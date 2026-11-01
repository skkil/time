import { createSyncDriver } from '@skkil/store-client';
import { randomUUID } from 'expo-crypto';
import { fetch as streamingFetch } from 'expo/fetch';

import { api, auth } from '@/core/api/client';
import { replica } from '@/core/local/replica';
import { onWrite } from '@/core/local/writes';
import { createSyncController } from '@/core/sync/controller';
import { fetchGrant } from '@/core/sync/grant';
import { refreshSoon } from '@/core/sync/refresh';
import { accountScope } from '@/core/sync/scope';

/** The phone's sync: store's driver over the replica, with the signed-in account's tokens. */
export const sync = createSyncController({
  core: replica,
  scope: () => accountScope(api, randomUUID),
  grant: (clientId) => fetchGrant(api, clientId),
  pushHeaders: async (): Promise<Record<string, string>> => {
    const token = await auth.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
  createDriver: createSyncDriver,
  fetch: streamingFetch as unknown as typeof globalThis.fetch,
  onChange: refreshSoon,
});

onWrite(() => sync.wrote());
