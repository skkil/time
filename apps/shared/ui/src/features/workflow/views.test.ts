import { describe, expect, it } from 'vitest';

import type { Id, ItemStatus, Task } from '@/backend';

import { filterTasks, groupTasks, sortTasks } from './views';

const task = (patch: Partial<Task>): Task => ({
  id: '1',
  title: 'Task',
  notes: '',
  projectId: '1',
  sectionId: null,
  parentId: null,
  priority: 4,
  dueDate: null,
  dueUntil: null,
  dueTime: null,
  deadline: null,
  recurrence: null,
  estimateMinutes: null,
  position: 0,
  completedAt: null,
  createdAt: 0,
  trackedSeconds: 0,
  outcomeId: null,
  nextStep: '',
  mustOn: null,
  typeId: null,
  statusId: null,
  milestoneId: null,
  location: '',
  countsAsTime: false,
  statusChangedAt: null,
  kind: 'task',
  statusCategory: null,
  blockedBy: [],
  waitingOn: [],
  phaseId: null,
  placeId: null,
  ...patch,
});

const status = (id: Id, category: string): ItemStatus => ({
  id,
  projectId: '1',
  name: category,
  category,
  position: Number(id),
});

describe('views', () => {
  it('keeps closed items on a status board but not in a plain list', () => {
    const tasks = [
      task({ id: '1', statusCategory: 'todo' }),
      task({ id: '2', statusCategory: 'done', completedAt: 5 }),
      task({ id: '3', parentId: '1' }),
    ];
    const board = filterTasks(tasks, {
      layout: 'board',
      groupBy: 'status',
      sort: 'manual',
      filter: {},
    });
    const list = filterTasks(tasks, {
      layout: 'list',
      groupBy: 'type',
      sort: 'manual',
      filter: {},
    });
    expect(board.map((t) => t.id)).toEqual(['1', '2']);
    expect(list.map((t) => t.id)).toEqual(['1']);
  });

  it('hides tasks still waiting on others', () => {
    const tasks = [
      task({ id: '1', waitingOn: ['3'] }),
      task({ id: '2', blockedBy: ['3'] }),
    ];
    const visible = filterTasks(tasks, {
      layout: 'list',
      groupBy: 'none',
      sort: 'manual',
      filter: { hideWaiting: true },
    });
    expect(visible.map((t) => t.id)).toEqual(['2']);
  });

  it('filters by status category', () => {
    const tasks = [
      task({ id: '1', statusCategory: 'backlog' }),
      task({ id: '2', statusCategory: 'todo' }),
    ];
    const spec = {
      layout: 'list',
      groupBy: 'none',
      sort: 'manual',
      filter: { categories: ['backlog'] },
    };
    expect(filterTasks(tasks, spec).map((t) => t.id)).toEqual(['1']);
    expect(
      filterTasks(tasks, { ...spec, filter: { hideBacklog: true } }).map(
        (t) => t.id,
      ),
    ).toEqual(['2']);
  });

  it('sorts undated items last', () => {
    const tasks = [
      task({ id: '1', dueDate: null }),
      task({ id: '2', dueDate: '2026-11-05' }),
      task({ id: '3', dueDate: '2026-11-03' }),
    ];
    expect(sortTasks(tasks, 'date').map((t) => t.id)).toEqual(['3', '2', '1']);
  });

  it('groups by status in the project order and by date bucket', () => {
    const parts = {
      types: [],
      milestones: [],
      sections: [],
      statuses: [status('10', 'todo'), status('11', 'done')],
    };
    const tasks = [
      task({ id: '1', statusId: '11' }),
      task({ id: '2', statusId: '10', dueDate: '2026-11-01' }),
    ];
    expect(
      groupTasks(tasks, 'status', parts, '2026-11-02').map((g) =>
        g.tasks.map((t) => t.id),
      ),
    ).toEqual([['2'], ['1']]);
    const byDate = groupTasks(tasks, 'date', parts, '2026-11-02');
    expect(byDate[0].label).toBe('Earlier');
    expect(byDate[0].tasks.map((t) => t.id)).toEqual(['2']);
    expect(byDate.at(-1)?.tasks.map((t) => t.id)).toEqual(['1']);
  });
});
