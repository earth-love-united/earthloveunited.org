#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REVIEW_PATH = 'data/climate/reviews/climate-factual-runtime-ct42-ui-review.json';
const EXPECTED_COMMIT = '793eade295ae3fa787749e4d6ee112cf374a7634';
const REQUIRED_GATES = [
  'runtime-boundary', 'truth-language', 'magnitude-and-gaps', 'chart-table-source',
  'screen-reader-semantics', 'keyboard-focus', 'touch-targets', 'responsive-320',
  'zoom-200', 'reduced-motion', 'contrast', 'color-removal', 'polygon-render',
  'fallback-render', 'smoke-and-stack'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relativePath))).digest('hex');
}

const review = readJson(REVIEW_PATH);
assert.equal(review.schema_version, '1.0.0');
assert.equal(review.reviewed_commit, EXPECTED_COMMIT);
assert.equal(review.independent, true);
assert.notEqual(review.reviewer_id, review.builder_id);
assert.equal(review.decision, 'pass');
assert.equal(review.data_lineage_reviewed, false);
assert.match(review.data_lineage_boundary, /not independently re-reviewed/);

assert.equal(review.reviewed_file_pins.length, 7);
for (const pin of review.reviewed_file_pins) {
  assert.equal(sha256(pin.path), pin.sha256, `reviewed file pin drift: ${pin.path}`);
}
assert.equal(review.local_runtime_dependency.version, '2.46.1');
assert.equal(review.local_runtime_dependency.sha256, '2ab6767f47e2be0ac346cd7a5eb55d259ea3da06d479dc22f1820ddd698f496a');
assert.equal(review.local_runtime_dependency.committed, false);

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
for (const field of ['targets_reviewed', 'commitments_reviewed', 'performance_assessed', 'scores_assessed', 'ct40_allow_decision', 'release_eligible', 'production_runtime_release']) {
  assert.equal(boundary[field], false, `publication boundary widened: ${field}`);
}
assert.match(boundary.required_next_gate, /CT-40 independent allow decision/);

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

console.log(`CT-42 independent UI review: PASS (${REQUIRED_GATES.length} gates; reviewed ${EXPECTED_COMMIT.slice(0, 7)}; factual display only; CT-40/release remain false)`);
