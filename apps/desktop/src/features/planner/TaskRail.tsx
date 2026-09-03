import { useDraggable } from '@dnd-kit/core';
import { GripVerticalIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Id, Task } from '@/bindings';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import {
  type DateKey,
  formatDayLabel,
  formatEstimate,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

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
      aria-label={`Drag ${task.title} onto the week`}
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
            <span className={cn(task.dueDate < today && 'text-attention')}>
              {formatDayLabel(task.dueDate, today)}
            </span>
          )}
          {task.estimateMinutes !== null && (
            <span>{formatEstimate(task.estimateMinutes)}</span>
          )}
          {plannedCount > 0 && (
            <span>Planned{plannedCount > 1 ? ` ×${plannedCount}` : ''}</span>
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
  const weekEnd = shiftKey(week, 7);

  const { dueSoon, rest } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const open = (tasks ?? []).filter(
      (task) =>
        task.completedAt === null &&
        (!query || task.title.toLowerCase().includes(query)),
    );
    return {
      dueSoon: open.filter(
        (task) => task.dueDate !== null && task.dueDate < weekEnd,
      ),
      rest: open.filter(
        (task) => task.dueDate === null || task.dueDate >= weekEnd,
      ),
    };
  }, [tasks, search, weekEnd]);

  return (
    <aside
      aria-label="Tasks to plan"
      className="flex w-72 shrink-0 flex-col border-l bg-background"
    >
      <div className="grid gap-2 border-b p-3">
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
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-3 text-xs text-muted-foreground">
          Drag a task onto the week to give it a time.
        </p>
        <RailSection
          title="Due this week"
          tasks={dueSoon}
          plannedCounts={plannedCounts}
        />
        <RailSection
          title="Everything else"
          tasks={rest}
          plannedCounts={plannedCounts}
        />
        {dueSoon.length + rest.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {search ? 'No task matches.' : 'No open tasks.'}
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
