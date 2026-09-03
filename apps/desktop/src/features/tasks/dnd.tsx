import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { type ReactNode, useState } from 'react';

import type { Id, Task } from '@/bindings';

import { useMoveTask, useTasks } from './api';
import {
  type Container,
  type DropData,
  containerOf,
  openSiblings,
} from './container';

export function TaskDnd({ children }: { children: ReactNode }) {
  const { data: tasks } = useTasks();
  const move = useMoveTask();
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragStart = ({ active: dragged }: DragStartEvent) => {
    const data = dragged.data.current as DropData | undefined;
    if (data?.type === 'task') setActive(data.task);
  };

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    setActive(null);
    const data = dragged.data.current as DropData | undefined;
    const target = over?.data.current as DropData | undefined;
    if (!data || data.type !== 'task' || !target || dragged.id === over?.id)
      return;
    const task = data.task;

    let container: Container;
    let before: Id | null = null;
    if (target.type === 'container') {
      container = target.container;
    } else {
      container = containerOf(target.task);
      const siblings = openSiblings(tasks ?? [], container).map((t) => t.id);
      const from = siblings.indexOf(task.id);
      const to = siblings.indexOf(target.task.id);
      before =
        from !== -1 && from < to ? (siblings[to + 1] ?? null) : target.task.id;
    }
    move.mutate({ id: task.id, placement: { ...container, before } });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="max-w-md truncate rounded-md border bg-card px-3 py-2 text-sm shadow-lg">
            {active.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
