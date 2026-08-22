const CACHE_NAME = 'pixora-shell-v5';
const SHELL_FILES = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './favicon-32.png',
  './apple-touch-icon.png'
];
// ffmpeg engine files are deliberately NOT pre-cached in the install step — ff-core.wasm
// alone is ~31MB, and pre-caching it would make every fresh install download 31MB before
// the app even opens. They're fetched on demand the first time an export needs the
// compatibility encoder, then served from cache (via the same-origin cache-first fetch
// handler below) on every export after that.

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// Navigation requests (index.html) go NETWORK-FIRST: this app is under active
// development, so the page itself must never be served stale from cache while
// online. Cache is only the offline fallback, not the default source of truth.
// Static assets (icons, manifest) stay cache-first — they don't change between
// releases, so there's no correctness reason to refetch them every load.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => new Response('', { status: 504, statusText: 'Offline and not cached' }));
    })
  );
});
