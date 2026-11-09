import {
  SYNC_PROBLEM_COPY,
  describeSyncError,
  isUpload,
} from '@skkil-time/rules/sync-messages';

import type { SyncIssue, SyncStatus } from '@/platform';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function ago(at: number, now: number) {
  const elapsed = Math.max(0, now - at);
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  const days = Math.floor(elapsed / DAY);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

const changes = (count: number) =>
  count === 1 ? '1 change' : `${count} changes`;

export type StatusLine = {
  label: string;
  detail?: string;
  tone: 'calm' | 'busy' | 'warn';
};

/** The one-line summary under "Status". */
export function describeStatus(status: SyncStatus, now: number): StatusLine {
  const waiting =
    status.pending > 0
      ? `${changes(status.pending)} waiting to sync`
      : undefined;
  const last =
    status.lastSyncedAt === null
      ? undefined
      : `Last synced ${ago(status.lastSyncedAt, now)}`;
  switch (status.phase) {
    case 'signedOut':
      return {
        label: 'Not syncing',
        detail: 'Everything stays on this device until you sign in.',
        tone: 'calm',
      };
    case 'signingIn':
      return {
        label: 'Waiting for the browser…',
        detail: 'Finish signing in there.',
        tone: 'busy',
      };
    case 'syncing':
      return { label: 'Syncing…', detail: waiting ?? last, tone: 'busy' };
    case 'idle':
      return {
        label: last ? last.replace('Last synced', 'Synced') : 'Synced',
        detail: waiting,
        tone: 'calm',
      };
    case 'offline': {
      const problem =
        describeSyncError(status.error) ?? SYNC_PROBLEM_COPY.offline;
      return {
        label: problem.title,
        detail: waiting ? `${waiting}, retrying soon` : problem.detail,
        tone: 'warn',
      };
    }
    case 'needsSignIn':
      return {
        label: 'Sign in again to keep syncing',
        detail: waiting ?? 'Your changes are kept on this device.',
        tone: 'warn',
      };
    case 'needsChoice':
      return {
        label: 'Choose what to do with this device’s data',
        tone: 'warn',
      };
  }
}

export const isSignedIn = (status: SyncStatus) =>
  status.phase !== 'signedOut' && status.phase !== 'signingIn';

export const canSyncNow = (status: SyncStatus) =>
  status.phase === 'idle' || status.phase === 'offline';

/** `updateTask` → `Update task`. */
export function changeName(name: string) {
  const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function describeIssue(issue: SyncIssue) {
  if (isUpload(issue)) return 'Your data from before you signed in';
  const title = changeName(issue.name);
  return issue.subject ? `${title}: ${issue.subject}` : title;
}

export function accountLabel(status: SyncStatus) {
  return status.account?.name ?? status.account?.email ?? 'Signed in';
}
