import type { DeviceCommands } from '@skkil-time/local';

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
  syncHabits: async () => ({
    activitywatch: 'notNeeded',
    hasWebData: false,
    hasWindowData: false,
    message: null,
  }),
};
