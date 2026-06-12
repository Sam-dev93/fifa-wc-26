/* ============================================================
   World Cup 2026 — Service Worker
   ⬆️  BUMP THIS VERSION EVERY TIME YOU DEPLOY A CHANGE.
   Changing the string is what tells browsers a new version
   exists → the app auto-updates and wipes the old cache.
   ============================================================ */
const CACHE_NAME = 'world-cup-tickets-v13';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json'
];

// Install — pre-cache the shell and activate ASAP (no "waiting")
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate — delete every cache that isn't the current version, then take control
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Allow the page to tell a waiting worker to take over now
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Google Sheets API — always live, never cached
  if (url.hostname.indexOf('googleapis.com') !== -1) {
    event.respondWith(
      fetch(req).catch(() => new Response(
        JSON.stringify({ error: 'offline', message: 'Unable to fetch data while offline' }),
        { headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Same-origin app files (index.html, manifest, icons) — NETWORK FIRST.
  // Always get the freshest file when online; fall back to cache when offline.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cross-origin libraries (e.g. jsPDF from a CDN) — cache first, they rarely change
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
