import type { Id, ManualStatus } from '@skkil-time/contract';
import type { DateKey } from '@skkil-time/rules/time';
import { useMutation, useQuery } from '@tanstack/react-query';

import { keys } from '@/core/api/query-client';
import { commands } from '@/core/local/backend';

export const useHabits = () =>
  useQuery({ queryKey: keys.habits, queryFn: commands.listHabits });

export const useHabitDays = (from: DateKey, to: DateKey) =>
  useQuery({
    queryKey: keys.habitDays(from, to),
    queryFn: () => commands.listHabitDays(from, to),
  });

export const useSetHabitStatus = () =>
  useMutation({
    mutationFn: ({
      habitId,
      date,
      status,
    }: {
      habitId: Id;
      date: DateKey;
      status: ManualStatus | null;
    }) => commands.setHabitStatus(habitId, date, status),
  });

export const useAddHabitValue = () =>
  useMutation({
    mutationFn: ({
      habitId,
      date,
      delta,
    }: {
      habitId: Id;
      date: DateKey;
      delta: number | null;
    }) => commands.addHabitValue(habitId, date, delta),
  });
