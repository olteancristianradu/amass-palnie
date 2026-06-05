/* AMASS Pâlnie — service worker (PWA, offline) — NETWORK-FIRST ca update-urile să apară imediat.
   Adaptat pentru Next.js: nu cache-uim rute API/_next dinamice agresiv; doar fallback offline. */
const CACHE = 'amass-palnie-v4';
const ASSETS = ['/', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
/* Network-first: încearcă rețeaua, actualizează cache-ul; offline → cache. NU interceptăm API (lasă să eșueze natural). */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return; // datele live trec direct la rețea
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
