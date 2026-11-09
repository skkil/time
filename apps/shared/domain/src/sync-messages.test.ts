import {
  describeSignInError,
  describeSyncError,
  isUpload,
  syncProblem,
} from '#sync-messages';
import { describe, expect, it } from 'vitest';

describe('syncProblem', () => {
  it.each([
    ['transport: io: Connection refused (os error 111)', 'offline'],
    ['TypeError: Failed to fetch', 'offline'],
    ['error sending request: dns error: failed to lookup address', 'offline'],
    ['The sign-in expired. Sign in again.', 'signedOut'],
    ['rpc unauthenticated: token expired', 'signedOut'],
    ['HTTP 401 ', 'signedOut'],
    ['Couldn’t reach the server: HTTP 502 Bad Gateway', 'server'],
    ['HTTP 500 boom', 'server'],
    ['This device belongs to another account.', 'refused'],
    ['HTTP 409 conflict', 'refused'],
    ['something odd', 'server'],
  ] as const)('%s → %s', (error, problem) => {
    expect(syncProblem(error)).toBe(problem);
  });
});

describe('describeSyncError', () => {
  it('keeps the technical detail out of the copy', () => {
    const copy = describeSyncError(
      'transport: io: Connection refused (os error 111)',
    );
    expect(copy?.title).toBe('Can’t reach the server');
    expect(copy?.detail).not.toMatch(/os error|transport/);
  });

  it('has nothing to say without an error', () => {
    expect(describeSyncError(null)).toBeNull();
    expect(describeSyncError('  ')).toBeNull();
  });
});

describe('describeSignInError', () => {
  it('turns failures into plain sentences', () => {
    expect(describeSignInError('Discovery: Connection refused')).toMatch(
      /Couldn’t reach the sign-in server/,
    );
    expect(describeSignInError('Sign-in timed out. Try again.')).toBe(
      'Sign-in timed out. Try again.',
    );
    expect(describeSignInError('Sign-in was refused: access_denied')).toBe(
      'The sign-in was turned down. Try again.',
    );
  });
});

it('knows the first-sign-in upload', () => {
  expect(isUpload({ name: 'importLocal' })).toBe(true);
  expect(isUpload({ name: 'createTask' })).toBe(false);
});
