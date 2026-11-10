import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';

import type { Id } from '@/backend';
import type { Platform } from '@/platform';

import { commands } from './bindings';
import {
  onConnectionChange,
  onRemoteChange,
  tauriCalendars,
  tauriSync,
} from './sync';

function subscribe<T>(event: string, listener: (payload: T) => void) {
  const stop = listen<T>(event, ({ payload }) => listener(payload));
  return () => void stop.then((unlisten) => unlisten());
}

export const tauriPlatform: Platform = {
  kind: 'desktop',
  openUrl: (url) => void openUrl(url),
  onFocusChange(listener) {
    const stop = getCurrentWindow().onFocusChanged(({ payload }) =>
      listener(payload),
    );
    return () => void stop.then((unlisten) => unlisten());
  },
  setZoom: (zoom) => void getCurrentWebview().setZoom(zoom),
  onOpenTask: (listener) => subscribe<Id>('open-task', listener),
  onQuickAdd: (listener) => subscribe<null>('quick-add', () => listener()),
  onOpenEarlier: (listener) =>
    subscribe<null>('open-earlier', () => listener()),
  account: null,
  sync: tauriSync,
  calendars: tauriCalendars,
  tray: {
    keepOnClose: commands.getKeepInTray,
    setKeepOnClose: async (keep) => void (await commands.setKeepInTray(keep)),
  },
  onRemoteChange,
  onConnectionChange,
  features: {
    captureHotkey: true,
    reminders: true,
    activityTracking: true,
    databaseFile: true,
  },
};
