import { useMemo, useState } from 'react';

import type { Id, TrackedEntry } from '@/backend';
import { TaskLink } from '@/features/tasks/TaskLink';
import { formatClockTime, formatDayLabel, formatDuration } from '@/lib/time';
import { cn } from '@/lib/utils';

import { EntryDialog } from './EntryDialog';
import { entriesByDay, entrySeconds, totalSeconds } from './entries';

function EntrySubject({
  entry,
  currentTaskId,
}: {
  entry: TrackedEntry;
  currentTaskId?: Id;
}) {
  const note = entry.description !== entry.taskTitle && entry.description;
  const showTask =
    entry.taskId !== null &&
    entry.taskId !== currentTaskId &&
    entry.taskTitle !== null;

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {showTask && (
        <TaskLink
          taskId={entry.taskId ?? ''}
          className={cn(
            'truncate',
            entry.taskCompleted && 'text-foreground/75 line-through',
          )}
        >
          {entry.taskTitle}
        </TaskLink>
      )}
      {note && <span className="truncate text-foreground/75">{note}</span>}
    </span>
  );
}

export function EntryHistory({
  entries,
  currentTaskId,
}: {
  entries: TrackedEntry[];
  currentTaskId?: Id;
}) {
  const [editing, setEditing] = useState<TrackedEntry>();
  const days = useMemo(() => entriesByDay(entries), [entries]);

  return (
    <div className="grid gap-5">
      {days.map(([day, list]) => (
        <section key={day} aria-label={formatDayLabel(day)}>
          <h3 className="flex justify-between text-xs text-foreground/75">
            {formatDayLabel(day)}
            <span className="tabular-nums">
              {formatDuration(totalSeconds(list))}
            </span>
          </h3>
          <ul className="mt-1">
            {list.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-4 py-1 text-sm"
              >
                <button
                  type="button"
                  aria-label={`Edit entry from ${formatClockTime(entry.startedAt)}`}
                  onClick={() => setEditing(entry)}
                  className="flex shrink-0 gap-4 rounded-sm text-left text-foreground/75 tabular-nums outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="w-28">
                    {formatClockTime(entry.startedAt)} –{' '}
                    {formatClockTime(entry.endedAt)}
                  </span>
                  <span className="w-16">
                    {formatDuration(entrySeconds(entry))}
                  </span>
                </button>
                <EntrySubject entry={entry} currentTaskId={currentTaskId} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <EntryDialog
        key={editing?.id}
        open={editing !== undefined}
        onOpenChange={(next) => !next && setEditing(undefined)}
        entry={editing}
      />
    </div>
  );
}
