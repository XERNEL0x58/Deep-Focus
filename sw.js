/**
 * sw.js — Deep-Focus Service Worker
 * Strategy: Cache-First for static assets, Network-First for dynamic requests
 */
'use strict';

const CACHE_NAME    = 'deep-focus-v1.0.0';
const OFFLINE_URL   = './index.html';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/responsive.css',
  './js/storage.js',
  './js/canvas.js',
  './js/game.js',
  './js/ui.js',
  './js/pwa.js',
  './js/app.js',
  './assets/icons/icon-48x48.png',
  './assets/icons/icon-72x72.png',
  './assets/icons/icon-96x96.png',
  './assets/icons/icon-128x128.png',
  './assets/icons/icon-144x144.png',
  './assets/icons/icon-152x152.png',
  './assets/icons/icon-180x180.png',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-256x256.png',
  './assets/icons/icon-384x384.png',
  './assets/icons/icon-512x512.png',
];

/* ── Install ─────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate ────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ───────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin or fonts
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin && !isFont) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }

          // Cache a clone for future requests
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));

          return response;
        })
        .catch(() => {
          // Offline fallback
          if (event.request.destination === 'document') {
            return caches.match(OFFLINE_URL);
          }
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});

/* ── Message Handler (force update) ─────────────────────── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
