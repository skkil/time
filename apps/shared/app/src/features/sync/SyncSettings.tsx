import { RefreshCwIcon, XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SettingRow } from '@/features/settings/SettingRow';
import { AccountChoiceDialog } from '@/features/sync/AccountChoiceDialog';
import { SyncServerSettings } from '@/features/sync/SyncServerSettings';
import {
  useDismissIssue,
  useSignIn,
  useSignOut,
  useSyncIssues,
  useSyncNow,
  useSyncStatus,
} from '@/features/sync/api';
import {
  accountLabel,
  ago,
  canSyncNow,
  describeIssue,
  describeStatus,
  isSignedIn,
} from '@/features/sync/view';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';

const TONES = {
  calm: 'text-muted-foreground',
  busy: 'text-muted-foreground',
  warn: 'text-amber-700 dark:text-amber-400',
};

export function SyncSettings() {
  const { data: status } = useSyncStatus();
  const { data: issues = [] } = useSyncIssues();
  const syncNow = useSyncNow();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const dismiss = useDismissIssue();
  const now = useNow(30_000) * 1000;
  if (!status) return null;

  const signedIn = isSignedIn(status);
  const line = describeStatus(status, now);
  const account = accountLabel(status);

  return (
    <div>
      {signedIn ? (
        <SettingRow
          label={account}
          description={
            status.account?.name && status.account.email
              ? status.account.email
              : undefined
          }
        >
          <div className="flex gap-2">
            {status.phase === 'needsSignIn' && (
              <Button
                size="sm"
                disabled={signIn.isPending}
                onClick={() => signIn.mutate()}
              >
                Sign in again
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={signOut.isPending}
              onClick={() => signOut.mutate()}
            >
              Sign out
            </Button>
          </div>
        </SettingRow>
      ) : (
        <SettingRow
          label="Account"
          description="Sign in to keep this computer, the web app and your phone in step."
        >
          <Button
            size="sm"
            disabled={status.phase === 'signingIn'}
            onClick={() => signIn.mutate()}
          >
            {status.phase === 'signingIn' ? 'Signing in…' : 'Sign in'}
          </Button>
        </SettingRow>
      )}
      {signIn.isError && (
        <p className="border-b py-3 text-xs text-destructive">
          {signInError(signIn.error)}
        </p>
      )}
      <SettingRow label={line.label} description={line.detail}>
        {signedIn && (
          <Button
            variant="outline"
            size="sm"
            disabled={!canSyncNow(status) || syncNow.isPending}
            onClick={() => syncNow.mutate()}
          >
            <RefreshCwIcon
              className={cn(status.phase === 'syncing' && 'animate-spin')}
            />
            Sync now
          </Button>
        )}
      </SettingRow>
      {status.error && line.tone === 'warn' && (
        <p className={cn('border-b py-2 text-xs', TONES.warn)}>
          {status.error}
        </p>
      )}
      {issues.length > 0 && (
        <section className="border-b py-3">
          <h3 className="text-sm font-medium">Couldn’t apply</h3>
          <p className="text-xs text-muted-foreground">
            The server refused these changes, so they were undone here.
          </p>
          <ul className="mt-2 grid gap-1.5">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className="flex items-start justify-between gap-3 rounded-md bg-muted/50 px-3 py-2"
              >
                <div className="grid gap-0.5">
                  <span className="text-sm">{describeIssue(issue)}</span>
                  <span className="text-xs text-muted-foreground">
                    {issue.reason} · {ago(issue.createdAt, now)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Dismiss"
                  disabled={dismiss.isPending}
                  onClick={() => dismiss.mutate(issue.id)}
                >
                  <XIcon />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SyncServerSettings disabled={signedIn} />
      <AccountChoiceDialog
        open={status.phase === 'needsChoice'}
        account={account}
      />
    </div>
  );
}

function signInError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error)
    return String(error.message);
  return 'Couldn’t sign in. Try again.';
}
