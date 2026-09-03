import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Id, Task, TimeBlock, TimeEntry } from '@/bindings';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useProjectIndex } from '@/features/projects/api';
import { projectColorVar } from '@/features/projects/tree';
import { useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { useTimeEntries, useTimer } from '@/features/time/api';
import { useNow } from '@/hooks/use-now';
import {
  type DateKey,
  atMinutes,
  dateKeyOf,
  formatClockTime,
  formatDayOfMonth,
  formatDuration,
  formatMinutesOfDay,
  formatWeekday,
  minutesIntoDay,
  shiftKey,
  todayKey,
  weekKeys,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { BlockCard, type BlockDragData } from './BlockCard';
import { type BlockSlot, NewBlockDialog } from './NewBlockDialog';
import { DraggableTask, type TaskDragData, TaskRail } from './TaskRail';
import {
  useBlocks,
  useCreateBlock,
  useDeleteBlock,
  useRescheduleBlock,
} from './api';
import {
  DAY_MINUTES,
  DEFAULT_BLOCK_MINUTES,
  HOUR_HEIGHT,
  INITIAL_SCROLL_HOUR,
  PX_PER_MINUTE,
  layoutLanes,
  minutesAtOffset,
  placeSpan,
} from './geometry';
import { type RangeSelection, useRangeSelect } from './use-range-select';

type DragData = TaskDragData | BlockDragData;
type Preview = { day: DateKey; start: number; end: number };
type Span = { start: number; end: number };

const durationOf = (data: DragData) =>
  data.kind === 'block'
    ? data.duration
    : (data.task.estimateMinutes ?? DEFAULT_BLOCK_MINUTES);

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const ACTUAL_STRIP = 6;

function clipToDay(day: DateKey, startAt: number, endAt: number): Span | null {
  const dayStart = atMinutes(day, 0);
  const dayEnd = atMinutes(shiftKey(day, 1), 0);
  const start = Math.max(startAt, dayStart);
  const end = Math.min(endAt, dayEnd);
  if (end <= start) return null;
  return { start: (start - dayStart) / 60, end: (end - dayStart) / 60 };
}

export function ScheduleView({ week }: { week: DateKey }) {
  const days = useMemo(() => weekKeys(week), [week]);
  const today = todayKey();
  const { data: blocks = [] } = useBlocks(week);
  const { data: entries = [] } = useTimeEntries(
    shiftKey(week, -1),
    shiftKey(week, 7),
  );
  const { data: tasks = [] } = useTasks();
  const { data: timer } = useTimer();
  const createBlock = useCreateBlock(week);
  const reschedule = useRescheduleBlock(week);
  const removeBlock = useDeleteBlock(week);
  const now = useNow(60_000);

  const scroller = useRef<HTMLDivElement>(null);
  const columns = useRef(new Map<DateKey, HTMLElement>());
  const grabOffset = useRef(0);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const [active, setActive] = useState<DragData | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [slot, setSlot] = useState<BlockSlot | null>(null);
  const range = useRangeSelect({
    onSelect: (selected) => setSlot(selected),
    onClick: (day, start) => setSlot({ day, start, end: null }),
  });
  const closeSlot = () => {
    setSlot(null);
    range.clear();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  useLayoutEffect(() => {
    scroller.current?.scrollTo({
      top: INITIAL_SCROLL_HOUR * HOUR_HEIGHT - HOUR_HEIGHT / 3,
    });
  }, []);

  const plannedCounts = useMemo(() => {
    const counts = new Map<Id, number>();
    for (const block of blocks)
      counts.set(block.taskId, (counts.get(block.taskId) ?? 0) + 1);
    return counts;
  }, [blocks]);

  const dueByDay = useMemo(() => {
    const map = new Map<DateKey, Task[]>();
    for (const task of tasks) {
      if (task.completedAt !== null || task.dueDate === null) continue;
      map.set(task.dueDate, [...(map.get(task.dueDate) ?? []), task]);
    }
    return map;
  }, [tasks]);

  const registerColumn = useCallback(
    (day: DateKey, element: HTMLElement | null) => {
      if (element) columns.current.set(day, element);
      else columns.current.delete(day);
    },
    [],
  );

  const updatePreview = useCallback((data: DragData) => {
    const at = pointer.current;
    const viewport = scroller.current?.getBoundingClientRect();
    let next: Preview | null = null;
    if (at && viewport && at.y >= viewport.top && at.y <= viewport.bottom) {
      for (const [day, column] of columns.current) {
        const rect = column.getBoundingClientRect();
        if (at.x < rect.left || at.x >= rect.right) continue;
        const span = placeSpan(
          minutesAtOffset(at.y - grabOffset.current - rect.top),
          durationOf(data),
        );
        next = { day, ...span };
        break;
      }
    }
    previewRef.current = next;
    setPreview((current) =>
      current?.day === next?.day &&
      current?.start === next?.start &&
      current?.end === next?.end
        ? current
        : next,
    );
  }, []);

  useEffect(() => {
    if (!active) return;
    const onPointerMove = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      updatePreview(active);
    };
    const onScroll = () => updatePreview(active);
    const area = scroller.current;
    window.addEventListener('pointermove', onPointerMove);
    area?.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      area?.removeEventListener('scroll', onScroll);
    };
  }, [active, updatePreview]);

  const onDragStart = ({ active: dragged, activatorEvent }: DragStartEvent) => {
    const data = dragged.data.current as DragData | undefined;
    if (!data) return;
    const event = activatorEvent as PointerEvent;
    const card = (event.target as HTMLElement | null)?.closest(
      '[data-block-id]',
    );
    grabOffset.current =
      data.kind === 'block' && card
        ? event.clientY - card.getBoundingClientRect().top
        : 0;
    pointer.current = { x: event.clientX, y: event.clientY };
    setActive(data);
  };

  const finishDrag = () => {
    setActive(null);
    setPreview(null);
    previewRef.current = null;
    pointer.current = null;
  };

  const onDragEnd = () => {
    const preview = previewRef.current;
    if (active && preview) {
      const span = {
        startAt: atMinutes(preview.day, preview.start),
        endAt: atMinutes(preview.day, preview.end),
      };
      if (active.kind === 'block') {
        if (span.startAt !== active.block.startAt)
          reschedule.mutate({ id: active.block.id, span });
      } else {
        createBlock.mutate({ taskId: active.task.id, span });
      }
    }
    finishDrag();
  };

  const planTask = (task: Task, target: BlockSlot) => {
    const span =
      target.end === null
        ? placeSpan(target.start, task.estimateMinutes ?? DEFAULT_BLOCK_MINUTES)
        : { start: target.start, end: target.end };
    createBlock.mutate({
      taskId: task.id,
      span: {
        startAt: atMinutes(target.day, span.start),
        endAt: atMinutes(target.day, span.end),
      },
    });
    closeSlot();
  };

  const runningEntry: TimeEntry | null = timer
    ? { id: -1, ...timer, endedAt: Math.max(now, timer.startedAt + 60) }
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={finishDrag}
      autoScroll={{ threshold: { x: 0, y: 0.15 } }}
    >
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="grid shrink-0 grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b bg-background">
            <div />
            {days.map((day) => (
              <DayHeader
                key={day}
                day={day}
                today={today}
                due={dueByDay.get(day) ?? []}
              />
            ))}
          </div>

          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
            <div
              className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]"
              style={{ height: 24 * HOUR_HEIGHT }}
            >
              <div className="relative">
                {HOURS.slice(1).map((hour) => (
                  <span
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground"
                    style={{ top: hour * HOUR_HEIGHT }}
                  >
                    {formatMinutesOfDay(hour * 60)}
                  </span>
                ))}
              </div>
              {days.map((day) => (
                <DayColumn
                  key={day}
                  day={day}
                  isToday={day === today}
                  now={now}
                  blocks={blocks}
                  entries={runningEntry ? [...entries, runningEntry] : entries}
                  runningTaskId={timer?.taskId ?? null}
                  preview={preview?.day === day ? preview : null}
                  register={registerColumn}
                  selection={
                    range.selection?.day === day ? range.selection : null
                  }
                  onEmptyPointerDown={(event) => range.begin(day, event)}
                  onResize={(block, end) =>
                    reschedule.mutate({
                      id: block.id,
                      span: {
                        startAt: block.startAt,
                        endAt: atMinutes(day, end),
                      },
                    })
                  }
                  onRemove={(block) => removeBlock.mutate(block.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <TaskRail week={week} plannedCounts={plannedCounts} />
      </div>

      <DragOverlay dropAnimation={null}>
        {active && !preview && (
          <div className="pointer-events-none max-w-56 truncate rounded-md border bg-popover px-2.5 py-1.5 text-sm shadow-[0_8px_24px_rgba(26,29,33,.14)]">
            {active.kind === 'block' ? active.block.title : active.task.title}
          </div>
        )}
      </DragOverlay>

      <NewBlockDialog slot={slot} onClose={closeSlot} onPick={planTask} />
    </DndContext>
  );
}

function DayHeader({
  day,
  today,
  due,
}: {
  day: DateKey;
  today: DateKey;
  due: Task[];
}) {
  const { openTask } = useTaskDialog();
  const isToday = day === today;
  const visible = due.slice(0, 2);

  return (
    <div className="min-w-0 border-l px-2 pt-2 pb-2">
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'text-xs font-medium text-muted-foreground',
            isToday && 'text-foreground',
          )}
        >
          {formatWeekday(day)}
        </span>
        <span
          className={cn(
            'font-heading text-lg leading-none font-medium',
            isToday && 'rounded-sm bg-today px-1 text-today-foreground',
          )}
        >
          {formatDayOfMonth(day)}
        </span>
      </div>
      <div className="mt-1.5 grid min-h-6 grid-cols-[minmax(0,1fr)] gap-1">
        {visible.map((task) => (
          <DraggableTask
            key={task.id}
            task={task}
            source={`due-${day}`}
            className={cn(
              'px-1.5 py-0.5 text-xs [&_p+p]:hidden [&_svg]:hidden',
              day < today && 'border-attention/50',
            )}
          />
        ))}
        {due.length > visible.length && (
          <button
            type="button"
            onClick={() => openTask(due[visible.length].id)}
            className="text-left text-xs text-muted-foreground hover:text-foreground"
          >
            +{due.length - visible.length} more due
          </button>
        )}
      </div>
    </div>
  );
}

type DayColumnProps = {
  day: DateKey;
  isToday: boolean;
  now: number;
  blocks: TimeBlock[];
  entries: TimeEntry[];
  runningTaskId: Id | null;
  preview: Preview | null;
  register: (day: DateKey, element: HTMLElement | null) => void;
  selection: RangeSelection | null;
  onEmptyPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResize: (block: TimeBlock, end: number) => void;
  onRemove: (block: TimeBlock) => void;
};

function DayColumn({
  day,
  isToday,
  now,
  blocks,
  entries,
  runningTaskId,
  preview,
  register,
  selection,
  onEmptyPointerDown,
  onResize,
  onRemove,
}: DayColumnProps) {
  const index = useProjectIndex();
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}` });

  useEffect(() => () => register(day, null), [day, register]);

  const placed = useMemo(() => {
    const own = blocks
      .filter((block) => dateKeyOf(block.startAt) === day)
      .map((block) => {
        const start = minutesIntoDay(block.startAt);
        return {
          block,
          start,
          end: Math.min(
            start + (block.endAt - block.startAt) / 60,
            DAY_MINUTES,
          ),
        };
      });
    const lanes = layoutLanes(
      own.map(({ block, start, end }) => ({ id: block.id, start, end })),
    );
    return own.map((item) => ({
      ...item,
      ...(lanes.get(item.block.id) ?? { lane: 0, lanes: 1 }),
    }));
  }, [blocks, day]);

  const actual = useMemo(
    () =>
      entries
        .map((entry) => ({
          entry,
          span: clipToDay(day, entry.startedAt, entry.endedAt),
        }))
        .filter(
          (item): item is { entry: TimeEntry; span: Span } =>
            item.span !== null,
        ),
    [entries, day],
  );

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        register(day, node);
      }}
      onPointerDown={onEmptyPointerDown}
      className={cn(
        'relative border-l transition-colors',
        isToday && 'bg-today-tint/50',
        isOver && 'bg-accent/60',
      )}
      style={{
        backgroundImage: `linear-gradient(to bottom, var(--border) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 45%, transparent) 1px, transparent 1px)`,
        backgroundSize: `100% ${HOUR_HEIGHT}px, 100% ${HOUR_HEIGHT / 2}px`,
        paddingRight: ACTUAL_STRIP + 2,
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0"
        style={{ right: ACTUAL_STRIP + 2 }}
      >
        <div className="pointer-events-auto">
          {placed.map(({ block, start, end, lane, lanes }) => (
            <BlockCard
              key={block.id}
              block={block}
              start={start}
              end={end}
              lane={lane}
              lanes={lanes}
              running={runningTaskId === block.taskId}
              onResize={(next) => onResize(block, next)}
              onRemove={() => onRemove(block)}
            />
          ))}
        </div>
        {selection && (
          <div
            className="absolute inset-x-0.5 z-20 overflow-hidden rounded-md bg-foreground/15 px-2 py-1 text-[12px]"
            style={{
              top: selection.start * PX_PER_MINUTE,
              height: (selection.end - selection.start) * PX_PER_MINUTE - 2,
            }}
          >
            <span>
              {formatMinutesOfDay(selection.start)}–
              {formatMinutesOfDay(selection.end % DAY_MINUTES)}
            </span>
          </div>
        )}
        {preview && (
          <div
            className="absolute inset-x-0.5 z-20 overflow-hidden rounded-md border-2 border-dashed border-ring bg-now-tint/80 px-2 py-1 text-[12px] text-now"
            style={{
              top: preview.start * PX_PER_MINUTE,
              height: (preview.end - preview.start) * PX_PER_MINUTE - 2,
            }}
          >
            <span>
              {formatMinutesOfDay(preview.start)}–
              {formatMinutesOfDay(preview.end % DAY_MINUTES)}
            </span>
          </div>
        )}
      </div>

      <div
        className="absolute inset-y-0 right-0.5"
        style={{ width: ACTUAL_STRIP - 2 }}
      >
        {actual.map(({ entry, span }) => {
          const project =
            entry.projectId === null
              ? undefined
              : index.byId.get(entry.projectId);
          return (
            <Tooltip key={entry.id}>
              <TooltipTrigger asChild>
                <div
                  className="absolute inset-x-0 rounded-full"
                  style={{
                    top: span.start * PX_PER_MINUTE,
                    height: Math.max(
                      (span.end - span.start) * PX_PER_MINUTE,
                      3,
                    ),
                    background: project
                      ? projectColorVar(project.color)
                      : 'var(--muted-foreground)',
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{entry.description || project?.name || 'Tracked time'}</p>
                <p className="text-xs opacity-80">
                  {formatClockTime(entry.startedAt)}–
                  {entry.id === -1 ? 'now' : formatClockTime(entry.endedAt)} ·{' '}
                  {formatDuration(entry.endedAt - entry.startedAt)}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {isToday && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-30 h-0.5 bg-now"
          style={{ top: minutesIntoDay(now) * PX_PER_MINUTE }}
        >
          <div className="absolute -top-[3px] -left-[4px] size-2 rounded-full bg-now" />
        </div>
      )}
    </div>
  );
}
