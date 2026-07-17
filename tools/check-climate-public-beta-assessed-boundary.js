#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { parseJsonNoDuplicateKeys } = require('./lib/json-schema-lite');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = 'data/climate/fixtures/public-beta-assessed-boundary.json';
const RUNTIME_MANIFEST = 'data/climate/runtime-manifest.json';
const CANDIDATE_MANIFEST = 'data/climate/runtime/candidate-manifest.json';
const ASSESSED_SURFACE_FILES = Object.freeze([
  'tools/build-deploy.sh',
  'tools/stage-public-deploy.js',
  'tools/lib/public-deploy-surface.js',
]);
const BETA_MARKERS = Object.freeze([
  'climate-public-beta/',
  'data/climate/public-beta/',
  '_deploy_beta',
]);

function readJson(relative) {
  return parseJsonNoDuplicateKeys(
    fs.readFileSync(path.join(ROOT, relative), 'utf8'), relative);
}

function runNode(args) {
  const result = childProcess.spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return { exit_code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function runPolicyFixtures() {
  const checks = [
    ['tools/check-climate-production-readiness-policy.js'],
    ['tools/check-climate-truth-ci.js'],
  ];
  for (const args of checks) {
    const result = runNode(args);
    if (result.exit_code !== 0) {
      throw new Error(args[0] + ' failed:\n' + `${result.stdout}${result.stderr}`.trim());
    }
  }
}

function readinessProbe(mode) {
  const result = runNode(['tools/check-climate-production-readiness.js', '--' + mode, '--json']);
  let report;
  try { report = parseJsonNoDuplicateKeys(result.stdout, mode + ' readiness report'); }
  catch (_) { throw new Error(mode + ' readiness did not emit valid JSON'); }
  return {
    exit_code: result.exit_code,
    status: report.status,
    ready: report.ready,
    failure_ids: report.checks.filter(item => !item.pass).map(item => item.id).sort(),
  };
}

function truthProbe(mode) {
  const script = [
    `process.argv.push(${JSON.stringify(mode)});`,
    'const report=require("./tools/climate-truth-ci.js").report;',
    'process.stdout.write("\\n__ELU_BOUNDARY_REPORT__"+JSON.stringify(report)+"\\n");',
  ].join('');
  const result = runNode(['-e', script]);
  const marker = '__ELU_BOUNDARY_REPORT__';
  const index = result.stdout.lastIndexOf(marker);
  if (index < 0) throw new Error(mode + ' truth CI did not expose a structured report');
  let report;
  try {
    report = parseJsonNoDuplicateKeys(
      result.stdout.slice(index + marker.length).trim(), mode + ' truth CI report');
  }
  catch (_) { throw new Error(mode + ' truth CI report was not valid JSON'); }
  return {
    exit_code: result.exit_code,
    status: report.status,
    failed_components: report.components.filter(item => item.status === 'failed').map(item => item.id).sort(),
    missing_required_components: [...report.missing_required_components].sort(),
    generated_drift: report.generated_drift,
    policy_status: report.policy ? report.policy.status : null,
  };
}

function currentState() {
  return fs.existsSync(path.join(ROOT, RUNTIME_MANIFEST)) ? 'reviewed_release' : 'candidate';
}

function ensureBetaIsolation() {
  const candidate = readJson(CANDIDATE_MANIFEST);
  const declared = [
    ...(candidate.runtime_files || []),
    ...(candidate.compiler_files || []),
    ...(candidate.prohibited_release_files || []),
  ];
  for (const value of declared) {
    if (String(value).startsWith('data/climate/public-beta/') || String(value).startsWith('climate-public-beta/')) {
      throw new Error('beta path is declared by the assessed candidate manifest: ' + value);
    }
  }
  if (fs.existsSync(path.join(ROOT, RUNTIME_MANIFEST))) {
    const manifestText = fs.readFileSync(path.join(ROOT, RUNTIME_MANIFEST), 'utf8');
    for (const marker of BETA_MARKERS) {
      if (manifestText.includes(marker)) throw new Error('beta marker appears in assessed runtime manifest: ' + marker);
    }
  }
  for (const relative of ASSESSED_SURFACE_FILES) {
    const text = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    for (const marker of BETA_MARKERS) {
      if (text.includes(marker)) throw new Error('beta marker appears in assessed build surface: ' + relative + ': ' + marker);
    }
  }
}

function compareReadiness(actual, expected, label) {
  assert.equal(actual.exit_code, expected.exit_code, label + ': exit_code drift');
  assert.equal(actual.status, expected.status, label + ': status drift');
  assert.equal(actual.ready, expected.ready, label + ': ready drift');
  if (Array.isArray(expected.failure_ids)) {
    assert.deepEqual(actual.failure_ids, [...expected.failure_ids].sort(), label + ': failure IDs drift');
  }
  if (Array.isArray(expected.required_failure_ids)) {
    for (const id of expected.required_failure_ids) {
      assert.ok(actual.failure_ids.includes(id), label + ': required safety failure disappeared: ' + id);
    }
  }
}

function compareTruth(actual, expected, label) {
  assert.deepEqual(actual, {
    exit_code: expected.exit_code,
    status: expected.status,
    failed_components: [...expected.failed_components].sort(),
    missing_required_components: [...expected.missing_required_components].sort(),
    generated_drift: expected.generated_drift,
    policy_status: expected.policy_status,
  }, label + ': structured result drift');
}

function evaluateExpectedState(actual, expected, state) {
  compareReadiness(actual.candidate_readiness, expected.candidate_readiness, state + ' candidate readiness');
  compareReadiness(actual.release_readiness, expected.release_readiness, state + ' release readiness');
  compareTruth(actual.allow_incomplete_truth, expected.allow_incomplete_truth, state + ' allow-incomplete truth');
  compareTruth(actual.strict_truth, expected.strict_truth, state + ' strict truth');
  return { status: 'pass', assessed_state: state };
}

function runSelfTest() {
  const candidateExpected = {
    candidate_readiness: { exit_code: 1, status: 'blocked', ready: false, failure_ids: ['truth-ci-incomplete-only'] },
    release_readiness: { exit_code: 1, status: 'blocked', ready: false, failure_ids: ['missing'] },
    allow_incomplete_truth: {
      exit_code: 1, status: 'fail', failed_components: ['CT-X'], missing_required_components: ['manifest'],
      generated_drift: false, policy_status: null,
    },
    strict_truth: {
      exit_code: 1, status: 'fail', failed_components: ['CT-X'], missing_required_components: ['manifest'],
      generated_drift: false, policy_status: null,
    },
  };
  const actual = structuredClone(candidateExpected);
  assert.equal(evaluateExpectedState(actual, candidateExpected, 'candidate').status, 'pass');
  const mutations = [
    report => { report.candidate_readiness.exit_code = 0; },
    report => { report.release_readiness.failure_ids = []; },
    report => { report.allow_incomplete_truth.failed_components = []; },
    report => { report.strict_truth.missing_required_components = []; },
    report => { report.strict_truth.generated_drift = true; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(actual);
    mutate(changed);
    assert.throws(() => evaluateExpectedState(changed, candidateExpected, 'candidate'), /drift|disappeared/);
  }
  const reviewedExpected = structuredClone(candidateExpected);
  reviewedExpected.candidate_readiness = {
    exit_code: 1, status: 'blocked', ready: false, required_failure_ids: ['release-artifacts-absent'],
  };
  const reviewedActual = structuredClone(candidateExpected);
  reviewedActual.candidate_readiness.failure_ids = ['release-artifacts-absent', 'another-safe-failure'];
  compareReadiness(reviewedActual.candidate_readiness, reviewedExpected.candidate_readiness, 'reviewed candidate');
  reviewedActual.candidate_readiness.failure_ids = ['another-safe-failure'];
  assert.throws(
    () => compareReadiness(reviewedActual.candidate_readiness, reviewedExpected.candidate_readiness, 'reviewed candidate'),
    /required safety failure disappeared/,
  );
  process.stdout.write('Climate public-beta assessed-boundary policy: PASS (7 fail-closed cases)\n');
}

function main() {
  if (process.argv.length !== 2 && !(process.argv.length === 3 && process.argv[2] === '--self-test')) {
    throw new Error('usage: check-climate-public-beta-assessed-boundary.js [--self-test]');
  }
  if (process.argv.includes('--self-test')) return runSelfTest();
  const fixture = readJson(FIXTURE_PATH);
  assert.equal(fixture.fixture_version, 'public-beta-assessed-boundary-v1', 'assessed boundary fixture version drift');
  assert.equal(fixture.fixture_only, true, 'assessed boundary fixture must remain fixture-only');
  assert.equal(fixture.publication_authority, false,
    'assessed boundary fixture must not grant publication authority');
  ensureBetaIsolation();
  runPolicyFixtures();
  const state = currentState();
  const actual = {
    candidate_readiness: readinessProbe('candidate'),
    release_readiness: readinessProbe('release'),
    allow_incomplete_truth: truthProbe('--allow-incomplete'),
    strict_truth: truthProbe('--strict'),
  };
  const result = evaluateExpectedState(actual, fixture[state], state);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (require.main === module) main();

module.exports = {
  compareReadiness,
  compareTruth,
  currentState,
  ensureBetaIsolation,
  evaluateExpectedState,
  readinessProbe,
  runSelfTest,
  truthProbe,
};
