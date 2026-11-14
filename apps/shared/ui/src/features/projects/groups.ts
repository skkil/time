import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { type Group, type Id, commands } from '@/backend';
import { keys } from '@/lib/query';
import { renumber } from '@/lib/reorder';

import { useProjectIndex } from './api';
import { rootOf } from './tree';

export function useGroups() {
  const { data } = useQuery({
    queryKey: keys.groups,
    queryFn: commands.listGroups,
  });
  return useMemo(() => {
    const list = data ?? [];
    return { list, byId: new Map(list.map((org) => [org.id, org])) };
  }, [data]);
}

export function useProjectGroup(projectId: Id | null | undefined) {
  const index = useProjectIndex();
  const groups = useGroups();
  if (projectId == null) return undefined;
  const id = rootOf(index, projectId)?.groupId;
  return id == null ? undefined : groups.byId.get(id);
}

function useInvalidate() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.groups }),
      client.invalidateQueries({ queryKey: keys.projects }),
    ]);
}

export function useCreateGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (name: string) => commands.createGroup(name),
    onSuccess: invalidate,
  });
}

export function useRenameGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, name }: { id: Id; name: string }) =>
      commands.renameGroup(id, name),
    onSuccess: invalidate,
  });
}

export function useReorderGroup() {
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, before }: { id: Id; before: Id | null }) =>
      commands.reorderGroup(id, before),
    onMutate: async ({ id, before }) => {
      await client.cancelQueries({ queryKey: keys.groups });
      client.setQueryData<Group[]>(keys.groups, (groups = []) =>
        renumber(groups, id, before),
      );
    },
    onSettled: invalidate,
  });
}

export function useDeleteGroup() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: Id) => commands.deleteGroup(id),
    onSuccess: invalidate,
  });
}
