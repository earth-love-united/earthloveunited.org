'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CONTROL_FILES = Object.freeze([
  'index.html',
  'css/globe-system.css',
  'js/data.js',
  'js/globe.js',
  'sw.js',
]);

const PROHIBITED_OUTPUTS = Object.freeze([
  'data/climate/runtime-manifest.json',
  'data/climate/releases/reviewed-release-diff.json',
  'data/climate/releases/ct40-allow-manifest.json',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function calculationHash(value) {
  const copy = structuredClone(value);
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function read(root, relative) {
  return fs.readFileSync(path.join(root, relative));
}

function readJson(root, relative) {
  return JSON.parse(read(root, relative));
}

function normalizeFiles(files) {
  return [...files].sort();
}

function assertExactFileSet(actual) {
  assert.deepEqual(normalizeFiles(actual), normalizeFiles(CONTROL_FILES), 'rollback control-file set drift');
}

function controlByPath(proof) {
  return new Map(proof.rollback.controls.map(control => [control.path, control]));
}

function validateProofDocument(root, proof, options = {}) {
  assert.equal(proof.schema_version, '1.0.0');
  assert.equal(proof.proof_id, 'ct-42-runtime-rollback-rehearsal-2026-07-15');
  assert.equal(proof.status, 'rehearsed_not_reviewed');
  assert.equal(proof.release_authority, false);
  assert.equal(proof.deploy_authority, false);
  assert.deepEqual(proof.review, {
    status: 'not_reviewed',
    builder_id: 'ct-42-runtime-rollback-builder',
    reviewer_id: null,
    reviewed_at: null,
    independent_review_required: true,
  });
  assert.equal(proof.calculation_hash, calculationHash(proof), 'rollback proof calculation hash drift');
  if (options.expectedCalculationHash) {
    assert.equal(proof.calculation_hash, options.expectedCalculationHash, 'rollback proof is not the independently pinned artifact');
  }

  assert.equal(proof.candidate.builder_commit, '793eade295ae3fa787749e4d6ee112cf374a7634');
  assert.equal(proof.candidate.review_chain_head, '9089b1f34cad985464c6d77f486b05f415496586');
  assert.equal(proof.candidate.production_control_head, '225873f6a78889ef9395b0862e30ecf759c9608f');
  assert.equal(proof.candidate.candidate_id, 'ct-42-factual-runtime-candidate-2026-07-15');
  assert.equal(proof.candidate.decision, 'deny');
  assert.equal(proof.candidate.release_eligible, false);
  assert.equal(proof.candidate.production_runtime_release, false);

  assert.equal(proof.rollback.strategy, 'candidate_to_fail_closed_baseline');
  assert.equal(proof.rollback.baseline_commit, '4f94b218c460d2d452dc3fd1354b9e1c3ddc25cc');
  assert.equal(proof.rollback.cache_name, 'elu-v28-ct42-rollback');
  assert.equal(proof.rollback.service_worker_registration, '/sw.js?v=28-ct42-rollback');
  assert.equal(proof.rollback.workspace_mutation, false);
  assert.equal(proof.rollback.patch.path, 'data/climate/operations/ct42-runtime-rollback.patch.b64');
  assert.equal(proof.rollback.patch.encoding, 'base64');
  assertExactFileSet(proof.rollback.patch.changed_files);
  assertExactFileSet(proof.rollback.controls.map(control => control.path));
  assert.deepEqual(proof.prohibited_outputs, PROHIBITED_OUTPUTS);

  const manifest = readJson(root, proof.candidate.candidate_manifest.path);
  assert.equal(sha256(read(root, proof.candidate.candidate_manifest.path)), proof.candidate.candidate_manifest.sha256);
  assert.equal(manifest.candidate_id, proof.candidate.candidate_id);
  assert.equal(manifest.review_status, 'not_reviewed');
  assert.equal(manifest.decision, 'deny');
  assert.equal(manifest.release_eligible, false);
  assert.equal(manifest.production_runtime_release, false);

  const runtime = readJson(root, proof.candidate.runtime_data.path);
  assert.equal(sha256(read(root, proof.candidate.runtime_data.path)), proof.candidate.runtime_data.sha256);
  assert.equal(runtime.candidate_id, proof.candidate.candidate_id);
  assert.equal(runtime.review_status, 'not_reviewed');
  assert.equal(runtime.production_runtime_release, false);

  const ct40 = readJson(root, proof.candidate.ct40_result.path);
  assert.equal(sha256(read(root, proof.candidate.ct40_result.path)), proof.candidate.ct40_result.sha256);
  assert.equal(ct40.decision, 'deny');
  assert.equal(ct40.eligible, false);
  assert.equal(ct40.release_authority, false);
  assert.deepEqual(ct40.prohibited_outputs_absent, PROHIBITED_OUTPUTS);

  const patchArtifactBytes = options.patchBytes || read(root, proof.rollback.patch.path);
  assert.equal(sha256(patchArtifactBytes), proof.rollback.patch.sha256, 'rollback patch artifact hash drift');
  if (options.expectedPatchSha256) {
    assert.equal(proof.rollback.patch.sha256, options.expectedPatchSha256, 'rollback patch is not the independently pinned artifact');
  }
  const patchArtifactText = patchArtifactBytes.toString('utf8');
  const encodedPatch = patchArtifactText.replace(/\s/g, '');
  assert.match(encodedPatch, /^[A-Za-z0-9+/]+={0,2}$/, 'rollback patch is not base64');
  const canonicalArtifact = `${encodedPatch.match(/.{1,76}/g).join('\n')}\n`;
  assert.equal(patchArtifactText, canonicalArtifact, 'rollback patch artifact wrapping drift');
  const patchBytes = Buffer.from(encodedPatch, 'base64');
  assert.equal(patchBytes.toString('base64'), encodedPatch, 'rollback patch base64 round-trip drift');
  assert.equal(sha256(patchBytes), proof.rollback.patch.decoded_sha256, 'decoded rollback patch hash drift');

  const controls = controlByPath(proof);
  for (const relative of CONTROL_FILES) {
    const control = controls.get(relative);
    assert.ok(control, `missing rollback control ${relative}`);
    const bytes = options.sourceOverrides?.[relative] || read(root, relative);
    assert.equal(sha256(bytes), control.candidate_sha256, `${relative} candidate pin drift`);
    assert.match(control.rollback_sha256, /^[a-f0-9]{64}$/);
  }

  for (const relative of PROHIBITED_OUTPUTS) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, `${relative} must remain absent before rollback rehearsal`);
  }

  return { patchBytes, controls };
}

function writeSourceTree(root, sourceRoot, controls, sourceOverrides = {}) {
  for (const relative of CONTROL_FILES) {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, sourceOverrides[relative] || read(sourceRoot, relative));
    assert.equal(sha256(fs.readFileSync(destination)), controls.get(relative).candidate_sha256, `${relative} staged candidate drift`);
  }
}

function applyPatch(rehearsalRoot, patchBytes) {
  const patchPath = path.join(rehearsalRoot, '.ct42-rollback.patch');
  fs.writeFileSync(patchPath, patchBytes);
  const check = childProcess.spawnSync('git', ['apply', '--check', '--no-index', patchPath], {
    cwd: rehearsalRoot,
    encoding: 'utf8',
  });
  assert.equal(check.status, 0, `rollback patch preflight failed: ${(check.stderr || check.stdout || '').trim()}`);
  const apply = childProcess.spawnSync('git', ['apply', '--no-index', patchPath], {
    cwd: rehearsalRoot,
    encoding: 'utf8',
  });
  assert.equal(apply.status, 0, `rollback patch application failed: ${(apply.stderr || apply.stdout || '').trim()}`);
  fs.rmSync(patchPath);
}

function validateRollbackState(rehearsalRoot, proof) {
  const controls = controlByPath(proof);
  for (const relative of CONTROL_FILES) {
    assert.equal(
      sha256(read(rehearsalRoot, relative)),
      controls.get(relative).rollback_sha256,
      `${relative} rollback output drift`,
    );
  }

  const index = read(rehearsalRoot, 'index.html').toString('utf8');
  const data = read(rehearsalRoot, 'js/data.js').toString('utf8');
  const globe = read(rehearsalRoot, 'js/globe.js').toString('utf8');
  const css = read(rehearsalRoot, 'css/globe-system.css').toString('utf8');
  const sw = read(rehearsalRoot, 'sw.js').toString('utf8');

  ['js/data.js', 'js/globe.js', 'sw.js'].forEach(relative => {
    const syntax = childProcess.spawnSync(process.execPath, ['--check', relative], {
      cwd: rehearsalRoot,
      encoding: 'utf8',
    });
    assert.equal(syntax.status, 0, `${relative} rollback syntax failed: ${(syntax.stderr || syntax.stdout || '').trim()}`);
  });

  assert.ok(!data.includes('country-factual-candidate.json'), 'candidate runtime data pointer survived rollback');
  assert.ok(!data.includes('climateCandidate'), 'candidate runtime state survived rollback');
  assert.ok(!globe.includes('Candidate preview'), 'candidate globe presentation survived rollback');
  assert.ok(!globe.includes('getClimateCountry') && !globe.includes('getClimateRanking'), 'candidate climate adapter survived rollback');
  assert.ok(!globe.includes('elu-trajectory-point'), 'candidate factual trajectory survived rollback');
  assert.ok(globe.includes('Country facts are being re-sourced. Performance is withheld until reviewed evidence is available.'), 'fail-closed country card copy missing after rollback');
  assert.ok(!globe.includes('\n        this.selectDefaultCountry();'), 'rollback opens a country dialog without a user action');
  assert.ok(globe.includes("wrap.setAttribute('role', 'dialog')") && globe.includes("wrap.setAttribute('aria-modal', 'true')"), 'rollback lost modal dialog semantics');
  assert.ok(globe.includes('node.getClientRects().length > 0') && globe.includes("style.visibility !== 'hidden'"), 'rollback lost the responsive focus trap');
  assert.ok(globe.includes('restoreHeadingFocus') && globe.includes("heading.focus({ preventScroll: true })"), 'rollback lost navigation focus restoration');
  assert.ok(globe.includes("tt.setAttribute('aria-hidden', 'true')") && globe.includes('this._countryOpener.focus()'), 'rollback lost close/focus restoration semantics');
  assert.ok(!css.includes('.elu-rank-dot.is-magnitude'), 'candidate magnitude styling survived rollback');
  assert.ok(!css.includes('.tt-candidate'), 'candidate disclosure styling survived rollback');
  assert.ok(css.includes('#hex-country-tooltip .tt-close { min-width:44px; min-height:44px; }'), 'rollback regressed close target size');
  assert.ok(css.includes("content: 'A–Z';"), 'rollback mobile rail no longer identifies alphabetical navigation');
  assert.ok(css.includes('min-height: 44px;'), 'rollback regressed minimum interactive target size');
  assert.ok(!index.includes('CT-42 candidate'), 'candidate public copy survived rollback');
  assert.ok(index.includes('https://github.com/earth-love-united/earthloveunited.org'), 'canonical source URL missing after rollback');
  assert.ok(!index.includes('https://github.com/gke0op/earthloveunited.org'), 'superseded source URL returned during rollback');
  assert.ok(index.includes('Uniform neutral surface · country evidence withheld'), 'neutral legend missing after rollback');
  assert.ok(index.includes('Target, ambition, delivery, finance, rating, and emissions claims are withheld'), 'fail-closed public copy missing after rollback');
  assert.ok(index.includes("navigator.serviceWorker.register('/sw.js?v=28-ct42-rollback'"), 'rollback service-worker registration mismatch');
  ['css/globe-system.css?v=ct42-rollback-1', 'js/data.js?v=ct42-rollback-1', 'js/globe.js?v=ct42-rollback-1'].forEach(asset => {
    assert.ok(index.includes(asset), `rollback asset cache key missing for ${asset}`);
  });
  assert.ok(sw.includes("const CACHE_NAME = 'elu-v28-ct42-rollback';"), 'rollback cache epoch mismatch');
  assert.ok(!sw.includes('/data/climate/runtime/country-factual-candidate.json'), 'candidate data remains in rollback pre-cache');
  assert.ok(sw.includes("keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))"), 'rollback cache eviction behavior missing');

  for (const relative of PROHIBITED_OUTPUTS) {
    assert.equal(fs.existsSync(path.join(rehearsalRoot, relative)), false, `${relative} appeared during rollback rehearsal`);
  }

  return Object.fromEntries(CONTROL_FILES.map(relative => [relative, sha256(read(rehearsalRoot, relative))]));
}

function rehearse(root, proof, options = {}) {
  const validated = validateProofDocument(root, proof, options);
  const rehearsalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-ct42-rollback-'));
  try {
    writeSourceTree(rehearsalRoot, root, validated.controls, options.sourceOverrides);
    applyPatch(rehearsalRoot, validated.patchBytes);
    if (options.afterApply) options.afterApply(rehearsalRoot);
    const hashes = validateRollbackState(rehearsalRoot, proof);
    return {
      proof_id: proof.proof_id,
      candidate_decision: proof.candidate.decision,
      cache_name: proof.rollback.cache_name,
      changed_files: CONTROL_FILES.length,
      output_hashes: hashes,
      prohibited_outputs_absent: PROHIBITED_OUTPUTS.length,
      workspace_mutation: false,
    };
  } finally {
    fs.rmSync(rehearsalRoot, { recursive: true, force: true });
  }
}

module.exports = {
  CONTROL_FILES,
  PROHIBITED_OUTPUTS,
  calculationHash,
  rehearse,
  sha256,
  stable,
  validateProofDocument,
  validateRollbackState,
};
