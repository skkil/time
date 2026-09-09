import { ChevronDownIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { WeekSummary } from '@/bindings';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useWeeks } from '@/features/review/api';
import { FELT_LABELS } from '@/lib/felt';
import {
  type DateKey,
  formatHours,
  formatWeekRange,
  isoWeekNumber,
  reviewWeekOf,
  shiftKey,
  todayKey,
  weekOfMonday,
  weekStartOf,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { isQuiet } from './period';

type Item =
  | { kind: 'week'; summary: WeekSummary }
  | { kind: 'quiet'; count: number; key: DateKey };

export function WeekPicker({
  week,
  onPick,
}: {
  week: DateKey;
  onPick: (week: DateKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const thisMonday = reviewWeekOf(weekStartOf(todayKey()));
  const { data: summaries } = useWeeks(
    shiftKey(thisMonday, -7 * 104),
    shiftKey(thisMonday, 14),
  );

  const items = useMemo(() => {
    const all = summaries ?? [];
    const oldest = all.findLastIndex(
      (summary) => summary.startDate >= thisMonday || !isQuiet(summary),
    );
    const result: Item[] = [];
    for (const summary of all.slice(0, oldest + 1)) {
      const keep =
        summary.startDate >= thisMonday ||
        summary.startDate === week ||
        !isQuiet(summary);
      const last = result.at(-1);
      if (keep) result.push({ kind: 'week', summary });
      else if (last?.kind === 'quiet') last.count += 1;
      else result.push({ kind: 'quiet', count: 1, key: summary.startDate });
    }
    return result;
  }, [summaries, thisMonday, week]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          Week {isoWeekNumber(week)}
          <ChevronDownIcon
            className="mt-1 size-5 text-foreground/40"
            strokeWidth={1.5}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70vh] w-[420px] overflow-y-auto rounded-2xl p-2"
      >
        <ul>
          {items.map((item) =>
            item.kind === 'quiet' ? (
              <li
                key={item.key}
                className="px-3 py-1.5 text-xs text-foreground/30"
              >
                {item.count === 1
                  ? '1 quiet week'
                  : `${item.count} quiet weeks`}
              </li>
            ) : (
              <li key={item.summary.startDate}>
                <WeekRow
                  summary={item.summary}
                  selected={item.summary.startDate === week}
                  thisMonday={thisMonday}
                  onPick={() => {
                    onPick(item.summary.startDate);
                    setOpen(false);
                  }}
                />
              </li>
            ),
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function WeekRow({
  summary,
  selected,
  thisMonday,
  onPick,
}: {
  summary: WeekSummary;
  selected: boolean;
  thisMonday: DateKey;
  onPick: () => void;
}) {
  const start = summary.startDate;
  const past = start < thisMonday;
  return (
    <button
      type="button"
      aria-current={selected ? 'date' : undefined}
      onClick={onPick}
      className={cn(
        'grid w-full grid-cols-[72px_1fr_auto] items-baseline gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/[.06]',
        selected && 'bg-white/[.09]',
      )}
    >
      <span className="text-[15px]">Week {isoWeekNumber(start)}</span>
      <span className="truncate text-xs text-foreground/50">
        {[
          start === thisMonday
            ? 'This week'
            : start === shiftKey(thisMonday, 7)
              ? 'Next week'
              : formatWeekRange(weekOfMonday(start)),
          summary.felt && FELT_LABELS[summary.felt - 1],
          summary.outcomesTotal > 0 &&
            `${summary.outcomesAchieved} of ${summary.outcomesTotal} outcomes`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
      <span className="text-xs text-foreground/50 tabular-nums">
        {past && summary.reviewedAt === null && (
          <span className="mr-2 text-foreground/35">not reviewed</span>
        )}
        {summary.trackedSeconds > 0 &&
          `${formatHours(summary.trackedSeconds)} h`}
      </span>
    </button>
  );
}
