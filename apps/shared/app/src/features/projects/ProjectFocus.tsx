import type { Id } from '@/backend';
import { EmptyState, PageBody } from '@/components/page';
import { EntryHistory } from '@/features/time/EntryHistory';
import { useProjectEntries } from '@/features/time/api';
import { sessionCount, totalSeconds } from '@/features/time/entries';
import { formatDuration } from '@/lib/time';

export function ProjectFocus({ projectId }: { projectId: Id }) {
  const { data: entries, isPending } = useProjectEntries(projectId);

  if (isPending) return null;
  if (!entries || entries.length === 0)
    return (
      <PageBody className="px-4 sm:px-10">
        <EmptyState title="No focus time yet.">
          Sessions on this project and its tasks show up here.
        </EmptyState>
      </PageBody>
    );

  return (
    <PageBody className="px-4 sm:px-10">
      <p className="mb-5 text-sm text-foreground/75">
        {formatDuration(totalSeconds(entries))} · {sessionCount(entries.length)}
      </p>
      <div className="max-w-2xl">
        <EntryHistory entries={entries} />
      </div>
    </PageBody>
  );
}
