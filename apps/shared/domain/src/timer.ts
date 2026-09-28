import type { RunningTimer, TimeEntry } from '@skkil-time/contract';

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
    id: -1,
    description,
    projectId,
    taskId,
    startedAt,
    endedAt: Math.max(now, startedAt),
  };
}
