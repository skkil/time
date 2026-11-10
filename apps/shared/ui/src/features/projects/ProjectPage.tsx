import { nextUp } from '@skkil-time/rules/next';
import { useNavigate } from '@tanstack/react-router';
import { Suspense, lazy, useMemo } from 'react';

import type { Id } from '@/backend';
import { EmptyState, Page, PageBody } from '@/components/page';
import { useSections, useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { useProjectWorkflow } from '@/features/workflow/api';
import { todayKey } from '@/lib/time';

import { ProjectFocus } from './ProjectFocus';
import { ProjectHeader } from './ProjectHeader';
import { ProjectSettings } from './ProjectSettings';
import { ProjectTasks } from './ProjectTasks';
import { useProjectIndex } from './api';
import {
  PROJECT_TABS,
  type ProjectTab,
  chooseTab,
  remembersTab,
} from './project-view';
import { useProjectMemory } from './use-project-memory';

const ProjectCanvas = lazy(() =>
  import('./ProjectCanvas').then(({ ProjectCanvas }) => ({
    default: ProjectCanvas,
  })),
);

export function ProjectPage({
  projectId,
  tab: requested,
}: {
  projectId: Id | null;
  tab?: ProjectTab;
}) {
  const navigate = useNavigate();
  const { data: tasks, isPending } = useTasks();
  const { data: allSections } = useSections();
  const { newTask } = useTaskDialog();
  const index = useProjectIndex();
  const workflow = useProjectWorkflow(projectId);
  const { memory, remember } = useProjectMemory(projectId);
  const project = projectId === null ? undefined : index.byId.get(projectId);

  const { own, sections, openCount } = useMemo(() => {
    const own = (tasks ?? []).filter((task) => task.projectId === projectId);
    return {
      own,
      sections: (allSections ?? []).filter(
        (section) => section.projectId === projectId,
      ),
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

  const tab = chooseTab({
    inProject: project !== undefined,
    requested,
    memory,
  });
  const next = nextUp(own, todayKey());
  const openTab = (target: ProjectTab) => {
    if (remembersTab(target)) remember({ tab: target });
    if (projectId !== null)
      void navigate({
        to: '/projects/$projectId',
        params: { projectId },
        search: { tab: target },
      });
  };

  return (
    <Page>
      <ProjectHeader
        project={project}
        openCount={openCount}
        tabs={project ? PROJECT_TABS : []}
        tab={tab}
        onTab={openTab}
        onAddTask={() => newTask({ projectId })}
        next={next}
      />

      {tab === 'notes' && project ? (
        <Suspense>
          <ProjectCanvas projectId={project.id} />
        </Suspense>
      ) : tab === 'focus' && project ? (
        <ProjectFocus projectId={project.id} />
      ) : tab === 'settings' && project ? (
        <ProjectSettings project={project} />
      ) : (
        <ProjectTasks
          projectId={projectId}
          project={project}
          workflow={workflow}
          own={own}
          sections={sections}
          openCount={openCount}
          next={next}
          onOpenNotes={() => openTab('notes')}
          onOpenFocus={() => openTab('focus')}
        />
      )}
    </Page>
  );
}
