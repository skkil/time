import { type ReactNode, useMemo } from 'react';

import type { Project, Task } from '@/backend';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TaskLink } from '@/features/tasks/TaskLink';
import { formatDate } from '@/features/tasks/meta';
import { useTimeEntries } from '@/features/time/api';
import { useWorkflow } from '@/features/workflow/api';
import { useProjectTypeTime } from '@/features/workflow/type-time';
import {
  formatDay,
  formatDuration,
  fromSeconds,
  mondayOf,
  nowSeconds,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { useProjectIndex } from './api';
import { useProjectCanvas } from './canvas';
import { comingUp, noteLines } from './context';
import { descendantIds } from './tree';

const WEEK_SECONDS = 7 * 24 * 3600;

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="text-xs text-foreground/70">{title}</h2>
      <div className="mt-2 text-sm">{children}</div>
    </section>
  );
}

function ComingUp({ project, own }: { project: Project; own: Task[] }) {
  const { data: workflow } = useWorkflow();
  const today = todayKey();
  const milestones = (workflow?.milestones ?? []).filter(
    (milestone) => milestone.projectId === project.id,
  );
  const items = comingUp(own, milestones, project, today);
  if (items.length === 0) return null;

  return (
    <Block title="Coming up">
      <ul className="grid gap-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className="grid grid-cols-[76px_minmax(0,1fr)] gap-2"
          >
            <span className="truncate text-foreground/70 tabular-nums">
              {formatDate(item.date, today)}
            </span>
            <span className="flex min-w-0 gap-1.5">
              {item.taskId === undefined ? (
                <span className="truncate">{item.label}</span>
              ) : (
                <TaskLink taskId={item.taskId} className="truncate">
                  {item.label}
                </TaskLink>
              )}
              {item.note && (
                <span className="shrink-0 text-foreground/75">{item.note}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Block>
  );
}

function ThisWeek({
  project,
  onOpenFocus,
}: {
  project: Project;
  onOpenFocus: () => void;
}) {
  const index = useProjectIndex();
  const monday = mondayOf(todayKey());
  const { data: entries } = useTimeEntries(monday, shiftKey(monday, 7));
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
  const nextReview =
    project.lastReviewedAt === null
      ? null
      : project.lastReviewedAt + project.reviewEveryWeeks * WEEK_SECONDS;
  const details = [
    ...byType.map(([name, seconds]) => `${name}: ${formatDuration(seconds)}`),
    nextReview === null
      ? 'Not reviewed yet'
      : `Next review ${formatDay(fromSeconds(nextReview), 'dayMonth')}`,
  ];

  return (
    <Block title="This week">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Open focus history"
            onClick={onOpenFocus}
            className={cn(
              'rounded-sm tabular-nums underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-white/50',
              budget !== null && tracked > budget && 'text-attention',
            )}
          >
            {formatDuration(tracked)}
            {budget !== null && ` of ${formatDuration(budget)}`}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {details.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </TooltipContent>
      </Tooltip>
    </Block>
  );
}

function Notes({
  project,
  onOpenNotes,
}: {
  project: Project;
  onOpenNotes: () => void;
}) {
  const { data: canvas } = useProjectCanvas(project.id);
  const lines = noteLines(canvas?.content ?? '');

  if (lines.length === 0)
    return (
      <button
        type="button"
        onClick={onOpenNotes}
        className="justify-self-start rounded-sm text-sm text-foreground/70 underline-offset-2 outline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
      >
        Write notes
      </button>
    );

  return (
    <Block title="Notes">
      <button
        type="button"
        aria-label="Open notes"
        onClick={onOpenNotes}
        className="grid gap-1 rounded-sm text-left text-foreground/80 outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {lines.map((line, position) => (
          <span key={position} className="line-clamp-2 break-words">
            {line}
          </span>
        ))}
      </button>
    </Block>
  );
}

export function ProjectContext({
  project,
  own,
  onOpenNotes,
  onOpenFocus,
}: {
  project: Project;
  own: Task[];
  onOpenNotes: () => void;
  onOpenFocus: () => void;
}) {
  return (
    <aside
      aria-label="About this project"
      className="hidden w-80 shrink-0 overflow-y-auto pt-4 pr-10 pb-5 pl-6 @3xl:block"
    >
      <div className="grid gap-7">
        <ComingUp project={project} own={own} />
        <ThisWeek project={project} onOpenFocus={onOpenFocus} />
        <Notes project={project} onOpenNotes={onOpenNotes} />
      </div>
    </aside>
  );
}
