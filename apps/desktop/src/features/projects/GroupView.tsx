import { Link, useNavigate } from '@tanstack/react-router';
import { differenceInCalendarDays, format } from 'date-fns';
import { FoldersIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import type { Id, Milestone, Task, TimeEntry } from '@/bindings';
import { Button } from '@/components/ui/button';
import { useTasks } from '@/features/tasks/api';
import { useTimeEntries } from '@/features/time/api';
import { useWorkflow } from '@/features/workflow/api';
import {
  formatDuration,
  fromDateKey,
  mondayOf,
  nowSeconds,
  shiftKey,
  todayKey,
} from '@/lib/time';
import { cn } from '@/lib/utils';

import { NewProjectDialog } from './NewProjectDialog';
import { ProjectDot } from './ProjectDot';
import { Timeline, TimelineLegend, type TimelineRow } from './Timeline';
import { useProjectIndex } from './api';
import { useGroups, useRenameGroup } from './groups';
import { projectMarks, taskMarks } from './timeline-rows';
import { type ProjectNode, STATUSES, descendantIds } from './tree';

type Summary = {
  node: ProjectNode;
  done: number;
  open: number;
  overdue: number;
  nextDue: string | null;
  nextDeadline: Task | null;
  tracked: number;
};

const isInactive = (node: ProjectNode) =>
  node.archived || node.status !== 'active';

function summarize(
  node: ProjectNode,
  tasks: Task[],
  entries: TimeEntry[],
  today: string,
  now: number,
): Summary {
  const ids = descendantIds(node);
  const own = tasks.filter(
    (task) =>
      task.kind === 'task' &&
      task.projectId !== null &&
      ids.has(task.projectId),
  );
  const open = own.filter((task) => task.completedAt === null);
  const counted = open.filter((task) => task.statusCategory !== 'backlog');
  const dueDates = counted
    .flatMap((task) => (task.dueDate ? [task.dueDate] : []))
    .sort();
  const deadlines = counted
    .filter((task) => task.deadline !== null && task.deadline >= today)
    .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string));
  const late = (date: string | null) => date !== null && date < today;
  return {
    node,
    done: own.length - open.length,
    open: open.length,
    overdue: counted.filter((task) => late(task.dueDate) || late(task.deadline))
      .length,
    nextDue: dueDates.find((date) => date >= today) ?? null,
    nextDeadline: deadlines[0] ?? null,
    tracked: entries
      .filter((entry) => entry.projectId !== null && ids.has(entry.projectId))
      .reduce(
        (sum, entry) => sum + (Math.min(entry.endedAt, now) - entry.startedAt),
        0,
      ),
  };
}

export function GroupView({ groupId }: { groupId: Id }) {
  const groups = useGroups();
  const index = useProjectIndex();
  const { data: tasks } = useTasks();
  const today = todayKey();
  const monday = mondayOf(today);
  const { data: entries } = useTimeEntries(monday, shiftKey(monday, 6));
  const { data: workflow } = useWorkflow();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const group = groups.byId.get(groupId);

  const summaries = useMemo(() => {
    const now = nowSeconds();
    return index.roots
      .filter((node) => node.groupId === groupId)
      .map((node) => summarize(node, tasks ?? [], entries ?? [], today, now));
  }, [index, groupId, tasks, entries, today]);

  if (!group)
    return (
      <p className="px-10 pt-6 text-sm text-foreground/55">
        This group no longer exists.
      </p>
    );

  const active = summaries.filter(({ node }) => !isInactive(node));
  const inactive = summaries.filter(({ node }) => isInactive(node));
  const total = (pick: (summary: Summary) => number) =>
    active.reduce((sum, summary) => sum + pick(summary), 0);
  const open = total((summary) => summary.open);
  const overdue = total((summary) => summary.overdue);
  const tracked = total((summary) => summary.tracked);

  const rows = timelineRows(
    active.map(({ node }) => node),
    tasks ?? [],
    workflow?.milestones ?? [],
    today,
    (projectId) =>
      navigate({ to: '/projects/$projectId', params: { projectId } }),
  );

  const details = [
    `${active.length} active ${active.length === 1 ? 'project' : 'projects'}`,
    `${open} open ${open === 1 ? 'task' : 'tasks'}`,
    overdue > 0 && `${overdue} overdue`,
    tracked > 0 && `${formatDuration(tracked)} tracked this week`,
  ].filter(Boolean);

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-10">
      <header className="w-full shrink-0 px-10 pt-4">
        <p className="mb-1 text-sm text-foreground/50">Group</p>
        <GroupTitle
          groupId={group.id}
          name={group.name}
          onAddProject={() => setCreating(true)}
        />
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-foreground/55">
          {details.map((detail, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>·</span>}
              {detail}
            </span>
          ))}
        </p>
        <div className="mt-5 border-b border-white/10" />
      </header>

      <div className="px-10 pt-6">
        {summaries.length === 0 ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="w-full max-w-md rounded-xl border border-dashed border-white/15 px-4 py-6 text-left text-sm text-foreground/55 hover:bg-white/[.04]"
          >
            No projects in this group yet. Add one, or set this group in a
            project’s settings.
          </button>
        ) : (
          <>
            {rows.some((row) => row.marks.length > 0) && (
              <section className="mb-10">
                <h2 className="mb-3 text-sm font-medium text-foreground/55">
                  Timeline
                </h2>
                <Timeline heading="Project" rows={rows} />
                <TimelineLegend />
              </section>
            )}
            <h2 className="mb-3 text-sm font-medium text-foreground/55">
              Projects
            </h2>
            <ProjectGrid summaries={active} today={today} />
          </>
        )}
        {inactive.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium text-foreground/55">
              Inactive
            </h2>
            <ProjectGrid summaries={inactive} today={today} />
          </section>
        )}
      </div>

      <NewProjectDialog
        open={creating}
        onOpenChange={setCreating}
        parentId={null}
        groupId={group.id}
      />
    </div>
  );
}

function timelineRows(
  roots: ProjectNode[],
  tasks: Task[],
  milestones: Milestone[],
  today: string,
  open: (projectId: Id) => void,
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const visit = (node: ProjectNode, depth: number) => {
    rows.push({
      id: String(node.id),
      label: node.name,
      color: node.color,
      depth,
      marks: [
        ...tasks
          .filter(
            (task) =>
              task.projectId === node.id &&
              task.kind !== 'record' &&
              task.completedAt === null,
          )
          .flatMap((task) => taskMarks(task, today)),
        ...projectMarks(
          node,
          milestones.filter((milestone) => milestone.projectId === node.id),
        ),
      ],
      span:
        node.targetDate && node.targetDate >= today
          ? { from: today, to: node.targetDate }
          : undefined,
      onOpen: () => open(node.id),
    });
    for (const child of node.children)
      if (!isInactive(child)) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);
  return rows;
}

function GroupTitle({
  groupId,
  name,
  onAddProject,
}: {
  groupId: Id;
  name: string;
  onAddProject: () => void;
}) {
  const rename = useRenameGroup();
  const [renaming, setRenaming] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <h1 className="flex min-w-0 flex-1 items-center gap-2.5 text-3xl leading-tight font-light tracking-tight">
        <FoldersIcon
          className="size-6 shrink-0 text-foreground/50"
          strokeWidth={1.5}
        />
        {renaming ? (
          <input
            autoFocus
            defaultValue={name}
            maxLength={80}
            aria-label="Group name"
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next && next !== name)
                rename.mutate({ id: groupId, name: next });
              setRenaming(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setRenaming(false);
            }}
            className="min-w-0 flex-1 rounded-md bg-white/10 px-2 outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          />
        ) : (
          <span className="truncate">{name}</span>
        )}
      </h1>
      <Button onClick={onAddProject}>
        <PlusIcon />
        New project
      </Button>
      <Button variant="outline" onClick={() => setRenaming(true)}>
        <PencilIcon />
        Rename
      </Button>
    </div>
  );
}

function ProjectGrid({
  summaries,
  today,
}: {
  summaries: Summary[];
  today: string;
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {summaries.map((summary) => (
        <li key={summary.node.id}>
          <ProjectCard summary={summary} today={today} />
        </li>
      ))}
    </ul>
  );
}

const dayLabel = (date: string, today: string) =>
  date === today ? 'Today' : format(fromDateKey(date), 'd MMM');

function deadlineLabel(date: string, today: string) {
  const days = differenceInCalendarDays(fromDateKey(date), fromDateKey(today));
  const left =
    days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  return `${format(fromDateKey(date), 'd MMM')} · ${left}`;
}

function ProjectCard({ summary, today }: { summary: Summary; today: string }) {
  const { node, done, open, overdue, nextDue, nextDeadline, tracked } = summary;
  const status = STATUSES.find((option) => option.value === node.status);
  const total = done + open;
  const budget = node.weeklyMinutes !== null ? node.weeklyMinutes * 60 : null;
  const children = node.children.filter((child) => !child.archived);

  const stats: [string, ReactNode][] = [
    ['Open tasks', open],
    [
      'Overdue',
      <span className={cn(overdue > 0 && 'text-attention')}>{overdue}</span>,
    ],
    ['Next due', nextDue ? dayLabel(nextDue, today) : '—'],
    [
      'Target',
      node.targetDate
        ? format(fromDateKey(node.targetDate), 'd MMM yyyy')
        : '—',
    ],
    [
      'This week',
      <span
        className={cn(
          'tabular-nums',
          budget !== null && tracked > budget && 'text-attention',
        )}
      >
        {formatDuration(tracked)}
        {budget !== null && ` of ${formatDuration(budget)}`}
      </span>,
    ],
  ];

  return (
    <Link
      to="/projects/$projectId"
      params={{ projectId: node.id }}
      className={cn(
        'flex h-full flex-col gap-4 rounded-xl bg-white/[.04] p-5 ring-1 ring-white/10 transition-colors outline-none hover:bg-white/[.07] focus-visible:ring-2 focus-visible:ring-white/50',
        isInactive(node) && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2.5">
        <ProjectDot color={node.color} className="size-2.5" />
        <h3 className="min-w-0 flex-1 truncate text-base font-medium">
          {node.name}
        </h3>
        {(node.archived || node.status !== 'active') && (
          <span className="rounded-full px-2 py-0.5 text-xs text-foreground/60 ring-1 ring-white/15">
            {node.archived ? 'Archived' : status?.label}
          </span>
        )}
      </div>

      <div className="min-h-10 text-sm">
        <p className="text-xs text-foreground/55">Next deadline</p>
        {nextDeadline ? (
          <p className="flex gap-2">
            <span className="min-w-0 flex-1 truncate">
              {nextDeadline.title}
            </span>
            <span className="shrink-0 text-foreground/70 tabular-nums">
              {deadlineLabel(nextDeadline.deadline as string, today)}
            </span>
          </p>
        ) : (
          <p className="text-foreground/40">None</p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-xs text-foreground/55">
          <span>Progress</span>
          <span className="tabular-nums">
            {done} of {total} done
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-foreground/70"
            style={{ width: total === 0 ? 0 : `${(done / total) * 100}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {stats.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-foreground/55">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>

      {children.length > 0 && (
        <p className="mt-auto truncate border-t border-white/10 pt-3 text-xs text-foreground/55">
          {children.length} sub-{children.length === 1 ? 'project' : 'projects'}
          : {children.map((child) => child.name).join(', ')}
        </p>
      )}
    </Link>
  );
}
