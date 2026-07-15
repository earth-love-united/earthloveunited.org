#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  PROHIBITED_OUTPUTS,
  rehearse,
  validateProofDocument,
} = require('./lib/ct42-runtime-rollback-proof');

const ROOT = path.resolve(__dirname, '..');
const PROOF_PATH = 'data/climate/reviews/ct42-candidate-rollback-rehearsal.json';
const FIXTURE_PATH = 'data/climate/fixtures/ct42-runtime-rollback-proof.json';
const EXPECTED_PROOF_CALCULATION_HASH = 'c66b05a3fdccb3f220c4dada1324da8a4e594faf35a6c131b8e5f1f7e85088b6';
const EXPECTED_PATCH_SHA256 = 'c0f2ae6953dc9a79197348ea4849d009787fbe3996d9f654eaeb0a7dd6e5b771';

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
assert.equal(result.changed_files, 5);
assert.equal(result.prohibited_outputs_absent, 3);

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
  'CT-42 runtime rollback proof: PASS',
  `  proof calculation hash: ${proof.calculation_hash}`,
  `  patch artifact sha256: ${proof.rollback.patch.sha256}`,
  `  decoded patch sha256: ${proof.rollback.patch.decoded_sha256}`,
  `  deterministic adversarial mutations rejected: ${rejected}`,
  '  production manifest / release diff / CT-40 allow manifest: absent',
  '  release authority / deploy authority: false',
].join('\n') + '\n');
