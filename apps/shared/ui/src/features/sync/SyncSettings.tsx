import { describeSignInError } from '@skkil-time/rules/sync-messages';
import { RefreshCwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SettingRow } from '@/features/settings/SettingRow';
import { AccountChoiceDialog } from '@/features/sync/AccountChoiceDialog';
import { SyncIssues } from '@/features/sync/SyncIssues';
import { SyncServerSettings } from '@/features/sync/SyncServerSettings';
import {
  useSignIn,
  useSignOut,
  useSyncIssues,
  useSyncNow,
  useSyncStatus,
} from '@/features/sync/api';
import {
  accountLabel,
  canSyncNow,
  describeStatus,
  isSignedIn,
} from '@/features/sync/view';
import { useNow } from '@/hooks/use-now';
import { cn } from '@/lib/utils';
import { platform } from '@/platform';

export function SyncSettings() {
  const { data: status } = useSyncStatus();
  const { data: issues = [] } = useSyncIssues();
  const syncNow = useSyncNow();
  const signIn = useSignIn();
  const signOut = useSignOut();
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
          description="Sign in to keep this device in step with your other devices."
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
        <p className="border-b py-3 text-xs text-amber-700 dark:text-amber-400">
          {signInError(signIn.error)}
        </p>
      )}
      <SettingRow
        label={line.label}
        description={line.detail}
        hint={status.error ?? undefined}
      >
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
      <SyncIssues issues={issues} now={now} />
      {platform().sync?.config && (
        <SyncServerSettings disabled={signedIn} error={status.error} />
      )}
      <AccountChoiceDialog
        open={status.phase === 'needsChoice'}
        account={account}
      />
    </div>
  );
}

function signInError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error)
    return describeSignInError(String(error.message));
  return 'Couldn’t sign in. Try again.';
}
