import type { Id, Task } from '@/bindings';

export type Container = {
  projectId: Id | null;
  sectionId: Id | null;
  parentId: Id | null;
};

export type DropData =
  { type: 'task'; task: Task } | { type: 'container'; container: Container };

export const MAX_INDENTED_DEPTH = 6;

export const containerKey = (container: Container) =>
  `c:${container.projectId}:${container.sectionId}:${container.parentId}`;

export const containerOf = (task: Task): Container => ({
  projectId: task.projectId,
  sectionId: task.sectionId,
  parentId: task.parentId,
});

const sameContainer = (a: Container, b: Container) =>
  a.projectId === b.projectId &&
  a.sectionId === b.sectionId &&
  a.parentId === b.parentId;

export function openSiblings(tasks: Task[], container: Container) {
  return tasks.filter(
    (task) =>
      task.completedAt === null && sameContainer(containerOf(task), container),
  );
}
