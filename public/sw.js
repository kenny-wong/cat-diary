// Service worker: shows push notifications and opens the diary when one is tapped.
// It doesn't cache anything; the diary always loads fresh from the network.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch { /* not JSON: show a plain notification */ }
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // The diary is open and in front: let it update its bell instead of popping up a notification.
    const front = windows.find(w => w.visibilityState === 'visible' && w.focused);
    if (front) return front.postMessage({ type: 'notes' });
    windows.forEach(w => w.postMessage({ type: 'notes' }));
    await self.registration.showNotification(msg.title || 'My Little Diary', {
      body: msg.body || 'Something new in your diary',
      tag: msg.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: msg.url || '/' },
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find(w => new URL(w.url).origin === self.location.origin);
    if (open) {
      await open.focus();
      open.postMessage({ type: 'open', url });
    } else {
      await self.clients.openWindow(url);
    }
  })());
});
