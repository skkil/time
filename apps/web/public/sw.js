const SHELL = 'skkil-time-shell-v1';
const SHELL_LIST = '/shell-files.json';
const SHELL_FILES = ['/', '/config.js', '/favicon.svg'];
const MATCH = { ignoreVary: true };

async function precache() {
  const cache = await caches.open(SHELL);
  const built = await fetch(SHELL_LIST)
    .then((response) => (response.ok ? response.json() : []))
    .catch(() => []);
  await Promise.all(
    [...SHELL_FILES, ...built].map((file) =>
      cache.add(file).catch(() => undefined),
    ),
  );
  if (built.length === 0) return;
  const current = new Set(built);
  for (const request of await cache.keys()) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/assets/') && !current.has(pathname))
      await cache.delete(request);
  }
}

async function fromCache(request) {
  const cache = await caches.open(SHELL);
  return (
    (await cache.match(request, MATCH)) ??
    (request.mode === 'navigate' ? await cache.match('/', MATCH) : undefined) ??
    Response.error()
  );
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok)
      void caches
        .open(SHELL)
        .then((cache) => cache.put(request, response.clone()));
    return response;
  } catch {
    return fromCache(request);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) void cache.put(request, response.clone());
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== SHELL)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    url.pathname.startsWith('/assets/')
      ? cacheFirst(request)
      : networkFirst(request),
  );
});

self.addEventListener('push', (event) => {
  const push = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(push.title ?? 'skkil time', {
      body: push.body ?? '',
      icon: '/favicon.svg',
      tag: push.taskId ? `task-${push.taskId}` : undefined,
      data: { taskId: push.taskId ?? null },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const taskId = event.notification.data?.taskId ?? null;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      if (windows.length === 0) {
        await self.clients.openWindow(
          taskId === null ? '/' : `/?open-task=${taskId}`,
        );
        return;
      }
      const client = await windows[0].focus();
      if (taskId !== null) client.postMessage({ type: 'open-task', taskId });
    })(),
  );
});
