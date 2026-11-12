import type { Project } from '@/backend';
import { PageBody } from '@/components/page';
import { useTasks } from '@/features/tasks/api';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { useWorkflow } from '@/features/workflow/api';
import { todayKey } from '@/lib/time';

import { Timeline, TimelineLegend } from './Timeline';
import { useProjectIndex } from './api';
import { projectLines, taskTimelineRows } from './timeline-rows';
import { descendantIds } from './tree';

export function ProjectTimeline({ project }: { project: Project }) {
  const { data: tasks = [] } = useTasks();
  const { openTask } = useTaskDialog();
  const { data: workflow } = useWorkflow();
  const index = useProjectIndex();
  const node = index.byId.get(project.id);
  const subtree = node ? descendantIds(node) : new Set([project.id]);
  const milestones = (workflow?.milestones ?? []).filter(
    (milestone) => milestone.projectId === project.id,
  );
  const rows = taskTimelineRows(
    tasks.filter(
      (task) => task.projectId !== null && subtree.has(task.projectId),
    ),
    todayKey(),
    (projectId) =>
      (projectId === null ? undefined : index.byId.get(projectId)?.color) ??
      project.color,
    (task) => openTask(task.id),
  );

  return (
    <PageBody className="flex min-h-0 flex-col px-4 pt-5 pb-6 sm:px-10">
      {rows.length === 0 ? (
        <p className="text-sm text-foreground/75">
          No open tasks yet. Add tasks to see them here.
        </p>
      ) : (
        <>
          <Timeline
            fill
            heading="Task"
            rows={rows}
            lines={projectLines(project, milestones)}
          />
          <TimelineLegend />
        </>
      )}
    </PageBody>
  );
}
