import type { CalendarEvent } from '@/backend';
import { Popover, PopoverTrigger } from '@/components/ui/popover';

import { CalendarEventDetails, GoogleMark } from './CalendarEventDetails';

/** An all-day event from a connected calendar, above a day's hours. */
export function CalendarDayChip({ event }: { event: CalendarEvent }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-calendar-event=""
          aria-label={`${event.title}, all day, from ${event.sourceName}`}
          className="flex min-w-0 items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-left text-[11px] leading-4 text-white outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{
            background: `color-mix(in oklab, ${event.color} 55%, #0b1220)`,
          }}
        >
          <span className="min-w-0 flex-1 truncate">{event.title}</span>
          <GoogleMark />
        </button>
      </PopoverTrigger>
      <CalendarEventDetails event={event} side="bottom" />
    </Popover>
  );
}
