/**
 * Zambuko Dispatch App - Service Worker
 * Enables offline functionality and app-like behavior
 */

const CACHE_NAME = 'zambuko-dispatch-v1';
const RUNTIME_CACHE = 'zambuko-dispatch-runtime-v1';

const STATIC_ASSETS = [
  '/dispatch-app/index.html',
  '/dispatch-app/css/dispatch.css',
  '/dispatch-app/js/dispatch.js',
  '/shared/css/common.css',
  '/shared/js/database.js',
  '/dispatch-app/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[SW Dispatch] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW Dispatch] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/dispatch-app/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.status === 200) {
          const cache = caches.open(CACHE_NAME);
          cache.then((c) => c.put(request, response.clone()));
        }
        return response;
      });
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Emergency Alert', {
      body: data.body || 'New emergency request received',
      icon: '/dispatch-app/icons/icon-192x192.png',
      badge: '/dispatch-app/icons/icon-72x72.png',
      data: data.url,
      vibrate: [200, 100, 200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/dispatch-app/index.html')
  );
});
