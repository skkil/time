import { createApi, unwrap } from '@skkil-time/api';
import { createWebAuth } from '@skkil-time/auth/web';
import { createRemoteBackend } from '@skkil-time/remote';
import { createRoot } from 'react-dom/client';
import { config } from '~/app/config';
import { SignInPage } from '~/auth/SignInPage';
import { setUpWebPush } from '~/notifications/web-push';
import { createConnection } from '~/platform/connection';
import { webHost } from '~/platform/host';
import { createLiveUpdates } from '~/platform/live-updates';
import { accountPreferences } from '~/platform/shared-preferences';
import { webPlatform } from '~/platform/web-platform';

import { syncColorScheme } from '@/hooks/use-color-scheme';
import { claimPreferences } from '@/lib/preferences';
import { mount } from '@/mount';

const auth = createWebAuth(config.auth);

function showSignIn(error?: string) {
  syncColorScheme();
  createRoot(document.getElementById('root') as HTMLElement).render(
    <SignInPage onSignIn={() => void auth.signIn()} error={error} />,
  );
}

/** Finishes any sign-in redirect, then shows the sign-in page or the app. */
export async function bootstrap() {
  let error: string | undefined;
  try {
    await auth.completeSignIn();
  } catch {
    error = 'Sign-in didn’t finish. Try again.';
  }
  const session = await auth.session();
  if (!session) return showSignIn(error);
  claimPreferences(session.subject);

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

  mount({
    backend: createRemoteBackend(api, host),
    platform: webPlatform(auth, session, {
      deleteAccount: async () => {
        await unwrap(api.DELETE('/api/v1/me'));
      },
      preferences: accountPreferences(api),
      notifications,
      onConnectionChange: connection.subscribe,
      onRemoteChange,
    }),
  });
}
