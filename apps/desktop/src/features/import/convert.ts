import type { ImportProject, ImportTask, TaskInput } from '@/bindings';
import { PROJECT_COLORS } from '@/features/projects/tree';
import { parseQuickAdd } from '@/features/tasks/quick-add/parser/parse';
import type { DateKey } from '@/lib/time';

import { parseCsv } from './csv';

export type ImportSource = { name: string; text: string };

type Columns = Record<string, number>;

const TODOIST_COLUMNS = ['TYPE', 'CONTENT', 'PRIORITY', 'INDENT'];

const GENERIC_COLUMNS: Record<string, string[]> = {
  title: ['title', 'task', 'name', 'content'],
  notes: ['notes', 'description', 'note'],
  due: ['due', 'date', 'due date'],
  priority: ['priority'],
  project: ['project', 'list'],
  section: ['section'],
};

const projectColor = (index: number) =>
  PROJECT_COLORS[1 + (index % (PROJECT_COLORS.length - 1))];

function columnsOf(header: string[]): Columns {
  return Object.fromEntries(
    header.map((name, i) => [name.trim().toLowerCase(), i]),
  );
}

function pick(row: string[], columns: Columns, names: string[]) {
  for (const name of names) {
    const index = columns[name];
    if (index !== undefined && row[index] !== undefined)
      return row[index].trim();
  }
  return '';
}

function blankTask(title: string, notes: string): TaskInput {
  return {
    title,
    notes,
    projectId: null,
    sectionId: null,
    parentId: null,
    priority: 4,
    dueDate: null,
    dueTime: null,
    deadline: null,
    recurrence: null,
    estimateMinutes: null,
  };
}

function withDue(task: TaskInput, phrase: string, today: DateKey): TaskInput {
  if (!phrase) return task;
  const parsed = parseQuickAdd(phrase, {
    today,
    nowMinutes: 0,
    projects: [],
    sections: [],
    projectId: null,
  });
  const understood =
    parsed.title.trim() === '' &&
    (parsed.dueDate !== undefined || parsed.recurrence !== undefined);
  if (!understood) {
    const note = `Due: ${phrase}`;
    return { ...task, notes: task.notes ? `${task.notes}\n\n${note}` : note };
  }
  return {
    ...task,
    dueDate: parsed.dueDate ?? null,
    dueTime: parsed.dueTime ?? null,
    recurrence: parsed.recurrence ?? null,
  };
}

function deadlineOf(phrase: string, today: DateKey): DateKey | null {
  if (!phrase) return null;
  return withDue(blankTask('', ''), phrase, today).dueDate;
}

function minutesOf(amount: string, unit: string) {
  const value = Number(amount);
  if (!amount || !Number.isFinite(value) || value <= 0) return null;
  return unit.toLowerCase().startsWith('day')
    ? Math.round(value * 24 * 60)
    : Math.round(value);
}

const clampPriority = (value: number) =>
  Number.isInteger(value) && value >= 1 && value <= 4 ? value : 4;

function fromTodoist(
  name: string,
  rows: string[][],
  columns: Columns,
  today: DateKey,
): Omit<ImportProject, 'color'> {
  const project: Omit<ImportProject, 'color'> = {
    name,
    tasks: [],
    sections: [],
  };
  let bucket = project.tasks;
  let stack: ImportTask[] = [];
  const field = (row: string[], key: string) => pick(row, columns, [key]);

  for (const row of rows) {
    const type = field(row, 'type').toLowerCase();
    const content = field(row, 'content');
    if (type === 'section') {
      const section = { name: content || 'Section', tasks: [] };
      project.sections.push(section);
      bucket = section.tasks;
      stack = [];
    } else if (type === 'note') {
      const last = stack.at(-1);
      if (last && content)
        last.task.notes = last.task.notes
          ? `${last.task.notes}\n\n${content}`
          : content;
    } else if (type === 'task' && content) {
      const title = content.replace(/^\*\s+/, '');
      let task = blankTask(title, field(row, 'description'));
      task.priority = clampPriority(5 - Number(field(row, 'priority')));
      task.estimateMinutes = minutesOf(
        field(row, 'duration'),
        field(row, 'duration_unit'),
      );
      task.deadline = deadlineOf(field(row, 'deadline'), today);
      task = withDue(task, field(row, 'date'), today);
      const item: ImportTask = { task, children: [] };
      const depth = Math.max(1, Number(field(row, 'indent')) || 1);
      stack = stack.slice(0, depth - 1);
      const parent = stack.at(-1);
      (parent ? parent.children : bucket).push(item);
      stack.push(item);
    }
  }
  return project;
}

function fromGeneric(
  name: string,
  rows: string[][],
  columns: Columns,
  today: DateKey,
): Omit<ImportProject, 'color'>[] {
  const projects = new Map<string, Omit<ImportProject, 'color'>>();
  for (const row of rows) {
    const value = (key: string) => pick(row, columns, GENERIC_COLUMNS[key]);
    const title = value('title');
    if (!title) continue;
    const projectName = value('project') || name;
    let project = projects.get(projectName);
    if (!project) {
      project = { name: projectName, tasks: [], sections: [] };
      projects.set(projectName, project);
    }
    let task = blankTask(title, value('notes'));
    const priority = value('priority').replace(/^p/i, '');
    if (priority) task.priority = clampPriority(Number(priority));
    task = withDue(task, value('due'), today);
    const sectionName = value('section');
    let bucket = project.tasks;
    if (sectionName) {
      let section = project.sections.find((s) => s.name === sectionName);
      if (!section) {
        section = { name: sectionName, tasks: [] };
        project.sections.push(section);
      }
      bucket = section.tasks;
    }
    bucket.push({ task, children: [] });
  }
  return [...projects.values()];
}

const projectName = (fileName: string) =>
  fileName.replace(/\s*\[\d+\]\s*$/, '').trim() || 'Imported';

export function toImport(
  sources: ImportSource[],
  today: DateKey,
): ImportProject[] {
  const projects = sources.flatMap((source) => {
    const [header, ...rows] = parseCsv(source.text).filter((row) =>
      row.some((cell) => cell.trim() !== ''),
    );
    if (!header) return [];
    const columns = columnsOf(header);
    const name = projectName(source.name);
    const todoist = TODOIST_COLUMNS.every(
      (column) => columns[column.toLowerCase()] !== undefined,
    );
    return todoist
      ? [fromTodoist(name, rows, columns, today)]
      : fromGeneric(name, rows, columns, today);
  });
  return projects
    .filter((project) => project.tasks.length + project.sections.length > 0)
    .map((project, i) => ({ ...project, color: projectColor(i) }));
}

export function countTasks(projects: ImportProject[]) {
  const count = (tasks: ImportTask[]): number =>
    tasks.reduce((sum, item) => sum + 1 + count(item.children), 0);
  return projects.reduce(
    (sum, project) =>
      sum +
      count(project.tasks) +
      project.sections.reduce((n, section) => n + count(section.tasks), 0),
    0,
  );
}
