import { nextUp } from '#next';
import type { Id, Task } from '@skkil-time/client/types';
import { describe, expect, it } from 'vitest';

const TODAY = '2026-11-07';

const task = (id: Id, patch: Partial<Task> = {}) =>
  ({
    id,
    title: `Task ${id}`,
    parentId: null,
    position: Number(id),
    priority: 4,
    completedAt: null,
    kind: 'task',
    statusCategory: null,
    waitingOn: [],
    dueDate: null,
    dueTime: null,
    deadline: null,
    ...patch,
  }) as Task;

describe('nextUp', () => {
  it('takes the earliest dated task, nested ones included', () => {
    const tasks = [
      task('1', { dueDate: '2026-11-20' }),
      task('2', { dueDate: '2026-11-10', dueTime: 900, parentId: '1' }),
      task('3', { dueDate: '2026-11-10', dueTime: 600, parentId: '1' }),
    ];
    expect(nextUp(tasks, TODAY)?.id).toBe('3');
  });

  it('falls back to the first open task when nothing has a date', () => {
    expect(nextUp([task('2'), task('1')], TODAY)?.id).toBe('1');
  });

  it('skips work that cannot be done now', () => {
    const tasks = [
      task('1', { completedAt: 1 }),
      task('3', { waitingOn: ['1'] }),
      task('4', { statusCategory: 'backlog' }),
      task('5', { kind: 'event', dueDate: TODAY }),
      task('6', { kind: 'record' }),
    ];
    expect(nextUp(tasks, TODAY)).toBeUndefined();
  });

  it('puts the most important work due now ahead of older, lesser work', () => {
    const tasks = [
      task('1', { dueDate: '2026-11-05', priority: 2 }),
      task('2', { dueDate: TODAY, priority: 1 }),
      task('3', { dueDate: '2026-11-08', priority: 1 }),
    ];
    expect(nextUp(tasks, TODAY)?.id).toBe('2');
    expect(nextUp([tasks[0], tasks[2]], TODAY)?.id).toBe('1');
  });

  it('prefers higher priority among undated tasks', () => {
    expect(nextUp([task('1'), task('2', { priority: 1 })], TODAY)?.id).toBe(
      '2',
    );
  });
});
