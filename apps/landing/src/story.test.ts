import { describe, expect, it } from 'vitest';

import { blendHours, hourAt } from './story';

describe('blendHours', () => {
  it('goes forward through midnight when that is shorter', () => {
    expect(blendHours(22, 2, 0.5)).toBeCloseTo(0);
  });

  it('goes back when that is shorter', () => {
    expect(blendHours(9, 7, 0.5)).toBeCloseTo(8);
  });
});

describe('hourAt', () => {
  const anchors = [
    { at: 0, hour: 18 },
    { at: 100, hour: 6 },
    { at: 200, hour: 9 },
  ];

  it('holds the first and last hours past the ends', () => {
    expect(hourAt(anchors, -50)).toBe(18);
    expect(hourAt(anchors, 500)).toBe(9);
  });

  it('passes through the night between evening and dawn', () => {
    expect(hourAt(anchors, 50)).toBeCloseTo(0);
  });
});
