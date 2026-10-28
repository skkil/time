import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useChooseAccountData, useSignOut } from '@/features/sync/api';

/**
 * Shown when this computer signs in to an account other than the one its
 * data came from: nothing merges until the user picks.
 */
export function AccountChoiceDialog({
  open,
  account,
}: {
  open: boolean;
  account: string;
}) {
  const choose = useChooseAccountData();
  const signOut = useSignOut();
  const busy = choose.isPending || signOut.isPending;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            This computer has another account’s data
          </AlertDialogTitle>
          <AlertDialogDescription>
            It last synced with a different account than {account}. Choose what
            happens to the projects and tasks on this computer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {choose.isError && (
          <p className="text-sm text-destructive">
            Couldn’t switch accounts. Nothing was changed.
          </p>
        )}
        <AlertDialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => signOut.mutate()}
          >
            Cancel
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => choose.mutate('startFresh')}
            >
              Start fresh
            </Button>
            <Button disabled={busy} onClick={() => choose.mutate('keepLocal')}>
              Upload this computer’s data
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
