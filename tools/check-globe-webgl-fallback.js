#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = 'data/climate/fixtures/globe-webgl-fallback.json';
const PROHIBITED_RELEASE_FILES = [
  'data/climate/runtime-manifest.json',
  'data/climate/releases/reviewed-release-diff.json',
  'data/climate/releases/ct40-allow-manifest.json',
];

function text(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function json(relative) {
  return JSON.parse(text(relative));
}

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `source boundary missing: ${start} .. ${end}`);
  return source.slice(from, to);
}

function compile() {
  const app = text('js/app.js');
  const globe = text('js/globe.js');
  const html = text('index.html');
  const css = text('css/globe-system.css');
  const smoke = text('tools/smoke-test.js');
  const architecture = text('ARCHITECTURE.md');
  const candidate = json('data/climate/runtime/country-climate-intelligence.json');
  const carbon = candidate.lens_orders.carbon;
  const fallbackHtml = between(html, '<section id="globe-fallback"', '</section>');
  const fallbackRuntime = between(globe, '  showFallback(reasonCode)', '  setTheme(theme)');
  const detailRuntime = between(globe, '  _renderFallbackCountry(iso, focusDetail)', '  hideFallback(options = {})');

  return {
    schema_version: '2.0.0',
    runtime: {
      vendor_failure_route: app.includes("safeCall('GlobeModule', 'showFallback', 'library_load_failed')") && app.includes('return false;'),
      boolean_initialization: app.includes('GlobeModule._initialized = GlobeModule.init() === true;'),
      webgl_gate: globe.includes('hasWebGLSupport()') && globe.includes('if (!this.hasWebGLSupport())') && globe.includes("this.showFallback('webgl_unavailable')"),
      constructor_boundary: /try\s*\{\s*renderer = new window\.Globe/.test(globe) && globe.includes("this.showFallback('globe_construction_failed')") && globe.includes('this._teardownFailedRenderer();'),
      missing_constructor_route: globe.includes("this.showFallback('library_unavailable')"),
      retry_route: app.includes('async retryGlobe()') && globe.includes("if (name === 'retry') safeCall('App', 'retryGlobe')"),
      stable_reason_codes: ['library_load_failed', 'library_unavailable', 'webgl_unavailable', 'globe_construction_failed', 'globe_container_missing'].every(code => globe.includes(code)),
      preparation_failure_codes: ['candidate_data_unavailable', 'country_geometry_unavailable', 'visual_assets_unavailable'].every(code => globe.includes(code)),
      user_invoked_browser: html.includes('aria-label="Browse all 249 climate intelligence records"') && globe.includes("stableReason === 'evidence_browse_requested'") && globe.includes("evidence_browse_requested: 'All 249 registry entities"),
      guarded_browser_return: globe.includes('closeEvidenceBrowser()') && globe.includes("querySelectorAll('canvas').length === 1") && globe.includes('this._teardownFailedRenderer();'),
      context_loss_route: globe.includes("addEventListener('webglcontextlost', this._onCanvasWebGLContextLost)") && globe.includes("this.showFallback('webgl_unavailable')"),
      contracts_registered: globe.includes("'hasWebGLSupport'") && globe.includes("'showFallback'") && globe.includes("'hideFallback'") && globe.includes("'closeEvidenceBrowser'") && globe.includes("'globe:fallback-shown'") && app.includes("'retryGlobe'") && app.includes("'browseEvidence'") && app.includes("'globe:fallback-shown'"),
      lens_parity: globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getRailRows'") && globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getCountryView'") && globe.includes('this._renderFallbackEvidence();'),
    },
    accessibility: {
      body_level_region: html.indexOf('<section id="globe-fallback"') > html.indexOf('<div id="globeViz" aria-hidden="true"></div>') && fallbackHtml.includes('aria-labelledby="globe-fallback-title"'),
      closed_inert: fallbackHtml.includes('hidden aria-hidden="true"') && css.includes('#globe-fallback[hidden] { display: none !important; }'),
      labelled_status: fallbackHtml.includes('id="globe-fallback-title" tabindex="-1"') && fallbackHtml.includes('role="status" aria-live="polite"'),
      searchable_evidence: fallbackHtml.includes('id="globe-fallback-search"') && fallbackHtml.includes('id="globe-fallback-country-list"') && fallbackRuntime.includes('data-fallback-country-iso') && fallbackRuntime.includes("if (name === 'close')"),
      focus_restoration: app.includes("safeCall('GlobeModule', 'rememberFallbackOpener', document.activeElement)") && app.includes("safeCall('GlobeModule', 'hideFallback', { restoreFocus: true, preserveOpener: false })") && globe.includes('requestAnimationFrame(() => opener.focus({ preventScroll: true }))'),
      touch_targets_44px: css.includes('.elu-fallback-actions .glass-btn') && css.includes('.elu-fallback-search input') && css.includes('min-height: 44px;') && css.includes('min-height: 52px;'),
      reduced_motion: css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('#globe-fallback *') && css.includes('transition: none !important;'),
      theme_compatible: css.includes('background: var(--hud-bg-strong);') && css.includes('html[data-theme="light"] body.globe-mode .elu-fallback-detail-value strong'),
      stacking_safe: css.includes('z-index: 60;') && css.includes('body.globe-fallback-active #globeViz') && css.includes('body.globe-fallback-active #globe-back-btn'),
    },
    data: {
      registry_entities: candidate.countries.length,
      carbon_eligible: carbon.eligible_count,
      carbon_gaps: carbon.unranked_count,
      mapped_entities: Number((globe.match(/EXPECTED_INTERACTIVE_ENTITY_COUNT = (\d+)/) || [])[1]),
      metric_count: Object.keys(candidate.metric_definitions).length,
      lens_count: candidate.lens_catalog.length,
      review_status: candidate.release.review_state,
      production_runtime_release: candidate.release.production_runtime_release,
    },
    truth: {
      durable_public_copy: fallbackHtml.includes('same carbon, power, and physical-climate metrics') && !/CT-\d|\bdeny|\bdenied/i.test(fallbackHtml),
      no_public_review_claim: !/\breviewed\b/i.test(fallbackHtml) && !fallbackRuntime.includes('reviewed factual series'),
      no_assessment_field_reads: !/country\.assessment|assessment\?\.|\.score\b/.test(detailRuntime),
      no_performance_language: !/pledges?\s+vs\.?\s+reality|climate performance|performance score/i.test(fallbackHtml + fallbackRuntime),
      gaps_unranked: fallbackRuntime.includes('explicit data gap, unranked') && fallbackRuntime.includes('Data gap'),
      methods_and_sources: globe.includes('Methods &amp; sources') && globe.includes('fact.sources') && globe.includes('fact.uncertainty'),
      no_public_primap: !/PRIMAP/i.test(fallbackHtml + fallbackRuntime + detailRuntime),
    },
    validation: {
      smoke_contract: smoke.includes('Non-WebGL fallback is body-level, accessible, and fail-closed') && smoke.includes('data-fallback-evidence-state="factual"') && smoke.includes('data-fallback-evidence-state="gap"') && smoke.includes('All 249 evidence records remain first-class and searchable'),
      architecture_route: architecture.includes('load failure → show body-level #globe-fallback evidence view') && architecture.includes('60  #globe-fallback (failure or user-invoked evidence browser), .hex-legend') && architecture.includes('Close/Escape validates the renderer again before returning'),
      release_files_absent: PROHIBITED_RELEASE_FILES.every(relative => !fs.existsSync(path.join(ROOT, relative))),
    },
  };
}

function validate(snapshot) {
  assert.equal(snapshot.schema_version, '2.0.0');
  for (const [groupName, group] of Object.entries(snapshot)) {
    if (groupName === 'schema_version' || groupName === 'data') continue;
    for (const [name, value] of Object.entries(group)) assert.equal(value, true, `${groupName}.${name} failed`);
  }
  assert.equal(snapshot.data.registry_entities, 249);
  assert.equal(snapshot.data.carbon_eligible, 213);
  assert.equal(snapshot.data.carbon_gaps, 36);
  assert.equal(snapshot.data.mapped_entities, 201);
  assert.equal(snapshot.data.metric_count, 18);
  assert.equal(snapshot.data.lens_count, 3);
  assert.equal(snapshot.data.review_status, 'source_validated_factual_candidate');
  assert.equal(snapshot.data.production_runtime_release, false);
}

function locate(target, dottedPath) {
  const parts = dottedPath.split('.');
  const key = parts.pop();
  const owner = parts.reduce((value, part) => value[part], target);
  return { owner, key };
}

const snapshot = compile();
validate(snapshot);

let rejected = 0;
for (const mutation of json(FIXTURE).mutations) {
  const changed = structuredClone(snapshot);
  const { owner, key } = locate(changed, mutation.path);
  owner[key] = structuredClone(mutation.value);
  assert.throws(() => validate(changed), undefined, `mutation accepted: ${mutation.id}`);
  rejected++;
}

console.log(`globe WebGL fallback: PASS (three-lens parity; 249 entities = 213 carbon records + 36 explicit gaps; ${rejected} adversarial mutations rejected; production release remains false)`);

module.exports = { compile, validate };
