import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

import type { Task, TaskInput } from '@/bindings';
import { cn } from '@/lib/utils';

import { TaskEditor } from './TaskEditor';
import { TaskItem } from './TaskItem';
import { useMoveTask, useTaskIndex } from './api';
import { type Container, containerKey, containerOf } from './container';

const open = (task: Task) => task.completedAt === null;

function SortableTask({
  task,
  previous,
  showPlacement,
  variant,
}: {
  task: Task;
  previous?: Task;
  showPlacement: boolean;
  variant: 'row' | 'card';
}) {
  const index = useTaskIndex();
  const move = useMoveTask();
  const [expanded, setExpanded] = useState(true);
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });
  const children = (index.children.get(task.id) ?? []).filter(open);
  const parent =
    task.parentId === null ? undefined : index.byId.get(task.parentId);

  const indent = previous
    ? () =>
        move.mutate({
          id: task.id,
          placement: {
            ...containerOf(task),
            parentId: previous.id,
            before: null,
          },
        })
    : undefined;

  const outdent = parent
    ? () => {
        const siblings = (
          parent.parentId === null
            ? []
            : (index.children.get(parent.parentId) ?? [])
        ).filter(open);
        const after =
          siblings[siblings.findIndex((t) => t.id === parent.id) + 1];
        move.mutate({
          id: task.id,
          placement: {
            ...containerOf(parent),
            before: after?.id ?? null,
          },
        });
      }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: transition,
      }}
    >
      <TaskItem
        task={task}
        showPlacement={showPlacement}
        variant={variant}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((value) => !value)}
        onIndent={indent}
        onOutdent={outdent}
        dragging={isDragging}
        dragHandle={{
          attributes: attributes,
          listeners: listeners,
        }}
      />
      {expanded && children.length > 0 && variant === 'row' && (
        <TaskList
          tasks={children}
          container={{ ...containerOf(task), parentId: task.id }}
          className="ml-7"
        />
      )}
    </li>
  );
}

export function TaskList({
  tasks,
  container,
  showPlacement = false,
  variant = 'row',
  className,
}: {
  tasks: Task[];
  container: Container;
  showPlacement?: boolean;
  variant?: 'row' | 'card';
  className?: string;
}) {
  const key = containerKey(container);
  const { setNodeRef, isOver } = useDroppable({
    id: key,
    data: { type: 'container', container },
  });

  return (
    <SortableContext
      id={key}
      items={tasks.map((task) => task.id)}
      strategy={verticalListSortingStrategy}
    >
      <ul
        ref={setNodeRef}
        className={cn(
          'min-h-1',
          isOver && tasks.length === 0 && 'min-h-10 rounded-md bg-now-tint',
          className,
        )}
      >
        {tasks.map((task, i) => (
          <SortableTask
            key={task.id}
            task={task}
            previous={tasks[i - 1]}
            showPlacement={showPlacement}
            variant={variant}
          />
        ))}
      </ul>
    </SortableContext>
  );
}

export function FlatTaskList({ tasks }: { tasks: Task[] }) {
  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskItem task={task} showPlacement showParent />
        </li>
      ))}
    </ul>
  );
}

export function AddTaskRow({
  defaults,
  label = 'Add task',
}: {
  defaults: Partial<TaskInput>;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <TaskEditor
        defaults={defaults}
        keepOpen
        className="my-2"
        onClose={() => setEditing(false)}
      />
    );
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group/add flex h-9 w-full items-center gap-2.5 rounded-sm text-sm text-muted-foreground outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="grid size-[18px] place-items-center rounded-full text-now group-hover/add:bg-now group-hover/add:text-background">
        <PlusIcon className="size-3.5" strokeWidth={2.5} />
      </span>
      {label}
    </button>
  );
}
