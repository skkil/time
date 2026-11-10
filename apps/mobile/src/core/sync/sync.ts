import {
  type SyncAccount,
  createSyncAccount,
  isUnauthorized,
} from '@skkil-time/client/sync';
import { createSyncDriver } from '@skkil/store-client';
import { fetch as streamingFetch } from 'expo/fetch';

import { auth } from '@/core/api/client';
import { config } from '@/core/config';
import { replica } from '@/core/local/replica';
import { onWrite } from '@/core/local/writes';
import { createSyncController } from '@/core/sync/controller';
import { refreshSoon } from '@/core/sync/refresh';
import { widgets } from '@/core/widgets/widgets';

const signOutWhenRefused =
  <T>(call: () => Promise<T>) =>
  async (): Promise<T> => {
    try {
      return await call();
    } catch (error) {
      if (isUnauthorized(error)) void auth.signOut();
      throw error;
    }
  };

const server = createSyncAccount({
  apiUrl: config.apiUrl,
  getAccessToken: auth.getToken,
});

const account: SyncAccount = {
  scope: signOutWhenRefused(server.scope),
  grant: (clientId) => signOutWhenRefused(() => server.grant(clientId))(),
  pushHeaders: server.pushHeaders,
};

/** The phone's sync: store's driver over the replica, with the signed-in account's tokens. */
export const sync = createSyncController({
  core: replica,
  account,
  createDriver: createSyncDriver,
  fetch: streamingFetch as unknown as typeof globalThis.fetch,
  onChange: () => {
    refreshSoon();
    widgets.soon();
  },
});

onWrite(() => sync.wrote());
