import type { WeekSummary } from '@/bindings';
import { type DateKey, mondayOf, shiftKey } from '@/lib/time';

export const isQuiet = (summary: WeekSummary) =>
  summary.trackedSeconds === 0 &&
  summary.outcomesTotal === 0 &&
  summary.tasksCompleted === 0;

export const isDueInAnotherWeek = (
  due: DateKey,
  week: DateKey,
  today: DateKey,
) => due >= today && (due < week || due >= shiftKey(week, 7));

export function isHeldBack(week: DateKey, reviewed: boolean, today: DateKey) {
  const thisMonday = mondayOf(today);
  return (
    !reviewed &&
    week === shiftKey(thisMonday, -7) &&
    today < shiftKey(thisMonday, 2)
  );
}
