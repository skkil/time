import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { type Id, commands } from '@/backend';
import { keys } from '@/lib/query';

export function usePlaces() {
  const { data } = useQuery({
    queryKey: keys.places,
    queryFn: commands.listPlaces,
  });
  return useMemo(() => {
    const list = data ?? [];
    return { list, byId: new Map(list.map((place) => [place.id, place])) };
  }, [data]);
}

function useInvalidate() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: keys.places }),
      client.invalidateQueries({ queryKey: keys.tasks }),
    ]);
}

export function useCreatePlace() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (name: string) => commands.createPlace(name),
    onSuccess: invalidate,
  });
}

export function useRenamePlace() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, name }: { id: Id; name: string }) =>
      commands.renamePlace(id, name),
    onSuccess: invalidate,
  });
}

export function useDeletePlace() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: Id) => commands.deletePlace(id),
    onSuccess: invalidate,
  });
}
