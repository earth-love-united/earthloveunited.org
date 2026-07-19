#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { resolveStagedRoot } = require('./check-staged-production-integrity');
const publicSurface = require('./lib/public-deploy-surface');
const { parseJsonNoDuplicateKeys } = require('./lib/ct42-runtime-rollback-review');
const {
  EXPECTED_UI_REVIEW_COMMIT,
  EXPECTED_UI_REVIEW_SHA256,
  REQUIRED_UI_REVIEW_PIN_PATHS,
  UI_REVIEW_PATH,
  ct42RuntimeProjection,
} = require('./lib/globe-runtime-assets');

const ROOT = path.resolve(__dirname, '..');

function runNode(args) {
  const result = childProcess.spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

function requirePass(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${result.stdout || ''}${result.stderr || ''}`.trim());
  }
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function reviewedCommitBytes(sourceRoot, commit, relative) {
  const result = childProcess.spawnSync('git', ['show', `${commit}:${relative}`], {
    cwd: sourceRoot,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`reviewed Git object is unavailable: ${relative}`);
  return result.stdout;
}

function verifyReviewedPublicRuntime(sourceRoot, stagedRoot) {
  const reviewRecord = publicSurface.inspectRegular(sourceRoot, UI_REVIEW_PATH);
  assert.equal(reviewRecord.sha256, EXPECTED_UI_REVIEW_SHA256, 'CT-42 UI review attestation SHA-256 drift');
  const review = parseJsonNoDuplicateKeys(reviewRecord.bytes.toString('utf8'), UI_REVIEW_PATH);
  assert.equal(review.reviewed_commit, EXPECTED_UI_REVIEW_COMMIT, 'CT-42 UI review commit drift');
  assert.deepEqual(review.reviewed_file_pins.map(entry => entry.path), REQUIRED_UI_REVIEW_PIN_PATHS,
    'CT-42 UI review pin scope drift');

  const pins = new Map();
  for (const entry of review.reviewed_file_pins) {
    assert.match(entry.sha256 || '', /^[0-9a-f]{64}$/, `invalid CT-42 UI pin: ${entry.path}`);
    assert.equal(pins.has(entry.path), false, `duplicate CT-42 UI pin: ${entry.path}`);
    pins.set(entry.path, entry.sha256);
  }

  let stagedCount = 0;
  for (const relative of REQUIRED_UI_REVIEW_PIN_PATHS) {
    const expected = pins.get(relative);
    const source = publicSurface.inspectRegular(sourceRoot, relative);
    const reviewedBytes = reviewedCommitBytes(sourceRoot, review.reviewed_commit, relative);
    assert.equal(sha256(reviewedBytes), expected,
      `CT-42 pin differs from reviewed Git object: ${relative}`);
    const projectionSha256 = sha256(ct42RuntimeProjection(relative, reviewedBytes));
    assert.equal(sha256(ct42RuntimeProjection(relative, source.bytes)), projectionSha256,
      `source reviewed runtime projection drift: ${relative}`);
    if (publicSurface.ALWAYS_PUBLIC_PATHS.includes(relative)) {
      const staged = publicSurface.inspectRegular(stagedRoot, relative);
      assert.equal(sha256(ct42RuntimeProjection(relative, staged.bytes)), projectionSha256,
        `staged reviewed runtime projection drift: ${relative}`);
      assert.equal(staged.sha256, source.sha256, `staged/source runtime byte drift: ${relative}`);
      stagedCount += 1;
    }
  }
  assert.equal(stagedCount, REQUIRED_UI_REVIEW_PIN_PATHS.length - 1,
    'exactly one reviewed source-only test tool must remain outside the public surface');
  return stagedCount;
}

function verifyFactualStaged(options) {
  const runner = options.runner || runNode;
  requirePass(runner(['tools/check-climate-factual-public-readiness.js']), 'factual-public readiness');
  requirePass(runner(['tools/check-globe-third-party-notices.js', '--staged', options.stagedRoot]),
    'staged third-party notices');
  const surfaceVerifier = options.surfaceVerifier || publicSurface.verifyPublicDeploySurface;
  const runtimeVerifier = options.runtimeVerifier || verifyReviewedPublicRuntime;
  const surfaceReport = surfaceVerifier({
    sourceRoot: options.sourceRoot,
    stagedRoot: options.stagedRoot,
    mode: 'release',
  });
  const ct45RehashCount = runtimeVerifier(options.sourceRoot, options.stagedRoot);
  return {
    status: 'pass',
    public_file_count: surfaceReport.file_count,
    ct45_rehash_count: ct45RehashCount,
  };
}

function runSelfTest() {
  const calls = [];
  const report = verifyFactualStaged({
    sourceRoot: '/fixture/source',
    stagedRoot: '/fixture/staged',
    runner(args) {
      calls.push(args);
      return { status: 0, stdout: '', stderr: '' };
    },
    surfaceVerifier(options) {
      assert.equal(options.mode, 'release', 'factual output must use the marker-free exact release surface');
      return { status: 'pass', file_count: 43 };
    },
    runtimeVerifier() { return 22; },
  });
  assert.equal(report.status, 'pass');
  assert.deepEqual(calls, [
    ['tools/check-climate-factual-public-readiness.js'],
    ['tools/check-globe-third-party-notices.js', '--staged', '/fixture/staged'],
  ]);
  assert.throws(() => verifyFactualStaged({
    sourceRoot: '/fixture/source',
    stagedRoot: '/fixture/staged',
    runner() { return { status: 1, stdout: '', stderr: 'blocked' }; },
    surfaceVerifier() { throw new Error('must not reach surface verification'); },
    runtimeVerifier() { throw new Error('must not reach runtime verification'); },
  }), /factual-public readiness failed/);
  process.stdout.write('Final staged factual-public integrity policy: PASS (marker-free mode and child gates fail closed)\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') return runSelfTest();
  if (args.length !== 2 || args[0] !== '--staged') {
    throw new Error('usage: check-staged-factual-public-integrity.js --staged <directory> | --self-test');
  }
  const stagedRoot = resolveStagedRoot(ROOT, args[1]);
  try {
    const report = verifyFactualStaged({ sourceRoot: ROOT, stagedRoot });
    process.stdout.write('Final staged factual-public integrity: PASS (' + report.public_file_count +
      ' exact public files, ' +
      report.ct45_rehash_count + ' final CT-45 reviewed runtime rehashes; assessed release remains blocked)\n');
  } catch (error) {
    fs.rmSync(stagedRoot, { recursive: true, force: true });
    throw error;
  }
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Final staged factual-public integrity: BLOCKED — ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  requirePass,
  runSelfTest,
  verifyFactualStaged,
  verifyReviewedPublicRuntime,
};
