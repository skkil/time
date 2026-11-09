import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type Id, commands } from '@/backend';
import { keys } from '@/lib/query';

export function useRecordPhases(taskId: Id) {
  return useQuery({
    queryKey: keys.recordPhases(taskId),
    queryFn: () => commands.listRecordPhases(taskId),
  });
}

export function useSetPhaseNotes(taskId: Id) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ statusId, notes }: { statusId: Id; notes: string }) =>
      commands.setRecordPhaseNotes(taskId, statusId, notes),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: keys.recordPhases(taskId) }),
  });
}

function useTaskMutation<T>(run: (vars: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: keys.tasks }),
  });
}

export const useCreatePhaseTask = () =>
  useTaskMutation(
    ({
      recordId,
      phaseId,
      title,
    }: {
      recordId: Id;
      phaseId: Id;
      title: string;
    }) => commands.createPhaseTask(recordId, phaseId, title),
  );

export const useSetTaskPhase = () =>
  useTaskMutation(({ id, phaseId }: { id: Id; phaseId: Id | null }) =>
    commands.setTaskPhase(id, phaseId),
  );
