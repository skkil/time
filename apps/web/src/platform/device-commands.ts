import type { DeviceCommands } from '@skkil-time/client/local';
import type { NotificationPrefs } from '@skkil-time/client/types';
import type { EngineClient } from '~/engine/client';
import { browserFiles } from '~/platform/files';

const JSON_TYPE = 'application/json';
const PREFS_KEY = 'skkil-time:notification-prefs';
const DEFAULT_PREFS: NotificationPrefs = {
  on: true,
  tasks: true,
  blocks: true,
  events: true,
};

const readPrefs = (): NotificationPrefs => {
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

const writePrefs = (prefs: NotificationPrefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    return null;
  }
  return null;
};

const today = () => new Date().toLocaleDateString('sv');

/** The commands a browser answers itself: backups as JSON files, CSV imports from a file input, and no desktop extras. */
export const webDeviceCommands = (
  engine: EngineClient,
  files = browserFiles,
): DeviceCommands => ({
  exportData: async () =>
    files.saveFile(
      `skkil-time-${today()}.json`,
      await engine.call('dump'),
      JSON_TYPE,
    ),
  importData: async () => {
    const backup = await files.openFile(`.json,${JSON_TYPE}`);
    if (backup === null) return false;
    await engine.call('restore', backup);
    return true;
  },
  pickImportFiles: () => files.pickImportFiles(),
  externalChanges: async () => false,
  getCaptureHotkey: async () => false,
  setCaptureHotkey: async () => null,
  getNotificationPrefs: async () => readPrefs(),
  setNotificationPrefs: async (prefs) => writePrefs(prefs),
  syncHabits: () => engine.call('syncHabits'),
});
