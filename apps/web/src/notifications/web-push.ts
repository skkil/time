import { type Api, unwrap } from '@skkil-time/client/server';

import type { Id } from '@/backend';
import type { Notifications } from '@/platform';

const OPEN_TASK_PARAM = 'open-task';

type OpenTaskMessage = { type: 'open-task'; taskId: Id };

const isOpenTask = (data: unknown): data is OpenTaskMessage =>
  typeof data === 'object' &&
  data !== null &&
  'type' in data &&
  data.type === 'open-task' &&
  'taskId' in data &&
  typeof data.taskId === 'string';

const listeners = new Set<(id: Id) => void>();
const pending: Id[] = [];

function openTask(id: Id) {
  if (listeners.size === 0) pending.push(id);
  listeners.forEach((listener) => listener(id));
}

/** Delivers task ids from notification clicks, including the one a click opened this tab with. */
export function onOpenTask(listener: (id: Id) => void) {
  listeners.add(listener);
  pending.splice(0).forEach(listener);
  return () => void listeners.delete(listener);
}

function takeOpenTaskParam() {
  const url = new URL(window.location.href);
  const id = url.searchParams.get(OPEN_TASK_PARAM);
  if (id === null) return;
  url.searchParams.delete(OPEN_TASK_PARAM);
  window.history.replaceState(window.history.state, '', url);
  if (id) openTask(id);
}

function urlBase64ToBytes(value: string) {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function browserLabel() {
  const agent = navigator.userAgent;
  const browser =
    ['Edg', 'Firefox', 'Chrome', 'Safari'].find((name) =>
      agent.includes(name),
    ) ?? 'Browser';
  return browser === 'Edg' ? 'Edge' : browser;
}

/**
 * Registers the service worker and, when the server has a VAPID key and the browser supports push,
 * returns the hooks that subscribe this browser to reminders.
 */
export async function setUpWebPush(api: Api): Promise<Notifications | null> {
  takeOpenTaskParam();
  if (!('serviceWorker' in navigator)) return null;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (isOpenTask(event.data)) openTask(event.data.taskId);
  });
  const registered = navigator.serviceWorker
    .register('/sw.js')
    .catch(() => null);
  if (!('PushManager' in window) || !('Notification' in window)) return null;

  const publicKey = await unwrap(api.GET('/api/v1/notifications/config'))
    .then((config) => config.webPushPublicKey)
    .catch(() => null);
  if (!publicKey || !(await registered)) return null;

  const subscription = async () =>
    (await navigator.serviceWorker.ready).pushManager.getSubscription();

  const register = (current: PushSubscription) => {
    const { endpoint, keys } = current.toJSON();
    return unwrap(
      api.POST('/api/v1/notifications/devices', {
        body: {
          kind: 'web',
          token: endpoint ?? current.endpoint,
          p256dh: keys?.p256dh ?? null,
          auth: keys?.auth ?? null,
          label: browserLabel(),
        },
      }),
    );
  };

  const existing =
    Notification.permission === 'granted' ? await subscription() : null;
  if (existing) void register(existing).catch(() => undefined);

  return {
    async isEnabled() {
      return Notification.permission === 'granted' && !!(await subscription());
    },
    async enable() {
      if ((await Notification.requestPermission()) !== 'granted') return false;
      const registration = await navigator.serviceWorker.ready;
      const current =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(publicKey),
        }));
      await register(current);
      return true;
    },
    async disable() {
      const current = await subscription();
      if (!current) return;
      const { id } = await register(current);
      await unwrap(
        api.DELETE('/api/v1/notifications/devices/{id}', {
          params: { path: { id } },
        }),
      );
      await current.unsubscribe();
    },
  };
}
