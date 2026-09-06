import { Link, useNavigate } from '@tanstack/react-router';
import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Id, TimeEntry } from '@/bindings';
import { HabitCell } from '@/features/habits/HabitCell';
import { HabitsSheet } from '@/features/habits/HabitsSheet';
import { dayLookup, useHabitDays, useHabits } from '@/features/habits/api';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { rootOf } from '@/features/projects/tree';
import { useDays, useWeek, useWeeks } from '@/features/review/api';
import { useRitualRunner } from '@/features/rituals/runner-context';
import { useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { EntryDialog } from '@/features/time/EntryDialog';
import { useTimeEntries } from '@/features/time/api';
import { useTypeTime } from '@/features/workflow/api';
import { FELT_LABELS } from '@/lib/felt';
import {
  type DateKey,
  dateKeyOf,
  formatClockTime,
  formatDayLabel,
  formatDuration,
  formatHours,
  formatWeekRange,
  formatWeekday,
  isoWeekNumber,
  mondayOf,
  shiftKey,
  todayKey,
  weekKeys,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { ReportSection } from './ReportsPage';
import { pickInsight } from './insight';
import { isHeldBack } from './period';

export function WeekPage({ week }: { week: DateKey }) {
  const today = todayKey();
  const thisMonday = mondayOf(today);
  const runner = useRitualRunner();
  const { data, isPending } = useWeek(week);
  const reviewed = data?.reviewedAt != null;
  const heldBack = isHeldBack(week, reviewed, today);
  const review = () =>
    week === shiftKey(thisMonday, -7) ? runner.open('weekly') : undefined;

  return (
    <article className="mt-8 grid gap-12">
      <header>
        <p className="text-sm text-foreground/45">
          {formatWeekRange(week)}
          {week === thisMonday && ' · this week'}
        </p>
        <h1 className="mt-1 text-5xl font-light tracking-tight">
          Week {isoWeekNumber(week)}
        </h1>
        <p className="mt-3 flex flex-wrap gap-x-3 text-sm text-foreground/55">
          {data?.felt && (
            <span>Felt {FELT_LABELS[data.felt - 1].toLowerCase()}</span>
          )}
          <span>{reviewed ? 'Reviewed' : 'Not reviewed'}</span>
          {week < thisMonday &&
            (week === shiftKey(thisMonday, -7) ? (
              <button
                type="button"
                onClick={review}
                className="text-foreground/80 hover:underline"
              >
                {reviewed ? 'Edit review' : 'Review'}
              </button>
            ) : (
              <Link
                to="/review/$week"
                params={{ week }}
                className="text-foreground/80 hover:underline"
              >
                {reviewed ? 'Edit review' : 'Review'}
              </Link>
            ))}
        </p>
      </header>
      {isPending ? null : heldBack ? (
        <button
          type="button"
          onClick={review}
          className="w-fit rounded-full bg-white/90 px-6 py-3 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
        >
          Review week {isoWeekNumber(week)} · about 10 min
        </button>
      ) : (
        <WeekBody week={week} />
      )}
    </article>
  );
}

function WeekBody({ week }: { week: DateKey }) {
  const end = shiftKey(week, 7);
  const navigate = useNavigate();
  const { openTask } = useTaskDialog();
  const index = useProjectIndex();
  const { data } = useWeek(week);
  const { data: summaries } = useWeeks(week, end);
  const { data: entries = [] } = useTimeEntries(week, end);
  const { data: tasks = [] } = useTasks();
  const { data: days = [] } = useDays(week, end);
  const { data: habits = [] } = useHabits();
  const { data: habitDays } = useHabitDays(week, end);
  const { data: byType = [] } = useTypeTime(week, end);
  const [habitsOpen, setHabitsOpen] = useState(false);
  const summary = summaries?.[0];
  const outcomes = (data?.outcomes ?? []).filter((o) => o.status !== 'dropped');
  const lookup = useMemo(() => dayLookup(habitDays), [habitDays]);
  const keys = weekKeys(week);

  const projects = useMemo(() => {
    const totals = new Map<Id | null, number>();
    for (const entry of entries) {
      const root =
        entry.projectId === null
          ? null
          : (rootOf(index, entry.projectId)?.id ?? null);
      totals.set(
        root,
        (totals.get(root) ?? 0) + entry.endedAt - entry.startedAt,
      );
    }
    const sorted = [...totals.entries()]
      .map(([id, seconds]) => ({
        id,
        name:
          id === null ? 'No project' : (index.byId.get(id)?.name ?? 'Project'),
        color: id === null ? undefined : index.byId.get(id)?.color,
        seconds,
      }))
      .sort((a, b) => b.seconds - a.seconds);
    const top = sorted.slice(0, 3);
    const rest = sorted.slice(3).reduce((sum, item) => sum + item.seconds, 0);
    return { all: sorted, top, rest };
  }, [entries, index]);

  const habitTotals = habits.map((habit) => {
    const results = keys.map((day) => lookup(habit.id, day));
    const due = results.filter(
      (day) => day && ['done', 'failed', 'missed'].includes(day.status),
    ).length;
    const done = results.filter((day) => day?.status === 'done').length;
    return { habit, results, due, done };
  });

  const linked = new Set(outcomes.map((o) => o.id));
  const alsoFinished = tasks.filter(
    (task) =>
      task.completedAt !== null &&
      dateKeyOf(task.completedAt) >= week &&
      dateKeyOf(task.completedAt) < end &&
      !(task.outcomeId !== null && linked.has(task.outcomeId)),
  );

  const insight = summary
    ? pickInsight({
        trackedSeconds: summary.trackedSeconds,
        plannedSeconds: summary.plannedSeconds,
        outcomes: data?.outcomes ?? [],
        projects: projects.all,
        habits: habitTotals.map(({ habit, done, due }) => ({
          name: habit.name,
          kind: habit.kind,
          done,
          due,
        })),
      })
    : null;
  const notes = data?.notes;
  const hasNotes = notes && (notes.worked || notes.fellShort || notes.change);
  const hasDays = days.some((day) => day.felt || day.note);

  return (
    <>
      {insight && (
        <p className="-mt-4 text-xl leading-relaxed font-light text-foreground/85">
          {insight.text}
          {insight.action && (
            <>
              {' '}
              <button
                type="button"
                onClick={() =>
                  insight.action?.target === 'habits'
                    ? setHabitsOpen(true)
                    : navigate({
                        to: '/',
                        search: {
                          view: 'week',
                          week: [end, mondayOf(todayKey())].sort().at(-1)!,
                        },
                      })
                }
                className="text-base text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
              >
                {insight.action.label}
              </button>
            </>
          )}
        </p>
      )}

      {summary &&
        (summary.trackedSeconds > 0 || summary.plannedSeconds > 0) && (
          <ReportSection title="Focused hours">
            <p className="text-4xl font-extralight tabular-nums">
              {formatHours(summary.trackedSeconds)} h
              <span className="ml-3 text-base text-foreground/45">
                tracked
                {summary.plannedSeconds > 0 &&
                  ` · ${formatHours(summary.plannedSeconds)} h planned`}
              </span>
            </p>
          </ReportSection>
        )}

      {(outcomes.length > 0 || alsoFinished.length > 0) && (
        <ReportSection title="Outcomes">
          <ul className="grid gap-3">
            {outcomes.map((outcome) => (
              <li key={outcome.id} className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-1.5 grid size-4 shrink-0 place-items-center rounded-full',
                    outcome.status === 'achieved'
                      ? 'bg-white/70 text-[#0b1a22]'
                      : 'ring-1 ring-white/35',
                  )}
                >
                  {outcome.status === 'achieved' && (
                    <CheckIcon className="size-2.5" strokeWidth={3} />
                  )}
                </span>
                <div>
                  <p className="text-[17px]">{outcome.title}</p>
                  <p className="text-sm text-foreground/45">
                    {[
                      outcome.status === 'achieved'
                        ? 'achieved'
                        : outcome.status === 'carried'
                          ? 'carried to the next week'
                          : 'not achieved',
                      outcome.tasksTotal > 0 &&
                        `${outcome.tasksDone} of ${outcome.tasksTotal} tasks`,
                      outcome.trackedSeconds > 0 &&
                        `${formatHours(outcome.trackedSeconds)} h`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {alsoFinished.length > 0 && (
            <p className="text-sm leading-relaxed text-foreground/55">
              Also finished:{' '}
              {alsoFinished.slice(0, 8).map((task, i) => (
                <span key={task.id}>
                  {i > 0 && ', '}
                  <button
                    type="button"
                    onClick={() => openTask(task.id)}
                    className="hover:text-foreground hover:underline"
                  >
                    {task.title}
                  </button>
                </span>
              ))}
              {alsoFinished.length > 8 &&
                ` and ${alsoFinished.length - 8} more`}
            </p>
          )}
        </ReportSection>
      )}

      {projects.top.length > 0 && (
        <ReportSection title="Time by project">
          <ul className="grid gap-2">
            {projects.top.map((item) => (
              <li key={item.id ?? 'none'} className="flex items-center gap-2.5">
                <ProjectDot color={item.color} />
                <span className="flex-1">{item.name}</span>
                <span className="text-sm text-foreground/60 tabular-nums">
                  {formatHours(item.seconds)} h
                </span>
              </li>
            ))}
            {projects.rest > 0 && (
              <li className="flex items-center gap-2.5 pl-[18px] text-foreground/60">
                <span className="flex-1">Other</span>
                <span className="text-sm tabular-nums">
                  {formatHours(projects.rest)} h
                </span>
              </li>
            )}
          </ul>
        </ReportSection>
      )}

      {byType.length > 0 && (
        <ReportSection title="Time by type">
          <p className="text-[15px] text-foreground/75">
            {byType
              .map((item) => `${item.name} ${formatHours(item.seconds)} h`)
              .join(' · ')}
          </p>
        </ReportSection>
      )}

      {habitTotals.some((item) => item.due > 0) && (
        <ReportSection title="Habits">
          <div className="grid gap-1.5">
            {habitTotals
              .filter((item) => item.due > 0)
              .map(({ habit, results, due, done }) => (
                <div
                  key={habit.id}
                  className="grid grid-cols-[minmax(0,200px)_repeat(7,28px)_auto] items-center gap-x-1.5"
                >
                  <span className="truncate pr-2 text-sm">{habit.name}</span>
                  {results.map((day, i) => (
                    <HabitCell
                      key={keys[i]}
                      size="sm"
                      readOnly
                      day={day}
                      label={`${habit.name}, ${formatWeekday(keys[i])}`}
                      onChange={() => undefined}
                    />
                  ))}
                  <span className="pl-3 text-xs text-foreground/50">
                    {done} of {due} days
                  </span>
                </div>
              ))}
          </div>
        </ReportSection>
      )}

      {hasDays && (
        <ReportSection title="Days">
          <ul className="grid gap-1.5">
            {keys.map((key) => {
              const day = days.find((item) => item.date === key);
              return (
                <li
                  key={key}
                  className="grid grid-cols-[96px_72px_1fr] gap-3 text-sm"
                >
                  <span className="text-foreground/45">
                    {formatDayLabel(key)}
                  </span>
                  <span className="text-foreground/70">
                    {day?.felt
                      ? FELT_LABELS[day.felt - 1]
                      : day?.skipped
                        ? 'skipped'
                        : ''}
                  </span>
                  <span className="text-foreground/80">{day?.note}</span>
                </li>
              );
            })}
          </ul>
        </ReportSection>
      )}

      {hasNotes && (
        <ReportSection title="Notes">
          <dl className="grid gap-4 text-[15px] leading-relaxed">
            {[
              ['What worked', notes.worked],
              ['What fell short', notes.fellShort],
              ['One change', notes.change],
            ]
              .filter(([, text]) => text)
              .map(([label, text]) => (
                <div key={label}>
                  <dt className="text-sm text-foreground/45">{label}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap">{text}</dd>
                </div>
              ))}
          </dl>
        </ReportSection>
      )}

      {entries.length > 0 && <Entries entries={entries} />}

      <HabitsSheet open={habitsOpen} onOpenChange={setHabitsOpen} />
    </>
  );
}

function Entries({ entries }: { entries: TimeEntry[] }) {
  const index = useProjectIndex();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | undefined>();
  const sorted = [...entries].sort((a, b) => a.startedAt - b.startedAt);
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs tracking-wide text-foreground/45 hover:text-foreground"
      >
        <ChevronRightIcon
          className={cn('size-3 transition-transform', open && 'rotate-90')}
        />
        Entries ({entries.length})
      </button>
      {open && (
        <ul className="mt-3 grid">
          {sorted.map((entry) => {
            const project =
              entry.projectId === null
                ? undefined
                : index.byId.get(entry.projectId);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setEditing(entry)}
                  className="-mx-3 grid w-[calc(100%+24px)] grid-cols-[88px_1fr_auto] items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/[.05]"
                >
                  <span className="text-foreground/45">
                    {formatWeekday(dateKeyOf(entry.startedAt))}{' '}
                    {formatClockTime(entry.startedAt)}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <ProjectDot color={project?.color} />
                    <span className="truncate">
                      {entry.description || project?.name || 'No description'}
                    </span>
                  </span>
                  <span className="text-foreground/60 tabular-nums">
                    {formatDuration(entry.endedAt - entry.startedAt)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <EntryDialog
        open={editing !== undefined}
        onOpenChange={(next) => !next && setEditing(undefined)}
        entry={editing}
      />
    </section>
  );
}
