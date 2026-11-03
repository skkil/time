import type { Session } from '@skkil-time/auth';
import { type SyncAccount, isUnauthorized } from '@skkil-time/sync';
import type { EngineClient } from '~/engine/client';
import type { SyncState } from '~/engine/protocol';

import type {
  AccountChoice,
  ConnectionStatus,
  Sync,
  SyncPhase,
  SyncStatus,
} from '@/platform';

export type WebSyncOptions = {
  engine: EngineClient;
  account: SyncAccount;
  /** The signed-in session, or null when its tokens ran out (the app still opens on this device's data). */
  session: Session | null;
  /** Who last signed in on this browser. */
  profile: Session;
  signIn(): void;
  signOut(): Promise<void>;
  online?: () => boolean;
};

const IDLE: SyncState = {
  running: false,
  online: null,
  pending: 0,
  issues: 0,
  lastSyncedAt: null,
  error: null,
  unauthorized: false,
};

/**
 * `Platform.sync` for the browser: binds the engine to the signed-in account (asking first when it holds
 * another account's data), starts the sync driver in the worker that owns the database, and turns what that
 * worker reports into the status Settings → Sync shows.
 */
export function createWebSync({
  engine,
  account,
  session,
  profile,
  signIn,
  signOut,
  online = () => navigator.onLine,
}: WebSyncOptions) {
  const listeners = new Set<(status: SyncStatus) => void>();
  let state = IDLE;
  let choice: string | null = null;
  let signedIn = session !== null;
  let bindError: string | null = null;

  const phase = (): SyncPhase => {
    if (choice) return 'needsChoice';
    if (!signedIn || state.unauthorized) return 'needsSignIn';
    if (!state.running) return bindError ? 'offline' : 'syncing';
    if (state.online === null) return 'syncing';
    return state.online ? 'idle' : 'offline';
  };

  const status = (): SyncStatus => ({
    phase: phase(),
    account: { name: profile.name, email: profile.email },
    pending: state.pending,
    lastSyncedAt: state.lastSyncedAt,
    issues: state.issues,
    error: state.error ?? bindError,
  });

  const publish = () => {
    const current = status();
    listeners.forEach((listener) => listener(current));
  };

  engine.onEvent((event) => {
    if (event.kind !== 'sync') return;
    state = event.state;
    publish();
  });

  const startSync = async () => {
    await engine.call('startSync');
    state = await engine.call('syncState');
    publish();
  };

  /** Binds the engine to the signed-in account and starts syncing; offline, a bound engine syncs once it can. */
  const bind = async () => {
    if (!signedIn) return;
    let scope: string;
    try {
      scope = await account.scope();
    } catch (error) {
      if (isUnauthorized(error)) signedIn = false;
      else bindError = error instanceof Error ? error.message : String(error);
      const { scopeId } = await engine.call('status');
      if (scopeId && signedIn) await startSync();
      return publish();
    }
    bindError = null;
    const result = await engine.call('bindScope', scope);
    if (result.kind === 'otherAccount') {
      choice = scope;
      return publish();
    }
    await startSync();
  };

  const sync: Sync = {
    status: async () => {
      state = await engine.call('syncState');
      return status();
    },
    onStatus(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    syncNow: () => engine.call('syncNow'),
    issues: () => engine.call('issues'),
    dismissIssue: async (id) => {
      await engine.call('dismissIssue', id);
    },
    signIn: async () => signIn(),
    signOut,
    async chooseAccountData(picked: AccountChoice) {
      const scope = choice;
      if (!scope) throw new Error('Nothing is waiting for a choice.');
      if (picked === 'keepLocal') await engine.call('keepLocal', scope);
      else await engine.call('startFresh', scope);
      choice = null;
      await startSync();
    },
  };

  const onConnectionChange = (listener: (status: ConnectionStatus) => void) => {
    const report = () => {
      if (phase() === 'needsSignIn') return listener('signedOut');
      listener(online() ? 'online' : 'offline');
    };
    const unsubscribe = sync.onStatus(report);
    window.addEventListener('online', report);
    window.addEventListener('offline', report);
    report();
    return () => {
      unsubscribe();
      window.removeEventListener('online', report);
      window.removeEventListener('offline', report);
    };
  };

  window.addEventListener('online', () => {
    void engine.call('connectivity', true);
    if (bindError) void bind();
  });
  window.addEventListener('offline', () => {
    void engine.call('connectivity', false);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void engine.call('syncNow');
  });

  return { sync, bind, onConnectionChange };
}
