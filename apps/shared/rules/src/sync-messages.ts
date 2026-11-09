/**
 * Why sync stopped, in the user's terms:
 * - `offline`: the server couldn't be reached (no network, server down, DNS);
 * - `signedOut`: the sign-in expired or was refused;
 * - `refused`: the server reached a decision and said no (another account's device, a conflict);
 * - `server`: the server failed while answering.
 */
export type SyncProblem = 'offline' | 'signedOut' | 'refused' | 'server';

export const SYNC_PROBLEM_COPY: Record<
  SyncProblem,
  { title: string; detail: string }
> = {
  offline: {
    title: 'Can’t reach the server',
    detail: 'Your changes are kept on this device and sync when it’s back.',
  },
  signedOut: {
    title: 'Sign in again to keep syncing',
    detail: 'Your changes are kept on this device until you do.',
  },
  refused: {
    title: 'The server turned this device away',
    detail: 'Your changes are kept on this device. Signing in again may help.',
  },
  server: {
    title: 'The server ran into a problem',
    detail: 'Your changes are kept on this device. Sync tries again soon.',
  },
};

const PATTERNS: [SyncProblem, RegExp][] = [
  [
    'signedOut',
    /unauthori[sz]ed|unauthenticated|\b401\b|sign-in expired|sign in again|invalid_grant|refresh token/i,
  ],
  ['server', /\b5\d\d\b|internal error|server error|bad gateway/i],
  [
    'offline',
    /connection (?:refused|reset|closed|failed)|os error|transport|\bio:|dns|resolve|timed out|timeout|network|failed to fetch|fetch failed|load failed|unreachable|offline/i,
  ],
  [
    'refused',
    /\b40[39]\b|forbidden|conflict|another account|refused|rejected|permission/i,
  ],
];

/** Sorts a raw sync or sign-in error (from Rust, store's driver or fetch) into a {@link SyncProblem}. */
export function syncProblem(error: string): SyncProblem {
  return PATTERNS.find(([, pattern]) => pattern.test(error))?.[0] ?? 'server';
}

/** The calm, one-line message for a raw sync error, or null when there is none. */
export function describeSyncError(error: string | null | undefined) {
  if (!error?.trim()) return null;
  return SYNC_PROBLEM_COPY[syncProblem(error)];
}

/** The first-sign-in upload: every row this device had, as one change. */
export const UPLOAD_CHANGE = 'importLocal';

export const isUpload = (issue: { name: string }) =>
  issue.name === UPLOAD_CHANGE;

/** Asked before dismissing a refused upload, which drops the rows it carried. */
export const DISMISS_UPLOAD = {
  title: 'Remove the data that couldn’t upload?',
  message:
    'The server didn’t accept what this device had before you signed in. Dismissing removes that data from this device for good. Try again sends it once more.',
  confirm: 'Remove from this device',
  cancel: 'Keep it',
};

/** The calm message for a failed sign-in. */
export function describeSignInError(error: string) {
  if (/^sign-in timed out/i.test(error.trim()))
    return 'Sign-in timed out. Try again.';
  switch (syncProblem(error)) {
    case 'offline':
      return 'Couldn’t reach the sign-in server. Check your connection and try again.';
    case 'signedOut':
    case 'refused':
      return 'The sign-in was turned down. Try again.';
    case 'server':
      return 'Couldn’t sign in. Try again.';
  }
}
