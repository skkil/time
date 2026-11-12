import { ChevronDownIcon, PlusIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useState } from 'react';

import type { Id, Project, SavedView, Section, Task } from '@/backend';
import { EmptyState, PageBody } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AddSection,
  SectionHeader,
  SectionMenu,
  SectionTitle,
} from '@/features/tasks/SectionHeader';
import { AddTaskRow, FlatTaskList, TaskList } from '@/features/tasks/TaskList';
import { useCreateSection, useTaskIndex } from '@/features/tasks/api';
import { TaskDnd } from '@/features/tasks/dnd';
import { GraphView } from '@/features/workflow/GraphView';
import { ViewEditor } from '@/features/workflow/ViewEditor';
import { Workspace } from '@/features/workflow/Workspace';
import type { ProjectWorkflow } from '@/features/workflow/api';
import { cn } from '@/lib/utils';

import { NewProjectDialog } from './NewProjectDialog';
import { ProjectContext } from './ProjectContext';
import { ProjectTimeline } from './ProjectTimeline';
import { useProjectIndex } from './api';
import {
  type ViewOption,
  chooseView,
  fallbackView,
  isSaved,
  viewOptions,
} from './project-view';
import { useProjectMemory } from './use-project-memory';

const topLevel = (tasks: Task[], sectionId: Id | null) =>
  tasks.filter(
    (task) =>
      task.completedAt === null &&
      task.parentId === null &&
      task.sectionId === sectionId,
  );

const boardByStatus = (projectId: Id): SavedView => ({
  id: 'board',
  projectId,
  name: 'Board',
  layout: 'board',
  groupBy: 'status',
  filter: '{}',
  sort: 'manual',
  position: 0,
});

export function ProjectTasks({
  projectId,
  project,
  workflow,
  own,
  sections,
  openCount,
  next,
  onOpenNotes,
  onOpenFocus,
}: {
  projectId: Id | null;
  project?: Project;
  workflow: ProjectWorkflow;
  own: Task[];
  sections: Section[];
  openCount: number;
  next?: Task;
  onOpenNotes: () => void;
  onOpenFocus: () => void;
}) {
  const taskIndex = useTaskIndex();
  const { memory, remember } = useProjectMemory(projectId);
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewEditor, setViewEditor] = useState<SavedView | 'new' | null>(null);

  const linked = own.some(
    (task) =>
      task.completedAt === null &&
      (task.blockedBy.length > 0 ||
        (taskIndex.holding.get(task.id) ?? []).some(
          (held) => held.completedAt === null,
        )),
  );
  const options = viewOptions({
    inProject: project !== undefined,
    linked,
    saved: workflow.views,
  });
  const current = chooseView(
    options,
    memory.view,
    fallbackView(project?.view, workflow.views),
  );
  const choose = (id: string) => remember({ view: id });
  const archived = project?.archived ?? false;
  const unsectioned = topLevel(own, null);
  const completed = own
    .filter((task) => task.completedAt !== null)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const sectionList = (
    <SectionList
      projectId={projectId}
      own={own}
      sections={sections}
      unsectioned={unsectioned}
      archived={archived}
      empty={openCount === 0}
      completed={showCompleted ? completed : undefined}
    />
  );

  const body =
    current.id === 'graph' ? (
      <GraphView projectId={projectId} own={own} />
    ) : current.id === 'timeline' && project ? (
      <ProjectTimeline project={project} own={own} />
    ) : isSaved(current) && project ? (
      <Workspace
        project={project}
        workflow={workflow}
        view={current.saved}
        own={own}
        sections={sections}
        sectionList={sectionList}
      />
    ) : current.id === 'board' && project && workflow.statuses.length > 0 ? (
      <Workspace
        project={project}
        workflow={workflow}
        view={boardByStatus(project.id)}
        own={own}
        sections={sections}
        sectionList={sectionList}
      />
    ) : current.id === 'board' ? (
      <BoardLayout
        projectId={projectId}
        own={own}
        sections={sections}
        unsectioned={unsectioned}
        archived={archived}
      />
    ) : (
      sectionList
    );
  const wide = current.id === 'graph' || current.id === 'timeline';

  return (
    <>
      <div
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-10',
          project ? 'pt-3' : 'pt-5',
        )}
      >
        <ViewPicker
          options={options}
          current={current}
          onChoose={choose}
          onNew={project ? () => setViewEditor('new') : undefined}
          onEdit={
            isSaved(current) ? () => setViewEditor(current.saved) : undefined
          }
        />
        {current.id === 'list' && (
          <label className="flex items-center gap-2 text-sm text-foreground/75">
            <Checkbox
              checked={showCompleted}
              onCheckedChange={(checked) => setShowCompleted(checked === true)}
            />
            Show completed
          </label>
        )}
      </div>

      <div className="@container flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{body}</div>
        {project && !wide && (
          <ProjectContext
            project={project}
            own={own}
            nextId={next?.id}
            onOpenNotes={onOpenNotes}
            onOpenFocus={onOpenFocus}
          />
        )}
      </div>

      {project && (
        <Dialog
          open={viewEditor !== null}
          onOpenChange={(open) => !open && setViewEditor(null)}
        >
          <DialogContent className="rounded-[28px] border-0 bg-[rgba(10,18,32,.92)] p-8 sm:max-w-md">
            <DialogTitle className="text-xl font-light">
              {viewEditor === 'new' ? 'New view' : 'Edit view'}
            </DialogTitle>
            {viewEditor !== null && (
              <ViewEditor
                projectId={project.id}
                workflow={workflow}
                view={viewEditor === 'new' ? undefined : viewEditor}
                onDone={(id) => {
                  if (id !== undefined) choose(String(id));
                  setViewEditor(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ViewPicker({
  options,
  current,
  onChoose,
  onNew,
  onEdit,
}: {
  options: ViewOption[];
  current: ViewOption;
  onChoose: (id: string) => void;
  onNew?: () => void;
  onEdit?: () => void;
}) {
  const builtIn = options.filter((option) => !isSaved(option));
  const saved = options.filter(isSaved);
  return (
    <div className="flex items-center gap-2">
      <span id="project-view-label" className="text-sm text-foreground/75">
        View
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-labelledby="project-view-label project-view-current"
          >
            <span id="project-view-current">{current.label}</span>
            <ChevronDownIcon data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuRadioGroup value={current.id} onValueChange={onChoose}>
            {builtIn.map((option) => (
              <DropdownMenuRadioItem key={option.id} value={option.id}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
            {saved.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Saved views
                </DropdownMenuLabel>
                {saved.map((option) => (
                  <DropdownMenuRadioItem key={option.id} value={option.id}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </>
            )}
          </DropdownMenuRadioGroup>
          {(onNew || onEdit) && <DropdownMenuSeparator />}
          {onEdit && (
            <DropdownMenuItem onSelect={onEdit}>
              <SlidersHorizontalIcon />
              Edit this view…
            </DropdownMenuItem>
          )}
          {onNew && (
            <DropdownMenuItem onSelect={onNew}>
              <PlusIcon />
              New view…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SectionList({
  projectId,
  own,
  sections,
  unsectioned,
  archived,
  empty,
  completed,
}: {
  projectId: Id | null;
  own: Task[];
  sections: Section[];
  unsectioned: Task[];
  archived: boolean;
  empty: boolean;
  completed?: Task[];
}) {
  const createSection = useCreateSection();
  const addSection = (name: string, before: Id | null = null) =>
    createSection.mutate({ projectId, name, before });
  return (
    <PageBody className="px-4 pt-4 sm:px-10">
      <TaskDnd>
        <TaskList
          tasks={unsectioned}
          container={{ projectId, sectionId: null, parentId: null }}
        />
        {!archived && (sections.length === 0 || unsectioned.length > 0) && (
          <AddTaskRow defaults={{ projectId, sectionId: null }} />
        )}
        {sections.map((section, position) => {
          const sectionTasks = topLevel(own, section.id);
          return (
            <section
              key={section.id}
              aria-label={section.name}
              className="group/section"
            >
              {(position > 0 || unsectioned.length > 0) && (
                <AddSection onAdd={(name) => addSection(name, section.id)} />
              )}
              <SectionHeader section={section} count={sectionTasks.length} />
              {!section.collapsed && (
                <>
                  <TaskList
                    tasks={sectionTasks}
                    container={{
                      projectId,
                      sectionId: section.id,
                      parentId: null,
                    }}
                  />
                  {!archived && (
                    <AddTaskRow
                      defaults={{ projectId, sectionId: section.id }}
                      className={
                        sectionTasks.length > 0
                          ? 'opacity-0 transition-opacity group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100'
                          : undefined
                      }
                    />
                  )}
                </>
              )}
            </section>
          );
        })}
      </TaskDnd>
      {!archived && empty && sections.length === 0 && (
        <EmptyProject inbox={projectId === null} />
      )}
      {!archived && (
        <AddSection
          always={sections.length === 0}
          onAdd={(name) => addSection(name)}
        />
      )}

      {completed && (
        <section aria-label="Completed" className="mt-8">
          <h2 className="mb-1 border-b border-white/[.07] pb-2 text-sm font-medium text-foreground/75">
            Completed{' '}
            <span className="text-xs font-normal">{completed.length}</span>
          </h2>
          {completed.length > 0 ? (
            <FlatTaskList tasks={completed} />
          ) : (
            <p className="py-3 text-sm text-foreground/75">
              Nothing completed in the last two weeks.
            </p>
          )}
        </section>
      )}
    </PageBody>
  );
}

function BoardLayout({
  projectId,
  own,
  sections,
  unsectioned,
  archived,
}: {
  projectId: Id | null;
  own: Task[];
  sections: Section[];
  unsectioned: Task[];
  archived: boolean;
}) {
  const createSection = useCreateSection();
  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="flex h-full items-start gap-4 px-4 py-5 sm:px-10">
        <TaskDnd>
          {(unsectioned.length > 0 || sections.length === 0) && (
            <BoardColumn
              title="(No section)"
              count={unsectioned.length}
              tasks={unsectioned}
              projectId={projectId}
              sectionId={null}
              archived={archived}
            />
          )}
          {sections.map((section) => {
            const sectionTasks = topLevel(own, section.id);
            return (
              <BoardColumn
                key={section.id}
                section={section}
                title={section.name}
                count={sectionTasks.length}
                tasks={sectionTasks}
                projectId={projectId}
                sectionId={section.id}
                archived={archived}
              />
            );
          })}
        </TaskDnd>
        {!archived && (
          <div className="w-44 shrink-0">
            <AddSection
              always
              onAdd={(name) =>
                createSection.mutate({ projectId, name, before: null })
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

function BoardColumn({
  section,
  title,
  count,
  tasks,
  projectId,
  sectionId,
  archived,
}: {
  section?: Section;
  title: string;
  count: number;
  tasks: Task[];
  projectId: Id | null;
  sectionId: Id | null;
  archived: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  return (
    <section
      aria-label={title}
      className="group/section flex max-h-full w-72 shrink-0 flex-col"
    >
      <header className="flex h-9 shrink-0 items-center gap-1.5 px-1">
        <h2 className="flex min-w-0 items-center truncate text-sm font-medium text-foreground/90">
          {section ? (
            <SectionTitle
              section={section}
              editing={renaming}
              onEditingChange={setRenaming}
            />
          ) : (
            title
          )}
        </h2>
        <span className="text-xs text-foreground/75 tabular-nums">{count}</span>
        {section && (
          <div
            className={cn(
              'ml-auto opacity-0 group-hover/section:opacity-100 has-[[data-state=open]]:opacity-100',
            )}
          >
            <SectionMenu
              section={section}
              count={count}
              onRename={() => setRenaming(true)}
            />
          </div>
        )}
      </header>
      <div className="-ml-6 min-h-0 overflow-y-auto pr-1 pl-6">
        <TaskList
          tasks={tasks}
          variant="card"
          container={{ projectId, sectionId, parentId: null }}
        />
        {!archived && <AddTaskRow defaults={{ projectId, sectionId }} />}
      </div>
    </section>
  );
}

function EmptyProject({ inbox }: { inbox: boolean }) {
  const index = useProjectIndex();
  const [creating, setCreating] = useState(false);
  if (!inbox)
    return (
      <EmptyState className="mt-4" title="No tasks in this project yet.">
        Add the first one above, or press Q from anywhere.
      </EmptyState>
    );
  return (
    <EmptyState
      className="mt-4"
      title="Your Inbox is empty."
      action={
        index.active.length === 0 && (
          <>
            <Button size="sm" onClick={() => setCreating(true)}>
              New project
            </Button>
            <NewProjectDialog
              open={creating}
              onOpenChange={setCreating}
              parentId={null}
            />
          </>
        )
      }
    >
      Tasks you add without a project land here.
      {index.active.length === 0 &&
        ' Projects keep related tasks together; start one when you have a goal with several steps.'}
    </EmptyState>
  );
}
