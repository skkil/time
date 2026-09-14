import { format } from 'date-fns';
import { PlusIcon, SettingsIcon } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

import type { Project } from '@/bindings';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTimeEntries } from '@/features/time/api';
import { useProjectTypeTime } from '@/features/workflow/use-workspace';
import {
  formatDuration,
  formatHours,
  fromDateKey,
  fromSeconds,
  mondayOf,
  nowSeconds,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { ProjectDot } from './ProjectDot';
import { useProjectIndex } from './api';
import { useProjectGroup } from './groups';
import { STATUSES, descendantIds, projectChain } from './tree';

const WEEK_SECONDS = 7 * 24 * 3600;

export type ViewOption = { id: string; label: string };

export function ProjectHeader({
  project,
  openCount,
  views,
  view,
  onView,
  onAddTask,
  onSettings,
  viewActions,
}: {
  project?: Project;
  openCount: number;
  views: ViewOption[];
  view: string;
  onView: (id: string) => void;
  onAddTask: () => void;
  onSettings: () => void;
  viewActions?: ReactNode;
}) {
  const index = useProjectIndex();
  const group = useProjectGroup(project?.id);
  const status = STATUSES.find((option) => option.value === project?.status);
  const trail = [
    group?.name,
    ...(project?.parentId != null
      ? projectChain(index, project.parentId).map((node) => node.name)
      : []),
  ].filter(Boolean);

  const details: ReactNode[] = [
    `${openCount} open ${openCount === 1 ? 'task' : 'tasks'}`,
    project?.archived && 'Archived',
    project && project.status !== 'active' && status?.label,
    project?.targetDate &&
      `Target ${format(fromDateKey(project.targetDate), 'd MMM yyyy')}`,
    project && <WeekHours key="hours" project={project} />,
  ].filter(Boolean);

  return (
    <header className="w-full shrink-0 px-10 pt-4">
      {trail.length > 0 && (
        <p className="mb-1 text-sm text-foreground/50">{trail.join(' / ')}</p>
      )}
      <div className="flex items-center gap-3">
        <h1 className="flex min-w-0 flex-1 items-center gap-2.5 text-3xl leading-tight font-light tracking-tight">
          {project && <ProjectDot color={project.color} className="size-3" />}
          <span className="truncate">{project?.name ?? 'Inbox'}</span>
        </h1>
        {!project?.archived && (
          <Button onClick={onAddTask}>
            <PlusIcon />
            Add task
          </Button>
        )}
        {project && (
          <Button variant="outline" onClick={onSettings}>
            <SettingsIcon />
            Settings
          </Button>
        )}
      </div>
      {project?.outcome && (
        <p className="mt-2 max-w-3xl text-[15px] text-foreground/80">
          <span className="text-foreground/50">Goal: </span>
          {project.outcome}
        </p>
      )}
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-foreground/55">
        {details.map((detail, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>·</span>}
            {detail}
          </span>
        ))}
      </p>

      <div className="mt-5 flex min-h-9 items-end gap-6 border-b border-white/10">
        {views.length > 1 && (
          <nav role="tablist" aria-label="Views" className="flex gap-5">
            {views.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={option.id === view}
                onClick={() => onView(option.id)}
                className={cn(
                  '-mb-px border-b-2 pb-2.5 text-sm transition-colors outline-none focus-visible:text-foreground',
                  option.id === view
                    ? 'border-foreground font-medium text-foreground'
                    : 'border-transparent text-foreground/55 hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </nav>
        )}
        {viewActions && (
          <div className="ml-auto flex items-center gap-1 pb-1.5">
            {viewActions}
          </div>
        )}
      </div>
    </header>
  );
}

function WeekHours({ project }: { project: Project }) {
  const index = useProjectIndex();
  const monday = mondayOf(todayKey());
  const { data: entries } = useTimeEntries(monday, shiftKey(monday, 6));
  const byType = useProjectTypeTime(project.id);

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
  if (tracked === 0 && budget === null) return null;

  const nextReview =
    project.lastReviewedAt === null
      ? null
      : project.lastReviewedAt + project.reviewEveryWeeks * WEEK_SECONDS;
  const details = [
    ...byType.map(([name, seconds]) => `${name}: ${formatHours(seconds)} h`),
    nextReview === null
      ? 'Not reviewed yet'
      : `Next review ${format(fromSeconds(nextReview), 'd MMM')}`,
  ];
  const over = budget !== null && tracked > budget;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            'rounded-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-white/50',
            over && 'text-attention',
          )}
        >
          {formatDuration(tracked)}
          {budget !== null && ` of ${formatDuration(budget)}`} tracked this week
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {details.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
