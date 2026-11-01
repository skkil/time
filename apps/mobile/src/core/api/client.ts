import { createApi } from '@skkil-time/api';

import { createNativeAuth } from '@/core/auth/native-auth';
import { config } from '@/core/config';

export const auth = createNativeAuth(config.auth);

/** The server, for what only it does: sync tokens, account and push devices. */
export const api = createApi({
  baseUrl: config.apiUrl,
  getToken: auth.getToken,
  onUnauthorized: () => void auth.signOut(),
});
