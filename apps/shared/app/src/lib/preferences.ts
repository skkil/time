import type { WeekStart } from '@skkil-time/domain/time';
import { useSyncExternalStore } from 'react';

import { platform } from '@/platform';

export type ZenBackdropMode = 'motion' | 'still';

export type ProjectTab = 'graph' | 'timeline';

export type { WeekStart };

export type WeatherPlace = {
  name: string;
  latitude: number;
  longitude: number;
};

export type SleepWindow = { start: number; end: number };

export type Preferences = {
  zoom: number;
  zenBackdrop: ZenBackdropMode;
  profileName: string;
  showDate: boolean;
  showWeekday: boolean;
  showWeather: boolean;
  weatherPlace: WeatherPlace | null;
  lastProject: string;
  weekHabitsOpen: boolean;
  dayAnyTimeOpen: boolean;
  weekProjectsOpen: boolean;
  projectsSidebarOpen: boolean;
  lastViews: Record<string, number>;
  projectTabs: Partial<Record<string, ProjectTab>>;
  weekStartsOn: WeekStart;
  sleep: SleepWindow | null;
  priorityColors: Record<string, string>;
};

const defaults: Preferences = {
  zoom: 1,
  zenBackdrop: 'motion',
  profileName: '',
  showDate: true,
  showWeekday: true,
  showWeather: true,
  weatherPlace: null,
  lastProject: 'inbox',
  weekHabitsOpen: false,
  dayAnyTimeOpen: true,
  weekProjectsOpen: false,
  projectsSidebarOpen: false,
  lastViews: {},
  projectTabs: {},
  weekStartsOn: 1,
  sleep: null,
  priorityColors: {},
};

/** Follow the account to every signed-in device; the rest describe this device's layout. */
const SHARED_KEYS = new Set<keyof Preferences>([
  'profileName',
  'showDate',
  'showWeekday',
  'showWeather',
  'weatherPlace',
  'weekStartsOn',
  'sleep',
  'priorityColors',
  'zenBackdrop',
]);

const BACKDROP_MODES: ZenBackdropMode[] = ['motion', 'still'];

const storageKey = 'preferences';
const listeners = new Set<() => void>();
let cache: Preferences | undefined;

function sanitize(stored: Record<string, unknown>): Preferences {
  const next = { ...defaults, ...stored } as Preferences;
  if (!BACKDROP_MODES.includes(next.zenBackdrop)) next.zenBackdrop = 'motion';
  if (![0, 1, 2, 3, 4, 5, 6].includes(next.weekStartsOn)) next.weekStartsOn = 1;
  if (typeof next.priorityColors !== 'object' || !next.priorityColors)
    next.priorityColors = {};
  return next;
}

function read(): Preferences {
  if (cache) return cache;
  try {
    cache = sanitize(JSON.parse(localStorage.getItem(storageKey) ?? '{}'));
  } catch {
    cache = defaults;
  }
  return cache;
}

function store(next: Preferences) {
  cache = next;
  localStorage.setItem(storageKey, JSON.stringify(cache));
  listeners.forEach((listener) => listener());
}

export function getPreference<K extends keyof Preferences>(key: K) {
  return read()[key];
}

export function setPreference<K extends keyof Preferences>(
  key: K,
  value: Preferences[K],
) {
  if (read()[key] === value) return;
  store({ ...read(), [key]: value });
  if (SHARED_KEYS.has(key))
    void platform()
      .preferences?.save({ [key]: value })
      .catch(() => undefined);
}

async function pullShared() {
  const shared = platform().preferences;
  if (!shared) return;
  const remote = await shared.load();
  const picked = Object.fromEntries(
    Object.entries(remote).filter(([key]) =>
      SHARED_KEYS.has(key as keyof Preferences),
    ),
  );
  store(sanitize({ ...read(), ...picked }));
}

/** Loads account-wide preferences and keeps them current as other devices change them. */
export function syncSharedPreferences() {
  if (!platform().preferences) return;
  void pullShared().catch(() => undefined);
  platform().onRemoteChange?.((change) => {
    if (change.topic === 'preferences')
      void pullShared().catch(() => undefined);
  });
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
