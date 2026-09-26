import type { SleepWindow } from '@/lib/preferences';

import {
  DAY_MINUTES,
  FIT_FROM_HOUR,
  FIT_TO_HOUR,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  clamp,
} from './geometry';

export const COMPACT_HOUR_HEIGHT = 6;
const MIN_FITTED_HOUR_HEIGHT = 16;

export type ScaleSegment = {
  from: number;
  to: number;
  top: number;
  height: number;
  perMinute: number;
  compact: boolean;
};

export type TimeScale = {
  height: number;
  segments: ScaleSegment[];
  marks: number[];
  top: (minute: number) => number;
  extent: (start: number, end: number) => number;
  minuteAt: (offsetPx: number) => number;
};

export function sleepSpans(sleep: SleepWindow) {
  const spans =
    sleep.start < sleep.end
      ? [{ from: sleep.start, to: sleep.end }]
      : [
          { from: 0, to: sleep.end },
          { from: sleep.start, to: DAY_MINUTES },
        ];
  return spans.filter((span) => span.from < span.to);
}

const sleepHours = (sleep: SleepWindow) =>
  sleepSpans(sleep).reduce((sum, span) => sum + span.to - span.from, 0) / 60;

export function fitHourHeight(viewportPx: number, sleep: SleepWindow | null) {
  if (!sleep)
    return clamp(
      Math.floor(viewportPx / (FIT_TO_HOUR - FIT_FROM_HOUR)),
      MIN_HOUR_HEIGHT,
      MAX_HOUR_HEIGHT,
    );
  const compacted = sleepHours(sleep);
  return Math.max(
    Math.floor(
      (viewportPx - compacted * COMPACT_HOUR_HEIGHT) / (24 - compacted),
    ),
    MIN_FITTED_HOUR_HEIGHT,
  );
}

function bandsOf(sleep: SleepWindow | null) {
  const spans = sleep ? sleepSpans(sleep) : [];
  const bands: { from: number; to: number; compact: boolean }[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.from > cursor)
      bands.push({ from: cursor, to: span.from, compact: false });
    bands.push({ ...span, compact: true });
    cursor = span.to;
  }
  if (cursor < DAY_MINUTES)
    bands.push({ from: cursor, to: DAY_MINUTES, compact: false });
  return bands;
}

function marksOf(segments: ScaleSegment[]) {
  const marks = new Set<number>();
  for (const { from, to, compact } of segments) {
    marks.add(from).add(to);
    if (compact) continue;
    for (let hour = Math.ceil(from / 60) * 60; hour < to; hour += 60)
      marks.add(hour);
  }
  return [...marks]
    .filter((minute) => minute > 0 && minute < DAY_MINUTES)
    .sort((a, b) => a - b);
}

export function createTimeScale(
  hourHeight: number,
  sleep: SleepWindow | null = null,
): TimeScale {
  let height = 0;
  const segments = bandsOf(sleep).map((band) => {
    const perMinute = (band.compact ? COMPACT_HOUR_HEIGHT : hourHeight) / 60;
    const segment = {
      ...band,
      top: height,
      height: (band.to - band.from) * perMinute,
      perMinute,
    };
    height += segment.height;
    return segment;
  });
  const last = segments[segments.length - 1];

  const top = (minute: number) => {
    const segment = segments.find((candidate) => minute < candidate.to) ?? last;
    return segment.top + (minute - segment.from) * segment.perMinute;
  };

  return {
    height,
    segments,
    marks: marksOf(segments),
    top,
    extent: (start, end) => top(end) - top(start),
    minuteAt: (offsetPx) => {
      const segment =
        segments.find(
          (candidate) => offsetPx < candidate.top + candidate.height,
        ) ?? last;
      return segment.from + (offsetPx - segment.top) / segment.perMinute;
    },
  };
}
