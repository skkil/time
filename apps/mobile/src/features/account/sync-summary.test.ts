import { describe, expect, it } from 'vitest';

import type { SyncView } from '@/core/sync/controller';
import { summarize } from '@/features/account/sync-summary';

const NOW = Date.UTC(2026, 10, 9, 12, 0);

const view = (overrides: Partial<SyncView>): SyncView => ({
  phase: 'online',
  pending: 0,
  issues: 0,
  lastSyncedAt: NOW - 120_000,
  error: null,
  ...overrides,
});

describe('summarize', () => {
  it('says when it last synced and that nothing waits', () => {
    expect(summarize(view({}), NOW)).toEqual({
      status: 'Synced 2 minutes ago',
      detail: 'Everything on this device is synced',
    });
  });

  it('counts the changes waiting while offline', () => {
    expect(summarize(view({ phase: 'offline', pending: 1 }), NOW)).toEqual({
      status: 'Offline',
      detail: '1 change waiting to sync. Synced 2 minutes ago.',
    });
    expect(
      summarize(view({ phase: 'offline', pending: 3, lastSyncedAt: null }), NOW)
        .detail,
    ).toBe('3 changes waiting to sync. Not synced yet.');
  });

  it('asks for the account choice', () => {
    expect(summarize(view({ phase: 'needsChoice' }), NOW).status).toBe(
      'Waiting for your choice',
    );
  });
});
