/**
 * Zambuko Doctor App - Service Worker
 * Enables offline functionality and app-like behavior
 */

const CACHE_NAME = 'zambuko-doctor-v1';
const RUNTIME_CACHE = 'zambuko-doctor-runtime-v1';

const STATIC_ASSETS = [
  '/doctor-app/index.html',
  '/doctor-app/css/doctor.css',
  '/doctor-app/js/doctor.js',
  '/shared/css/common.css',
  '/shared/js/database.js',
  '/doctor-app/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[SW Doctor] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW Doctor] Activating...');
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
      fetch(request).catch(() => caches.match('/doctor-app/index.html'))
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
    self.registration.showNotification(data.title || 'New Consultation Request', {
      body: data.body || 'You have a new patient consultation request',
      icon: '/doctor-app/icons/icon-192x192.png',
      badge: '/doctor-app/icons/icon-72x72.png',
      data: data.url,
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/doctor-app/index.html')
  );
});
