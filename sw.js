/**
 * Service Worker — Earth Love United
 * Cache-first for static assets, network-first for HTML and data files.
 * Version bump (v6) forces cache refresh on deploy.
 */
const CACHE_NAME = 'elu-v6';
const STATIC_ASSETS = [
  // HTML
  '/',
  '/index.html',
  '/gaia.html',
  // CSS (critical — preloaded)
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
  // JS — Foundation (must load first)
  '/js/gaia-utils.js',
  '/js/module-contracts.js',
  '/js/event-bus.js',
  '/js/storage-adapter.js',
  '/js/storage.js',
  // JS — Data layer
  '/js/data.js',
  '/js/data-schema.js',
  '/js/vendor/globe.gl.js',
  // JS — Core modules
  '/js/quiz.js',
  '/js/cycle.js',
  '/js/biomes.js',
  '/js/counters.js',
  '/js/scenario.js',
  '/js/globe.js',
  '/js/globe-modes.js',
  '/js/globe-restore.js',
  '/js/globe-ndvi.js',
  '/js/climate-data-loader.js',
  '/js/globe-events.js',
  // JS — GAIA layer
  '/js/gaia-legacy/gaia-data.js',
  '/js/gaia-legacy/gaia-signals.js',
  '/js/gaia-legacy/gaia-charts.js',
  '/js/gaia-voice.js',
  '/js/gaia-engagement.js',
  '/js/gaia-journal.js',
  '/js/gaia-bubble.js',
  '/js/globe-overlay.js',
  '/js/site-panel.js',
  '/js/carbon-clock.js',
  '/js/country-data.js',
  '/js/delegation.js',
  '/js/pledge-wall.js',
  '/js/gaia-nodes.js',
  '/js/gaia-legacy/gaia-knowledge.js',
  '/js/gaia-overlay-knowledge.js',
  '/js/ndvi-verifier.js',
  '/js/gaia-presence.js',
  '/js/registry-check.js',
  '/js/module-validator.js',
  '/js/bridge-client.js',
  '/js/app.js',
  // JS — gaia.html specific
  '/js/gaia-chat.js',
  '/js/gaia-embeddings.js',
  '/js/gaia-reranker.js',
  '/js/gaia-retrieval.js',
  '/js/gaia-structured.js',
  '/js/gaia-legacy/gaia-dom-adapter.js',
  '/js/gaia-legacy/gaia-integration.js',
  // JS — DIS (GAIA intelligence)
  '/dis/gaia-mind.js',
  '/dis/gaia-state-machine.js',
  '/dis/gaia-voice-engine.js',
  '/dis/gaia-voice-data.js',
  '/dis/gaia-quest-system.js',
  '/dis/gaia-key-gate.js',
  '/dis/gaia-client.js',
  '/dis/gaia-knowledge.js',
  // Data (small, cacheable)
  '/data/biomes.json',
  '/data/sites.json',
  '/data/climate-events.json',
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
