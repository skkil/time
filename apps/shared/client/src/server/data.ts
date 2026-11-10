import { type ApiError, unwrap } from '#server/api';
import type { HostCommands } from '#server/backend';
import type { NotificationPrefs } from '#types/bindings';

const JSON_TYPE = 'application/json';

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const today = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const PREFS_KEY = 'skkil-time:notification-prefs';
const DEFAULT_PREFS: NotificationPrefs = {
  on: true,
  tasks: true,
  blocks: true,
  events: true,
};

const readNotificationPrefs = (): NotificationPrefs => {
  try {
    const saved = globalThis.localStorage?.getItem(PREFS_KEY);
    return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

const writeNotificationPrefs = (prefs: NotificationPrefs) => {
  try {
    globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    return null;
  }
  return null;
};

export const data: HostCommands<
  | 'externalChanges'
  | 'pickImportFiles'
  | 'importProjects'
  | 'getCaptureHotkey'
  | 'setCaptureHotkey'
  | 'getRemindersEnabled'
  | 'setRemindersEnabled'
  | 'listReminders'
  | 'getNotificationPrefs'
  | 'setNotificationPrefs'
  | 'exportData'
  | 'importData'
  | 'deleteAllData'
  | 'saveProjectPreset'
> = (api, host) => {
  let seen: number | null = null;
  return {
    externalChanges: async () => {
      const { version, lastWriter } = await unwrap(api.GET('/api/v1/changes'));
      const previous = seen;
      seen = version;
      return (
        previous !== null &&
        previous !== version &&
        lastWriter !== host.clientId
      );
    },
    pickImportFiles: () => host.pickImportFiles(),
    importProjects: (projects) =>
      unwrap(api.POST('/api/v1/import/projects', { body: projects })),
    getCaptureHotkey: () => unwrap(api.GET('/api/v1/settings/capture-hotkey')),
    setCaptureHotkey: (enabled) =>
      unwrap(api.PUT('/api/v1/settings/capture-hotkey', { body: { enabled } })),
    getRemindersEnabled: () => unwrap(api.GET('/api/v1/settings/reminders')),
    setRemindersEnabled: (enabled) =>
      unwrap(api.PUT('/api/v1/settings/reminders', { body: { enabled } })),
    listReminders: (from, to, prefs) =>
      unwrap(
        api.GET('/api/v1/notifications/reminders', {
          params: { query: { from, to, ...prefs } },
        }),
      ),
    getNotificationPrefs: async () => readNotificationPrefs(),
    setNotificationPrefs: async (prefs) => writeNotificationPrefs(prefs),
    exportData: async () => {
      const backup = await unwrap(api.GET('/api/v1/data/export'));
      return host.saveFile(
        `skkil-time-${today()}.json`,
        pretty(backup),
        JSON_TYPE,
      );
    },
    importData: async () => {
      const text = await host.openFile('.json');
      if (text === null) return false;
      await unwrap(
        api.POST('/api/v1/data/import', {
          body: text,
          bodySerializer: (body) => body,
        }),
      );
      return true;
    },
    deleteAllData: () => unwrap(api.DELETE('/api/v1/data')),
    saveProjectPreset: async (id) => {
      const preset = await unwrap(
        api.GET('/api/v1/projects/{id}/preset', { params: { path: { id } } }),
      );
      const saved = await host.saveFile(
        `${preset.key}.skkil-preset.json`,
        pretty(preset),
        JSON_TYPE,
      );
      if (saved === null)
        throw {
          kind: 'invalid',
          message: 'The preset wasn’t saved.',
        } satisfies ApiError;
      return saved;
    },
  };
};
