'use strict';

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { stable, validateJsonSchema } = require('./json-schema-lite');

const SCHEMA_PATH = 'data/climate/schemas/reviewed-runtime-rollback-proof.schema.json';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function calculationHash(proof) {
  const copy = structuredClone(proof);
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function isSafeRelative(relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\')) return false;
  const normalized = path.posix.normalize(relative);
  return normalized === relative && normalized !== '..' && !normalized.startsWith('../') && !path.posix.isAbsolute(normalized);
}

function regularNonSymlink(root, relative) {
  if (!isSafeRelative(relative)) return false;
  try {
    const rootStat = fs.lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return false;
    let current = root;
    const parts = relative.split('/');
    for (let index = 0; index < parts.length; index += 1) {
      current = path.join(current, parts[index]);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return false;
      if (index < parts.length - 1 && !stat.isDirectory()) return false;
      if (index === parts.length - 1 && !stat.isFile()) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function gitBaselineReader(root, commit, relative) {
  const result = childProcess.spawnSync('git', ['show', `${commit}:${relative}`], {
    cwd: root,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`baseline cannot read ${relative}`);
  return result.stdout;
}

function canonicalBase64(text) {
  if (typeof text !== 'string' || !text.endsWith('\n')) return null;
  const encoded = text.replace(/\s/g, '');
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const decoded = Buffer.from(encoded, 'base64');
  if (decoded.toString('base64') !== encoded) return null;
  const wrapped = `${encoded.match(/.{1,76}/g).join('\n')}\n`;
  return wrapped === text ? { decoded, encoded } : null;
}

function add(errors, code, detail) {
  errors.push({ code, detail });
}

function validReviewIdentity(value, allowFixtureIdentities = false) {
  return typeof value === 'string' && value.trim() === value && value.length >= 5 &&
    (allowFixtureIdentities || !/(?:^|[\s@._-])(fake|self|invented|unknown|example|placeholder|test|fixture|tbd|todo)(?:$|[\s@._-])/i.test(value));
}

function rehearsalFiles(root, current = root, found = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join('/');
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) found.push(`symlink:${relative}`);
    else if (stat.isDirectory()) rehearsalFiles(root, absolute, found);
    else if (stat.isFile() && relative !== '.rollback.patch') found.push(relative);
  }
  return found.sort();
}

function validateReviewedRollbackProof(root, proof, options = {}) {
  const errors = [];
  let schema;
  try {
    schema = options.schema || JSON.parse(fs.readFileSync(path.join(root, SCHEMA_PATH), 'utf8'));
    validateJsonSchema(proof, schema).forEach(detail => add(errors, 'rollback_schema_invalid', detail));
  } catch (error) {
    add(errors, 'rollback_schema_unavailable', error.message);
  }

  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
    return { pass: false, errors, rehearsal: null };
  }
  if (proof.calculation_hash !== calculationHash(proof)) add(errors, 'rollback_calculation_hash_mismatch', 'Proof hash is not the canonical calculation.');
  if (proof.review?.builder_id === proof.review?.reviewer_id) add(errors, 'rollback_self_review', 'Builder and reviewer must be independent.');
  if (!validReviewIdentity(proof.review?.builder_id, options.allowFixtureIdentities) ||
      !validReviewIdentity(proof.review?.reviewer_id, options.allowFixtureIdentities)) {
    add(errors, 'rollback_review_identity_invalid', 'Rollback builder/reviewer identities must be non-placeholder identities.');
  }

  const expectedPins = Array.isArray(options.expectedPackagePins) ? [...options.expectedPackagePins].sort((a, b) => a.path.localeCompare(b.path)) : [];
  const actualPins = Array.isArray(proof.release_package_pins) ? proof.release_package_pins : [];
  if (JSON.stringify(actualPins) !== JSON.stringify(expectedPins)) {
    add(errors, 'rollback_release_package_pin_mismatch', 'Release package pins are not the exact canonical path/hash set.');
  }

  const rollback = proof.rollback || {};
  const controls = Array.isArray(rollback.controls) ? rollback.controls : [];
  const controlPaths = controls.map(item => item && item.path);
  const changedFiles = Array.isArray(rollback.patch?.changed_files) ? rollback.patch.changed_files : [];
  if (!controlPaths.length || new Set(controlPaths).size !== controlPaths.length ||
      JSON.stringify(controlPaths) !== JSON.stringify([...controlPaths].sort()) ||
      JSON.stringify(changedFiles) !== JSON.stringify(controlPaths)) {
    add(errors, 'rollback_control_set_mismatch', 'Controls and changed files must be the same non-empty sorted unique set.');
  }

  const allowedControls = new Set(options.allowedControlPaths || []);
  if (allowedControls.size && controlPaths.some(relative => !allowedControls.has(relative))) {
    add(errors, 'rollback_control_outside_runtime', 'Rollback changes a file outside the reviewed runtime manifest.');
  }

  const baseline = rollback.baseline_commit_sha;
  const baselineReader = options.baselineReader || ((relative) => gitBaselineReader(root, baseline, relative));
  if (!options.baselineReader && /^[a-f0-9]{40}$/.test(baseline || '')) {
    const commit = childProcess.spawnSync('git', ['cat-file', '-e', `${baseline}^{commit}`], { cwd: root, encoding: 'utf8' });
    const ancestor = childProcess.spawnSync('git', ['merge-base', '--is-ancestor', baseline, 'HEAD'], { cwd: root, encoding: 'utf8' });
    if (commit.status !== 0 || ancestor.status !== 0) add(errors, 'rollback_baseline_commit_invalid', 'Baseline commit is missing or is not an ancestor of HEAD.');
  }

  for (const control of controls) {
    if (!control || !isSafeRelative(control.path) || !regularNonSymlink(root, control.path)) {
      add(errors, 'rollback_control_not_regular', String(control && control.path));
      continue;
    }
    const current = fs.readFileSync(path.join(root, control.path));
    if (sha256(current) !== control.release_sha256) add(errors, 'rollback_release_pin_mismatch', control.path);
    try {
      if (sha256(baselineReader(control.path)) !== control.rollback_sha256) add(errors, 'rollback_baseline_pin_mismatch', control.path);
    } catch (error) {
      add(errors, 'rollback_baseline_pin_mismatch', `${control.path}: ${error.message}`);
    }
  }

  const patchRelative = rollback.patch?.path;
  let patchBytes = null;
  if (!isSafeRelative(patchRelative) || !regularNonSymlink(root, patchRelative)) {
    add(errors, 'rollback_patch_not_regular', String(patchRelative));
  } else {
    const artifact = fs.readFileSync(path.join(root, patchRelative));
    if (sha256(artifact) !== rollback.patch.sha256) add(errors, 'rollback_patch_pin_mismatch', 'Encoded patch SHA-256 differs.');
    const decoded = canonicalBase64(artifact.toString('utf8'));
    if (!decoded) add(errors, 'rollback_patch_encoding_invalid', 'Patch is not canonical base64.');
    else {
      patchBytes = decoded.decoded;
      if (sha256(patchBytes) !== rollback.patch.decoded_sha256) add(errors, 'rollback_patch_decoded_pin_mismatch', 'Decoded patch SHA-256 differs.');
    }
  }

  let rehearsal = null;
  if (!errors.length && patchBytes) {
    const rehearsalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-reviewed-rollback-'));
    try {
      for (const control of controls) {
        const destination = path.join(rehearsalRoot, control.path);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(root, control.path), destination);
      }
      const patchPath = path.join(rehearsalRoot, '.rollback.patch');
      fs.writeFileSync(patchPath, patchBytes);
      const check = childProcess.spawnSync('git', ['apply', '--check', '--no-index', patchPath], { cwd: rehearsalRoot, encoding: 'utf8' });
      if (check.status !== 0) add(errors, 'rollback_patch_preflight_failed', (check.stderr || check.stdout || '').trim());
      if (!errors.length) {
        const apply = childProcess.spawnSync('git', ['apply', '--no-index', patchPath], { cwd: rehearsalRoot, encoding: 'utf8' });
        if (apply.status !== 0) add(errors, 'rollback_patch_apply_failed', (apply.stderr || apply.stdout || '').trim());
      }
      const outputHashes = {};
      if (!errors.length) {
        const actualFiles = rehearsalFiles(rehearsalRoot);
        if (JSON.stringify(actualFiles) !== JSON.stringify(controlPaths)) {
          add(errors, 'rollback_patch_file_set_mismatch', `Actual files: ${actualFiles.join(', ')}`);
        }
      }
      if (!errors.length) {
        for (const control of controls) {
          const output = fs.readFileSync(path.join(rehearsalRoot, control.path));
          outputHashes[control.path] = sha256(output);
          if (outputHashes[control.path] !== control.rollback_sha256) add(errors, 'rollback_output_pin_mismatch', control.path);
          if (control.path.endsWith('.js')) {
            const syntax = childProcess.spawnSync(process.execPath, ['--check', control.path], { cwd: rehearsalRoot, encoding: 'utf8' });
            if (syntax.status !== 0) add(errors, 'rollback_javascript_invalid', control.path);
          }
        }
      }
      if (!errors.length) rehearsal = { changed_files: controls.length, output_hashes: outputHashes };
    } finally {
      fs.rmSync(rehearsalRoot, { recursive: true, force: true });
    }
  }

  errors.sort((a, b) => a.code.localeCompare(b.code) || a.detail.localeCompare(b.detail));
  return { pass: errors.length === 0, errors, rehearsal };
}

module.exports = {
  SCHEMA_PATH,
  calculationHash,
  isSafeRelative,
  regularNonSymlink,
  sha256,
  validateReviewedRollbackProof,
};
