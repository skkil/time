import { createApi, unwrap } from '@skkil-time/api';
import { createWebAuth } from '@skkil-time/auth/web';
import { createRemoteBackend } from '@skkil-time/remote';
import { createRoot } from 'react-dom/client';
import { SignIn } from '~/SignIn';
import { config } from '~/config';
import { webPlatform } from '~/platform';

import type { Backend } from '@/backend';
import { mount } from '@/mount';
import '@/styles/globals.css';

const auth = createWebAuth(config.auth);

function showSignIn(error?: string) {
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

  const api = createApi({
    baseUrl: config.apiUrl,
    getToken: auth.getToken,
    onUnauthorized: () => void auth.signIn(),
  });
  mount({
    backend: createRemoteBackend(api) as Backend,
    platform: webPlatform(auth, session, async () => {
      await unwrap(api.DELETE('/api/v1/me'));
    }),
  });
}

void start();
