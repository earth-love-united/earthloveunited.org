#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { parseJsonNoDuplicateKeys } = require('./lib/ct42-runtime-rollback-review');

const ROOT = path.resolve(__dirname, '..');
const CT40_PATH = 'data/climate/reviews/ct42-ct40-release-review-result.json';
const EXPECTED_CHECK_IDS = Object.freeze([
  'approval-trust-registry-integrity',
  'canonical-source-links',
  'ct45-notice-integrity',
  'ct45-runtime-asset-integrity',
  'deny-reasons-present',
  'evidence-plan-fail-closed',
  'independent-data-review',
  'independent-ui-review',
  'javascript-syntax',
  'load-order',
  'public-copy',
  'release-artifacts-absent',
  'runtime-assets-candidate-release-blocked',
  'tiered-ct40-publication-boundary',
  'top20-queue-fail-closed',
  'truth-ci-incomplete-only',
].sort());
const PROHIBITED_TIERS = Object.freeze([
  'commitment_display',
  'derived_metrics',
  'performance_assessment',
  'score',
]);

function runNode(args) {
  const result = childProcess.spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return {
    exit_code: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function parseReport(text, label) {
  return parseJsonNoDuplicateKeys(text, label);
}

function evaluateCandidateReadiness(report) {
  assert.equal(report?.schema_version, '1.0.0', 'candidate readiness schema drift');
  assert.equal(report?.mode, 'candidate', 'factual publication must derive from candidate mode');
  assert.equal(report?.status, 'candidate_integrity_ready_release_blocked',
    'candidate integrity is not ready');
  assert.equal(report?.ready, true, 'candidate readiness must pass');
  assert.deepEqual(report?.blockers, [], 'candidate readiness contains blockers');
  assert.ok(Array.isArray(report?.checks), 'candidate readiness checks are absent');
  assert.deepEqual(report.checks.map(item => item.id).sort(), EXPECTED_CHECK_IDS,
    'candidate readiness check inventory drift');
  assert.ok(report.checks.every(item => item.pass === true), 'candidate readiness contains a failed check');
  return true;
}

function evaluateCt40Boundary(ct40) {
  assert.equal(ct40?.decision_scope, 'assessed_climate_release', 'CT-40 scope drift');
  assert.equal(ct40?.decision, 'deny', 'assessed release must remain denied');
  assert.equal(ct40?.eligible, false, 'assessed release must remain ineligible');
  assert.equal(ct40?.release_authority, false, 'assessed release authority must remain false');

  for (const tierName of ['factual_display', 'magnitude_comparison']) {
    const tier = ct40?.publication_tiers?.[tierName];
    assert.equal(tier?.status, 'eligible', `${tierName} must remain eligible`);
    assert.equal(tier?.eligible, true, `${tierName} eligibility drift`);
    assert.equal(tier?.eligible_count, 2060, `${tierName} count drift`);
    assert.equal(tier?.blocked_count, 0, `${tierName} unexpectedly blocked facts`);
  }
  for (const tierName of PROHIBITED_TIERS) {
    const tier = ct40?.publication_tiers?.[tierName];
    assert.equal(tier?.status, 'not_present', `${tierName} must remain absent`);
    assert.equal(tier?.eligible, false, `${tierName} must remain ineligible`);
    assert.equal(tier?.eligible_count, 0, `${tierName} must contain no eligible facts`);
  }
  return true;
}

function requirePass(args, label) {
  const result = runNode(args);
  if (result.exit_code !== 0) {
    throw new Error(`${label} failed:\n${result.stdout}${result.stderr}`.trim());
  }
}

function runSelfTest() {
  const report = {
    schema_version: '1.0.0',
    mode: 'candidate',
    status: 'candidate_integrity_ready_release_blocked',
    ready: true,
    blockers: [],
    checks: EXPECTED_CHECK_IDS.map(id => ({ id, pass: true, detail: 'fixture' })),
  };
  assert.equal(evaluateCandidateReadiness(report), true);
  const blocked = structuredClone(report);
  blocked.checks[0].pass = false;
  assert.throws(() => evaluateCandidateReadiness(blocked), /failed check/);
  const widened = structuredClone(report);
  widened.checks.push({ id: 'assessed-score-release', pass: true, detail: 'fixture' });
  assert.throws(() => evaluateCandidateReadiness(widened), /inventory drift/);

  const ct40 = {
    decision_scope: 'assessed_climate_release',
    decision: 'deny',
    eligible: false,
    release_authority: false,
    publication_tiers: {
      factual_display: { status: 'eligible', eligible: true, eligible_count: 2060, blocked_count: 0 },
      magnitude_comparison: { status: 'eligible', eligible: true, eligible_count: 2060, blocked_count: 0 },
      commitment_display: { status: 'not_present', eligible: false, eligible_count: 0 },
      derived_metrics: { status: 'not_present', eligible: false, eligible_count: 0 },
      performance_assessment: { status: 'not_present', eligible: false, eligible_count: 0 },
      score: { status: 'not_present', eligible: false, eligible_count: 0 },
    },
  };
  assert.equal(evaluateCt40Boundary(ct40), true);
  const scored = structuredClone(ct40);
  scored.publication_tiers.score = { status: 'eligible', eligible: true, eligible_count: 1 };
  assert.throws(() => evaluateCt40Boundary(scored), /score must remain absent/);
  const assessed = structuredClone(ct40);
  assessed.decision = 'allow';
  assert.throws(() => evaluateCt40Boundary(assessed), /must remain denied/);
  process.stdout.write('Climate factual-public readiness policy: PASS (5 fail-closed boundary cases)\n');
}

function main() {
  if (process.argv.length === 3 && process.argv[2] === '--self-test') return runSelfTest();
  if (process.argv.length !== 2) {
    throw new Error('usage: check-climate-factual-public-readiness.js [--self-test]');
  }

  const readiness = runNode(['tools/check-climate-production-readiness.js', '--candidate', '--json']);
  if (readiness.exit_code !== 0) {
    throw new Error(`candidate readiness failed:\n${readiness.stdout}${readiness.stderr}`.trim());
  }
  evaluateCandidateReadiness(parseReport(readiness.stdout, 'candidate readiness report'));
  evaluateCt40Boundary(parseReport(fs.readFileSync(path.join(ROOT, CT40_PATH), 'utf8'), CT40_PATH));

  requirePass(['tools/check-climate-factual-runtime-candidate.js'], 'CT-42 factual runtime');
  requirePass(['tools/check-ct42-runtime-rollback-proof.js'], 'CT-42 rollback proof');

  process.stdout.write([
    'Climate factual-public readiness: PASS',
    '  2,060 reviewed facts are eligible for factual display and magnitude comparison.',
    '  Commitments, derived metrics, performance assessment, scores, and assessed release remain absent or denied.',
    '  Visual-asset provenance and notices are pinned; protected maintainer merge is still required and the broader signed assessed-release gate remains unchanged.',
    '  Open concern: independent rollback-browser review remains untested for this narrow launch; the deterministic rollback proof itself passes.',
  ].join('\n') + '\n');
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Climate factual-public readiness: BLOCKED — ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  EXPECTED_CHECK_IDS,
  PROHIBITED_TIERS,
  evaluateCandidateReadiness,
  evaluateCt40Boundary,
  runSelfTest,
};
