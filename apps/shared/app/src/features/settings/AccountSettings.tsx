import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { platform } from '@/platform';

import { SettingRow } from './SettingRow';

const CONFIRM = 'delete';

export function AccountSettings() {
  const account = platform().account;
  const [typed, setTyped] = useState('');
  const remove = useMutation({
    mutationFn: () => account!.deleteAccount(),
  });
  if (!account) return null;

  return (
    <div>
      <SettingRow label="Signed in as" description={account.label}>
        <Button variant="outline" size="sm" onClick={account.signOut}>
          Sign out
        </Button>
      </SettingRow>
      <SettingRow
        label="Delete account"
        description="Removes your account and every project, task, focus session, habit and review in it. This can’t be undone."
      >
        <AlertDialog onOpenChange={() => setTyped('')}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Delete account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                Your account and all of its data are removed for good. Export a
                backup first if you may want them. Type “{CONFIRM}” to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              aria-label={`Type ${CONFIRM} to confirm`}
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
            {remove.isError && (
              <p className="text-sm text-destructive">
                Couldn’t delete the account. Nothing was changed.
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my account</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={
                  typed.trim().toLowerCase() !== CONFIRM || remove.isPending
                }
                onClick={() => remove.mutate()}
              >
                Delete account
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingRow>
    </div>
  );
}
