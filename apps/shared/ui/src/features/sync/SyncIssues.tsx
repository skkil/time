import { DISMISS_UPLOAD, isUpload } from '@skkil-time/rules/sync-messages';
import { RotateCcwIcon, XIcon } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useDismissIssue, useRetryIssue } from '@/features/sync/api';
import { ago, describeIssue } from '@/features/sync/view';
import type { SyncIssue } from '@/platform';

/** The changes the server refused, each with Try again and Dismiss. */
export function SyncIssues({
  issues,
  now,
}: {
  issues: SyncIssue[];
  now: number;
}) {
  const dismiss = useDismissIssue();
  const retry = useRetryIssue();
  const [confirming, setConfirming] = useState<SyncIssue | null>(null);
  if (issues.length === 0) return null;

  const busy = dismiss.isPending || retry.isPending;
  const onDismiss = (issue: SyncIssue) =>
    isUpload(issue) ? setConfirming(issue) : dismiss.mutate(issue.id);

  return (
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
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => retry.mutate(issue.id)}
              >
                <RotateCcwIcon />
                Try again
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss"
                disabled={busy}
                onClick={() => onDismiss(issue)}
              >
                <XIcon />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {retry.isError && (
        <p className="mt-2 text-xs text-muted-foreground">
          {retryError(retry.error)}
        </p>
      )}
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{DISMISS_UPLOAD.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {DISMISS_UPLOAD.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{DISMISS_UPLOAD.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => confirming && dismiss.mutate(confirming.id)}
            >
              {DISMISS_UPLOAD.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function retryError(error: unknown) {
  const reason =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : '';
  return reason
    ? `Still couldn’t apply it here: ${reason}`
    : 'Still couldn’t apply it here. It stays in the list.';
}
