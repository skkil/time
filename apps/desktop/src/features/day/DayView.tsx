import { format } from 'date-fns';
import { CheckIcon, PlayIcon, SquareIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { TimeBlock } from '@/bindings';
import { Page, PageBody, PageHeader, Stat } from '@/components/page';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { HabitCell } from '@/features/habits/HabitCell';
import {
  dayLookup,
  useHabitDays,
  useHabits,
  useSetHabitStatus,
} from '@/features/habits/api';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { useWeek } from '@/features/review/api';
import { outcomeEvidence } from '@/features/review/format';
import { useRitualRuns } from '@/features/rituals/api';
import { useRitualRunner } from '@/features/rituals/runner-context';
import { TaskItem } from '@/features/tasks/TaskItem';
import { FlatTaskList } from '@/features/tasks/TaskList';
import { useTaskIndex } from '@/features/tasks/api';
import { useStartTimer, useStopTimer, useTimer } from '@/features/time/api';
import { useNow } from '@/hooks/use-now';
import { setPreference, usePreference } from '@/lib/preferences';
import {
  formatClockTime,
  formatDuration,
  formatStopwatch,
  fromDateKey,
  mondayOf,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { Leftovers } from './Leftovers';
import { type DayPlan, useDayPlan } from './plan';

export function DayView() {
  const { data: timer } = useTimer();
  return timer ? <NowPanel /> : <Outline />;
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="grid gap-2">
      <div className="flex h-7 items-center gap-2">
        <h2 className="font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Outline() {
  const today = todayKey();
  const plan = useDayPlan(today);
  const now = useNow(60_000);
  const [sorting, setSorting] = useState(false);
  const empty =
    plan.blocks.length + plan.musts.length + plan.due.length === 0 &&
    !plan.loading;

  return (
    <Page>
      <PageHeader
        title={format(fromDateKey(today), 'EEEE d MMMM')}
        meta={[
          <Stat
            value={String(
              plan.blocks.length + plan.musts.length + plan.due.length,
            )}
            label="planned"
          />,
          plan.plannedSeconds > 0 && (
            <Stat value={formatDuration(plan.plannedSeconds)} label="blocked" />
          ),
          plan.doneToday.length > 0 && (
            <Stat value={String(plan.doneToday.length)} label="done" />
          ),
        ]}
      />
      <PageBody>
        <div className="mx-auto grid max-w-3xl gap-8">
          <PlanTodayCard plan={plan} />

          <WeekOutcomes />

          {plan.earlier.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
              <span>
                <span className="font-semibold">{plan.earlier.length}</span>{' '}
                {plan.earlier.length === 1 ? 'task' : 'tasks'} from earlier days
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => setSorting(true)}
              >
                Sort out
              </Button>
            </div>
          )}

          {plan.blocks.length > 0 && (
            <Section title="Schedule">
              <ol className="grid gap-1.5">
                {plan.blocks.map((block) => (
                  <BlockRow key={block.id} block={block} now={now} />
                ))}
              </ol>
            </Section>
          )}

          {plan.musts.length > 0 && (
            <Section title="Must do">
              <FlatTaskList tasks={plan.musts} />
            </Section>
          )}

          {plan.due.length > 0 && (
            <Section title={plan.musts.length > 0 ? 'Also today' : 'Today'}>
              <FlatTaskList tasks={plan.due} />
            </Section>
          )}

          {empty && (
            <div className="rounded-lg border border-dashed px-5 py-6 text-sm">
              <p className="font-medium">Nothing planned yet.</p>
              <p className="mt-1 text-muted-foreground">
                Pick one thing that would make today count, or open Week to
                block time.
              </p>
            </div>
          )}

          <TodayHabits />

          {plan.nextActions.length > 0 && (
            <Section title="Next in your projects">
              <ul>
                {plan.nextActions.map(({ project, task }) => (
                  <li key={project.id} className="flex items-start gap-3">
                    <span className="mt-2.5 flex w-28 shrink-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <ProjectDot color={project.color} />
                      <span className="truncate">{project.name}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <TaskItem task={task} />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </PageBody>

      <Dialog open={sorting} onOpenChange={setSorting}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>From earlier days</DialogTitle>
            <DialogDescription>
              Give each one a day, park it, or let it go.
            </DialogDescription>
          </DialogHeader>
          <Leftovers tasks={plan.earlier} target={today} />
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function PlanTodayCard({ plan }: { plan: DayPlan & { loading: boolean } }) {
  const today = todayKey();
  const { open, active } = useRitualRunner();
  const dismissed = usePreference('dismissedPlanCard') === today;
  const { data: runs } = useRitualRuns(today, shiftKey(today, 1));
  const planned = plan.blocks.length > 0 || plan.musts.length > 0;
  const planningRanToday = (runs ?? []).some(
    (run) => run.kind === 'morning' && run.finishedAt !== null,
  );
  if (plan.loading || planned || dismissed || planningRanToday || active)
    return null;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-primary/30 bg-now-tint px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Plan today · 2 min</p>
        <p className="text-xs text-muted-foreground">
          Sort leftovers, pick up to three musts, give them a time.
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setPreference('dismissedPlanCard', today)}
      >
        Not today
      </Button>
      <Button size="sm" onClick={() => open('morning')}>
        Start
      </Button>
    </div>
  );
}

function BlockRow({ block, now }: { block: TimeBlock; now: number }) {
  const start = useStartTimer();
  const index = useProjectIndex();
  const project =
    block.projectId === null ? undefined : index.byId.get(block.projectId);
  const state =
    block.completed || block.endAt <= now
      ? 'past'
      : block.startAt <= now
        ? 'now'
        : 'later';

  return (
    <li
      className={cn(
        'group/block flex items-center gap-3 rounded-md border bg-card px-3 py-2',
        state === 'now' && 'border-primary ring-1 ring-primary',
        state === 'past' && 'bg-transparent text-muted-foreground',
      )}
    >
      <span className="w-24 shrink-0 text-xs text-muted-foreground">
        {formatClockTime(block.startAt)}–{formatClockTime(block.endAt)}
      </span>
      <ProjectDot color={project?.color} />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          block.completed && 'line-through',
        )}
      >
        {block.title}
      </span>
      {state === 'now' && (
        <span className="text-xs font-medium text-primary">Now</span>
      )}
      {block.completed ? (
        <CheckIcon className="size-4 text-due-today" />
      ) : (
        <Button
          size="icon-xs"
          variant={state === 'now' ? 'default' : 'ghost'}
          aria-label={`Start ${block.title}`}
          className={cn(
            state !== 'now' &&
              'opacity-0 group-hover/block:opacity-100 focus-visible:opacity-100',
          )}
          onClick={() =>
            start.mutate({
              description: block.title,
              projectId: block.projectId,
              taskId: block.taskId,
            })
          }
        >
          <PlayIcon />
        </Button>
      )}
    </li>
  );
}

function WeekOutcomes() {
  const { data: week } = useWeek(mondayOf(todayKey()));
  const outcomes = (week?.outcomes ?? []).filter(
    (outcome) => outcome.status === 'open',
  );
  if (outcomes.length === 0) return null;
  return (
    <Section title="This week">
      <ul className="grid gap-2 sm:grid-cols-3">
        {outcomes.map((outcome) => (
          <li key={outcome.id} className="rounded-md bg-now-tint px-3 py-2">
            <p className="text-sm leading-snug font-medium">{outcome.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {outcomeEvidence(outcome)}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TodayHabits() {
  const today = todayKey();
  const { data: habits } = useHabits();
  const { data: days } = useHabitDays(today, shiftKey(today, 1));
  const setStatus = useSetHabitStatus();
  const lookup = dayLookup(days);
  const due = (habits ?? []).filter((habit) => {
    const status = lookup(habit.id, today)?.status;
    return status !== undefined && status !== 'off';
  });
  if (due.length === 0) return null;

  return (
    <Section title="Habits">
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {due.map((habit) => (
          <li key={habit.id} className="flex items-center gap-2">
            <HabitCell
              size="sm"
              day={lookup(habit.id, today)}
              label={habit.name}
              onChange={(status) =>
                setStatus.mutate({ habitId: habit.id, date: today, status })
              }
            />
            <span className="text-sm">{habit.name}</span>
            {habit.anchor && (
              <span className="text-xs text-muted-foreground">
                after {habit.anchor}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function NowPanel() {
  const { data: timer } = useTimer();
  const stop = useStopTimer();
  const tasks = useTaskIndex();
  const index = useProjectIndex();
  const today = todayKey();
  const plan = useDayPlan(today);
  const now = useNow(1000);
  if (!timer) return null;

  const task = timer.taskId === null ? undefined : tasks.byId.get(timer.taskId);
  const project = timer.projectId ? index.byId.get(timer.projectId) : undefined;
  const block = plan.blocks.find(
    (candidate) => candidate.startAt <= now && candidate.endAt > now,
  );
  const next = plan.blocks.find((candidate) => candidate.startAt > now);

  return (
    <Page>
      <PageBody className="grid place-items-center">
        <div className="grid w-full max-w-xl justify-items-center gap-6 text-center">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ProjectDot color={project?.color} />
            {project?.name ?? 'No project'}
          </p>
          <h1 className="text-3xl leading-tight font-bold text-balance">
            {task?.title || timer.description || 'Untitled session'}
          </h1>
          <p className="text-5xl font-semibold tracking-tight text-primary">
            {formatStopwatch(now - timer.startedAt)}
          </p>
          {block && (
            <p className="text-sm text-muted-foreground">
              Block {formatClockTime(block.startAt)}–
              {formatClockTime(block.endAt)} ·{' '}
              {formatDuration(Math.max(0, block.endAt - now))} left
            </p>
          )}
          {task?.nextStep && (
            <p className="max-w-md rounded-md bg-now-tint px-4 py-2 text-sm">
              <span className="font-medium">Where you left off:</span>{' '}
              {task.nextStep}
            </p>
          )}
          <Button size="lg" onClick={() => stop.mutate(undefined)}>
            <SquareIcon className="fill-current" />
            Stop
          </Button>
          {next && (
            <p className="text-xs text-muted-foreground">
              Next: {next.title} at {formatClockTime(next.startAt)}
            </p>
          )}
        </div>
      </PageBody>
    </Page>
  );
}
