import { useNavigate } from '@tanstack/react-router';
import { type ReactNode, useMemo, useState } from 'react';

import type { Id } from '@/bindings';
import { HabitsSheet } from '@/features/habits/HabitsSheet';
import { dayLookup, useHabitDays, useHabits } from '@/features/habits/api';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { useProjectIndex } from '@/features/projects/api';
import { rootOf } from '@/features/projects/tree';
import { useDays, useWeek, useWeeks } from '@/features/review/api';
import { useRitualRunner } from '@/features/rituals/runner-context';
import { useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { useTimeEntries } from '@/features/time/api';
import { useTypeTime } from '@/features/workflow/api';
import { FELT_LABELS } from '@/lib/felt';
import {
  type DateKey,
  dateKeyOf,
  formatHours,
  formatWeekday,
  isoWeekNumber,
  mondayOf,
  shiftKey,
  todayKey,
  weekKeys,
} from '@/lib/time';

import { ReviewDialog } from './ReviewDialog';
import { pickInsight } from './insight';
import { isHeldBack } from './period';

export function WeekReflection({ week }: { week: DateKey }) {
  const today = todayKey();
  const thisMonday = mondayOf(today);
  const navigate = useNavigate();
  const runner = useRitualRunner();
  const { data, isPending } = useWeek(week);
  const [editing, setEditing] = useState(false);
  const reviewed = data?.reviewedAt != null;
  const review = () =>
    week === shiftKey(thisMonday, -7)
      ? runner.open('weekly')
      : navigate({ to: '/review/$week', params: { week } });

  return (
    <aside
      aria-label={`Week ${isoWeekNumber(week)} in review`}
      className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-[rgba(6,18,26,.35)] backdrop-blur-xl"
    >
      <div className="grid min-h-0 flex-1 content-start gap-7 overflow-y-auto p-6">
        {isPending ? null : reviewed ? (
          <p className="flex items-baseline justify-between text-sm text-foreground/55">
            <span>
              {data?.felt
                ? `Felt ${FELT_LABELS[data.felt - 1].toLowerCase()}`
                : 'Reviewed'}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-foreground/80 hover:text-foreground hover:underline"
            >
              Edit review
            </button>
          </p>
        ) : (
          <button
            type="button"
            onClick={review}
            className="w-full rounded-full bg-white/90 px-5 py-2.5 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
          >
            Review week {isoWeekNumber(week)} · about 10 min
          </button>
        )}
        {!isPending && !isHeldBack(week, reviewed, today) && (
          <Reflection week={week} />
        )}
      </div>
      <ReviewDialog week={week} open={editing} onOpenChange={setEditing} />
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-xs tracking-wide text-foreground/45">{title}</h3>
      {children}
    </section>
  );
}

function Reflection({ week }: { week: DateKey }) {
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
  const lookup = useMemo(() => dayLookup(habitDays), [habitDays]);

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
    return {
      all: sorted,
      top: sorted.slice(0, 4),
      rest: sorted.slice(4).reduce((sum, item) => sum + item.seconds, 0),
    };
  }, [entries, index]);

  const habitTotals = habits.map((habit) => {
    const results = weekKeys(week).map((day) => lookup(habit.id, day));
    return {
      name: habit.name,
      kind: habit.kind,
      due: results.filter(
        (day) => day && ['done', 'failed', 'missed'].includes(day.status),
      ).length,
      done: results.filter((day) => day?.status === 'done').length,
    };
  });

  const finished = tasks.filter(
    (task) =>
      task.completedAt !== null &&
      dateKeyOf(task.completedAt) >= week &&
      dateKeyOf(task.completedAt) < end,
  );

  const insight = summary
    ? pickInsight({
        trackedSeconds: summary.trackedSeconds,
        plannedSeconds: summary.plannedSeconds,
        outcomes: data?.outcomes ?? [],
        projects: projects.all,
        habits: habitTotals,
      })
    : null;
  const notes = data?.notes;
  const noted = [
    ['What worked', notes?.worked],
    ['What fell short', notes?.fellShort],
    ['One change', notes?.change],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const felt = days.filter((day) => day.felt || day.note);

  return (
    <>
      {insight && (
        <p className="text-[17px] leading-relaxed font-light text-foreground/85">
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
                className="text-sm text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
              >
                {insight.action.label}
              </button>
            </>
          )}
        </p>
      )}

      {projects.top.length > 0 && (
        <Section title="Time">
          <ul className="grid gap-1.5 text-sm">
            {projects.top.map((item) => (
              <li key={item.id ?? 'none'} className="flex items-center gap-2">
                <ProjectDot color={item.color} />
                <span className="flex-1 truncate">{item.name}</span>
                <span className="text-foreground/60 tabular-nums">
                  {formatHours(item.seconds)} h
                </span>
              </li>
            ))}
            {projects.rest > 0 && (
              <li className="flex items-center gap-2 pl-4 text-foreground/55">
                <span className="flex-1">Other</span>
                <span className="tabular-nums">
                  {formatHours(projects.rest)} h
                </span>
              </li>
            )}
          </ul>
          {byType.length > 0 && (
            <p className="text-xs leading-relaxed text-foreground/50">
              {byType
                .map((item) => `${item.name} ${formatHours(item.seconds)} h`)
                .join(' · ')}
            </p>
          )}
        </Section>
      )}

      {finished.length > 0 && (
        <Section title={`Finished · ${finished.length}`}>
          <ul className="grid gap-1 text-sm">
            {finished.slice(0, 6).map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => openTask(task.id)}
                  className="w-full truncate text-left text-foreground/75 hover:text-foreground"
                >
                  {task.title}
                </button>
              </li>
            ))}
            {finished.length > 6 && (
              <li className="text-foreground/40">
                and {finished.length - 6} more
              </li>
            )}
          </ul>
        </Section>
      )}

      {noted.length > 0 && (
        <Section title="Notes">
          <dl className="grid gap-3 text-sm leading-relaxed">
            {noted.map(([label, text]) => (
              <div key={label}>
                <dt className="text-xs text-foreground/45">{label}</dt>
                <dd className="whitespace-pre-wrap text-foreground/85">
                  {text}
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {felt.length > 0 && (
        <Section title="Days">
          <ul className="grid gap-1 text-sm">
            {felt.map((day) => (
              <li key={day.date} className="grid grid-cols-[36px_1fr] gap-2">
                <span className="text-foreground/45">
                  {formatWeekday(day.date)}
                </span>
                <span className="text-foreground/80">
                  {[day.felt && FELT_LABELS[day.felt - 1], day.note]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <HabitsSheet open={habitsOpen} onOpenChange={setHabitsOpen} />
    </>
  );
}
