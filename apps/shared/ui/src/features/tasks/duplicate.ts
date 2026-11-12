import type { Id, Task } from '@/backend';

const sameSlot = (a: Task, b: Task) =>
  a.projectId === b.projectId &&
  a.sectionId === b.sectionId &&
  a.parentId === b.parentId;

const byPosition = (a: Task, b: Task) =>
  a.position - b.position || a.id.localeCompare(b.id);

export function duplicatePlan(tasks: Task[], original: Task) {
  const siblings = tasks
    .filter((task) => task.completedAt === null && sameSlot(task, original))
    .sort(byPosition);
  const at = siblings.findIndex((task) => task.id === original.id);
  const before: Id | null = siblings[at + 1]?.id ?? null;

  const steps: Task[] = [];
  const queue = [original.id];
  while (queue.length > 0) {
    const parentId = queue.shift();
    const children = tasks
      .filter((task) => task.parentId === parentId && task.completedAt === null)
      .sort(byPosition);
    steps.push(...children);
    queue.push(...children.map((child) => child.id));
  }
  return { before, steps };
}
