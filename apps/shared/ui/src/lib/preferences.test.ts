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
