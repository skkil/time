import { useSyncExternalStore } from 'react';

export type ZenBackdropMode = 'motion' | 'still';

export type ProjectTab = 'graph' | 'timeline' | 'focus' | 'canvas';

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type WeatherPlace = {
  name: string;
  latitude: number;
  longitude: number;
};

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
  weekProjectsOpen: boolean;
  projectsNavOpen: boolean;
  lastViews: Record<string, number>;
  projectTabs: Partial<Record<string, ProjectTab>>;
  weekStartsOn: WeekStart;
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
  weekProjectsOpen: false,
  projectsNavOpen: true,
  lastViews: {},
  projectTabs: {},
  weekStartsOn: 1,
  priorityColors: {},
};

const BACKDROP_MODES: ZenBackdropMode[] = ['motion', 'still'];

const storageKey = 'preferences';
const listeners = new Set<() => void>();
let cache: Preferences | undefined;

function read(): Preferences {
  if (cache) return cache;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    cache = { ...defaults, ...stored };
    if (!BACKDROP_MODES.includes(cache!.zenBackdrop))
      cache!.zenBackdrop = 'motion';
    if (![0, 1, 2, 3, 4, 5, 6].includes(cache!.weekStartsOn))
      cache!.weekStartsOn = 1;
    if (typeof cache!.priorityColors !== 'object' || !cache!.priorityColors)
      cache!.priorityColors = {};
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
