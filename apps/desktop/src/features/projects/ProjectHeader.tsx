import { format } from 'date-fns';
import { EllipsisIcon } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

import type { Project } from '@/bindings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useProjectOrganization } from './organizations';
import { STATUSES, descendantIds, projectPath } from './tree';

const WEEK_SECONDS = 7 * 24 * 3600;

export type ViewOption = { id: string; label: string };

export function ProjectHeader({
  project,
  openCount,
  views,
  view,
  onView,
  onSettings,
  menu,
}: {
  project?: Project;
  openCount: number;
  views: ViewOption[];
  view: string;
  onView: (id: string) => void;
  onSettings: () => void;
  menu: ReactNode;
}) {
  const index = useProjectIndex();
  const organization = useProjectOrganization(project?.id);
  const status = STATUSES.find((option) => option.value === project?.status);

  return (
    <header className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-3 px-8 pt-4 pb-2">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 truncate text-3xl leading-tight font-light tracking-tight">
          {project && <ProjectDot color={project.color} className="size-2.5" />}
          {project?.name ?? 'Inbox'}
        </h1>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-foreground/55">
          {organization && <span>{organization.name}</span>}
          {project?.parentId != null && (
            <span>In {projectPath(index, project.parentId)}</span>
          )}
          <span>
            <span className="text-foreground">{openCount}</span> open
          </span>
          {project?.archived && <span>Archived</span>}
          {project && project.status !== 'active' && (
            <span>{status?.label}</span>
          )}
          {project?.targetDate && (
            <span>
              Target {format(fromDateKey(project.targetDate), 'd MMM')}
            </span>
          )}
          {project && <WeekHours project={project} />}
        </p>
        {project?.outcome && (
          <button
            type="button"
            onClick={onSettings}
            className="mt-3 max-w-2xl text-left text-[15px] text-foreground/75 outline-none hover:text-foreground focus-visible:underline"
          >
            <span className="text-foreground/45">Done when </span>
            {project.outcome}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {views.length > 1 && (
          <div
            role="tablist"
            aria-label="Views"
            className="flex rounded-full bg-white/[.07] p-1 backdrop-blur-md"
          >
            {views.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={option.id === view}
                onClick={() => onView(option.id)}
                className={cn(
                  'h-7 rounded-full px-3 text-[13px] tracking-wide transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                  option.id === view
                    ? 'bg-white/[.14] text-foreground'
                    : 'text-foreground/55 hover:text-foreground/85',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={project ? 'Project options' : 'Inbox options'}
              className="grid size-9 place-items-center rounded-full text-foreground/70 transition-colors outline-none hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <EllipsisIcon className="size-[18px]" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            {menu}
          </DropdownMenuContent>
        </DropdownMenu>
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
    ...byType.map(([name, seconds]) => `${name} ${formatHours(seconds)} h`),
    nextReview === null
      ? 'Not looked at yet'
      : `Next look ${format(fromSeconds(nextReview), 'd MMM')}`,
  ];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            'rounded-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-white/50',
            budget !== null && tracked > budget && 'text-attention',
          )}
        >
          <span
            className={cn(
              budget !== null && tracked > budget
                ? 'text-attention'
                : 'text-foreground',
            )}
          >
            {formatDuration(tracked)}
          </span>
          {budget !== null && ` of ${formatDuration(budget)}`} this week
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
