import { unwrap } from '@skkil-time/client/server';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { api } from '@/core/api/client';
import { queryClient } from '@/core/api/query-client';
import { commands } from '@/core/local/backend';
import { onWrite } from '@/core/local/writes';
import { ACTION, isOurs, snoozed } from '@/core/notifications/plan';
import {
  allowed,
  cancelAll,
  reschedule,
  rescheduleSoon,
  schedule,
} from '@/core/notifications/schedule';
import { onSyncedChange } from '@/core/sync/refresh';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function pushToken(): Promise<string | null> {
  const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  if (!Device.isDevice || typeof projectId !== 'string') return null;
  if (!(await Notifications.getPermissionsAsync()).granted) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

const safeToken = () => pushToken().catch(() => null);

const register = (token: string) =>
  unwrap(
    api.POST('/api/v1/notifications/devices', {
      body: {
        kind: 'expo',
        token,
        p256dh: null,
        auth: null,
        label: Device.deviceName ?? Device.modelName ?? Platform.OS,
        scheduling: 'local',
        kinds: null,
      },
    }),
  );

async function forgetDevice() {
  const token = await safeToken();
  if (!token) return;
  const { id } = await register(token);
  await unwrap(
    api.DELETE('/api/v1/notifications/devices/{id}', {
      params: { path: { id } },
    }),
  );
}

/** Whether this phone shows reminders: switched on here, and allowed by the system. */
export async function remindersOn() {
  return (await commands.getNotificationPrefs()).on && (await allowed(false));
}

/** Turns reminders on for this phone; false when the system refused permission. */
export async function enableReminders() {
  if (!(await allowed(true))) return false;
  const prefs = await commands.getNotificationPrefs();
  await commands.setNotificationPrefs({ ...prefs, on: true });
  const token = await safeToken();
  if (token) await register(token).catch(() => undefined);
  await reschedule();
  return true;
}

export async function disableReminders() {
  const prefs = await commands.getNotificationPrefs();
  await commands.setNotificationPrefs({ ...prefs, on: false });
  await cancelAll();
  await forgetDevice().catch(() => undefined);
}

async function refreshDevice() {
  if (!(await remindersOn())) return;
  const token = await safeToken();
  if (token) await register(token);
}

async function respond(response: Notifications.NotificationResponse) {
  Notifications.clearLastNotificationResponse();
  const data: unknown = response.notification.request.content.data;
  if (!isOurs(data)) {
    const taskId = (data as { taskId?: unknown } | null)?.taskId;
    if (
      typeof taskId === 'string' &&
      response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
    )
      router.push({ pathname: '/task/[id]', params: { id: taskId } });
    return;
  }
  switch (response.actionIdentifier) {
    case ACTION.done:
      await commands.setTaskCompleted(data.taskId, true);
      break;
    case ACTION.startFocus:
      await commands.startTimer({
        description: data.title,
        projectId: null,
        taskId: data.taskId,
      });
      router.push('/');
      break;
    case ACTION.snooze: {
      const again = snoozed(data, Math.floor(Date.now() / 1000));
      if (again) await schedule(again);
      break;
    }
    case Notifications.DEFAULT_ACTION_IDENTIFIER:
      router.push({ pathname: '/task/[id]', params: { id: data.taskId } });
      break;
  }
  await queryClient.invalidateQueries();
  await Notifications.dismissNotificationAsync(
    response.notification.request.identifier,
  );
}

/**
 * While signed in, keeps the next two days of reminders scheduled on this
 * phone (on start, in the foreground, after writes and synced changes) and
 * answers taps and actions on them.
 */
export function useReminders(signedIn: boolean) {
  useEffect(() => {
    if (!signedIn) return;
    void refreshDevice().catch(() => undefined);
    rescheduleSoon();
    const stops = [
      onWrite(() => rescheduleSoon(true)),
      onSyncedChange(() => rescheduleSoon()),
    ];
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') rescheduleSoon();
    });
    const responses = Notifications.addNotificationResponseReceivedListener(
      (response) => void respond(response).catch(() => undefined),
    );
    const last = Notifications.getLastNotificationResponse();
    if (last) void respond(last).catch(() => undefined);
    return () => {
      stops.forEach((stop) => stop());
      foreground.remove();
      responses.remove();
    };
  }, [signedIn]);
}
