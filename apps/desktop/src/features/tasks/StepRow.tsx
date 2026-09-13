import { CheckIcon, PlusIcon } from 'lucide-react';

import type { Task } from '@/bindings';
import { cn } from '@/lib/utils';

import { useSetTaskCompleted } from './api';

export function StepRow({ step }: { step: Task }) {
  const complete = useSetTaskCompleted();
  const finished = step.completedAt !== null;
  return (
    <label className="group flex cursor-pointer items-center gap-3 py-1.5">
      <button
        type="button"
        aria-label={finished ? `Reopen ${step.title}` : `Finish ${step.title}`}
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
      <span
        className={cn(
          'text-[15px]',
          finished ? 'text-foreground/40 line-through' : 'text-foreground/85',
        )}
      >
        {step.title}
      </span>
    </label>
  );
}

export function AddStepForm({
  label,
  onAdd,
}: {
  label: string;
  onAdd: (title: string) => void;
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
      <PlusIcon className="size-[18px] text-foreground/35" strokeWidth={1.5} />
      <input
        name="title"
        aria-label={label}
        placeholder={label}
        className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-foreground/35"
      />
    </form>
  );
}
