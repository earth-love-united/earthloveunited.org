#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const notices = require('./lib/globe-third-party-notices');
const approvalPolicy = require('./lib/globe-runtime-approval');
const publicSurface = require('./lib/public-deploy-surface');
const {
  EXPECTED_UI_REVIEW_COMMIT,
  EXPECTED_UI_REVIEW_SHA256,
  REQUIRED_UI_REVIEW_PIN_PATHS,
  UI_REVIEW_PATH,
  ct42RuntimeProjection,
} = require('./lib/globe-runtime-assets');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_NOTICE_LINK = '<a href="/THIRD_PARTY_NOTICES.txt">Third-party notices</a>';
const FINAL_CT45_REHASH_PATHS = REQUIRED_UI_REVIEW_PIN_PATHS;
const PINNED_FILES = Object.freeze([
  Object.freeze({ path: notices.NOTICE_PATH, sha256: notices.EXPECTED_NOTICE_SHA256 }),
  Object.freeze({ path: notices.MANIFEST_PATH, sha256: notices.EXPECTED_MANIFEST_SHA256 }),
  Object.freeze({ path: notices.INTEGRATION_PATH, sha256: notices.EXPECTED_INTEGRATION_SHA256 }),
  Object.freeze({ path: notices.APPROVAL_SCHEMA_PATH, sha256: notices.EXPECTED_APPROVAL_SCHEMA_SHA256 }),
  Object.freeze({ path: approvalPolicy.TRUST_REGISTRY_PATH, sha256: approvalPolicy.EXPECTED_TRUST_REGISTRY_SHA256 }),
]);
const APPROVAL_REVIEWED_PATHS = Object.freeze([...new Set([
  ...REQUIRED_UI_REVIEW_PIN_PATHS,
  UI_REVIEW_PATH,
  notices.NOTICE_PATH,
  notices.MANIFEST_PATH,
  notices.INTEGRATION_PATH,
  notices.APPROVAL_SCHEMA_PATH,
  approvalPolicy.TRUST_REGISTRY_PATH,
  'index.html',
  'CREDITS.md',
  '.github/workflows/ci.yml',
  'tools/build-deploy.sh',
  'tools/stage-public-deploy.js',
  'tools/check-public-deploy-surface.js',
  'tools/lib/public-deploy-surface.js',
  '_headers',
  'docs/LEGACY-COUNTRY-DATA-EXIT.md',
  'docs/COUNTRY-CLIMATE-TRUTH-CI.md',
  'data/climate/fixtures/release-eligibility.json',
  'data/climate/fixtures/reviewed-climate-release.json',
  'data/climate/fixtures/truth-ci-policy.json',
  'data/climate/schemas/ct40-reviewed-release-input.schema.json',
  'data/climate/schemas/reviewed-climate-runtime-manifest.schema.json',
  'data/climate/schemas/reviewed-release-diff.schema.json',
  'data/climate/schemas/reviewed-runtime-rollback-proof.schema.json',
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
  'tools/check-climate-factual-runtime-candidate.js',
  'tools/check-climate-factual-runtime-data-review.js',
  'tools/check-reviewed-climate-release.js',
  'tools/lib/climate-release-gate.js',
  'tools/lib/climate-reviewed-release.js',
  'tools/lib/climate-truth-ci-policy.js',
  'tools/lib/json-schema-lite.js',
  'tools/lib/reviewed-runtime-rollback-proof.js',
])]);

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
  const diff = childProcess.spawnSync('git', ['diff', '--quiet', reviewed, 'HEAD', '--', ...APPROVAL_REVIEWED_PATHS], {
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

function reviewedRuntimePins(sourceRoot) {
  const record = requireRegular(sourceRoot, UI_REVIEW_PATH);
  if (record.sha256 !== EXPECTED_UI_REVIEW_SHA256) {
    throw new Error('CT-42 UI review attestation SHA-256 drift');
  }
  let review;
  try { review = JSON.parse(record.text); }
  catch (_) { throw new Error('CT-42 UI review must be valid JSON'); }
  if (review.reviewed_commit !== EXPECTED_UI_REVIEW_COMMIT) {
    throw new Error('CT-42 UI review commit drift');
  }
  const pins = Array.isArray(review.reviewed_file_pins) ? review.reviewed_file_pins : [];
  const paths = pins.map(entry => entry && entry.path);
  if (JSON.stringify(paths) !== JSON.stringify(FINAL_CT45_REHASH_PATHS)) {
    throw new Error('CT-42 UI review pin scope differs from canonical final CT-45 rehash scope');
  }
  const result = new Map();
  pins.forEach(function (entry) {
    if (!entry || !/^[0-9a-f]{64}$/.test(entry.sha256 || '') || result.has(entry.path)) {
      throw new Error('CT-42 UI review contains an invalid or duplicate runtime pin');
    }
    const reviewedBytes = reviewedCommitBytes(ROOT, review.reviewed_commit, entry.path);
    if (approvalPolicy.sha256(reviewedBytes) !== entry.sha256) {
      throw new Error('CT-42 UI review pin differs from reviewed Git object: ' + entry.path);
    }
    result.set(entry.path, {
      reviewed_sha256: entry.sha256,
      projection_sha256: approvalPolicy.sha256(ct42RuntimeProjection(entry.path, reviewedBytes)),
    });
  });
  return result;
}

function reviewedCommitBytes(sourceRoot, commit, relative) {
  const result = childProcess.spawnSync('git', ['show', commit + ':' + relative], {
    cwd: sourceRoot,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error('reviewed Git object is unavailable: ' + relative);
  }
  return result.stdout;
}

function verifyCt45RuntimeBytes(sourceRoot, stagedRoot) {
  const pins = reviewedRuntimePins(sourceRoot);
  FINAL_CT45_REHASH_PATHS.forEach(function (relative) {
    const expected = pins.get(relative);
    const source = requireRegular(sourceRoot, relative);
    const staged = requireRegular(stagedRoot, relative);
    if (approvalPolicy.sha256(ct42RuntimeProjection(relative, source.bytes)) !== expected.projection_sha256) {
      throw new Error('source reviewed runtime projection drift: ' + relative);
    }
    if (approvalPolicy.sha256(ct42RuntimeProjection(relative, staged.bytes)) !== expected.projection_sha256) {
      throw new Error('final staged CT-45 runtime projection drift: ' + relative);
    }
    if (source.sha256 !== staged.sha256) throw new Error('final CT-45 source/staged mismatch: ' + relative);
  });
  return FINAL_CT45_REHASH_PATHS.length;
}

function verifyFinalStagedIntegrity(options) {
  const sourceRoot = path.resolve(options.sourceRoot);
  const stagedRoot = path.resolve(options.stagedRoot);
  if (!['candidate', 'release'].includes(options.mode)) {
    throw new Error('final staged integrity requires an explicit candidate or release mode');
  }
  if (typeof options.childCheckRunner === 'function') {
    options.childCheckRunner();
  } else if (!options.skipChildChecks) {
    if (options.mode === 'release') {
      runChecker(sourceRoot, ['tools/check-climate-production-readiness.js', '--release']);
    }
    runChecker(sourceRoot, ['tools/check-globe-third-party-notices.js', '--staged', stagedRoot]);
    runChecker(sourceRoot, ['tools/check-globe-runtime-assets.js', '--staged', stagedRoot]);
  }
  if (typeof options.afterPrecheck === 'function') options.afterPrecheck();
  verifyPinnedFiles(sourceRoot, stagedRoot);
  verifyFooter(sourceRoot, stagedRoot);
  verifyApprovalArtifacts(sourceRoot, stagedRoot);
  const publicReport = options.skipPublicSurface ? null : publicSurface.verifyPublicDeploySurface({
    sourceRoot,
    stagedRoot,
    mode: options.mode,
    ...(options.expectedVendorSha256 ? { expectedVendorSha256: options.expectedVendorSha256 } : {}),
  });
  const ct45RehashCount = verifyCt45RuntimeBytes(sourceRoot, stagedRoot);
  return {
    status: 'pass',
    pinned_file_count: PINNED_FILES.length,
    public_file_count: publicReport ? publicReport.file_count : null,
    ct45_rehash_count: ct45RehashCount,
  };
}

function verifyFinalStagedIntegrityWithCleanup(options) {
  try {
    return verifyFinalStagedIntegrity(options);
  } catch (error) {
    try {
      fs.rmSync(options.stagedRoot, { recursive: true, force: true });
    } catch (cleanupError) {
      throw new Error(error.message + '; failed staged-output cleanup: ' + cleanupError.message, { cause: error });
    }
    throw error;
  }
}

function copyFixtureFile(sourceRoot, targetRoot, relative) {
  const destination = path.join(targetRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(sourceRoot, relative), destination);
}

function runFixtureGit(root, args) {
  const result = childProcess.spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('fixture git failed: ' + (result.stderr || result.stdout || args.join(' ')));
  return result.stdout.trim();
}

function runApprovalCommitBindingSelfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-approval-binding-'));
  try {
    APPROVAL_REVIEWED_PATHS.forEach(relative => copyFixtureFile(ROOT, root, relative));
    runFixtureGit(root, ['init', '-q']);
    runFixtureGit(root, ['add', '.']);
    runFixtureGit(root, ['-c', 'user.name=ELU Fixture', '-c', 'user.email=fixture.invalid', 'commit', '-q', '-m', 'reviewed']);
    const reviewed = runFixtureGit(root, ['rev-parse', 'HEAD']);
    assert.equal(reviewedCommitBindingPasses(root, { reviewed_commit_sha: reviewed }), true,
      'exact reviewed approval scope must pass');

    fs.writeFileSync(path.join(root, 'unreviewed-note.txt'), 'outside approval scope\n');
    runFixtureGit(root, ['add', 'unreviewed-note.txt']);
    runFixtureGit(root, ['-c', 'user.name=ELU Fixture', '-c', 'user.email=fixture.invalid', 'commit', '-q', '-m', 'outside scope']);
    assert.equal(reviewedCommitBindingPasses(root, { reviewed_commit_sha: reviewed }), true,
      'unrelated descendant changes must not falsify scoped approval binding');

    fs.appendFileSync(path.join(root, 'js/gaia-utils.js'), '\n// post-review foundation drift\n');
    runFixtureGit(root, ['add', 'js/gaia-utils.js']);
    runFixtureGit(root, ['-c', 'user.name=ELU Fixture', '-c', 'user.email=fixture.invalid', 'commit', '-q', '-m', 'runtime drift']);
    assert.equal(reviewedCommitBindingPasses(root, { reviewed_commit_sha: reviewed }), false,
      'foundation runtime drift must invalidate approval commit binding');

    const reviewRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-approval-ui-review-binding-'));
    try {
      APPROVAL_REVIEWED_PATHS.forEach(relative => copyFixtureFile(ROOT, reviewRoot, relative));
      runFixtureGit(reviewRoot, ['init', '-q']);
      runFixtureGit(reviewRoot, ['add', '.']);
      runFixtureGit(reviewRoot, ['-c', 'user.name=ELU Fixture', '-c', 'user.email=fixture.invalid',
        'commit', '-q', '-m', 'reviewed']);
      const reviewCommit = runFixtureGit(reviewRoot, ['rev-parse', 'HEAD']);
      fs.appendFileSync(path.join(reviewRoot, UI_REVIEW_PATH), '\n');
      runFixtureGit(reviewRoot, ['add', UI_REVIEW_PATH]);
      runFixtureGit(reviewRoot, ['-c', 'user.name=ELU Fixture', '-c', 'user.email=fixture.invalid',
        'commit', '-q', '-m', 'ui review drift']);
      assert.equal(reviewedCommitBindingPasses(reviewRoot, { reviewed_commit_sha: reviewCommit }), false,
        'UI review attestation drift must invalidate approval commit binding');
    } finally {
      fs.rmSync(reviewRoot, { recursive: true, force: true });
    }
    return 3;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function makeSelfTestFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-final-integrity-'));
  const staged = path.join(root, '_deploy');
  fs.mkdirSync(staged);
  const parityPaths = [...new Set(PINNED_FILES.map(entry => entry.path).concat(FINAL_CT45_REHASH_PATHS))];
  parityPaths.forEach(function (relative) {
    copyFixtureFile(ROOT, root, relative);
    copyFixtureFile(ROOT, staged, relative);
  });
  copyFixtureFile(ROOT, root, UI_REVIEW_PATH);
  return { root, staged };
}

function makePublicSurfaceSelfTestFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-final-public-surface-'));
  const staged = path.join(root, '_deploy');
  fs.mkdirSync(staged);
  [...publicSurface.ALWAYS_PUBLIC_PATHS, ...publicSurface.CANDIDATE_ONLY_PATHS].forEach(function (relative) {
    const sourcePath = path.join(ROOT, relative);
    const fixtureSource = path.join(root, relative);
    const fixtureStaged = path.join(staged, relative);
    fs.mkdirSync(path.dirname(fixtureSource), { recursive: true });
    fs.mkdirSync(path.dirname(fixtureStaged), { recursive: true });
    if (fs.existsSync(sourcePath)) fs.copyFileSync(sourcePath, fixtureSource);
    else fs.writeFileSync(fixtureSource, 'self-test dependency placeholder: ' + relative + '\n');
    fs.copyFileSync(fixtureSource, fixtureStaged);
  });
  copyFixtureFile(ROOT, root, UI_REVIEW_PATH);
  fs.writeFileSync(path.join(staged, publicSurface.CANDIDATE_MARKER_PATH), publicSurface.CANDIDATE_MARKER_TEXT);
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
        mode: 'candidate',
        skipChildChecks: true,
        skipPublicSurface: true,
        afterPrecheck: afterPrecheck ? function () { afterPrecheck(fixture); } : null,
      });
    }, undefined, id + ' unexpectedly passed');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
}

function runSelfTest() {
  const approvalBindingCases = runApprovalCommitBindingSelfTest();
  const fixture = makeSelfTestFixture();
  try {
    assert.throws(() => verifyFinalStagedIntegrity({
      sourceRoot: fixture.root,
      stagedRoot: fixture.staged,
      skipChildChecks: true,
      skipPublicSurface: true,
    }), /explicit candidate or release mode/);
    assert.equal(verifyFinalStagedIntegrity({
      sourceRoot: fixture.root,
      stagedRoot: fixture.staged,
      mode: 'candidate',
      skipChildChecks: true,
      skipPublicSurface: true,
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
  assertMutationRejected('post-check foundation runtime tamper', function () {}, function (value) {
    fs.appendFileSync(path.join(value.staged, 'js/gaia-utils.js'), '\n// tampered after earlier checks\n');
  });
  assertMutationRejected('post-check UI review hash drift', function () {}, function (value) {
    fs.appendFileSync(path.join(value.root, UI_REVIEW_PATH), '\n');
  });
  assertMutationRejected('UI review leaf symlink', function (value) {
    const target = path.join(value.root, 'repinned-ui-review.json');
    fs.copyFileSync(path.join(value.root, UI_REVIEW_PATH), target);
    fs.unlinkSync(path.join(value.root, UI_REVIEW_PATH));
    fs.symlinkSync(target, path.join(value.root, UI_REVIEW_PATH));
  });
  assertMutationRejected('UI review ancestor symlink', function (value) {
    const reviewsPath = path.join(value.root, path.dirname(UI_REVIEW_PATH));
    const externalReviews = path.join(value.root, 'external-ui-reviews');
    fs.renameSync(reviewsPath, externalReviews);
    fs.symlinkSync(path.relative(path.dirname(reviewsPath), externalReviews), reviewsPath, 'dir');
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
    const reviewsPath = path.join(value.root, path.dirname(approvalPolicy.APPROVAL_PATH));
    fs.renameSync(reviewsPath, externalReviews);
    fs.writeFileSync(path.join(externalReviews, path.basename(approvalPolicy.APPROVAL_PATH)), '{}\n');
    fs.writeFileSync(path.join(externalReviews, path.basename(approvalPolicy.SIGNATURE_BUNDLE_PATH)), '{}\n');
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

  const cleanupFixture = makeSelfTestFixture();
  try {
    fs.appendFileSync(path.join(cleanupFixture.staged, notices.NOTICE_PATH), '\ninvalid staged bytes\n');
    assert.throws(() => verifyFinalStagedIntegrityWithCleanup({
      sourceRoot: cleanupFixture.root,
      stagedRoot: cleanupFixture.staged,
      mode: 'candidate',
      skipChildChecks: true,
      skipPublicSurface: true,
    }), undefined, 'failed final verification must throw');
    assert.equal(fs.existsSync(cleanupFixture.staged), false, 'failed final verification must remove staged output');
  } finally {
    fs.rmSync(cleanupFixture.root, { recursive: true, force: true });
  }

  const postChildCt45Fixture = makeSelfTestFixture();
  let childChecksCompleted = false;
  try {
    assert.throws(() => verifyFinalStagedIntegrityWithCleanup({
      sourceRoot: postChildCt45Fixture.root,
      stagedRoot: postChildCt45Fixture.staged,
      mode: 'candidate',
      skipPublicSurface: true,
      childCheckRunner: function () { childChecksCompleted = true; },
      afterPrecheck: function () {
        assert.equal(childChecksCompleted, true, 'CT-45 mutation must occur after child checks');
        fs.appendFileSync(path.join(postChildCt45Fixture.staged, 'assets/globe/runtime/earth-night.jpg'),
          Buffer.from('post-child-check mutation'));
      },
    }), /final staged CT-45 runtime projection drift/, 'post-child CT-45 mutation must fail');
    assert.equal(childChecksCompleted, true, 'child checker hook must run before the CT-45 mutation');
    assert.equal(fs.existsSync(postChildCt45Fixture.staged), false,
      'post-child CT-45 mutation failure must remove staged output');
  } finally {
    fs.rmSync(postChildCt45Fixture.root, { recursive: true, force: true });
  }

  const pairedRepinFixture = makeSelfTestFixture();
  let pairedChildChecksCompleted = false;
  try {
    assert.throws(() => verifyFinalStagedIntegrityWithCleanup({
      sourceRoot: pairedRepinFixture.root,
      stagedRoot: pairedRepinFixture.staged,
      mode: 'candidate',
      skipPublicSurface: true,
      childCheckRunner: function () { pairedChildChecksCompleted = true; },
      afterPrecheck: function () {
        assert.equal(pairedChildChecksCompleted, true, 'paired mutation must occur after child checks');
        const relative = 'js/gaia-utils.js';
        const suffix = Buffer.from('\n// adversarial paired post-child mutation\n');
        fs.appendFileSync(path.join(pairedRepinFixture.root, relative), suffix);
        fs.appendFileSync(path.join(pairedRepinFixture.staged, relative), suffix);
        const reviewPath = path.join(pairedRepinFixture.root, UI_REVIEW_PATH);
        const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
        review.reviewed_file_pins.find(entry => entry.path === relative).sha256 =
          approvalPolicy.sha256(fs.readFileSync(path.join(pairedRepinFixture.root, relative)));
        fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2) + '\n');
      },
    }), /CT-42 UI review attestation SHA-256 drift/,
    'paired source/staged runtime mutation plus review repin must fail');
    assert.equal(pairedChildChecksCompleted, true, 'child checker hook must precede paired repin mutation');
    assert.equal(fs.existsSync(pairedRepinFixture.staged), false,
      'paired repin failure must remove staged output');
  } finally {
    fs.rmSync(pairedRepinFixture.root, { recursive: true, force: true });
  }
  const publicFixture = makePublicSurfaceSelfTestFixture();
  try {
    assert.equal(verifyFinalStagedIntegrity({
      sourceRoot: publicFixture.root,
      stagedRoot: publicFixture.staged,
      mode: 'candidate',
      skipChildChecks: true,
      expectedVendorSha256: publicSurface.inspectRegular(publicFixture.root, 'js/vendor/globe.gl.js').sha256,
    }).status, 'pass');
    assert.throws(function () {
      verifyFinalStagedIntegrity({
        sourceRoot: publicFixture.root,
        stagedRoot: publicFixture.staged,
        mode: 'candidate',
        skipChildChecks: true,
        expectedVendorSha256: publicSurface.inspectRegular(publicFixture.root, 'js/vendor/globe.gl.js').sha256,
        afterPrecheck: function () {
          const leaked = path.join(publicFixture.staged, 'data/climate/fixtures/internal-review.json');
          fs.mkdirSync(path.dirname(leaked), { recursive: true });
          fs.writeFileSync(leaked, '{}\n');
        },
      });
    }, /public surface mismatch/, 'post-check unexpected public file must fail');
  } finally {
    fs.rmSync(publicFixture.root, { recursive: true, force: true });
  }
  process.stdout.write('Final staged production integrity self-test: PASS (18 fail-closed ' +
    'filesystem/tamper/cleanup/public-surface/mode cases; ' + approvalBindingCases +
    ' scoped approval commit-binding cases; post-child CT-45 mutation rejected and cleaned)\n');
}

function runCli(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') {
    runSelfTest();
    return;
  }
  if (argv.length !== 2 || argv[0] !== '--staged') {
    throw new Error('usage: node tools/check-staged-production-integrity.js --staged <directory> | --self-test');
  }
  const mode = process.env.ELU_VERIFIED_DEPLOY_MODE;
  if (!['candidate', 'release'].includes(mode)) {
    throw new Error('ELU_VERIFIED_DEPLOY_MODE must explicitly be candidate or release');
  }
  const stagedRoot = resolveStagedRoot(ROOT, argv[1]);
  const report = verifyFinalStagedIntegrityWithCleanup({ sourceRoot: ROOT, stagedRoot, mode });
  process.stdout.write('Final staged production integrity: PASS (' + report.pinned_file_count +
    ' pinned notice/trust files, ' + report.public_file_count +
    ' exact public files, ' + report.ct45_rehash_count +
    ' final CT-45 reviewed runtime rehashes, footer parity, approval boundary)\n');
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
  APPROVAL_REVIEWED_PATHS,
  FINAL_CT45_REHASH_PATHS,
  inspectEntry,
  resolveStagedRoot,
  verifyCt45RuntimeBytes,
  verifyFinalStagedIntegrity,
};
