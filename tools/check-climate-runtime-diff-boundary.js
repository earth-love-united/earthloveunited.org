#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  POLICY_VERSION,
  PROFILE_CCI,
  PROFILE_LEGACY_CT40,
  PROHIBITED_RELEASE_PATHS,
  evaluateRuntimeDiffBoundary,
} = require('./lib/climate-runtime-diff-boundary');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = 'data/climate/fixtures/climate-runtime-diff-boundary.json';
const CANDIDATE_PATH = 'data/climate/runtime/candidate-manifest.json';
const RUNTIME_MANIFEST_PATH = 'data/climate/runtime-manifest.json';
const CCI_RUNTIME_PATH = 'data/climate/runtime/country-climate-intelligence.json';
const CCI_RELEASE_MANIFEST_PATH = 'data/climate/releases/country-climate-intelligence-v1/release-manifest.json';
const ACTIVE_PROFILE_CHECKER = 'tools/check-public-climate-release-profile.js';
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
  const stateCommand = 'node tools/check-public-climate-release-profile.js --state';
  const activeCommand = 'node tools/check-public-climate-release-profile.js --verify-active';
  const strictCommand = 'node tools/climate-truth-ci.js --strict';
  assert.match(workflow, /pull_request:\s*\n\s+branches: \[main\]/, 'runtime boundary must run for main-target pull requests');
  assert.match(workflow, /fetch-depth: 0/, 'runtime boundary requires full history for a trustworthy base/head diff');
  assert.ok(workflow.includes('node tools/check-climate-runtime-diff-boundary.js --self-test'), 'runtime boundary fixture step is absent');
  assert.ok(workflow.includes(boundaryCommand), 'runtime boundary live diff step is absent');
  assert.ok(workflow.includes(stateCommand), 'exact public climate profile/phase detection is absent');
  assert.ok(workflow.includes(activeCommand), 'active-profile readiness policy step is absent');
  ['cci:candidate', 'cci:release', 'legacy_ct40:candidate', 'legacy_ct40:release'].forEach(state => {
    assert.ok(workflow.includes(state), 'workflow does not recognize exact state: ' + state);
  });
  assert.match(workflow,
    /- name: Climate truth CI reviewed-release gate\s*\n\s+if: \$\{\{ steps\.climate_profile\.outputs\.phase == 'release' \}\}\s*\n\s+run: node tools\/climate-truth-ci\.js --strict/,
    'strict climate truth policy is not bound to the exact reviewed-release phase');
  assert.ok(workflow.includes('node tools/check-climate-truth-ci.js'),
    'phase-aware climate truth component-plan self-test is absent');
  assert.ok(workflow.includes("steps.factual_profile.outputs.profile == 'cci' && steps.factual_profile.outputs.phase == 'candidate'"),
    'CCI factual-public refusal branch is absent');
  assert.ok(workflow.includes("steps.factual_profile.outputs.profile == 'cci' && steps.factual_profile.outputs.phase == 'release'"),
    'CCI reviewed-release staging branch is absent');
  assert.ok(workflow.includes("steps.factual_profile.outputs.profile == 'legacy_ct40' && steps.factual_profile.outputs.phase == 'candidate'"),
    'limited legacy factual-display branch is not isolated from full release');
  assert.ok(workflow.includes("steps.factual_profile.outputs.profile == 'legacy_ct40' && steps.factual_profile.outputs.phase == 'release'"),
    'reviewed legacy release staging branch is absent');
  assert.ok(workflow.includes('Build limited legacy factual-display deploy directory') &&
    workflow.includes('Verify final limited legacy factual-display integrity independently'),
    'limited legacy factual-display builder and final verifier are absent');
  assert.ok(workflow.includes('Build reviewed legacy release deploy directory') &&
    workflow.includes('Verify final legacy release integrity independently'),
    'reviewed legacy release must use the standard release builder and final verifier');
  assert.ok(workflow.includes('needs: [static, factual_public]'),
    'browser smoke must remain downstream of both static and factual-public policy jobs');
  assert.ok(workflow.includes("steps.smoke_profile.outputs.phase == 'candidate'"),
    'browser smoke candidate build is not bound to the detected package phase');
  assert.ok(workflow.includes("steps.smoke_profile.outputs.phase == 'release'"),
    'browser smoke release build is not bound to the detected package phase');
  assert.ok(workflow.includes(strictCommand), 'strict climate truth policy step is absent');
  assert.equal(workflow.includes('node tools/check-climate-production-readiness.js --candidate'), false,
    'workflow must not bypass active-profile routing with a direct legacy candidate gate');
  assert.equal(workflow.includes('node tools/check-climate-production-readiness.js --release'), false,
    'workflow must not bypass active-profile routing with a direct legacy release gate');
  assert.ok(workflow.indexOf(boundaryCommand) < workflow.indexOf(activeCommand), 'runtime boundary must run before active-profile readiness policy');
  assert.ok(workflow.indexOf(activeCommand) < workflow.indexOf(strictCommand), 'active-profile readiness policy must run before the final strict policy step');
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
    const cciRuntime = testCase.cci_runtime === '$base_cci_runtime'
      ? clone(fixture.base_cci_runtime)
      : clone(testCase.cci_runtime || null);
    const cciReleaseManifest = testCase.cci_release_manifest === '$base_cci_release_manifest'
      ? clone(fixture.base_cci_release_manifest)
      : clone(testCase.cci_release_manifest || null);
    for (const mutation of testCase.cci_runtime_mutations || []) mutate(cciRuntime, mutation);
    for (const mutation of testCase.cci_release_manifest_mutations || []) mutate(cciReleaseManifest, mutation);
    const artifactsPresent = clone(testCase.artifacts_present || {});
    const input = {
      active_profile: testCase.active_profile || PROFILE_LEGACY_CT40,
      active_phase: testCase.active_phase ||
        (artifactsPresent['data/climate/runtime-manifest.json'] === true ? 'release' : 'candidate'),
      changed_paths: testCase.changed_paths,
      declared_runtime_paths: testCase.declared_runtime_paths,
      candidate_manifest: candidate,
      runtime_manifest: clone(testCase.runtime_manifest || null),
      cci_runtime: cciRuntime,
      cci_release_manifest: cciReleaseManifest,
      artifacts_present: artifactsPresent,
    };
    const result = evaluateRuntimeDiffBoundary(input);
    const repeat = evaluateRuntimeDiffBoundary(clone(input));
    assert.deepEqual(result, repeat, `${testCase.id}: result is not deterministic`);
    assert.equal(result.status, testCase.expected.status, `${testCase.id}: status`);
    assert.equal(result.mode, testCase.expected.mode, `${testCase.id}: mode`);
    if (Object.hasOwn(testCase.expected, 'strict_required')) {
      assert.equal(result.strict_required, testCase.expected.strict_required, `${testCase.id}: strict_required`);
    }
    if (Object.hasOwn(testCase.expected, 'release_required')) {
      assert.equal(result.release_required, testCase.expected.release_required, `${testCase.id}: release_required`);
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

function activeProfileState() {
  const run = childProcess.spawnSync(process.execPath, [ACTIVE_PROFILE_CHECKER, '--state'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  if (run.status !== 0) {
    throw new Error(`cannot derive active climate profile state:\n${`${run.stdout || ''}${run.stderr || ''}`.trim()}`);
  }
  const match = /^(cci|legacy_ct40):(candidate|release)$/.exec((run.stdout || '').trim());
  if (!match) throw new Error('active climate profile state is malformed');
  return { profile: match[1], phase: match[2] };
}

function liveInput(base, head) {
  const state = activeProfileState();
  const candidate = exists(CANDIDATE_PATH) ? json(CANDIDATE_PATH) : null;
  const runtimeManifest = exists(RUNTIME_MANIFEST_PATH) ? json(RUNTIME_MANIFEST_PATH) : null;
  const declared = candidate && [
    ...(candidate.runtime_files || []),
    ...(candidate.compiler_files || []),
  ];
  return {
    active_profile: state.profile,
    active_phase: state.phase,
    changed_paths: changedPaths(base, head),
    declared_runtime_paths: declared || [],
    candidate_manifest: candidate,
    runtime_manifest: runtimeManifest,
    cci_runtime: state.profile === PROFILE_CCI ? json(CCI_RUNTIME_PATH) : null,
    cci_release_manifest: state.profile === PROFILE_CCI ? json(CCI_RELEASE_MANIFEST_PATH) : null,
    artifacts_present: Object.fromEntries(PROHIBITED_RELEASE_PATHS.map(relative => [relative, exists(relative)])),
  };
}

function runActiveProfileChecker() {
  assert.equal(exists(ACTIVE_PROFILE_CHECKER), true, 'active-profile checker is missing');
  const run = childProcess.spawnSync(process.execPath, [ACTIVE_PROFILE_CHECKER, '--verify-active'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  if (run.status !== 0) {
    throw new Error(`active-profile checker failed:\n${`${run.stdout || ''}${run.stderr || ''}`.trim()}`);
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
    let activeProfileCheck = null;
    if (result.runtime_affecting_paths.length) activeProfileCheck = runActiveProfileChecker();
    process.stdout.write([
      'CT-RUNTIME-DIFF boundary: PASS',
      `  mode: ${result.mode}`,
      `  runtime paths: ${result.runtime_affecting_paths.length}`,
      `  strict required: ${result.strict_required}`,
      `  reviewed release required: ${result.release_required}`,
      `  active state: ${result.active_profile}:${result.active_phase}`,
      activeProfileCheck ? `  active-profile check: ${activeProfileCheck}` : null,
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
    '  fictional release-routing cases grant no release authority',
  ].join('\n') + '\n');
}
