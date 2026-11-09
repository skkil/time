import { CheckIcon, ChevronRightIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import type { Task } from '@/backend';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

import {
  stepInput,
  useCreateTask,
  useDeleteTask,
  useSetTaskCompleted,
  useTaskIndex,
} from './api';
import { MAX_INDENTED_DEPTH } from './container';
import { useTaskDialog } from './task-dialog-context';

export function StepRow({ step, depth = 0 }: { step: Task; depth?: number }) {
  const complete = useSetTaskCompleted();
  const create = useCreateTask();
  const remove = useDeleteTask();
  const tasks = useTaskIndex();
  const { openTask } = useTaskDialog();
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const finished = step.completedAt !== null;
  const steps = tasks.children.get(step.id) ?? [];
  const done = steps.filter((child) => child.completedAt !== null).length;

  return (
    <div>
      <div className="group flex items-center gap-3 py-1.5">
        <button
          type="button"
          aria-label={
            finished ? `Reopen ${step.title}` : `Finish ${step.title}`
          }
          onClick={() => complete.mutate({ id: step.id, completed: !finished })}
          className={cn(
            'grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors',
            finished
              ? 'border-white/50 bg-white/50 text-[#0b1a22]'
              : 'border-white/40 group-hover:border-white/80',
          )}
        >
          {finished && <CheckIcon className="size-3" strokeWidth={2.5} />}
        </button>
        <button
          type="button"
          onClick={() => openTask(step.id)}
          className={cn(
            'min-w-0 text-left text-[15px] hover:underline',
            finished ? 'text-foreground/75 line-through' : 'text-foreground/85',
          )}
        >
          {step.title}
        </button>
        {steps.length > 0 && (
          <button
            type="button"
            aria-label={expanded ? 'Hide steps' : 'Show steps'}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            className="flex shrink-0 items-center gap-1 text-xs text-foreground/75 tabular-nums hover:text-foreground/80"
          >
            <ChevronRightIcon
              className={cn(
                'size-3.5 transition-transform',
                expanded && 'rotate-90',
              )}
            />
            {done} of {steps.length}
          </button>
        )}
        <button
          type="button"
          aria-label={`Add a sub-task to ${step.title}`}
          title="Add a sub-task"
          onClick={() => {
            setExpanded(true);
            setAdding(true);
          }}
          className="ml-auto shrink-0 rounded-sm text-foreground/75 transition-colors group-hover:text-foreground/75 hover:text-foreground"
        >
          <PlusIcon className="size-4" />
        </button>
        <button
          type="button"
          aria-label={`Remove ${step.title}`}
          title="Remove"
          onClick={() =>
            steps.length > 0 ? setConfirming(true) : remove.mutate(step.id)
          }
          className="shrink-0 rounded-sm text-foreground/75 transition-colors group-hover:text-foreground/75 hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      {expanded && (steps.length > 0 || adding) && (
        <div className={cn(depth < MAX_INDENTED_DEPTH && 'ml-7')}>
          {steps.map((child) => (
            <StepRow key={child.id} step={child} depth={depth + 1} />
          ))}
          {adding && (
            <AddStepForm
              label="Add a sub-task"
              autoFocus
              onAdd={(title) => create.mutate(stepInput(step, title))}
              onLeave={() => setAdding(false)}
            />
          )}
        </div>
      )}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove “{step.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything inside it goes too. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate(step.id)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function AddStepForm({
  label,
  autoFocus,
  onAdd,
  onLeave,
}: {
  label: string;
  autoFocus?: boolean;
  onAdd: (title: string) => void;
  onLeave?: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const field = event.currentTarget.elements.namedItem(
          'title',
        ) as HTMLInputElement;
        if (!field.value.trim()) return;
        onAdd(field.value.trim());
        field.value = '';
      }}
      className="flex items-center gap-3 py-1.5"
    >
      <PlusIcon className="size-[18px] text-foreground/75" strokeWidth={1.5} />
      <input
        name="title"
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={label}
        onBlur={(event) => !event.target.value.trim() && onLeave?.()}
        className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-foreground/35"
      />
    </form>
  );
}
