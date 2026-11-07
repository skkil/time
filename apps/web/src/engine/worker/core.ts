import type { SyncReport } from '@skkil-time/contract';
import type { CoreHandle, PullApplied } from '@skkil/store-client';
import type { CoreStatus, EngineIssue, SignIn } from '~/engine/protocol';

/** The calls the worker makes on `TimeCore` from `@skkil-time/core-wasm`; tests pass a fake. */
export interface Core {
  mutate(name: string, args: string): string;
  query(name: string, args: string): string;
  pushRequest(limit: number): Uint8Array | undefined;
  applyPushResponse(bytes: Uint8Array): unknown;
  pullRequest(limit: number): Uint8Array;
  applyPullResponse(bytes: Uint8Array): PullApplied;
  status(): CoreStatus;
  scope(): string | undefined;
  bindScope(scope: string): SignIn;
  keepLocal(scope: string): number;
  startFresh(scope: string): void;
  forget(): void;
  issues(): EngineIssue[];
  dismissIssue(id: number): boolean;
  retryIssue(id: number): string;
  dump(): string;
  restore(backup: string): number;
  syncHabits(): SyncReport;
}

/** The core as store's driver expects it: `null` for an empty push and the cursor as a bigint. */
export function coreHandle(core: Core): CoreHandle {
  return {
    pushRequest: (limit) => core.pushRequest(limit) ?? null,
    applyPushResponse: (bytes) => void core.applyPushResponse(bytes),
    pullRequest: (limit) => core.pullRequest(limit),
    applyPullResponse: (bytes) => core.applyPullResponse(bytes),
    status: () => {
      const { clientId, pending, issues, cursorVersion } = core.status();
      return {
        clientId,
        pending,
        issues,
        cursorVersion: BigInt(cursorVersion),
      };
    },
  };
}
