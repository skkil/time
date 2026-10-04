import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';

import { commands } from '@/backend';
import {
  AlertDialog,
  AlertDialogAction,
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
import { useImportTasks } from '@/features/import/api';
import { platform } from '@/platform';

import { SettingRow } from './SettingRow';

const CONFIRM = 'delete';

function reopen() {
  window.location.replace('#/');
  window.location.reload();
}

export function DataSettings() {
  const local = platform().features.databaseFile;
  const where = local ? 'on this computer' : 'in your account';
  const [typed, setTyped] = useState('');
  const importTasks = useImportTasks();
  const backup = useMutation({
    mutationFn: () => commands.exportData(),
    onSuccess: (path) => {
      if (path)
        toast.success(
          local ? `Backup saved to ${path}` : `Backup downloaded as ${path}`,
        );
    },
  });
  const restore = useMutation({
    mutationFn: () => commands.importData(),
    onSuccess: (restored) => {
      if (restored) reopen();
    },
  });
  const wipe = useMutation({
    mutationFn: () => commands.deleteAllData(),
    onSuccess: () => {
      localStorage.clear();
      reopen();
    },
  });

  return (
    <div>
      <SettingRow
        label="Import tasks"
        description="Todoist exports (one CSV per project) or any CSV with a Title column. Each file becomes a new project."
      >
        <Button
          variant="outline"
          size="sm"
          disabled={importTasks.isPending}
          onClick={() => importTasks.mutate()}
        >
          Import…
        </Button>
      </SettingRow>
      <SettingRow
        label="Export a backup"
        description={`${local ? 'Saves' : 'Downloads'} all projects, tasks, time, habits and reviews ${local ? 'to a file you choose' : 'as a file'}.`}
      >
        <Button
          variant="outline"
          size="sm"
          disabled={backup.isPending}
          onClick={() => backup.mutate()}
        >
          Export
        </Button>
      </SettingRow>
      <SettingRow
        label="Restore from a backup"
        description={`Replaces the data ${where} with a backup file.`}
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={restore.isPending}>
              Restore
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore from a backup?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything here is replaced by the file you pick.
                {local &&
                  ' A copy of the current data is saved as time-before-restore.db in the app’s data folder first.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my data</AlertDialogCancel>
              <AlertDialogAction onClick={() => restore.mutate()}>
                Choose a file
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingRow>
      <SettingRow
        label="Delete all data"
        description={`Projects, tasks, time, habits, reviews and settings ${where}. Export a backup first if you may want them back.`}
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
                Every project, task, focus session, habit and review is removed,
                and settings go back to their defaults. Only a backup you
                exported can bring them back. Type “{CONFIRM}” to confirm.
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
