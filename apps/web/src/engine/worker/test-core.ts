import { vi } from 'vitest';
import type { CoreStatus } from '~/engine/protocol';
import type { Core } from '~/engine/worker/core';

/** A `Core` with every call mocked, bound to `scope` unless it is null. */
export function fakeCore(scope: string | null = 'scope-1') {
  const status: CoreStatus = {
    clientId: 'client-1',
    scopeId: scope,
    pending: 0,
    issues: 0,
    cursorVersion: 7,
    lastPullAt: null,
  };
  return {
    status,
    core: {
      mutate: vi.fn(() => '{"id":"t1"}'),
      query: vi.fn(() => '[]'),
      pushRequest: vi.fn(() => undefined),
      applyPushResponse: vi.fn(),
      pullRequest: vi.fn(() => new Uint8Array([1])),
      applyPullResponse: vi.fn(() => ({
        changedTables: [],
        more: false,
        reset: false,
      })),
      status: vi.fn(() => ({ ...status })),
      scope: vi.fn(() => status.scopeId ?? undefined),
      bindScope: vi.fn(() => ({ kind: 'synced' as const })),
      keepLocal: vi.fn(() => 3),
      startFresh: vi.fn(),
      forget: vi.fn(),
      issues: vi.fn(() => []),
      dismissIssue: vi.fn(() => true),
      retryIssue: vi.fn(() => '{}'),
      dump: vi.fn(() => '{"tables":[]}'),
      restore: vi.fn(() => 2),
      syncHabits: vi.fn(() => ({
        activitywatch: 'notNeeded' as const,
        hasWebData: false,
        hasWindowData: false,
        message: null,
      })),
    } satisfies Core,
  };
}
