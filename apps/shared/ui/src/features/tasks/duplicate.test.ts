import { describe, expect, it } from 'vitest';

import type { Task } from '@/backend';

import { duplicatePlan } from './duplicate';

const task = (id: string, position: number, extra: Partial<Task> = {}) =>
  ({
    id,
    position,
    projectId: 'p',
    sectionId: null,
    parentId: null,
    completedAt: null,
    ...extra,
  }) as Task;

describe('duplicatePlan', () => {
  it('places the copy right after the original among open siblings', () => {
    const tasks = [
      task('a', 1),
      task('b', 2),
      task('done', 3, { completedAt: 1 }),
      task('c', 4),
      task('elsewhere', 5, { sectionId: 's' }),
    ];
    expect(duplicatePlan(tasks, tasks[1]).before).toBe('c');
    expect(duplicatePlan(tasks, tasks[3]).before).toBeNull();
  });

  it('copies open sub-tasks parents first, in order', () => {
    const root = task('root', 1);
    const tasks = [
      root,
      task('second', 2, { parentId: 'root' }),
      task('first', 1, { parentId: 'root' }),
      task('finished', 3, { parentId: 'root', completedAt: 1 }),
      task('nested', 1, { parentId: 'first' }),
    ];
    expect(duplicatePlan(tasks, root).steps.map((step) => step.id)).toEqual([
      'first',
      'second',
      'nested',
    ]);
  });
});
