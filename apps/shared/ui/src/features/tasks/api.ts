import { describeMove, movedTask } from '@skkil-time/rules/move';
import { EMPTY_TASK } from '@skkil-time/rules/quick-add/task';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  type BlockMove,
  type Date as DateKey,
  type Id,
  type MoveTarget,
  type Section,
  type Task,
  type TaskInput,
  type TaskPlacement,
  type TaskSnapshot,
  commands,
} from '@/backend';
import { formatDate } from '@/features/tasks/meta';
import { keys } from '@/lib/query';
import { offerUndo, quoted } from '@/lib/undo';

export function useTasks() {
  return useQuery({ queryKey: keys.tasks, queryFn: commands.listTasks });
}

export function useSections() {
  return useQuery({ queryKey: keys.sections, queryFn: commands.listSections });
}

export function useTask(id: Id | null) {
  const { byId } = useTaskIndex();
  const listed = id === null ? undefined : byId.get(id);
  const { data: unlisted } = useQuery({
    queryKey: keys.task(id ?? ''),
    queryFn: () => commands.getTask(id ?? ''),
    enabled: id !== null && listed === undefined,
  });
  return listed ?? (id === null ? undefined : unlisted);
}

export function useTaskIndex() {
  const { data } = useTasks();
  return useMemo(() => {
    const byId = new Map<Id, Task>();
    const children = new Map<Id, Task[]>();
    const holding = new Map<Id, Task[]>();
    for (const task of data ?? []) {
      byId.set(task.id, task);
      for (const blocker of task.blockedBy) {
        const held = holding.get(blocker) ?? [];
        held.push(task);
        holding.set(blocker, held);
      }
      if (task.parentId !== null) {
        const siblings = children.get(task.parentId) ?? [];
        siblings.push(task);
        children.set(task.parentId, siblings);
      }
    }
    return { byId, children, holding };
  }, [data]);
}

export { EMPTY_TASK } from '@skkil-time/rules/quick-add/task';

export const stepInput = (parent: Task, title: string): TaskInput => ({
  ...EMPTY_TASK,
  title,
  projectId: parent.projectId,
  sectionId: parent.sectionId,
  parentId: parent.id,
});

export const taskToInput = (task: Task): TaskInput => ({
  title: task.title,
  notes: task.notes,
  projectId: task.projectId,
  sectionId: task.sectionId,
  parentId: task.parentId,
  priority: task.priority,
  dueDate: task.dueDate,
  dueTime: task.dueTime,
  deadline: task.deadline,
  recurrence: task.recurrence,
  estimateMinutes: task.estimateMinutes,
});

function useTaskCache() {
  const client = useQueryClient();
  return {
    client,
    async freeze() {
      await client.cancelQueries({ queryKey: keys.tasks });
      return client.getQueryData<Task[]>(keys.tasks);
    },
    current: () => client.getQueryData<Task[]>(keys.tasks),
    update: (change: (tasks: Task[]) => Task[]) =>
      client.setQueryData<Task[]>(keys.tasks, (tasks) =>
        tasks ? change(tasks) : tasks,
      ),
    replace: (task: Task) =>
      client.setQueryData<Task[]>(keys.tasks, (tasks) =>
        tasks?.map((current) => (current.id === task.id ? task : current)),
      ),
    restore: (tasks: Task[] | undefined) =>
      client.setQueryData(keys.tasks, tasks),
    refresh: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.tasks }),
        client.invalidateQueries({ queryKey: keys.allBlocks }),
        client.invalidateQueries({ queryKey: keys.review }),
      ]),
    offerRestore: (message: string, snapshot: TaskSnapshot) =>
      offerUndo(message, async () => {
        await commands.restoreTasks(snapshot);
        await Promise.all([
          client.invalidateQueries({ queryKey: keys.tasks }),
          client.invalidateQueries({ queryKey: keys.allBlocks }),
          client.invalidateQueries({ queryKey: keys.review }),
          client.invalidateQueries({ queryKey: keys.allEntries }),
        ]);
      }),
  };
}

function titleOf(ids: Id[], tasks: Task[] | undefined) {
  if (ids.length > 1) return `${ids.length} tasks`;
  const task = tasks?.find((candidate) => candidate.id === ids[0]);
  return task ? quoted(task.title) : 'Task';
}

async function withSnapshot<T>(ids: Id[], change: () => Promise<T>) {
  const snapshot = await commands.captureTasks(ids);
  return { snapshot, result: await change() };
}

export function useCreateTask() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: (input: TaskInput) => commands.createTask(input),
    onSuccess: (task) => {
      cache.update((tasks) => [...tasks, task]);
      return cache.refresh();
    },
  });
}

export function useUpdateTask() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: TaskInput }) =>
      commands.updateTask(id, input),
    onMutate: async ({ id, input }) => {
      const previous = await cache.freeze();
      cache.update((tasks) =>
        tasks.map((task) => (task.id === id ? { ...task, ...input } : task)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => cache.restore(context?.previous),
    onSettled: () => cache.refresh(),
  });
}

export function useMoveTask() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: ({ id, placement }: { id: Id; placement: TaskPlacement }) =>
      withSnapshot([id], () => commands.moveTask(id, placement)),
    onMutate: async ({ id, placement }) => {
      const previous = await cache.freeze();
      cache.update((tasks) => {
        const moving = tasks.find((task) => task.id === id);
        if (!moving) return tasks;
        const moved = {
          ...moving,
          projectId: placement.projectId,
          sectionId: placement.sectionId,
          parentId: placement.parentId,
        };
        const rest = tasks.filter((task) => task.id !== id);
        const at = rest.findIndex((task) => task.id === placement.before);
        if (at === -1) return [...rest, moved];
        return [...rest.slice(0, at), moved, ...rest.slice(at)];
      });
      return { previous };
    },
    onSuccess: ({ snapshot }, { id, placement }, context) => {
      const before = context.previous?.find((task) => task.id === id);
      const changedPlace =
        before?.projectId !== placement.projectId ||
        before?.sectionId !== placement.sectionId ||
        before?.parentId !== placement.parentId;
      if (changedPlace)
        cache.offerRestore(
          `Moved ${titleOf([id], context.previous)}`,
          snapshot,
        );
    },
    onError: (_error, _vars, context) => cache.restore(context?.previous),
    onSettled: () => cache.refresh(),
  });
}

export function useRescheduleTasks() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: ({ ids, dueDate }: { ids: Id[]; dueDate: DateKey | null }) =>
      withSnapshot(ids, () => commands.rescheduleTasks(ids, dueDate)),
    onMutate: async ({ ids, dueDate }) => {
      const previous = await cache.freeze();
      cache.update((tasks) =>
        tasks.map((task) =>
          ids.includes(task.id)
            ? {
                ...task,
                dueDate,
                dueTime: dueDate ? task.dueTime : null,
                recurrence: dueDate ? task.recurrence : null,
              }
            : task,
        ),
      );
      return { previous };
    },
    onSuccess: ({ snapshot }, { ids, dueDate }, context) => {
      const title = titleOf(ids, context.previous);
      cache.offerRestore(
        dueDate
          ? `Moved ${title} to ${formatDate(dueDate)}`
          : `Removed the date from ${title}`,
        snapshot,
      );
    },
    onError: (_error, _vars, context) => cache.restore(context?.previous),
    onSettled: () => cache.refresh(),
  });
}

export type MoveTasks = {
  ids: Id[];
  target: MoveTarget;
  blocks?: BlockMove;
};

export function useMoveTasks() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: ({ ids, target, blocks = 'follow' }: MoveTasks) =>
      withSnapshot(ids, () => commands.moveTasks(ids, target, blocks)),
    onMutate: async ({ ids, target }) => {
      const previous = await cache.freeze();
      cache.update((tasks) =>
        tasks.map((task) =>
          ids.includes(task.id) ? movedTask(task, target) : task,
        ),
      );
      return { previous };
    },
    onSuccess: ({ snapshot, result }, { ids, target }, context) =>
      cache.offerRestore(
        describeMove(titleOf(ids, context.previous), target, result),
        snapshot,
      ),
    onError: (_error, _vars, context) => cache.restore(context?.previous),
    onSettled: () => cache.refresh(),
  });
}

export function useSetTaskCompleted() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: ({ id, completed }: { id: Id; completed: boolean }) =>
      withSnapshot([id], () => commands.setTaskCompleted(id, completed)),
    onMutate: async ({ id, completed }) => {
      const previous = await cache.freeze();
      const target = previous?.find((task) => task.id === id);
      if (!target?.recurrence || !completed)
        cache.update((tasks) =>
          tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  completedAt: completed ? Math.floor(Date.now() / 1000) : null,
                }
              : task,
          ),
        );
      return { previous };
    },
    onSuccess: ({ snapshot, result }, { completed }) => {
      if (!completed) return;
      const next = result.completedAt === null ? result.dueDate : null;
      cache.offerRestore(
        next
          ? `${quoted(result.title)} is next on ${formatDate(next)}`
          : `${quoted(result.title)} done`,
        snapshot,
      );
    },
    onError: (_error, _vars, context) => cache.restore(context?.previous),
    onSettled: () =>
      Promise.all([
        cache.refresh(),
        cache.client.invalidateQueries({ queryKey: keys.timer }),
        cache.client.invalidateQueries({ queryKey: keys.allEntries }),
      ]),
  });
}

export function useSetTaskOutcome() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: ({ id, outcomeId }: { id: Id; outcomeId: Id | null }) =>
      commands.setTaskOutcome(id, outcomeId),
    onSuccess: (task) => {
      cache.replace(task);
      return cache.refresh();
    },
  });
}

export function useTaskDependency() {
  const cache = useTaskCache();
  const onSuccess = (task: Task) => {
    cache.replace(task);
    return cache.refresh();
  };
  return {
    add: useMutation({
      mutationFn: ({ id, blockedById }: { id: Id; blockedById: Id }) =>
        commands.addTaskDependency(id, blockedById),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: ({ id, blockedById }: { id: Id; blockedById: Id }) =>
        commands.removeTaskDependency(id, blockedById),
      onSuccess,
    }),
  };
}

export function useSetTasksSomeday() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: ({ ids, someday }: { ids: Id[]; someday: boolean }) =>
      withSnapshot(ids, () => commands.setTasksSomeday(ids, someday)),
    onMutate: async ({ ids, someday }) => {
      const previous = await cache.freeze();
      cache.update((tasks) =>
        tasks.map((task) =>
          ids.includes(task.id)
            ? {
                ...task,
                someday,
                ...(someday && {
                  dueDate: null,
                  dueTime: null,
                  recurrence: null,
                  mustOn: null,
                }),
              }
            : task,
        ),
      );
      return { previous };
    },
    onSuccess: ({ snapshot }, { ids, someday }, context) => {
      if (someday)
        cache.offerRestore(
          `Moved ${titleOf(ids, context.previous)} to Someday`,
          snapshot,
        );
    },
    onError: (_error, _vars, context) => cache.restore(context?.previous),
    onSettled: () => cache.refresh(),
  });
}

export function useSetTaskMust() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: ({ id, mustOn }: { id: Id; mustOn: DateKey | null }) =>
      commands.setTaskMust(id, mustOn),
    onMutate: async ({ id, mustOn }) => {
      const previous = await cache.freeze();
      cache.update((tasks) =>
        tasks.map((task) =>
          task.id === id
            ? { ...task, mustOn, someday: mustOn ? false : task.someday }
            : task,
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => cache.restore(context?.previous),
    onSettled: () => cache.refresh(),
  });
}

export function useSetTaskNextStep() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: ({ id, nextStep }: { id: Id; nextStep: string }) =>
      commands.setTaskNextStep(id, nextStep),
    onSuccess: (task) => cache.replace(task),
  });
}

export function useDeleteTasks() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: (ids: Id[]) =>
      withSnapshot(ids, () => commands.deleteTasks(ids)),
    onSuccess: ({ snapshot }, ids) => {
      const title = titleOf(ids, cache.current());
      cache.update((tasks) =>
        tasks.filter(
          (task) =>
            !ids.includes(task.id) &&
            (task.parentId === null || !ids.includes(task.parentId)),
        ),
      );
      cache.offerRestore(`Dropped ${title}`, snapshot);
      return cache.refresh();
    },
  });
}

export function useDeleteTask() {
  const cache = useTaskCache();
  return useMutation({
    mutationFn: (id: Id) => withSnapshot([id], () => commands.deleteTask(id)),
    onSuccess: ({ snapshot }, id) => {
      const title = titleOf([id], cache.current());
      cache.update((tasks) =>
        tasks.filter((task) => task.id !== id && task.parentId !== id),
      );
      cache.offerRestore(`Deleted ${title}`, snapshot);
      return Promise.all([
        cache.refresh(),
        cache.client.invalidateQueries({ queryKey: keys.allEntries }),
      ]);
    },
  });
}

function useSectionCache() {
  const client = useQueryClient();
  return {
    replace: (section: Section) =>
      client.setQueryData<Section[]>(keys.sections, (sections) =>
        sections?.map((current) =>
          current.id === section.id ? section : current,
        ),
      ),
    refresh: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.sections }),
        client.invalidateQueries({ queryKey: keys.tasks }),
      ]),
  };
}

export function useCreateSection() {
  const cache = useSectionCache();
  return useMutation({
    mutationFn: ({
      projectId,
      name,
      before = null,
    }: {
      projectId: Id | null;
      name: string;
      before?: Id | null;
    }) => commands.createSection(projectId, name, before),
    onSuccess: cache.refresh,
  });
}

export function useRenameSection() {
  const cache = useSectionCache();
  return useMutation({
    mutationFn: ({ id, name }: { id: Id; name: string }) =>
      commands.renameSection(id, name),
    onSuccess: cache.replace,
  });
}

export function useCollapseSection() {
  const client = useQueryClient();
  const cache = useSectionCache();
  return useMutation({
    mutationFn: ({ id, collapsed }: { id: Id; collapsed: boolean }) =>
      commands.setSectionCollapsed(id, collapsed),
    onMutate: ({ id, collapsed }) => {
      client.setQueryData<Section[]>(keys.sections, (sections) =>
        sections?.map((section) =>
          section.id === id ? { ...section, collapsed } : section,
        ),
      );
    },
    onSuccess: cache.replace,
  });
}

export function useReorderSection() {
  const cache = useSectionCache();
  return useMutation({
    mutationFn: ({ id, before }: { id: Id; before: Id | null }) =>
      commands.reorderSection(id, before),
    onSuccess: cache.refresh,
  });
}

export function useDeleteSection() {
  const cache = useSectionCache();
  return useMutation({
    mutationFn: (id: Id) => commands.deleteSection(id),
    onSuccess: cache.refresh,
  });
}
