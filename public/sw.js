const CACHE_NAME = 'king-queen-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never cache Firebase / GitHub / Cloudflare API calls — always network
  const apiHosts = [
    'googleapis.com',
    'github.com',
    'firebaseio.com',
    'cloudflare.com',
  ];
  if (apiHosts.some((h) => url.hostname.includes(h))) return;

  // Cache-first for same-origin static assets (HTML, JS, CSS, images)
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetched = fetch(e.request).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return resp;
        }).catch(() => cached);

        return cached || fetched;
      })
    );
  }
});
