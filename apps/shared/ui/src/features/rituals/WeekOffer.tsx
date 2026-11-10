import { format } from 'date-fns';
import { ArrowRightIcon } from 'lucide-react';

import { type DateKey, fromDateKey, isoWeekNumber, todayKey } from '@/lib/time';

import type { WeekHost } from './meta';
import { StepHeading } from './steps';

export function WeekOffer({
  host,
  week,
  snoozed,
  busy,
  onStart,
  onLater,
}: {
  host: WeekHost;
  week: DateKey;
  snoozed: boolean;
  busy: boolean;
  onStart: () => void;
  onLater: () => void;
}) {
  const evening = host === 'evening';
  const later = evening
    ? snoozed
      ? 'Not tonight'
      : 'Later tonight'
    : 'Not now';

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <StepHeading
          title={
            evening
              ? `It’s ${format(fromDateKey(todayKey()), 'EEEE')}, so let’s close the week.`
              : 'Close last week?'
          }
        >
          {evening
            ? 'How it felt, what happened to its outcomes, a clear deck and a plan for next week.'
            : `Week ${isoWeekNumber(week)} wasn’t closed yet. Settle it before this one gets going.`}
        </StepHeading>
        <p className="text-center text-xs tracking-wide text-white/70">
          About 5 minutes
        </p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onLater}
          className="h-9 rounded-full px-4 text-sm text-white/80 ring-1 ring-white/25 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60 pointer-coarse:h-10"
        >
          {later}
        </button>
        <button
          type="button"
          autoFocus
          disabled={busy}
          onClick={onStart}
          className="flex h-9 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-medium text-[#0b1a22] transition-colors hover:bg-white disabled:opacity-60 pointer-coarse:h-10"
        >
          Start
          <ArrowRightIcon className="size-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
