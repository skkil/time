import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { type Id, commands } from '@/bindings';
import { keys } from '@/lib/query';

import { useProjectIndex } from './api';
import { rootOf } from './tree';

export function useOrganizations() {
  const { data } = useQuery({
    queryKey: keys.organizations,
    queryFn: commands.listOrganizations,
  });
  return useMemo(() => {
    const list = data ?? [];
    return { list, byId: new Map(list.map((org) => [org.id, org])) };
  }, [data]);
}

export function useProjectOrganization(projectId: Id | null | undefined) {
  const index = useProjectIndex();
  const organizations = useOrganizations();
  if (projectId == null) return undefined;
  const id = rootOf(index, projectId)?.organizationId;
  return id == null ? undefined : organizations.byId.get(id);
}

function useInvalidate() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.organizations }),
      client.invalidateQueries({ queryKey: keys.projects }),
    ]);
}

export function useCreateOrganization() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (name: string) => commands.createOrganization(name),
    onSuccess: invalidate,
  });
}

export function useRenameOrganization() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, name }: { id: Id; name: string }) =>
      commands.renameOrganization(id, name),
    onSuccess: invalidate,
  });
}

export function useDeleteOrganization() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: Id) => commands.deleteOrganization(id),
    onSuccess: invalidate,
  });
}
