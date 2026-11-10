import type { Reminder } from '@skkil-time/client/types';
import { describe, expect, it } from 'vitest';

import {
  MAX_SCHEDULED,
  SOURCE,
  isOurs,
  planNotifications,
  snoozed,
} from '@/core/notifications/plan';

const reminder = (
  key: string,
  at: number,
  kind: Reminder['kind'] = 'task',
): Reminder => ({
  key,
  kind,
  at,
  title: key,
  startsAt: at,
  taskId: `task-${key}`,
  blockId: null,
  location: '',
});

describe('planNotifications', () => {
  it('schedules what is still ahead, soonest first, tagged as ours', () => {
    const planned = planNotifications(
      [
        reminder('later', 2_000),
        reminder('past', 500),
        reminder('soon', 1_500),
      ],
      1_000,
    );
    expect(planned.map((item) => item.data.key)).toEqual(['soon', 'later']);
    expect(planned.every((item) => isOurs(item.data))).toBe(true);
    expect(planned[0].identifier).toBe(`${SOURCE}:soon`);
  });

  it('stays under the limit phones keep', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      reminder(`r${i}`, 2_000 + i),
    );
    expect(planNotifications(many, 0)).toHaveLength(MAX_SCHEDULED);
  });

  it('describes blocks and events by their start', () => {
    const [block, event] = planNotifications(
      [
        reminder('block', 1_000, 'block'),
        { ...reminder('event', 2_000, 'event'), location: 'Room 3' },
      ],
      0,
    );
    expect(block.body).toMatch(/^Focus block at \d\d:\d\d$/);
    expect(event.body).toMatch(/^Starts at \d\d:\d\d · Room 3$/);
  });
});

describe('snoozed', () => {
  it('repeats a task in 15 minutes and a block in 10, never an event', () => {
    const [task, block, event] = planNotifications(
      [
        reminder('t', 10, 'task'),
        reminder('b', 20, 'block'),
        reminder('e', 30, 'event'),
      ],
      0,
    );
    expect(snoozed(task.data, 1_000)?.at).toBe(1_000 + 15 * 60);
    expect(snoozed(block.data, 1_000)?.at).toBe(1_000 + 10 * 60);
    expect(snoozed(event.data, 1_000)).toBeNull();
    expect(snoozed(task.data, 1_000)?.identifier).not.toBe(task.identifier);
  });
});

it('ignores notifications it did not schedule', () => {
  expect(isOurs({ source: 'other' })).toBe(false);
  expect(isOurs(undefined)).toBe(false);
});
