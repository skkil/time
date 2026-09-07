import { CheckIcon, ChevronRightIcon, PlusIcon, XIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useMemo, useState } from 'react';

import type { Id, Outcome } from '@/bindings';
import { HabitCell } from '@/features/habits/HabitCell';
import { HabitsSheet } from '@/features/habits/HabitsSheet';
import {
  useHabitDays,
  useHabits,
  useSetHabitStatus,
} from '@/features/habits/api';
import { dayLookup } from '@/features/habits/api';
import { WEEKDAY_LETTERS } from '@/features/habits/meta';
import { ProjectDot } from '@/features/projects/ProjectDot';
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
import { setPreference, usePreference } from '@/lib/preferences';
import {
  type DateKey,
  formatDayOfMonth,
  formatHours,
  formatWeekday,
  fromDateKey,
  isoWeekNumber,
  mondayOf,
  shiftKey,
  todayKey,
  weekKeys,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { useBlocks } from './api';

const MAX_OUTCOMES = 3;

export function PlanStrip({ week }: { week: DateKey }) {
  return (
    <div className="grid shrink-0 gap-3 px-8 pb-5">
      <ReviewNudge week={week} />
      <OutcomesRow week={week} />
      <HabitsRow week={week} />
      <ProjectsRow week={week} />
    </div>
  );
}

function Row({
  label,
  open,
  onToggle,
  children,
  action,
}: {
  label: string;
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[96px_1fr_auto] items-start gap-4">
      {onToggle ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex items-center gap-1 pt-0.5 text-xs tracking-wide text-foreground/45 hover:text-foreground"
        >
          <ChevronRightIcon
            className={cn(
              'size-3 transition-transform duration-300',
              open && 'rotate-90',
            )}
          />
          {label}
        </button>
      ) : (
        <span className="pt-0.5 pl-4 text-xs tracking-wide text-foreground/45">
          {label}
        </span>
      )}
      <div className="min-w-0">{children}</div>
      {action ?? <span />}
    </div>
  );
}

function ReviewNudge({ week }: { week: DateKey }) {
  const runner = useRitualRunner();
  const thisMonday = mondayOf(todayKey());
  const lastMonday = shiftKey(thisMonday, -7);
  const { data: summaries } = useWeeks(lastMonday, thisMonday);
  const weekday = fromDateKey(todayKey()).getDay();
  const last = summaries?.[0];
  if (
    week !== thisMonday ||
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
    <p className="pl-4 text-sm text-foreground/55">
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

function OutcomesRow({ week }: { week: DateKey }) {
  const { data } = useWeek(week);
  const outcomes = (data?.outcomes ?? []).filter(
    (outcome) => outcome.status !== 'dropped',
  );
  const open = outcomes.filter((outcome) => outcome.status === 'open').length;
  return (
    <Row label="Outcomes">
      <div className="flex flex-wrap items-start gap-x-10 gap-y-3">
        {outcomes.map((outcome) => (
          <OutcomeItem key={outcome.id} outcome={outcome} />
        ))}
        {open < MAX_OUTCOMES && <AddOutcome week={week} />}
      </div>
    </Row>
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
    <div className="group flex max-w-xs min-w-48 items-start gap-2.5">
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
            className="w-full bg-transparent text-[15px] outline-none"
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
              'text-left text-[15px] leading-snug hover:underline',
              achieved && 'text-foreground/50',
            )}
          >
            {outcome.title}
          </button>
        )}
        <p className="mt-1 flex items-center gap-2 text-xs text-foreground/45">
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
                `${formatHours(outcome.trackedSeconds)} h`,
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
        className="mt-0.5 rounded-full p-0.5 text-foreground/40 opacity-0 group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
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
    <form onSubmit={submit} className="flex items-center gap-2 pt-0.5">
      <PlusIcon className="size-3.5 text-foreground/35" />
      <input
        value={title}
        maxLength={200}
        aria-label="Add an outcome"
        placeholder="Add an outcome"
        className="w-44 bg-transparent text-sm outline-none placeholder:text-foreground/35"
        onChange={(event) => setTitle(event.target.value)}
      />
    </form>
  );
}

function HabitsRow({ week }: { week: DateKey }) {
  const open = usePreference('weekHabitsOpen');
  const [editing, setEditing] = useState(false);
  const { data: habits = [] } = useHabits();
  const { data: days } = useHabitDays(week, shiftKey(week, 7));
  const setStatus = useSetHabitStatus();
  const lookup = useMemo(() => dayLookup(days), [days]);
  const keys = weekKeys(week);
  const today = todayKey();

  const edit = (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-xs text-foreground/45 hover:text-foreground hover:underline"
    >
      Edit habits
    </button>
  );
  const sheet = <HabitsSheet open={editing} onOpenChange={setEditing} />;

  if (habits.length === 0)
    return (
      <>
        <Row label="Habits" action={edit}>
          <span />
        </Row>
        {sheet}
      </>
    );

  return (
    <>
      <Row
        label="Habits"
        open={open}
        onToggle={() => setPreference('weekHabitsOpen', !open)}
        action={edit}
      >
        {open ? (
          <div className="grid gap-1">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="grid grid-cols-[minmax(0,180px)_repeat(7,28px)_auto] items-center gap-x-1.5"
              >
                <span className="truncate pr-2 text-sm text-foreground/80">
                  {habit.name}
                </span>
                {keys.map((day) => (
                  <HabitCell
                    key={day}
                    size="sm"
                    day={lookup(habit.id, day)}
                    readOnly={day > today}
                    label={`${habit.name}, ${formatWeekday(day)} ${formatDayOfMonth(day)}`}
                    onChange={(status) =>
                      setStatus.mutate({ habitId: habit.id, date: day, status })
                    }
                  />
                ))}
                <span className="pl-3 text-xs text-foreground/45">
                  {habit.dueDays > 0 &&
                    `${habit.doneDays} of last ${habit.dueDays}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <ol className="flex gap-5 text-xs">
            {keys.map((day, i) => {
              const scheduled = habits
                .map((habit) => ({ habit, entry: lookup(habit.id, day) }))
                .filter(({ habit, entry }) =>
                  day > today
                    ? habit.startDate <= day && (habit.days >> i) & 1
                    : entry &&
                      entry.status !== 'off' &&
                      entry.status !== 'skipped',
                );
              const done = scheduled.filter(
                ({ entry }) => entry?.status === 'done',
              ).length;
              return (
                <li
                  key={day}
                  className={cn(
                    'flex items-baseline gap-1.5 tabular-nums',
                    day > today ? 'text-foreground/25' : 'text-foreground/60',
                    day === today && 'text-foreground',
                  )}
                >
                  <span className="text-foreground/35">
                    {WEEKDAY_LETTERS[i]}
                  </span>
                  {scheduled.length === 0
                    ? 'rest'
                    : day > today
                      ? `${scheduled.length} due`
                      : `${done}/${scheduled.length}`}
                </li>
              );
            })}
          </ol>
        )}
      </Row>
      {sheet}
    </>
  );
}

function ProjectsRow({ week }: { week: DateKey }) {
  const open = usePreference('weekProjectsOpen');
  const index = useProjectIndex();
  const { data: entries = [] } = useTimeEntries(week, shiftKey(week, 7));
  const { data: blocks = [] } = useBlocks(week);

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
    <Row
      label="Projects"
      open={open}
      onToggle={() => setPreference('weekProjectsOpen', !open)}
    >
      {open ? (
        <div className="grid gap-2">
          {rows.map(({ project, target, tracked, planned }) => (
            <div
              key={project.id}
              className="grid grid-cols-[minmax(0,180px)_160px_auto] items-center gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ProjectDot color={project.color} />
                <span className="truncate">{project.name}</span>
              </span>
              <span
                aria-hidden
                className="relative h-1 overflow-hidden rounded-full bg-white/10"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-white/20"
                  style={{ width: `${Math.min(1, planned / target) * 100}%` }}
                />
                <span
                  className="absolute inset-y-0 left-0 bg-white/75"
                  style={{ width: `${Math.min(1, tracked / target) * 100}%` }}
                />
              </span>
              <span className="text-xs text-foreground/55 tabular-nums">
                {formatHours(tracked)} / {formatHours(target)} h
                {planned > 0 && ` · ${formatHours(planned)} h planned`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex flex-wrap gap-x-5 text-xs text-foreground/60 tabular-nums">
          {rows.map(({ project, target, tracked }) => (
            <span key={project.id} className="flex items-center gap-1.5">
              <ProjectDot color={project.color} />
              {project.name} {formatHours(tracked)} / {formatHours(target)} h
            </span>
          ))}
        </p>
      )}
    </Row>
  );
}
