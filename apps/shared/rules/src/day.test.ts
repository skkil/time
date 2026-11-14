import { earlierTasks, planDay } from '#day';
import type { Id, Task, TimeBlock } from '@skkil-time/client/types';
import { describe, expect, it } from 'vitest';

const DAY = '2026-11-11';

const task = (id: Id, patch: Partial<Task> = {}) =>
  ({
    id,
    title: `Task ${id}`,
    projectId: null,
    parentId: null,
    position: Number(id),
    completedAt: null,
    kind: 'task',
    statusCategory: null,
    mustOn: null,
    dueDate: null,
    dueUntil: null,
    dueTime: null,
    ...patch,
  }) as Task;

const block = (taskId: Id, startAt: number) =>
  ({ id: `b${taskId}`, taskId, startAt, endAt: startAt + 3600 }) as TimeBlock;

const noon = (key: string) => new Date(`${key}T12:00:00`).getTime() / 1000;

describe('planDay', () => {
  it('lists an open week window under this week, not as due or earlier', () => {
    const plan = planDay(
      DAY,
      [task('1', { dueDate: '2026-11-09', dueUntil: '2026-11-15' })],
      [],
      [],
    );
    expect(plan.thisWeek.map((t) => t.id)).toEqual(['1']);
    expect(plan.due).toEqual([]);
    expect(plan.earlier).toEqual([]);
  });

  it('shows a past-due task with a block today only as the block', () => {
    const plan = planDay(
      DAY,
      [task('1', { dueDate: '2026-11-09' })],
      [],
      [block('1', noon(DAY))],
    );
    expect(plan.blocks).toHaveLength(1);
    expect(plan.earlier).toEqual([]);
  });
});

describe('earlierTasks', () => {
  it('orders by the end of the window and skips windows still open', () => {
    const tasks = [
      task('1', { dueDate: '2026-11-02', dueUntil: '2026-11-08' }),
      task('2', { dueDate: '2026-11-05' }),
      task('3', { dueDate: '2026-11-09', dueUntil: '2026-11-15' }),
    ];
    expect(earlierTasks(tasks, DAY).map((t) => t.id)).toEqual(['2', '1']);
  });
});
