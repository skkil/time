import type { EntryDetails, Id } from '@skkil-time/contract';
import { type DateKey, nowSeconds } from '@skkil-time/rules/time';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { keys } from '@/core/api/query-client';
import { commands } from '@/core/local/backend';

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
  edit: useMutation({
    mutationFn: (details: EntryDetails) => commands.editTimer(details),
  }),
  discard: useMutation({ mutationFn: () => commands.discardTimer() }),
});

/** The current time in seconds, ticking every `every` ms while `active`. */
export function useNow(active = true, every = 1000) {
  const [now, setNow] = useState(nowSeconds);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(nowSeconds()), every);
    return () => clearInterval(id);
  }, [active, every]);
  return now;
}
