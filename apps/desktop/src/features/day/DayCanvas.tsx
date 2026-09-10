import { format } from 'date-fns';
import {
  InboxIcon,
  ListTodoIcon,
  PlayIcon,
  PlusIcon,
  SquareIcon,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { EntryDetails, Id, TimeEntry } from '@/bindings';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HabitDots } from '@/features/habits/HabitDots';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { ProjectPicker } from '@/features/projects/ProjectPicker';
import { useProjectIndex } from '@/features/projects/api';
import { projectColorVar } from '@/features/projects/tree';
import { useRitualRunner } from '@/features/rituals/runner-context';
import { TaskPanel } from '@/features/tasks/TaskPanel';
import { TaskPicker } from '@/features/tasks/TaskPicker';
import { useTaskIndex } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { EntryDialog } from '@/features/time/EntryDialog';
import {
  useDiscardTimer,
  useEditTimer,
  useStartTimer,
  useStopTimer,
  useTimeEntries,
  useTimer,
} from '@/features/time/api';
import { useEvents } from '@/features/workflow/api';
import { useNow } from '@/hooks/use-now';
import { usePreference } from '@/lib/preferences';
import { useShortcuts } from '@/lib/shortcuts';
import {
  dayStart,
  formatClockTime,
  formatDuration,
  formatStopwatch,
  fromDateKey,
  minutesIntoDay,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { Leftovers } from './Leftovers';
import { useDayPlan } from './plan';
import { describeWeather, useWeather } from './weather';

type Moment = {
  key: string;
  taskId: Id;
  title: string;
  projectId: Id | null;
  start: number;
  end: number;
  done: boolean;
  event: boolean;
};

type Loose = { taskId: Id; title: string; projectId: Id | null; done: boolean };

type Panel = { kind: 'task'; taskId: Id } | { kind: 'focus' };

const WINDOW_HOURS = 6;
const ROW = 46;

export function DayCanvas() {
  const today = todayKey();
  const plan = useDayPlan(today);
  const { data: events = [] } = useEvents(today, shiftKey(today, 1));
  const { data: timer } = useTimer();
  const { data: logged = [] } = useTimeEntries(today, shiftKey(today, 1));
  const now = useNow(30_000);
  const entries = useMemo<TimeEntry[]>(
    () =>
      timer
        ? [
            ...logged,
            { id: -1, ...timer, endedAt: Math.max(now, timer.startedAt + 60) },
          ]
        : logged,
    [logged, timer, now],
  );
  const tracked = entries.reduce(
    (sum, entry) =>
      sum +
      Math.max(
        0,
        Math.min(entry.endedAt, dayStart(shiftKey(today, 1))) -
          Math.max(entry.startedAt, dayStart(today)),
      ),
    0,
  );
  const [chosen, setChosen] = useState<Panel | null | undefined>(undefined);
  const [sorting, setSorting] = useState(false);

  const moments = useMemo<Moment[]>(() => {
    const timed = plan.blocks.map((block) => ({
      key: `block-${block.id}`,
      taskId: block.taskId,
      title: block.title,
      projectId: block.projectId,
      start: block.startAt,
      end: block.endAt,
      done: block.completed,
      event: false,
    }));
    const anchors = events.map((event) => ({
      key: `event-${event.taskId}-${event.startAt}`,
      taskId: event.taskId,
      title: event.title,
      projectId: event.projectId,
      start: event.startAt,
      end: event.endAt,
      done: false,
      event: true,
    }));
    return [...timed, ...anchors].sort((a, b) => a.start - b.start);
  }, [plan.blocks, events]);

  const loose = useMemo<Loose[]>(
    () =>
      [...plan.musts, ...plan.due].map((task) => ({
        taskId: task.id,
        title: task.title,
        projectId: task.projectId,
        done: task.completedAt !== null,
      })),
    [plan.musts, plan.due],
  );

  const running: Panel | null = timer
    ? timer.taskId !== null
      ? { kind: 'task', taskId: timer.taskId }
      : { kind: 'focus' }
    : null;
  const panel =
    chosen === undefined || (chosen?.kind === 'focus' && !timer)
      ? running
      : chosen;
  const openId = panel?.kind === 'task' ? panel.taskId : null;

  useShortcuts([{ keys: 'Escape', run: () => setChosen(null), idle: true }]);

  return (
    <div className="mx-auto grid h-full w-full max-w-[1180px] grid-cols-[minmax(300px,380px)_minmax(0,1fr)] gap-16 px-24 pb-12">
      <aside className="flex min-h-0 flex-col pt-6">
        <TodayLine tracked={tracked} />
        <Thread
          moments={moments}
          entries={entries}
          now={now}
          openId={openId}
          runningId={timer?.taskId ?? null}
          onPick={(taskId) => setChosen({ kind: 'task', taskId })}
        />
        <LooseList
          tasks={loose}
          openId={openId}
          runningId={timer?.taskId ?? null}
          onPick={(taskId) => setChosen({ kind: 'task', taskId })}
        />
        {plan.earlier.length > 0 && (
          <button
            type="button"
            onClick={() => setSorting(true)}
            className="mb-4 self-start text-sm text-foreground/55 underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {plan.earlier.length} left from earlier days
          </button>
        )}
        <div className="flex items-center gap-3 pt-2">
          <StartFocus onOpen={setChosen} />
          <CheckOut />
        </div>
      </aside>

      <section
        className="min-h-0 pt-6"
        onClick={(event) => {
          if (event.target === event.currentTarget) setChosen(null);
        }}
      >
        {panel?.kind === 'task' && (
          <Focus key={panel.taskId} taskId={panel.taskId} />
        )}
        {panel?.kind === 'focus' && <FreeFocus />}
      </section>

      <Dialog open={sorting} onOpenChange={setSorting}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>From earlier days</DialogTitle>
            <DialogDescription>
              Give each one a day, park it, or let it go.
            </DialogDescription>
          </DialogHeader>
          <Leftovers tasks={plan.earlier} target={todayKey()} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TodayLine({ tracked }: { tracked: number }) {
  const showDate = usePreference('showDate');
  const showWeekday = usePreference('showWeekday');
  const showWeather = usePreference('showWeather');
  const place = usePreference('weatherPlace');
  const { data: weather } = useWeather(showWeather ? place : null);
  const date = fromDateKey(todayKey());

  return (
    <header className="grid animate-in gap-1 pb-10 duration-1000 fade-in-0 slide-in-from-bottom-1">
      {showWeekday && (
        <h1 className="text-5xl font-light tracking-tight">
          {format(date, 'EEEE')}
        </h1>
      )}
      <p className="text-base text-foreground/70">
        {[
          showDate && format(date, 'd MMMM'),
          showWeather &&
            weather &&
            `${weather.temperature}° ${describeWeather(weather.code)}${place ? ` in ${place.name}` : ''}`,
          tracked >= 60 && `${formatDuration(tracked)} focused`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <HabitDots />
    </header>
  );
}

function Thread({
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
  onPick: (id: Id) => void;
}) {
  const index = useProjectIndex();
  const today = todayKey();
  const [editing, setEditing] = useState<TimeEntry>();
  const scroller = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const hourHeight = Math.max(48, height / WINDOW_HOURS);
  const perMinute = hourHeight / 60;
  const nowTop = minutesIntoDay(now) * perMinute;

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
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
      const start = Math.max(0, (moment.start - dayOpen) / 60) * perMinute;
      const end = Math.min(24 * 60, (moment.end - dayOpen) / 60) * perMinute;
      const previous = placed.at(-1);
      const top = previous ? Math.max(start, previous.top + ROW) : start;
      placed.push({ moment, start, end, top });
    }
    return placed;
  }, [moments, perMinute, today]);

  return (
    <div
      ref={scroller}
      className="relative no-scrollbar min-h-0 flex-1 overflow-y-auto [mask-image:linear-gradient(180deg,transparent,#000_24px,#000_calc(100%-24px),transparent)] pr-2"
    >
      <div className="relative" style={{ height: 24 * hourHeight }}>
        {Array.from({ length: 23 }, (_, i) => i + 1).map((hour) => (
          <span
            key={hour}
            aria-hidden
            className="absolute left-0 w-10 -translate-y-1/2 text-[11px] text-foreground/35"
            style={{ top: hour * hourHeight }}
          >
            {String(hour).padStart(2, '0')}:00
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
          const tall = (to - from) * perMinute;
          const project =
            entry.projectId === null
              ? undefined
              : index.byId.get(entry.projectId);
          const label = entry.description || project?.name || 'Focus';
          return (
            <button
              key={entry.id}
              type="button"
              disabled={entry.id === -1}
              onClick={() => setEditing(entry)}
              title={`${label} · ${formatClockTime(entry.startedAt)}–${entry.id === -1 ? 'now' : formatClockTime(entry.endedAt)} · ${formatDuration(entry.endedAt - entry.startedAt)}`}
              className="absolute right-0 w-24 overflow-hidden rounded-md px-2 text-left text-[11px] leading-tight text-white/90 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              style={{
                top: from * perMinute,
                height: Math.max(tall - 1, 3),
                background: `color-mix(in oklab, ${
                  project
                    ? projectColorVar(project.color)
                    : 'var(--muted-foreground)'
                } 50%, transparent)`,
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
          className="pointer-events-none absolute right-0 left-[51px] flex items-center"
          style={{ top: nowTop }}
        >
          <span className="size-2 -translate-y-1/2 rounded-full bg-white" />
          <span className="h-px flex-1 -translate-y-1/2 bg-gradient-to-r from-white/70 to-transparent" />
        </div>
        <ol>
          {rows.map(({ moment, top }) => {
            const past = moment.end <= now;
            const live =
              moment.taskId === runningId ||
              (moment.start <= now && moment.end > now);
            const open = moment.taskId === openId;
            const project =
              moment.projectId !== null
                ? index.byId.get(moment.projectId)
                : undefined;
            return (
              <li
                key={moment.key}
                className="absolute right-28 left-12"
                style={{ top: top - 11 }}
              >
                <button
                  type="button"
                  onClick={() => onPick(moment.taskId)}
                  aria-current={open ? 'true' : undefined}
                  className="group relative flex w-full items-start gap-4 text-left outline-none"
                >
                  <span className="relative mt-1 grid size-[15px] shrink-0 place-items-center">
                    {moment.event ? (
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
                          <span className="absolute inset-[-5px] animate-[ping_2.6s_cubic-bezier(0,0,.2,1)_infinite] rounded-full bg-white/25" />
                        )}
                        <span
                          className={cn(
                            'size-[15px] rounded-full border transition-all duration-500',
                            moment.done
                              ? 'border-white/40 bg-white/40'
                              : live || open
                                ? 'border-white bg-white'
                                : 'border-white/60 bg-[rgba(8,22,30,.9)] group-hover:border-white',
                          )}
                        />
                      </>
                    )}
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span
                      className={cn(
                        'truncate text-[15px] transition-colors duration-500',
                        moment.done && 'text-foreground/40 line-through',
                        !moment.done &&
                          (open
                            ? 'text-foreground'
                            : past
                              ? 'text-foreground/50'
                              : 'text-foreground/80 group-hover:text-foreground'),
                        'group-focus-visible:underline',
                      )}
                    >
                      {moment.title}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-foreground/50">
                      {`${formatClockTime(moment.start)} – ${formatClockTime(moment.end)}`}
                      {project && (
                        <>
                          <ProjectDot color={project.color} />
                          <span className="truncate">{project.name}</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
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

function LooseList({
  tasks,
  openId,
  runningId,
  onPick,
}: {
  tasks: Loose[];
  openId: Id | null;
  runningId: Id | null;
  onPick: (id: Id) => void;
}) {
  const { newTask } = useTaskDialog();
  const today = todayKey();

  return (
    <div className="no-scrollbar max-h-[32%] shrink-0 overflow-y-auto pt-4 pb-3">
      {tasks.length > 0 && (
        <p className="pb-1 text-xs text-foreground/45">Any time today</p>
      )}
      <ul>
        {tasks.map((task) => {
          const open = task.taskId === openId;
          const live = task.taskId === runningId;
          return (
            <li key={task.taskId}>
              <button
                type="button"
                onClick={() => onPick(task.taskId)}
                aria-current={open ? 'true' : undefined}
                className="group flex w-full items-center gap-3 py-1.5 text-left outline-none"
              >
                <span
                  className={cn(
                    'size-[11px] shrink-0 rounded-full border transition-all duration-500',
                    task.done
                      ? 'border-white/40 bg-white/40'
                      : live || open
                        ? 'border-white bg-white'
                        : 'border-white/60 group-hover:border-white',
                  )}
                />
                <span
                  className={cn(
                    'truncate text-sm transition-colors duration-500 group-focus-visible:underline',
                    task.done
                      ? 'text-foreground/40 line-through'
                      : open
                        ? 'text-foreground'
                        : 'text-foreground/75 group-hover:text-foreground',
                  )}
                >
                  {task.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => newTask({ dueDate: today })}
        className="flex items-center gap-2 pt-1.5 text-sm text-foreground/45 transition-colors hover:text-foreground"
      >
        <PlusIcon className="size-4" strokeWidth={1.5} />
        Add
      </button>
    </div>
  );
}

function StartFocus({ onOpen }: { onOpen: (panel: Panel) => void }) {
  const { data: timer } = useTimer();
  const start = useStartTimer();
  const now = useNow(1000, Boolean(timer));

  if (timer)
    return (
      <button
        type="button"
        onClick={() => onOpen({ kind: 'focus' })}
        className="flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#08161e] tabular-nums transition-colors hover:bg-white"
      >
        <span className="size-2 rounded-full bg-[#08161e]" />
        {formatStopwatch(now - timer.startedAt)}
      </button>
    );

  return (
    <button
      type="button"
      disabled={start.isPending}
      onClick={() =>
        start.mutate(
          { description: '', projectId: null, taskId: null },
          { onSuccess: () => onOpen({ kind: 'focus' }) },
        )
      }
      className="flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
    >
      <PlayIcon className="size-3.5 fill-current" />
      Start focus
    </button>
  );
}

function CheckOut() {
  const runner = useRitualRunner();
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => runner.open('evening')}
        className="group flex h-9 items-center gap-2.5 rounded-full bg-white/10 pr-4 pl-3.5 text-sm ring-1 ring-white/20 backdrop-blur-md transition-all duration-500 outline-none hover:bg-white/[.16] hover:ring-white/35 focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <span className="size-2 rounded-full bg-white/70 transition-transform duration-500 group-hover:scale-125" />
        Check out
      </button>
    </div>
  );
}

function Focus({ taskId }: { taskId: Id }) {
  const tasks = useTaskIndex();
  const task = tasks.byId.get(taskId);
  if (!task) return null;

  return (
    <div className="flex h-full max-h-[720px] animate-in flex-col rounded-[32px] bg-[rgba(6,18,26,.38)] p-12 ring-1 ring-white/[.08] backdrop-blur-xl duration-700 fade-in-0 slide-in-from-bottom-2">
      <TaskPanel key={task.id} task={task} />
    </div>
  );
}

function FreeFocus() {
  const { data: timer } = useTimer();
  const index = useProjectIndex();
  const tasks = useTaskIndex();
  const edit = useEditTimer();
  const stop = useStopTimer();
  const discard = useDiscardTimer();
  const now = useNow(1000, Boolean(timer));
  const input = useRef<HTMLInputElement>(null);
  if (!timer) return null;

  const current = (): EntryDetails => ({
    description: input.current?.value.trim() ?? timer.description,
    projectId: timer.projectId,
    taskId: timer.taskId,
  });
  const project =
    timer.projectId === null ? undefined : index.byId.get(timer.projectId);
  const task = timer.taskId === null ? undefined : tasks.byId.get(timer.taskId);

  return (
    <div className="flex h-full max-h-[720px] animate-in flex-col rounded-[32px] bg-[rgba(6,18,26,.38)] p-12 ring-1 ring-white/[.08] backdrop-blur-xl duration-700 fade-in-0 slide-in-from-bottom-2">
      <p className="text-sm text-foreground/55">Focusing</p>
      <input
        key={`${timer.startedAt}-${timer.taskId}`}
        ref={input}
        defaultValue={timer.description}
        placeholder="What are you on?"
        aria-label="What are you on?"
        onBlur={() => {
          if (current().description !== timer.description)
            edit.mutate(current());
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        className="mt-2 bg-transparent text-3xl font-light outline-none placeholder:text-foreground/35"
      />

      <dl className="mt-10 grid max-w-md grid-cols-[88px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 text-sm">
        <dt className="text-foreground/45">Task</dt>
        <dd>
          <TaskPicker
            value={timer.taskId}
            onChange={(picked) =>
              edit.mutate(
                picked
                  ? {
                      description: current().description || picked.title,
                      projectId: picked.projectId,
                      taskId: picked.id,
                    }
                  : { ...current(), taskId: null },
              )
            }
            trigger={
              <button type="button" className={FIELD}>
                <ListTodoIcon className="size-3.5 text-foreground/50" />
                <span className="truncate">{task?.title ?? 'None'}</span>
              </button>
            }
          />
        </dd>
        <dt className="text-foreground/45">Project</dt>
        <dd>
          <ProjectPicker
            value={timer.projectId}
            onChange={(projectId) =>
              edit.mutate({ ...current(), projectId, taskId: null })
            }
            trigger={
              <button type="button" className={FIELD}>
                {project ? (
                  <ProjectDot color={project.color} />
                ) : (
                  <InboxIcon className="size-3.5 text-foreground/50" />
                )}
                <span className="truncate">{project?.name ?? 'None'}</span>
              </button>
            }
          />
        </dd>
        <dt className="text-foreground/45">Started</dt>
        <dd className="text-foreground/75 tabular-nums">
          {formatClockTime(timer.startedAt)}
        </dd>
      </dl>

      <div className="mt-auto flex items-center gap-4 pt-10">
        <span className="text-5xl font-extralight tracking-tight tabular-nums">
          {formatStopwatch(now - timer.startedAt)}
        </span>
        <button
          type="button"
          disabled={stop.isPending}
          onClick={() => stop.mutate(current())}
          className="ml-4 flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
        >
          <SquareIcon className="size-3.5 fill-current" />
          Stop
        </button>
        <button
          type="button"
          disabled={discard.isPending}
          onClick={() => discard.mutate()}
          className="text-sm text-foreground/45 transition-colors hover:text-foreground"
        >
          Discard
        </button>
      </div>
    </div>
  );
}

const FIELD =
  'flex h-8 max-w-full items-center gap-2 rounded-full px-3 text-foreground/80 ring-1 ring-white/15 transition-colors outline-none hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-white/50';
