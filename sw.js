const CACHE_NAME = 'pixora-shell-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './favicon-32.png',
  './apple-touch-icon.png'
];

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

// Cache-first for the app shell. The app itself makes no API calls — the one exception
// is export: every export re-encodes through a WhatsApp-compatibility pass that fetches
// a converter (@ffmpeg/ffmpeg + @ffmpeg/core) from unpkg the first time it's needed in a
// session. That fetch needs a live network connection and isn't pre-cached here (it's a
// large, one-time-per-session download). Anything else not in the shell falls through to
// the network, and a network failure for a navigation returns the cached index.html so
// PIXORA still opens offline instead of showing a browser error page.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 504, statusText: 'Offline and not cached' });
      });
    })
  );
});
