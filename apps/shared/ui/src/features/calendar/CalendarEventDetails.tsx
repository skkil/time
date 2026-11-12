import { ExternalLinkIcon, MapPinIcon } from 'lucide-react';

import type { CalendarEvent } from '@/backend';
import { Button } from '@/components/ui/button';
import {
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from '@/components/ui/popover';
import {
  formatClockTime,
  formatDay,
  fromDateKey,
  fromSeconds,
  shiftKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';
import { platform } from '@/platform';

function when(event: CalendarEvent): string {
  if (event.allDay && event.startDate && event.endDate) {
    const last = shiftKey(event.endDate, -1);
    const first = formatDay(fromDateKey(event.startDate), 'weekdayDayMonth');
    return last === event.startDate
      ? `${first} · All day`
      : `${first} – ${formatDay(fromDateKey(last), 'weekdayDayMonth')} · All day`;
  }
  return `${formatDay(fromSeconds(event.startAt), 'weekdayDayMonth')} · ${formatClockTime(event.startAt)}–${formatClockTime(event.endAt)}`;
}

export function GoogleMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-3.5 shrink-0 place-items-center rounded-[4px] bg-white/85 text-[9px] leading-none font-semibold text-[#0b1220]',
        className,
      )}
    >
      G
    </span>
  );
}

/** The read-only card for an event from a connected calendar. */
export function CalendarEventDetails({
  event,
  side = 'right',
}: {
  event: CalendarEvent;
  side?: 'right' | 'bottom' | 'left' | 'top';
}) {
  return (
    <PopoverContent side={side} align="start" className="w-72 gap-3 p-3">
      <PopoverHeader>
        <PopoverTitle className="text-[15px] leading-snug">
          {event.title}
        </PopoverTitle>
        <PopoverDescription>
          {when(event)}
          {event.tentative && ' · Maybe'}
        </PopoverDescription>
      </PopoverHeader>
      {event.location && (
        <p className="flex items-start gap-2 text-sm text-foreground/85">
          <MapPinIcon className="mt-0.5 size-3.5 shrink-0 opacity-70" />
          <span className="min-w-0 break-words">{event.location}</span>
        </p>
      )}
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: event.color }}
        />
        <span className="truncate">{event.sourceName}</span>
        <span aria-hidden>·</span>
        <span>Google Calendar</span>
      </p>
      {event.link && (
        <Button
          size="sm"
          variant="outline"
          className="justify-self-start"
          onClick={() => platform().openUrl(event.link!)}
        >
          <ExternalLinkIcon />
          Open in Google Calendar
        </Button>
      )}
    </PopoverContent>
  );
}
