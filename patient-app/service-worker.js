/**
 * Zambuko Patient App - Service Worker
 * Enables offline functionality and app-like behavior
 */

const CACHE_NAME = 'zambuko-patient-v1';
const RUNTIME_CACHE = 'zambuko-patient-runtime-v1';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/patient-app/index.html',
  '/patient-app/css/patient.css',
  '/patient-app/js/patient.js',
  '/shared/css/common.css',
  '/shared/js/database.js',
  '/patient-app/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
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

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Handle API calls differently - network first
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // For navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/patient-app/index.html'))
    );
    return;
  }

  // Cache first strategy for static assets
  event.respondWith(cacheFirst(request));
});

// Cache first strategy
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    // Cache successful responses
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Fetch failed:', error);
    throw error;
  }
}

// Network first strategy (for API calls)
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const response = await fetch(request);
    // Cache successful API responses
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Fallback to cache if network fails
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Handle background sync (for offline data submission)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-consultations') {
    event.waitUntil(syncConsultations());
  }
});

async function syncConsultations() {
  // Implement your sync logic here
  console.log('[SW] Syncing consultations...');
}

// Handle push notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Zambuko Notification';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/patient-app/icons/icon-192x192.png',
    badge: '/patient-app/icons/icon-72x72.png',
    data: data.url,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data || '/patient-app/index.html')
  );
});
