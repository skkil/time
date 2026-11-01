import type { Engine } from '@skkil-time/local';
import type { CoreHandle } from '@skkil/store-client';

import { guard, guardAsync } from './errors';
import {
  type SyncIssue as NativeIssue,
  type SignInOutcome,
  SignInOutcome_Tags,
  type TimeCoreLike,
} from './native/generated/time_core_native';

/** What binding the device to an account did with its data. */
export type Binding =
  | { kind: 'synced' }
  | { kind: 'uploading'; rows: number }
  | { kind: 'otherAccount'; bound: string };

/** The replica's sync state; times are Unix milliseconds. */
export type SyncState = {
  clientId: string;
  scopeId: string | null;
  pending: number;
  issues: number;
  cursorVersion: bigint;
  lastPullAt: number | null;
};

/** A change the server refused. */
export type SyncIssue = {
  id: number;
  name: string;
  subject: string | null;
  reason: string;
  createdAt: number;
};

/**
 * The device's replica: `engine` for `createLocalBackend`, `handle` for
 * store's sync driver, and the account steps around them.
 */
export interface NativeCore {
  engine: Engine;
  handle: CoreHandle;
  state(): SyncState;
  bindScope(scopeId: string): Promise<Binding>;
  keepLocal(scopeId: string): Promise<number>;
  startFresh(scopeId: string): Promise<void>;
  forget(): Promise<void>;
  issues(): SyncIssue[];
  dismissIssue(id: number): boolean;
}

const toBinding = (outcome: SignInOutcome): Binding => {
  switch (outcome.tag) {
    case SignInOutcome_Tags.Synced:
      return { kind: 'synced' };
    case SignInOutcome_Tags.Uploading:
      return { kind: 'uploading', rows: Number(outcome.inner.rows) };
    case SignInOutcome_Tags.OtherAccount:
      return { kind: 'otherAccount', bound: outcome.inner.bound };
  }
};

const toIssue = (issue: NativeIssue): SyncIssue => ({
  id: Number(issue.id),
  name: issue.name,
  subject: issue.subject ?? null,
  reason: issue.reason,
  createdAt: Number(issue.createdAt),
});

const parse = (json: string): unknown => JSON.parse(json);

export function createNativeCore(core: TimeCoreLike): NativeCore {
  const state = (): SyncState => {
    const status = guard(() => core.status());
    return {
      clientId: status.clientId,
      scopeId: status.scopeId ?? null,
      pending: Number(status.pending),
      issues: Number(status.issues),
      cursorVersion: status.cursorVersion,
      lastPullAt:
        status.lastPullAt === undefined ? null : Number(status.lastPullAt),
    };
  };

  return {
    engine: {
      mutate: (name, args) =>
        guardAsync(async () =>
          parse(await core.mutate(name, JSON.stringify(args))),
        ),
      query: (name, args) =>
        guardAsync(async () =>
          parse(await core.query(name, JSON.stringify(args))),
        ),
    },
    handle: {
      pushRequest: (limit) => guard(() => core.pushRequest(limit) ?? null),
      applyPushResponse: (bytes) => guard(() => core.applyPushResponse(bytes)),
      pullRequest: (limit) => guard(() => core.pullRequest(limit)),
      applyPullResponse: (bytes) => guard(() => core.applyPullResponse(bytes)),
      status: state,
    },
    state,
    bindScope: (scopeId) =>
      guardAsync(async () => toBinding(await core.bindScope(scopeId))),
    keepLocal: (scopeId) =>
      guardAsync(async () => Number(await core.keepLocal(scopeId))),
    startFresh: (scopeId) => guardAsync(() => core.startFresh(scopeId)),
    forget: () => guardAsync(() => core.forget()),
    issues: () => guard(() => core.issues().map(toIssue)),
    dismissIssue: (id) => guard(() => core.dismissIssue(BigInt(id))),
  };
}
