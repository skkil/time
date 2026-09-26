import { describe, expect, it } from 'vitest';

import { rangeBetween, slotAtOffset } from './geometry';
import { createTimeScale } from './time-scale';

const PER_MINUTE = 0.8;
const SCALE = createTimeScale(PER_MINUTE * 60);

describe('range selection', () => {
  it('snaps an offset down to the slot it falls in', () => {
    expect(slotAtOffset(7.5 * 60 * PER_MINUTE + 5, SCALE)).toBe(450);
    expect(slotAtOffset(-20, SCALE)).toBe(0);
    expect(slotAtOffset(25 * 60 * PER_MINUTE, SCALE)).toBe(24 * 60 - 15);
  });

  it('covers both end slots, whichever way the drag went', () => {
    expect(rangeBetween(450, 570)).toEqual({ start: 450, end: 585 });
    expect(rangeBetween(570, 450)).toEqual({ start: 450, end: 585 });
    expect(rangeBetween(450, 450)).toEqual({ start: 450, end: 465 });
  });
});
