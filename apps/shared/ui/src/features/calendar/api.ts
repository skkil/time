import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type CalendarSource, type Id, commands } from '@/backend';
import { keys } from '@/lib/query';
import type { DateKey } from '@/lib/time';
import { platform } from '@/platform';

const STATUS_REFRESH_MS = 5_000;

export function useCalendarEvents(from: DateKey, to: DateKey) {
  return useQuery({
    queryKey: keys.calendarEvents(from, to),
    queryFn: () => commands.listCalendarEvents(from, to),
  });
}

export function useCalendarSources() {
  return useQuery({
    queryKey: keys.calendarSources,
    queryFn: () => commands.listCalendarSources(),
  });
}

export function useSetCalendarSourceVisible() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, visible }: { id: Id; visible: boolean }) =>
      commands.setCalendarSourceVisible(id, visible),
    onMutate: async ({ id, visible }) => {
      await client.cancelQueries({ queryKey: keys.calendarSources });
      const previous = client.getQueryData<CalendarSource[]>(
        keys.calendarSources,
      );
      client.setQueryData<CalendarSource[]>(keys.calendarSources, (sources) =>
        sources?.map((source) =>
          source.id === id ? { ...source, visible } : source,
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) =>
      client.setQueryData(keys.calendarSources, context?.previous),
    onSettled: () => client.invalidateQueries({ queryKey: keys.allCalendar }),
  });
}

const calendars = () => {
  const port = platform().calendars;
  if (!port) throw new Error('This platform has no connected calendars');
  return port;
};

/**
 * The account's connected calendars, checked again every few seconds while
 * a connection is being made in the browser.
 */
export function useCalendarStatus({ waiting = false } = {}) {
  return useQuery({
    queryKey: keys.calendarStatus,
    queryFn: () => calendars().status(),
    refetchInterval: waiting ? STATUS_REFRESH_MS : false,
  });
}

export function useConnectCalendar() {
  return useMutation({ mutationFn: () => calendars().connect() });
}

export function useDisconnectCalendar() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendars().disconnect(id),
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: keys.calendarStatus }),
        client.invalidateQueries({ queryKey: keys.allCalendar }),
      ]),
  });
}
