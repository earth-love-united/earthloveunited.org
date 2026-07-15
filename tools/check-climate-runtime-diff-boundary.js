#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  POLICY_VERSION,
  PROHIBITED_RELEASE_PATHS,
  evaluateRuntimeDiffBoundary,
} = require('./lib/climate-runtime-diff-boundary');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = 'data/climate/fixtures/climate-runtime-diff-boundary.json';
const CANDIDATE_PATH = 'data/climate/runtime/candidate-manifest.json';
const RUNTIME_MANIFEST_PATH = 'data/climate/runtime-manifest.json';
const CANDIDATE_CHECKER = 'tools/check-climate-factual-runtime-candidate.js';
const CI_WORKFLOW_PATH = '.github/workflows/ci.yml';

function clone(value) { return structuredClone(value); }
function exists(relative) { return fs.existsSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')); }

function mutate(target, mutation) {
  const parts = mutation.path.split('.');
  let owner = target;
  for (let index = 0; index < parts.length - 1; index += 1) owner = owner[parts[index]];
  const key = parts.at(-1);
  if (mutation.operation === 'pop') owner[key].pop();
  else owner[key] = clone(mutation.value);
}

function verifyWorkflowWiring() {
  const workflow = fs.readFileSync(path.join(ROOT, CI_WORKFLOW_PATH), 'utf8');
  const boundaryCommand = 'node tools/check-climate-runtime-diff-boundary.js --base "$CLIMATE_RUNTIME_BASE_SHA" --head "$CLIMATE_RUNTIME_HEAD_SHA"';
  const candidateCommand = 'node tools/check-climate-production-readiness.js --candidate';
  const releaseCommand = 'node tools/check-climate-production-readiness.js --release';
  const strictCommand = 'node tools/climate-truth-ci.js --strict';
  assert.match(workflow, /pull_request:\s*\n\s+branches: \[main\]/, 'runtime boundary must run for main-target pull requests');
  assert.match(workflow, /fetch-depth: 0/, 'runtime boundary requires full history for a trustworthy base/head diff');
  assert.ok(workflow.includes('node tools/check-climate-runtime-diff-boundary.js --self-test'), 'runtime boundary fixture step is absent');
  assert.ok(workflow.includes(boundaryCommand), 'runtime boundary live diff step is absent');
  assert.ok(workflow.includes("hashFiles('data/climate/runtime-manifest.json') == ''"), 'denied candidate does not select candidate-readiness policy');
  assert.ok(workflow.includes(candidateCommand), 'candidate-readiness policy step is absent');
  assert.ok(workflow.includes("hashFiles('data/climate/runtime-manifest.json') != ''"), 'reviewed runtime manifest does not trigger strict policy');
  assert.ok(workflow.includes(releaseCommand), 'reviewed runtime manifest does not trigger release-readiness policy');
  assert.ok(workflow.includes(strictCommand), 'strict climate truth policy step is absent');
  assert.ok(workflow.indexOf(boundaryCommand) < workflow.indexOf(candidateCommand), 'runtime boundary must run before candidate-readiness policy');
  assert.ok(workflow.indexOf(boundaryCommand) < workflow.indexOf(releaseCommand), 'runtime boundary must run before release-readiness policy');
  assert.ok(workflow.indexOf(releaseCommand) < workflow.indexOf(strictCommand), 'release-readiness policy must run before the final strict policy step');
}

function runFixtures() {
  verifyWorkflowWiring();
  const fixture = json(FIXTURE_PATH);
  assert.equal(POLICY_VERSION, fixture._meta.fixture_version, 'fixture/policy version drift');
  let expectedPasses = 0;
  let adversarialFailures = 0;

  for (const testCase of fixture.cases) {
    const candidate = testCase.candidate === '$base_denied_candidate'
      ? clone(fixture.base_denied_candidate)
      : clone(testCase.candidate || null);
    for (const mutation of testCase.mutations || []) mutate(candidate, mutation);
    const input = {
      changed_paths: testCase.changed_paths,
      declared_runtime_paths: testCase.declared_runtime_paths,
      candidate_manifest: candidate,
      runtime_manifest: clone(testCase.runtime_manifest || null),
      artifacts_present: clone(testCase.artifacts_present || {}),
    };
    const result = evaluateRuntimeDiffBoundary(input);
    const repeat = evaluateRuntimeDiffBoundary(clone(input));
    assert.deepEqual(result, repeat, `${testCase.id}: result is not deterministic`);
    assert.equal(result.status, testCase.expected.status, `${testCase.id}: status`);
    assert.equal(result.mode, testCase.expected.mode, `${testCase.id}: mode`);
    if (Object.hasOwn(testCase.expected, 'strict_required')) {
      assert.equal(result.strict_required, testCase.expected.strict_required, `${testCase.id}: strict_required`);
    }
    assert.deepEqual(result.reasons, [...(testCase.expected.codes || [])].sort(), `${testCase.id}: reasons`);
    assert.match(result.calculation_hash, /^[a-f0-9]{64}$/, `${testCase.id}: calculation hash`);
    if (result.status === 'pass') expectedPasses += 1;
    else adversarialFailures += 1;
  }
  return { cases: fixture.cases.length, expectedPasses, adversarialFailures };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function verifyCommit(ref, label) {
  if (!ref) throw new Error(`${label} ref is required`);
  const run = childProcess.spawnSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: ROOT, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`${label} ref is not a commit available in this checkout: ${ref}`);
  return run.stdout.trim();
}

function changedPaths(base, head) {
  const run = childProcess.spawnSync('git', ['diff', '--name-only', '--diff-filter=ACDMRTUXB', `${base}...${head}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (run.status !== 0) throw new Error(`cannot calculate runtime diff: ${(run.stderr || run.stdout).trim()}`);
  return run.stdout.split('\n').filter(Boolean);
}

function liveInput(base, head) {
  const candidate = exists(CANDIDATE_PATH) ? json(CANDIDATE_PATH) : null;
  const runtimeManifest = exists(RUNTIME_MANIFEST_PATH) ? json(RUNTIME_MANIFEST_PATH) : null;
  const declared = candidate && [
    ...(candidate.runtime_files || []),
    ...(candidate.compiler_files || []),
  ];
  return {
    changed_paths: changedPaths(base, head),
    declared_runtime_paths: declared || [],
    candidate_manifest: candidate,
    runtime_manifest: runtimeManifest,
    artifacts_present: Object.fromEntries(PROHIBITED_RELEASE_PATHS.map(relative => [relative, exists(relative)])),
  };
}

function runDeniedCandidateChecker() {
  assert.equal(exists(CANDIDATE_CHECKER), true, 'denied candidate checker is missing');
  const run = childProcess.spawnSync(process.execPath, [CANDIDATE_CHECKER], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  if (run.status !== 0) {
    throw new Error(`denied candidate checker failed:\n${`${run.stdout || ''}${run.stderr || ''}`.trim()}`);
  }
  return (run.stdout || '').trim().split('\n')[0];
}

const selfTestRequested = process.argv.includes('--self-test');
const baseArgument = argument('--base');
const headArgument = argument('--head');
let fixtureSummary = null;

if (selfTestRequested || (!baseArgument && !headArgument)) fixtureSummary = runFixtures();

if (baseArgument || headArgument) {
  const base = verifyCommit(baseArgument, 'base');
  const head = verifyCommit(headArgument, 'head');
  const result = evaluateRuntimeDiffBoundary(liveInput(base, head));
  if (result.status !== 'pass') {
    process.stderr.write([
      'CT-RUNTIME-DIFF boundary: FAIL',
      `  mode: ${result.mode}`,
      `  runtime paths: ${result.runtime_affecting_paths.join(', ') || 'none'}`,
      `  reasons: ${result.reasons.join(', ') || 'none'}`,
      `  calculation hash: ${result.calculation_hash}`,
    ].join('\n') + '\n');
    process.exitCode = 1;
  } else {
    let candidateCheck = null;
    if (result.mode === 'denied-candidate') candidateCheck = runDeniedCandidateChecker();
    process.stdout.write([
      'CT-RUNTIME-DIFF boundary: PASS',
      `  mode: ${result.mode}`,
      `  runtime paths: ${result.runtime_affecting_paths.length}`,
      `  strict required: ${result.strict_required}`,
      candidateCheck ? `  denied candidate check: ${candidateCheck}` : null,
      result.strict_required ? '  reviewed runtime manifest detected; workflow must run climate-truth-ci.js --strict' : null,
      `  calculation hash: ${result.calculation_hash}`,
    ].filter(Boolean).join('\n') + '\n');
  }
}

if (fixtureSummary) {
  process.stdout.write([
    'CT-RUNTIME-DIFF fixtures: PASS',
    `  fictional cases: ${fixtureSummary.cases}`,
    `  expected pass / adversarial fail: ${fixtureSummary.expectedPasses} / ${fixtureSummary.adversarialFailures}`,
    '  no fixture creates a runtime manifest, release diff, CT-40 allow, or release authority',
  ].join('\n') + '\n');
}
