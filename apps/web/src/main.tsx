import { createApi, unwrap } from '@skkil-time/api';
import { connectRealtime } from '@skkil-time/api/realtime';
import { createWebAuth } from '@skkil-time/auth/web';
import { createRemoteBackend } from '@skkil-time/remote';
import { createRoot } from 'react-dom/client';
import { SignIn } from '~/SignIn';
import { config } from '~/config';
import { createConnection } from '~/connection';
import { webHost } from '~/host';
import { setUpWebPush } from '~/notifications';
import { webPlatform } from '~/platform';

import { syncColorScheme } from '@/hooks/use-color-scheme';
import { mount } from '@/mount';
import type { RemoteChange } from '@/platform';
import '@/styles/globals.css';

const auth = createWebAuth(config.auth);

function showSignIn(error?: string) {
  syncColorScheme();
  createRoot(document.getElementById('root') as HTMLElement).render(
    <SignIn onSignIn={() => void auth.signIn()} error={error} />,
  );
}

async function start() {
  let error: string | undefined;
  try {
    await auth.completeSignIn();
  } catch {
    error = 'Sign-in didn’t finish. Try again.';
  }
  const session = await auth.session();
  if (!session) return showSignIn(error);

  const host = webHost();
  const connection = createConnection();
  const api = createApi({
    baseUrl: config.apiUrl,
    getToken: auth.getToken,
    clientId: host.clientId,
    onUnauthorized: connection.signedOut,
  });
  const listeners = new Set<(change: RemoteChange) => void>();
  const realtime = connectRealtime({
    api,
    baseUrl: config.apiUrl,
    clientId: host.clientId,
    onChange: ({ topic }) =>
      listeners.forEach((listener) => listener({ topic })),
    onReconnect: () =>
      listeners.forEach((listener) => listener({ topic: 'reconnect' })),
    onStatus: connection.realtime,
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) realtime.resume();
  });
  window.addEventListener('online', () => realtime.resume());

  const notifications = await setUpWebPush(api);
  mount({
    backend: createRemoteBackend(api, host),
    platform: webPlatform(auth, session, {
      deleteAccount: async () => {
        await unwrap(api.DELETE('/api/v1/me'));
      },
      preferences: {
        load: async () => unwrap(api.GET('/api/v1/preferences')),
        save: async (changes) => {
          await unwrap(api.PATCH('/api/v1/preferences', { body: changes }));
        },
      },
      notifications,
      onConnectionChange: connection.subscribe,
      onRemoteChange: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
  });
}

void start();
