import { CheckIcon, CircleIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import type { Outcome, Quarter } from '@/bindings';
import { useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { cn } from '@/lib/utils';

import { outcomeEvidence } from './format';

export function OutcomeCard({
  outcome,
  quarter,
  showTasks = false,
  actions,
}: {
  outcome: Outcome;
  quarter?: Quarter | null;
  showTasks?: boolean;
  actions?: ReactNode;
}) {
  const priority = quarter?.priorities.find(
    (item) => item.id === outcome.priorityId,
  );
  const muted = outcome.status === 'dropped';
  return (
    <li className="grid gap-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-medium',
              muted && 'text-muted-foreground line-through',
            )}
          >
            {outcome.title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {outcomeEvidence(outcome)}
            {priority && ` · Serves ${priority.title}`}
            {outcome.carriedFrom !== null && ' · Carried over'}
          </p>
        </div>
        {actions}
      </div>
      {showTasks && <LinkedTasks outcome={outcome} />}
    </li>
  );
}

function LinkedTasks({ outcome }: { outcome: Outcome }) {
  const { data: tasks = [] } = useTasks();
  const { openTask } = useTaskDialog();
  const linked = tasks.filter((task) => task.outcomeId === outcome.id);
  if (linked.length === 0) return null;
  return (
    <ul className="grid gap-0.5 border-l pl-3">
      {linked.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            onClick={() => openTask(task.id)}
            className="flex items-center gap-2 rounded-sm text-left text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {task.completedAt !== null ? (
              <CheckIcon className="size-3.5 text-now" />
            ) : (
              <CircleIcon className="size-3.5 text-muted-foreground" />
            )}
            <span
              className={cn(
                task.completedAt === null && 'text-muted-foreground',
              )}
            >
              {task.title}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
