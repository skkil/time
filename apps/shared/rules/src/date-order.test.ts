import { setDateOrder } from '#date-order';
import { formatDate } from '#due';
import { formatDayLabel, formatWeekRange } from '#time';
import { afterEach, describe, expect, it } from 'vitest';

const today = '2026-11-13';

describe('date order', () => {
  afterEach(() => setDateOrder('dayFirst'));

  it('puts the day first by default', () => {
    expect(formatDate('2026-11-24', today)).toBe('24 Nov');
    expect(formatDate('2027-01-05', today)).toBe('5 Jan 2027');
    expect(formatDayLabel('2026-11-24', today)).toBe('Tue 24 Nov');
    expect(formatWeekRange('2026-11-09')).toBe('9 – 15 November 2026');
    expect(formatWeekRange('2026-11-30')).toBe('30 Nov – 6 Dec 2026');
  });

  it('puts the month first when chosen', () => {
    setDateOrder('monthFirst');
    expect(formatDate('2026-11-24', today)).toBe('Nov 24');
    expect(formatDate('2027-01-05', today)).toBe('Jan 5, 2027');
    expect(formatDayLabel('2026-11-24', today)).toBe('Tue, Nov 24');
    expect(formatWeekRange('2026-11-09')).toBe('November 9 – 15, 2026');
    expect(formatWeekRange('2026-11-30')).toBe('Nov 30 – Dec 6, 2026');
  });

  it('falls back to day first for an unknown order', () => {
    setDateOrder('nonsense' as never);
    expect(formatDate('2026-11-24', today)).toBe('24 Nov');
  });
});
