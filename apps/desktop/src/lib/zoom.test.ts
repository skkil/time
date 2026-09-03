import { describe, expect, it } from 'vitest';

import { stepZoom } from './zoom';

describe('stepZoom', () => {
  it('moves to the neighbouring level', () => {
    expect(stepZoom(1, 1)).toBe(1.1);
    expect(stepZoom(1, -1)).toBe(0.9);
  });

  it('snaps an off-level value to the next level', () => {
    expect(stepZoom(1.05, 1)).toBe(1.1);
    expect(stepZoom(1.05, -1)).toBe(1);
  });

  it('stops at the ends', () => {
    expect(stepZoom(2, 1)).toBe(2);
    expect(stepZoom(0.5, -1)).toBe(0.5);
  });
});
