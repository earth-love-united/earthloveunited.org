#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT, fileSha256, readJson } = require('./lib/country-climate-intelligence');

const serviceWorker = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dataSource = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8');
const manifest = readJson(path.join(ROOT, 'data/climate/releases/country-climate-intelligence-v1/release-manifest.json'));
const runtimePath = path.join(ROOT, 'data/climate/runtime/country-climate-intelligence.json');
const rollbackPath = path.join(ROOT, manifest.prior_runtime_retained_for_rollback);

assert(serviceWorker.includes("const CACHE_NAME = 'elu-v46-country-climate-tiled-lenses'"), 'service-worker cache epoch is not v46');
assert(index.includes("navigator.serviceWorker.register('/sw.js?v=46-country-climate-tiled-lenses'"), 'HTML does not request the v46 service worker');
for (const asset of [
  '/css/globe-system.css?v=v27',
  '/css/guided-first-orbit.css?v=v2',
  '/js/data.js?v=v5',
  '/js/country-climate-intelligence.js?v=v4',
  '/js/globe.js?v=v21',
  '/js/guided-first-orbit.js?v=v2',
  '/data/climate/runtime/country-climate-intelligence.json?v=cci1candidate3',
  '/data/climate/runtime/country-factual-candidate.json?v=ct42candidate1',
]) {
  assert(serviceWorker.includes(`'${asset}'`), `service worker does not stage ${asset}`);
}
assert(dataSource.includes("version: 'cci1candidate3'"), 'Data runtime query does not match service-worker staging');
assert.strictEqual(dataSource.match(/CLIMATE_INTELLIGENCE_SHA256 = '([a-f0-9]{64})'/)?.[1], fileSha256(runtimePath), 'Data runtime checksum pin is stale');
assert(fs.existsSync(rollbackPath), 'prior runtime rollback artifact is missing');
assert.notStrictEqual(fileSha256(runtimePath), fileSha256(rollbackPath), 'current and rollback runtime artifacts must be distinct');
assert(serviceWorker.includes("if (url.pathname.startsWith('/data/'))") && serviceWorker.includes('networkFirst(request)'), 'runtime data must use network-first refresh with cached fallback');
assert(serviceWorker.includes('keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))'), 'old cache cleanup is missing');
assert(serviceWorker.includes('self.skipWaiting()') && serviceWorker.includes('self.clients.claim()'), 'atomic service-worker activation hooks are missing');
assert(!serviceWorker.includes('/data/carbon-projects.json'), 'retired carbon-project data remains in the atomic cache set');

console.log(`Country Climate Intelligence atomic staging check passed (elu-v46; runtime ${fileSha256(runtimePath)}; rollback retained).`);
