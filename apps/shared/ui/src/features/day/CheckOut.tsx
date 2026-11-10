import { format } from 'date-fns';
import { CalendarCheckIcon, MoonIcon } from 'lucide-react';

import { DAY_PANEL } from '@/components/surfaces';
import { useRituals, useWeekToClose } from '@/features/rituals/api';
import { STEPS } from '@/features/rituals/meta';
import { useRitualRunner } from '@/features/rituals/runner-context';
import { useShownSteps } from '@/features/rituals/shown-steps';
import { formatClockTime, fromDateKey, todayKey } from '@/lib/time';
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
        'flex h-9 items-center gap-2 rounded-full px-4 text-sm ring-1 ring-white/20 transition-colors hover:bg-white/15 hover:text-foreground pointer-coarse:h-10',
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
  const { data: week = null } = useWeekToClose('evening');
  const steps = useShownSteps(
    (rituals?.find((ritual) => ritual.kind === 'evening')?.steps ?? []).filter(
      (step): step is keyof typeof STEPS => step in STEPS,
    ),
    todayKey(),
  );

  return (
    <div className={DAY_PANEL}>
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
          {week && (
            <li className="grid gap-0.5">
              <span>Close the week</span>
              <span className="text-foreground/75">
                It’s {format(fromDateKey(todayKey()), 'EEEE')}: outcomes, a
                clear deck and next week’s plan
              </span>
            </li>
          )}
        </ol>
      )}
      <div className="flex shrink-0 flex-wrap gap-2 pt-6">
        {checkedOutAt && week && (
          <button
            type="button"
            onClick={() => runner.closeWeek('evening')}
            className="flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#08161e] transition-colors hover:bg-white"
          >
            <CalendarCheckIcon className="size-3.5" strokeWidth={1.75} />
            Close the week
          </button>
        )}
        <button
          type="button"
          onClick={() => runner.open('evening')}
          className={cn(
            'flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
            checkedOutAt && week
              ? 'text-foreground ring-1 ring-white/20 hover:bg-white/15'
              : 'bg-white/90 text-[#08161e] hover:bg-white',
          )}
        >
          <MoonIcon className="size-3.5" strokeWidth={1.75} />
          {checkedOutAt ? 'Check out again' : 'Check out'}
        </button>
      </div>
    </div>
  );
}
