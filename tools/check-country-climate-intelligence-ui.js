#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib/country-climate-intelligence');

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const presentation = fs.readFileSync(path.join(ROOT, 'js/country-climate-intelligence.js'), 'utf8');
const globe = fs.readFileSync(path.join(ROOT, 'js/globe.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/globe-system.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const dataAt = index.indexOf('src="js/data.js?v=v4"');
const intelligenceAt = index.indexOf('src="js/country-climate-intelligence.js?v=v3"');
const globeAt = index.indexOf('src="js/globe.js?v=v20"');
assert(dataAt >= 0 && dataAt < intelligenceAt && intelligenceAt < globeAt, 'classic script order must be Data → Country Climate Intelligence → GlobeModule');

assert(presentation.includes('const COUNTRY_CLIMATE_INTELLIGENCE = (() => {'));
assert(presentation.includes('window.COUNTRY_CLIMATE_INTELLIGENCE = COUNTRY_CLIMATE_INTELLIGENCE;'));
for (const method of ['init', 'getCountryView', 'getRailRows', 'getLegend', 'getState', 'reset', 'destroy']) {
  assert(new RegExp(`provides: \\[[^\\]]*['"]${method}['"]`, 's').test(presentation), `Country Climate Intelligence contract does not provide ${method}`);
}
assert(globe.includes('setLens(lensId)'));
assert(globe.includes('getLens()'));
assert(globe.includes("EventBus.emit('globe:lens-changed'"));
assert(globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getRailRows'"));
assert(globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getLegend'"));

const controlsAt = index.indexOf('id="climate-lens-controls"');
const globeVizAt = index.indexOf('id="globeViz"');
assert(controlsAt >= 0 && controlsAt < globeVizAt, 'lens controls must be body-level overlays before #globeViz');
for (const lens of ['carbon', 'power', 'physical']) {
  assert(index.includes(`data-climate-lens="${lens}"`), `missing ${lens} lens button`);
}
assert(index.includes('aria-live="polite"'));
assert(index.includes('Browse all 249 records'));
assert(index.includes('id="globe-fallback-country-list"'));
assert(index.includes('id="globe-fallback-search"'));
assert(index.includes('No composite score, target assessment, finance judgment, or offset adjustment is produced.'));

assert(presentation.includes('citation_only_sources'));
assert(presentation.includes('Citation retained for historical provenance; no values from this source appear in this release.'));
assert(globe.includes('Methods &amp; sources'));
assert(globe.includes('At a glance'));
assert(globe.includes('view.primary.evidence_label') && globe.includes('view.tooltip.evidence_class'));
assert(css.includes('.tt-methods > summary'));
assert(css.includes('min-height: 44px') || css.includes('min-height:44px'));
assert(css.includes('@media (prefers-reduced-motion: reduce)') || css.includes('@media(prefers-reduced-motion:reduce)'));

const publicClimateSurface = [index, globe, css].join('\n');
assert(!/PRIMAP/i.test(publicClimateSurface), 'PRIMAP must not appear in public HTML, globe UI, or public globe CSS');
assert(!/pledges?\s+vs\.?\s+reality|climate performance|country performance score/i.test([presentation, globe].join('\n')), 'retired performance copy remains in the climate UI');
assert(!/provider-logo|source-logo/i.test([index, presentation, globe, css].join('\n')), 'provider logos must not dominate metric-first UI');

assert(serviceWorker.includes("const CACHE_NAME = 'elu-v45-country-climate-fair-hud'"));
assert(serviceWorker.includes("'/js/country-climate-intelligence.js?v=v3'"));
assert(serviceWorker.includes("'/data/climate/runtime/country-climate-intelligence.json?v=cci1candidate2'"));
assert(serviceWorker.includes("'/data/climate/runtime/country-factual-candidate.json?v=ct42candidate1'"));
assert(!serviceWorker.includes('/data/carbon-projects.json'), 'retired project data must not be pinned by the climate runtime cache');

console.log('Country Climate Intelligence UI contract check passed (classic load order, three lenses, metric-first copy, body overlays, fallback, and rollback pin).');
