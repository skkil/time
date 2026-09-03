import { CheckIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import { priorityColor } from './meta';

export function PriorityCheck({
  priority,
  checked,
  label,
  onToggle,
  className,
}: {
  priority: number;
  checked: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}) {
  const color = priorityColor(priority) ?? 'var(--muted-foreground)';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      style={{
        borderColor: color,
        background: checked
          ? color
          : `color-mix(in oklab, ${color} ${priority < 4 ? 12 : 0}%, transparent)`,
      }}
      className={cn(
        'group/check grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-ring',
        priority < 4 && 'border-2',
        className,
      )}
    >
      <CheckIcon
        strokeWidth={3}
        className={cn(
          'size-2.5 transition-opacity',
          checked
            ? 'text-background opacity-100'
            : 'opacity-0 group-hover/check:opacity-100',
        )}
        style={checked ? undefined : { color }}
      />
    </button>
  );
}
