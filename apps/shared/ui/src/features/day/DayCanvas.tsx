import { dayTarget } from '@skkil-time/rules/move';
import { liveEntry } from '@skkil-time/rules/timer';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';

import type { Id, Task, TimeEntry } from '@/backend';
import { DAY_PANEL } from '@/components/surfaces';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRitualRuns } from '@/features/rituals/api';
import { TaskPanel } from '@/features/tasks/TaskPanel';
import { useTaskIndex } from '@/features/tasks/api';
import { useTimeEntries, useTimer } from '@/features/time/api';
import { useEvents } from '@/features/workflow/api';
import { useNow } from '@/hooks/use-now';
import { usePreference } from '@/lib/preferences';
import { useShortcuts } from '@/lib/shortcuts';
import {
  dayStart,
  formatDuration,
  fromDateKey,
  secondsWithin,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { AnyTimeList } from './AnyTimeList';
import { CheckOut, CheckOutPrompt } from './CheckOut';
import { DayThread, type Moment } from './DayThread';
import { FreeFocus, StartFocus } from './FreeFocus';
import { Leftovers } from './Leftovers';
import { useDayPlan } from './plan';
import { describeWeather, useWeather } from './weather';

type Panel =
  { kind: 'task'; taskId: Id } | { kind: 'focus' } | { kind: 'checkout' };

const isTimed = (task: Task) => task.dueTime !== null;

export function DayCanvas({
  triage = false,
  onTriageClose,
}: {
  triage?: boolean;
  onTriageClose?: () => void;
}) {
  const today = todayKey();
  const plan = useDayPlan(today);
  const { data: events = [] } = useEvents(today, shiftKey(today, 1));
  const { data: timer } = useTimer();
  const { data: runs = [] } = useRitualRuns(today, shiftKey(today, 1));
  const { data: logged = [] } = useTimeEntries(today, shiftKey(today, 1));
  const now = useNow(30_000);
  const entries = useMemo<TimeEntry[]>(() => {
    const live = liveEntry(timer, now);
    return live ? [...logged, live] : logged;
  }, [logged, timer, now]);
  const tracked = entries.reduce(
    (sum, entry) => sum + secondsWithin(entry, today, shiftKey(today, 1)),
    0,
  );
  const [chosen, setChosen] = useState<Panel | null | undefined>(undefined);
  const [sorting, setSorting] = useState(false);

  const checkedOutAt =
    runs.find((run) => run.kind === 'evening' && run.finishedAt !== null)
      ?.finishedAt ?? null;

  const moments = useMemo<Moment[]>(() => {
    const timed = plan.blocks.map((block) => ({
      key: `block-${block.id}`,
      taskId: block.taskId,
      title: block.title,
      priority: block.priority,
      projectId: block.projectId,
      start: block.startAt,
      end: block.endAt,
      showEnd: true,
      kind: 'block' as const,
      done: block.completed,
    }));
    const anchors = events.map((event) => ({
      key: `event-${event.taskId}-${event.startAt}`,
      taskId: event.taskId,
      title: event.title,
      priority: 4,
      projectId: event.projectId,
      start: event.startAt,
      end: event.endAt,
      showEnd: true,
      kind: 'event' as const,
      done: false,
    }));
    const finishedHere = plan.doneToday.filter(
      (task) => task.dueDate === today,
    );
    const due = [...plan.musts, ...plan.due, ...finishedHere]
      .filter(isTimed)
      .map((task) => {
        const start = dayStart(today) + task.dueTime! * 60;
        return {
          key: `due-${task.id}`,
          taskId: task.id,
          title: task.title,
          priority: task.priority,
          projectId: task.projectId,
          start,
          end: start + (task.estimateMinutes ?? 0) * 60,
          showEnd: task.estimateMinutes !== null,
          kind: 'due' as const,
          done: task.completedAt !== null,
        };
      });
    return [...timed, ...anchors, ...due].sort((a, b) => a.start - b.start);
  }, [plan.blocks, plan.musts, plan.due, plan.doneToday, events, today]);

  const blocked = new Set(plan.blocks.map((block) => block.taskId));
  const anyTime = [...plan.musts, ...plan.due, ...plan.thisWeek].filter(
    (task) => !isTimed(task),
  );
  const finished = plan.doneToday.filter(
    (task) =>
      !blocked.has(task.id) && !(isTimed(task) && task.dueDate === today),
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
    <div className="mx-auto flex h-full w-full max-w-[1180px] flex-col px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-24 lg:pt-6 lg:pb-12">
      <div className="flex flex-col gap-4 pb-5 lg:flex-row lg:items-start lg:justify-between lg:gap-6 lg:pb-8">
        <div className="grid min-w-0 gap-5 max-lg:contents">
          <TodayLine tracked={tracked} />
          <div className="grid min-w-0 justify-items-start gap-2 max-lg:order-1">
            <AnyTimeList
              tasks={anyTime}
              finished={finished}
              openId={openId}
              runningId={timer?.taskId ?? null}
              onPick={(taskId) => setChosen({ kind: 'task', taskId })}
            />
            {plan.earlier.length > 0 && (
              <button
                type="button"
                onClick={() => setSorting(true)}
                className="text-sm text-foreground/85 underline decoration-foreground/30 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
              >
                {plan.earlier.length === 1
                  ? '1 task from earlier days'
                  : `${plan.earlier.length} tasks from earlier days`}
              </button>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pt-4">
          <StartFocus
            open={
              panel?.kind === 'focus' ||
              (panel?.kind === 'task' && panel.taskId === timer?.taskId)
            }
            onOpen={() => setChosen({ kind: 'focus' })}
          />
          <CheckOut
            done={checkedOutAt !== null}
            open={panel?.kind === 'checkout'}
            onToggle={(open) => setChosen(open ? { kind: 'checkout' } : null)}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            'flex min-h-0 shrink-0 flex-col transition-[width] duration-200 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
            panel ? 'w-full lg:w-[clamp(300px,40%,380px)]' : 'w-full',
          )}
        >
          <DayThread
            moments={moments}
            entries={entries}
            now={now}
            openId={openId}
            runningId={timer?.taskId ?? null}
            onPick={(taskId) => setChosen({ kind: 'task', taskId })}
          />
        </aside>

        {panel && (
          <section
            className="min-h-0 min-w-0 flex-1 pl-16 max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:flex max-lg:animate-in max-lg:flex-col max-lg:justify-end max-lg:bg-black/40 max-lg:pt-[calc(4.5rem+env(safe-area-inset-top))] max-lg:pl-0 max-lg:duration-200 max-lg:fade-in-0"
            onClick={(event) => {
              if (event.target === event.currentTarget) setChosen(null);
            }}
          >
            {panel.kind === 'task' && (
              <Focus key={panel.taskId} taskId={panel.taskId} />
            )}
            {panel.kind === 'focus' && <FreeFocus />}
            {panel.kind === 'checkout' && (
              <CheckOutPrompt checkedOutAt={checkedOutAt} />
            )}
          </section>
        )}
      </div>

      <Dialog
        open={sorting || triage}
        onOpenChange={(open) => {
          setSorting(open);
          if (!open) onTriageClose?.();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>From earlier days</DialogTitle>
            <DialogDescription>
              Give each one a day, park it, or let it go.
            </DialogDescription>
          </DialogHeader>
          <Leftovers tasks={plan.earlier} target={dayTarget(todayKey())} />
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
    <header className="grid animate-in gap-1 duration-1000 fade-in-0 slide-in-from-bottom-1">
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
    </header>
  );
}

function Focus({ taskId }: { taskId: Id }) {
  const tasks = useTaskIndex();
  const task = tasks.byId.get(taskId);
  if (!task) return null;

  return (
    <div className={DAY_PANEL}>
      <TaskPanel key={task.id} task={task} />
    </div>
  );
}
