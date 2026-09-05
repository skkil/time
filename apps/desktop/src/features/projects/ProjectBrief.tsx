import { format } from 'date-fns';
import { useMemo } from 'react';

import type { Project } from '@/bindings';
import { useTimeEntries } from '@/features/time/api';
import {
  formatDuration,
  fromDateKey,
  fromSeconds,
  mondayOf,
  nowSeconds,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { useProjectIndex } from './api';
import { STATUSES, descendantIds } from './tree';

const WEEK_SECONDS = 7 * 24 * 3600;

export function ProjectBrief({
  project,
  onEdit,
}: {
  project: Project;
  onEdit: () => void;
}) {
  const index = useProjectIndex();
  const monday = mondayOf(todayKey());
  const { data: entries } = useTimeEntries(monday, shiftKey(monday, 6));
  const finite = project.kind === 'project';

  const tracked = useMemo(() => {
    const node = index.byId.get(project.id);
    const ids = node ? descendantIds(node) : new Set([project.id]);
    const now = nowSeconds();
    return (entries ?? [])
      .filter((entry) => entry.projectId !== null && ids.has(entry.projectId))
      .reduce(
        (sum, entry) => sum + (Math.min(entry.endedAt, now) - entry.startedAt),
        0,
      );
  }, [entries, index, project.id]);

  const budget =
    project.weeklyMinutes !== null ? project.weeklyMinutes * 60 : null;
  const nextReview =
    project.lastReviewedAt === null
      ? null
      : project.lastReviewedAt + project.reviewEveryWeeks * WEEK_SECONDS;
  const status = STATUSES.find((option) => option.value === project.status);

  return (
    <button
      type="button"
      onClick={onEdit}
      className="mx-auto grid w-full max-w-3xl gap-3 rounded-lg border bg-card px-4 py-3 text-left outline-none hover:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {finite ? 'Project' : 'Area'}
        </span>
        {project.status !== 'active' && <span>{status?.label}</span>}
        {finite && project.targetDate && (
          <span>Target {format(fromDateKey(project.targetDate), 'd MMM')}</span>
        )}
        <span>
          {nextReview === null
            ? 'Not looked at yet'
            : `Next look ${format(fromSeconds(nextReview), 'd MMM')}`}
        </span>
      </div>
      {project.outcome ? (
        <p className="text-sm">
          <span className="text-muted-foreground">
            {finite ? 'Done when ' : 'Standard '}
          </span>
          {project.outcome}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {finite
            ? 'Add what “done” means, so you’ll know when to stop.'
            : 'Add the standard you want to keep here.'}
        </p>
      )}
      <div className="grid gap-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>This week</span>
          <span className="tabular-nums">
            {formatDuration(tracked)}
            {budget !== null && ` of ${formatDuration(budget)}`}
          </span>
        </div>
        {budget !== null && budget > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full',
                tracked > budget ? 'bg-attention' : 'bg-primary',
              )}
              style={{ width: `${Math.min(100, (tracked / budget) * 100)}%` }}
            />
          </div>
        )}
      </div>
    </button>
  );
}
