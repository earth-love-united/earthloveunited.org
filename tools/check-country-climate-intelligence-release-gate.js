#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const {
  inspectReleaseApproval,
  inspectReviewRequest,
} = require('./lib/country-climate-intelligence-release-gate');

const ROOT = path.resolve(__dirname, '..');

function runSelfTest() {
  const baseline = inspectReleaseApproval(ROOT);
  assert.equal(baseline.status, 'blocked');
  assert.equal(baseline.release_authority, false);
  assert.equal(baseline.production_runtime_release, false);
  assert(baseline.blockers.some(item => item.code === 'review_request_commit_unbound'));
  assert(baseline.blockers.some(item => item.code === 'reviewed_release_package_absent'));

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
  process.stdout.write('Country Climate Intelligence release-gate self-test: PASS (unbound, absent, hash, pin, and source-set cases fail closed)\n');
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
