import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { type AccountChoice, type SyncConfig, platform } from '@/platform';

const keys = {
  status: ['sync', 'status'] as const,
  issues: ['sync', 'issues'] as const,
  config: ['sync', 'config'] as const,
};

const sync = () => {
  const port = platform().sync;
  if (!port) throw new Error('This platform does not sync on its own');
  return port;
};

/** The sync status, kept current by the platform's status events. */
export function useSyncStatus() {
  const client = useQueryClient();
  useEffect(
    () =>
      sync().onStatus((status) => {
        client.setQueryData(keys.status, status);
        void client.invalidateQueries({ queryKey: keys.issues });
      }),
    [client],
  );
  return useQuery({ queryKey: keys.status, queryFn: () => sync().status() });
}

export function useSyncIssues() {
  return useQuery({ queryKey: keys.issues, queryFn: () => sync().issues() });
}

export function useSyncConfig() {
  return useQuery({ queryKey: keys.config, queryFn: () => sync().config() });
}

function useRefreshingMutation<T>(run: (input: T) => Promise<void>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => client.invalidateQueries({ queryKey: ['sync'] }),
  });
}

export const useSyncNow = () => useRefreshingMutation(() => sync().syncNow());
export const useSignIn = () => useRefreshingMutation(() => sync().signIn());
export const useSignOut = () => useRefreshingMutation(() => sync().signOut());
export const useDismissIssue = () =>
  useRefreshingMutation((id: number) => sync().dismissIssue(id));
export const useChooseAccountData = () =>
  useRefreshingMutation((choice: AccountChoice) =>
    sync().chooseAccountData(choice),
  );
export const useSaveSyncConfig = () =>
  useRefreshingMutation((config: SyncConfig) => sync().saveConfig(config));
