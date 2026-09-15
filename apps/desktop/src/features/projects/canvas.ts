import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type Id, commands } from '@/bindings';
import { keys } from '@/lib/query';

export function useProjectCanvas(projectId: Id) {
  return useQuery({
    queryKey: keys.canvas(projectId),
    queryFn: () => commands.getProjectCanvas(projectId),
    staleTime: Infinity,
  });
}

export function useSaveProjectCanvas(projectId: Id) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      commands.saveProjectCanvas(projectId, content),
    onSuccess: (canvas) => client.setQueryData(keys.canvas(projectId), canvas),
  });
}
