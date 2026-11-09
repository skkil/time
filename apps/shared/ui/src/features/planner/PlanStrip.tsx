import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';

import type { Id, Outcome } from '@/backend';
import { HabitsSheet } from '@/features/habits/HabitsSheet';
import { useHabitDays, useHabits } from '@/features/habits/api';
import { dayLookup } from '@/features/habits/api';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { ProjectLink } from '@/features/projects/ProjectLink';
import { useProjectIndex } from '@/features/projects/api';
import { descendantIds } from '@/features/projects/tree';
import {
  useCreateOutcome,
  useRemoveOutcome,
  useSetOutcomeStatus,
  useUpdateOutcome,
  useWeek,
  useWeeks,
} from '@/features/review/api';
import { useRitualRunner } from '@/features/rituals/runner-context';
import { useTimeEntries } from '@/features/time/api';
import {
  type DateKey,
  formatDuration,
  fromDateKey,
  isoWeekNumber,
  mondayOf,
  reviewWeekOf,
  shiftKey,
  todayKey,
  weekKeys,
  weekStartOf,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { useBlocks } from './api';

const MAX_OUTCOMES = 3;

export function WeekPlan({ start }: { start: DateKey }) {
  return (
    <div className="grid gap-6 border-b border-white/10 p-4 pb-5">
      <ReviewNudge start={start} />
      <RailBlock title="Outcomes">
        <OutcomesList week={reviewWeekOf(start)} />
      </RailBlock>
      <ProjectHours start={start} />
      <HabitsLine start={start} />
    </div>
  );
}

function RailBlock({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs tracking-wide text-foreground/75">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ReviewNudge({ start }: { start: DateKey }) {
  const runner = useRitualRunner();
  const thisMonday = mondayOf(todayKey());
  const lastMonday = shiftKey(thisMonday, -7);
  const { data: summaries } = useWeeks(lastMonday, thisMonday);
  const weekday = fromDateKey(todayKey()).getDay();
  const last = summaries?.[0];
  if (
    start !== weekStartOf(todayKey()) ||
    weekday === 0 ||
    weekday > 3 ||
    !last ||
    last.reviewedAt !== null ||
    (last.trackedSeconds === 0 &&
      last.outcomesTotal === 0 &&
      last.tasksCompleted === 0)
  )
    return null;
  return (
    <p className="text-sm text-foreground/75">
      Week {isoWeekNumber(lastMonday)} isn’t reviewed ·{' '}
      <button
        type="button"
        onClick={() => runner.open('weekly')}
        className="text-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
      >
        Review (about 10 min)
      </button>
    </p>
  );
}

function useOutcomes(week: DateKey) {
  const { data } = useWeek(week);
  const outcomes = (data?.outcomes ?? []).filter(
    (outcome) => outcome.status !== 'dropped',
  );
  const open = outcomes.filter((outcome) => outcome.status === 'open').length;
  return { outcomes, canAdd: open < MAX_OUTCOMES };
}

function OutcomesList({ week }: { week: DateKey }) {
  const { outcomes, canAdd } = useOutcomes(week);
  return (
    <div className="grid gap-3">
      {outcomes.map((outcome) => (
        <OutcomeItem key={outcome.id} outcome={outcome} />
      ))}
      {canAdd && <AddOutcome week={week} />}
    </div>
  );
}

function OutcomeItem({ outcome }: { outcome: Outcome }) {
  const rename = useUpdateOutcome();
  const remove = useRemoveOutcome();
  const setStatus = useSetOutcomeStatus();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(outcome.title);
  const achieved = outcome.status === 'achieved';
  const share = outcome.tasksTotal ? outcome.tasksDone / outcome.tasksTotal : 0;

  const save = () => {
    setEditing(false);
    if (title.trim() && title !== outcome.title)
      rename.mutate({
        id: outcome.id,
        title: title.trim(),
        priorityId: outcome.priorityId,
      });
    else setTitle(outcome.title);
  };

  return (
    <div className="group flex items-start gap-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={achieved}
        aria-label={
          achieved
            ? `Reopen ${outcome.title}`
            : `Mark ${outcome.title} achieved`
        }
        disabled={outcome.status === 'carried'}
        onClick={() =>
          setStatus.mutate({
            id: outcome.id,
            status: achieved ? 'open' : 'achieved',
          })
        }
        className={cn(
          'mt-1 grid size-4 shrink-0 place-items-center rounded-full transition-colors',
          achieved
            ? 'bg-white/70 text-[#0b1a22]'
            : 'ring-1 ring-white/40 hover:ring-white/80',
        )}
      >
        {achieved && <CheckIcon className="size-2.5" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={title}
            maxLength={200}
            aria-label="Outcome"
            className="w-full bg-transparent text-sm outline-none"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={save}
            onKeyDown={(event) => {
              if (event.key === 'Enter') save();
              if (event.key === 'Escape') {
                setTitle(outcome.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              'text-left text-sm leading-snug hover:underline',
              achieved && 'text-foreground/75',
            )}
          >
            {outcome.title}
          </button>
        )}
        <p className="mt-1 flex items-center gap-2 text-xs text-foreground/75">
          {outcome.tasksTotal > 0 && (
            <span
              aria-hidden
              className="relative h-px w-10 overflow-hidden rounded-full bg-white/15"
            >
              <span
                className="absolute inset-y-0 left-0 bg-white/70"
                style={{ width: `${share * 100}%` }}
              />
            </span>
          )}
          <span>
            {[
              outcome.tasksTotal
                ? `${outcome.tasksDone} of ${outcome.tasksTotal}`
                : 'no tasks linked',
              outcome.trackedSeconds > 0 &&
                formatDuration(outcome.trackedSeconds),
              outcome.timesCarried > 0 && `carried ×${outcome.timesCarried}`,
              outcome.status === 'carried' && 'moved to next week',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </p>
      </div>
      <button
        type="button"
        aria-label={`Remove ${outcome.title}`}
        onClick={() => remove.mutate(outcome.id)}
        className="mt-0.5 rounded-full p-0.5 text-foreground/75 opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

function AddOutcome({ week }: { week: DateKey }) {
  const create = useCreateOutcome(week);
  const [title, setTitle] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (title.trim())
      create.mutate(
        { title: title.trim(), priorityId: null },
        { onSuccess: () => setTitle('') },
      );
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2.5">
      <PlusIcon className="size-4 text-foreground/75" />
      <input
        value={title}
        maxLength={200}
        aria-label="Add an outcome"
        placeholder="Add an outcome"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/35"
        onChange={(event) => setTitle(event.target.value)}
      />
    </form>
  );
}

function HabitsLine({ start }: { start: DateKey }) {
  const [editing, setEditing] = useState(false);
  const { data: habits = [] } = useHabits();
  const { data: days } = useHabitDays(start, shiftKey(start, 7));
  const lookup = useMemo(() => dayLookup(days), [days]);
  const today = todayKey();
  const results = habits.flatMap((habit) =>
    weekKeys(start)
      .filter((day) => day <= today)
      .map((day) => lookup(habit.id, day)?.status),
  );
  const done = results.filter((status) => status === 'done').length;
  const due = results.filter(
    (status) => status === 'done' || status === 'failed' || status === 'missed',
  ).length;

  return (
    <RailBlock
      title="Habits"
      action={
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-foreground/75 hover:text-foreground hover:underline"
        >
          {habits.length ? 'Open' : 'Add'}
        </button>
      }
    >
      {habits.length > 0 && (
        <p className="text-sm text-foreground/70 tabular-nums">
          {due > 0 ? `${done} of ${due} habits done today` : 'Nothing due yet'}
        </p>
      )}
      <HabitsSheet open={editing} onOpenChange={setEditing} />
    </RailBlock>
  );
}

function ProjectHours({ start }: { start: DateKey }) {
  const index = useProjectIndex();
  const { data: entries = [] } = useTimeEntries(start, shiftKey(start, 7));
  const { data: blocks = [] } = useBlocks(start);

  const rows = useMemo(() => {
    const sum = (
      spans: { projectId: Id | null; seconds: number }[],
      ids: Set<Id>,
    ) =>
      spans.reduce(
        (total, span) =>
          span.projectId !== null && ids.has(span.projectId)
            ? total + span.seconds
            : total,
        0,
      );
    const tracked = entries.map((entry) => ({
      projectId: entry.projectId,
      seconds: entry.endedAt - entry.startedAt,
    }));
    const planned = blocks.map((block) => ({
      projectId: block.projectId,
      seconds: block.endAt - block.startAt,
    }));
    return index.active
      .filter((project) => project.status === 'active' && project.weeklyMinutes)
      .map((project) => {
        const ids = descendantIds(project);
        return {
          project,
          target: (project.weeklyMinutes ?? 0) * 60,
          tracked: sum(tracked, ids),
          planned: sum(planned, ids),
        };
      });
  }, [index, entries, blocks]);

  if (rows.length === 0) return null;

  return (
    <RailBlock title="Hours">
      <ul className="grid gap-2.5">
        {rows.map(({ project, target, tracked, planned }) => (
          <li key={project.id} className="grid gap-1.5 text-sm">
            <span className="flex items-center gap-2">
              <ProjectLink
                projectId={project.id}
                className="flex flex-1 items-center gap-2 truncate"
              >
                <ProjectDot color={project.color} />
                <span className="truncate">{project.name}</span>
              </ProjectLink>
              <span className="text-xs text-foreground/75 tabular-nums">
                {formatDuration(tracked)} of {formatDuration(target)}
              </span>
            </span>
            <span
              aria-hidden
              className="relative h-0.5 overflow-hidden rounded-full bg-white/10"
            >
              <span
                className="absolute inset-y-0 left-0 bg-white/25"
                style={{ width: `${Math.min(1, planned / target) * 100}%` }}
              />
              <span
                className="absolute inset-y-0 left-0 bg-white/75"
                style={{ width: `${Math.min(1, tracked / target) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </RailBlock>
  );
}
