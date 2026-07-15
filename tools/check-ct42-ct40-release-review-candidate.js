#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateRelease } = require('./lib/climate-release-gate');
const {
  REQUIRED_DATA_REVIEW_PIN_PATHS,
  REQUIRED_REASON_CODES,
  REQUIRED_UI_REVIEW_PIN_PATHS,
  compile,
  hash,
  reviewPinPaths,
  validateReviewScopes,
} = require('./lib/ct42-ct40-release-review');

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
function hashPaths(paths) { return Object.fromEntries([...new Set(paths)].sort().map(relative => [relative, sha256(bytes(relative))])); }

function loadInputs() {
  const dataReview = json(PATHS.dataReview);
  const uiReview = json(PATHS.uiReview);
  const referenced = new Set([
    ...reviewPinPaths(dataReview, uiReview),
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
    fileHashes: hashPaths(referenced),
  };
}

function scopeFixtureInputs() {
  const dataReview = clone(json(PATHS.dataReview));
  const uiReview = clone(json(PATHS.uiReview));
  const requiredPaths = [...new Set([...REQUIRED_DATA_REVIEW_PIN_PATHS, ...REQUIRED_UI_REVIEW_PIN_PATHS])];
  const fileHashes = hashPaths(requiredPaths);
  dataReview.reviewed_input_sha256 = Object.fromEntries(REQUIRED_DATA_REVIEW_PIN_PATHS.map(path => [path, fileHashes[path]]));
  uiReview.reviewed_commit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  uiReview.reviewed_file_pins = REQUIRED_UI_REVIEW_PIN_PATHS.map(path => ({ path, sha256: fileHashes[path] }));
  return { dataReview, uiReview, fileHashes };
}

function applyScopeMutation(input, mutation) {
  if (mutation.operation === 'delete-data-pin') delete input.dataReview.reviewed_input_sha256[mutation.path];
  else if (mutation.operation === 'set-data-pin') input.dataReview.reviewed_input_sha256[mutation.path] = mutation.value;
  else if (mutation.operation === 'clear-data-pins') input.dataReview.reviewed_input_sha256 = {};
  else if (mutation.operation === 'remove-ui-pin') input.uiReview.reviewed_file_pins = input.uiReview.reviewed_file_pins.filter(pin => pin.path !== mutation.path);
  else if (mutation.operation === 'set-ui-pin') input.uiReview.reviewed_file_pins.find(pin => pin.path === mutation.path).sha256 = mutation.value;
  else if (mutation.operation === 'clear-ui-pins') input.uiReview.reviewed_file_pins = [];
  else if (mutation.operation === 'duplicate-ui-pin') input.uiReview.reviewed_file_pins.push(clone(input.uiReview.reviewed_file_pins.find(pin => pin.path === mutation.path)));
  else if (mutation.operation === 'set-current-hash') input.fileHashes[mutation.path] = mutation.value;
  else throw new Error(`unknown scoped review mutation: ${mutation.operation}`);
}

function runScopeFixtures(fixture) {
  const baseline = scopeFixtureInputs();
  const evidence = validateReviewScopes(baseline);
  assert.notEqual(evidence.data_review.commit_sha, evidence.ui_review.commit_sha, 'fixture must prove independent review commits are accepted');
  assert.equal(evidence.commit_relationship.common_commit_required, false);
  assert.equal(evidence.commit_relationship.ancestry_evaluated, false);
  assert.deepEqual(evidence.data_review.required_pin_paths, REQUIRED_DATA_REVIEW_PIN_PATHS);
  assert.deepEqual(evidence.ui_review.required_pin_paths, REQUIRED_UI_REVIEW_PIN_PATHS);
  const compiled = compile({
    runtime: json(PATHS.runtime),
    facts: json(PATHS.facts),
    sourceRegistry: json(PATHS.sourceRegistry),
    candidateManifest: json(PATHS.candidateManifest),
    primarySourcePilot: json(PATHS.primarySourcePilot),
    ...baseline,
  });
  assert.equal(compiled.gateOutput.decision, 'deny', 'independent scoped review commits changed the fail-closed CT-40 result');
  assert.equal(compiled.inputArtifact.review_evidence.data_review.commit_sha, baseline.dataReview.reviewed_commit_sha);
  assert.equal(compiled.inputArtifact.review_evidence.ui_review.commit_sha, baseline.uiReview.reviewed_commit);
  assert.equal(compiled.resultArtifact.review_commits.common_commit_required, false);

  let rejected = 0;
  for (const mutation of fixture.scope_mutations) {
    const changed = clone(baseline);
    applyScopeMutation(changed, mutation);
    assert.throws(() => validateReviewScopes(changed), undefined, `${mutation.id}: invalid scoped review evidence was accepted`);
    rejected += 1;
  }
  return rejected;
}

const fixture = json(PATHS.fixture);
const scopeRejected = runScopeFixtures(fixture);
if (process.argv.includes('--scope-fixtures-only')) {
  process.stdout.write(`CT-42→CT-40 scoped review pins: PASS (independent commits accepted; ${scopeRejected} adversarial mutations rejected; ancestry not inferred)\n`);
  process.exit(0);
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
assert.equal(actual.resultArtifact.decision_scope, 'assessed_climate_release');
assert.deepEqual(actual.resultArtifact.publication_tiers.factual_display, {
  status: 'eligible', eligible: true, reason_codes: [], eligible_count: 2060, blocked_count: 0,
});
assert.deepEqual(actual.resultArtifact.publication_tiers.magnitude_comparison, {
  status: 'eligible', eligible: true, reason_codes: [], eligible_count: 2060, blocked_count: 0,
});
['commitment_display', 'derived_metrics', 'performance_assessment', 'score'].forEach(tierId => {
  assert.deepEqual(actual.resultArtifact.publication_tiers[tierId], {
    status: 'not_present', eligible: false, reason_codes: [], eligible_count: 0, blocked_count: 0,
  }, `${tierId} must remain explicitly unavailable`);
});
PROHIBITED.forEach(relative => assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `${relative} must remain absent after DENY`));

const reversed = loadInputs();
reversed.facts.facts.reverse();
const reversedOutput = compile(reversed);
assert.deepEqual(reversedOutput.gateOutput, actual.gateOutput, 'CT-40 decision changed when factual input order reversed');

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
  `  factual display / magnitude comparison eligible: ${actual.resultArtifact.counts.facts_factual_display_eligible} / ${actual.resultArtifact.counts.facts_magnitude_comparison_eligible}`,
  `  canonical deny reasons: ${actual.gateOutput.reason_codes.join(', ')}`,
  `  scoped review pin mutations: ${scopeRejected} rejected; independent commits retained`,
  `  adversarial mutations: ${rejected} rejected; ${drifted} artifact drifts detected; ${stable} deterministic reorder`,
  '  runtime manifest / release diff / CT-40 allow manifest: absent',
].join('\n') + '\n');
