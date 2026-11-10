import type {
  BlockMove,
  Id,
  MoveTarget,
  OutcomeStatus,
} from '@skkil-time/client/types';
import { type DateKey, shiftKey } from '@skkil-time/rules/time';
import { useMutation, useQuery } from '@tanstack/react-query';

import { commands } from '@/core/local/backend';

export const useBlocks = (monday: DateKey) =>
  useQuery({
    queryKey: ['blocks', monday],
    queryFn: () => commands.listBlocks(monday, shiftKey(monday, 7)),
  });

export const useEvents = (from: DateKey, to: DateKey) =>
  useQuery({
    queryKey: ['events', from, to],
    queryFn: () => commands.listEvents(from, to),
  });

export const useCalendarEvents = (from: DateKey, to: DateKey) =>
  useQuery({
    queryKey: ['calendar', 'events', from, to],
    queryFn: () => commands.listCalendarEvents(from, to),
  });

export const useWeek = (monday: DateKey) =>
  useQuery({
    queryKey: ['week', monday],
    queryFn: () => commands.getWeek(monday),
  });

export const useOutcomeActions = () => ({
  create: useMutation({
    mutationFn: ({ week, title }: { week: DateKey; title: string }) =>
      commands.createOutcome(week, title, null),
  }),
  setStatus: useMutation({
    mutationFn: ({ id, status }: { id: Id; status: OutcomeStatus }) =>
      commands.updateOutcomeStatus(id, status),
  }),
});

export const useMoveTasks = () =>
  useMutation({
    mutationFn: ({
      ids,
      target,
      blocks = 'follow',
    }: {
      ids: Id[];
      target: MoveTarget;
      blocks?: BlockMove;
    }) => commands.moveTasks(ids, target, blocks),
  });
