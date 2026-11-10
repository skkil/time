import { beforeEach, describe, expect, it, vi } from 'vitest';

const items = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => items.get(key) ?? null,
  setItem: (key: string, value: string) => void items.set(key, value),
  removeItem: (key: string) => void items.delete(key),
});

const { claimPreferences, getPreference, setPreference } =
  await import('./preferences');

describe('account preferences', () => {
  beforeEach(() => claimPreferences('first'));

  it('drops the previous account’s preferences and keeps the device’s', () => {
    setPreference('zoom', 1.25);
    setPreference('lastProject', '42');
    setPreference('weekStartsOn', 0);
    claimPreferences('second');
    expect(getPreference('zoom')).toBe(1.25);
    expect(getPreference('lastProject')).toBe('inbox');
    expect(getPreference('weekStartsOn')).toBe(1);
  });

  it('keeps everything when the same account comes back', () => {
    setPreference('lastProject', '7');
    claimPreferences('first');
    expect(getPreference('lastProject')).toBe('7');
  });
});

describe('project view memory', () => {
  const load = async (stored: Record<string, unknown>) => {
    items.set('preferences', JSON.stringify(stored));
    vi.resetModules();
    return import('./preferences');
  };

  it('carries the old layout and saved-view choices over', async () => {
    const { getPreference } = await load({
      lastViews: { a: 'view-1', b: 'default', c: 'view-2' },
      projectTabs: { c: 'timeline', inbox: 'graph' },
    });
    expect(getPreference('projectView')).toEqual({
      a: { view: 'view-1' },
      b: { view: 'list' },
      c: { view: 'timeline' },
      inbox: { view: 'graph' },
    });
  });

  it('drops the old keys once anything is saved', async () => {
    const { getPreference, setPreference } = await load({
      lastViews: { a: 'view-1' },
      projectTabs: { a: 'graph' },
    });
    setPreference('projectView', {
      ...getPreference('projectView'),
      b: { tab: 'notes' },
    });
    const saved = JSON.parse(items.get('preferences') ?? '{}');
    expect(saved.lastViews).toBeUndefined();
    expect(saved.projectTabs).toBeUndefined();
    expect(saved.projectView).toEqual({
      a: { view: 'graph' },
      b: { tab: 'notes' },
    });
  });

  it('prefers the new key and drops malformed entries', async () => {
    const { getPreference } = await load({
      lastViews: { a: 'view-1' },
      projectView: {
        a: { tab: 'focus', view: 'board' },
        b: { tab: 'nowhere', view: 3 },
        c: 'list',
      },
    });
    expect(getPreference('projectView')).toEqual({
      a: { tab: 'focus', view: 'board' },
      b: {},
    });
  });

  it('belongs to the signed-in account', async () => {
    const { claimPreferences, getPreference } = await load({
      projectView: { a: { view: 'board' } },
    });
    claimPreferences('someone-else');
    expect(getPreference('projectView')).toEqual({});
  });
});
