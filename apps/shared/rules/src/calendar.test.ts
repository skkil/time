import { busyOn, clashes, coversDay, eventSpanOn, freeStart } from '#calendar';
import { atMinutes } from '#time';
import type { CalendarEvent } from '@skkil-time/client/types';
import { describe, expect, it } from 'vitest';

const DAY = '2026-11-10';

const event = (
  start: number,
  end: number,
  patch: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  id: `e-${start}`,
  sourceId: 's',
  sourceName: 'Work',
  color: '#039be5',
  title: 'Meeting',
  startAt: atMinutes(DAY, start),
  endAt: atMinutes(DAY, end),
  allDay: false,
  startDate: null,
  endDate: null,
  location: null,
  link: null,
  tentative: false,
  ...patch,
});

describe('eventSpanOn', () => {
  it('clips an event to the day it touches', () => {
    expect(eventSpanOn(event(9 * 60, 10 * 60), DAY)).toEqual({
      start: 540,
      end: 600,
    });
    const overnight = event(23 * 60, 25 * 60);
    expect(eventSpanOn(overnight, DAY)).toEqual({ start: 1380, end: 1440 });
    expect(eventSpanOn(overnight, '2026-11-11')).toEqual({ start: 0, end: 60 });
    expect(eventSpanOn(overnight, '2026-11-12')).toBeNull();
  });

  it('leaves all-day events to the day header', () => {
    const offsite = event(0, 0, {
      allDay: true,
      startDate: DAY,
      endDate: '2026-11-12',
    });
    expect(eventSpanOn(offsite, DAY)).toBeNull();
    expect(coversDay(offsite, DAY)).toBe(true);
    expect(coversDay(offsite, '2026-11-11')).toBe(true);
    expect(coversDay(offsite, '2026-11-12')).toBe(false);
  });
});

describe('freeStart', () => {
  const busy = busyOn(
    [
      event(10 * 60, 11 * 60),
      event(9 * 60, 9 * 60 + 30),
      event(14 * 60, 15 * 60, { tentative: true }),
    ],
    DAY,
  );

  it('keeps a free slot and counts only firm events as busy', () => {
    expect(busy).toEqual([
      { start: 540, end: 570 },
      { start: 600, end: 660 },
    ]);
    expect(freeStart(14 * 60, 60, busy)).toBe(14 * 60);
    expect(clashes(9 * 60, 60, busy)).toBe(true);
  });

  it('moves past the events in the way', () => {
    expect(freeStart(9 * 60, 30, busy)).toBe(570);
    expect(freeStart(9 * 60, 60, busy)).toBe(660);
    expect(freeStart(10 * 60 + 30, 15, busy)).toBe(660);
  });

  it('falls back to before when nothing later fits', () => {
    const late = [{ start: 22 * 60, end: 24 * 60 }];
    expect(freeStart(22 * 60 + 30, 60, late)).toBe(21 * 60);
  });
});
