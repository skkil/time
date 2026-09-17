import { describe, expect, it } from 'vitest';

import type { TrackedEntry } from '@/bindings';
import { atMinutes } from '@/lib/time';

import { entriesByDay, sessionCount, totalSeconds } from './entries';

const entry = (id: number, startedAt: number, minutes: number) =>
  ({
    id,
    startedAt,
    endedAt: startedAt + minutes * 60,
  }) as TrackedEntry;

describe('entries', () => {
  const late = entry(1, atMinutes('2026-11-05', 600), 30);
  const early = entry(2, atMinutes('2026-11-05', 540), 15);
  const before = entry(3, atMinutes('2026-11-04', 23 * 60 + 30), 60);

  it('groups by the day an entry started, keeping order', () => {
    expect(entriesByDay([late, early, before])).toEqual([
      ['2026-11-05', [late, early]],
      ['2026-11-04', [before]],
    ]);
  });

  it('adds up time and counts sessions', () => {
    expect(totalSeconds([late, early])).toBe(45 * 60);
    expect(sessionCount(1)).toBe('1 session');
    expect(sessionCount(3)).toBe('3 sessions');
  });
});
