import { listen } from '@tauri-apps/api/event';

import type { Calendars, ConnectionStatus, Sync, SyncStatus } from '@/platform';

import { type RemoteChange, type SyncView, commands } from './bindings';

function subscribe<T>(event: string, listener: (payload: T) => void) {
  const stop = listen<T>(event, ({ payload }) => listener(payload));
  return () => void stop.then((unlisten) => unlisten());
}

const onStatus = (listener: (status: SyncStatus) => void) =>
  subscribe<SyncView>('sync-status', listener);

export const tauriSync: Sync = {
  status: commands.syncStatus,
  onStatus,
  syncNow: async () => void (await commands.syncNow()),
  issues: commands.syncIssues,
  dismissIssue: async (id) => void (await commands.dismissSyncIssue(id)),
  retryIssue: async (id) => void (await commands.retrySyncIssue(id)),
  signIn: async () => void (await commands.signIn()),
  signOut: async () => void (await commands.signOut()),
  chooseAccountData: async (choice) =>
    void (await commands.chooseAccountData(choice)),
  config: commands.getSyncConfig,
  saveConfig: async (config) => void (await commands.setSyncConfig(config)),
};

/** Calendars belong to the account; a signed-out desktop has none. */
export const tauriCalendars: Calendars = {
  status: commands.calendarStatus,
  connect: async () => void (await commands.connectCalendar()),
  disconnect: async (id) => void (await commands.disconnectCalendar(id)),
};

/** Pulled changes refetch like another device's write on web. */
export const onRemoteChange = (listener: (change: { topic: string }) => void) =>
  subscribe<RemoteChange>('remote-change', () => listener({ topic: 'sync' }));

/**
 * Local writes always save, so the only state worth a notice is a sign-in
 * that stopped working; being offline shows in Settings → Sync.
 */
export const onConnectionChange = (
  listener: (status: ConnectionStatus) => void,
) => {
  const report = (status: SyncStatus) =>
    listener(status.phase === 'needsSignIn' ? 'signedOut' : 'online');
  void commands.syncStatus().then(report);
  return onStatus(report);
};
