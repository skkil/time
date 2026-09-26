import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type EntryDetails,
  type EntryInput,
  type Id,
  type RunningTimer,
  type TimeEntry,
  commands,
} from '@/backend';
import { keys } from '@/lib/query';
import type { DateKey } from '@/lib/time';
import { offerUndo } from '@/lib/undo';

export function useTimeEntries(from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: keys.entries(from, to),
    queryFn: () => commands.listTimeEntries(from, to),
  });
}

export function useTaskEntries(taskId: Id) {
  return useQuery({
    queryKey: keys.taskEntries(taskId),
    queryFn: () => commands.listTaskEntries(taskId),
  });
}

export function useProjectEntries(projectId: Id) {
  return useQuery({
    queryKey: keys.projectEntries(projectId),
    queryFn: () => commands.listProjectEntries(projectId),
  });
}

export function useTimer() {
  return useQuery({
    queryKey: keys.timer,
    queryFn: commands.getTimer,
    staleTime: Infinity,
  });
}

function useRefreshTracked() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.allEntries }),
      client.invalidateQueries({ queryKey: keys.tasks }),
    ]);
}

export function useStartTimer() {
  const client = useQueryClient();
  const refresh = useRefreshTracked();
  return useMutation({
    mutationFn: (details: EntryDetails) => commands.startTimer(details),
    onSuccess: (timer) => {
      client.setQueryData(keys.timer, timer);
      return refresh();
    },
  });
}

export function usePauseTimer() {
  const client = useQueryClient();
  const refresh = useRefreshTracked();
  return useMutation({
    mutationFn: (paused: boolean) =>
      paused ? commands.resumeTimer() : commands.pauseTimer(),
    onSuccess: (timer) => {
      client.setQueryData(keys.timer, timer);
      return refresh();
    },
  });
}

export function useEditTimer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (details: EntryDetails) => commands.editTimer(details),
    onSuccess: (timer) => client.setQueryData(keys.timer, timer),
  });
}

export function useStopTimer() {
  const client = useQueryClient();
  const refresh = useRefreshTracked();
  return useMutation({
    mutationFn: async (latest?: EntryDetails) => {
      if (latest) await commands.editTimer(latest);
      return commands.stopTimer();
    },
    onSuccess: () => {
      client.setQueryData(keys.timer, null);
      return refresh();
    },
  });
}

export function useDiscardTimer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => commands.discardTimer(),
    onMutate: () => ({
      timer: client.getQueryData<RunningTimer | null>(keys.timer),
    }),
    onSuccess: (_result, _vars, { timer }) => {
      client.setQueryData(keys.timer, null);
      if (!timer) return;
      offerUndo('Session discarded', async () => {
        client.setQueryData(keys.timer, await commands.restoreTimer(timer));
      });
    },
  });
}

export function useCreateEntry() {
  const refresh = useRefreshTracked();
  return useMutation({
    mutationFn: (input: EntryInput) => commands.createTimeEntry(input),
    onSuccess: refresh,
  });
}

export function useUpdateEntry() {
  const refresh = useRefreshTracked();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: EntryInput }) =>
      commands.updateTimeEntry(id, input),
    onSuccess: refresh,
  });
}

export function useDeleteEntry() {
  const refresh = useRefreshTracked();
  return useMutation({
    mutationFn: (entry: TimeEntry) => commands.deleteTimeEntry(entry.id),
    onSuccess: (_result, { id: _id, ...input }) => {
      refresh();
      offerUndo('Focus session deleted', async () => {
        await commands.createTimeEntry(input);
        refresh();
      });
    },
  });
}
