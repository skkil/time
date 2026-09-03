export const HOUR_HEIGHT = 48;
export const PX_PER_MINUTE = HOUR_HEIGHT / 60;
export const SNAP_MINUTES = 15;
export const DAY_MINUTES = 24 * 60;
export const DEFAULT_BLOCK_MINUTES = 60;
export const MIN_BLOCK_MINUTES = 15;
export const INITIAL_SCROLL_HOUR = 7;

export const snap = (minutes: number) =>
  Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function minutesAtOffset(offsetPx: number): number {
  return clamp(snap(offsetPx / PX_PER_MINUTE), 0, DAY_MINUTES - SNAP_MINUTES);
}

export function placeSpan(startMinutes: number, length: number) {
  const duration = clamp(length, MIN_BLOCK_MINUTES, DAY_MINUTES);
  const start = clamp(startMinutes, 0, DAY_MINUTES - duration);
  return { start, end: start + duration };
}

export type Interval = { id: number; start: number; end: number };
export type Lane = { lane: number; lanes: number };

export function layoutLanes(intervals: Interval[]): Map<number, Lane> {
  const sorted = [...intervals].sort(
    (a, b) => a.start - b.start || b.end - a.end,
  );
  const result = new Map<number, Lane>();
  let cluster: { id: number; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const item of cluster)
      result.set(item.id, { lane: item.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };

  for (const interval of sorted) {
    if (interval.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= interval.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(interval.end);
    } else {
      laneEnds[lane] = interval.end;
    }
    cluster.push({ id: interval.id, lane });
    clusterEnd = Math.max(clusterEnd, interval.end);
  }
  flush();
  return result;
}

export function slotAtOffset(offsetPx: number): number {
  return clamp(
    Math.floor(offsetPx / PX_PER_MINUTE / SNAP_MINUTES) * SNAP_MINUTES,
    0,
    DAY_MINUTES - SNAP_MINUTES,
  );
}

export function rangeBetween(anchor: number, current: number) {
  return {
    start: Math.min(anchor, current),
    end: Math.max(anchor, current) + SNAP_MINUTES,
  };
}
