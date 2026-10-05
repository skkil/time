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
