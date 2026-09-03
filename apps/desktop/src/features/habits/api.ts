import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type HabitDay,
  type HabitInput,
  type Id,
  type ManualStatus,
  commands,
} from '@/bindings';
import { keys } from '@/lib/query';
import type { DateKey } from '@/lib/time';

const SYNC_INTERVAL_MS = 5 * 60_000;

export function useHabits() {
  return useQuery({ queryKey: keys.habits, queryFn: commands.listHabits });
}

export function useHabitDays(from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: keys.habitDays(from, to),
    queryFn: () => commands.listHabitDays(from, to),
  });
}

function useRefreshHabits() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.habits }),
      client.invalidateQueries({ queryKey: keys.allHabitDays }),
    ]);
}

export function useHabitSync() {
  const refresh = useRefreshHabits();
  return useQuery({
    queryKey: keys.habitSync,
    queryFn: async () => {
      const report = await commands.syncHabits();
      await refresh();
      return report;
    },
    refetchInterval: SYNC_INTERVAL_MS,
    staleTime: 60_000,
  });
}

export function useCreateHabit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: HabitInput) => commands.createHabit(input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.habitSync }),
  });
}

export function useUpdateHabit() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id; input: HabitInput }) =>
      commands.updateHabit(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.habitSync }),
  });
}

export function useArchiveHabit() {
  const refresh = useRefreshHabits();
  return useMutation({
    mutationFn: (id: Id) => commands.archiveHabit(id),
    onSuccess: refresh,
  });
}

export function useSetHabitStatus() {
  const client = useQueryClient();
  const refresh = useRefreshHabits();
  return useMutation({
    mutationFn: ({
      habitId,
      date,
      status,
    }: {
      habitId: Id;
      date: DateKey;
      status: ManualStatus | null;
    }) => commands.setHabitStatus(habitId, date, status),
    onMutate: async ({ habitId, date, status }) => {
      await client.cancelQueries({ queryKey: keys.allHabitDays });
      const snapshots = client.getQueriesData<HabitDay[]>({
        queryKey: keys.allHabitDays,
      });
      if (status)
        for (const [key, days] of snapshots)
          client.setQueryData(
            key,
            days?.map((day) =>
              day.habitId === habitId && day.date === date
                ? { ...day, status, manual: true }
                : day,
            ),
          );
      return { snapshots };
    },
    onError: (_error, _vars, context) => {
      for (const [key, days] of context?.snapshots ?? [])
        client.setQueryData(key, days);
    },
    onSettled: refresh,
  });
}

export function useAddHabitValue() {
  const refresh = useRefreshHabits();
  return useMutation({
    mutationFn: ({
      habitId,
      date,
      delta,
    }: {
      habitId: Id;
      date: DateKey;
      delta: number;
    }) => commands.addHabitValue(habitId, date, delta),
    onSettled: refresh,
  });
}

export function dayLookup(days: HabitDay[] | undefined) {
  const map = new Map<string, HabitDay>();
  for (const day of days ?? []) map.set(`${day.habitId}:${day.date}`, day);
  return (habitId: Id, date: DateKey) => map.get(`${habitId}:${date}`);
}
