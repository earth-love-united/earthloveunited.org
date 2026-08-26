#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const path = require('node:path');
const {
  PROFILE_CCI,
  PROFILE_LEGACY_CT40,
  detectPublicClimateReleaseProfile,
  runSelfTest: runDetectionSelfTest,
} = require('./lib/public-climate-release-profile');
const { verifyApprovalArtifacts } = require('./check-staged-production-integrity');

const ROOT = path.resolve(__dirname, '..');

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
  policyPlan(detected.profile, options.mode).forEach(args => runner(root, args));
  if (options.mode === 'release') {
    const approvalVerifier = options.approvalVerifier || function (valueRoot) {
      verifyApprovalArtifacts(valueRoot, valueRoot, true);
    };
    approvalVerifier(root);
  }
  return { status: 'pass', mode: options.mode, profile: detected.profile, fingerprint: detected.fingerprint };
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
  assert.throws(() => policyPlan('mixed', 'release'), /unknown/);
  process.stdout.write('Public climate release-profile self-test: PASS (' + detectionCases +
    ' detection cases; exclusive routing; release-only signed-asset boundary)\n');
}

function parseArgs(argv) {
  if (argv.length !== 1 || !['--profile', '--candidate', '--release', '--self-test'].includes(argv[0])) {
    throw new Error('usage: node tools/check-public-climate-release-profile.js --profile | --candidate | --release | --self-test');
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

module.exports = { enforceProfilePolicy, parseArgs, policyPlan, runSelfTest };
