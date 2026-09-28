import type { Id, ManualStatus, TaskInput } from '@skkil-time/contract';
import type { DateKey } from '@skkil-time/domain/time';
import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';

import { commands } from '@/backend';

export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    mutations: {
      onSettled: (): Promise<void> => queryClient.invalidateQueries(),
    },
  },
});

export const keys = {
  tasks: ['tasks'],
  projects: ['projects'],
  sections: ['sections'],
  timer: ['timer'],
  habits: ['habits'],
  habitDays: (from: DateKey, to: DateKey) => ['habit-days', from, to],
  entries: (from: DateKey, to: DateKey) => ['time-entries', from, to],
};

export const useTasks = () =>
  useQuery({ queryKey: keys.tasks, queryFn: commands.listTasks });

export const useProjects = () =>
  useQuery({ queryKey: keys.projects, queryFn: commands.listProjects });

export const useSections = () =>
  useQuery({ queryKey: keys.sections, queryFn: commands.listSections });

export const useTimer = () =>
  useQuery({
    queryKey: keys.timer,
    queryFn: commands.getTimer,
    refetchInterval: 60_000,
  });

export const useHabits = () =>
  useQuery({ queryKey: keys.habits, queryFn: commands.listHabits });

export const useHabitDays = (from: DateKey, to: DateKey) =>
  useQuery({
    queryKey: keys.habitDays(from, to),
    queryFn: () => commands.listHabitDays(from, to),
  });

export const useTimeEntries = (from: DateKey, to: DateKey) =>
  useQuery({
    queryKey: keys.entries(from, to),
    queryFn: () => commands.listTimeEntries(from, to),
  });

export const useCompleteTask = () =>
  useMutation({
    mutationFn: ({ id, completed }: { id: Id; completed: boolean }) =>
      commands.setTaskCompleted(id, completed),
  });

export const useCreateTask = () =>
  useMutation({ mutationFn: (input: TaskInput) => commands.createTask(input) });

export const useUpdateTask = () =>
  useMutation({
    mutationFn: ({ id, input }: { id: Id; input: TaskInput }) =>
      commands.updateTask(id, input),
  });

export const useDeleteTask = () =>
  useMutation({ mutationFn: (id: Id) => commands.deleteTask(id) });

export const useTimerActions = () => ({
  start: useMutation({
    mutationFn: (details: {
      taskId: Id | null;
      projectId: Id | null;
      description: string;
    }) => commands.startTimer(details),
  }),
  stop: useMutation({ mutationFn: () => commands.stopTimer() }),
  pause: useMutation({ mutationFn: () => commands.pauseTimer() }),
  resume: useMutation({ mutationFn: () => commands.resumeTimer() }),
});

export const useSetHabitStatus = () =>
  useMutation({
    mutationFn: ({
      habitId,
      date,
      status,
    }: {
      habitId: Id;
      date: DateKey;
      status: ManualStatus | null;
    }) => commands.setHabitStatus(habitId, date, status),
  });

export const useAddHabitValue = () =>
  useMutation({
    mutationFn: ({
      habitId,
      date,
      delta,
    }: {
      habitId: Id;
      date: DateKey;
      delta: number | null;
    }) => commands.addHabitValue(habitId, date, delta),
  });
