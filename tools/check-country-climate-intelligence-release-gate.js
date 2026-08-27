#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  inspectReleaseApproval,
  inspectReviewRequest,
  PATHS,
  releaseDiffSemanticFailures,
  requiredAbsentViolations,
} = require('./lib/country-climate-intelligence-release-gate');
const {
  REQUIRED_ABSENT_PATHS,
  SUBJECT_PATHS,
  artifactPinDigest,
  calculationHash,
} = require('./prepare-country-climate-intelligence-review-request');

const ROOT = path.resolve(__dirname, '..');

function runSelfTest() {
  const baseline = inspectReleaseApproval(ROOT);
  assert.equal(baseline.status, 'blocked');
  assert.equal(baseline.release_authority, false);
  assert.equal(baseline.production_runtime_release, false);
  assert(baseline.blockers.some(item => item.code === 'reviewed_release_package_absent'));

  assert.equal(
    artifactPinDigest([...baseline.request.subject.artifact_pins].reverse(), [...REQUIRED_ABSENT_PATHS].reverse()),
    baseline.request.subject.artifact_pin_digest,
    'subject digest must be canonical across input ordering'
  );

  const digestMutation = structuredClone(baseline.request);
  digestMutation.subject.artifact_pin_digest = '0'.repeat(64);
  digestMutation.calculation_hash = calculationHash(digestMutation);
  const digestResult = inspectReviewRequest(ROOT, digestMutation);
  assert.equal(digestResult.status, 'invalid');
  assert(digestResult.errors.some(item => item.code === 'review_request_subject_digest_mismatch'));

  const malformedPinMutation = structuredClone(baseline.request);
  malformedPinMutation.subject.artifact_pins[0] = null;
  malformedPinMutation.calculation_hash = calculationHash(malformedPinMutation);
  const malformedPinResult = inspectReviewRequest(ROOT, malformedPinMutation);
  assert.equal(malformedPinResult.status, 'invalid');
  assert(malformedPinResult.errors.some(item => item.code === 'review_request_subject_digest_mismatch'));

  const hashMutation = structuredClone(baseline.request);
  hashMutation.calculation_hash = '0'.repeat(64);
  assert.equal(inspectReviewRequest(ROOT, hashMutation).status, 'invalid');

  const pinMutation = structuredClone(baseline.request);
  pinMutation.subject.artifact_pins[0].sha256 = '0'.repeat(64);
  pinMutation.subject.artifact_pin_digest = artifactPinDigest(
    pinMutation.subject.artifact_pins,
    pinMutation.required_absent_paths
  );
  pinMutation.calculation_hash = calculationHash(pinMutation);
  const pinResult = inspectReviewRequest(ROOT, pinMutation);
  assert.equal(pinResult.status, 'invalid');
  assert(pinResult.errors.some(item => item.code === 'review_request_artifact_pin_mismatch'));

  const sourceMutation = structuredClone(baseline.request);
  sourceMutation.source_reviews.pop();
  sourceMutation.calculation_hash = calculationHash(sourceMutation);
  const sourceResult = inspectReviewRequest(ROOT, sourceMutation);
  assert.equal(sourceResult.status, 'invalid');
  assert(sourceResult.errors.some(item => item.code === 'review_request_source_set_mismatch'));

  const absenceMutation = structuredClone(baseline.request);
  absenceMutation.required_absent_paths.pop();
  absenceMutation.subject.artifact_pin_digest = artifactPinDigest(
    absenceMutation.subject.artifact_pins,
    absenceMutation.required_absent_paths
  );
  absenceMutation.calculation_hash = calculationHash(absenceMutation);
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

  const squashRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cci-squash-checkout-'));
  try {
    [...new Set([...SUBJECT_PATHS, PATHS.request])].forEach(relative => {
      const source = path.join(ROOT, relative);
      const target = path.join(squashRoot, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    });
    assert.equal(fs.existsSync(path.join(squashRoot, '.git')), false,
      'squash fixture must not inherit Git history');
    const squashResult = inspectReviewRequest(squashRoot);
    assert.equal(squashResult.status, 'ready_for_external_review',
      JSON.stringify([...squashResult.errors, ...squashResult.blockers]));
    const squashApprovalResult = inspectReleaseApproval(squashRoot);
    assert.equal(squashApprovalResult.status, 'blocked');
    assert.deepEqual(squashApprovalResult.blockers.map(item => item.code), ['reviewed_release_package_absent'],
      'a squash checkout must retain only the genuine absent-package blocker');

    const forbiddenPath = path.join(squashRoot, REQUIRED_ABSENT_PATHS[0]);
    fs.mkdirSync(path.dirname(forbiddenPath), { recursive: true });
    fs.writeFileSync(forbiddenPath, '{}\n');
    const forbiddenResult = inspectReviewRequest(squashRoot);
    assert.equal(forbiddenResult.status, 'invalid');
    assert(forbiddenResult.errors.some(item => item.code === 'review_request_forbidden_path_boundary_invalid'));
    fs.unlinkSync(forbiddenPath);

    const driftPath = baseline.request.subject.artifact_pins[0].path;
    fs.appendFileSync(path.join(squashRoot, driftPath), '\npost-review drift\n');
    const driftResult = inspectReviewRequest(squashRoot);
    assert.equal(driftResult.status, 'invalid');
    assert(driftResult.errors.some(item => item.code === 'review_request_artifact_pin_mismatch'));
  } finally {
    fs.rmSync(squashRoot, { recursive: true, force: true });
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
  process.stdout.write('Country Climate Intelligence release-gate self-test: PASS (squash-safe subject digest; absent package, forbidden-path, hash, pin, and source-set cases fail closed)\n');
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
