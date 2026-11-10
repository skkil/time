import type { Reminder, ReminderKind } from '@skkil-time/client/types';
import { formatClockTime } from '@skkil-time/rules/time';

export const SOURCE = 'skkil';
export const WINDOW_SECONDS = 48 * 60 * 60;
export const MAX_SCHEDULED = 50;

export const CATEGORY: Record<ReminderKind, string | null> = {
  task: 'skkil-task',
  block: 'skkil-block',
  event: null,
};

export const ACTION = {
  done: 'done',
  startFocus: 'start-focus',
  snooze: 'snooze',
} as const;

export const SNOOZE_MINUTES: Record<ReminderKind, number> = {
  task: 15,
  block: 10,
  event: 0,
};

export const CHANNEL: Record<ReminderKind, string> = {
  task: 'reminders',
  block: 'focus',
  event: 'reminders',
};

export type ReminderData = {
  source: typeof SOURCE;
  key: string;
  kind: ReminderKind;
  taskId: string;
  title: string;
  body: string;
};

export type PlannedNotification = {
  identifier: string;
  at: number;
  title: string;
  body: string;
  kind: ReminderKind;
  data: ReminderData;
};

export function reminderBody(reminder: Reminder): string {
  const at = formatClockTime(reminder.startsAt);
  switch (reminder.kind) {
    case 'task':
      return at;
    case 'block':
      return `Focus block at ${at}`;
    case 'event':
      return reminder.location
        ? `Starts at ${at} · ${reminder.location}`
        : `Starts at ${at}`;
  }
}

const identifierOf = (key: string) => `${SOURCE}:${key}`;

export const isOurs = (data: unknown): data is ReminderData =>
  typeof data === 'object' &&
  data !== null &&
  (data as { source?: unknown }).source === SOURCE;

/** What to schedule on the phone: the next reminders after `now`, soonest first, within the OS limit. */
export function planNotifications(
  reminders: Reminder[],
  now: number,
): PlannedNotification[] {
  return reminders
    .filter((reminder) => reminder.at > now)
    .sort((a, b) => a.at - b.at || a.key.localeCompare(b.key))
    .slice(0, MAX_SCHEDULED)
    .map((reminder) => {
      const body = reminderBody(reminder);
      return {
        identifier: identifierOf(reminder.key),
        at: reminder.at,
        title: reminder.title,
        body,
        kind: reminder.kind,
        data: {
          source: SOURCE,
          key: reminder.key,
          kind: reminder.kind,
          taskId: reminder.taskId,
          title: reminder.title,
          body,
        },
      };
    });
}

/** The same reminder again a few minutes from `now`. */
export function snoozed(
  data: ReminderData,
  now: number,
): PlannedNotification | null {
  const minutes = SNOOZE_MINUTES[data.kind];
  if (minutes === 0) return null;
  const at = now + minutes * 60;
  const key = `${data.key}:snoozed:${at}`;
  return {
    identifier: identifierOf(key),
    at,
    title: data.title,
    body: data.body,
    kind: data.kind,
    data: { ...data, key },
  };
}
