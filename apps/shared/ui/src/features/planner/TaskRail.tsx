import { useDraggable } from '@dnd-kit/core';
import { GripVerticalIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Id, Task } from '@/backend';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { useTasks } from '@/features/tasks/api';
import { formatDue, isOverdue } from '@/features/tasks/meta';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import {
  type DateKey,
  formatDayLabel,
  formatEstimate,
  formatMinutesOfDay,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { WeekPlan } from './PlanStrip';
import { isDueInAnotherWeek } from './period';

export type TaskDragData = { kind: 'task'; task: Task };

export function DraggableTask({
  task,
  source,
  plannedCount = 0,
  className,
}: {
  task: Task;
  source: string;
  plannedCount?: number;
  className?: string;
}) {
  const index = useProjectIndex();
  const { openTask } = useTaskDialog();
  const project =
    task.projectId === null ? undefined : index.byId.get(task.projectId);
  const today = todayKey();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${source}:${task.id}`,
    data: { kind: 'task', task } satisfies TaskDragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Open ${task.title}, or drag it onto the week`}
      onClick={() => openTask(task.id)}
      className={cn(
        'group/rail flex min-w-0 cursor-grab touch-none items-start gap-2 rounded-md border bg-card px-2.5 py-2 text-sm outline-none select-none hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        isDragging && 'opacity-40',
        className,
      )}
    >
      <ProjectDot color={project?.color} className="mt-1.5" />
      <div className="min-w-0 flex-1">
        <p className="truncate leading-snug">{task.title}</p>
        <p className="mt-0.5 flex gap-2 text-xs text-muted-foreground">
          {task.dueDate && (
            <span className={cn(isOverdue(task, today) && 'text-earlier')}>
              {task.dueUntil
                ? formatDue(task, today)
                : formatDayLabel(task.dueDate, today)}
            </span>
          )}
          {task.estimateMinutes !== null && (
            <span>{formatEstimate(task.estimateMinutes)}</span>
          )}
          {plannedCount > 0 ? (
            <span>Planned{plannedCount > 1 ? ` ×${plannedCount}` : ''}</span>
          ) : (
            task.dueTime !== null && (
              <span>Planned {formatMinutesOfDay(task.dueTime)}</span>
            )
          )}
        </p>
      </div>
      <GripVerticalIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/rail:opacity-100" />
    </div>
  );
}

export function TaskRail({
  week,
  plannedCounts,
}: {
  week: DateKey;
  plannedCounts: Map<Id, number>;
}) {
  const { newTask } = useTaskDialog();
  const { data: tasks } = useTasks();
  const [search, setSearch] = useState('');

  const { earlier, dueSoon, undated } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = todayKey();
    const open = (tasks ?? []).filter(
      (task) =>
        task.completedAt === null &&
        task.kind === 'task' &&
        (task.dueDate === null ||
          isOverdue(task, today) ||
          !isDueInAnotherWeek(task.dueUntil ?? task.dueDate, week, today)) &&
        (!query || task.title.toLowerCase().includes(query)),
    );
    return {
      earlier: open.filter((task) => isOverdue(task, today)),
      dueSoon: open.filter(
        (task) => task.dueDate !== null && !isOverdue(task, today),
      ),
      undated: open.filter((task) => task.dueDate === null),
    };
  }, [tasks, search, week]);

  return (
    <aside
      aria-label="Plan the week"
      className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-[rgba(6,18,26,.35)] backdrop-blur-xl max-lg:pb-20"
    >
      <WeekPlan start={week} />
      <div className="grid gap-2 p-3">
        <button
          type="button"
          onClick={() => newTask()}
          className="flex h-8 items-center gap-2 rounded-md border border-dashed px-2.5 text-sm text-muted-foreground hover:border-solid hover:bg-card hover:text-foreground"
        >
          <PlusIcon className="size-3.5" />
          New task
        </button>
        <label className="flex h-8 items-center gap-2 rounded-md bg-muted px-2.5 text-sm">
          <SearchIcon className="size-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter tasks"
            aria-label="Filter tasks"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <div className="p-3 pt-1">
        <RailSection
          title="From earlier days"
          tasks={earlier}
          plannedCounts={plannedCounts}
        />
        <RailSection
          title="Due this week"
          tasks={dueSoon}
          plannedCounts={plannedCounts}
        />
        <RailSection
          title="No due date"
          tasks={undated}
          plannedCounts={plannedCounts}
        />
        {earlier.length + dueSoon.length + undated.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {search
              ? 'No task matches.'
              : 'No open tasks. Add one with New task, then drag it onto a day to plan when you’ll do it, or onto a day’s name to give it that date.'}
          </p>
        )}
      </div>
    </aside>
  );
}

function RailSection({
  title,
  tasks,
  plannedCounts,
}: {
  title: string;
  tasks: Task[];
  plannedCounts: Map<Id, number>;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="mb-5">
      <h3 className="mb-2 font-sans text-xs font-semibold text-muted-foreground">
        {title} <span className="font-normal">{tasks.length}</span>
      </h3>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
        {tasks.map((task) => (
          <DraggableTask
            key={task.id}
            task={task}
            source="rail"
            plannedCount={plannedCounts.get(task.id)}
          />
        ))}
      </div>
    </section>
  );
}
