import type { Project, Task } from '@/bindings';
import { PageBody } from '@/components/page';
import { useTaskDialog } from '@/features/tasks/task-dialog-context';
import { useWorkflow } from '@/features/workflow/api';
import { todayKey } from '@/lib/time';

import { Timeline, TimelineLegend } from './Timeline';
import {
  firstDate,
  isScheduled,
  projectLines,
  taskMarks,
} from './timeline-rows';

export function ProjectTimeline({
  project,
  own,
}: {
  project: Project;
  own: Task[];
}) {
  const { openTask } = useTaskDialog();
  const { data: workflow } = useWorkflow();
  const today = todayKey();
  const milestones = (workflow?.milestones ?? []).filter(
    (milestone) => milestone.projectId === project.id,
  );
  const scheduled = own
    .filter(isScheduled)
    .sort((a, b) => firstDate(a).localeCompare(firstDate(b)));
  const undated = own.filter(
    (task) =>
      task.completedAt === null && task.kind !== 'record' && !isScheduled(task),
  ).length;

  const rows = scheduled.map((task) => ({
    id: String(task.id),
    label: task.title,
    color: project.color,
    marks: taskMarks(task, today),
    span:
      task.dueDate && task.deadline && task.dueDate < task.deadline
        ? { from: task.dueDate, to: task.deadline }
        : undefined,
    onOpen: () => openTask(task.id),
  }));

  return (
    <PageBody className="px-10 pt-5">
      {rows.length === 0 ? (
        <p className="text-sm text-foreground/55">
          No open task has a due date or deadline yet. Give tasks dates to see
          them here.
        </p>
      ) : (
        <>
          <Timeline
            heading="Task"
            rows={rows}
            lines={projectLines(project, milestones)}
          />
          <TimelineLegend />
        </>
      )}
      {undated > 0 && rows.length > 0 && (
        <p className="mt-1 text-xs text-foreground/45">
          {undated} open {undated === 1 ? 'task has' : 'tasks have'} no date and{' '}
          {undated === 1 ? 'isn’t' : 'aren’t'} shown.
        </p>
      )}
    </PageBody>
  );
}
