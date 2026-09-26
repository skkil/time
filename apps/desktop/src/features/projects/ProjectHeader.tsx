import { Link, useNavigate } from '@tanstack/react-router';
import {
  ChevronDownIcon,
  PlusIcon,
  SettingsIcon,
  SunsetIcon,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { Project, Task } from '@/bindings';
import { InlineRename } from '@/components/InlineRename';
import { Button } from '@/components/ui/button';
import { CommandItem } from '@/components/ui/command';
import { DueText } from '@/features/tasks/DueText';
import { TaskLink } from '@/features/tasks/TaskLink';
import { cn } from '@/lib/utils';

import { NewProjectDialog } from './NewProjectDialog';
import { ProjectDot } from './ProjectDot';
import { ProjectLink } from './ProjectLink';
import { ProjectPicker } from './ProjectPicker';
import { useProjectIndex, useUpdateProject } from './api';
import { useProjectGroup } from './groups';
import { STATUSES, projectChain } from './tree';

export type ViewOption = { id: string; label: string };

function ProjectSwitcher({ project }: { project?: Project }) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const update = useUpdateProject();
  const chevron = (
    <ChevronDownIcon
      className="size-5 shrink-0 text-foreground/75 transition-colors group-hover/switch:text-foreground"
      strokeWidth={1.5}
    />
  );

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {project && <ProjectDot color={project.color} className="size-3" />}
      {project && (
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
      )}
      <ProjectPicker
        value={project?.id ?? null}
        noneLabel="Inbox"
        onChange={(id) =>
          id === null
            ? navigate({ to: '/projects' })
            : navigate({
                to: '/projects/$projectId',
                params: { projectId: id },
              })
        }
        trigger={
          <button
            type="button"
            aria-label={`Switch project, now ${project?.name ?? 'Inbox'}`}
            className="group/switch flex max-w-full shrink-0 items-center gap-2.5 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {!project && <span className="truncate">Inbox</span>}
            {chevron}
          </button>
        }
      >
        <CommandItem
          value="Someday"
          onSelect={() => navigate({ to: '/projects/someday' })}
        >
          <SunsetIcon className="text-muted-foreground" />
          Someday
        </CommandItem>
        <CommandItem value="New project" onSelect={() => setCreating(true)}>
          <PlusIcon className="text-muted-foreground" />
          New project
        </CommandItem>
      </ProjectPicker>
      <NewProjectDialog
        open={creating}
        onOpenChange={setCreating}
        parentId={null}
      />
    </div>
  );
}

export function ProjectHeader({
  project,
  openCount,
  views,
  view,
  onView,
  onAddTask,
  onSettings,
  next,
  actions,
}: {
  project?: Project;
  openCount: number;
  views: ViewOption[];
  view: string;
  onView: (id: string) => void;
  onAddTask: () => void;
  onSettings: () => void;
  next?: Task;
  actions?: ReactNode;
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
        className="max-w-xl truncate text-base text-foreground"
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
    <header className="w-full shrink-0 px-10 pt-4">
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
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 text-3xl leading-tight font-light tracking-tight">
          <ProjectSwitcher project={project} />
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
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-foreground/75">
        {details.map((detail, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>·</span>}
            {detail}
          </span>
        ))}
      </p>

      {(views.length > 1 || actions) && (
        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-white/10">
          {views.length > 1 && (
            <nav
              role="tablist"
              aria-label="Project sections"
              className="flex gap-5"
            >
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
                      : 'border-transparent text-foreground/75 hover:text-foreground',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </nav>
          )}
          {actions && (
            <div className="ml-auto flex items-center gap-3 pb-1.5">
              {actions}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
