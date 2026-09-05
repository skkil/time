import { describe, expect, it } from 'vitest';

import {
  FRAME_INTERVAL_MS,
  SAMPLE_FRAMES,
  SLOW_FRAME_MS,
  WARMUP_FRAMES,
  frameDue,
  judgeFrames,
  median,
} from './loop';

const frames = (count: number, ms: number) =>
  Array.from({ length: count }, () => ms);

describe('frame cap', () => {
  it('skips ticks until a 30 fps frame is due', () => {
    expect(frameDue(1016.7, 1000)).toBe(false);
    expect(frameDue(1000 + FRAME_INTERVAL_MS, 1000)).toBe(true);
    expect(frameDue(1032, 1000)).toBe(true);
    expect(frameDue(0, -Infinity)).toBe(true);
  });
});

describe('median', () => {
  it('handles odd, even and empty inputs', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('slow GPU guard', () => {
  it('waits for enough frames after the warm-up', () => {
    expect(judgeFrames(frames(WARMUP_FRAMES + SAMPLE_FRAMES - 1, 200))).toBe(
      'pending',
    );
  });

  it('keeps the shader when frames arrive on time', () => {
    expect(judgeFrames(frames(WARMUP_FRAMES + SAMPLE_FRAMES, 33.4))).toBe(
      'smooth',
    );
  });

  it('falls back when the median frame is too slow', () => {
    expect(
      judgeFrames(frames(WARMUP_FRAMES + SAMPLE_FRAMES, SLOW_FRAME_MS + 10)),
    ).toBe('slow');
  });

  it('ignores warm-up stalls and the odd hitch', () => {
    const intervals = [
      ...frames(WARMUP_FRAMES, 500),
      ...frames(SAMPLE_FRAMES - 10, 34),
      ...frames(10, 120),
    ];
    expect(judgeFrames(intervals)).toBe('smooth');
  });
});
