import { describe, expect, it } from 'vitest';

import type { SyncStatus } from '@/platform';

import {
  accountLabel,
  ago,
  canSyncNow,
  changeName,
  describeIssue,
  describeStatus,
  isSignedIn,
} from './view';

const NOW = 1_800_000_000_000;

const status = (changes: Partial<SyncStatus> = {}): SyncStatus => ({
  phase: 'idle',
  account: { name: 'Ada', email: 'ada@example.com' },
  pending: 0,
  lastSyncedAt: NOW - 30_000,
  issues: 0,
  error: null,
  ...changes,
});

describe('ago', () => {
  it('rounds to the largest unit', () => {
    expect(ago(NOW - 10_000, NOW)).toBe('just now');
    expect(ago(NOW - 5 * 60_000, NOW)).toBe('5 min ago');
    expect(ago(NOW - 3 * 3_600_000, NOW)).toBe('3 h ago');
    expect(ago(NOW - 26 * 3_600_000, NOW)).toBe('yesterday');
    expect(ago(NOW - 72 * 3_600_000, NOW)).toBe('3 days ago');
    expect(ago(NOW + 5_000, NOW)).toBe('just now');
  });
});

describe('describeStatus', () => {
  it('says when it last synced', () => {
    expect(describeStatus(status(), NOW)).toEqual({
      label: 'Synced just now',
      detail: undefined,
      tone: 'calm',
    });
    expect(describeStatus(status({ lastSyncedAt: null }), NOW).label).toBe(
      'Synced',
    );
  });

  it('counts waiting changes', () => {
    expect(describeStatus(status({ pending: 1 }), NOW).detail).toBe(
      '1 change waiting to sync',
    );
    expect(
      describeStatus(status({ phase: 'syncing', pending: 3 }), NOW),
    ).toEqual({
      label: 'Syncing…',
      detail: '3 changes waiting to sync',
      tone: 'busy',
    });
  });

  it('warns when offline or signed out of the account', () => {
    const offline = describeStatus(
      status({ phase: 'offline', pending: 2 }),
      NOW,
    );
    expect(offline.tone).toBe('warn');
    expect(offline.label).toBe('Can’t reach the server');
    expect(offline.detail).toBe('2 changes waiting to sync, retrying soon');
    expect(describeStatus(status({ phase: 'needsSignIn' }), NOW).label).toBe(
      'Sign in again to keep syncing',
    );
  });

  it('names why sync stopped without the technical detail', () => {
    const refused = describeStatus(
      status({
        phase: 'offline',
        error: 'transport: io: Connection refused (os error 111)',
      }),
      NOW,
    );
    expect(refused.label).toBe('Can’t reach the server');
    expect(refused.detail).not.toMatch(/os error/);
    expect(
      describeStatus(
        status({ phase: 'offline', error: 'HTTP 503 unavailable' }),
        NOW,
      ).label,
    ).toBe('The server ran into a problem');
  });

  it('reassures a desktop that never signed in', () => {
    const line = describeStatus(
      status({ phase: 'signedOut', account: null }),
      NOW,
    );
    expect(line.label).toBe('Not syncing');
    expect(line.tone).toBe('calm');
  });
});

describe('actions', () => {
  it('offers Sync now only when a cycle can start', () => {
    expect(canSyncNow(status())).toBe(true);
    expect(canSyncNow(status({ phase: 'offline' }))).toBe(true);
    expect(canSyncNow(status({ phase: 'syncing' }))).toBe(false);
    expect(canSyncNow(status({ phase: 'signedOut' }))).toBe(false);
  });

  it('treats every phase after sign-in as signed in', () => {
    expect(isSignedIn(status({ phase: 'needsSignIn' }))).toBe(true);
    expect(isSignedIn(status({ phase: 'signingIn' }))).toBe(false);
  });

  it('names the account', () => {
    expect(accountLabel(status())).toBe('Ada');
    expect(
      accountLabel(status({ account: { name: null, email: 'a@b.c' } })),
    ).toBe('a@b.c');
    expect(accountLabel(status({ account: null }))).toBe('Signed in');
  });
});

describe('issues', () => {
  it('reads a refused change as a sentence', () => {
    expect(changeName('setTaskCompleted')).toBe('Set task completed');
    expect(
      describeIssue({
        id: 1,
        name: 'updateTask',
        subject: 'Call Ada',
        reason: 'gone',
        createdAt: 0,
      }),
    ).toBe('Update task: Call Ada');
    expect(
      describeIssue({
        id: 2,
        name: 'deleteAllData',
        subject: null,
        reason: 'x',
        createdAt: 0,
      }),
    ).toBe('Delete all data');
    expect(
      describeIssue({
        id: 3,
        name: 'importLocal',
        subject: null,
        reason: 'x',
        createdAt: 0,
      }),
    ).toBe('Your data from before you signed in');
  });
});
