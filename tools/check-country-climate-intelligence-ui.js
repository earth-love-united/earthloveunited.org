#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('./lib/country-climate-intelligence');

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const presentation = fs.readFileSync(path.join(ROOT, 'js/country-climate-intelligence.js'), 'utf8');
const globe = fs.readFileSync(path.join(ROOT, 'js/globe.js'), 'utf8');
const guidedOrbit = fs.readFileSync(path.join(ROOT, 'js/guided-first-orbit.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/globe-system.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const dataAt = index.indexOf('src="js/data.js?v=v7"');
const intelligenceAt = index.indexOf('src="js/country-climate-intelligence.js?v=v8"');
const globeAt = index.indexOf('src="js/globe.js?v=v26"');
assert(dataAt >= 0 && dataAt < intelligenceAt && intelligenceAt < globeAt, 'classic script order must be Data → Country Climate Intelligence → GlobeModule');

assert(presentation.includes('const COUNTRY_CLIMATE_INTELLIGENCE = (() => {'));
assert(presentation.includes('window.COUNTRY_CLIMATE_INTELLIGENCE = COUNTRY_CLIMATE_INTELLIGENCE;'));
for (const method of ['init', 'getCountryView', 'getCountryVisual', 'getRailRows', 'getLegend', 'getState', 'reset', 'destroy']) {
  assert(new RegExp(`provides: \\[[^\\]]*['"]${method}['"]`, 's').test(presentation), `Country Climate Intelligence contract does not provide ${method}`);
}
assert(globe.includes('setLens(lensId)'));
assert(globe.includes('getLens()'));
assert(globe.includes("EventBus.emit('globe:lens-changed'"));
assert(globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getRailRows'"));
assert(globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getLegend'"));
assert(presentation.includes("const reliefKind = lens.visual.extrusion === 'transparent_log' ? 'metric_log' : 'metric_linear'"));
assert(presentation.includes("relief: metricRelief ? reliefKind : 'base_tile'"));
assert(presentation.includes('relief_encodes_metric: metricRelief'));
assert(presentation.includes('const RELIEF_BASE_ALTITUDE = 0.007;'));
assert(presentation.includes('const RELIEF_RANGE = 0.005;'));
assert(presentation.includes("query.get('carbon-relief') === CARBON_RELIEF_DEMO_VALUE"));
assert(presentation.includes("relief_direction: inverseCarbonDemo ? 'lower_value_higher' : 'higher_value_higher'"));
assert(presentation.includes("relief_note: inverseCarbonDemo ? 'Inverse relief demo' : null"));
assert(presentation.includes('Color and the rail still show raw emissions; this is not a performance score.'));
assert(presentation.includes('Subtle bounded linear tile relief and color show clean electricity share.'));
assert(presentation.includes('Subtle linear tile relief and color show projected warming—not vulnerability or damage.'));
assert(guidedOrbit.includes('Color and subtle tile relief follow the selected metric: Carbon is log-scaled, Power bounded linear, and Physical linear.'));
assert(!guidedOrbit.includes('Only Carbon uses transparent log-scaled height'));
assert(globe.includes('_countryPolygonSideColorFn(feature)'));
assert(globe.includes('.polygonSideColor((f) => this._countryPolygonSideColorFn(f))'));
assert(globe.includes('class="elu-rank-relief-note"'));
assert(globe.includes('Inverse relief demo: lower territorial fossil CO₂ sits slightly higher; the raw descending rail is unchanged.'));
assert(css.includes('.elu-rank-relief-note'));
assert(globe.includes('const chartFacts = Array.isArray(view.detail_charts)'));
assert(globe.includes('class="elu-trajectory-trend"'));
assert(css.includes('.elu-trajectory-trend'));
assert(globe.includes("powerPreference: 'high-performance'"), 'renderer must request the high-performance GPU path');
assert(globe.includes('const GLOBE_TARGET_FPS = 120;'), '120 FPS renderer target is missing');
assert(globe.includes('getPerformanceState()'), 'renderer performance telemetry is missing');
assert(globe.includes('lensIds.forEach(lensId => this._buildCountryDeck(lensId, { force: true }))'), 'all three navigation decks must be warmed before the renderer starts');
assert(globe.includes('const cached = this._countryDeckByLens?.[lensId]'), 'lens switches must reuse the warmed navigation deck');
assert(globe.includes('this.world.polygonStrokeColor((f) => this._countryBorderColorFn(f));'), 'hover path must update only the country outline');
assert(globe.includes('if (options.visuals === true)'), 'full polygon visual refresh must be an explicit lens-only path');
assert(globe.includes("this._countryTooltipResizeObserver = new ResizeObserver"), 'hover tooltip sizing must be learned without a synchronous layout read');
assert(!/_positionCountryInfoCard\(event\)[\s\S]{0,600}tt\.offset(Width|Height)/.test(globe), 'pointer positioning must not force tooltip layout');
assert(globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getCountryVisual'"), 'polygon accessors must use the compact visual contract');
assert(!/_countryHexColorFn\(feature\)\s*\{[\s\S]{0,160}_getCountryDisplayData\(feature\)/.test(globe), 'hot color accessor must not build the country-card model');
assert(globe.includes('polygonCapCurvatureResolution(8)'), 'country caps must retain the bounded 8-degree tessellation');

const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/runtime/country-climate-intelligence.json'), 'utf8'));
const presentationSandbox = {
  URLSearchParams,
  console,
  hasModule: () => false,
  safeGet(globalName, methodName, fallback) {
    if (globalName !== 'Data') return fallback;
    if (methodName === 'getClimateIntelligenceRelease') return release;
    if (methodName === 'isClimateIntelligenceReady') return true;
    return fallback;
  },
};
presentationSandbox.window = presentationSandbox;
presentationSandbox.location = { search: '' };
vm.runInNewContext(presentation, presentationSandbox, { filename: 'country-climate-intelligence.js' });
const viewsByLens = Object.fromEntries(['carbon', 'power', 'physical'].map(lensId => [lensId,
  presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryView('JPN', lensId)]));
for (const [lensId, view] of Object.entries(viewsByLens)) {
  assert(view, `Japan ${lensId} view did not resolve`);
  const glanceIds = Array.from(view.at_a_glance, fact => fact.id);
  const panelIds = Array.from(view.active_panel.facts, fact => fact.id);
  assert.strictEqual(glanceIds.filter(id => panelIds.includes(id)).length, 0, `${lensId} At-a-glance metrics must not repeat in the lens panel`);
}
const physicalView = viewsByLens.physical;
const cachedPhysicalVisual = presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryVisual('JPN', 'physical');
assert.strictEqual(cachedPhysicalVisual, presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryVisual('JPN', 'physical'), 'compact visual models must be cached per country and lens');
assert.strictEqual(JSON.stringify(cachedPhysicalVisual), JSON.stringify(physicalView.visual), 'country-card and renderer visual contracts must match');
assert.strictEqual(physicalView.detail_chart.id, 'climate.temperature.observed_trend');
assert.deepStrictEqual(Array.from(physicalView.detail_charts, chart => chart.id), ['climate.temperature.observed_trend', 'climate.precipitation.observed_trend']);
assert.deepStrictEqual(Array.from(physicalView.detail_charts, chart => chart.series.length), [56, 56]);
assert.deepStrictEqual(Array.from(physicalView.detail_charts, chart => chart.series_unit), ['°C', 'mm/year']);
assert(physicalView.detail_charts.every(chart => chart.evidence_label === 'ERA5 reanalysis'));
const physicalGlanceIds = new Set(Array.from(physicalView.at_a_glance, fact => fact.id));
const physicalPanelIds = new Set(Array.from(physicalView.active_panel.facts, fact => fact.id));
for (const chart of physicalView.detail_charts) {
  assert(!physicalGlanceIds.has(chart.id) && !physicalPanelIds.has(chart.id), `${chart.id} must render once as a chart, not repeat as a fact card`);
}
assert.strictEqual(physicalView.methods.facts.length, 4, 'Methods drawer must retain all Physical facts after visual de-duplication');

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

assert(serviceWorker.includes("const CACHE_NAME = 'elu-v51-globe-120fps'"));
assert(serviceWorker.includes("'/js/country-climate-intelligence.js?v=v8'"));
assert(serviceWorker.includes("'/data/climate/runtime/country-climate-intelligence.json?v=cci1candidate5'"));
assert(serviceWorker.includes("'/data/climate/runtime/country-factual-candidate.json?v=ct42candidate1'"));
assert(!serviceWorker.includes('/data/carbon-projects.json'), 'retired project data must not be pinned by the climate runtime cache');

console.log('Country Climate Intelligence UI contract check passed (classic load order, three lenses, metric-first copy, body overlays, fallback, and rollback pin).');
