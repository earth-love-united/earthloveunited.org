#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  inspectReleaseApproval,
  inspectReviewRequest,
  releaseDiffSemanticFailures,
  requiredAbsentViolations,
} = require('./lib/country-climate-intelligence-release-gate');
const { REQUIRED_ABSENT_PATHS } = require('./prepare-country-climate-intelligence-review-request');

const ROOT = path.resolve(__dirname, '..');

function runSelfTest() {
  const baseline = inspectReleaseApproval(ROOT);
  assert.equal(baseline.status, 'blocked');
  assert.equal(baseline.release_authority, false);
  assert.equal(baseline.production_runtime_release, false);
  assert(baseline.blockers.some(item => item.code === 'reviewed_release_package_absent'));

  const unboundMutation = structuredClone(baseline.request);
  unboundMutation.subject.commit_binding_state = 'unbound_worktree_candidate';
  unboundMutation.subject.subject_commit_sha = null;
  unboundMutation.calculation_hash = require('./prepare-country-climate-intelligence-review-request').calculationHash(unboundMutation);
  const unboundResult = inspectReviewRequest(ROOT, unboundMutation);
  assert.equal(unboundResult.status, 'blocked');
  assert(unboundResult.blockers.some(item => item.code === 'review_request_commit_unbound'));

  const hashMutation = structuredClone(baseline.request);
  hashMutation.calculation_hash = '0'.repeat(64);
  assert.equal(inspectReviewRequest(ROOT, hashMutation).status, 'invalid');

  const pinMutation = structuredClone(baseline.request);
  pinMutation.subject.artifact_pins[0].sha256 = '0'.repeat(64);
  pinMutation.calculation_hash = require('./prepare-country-climate-intelligence-review-request').calculationHash(pinMutation);
  const pinResult = inspectReviewRequest(ROOT, pinMutation);
  assert.equal(pinResult.status, 'invalid');
  assert(pinResult.errors.some(item => item.code === 'review_request_artifact_pin_mismatch'));

  const sourceMutation = structuredClone(baseline.request);
  sourceMutation.source_reviews.pop();
  sourceMutation.calculation_hash = require('./prepare-country-climate-intelligence-review-request').calculationHash(sourceMutation);
  const sourceResult = inspectReviewRequest(ROOT, sourceMutation);
  assert.equal(sourceResult.status, 'invalid');
  assert(sourceResult.errors.some(item => item.code === 'review_request_source_set_mismatch'));

  const absenceMutation = structuredClone(baseline.request);
  absenceMutation.required_absent_paths.pop();
  absenceMutation.calculation_hash = require('./prepare-country-climate-intelligence-review-request').calculationHash(absenceMutation);
  const absenceResult = inspectReviewRequest(ROOT, absenceMutation);
  assert.equal(absenceResult.status, 'invalid');
  assert(absenceResult.errors.some(item => item.code === 'review_request_forbidden_path_boundary_invalid'));

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cci-required-absence-'));
  try {
    const forbidden = path.join(fixtureRoot, REQUIRED_ABSENT_PATHS[0]);
    fs.mkdirSync(path.dirname(forbidden), { recursive: true });
    fs.writeFileSync(forbidden, '{}\n');
    const violations = requiredAbsentViolations(fixtureRoot, { required_absent_paths: REQUIRED_ABSENT_PATHS });
    assert(violations.some(detail => detail.includes(REQUIRED_ABSENT_PATHS[0])));
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }

  const runtimeFixture = { countries: [{ country_id: 'iso3166-1:AAA' }, { country_id: 'iso3166-1:BBB' }] };
  const validDiffFixture = {
    initial_release: true,
    previous_release_id: null,
    changed_entity_ids: ['iso3166-1:AAA', 'iso3166-1:BBB'],
    source_revision_ids: [
      'ember-yearly-electricity-data-2026-08-25',
      'gcp-gcb-2025-v1.0',
      'un-wpp-2024',
      'world-bank-cckp-cmip6-2026-08-24',
      'world-bank-cckp-era5-2026-08-25',
    ],
  };
  assert.deepEqual(releaseDiffSemanticFailures(validDiffFixture, runtimeFixture), []);
  const wrongLineage = structuredClone(validDiffFixture);
  wrongLineage.previous_release_id = 'not-null-for-v1';
  assert(releaseDiffSemanticFailures(wrongLineage, runtimeFixture).includes('release_diff_lineage_invalid'));
  const omittedEntity = structuredClone(validDiffFixture);
  omittedEntity.changed_entity_ids.pop();
  assert(releaseDiffSemanticFailures(omittedEntity, runtimeFixture).includes('release_diff_entity_set_mismatch'));
  const extraSource = structuredClone(validDiffFixture);
  extraSource.source_revision_ids.push('unreviewed-source');
  assert(releaseDiffSemanticFailures(extraSource, runtimeFixture).includes('release_diff_source_set_mismatch'));
  const missingSource = structuredClone(validDiffFixture);
  missingSource.source_revision_ids.pop();
  assert(releaseDiffSemanticFailures(missingSource, runtimeFixture).includes('release_diff_source_set_mismatch'));
  process.stdout.write('Country Climate Intelligence release-gate self-test: PASS (current baseline; unbound, absent package, forbidden-path, hash, pin, and source-set cases fail closed)\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return runSelfTest();
  const result = inspectReleaseApproval(ROOT);
  if (args.includes('--require-release')) {
    if (!result.pass) {
      const details = [...result.errors, ...result.blockers].map(item => `${item.code}: ${item.detail}`).join(' | ');
      throw new Error(details || 'CCI release approval did not pass');
    }
    process.stdout.write('Country Climate Intelligence production release gate: PASS\n');
    return;
  }
  if (result.status === 'invalid') {
    throw new Error(result.errors.map(item => `${item.code}: ${item.detail}`).join(' | '));
  }
  if (result.status === 'approved') {
    process.stdout.write('Country Climate Intelligence release gate: APPROVED (exact reviewed production package)\n');
    return;
  }
  process.stdout.write(`Country Climate Intelligence release gate: PASS (fail-closed candidate; ${result.blockers.map(item => item.code).join(', ')})\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Country Climate Intelligence release gate: BLOCKED — ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { runSelfTest };
