import { describe, expect, it } from 'vitest';

import type { Milestone, Project, Task } from '@/bindings';

import { comingUp, nextUp, noteLines } from './context';

const TODAY = '2026-11-07';

const task = (id: number, patch: Partial<Task> = {}) =>
  ({
    id,
    title: `Task ${id}`,
    parentId: null,
    position: id,
    priority: 4,
    completedAt: null,
    kind: 'task',
    someday: false,
    statusCategory: null,
    waitingOn: [],
    dueDate: null,
    dueTime: null,
    deadline: null,
    ...patch,
  }) as Task;

const project = (targetDate: string | null = null) =>
  ({ targetDate }) as Project;

describe('nextUp', () => {
  it('takes the earliest dated task, nested ones included', () => {
    const tasks = [
      task(1, { dueDate: '2026-11-20' }),
      task(2, { dueDate: '2026-11-10', dueTime: 900, parentId: 1 }),
      task(3, { dueDate: '2026-11-10', dueTime: 600, parentId: 1 }),
    ];
    expect(nextUp(tasks, TODAY)?.id).toBe(3);
  });

  it('falls back to the first open task when nothing has a date', () => {
    expect(nextUp([task(2), task(1)], TODAY)?.id).toBe(1);
  });

  it('skips work that cannot be done now', () => {
    const tasks = [
      task(1, { completedAt: 1 }),
      task(2, { someday: true }),
      task(3, { waitingOn: [1] }),
      task(4, { statusCategory: 'backlog' }),
      task(5, { kind: 'event', dueDate: TODAY }),
      task(6, { kind: 'record' }),
    ];
    expect(nextUp(tasks, TODAY)).toBeUndefined();
  });

  it('puts the most important work due now ahead of older, lesser work', () => {
    const tasks = [
      task(1, { dueDate: '2026-11-05', priority: 2 }),
      task(2, { dueDate: TODAY, priority: 1 }),
      task(3, { dueDate: '2026-11-08', priority: 1 }),
    ];
    expect(nextUp(tasks, TODAY)?.id).toBe(2);
    expect(nextUp([tasks[0], tasks[2]], TODAY)?.id).toBe(1);
  });

  it('prefers higher priority among undated tasks', () => {
    expect(nextUp([task(1), task(2, { priority: 1 })], TODAY)?.id).toBe(2);
  });
});

describe('comingUp', () => {
  it('merges dates from tasks, milestones and the project in order', () => {
    const milestones = [
      { id: 1, name: 'Offer', date: '2026-11-15' },
      { id: 2, name: 'Past', date: '2026-10-01' },
    ] as Milestone[];
    const items = comingUp(
      [task(1, { dueDate: '2026-11-10', deadline: '2026-11-20' })],
      milestones,
      project('2026-11-30'),
      TODAY,
    );
    expect(items.map((item) => [item.date, item.note])).toEqual([
      ['2026-11-10', undefined],
      ['2026-11-15', 'Milestone'],
      ['2026-11-30', undefined],
    ]);
  });

  it('looks ahead only and lists each task once', () => {
    const items = comingUp(
      [
        task(1, { dueDate: '2026-11-06' }),
        task(2, { dueDate: '2026-11-09', deadline: '2026-11-12' }),
      ],
      [],
      project(),
      TODAY,
    );
    expect(items.map((item) => [item.taskId, item.date])).toEqual([
      [2, '2026-11-09'],
    ]);
  });

  it('drops past events and closed work', () => {
    const items = comingUp(
      [
        task(1, { dueDate: '2026-11-08' }),
        task(2, { dueDate: '2026-11-01', kind: 'event' }),
        task(3, { dueDate: '2026-11-09', completedAt: 1 }),
        task(4, { dueDate: '2026-11-09', statusCategory: 'backlog' }),
      ],
      [],
      project(),
      TODAY,
    );
    expect(items.map((item) => item.taskId)).toEqual([1]);
  });

  it('leaves out the next task but keeps its deadline', () => {
    const items = comingUp(
      [task(1, { dueDate: '2026-11-10', deadline: '2026-11-20' })],
      [],
      project(),
      TODAY,
      1,
    );
    expect(items.map((item) => item.date)).toEqual(['2026-11-20']);
  });

  it('shows five at most', () => {
    const tasks = Array.from({ length: 8 }, (_, i) =>
      task(i + 1, { dueDate: '2026-11-09' }),
    );
    expect(comingUp(tasks, [], project(), TODAY)).toHaveLength(5);
  });
});

describe('noteLines', () => {
  it('reads an editor document as plain lines', () => {
    expect(
      noteLines(
        '<h1>Plan</h1><p>Resume <strong>v3</strong> &amp; cover</p><ul><li><p>Java</p></li></ul><p></p>',
      ),
    ).toEqual(['Plan', 'Resume v3 & cover', 'Java']);
  });

  it('is empty for an empty document', () => {
    expect(noteLines('')).toEqual([]);
    expect(noteLines('<p></p>')).toEqual([]);
  });
});
