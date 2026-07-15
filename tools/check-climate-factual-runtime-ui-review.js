#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { REQUIRED_UI_REVIEW_PIN_PATHS } = require('./lib/globe-runtime-assets');

const ROOT = path.resolve(__dirname, '..');
const REVIEW_PATH = 'data/climate/reviews/climate-factual-runtime-ct42-ui-review.json';
const EXPECTED_COMMIT = 'c7ba0560b164e5f3b67c01e96abf75720ad3fd7a';
const REQUIRED_GATES = [
  'runtime-boundary', 'truth-language', 'magnitude-and-gaps', 'chart-table-source',
  'screen-reader-semantics', 'keyboard-focus', 'touch-targets', 'responsive-320',
  'zoom-200', 'reduced-motion', 'contrast', 'color-removal', 'polygon-render',
  'fallback-render', 'smoke-and-stack'
];
const EXPECTED_RUNTIME_EVIDENCE = {
  source_geometry_features: 177,
  interactive_entities: {
    total: 201,
    reviewed_factual: 194,
    source_gaps: 7,
  },
  evidence_browser_entities: {
    total: 249,
    reviewed_factual: 206,
    source_gaps: 43,
  },
  renderer_canvases: 1,
  smoke_test: {
    passed: 22,
    total: 22,
    failed: 0,
    critical_failed: 0,
  },
  stack_lint_issues: 0,
  delivery_versions: {
    globe_system_css: 'v15',
    globe_script: 'v10',
    service_worker_registration: '33-focus-trap',
    service_worker_cache: 'elu-v33-focus-trap',
  },
  browser_qa: {
    mobile: {
      viewports_css_px: ['320x720', '375x720'],
      horizontal_overflow_px: 0,
      card_header_overlaps: 0,
      minimum_control_target_px: 44,
    },
    reflow: {
      css_viewport_px: '640x400',
      device_scale_factor: 2,
      horizontal_overflow_px: 0,
      card_fully_visible: true,
    },
    reduced_motion: {
      entry_auto_rotate: false,
      selected_auto_rotate: false,
      closed_auto_rotate: false,
      dynamic_preference_auto_rotate: false,
      animations_disabled: true,
    },
    keyboard: {
      backward_focus_cycle: 'heading -> Close -> Previous country -> Next country',
      forward_wrap_returns_to_heading: true,
      arrow_navigation_retains_heading_focus: true,
      escape_and_close_restore_opener: true,
    },
    textures: {
      surface: {
        path: 'assets/globe/runtime/earth-night.jpg',
        width: 3600,
        height: 1800,
        mime: 'image/jpeg',
        flip_y: true,
      },
      sky: {
        path: 'assets/globe/runtime/night-sky.svg',
        width: 4096,
        height: 2048,
        mime: 'image/svg+xml',
        flip_y: true,
        mesh: true,
      },
    },
    security: {
      content_security_policy_violations: 0,
      svg_initiated_subrequests: 0,
    },
    cache: {
      controller_reload_verified: true,
      css_key: '/css/globe-system.css?v=v15',
      globe_key: '/js/globe.js?v=v10',
      service_worker_key: '/sw.js?v=33-focus-trap',
      cache_name: 'elu-v33-focus-trap',
    },
  },
};

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function sha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relativePath))).digest('hex');
}

const review = readJson(REVIEW_PATH);
assert.equal(review.schema_version, '1.1.0');
assert.equal(review.reviewed_commit, EXPECTED_COMMIT);
assert.equal(review.independent, true);
assert.notEqual(review.reviewer_id, review.builder_id);
assert.equal(review.decision, 'pass');
assert.equal(review.data_lineage_reviewed, false);
assert.match(review.data_lineage_boundary, /not independently re-reviewed/);

assert.deepEqual(
  review.reviewed_file_pins.map(pin => pin.path),
  REQUIRED_UI_REVIEW_PIN_PATHS,
  'UI review pins must exactly match the canonical 16-path scope in canonical order'
);
for (const pin of review.reviewed_file_pins) {
  assert.match(pin.sha256, /^[0-9a-f]{64}$/, `invalid reviewed SHA-256: ${pin.path}`);
  assert.equal(sha256(pin.path), pin.sha256, `reviewed file pin drift: ${pin.path}`);
}

const dependency = review.local_runtime_dependency;
assert.equal(dependency.name, 'globe.gl');
assert.equal(dependency.path, 'js/vendor/globe.gl.js');
assert.equal(dependency.version, '2.46.1');
assert.equal(dependency.sha256, '2ab6767f47e2be0ac346cd7a5eb55d259ea3da06d479dc22f1820ddd698f496a');
assert.equal(dependency.committed, false);
assert.equal(dependency.staged_for_candidate_deploy, true);
assert.match(dependency.purpose, /gitignored runtime dependency/);

assert.deepEqual(review.runtime_evidence, EXPECTED_RUNTIME_EVIDENCE);

const gates = new Map(review.gates.map(gate => [gate.id, gate]));
assert.equal(gates.size, review.gates.length, 'duplicate gate id');
assert.deepEqual([...gates.keys()].sort(), REQUIRED_GATES.slice().sort());
for (const id of REQUIRED_GATES) {
  assert.equal(gates.get(id).result, 'pass', `gate did not pass: ${id}`);
  assert.ok(gates.get(id).evidence.length >= 24, `gate lacks evidence: ${id}`);
}

const boundary = review.publication_boundary;
assert.equal(boundary.runtime_ui_review_passed, true);
assert.equal(boundary.factual_display_only, true);
assert.equal(boundary.candidate_release_decision, 'deny');
for (const field of [
  'targets_reviewed', 'commitments_reviewed', 'performance_assessed', 'scores_assessed',
  'ct40_allow_decision', 'release_eligible', 'production_runtime_release',
  'production_use_approved', 'release_authority', 'climate_claim_authority',
]) {
  assert.equal(boundary[field], false, `publication boundary widened: ${field}`);
}
assert.match(boundary.required_next_gate, /CT-40 independent allow decision/);

const index = read('index.html');
const serviceWorker = read('sw.js');
assert.ok(index.includes('href="css/globe-system.css?v=v15"'), 'index CSS cache key drift');
assert.ok(index.includes('src="js/globe.js?v=v10"'), 'index globe cache key drift');
assert.ok(index.includes("register('/sw.js?v=33-focus-trap'"), 'service-worker registration key drift');
assert.ok(serviceWorker.includes("const CACHE_NAME = 'elu-v33-focus-trap';"), 'service-worker cache name drift');
assert.ok(serviceWorker.includes("'/css/globe-system.css?v=v15'"), 'service-worker CSS cache key drift');
assert.ok(serviceWorker.includes("'/js/globe.js?v=v10'"), 'service-worker globe cache key drift');

const geometry = readJson('assets/globe/runtime/ne_110m_admin_0_countries.geojson');
assert.equal(geometry.type, 'FeatureCollection');
assert.equal(geometry.features.length, 177);
const smallNations = readJson('data/small-nations.json');
assert.equal(smallNations.data.length, 28);

const assetManifest = readJson('assets/globe/runtime/manifest.json');
assert.equal(assetManifest.production_use_approved, false);
assert.equal(assetManifest.release_authority, false);

const manifest = readJson('data/climate/runtime/candidate-manifest.json');
assert.equal(manifest.review_status, 'not_reviewed');
assert.equal(manifest.decision, 'deny');
assert.equal(manifest.release_eligible, false);
assert.equal(manifest.production_runtime_release, false);
for (const prohibited of manifest.prohibited_release_files) {
  assert.equal(fs.existsSync(path.join(ROOT, prohibited)), false, `prohibited release file exists: ${prohibited}`);
}

const runtime = readJson('data/climate/runtime/country-factual-candidate.json');
assert.equal(runtime.review_status, 'not_reviewed');
assert.equal(runtime.production_runtime_release, false);
assert.equal(runtime.countries.length, 249);
assert.equal(runtime.countries.filter(country => country.emissions.status === 'reviewed_factual').length, 206);
assert.equal(runtime.countries.filter(country => country.emissions.status === 'source_gap').length, 43);

console.log(`CT-42 independent UI review: PASS (${REQUIRED_GATES.length} gates; ${REQUIRED_UI_REVIEW_PIN_PATHS.length} canonical pins; reviewed ${EXPECTED_COMMIT.slice(0, 7)}; factual display only; candidate/release authority remain false)`);
