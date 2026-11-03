import { formatDistance } from 'date-fns';

import type { SyncView } from '@/core/sync/controller';

export type SyncSummary = { status: string; detail: string };

const changes = (count: number) =>
  count === 1 ? '1 change' : `${count} changes`;

const synced = (lastSyncedAt: number | null, now: number) =>
  lastSyncedAt === null
    ? 'Not synced yet'
    : `Synced ${formatDistance(lastSyncedAt, now, { addSuffix: true })}`;

/** The Sync row's two lines: what sync is doing, then what waits. */
export function summarize(view: SyncView, now: number): SyncSummary {
  const waiting =
    view.pending > 0
      ? `${changes(view.pending)} waiting to sync`
      : 'Everything on this device is synced';
  switch (view.phase) {
    case 'connecting':
      return { status: 'Syncing…', detail: waiting };
    case 'offline':
      return {
        status: 'Offline',
        detail: `${waiting}. ${synced(view.lastSyncedAt, now)}.`,
      };
    case 'needsChoice':
      return {
        status: 'Waiting for your choice',
        detail: 'Choose what to do with the data on this device.',
      };
    case 'off':
      return { status: 'Paused', detail: waiting };
    case 'online':
      return { status: synced(view.lastSyncedAt, now), detail: waiting };
  }
}
