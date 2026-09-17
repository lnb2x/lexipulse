importScripts('/sw-precache.js');
const PREFIX = 'lexipulse-shell-';
const CACHE_NAME = `${PREFIX}${self.LEXIPULSE_PRECACHE.version}`;
const STATIC_ASSETS = self.LEXIPULSE_PRECACHE.urls;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache =>
    cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Old tabs can still import their build's hashed chunks. Retain those caches
    // until a natural activation with no open windows; never delete other apps' caches.
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length === 0) {
      for (const key of await caches.keys()) {
        if (key.startsWith(PREFIX) && key !== CACHE_NAME) await caches.delete(key);
      }
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.search || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match('/index.html') || fetch(event.request);
    })());
    return;
  }
  if (!STATIC_ASSETS.includes(url.pathname) && !url.pathname.startsWith('/assets/')) return;
  event.respondWith((async () => {
    const current = await caches.open(CACHE_NAME);
    // Immutable, same-origin build assets have identical bytes across Origin headers.
    const cached = await current.match(event.request, { ignoreVary: true });
    if (cached) return cached;
    if (url.pathname.startsWith('/assets/')) {
      for (const key of await caches.keys()) {
        if (!key.startsWith(PREFIX) || key === CACHE_NAME) continue;
        const old = await (await caches.open(key)).match(event.request, { ignoreVary: true });
        if (old) return old;
      }
    }
    return fetch(event.request);
  })());
});
