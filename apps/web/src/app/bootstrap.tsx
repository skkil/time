import { createWebAuth } from '@skkil-time/auth/web';
import { createRoot } from 'react-dom/client';
import { config } from '~/app/config';
import { startLocal } from '~/app/start-local';
import { startRemote } from '~/app/start-remote';
import { SignInPage } from '~/auth/SignInPage';
import { EngineUnavailable } from '~/engine/client';
import { startEngine } from '~/engine/start';

import { syncColorScheme } from '@/hooks/use-color-scheme';
import { claimPreferences } from '@/lib/preferences';

const auth = createWebAuth(config.auth);

function showSignIn(error?: string) {
  syncColorScheme();
  createRoot(document.getElementById('root') as HTMLElement).render(
    <SignInPage onSignIn={() => void auth.signIn()} error={error} />,
  );
}

/**
 * Finishes any sign-in redirect, then opens the app on this browser's offline database. Whoever signed in
 * last can open it even offline or with expired tokens; syncing waits for a new sign-in. Browsers that
 * can't keep the database fall back to the online-only server backend.
 */
export async function bootstrap() {
  let error: string | undefined;
  try {
    await auth.completeSignIn();
  } catch {
    error = 'Sign-in didn’t finish. Try again.';
  }
  const session = await auth.session();
  const profile = session ?? (await auth.lastSession());
  if (!profile) return showSignIn(error);
  claimPreferences(profile.subject);

  const engine = startEngine(config.apiUrl, { accessToken: auth.getToken });
  try {
    await engine.ready;
  } catch (failure) {
    engine.stop();
    if (!(failure instanceof EngineUnavailable)) throw failure;
    if (!session) return showSignIn(failure.message);
    return startRemote(auth, session, failure.message);
  }
  await startLocal(auth, engine, session, profile);
}
