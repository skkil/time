import {
  type SyncAccount,
  type SyncGrant,
  isUnauthorized,
  syncTokens,
} from '@skkil-time/sync';
import {
  type SyncDriver,
  type SyncDriverOptions,
  createSyncDriver,
  noopLock,
} from '@skkil/store-client';
import type { SyncState } from '~/engine/protocol';
import { type Core, coreHandle } from '~/engine/worker/core';

export type SyncRunnerOptions = {
  core: Core;
  account: SyncAccount;
  report(state: SyncState): void;
  onChange(tables: string[]): void;
  createDriver?: (options: SyncDriverOptions) => SyncDriver;
  /** Wait after a local write so a burst syncs as one cycle. */
  writeDelayMs?: number;
  retry?: { baseMs: number; maxMs: number };
};

const UNAUTHENTICATED = 16;

const refused = (error: unknown) =>
  isUnauthorized(error) ||
  (typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === UNAUTHENTICATED);

const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Runs store's sync driver for the bound account in the worker that owns the database. The servers'
 * addresses come with the first sync token, so until one arrives it retries with backoff; leadership is
 * already this worker's, so the driver takes no lock of its own.
 */
export class SyncRunner {
  private driver: SyncDriver | null = null;
  private connecting: AbortController | null = null;
  private wake: (() => void) | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | undefined;
  private online: boolean | null = null;
  private error: string | null = null;
  private unauthorized = false;
  private reported = '';

  constructor(private readonly options: SyncRunnerOptions) {}

  start() {
    if (this.driver || this.connecting || !this.options.core.scope()) return;
    this.unauthorized = false;
    const controller = new AbortController();
    this.connecting = controller;
    void this.connect(controller.signal);
  }

  async stop() {
    this.connecting?.abort();
    this.connecting = null;
    this.wake?.();
    clearTimeout(this.writeTimer);
    const driver = this.driver;
    this.driver = null;
    this.online = null;
    await driver?.stop();
    this.report();
  }

  /** Syncs right away, or retries connecting at once. */
  now() {
    if (this.driver) return void this.driver.syncNow().catch(() => undefined);
    if (this.connecting) return void this.wake?.();
    this.start();
  }

  /** A local write: report the new pending count and sync shortly. */
  wrote() {
    this.report();
    clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(
      () => this.now(),
      this.options.writeDelayMs ?? 1_000,
    );
  }

  /** The browser's network changed. Back online, a driver that lost the servers starts over so its poke stream reconnects now. */
  async connectivity(online: boolean) {
    if (!online) {
      this.online = false;
      return this.report();
    }
    if (this.driver && this.online === false) {
      await this.stop();
      return this.start();
    }
    this.now();
  }

  state(): SyncState {
    const status = this.options.core.status();
    return {
      running: this.driver !== null,
      online: this.online,
      pending: status.pending,
      issues: status.issues,
      lastSyncedAt: status.lastPullAt,
      error: this.error,
      unauthorized: this.unauthorized,
    };
  }

  report() {
    const state = this.state();
    const key = JSON.stringify(state);
    if (key === this.reported) return;
    this.reported = key;
    this.options.report(state);
  }

  private async connect(signal: AbortSignal) {
    const {
      core,
      account,
      retry = { baseMs: 1_000, maxMs: 60_000 },
    } = this.options;
    const clientId = core.status().clientId;
    for (let failures = 0; !signal.aborted; failures++) {
      try {
        const grant = await account.grant(clientId);
        if (signal.aborted) return;
        this.connecting = null;
        this.driver = this.drive(grant, clientId);
        return this.report();
      } catch (error) {
        if (signal.aborted) return;
        this.fail(error);
        if (this.unauthorized) {
          this.connecting = null;
          return;
        }
        await this.pause(
          Math.min(retry.maxMs, retry.baseMs * 2 ** failures),
          signal,
        );
      }
    }
  }

  private drive(grant: SyncGrant, clientId: string) {
    const {
      core,
      account,
      onChange,
      createDriver = createSyncDriver,
    } = this.options;
    return createDriver({
      core: coreHandle(core),
      storeUrl: grant.storeUrl,
      pushUrl: grant.pushUrl,
      getSyncToken: syncTokens(account, clientId, grant),
      getPushHeaders: () => account.pushHeaders(),
      onChange,
      onStatus: ({ online }) => {
        this.online = online;
        if (online) {
          this.error = null;
          this.unauthorized = false;
        }
        this.report();
      },
      onError: (error) => this.fail(error),
      lock: noopLock(),
    });
  }

  private fail(error: unknown) {
    this.error = describe(error);
    if (refused(error)) this.unauthorized = true;
    else this.online = false;
    this.report();
  }

  private pause(ms: number, signal: AbortSignal) {
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.wake = null;
        signal.removeEventListener('abort', done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      this.wake = done;
      signal.addEventListener('abort', done);
    });
  }
}
