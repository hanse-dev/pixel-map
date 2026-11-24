'use strict';
// Offline walks: tiles, hit map, height tiles and narration of a walk are stored on request (message
// {cache: [urls]}); afterwards they are served from the cache first. Pages and data stay network-first.
const STORE = 'pixel-map-offline-v1';
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', e => {
  if (!e.data || !e.data.cache) return;
  const urls = e.data.cache, port = e.ports[0];
  e.waitUntil((async () => {
    const c = await caches.open(STORE); let done = 0;
    for (let i = 0; i < urls.length; i += 8) {
      await Promise.all(urls.slice(i, i + 8).map(async u => { try { if (!(await c.match(u))) { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await c.put(u, r) } } catch {} done++ }));
      port && port.postMessage({ done, of: urls.length });
    }
    port && port.postMessage({ done: urls.length, of: urls.length, finished: true });
  })());
});
self.addEventListener('fetch', e => {
  const u = e.request.url;
  if (e.request.method !== 'GET') return;
  if (/\.(webp|png|mp3)(\?|$)/.test(u)) {                         // tiles and audio: cache first
    e.respondWith(caches.match(u).then(hit => hit || fetch(e.request)));
  } else if (u.startsWith(self.location.origin)) {                // pages and data: network first, cache as fallback
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(STORE).then(c => c.put(e.request, copy)) } return r })
      .catch(() => caches.match(e.request)));
  }
});
