// Offline-first service worker. Bump VERSION whenever any precached file changes.
const VERSION = 'datadev-pipe-v2.0.0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/calc.js', './js/data.js', './js/i18n.js',
  './assets/sea.webp', './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png', './assets/fonts/inter.woff2', './assets/fonts/geist.woff2',
  './assets/fonts/vazirmatn.woff2', './assets/fonts/byekan.woff2', './favicon.png',
  './apple-touch-icon-120.png', './apple-touch-icon-152.png', './apple-touch-icon-167.png', './apple-touch-icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && new URL(request.url).origin === self.location.origin) {
      const cache = await caches.open(VERSION);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (request.mode === 'navigate') return caches.match('./index.html');
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(cacheFirst(event.request));
});
