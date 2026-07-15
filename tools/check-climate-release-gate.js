#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { DECISION_SCOPE, GATE_VERSION, REASON_CODES, evaluateRelease } = require('./lib/climate-release-gate');

const ROOT = path.join(__dirname, '..');
const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/fixtures/release-eligibility.json'), 'utf8'));
const enums = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/enums.json'), 'utf8'));
const resultSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/release-eligibility-result.schema.json'), 'utf8'));

function mutate(candidate, mutation) {
  const parts = mutation.path.split('.');
  let cursor = candidate;
  for (let index = 0; index < parts.length - 1; index += 1) cursor = cursor[parts[index]];
  cursor[parts[parts.length - 1]] = structuredClone(mutation.value);
}

function build(testCase) {
  const candidate = structuredClone(fixtures.base_candidate);
  testCase.mutations.forEach((mutation) => mutate(candidate, mutation));
  return candidate;
}

function canonical(output, id) {
  assert.deepStrictEqual(Object.keys(output).sort(), [...resultSchema.required].sort(), `${id}: frozen output keys`);
  for (const code of output.reason_codes) assert(REASON_CODES.includes(code), `${id}: non-canonical reason ${code}`);
  assert.deepStrictEqual(output.manifest.reason_codes, output.reason_codes, `${id}: manifest reasons differ`);
  assert.strictEqual(output.manifest.release_eligible, output.eligible, `${id}: manifest eligibility differs`);
  assert.strictEqual(output.manifest.decision, output.decision, `${id}: manifest decision differs`);
  assert.strictEqual(output.decision_scope, DECISION_SCOPE, `${id}: decision scope differs`);
  assert.strictEqual(output.manifest.decision_scope, DECISION_SCOPE, `${id}: manifest decision scope differs`);
  assert.strictEqual(output.decision, output.eligible ? 'allow' : 'deny', `${id}: decision differs`);
  assert.deepStrictEqual(Object.keys(output.publication_tiers).sort(), [
    'commitment_display', 'derived_metrics', 'factual_display', 'magnitude_comparison',
    'performance_assessment', 'score',
  ], `${id}: publication tier keys differ`);
  for (const [tierId, tier] of Object.entries(output.publication_tiers)) {
    assert(['eligible', 'blocked', 'not_present'].includes(tier.status), `${id}: invalid ${tierId} status`);
    assert.strictEqual(tier.eligible, tier.status === 'eligible', `${id}: ${tierId} eligibility differs`);
    assert.strictEqual(tier.blocked_ids.length > 0, tier.status === 'blocked', `${id}: ${tierId} blocked IDs differ`);
    assert.strictEqual(tier.eligible_ids.length + tier.blocked_ids.length === 0, tier.status === 'not_present', `${id}: ${tierId} presence differs`);
    tier.reason_codes.forEach(code => assert(REASON_CODES.includes(code), `${id}: ${tierId} reason non-canonical`));
  }
  for (const item of output.review_queue) {
    assert(item.reason_codes.length > 0, `${id}: empty review queue reasons`);
    item.reason_codes.forEach((code) => assert(REASON_CODES.includes(code), `${id}: queue reason non-canonical`));
  }
}

assert.strictEqual(GATE_VERSION, fixtures._meta.fixture_version);
assert.strictEqual(REASON_CODES.length, 55);
assert.deepStrictEqual(REASON_CODES, enums.reason_codes);

let allow = 0;
let deny = 0;
for (const testCase of fixtures.cases) {
  const candidate = build(testCase);
  const output = evaluateRelease(candidate);
  const reordered = structuredClone(candidate);
  reordered.facts.reverse();
  reordered.fact_reviews.reverse();
  reordered.sources.reverse();
  reordered.profiles.reverse();
  reordered.conflicts.reverse();
  const repeat = evaluateRelease(reordered);
  assert.deepStrictEqual(output, repeat, `${testCase.id}: input order changed output`);
  assert.strictEqual(output.decision, testCase.expected.decision, `${testCase.id}: decision`);
  if (testCase.expected.reasons) assert.deepStrictEqual(output.reason_codes, testCase.expected.reasons, `${testCase.id}: exact reasons`);
  for (const code of testCase.expected.reasons_include || []) assert(output.reason_codes.includes(code), `${testCase.id}: missing ${code}`);
  if (testCase.expected.queue !== undefined) assert.strictEqual(output.review_queue.length, testCase.expected.queue, `${testCase.id}: queue size`);
  if (testCase.expected.queue_min !== undefined) assert(output.review_queue.length >= testCase.expected.queue_min, `${testCase.id}: queue minimum`);
  if (testCase.expected.queue_field) assert(output.review_queue.some((item) => item.required_fields.includes(testCase.expected.queue_field)), `${testCase.id}: missing queue field ${testCase.expected.queue_field}`);
  if (testCase.expected.eligible_facts !== undefined) assert.strictEqual(output.manifest.eligible_fact_ids.length, testCase.expected.eligible_facts, `${testCase.id}: eligible fact count`);
  if (testCase.expected.eligible_profiles !== undefined) assert.strictEqual(output.manifest.eligible_profile_ids.length, testCase.expected.eligible_profiles, `${testCase.id}: eligible profile count`);
  assert(/^[a-f0-9]{64}$/.test(output.manifest.calculation_hash), `${testCase.id}: deterministic hash shape`);
  canonical(output, testCase.id);
  if (testCase.id === 'fully-reviewed-release') {
    assert.strictEqual(output.publication_tiers.factual_display.status, 'eligible');
    assert.strictEqual(output.publication_tiers.commitment_display.status, 'eligible');
    assert.strictEqual(output.publication_tiers.derived_metrics.status, 'eligible');
    assert.strictEqual(output.publication_tiers.performance_assessment.status, 'eligible');
    assert.strictEqual(output.publication_tiers.score.status, 'eligible');
  }
  if (testCase.id === 'scoring-permission-blocked') {
    assert.strictEqual(output.publication_tiers.factual_display.status, 'eligible');
    assert.strictEqual(output.publication_tiers.performance_assessment.status, 'blocked');
    assert.strictEqual(output.publication_tiers.score.status, 'blocked');
  }
  if (output.eligible) allow += 1; else deny += 1;
}

assert.throws(() => evaluateRelease({}), /evaluated_at/, 'implicit clock use must fail');
assert.throws(() => evaluateRelease({ evaluated_at: '2099-01-01T00:00:00Z', methodology_version: 'latest' }), /semantic version/);

const duplicateCandidate = structuredClone(fixtures.base_candidate);
const duplicateFact = structuredClone(duplicateCandidate.facts[0]);
duplicateFact.evidence_state = 'stale';
duplicateCandidate.facts.push(duplicateFact);
const duplicateForward = evaluateRelease(duplicateCandidate);
duplicateCandidate.facts.reverse();
const duplicateReverse = evaluateRelease(duplicateCandidate);
assert.deepStrictEqual(duplicateForward, duplicateReverse, 'duplicate rejection must remain deterministic');
assert.strictEqual(duplicateForward.decision, 'deny');
assert(duplicateForward.reason_codes.includes('evidence_insufficient'));

process.stdout.write([
  'CT-40 independent review and release gate: PASS',
  `  canonical reason codes: ${REASON_CODES.length}`,
  `  fictional cases: ${fixtures.cases.length}`,
  `  allowed / denied: ${allow} / ${deny}`,
  '  deterministic timestamp, ordering, hash, and review queue: verified'
].join('\n') + '\n');
