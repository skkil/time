import { LIVE_ENTRY_ID } from '@skkil-time/rules/timer';

import type { TimeEntry } from '@/backend';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  formatClockTime,
  formatDuration,
  formatMinutesOfDay,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { TRACKED_LOOK, cardColors } from './card-colors';
import { DAY_MINUTES } from './geometry';
import { useTimeScale } from './scale';

export function EntryCard({
  entry,
  label,
  tint,
  start,
  end,
  lane,
  lanes,
  onOpen,
}: {
  entry: TimeEntry;
  label: string;
  tint: string;
  start: number;
  end: number;
  lane: number;
  lanes: number;
  onOpen: () => void;
}) {
  const scale = useTimeScale();
  const height = scale.extent(start, end);
  const compact = height < 36;
  const live = entry.id === LIVE_ENTRY_ID;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={live}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onOpen}
          aria-label={`Focus: ${label}, ${formatClockTime(entry.startedAt)} to ${live ? 'now' : formatClockTime(entry.endedAt)}`}
          style={{
            top: scale.top(start),
            height: Math.max(height - 2, 14),
            left: `calc(${(lane / lanes) * 100}% + 2px)`,
            width: `calc(${100 / lanes}% - 4px)`,
            ...cardColors(tint),
          }}
          className={cn(
            'absolute z-10 flex overflow-hidden rounded-md border px-2 text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
            compact ? 'items-center gap-1.5 py-0' : 'flex-col py-1',
            TRACKED_LOOK,
          )}
        >
          <span
            className={cn(
              'text-[13px] leading-tight font-semibold',
              height >= 72 ? 'line-clamp-2' : 'truncate',
            )}
          >
            {label}
          </span>
          <span className="truncate text-[11px] leading-tight text-muted-foreground">
            {formatMinutesOfDay(start)}
            {!compact && `–${formatMinutesOfDay(end % DAY_MINUTES)}`}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">
        <p>Focus: {label}</p>
        <p className="text-xs opacity-80">
          {formatClockTime(entry.startedAt)}–
          {live ? 'now' : formatClockTime(entry.endedAt)} ·{' '}
          {formatDuration(entry.endedAt - entry.startedAt)}
        </p>
        {entry.source === 'block' && (
          <p className="text-xs opacity-80">
            Logged from your plan. Open it to change or remove it.
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
