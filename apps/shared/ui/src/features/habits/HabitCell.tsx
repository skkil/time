import { CheckIcon, XIcon } from 'lucide-react';

import type { HabitDay, ManualStatus } from '@/backend';
import { cn } from '@/lib/utils';

import { NEXT_STATUS, statusLabel } from './meta';

export function HabitCell({
  day,
  label,
  onChange,
  readOnly = false,
  size = 'md',
}: {
  day: HabitDay | undefined;
  label: string;
  onChange: (next: ManualStatus | null) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md';
}) {
  const status = day?.status ?? 'off';
  const disabled = readOnly || !day || (status === 'off' && !day.manual);
  const current = day?.manual ? status : 'none';
  const next = current in NEXT_STATUS ? NEXT_STATUS[current] : 'done';
  const shown = status === 'skipped' ? 'Rest day' : statusLabel[status];

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${label}: ${shown}${day?.manual ? '' : day?.value ? ', automatic' : ''}`}
      title={
        disabled
          ? shown
          : `${shown}${day?.manual ? ' (set by you)' : ''}. Click to set: ${next === 'skipped' ? 'rest' : (next ?? 'automatic')}`
      }
      onClick={() => onChange(next)}
      className={cn(
        'relative grid place-items-center rounded-full transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-default',
        size === 'md' ? 'size-8' : 'size-6',
        status === 'done' && 'bg-white/80 text-[#0b1a22]',
        status === 'failed' && 'text-foreground/75 ring-1 ring-white/30',
        status === 'skipped' && 'text-foreground/75',
        status === 'missed' && 'ring-1 ring-white/15',
        status === 'pending' && 'ring-1 ring-white/35 hover:ring-white/70',
        status === 'off' && 'text-foreground/15',
      )}
    >
      {status === 'done' && (
        <CheckIcon className="size-3.5" strokeWidth={2.5} />
      )}
      {status === 'failed' && <XIcon className="size-3" strokeWidth={2} />}
      {status === 'skipped' && <span className="text-xs">–</span>}
      {status === 'off' && <span className="size-1 rounded-full bg-current" />}
    </button>
  );
}
