import { createApi, unwrap } from '@skkil-time/api';
import type { Session } from '@skkil-time/auth';
import type { WebAuth } from '@skkil-time/auth/web';
import { createRemoteBackend } from '@skkil-time/remote';
import { toast } from 'sonner';
import { config } from '~/app/config';
import { setUpWebPush } from '~/notifications/web-push';
import { createConnection } from '~/platform/connection';
import { webHost } from '~/platform/host';
import { createLiveUpdates } from '~/platform/live-updates';
import { accountPreferences } from '~/platform/shared-preferences';
import { webPlatform } from '~/platform/web-platform';

import { forgetAccountPreferences } from '@/lib/preferences';
import { mount } from '@/mount';

/**
 * Online only, for browsers that can't keep data offline (no OPFS sync access handles): every command goes
 * to the server and other devices' writes arrive over the realtime socket.
 */
export async function startRemote(
  auth: WebAuth,
  session: Session,
  reason: string,
) {
  const host = webHost();
  const connection = createConnection();
  const api = createApi({
    baseUrl: config.apiUrl,
    getToken: auth.getToken,
    clientId: host.clientId,
    onUnauthorized: connection.signedOut,
  });
  const onRemoteChange = createLiveUpdates({
    api,
    baseUrl: config.apiUrl,
    clientId: host.clientId,
    onStatus: connection.realtime,
  });
  const notifications = await setUpWebPush(api);
  const signOut = async () => {
    forgetAccountPreferences();
    await auth.signOut();
  };

  mount({
    backend: createRemoteBackend(api, host),
    platform: webPlatform({
      profile: session,
      signIn: () => void auth.signIn(),
      signOut,
      deleteAccount: async () => {
        await unwrap(api.DELETE('/api/v1/me'));
        await signOut();
      },
      preferences: accountPreferences(api),
      notifications,
      onConnectionChange: connection.subscribe,
      onRemoteChange,
    }),
  });
  toast.info(`${reason} Changes save only while you’re online.`, {
    duration: 10_000,
  });
}
