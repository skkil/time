import type { Task } from '@/bindings';
import { cn } from '@/lib/utils';

import { formatDue, isOverdue } from './meta';

type Dated = Pick<
  Task,
  'dueDate' | 'dueTime' | 'completedAt' | 'statusCategory'
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
    <span className={cn(overdue && 'text-p1', className)}>
      {formatDue(task)}
      {overdue && <span className="sr-only"> (overdue)</span>}
    </span>
  );
}
