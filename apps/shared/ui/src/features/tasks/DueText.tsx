import type { Task } from '@/backend';
import { cn } from '@/lib/utils';

import { formatDue, isOverdue } from './meta';

type Dated = Pick<
  Task,
  'dueDate' | 'dueUntil' | 'dueTime' | 'completedAt' | 'statusCategory'
>;

export function DueText({
  task,
  className,
}: {
  task: Dated;
  className?: string;
}) {
  if (!task.dueDate) return null;
  const overdue = isOverdue(task);
  return (
    <span className={cn(overdue && 'text-earlier', className)}>
      {formatDue(task)}
      {overdue && <span className="sr-only"> (from an earlier day)</span>}
    </span>
  );
}
