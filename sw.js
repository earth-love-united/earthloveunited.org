/**
 * Service Worker — Earth Love United
 * Cache-first for static assets, network-first for HTML and data files.
 * Version bump (v8) forces cache refresh on deploy — bundles replaced individual JS.
 */
const CACHE_NAME = 'elu-v8';
const STATIC_ASSETS = [
  // HTML
  '/',
  '/index.html',
  '/gaia.html',
  // CSS (critical — inlined in index.html since A3, but keep for gaia.html / noscript)
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  // CSS (non-critical — deferred)
  '/css/widgets.css',
  '/css/responsive.css',
  '/css/carbon-clock.css',
  '/css/delegation.css',
  '/css/pledge-wall.css',
  '/css/gaia-bubble.css',
  '/css/globe-overlay.css',
  '/css/gaia-presence.css',
  '/css/ndvi-verifier.css',
  '/css/registry-check.css',
  '/css/gaia-sources.css',
  '/css/print.css',
  // JS — Bundles (B1: replaced 42 individual files with 3 bundles)
  '/js/foundation.bundle.js',  // sync: gaia-utils → data
  '/js/app.bundle.js',         // deferred: quiz → app.js (index.html)
  '/js/gaia.bundle.js',        // deferred: gaia-data → gaia-integration (gaia.html)
  // Data (small, cacheable)
  '/data/biomes.json',
  '/data/sites.json',
  '/data/climate-events.json',
  '/data/provenance-registry.json',
];

// ── Install: pre-cache static assets ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Don't fail install if some assets are missing (e.g. CDN refs)
        console.warn('[SW] Some assets failed to cache');
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// ── Fetch: cache-first for static, network-first for data ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests (CDNs, APIs, fonts)
  if (url.origin !== self.location.origin) return;

  // Data files: network-first (always fresh)
  if (url.pathname.startsWith('/data/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // HTML documents should update immediately, with cached fallback offline.
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: cache-first
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline fallback for HTML pages
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/index.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}
