import { describe, expect, it } from 'vitest';

import { minutesAtOffset, slotAtOffset } from './geometry';
import {
  COMPACT_HOUR_HEIGHT,
  createTimeScale,
  fitHourHeight,
  sleepSpans,
} from './time-scale';

const OVERNIGHT = { start: 23 * 60, end: 7 * 60 };

describe('sleep spans', () => {
  it('splits a window that crosses midnight', () => {
    expect(sleepSpans(OVERNIGHT)).toEqual([
      { from: 0, to: 420 },
      { from: 1380, to: 1440 },
    ]);
  });

  it('keeps one span when the window stays within a day', () => {
    expect(sleepSpans({ start: 60, end: 480 })).toEqual([
      { from: 60, to: 480 },
    ]);
    expect(sleepSpans({ start: 1320, end: 0 })).toEqual([
      { from: 1320, to: 1440 },
    ]);
  });
});

describe('fitting the day to the window', () => {
  it('shows 07:00 to 23:00 within bounds when there is no sleep window', () => {
    expect(fitHourHeight(640, null)).toBe(40);
    expect(fitHourHeight(200, null)).toBe(28);
    expect(fitHourHeight(2000, null)).toBe(64);
  });

  it('fits all 24 hours around a sleep window', () => {
    const hourHeight = fitHourHeight(688, OVERNIGHT);
    expect(hourHeight).toBe(40);
    expect(createTimeScale(hourHeight, OVERNIGHT).height).toBe(688);
    expect(fitHourHeight(430, OVERNIGHT)).toBe(23);
    expect(fitHourHeight(100, OVERNIGHT)).toBe(16);
  });
});

describe('a time scale', () => {
  it('is even without a sleep window', () => {
    const scale = createTimeScale(60);
    expect(scale.height).toBe(1440);
    expect(scale.top(90)).toBe(90);
    expect(scale.minuteAt(90)).toBe(90);
    expect(scale.marks).toHaveLength(23);
  });

  it('shrinks sleep hours and keeps every minute in order', () => {
    const scale = createTimeScale(60, OVERNIGHT);
    expect(scale.top(420)).toBe(7 * COMPACT_HOUR_HEIGHT);
    expect(scale.top(480)).toBe(7 * COMPACT_HOUR_HEIGHT + 60);
    expect(scale.height).toBe(8 * COMPACT_HOUR_HEIGHT + 16 * 60);
    for (let minute = 15; minute <= 1440; minute += 15)
      expect(scale.top(minute)).toBeGreaterThan(scale.top(minute - 15));
  });

  it('reads back the minute at any offset', () => {
    const scale = createTimeScale(60, OVERNIGHT);
    for (const minute of [0, 200, 420, 600, 1380, 1400, 1440])
      expect(scale.minuteAt(scale.top(minute))).toBeCloseTo(minute);
  });

  it('measures a span across a boundary', () => {
    const scale = createTimeScale(60, OVERNIGHT);
    expect(scale.extent(390, 450)).toBe(COMPACT_HOUR_HEIGHT / 2 + 30);
  });

  it('labels waking hours and the edges of sleep', () => {
    const { marks } = createTimeScale(60, { start: 23 * 60 + 30, end: 7 * 60 });
    expect(marks[0]).toBe(420);
    expect(marks).toContain(1410);
    expect(marks).not.toContain(120);
  });

  it('snaps through compacted time', () => {
    const scale = createTimeScale(60, OVERNIGHT);
    expect(minutesAtOffset(scale.top(120), scale)).toBe(120);
    expect(slotAtOffset(scale.top(130), scale)).toBe(120);
    expect(minutesAtOffset(-10, scale)).toBe(0);
    expect(slotAtOffset(scale.height + 50, scale)).toBe(1425);
  });
});
