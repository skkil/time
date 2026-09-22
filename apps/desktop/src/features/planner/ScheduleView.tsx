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
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  EventOccurrence,
  Id,
  Task,
  TimeBlock,
  TimeEntry,
} from '@/bindings';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useProjectIndex } from '@/features/projects/api';
import { projectColorVar } from '@/features/projects/tree';
import { useTaskIndex, useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { EntryDialog } from '@/features/time/EntryDialog';
import { useTimeEntries, useTimer } from '@/features/time/api';
import { MIN_ENTRY_HEIGHT, trackedFill } from '@/features/time/tracked';
import { useEvents } from '@/features/workflow/api';
import { useNow } from '@/hooks/use-now';
import { usePreference } from '@/lib/preferences';
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
import { DueCard } from './DueCard';
import { EventCard } from './EventCard';
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
  FIT_FROM_HOUR,
  layoutLanes,
  minutesAtOffset,
  placeSpan,
} from './geometry';
import { TimeScaleContext, useTimeScale } from './scale';
import {
  type ScaleSegment,
  createTimeScale,
  fitHourHeight,
} from './time-scale';
import { type RangeSelection, useRangeSelect } from './use-range-select';

type DragData = TaskDragData | BlockDragData;
type Preview = { day: DateKey; start: number; end: number };
type Span = { start: number; end: number };

const durationOf = (data: DragData) =>
  data.kind === 'block'
    ? data.duration
    : (data.task.estimateMinutes ?? DEFAULT_BLOCK_MINUTES);

function clipToDay(day: DateKey, startAt: number, endAt: number): Span | null {
  const dayStart = atMinutes(day, 0);
  const dayEnd = atMinutes(shiftKey(day, 1), 0);
  const start = Math.max(startAt, dayStart);
  const end = Math.min(endAt, dayEnd);
  if (end <= start) return null;
  return { start: (start - dayStart) / 60, end: (end - dayStart) / 60 };
}

export function ScheduleView({
  week,
  aside,
}: {
  week: DateKey;
  aside?: ReactNode;
}) {
  const days = useMemo(() => weekKeys(week), [week]);
  const today = todayKey();
  const { data: blocks = [] } = useBlocks(week);
  const { data: events = [] } = useEvents(week, shiftKey(week, 7));
  const { data: entries = [] } = useTimeEntries(week, shiftKey(week, 7));
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
  const sleep = usePreference('sleep');
  const [viewport, setViewport] = useState(0);
  const scale = useMemo(
    () => createTimeScale(fitHourHeight(viewport, sleep), sleep),
    [viewport, sleep],
  );
  const [editingEntry, setEditingEntry] = useState<TimeEntry | undefined>();
  const previewRef = useRef<Preview | null>(null);
  const [active, setActive] = useState<DragData | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [slot, setSlot] = useState<BlockSlot | null>(null);
  const range = useRangeSelect({
    scale,
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
    const area = scroller.current;
    if (!area) return;
    const fit = () => setViewport(area.clientHeight);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    scroller.current?.scrollTo({ top: scale.top(FIT_FROM_HOUR * 60) - 6 });
  }, [scale]);

  const trackedByDay = useMemo(() => {
    const totals = new Map<DateKey, number>();
    for (const day of days)
      for (const entry of entries) {
        const span = clipToDay(day, entry.startedAt, entry.endedAt);
        if (span)
          totals.set(
            day,
            (totals.get(day) ?? 0) + (span.end - span.start) * 60,
          );
      }
    return totals;
  }, [days, entries]);

  const plannedCounts = useMemo(() => {
    const counts = new Map<Id, number>();
    for (const block of blocks)
      counts.set(block.taskId, (counts.get(block.taskId) ?? 0) + 1);
    return counts;
  }, [blocks]);

  const { dueByDay, timedByDay } = useMemo(() => {
    const due = new Map<DateKey, Task[]>();
    const timed = new Map<DateKey, Task[]>();
    for (const task of tasks) {
      if (
        task.completedAt !== null ||
        task.dueDate === null ||
        task.kind !== 'task'
      )
        continue;
      const target = task.dueTime === null ? due : timed;
      if (plannedCounts.has(task.id)) continue;
      target.set(task.dueDate, [...(target.get(task.dueDate) ?? []), task]);
    }
    return { dueByDay: due, timedByDay: timed };
  }, [tasks, plannedCounts]);

  const registerColumn = useCallback(
    (day: DateKey, element: HTMLElement | null) => {
      if (element) columns.current.set(day, element);
      else columns.current.delete(day);
    },
    [],
  );

  const updatePreview = useCallback(
    (data: DragData) => {
      const at = pointer.current;
      const viewport = scroller.current?.getBoundingClientRect();
      let next: Preview | null = null;
      if (at && viewport && at.y >= viewport.top && at.y <= viewport.bottom) {
        for (const [day, column] of columns.current) {
          const rect = column.getBoundingClientRect();
          if (at.x < rect.left || at.x >= rect.right) continue;
          const span = placeSpan(
            minutesAtOffset(at.y - grabOffset.current - rect.top, scale),
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
    },
    [scale],
  );

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
      '[data-grid-card]',
    );
    grabOffset.current = card
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
    ? { id: -1, ...timer, endedAt: Math.max(now, timer.startedAt) }
    : null;

  return (
    <TimeScaleContext value={scale}>
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
            <div className="grid shrink-0 [scrollbar-gutter:stable] grid-cols-[56px_repeat(7,minmax(0,1fr))] overflow-y-hidden border-b border-white/10">
              <div />
              {days.map((day) => (
                <DayHeader
                  key={day}
                  day={day}
                  today={today}
                  due={dueByDay.get(day) ?? []}
                  tracked={trackedByDay.get(day) ?? 0}
                />
              ))}
            </div>

            <div
              ref={scroller}
              className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto"
            >
              <div
                className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]"
                style={{ height: scale.height }}
              >
                <div className="relative">
                  {scale.marks.map((minute) => (
                    <span
                      key={minute}
                      className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground"
                      style={{ top: scale.top(minute) }}
                    >
                      {formatMinutesOfDay(minute)}
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
                    events={events}
                    timed={timedByDay.get(day) ?? []}
                    entries={
                      runningEntry ? [...entries, runningEntry] : entries
                    }
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
                    onOpenEntry={setEditingEntry}
                  />
                ))}
              </div>
            </div>
          </div>

          {aside ?? <TaskRail week={week} plannedCounts={plannedCounts} />}
        </div>

        <DragOverlay dropAnimation={null}>
          {active && !preview && (
            <div className="pointer-events-none max-w-56 truncate rounded-md border bg-popover px-2.5 py-1.5 text-sm shadow-[0_8px_24px_rgba(26,29,33,.14)]">
              {active.kind === 'block' ? active.block.title : active.task.title}
            </div>
          )}
        </DragOverlay>

        <NewBlockDialog slot={slot} onClose={closeSlot} onPick={planTask} />
        <EntryDialog
          open={editingEntry !== undefined}
          onOpenChange={(next) => !next && setEditingEntry(undefined)}
          entry={editingEntry}
        />
      </DndContext>
    </TimeScaleContext>
  );
}

function DayHeader({
  day,
  today,
  due,
  tracked,
}: {
  day: DateKey;
  today: DateKey;
  due: Task[];
  tracked: number;
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
        {tracked >= 60 && (
          <span className="ml-auto text-[11px] text-foreground/50 tabular-nums">
            {formatDuration(tracked)}
          </span>
        )}
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
  events: EventOccurrence[];
  timed: Task[];
  entries: TimeEntry[];
  runningTaskId: Id | null;
  preview: Preview | null;
  register: (day: DateKey, element: HTMLElement | null) => void;
  selection: RangeSelection | null;
  onEmptyPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResize: (block: TimeBlock, end: number) => void;
  onRemove: (block: TimeBlock) => void;
  onOpenEntry: (entry: TimeEntry) => void;
};

function GridBand({ segment }: { segment: ScaleSegment }) {
  const { from, top, height, perMinute, compact } = segment;
  if (compact)
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bg-black/25"
        style={{ top, height }}
      />
    );
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0"
      style={{
        top,
        height,
        backgroundImage: `linear-gradient(to bottom, var(--border) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 45%, transparent) 1px, transparent 1px)`,
        backgroundSize: `100% ${perMinute * 60}px, 100% ${perMinute * 30}px`,
        backgroundPositionY: `${-(from % 60) * perMinute}px, ${-(from % 30) * perMinute}px`,
      }}
    />
  );
}

function DayColumn({
  day,
  isToday,
  now,
  blocks,
  events,
  timed,
  entries,
  runningTaskId,
  preview,
  register,
  selection,
  onEmptyPointerDown,
  onResize,
  onRemove,
  onOpenEntry,
}: DayColumnProps) {
  const index = useProjectIndex();
  const taskIndex = useTaskIndex();
  const scale = useTimeScale();
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
    const anchors = events
      .filter((event) => dateKeyOf(event.startAt) === day)
      .map((event, i) => {
        const start = minutesIntoDay(event.startAt);
        return {
          event,
          id: -(i + 1),
          start,
          end: Math.min(
            start + (event.endAt - event.startAt) / 60,
            DAY_MINUTES,
          ),
        };
      });
    const due = timed.map((task, i) => {
      const start = task.dueTime ?? 0;
      return {
        task,
        id: -(anchors.length + i + 1),
        start,
        end: Math.min(
          start + (task.estimateMinutes ?? DEFAULT_BLOCK_MINUTES),
          DAY_MINUTES,
        ),
      };
    });
    const lanes = layoutLanes([
      ...own.map(({ block, start, end }) => ({ id: block.id, start, end })),
      ...anchors.map(({ id, start, end }) => ({ id, start, end })),
      ...due.map(({ id, start, end }) => ({ id, start, end })),
    ]);
    const lane = (id: number) => lanes.get(id) ?? { lane: 0, lanes: 1 };
    return {
      blocks: own.map((item) => ({ ...item, ...lane(item.block.id) })),
      events: anchors.map((item) => ({ ...item, ...lane(item.id) })),
      due: due.map((item) => ({ ...item, ...lane(item.id) })),
    };
  }, [blocks, events, timed, day]);

  const actual = useMemo(() => {
    const planned = [...placed.blocks, ...placed.events, ...placed.due];
    return entries.flatMap((entry) => {
      const span = clipToDay(day, entry.startedAt, entry.endedAt);
      if (!span) return [];
      const shared = planned.some(
        (item) => item.start < span.end && item.end > span.start,
      );
      return [{ entry, span, shared }];
    });
  }, [entries, day, placed]);

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
    >
      {scale.segments.map((segment) => (
        <GridBand key={segment.from} segment={segment} />
      ))}
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto">
          {placed.events.map(({ event, start, end, lane, lanes }) => (
            <EventCard
              key={`${event.taskId}-${event.startAt}`}
              event={event}
              start={start}
              end={end}
              lane={lane}
              lanes={lanes}
            />
          ))}
          {placed.due.map(({ task, start, end, lane, lanes }) => (
            <DueCard
              key={task.id}
              task={task}
              start={start}
              end={end}
              lane={lane}
              lanes={lanes}
            />
          ))}
          {placed.blocks.map(({ block, start, end, lane, lanes }) => (
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
              top: scale.top(selection.start),
              height: scale.extent(selection.start, selection.end) - 2,
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
              top: scale.top(preview.start),
              height: scale.extent(preview.start, preview.end) - 2,
            }}
          >
            <span>
              {formatMinutesOfDay(preview.start)}–
              {formatMinutesOfDay(preview.end % DAY_MINUTES)}
            </span>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0.5 left-0.5">
        {actual.map(({ entry, span, shared }) => {
          const project =
            entry.projectId === null
              ? undefined
              : index.byId.get(entry.projectId);
          const label =
            (entry.taskId !== null &&
              taskIndex.byId.get(entry.taskId)?.title) ||
            entry.description ||
            project?.name ||
            'Tracked time';
          const tall = scale.extent(span.start, span.end);
          return (
            <Tooltip key={entry.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={entry.id === -1}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onOpenEntry(entry)}
                  className={cn(
                    'pointer-events-auto absolute right-0 overflow-hidden rounded-[5px] text-left leading-tight text-white/90 outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                    shared ? 'z-10 w-1.5' : 'left-0 px-2 text-[11px]',
                  )}
                  style={{
                    top: scale.top(span.start),
                    height: Math.max(tall - 1, MIN_ENTRY_HEIGHT),
                    background: trackedFill(
                      project
                        ? projectColorVar(project.color)
                        : 'var(--muted-foreground)',
                    ),
                  }}
                >
                  {!shared && tall >= 24 && (
                    <span className="block truncate pt-0.5">{label}</span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Tracked: {label}</p>
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
          style={{ top: scale.top(minutesIntoDay(now)) }}
        >
          <div className="absolute -top-[3px] -left-[4px] size-2 rounded-full bg-now" />
        </div>
      )}
    </div>
  );
}
