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
  const guided = text('js/guided-first-orbit.js');
  const guidedCss = text('css/guided-first-orbit.css');
  const smoke = text('tools/smoke-test.js');
  const architecture = text('ARCHITECTURE.md');
  const candidate = json('data/climate/runtime/country-climate-intelligence.json');
  const carbon = candidate.lens_orders.carbon;
  const fallbackHtml = between(html, '<section id="globe-fallback"', '</section>');
  const fallbackOpenTag = (fallbackHtml.match(/^<section\b[^>]*>/) || [''])[0];
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
      renderer_lifecycle: app.includes("safeCall('GlobeModule', 'pause')") &&
        app.includes("safeCall('GlobeModule', 'resume')") &&
        globe.includes("document.addEventListener('visibilitychange', this._onVisibilityChange)") &&
        globe.includes('this.world.pauseAnimation()') && globe.includes('this.world.resumeAnimation()') &&
        fallbackRuntime.includes('this.pause();') && fallbackRuntime.includes('this._syncAnimationLifecycle();'),
      contracts_registered: globe.includes("'pause'") && globe.includes("'resume'") && globe.includes("'hasWebGLSupport'") && globe.includes("'showFallback'") && globe.includes("'hideFallback'") && globe.includes("'closeEvidenceBrowser'") && globe.includes("'globe:fallback-shown'") && globe.includes("'globe:fallback-hidden'") && globe.includes("'globe:country-navigated'") && guided.includes("EventBus.on('globe:fallback-hidden', _onFallbackHidden)") && guided.includes("EventBus.on('globe:country-navigated', _onCountryNavigated)") && app.includes("'retryGlobe'") && app.includes("'browseEvidence'") && app.includes("'globe:fallback-shown'"),
      lens_parity: globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getRailRows'") && globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getCountryView'") && globe.includes('this._renderFallbackEvidence();'),
    },
    accessibility: {
      body_level_region: html.indexOf('<section id="globe-fallback"') > html.indexOf('<div id="globeViz" aria-hidden="true"></div>') &&
        fallbackOpenTag.includes('role="region"') && !fallbackOpenTag.includes('aria-modal=') && fallbackHtml.includes('aria-labelledby="globe-fallback-title"'),
      closed_inert: /\shidden(?:\s|>)/.test(fallbackOpenTag) &&
        /\saria-hidden="true"(?:\s|>)/.test(fallbackOpenTag) &&
        css.includes('#globe-fallback[hidden] { display: none !important; }'),
      labelled_status: fallbackHtml.includes('id="globe-fallback-title" tabindex="-1"') && fallbackHtml.includes('role="status" aria-live="polite"'),
      searchable_evidence: fallbackHtml.includes('id="globe-fallback-search"') && fallbackHtml.includes('id="globe-fallback-country-list"') && fallbackRuntime.includes('data-fallback-country-iso') && fallbackRuntime.includes("if (name === 'close')"),
      lens_and_tutorial_operable: !globe.includes('_setFallbackIsolation(') && !globe.includes('_onFallbackKeydown') &&
        html.includes('id="climate-lens-controls"') && html.includes('id="guided-orbit"') &&
        fallbackRuntime.includes('this._bindLensControls();') &&
        guidedCss.includes('body.globe-fallback-active .guided-orbit[data-mode="interaction"] .guided-orbit-card') &&
        guidedCss.includes('@media (min-width: 801px) and (max-width: 1280px)') &&
        guidedCss.includes('top: auto;') && guidedCss.includes('right: 12px;') &&
        guidedCss.includes('bottom: max(12px, env(safe-area-inset-bottom));') &&
        guidedCss.includes('(max-height: 767px)') && guidedCss.includes('top: 132px;'),
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
      smoke_contract: smoke.includes('Non-WebGL fallback is body-level, accessible, and fail-closed') &&
        smoke.includes('data-fallback-evidence-state="factual"') &&
        smoke.includes('data-fallback-evidence-state="gap"') &&
        smoke.includes('All 249 evidence records remain first-class and searchable') &&
        smoke.includes('Globe renderer follows the visible application lifecycle') &&
        smoke.includes('Guided orbit suppresses no-data routes and owns one control lifecycle') &&
        smoke.includes('Fallback tutorial shelf leaves lens, search, and country chooser operable') &&
        smoke.includes('Country rail exposes the exact lens metric and searchable gaps') &&
        smoke.includes('Guided orbit cues one country-deck move and auto-completes'),
      guided_no_data_terminal: guided.includes("fallbackReason === 'candidate_data_unavailable'") &&
        guided.includes('_suppressUnavailableEvidence(options = {})') &&
        guided.includes("payload?.reason || window.GlobeModule?._fallbackReasonCode") &&
        guided.includes('Climate Intelligence first orbit is unavailable because country evidence could not be loaded.'),
      guided_three_move_completion: guided.includes('const STORAGE_VERSION = 4;') &&
        guided.includes('const FINAL_STEP = 2;') &&
        guided.includes('Swipe through the country deck.') &&
        guided.includes("query.get('guided-orbit') === '1' || query.has('review')") &&
        guided.includes("EventBus.on('globe:country-navigated', _onCountryNavigated)") &&
        guided.includes("complete({ source: payload?.source || 'deck' })") &&
        guided.includes("complete({ source: 'fallback-list' })") &&
        guided.includes("EventBus.on('globe:country-closed', _onCountryClosed)") &&
        guided.includes("goToStep(1, { focus: false })") &&
        globe.includes("EventBus.emit('globe:country-navigated'") &&
        globe.includes("source: navigationSource") &&
        globe.includes('cueCountrySwipe()') && globe.includes('clearCountrySwipeCue()') &&
        guidedCss.includes('body.guided-orbit-step-3:not(.globe-fallback-active) #elu-country-card-wrap #hex-country-tooltip.tt-swipe-cue') &&
        !guided.includes('guided-orbit-dialog-complete') && !guidedCss.includes('body.guided-orbit-step-4'),
      guided_visible_focus_restore: guided.includes("target.closest('[hidden],[aria-hidden=\"true\"],[inert]')") &&
        guided.includes('target.getClientRects().length > 0') && guided.includes('Number(nodeStyle.opacity) === 0') &&
        guided.includes('const candidates = [selectedHeading, fallbackHeading, opener, replay]') &&
        guided.includes('document.activeElement === candidate') &&
        guided.includes('window.requestAnimationFrame(() =>') &&
        detailRuntime.includes('id="globe-fallback-detail-title" tabindex="-1"'),
      guided_listener_teardown: ['_onPrimaryClick', '_onBackClick', '_onCloseClick'].every(handler =>
        guided.includes(`addEventListener('click', ${handler})`) && guided.includes(`removeEventListener('click', ${handler})`)),
      architecture_route: architecture.includes('load failure → show body-level #globe-fallback evidence view') &&
        architecture.includes('60  #globe-fallback (failure or user-invoked evidence browser), .hex-legend') &&
        architecture.includes('Close/Escape validates the renderer again before returning'),
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
  assert.equal(snapshot.data.metric_count, 27);
  assert.equal(snapshot.data.lens_count, 3);
  assert.equal(snapshot.data.review_status, 'normalized_factual_candidate_pending_source_revalidation');
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
