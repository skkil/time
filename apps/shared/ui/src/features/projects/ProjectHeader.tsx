import { Link } from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { Project, Task } from '@/backend';
import { InlineRename } from '@/components/InlineRename';
import { Button } from '@/components/ui/button';
import { DueText } from '@/features/tasks/DueText';
import { TaskLink } from '@/features/tasks/TaskLink';
import { cn } from '@/lib/utils';

import { ProjectDot } from './ProjectDot';
import { ProjectLink } from './ProjectLink';
import { useProjectIndex, useUpdateProject } from './api';
import { useProjectGroup } from './groups';
import type { ProjectTab, TabOption } from './project-view';
import { STATUSES, projectChain } from './tree';

function ProjectTitle({ project }: { project?: Project }) {
  const [renaming, setRenaming] = useState(false);
  const update = useUpdateProject();

  if (!project) return 'Inbox';
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ProjectDot color={project.color} className="size-3" />
      <InlineRename
        value={project.name}
        label="Project name"
        editing={renaming}
        onEditingChange={setRenaming}
        onSave={(name) =>
          update.mutate({
            id: project.id,
            input: { name, parentId: project.parentId, color: project.color },
          })
        }
      />
    </div>
  );
}

export function ProjectHeader({
  project,
  openCount,
  tabs,
  tab,
  onTab,
  onAddTask,
  next,
}: {
  project?: Project;
  openCount: number;
  tabs: TabOption[];
  tab: ProjectTab;
  onTab: (tab: ProjectTab) => void;
  onAddTask: () => void;
  next?: Task;
}) {
  const index = useProjectIndex();
  const group = useProjectGroup(project?.id);
  const status = STATUSES.find((option) => option.value === project?.status);
  const parents =
    project?.parentId != null ? projectChain(index, project.parentId) : [];

  const details: ReactNode[] = [
    next && (
      <TaskLink
        key="next"
        taskId={next.id}
        label={`Open ${next.title}`}
        className="max-w-full truncate text-base text-foreground sm:max-w-xl"
      >
        Next: {next.title}
        {next.dueDate && (
          <>
            , <DueText task={next} />
          </>
        )}
      </TaskLink>
    ),
    `${openCount} open ${openCount === 1 ? 'task' : 'tasks'}`,
    project?.archived && 'Archived',
    project && project.status !== 'active' && status?.label,
  ].filter(Boolean);

  return (
    <header className="w-full shrink-0 px-4 pt-4 sm:px-10">
      {(group || parents.length > 0) && (
        <nav
          aria-label="Breadcrumb"
          className="mb-1 flex flex-wrap gap-1.5 text-sm text-foreground/75"
        >
          {group && (
            <Link
              to="/projects/groups/$groupId"
              params={{ groupId: group.id }}
              className="rounded-sm outline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {group.name}
            </Link>
          )}
          {parents.map((node, position) => (
            <span key={node.id} className="flex gap-1.5">
              {(group || position > 0) && <span aria-hidden>/</span>}
              <ProjectLink projectId={node.id}>{node.name}</ProjectLink>
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-3xl leading-tight font-light tracking-tight max-sm:basis-full">
          <ProjectTitle project={project} />
        </h1>
        {!project?.archived && (
          <Button onClick={onAddTask}>
            <PlusIcon />
            Add task
          </Button>
        )}
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-foreground/75">
        {details.map((detail, i) => (
          <span key={i} className="flex max-w-full min-w-0 items-center gap-2">
            {i > 0 && <span aria-hidden>·</span>}
            {detail}
          </span>
        ))}
      </p>

      {tabs.length > 1 && (
        <nav
          role="tablist"
          aria-label="Project sections"
          className="mt-4 flex gap-5 border-b border-white/10"
        >
          {tabs.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={option.id === tab}
              onClick={() => onTab(option.id)}
              className={cn(
                '-mb-px border-b-2 pb-2.5 text-sm transition-colors outline-none focus-visible:text-foreground',
                option.id === tab
                  ? 'border-foreground font-medium text-foreground'
                  : 'border-transparent text-foreground/75 hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
