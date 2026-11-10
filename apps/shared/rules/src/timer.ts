import type { RunningTimer, TimeEntry } from '@skkil-time/client/types';

/** The id of the entry that stands in for a running timer. */
export const LIVE_ENTRY_ID = 'live';

export function focusedSeconds(timer: RunningTimer, now: number) {
  const current =
    timer.pausedAt === null ? Math.max(0, now - timer.startedAt) : 0;
  return timer.bankedSeconds + current;
}

export function liveEntry(
  timer: RunningTimer | null | undefined,
  now: number,
): TimeEntry | null {
  if (!timer || timer.pausedAt !== null) return null;
  const { description, projectId, taskId, startedAt } = timer;
  return {
    id: LIVE_ENTRY_ID,
    description,
    projectId,
    taskId,
    startedAt,
    endedAt: Math.max(now, startedAt),
    source: 'timer',
  };
}
