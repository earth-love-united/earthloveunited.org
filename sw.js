/**
 * Service Worker — Earth Love United
 * Cache-first for media, network-first for HTML, data, CSS, and JavaScript.
 * Globe cache (v37) — retain the original pinned Three-Globe sky while shipping
 * the reviewed HUD dock clearance and opaque high-contrast return control.
 */
const CACHE_NAME = 'elu-v37-return-contrast';
const STATIC_ASSETS = [
  // HTML
  '/',
  '/index.html',
  // CSS (critical CSS is inlined in index.html)
  '/css/carbon-clock.css?v=v2',
  '/css/globe-system.css?v=v19',
  '/assets/legacy/elu-logo.png',
  '/assets/legacy/elu-logo-light.png',
  '/assets/globe/runtime/manifest.json',
  '/assets/globe/runtime/ne_110m_admin_0_countries.geojson?v=a4d67eac9c75',
  '/assets/globe/runtime/earth-night.jpg?v=373e5a08c9f3',
  '/assets/globe/runtime/night-sky.png?v=7e1d5e780301',
  '/assets/globe/runtime/earth-blue-marble.jpg?v=228deba2e4b6',
  '/assets/globe/runtime/earth-topology.png?v=839b12da2e4d',
  // JS — v1 core
  '/js/gaia-utils.js',
  '/js/module-contracts.js',
  '/js/event-bus.js',
  '/js/storage-adapter.js',
  '/js/storage.js',
  '/js/data-schema.js?v=v1',
  '/js/data.js?v=v2',
  '/js/globe.js?v=v13',
  '/js/carbon-clock.js?v=v1',
  '/js/app.js?v=v3',
  '/js/vendor/globe.gl.js',
  // Data (small, cacheable)
  '/data/carbon-projects.json?v=ct42candidate1',
  '/data/climate/runtime/country-factual-candidate.json?v=ct42candidate1',
];

// ── Install: pre-cache static assets ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
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
