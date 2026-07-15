#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { evaluateReadiness } = require('./lib/climate-production-readiness');

const candidate = {
  mode: 'candidate',
  data_review: { decision: 'pass', independent: true },
  ui_review: { decision: 'pass', independent: true },
  canonical_source_links_passed: true,
  public_copy_passed: true,
  load_order_passed: true,
  javascript_syntax_passed: true,
  ct40: { decision: 'deny', eligible: false, release_authority: false, reason_codes: ['evidence_insufficient'] },
  top20_queue: { coverage: { ranked_entities: 20, release_eligible_entities: 0 } },
  evidence_readiness: { status: 'blocked', release_authority: false, required_next_compiler: { status: 'not_implemented' } },
  artifacts: { runtime_manifest: false, release_diff: false, allow_manifest: false, rollback_proof: false },
  truth_ci: { status: 'incomplete', missing_required_components: ['reviewed-release-diff', 'reviewed-runtime-manifest'] },
};
const release = {
  mode: 'release',
  data_review: { decision: 'pass', independent: true },
  ui_review: { decision: 'pass', independent: true },
  canonical_source_links_passed: true,
  public_copy_passed: true,
  load_order_passed: true,
  javascript_syntax_passed: true,
  ct40: { decision: 'allow', eligible: true, release_authority: true, reason_codes: [] },
  top20_primary_source_review_complete: true,
  licence_decisions_complete: true,
  field_level_fact_reviews_complete: true,
  independent_release_review_passed: true,
  artifacts: { runtime_manifest: true, release_diff: true, allow_manifest: true, rollback_proof: true },
  truth_ci: { status: 'pass', missing_required_components: [] },
};

assert.equal(evaluateReadiness(candidate).status, 'candidate_integrity_ready_release_blocked');
assert.equal(evaluateReadiness(release).status, 'release_ready');

const candidateMutations = [
  input => { input.data_review.independent = false; },
  input => { input.ui_review.decision = 'deny'; },
  input => { input.canonical_source_links_passed = false; },
  input => { input.public_copy_passed = false; },
  input => { input.load_order_passed = false; },
  input => { input.javascript_syntax_passed = false; },
  input => { input.ct40.decision = 'allow'; },
  input => { input.ct40.reason_codes = []; },
  input => { input.top20_queue.coverage.ranked_entities = 19; },
  input => { input.top20_queue.coverage.release_eligible_entities = 1; },
  input => { input.evidence_readiness.release_authority = true; },
  input => { input.artifacts.runtime_manifest = true; },
  input => { input.artifacts.release_diff = true; },
  input => { input.artifacts.allow_manifest = true; },
  input => { input.truth_ci.status = 'pass'; },
  input => { input.truth_ci.missing_required_components.push('unexpected'); },
];
for (const mutate of candidateMutations) {
  const changed = structuredClone(candidate);
  mutate(changed);
  assert.equal(evaluateReadiness(changed).ready, false, 'candidate mutation bypassed readiness policy');
}

const releaseMutations = [
  input => { input.ct40.release_authority = false; },
  input => { input.top20_primary_source_review_complete = false; },
  input => { input.licence_decisions_complete = false; },
  input => { input.field_level_fact_reviews_complete = false; },
  input => { input.independent_release_review_passed = false; },
  input => { input.artifacts.runtime_manifest = false; },
  input => { input.artifacts.release_diff = false; },
  input => { input.artifacts.allow_manifest = false; },
  input => { input.artifacts.rollback_proof = false; },
  input => { input.truth_ci.status = 'incomplete'; },
  input => { input.truth_ci.missing_required_components = ['reviewed-release-diff']; },
];
for (const mutate of releaseMutations) {
  const changed = structuredClone(release);
  mutate(changed);
  assert.equal(evaluateReadiness(changed).ready, false, 'release mutation bypassed readiness policy');
}

assert.throws(() => evaluateReadiness({ mode: 'preview' }), /mode must be candidate or release/);
process.stdout.write(`Climate production readiness policy: PASS (${candidateMutations.length + releaseMutations.length + 1} fail-closed cases)\n`);
