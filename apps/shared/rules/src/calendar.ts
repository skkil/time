import { type DateKey, atMinutes, shiftKey } from '#time';
import type { CalendarEvent } from '@skkil-time/client/types';

/** A stretch of one day in minutes from midnight, `end` exclusive. */
export type Span = { start: number; end: number };

const DAY_MINUTES = 24 * 60;

/** The part of a timed event that falls on `day`, in minutes, or null. */
export function eventSpanOn(event: CalendarEvent, day: DateKey): Span | null {
  if (event.allDay) return null;
  const open = atMinutes(day, 0);
  const close = atMinutes(shiftKey(day, 1), 0);
  const start = Math.max(event.startAt, open);
  const end = Math.min(event.endAt, close);
  if (end <= start) return null;
  return { start: (start - open) / 60, end: (end - open) / 60 };
}

/** Whether an all-day event covers `day`. */
export const coversDay = (event: CalendarEvent, day: DateKey) =>
  event.allDay &&
  event.startDate !== null &&
  event.endDate !== null &&
  event.startDate <= day &&
  day < event.endDate;

/** The timed events of `day` as busy spans, sorted. */
export function busyOn(events: CalendarEvent[], day: DateKey): Span[] {
  return events
    .flatMap((event) => {
      const span = eventSpanOn(event, day);
      return span && !event.tentative ? [span] : [];
    })
    .sort((a, b) => a.start - b.start);
}

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/**
 * Where a new block of `minutes` asked for at `start` goes: there when it's
 * free, else the first free start after it on the same day, else the last
 * free one before it, else where it was asked for.
 */
export function freeStart(
  start: number,
  minutes: number,
  busy: Span[],
): number {
  const fits = (at: number) =>
    at >= 0 &&
    at + minutes <= DAY_MINUTES &&
    !busy.some((span) => overlaps(span, { start: at, end: at + minutes }));
  if (fits(start)) return start;
  const after = busy
    .map((span) => span.end)
    .filter((at) => at > start)
    .sort((a, b) => a - b)
    .find(fits);
  if (after !== undefined) return after;
  const before = busy
    .map((span) => span.start - minutes)
    .filter((at) => at < start)
    .sort((a, b) => b - a)
    .find(fits);
  return before ?? start;
}

/** Whether a block from `start` for `minutes` would sit on a busy span. */
export const clashes = (start: number, minutes: number, busy: Span[]) =>
  busy.some((span) => overlaps(span, { start, end: start + minutes }));
