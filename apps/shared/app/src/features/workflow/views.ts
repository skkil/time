import type {
  Id,
  ItemStatus,
  ItemType,
  Milestone,
  SavedView,
  Section,
  Task,
  TaskInput,
} from '@/backend';
import { type DateKey, mondayOf, shiftKey } from '@/lib/time';

export type ViewFilter = {
  hideDone?: boolean;
  hideBacklog?: boolean;
  hideWaiting?: boolean;
  categories?: string[];
  typeIds?: Id[];
};

export type ViewSpec = Pick<SavedView, 'layout' | 'groupBy' | 'sort'> & {
  filter: ViewFilter;
};

export type Group = {
  key: string;
  label: string;
  icon?: string;
  category?: string;
  tasks: Task[];
  value:
    | { by: 'status'; id: Id }
    | { by: 'type'; id: Id | null }
    | { by: 'milestone'; id: Id | null }
    | { by: 'section'; id: Id | null }
    | { by: 'none' }
    | { by: 'date'; date: DateKey | null };
};

export type WorkflowParts = {
  types: ItemType[];
  statuses: ItemStatus[];
  milestones: Milestone[];
  sections: Section[];
};

export function parseFilter(text: string): ViewFilter {
  try {
    const value = JSON.parse(text);
    return typeof value === 'object' && value !== null ? value : {};
  } catch {
    return {};
  }
}

export const specOf = (view: SavedView): ViewSpec => ({
  layout: view.layout,
  groupBy: view.groupBy,
  sort: view.sort,
  filter: parseFilter(view.filter),
});

const closed = (task: Task) =>
  task.completedAt !== null ||
  task.statusCategory === 'done' ||
  task.statusCategory === 'dropped';

export function filterTasks(tasks: Task[], spec: ViewSpec): Task[] {
  const { filter } = spec;
  return tasks.filter((task) => {
    if (task.parentId !== null) return false;
    if (filter.hideDone && closed(task)) return false;
    if (spec.layout !== 'board' && spec.groupBy !== 'status' && closed(task))
      return false;
    if (filter.hideBacklog && task.statusCategory === 'backlog') return false;
    if (filter.hideWaiting && task.waitingOn.length > 0 && !closed(task))
      return false;
    if (
      filter.categories?.length &&
      !filter.categories.includes(task.statusCategory ?? '')
    )
      return false;
    if (
      filter.typeIds?.length &&
      (task.typeId === null || !filter.typeIds.includes(task.typeId))
    )
      return false;
    return true;
  });
}

const byNullable = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b);

export function sortTasks(tasks: Task[], sort: string): Task[] {
  const sorted = [...tasks];
  const compare: Record<string, (a: Task, b: Task) => number> = {
    manual: (a, b) => a.position - b.position,
    date: (a, b) =>
      byNullable(a.dueDate, b.dueDate) || (a.dueTime ?? 0) - (b.dueTime ?? 0),
    deadline: (a, b) => byNullable(a.deadline, b.deadline),
    priority: (a, b) => a.priority - b.priority,
    title: (a, b) => a.title.localeCompare(b.title),
    created: (a, b) => b.createdAt - a.createdAt,
  };
  return sorted.sort(
    (a, b) =>
      (compare[sort] ?? compare.manual)(a, b) || a.position - b.position,
  );
}

export function groupTasks(
  tasks: Task[],
  groupBy: string,
  parts: WorkflowParts,
  today: DateKey,
): Group[] {
  const pick = (test: (task: Task) => boolean) => tasks.filter(test);
  switch (groupBy) {
    case 'status':
      return parts.statuses.map((status) => ({
        key: `status-${status.id}`,
        label: status.name,
        category: status.category,
        tasks: pick((task) => task.statusId === status.id),
        value: { by: 'status', id: status.id },
      }));
    case 'type':
      return [
        ...parts.types.map((type) => ({
          key: `type-${type.id}`,
          label: type.name,
          icon: type.icon,
          tasks: pick((task) => task.typeId === type.id),
          value: { by: 'type' as const, id: type.id },
        })),
        {
          key: 'type-none',
          label: 'No type',
          tasks: pick((task) => task.typeId === null),
          value: { by: 'type' as const, id: null },
        },
      ];
    case 'milestone':
      return [
        ...parts.milestones.map((milestone) => ({
          key: `milestone-${milestone.id}`,
          label: milestone.name,
          tasks: pick((task) => task.milestoneId === milestone.id),
          value: { by: 'milestone' as const, id: milestone.id },
        })),
        {
          key: 'milestone-none',
          label: 'None',
          tasks: pick((task) => task.milestoneId === null),
          value: { by: 'milestone' as const, id: null },
        },
      ];
    case 'section':
      return [
        {
          key: 'section-none',
          label: 'No section',
          tasks: pick((task) => task.sectionId === null),
          value: { by: 'section' as const, id: null },
        },
        ...parts.sections.map((section) => ({
          key: `section-${section.id}`,
          label: section.name,
          tasks: pick((task) => task.sectionId === section.id),
          value: { by: 'section' as const, id: section.id },
        })),
      ];
    case 'date': {
      const weekEnd = shiftKey(mondayOf(today), 7);
      const buckets: [
        string,
        string,
        (d: DateKey | null) => boolean,
        DateKey | null,
      ][] = [
        ['overdue', 'Earlier', (d) => d !== null && d < today, today],
        ['today', 'Today', (d) => d === today, today],
        [
          'week',
          'This week',
          (d) => d !== null && d > today && d < weekEnd,
          shiftKey(today, 1),
        ],
        ['later', 'Later', (d) => d !== null && d >= weekEnd, weekEnd],
        ['none', 'No date', (d) => d === null, null],
      ];
      return buckets.map(([key, label, test, date]) => ({
        key: `date-${key}`,
        label,
        tasks: pick((task) => test(task.dueDate)),
        value: { by: 'date' as const, date },
      }));
    }
    default:
      return [
        { key: 'all', label: 'All', tasks, value: { by: 'none' as const } },
      ];
  }
}

export const daysSince = (task: Task, now: number) =>
  Math.floor((now - (task.statusChangedAt ?? task.createdAt)) / 86_400);

export const groupDefaults = (
  group: Group,
  projectId: Id,
): Partial<TaskInput> => ({
  projectId,
  ...(group.value.by === 'section' ? { sectionId: group.value.id } : {}),
  ...(group.value.by === 'date' && group.value.date
    ? { dueDate: group.value.date }
    : {}),
});
