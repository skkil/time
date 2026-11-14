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

export function comingUp(
  tasks: Task[],
  milestones: Milestone[],
  project: Project,
  today: DateKey,
): ComingItem[] {
  const open = tasks.filter(
    (task) =>
      task.completedAt === null &&
      task.kind !== 'record' &&
      task.statusCategory !== 'backlog',
  );
  const tasksAhead = open.flatMap((task) => {
    const dates: ComingItem[] = [];
    if (task.dueDate !== null && task.dueDate >= today)
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
