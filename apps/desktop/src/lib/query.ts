import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { Error as CommandError } from '@/bindings';

function isCommandError(error: unknown): error is CommandError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'kind' in error &&
    'message' in error
  );
}

export function errorMessage(error: unknown): string {
  if (isCommandError(error)) {
    return error.kind === 'notFound'
      ? `${error.message} not found.`
      : error.message;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong.';
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(errorMessage(error));
    },
  }),
});

export const keys = {
  projects: ['projects'] as const,
  organizations: ['organizations'] as const,
  tasks: ['tasks'] as const,
  sections: ['sections'] as const,
  blocks: (monday: string) => ['blocks', monday] as const,
  allBlocks: ['blocks'] as const,
  entries: (from: string, to: string) => ['entries', from, to] as const,
  allEntries: ['entries'] as const,
  timer: ['timer'] as const,
  habits: ['habits'] as const,
  habitDays: (from: string, to: string) => ['habitDays', from, to] as const,
  allHabitDays: ['habitDays'] as const,
  habitSync: ['habitSync'] as const,
  review: ['review'] as const,
  days: (from: string, to: string) => ['review', 'days', from, to] as const,
  week: (monday: string) => ['review', 'week', monday] as const,
  weeks: (from: string, to: string) => ['review', 'weeks', from, to] as const,
  quarter: (monday: string) => ['review', 'quarter', monday] as const,
  rituals: ['rituals'] as const,
  workflow: ['workflow'] as const,
  recordPhases: (taskId: number) => ['recordPhases', taskId] as const,
  presets: ['presets'] as const,
  events: (from: string, to: string) => ['events', from, to] as const,
  allEvents: ['events'] as const,
  typeTime: (from: string, to: string) => ['typeTime', from, to] as const,
  planningTime: ['rituals', 'planningTime'] as const,
  ritualRuns: (from: string, to: string) =>
    ['rituals', 'runs', from, to] as const,
};
