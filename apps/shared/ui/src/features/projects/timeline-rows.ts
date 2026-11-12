import type { Id, Milestone, Project, Task } from '@/backend';
import type { DateKey } from '@/lib/time';

import type { TimelineLine, TimelineMark, TimelineRow } from './Timeline';

export const isScheduled = (task: Task) =>
  task.kind !== 'record' &&
  task.completedAt === null &&
  (task.dueDate !== null || task.deadline !== null);

const isOpenItem = (task: Task) =>
  task.kind !== 'record' && task.completedAt === null;

export function taskSpan(task: Task): TimelineRow['span'] {
  if (task.dueDate === null) return undefined;
  const end = [task.dueUntil, task.deadline]
    .filter((date): date is DateKey => date !== null && date > task.dueDate!)
    .sort()
    .at(-1);
  return end ? { from: task.dueDate, to: end } : undefined;
}

export function taskTimelineRows(
  tasks: Task[],
  today: DateKey,
  colorOf: (projectId: Id | null) => string,
  onOpen: (task: Task) => void,
): TimelineRow[] {
  const open = tasks.filter(isOpenItem);
  const dated = open
    .filter(isScheduled)
    .sort((a, b) => firstDate(a).localeCompare(firstDate(b)));
  const undated = open.filter((task) => !isScheduled(task));
  return [...dated, ...undated].map((task) => ({
    id: String(task.id),
    label: task.title,
    color: colorOf(task.projectId),
    marks: taskMarks(task, today),
    span: taskSpan(task),
    note: isScheduled(task) ? undefined : 'No date',
    onOpen: () => onOpen(task),
  }));
}

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
