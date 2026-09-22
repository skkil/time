import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import type { Id, Task } from '@/bindings';
import { TaskItem } from '@/features/tasks/TaskItem';
import { useMoveTask, useRescheduleTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';

import { TypeIcon } from './TypeIcon';
import {
  isClosed,
  useSetTaskMilestone,
  useSetTaskStatus,
  useSetTaskType,
} from './api';
import { type Group, daysSince, groupDefaults } from './views';

export function BoardView({
  groups,
  projectId,
  archived,
  showAge,
}: {
  groups: Group[];
  projectId: Id;
  archived: boolean;
  showAge: boolean;
}) {
  const setStatus = useSetTaskStatus();
  const setType = useSetTaskType();
  const setMilestone = useSetTaskMilestone();
  const move = useMoveTask();
  const reschedule = useRescheduleTasks();
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const drop = ({ active, over }: DragEndEvent) => {
    const group = groups.find((g) => g.key === over?.id);
    const task = active.data.current?.task as Task | undefined;
    if (!group || !task) return;
    const value = group.value;
    if (value.by === 'status' && task.statusId !== value.id)
      setStatus.mutate({ id: task.id, statusId: value.id });
    if (value.by === 'type' && task.typeId !== value.id)
      setType.mutate({ id: task.id, typeId: value.id });
    if (value.by === 'milestone' && task.milestoneId !== value.id)
      setMilestone.mutate({ id: task.id, milestoneId: value.id });
    if (value.by === 'section' && task.sectionId !== value.id)
      move.mutate({
        id: task.id,
        placement: {
          projectId,
          sectionId: value.id,
          parentId: null,
          before: null,
        },
      });
    if (value.by === 'date' && task.dueDate !== value.date)
      reschedule.mutate({ ids: [task.id], dueDate: value.date });
  };

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="flex h-full items-start gap-3 px-10 py-4">
        <DndContext sensors={sensors} onDragEnd={drop}>
          {groups.map((group) => (
            <Column
              key={group.key}
              group={group}
              projectId={projectId}
              archived={archived}
              showAge={showAge}
              folded={
                isClosed(group.category ?? null) && !opened.has(group.key)
              }
              onUnfold={() => setOpened(new Set([...opened, group.key]))}
              onFold={() =>
                setOpened(new Set([...opened].filter((k) => k !== group.key)))
              }
            />
          ))}
        </DndContext>
      </div>
    </div>
  );
}

function Column({
  group,
  projectId,
  archived,
  showAge,
  folded,
  onUnfold,
  onFold,
}: {
  group: Group;
  projectId: Id;
  archived: boolean;
  showAge: boolean;
  folded: boolean;
  onUnfold: () => void;
  onFold: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: group.key });
  const { newTask } = useTaskDialog();
  if (folded)
    return (
      <button
        ref={setNodeRef}
        type="button"
        onClick={onUnfold}
        aria-label={`Show ${group.label}, ${group.tasks.length} items`}
        className={cn(
          'flex h-48 w-11 shrink-0 flex-col items-center gap-2 rounded-2xl bg-white/[.03] py-3 text-xs text-foreground/75 ring-1 ring-white/[.06] transition-colors hover:text-foreground',
          isOver && 'bg-white/[.08]',
        )}
      >
        <span className="tabular-nums">{group.tasks.length}</span>
        <span className="[writing-mode:vertical-rl]">{group.label}</span>
      </button>
    );
  return (
    <section
      ref={setNodeRef}
      aria-label={group.label}
      className={cn(
        'flex max-h-full w-72 shrink-0 flex-col rounded-2xl bg-white/[.04] ring-1 ring-white/[.07] backdrop-blur-md transition-colors',
        isOver && 'bg-white/[.08]',
      )}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 px-3 text-sm">
        {group.icon && <TypeIcon icon={group.icon} />}
        <h2 className="truncate">{group.label}</h2>
        <span className="text-xs text-foreground/75 tabular-nums">
          {group.tasks.length}
        </span>
        {isClosed(group.category ?? null) && (
          <button
            type="button"
            onClick={onFold}
            className="ml-auto text-xs text-foreground/75 hover:text-foreground"
          >
            Fold
          </button>
        )}
      </header>
      <ul className="grid min-h-8 content-start gap-1.5 overflow-y-auto px-2 pb-2">
        {group.tasks.map((task) => (
          <Card key={task.id} task={task} showAge={showAge} />
        ))}
      </ul>
      {!archived && group.value.by !== 'none' && (
        <button
          type="button"
          onClick={() => newTask(groupDefaults(group, projectId))}
          className="mx-3 mb-2 flex h-8 items-center gap-2 text-sm text-foreground/75 hover:text-foreground"
        >
          <PlusIcon className="size-4" strokeWidth={1.5} />
          Add
        </button>
      )}
    </section>
  );
}

function Card({ task, showAge }: { task: Task; showAge: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } =
    useDraggable({ id: `task-${task.id}`, data: { task } });
  const now = useNow(3_600_000, showAge);
  const age = daysSince(task, now);
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn('relative touch-none', isDragging && 'z-50 opacity-80')}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
    >
      <TaskItem task={task} variant="card" />
      {showAge && (
        <span className="pointer-events-none absolute right-3 bottom-2 text-[11px] text-foreground/75">
          {age === 0 ? 'moved today' : `${age}d since last move`}
        </span>
      )}
    </li>
  );
}
