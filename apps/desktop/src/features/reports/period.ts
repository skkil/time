import type { WeekSummary } from '@/bindings';
import { type DateKey, fromDateKey, mondayOf, shiftKey } from '@/lib/time';

export const isQuiet = (summary: WeekSummary) =>
  summary.trackedSeconds === 0 &&
  summary.outcomesTotal === 0 &&
  summary.tasksCompleted === 0;

export function calendarQuarterStart(week: DateKey): DateKey {
  const date = fromDateKey(week);
  const first = new Date(
    date.getFullYear(),
    Math.floor(date.getMonth() / 3) * 3,
    1,
  );
  return mondayOf(
    `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`,
  );
}

export function isHeldBack(week: DateKey, reviewed: boolean, today: DateKey) {
  const thisMonday = mondayOf(today);
  return (
    !reviewed &&
    week === shiftKey(thisMonday, -7) &&
    today < shiftKey(thisMonday, 2)
  );
}
