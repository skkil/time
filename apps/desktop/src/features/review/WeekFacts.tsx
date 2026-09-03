import { useMemo } from 'react';

import { SectionTitle } from '@/components/page';
import { dayLookup, useHabitDays, useHabits } from '@/features/habits/api';
import { useBlocks } from '@/features/planner/api';
import { ProjectTimeBreakdown } from '@/features/projects/ProjectTimeBreakdown';
import { useTimeEntries } from '@/features/time/api';
import { FELT_LABELS } from '@/lib/felt';
import {
  type DateKey,
  dateKeyOf,
  formatDayOfMonth,
  formatDuration,
  formatWeekday,
  shiftKey,
  todayKey,
  weekKeys,
} from '@/lib/time';

import { useDays } from './api';

export function WeekFacts({ week }: { week: DateKey }) {
  const end = shiftKey(week, 7);
  const { data: entries = [] } = useTimeEntries(week, end);
  const spans = useMemo(
    () =>
      entries.map((entry) => ({
        projectId: entry.projectId,
        seconds: entry.endedAt - entry.startedAt,
      })),
    [entries],
  );
  const total = spans.reduce((sum, span) => sum + span.seconds, 0);

  return (
    <div className="grid gap-8">
      <section aria-labelledby="days-title">
        <SectionTitle aside="Planned vs tracked">
          <span id="days-title">Day by day</span>
        </SectionTitle>
        <DaysTable week={week} />
      </section>
      <section aria-labelledby="time-title">
        <SectionTitle aside={<span>{formatDuration(total)}</span>}>
          <span id="time-title">Where the time went</span>
        </SectionTitle>
        <div className="rounded-md border bg-card p-4">
          <ProjectTimeBreakdown spans={spans} />
        </div>
      </section>
    </div>
  );
}

function DaysTable({ week }: { week: DateKey }) {
  const days = useMemo(() => weekKeys(week), [week]);
  const end = shiftKey(week, 7);
  const today = todayKey();
  const { data: blocks = [] } = useBlocks(week);
  const { data: entries = [] } = useTimeEntries(week, end);
  const { data: checkIns = [] } = useDays(week, end);
  const { data: habits = [] } = useHabits();
  const { data: habitDays } = useHabitDays(week, end);
  const lookup = useMemo(() => dayLookup(habitDays), [habitDays]);

  const sumOn = <T,>(
    items: T[],
    day: DateKey,
    at: (item: T) => number,
    length: (item: T) => number,
  ) =>
    items
      .filter((item) => dateKeyOf(at(item)) === day)
      .reduce((sum, item) => sum + length(item), 0);

  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">Day</th>
            <th className="px-2 py-2 text-right font-medium">Planned</th>
            <th className="px-2 py-2 text-right font-medium">Tracked</th>
            {habits.length > 0 && (
              <th className="px-2 py-2 text-center font-medium">Habits</th>
            )}
            <th className="px-4 py-2 font-medium">Felt</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const checkIn = checkIns.find((item) => item.date === day);
            const planned = sumOn(
              blocks,
              day,
              (b) => b.startAt,
              (b) => b.endAt - b.startAt,
            );
            const tracked = sumOn(
              entries,
              day,
              (e) => e.startedAt,
              (e) => e.endedAt - e.startedAt,
            );
            const scheduled = habits.filter((habit) =>
              ['done', 'failed', 'missed', 'pending'].includes(
                lookup(habit.id, day)?.status ?? 'off',
              ),
            );
            const met = scheduled.filter(
              (habit) => lookup(habit.id, day)?.status === 'done',
            ).length;
            return (
              <tr key={day} className="border-b last:border-b-0">
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="font-medium">{formatWeekday(day)}</span>{' '}
                  <span className="text-muted-foreground">
                    {formatDayOfMonth(day)}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right whitespace-nowrap text-muted-foreground">
                  {planned ? formatDuration(planned) : '–'}
                </td>
                <td className="px-2 py-2.5 text-right whitespace-nowrap">
                  {tracked ? formatDuration(tracked) : '–'}
                </td>
                {habits.length > 0 && (
                  <td className="px-2 py-2.5 text-center text-muted-foreground">
                    {day <= today && scheduled.length
                      ? `${met}/${scheduled.length}`
                      : '–'}
                  </td>
                )}
                <td className="w-full px-4 py-2.5">
                  {checkIn?.felt ? (
                    <span>
                      {FELT_LABELS[checkIn.felt - 1]}
                      {checkIn.note && (
                        <span className="text-muted-foreground">
                          {' · '}
                          {checkIn.note}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
