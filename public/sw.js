const CACHE_NAME = 'king-queen-v1';

self.addEventListener('install', (e) => {
  // Pre-cache just the app shell for offline fallback
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(['/', '/index.html']))
  );
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

  // Never intercept Firebase / GitHub / Cloudflare API calls
  const apiHosts = ['googleapis.com', 'github.com', 'firebaseio.com', 'cloudflare.com'];
  if (apiHosts.some((h) => url.hostname.includes(h))) return;

  // Same-origin: network-first, cache fallback (for offline)
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
