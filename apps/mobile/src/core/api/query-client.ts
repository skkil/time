import type { DateKey } from '@skkil-time/rules/time';
import { QueryClient } from '@tanstack/react-query';

export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    mutations: {
      onSettled: (): Promise<void> => queryClient.invalidateQueries(),
    },
  },
});

export const keys = {
  tasks: ['tasks'],
  projects: ['projects'],
  sections: ['sections'],
  timer: ['timer'],
  habits: ['habits'],
  habitDays: (from: DateKey, to: DateKey) => ['habit-days', from, to],
  entries: (from: DateKey, to: DateKey) => ['time-entries', from, to],
};
