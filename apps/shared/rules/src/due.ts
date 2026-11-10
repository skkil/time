import {
  type DateKey,
  formatMinutesOfDay,
  fromDateKey,
  mondayOf,
  shiftKey,
  todayKey,
} from '#time';
import type { Task } from '@skkil-time/client/types';
import { differenceInCalendarDays, format } from 'date-fns';

export const PRIORITIES = [1, 2, 3, 4] as const;

export type DueTone = 'overdue' | 'today' | 'soon' | 'later';

export function dueTone(date: DateKey, today = todayKey()): DueTone {
  const diff = differenceInCalendarDays(fromDateKey(date), fromDateKey(today));
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return diff < 7 ? 'soon' : 'later';
}

export function formatDate(date: DateKey, today = todayKey()): string {
  const diff = differenceInCalendarDays(fromDateKey(date), fromDateKey(today));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return format(fromDateKey(date), 'EEEE');
  if (date.slice(0, 4) !== today.slice(0, 4))
    return format(fromDateKey(date), 'd MMM yyyy');
  return format(fromDateKey(date), 'd MMM');
}

export const STALE_DAYS = 14;
export const STALE_ROLLOVERS = 3;

type Dated = Pick<Task, 'dueDate' | 'dueUntil'>;

/** The last day a task is due on: the end of its window, else its date. */
export const dueEnd = (task: Dated): DateKey | null =>
  task.dueUntil ?? task.dueDate;

export const inWindow = (task: Dated, date: DateKey) =>
  task.dueDate !== null &&
  task.dueUntil !== null &&
  task.dueDate <= date &&
  date <= task.dueUntil;

export function taskTone(task: Dated, today = todayKey()): DueTone | null {
  if (task.dueDate === null) return null;
  if (task.dueUntil === null) return dueTone(task.dueDate, today);
  if (task.dueUntil < today) return 'overdue';
  return task.dueDate <= today ? 'today' : dueTone(task.dueDate, today);
}

export function formatWindow(
  start: DateKey,
  end: DateKey,
  today = todayKey(),
): string {
  if (shiftKey(start, 6) === end && mondayOf(start) === start) {
    const thisWeek = mondayOf(today);
    if (start === thisWeek) return 'This week';
    if (start === shiftKey(thisWeek, 7)) return 'Next week';
    if (start === shiftKey(thisWeek, -7)) return 'Last week';
    return `Week of ${formatDate(start, today)}`;
  }
  return `${formatDate(start, today)} – ${formatDate(end, today)}`;
}

export function formatDue(
  task: Pick<Task, 'dueDate' | 'dueUntil' | 'dueTime'>,
  today = todayKey(),
): string {
  if (!task.dueDate) return '';
  if (task.dueUntil) return formatWindow(task.dueDate, task.dueUntil, today);
  const day = formatDate(task.dueDate, today);
  return task.dueTime === null
    ? day
    : `${day} ${formatMinutesOfDay(task.dueTime)}`;
}

export const isOpen = (task: Pick<Task, 'completedAt'>) =>
  task.completedAt === null;

export const isOverdue = (
  task: Pick<Task, 'dueDate' | 'dueUntil' | 'completedAt' | 'statusCategory'>,
  today = todayKey(),
) => {
  const end = dueEnd(task);
  return (
    end !== null &&
    end < today &&
    task.completedAt === null &&
    task.statusCategory !== 'backlog'
  );
};

/** Moved again and again, or left behind for weeks: worth parking. */
export function isStale(
  task: Pick<
    Task,
    'dueDate' | 'dueUntil' | 'rolloverCount' | 'statusCategory' | 'completedAt'
  >,
  today = todayKey(),
) {
  if (task.completedAt !== null || task.statusCategory === 'backlog')
    return false;
  const end = dueEnd(task);
  return (
    task.rolloverCount >= STALE_ROLLOVERS ||
    (end !== null && end < shiftKey(today, -STALE_DAYS))
  );
}
