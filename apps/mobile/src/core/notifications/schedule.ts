import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { commands } from '@/core/local/backend';
import {
  ACTION,
  CATEGORY,
  CHANNEL,
  type PlannedNotification,
  WINDOW_SECONDS,
  isOurs,
  planNotifications,
} from '@/core/notifications/plan';

const DEBOUNCE_MS = 1_000;

let prepared: Promise<void> | null = null;

const prepare = () =>
  (prepared ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL.task, {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
      await Notifications.setNotificationChannelAsync(CHANNEL.block, {
        name: 'Focus blocks',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    await Notifications.setNotificationCategoryAsync(CATEGORY.task!, [
      { identifier: ACTION.done, buttonTitle: 'Done' },
      { identifier: ACTION.snooze, buttonTitle: 'Snooze 15 min' },
    ]);
    await Notifications.setNotificationCategoryAsync(CATEGORY.block!, [
      {
        identifier: ACTION.startFocus,
        buttonTitle: 'Start focus',
        options: { opensAppToForeground: true },
      },
      { identifier: ACTION.snooze, buttonTitle: 'Snooze 10 min' },
    ]);
  })().catch((error: unknown) => {
    prepared = null;
    throw error;
  }));

/** Whether reminders may be shown, asking once when `ask` and the OS still allows asking. */
export async function allowed(ask: boolean) {
  if (!Device.isDevice) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !ask || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function schedule(notification: PlannedNotification) {
  await Notifications.scheduleNotificationAsync({
    identifier: notification.identifier,
    content: {
      title: notification.title,
      body: notification.body,
      data: notification.data,
      categoryIdentifier: CATEGORY[notification.kind] ?? undefined,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(notification.at * 1000),
      channelId: CHANNEL[notification.kind],
    },
  });
}

export async function cancelAll() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => isOurs(request.content.data))
      .map((request) =>
        Notifications.cancelScheduledNotificationAsync(request.identifier),
      ),
  );
}

/**
 * Replaces what this phone has scheduled with the next two days of
 * reminders. `ask` is set after the person's own writes, so permission is
 * asked the first time something time-bound needs it, never at launch.
 */
export async function reschedule(ask = false) {
  const prefs = await commands.getNotificationPrefs();
  await cancelAll();
  if (!prefs.on) return;
  const now = Math.floor(Date.now() / 1000);
  const planned = planNotifications(
    await commands.listReminders(now, now + WINDOW_SECONDS, prefs),
    now,
  );
  if (planned.length === 0 || !(await allowed(ask))) return;
  await prepare();
  for (const notification of planned) await schedule(notification);
}

let timer: ReturnType<typeof setTimeout> | undefined;
let asking = false;
let running: Promise<void> = Promise.resolve();

/** Reschedules once a burst of changes has settled. */
export function rescheduleSoon(ask = false) {
  asking ||= ask;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const askNow = asking;
    asking = false;
    running = running.then(() => reschedule(askNow)).catch(() => undefined);
  }, DEBOUNCE_MS);
}
