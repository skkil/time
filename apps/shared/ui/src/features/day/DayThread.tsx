import { LIVE_ENTRY_ID } from '@skkil-time/rules/timer';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { CalendarEvent, Id, TimeEntry } from '@/backend';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import {
  CalendarEventDetails,
  GoogleMark,
} from '@/features/calendar/CalendarEventDetails';
import { TRACKED_LOOK, cardColors } from '@/features/planner/card-colors';
import { createTimeScale } from '@/features/planner/time-scale';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { ProjectLink } from '@/features/projects/ProjectLink';
import { useProjectIndex } from '@/features/projects/api';
import { PriorityCheck } from '@/features/tasks/PriorityCheck';
import { useSetTaskCompleted, useTaskIndex } from '@/features/tasks/api';
import { priorityTint } from '@/features/tasks/meta';
import { EntryDialog } from '@/features/time/EntryDialog';
import { MIN_ENTRY_HEIGHT } from '@/features/time/tracked';
import { usePreference } from '@/lib/preferences';
import {
  dayStart,
  formatClockTime,
  formatDuration,
  formatMinutesOfDay,
  minutesIntoDay,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

export type Moment = {
  key: string;
  kind: 'block' | 'event' | 'due' | 'calendar';
  taskId: Id;
  title: string;
  priority: number;
  projectId: Id | null;
  start: number;
  end: number;
  showEnd: boolean;
  done: boolean;
  calendar?: CalendarEvent;
};

const WINDOW_HOURS = 6;
const ROW = 46;

export function DayThread({
  moments,
  entries,
  now,
  openId,
  runningId,
  onPick,
}: {
  moments: Moment[];
  entries: TimeEntry[];
  now: number;
  openId: Id | null;
  runningId: Id | null;
  onPick: (taskId: Id) => void;
}) {
  const index = useProjectIndex();
  const complete = useSetTaskCompleted();
  const tasks = useTaskIndex();
  const today = todayKey();
  const [editing, setEditing] = useState<TimeEntry>();
  const scroller = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const sleep = usePreference('sleep');
  const hourHeight = Math.max(48, height / WINDOW_HOURS);
  const scale = useMemo(
    () => createTimeScale(hourHeight, sleep),
    [hourHeight, sleep],
  );
  const nowTop = scale.top(minutesIntoDay(now));

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    setHeight(element.clientHeight);
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry.contentRect.height),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const placed = useRef(false);
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element || height === 0 || placed.current) return;
    placed.current = true;
    element.scrollTop = nowTop - hourHeight;
  }, [height, nowTop, hourHeight]);

  const rows = useMemo(() => {
    const dayOpen = dayStart(today);
    const placed: {
      moment: Moment;
      start: number;
      end: number;
      top: number;
    }[] = [];
    for (const moment of moments) {
      const start = scale.top(Math.max(0, (moment.start - dayOpen) / 60));
      const end = scale.top(Math.min(24 * 60, (moment.end - dayOpen) / 60));
      const previous = placed.at(-1);
      const top = previous ? Math.max(start, previous.top + ROW) : start;
      placed.push({ moment, start, end, top });
    }
    return placed;
  }, [moments, scale, today]);

  return (
    <div
      ref={scroller}
      className="relative no-scrollbar min-h-0 flex-1 overflow-y-auto [mask-image:linear-gradient(180deg,transparent,#000_24px,#000_calc(100%-24px),transparent)] pr-2"
    >
      <div className="relative" style={{ height: scale.height }}>
        {scale.segments
          .filter((segment) => segment.compact)
          .map(({ from, top, height }) => (
            <span
              key={from}
              aria-hidden
              className="absolute inset-x-0 rounded-sm bg-black/20"
              style={{ top, height }}
            />
          ))}
        {scale.marks.map((minute) => (
          <span
            key={minute}
            aria-hidden
            className="absolute left-0 w-10 -translate-y-1/2 text-[11px] text-foreground/75"
            style={{ top: scale.top(minute) }}
          >
            {formatMinutesOfDay(minute)}
          </span>
        ))}
        <span
          aria-hidden
          className="absolute inset-y-0 left-[55px] w-px bg-white/20"
        />
        {rows.map(({ moment, start, end }) => (
          <span
            key={`span-${moment.key}`}
            aria-hidden
            className={cn(
              'absolute left-[54px] w-[3px] rounded-full',
              moment.done || moment.end <= now ? 'bg-white/30' : 'bg-white/70',
            )}
            style={{ top: start, height: Math.max(end - start, 3) }}
          />
        ))}
        {entries.map((entry) => {
          const dayOpen = dayStart(today);
          const from = Math.max(0, (entry.startedAt - dayOpen) / 60);
          const to = Math.min(24 * 60, (entry.endedAt - dayOpen) / 60);
          if (to <= from) return null;
          const tall = scale.extent(from, to);
          const project =
            entry.projectId === null
              ? undefined
              : index.byId.get(entry.projectId);
          const task =
            entry.taskId === null ? undefined : tasks.byId.get(entry.taskId);
          const label =
            task?.title || entry.description || project?.name || 'Focus';
          return (
            <button
              key={entry.id}
              type="button"
              disabled={entry.id === LIVE_ENTRY_ID}
              onClick={() =>
                entry.taskId === null ? setEditing(entry) : onPick(entry.taskId)
              }
              title={`${label} · ${formatClockTime(entry.startedAt)}–${entry.id === LIVE_ENTRY_ID ? 'now' : formatClockTime(entry.endedAt)} · ${formatDuration(entry.endedAt - entry.startedAt)}`}
              className={cn(
                'absolute right-0 left-16 overflow-hidden rounded-md border px-2 text-right text-[11px] leading-tight font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
                TRACKED_LOOK,
              )}
              style={{
                top: scale.top(from),
                height: Math.max(tall - 1, MIN_ENTRY_HEIGHT),
                ...cardColors(
                  task
                    ? priorityTint(task.priority)
                    : 'var(--muted-foreground)',
                ),
              }}
            >
              {tall >= 24 && (
                <span className="block truncate pt-1">{label}</span>
              )}
            </button>
          );
        })}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 left-[51.5px] flex -translate-y-1/2 items-center"
          style={{ top: nowTop }}
        >
          <span className="size-2 rounded-full bg-white" />
          <span className="h-px flex-1 bg-gradient-to-r from-white/70 to-transparent" />
        </div>
        <ol>
          {rows.map(({ moment, top }) => {
            const past = moment.end <= now;
            const live =
              moment.kind === 'block' &&
              (moment.taskId === runningId ||
                (moment.start <= now && moment.end > now));
            const open = moment.taskId === openId;
            const project =
              moment.projectId !== null
                ? index.byId.get(moment.projectId)
                : undefined;
            return (
              <li
                key={moment.key}
                className="absolute right-28 left-[48px]"
                style={{ top: top - 11 }}
              >
                <div className="flex items-start gap-4">
                  <span className="relative mt-1 grid size-[15px] shrink-0 place-items-center">
                    {moment.calendar ? (
                      <GoogleMark
                        className={cn(
                          'size-[13px] transition-opacity duration-500',
                          past && 'opacity-40',
                        )}
                      />
                    ) : moment.kind === 'event' ? (
                      <span
                        aria-label="Event"
                        className={cn(
                          'size-[11px] rotate-45 rounded-[2px] transition-colors duration-500',
                          past ? 'bg-white/35' : 'bg-white/85',
                        )}
                      />
                    ) : (
                      <>
                        {live && (
                          <span className="pointer-events-none absolute inset-[-5px] animate-[ping_2.6s_cubic-bezier(0,0,.2,1)_infinite] rounded-full bg-white/25" />
                        )}
                        <PriorityCheck
                          priority={moment.priority}
                          checked={moment.done}
                          label={`Mark ${moment.title} ${moment.done ? 'not done' : 'done'}`}
                          onToggle={() =>
                            complete.mutate({
                              id: moment.taskId,
                              completed: !moment.done,
                            })
                          }
                          className={cn(
                            'size-[15px] [&_svg]:size-2.5',
                            !moment.done &&
                              (live || open
                                ? 'border-white bg-white/25'
                                : 'border-white/60 bg-[rgba(8,22,30,.9)]'),
                          )}
                        />
                      </>
                    )}
                  </span>
                  {moment.calendar ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          data-calendar-event=""
                          className="group min-w-0 text-left outline-none"
                        >
                          <span
                            className={cn(
                              'block truncate text-[15px] transition-colors duration-500 group-focus-visible:underline',
                              past
                                ? 'text-foreground/75'
                                : 'text-foreground/80 group-hover:text-foreground',
                            )}
                          >
                            {moment.title}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <CalendarEventDetails event={moment.calendar} />
                    </Popover>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPick(moment.taskId)}
                      aria-current={open ? 'true' : undefined}
                      className="group min-w-0 text-left outline-none"
                    >
                      <span
                        className={cn(
                          'block truncate text-[15px] transition-colors duration-500',
                          moment.done && 'text-foreground/75 line-through',
                          !moment.done &&
                            (open
                              ? 'text-foreground'
                              : past
                                ? 'text-foreground/75'
                                : 'text-foreground/80 group-hover:text-foreground'),
                          'group-focus-visible:underline',
                        )}
                      >
                        {moment.title}
                      </span>
                    </button>
                  )}
                </div>
                <p className="flex items-center gap-2 pl-[31px] text-xs text-foreground/75">
                  {moment.showEnd
                    ? `${formatClockTime(moment.start)} – ${formatClockTime(moment.end)}`
                    : formatClockTime(moment.start)}
                  {project && (
                    <ProjectLink
                      projectId={project.id}
                      className="flex items-center gap-2"
                    >
                      <ProjectDot color={project.color} />
                      <span className="truncate">{project.name}</span>
                    </ProjectLink>
                  )}
                  {moment.calendar && (
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: moment.calendar.color }}
                      />
                      <span className="truncate">
                        {moment.calendar.sourceName}
                      </span>
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
      <EntryDialog
        open={editing !== undefined}
        onOpenChange={(next) => !next && setEditing(undefined)}
        entry={editing}
      />
    </div>
  );
}
