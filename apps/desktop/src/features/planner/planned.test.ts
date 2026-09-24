import { describe, expect, it } from 'vitest';

import type { Task, TimeBlock } from '@/bindings';

import { plannedSeconds } from './planned';

const task = (patch: Partial<Task>) =>
  ({
    id: 1,
    kind: 'task',
    dueDate: '2026-11-10',
    dueTime: 600,
    estimateMinutes: 30,
    ...patch,
  }) as Task;

const block = { taskId: 9, startAt: 0, endAt: 3600 } as TimeBlock;

describe('plannedSeconds', () => {
  it('counts blocks and tasks given a time', () => {
    expect(
      plannedSeconds([block], [task({})], '2026-11-09', '2026-11-16'),
    ).toBe(3600 + 1800);
  });

  it('does not count a timed task twice when it also has a block', () => {
    expect(
      plannedSeconds([block], [task({ id: 9 })], '2026-11-09', '2026-11-16'),
    ).toBe(3600);
  });

  it('leaves out untimed tasks, events and other weeks', () => {
    const tasks = [
      task({ dueTime: null }),
      task({ kind: 'event' }),
      task({ dueDate: '2026-11-16' }),
    ];
    expect(plannedSeconds([], tasks, '2026-11-09', '2026-11-16')).toBe(0);
  });

  it('uses an hour when a timed task has no estimate', () => {
    expect(
      plannedSeconds(
        [],
        [task({ estimateMinutes: null })],
        '2026-11-09',
        '2026-11-16',
      ),
    ).toBe(3600);
  });
});
