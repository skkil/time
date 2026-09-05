import { useMemo } from 'react';

import type { Project, Task, TimeBlock } from '@/bindings';
import { useBlocks } from '@/features/planner/api';
import { useProjects } from '@/features/projects/api';
import { useTasks } from '@/features/tasks/api';
import {
  type DateKey,
  dateKeyOf,
  dayStart,
  mondayOf,
  shiftKey,
} from '@/lib/time';

export type DayPlan = {
  blocks: TimeBlock[];
  musts: Task[];
  due: Task[];
  earlier: Task[];
  doneToday: Task[];
  nextActions: { project: Project; task: Task }[];
  plannedSeconds: number;
};

const isOpen = (task: Task) => task.completedAt === null && !task.someday;

export function earlierTasks(tasks: Task[], date: DateKey) {
  return tasks
    .filter(
      (task) =>
        isOpen(task) &&
        task.dueDate !== null &&
        task.dueDate < date &&
        task.mustOn !== date,
    )
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
}

export function nextActions(projects: Project[], tasks: Task[]) {
  const firstOpen = new Map<number, Task>();
  for (const task of [...tasks].sort((a, b) => a.position - b.position)) {
    if (
      task.projectId !== null &&
      task.parentId === null &&
      isOpen(task) &&
      !firstOpen.has(task.projectId)
    )
      firstOpen.set(task.projectId, task);
  }
  return projects
    .filter((project) => !project.archived && project.status === 'active')
    .flatMap((project) => {
      const task = firstOpen.get(project.id);
      return task ? [{ project, task }] : [];
    });
}

export function useDayPlan(date: DateKey): DayPlan & { loading: boolean } {
  const { data: tasks, isPending } = useTasks();
  const { data: projects } = useProjects();
  const { data: weekBlocks } = useBlocks(mondayOf(date));

  return useMemo(() => {
    const inactive = new Set(
      (projects ?? [])
        .filter((project) => project.archived || project.status !== 'active')
        .map((project) => project.id),
    );
    const all = (tasks ?? []).filter(
      (task) => task.projectId === null || !inactive.has(task.projectId),
    );
    const blocks = (weekBlocks ?? [])
      .filter((block) => dateKeyOf(block.startAt) === date)
      .sort((a, b) => a.startAt - b.startAt);
    const blocked = new Set(blocks.map((block) => block.taskId));
    const start = dayStart(date);
    const end = dayStart(shiftKey(date, 1));
    const musts = all.filter(
      (task) => isOpen(task) && task.mustOn === date && !blocked.has(task.id),
    );
    const due = all.filter(
      (task) =>
        isOpen(task) &&
        task.dueDate === date &&
        task.mustOn !== date &&
        !blocked.has(task.id),
    );
    const earlier = earlierTasks(all, date);
    const shown = new Set([
      ...blocked,
      ...musts.map((task) => task.id),
      ...due.map((task) => task.id),
      ...earlier.map((task) => task.id),
    ]);
    return {
      loading: isPending,
      blocks,
      musts,
      due,
      earlier,
      doneToday: all.filter(
        (task) =>
          task.completedAt !== null &&
          task.completedAt >= start &&
          task.completedAt < end,
      ),
      nextActions: nextActions(projects ?? [], all).filter(
        ({ task }) => !shown.has(task.id),
      ),
      plannedSeconds: blocks.reduce(
        (sum, block) => sum + block.endAt - block.startAt,
        0,
      ),
    };
  }, [tasks, projects, weekBlocks, date, isPending]);
}
