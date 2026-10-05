import { unwrap } from '@skkil-time/api';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { api, commands } from '@/backend';

const REMINDER_CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function pushToken(ask: boolean): Promise<string | null> {
  const projectId: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  if (!Device.isDevice || typeof projectId !== 'string') return null;
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted && ask)
    ({ granted } = await Notifications.requestPermissionsAsync());
  if (!granted) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

const register = (token: string) =>
  unwrap(
    api.POST('/api/v1/notifications/devices', {
      body: {
        kind: 'expo',
        token,
        p256dh: null,
        auth: null,
        label: Device.deviceName ?? Device.modelName ?? Platform.OS,
      },
    }),
  );

const safeToken = (ask: boolean) => pushToken(ask).catch(() => null);

/** Whether this device can show reminders: a real device with permission granted. */
export async function remindersAllowed() {
  if (!Device.isDevice) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Registers this device for reminders; false when push isn't available or permission was refused. */
export async function enableReminders() {
  const token = await safeToken(true);
  if (!token) return false;
  await register(token);
  return true;
}

export async function disableReminders() {
  const token = await safeToken(false);
  if (!token) return;
  const { id } = await register(token);
  await unwrap(
    api.DELETE('/api/v1/notifications/devices/{id}', {
      params: { path: { id } },
    }),
  );
}

async function refresh() {
  if (!(await commands.getRemindersEnabled())) return;
  const token = await safeToken(false);
  if (token) await register(token);
}

/** Keeps this device registered while signed in and opens the task a reminder was tapped for. */
export function useReminders(signedIn: boolean) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (signedIn) void refresh().catch(() => undefined);
  }, [signedIn]);
  useEffect(() => {
    const taskId: unknown = response?.notification.request.content.data?.taskId;
    if (
      !signedIn ||
      typeof taskId !== 'number' ||
      response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
    )
      return;
    router.push({ pathname: '/task/[id]', params: { id: taskId } });
    Notifications.clearLastNotificationResponse();
  }, [signedIn, response]);
}
