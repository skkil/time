import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type Id,
  type OutcomeStatus,
  type WeekNotes,
  commands,
} from '@/backend';
import { keys } from '@/lib/query';
import type { DateKey } from '@/lib/time';

export function useDays(from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: keys.days(from, to),
    queryFn: () => commands.listDays(from, to),
    staleTime: 0,
  });
}

export function useWeek(monday: DateKey) {
  return useQuery({
    queryKey: keys.week(monday),
    queryFn: () => commands.getWeek(monday),
    staleTime: 0,
  });
}

export function useWeeks(from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: keys.weeks(from, to),
    queryFn: () => commands.listWeeks(from, to),
    staleTime: 0,
  });
}

export function useQuarter(monday: DateKey) {
  return useQuery({
    queryKey: keys.quarter(monday),
    queryFn: () => commands.getQuarter(monday),
    staleTime: 0,
  });
}

function useReviewMutation<T, R = unknown>(run: (vars: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.review }),
        client.invalidateQueries({ queryKey: keys.tasks }),
      ]),
  });
}

export const useRateDay = () =>
  useReviewMutation(({ date, felt }: { date: DateKey; felt: number }) =>
    commands.rateDay(date, felt),
  );

export const useSaveDayNote = () =>
  useReviewMutation(({ date, note }: { date: DateKey; note: string }) =>
    commands.saveDayNote(date, note),
  );

export const useSkipDay = () =>
  useReviewMutation((date: DateKey) => commands.skipDayCheckIn(date));

export const useRateWeek = (monday: DateKey) =>
  useReviewMutation((felt: number) => commands.rateWeek(monday, felt));

export const useReachStep = (monday: DateKey) =>
  useReviewMutation((step: number) => commands.reachReviewStep(monday, step));

export const useFinishWeek = (monday: DateKey) =>
  useReviewMutation(() => commands.finishWeekReview(monday));

export const useSaveWeekNotes = (monday: DateKey) =>
  useReviewMutation((notes: WeekNotes) =>
    commands.saveWeekNotes(monday, notes),
  );

export const useCreateOutcome = (monday: DateKey) =>
  useReviewMutation(
    ({ title, priorityId }: { title: string; priorityId: Id | null }) =>
      commands.createOutcome(monday, title, priorityId),
  );

export const useUpdateOutcome = () =>
  useReviewMutation(
    ({
      id,
      title,
      priorityId,
    }: {
      id: Id;
      title: string;
      priorityId: Id | null;
    }) => commands.updateOutcome(id, title, priorityId),
  );

export const useSetOutcomeStatus = () =>
  useReviewMutation(({ id, status }: { id: Id; status: OutcomeStatus }) =>
    commands.updateOutcomeStatus(id, status),
  );

export const useRemoveOutcome = () =>
  useReviewMutation((id: Id) => commands.removeOutcome(id));

export const useSaveQuarter = () =>
  useReviewMutation(
    ({
      id,
      label,
      startDate,
    }: {
      id: Id | null;
      label: string;
      startDate: DateKey;
    }) => commands.upsertQuarter(id, label, startDate),
  );

export const useCreatePriority = () =>
  useReviewMutation(({ quarterId, title }: { quarterId: Id; title: string }) =>
    commands.createPriority(quarterId, title),
  );

export const useUpdatePriority = () =>
  useReviewMutation(
    ({ id, title, note }: { id: Id; title: string; note: string }) =>
      commands.updatePriority(id, title, note),
  );

export const useRemovePriority = () =>
  useReviewMutation((id: Id) => commands.removePriority(id));
