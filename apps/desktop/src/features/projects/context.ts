import type { Milestone, Project, Task } from '@/bindings';
import type { DateKey } from '@/lib/time';

const COMING_UP_LIMIT = 5;
const NOTE_LINE_LIMIT = 8;

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export type ComingItem = {
  key: string;
  date: DateKey;
  label: string;
  note?: string;
  taskId?: Task['id'];
};

const isActionable = (task: Task) =>
  task.completedAt === null &&
  task.kind === 'task' &&
  !task.someday &&
  task.statusCategory !== 'backlog' &&
  task.waitingOn.length === 0;

export function nextUp(tasks: Task[]): Task | undefined {
  const actionable = tasks.filter(isActionable);
  const dated = actionable
    .filter((task) => task.dueDate !== null)
    .sort(
      (a, b) =>
        (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
        (a.dueTime ?? 0) - (b.dueTime ?? 0),
    );
  return (
    dated[0] ??
    actionable
      .filter((task) => task.parentId === null)
      .sort((a, b) => a.position - b.position)[0]
  );
}

export function comingUp(
  tasks: Task[],
  milestones: Milestone[],
  project: Project,
  today: DateKey,
  nextId?: Task['id'],
): ComingItem[] {
  const open = tasks.filter(
    (task) =>
      task.completedAt === null &&
      task.kind !== 'record' &&
      task.statusCategory !== 'backlog',
  );
  const items: ComingItem[] = [
    ...open.flatMap((task) =>
      task.id !== nextId &&
      task.dueDate !== null &&
      (task.kind === 'task' || task.dueDate >= today)
        ? [
            {
              key: `due-${task.id}`,
              date: task.dueDate,
              label: task.title,
              taskId: task.id,
            },
          ]
        : [],
    ),
    ...open.flatMap((task) =>
      task.deadline !== null
        ? [
            {
              key: `deadline-${task.id}`,
              date: task.deadline,
              label: task.title,
              note: 'Deadline',
              taskId: task.id,
            },
          ]
        : [],
    ),
    ...milestones.flatMap((milestone) =>
      milestone.date !== null && milestone.date >= today
        ? [
            {
              key: `milestone-${milestone.id}`,
              date: milestone.date,
              label: milestone.name,
              note: 'Milestone',
            },
          ]
        : [],
    ),
    ...(project.targetDate !== null && project.targetDate >= today
      ? [
          {
            key: 'target',
            date: project.targetDate,
            label: 'Target date',
          },
        ]
      : []),
  ];
  return items
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, COMING_UP_LIMIT);
}

export function noteLines(html: string): string[] {
  return html
    .replace(/<\/(p|h[1-3]|li|blockquote|pre)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, NOTE_LINE_LIMIT);
}
