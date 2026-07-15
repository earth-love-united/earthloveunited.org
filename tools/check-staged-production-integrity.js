#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const notices = require('./lib/globe-third-party-notices');
const approvalPolicy = require('./lib/globe-runtime-approval');
const { REQUIRED_UI_REVIEW_PIN_PATHS } = require('./lib/globe-runtime-assets');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_NOTICE_LINK = '<a href="/THIRD_PARTY_NOTICES.txt">Third-party notices</a>';
const PINNED_FILES = Object.freeze([
  Object.freeze({ path: notices.NOTICE_PATH, sha256: notices.EXPECTED_NOTICE_SHA256 }),
  Object.freeze({ path: notices.MANIFEST_PATH, sha256: notices.EXPECTED_MANIFEST_SHA256 }),
  Object.freeze({ path: notices.INTEGRATION_PATH, sha256: notices.EXPECTED_INTEGRATION_SHA256 }),
  Object.freeze({ path: notices.APPROVAL_SCHEMA_PATH, sha256: notices.EXPECTED_APPROVAL_SCHEMA_SHA256 }),
  Object.freeze({ path: approvalPolicy.TRUST_REGISTRY_PATH, sha256: approvalPolicy.EXPECTED_TRUST_REGISTRY_SHA256 }),
]);

function safeRelative(relative) {
  const normalized = path.posix.normalize(String(relative || '').replaceAll(path.sep, '/'));
  if (!normalized || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized) ||
      normalized.includes('\0')) {
    throw new Error('unsafe production-integrity path: ' + relative);
  }
  return normalized;
}

function inspectEntry(root, relative) {
  const normalized = safeRelative(relative);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    return { exists: true, regular_file: false, reason: 'unsafe_root' };
  }
  let current = root;
  const parts = normalized.split('/');
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code === 'ENOENT') return { exists: false, regular_file: false, reason: 'missing' };
      throw error;
    }
    if (stat.isSymbolicLink()) return { exists: true, regular_file: false, reason: 'symbolic_link' };
    if (index < parts.length - 1 && !stat.isDirectory()) {
      return { exists: true, regular_file: false, reason: 'non_directory_parent' };
    }
    if (index === parts.length - 1 && !stat.isFile()) {
      return { exists: true, regular_file: false, reason: 'not_regular_file' };
    }
  }
  const bytes = fs.readFileSync(current);
  return {
    exists: true,
    regular_file: true,
    bytes,
    text: bytes.toString('utf8'),
    sha256: approvalPolicy.sha256(bytes),
  };
}

function requireRegular(root, relative) {
  const record = inspectEntry(root, relative);
  if (!record.regular_file) throw new Error(relative + ' must be a regular non-symlink file');
  return record;
}

function resolveStagedRoot(repoRoot, requested) {
  if (typeof requested !== 'string' || !requested.trim() || requested.includes('\0')) {
    throw new Error('--staged requires a safe staged directory');
  }
  const lexicalRoot = path.resolve(repoRoot);
  const lexicalCandidate = path.resolve(lexicalRoot, requested);
  const lexicalRelative = path.relative(lexicalRoot, lexicalCandidate);
  if (!lexicalRelative || lexicalRelative.startsWith('..') || path.isAbsolute(lexicalRelative)) {
    throw new Error('--staged must be a directory inside the repository');
  }
  const rootStat = fs.lstatSync(lexicalRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('repository root must be a regular directory');
  }
  let current = lexicalRoot;
  for (const part of lexicalRelative.split(path.sep)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('--staged path must not contain symbolic links');
    if (!stat.isDirectory()) throw new Error('--staged path components must be directories');
  }
  const realRoot = fs.realpathSync.native(lexicalRoot);
  const realCandidate = fs.realpathSync.native(lexicalCandidate);
  const realRelative = path.relative(realRoot, realCandidate);
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error('--staged real path must remain inside the repository');
  }
  return realCandidate;
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
}

function reviewedCommitBindingPasses(root, approval) {
  const reviewed = approval && approval.reviewed_commit_sha;
  if (!/^[0-9a-f]{40}$/.test(reviewed || '')) return false;
  const ancestor = childProcess.spawnSync('git', ['merge-base', '--is-ancestor', reviewed, 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (ancestor.status !== 0) return false;
  const reviewedPaths = [...new Set([
    ...REQUIRED_UI_REVIEW_PIN_PATHS,
    notices.NOTICE_PATH,
    notices.MANIFEST_PATH,
    notices.INTEGRATION_PATH,
    notices.APPROVAL_SCHEMA_PATH,
    approvalPolicy.TRUST_REGISTRY_PATH,
    'index.html',
    'CREDITS.md',
    '.github/workflows/ci.yml',
    'tools/build-deploy.sh',
    'tools/check-globe-runtime-assets.js',
    'tools/lib/globe-runtime-assets.js',
    'tools/fixtures/globe-runtime-assets.json',
    'tools/check-globe-third-party-notices.js',
    'tools/lib/globe-third-party-notices.js',
    'tools/fixtures/globe-third-party-notices.json',
    'tools/check-globe-runtime-approval.js',
    'tools/lib/globe-runtime-approval.js',
    'tools/check-staged-production-integrity.js',
    'tools/climate-truth-ci.js',
    'tools/lib/climate-runtime-diff-boundary.js',
    'tools/lib/climate-production-readiness.js',
    'tools/check-climate-production-readiness.js',
    'tools/check-climate-production-readiness-policy.js',
  ])];
  const diff = childProcess.spawnSync('git', ['diff', '--quiet', reviewed, 'HEAD', '--', ...reviewedPaths], {
    cwd: root,
    encoding: 'utf8',
  });
  return diff.status === 0;
}

function verifyPinnedFiles(sourceRoot, stagedRoot) {
  PINNED_FILES.forEach(function (entry) {
    const source = requireRegular(sourceRoot, entry.path);
    const staged = requireRegular(stagedRoot, entry.path);
    if (source.sha256 !== entry.sha256) throw new Error('source SHA-256 drift: ' + entry.path);
    if (staged.sha256 !== entry.sha256) throw new Error('staged SHA-256 drift: ' + entry.path);
    if (source.sha256 !== staged.sha256) throw new Error('source/staged mismatch: ' + entry.path);
  });
}

function verifyFooter(sourceRoot, stagedRoot) {
  const source = requireRegular(sourceRoot, 'index.html');
  const staged = requireRegular(stagedRoot, 'index.html');
  const activeSource = source.text.replace(/<!--[\s\S]*?-->/g, '');
  const activeStaged = staged.text.replace(/<!--[\s\S]*?-->/g, '');
  if (source.sha256 !== staged.sha256) throw new Error('staged index.html differs from source');
  if (activeSource.split(PUBLIC_NOTICE_LINK).length - 1 !== 1 ||
      activeStaged.split(PUBLIC_NOTICE_LINK).length - 1 !== 1) {
    throw new Error('exactly one active same-origin third-party notice footer link is required');
  }
}

function verifyApprovalArtifacts(sourceRoot, stagedRoot) {
  const sourceApproval = inspectEntry(sourceRoot, approvalPolicy.APPROVAL_PATH);
  const stagedApproval = inspectEntry(stagedRoot, approvalPolicy.APPROVAL_PATH);
  const sourceBundle = inspectEntry(sourceRoot, approvalPolicy.SIGNATURE_BUNDLE_PATH);
  const stagedBundle = inspectEntry(stagedRoot, approvalPolicy.SIGNATURE_BUNDLE_PATH);
  const anyPresent = sourceApproval.exists || stagedApproval.exists || sourceBundle.exists || stagedBundle.exists;
  if (!anyPresent) return;
  if (![sourceApproval, stagedApproval, sourceBundle, stagedBundle].every(record => record.regular_file)) {
    throw new Error('approval and detached signature artifacts must both be regular source/staged files');
  }
  if (sourceApproval.sha256 !== stagedApproval.sha256 || sourceBundle.sha256 !== stagedBundle.sha256) {
    throw new Error('approval or detached signature bytes differ between source and staged trees');
  }
  const stagedTrust = requireRegular(stagedRoot, approvalPolicy.TRUST_REGISTRY_PATH);
  let approval;
  let registry;
  let signatureBundle;
  try {
    approval = JSON.parse(stagedApproval.text);
    registry = JSON.parse(stagedTrust.text);
    signatureBundle = JSON.parse(stagedBundle.text);
  } catch (_) {
    throw new Error('approval, trust registry, and signature bundle must be valid JSON');
  }
  const report = approvalPolicy.evaluateApprovalAuthority({
    approval,
    approval_text: stagedApproval.text,
    approval_file_regular: true,
    trust_registry: registry,
    trust_registry_text: stagedTrust.text,
    trust_registry_file_regular: true,
    expected_trust_registry_sha256: approvalPolicy.EXPECTED_TRUST_REGISTRY_SHA256,
    signature_bundle: signatureBundle,
    signature_bundle_text: stagedBundle.text,
    signature_bundle_file_regular: true,
    reviewed_commit_binding_passed: reviewedCommitBindingPasses(sourceRoot, approval),
  });
  if (report.status !== 'pass') {
    throw new Error('detached production approval verification failed: ' + report.failure_ids.join(', '));
  }
}

function verifyFinalStagedIntegrity(options) {
  const sourceRoot = path.resolve(options.sourceRoot);
  const stagedRoot = path.resolve(options.stagedRoot);
  if (!options.skipChildChecks) {
    runChecker(sourceRoot, ['tools/check-globe-third-party-notices.js', '--staged', stagedRoot]);
    runChecker(sourceRoot, ['tools/check-globe-runtime-assets.js', '--staged', stagedRoot]);
  }
  if (typeof options.afterPrecheck === 'function') options.afterPrecheck();
  verifyPinnedFiles(sourceRoot, stagedRoot);
  verifyFooter(sourceRoot, stagedRoot);
  verifyApprovalArtifacts(sourceRoot, stagedRoot);
  return { status: 'pass', pinned_file_count: PINNED_FILES.length };
}

function copyFixtureFile(sourceRoot, targetRoot, relative) {
  const destination = path.join(targetRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, relative), destination);
}

function makeSelfTestFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-final-integrity-'));
  const staged = path.join(root, '_deploy');
  fs.mkdirSync(staged);
  PINNED_FILES.map(entry => entry.path).concat(['index.html']).forEach(function (relative) {
    copyFixtureFile(ROOT, root, relative);
    copyFixtureFile(ROOT, staged, relative);
  });
  return { root, staged };
}

function assertMutationRejected(id, mutate, afterPrecheck) {
  const fixture = makeSelfTestFixture();
  try {
    mutate(fixture);
    assert.throws(function () {
      verifyFinalStagedIntegrity({
        sourceRoot: fixture.root,
        stagedRoot: fixture.staged,
        skipChildChecks: true,
        afterPrecheck: afterPrecheck ? function () { afterPrecheck(fixture); } : null,
      });
    }, undefined, id + ' unexpectedly passed');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runSelfTest() {
  const fixture = makeSelfTestFixture();
  try {
    assert.equal(verifyFinalStagedIntegrity({
      sourceRoot: fixture.root,
      stagedRoot: fixture.staged,
      skipChildChecks: true,
    }).status, 'pass');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }

  assertMutationRejected('post-check notice tamper', function () {}, function (value) {
    fs.appendFileSync(path.join(value.staged, notices.NOTICE_PATH), '\ntampered after earlier checks\n');
  });
  assertMutationRejected('post-check trust tamper', function () {}, function (value) {
    fs.appendFileSync(path.join(value.staged, approvalPolicy.TRUST_REGISTRY_PATH), ' ');
  });
  assertMutationRejected('post-check footer tamper', function () {}, function (value) {
    const indexPath = path.join(value.staged, 'index.html');
    fs.writeFileSync(indexPath, fs.readFileSync(indexPath, 'utf8').replace(PUBLIC_NOTICE_LINK, 'Notices unavailable'));
  });
  assertMutationRejected('staged-only unpinned approval', function (value) {
    const approvalPath = path.join(value.staged, approvalPolicy.APPROVAL_PATH);
    fs.mkdirSync(path.dirname(approvalPath), { recursive: true });
    fs.writeFileSync(approvalPath, '{}\n');
  });
  assertMutationRejected('source approval symlink', function (value) {
    const target = path.join(value.root, 'untrusted-approval.json');
    fs.writeFileSync(target, '{}\n');
    const approvalPath = path.join(value.root, approvalPolicy.APPROVAL_PATH);
    fs.mkdirSync(path.dirname(approvalPath), { recursive: true });
    fs.symlinkSync(target, approvalPath);
  });
  assertMutationRejected('approval ancestor symlink', function (value) {
    const externalReviews = path.join(value.root, 'external-reviews');
    fs.mkdirSync(externalReviews);
    fs.writeFileSync(path.join(externalReviews, path.basename(approvalPolicy.APPROVAL_PATH)), '{}\n');
    fs.writeFileSync(path.join(externalReviews, path.basename(approvalPolicy.SIGNATURE_BUNDLE_PATH)), '{}\n');
    const reviewsPath = path.join(value.root, path.dirname(approvalPolicy.APPROVAL_PATH));
    fs.mkdirSync(path.dirname(reviewsPath), { recursive: true });
    fs.symlinkSync(path.relative(path.dirname(reviewsPath), externalReviews), reviewsPath, 'dir');
  });
  assertMutationRejected('trust-registry ancestor symlink', function (value) {
    const governancePath = path.join(value.staged, path.dirname(approvalPolicy.TRUST_REGISTRY_PATH));
    const externalGovernance = path.join(value.staged, 'external-governance');
    fs.renameSync(governancePath, externalGovernance);
    fs.symlinkSync(path.relative(path.dirname(governancePath), externalGovernance), governancePath, 'dir');
  });
  assertMutationRejected('signature without approval', function (value) {
    [value.root, value.staged].forEach(function (base) {
      const bundlePath = path.join(base, approvalPolicy.SIGNATURE_BUNDLE_PATH);
      fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
      fs.writeFileSync(bundlePath, '{}\n');
    });
  });

  const symlinkFixture = makeSelfTestFixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-final-integrity-outside-'));
  try {
    fs.symlinkSync(outside, path.join(symlinkFixture.root, 'redirect'));
    assert.throws(() => resolveStagedRoot(symlinkFixture.root, 'redirect/nested'), /symbolic links|ENOENT/);
  } finally {
    fs.rmSync(symlinkFixture.root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
  process.stdout.write('Final staged production integrity self-test: PASS (9 fail-closed filesystem/tamper cases)\n');
}

function runCli(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') {
    runSelfTest();
    return;
  }
  if (argv.length !== 2 || argv[0] !== '--staged') {
    throw new Error('usage: node tools/check-staged-production-integrity.js --staged <directory> | --self-test');
  }
  const stagedRoot = resolveStagedRoot(ROOT, argv[1]);
  const report = verifyFinalStagedIntegrity({ sourceRoot: ROOT, stagedRoot });
  process.stdout.write('Final staged production integrity: PASS (' + report.pinned_file_count +
    ' pinned notice/trust files, footer parity, approval boundary)\n');
}

if (require.main === module) {
  try { runCli(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write('Final staged production integrity: FAIL — ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = {
  PINNED_FILES,
  inspectEntry,
  resolveStagedRoot,
  verifyFinalStagedIntegrity,
};
