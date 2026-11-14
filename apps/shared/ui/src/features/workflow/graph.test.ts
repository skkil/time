import { describe, expect, it } from 'vitest';

import type { Id, Task } from '@/backend';

import { dependencyGraph } from './graph';

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
  ...patch,
});

const index = (tasks: Task[]) => {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const holding = new Map<Id, Task[]>();
  for (const t of tasks)
    for (const id of t.blockedBy)
      holding.set(id, [...(holding.get(id) ?? []), t]);
  return { byId, holding };
};

describe('dependencyGraph', () => {
  it('puts tasks after their latest blocker and starts right before what they hold up', () => {
    const tasks = [
      task({ id: '1', title: 'Copy' }),
      task({ id: '2', title: 'Design' }),
      task({ id: '3', title: 'Build', blockedBy: ['2'] }),
      task({ id: '4', title: 'Launch', blockedBy: ['1', '3'] }),
      task({ id: '5', title: 'Unlinked' }),
    ];
    const { byId, holding } = index(tasks);
    const { columns, edges } = dependencyGraph(tasks, byId, holding);
    expect(columns.map((column) => column.map((t) => t.id).sort())).toEqual([
      ['2'],
      ['1', '3'],
      ['4'],
    ]);
    expect(edges).toHaveLength(3);
  });

  it('keeps finished blockers but drops finished dependents', () => {
    const tasks = [
      task({ id: '1', completedAt: 5 }),
      task({ id: '2', blockedBy: ['1'] }),
      task({ id: '3', blockedBy: ['2'], completedAt: 6 }),
    ];
    const { byId, holding } = index(tasks);
    const { columns } = dependencyGraph(tasks, byId, holding);
    expect(columns.map((column) => column.map((t) => t.id))).toEqual([
      ['1'],
      ['2'],
    ]);
  });
});
