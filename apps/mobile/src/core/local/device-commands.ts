import type { DeviceCommands } from '@skkil-time/client/local';
import type { NotificationPrefs } from '@skkil-time/client/types';
import * as SecureStore from 'expo-secure-store';

const PREFS_KEY = 'notification-prefs';
const DEFAULT_PREFS: NotificationPrefs = {
  on: true,
  tasks: true,
  blocks: true,
  events: true,
};

const readPrefs = async (): Promise<NotificationPrefs> => {
  try {
    const saved = await SecureStore.getItemAsync(PREFS_KEY);
    return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

/**
 * Commands that touch only the device. A phone has no database file to
 * export, no capture hotkey and no ActivityWatch, and nothing else writes
 * to its replica.
 */
export const deviceCommands: DeviceCommands = {
  exportData: async () => null,
  importData: async () => false,
  pickImportFiles: async () => [],
  externalChanges: async () => false,
  getCaptureHotkey: async () => false,
  setCaptureHotkey: async () => null,
  getNotificationPrefs: readPrefs,
  setNotificationPrefs: async (prefs) => {
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
    return null;
  },
  syncHabits: async () => ({
    activitywatch: 'notNeeded',
    hasWebData: false,
    hasWindowData: false,
    message: null,
  }),
};
