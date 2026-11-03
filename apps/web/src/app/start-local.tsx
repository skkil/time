import { createApi, unwrap } from '@skkil-time/api';
import type { Session } from '@skkil-time/auth';
import type { WebAuth } from '@skkil-time/auth/web';
import { createLocalBackend } from '@skkil-time/local';
import { createSyncAccount } from '@skkil-time/sync';
import { config } from '~/app/config';
import { type StartedEngine, localEngine } from '~/engine/start';
import { setUpWebPush } from '~/notifications/web-push';
import { webDeviceCommands } from '~/platform/device-commands';
import { createLiveUpdates } from '~/platform/live-updates';
import { localChanges } from '~/platform/local-changes';
import { signOutLocal } from '~/platform/local-sign-out';
import { accountPreferences } from '~/platform/shared-preferences';
import { webPlatform } from '~/platform/web-platform';
import { createWebSync } from '~/platform/web-sync';

import { forgetAccountPreferences } from '@/lib/preferences';
import { mount } from '@/mount';

const PUSH_SETUP_MS = 3_000;

const withinTime = <T,>(work: Promise<T>, ms: number, fallback: T) =>
  Promise.race([
    work,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);

/**
 * Offline-first: the UI runs on the engine worker's replica, the worker that owns the database syncs it
 * with the servers, and the server is asked directly only for what isn't synced (preferences, push
 * reminders, deleting the account).
 */
export async function startLocal(
  auth: WebAuth,
  engine: StartedEngine,
  session: Session | null,
  profile: Session,
) {
  const clientId = crypto.randomUUID();
  const api = createApi({
    baseUrl: config.apiUrl,
    getToken: auth.getToken,
    clientId,
  });
  const finishSignOut = async () => {
    forgetAccountPreferences();
    await auth.signOut();
  };
  const signOut = () => signOutLocal(engine, finishSignOut);
  const web = createWebSync({
    engine,
    account: createSyncAccount({
      apiUrl: config.apiUrl,
      getAccessToken: auth.getToken,
    }),
    session,
    profile,
    signIn: () => void auth.signIn(),
    signOut,
  });
  const serverChanges = session
    ? createLiveUpdates({
        api,
        baseUrl: config.apiUrl,
        clientId,
        onStatus: () => undefined,
      })
    : undefined;
  const notifications = await withinTime(
    setUpWebPush(api),
    PUSH_SETUP_MS,
    null,
  );

  mount({
    backend: createLocalBackend(localEngine(engine), webDeviceCommands(engine)),
    platform: webPlatform({
      profile,
      signIn: () => void auth.signIn(),
      signOut,
      deleteAccount: async () => {
        await unwrap(api.DELETE('/api/v1/me'));
        await engine.call('forget');
        await finishSignOut();
      },
      preferences: accountPreferences(api),
      notifications,
      onConnectionChange: web.onConnectionChange,
      onRemoteChange: localChanges(engine, serverChanges),
      sync: web.sync,
    }),
  });
  await web.bind();
}
