#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  SOURCE_IDS,
  DECISION_FIELDS,
  EXPECTED_INPUT_SHA256,
  PRIMAP_SHA256,
  compile,
  validate,
  hashJson,
} = require('./lib/source-rights-review-packets');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = 'data/climate/reviews/source-rights-review-packets-2026-07-15.json';
const SCHEMA = 'data/climate/schemas/source-rights-review-packet.schema.json';
const FIXTURES = 'data/climate/fixtures/source-rights-review-packets.json';
const PATHS = Object.freeze({
  source_registry: 'data/climate/source-registry.json',
  ct15_readiness: 'data/climate/releases/climate-evidence-licensing-readiness-2026-07-15.json',
  ct16_policy: 'data/climate/releases/source-routing-policy-v2-2026-07-15.json',
  ct16_queue: 'data/climate/releases/top20-source-routing-queue-v2-2026-07-15.json',
  ct40_result: 'data/climate/reviews/ct42-ct40-release-review-result.json',
});
const PROHIBITED_RELEASE_FILES = Object.freeze([
  'data/climate/runtime-manifest.json',
  'data/climate/releases/reviewed-release-diff.json',
  'data/climate/releases/ct40-allow-manifest.json',
]);

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(relative) { return crypto.createHash('sha256').update(bytes(relative)).digest('hex'); }
function clone(value) { return structuredClone(value); }

function inputPins() {
  return Object.fromEntries(Object.entries(PATHS).map(([key, relative]) => [key, { path: relative, sha256: sha256(relative) }]));
}

function currentInput(overrides = {}) {
  return {
    sourceRegistry: overrides.sourceRegistry || json(PATHS.source_registry),
    ct15Readiness: overrides.ct15Readiness || json(PATHS.ct15_readiness),
    ct40Result: overrides.ct40Result || json(PATHS.ct40_result),
    inputPins: inputPins(),
  };
}

function resolvePointer(rootSchema, reference) {
  assert.ok(reference.startsWith('#/'), 'unsupported schema reference ' + reference);
  return reference.slice(2).split('/').reduce((node, part) => node[part.replaceAll('~1', '/').replaceAll('~0', '~')], rootSchema);
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function validateJsonSchema(value, schema, rootSchema, at = '$') {
  if (schema.$ref) return validateJsonSchema(value, resolvePointer(rootSchema, schema.$ref), rootSchema, at);
  const allowedTypes = schema.type === undefined ? null : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (allowedTypes && !allowedTypes.includes(typeOf(value))) throw new Error(at + ' type ' + typeOf(value) + ' is not one of ' + allowedTypes.join(', '));
  if (Object.hasOwn(schema, 'const')) assert.deepEqual(value, schema.const, at + ' const mismatch');
  if (schema.enum) assert.ok(schema.enum.some(candidate => JSON.stringify(candidate) === JSON.stringify(value)), at + ' enum mismatch');

  if (typeof value === 'string') {
    if (schema.minLength !== undefined) assert.ok(value.length >= schema.minLength, at + ' shorter than minLength');
    if (schema.pattern) assert.match(value, new RegExp(schema.pattern), at + ' pattern mismatch');
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems, at + ' below minItems');
    if (schema.maxItems !== undefined) assert.ok(value.length <= schema.maxItems, at + ' above maxItems');
    if (schema.uniqueItems) assert.equal(new Set(value.map(item => JSON.stringify(item))).size, value.length, at + ' contains duplicates');
    if (schema.items) value.forEach((item, index) => validateJsonSchema(item, schema.items, rootSchema, at + '[' + index + ']'));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const field of schema.required || []) assert.ok(Object.hasOwn(value, field), at + '.' + field + ' is required');
    const properties = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const field of Object.keys(value)) assert.ok(Object.hasOwn(properties, field), at + '.' + field + ' is not allowed');
    }
    for (const [field, fieldSchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, field)) validateJsonSchema(value[field], fieldSchema, rootSchema, at + '.' + field);
    }
  }
  return true;
}

function owner(target, dotted) {
  const parts = dotted.split('.');
  const key = parts.pop();
  const parent = parts.reduce((node, part) => node[Number.isInteger(Number(part)) ? Number(part) : part], target);
  return { parent, key };
}

function mutate(target, mutation) {
  const location = owner(target, mutation.path);
  if (mutation.operation === 'pop') location.parent[location.key].pop();
  else if (mutation.operation === 'push') location.parent[location.key].push(clone(mutation.value));
  else if (mutation.operation === 'delete') delete location.parent[location.key];
  else location.parent[location.key] = clone(mutation.value);
}

function resign(bundle) {
  bundle.calculation_hash = null;
  bundle.calculation_hash = hashJson(bundle);
}

for (const [key, expected] of Object.entries(EXPECTED_INPUT_SHA256)) {
  assert.equal(sha256(PATHS[key]), expected, key + ' immutable source or denial snapshot drift');
}

const input = currentInput();
const actual = json(OUTPUT);
const rebuilt = compile(input);
const schema = json(SCHEMA);

assert.deepEqual(actual, rebuilt, 'CT-17 source-rights packet drift; run builder');
assert.equal(Buffer.compare(bytes(OUTPUT), Buffer.from(JSON.stringify(rebuilt, null, 2) + '\n')), 0, 'CT-17 byte rebuild drift');
validate(actual, input);
validateJsonSchema(actual, schema, schema);
assert.deepEqual(actual.packets.map(packet => packet.source_registry_id), SOURCE_IDS, 'five-source coverage drift');
assert.deepEqual(actual.required_decision_fields, DECISION_FIELDS, 'authorized-reviewer decision field coverage drift');
assert.equal(actual.packets[0].exact_scope.artifact_sha256, PRIMAP_SHA256, 'exact PRIMAP pin drift');
assert.ok(actual.packets.every(packet => packet.status === 'requires_authorized_review'), 'packet claimed reviewed status');
assert.ok(actual.packets.every(packet => packet.blank_decision_record.decision_id === null && packet.blank_decision_record.reviewer_id === null), 'decision or reviewer identity invented');
assert.ok(actual.packets.every(packet => Object.values(packet.blank_decision_record).every(value => typeof value !== 'boolean' || value === false)), 'approval boolean enabled');
PROHIBITED_RELEASE_FILES.forEach(relative => assert.equal(fs.existsSync(path.join(ROOT, relative)), false, relative + ' must remain absent'));
for (const relative of ['index.html', 'gaia.html', 'js/data.js', 'js/globe.js', 'js/app.js', 'sw.js']) {
  if (!fs.existsSync(path.join(ROOT, relative))) continue;
  assert.ok(!bytes(relative).toString('utf8').includes(path.basename(OUTPUT)), relative + ' must not load CT-17 evidence packets');
}

let rejected = 0;
for (const mutation of json(FIXTURES).mutations) {
  if (mutation.target === 'bundle') {
    const changed = clone(actual);
    mutate(changed, mutation);
    resign(changed);
    assert.throws(() => {
      validateJsonSchema(changed, schema, schema);
      validate(changed, input);
    }, undefined, 'bundle mutation accepted: ' + mutation.id);
  } else if (mutation.target === 'sourceRegistry') {
    const changed = clone(input.sourceRegistry);
    mutate(changed, mutation);
    assert.throws(() => compile(currentInput({ sourceRegistry: changed })), undefined, 'source-registry mutation accepted: ' + mutation.id);
  } else if (mutation.target === 'ct40Result') {
    const changed = clone(input.ct40Result);
    mutate(changed, mutation);
    assert.throws(() => compile(currentInput({ ct40Result: changed })), undefined, 'CT-40 mutation accepted: ' + mutation.id);
  } else if (mutation.target === 'ct15Readiness') {
    const changed = clone(input.ct15Readiness);
    mutate(changed, mutation);
    assert.throws(() => compile(currentInput({ ct15Readiness: changed })), undefined, 'CT-15 contract mutation accepted: ' + mutation.id);
  } else {
    throw new Error('unknown fixture target ' + mutation.target);
  }
  rejected += 1;
}

process.stdout.write([
  'CT-17 source-rights review packets: PASS (requires authorized review)',
  '  five source packets: PRIMAP v2.6.1, NDC Registry, NIR/CRT, BTR/CTF, TER findings',
  '  official evidence and retrieval dates recorded; interpretations separated as reviewer questions',
  '  decision IDs / reviewer IDs: null; all approval booleans: false',
  '  source registry / CT-40 DENY / release / runtime / public UI: unchanged',
  '  adversarial mutations rejected after hash recomputation: ' + rejected,
].join('\n') + '\n');
