import type { CalendarEvent } from '@/backend';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { useTimeScale } from '@/features/planner/scale';
import { formatClockTime } from '@/lib/time';
import { cn } from '@/lib/utils';

import { CalendarEventDetails, GoogleMark } from './CalendarEventDetails';

/** An event from a connected calendar on the Week grid: read-only, opens its details. */
export function CalendarEventCard({
  event,
  start,
  end,
  lane,
  lanes,
}: {
  event: CalendarEvent;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}) {
  const scale = useTimeScale();
  const tall = scale.extent(start, end);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-calendar-event=""
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`${event.title}, from ${event.sourceName}, ${formatClockTime(event.startAt)} to ${formatClockTime(event.endAt)}`}
          className={cn(
            'absolute z-10 overflow-hidden rounded-md px-2 text-left text-white shadow-[0_1px_0_rgba(255,255,255,.15)_inset] outline-none focus-visible:ring-2 focus-visible:ring-white/70',
            tall < 24
              ? 'py-0 text-[11px] leading-[15px]'
              : 'py-1 text-[12px] leading-tight',
            event.tentative && 'border border-dashed border-white/55',
            lanes > 1 &&
              'hover:left-[2px]! hover:z-30 hover:w-[calc(100%-4px)]! hover:shadow-[0_8px_24px_rgba(0,0,0,.35)] focus-visible:left-[2px]! focus-visible:z-30 focus-visible:w-[calc(100%-4px)]!',
          )}
          style={{
            top: scale.top(start),
            height: Math.max(tall - 2, 15),
            left: `calc(${(lane / lanes) * 100}% + 2px)`,
            width: `calc(${100 / lanes}% - 4px)`,
            background: `color-mix(in oklab, ${event.color} ${event.tentative ? 45 : 62}%, #0b1220)`,
          }}
        >
          <span className="flex items-start gap-1">
            <span className="min-w-0 flex-1 truncate font-medium">
              {event.title}
            </span>
            <GoogleMark className="mt-px" />
          </span>
          {tall >= 32 && (
            <span className="block truncate text-white/75">
              {formatClockTime(event.startAt)}–{formatClockTime(event.endAt)}
              {event.location && ` · ${event.location}`}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <CalendarEventDetails event={event} />
    </Popover>
  );
}
