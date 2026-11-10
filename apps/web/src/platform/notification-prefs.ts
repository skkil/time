import type { NotificationPrefs } from '@skkil-time/client/types';

const PREFS_KEY = 'skkil-time:notification-prefs';
const CHANGED = 'skkil-time:notification-prefs';
const DEFAULT_PREFS: NotificationPrefs = {
  on: true,
  tasks: true,
  blocks: true,
  events: true,
};

export const readPrefs = (): NotificationPrefs => {
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

export const writePrefs = (prefs: NotificationPrefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    return null;
  }
  window.dispatchEvent(new Event(CHANGED));
  return null;
};

export const onPrefsChange = (listener: () => void) => {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
};

export const reminderKinds = (prefs: NotificationPrefs) =>
  [
    prefs.tasks && 'task',
    prefs.blocks && 'block',
    prefs.events && 'event',
  ].filter((kind) => kind !== false);
