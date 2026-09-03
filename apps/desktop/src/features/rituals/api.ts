import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type Id, type RitualInput, commands } from '@/bindings';
import { keys } from '@/lib/query';
import type { DateKey } from '@/lib/time';

export function useRituals() {
  return useQuery({ queryKey: keys.rituals, queryFn: commands.listRituals });
}

export function usePlanningTime() {
  return useQuery({
    queryKey: keys.planningTime,
    queryFn: commands.getPlanningTime,
  });
}

export function useRitualRuns(from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: keys.ritualRuns(from, to),
    queryFn: () => commands.listRitualRuns(from, to),
  });
}

function useRefreshRituals() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: keys.rituals });
}

export function useUpdateRitual() {
  const refresh = useRefreshRituals();
  return useMutation({
    mutationFn: ({ kind, input }: { kind: string; input: RitualInput }) =>
      commands.updateRitual(kind, input),
    onSuccess: refresh,
  });
}

export function useChoosePlanningTime() {
  const refresh = useRefreshRituals();
  return useMutation({
    mutationFn: (time: 'morning' | 'evening') =>
      commands.choosePlanningTime(time),
    onSuccess: refresh,
  });
}

export function useRunActions() {
  const refresh = useRefreshRituals();
  const options = { onSuccess: refresh };
  return {
    start: useMutation({
      mutationFn: ({ kind, taskId }: { kind: string; taskId: Id | null }) =>
        commands.startRitual(kind, taskId),
      ...options,
    }),
    reach: useMutation({
      mutationFn: ({ id, step }: { id: Id; step: number }) =>
        commands.reachRitualStep(id, step),
    }),
    finish: useMutation({
      mutationFn: (id: Id) => commands.finishRitual(id),
      ...options,
    }),
    skip: useMutation({
      mutationFn: (id: Id) => commands.skipRitual(id),
      ...options,
    }),
    snooze: useMutation({
      mutationFn: (id: Id) => commands.snoozeRitual(id),
      ...options,
    }),
  };
}
