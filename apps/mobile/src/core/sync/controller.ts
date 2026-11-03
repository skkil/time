import type { NativeCore, SyncIssue } from '@skkil-time/core-native';
import { type SyncAccount, syncTokens } from '@skkil-time/sync';
import type { SyncDriver, SyncDriverOptions } from '@skkil/store-client';

/** What the Sync settings and the offline notice show. */
export type SyncView = {
  phase: 'off' | 'connecting' | 'online' | 'offline' | 'needsChoice';
  pending: number;
  issues: number;
  /** Unix milliseconds of the last applied pull. */
  lastSyncedAt: number | null;
  error: string | null;
};

export type AccountChoice = 'keepLocal' | 'startFresh';

export type SyncControllerOptions = {
  core: () => Promise<NativeCore>;
  /** The signed-in account's scope, sync tokens and push headers; needs the network. */
  account: SyncAccount;
  createDriver: (options: SyncDriverOptions) => SyncDriver;
  /** Streaming fetch for the Pokes stream (`expo/fetch` on a phone). */
  fetch?: typeof globalThis.fetch;
  /** Tables whose rows changed under the UI (`*`: all of them, after an account step). */
  onChange: (tables: string[]) => void;
  /** How long a burst of local writes waits before one push. */
  pushDelayMs?: number;
};

export interface SyncController {
  view(): SyncView;
  subscribe(listener: () => void): () => void;
  /** Binds the replica to the signed-in account when needed, then syncs. */
  start(): Promise<void>;
  /** Stops syncing until the next `start`, keeping the account check. */
  pause(): Promise<void>;
  /** Stops syncing for good: the next `start` checks the account again. */
  stop(): Promise<void>;
  /** Pushes and pulls now; starts syncing first when it isn't running. */
  syncNow(): Promise<void>;
  /** A local write happened: refresh the counts and push soon. */
  wrote(): void;
  /** Settles a sign-in to an account other than the replica's. */
  choose(choice: AccountChoice): Promise<void>;
  issues(): Promise<SyncIssue[]>;
  dismissIssue(id: number): Promise<void>;
  /** Stops syncing and clears every synced row (explicit sign-out). */
  forget(): Promise<void>;
}

const EVERY_TABLE = ['*'];

const messageOf = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'message' in error)
    return String(error.message);
  return String(error);
};

/**
 * Runs store's sync driver for the phone's replica while the user is
 * signed in: checks which account the replica belongs to, fetches the
 * first sync token (which also says where to push and pull), and reports
 * a {@link SyncView}. Starting, pausing and account steps run one at a
 * time.
 */
export function createSyncController(
  options: SyncControllerOptions,
): SyncController {
  const listeners = new Set<() => void>();
  let driver: SyncDriver | null = null;
  let verified = false;
  let choice: string | null = null;
  let online = false;
  let phase: SyncView['phase'] = 'off';
  let error: string | null = null;
  let snapshot: SyncView = {
    phase,
    pending: 0,
    issues: 0,
    lastSyncedAt: null,
    error,
  };
  let queue: Promise<unknown> = Promise.resolve();
  let pushTimer: ReturnType<typeof setTimeout> | undefined;

  const serially = <T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.then(task, task);
    queue = next.catch(() => undefined);
    return next;
  };

  const publish = async () => {
    const state = (await options.core()).state();
    snapshot = {
      phase,
      pending: state.pending,
      issues: state.issues,
      lastSyncedAt: state.lastPullAt,
      error,
    };
    listeners.forEach((listener) => listener());
  };
  const settle = (next: SyncView['phase'], reason: string | null = null) => {
    phase = next;
    error = reason;
    return publish();
  };

  const verify = async (core: NativeCore) => {
    if (verified) return true;
    const scope = await options.account.scope();
    const binding = await core.bindScope(scope);
    if (binding.kind === 'otherAccount') {
      choice = scope;
      await settle('needsChoice');
      return false;
    }
    verified = true;
    if (binding.kind === 'uploading') options.onChange(EVERY_TABLE);
    return true;
  };

  const run = async (core: NativeCore) => {
    const { clientId } = core.state();
    const first = await options.account.grant(clientId);
    driver = options.createDriver({
      core: core.handle,
      storeUrl: first.storeUrl,
      pushUrl: first.pushUrl,
      getSyncToken: syncTokens(options.account, clientId, first),
      getPushHeaders: options.account.pushHeaders,
      onChange: (tables) => {
        options.onChange(tables);
        void publish();
      },
      onStatus: (status) => {
        online = status.online;
        void settle(online ? 'online' : 'offline', online ? null : error);
      },
      onError: (reason) => {
        error = messageOf(reason);
        void publish();
      },
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });
  };

  const halt = async () => {
    clearTimeout(pushTimer);
    const running = driver;
    driver = null;
    online = false;
    await running?.stop();
  };

  const start = () =>
    serially(async () => {
      if (driver || phase === 'needsChoice') return;
      await settle('connecting');
      try {
        const core = await options.core();
        if (await verify(core)) await run(core);
      } catch (reason) {
        await settle('offline', messageOf(reason));
      }
    });

  return {
    view: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    pause: () =>
      serially(async () => {
        await halt();
        if (phase !== 'needsChoice') await settle('off');
      }),
    stop: () =>
      serially(async () => {
        await halt();
        verified = false;
        choice = null;
        await settle('off');
      }),
    async syncNow() {
      if (!driver) return start();
      await driver.syncNow();
    },
    wrote() {
      void publish();
      clearTimeout(pushTimer);
      pushTimer = setTimeout(
        () => void driver?.syncNow().catch(() => undefined),
        options.pushDelayMs ?? 500,
      );
    },
    choose: (picked) =>
      serially(async () => {
        const scope = choice;
        if (!scope) return;
        const core = await options.core();
        if (picked === 'keepLocal') await core.keepLocal(scope);
        else await core.startFresh(scope);
        choice = null;
        verified = true;
        phase = 'off';
        options.onChange(EVERY_TABLE);
      }).then(start),
    issues: async () => (await options.core()).issues(),
    async dismissIssue(id) {
      (await options.core()).dismissIssue(id);
      await publish();
    },
    forget: () =>
      serially(async () => {
        await halt();
        verified = false;
        choice = null;
        await (await options.core()).forget();
        options.onChange(EVERY_TABLE);
        await settle('off');
      }),
  };
}
