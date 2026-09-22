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

import { TaskItem } from './TaskItem';
import { useTaskIndex } from './api';
import {
  type Container,
  MAX_INDENTED_DEPTH,
  containerKey,
  containerOf,
} from './container';
import { useTaskDialog } from './task-dialog-context';

const open = (task: Task) => task.completedAt === null;

function SortableTask({
  task,
  showPlacement,
  variant,
  depth,
}: {
  task: Task;
  showPlacement: boolean;
  variant: 'row' | 'card';
  depth: number;
}) {
  const index = useTaskIndex();
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
          depth={depth + 1}
          className={cn(depth < MAX_INDENTED_DEPTH && 'ml-7')}
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
  depth = 0,
  className,
}: {
  tasks: Task[];
  container: Container;
  showPlacement?: boolean;
  variant?: 'row' | 'card';
  depth?: number;
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
        {tasks.map((task) => (
          <SortableTask
            key={task.id}
            task={task}
            showPlacement={showPlacement}
            variant={variant}
            depth={depth}
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
  className,
}: {
  defaults: Partial<TaskInput>;
  label?: string;
  className?: string;
}) {
  const { newTask } = useTaskDialog();
  return (
    <button
      type="button"
      onClick={() => newTask(defaults)}
      className={cn(
        'group/add flex h-9 w-full items-center gap-2.5 rounded-sm text-sm text-foreground/75 outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      <PlusIcon className="size-[18px]" strokeWidth={1.5} />
      {label}
    </button>
  );
}
