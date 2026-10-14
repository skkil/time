import type { Id } from '@skkil-time/contract';
import type { DateKey } from '@skkil-time/domain/time';
import { useMutation, useQuery } from '@tanstack/react-query';

import { commands } from '@/core/api/client';
import { keys } from '@/core/api/query-client';

export const useTimer = () =>
  useQuery({
    queryKey: keys.timer,
    queryFn: commands.getTimer,
    refetchInterval: 60_000,
  });

export const useTimeEntries = (from: DateKey, to: DateKey) =>
  useQuery({
    queryKey: keys.entries(from, to),
    queryFn: () => commands.listTimeEntries(from, to),
  });

export const useTimerActions = () => ({
  start: useMutation({
    mutationFn: (details: {
      taskId: Id | null;
      projectId: Id | null;
      description: string;
    }) => commands.startTimer(details),
  }),
  stop: useMutation({ mutationFn: () => commands.stopTimer() }),
  pause: useMutation({ mutationFn: () => commands.pauseTimer() }),
  resume: useMutation({ mutationFn: () => commands.resumeTimer() }),
});
