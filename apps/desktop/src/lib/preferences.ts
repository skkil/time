import { useSyncExternalStore } from 'react';

export type ZenBackdropMode = 'auto' | 'shader' | 'static' | 'off';

export type Preferences = {
  zoom: number;
  zenBackdrop: ZenBackdropMode;
  zenTheme: string;
  dismissedPlanCard: string;
};

const defaults: Preferences = {
  zoom: 1,
  zenBackdrop: 'auto',
  zenTheme: 'water',
  dismissedPlanCard: '',
};

const storageKey = 'preferences';
const listeners = new Set<() => void>();
let cache: Preferences | undefined;

function read(): Preferences {
  if (cache) return cache;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    cache = { ...defaults, ...stored };
  } catch {
    cache = defaults;
  }
  return cache!;
}

export function getPreference<K extends keyof Preferences>(key: K) {
  return read()[key];
}

export function setPreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K],
) {
  if (read()[key] === value) return;
  cache = { ...read(), [key]: value };
  localStorage.setItem(storageKey, JSON.stringify(cache));
  listeners.forEach((listener) => listener());
}

export function subscribePreferences(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePreference<K extends keyof Preferences>(key: K) {
  return useSyncExternalStore(subscribePreferences, () => getPreference(key));
}
