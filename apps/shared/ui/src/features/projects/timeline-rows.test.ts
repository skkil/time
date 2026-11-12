import { describe, expect, it } from 'vitest';

import type { Task } from '@/backend';

import { taskSpan, taskTimelineRows } from './timeline-rows';

const task = (id: string, extra: Partial<Task> = {}) =>
  ({
    id,
    title: id,
    projectId: 'p',
    kind: 'task',
    completedAt: null,
    dueDate: null,
    dueUntil: null,
    deadline: null,
    statusCategory: null,
    ...extra,
  }) as Task;

describe('project timeline rows', () => {
  it('lists every open task: dated ones by date, then the undated ones', () => {
    const rows = taskTimelineRows(
      [
        task('later', { dueDate: '2026-11-20' }),
        task('undated'),
        task('sooner', { deadline: '2026-11-14' }),
        task('done', { dueDate: '2026-11-13', completedAt: 1 }),
        task('record', { kind: 'record' }),
      ],
      '2026-11-13',
      () => 'green',
      () => {},
    );
    expect(rows.map((row) => [row.id, row.note])).toEqual([
      ['sooner', undefined],
      ['later', undefined],
      ['undated', 'No date'],
    ]);
  });

  it('colours each row by its own project', () => {
    const [row] = taskTimelineRows(
      [task('a', { projectId: 'child' })],
      '2026-11-13',
      (projectId) => (projectId === 'child' ? 'blue' : 'green'),
      () => {},
    );
    expect(row.color).toBe('blue');
  });

  it('spans a task from its date to the later of its end date and deadline', () => {
    expect(
      taskSpan(task('a', { dueDate: '2026-11-15', dueUntil: '2026-11-17' })),
    ).toEqual({ from: '2026-11-15', to: '2026-11-17' });
    expect(
      taskSpan(
        task('b', {
          dueDate: '2026-11-15',
          dueUntil: '2026-11-17',
          deadline: '2026-11-20',
        }),
      ),
    ).toEqual({ from: '2026-11-15', to: '2026-11-20' });
    expect(taskSpan(task('c', { dueDate: '2026-11-15' }))).toBeUndefined();
  });
});
