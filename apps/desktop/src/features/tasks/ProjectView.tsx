import { PlusIcon, Settings2Icon, SlidersHorizontalIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Id, SavedView, Section, Task } from '@/bindings';
import { EmptyState, Page, PageBody } from '@/components/page';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ProjectHeader } from '@/features/projects/ProjectHeader';
import { ProjectSettingsDialog } from '@/features/projects/ProjectSettingsDialog';
import { useProjectIndex, useSetProjectView } from '@/features/projects/api';
import { ViewEditor } from '@/features/workflow/ViewEditor';
import { Workspace } from '@/features/workflow/Workspace';
import { useWorkspaceView } from '@/features/workflow/use-workspace';
import { cn } from '@/lib/utils';

import {
  AddSection,
  SectionHeader,
  SectionMenu,
  SectionName,
} from './SectionHeader';
import { AddTaskRow, FlatTaskList, TaskList } from './TaskList';
import { useCreateSection, useSections, useTasks } from './api';
import { TaskDnd } from './dnd';

const topLevel = (tasks: Task[], sectionId: Id | null) =>
  tasks.filter(
    (task) =>
      task.completedAt === null &&
      task.parentId === null &&
      task.sectionId === sectionId,
  );

export function ProjectView({ projectId }: { projectId: Id | null }) {
  const { data: tasks, isPending } = useTasks();
  const { data: allSections } = useSections();
  const index = useProjectIndex();
  const setView = useSetProjectView();
  const createSection = useCreateSection();
  const [editing, setEditing] = useState(false);
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

  const sectionList = (
    <PageBody>
      <div className="mx-auto max-w-3xl pl-10">
        <TaskDnd>
          <TaskList
            tasks={unsectioned}
            container={{ projectId, sectionId: null, parentId: null }}
          />
          {!archived && (
            <AddTaskRow defaults={{ projectId, sectionId: null }} />
          )}
          {sections.map((section) => {
            const sectionTasks = topLevel(own, section.id);
            return (
              <section key={section.id} aria-label={section.name}>
                <AddSection onAdd={(name) => addSection(name, section.id)} />
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
                      />
                    )}
                  </>
                )}
              </section>
            );
          })}
        </TaskDnd>
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

  const viewOptions = structured
    ? views.map((item) => ({ id: String(item.id), label: item.name }))
    : project
      ? [
          { id: 'list', label: 'List' },
          { id: 'board', label: 'Board' },
        ]
      : [];

  return (
    <Page>
      <ProjectHeader
        project={project}
        openCount={openCount}
        views={viewOptions}
        view={structured ? String(view.id) : (project?.view ?? 'list')}
        onView={(id) =>
          structured
            ? choose(Number(id))
            : project &&
              setView.mutate({ id: project.id, view: id as 'list' | 'board' })
        }
        onSettings={() => setEditing(true)}
        menu={
          <>
            {!structured && (
              <DropdownMenuCheckboxItem
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              >
                Show completed
              </DropdownMenuCheckboxItem>
            )}
            {structured && view.id > 0 && (
              <DropdownMenuItem onSelect={() => setViewEditor(view)}>
                <SlidersHorizontalIcon />
                Edit “{view.name}”
              </DropdownMenuItem>
            )}
            {structured && (
              <DropdownMenuItem onSelect={() => setViewEditor('new')}>
                <PlusIcon />
                New view
              </DropdownMenuItem>
            )}
            {project && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Settings2Icon />
                  Project settings
                </DropdownMenuItem>
              </>
            )}
          </>
        }
      />

      {structured && project ? (
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
      <div className="flex h-full items-start gap-4 px-8 py-5">
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
