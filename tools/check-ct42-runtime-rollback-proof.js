#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  CONTROL_FILES,
  EXPECTED_VENDOR_SPEC,
  PROHIBITED_OUTPUTS,
  RUNTIME_DEPENDENCY_FILES,
  RUNTIME_EXCLUSIONS,
  calculationHash,
  materializeRollbackSite,
  rehearse,
  validateProofDocument,
} = require('./lib/ct42-runtime-rollback-proof');

const ROOT = path.resolve(__dirname, '..');
const PROOF_PATH = 'data/climate/reviews/ct42-candidate-rollback-rehearsal.json';
const FIXTURE_PATH = 'data/climate/fixtures/ct42-runtime-rollback-proof.json';
const EXPECTED_PROOF_CALCULATION_HASH = '76646aea263bac27cc417e0091b93c77147270f73e7a7bb90aea1afddf053bcd';
const EXPECTED_PATCH_SHA256 = 'eaec0ff608cb571f5d1f16f65f5b7ea1eb204130e5706517928f7e7a8ec5736e';
const VENDOR_PATH = EXPECTED_VENDOR_SPEC.destination;

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative)));
}

function clone(value) {
  return structuredClone(value);
}

function get(target, dotted) {
  return dotted.split('.').reduce((node, key) => node[Number.isInteger(Number(key)) ? Number(key) : key], target);
}

function set(target, dotted, value) {
  const parts = dotted.split('.');
  const key = parts.pop();
  const owner = parts.length ? get(target, parts.join('.')) : target;
  owner[key] = value;
}

function mutateBytes(bytes, mutation) {
  const text = bytes.toString('utf8');
  if (mutation.operation === 'append') return Buffer.from(text + mutation.value);
  if (mutation.operation === 'replace') {
    assert.ok(text.includes(mutation.from), `${mutation.id}: replacement anchor missing`);
    return Buffer.from(text.replace(mutation.from, mutation.value));
  }
  throw new Error(`${mutation.id}: unsupported byte mutation ${mutation.operation}`);
}

function runGit(root, args, options = {}) {
  const result = childProcess.spawnSync('git', args, {
    cwd: root,
    encoding: options.encoding || 'utf8',
  });
  if (options.allowFailure !== true) {
    assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${String(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
}

function copySnapshotFile(destinationRoot, relative) {
  const source = path.join(ROOT, relative);
  if (!fs.existsSync(source)) return false;
  const destination = path.join(destinationRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  return true;
}

function commitSnapshot(root, message) {
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-qm', message]);
  return runGit(root, ['rev-parse', 'HEAD']).stdout.trim();
}

function runSquashMergeRegression(proof, pins) {
  const holder = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-ct42-squash-regression-'));
  const root = path.join(holder, 'repository');
  fs.mkdirSync(root);
  try {
    runGit(root, ['init', '-q']);
    runGit(root, ['config', 'user.name', 'Earth Love United squash regression']);
    runGit(root, ['config', 'user.email', 'squash-regression@invalid.example']);
    fs.writeFileSync(path.join(root, 'base.txt'), 'synthetic current main\n');
    commitSnapshot(root, 'synthetic current main');
    runGit(root, ['branch', '-M', 'main']);
    runGit(root, ['checkout', '-q', '-b', 'feature']);

    const runtimePaths = new Set([
      ...CONTROL_FILES,
      ...RUNTIME_DEPENDENCY_FILES,
      proof.candidate.builder.path,
      proof.candidate.candidate_manifest.path,
      proof.candidate.runtime_data.path,
      proof.candidate.ct40_result.path,
      proof.candidate.rollback_plan.path,
    ]);
    runtimePaths.forEach(relative => copySnapshotFile(root, relative));
    const runtimeIntermediate = commitSnapshot(root, 'intermediate runtime control');
    [PROOF_PATH, proof.rollback.patch.path].forEach(relative => copySnapshotFile(root, relative));
    const proofIntermediate = commitSnapshot(root, 'intermediate rollback proof');

    runGit(root, ['checkout', '-q', 'main']);
    runGit(root, ['merge', '--squash', 'feature']);
    commitSnapshot(root, 'squashed pull request');
    runGit(root, ['branch', '-D', 'feature']);
    runGit(root, ['reflog', 'expire', '--expire=now', '--all']);
    runGit(root, ['gc', '--prune=now']);
    for (const intermediate of [runtimeIntermediate, proofIntermediate]) {
      const object = runGit(root, ['cat-file', '-e', `${intermediate}^{commit}`], { allowFailure: true });
      assert.notEqual(object.status, 0, 'squash regression retained an intermediate commit object');
    }

    const squashedProof = JSON.parse(fs.readFileSync(path.join(root, PROOF_PATH)));
    const squashPins = {
      ...pins,
      allowMissingVendor: !fs.existsSync(path.join(root, VENDOR_PATH)),
    };
    validateProofDocument(root, squashedProof, squashPins);
    const result = rehearse(root, squashedProof, squashPins);
    assert.equal(result.workspace_mutation, false);
    assert.equal(result.changed_files, 6);
    return true;
  } finally {
    fs.rmSync(holder, { recursive: true, force: true });
  }
}

const proof = readJson(PROOF_PATH);
let vendorEntryPresent = true;
try { fs.lstatSync(path.join(ROOT, VENDOR_PATH)); }
catch (error) {
  if (error?.code !== 'ENOENT') throw error;
  vendorEntryPresent = false;
}
const pins = {
  expectedCalculationHash: EXPECTED_PROOF_CALCULATION_HASH,
  expectedPatchSha256: EXPECTED_PATCH_SHA256,
  allowMissingVendor: !vendorEntryPresent,
};
validateProofDocument(ROOT, proof, pins);
for (const [label, mutate] of [
  ['runtime content tree digest drift', changed => { changed.candidate.runtime_control.sha256 = 'a'.repeat(64); }],
  ['rollback source tree digest drift', changed => { changed.rollback.source_runtime_tree_sha256 = 'b'.repeat(64); }],
  ['unexpected runtime commit topology binding', changed => { changed.candidate.runtime_control_commit = 'c'.repeat(40); }],
]) {
  const changed = clone(proof);
  mutate(changed);
  changed.calculation_hash = calculationHash(changed);
  assert.throws(() => validateProofDocument(ROOT, changed, {
    expectedPatchSha256: EXPECTED_PATCH_SHA256,
    allowMissingVendor: !vendorEntryPresent,
  }), undefined, `${label} was accepted`);
}
for (const [label, commit] of [
  ['nonexistent review-chain commit', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
  ['ancestor with stale CT-40 tree', 'd3f5818d81f877dbb7217cff38a7a00644fc09e3'],
]) {
  const changed = clone(proof);
  changed.candidate.review_chain_head = commit;
  changed.candidate.review_chain_late_bound = false;
  changed.calculation_hash = calculationHash(changed);
  assert.throws(() => validateProofDocument(ROOT, changed, {
    expectedPatchSha256: EXPECTED_PATCH_SHA256,
    allowMissingVendor: !vendorEntryPresent,
  }), undefined, `${label} was accepted`);
}
const result = rehearse(ROOT, proof, pins);
const squashMergeRegression = runSquashMergeRegression(proof, pins);
assert.equal(result.workspace_mutation, false);
assert.equal(result.changed_files, 6);
assert.equal(result.pinned_control_files, 7);
assert.equal(result.pinned_runtime_dependencies, RUNTIME_DEPENDENCY_FILES.length);
assert.equal(result.materialized_runtime_dependencies, RUNTIME_DEPENDENCY_FILES.length - (vendorEntryPresent ? 0 : 1));
assert.equal(result.runtime_dependencies_complete, vendorEntryPresent);
assert.equal(result.vendor_materialized, vendorEntryPresent);
assert.equal(result.retained_polygons, 173);
assert.equal(result.small_nation_points, 28);
assert.equal(result.runtime_exclusions_absent, RUNTIME_EXCLUSIONS.length);
assert.equal(result.prohibited_outputs_absent, PROHIBITED_OUTPUTS.length);

const materializedPath = path.join(os.tmpdir(), `elu-ct42-neutral-site-${process.pid}-${Date.now()}`);
try {
  const materialized = materializeRollbackSite(ROOT, proof, materializedPath, pins);
  assert.equal(materialized.retained_polygons, 173);
  assert.equal(materialized.small_nation_points, 28);
  assert.equal(materialized.runtime_dependencies_complete, vendorEntryPresent);
  assert.equal(materialized.browser_ready, materialized.vendor_materialized && materialized.runtime_dependencies_complete);
  assert.equal(fs.lstatSync(path.join(materializedPath, 'manifest.json')).isFile(), true, 'root manifest must be a regular materialized dependency');
  RUNTIME_EXCLUSIONS.forEach(relative => assert.equal(fs.existsSync(path.join(materializedPath, relative)), false, `${relative} leaked into temporary site`));
} finally {
  fs.rmSync(materializedPath, { recursive: true, force: true });
}

const fixture = readJson(FIXTURE_PATH);
let rejected = 0;
for (const mutation of fixture.mutations) {
  if (mutation.phase === 'proof') {
    const changed = clone(proof);
    set(changed, mutation.path, mutation.value);
    assert.throws(() => validateProofDocument(ROOT, changed, pins), undefined, `${mutation.id}: proof mutation accepted`);
  } else if (mutation.phase === 'candidate' || mutation.phase === 'dependency') {
    const originalPath = path.join(ROOT, mutation.target);
    const original = fs.existsSync(originalPath) ? fs.readFileSync(originalPath) : Buffer.alloc(0);
    const sourceOverrides = { [mutation.target]: mutateBytes(original, mutation) };
    assert.throws(() => rehearse(ROOT, proof, { ...pins, sourceOverrides }), undefined, `${mutation.id}: ${mutation.phase} mutation accepted`);
  } else if (mutation.phase === 'patch') {
    const original = fs.readFileSync(path.join(ROOT, proof.rollback.patch.path));
    assert.throws(() => rehearse(ROOT, proof, { ...pins, patchBytes: mutateBytes(original, mutation) }), undefined, `${mutation.id}: patch mutation accepted`);
  } else if (mutation.phase === 'post') {
    assert.throws(() => rehearse(ROOT, proof, {
      ...pins,
      afterApply(rehearsalRoot) {
        const destination = path.join(rehearsalRoot, mutation.target);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        if (mutation.operation === 'remove') fs.rmSync(destination);
        else if (mutation.operation === 'create') fs.writeFileSync(destination, mutation.value);
        else if (mutation.operation === 'symlink-copy') {
          const target = destination + '.exact-target';
          fs.writeFileSync(target, fs.readFileSync(destination));
          fs.rmSync(destination);
          fs.symlinkSync(path.basename(target), destination);
        } else fs.writeFileSync(destination, mutateBytes(fs.readFileSync(destination), mutation));
      },
    }), undefined, `${mutation.id}: post-rollback mutation accepted`);
  } else {
    throw new Error(`${mutation.id}: unknown phase ${mutation.phase}`);
  }
  rejected += 1;
}

PROHIBITED_OUTPUTS.forEach(relative => assert.equal(fs.existsSync(path.join(ROOT, relative)), false));
process.stdout.write([
  'CT-42 neutral runtime rollback proof: PASS',
  `  proof calculation hash: ${proof.calculation_hash}`,
  `  patch artifact sha256: ${proof.rollback.patch.sha256}`,
  `  decoded patch sha256: ${proof.rollback.patch.decoded_sha256}`,
  `  exact entity boundary: ${result.retained_polygons} + ${result.small_nation_points} = ${result.retained_polygons + result.small_nation_points}`,
  `  pinned App/runtime controls: ${result.pinned_control_files}; deterministic patch files: ${result.changed_files}`,
  `  pinned unchanged runtime dependencies: ${result.pinned_runtime_dependencies}`,
  `  materialized runtime dependencies: ${result.materialized_runtime_dependencies}; vendor materialized: ${result.vendor_materialized}`,
  `  deterministic adversarial mutations rejected: ${rejected}`,
  `  squash-merge regression with pruned intermediate commits: ${squashMergeRegression ? 'PASS' : 'FAIL'}`,
  result.runtime_dependencies_complete
    ? '  complete exact temporary browser site materialization: PASS'
    : '  static temporary site materialization: PASS; browser site remains incomplete until the canonical vendor fetch gate supplies exact globe.gl bytes',
  '  browser execution evidence: external required gate; not run or recorded by this checker',
  '  production manifest / release diff / CT-40 allow manifest: absent',
  '  release authority / deploy authority / independent review: false / false / required',
].join('\n') + '\n');
