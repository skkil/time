import type { Outcome } from '@/backend';
import {
  type DateKey,
  formatDuration,
  formatWeekRange,
  fromDateKey,
  mondayOf,
  todayKey,
} from '@/lib/time';

export const QUARTER_WEEKS = 13;

export function outcomeEvidence(outcome: Outcome) {
  const parts = [
    outcome.tasksTotal
      ? `${outcome.tasksDone}/${count(outcome.tasksTotal, 'task')} done`
      : 'No linked tasks',
  ];
  if (outcome.trackedSeconds)
    parts.push(formatDuration(outcome.trackedSeconds));
  return parts.join(' · ');
}

export function weekName(monday: DateKey) {
  const offset = Math.round(
    (fromDateKey(monday).getTime() -
      fromDateKey(mondayOf(todayKey())).getTime()) /
      (7 * 24 * 3600 * 1000),
  );
  if (offset === 0) return 'This week';
  if (offset === 1) return 'Next week';
  if (offset === -1) return 'Last week';
  return formatWeekRange(monday);
}

export function quarterLabel(start: DateKey) {
  const date = fromDateKey(start);
  return `${date.getFullYear()} Q${Math.floor(date.getMonth() / 3) + 1}`;
}

export const count = (n: number, noun: string) =>
  `${n} ${noun}${n === 1 ? '' : 's'}`;
