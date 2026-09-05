export const FRAME_INTERVAL_MS = 1000 / 30;
export const FRAME_SLACK_MS = 2;
export const WARMUP_FRAMES = 5;
export const SAMPLE_FRAMES = 60;
export const SLOW_FRAME_MS = 50;

export type FrameVerdict = 'pending' | 'smooth' | 'slow';

export function frameDue(
  now: number,
  last: number,
  interval = FRAME_INTERVAL_MS,
) {
  return now - last >= interval - FRAME_SLACK_MS;
}

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function judgeFrames(
  intervals: number[],
  samples = SAMPLE_FRAMES,
  threshold = SLOW_FRAME_MS,
): FrameVerdict {
  const measured = intervals.slice(WARMUP_FRAMES);
  if (measured.length < samples) return 'pending';
  return median(measured) > threshold ? 'slow' : 'smooth';
}
