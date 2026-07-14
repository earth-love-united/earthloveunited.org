/**
 * Service Worker — Earth Love United
 * Cache-first for media, network-first for HTML, data, CSS, and JavaScript.
 * Version bump (v25) — light atmospheric background and globe halo.
 */
const CACHE_NAME = 'elu-v25';
const STATIC_ASSETS = [
  // HTML
  '/',
  '/index.html',
  // CSS (critical CSS is inlined in index.html)
  '/css/carbon-clock.css',
  '/css/globe-system.css',
  '/assets/globe/light-atmosphere.png?v=v2',
  // JS — v1 core
  '/js/gaia-utils.js',
  '/js/module-contracts.js',
  '/js/event-bus.js',
  '/js/storage-adapter.js',
  '/js/storage.js',
  '/js/data-schema.js',
  '/js/data.js',
  '/js/globe.js',
  '/js/carbon-clock.js',
  '/js/app.js',
  // Data (small, cacheable)
  '/data/pledge-nodes.json',
  '/data/small-nations.json',
  '/data/carbon-projects.json',
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
    event.respondWith(networkFirst(request, true));
    return;
  }

  // JS/CSS should update immediately too. Bypass the browser HTTP cache here:
  // a deployment can otherwise pair fresh HTML with an older same-URL asset.
  if (request.destination === 'script' || request.destination === 'style' ||
      url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(networkFirst(request, true));
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

async function networkFirst(request, bypassHttpCache = false) {
  try {
    const networkRequest = bypassHttpCache
      ? new Request(request, { cache: 'no-store' })
      : request;
    const response = await fetch(networkRequest);
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
