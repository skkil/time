import type { Task } from '@/bindings';

export const byDayOrder = (a: Task, b: Task) =>
  (a.dueTime ?? 24 * 60) - (b.dueTime ?? 24 * 60) ||
  a.priority - b.priority ||
  a.position - b.position;
