import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { commands } from '@/bindings';
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

import { SettingRow } from './SettingRow';

const CONFIRM = 'delete';

export function DataSettings() {
  const [typed, setTyped] = useState('');
  const wipe = useMutation({
    mutationFn: () => commands.deleteAllData(),
    onSuccess: () => {
      localStorage.clear();
      window.location.replace('#/');
      window.location.reload();
    },
  });

  return (
    <div>
      <SettingRow
        label="Delete all data"
        description="Projects, tasks, time, habits, reviews and settings on this computer. This can’t be undone."
      >
        <AlertDialog onOpenChange={() => setTyped('')}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              Delete all data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete everything?</AlertDialogTitle>
              <AlertDialogDescription>
                Every project, task, tracked hour, habit and review is removed,
                and settings go back to their defaults. There is no backup. Type
                “{CONFIRM}” to confirm.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              aria-label={`Type ${CONFIRM} to confirm`}
              autoFocus
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
            {wipe.isError && (
              <p className="text-sm text-destructive">
                Couldn’t delete the data. Nothing was changed.
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my data</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={
                  typed.trim().toLowerCase() !== CONFIRM || wipe.isPending
                }
                onClick={() => wipe.mutate()}
              >
                Delete all data
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingRow>
    </div>
  );
}
