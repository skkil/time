import type { Id, TaskInput } from '@skkil-time/client/types';
import { useMutation, useQuery } from '@tanstack/react-query';

import { keys } from '@/core/api/query-client';
import { commands } from '@/core/local/backend';

export const useTasks = () =>
  useQuery({ queryKey: keys.tasks, queryFn: commands.listTasks });

export const usePlaces = () =>
  useQuery({ queryKey: keys.places, queryFn: commands.listPlaces });

export const useSetTaskPlace = () =>
  useMutation({
    mutationFn: ({ id, placeId }: { id: Id; placeId: Id | null }) =>
      commands.setTaskPlace(id, placeId),
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
