import { MoonIcon } from 'lucide-react';

import { useRituals } from '@/features/rituals/api';
import { STEPS } from '@/features/rituals/meta';
import { useRitualRunner } from '@/features/rituals/runner-context';
import { formatClockTime } from '@/lib/time';
import { cn } from '@/lib/utils';

export function CheckOut({
  done,
  open,
  onToggle,
}: {
  done: boolean;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={open}
      onClick={() => onToggle(!open)}
      className={cn(
        'flex h-9 items-center gap-2 rounded-full px-4 text-sm ring-1 ring-white/20 transition-colors hover:bg-white/15 hover:text-foreground',
        open && 'bg-white/15',
        done && !open ? 'text-foreground/75' : 'text-foreground',
      )}
    >
      <MoonIcon className="size-3.5" strokeWidth={1.75} />
      {done ? 'Checked out' : 'Check out'}
    </button>
  );
}

export function CheckOutPrompt({
  checkedOutAt,
}: {
  checkedOutAt: number | null;
}) {
  const runner = useRitualRunner();
  const { data: rituals } = useRituals();
  const steps = (
    rituals?.find((ritual) => ritual.kind === 'evening')?.steps ?? []
  ).filter((step): step is keyof typeof STEPS => step in STEPS);

  return (
    <div className="flex h-full max-h-[720px] animate-in flex-col rounded-[32px] bg-[rgba(6,18,26,.38)] p-12 ring-1 ring-white/[.08] backdrop-blur-xl duration-200 fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
      <p className="text-sm text-foreground/75">End of day</p>
      <h2 className="mt-2 text-3xl font-light">
        {checkedOutAt
          ? `Checked out at ${formatClockTime(checkedOutAt)}`
          : 'Ready to check out?'}
      </h2>
      <p className="mt-3 max-w-md text-foreground/75">
        Close today in a few quiet steps, then leave it here.
      </p>
      {steps.length > 0 && (
        <ol className="mt-10 grid min-h-0 max-w-md flex-1 content-start gap-4 overflow-y-auto text-sm">
          {steps.map((step) => (
            <li key={step} className="grid gap-0.5">
              <span>{STEPS[step].label}</span>
              <span className="text-foreground/75">{STEPS[step].hint}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="shrink-0 pt-6">
        <button
          type="button"
          onClick={() => runner.open('evening')}
          className="flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
        >
          <MoonIcon className="size-3.5" strokeWidth={1.75} />
          {checkedOutAt ? 'Check out again' : 'Begin check out'}
        </button>
      </div>
    </div>
  );
}
