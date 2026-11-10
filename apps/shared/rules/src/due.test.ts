import { formatDue, isOverdue, isStale, taskTone } from '#due';
import type { Task } from '@skkil-time/client/types';
import { describe, expect, it } from 'vitest';

const TODAY = '2026-11-11';

const task = (patch: Partial<Task> = {}) =>
  ({
    dueDate: null,
    dueUntil: null,
    dueTime: null,
    completedAt: null,
    statusCategory: null,
    rolloverCount: 0,
    ...patch,
  }) as Task;

describe('windows', () => {
  const week = task({ dueDate: '2026-11-09', dueUntil: '2026-11-15' });

  it('is not overdue until the window has ended', () => {
    expect(isOverdue(week, '2026-11-15')).toBe(false);
    expect(isOverdue(week, '2026-11-16')).toBe(true);
    expect(taskTone(week, TODAY)).toBe('today');
    expect(taskTone(week, '2026-11-16')).toBe('overdue');
  });

  it('names whole weeks relative to today', () => {
    expect(formatDue(week, TODAY)).toBe('This week');
    expect(
      formatDue(task({ dueDate: '2026-11-16', dueUntil: '2026-11-22' }), TODAY),
    ).toBe('Next week');
    expect(
      formatDue(task({ dueDate: '2026-12-07', dueUntil: '2026-12-13' }), TODAY),
    ).toBe('Week of 7 Dec');
  });

  it('keeps single days as they were', () => {
    expect(formatDue(task({ dueDate: '2026-11-12' }), TODAY)).toBe('Tomorrow');
    expect(isOverdue(task({ dueDate: '2026-11-10' }), TODAY)).toBe(true);
  });
});

describe('isStale', () => {
  it('flags tasks moved three times or left for two weeks', () => {
    expect(isStale(task({ dueDate: TODAY, rolloverCount: 3 }), TODAY)).toBe(
      true,
    );
    expect(isStale(task({ dueDate: '2026-10-28' }), TODAY)).toBe(false);
    expect(isStale(task({ dueDate: '2026-10-27' }), TODAY)).toBe(true);
    expect(
      isStale(
        task({ dueDate: '2026-10-26', statusCategory: 'backlog' }),
        TODAY,
      ),
    ).toBe(false);
  });
});
