import { CheckIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type Step = { id: string; label: string };

export function StepIndicator({
  steps,
  current,
  reached,
  onSelect,
}: {
  steps: Step[];
  current: number;
  reached: number;
  onSelect: (index: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label="Steps">
      {steps.map((step, i) => {
        const done = i < reached && i !== current;
        return (
          <li key={step.id} className="flex items-center gap-1">
            {i > 0 && <span className="h-px w-4 bg-border" aria-hidden />}
            <button
              type="button"
              disabled={i > reached}
              aria-current={i === current ? 'step' : undefined}
              onClick={() => onSelect(i)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
                i === current &&
                  'bg-primary text-primary-foreground hover:bg-primary',
              )}
            >
              {done ? <CheckIcon className="size-3" /> : <span>{i + 1}</span>}
              {step.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
