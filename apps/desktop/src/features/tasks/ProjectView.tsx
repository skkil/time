import {
  CheckCircle2Icon,
  KanbanSquareIcon,
  ListIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Id, Section, Task } from '@/bindings';
import {
  EmptyState,
  Page,
  PageBody,
  PageHeader,
  Stat,
} from '@/components/page';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ProjectBrief } from '@/features/projects/ProjectBrief';
import { ProjectDot } from '@/features/projects/ProjectDot';
import { ProjectSettingsDialog } from '@/features/projects/ProjectSettingsDialog';
import { useProjectIndex, useSetProjectView } from '@/features/projects/api';
import { projectPath } from '@/features/projects/tree';
import { Workspace } from '@/features/workflow/Workspace';
import { useProjectWorkflow } from '@/features/workflow/api';
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
  const project = projectId === null ? undefined : index.byId.get(projectId);
  const board = project?.view === 'board';
  const { structured } = useProjectWorkflow(projectId);

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
            <h2 className="mb-1 border-b pb-2 font-sans text-sm font-semibold text-muted-foreground">
              Completed{' '}
              <span className="text-xs font-normal">{completed.length}</span>
            </h2>
            {completed.length > 0 ? (
              <FlatTaskList tasks={completed} />
            ) : (
              <p className="py-3 text-sm text-muted-foreground">
                Nothing completed in the last two weeks.
              </p>
            )}
          </section>
        )}
      </div>
    </PageBody>
  );

  return (
    <Page>
      <PageHeader
        title={
          project ? (
            <span className="flex items-center gap-2.5">
              <ProjectDot color={project.color} className="size-2.5" />
              {project.name}
            </span>
          ) : (
            'Inbox'
          )
        }
        meta={[
          project?.parentId != null
            ? `In ${projectPath(index, project.parentId)}`
            : null,
          <Stat value={String(openCount)} label="open" />,
          archived ? 'Archived' : null,
        ]}
        actions={
          <>
            {project && !structured && (
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={project.view}
                onValueChange={(view) =>
                  view && setView.mutate({ id: project.id, view })
                }
              >
                <ToggleGroupItem value="list" aria-label="List layout">
                  <ListIcon />
                  List
                </ToggleGroupItem>
                <ToggleGroupItem value="board" aria-label="Board layout">
                  <KanbanSquareIcon />
                  Board
                </ToggleGroupItem>
              </ToggleGroup>
            )}
            {!structured && (
              <Button
                variant={showCompleted ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={showCompleted}
                onClick={() => setShowCompleted((value) => !value)}
              >
                <CheckCircle2Icon />
                Completed
              </Button>
            )}
            {project && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <SlidersHorizontalIcon />
                Settings
              </Button>
            )}
          </>
        }
      />

      {project && !archived && (
        <div className="px-8 pt-4">
          <ProjectBrief project={project} onEdit={() => setEditing(true)} />
        </div>
      )}

      {structured && project ? (
        <Workspace
          project={project}
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
            className="truncate font-sans text-sm font-semibold"
            onDoubleClick={() => section && setRenaming(true)}
          >
            {title}
          </h2>
        )}
        <span className="text-xs text-muted-foreground">{count}</span>
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
