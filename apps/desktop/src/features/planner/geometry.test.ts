import { describe, expect, it } from 'vitest';

import { PX_PER_MINUTE, rangeBetween, slotAtOffset } from './geometry';

describe('range selection', () => {
  it('snaps an offset down to the slot it falls in', () => {
    expect(slotAtOffset(7.5 * 60 * PX_PER_MINUTE + 5)).toBe(450);
    expect(slotAtOffset(-20)).toBe(0);
    expect(slotAtOffset(25 * 60 * PX_PER_MINUTE)).toBe(24 * 60 - 15);
  });

  it('covers both end slots, whichever way the drag went', () => {
    expect(rangeBetween(450, 570)).toEqual({ start: 450, end: 585 });
    expect(rangeBetween(570, 450)).toEqual({ start: 450, end: 585 });
    expect(rangeBetween(450, 450)).toEqual({ start: 450, end: 465 });
  });
});
