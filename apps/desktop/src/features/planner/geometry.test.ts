import { describe, expect, it } from 'vitest';

import { fitHourHeight, rangeBetween, slotAtOffset } from './geometry';

const PER_MINUTE = 0.8;

describe('range selection', () => {
  it('snaps an offset down to the slot it falls in', () => {
    expect(slotAtOffset(7.5 * 60 * PER_MINUTE + 5, PER_MINUTE)).toBe(450);
    expect(slotAtOffset(-20, PER_MINUTE)).toBe(0);
    expect(slotAtOffset(25 * 60 * PER_MINUTE, PER_MINUTE)).toBe(24 * 60 - 15);
  });

  it('covers both end slots, whichever way the drag went', () => {
    expect(rangeBetween(450, 570)).toEqual({ start: 450, end: 585 });
    expect(rangeBetween(570, 450)).toEqual({ start: 450, end: 585 });
    expect(rangeBetween(450, 450)).toEqual({ start: 450, end: 465 });
  });
});

describe('fitting the day to the window', () => {
  it('shows 07:00 to 23:00 when there is room, within bounds', () => {
    expect(fitHourHeight(640)).toBe(40);
    expect(fitHourHeight(200)).toBe(28);
    expect(fitHourHeight(2000)).toBe(64);
  });
});
