import { createApi, unwrap } from '@skkil-time/api';
import type { commands as contract } from '@skkil-time/contract';
import { createRemoteBackend } from '@skkil-time/remote';

import { createNativeAuth } from '@/auth';
import { config } from '@/config';

export type Backend = typeof contract;

export const auth = createNativeAuth(config.auth);

export const api = createApi({
  baseUrl: config.apiUrl,
  getToken: auth.getToken,
  onUnauthorized: () => void auth.signOut(),
});

export const commands = createRemoteBackend(api) as Backend;

export const deleteAccount = async () => {
  await unwrap(api.DELETE('/api/v1/me'));
  await auth.signOut();
};
