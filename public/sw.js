// Service Worker for LibraryOS PWA
// Provides high-resilience offline support for desk seat matrix and API caching
const STATIC_CACHE = 'libraryos-static-v5';
const API_CACHE = 'libraryos-api-v5';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/manifest.webmanifest',
  '/libraryos-logo.png',
  '/lib-logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
];

// Read-only API endpoints to cache for offline resilience
const CACHABLE_API_PREFIXES = [
  '/api/seats',
  '/api/libraries',
  '/api/dashboard',
  '/api/collections',
  '/api/platform-config',
  '/api/receipts',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // Continue even if some individual asset fails to precache
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== API_CACHE) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests from the same origin
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // 1. API Caching Strategy (Network-First with Cache Fallback)
  const isCachableApi = CACHABLE_API_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix)
  );

  if (isCachableApi) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Network failed (offline) -> Serve from API cache
          const cached = await caches.match(event.request);
          if (cached) {
            const headers = new Headers(cached.headers);
            headers.set('X-LibraryOS-Offline', 'true');
            return new Response(cached.body, {
              status: cached.status,
              statusText: cached.statusText,
              headers,
            });
          }
          // If no cache, return empty JSON with offline flag
          return new Response(
            JSON.stringify({ offline: true, error: 'Offline: No cached data available yet.' }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'X-LibraryOS-Offline': 'true' },
            }
          );
        })
    );
    return;
  }

  // Skip other non-cachable API routes
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Next.js Static Assets & Chunks (Cache-First with Network Revalidation)
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.ico')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. HTML Navigation Pages (Network-First with Cache & Shell Fallback)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/');
          if (fallback) return fallback;
        }
        return new Response('Offline Mode', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
