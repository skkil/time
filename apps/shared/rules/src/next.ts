import type { DateKey } from '#time';
import type { Task } from '@skkil-time/client/types';

const isActionable = (task: Task) =>
  task.completedAt === null &&
  task.kind === 'task' &&
  task.statusCategory !== 'backlog' &&
  task.waitingOn.length === 0;

const byDueThenPosition = (a: Task, b: Task) =>
  (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
  (a.dueTime ?? 0) - (b.dueTime ?? 0) ||
  a.position - b.position;

/**
 * Next is the single task to do now:
 * 1. work due today or earlier, highest priority first, then oldest date;
 * 2. otherwise the earliest dated task, ties by priority;
 * 3. otherwise the top-level task with the highest priority, then by order.
 */
export function nextUp(tasks: Task[], today: DateKey): Task | undefined {
  const actionable = tasks.filter(isActionable);
  const urgent = actionable
    .filter((task) => task.dueDate !== null && task.dueDate <= today)
    .sort((a, b) => a.priority - b.priority || byDueThenPosition(a, b));
  const later = actionable
    .filter((task) => task.dueDate !== null && task.dueDate > today)
    .sort(
      (a, b) =>
        (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
        a.priority - b.priority ||
        byDueThenPosition(a, b),
    );
  const undated = actionable
    .filter((task) => task.dueDate === null && task.parentId === null)
    .sort((a, b) => a.priority - b.priority || a.position - b.position);
  return urgent[0] ?? later[0] ?? undated[0];
}
