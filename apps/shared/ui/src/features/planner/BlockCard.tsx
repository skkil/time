import { useDraggable } from '@dnd-kit/core';
import {
  CheckIcon,
  PencilIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  type CSSProperties,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { TimeBlock } from '@/backend';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { ProjectLink } from '@/features/projects/ProjectLink';
import { useProjectIndex } from '@/features/projects/api';
import { projectPath } from '@/features/projects/tree';
import { TaskLink } from '@/features/tasks/TaskLink';
import { useSetTaskCompleted } from '@/features/tasks/api';
import { priorityTint } from '@/features/tasks/meta';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { useStartTimer } from '@/features/time/api';
import { formatDuration, formatMinutesOfDay } from '@/lib/time';
import { cn } from '@/lib/utils';

import { DAY_MINUTES, MIN_BLOCK_MINUTES, clamp, snap } from './geometry';
import { useTimeScale } from './scale';

export type BlockDragData = {
  kind: 'block';
  block: TimeBlock;
  duration: number;
};

type BlockCardProps = {
  block: TimeBlock;
  start: number;
  end: number;
  lane: number;
  lanes: number;
  running: boolean;
  onResize: (end: number) => void;
  onRemove: () => void;
};

export function BlockCard({
  block,
  start,
  end,
  lane,
  lanes,
  running,
  onResize,
  onRemove,
}: BlockCardProps) {
  const index = useProjectIndex();
  const complete = useSetTaskCompleted();
  const startTimer = useStartTimer();
  const { openTask } = useTaskDialog();
  const [open, setOpen] = useState(false);
  const [resizeEnd, setResizeEnd] = useState<number | null>(null);
  const resizeOrigin = useRef<{ y: number; end: number } | null>(null);
  const project =
    block.projectId === null ? undefined : index.byId.get(block.projectId);
  const shownEnd = resizeEnd ?? end;
  const minutes = shownEnd - start;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block:${block.id}`,
    data: {
      kind: 'block',
      block,
      duration: (block.endAt - block.startAt) / 60,
    } satisfies BlockDragData,
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

  const scale = useTimeScale();
  const tint = priorityTint(block.priority);
  const fill = `color-mix(in oklab, ${tint} var(--block-tint), var(--card))`;
  const style: CSSProperties = {
    top: scale.top(start),
    height: Math.max(scale.extent(start, start + minutes) - 2, 14),
    left: `calc(${(lane / lanes) * 100}% + 2px)`,
    width: `calc(${100 / lanes}% - 4px)`,
    background: `linear-gradient(${fill}, ${fill}), var(--card-under, transparent)`,
    borderColor: `color-mix(in oklab, ${tint} var(--block-edge), var(--card))`,
    borderLeft: `3px solid ${tint}`,
  };

  const beginResize = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeOrigin.current = { y: event.clientY, end };
    setResizeEnd(end);
  };

  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    const origin = resizeOrigin.current;
    if (!origin) return;
    const next = snap(
      scale.minuteAt(scale.top(origin.end) + event.clientY - origin.y),
    );
    setResizeEnd(clamp(next, start + MIN_BLOCK_MINUTES, DAY_MINUTES));
  };

  const endResize = () => {
    if (resizeOrigin.current && resizeEnd !== null && resizeEnd !== end)
      onResize(resizeEnd);
    resizeOrigin.current = null;
    setResizeEnd(null);
  };

  const height = scale.extent(start, start + minutes);
  const compact = height < 36;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          role="button"
          data-grid-card
          aria-label={`${block.title}, ${formatMinutesOfDay(start)} to ${formatMinutesOfDay(shownEnd)}`}
          onClick={() => !suppressClick.current && setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setOpen(true);
            listeners?.onKeyDown?.(event);
          }}
          style={style}
          className={cn(
            'group/block absolute z-10 flex touch-none overflow-hidden rounded-md border px-2 text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
            compact ? 'items-center gap-1.5 py-0' : 'flex-col py-1',
            isDragging && 'opacity-40',
            running && 'ring-2 ring-now',
            block.completed && 'opacity-60',
            lanes > 1 &&
              'hover:left-[2px]! hover:z-30 hover:w-[calc(100%-4px)]! hover:shadow-[0_8px_24px_rgba(0,0,0,.35)] hover:[--card-under:rgb(22_34_52)] focus-visible:left-[2px]! focus-visible:z-30 focus-visible:w-[calc(100%-4px)]!',
          )}
        >
          <span
            className={cn(
              'text-[13px] leading-tight font-semibold',
              height >= 72 ? 'line-clamp-2' : 'truncate',
              block.completed && 'line-through',
            )}
          >
            {block.title}
          </span>
          <span className="truncate text-[11px] leading-tight text-muted-foreground">
            {formatMinutesOfDay(start)}
            {!compact && `–${formatMinutesOfDay(shownEnd % DAY_MINUTES)}`}
          </span>
          {minutes >= 30 && (
            <div
              aria-hidden
              onPointerDown={beginResize}
              onPointerMove={moveResize}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onClick={(event) => event.stopPropagation()}
              className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover/block:opacity-100"
            >
              <div className="mx-auto mt-0.5 h-0.5 w-6 rounded-full bg-foreground/30" />
            </div>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent side="right" align="start" className="w-72">
        <div className="grid gap-3">
          <div>
            <TaskLink
              taskId={block.taskId}
              className="leading-snug font-medium"
            >
              {block.title}
            </TaskLink>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMinutesOfDay(start)}–
              {formatMinutesOfDay(end % DAY_MINUTES)} ·{' '}
              {formatDuration(minutes * 60)}
            </p>
            {project && (
              <ProjectLink
                projectId={project.id}
                className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <ProjectDot color={project.color} />
                {projectPath(index, project.id)}
              </ProjectLink>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              disabled={running || block.completed}
              onClick={() => {
                startTimer.mutate({
                  description: block.title,
                  projectId: block.projectId,
                  taskId: block.taskId,
                });
                setOpen(false);
              }}
            >
              <PlayIcon />
              {running ? 'Focusing' : 'Start focus'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                complete.mutate({
                  id: block.taskId,
                  completed: !block.completed,
                })
              }
            >
              {block.completed ? <RotateCcwIcon /> : <CheckIcon />}
              {block.completed ? 'Reopen' : 'Done'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                openTask(block.taskId);
              }}
            >
              <PencilIcon />
              Edit task
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
            >
              <Trash2Icon />
              Unplan
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
