import { describe, expect, it } from 'vitest';

import type { SavedView } from '@/backend';

import {
  chooseTab,
  chooseView,
  fallbackView,
  remembersTab,
  viewOptions,
} from './project-view';

const view = (id: string, name: string): SavedView => ({
  id,
  projectId: 'p',
  name,
  layout: 'board',
  groupBy: 'status',
  filter: '{}',
  sort: 'manual',
  position: 0,
});

const ids = (options: { id: string }[]) => options.map((option) => option.id);

describe('view picker', () => {
  it('lists built-in layouts, then Graph when tasks are linked, then saved views', () => {
    expect(
      ids(
        viewOptions({
          inProject: true,
          linked: true,
          saved: [view('v1', 'Pipeline')],
        }),
      ),
    ).toEqual(['list', 'board', 'timeline', 'graph', 'v1']);
  });

  it('leaves Graph out without dependencies and Timeline out of the Inbox', () => {
    expect(
      ids(viewOptions({ inProject: true, linked: false, saved: [] })),
    ).toEqual(['list', 'board', 'timeline']);
    expect(
      ids(
        viewOptions({
          inProject: false,
          linked: false,
          saved: [view('v', 'x')],
        }),
      ),
    ).toEqual(['list', 'board']);
  });

  it('reopens the remembered view, else the fallback, else List', () => {
    const options = viewOptions({
      inProject: true,
      linked: false,
      saved: [view('v1', 'Pipeline')],
    });
    expect(chooseView(options, 'timeline', 'v1').id).toBe('timeline');
    expect(chooseView(options, 'graph', 'v1').id).toBe('v1');
    expect(chooseView(options, 'deleted-view', 'gone').id).toBe('list');
  });

  it('falls back to the project’s old layout, then its first saved view', () => {
    expect(fallbackView('board', [view('v1', 'Pipeline')])).toBe('board');
    expect(fallbackView('list', [view('v1', 'Pipeline')])).toBe('v1');
    expect(fallbackView(undefined, [])).toBe('list');
  });
});

describe('project tabs', () => {
  it('prefers the address, then the remembered tab, then Tasks', () => {
    expect(
      chooseTab({
        inProject: true,
        requested: 'settings',
        memory: { tab: 'notes' },
      }),
    ).toBe('settings');
    expect(
      chooseTab({
        inProject: true,
        requested: undefined,
        memory: { tab: 'notes' },
      }),
    ).toBe('notes');
    expect(
      chooseTab({ inProject: true, requested: undefined, memory: {} }),
    ).toBe('tasks');
  });

  it('keeps the Inbox on Tasks', () => {
    expect(
      chooseTab({
        inProject: false,
        requested: 'notes',
        memory: { tab: 'focus' },
      }),
    ).toBe('tasks');
  });

  it('remembers working tabs but not Settings', () => {
    expect(remembersTab('notes')).toBe(true);
    expect(remembersTab('settings')).toBe(false);
  });
});
