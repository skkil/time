import { FELT_LABELS } from '@/lib/felt';
import { cn } from '@/lib/utils';

export function FeltScale({
  value,
  onChange,
  label,
  size = 'lg',
}: {
  value: number | null;
  onChange: (value: number) => void;
  label: string;
  size?: 'sm' | 'lg';
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid grid-cols-5', size === 'lg' ? 'gap-2' : 'gap-1')}
    >
      {FELT_LABELS.map((name, i) => {
        const felt = i + 1;
        const selected = value === felt;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(felt)}
            className={cn(
              'grid place-items-center rounded-md border bg-card transition-colors outline-none hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring',
              size === 'lg' ? 'gap-1 py-3' : 'h-8 px-2.5',
              selected &&
                'border-primary bg-primary text-primary-foreground hover:border-primary',
            )}
          >
            {size === 'lg' && (
              <span className="font-heading text-[23px] leading-none font-bold">
                {felt}
              </span>
            )}
            <span
              className={cn(
                'text-xs',
                !selected && size === 'lg' && 'text-muted-foreground',
              )}
            >
              {name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
