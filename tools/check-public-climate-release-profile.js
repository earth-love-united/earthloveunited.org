#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  PROFILE_CCI,
  PROFILE_LEGACY_CT40,
  detectPublicClimateReleaseProfile,
  runSelfTest: runDetectionSelfTest,
} = require('./lib/public-climate-release-profile');
const { PATHS: CCI_RELEASE_PATHS } = require('./lib/country-climate-intelligence-release-gate');
const { PATHS: LEGACY_RELEASE_PATHS } = require('./lib/climate-reviewed-release');
const { verifyApprovalArtifacts } = require('./check-staged-production-integrity');

const ROOT = path.resolve(__dirname, '..');
const CCI_AUTHORITY_PATHS = Object.freeze([
  CCI_RELEASE_PATHS.approval,
  CCI_RELEASE_PATHS.releaseDiff,
  CCI_RELEASE_PATHS.runtimeManifest,
  CCI_RELEASE_PATHS.rollbackProof,
  CCI_RELEASE_PATHS.signatures,
]);
const LEGACY_AUTHORITY_PATHS = Object.freeze(Object.values(LEGACY_RELEASE_PATHS));

function entryPresent(root, relative) {
  try {
    fs.lstatSync(path.join(root, relative));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function assertNoCrossProfileAuthority(root, profile, present = entryPresent) {
  const prohibited = profile === PROFILE_CCI
    ? LEGACY_AUTHORITY_PATHS
    : CCI_AUTHORITY_PATHS;
  const found = prohibited.filter(relative => present(root, relative));
  if (found.length) {
    throw new Error('cross-profile release authority artifacts are present for ' + profile + ': ' + found.join(', '));
  }
}

function authorityPackageState(root, profile, present = entryPresent) {
  if (![PROFILE_CCI, PROFILE_LEGACY_CT40].includes(profile)) {
    throw new Error('unknown climate release profile');
  }
  assertNoCrossProfileAuthority(root, profile, present);
  const required = profile === PROFILE_CCI ? CCI_AUTHORITY_PATHS : LEGACY_AUTHORITY_PATHS;
  const found = required.filter(relative => present(root, relative));
  if (found.length === 0) return { mode: 'candidate', found: [], required: [...required] };
  if (found.length !== required.length) {
    throw new Error('active-profile release authority package is partial for ' + profile + ': ' + found.join(', '));
  }
  return { mode: 'release', found, required: [...required] };
}

function policyPlan(profile, mode) {
  if (![PROFILE_CCI, PROFILE_LEGACY_CT40].includes(profile)) throw new Error('unknown climate release profile');
  if (!['candidate', 'release'].includes(mode)) throw new Error('climate release mode must be candidate or release');
  if (profile === PROFILE_CCI) {
    return mode === 'release'
      ? [['tools/check-country-climate-intelligence-release-gate.js', '--require-release']]
      : [
        ['tools/check-country-climate-intelligence-ci.js'],
        ['tools/check-country-climate-intelligence-release-gate.js'],
      ];
  }
  return [['tools/check-climate-production-readiness.js', '--' + mode]];
}

function runChecker(root, args) {
  const result = childProcess.spawnSync(process.execPath, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  if (result.status !== 0) {
    throw new Error(args[0] + ' failed:\n' + (result.stdout || '') + (result.stderr || ''));
  }
  if (result.stdout) process.stdout.write(result.stdout);
}

function enforceProfilePolicy(options) {
  const root = path.resolve(options.root);
  const detected = options.detected || detectPublicClimateReleaseProfile(root);
  const runner = options.runner || runChecker;
  assertNoCrossProfileAuthority(root, detected.profile, options.entryPresent || entryPresent);
  policyPlan(detected.profile, options.mode).forEach(args => runner(root, args));
  if (options.mode === 'release') {
    const approvalVerifier = options.approvalVerifier || function (valueRoot) {
      verifyApprovalArtifacts(valueRoot, valueRoot, true);
    };
    approvalVerifier(root);
  }
  return { status: 'pass', mode: options.mode, profile: detected.profile, fingerprint: detected.fingerprint };
}

function enforceActiveProfilePolicy(options) {
  const root = path.resolve(options.root);
  const detected = options.detected || detectPublicClimateReleaseProfile(root);
  const packageState = authorityPackageState(root, detected.profile, options.entryPresent || entryPresent);
  return enforceProfilePolicy({ ...options, root, detected, mode: packageState.mode });
}

function enforceLegacyFactualDisplayProfile(options) {
  const root = path.resolve(options.root);
  const detected = options.detected || detectPublicClimateReleaseProfile(root);
  const packageState = authorityPackageState(root, detected.profile, options.entryPresent || entryPresent);
  if (detected.profile !== PROFILE_LEGACY_CT40 || packageState.mode !== 'candidate') {
    throw new Error('limited factual-display staging requires exact legacy_ct40:candidate state');
  }
  return {
    status: 'pass',
    mode: 'limited_factual_display',
    profile: detected.profile,
    fingerprint: detected.fingerprint,
  };
}

function enforceCciAiFactualProfile(options) {
  const root = path.resolve(options.root);
  const detected = options.detected || detectPublicClimateReleaseProfile(root);
  const packageState = authorityPackageState(root, detected.profile, options.entryPresent || entryPresent);
  if (detected.profile !== PROFILE_CCI || packageState.mode !== 'candidate') {
    throw new Error('AI-reviewed source-data staging requires exact cci:candidate state');
  }
  const runner = options.runner || runChecker;
  runner(root, ['tools/check-country-climate-intelligence-ci.js']);
  runner(root, ['tools/check-cci-factual-public-review.js']);
  return {
    status: 'pass',
    mode: 'ai_reviewed_source_data',
    profile: detected.profile,
    fingerprint: detected.fingerprint,
    human_review: false,
    legal_certification: false,
  };
}

function runSelfTest() {
  const detectionCases = runDetectionSelfTest();
  assert.deepEqual(policyPlan(PROFILE_CCI, 'release'), [
    ['tools/check-country-climate-intelligence-release-gate.js', '--require-release'],
  ]);
  assert.deepEqual(policyPlan(PROFILE_LEGACY_CT40, 'release'), [
    ['tools/check-climate-production-readiness.js', '--release'],
  ]);
  assert(policyPlan(PROFILE_CCI, 'candidate').every(args => !args[0].includes('production-readiness')));
  assert(policyPlan(PROFILE_LEGACY_CT40, 'candidate').every(args => !args[0].includes('country-climate-intelligence')));
  let assetCalls = 0;
  enforceProfilePolicy({
    root: ROOT,
    mode: 'release',
    detected: { profile: PROFILE_CCI, fingerprint: {} },
    runner() {},
    approvalVerifier() { assetCalls += 1; },
  });
  assert.equal(assetCalls, 1, 'release mode must require the separate signed globe-asset approval');
  let candidateAssetCalls = 0;
  enforceProfilePolicy({
    root: ROOT,
    mode: 'candidate',
    detected: { profile: PROFILE_CCI, fingerprint: {} },
    runner() {},
    approvalVerifier() { candidateAssetCalls += 1; },
  });
  assert.equal(candidateAssetCalls, 0, 'candidate mode must never infer release authority from asset approval');
  assert.equal(authorityPackageState(ROOT, PROFILE_CCI, () => false).mode, 'candidate');
  assert.equal(authorityPackageState(ROOT, PROFILE_CCI,
    (_root, relative) => CCI_AUTHORITY_PATHS.includes(relative)).mode, 'release');
  assert.equal(authorityPackageState(ROOT, PROFILE_LEGACY_CT40, () => false).mode, 'candidate');
  assert.equal(authorityPackageState(ROOT, PROFILE_LEGACY_CT40,
    (_root, relative) => LEGACY_AUTHORITY_PATHS.includes(relative)).mode, 'release');
  assert.throws(() => authorityPackageState(ROOT, PROFILE_CCI,
    (_root, relative) => relative === CCI_AUTHORITY_PATHS[0]), /partial/);
  assert.throws(() => authorityPackageState(ROOT, PROFILE_LEGACY_CT40,
    (_root, relative) => relative === LEGACY_AUTHORITY_PATHS[0]), /partial/);
  assert.throws(() => enforceActiveProfilePolicy({
    root: ROOT,
    detected: { profile: PROFILE_CCI, fingerprint: {} },
    runner() { throw new Error('runner must not execute for a partial package'); },
    entryPresent(_root, relative) { return relative === CCI_AUTHORITY_PATHS[0]; },
  }), /partial/);
  assert.throws(() => assertNoCrossProfileAuthority(ROOT, PROFILE_CCI,
    (_root, relative) => relative === LEGACY_AUTHORITY_PATHS[0]), /cross-profile/);
  assert.throws(() => assertNoCrossProfileAuthority(ROOT, PROFILE_LEGACY_CT40,
    (_root, relative) => relative === CCI_AUTHORITY_PATHS[0]), /cross-profile/);
  assert.doesNotThrow(() => assertNoCrossProfileAuthority(ROOT, PROFILE_CCI, () => false));
  assert.equal(enforceLegacyFactualDisplayProfile({
    root: ROOT,
    detected: { profile: PROFILE_LEGACY_CT40, fingerprint: {} },
    entryPresent() { return false; },
  }).mode, 'limited_factual_display');
  assert.throws(() => enforceLegacyFactualDisplayProfile({
    root: ROOT,
    detected: { profile: PROFILE_CCI, fingerprint: {} },
    entryPresent() { return false; },
  }), /exact legacy_ct40:candidate/);
  assert.throws(() => enforceLegacyFactualDisplayProfile({
    root: ROOT,
    detected: { profile: PROFILE_LEGACY_CT40, fingerprint: {} },
    entryPresent(_root, relative) { return LEGACY_AUTHORITY_PATHS.includes(relative); },
  }), /exact legacy_ct40:candidate/);
  let aiFactualCalls = 0;
  assert.equal(enforceCciAiFactualProfile({
    root: ROOT,
    detected: { profile: PROFILE_CCI, fingerprint: {} },
    entryPresent() { return false; },
    runner() { aiFactualCalls += 1; },
  }).mode, 'ai_reviewed_source_data');
  assert.equal(aiFactualCalls, 2, 'AI-factual mode must run exact CCI and review-artifact checks');
  assert.throws(() => enforceCciAiFactualProfile({
    root: ROOT,
    detected: { profile: PROFILE_LEGACY_CT40, fingerprint: {} },
    entryPresent() { return false; },
    runner() { throw new Error('runner must not execute'); },
  }), /exact cci:candidate/);
  assert.throws(() => enforceCciAiFactualProfile({
    root: ROOT,
    detected: { profile: PROFILE_CCI, fingerprint: {} },
    entryPresent(_root, relative) { return CCI_AUTHORITY_PATHS.includes(relative); },
    runner() { throw new Error('runner must not execute'); },
  }), /exact cci:candidate/);
  assert.throws(() => policyPlan('mixed', 'release'), /unknown/);
  process.stdout.write('Public climate release-profile self-test: PASS (' + detectionCases +
    ' detection cases; exclusive routing; limited factual-display isolation; separate AI-factual isolation; release-only signed-asset boundary)\n');
}

function parseArgs(argv) {
  if (argv.length !== 1 || !['--profile', '--state', '--verify-active', '--factual-display', '--cci-ai-factual', '--candidate', '--release', '--self-test'].includes(argv[0])) {
    throw new Error('usage: node tools/check-public-climate-release-profile.js --profile | --state | --verify-active | --factual-display | --cci-ai-factual | --candidate | --release | --self-test');
  }
  return argv[0];
}

function main() {
  const command = parseArgs(process.argv.slice(2));
  if (command === '--self-test') return runSelfTest();
  const detected = detectPublicClimateReleaseProfile(ROOT);
  if (command === '--profile') {
    process.stdout.write(detected.profile + '\n');
    return;
  }
  if (command === '--state') {
    const state = authorityPackageState(ROOT, detected.profile);
    process.stdout.write(detected.profile + ':' + state.mode + '\n');
    return;
  }
  if (command === '--verify-active') {
    const report = enforceActiveProfilePolicy({ root: ROOT, detected });
    process.stdout.write('Public climate release profile: PASS (' + report.profile + '; ' + report.mode + ')\n');
    return;
  }
  if (command === '--factual-display') {
    const report = enforceLegacyFactualDisplayProfile({ root: ROOT, detected });
    process.stdout.write('Public climate release profile: PASS (' + report.profile + '; ' + report.mode + ')\n');
    return;
  }
  if (command === '--cci-ai-factual') {
    const report = enforceCciAiFactualProfile({ root: ROOT, detected });
    process.stdout.write('Public climate release profile: PASS (' + report.profile + '; ' + report.mode + '; human_review=false; legal_certification=false)\n');
    return;
  }
  const report = enforceProfilePolicy({ root: ROOT, mode: command.slice(2), detected });
  process.stdout.write('Public climate release profile: PASS (' + report.profile + '; ' + report.mode + ')\n');
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write('Public climate release profile: BLOCKED — ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = {
  CCI_AUTHORITY_PATHS,
  LEGACY_AUTHORITY_PATHS,
  assertNoCrossProfileAuthority,
  authorityPackageState,
  enforceActiveProfilePolicy,
  enforceCciAiFactualProfile,
  enforceLegacyFactualDisplayProfile,
  enforceProfilePolicy,
  parseArgs,
  policyPlan,
  runSelfTest,
};
