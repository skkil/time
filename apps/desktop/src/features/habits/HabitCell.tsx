import { CheckIcon, MinusIcon, XIcon } from 'lucide-react';

import type { HabitDay, ManualStatus } from '@/bindings';
import { cn } from '@/lib/utils';

import { NEXT_STATUS, statusLabel } from './meta';

export function HabitCell({
  day,
  label,
  onChange,
  size = 'md',
}: {
  day: HabitDay | undefined;
  label: string;
  onChange: (next: ManualStatus | null) => void;
  size?: 'sm' | 'md';
}) {
  const status = day?.status ?? 'off';
  const disabled = !day || (status === 'off' && !day.manual);
  const current = day?.manual ? status : 'none';
  const next = current in NEXT_STATUS ? NEXT_STATUS[current] : 'done';

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}: ${statusLabel[status]}${day?.manual ? '' : day?.value ? ', automatic' : ''}`}
      title={
        disabled
          ? statusLabel[status]
          : `${statusLabel[status]}${day?.manual ? ' (set by you)' : ''}. Click to set: ${next ?? 'automatic'}`
      }
      onClick={() => onChange(next)}
      className={cn(
        'relative grid place-items-center rounded-md border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
        size === 'md' ? 'size-9' : 'size-7',
        status === 'done' && 'border-due-today bg-due-today text-background',
        status === 'failed' && 'border-p1 bg-p1 text-background',
        status === 'skipped' && 'border-dashed text-muted-foreground',
        status === 'missed' && 'border-dashed border-p1/50 text-p1/70',
        status === 'pending' && 'bg-card hover:border-foreground/30',
        status === 'off' && 'border-transparent bg-muted/40',
      )}
    >
      {status === 'done' && <CheckIcon className="size-4" strokeWidth={2.5} />}
      {status === 'failed' && <XIcon className="size-4" strokeWidth={2.5} />}
      {status === 'missed' && <XIcon className="size-3.5" />}
      {status === 'skipped' && <MinusIcon className="size-3.5" />}
      {day?.manual && status !== 'off' && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-foreground/60"
        />
      )}
    </button>
  );
}
