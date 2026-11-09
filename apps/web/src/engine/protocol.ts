import type { SyncReport } from '@skkil-time/client/types';

export type Arguments = Record<string, unknown>;

/** A failure as every backend reports it, so the app's error handling works unchanged. */
export type EngineError = { kind: string; message: string };

/** What binding the database to the signed-in account did. */
export type SignIn =
  | { kind: 'synced' }
  | { kind: 'uploading'; rows: number }
  | { kind: 'otherAccount'; bound: string };

/** store's view of the local replica. */
export type CoreStatus = {
  clientId: string;
  scopeId: string | null;
  pending: number;
  issues: number;
  cursorVersion: number;
  lastPullAt: number | null;
};

export type EngineIssue = {
  id: number;
  name: string;
  subject: string | null;
  reason: string;
  createdAt: number;
};

/** What the tab that owns the database reports about syncing. */
export type SyncState = {
  /** The sync driver is running for the bound account. */
  running: boolean;
  /** Whether the last request reached the servers; null before the first one. */
  online: boolean | null;
  pending: number;
  issues: number;
  lastSyncedAt: number | null;
  error: string | null;
  /** The servers refused the sign-in; syncing waits for a new one. */
  unauthorized: boolean;
};

/** Everything a tab can ask of the engine, wherever it runs. */
export interface EngineApi {
  mutate(name: string, args: Arguments): unknown;
  query(name: string, args: Arguments): unknown;
  status(): CoreStatus;
  issues(): EngineIssue[];
  dismissIssue(id: number): boolean;
  /** Sends a refused change again; returns the change's result. */
  retryIssue(id: number): unknown;
  bindScope(scope: string): SignIn;
  keepLocal(scope: string): number;
  startFresh(scope: string): void;
  forget(): void;
  dump(): string;
  restore(backup: string): number;
  syncHabits(): SyncReport;
  startSync(): void;
  stopSync(): void;
  syncNow(): void;
  /** The browser went online (true) or offline (false). */
  connectivity(online: boolean): void;
  syncState(): SyncState;
}

export type Method = keyof EngineApi;

export type Result<M extends Method> = Awaited<ReturnType<EngineApi[M]>>;

/** Calls that are safe to send again when the tab owning the database changed mid-call. */
export const RETRYABLE: ReadonlySet<Method> = new Set<Method>([
  'query',
  'status',
  'issues',
  'dump',
  'startSync',
  'stopSync',
  'syncNow',
  'connectivity',
  'syncState',
]);

export type EngineEvent =
  /** Rows changed: `source` is the worker whose call wrote them, null for pulls. */
  | { kind: 'changed'; tables: string[]; source: string | null }
  | { kind: 'sync'; state: SyncState };

/** What the page asks of the worker that owns it. */
export type HostApi = {
  accessToken(): Promise<string | null>;
};

export type ToWorker =
  | { type: 'init'; apiUrl: string }
  | { type: 'call'; id: number; method: Method; args: unknown[] }
  | { type: 'hostResult'; id: number; value?: unknown; error?: EngineError };

export type FromWorker =
  | { type: 'ready'; role: 'leader' | 'follower' }
  | { type: 'unavailable'; reason: string }
  | { type: 'result'; id: number; value: unknown }
  | { type: 'failure'; id: number; error: EngineError }
  | { type: 'host'; id: number; method: keyof HostApi }
  | { type: 'event'; event: EngineEvent };

/** Between the workers of every tab, over a BroadcastChannel. */
export type Relay =
  | { type: 'ping' }
  | { type: 'leader'; id: string }
  | { type: 'unavailable'; reason: string }
  | {
      type: 'request';
      from: string;
      id: number;
      method: Method;
      args: unknown[];
    }
  | {
      type: 'response';
      to: string;
      id: number;
      value?: unknown;
      error?: EngineError;
    }
  | { type: 'event'; event: EngineEvent };
