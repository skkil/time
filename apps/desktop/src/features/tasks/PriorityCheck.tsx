import { CheckIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

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
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={priority < 4 ? `Priority ${priority}` : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        'group/check relative grid size-[18px] shrink-0 place-items-center rounded-full border outline-offset-2 transition-colors duration-300 after:absolute after:-inset-1.5 focus-visible:outline-2 focus-visible:outline-ring',
        checked
          ? 'border-white/50 bg-white/50 text-[#0b1a22]'
          : 'border-white/40 hover:border-white/80',
        className,
      )}
    >
      <CheckIcon
        strokeWidth={2.5}
        className={cn(
          'size-3 transition-opacity',
          checked ? 'opacity-100' : 'opacity-0 group-hover/check:opacity-60',
        )}
      />
    </button>
  );
}
