import { focusedSeconds, liveEntry } from '#timer';
import type { RunningTimer } from '@skkil-time/contract';
import { describe, expect, it } from 'vitest';

const timer = (patch: Partial<RunningTimer> = {}): RunningTimer => ({
  description: '',
  projectId: null,
  taskId: null,
  startedAt: 1_000,
  pausedAt: null,
  bankedSeconds: 0,
  ...patch,
});

describe('focusedSeconds', () => {
  it('adds the current stretch to time banked before a break', () => {
    expect(focusedSeconds(timer({ bankedSeconds: 600 }), 1_060)).toBe(660);
  });

  it('stands still on a break', () => {
    const paused = timer({ bankedSeconds: 600, pausedAt: 1_030 });
    expect(focusedSeconds(paused, 5_000)).toBe(600);
  });
});

describe('liveEntry', () => {
  it('shows nothing on the timeline during a break', () => {
    expect(liveEntry(timer({ pausedAt: 1_030 }), 2_000)).toBeNull();
    expect(liveEntry(timer(), 2_000)?.endedAt).toBe(2_000);
  });
});
