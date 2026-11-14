import { formatDate, formatWindow } from '#due';
import { type DateKey, shiftKey, todayKey } from '#time';
import type { MoveResult, MoveTarget, Task } from '@skkil-time/client/types';

export const dayTarget = (date: DateKey): MoveTarget => ({ kind: 'day', date });

export const weekTarget = (monday: DateKey): MoveTarget => ({
  kind: 'week',
  monday,
});

/** The task as time-core leaves it after `moveTasks`, for optimistic updates. */
export function movedTask(task: Task, target: MoveTarget): Task {
  const dueDate = target.kind === 'day' ? target.date : target.monday;
  const dueUntil = target.kind === 'week' ? shiftKey(target.monday, 6) : null;
  const end = dueUntil ?? dueDate;
  return {
    ...task,
    dueDate,
    dueUntil,
    dueTime: dueUntil === null ? task.dueTime : null,
    mustOn:
      task.mustOn !== null && task.mustOn >= dueDate && task.mustOn <= end
        ? task.mustOn
        : null,
  };
}

export function targetLabel(target: MoveTarget, today = todayKey()): string {
  if (target.kind === 'week')
    return formatWindow(target.monday, shiftKey(target.monday, 6), today);
  return formatDate(target.date, today);
}

export function describeMove(
  what: string,
  target: MoveTarget,
  result: MoveResult,
  today = todayKey(),
): string {
  const where = targetLabel(target, today).replace(
    /^(This|Next|Last) week$/,
    (week) => week.toLowerCase(),
  );
  const blocks =
    result.blocksMoved > 0
      ? ` · ${plural(result.blocksMoved, 'focus block')} moved`
      : '';
  return `Moved ${what} to ${where}${blocks}`;
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;
