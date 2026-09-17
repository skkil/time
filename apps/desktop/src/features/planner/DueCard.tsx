import { useDraggable } from '@dnd-kit/core';
import { useEffect, useRef } from 'react';

import type { Task } from '@/bindings';
import { priorityTint } from '@/features/tasks/meta';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { formatMinutesOfDay } from '@/lib/time';
import { cn } from '@/lib/utils';

import type { TaskDragData } from './TaskRail';
import { DAY_MINUTES } from './geometry';
import { useTimeScale } from './scale';

export function DueCard({
  task,
  start,
  end,
  lane,
  lanes,
}: {
  task: Task;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}) {
  const { openTask } = useTaskDialog();
  const scale = useTimeScale();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `due-slot:${task.id}`,
    data: { kind: 'task', task } satisfies TaskDragData,
  });

  const suppressClick = useRef(false);
  useEffect(() => {
    if (isDragging) {
      suppressClick.current = true;
      return;
    }
    const id = window.setTimeout(() => (suppressClick.current = false), 0);
    return () => window.clearTimeout(id);
  }, [isDragging]);

  const tint = priorityTint(task.priority);
  const height = scale.extent(start, end);
  const compact = height < 36;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      data-grid-card
      aria-label={`${task.title}, due ${formatMinutesOfDay(start)}`}
      onClick={() => !suppressClick.current && openTask(task.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') openTask(task.id);
        listeners?.onKeyDown?.(event);
      }}
      className={cn(
        'absolute z-10 flex touch-none overflow-hidden rounded-md border px-2 text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
        compact ? 'items-center gap-1.5 py-0' : 'flex-col py-1',
        isDragging && 'opacity-40',
      )}
      style={{
        top: scale.top(start),
        height: Math.max(height - 2, 14),
        left: `calc(${(lane / lanes) * 100}% + 2px)`,
        width: `calc(${100 / lanes}% - 4px)`,
        background: `color-mix(in oklab, ${tint} var(--block-tint), var(--card))`,
        borderColor: `color-mix(in oklab, ${tint} var(--block-edge), var(--card))`,
        borderLeft: `3px solid ${tint}`,
      }}
    >
      <span className="truncate text-[13px] leading-tight font-semibold">
        {task.title}
      </span>
      <span className="truncate text-[11px] leading-tight text-muted-foreground">
        {formatMinutesOfDay(start)}
        {!compact && `–${formatMinutesOfDay(end % DAY_MINUTES)}`}
      </span>
    </div>
  );
}
