#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  PROHIBITED_OUTPUTS,
  RUNTIME_EXCLUSIONS,
  materializeRollbackSite,
  rehearse,
  validateProofDocument,
} = require('./lib/ct42-runtime-rollback-proof');

const ROOT = path.resolve(__dirname, '..');
const PROOF_PATH = 'data/climate/reviews/ct42-candidate-rollback-rehearsal.json';
const FIXTURE_PATH = 'data/climate/fixtures/ct42-runtime-rollback-proof.json';
const EXPECTED_PROOF_CALCULATION_HASH = 'b02156bfe0bea04611ba6d90948c5e0c9a3f3832ce2a0e60493306a043a2f7d2';
const EXPECTED_PATCH_SHA256 = '8089195ae3e00560012a5d9fa5341ceccfadfca871b40ad4c442c98fa56c01fb';

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

const proof = readJson(PROOF_PATH);
const pins = {
  expectedCalculationHash: EXPECTED_PROOF_CALCULATION_HASH,
  expectedPatchSha256: EXPECTED_PATCH_SHA256,
};
validateProofDocument(ROOT, proof, pins);
const result = rehearse(ROOT, proof, pins);
assert.equal(result.workspace_mutation, false);
assert.equal(result.changed_files, 6);
assert.equal(result.pinned_control_files, 7);
assert.equal(result.retained_polygons, 173);
assert.equal(result.small_nation_points, 28);
assert.equal(result.runtime_exclusions_absent, RUNTIME_EXCLUSIONS.length);
assert.equal(result.prohibited_outputs_absent, PROHIBITED_OUTPUTS.length);

const materializedPath = path.join(os.tmpdir(), `elu-ct42-neutral-site-${process.pid}-${Date.now()}`);
try {
  const materialized = materializeRollbackSite(ROOT, proof, materializedPath, { ...pins, requireVendor: false });
  assert.equal(materialized.retained_polygons, 173);
  assert.equal(materialized.small_nation_points, 28);
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
  } else if (mutation.phase === 'candidate') {
    const original = fs.readFileSync(path.join(ROOT, mutation.target));
    const sourceOverrides = { [mutation.target]: mutateBytes(original, mutation) };
    assert.throws(() => rehearse(ROOT, proof, { ...pins, sourceOverrides }), undefined, `${mutation.id}: candidate mutation accepted`);
  } else if (mutation.phase === 'patch') {
    const original = fs.readFileSync(path.join(ROOT, proof.rollback.patch.path));
    assert.throws(() => rehearse(ROOT, proof, { ...pins, patchBytes: mutateBytes(original, mutation) }), undefined, `${mutation.id}: patch mutation accepted`);
  } else if (mutation.phase === 'post') {
    assert.throws(() => rehearse(ROOT, proof, {
      ...pins,
      afterApply(rehearsalRoot) {
        const destination = path.join(rehearsalRoot, mutation.target);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        if (mutation.operation === 'create') fs.writeFileSync(destination, mutation.value);
        else fs.writeFileSync(destination, mutateBytes(fs.readFileSync(destination), mutation));
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
  `  deterministic adversarial mutations rejected: ${rejected}`,
  '  complete temporary browser site materialization: PASS',
  '  production manifest / release diff / CT-40 allow manifest: absent',
  '  release authority / deploy authority / independent review: false / false / required',
].join('\n') + '\n');
