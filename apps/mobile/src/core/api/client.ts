import { createApi, unwrap } from '@skkil-time/api';
import { type RemoteHost, createRemoteBackend } from '@skkil-time/remote';
import { randomUUID } from 'expo-crypto';

import { createNativeAuth } from '@/core/auth/native-auth';
import { config } from '@/core/config';

export const auth = createNativeAuth(config.auth);

export const host: RemoteHost = {
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

export const commands = createRemoteBackend(api, host);

export const deleteAccount = async () => {
  await unwrap(api.DELETE('/api/v1/me'));
  await auth.signOut();
};
