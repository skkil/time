import type { Milestone, Project, Task } from '@/bindings';
import type { DateKey } from '@/lib/time';

import type { TimelineLine, TimelineMark } from './Timeline';

export const isScheduled = (task: Task) =>
  task.kind !== 'record' &&
  task.completedAt === null &&
  (task.dueDate !== null || task.deadline !== null);

export function taskMarks(task: Task, today: DateKey): TimelineMark[] {
  const late = (date: DateKey) =>
    date < today && task.statusCategory !== 'backlog';
  return [
    ...(task.dueDate
      ? [
          {
            date: task.dueDate,
            kind: 'due' as const,
            label: task.title,
            late: late(task.dueDate),
          },
        ]
      : []),
    ...(task.deadline
      ? [
          {
            date: task.deadline,
            kind: 'deadline' as const,
            label: task.title,
            late: late(task.deadline),
          },
        ]
      : []),
  ];
}

export function projectMarks(
  project: Project,
  milestones: Milestone[],
): TimelineMark[] {
  return [
    ...milestones
      .filter((milestone) => milestone.date !== null)
      .map((milestone) => ({
        date: milestone.date as DateKey,
        kind: 'milestone' as const,
        label: milestone.name,
      })),
    ...(project.targetDate
      ? [
          {
            date: project.targetDate,
            kind: 'target' as const,
            label: project.name,
          },
        ]
      : []),
  ];
}

export function projectLines(
  project: Project,
  milestones: Milestone[],
): TimelineLine[] {
  return projectMarks(project, milestones).map((mark) => ({
    date: mark.date,
    label: mark.kind === 'target' ? 'Target' : mark.label,
  }));
}

export const firstDate = (task: Task) =>
  [task.dueDate, task.deadline].filter(Boolean).sort()[0] as DateKey;
