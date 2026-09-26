import type { Milestone, Project, Task } from '@/backend';
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

const byDueThenPosition = (a: Task, b: Task) =>
  (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
  (a.dueTime ?? 0) - (b.dueTime ?? 0) ||
  a.position - b.position;

/**
 * Next is the single task to do now:
 * 1. work due today or earlier, highest priority first, then oldest date;
 * 2. otherwise the earliest dated task, ties by priority;
 * 3. otherwise the top-level task with the highest priority, then by order.
 */
export function nextUp(tasks: Task[], today: DateKey): Task | undefined {
  const actionable = tasks.filter(isActionable);
  const urgent = actionable
    .filter((task) => task.dueDate !== null && task.dueDate <= today)
    .sort((a, b) => a.priority - b.priority || byDueThenPosition(a, b));
  const later = actionable
    .filter((task) => task.dueDate !== null && task.dueDate > today)
    .sort(
      (a, b) =>
        (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
        a.priority - b.priority ||
        byDueThenPosition(a, b),
    );
  const undated = actionable
    .filter((task) => task.dueDate === null && task.parentId === null)
    .sort((a, b) => a.priority - b.priority || a.position - b.position);
  return urgent[0] ?? later[0] ?? undated[0];
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
  const tasksAhead = open.flatMap((task) => {
    const dates: ComingItem[] = [];
    if (task.id !== nextId && task.dueDate !== null && task.dueDate >= today)
      dates.push({
        key: `due-${task.id}`,
        date: task.dueDate,
        label: task.title,
        taskId: task.id,
      });
    if (task.deadline !== null && task.deadline >= today)
      dates.push({
        key: `deadline-${task.id}`,
        date: task.deadline,
        label: task.title,
        note: 'Deadline',
        taskId: task.id,
      });
    const first = dates.sort((a, b) => a.date.localeCompare(b.date))[0];
    return first ? [first] : [];
  });
  const items: ComingItem[] = [
    ...tasksAhead,
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
