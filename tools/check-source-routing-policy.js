#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  REASON_CODES,
  ROUTE_IDS,
  compile,
  hashJson,
  validatePolicy,
  validateQueue,
} = require('./lib/source-routing-policy');

const ROOT = path.resolve(__dirname, '..');
const PATHS = Object.freeze({
  sourceRegistry: 'data/climate/source-registry.json',
  ct14: 'data/climate/releases/top20-primary-source-gap-queue-2026-07-15.json',
  ct15: 'data/climate/releases/climate-evidence-licensing-readiness-2026-07-15.json',
  policy: 'data/climate/releases/source-routing-policy-v2-2026-07-15.json',
  queue: 'data/climate/releases/top20-source-routing-queue-v2-2026-07-15.json',
  policySchema: 'data/climate/schemas/source-routing-policy.schema.json',
  queueSchema: 'data/climate/schemas/top20-source-routing-queue.schema.json',
  fixtures: 'data/climate/fixtures/source-routing-policy.json',
});
const EXPECTED_IMMUTABLE_SHA256 = Object.freeze({
  sourceRegistry: 'ae32cc5799a96115d1b8568250638759020ff36cb1b6d1fa6aa032f56d07634d',
  ct14: 'fb1bbc050b7ba791893b7751dd4f916ecd01885557b272cb025f8c0e4b64452d',
  ct15: '8b29a6b6eec99f49d8e0c88cce0bae4f26f03b3310151f4fb049505fc58e954a',
});
const EXPECTED_TOP20 = Object.freeze(['CHN', 'USA', 'IND', 'RUS', 'IDN', 'BRA', 'JPN', 'IRN', 'SAU', 'CAN', 'MEX', 'KOR', 'DEU', 'AUS', 'TUR', 'ZAF', 'VNM', 'PAK', 'THA', 'NGA']);
const PROHIBITED_RELEASE_FILES = Object.freeze([
  'data/climate/runtime-manifest.json',
  'data/climate/releases/reviewed-release-diff.json',
  'data/climate/releases/ct40-allow-manifest.json',
]);

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(relative) { return crypto.createHash('sha256').update(bytes(relative)).digest('hex'); }
function pin(relative) { return { path: relative, sha256: sha256(relative) }; }
function clone(value) { return structuredClone(value); }

function inputPins() {
  return {
    policy: {
      source_registry: pin(PATHS.sourceRegistry),
      ct14_immutable_snapshot: pin(PATHS.ct14),
      ct15_immutable_snapshot: pin(PATHS.ct15),
    },
    queue: {
      ct14_immutable_snapshot: pin(PATHS.ct14),
      source_routing_policy: { path: PATHS.policy, calculation_hash: null },
    },
  };
}

function compileCurrent(overrides = {}) {
  const pins = inputPins();
  return compile({
    sourceRegistry: overrides.sourceRegistry || json(PATHS.sourceRegistry),
    ct14: overrides.ct14 || json(PATHS.ct14),
    ct15: overrides.ct15 || json(PATHS.ct15),
    policyInputPins: pins.policy,
    queueInputPins: pins.queue,
  });
}

function resolvePointer(rootSchema, reference) {
  assert.ok(reference.startsWith('#/'), `unsupported schema reference ${reference}`);
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
  if (allowedTypes && !allowedTypes.includes(typeOf(value))) throw new Error(`${at} type ${typeOf(value)} is not one of ${allowedTypes.join(', ')}`);
  if (Object.hasOwn(schema, 'const')) assert.deepEqual(value, schema.const, `${at} const mismatch`);
  if (schema.enum) assert.ok(schema.enum.some(candidate => JSON.stringify(candidate) === JSON.stringify(value)), `${at} enum mismatch`);

  if (typeof value === 'string') {
    if (schema.minLength !== undefined) assert.ok(value.length >= schema.minLength, `${at} shorter than minLength`);
    if (schema.pattern) assert.match(value, new RegExp(schema.pattern), `${at} pattern mismatch`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, `${at} below minimum`);
    if (schema.maximum !== undefined) assert.ok(value <= schema.maximum, `${at} above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined) assert.ok(value.length >= schema.minItems, `${at} below minItems`);
    if (schema.maxItems !== undefined) assert.ok(value.length <= schema.maxItems, `${at} above maxItems`);
    if (schema.uniqueItems) assert.equal(new Set(value.map(item => JSON.stringify(item))).size, value.length, `${at} duplicate array values`);
    if (schema.items) value.forEach((item, index) => validateJsonSchema(item, schema.items, rootSchema, `${at}[${index}]`));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const field of schema.required || []) assert.ok(Object.hasOwn(value, field), `${at}.${field} is required`);
    const properties = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const field of Object.keys(value)) assert.ok(Object.hasOwn(properties, field), `${at}.${field} is not allowed`);
    }
    for (const [field, fieldSchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, field)) validateJsonSchema(value[field], fieldSchema, rootSchema, `${at}.${field}`);
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

function resign(document) {
  document.calculation_hash = null;
  document.calculation_hash = hashJson(document);
}

for (const [key, expected] of Object.entries(EXPECTED_IMMUTABLE_SHA256)) {
  assert.equal(sha256(PATHS[key]), expected, `${key} immutable snapshot drift`);
}

const rebuilt = compileCurrent();
const policy = json(PATHS.policy);
const queue = json(PATHS.queue);
assert.deepEqual(policy, rebuilt.policy, 'source-routing policy drift; run builder');
assert.deepEqual(queue, rebuilt.queue, 'successor source-routing queue drift; run builder');
assert.equal(Buffer.compare(bytes(PATHS.policy), Buffer.from(`${JSON.stringify(rebuilt.policy, null, 2)}\n`)), 0, 'source-routing policy byte rebuild drift');
assert.equal(Buffer.compare(bytes(PATHS.queue), Buffer.from(`${JSON.stringify(rebuilt.queue, null, 2)}\n`)), 0, 'successor queue byte rebuild drift');

validatePolicy(policy, {
  sourceRegistry: json(PATHS.sourceRegistry),
  inputPins: inputPins().policy,
});
validateQueue(queue, {
  ct14: json(PATHS.ct14),
  policy,
  inputPins: rebuilt.queue.inputs,
});
validateJsonSchema(policy, json(PATHS.policySchema), json(PATHS.policySchema));
validateJsonSchema(queue, json(PATHS.queueSchema), json(PATHS.queueSchema));

assert.deepEqual(queue.entities.map(entity => entity.iso_alpha3), EXPECTED_TOP20, 'successor queue top-20 universe drift');
assert.deepEqual(queue.entities.map(entity => entity.priority), Array.from({ length: 20 }, (_, index) => index + 1), 'successor queue priority drift');
assert.equal(policy.routes.find(item => item.route_id === ROUTE_IDS.nir).source_role, 'primary_value_source');
assert.equal(policy.routes.find(item => item.route_id === ROUTE_IDS.btr).current_gate.state, 'blocked_role_domain_mismatch');
assert.equal(policy.routes.find(item => item.route_id === ROUTE_IDS.ter).structural_sufficiency, 'never_sufficient_as_primary_value_source');
assert.ok(policy.routes.filter(item => [ROUTE_IDS.ndc, ROUTE_IDS.target].includes(item.route_id)).every(item => item.prohibited_evidence_roles.includes('official_inventory')));
assert.deepEqual(policy.reason_vocabulary.map(item => item.code), REASON_CODES);

for (const relative of ['index.html', 'js/data.js', 'js/globe.js', 'js/app.js', 'sw.js']) {
  const content = bytes(relative).toString('utf8');
  assert.ok(!content.includes(path.basename(PATHS.policy)), `${relative} must not load the source-routing policy`);
  assert.ok(!content.includes(path.basename(PATHS.queue)), `${relative} must not load the successor routing queue`);
}
PROHIBITED_RELEASE_FILES.forEach(relative => assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `${relative} must remain absent`));

let rejected = 0;
for (const mutation of json(PATHS.fixtures).mutations) {
  if (mutation.target === 'policy') {
    const changed = clone(policy);
    mutate(changed, mutation);
    if (mutation.resign !== false) resign(changed);
    assert.throws(() => validatePolicy(changed, {
      sourceRegistry: json(PATHS.sourceRegistry),
      inputPins: inputPins().policy,
    }), undefined, `policy mutation accepted: ${mutation.id}`);
  } else if (mutation.target === 'queue') {
    const changed = clone(queue);
    mutate(changed, mutation);
    if (mutation.resign !== false) resign(changed);
    assert.throws(() => validateQueue(changed, {
      ct14: json(PATHS.ct14),
      policy,
      inputPins: rebuilt.queue.inputs,
    }), undefined, `queue mutation accepted: ${mutation.id}`);
  } else if (['sourceRegistry', 'ct14', 'ct15'].includes(mutation.target)) {
    const changed = clone(json(PATHS[mutation.target]));
    mutate(changed, mutation);
    assert.throws(() => compileCurrent({ [mutation.target]: changed }), undefined, `input mutation accepted: ${mutation.id}`);
  } else {
    throw new Error(`unknown fixture target ${mutation.target}`);
  }
  rejected += 1;
}

process.stdout.write([
  'CT-16 source-routing policy: PASS (release remains blocked)',
  '  existing PRIMAP factual display and magnitude comparison: eligible and unchanged (2,060 facts)',
  '  NIR/CRT: primary only after rights, checksum, governance, and independent review',
  '  BTR: conditional explicit component only; family-level inventory authorization false',
  '  TER: corroboration-only; never sufficient as primary inventory evidence',
  '  NDC Registry: active-NDC and target-methodology routes only',
  `  successor queue: ${queue.entities.length} entities; 0 primary inventory routes satisfied; 0 release eligible`,
  `  adversarial mutations rejected after hash recomputation: ${rejected}`,
  '  new source approvals / assessed CT-40 / runtime / scoring / release authority: unchanged',
].join('\n') + '\n');
