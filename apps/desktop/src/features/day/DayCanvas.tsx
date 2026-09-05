import { format } from 'date-fns';
import {
  CheckIcon,
  PencilLineIcon,
  PlayIcon,
  PlusIcon,
  SquareIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Id, Task } from '@/bindings';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { useWeek } from '@/features/review/api';
import { useRituals } from '@/features/rituals/api';
import { useRitualRunner } from '@/features/rituals/runner-context';
import { useSetTaskCompleted, useTaskIndex } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { useStartTimer, useStopTimer, useTimer } from '@/features/time/api';
import { useNow } from '@/hooks/use-now';
import { usePreference } from '@/lib/preferences';
import {
  formatClockTime,
  formatDuration,
  formatEstimate,
  formatStopwatch,
  fromDateKey,
  mondayOf,
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
  start: number | null;
  end: number | null;
  done: boolean;
};

export function DayCanvas() {
  const today = todayKey();
  const plan = useDayPlan(today);
  const { data: timer } = useTimer();
  const now = useNow(30_000);
  const [picked, setPicked] = useState<Id | null>(null);
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
    }));
    const loose = [...plan.musts, ...plan.due].map((task) => ({
      key: `task-${task.id}`,
      taskId: task.id,
      title: task.title,
      projectId: task.projectId,
      start: null,
      end: null,
      done: task.completedAt !== null,
    }));
    return [...timed, ...loose];
  }, [plan.blocks, plan.musts, plan.due]);

  const current = moments.find(
    (moment) =>
      moment.start !== null &&
      moment.end !== null &&
      moment.start <= now &&
      moment.end > now,
  );
  const focusId =
    picked ??
    timer?.taskId ??
    current?.taskId ??
    moments.find((moment) => !moment.done)?.taskId ??
    null;

  return (
    <div className="grid h-full grid-cols-[minmax(300px,380px)_minmax(0,1fr)] gap-16 px-16 pb-10">
      <aside className="flex min-h-0 flex-col pt-6">
        <TodayLine />
        <Timeline
          moments={moments}
          now={now}
          focusId={focusId}
          runningId={timer?.taskId ?? null}
          loading={plan.loading}
          onPick={setPicked}
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
        <CheckOut />
      </aside>

      <section className="min-h-0 pt-6">
        <Focus key={focusId ?? 'none'} taskId={focusId} />
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

function TodayLine() {
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
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </header>
  );
}

function Timeline({
  moments,
  now,
  focusId,
  runningId,
  loading,
  onPick,
}: {
  moments: Moment[];
  now: number;
  focusId: Id | null;
  runningId: Id | null;
  loading: boolean;
  onPick: (id: Id) => void;
}) {
  const { newTask } = useTaskDialog();
  const index = useProjectIndex();
  const today = todayKey();

  if (!loading && moments.length === 0)
    return (
      <div className="flex-1">
        <p className="max-w-64 text-lg leading-relaxed font-light text-foreground/75">
          Nothing planned. What would make today count?
        </p>
        <button
          type="button"
          onClick={() => newTask({ dueDate: today })}
          className="mt-4 flex items-center gap-2 text-sm text-foreground/60 transition-colors hover:text-foreground"
        >
          <PlusIcon className="size-4" strokeWidth={1.5} />
          Add something for today
        </button>
      </div>
    );

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto [mask-image:linear-gradient(180deg,transparent,#000_16px,#000_calc(100%-24px),transparent)] pr-2">
      <ol className="relative py-4">
        <span
          aria-hidden
          className="absolute top-4 bottom-4 left-[7px] w-px bg-white/25"
        />
        {moments.map((moment, i) => {
          const past = moment.end !== null && moment.end <= now;
          const live =
            moment.taskId === runningId ||
            (moment.start !== null &&
              moment.end !== null &&
              moment.start <= now &&
              moment.end > now);
          const focused = moment.taskId === focusId;
          const project =
            moment.projectId !== null
              ? index.byId.get(moment.projectId)
              : undefined;
          return (
            <li
              key={moment.key}
              className="animate-in duration-700 fade-in-0 fill-mode-both slide-in-from-left-1"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <button
                type="button"
                onClick={() => onPick(moment.taskId)}
                aria-current={focused ? 'true' : undefined}
                className="group relative flex w-full items-start gap-5 py-3 text-left outline-none"
              >
                <span className="relative mt-1 grid size-[15px] shrink-0 place-items-center">
                  {live && (
                    <span className="absolute inset-[-5px] animate-[ping_2.6s_cubic-bezier(0,0,.2,1)_infinite] rounded-full bg-white/25" />
                  )}
                  <span
                    className={cn(
                      'size-[15px] rounded-full border transition-all duration-500',
                      moment.done
                        ? 'border-white/40 bg-white/40'
                        : live || focused
                          ? 'border-white bg-white'
                          : 'border-white/60 bg-[rgba(8,22,30,.9)] group-hover:border-white',
                    )}
                  />
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span
                    className={cn(
                      'truncate text-[17px] transition-colors duration-500',
                      moment.done && 'text-foreground/40 line-through',
                      !moment.done &&
                        (focused
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
                    {moment.start !== null && moment.end !== null
                      ? `${formatClockTime(moment.start)} – ${formatClockTime(moment.end)}`
                      : 'Any time today'}
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
      <button
        type="button"
        onClick={() => newTask({ dueDate: today })}
        className="ml-9 flex items-center gap-2 pb-4 text-sm text-foreground/45 transition-colors hover:text-foreground"
      >
        <PlusIcon className="size-4" strokeWidth={1.5} />
        Add
      </button>
    </div>
  );
}

function CheckOut() {
  const runner = useRitualRunner();
  const { data: rituals } = useRituals();
  const lastWeek = shiftKey(mondayOf(todayKey()), -7);
  const { data: week } = useWeek(lastWeek);
  const weekly = rituals?.find((ritual) => ritual.kind === 'weekly');
  const weekday = (new Date().getDay() + 6) % 7;
  const weeklyDue =
    weekly?.enabled &&
    (weekly.weekdays & (1 << weekday)) !== 0 &&
    week !== undefined &&
    week.reviewedAt === null;

  return (
    <div className="grid justify-items-start gap-3 pt-2">
      <button
        type="button"
        onClick={() => runner.open('evening')}
        className="group flex items-center gap-3 rounded-full bg-white/10 py-3 pr-6 pl-5 text-base ring-1 ring-white/20 backdrop-blur-md transition-all duration-500 outline-none hover:bg-white/[.16] hover:ring-white/35 focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <span className="size-2 rounded-full bg-white/70 transition-transform duration-500 group-hover:scale-125" />
        Check out
      </button>
      {weeklyDue && (
        <button
          type="button"
          onClick={() => runner.open('weekly')}
          className="text-sm text-foreground/55 underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Last week isn’t reviewed yet
        </button>
      )}
    </div>
  );
}

function Focus({ taskId }: { taskId: Id | null }) {
  const tasks = useTaskIndex();
  const task = taskId === null ? undefined : tasks.byId.get(taskId);

  return (
    <div className="flex h-full max-h-[720px] animate-in flex-col rounded-[32px] bg-[rgba(6,18,26,.38)] p-12 ring-1 ring-white/[.08] backdrop-blur-xl duration-700 fade-in-0 slide-in-from-bottom-2">
      {task ? (
        <TaskFocus task={task} />
      ) : (
        <div className="m-auto max-w-sm text-center">
          <p className="text-2xl font-light text-foreground/80">
            A quiet day so far.
          </p>
          <p className="mt-3 text-sm text-foreground/55">
            Add one thing on the left, or just breathe for a moment.
          </p>
        </div>
      )}
    </div>
  );
}

function TaskFocus({ task }: { task: Task }) {
  const { data: timer } = useTimer();
  const start = useStartTimer();
  const stop = useStopTimer();
  const complete = useSetTaskCompleted();
  const { openTask } = useTaskDialog();
  const index = useProjectIndex();
  const running = timer?.taskId === task.id;
  const now = useNow(1000, running);
  const project =
    task.projectId !== null ? index.byId.get(task.projectId) : undefined;
  const done = task.completedAt !== null;

  const facts = [
    task.estimateMinutes && `About ${formatEstimate(task.estimateMinutes)}`,
    task.trackedSeconds > 0 && `${formatDuration(task.trackedSeconds)} so far`,
    task.deadline && `Due by ${format(fromDateKey(task.deadline), 'd MMM')}`,
  ].filter(Boolean);

  return (
    <div className="flex h-full flex-col">
      <p className="flex items-center gap-2 text-sm text-foreground/60">
        {project ? (
          <>
            <ProjectDot color={project.color} />
            {project.name}
          </>
        ) : (
          'Inbox'
        )}
      </p>
      <h2
        className={cn(
          'mt-4 max-w-2xl text-4xl leading-tight font-light text-balance',
          done && 'text-foreground/50 line-through',
        )}
      >
        {task.title}
      </h2>
      {facts.length > 0 && (
        <p className="mt-3 text-sm text-foreground/55">{facts.join(' · ')}</p>
      )}

      <div className="mt-10 grid max-w-2xl gap-8 overflow-y-auto">
        {task.nextStep && (
          <div>
            <p className="text-xs tracking-wide text-foreground/45">
              Where you left off
            </p>
            <p className="mt-1.5 text-lg font-light">{task.nextStep}</p>
          </div>
        )}
        {task.notes && (
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-foreground/75">
            {task.notes}
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-10">
        {running ? (
          <>
            <span className="text-5xl font-extralight tracking-tight tabular-nums">
              {formatStopwatch(now - timer.startedAt)}
            </span>
            <button
              type="button"
              onClick={() => stop.mutate(undefined)}
              className="ml-4 flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
            >
              <SquareIcon className="size-3.5 fill-current" />
              Stop
            </button>
          </>
        ) : (
          !done && (
            <button
              type="button"
              disabled={start.isPending}
              onClick={() =>
                start.mutate({
                  description: task.title,
                  projectId: task.projectId,
                  taskId: task.id,
                })
              }
              className="flex items-center gap-2 rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
            >
              <PlayIcon className="size-3.5 fill-current" />
              Begin
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => complete.mutate({ id: task.id, completed: !done })}
          className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-foreground/75 ring-1 ring-white/20 transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <CheckIcon className="size-4" strokeWidth={1.5} />
          {done ? 'Not done' : 'Done'}
        </button>
        <button
          type="button"
          onClick={() => openTask(task.id)}
          className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <PencilLineIcon className="size-4" strokeWidth={1.5} />
          Edit
        </button>
      </div>
    </div>
  );
}
