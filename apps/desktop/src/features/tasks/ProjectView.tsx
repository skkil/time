import { PlusIcon, SlidersHorizontalIcon } from 'lucide-react';
import { Suspense, lazy, useMemo, useState } from 'react';

import type { Id, SavedView, Section, Task } from '@/bindings';
import { EmptyState, Page, PageBody } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { NewProjectDialog } from '@/features/projects/NewProjectDialog';
import { ProjectContext } from '@/features/projects/ProjectContext';
import { ProjectFocus } from '@/features/projects/ProjectFocus';
import { ProjectHeader } from '@/features/projects/ProjectHeader';
import { ProjectSettingsDialog } from '@/features/projects/ProjectSettingsDialog';
import { ProjectTimeline } from '@/features/projects/ProjectTimeline';
import { useProjectIndex, useSetProjectView } from '@/features/projects/api';
import { nextUp } from '@/features/projects/context';
import { GraphView } from '@/features/workflow/GraphView';
import { ViewEditor } from '@/features/workflow/ViewEditor';
import { Workspace } from '@/features/workflow/Workspace';
import { useWorkspaceView } from '@/features/workflow/use-workspace';
import {
  type ProjectTab,
  setPreference,
  usePreference,
} from '@/lib/preferences';
import { cn } from '@/lib/utils';

import {
  AddSection,
  SectionHeader,
  SectionMenu,
  SectionName,
} from './SectionHeader';
import { AddTaskRow, FlatTaskList, TaskList } from './TaskList';
import { useCreateSection, useSections, useTaskIndex, useTasks } from './api';
import { TaskDnd } from './dnd';
import { useTaskDialog } from './task-dialog-context';

type ProjectSection = 'tasks' | 'notes' | 'focus';

const PROJECT_SECTIONS: { id: ProjectSection; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Notes' },
  { id: 'focus', label: 'Focus' },
];

const PROJECT_TABS: ProjectTab[] = ['graph', 'timeline'];

const ProjectCanvas = lazy(() =>
  import('@/features/projects/ProjectCanvas').then(({ ProjectCanvas }) => ({
    default: ProjectCanvas,
  })),
);

const topLevel = (tasks: Task[], sectionId: Id | null) =>
  tasks.filter(
    (task) =>
      task.completedAt === null &&
      task.parentId === null &&
      task.sectionId === sectionId,
  );

export function ProjectView({ projectId }: { projectId: Id | null }) {
  const { data: tasks, isPending } = useTasks();
  const taskIndex = useTaskIndex();
  const { newTask } = useTaskDialog();
  const projectTabs = usePreference('projectTabs');
  const { data: allSections } = useSections();
  const index = useProjectIndex();
  const setView = useSetProjectView();
  const createSection = useCreateSection();
  const [editing, setEditing] = useState(false);
  const [section, setSection] = useState<ProjectSection>('tasks');
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewEditor, setViewEditor] = useState<SavedView | 'new' | null>(null);
  const project = projectId === null ? undefined : index.byId.get(projectId);
  const board = project?.view === 'board';
  const { workflow, views, view, choose } = useWorkspaceView(projectId);
  const { structured } = workflow;

  const { own, sections, completed, openCount } = useMemo(() => {
    const own = (tasks ?? []).filter((task) => task.projectId === projectId);
    return {
      own,
      sections: (allSections ?? []).filter(
        (section) => section.projectId === projectId,
      ),
      completed: own
        .filter((task) => task.completedAt !== null)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
      openCount: own.filter((task) => task.completedAt === null).length,
    };
  }, [tasks, allSections, projectId]);

  if (projectId !== null && !project && !isPending) {
    return (
      <Page>
        <PageBody>
          <EmptyState title="This project doesn't exist anymore." />
        </PageBody>
      </Page>
    );
  }

  const addSection = (name: string, before: Id | null = null) =>
    createSection.mutate({ projectId, name, before });
  const archived = project?.archived ?? false;
  const unsectioned = topLevel(own, null);
  const next = nextUp(own);

  const sectionList = (
    <PageBody className="px-10 pt-4">
      <div>
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
                            ? '-mb-5 opacity-0 transition-opacity group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100'
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
        {!archived && openCount === 0 && sections.length === 0 && (
          <EmptyProject inbox={projectId === null} />
        )}
        {!archived && (
          <AddSection
            always={sections.length === 0}
            onAdd={(name) => addSection(name)}
          />
        )}

        {showCompleted && (
          <section aria-label="Completed" className="mt-8">
            <h2 className="mb-1 border-b border-white/[.07] pb-2 text-sm font-medium text-foreground/50">
              Completed{' '}
              <span className="text-xs font-normal">{completed.length}</span>
            </h2>
            {completed.length > 0 ? (
              <FlatTaskList tasks={completed} />
            ) : (
              <p className="py-3 text-sm text-foreground/45">
                Nothing completed in the last two weeks.
              </p>
            )}
          </section>
        )}
      </div>
    </PageBody>
  );

  const linked = own.some(
    (task) =>
      task.completedAt === null &&
      (task.blockedBy.length > 0 ||
        (taskIndex.holding.get(task.id) ?? []).some(
          (held) => held.completedAt === null,
        )),
  );
  const tabKey = String(projectId ?? 'inbox');
  const savedTab = projectTabs[tabKey];
  const tab =
    savedTab === 'graph'
      ? linked
        ? savedTab
        : undefined
      : savedTab === 'timeline' && project
        ? savedTab
        : undefined;
  const graph = tab === 'graph';
  const setTab = (next: ProjectTab | undefined) =>
    setPreference('projectTabs', { ...projectTabs, [tabKey]: next });
  const viewOptions = [
    ...(structured
      ? views.map((item) => ({ id: String(item.id), label: item.name }))
      : project
        ? [
            { id: 'list', label: 'List' },
            { id: 'board', label: 'Board' },
          ]
        : linked
          ? [{ id: 'list', label: 'List' }]
          : []),
    ...(linked ? [{ id: 'graph', label: 'Graph' }] : []),
    ...(project ? [{ id: 'timeline', label: 'Timeline' }] : []),
  ];
  const layout = tab
    ? tab
    : structured
      ? String(view.id)
      : (project?.view ?? 'list');
  const chooseLayout = (id: string) => {
    if (PROJECT_TABS.includes(id as ProjectTab))
      return setTab(id as ProjectTab);
    setTab(undefined);
    if (structured) choose(Number(id));
    else if (project)
      setView.mutate({ id: project.id, view: id as 'list' | 'board' });
  };

  return (
    <Page>
      <ProjectHeader
        project={project}
        openCount={openCount}
        views={project ? PROJECT_SECTIONS : []}
        view={section}
        onView={(id) => setSection(id as ProjectSection)}
        onAddTask={() => newTask({ projectId })}
        onSettings={() => setEditing(true)}
        next={next}
        actions={
          section === 'tasks' ? (
            <>
              {viewOptions.length > 1 && (
                <div
                  role="group"
                  aria-label="Task layout"
                  className="flex gap-1"
                >
                  {viewOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={option.id === layout}
                      onClick={() => chooseLayout(option.id)}
                      className={cn(
                        'h-7 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/50',
                        option.id === layout
                          ? 'bg-white/[.12] text-foreground'
                          : 'text-foreground/55 hover:text-foreground',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
              {tab ? null : structured ? (
                <>
                  {view.id > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewEditor(view)}
                    >
                      <SlidersHorizontalIcon />
                      Edit view
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewEditor('new')}
                  >
                    <PlusIcon />
                    New view
                  </Button>
                </>
              ) : board ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={showCompleted}
                  onClick={() => setShowCompleted((value) => !value)}
                  className={cn(
                    '-mr-2.5 font-normal text-foreground/55',
                    showCompleted && 'bg-muted text-foreground',
                  )}
                >
                  Completed
                </Button>
              )}
            </>
          ) : undefined
        }
      />

      {section === 'notes' && project ? (
        <Suspense>
          <ProjectCanvas projectId={project.id} />
        </Suspense>
      ) : section === 'focus' && project ? (
        <ProjectFocus projectId={project.id} />
      ) : (
        <div className="@container flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {graph ? (
              <GraphView projectId={projectId} own={own} />
            ) : tab === 'timeline' && project ? (
              <ProjectTimeline project={project} own={own} />
            ) : structured && project ? (
              <Workspace
                project={project}
                workflow={workflow}
                view={view}
                own={own}
                sections={sections}
                sectionList={sectionList}
              />
            ) : board ? (
              <BoardLayout
                projectId={projectId}
                own={own}
                sections={sections}
                unsectioned={unsectioned}
                archived={archived}
                onAddSection={addSection}
              />
            ) : (
              sectionList
            )}
          </div>
          {project && !tab && (
            <ProjectContext
              project={project}
              own={own}
              nextId={next?.id}
              onOpenNotes={() => setSection('notes')}
              onOpenFocus={() => setSection('focus')}
            />
          )}
        </div>
      )}

      {project && (
        <Dialog
          open={viewEditor !== null}
          onOpenChange={(open) => !open && setViewEditor(null)}
        >
          <DialogContent className="rounded-[28px] border-0 bg-[rgba(10,18,32,.92)] p-8 shadow-[0_40px_120px_rgba(0,0,0,.4)] ring-1 ring-white/10 backdrop-blur-2xl sm:max-w-md">
            <DialogTitle className="text-xl font-light">
              {viewEditor === 'new' ? 'New view' : 'Edit view'}
            </DialogTitle>
            {viewEditor !== null && (
              <ViewEditor
                projectId={project.id}
                workflow={workflow}
                view={viewEditor === 'new' ? undefined : viewEditor}
                onDone={(id) => {
                  if (id !== undefined) choose(id);
                  setViewEditor(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {project && (
        <ProjectSettingsDialog
          open={editing}
          onOpenChange={setEditing}
          project={project}
        />
      )}
    </Page>
  );
}

function BoardLayout({
  projectId,
  own,
  sections,
  unsectioned,
  archived,
  onAddSection,
}: {
  projectId: Id | null;
  own: Task[];
  sections: Section[];
  unsectioned: Task[];
  archived: boolean;
  onAddSection: (name: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="flex h-full items-start gap-4 px-10 py-5">
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
          <div className="w-72 shrink-0">
            <AddSection always onAdd={onAddSection} />
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
        {section && renaming ? (
          <SectionName section={section} onDone={() => setRenaming(false)} />
        ) : (
          <h2
            className="truncate text-sm font-medium text-foreground/90"
            onDoubleClick={() => section && setRenaming(true)}
          >
            {title}
          </h2>
        )}
        <span className="text-xs text-foreground/40 tabular-nums">{count}</span>
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
