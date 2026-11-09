import { type DateKey, formatMinutesOfDay, fromDateKey, todayKey } from '#time';
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

export function formatDue(
  task: Pick<Task, 'dueDate' | 'dueTime'>,
  today = todayKey(),
): string {
  if (!task.dueDate) return '';
  const day = formatDate(task.dueDate, today);
  return task.dueTime === null
    ? day
    : `${day} ${formatMinutesOfDay(task.dueTime)}`;
}

export const isOpen = (task: Pick<Task, 'completedAt'>) =>
  task.completedAt === null;

export const isOverdue = (
  task: Pick<Task, 'dueDate' | 'completedAt' | 'statusCategory'>,
  today = todayKey(),
) =>
  task.dueDate !== null &&
  task.dueDate < today &&
  task.completedAt === null &&
  task.statusCategory !== 'backlog';
