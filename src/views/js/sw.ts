// Push service worker: shows a notice when the server sends one, and opens its link when tapped. No caching, no fetch handling.
export const swJs = String.raw`
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(String(d.title || 'Jellypass').slice(0, 100), { body: String(d.body || '').slice(0, 300), icon: '/assets/icon-192.png', badge: '/assets/icon-192.png', data: { url: String(d.url || '/') } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  let url = self.location.origin + '/';
  try { const u = new URL(e.notification.data.url, self.location.origin); if (u.protocol === 'https:') url = u.href; } catch (_) {}
  e.waitUntil(self.clients.openWindow(url));
});
`;
