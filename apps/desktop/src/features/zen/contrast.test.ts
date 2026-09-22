import { describe, expect, it } from 'vitest';

import {
  MIN_CONTRAST,
  brightestPoint,
  inkContrast,
  readabilityShade,
} from './contrast';
import { skyAt } from './sky';

describe('readabilityShade', () => {
  it('keeps secondary text at 4.5:1 over the brightest sky at every hour', () => {
    for (let hour = 0; hour < 24; hour += 0.25) {
      const sky = skyAt(hour);
      const ratio = inkContrast(brightestPoint(sky), readabilityShade(sky));
      expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it('leaves the dark night sky alone', () => {
    expect(readabilityShade(skyAt(0))).toBe(0);
    expect(readabilityShade(skyAt(13))).toBeGreaterThan(0.3);
  });
});
