import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

import type { Id } from '@/backend';
import { cn } from '@/lib/utils';

export const GROUPS_LIST = 'groups';

type Sorted = { list: string; items: Id[] };

const listOf = (data: { current?: Record<string, unknown> } | undefined) =>
  (data?.current?.sorted as Sorted | undefined)?.list;

const withinList: CollisionDetection = (args) =>
  closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter(
      (container) => listOf(container.data) === listOf(args.active.data),
    ),
  });

/** Drag-to-reorder for the sidebar; a row only moves among the rows of its own list. */
export function NavDnd({
  onMove,
  children,
}: {
  onMove: (list: string, id: Id, before: Id | null) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const from = active.data.current?.sorted as Sorted | undefined;
    const to = over?.data.current?.sorted as Sorted | undefined;
    if (!from || !to || from.list !== to.list || active.id === over?.id) return;
    const items = arrayMove(
      from.items,
      from.items.indexOf(String(active.id)),
      from.items.indexOf(String(over!.id)),
    );
    const at = items.indexOf(String(active.id));
    onMove(from.list, String(active.id), items[at + 1] ?? null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={withinList}
      onDragEnd={onDragEnd}
    >
      {children}
    </DndContext>
  );
}

export function SortableList({
  items,
  children,
}: {
  items: Id[];
  children: ReactNode;
}) {
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

/** A list item that drags by `handle` (the whole item when left out). */
export function SortableItem({
  id,
  list,
  items,
  handle,
  children,
}: {
  id: Id;
  list: string;
  items: Id[];
  handle?: (drag: {
    ref: (node: HTMLElement | null) => void;
    listeners: ReturnType<typeof useSortable>['listeners'];
  }) => ReactNode;
  children?: ReactNode;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { sorted: { list, items } satisfies Sorted } });

  return (
    <li
      ref={setNodeRef}
      {...(handle ? {} : listeners)}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'touch-none',
        isDragging && 'relative z-10 rounded-md bg-white/[.08] opacity-80',
      )}
    >
      {handle?.({ ref: setActivatorNodeRef, listeners })}
      {children}
    </li>
  );
}
