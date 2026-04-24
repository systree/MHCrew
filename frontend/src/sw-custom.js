// ---------------------------------------------------------------------------
// sw-custom.js — Custom Service Worker
// VitePWA injectManifest mode: Workbox injects the precache manifest here.
// ---------------------------------------------------------------------------
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies'; // CacheFirst used for images
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Workbox injects the precache manifest into this variable.
// eslint-disable-next-line no-underscore-dangle
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ---------------------------------------------------------------------------
// Skip waiting + claim clients immediately
// ---------------------------------------------------------------------------
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ---------------------------------------------------------------------------
// Runtime caching — mirrors the previous workbox config
// ---------------------------------------------------------------------------

// Individual jobs & sub-resources
registerRoute(
  ({ url }) => /^\/api\/jobs\/[^/]/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'jobs-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
    networkTimeoutSeconds: 10,
  })
);

// Job list
registerRoute(
  ({ url }) => url.pathname === '/api/jobs',
  new NetworkFirst({
    cacheName: 'jobs-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
    networkTimeoutSeconds: 10,
  })
);

// All other API endpoints
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
    networkTimeoutSeconds: 10,
  })
);

// Images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// SPA navigation fallback — use Workbox's own precache handler so it always
// serves the correct (up-to-date) index.html from the precache manifest.
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('/index.html'),
    { denylist: [/^\/api\//] }
  )
);

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Mover Hero', body: event.data.text() };
  }

  const title   = data.title ?? 'Mover Hero';
  const options = {
    body:  data.body  ?? '',
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag:   data.tag   ?? 'mh-notification',
    data:  { url: data.url ?? '/dashboard' },
    vibrate:        [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---------------------------------------------------------------------------
// Notification click — open or focus the app at the specified URL
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/dashboard';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window if one matches the target URL
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise focus any open window and navigate, or open a new one
        if (clientList.length > 0 && 'focus' in clientList[0]) {
          return clientList[0].focus().then((c) => c.navigate(targetUrl));
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});
