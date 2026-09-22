import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';

import type { Id } from '@/bindings';
import { EntryHistory } from '@/features/time/EntryHistory';
import { useTaskEntries } from '@/features/time/api';
import { sessionCount, totalSeconds } from '@/features/time/entries';
import { formatDuration } from '@/lib/time';
import { cn } from '@/lib/utils';

export function TaskFocus({ taskId }: { taskId: Id }) {
  const { data: entries = [] } = useTaskEntries(taskId);
  const [open, setOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <section aria-label="Focus" className="grid min-w-0 gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-w-0 items-center gap-2 rounded-sm text-left text-[15px] leading-relaxed text-foreground/75 transition-colors outline-none hover:text-foreground/70 focus-visible:text-foreground/70"
      >
        <ChevronRightIcon
          className={cn(
            'size-3.5 shrink-0 transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="shrink-0">Focus</span>
        <span className="min-w-0 truncate text-foreground/75">
          {formatDuration(totalSeconds(entries))} ·{' '}
          {sessionCount(entries.length)}
        </span>
      </button>
      {open && (
        <div className="pl-5.5">
          <EntryHistory entries={entries} currentTaskId={taskId} />
        </div>
      )}
    </section>
  );
}
