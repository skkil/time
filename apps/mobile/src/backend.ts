import { createApi, unwrap } from '@skkil-time/api';
import type { commands as contract } from '@skkil-time/contract';
import { type RemoteHost, createRemoteBackend } from '@skkil-time/remote';
import { randomUUID } from 'expo-crypto';

import { createNativeAuth } from '@/auth';
import { config } from '@/config';

export type Backend = typeof contract;

export const auth = createNativeAuth(config.auth);

const host: RemoteHost = {
  clientId: randomUUID(),
  saveFile: async () => null,
  openFile: async () => null,
  pickImportFiles: async () => [],
};

export const api = createApi({
  baseUrl: config.apiUrl,
  getToken: auth.getToken,
  clientId: host.clientId,
  onUnauthorized: () => void auth.signOut(),
});

export const commands = createRemoteBackend(api, host) as Backend;

export const deleteAccount = async () => {
  await unwrap(api.DELETE('/api/v1/me'));
  await auth.signOut();
};
