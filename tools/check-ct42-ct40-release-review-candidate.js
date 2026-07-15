#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateRelease } = require('./lib/climate-release-gate');
const { REQUIRED_REASON_CODES, compile, hash } = require('./lib/ct42-ct40-release-review');

const ROOT = path.resolve(__dirname, '..');
const PATHS = Object.freeze({
  runtime: 'data/climate/runtime/country-factual-candidate.json',
  facts: 'data/climate/runtime/published-facts-candidate.json',
  sourceRegistry: 'data/climate/source-registry.json',
  candidateManifest: 'data/climate/runtime/candidate-manifest.json',
  dataReview: 'data/climate/reviews/climate-factual-runtime-candidate-ct42-data-review.json',
  uiReview: 'data/climate/reviews/climate-factual-runtime-ct42-ui-review.json',
  primarySourcePilot: 'data/climate/releases/ct11-primary-source-pilot-2026-07-15.json',
  inputArtifact: 'data/climate/reviews/ct42-ct40-release-review-input.json',
  resultArtifact: 'data/climate/reviews/ct42-ct40-release-review-result.json',
  fixture: 'data/climate/fixtures/ct42-ct40-release-review.json',
});
const PROHIBITED = Object.freeze([
  'data/climate/runtime-manifest.json',
  'data/climate/releases/reviewed-release-diff.json',
  'data/climate/releases/ct40-allow-manifest.json',
]);

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function clone(value) { return structuredClone(value); }
function get(target, dotted) { return dotted.split('.').reduce((node, key) => node[Number.isInteger(Number(key)) ? Number(key) : key], target); }
function set(target, dotted, value) { const parts = dotted.split('.'); const key = parts.pop(); const owner = parts.length ? get(target, parts.join('.')) : target; owner[key] = value; }

function loadInputs() {
  const dataReview = json(PATHS.dataReview);
  const uiReview = json(PATHS.uiReview);
  const referenced = new Set([
    ...Object.keys(dataReview.reviewed_input_sha256 || {}),
    ...(uiReview.reviewed_file_pins || []).map(item => item.path),
    PATHS.dataReview,
    PATHS.uiReview,
    PATHS.primarySourcePilot,
  ]);
  return {
    runtime: json(PATHS.runtime),
    facts: json(PATHS.facts),
    sourceRegistry: json(PATHS.sourceRegistry),
    candidateManifest: json(PATHS.candidateManifest),
    dataReview,
    uiReview,
    primarySourcePilot: json(PATHS.primarySourcePilot),
    fileHashes: Object.fromEntries([...referenced].sort().map(relative => [relative, sha256(bytes(relative))])),
  };
}

const actual = compile(loadInputs());
assert.deepEqual(actual.inputArtifact, json(PATHS.inputArtifact), 'CT-40 review input drift; run builder');
assert.deepEqual(actual.resultArtifact, json(PATHS.resultArtifact), 'CT-40 review result drift; run builder');
assert.equal(actual.gateOutput.decision, 'deny');
assert.equal(actual.gateOutput.eligible, false);
assert.deepEqual(actual.gateOutput.reason_codes, REQUIRED_REASON_CODES);
assert.equal(actual.gateOutput.fact_decisions.length, 2060);
assert.equal(actual.gateOutput.fact_decisions.filter(item => item.eligible).length, 0);
assert.equal(actual.gateOutput.review_queue.length, 2061);
assert.equal(actual.resultArtifact.ct40_manifest_calculation_hash, actual.gateOutput.manifest.calculation_hash);
assert.equal(actual.resultArtifact.full_gate_output_sha256, hash(actual.gateOutput));

const candidate = actual.inputArtifact.ct40_candidate;
assert.equal(candidate.facts.length, 2060);
assert.equal(candidate.fact_reviews.length, 0, 'adapter must not infer CT-40 fact reviews from CT-10C batch review');
assert.equal(candidate.profiles.length, 0, 'adapter must not synthesize climate profiles');
assert.equal(candidate.sources.length, 1);
assert.deepEqual(candidate.sources[0].licence, {
  decision_id: null,
  redistribution_approved: null,
  scoring_approved: null,
}, 'adapter must expose absent CT-40 licence decisions as null');
assert.ok(candidate.facts.every(fact => fact.evidence_state === 'not_reviewed'), 'adapter must preserve candidate review state');
assert.equal(candidate.review.status, 'not_reviewed');
assert.deepEqual(candidate.review.reviewer_ids, []);
assert.equal(candidate.review_context.top20_primary_source_review.required_country_ids.length, 20);
assert.equal(candidate.review_context.top20_primary_source_review.pilot_country_ids.length, 4);
assert.equal(candidate.review_context.top20_primary_source_review.independently_reviewed_country_ids.length, 0);
assert.equal(candidate.review_context.release_authority, false);
assert.equal(actual.resultArtifact.release_authority, false);
PROHIBITED.forEach(relative => assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `${relative} must remain absent after DENY`));

const reversed = loadInputs();
reversed.facts.facts.reverse();
const reversedOutput = compile(reversed);
assert.deepEqual(reversedOutput.gateOutput, actual.gateOutput, 'CT-40 decision changed when factual input order reversed');

const fixture = json(PATHS.fixture);
let rejected = 0;
let drifted = 0;
let stable = 0;
for (const mutation of fixture.mutations) {
  if (mutation.target === 'inputArtifact' || mutation.target === 'resultArtifact') {
    const changed = clone(actual[mutation.target]);
    set(changed, mutation.path, mutation.value);
    assert.notDeepEqual(changed, actual[mutation.target], `${mutation.id}: mutation was ineffective`);
    if (mutation.target === 'inputArtifact') {
      const mutatedGate = evaluateRelease(changed.ct40_candidate);
      assert.equal(mutatedGate.decision, 'deny', `${mutation.id}: a single fabricated field bypassed CT-40`);
    } else {
      assert.notEqual(changed.decision, changed.eligible ? 'allow' : 'deny', `${mutation.id}: fabricated result remained internally consistent`);
    }
    drifted += 1;
    continue;
  }

  const changed = loadInputs();
  const target = changed[mutation.target];
  if (mutation.operation === 'pop') get(target, mutation.path).pop();
  else if (mutation.operation === 'reverse') get(target, mutation.path).reverse();
  else if (mutation.value_from) set(target, mutation.path, get(target, mutation.value_from));
  else set(target, mutation.path, mutation.value);

  if (mutation.expected === 'same-decision') {
    const output = compile(changed);
    assert.deepEqual(output.gateOutput, actual.gateOutput, `${mutation.id}: deterministic gate output drift`);
    stable += 1;
  } else {
    assert.throws(() => compile(changed), undefined, `${mutation.id}: unreviewed mutation was accepted`);
    rejected += 1;
  }
}

process.stdout.write([
  'CT-42→CT-40 real release-review candidate: PASS (truthful DENY)',
  `  actual facts evaluated: ${actual.gateOutput.fact_decisions.length}`,
  `  canonical deny reasons: ${actual.gateOutput.reason_codes.join(', ')}`,
  `  adversarial mutations: ${rejected} rejected; ${drifted} artifact drifts detected; ${stable} deterministic reorder`,
  '  runtime manifest / release diff / CT-40 allow manifest: absent',
].join('\n') + '\n');
