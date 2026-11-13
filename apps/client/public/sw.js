// Takes over open tabs at once, so a notification click can navigate them.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim())
);

// The server sends { title, body, url, tag }. A burst in one room shares a tag, so it replaces one notification.
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch {
    return;
  }
  if (!payload?.title) return;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      renotify: true,
      data: { url: payload.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/', self.location.origin)
    .href;

  event.waitUntil(
    (async () => {
      const tabs = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const tab = tabs.find(
        (client) => new URL(client.url).origin === self.location.origin
      );
      if (tab) {
        try {
          await tab.focus();
          await tab.navigate(url);
          return;
        } catch {
          // A tab that cannot be navigated gets a new window below.
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
