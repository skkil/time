import { XIcon } from 'lucide-react';

import type { Task } from '@/backend';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { Phrase } from './Phrase';
import { TaskCommand } from './TaskPicker';
import { useTaskDependency, useTaskIndex } from './api';
import { useTaskDialog } from './task-dialog-context';

export function Dependencies({
  task,
  adding,
  onAddingChange,
}: {
  task: Task;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}) {
  const tasks = useTaskIndex();
  const dependency = useTaskDependency();
  const { openTask } = useTaskDialog();
  const blockers = task.blockedBy
    .map((id) => tasks.byId.get(id))
    .filter((blocker): blocker is Task => blocker !== undefined);
  const holding = (tasks.holding.get(task.id) ?? []).filter(
    (held) => held.completedAt === null,
  );
  const linked = new Set(task.blockedBy);

  if (blockers.length === 0 && holding.length === 0 && !adding) return null;

  return (
    <div className="mt-1.5 grid gap-1 text-[15px] text-foreground/75">
      {(blockers.length > 0 || adding) && (
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          Waiting on
          {blockers.map((blocker, i) => (
            <span key={blocker.id} className="group/link flex items-baseline">
              <Phrase
                set
                onClick={() => openTask(blocker.id)}
                className={cn(
                  blocker.completedAt !== null &&
                    'text-foreground/75 line-through',
                )}
              >
                {blocker.title}
              </Phrase>
              <button
                type="button"
                aria-label={`Stop waiting on ${blocker.title}`}
                onClick={() =>
                  dependency.remove.mutate({
                    id: task.id,
                    blockedById: blocker.id,
                  })
                }
                className="ml-0.5 grid size-4 place-items-center self-center rounded-sm text-foreground/75 opacity-0 transition-opacity group-hover/link:opacity-100 hover:text-foreground focus-visible:opacity-100"
              >
                <XIcon className="size-3" />
              </button>
              {i < blockers.length - 1 && ','}
            </span>
          ))}
          <Popover open={adding} onOpenChange={onAddingChange}>
            <PopoverTrigger asChild>
              <Phrase set={false}>
                {blockers.length > 0 ? 'and…' : 'which task?'}
              </Phrase>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <TaskCommand
                autoFocus
                placeholder="Find the task it waits on"
                exclude={(candidate) =>
                  candidate.id === task.id ||
                  linked.has(candidate.id) ||
                  candidate.recurrence !== null ||
                  candidate.kind === 'event'
                }
                onSelect={(blocker) =>
                  dependency.add.mutate(
                    { id: task.id, blockedById: blocker.id },
                    { onSuccess: () => onAddingChange(false) },
                  )
                }
              />
            </PopoverContent>
          </Popover>
        </p>
      )}
      {holding.length > 0 && (
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          Holding up
          {holding.map((held, i) => (
            <span key={held.id} className="flex items-baseline">
              <Phrase set onClick={() => openTask(held.id)}>
                {held.title}
              </Phrase>
              {i < holding.length - 1 && ','}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
