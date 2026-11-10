import { SOMEDAY, describeMove, movedTask, weekTarget } from '#move';
import type { Task } from '@skkil-time/client/types';
import { describe, expect, it } from 'vitest';

const TODAY = '2026-11-11';

const task = (patch: Partial<Task> = {}) =>
  ({
    someday: false,
    dueDate: '2026-11-10',
    dueUntil: null,
    dueTime: 540,
    recurrence: null,
    mustOn: '2026-11-10',
    ...patch,
  }) as Task;

describe('movedTask', () => {
  it('gives a week a window and drops the time and must outside it', () => {
    const moved = movedTask(task(), weekTarget('2026-11-16'));
    expect(moved).toMatchObject({
      dueDate: '2026-11-16',
      dueUntil: '2026-11-22',
      dueTime: null,
      mustOn: null,
    });
  });

  it('parks a task in Someday without a date', () => {
    expect(movedTask(task(), SOMEDAY)).toMatchObject({
      someday: true,
      dueDate: null,
      dueTime: null,
      mustOn: null,
    });
  });
});

describe('describeMove', () => {
  it('says where the tasks went and what happened to their blocks', () => {
    const result = { tasks: 2, blocksMoved: 1, blocksRemoved: 0 };
    expect(
      describeMove('2 tasks', weekTarget('2026-11-16'), result, TODAY),
    ).toBe('Moved 2 tasks to next week · 1 focus block moved');
    expect(
      describeMove(
        '“Essay”',
        SOMEDAY,
        { ...result, blocksMoved: 0, blocksRemoved: 2 },
        TODAY,
      ),
    ).toBe('Moved “Essay” to Someday · 2 focus blocks cleared');
  });
});
