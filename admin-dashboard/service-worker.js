/**
 * Zambuko Admin Dashboard - Service Worker
 * Enables offline functionality and app-like behavior
 */

const CACHE_NAME = 'zambuko-admin-v1';
const RUNTIME_CACHE = 'zambuko-admin-runtime-v1';

const STATIC_ASSETS = [
  '/admin-dashboard/index.html',
  '/admin-dashboard/css/admin.css',
  '/admin-dashboard/js/admin.js',
  '/shared/css/common.css',
  '/shared/js/database.js',
  '/shared/js/utils.js',
  '/admin-dashboard/manifest.json'
];

self.addEventListener('install', (event) => {
  console.log('[SW Admin] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW Admin] Activating...');
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

  // Don't cache Chart.js CDN
  if (url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/admin-dashboard/index.html'))
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
