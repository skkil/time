import { ArrowUpRightIcon } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';

import type { Id } from '@/bindings';
import { cn } from '@/lib/utils';

import { useTaskDialog } from './task-dialog-context';

export function TaskLink({
  taskId,
  label,
  className,
  children,
}: {
  taskId: Id;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const { openTask } = useTaskDialog();
  const open = (event: MouseEvent) => {
    event.stopPropagation();
    openTask(taskId);
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={open}
      className={cn(
        'min-w-0 rounded-sm text-left underline-offset-2 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TaskJump({ taskId, name }: { taskId: Id; name: string }) {
  return (
    <TaskLink
      taskId={taskId}
      label={`Open ${name}`}
      className="shrink-0 text-foreground/75 hover:text-foreground"
    >
      <ArrowUpRightIcon className="size-4" />
    </TaskLink>
  );
}
