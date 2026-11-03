import type { DeviceCommands } from '@skkil-time/local';
import type { EngineClient } from '~/engine/client';
import { browserFiles } from '~/platform/files';

const JSON_TYPE = 'application/json';

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
  syncHabits: () => engine.call('syncHabits'),
});
