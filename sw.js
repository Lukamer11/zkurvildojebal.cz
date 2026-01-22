/* sw.js — jednoduchý offline cache pro GitHub Pages / WebView
   - Precache jen minimum
   - Ostatní soubory cachuje za běhu (cache-first)

   Offline bude fungovat po první online návštěvě (cache se musí naplnit),
   nebo když je web přímo zabalený v APK.
*/

const CACHE_VERSION = 'sf-cache-v1';
const CORE_ASSETS = [
  './offline.html',
  './login.html',
  './supabase_stub.js',
  './menu.js',
  './menu.css',
  './mobile.css',
  './sf_scale.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_VERSION ? null : caches.delete(k))));
    self.clients.claim();
  })());
});

function isHtmlRequest(req) {
  return req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // jen GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // cachujeme jen same-origin (GitHub Pages nebo v APK assety přes http(s))
  if (url.origin !== self.location.origin) return;

  // HTML: network-first (aktuální verze), fallback na cache/offline
  if (isHtmlRequest(req)) {
    event.respondWith((async () => {
      try {
        const netRes = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, netRes.clone());
        return netRes;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match('./offline.html');
      }
    })());
    return;
  }

  // Ostatní: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const netRes = await fetch(req);
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, netRes.clone());
      return netRes;
    } catch {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
