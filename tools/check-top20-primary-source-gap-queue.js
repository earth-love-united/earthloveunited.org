#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compile, validate } = require('./lib/top20-primary-source-gap-queue');

const ROOT = path.resolve(__dirname, '..');
const PATHS = Object.freeze({
  runtime: 'data/climate/runtime/country-factual-candidate.json',
  audit: 'data/climate/evidence/major-emitter-ndc-source-audit.json',
  sourceRegistry: 'data/climate/source-registry.json',
  output: 'data/climate/releases/top20-primary-source-gap-queue-2026-07-15.json',
  fixtures: 'data/climate/fixtures/top20-primary-source-gap-queue.json',
});
const EXPECTED_INPUT_SHA256 = Object.freeze({
  runtime: '7f002bc18396d827179cef0a3dda5bb83c3a1538dd6beffd6e4b80c2f7583664',
  audit: 'c4764628073653bda0f3f8a14f49400a624dfb3935c36432db8754e23d2c6683',
  sourceRegistry: 'ae32cc5799a96115d1b8568250638759020ff36cb1b6d1fa6aa032f56d07634d',
});
const EXPECTED_TOP20 = Object.freeze(['CHN', 'USA', 'IND', 'RUS', 'IDN', 'BRA', 'JPN', 'IRN', 'SAU', 'CAN', 'MEX', 'KOR', 'DEU', 'AUS', 'TUR', 'ZAF', 'VNM', 'PAK', 'THA', 'NGA']);

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(relative) { return crypto.createHash('sha256').update(bytes(relative)).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function owner(target, dotted) { const parts = dotted.split('.'); const key = parts.pop(); const parent = parts.reduce((node, part) => node[Number.isInteger(Number(part)) ? Number(part) : part], target); return { parent, key }; }
function mutate(target, mutation) {
  const location = owner(target, mutation.path);
  if (mutation.operation === 'pop') location.parent[location.key].pop();
  else if (mutation.operation === 'delete') delete location.parent[location.key];
  else location.parent[location.key] = clone(mutation.value);
}
function collectKeys(value, keys = []) {
  if (Array.isArray(value)) value.forEach(item => collectKeys(item, keys));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => { keys.push(key); collectKeys(item, keys); });
  return keys;
}

const runtime = json(PATHS.runtime);
const audit = json(PATHS.audit);
const sourceRegistry = json(PATHS.sourceRegistry);
const output = json(PATHS.output);
const inputPins = Object.fromEntries(['runtime', 'audit', 'sourceRegistry'].map(key => [key, { path: PATHS[key], sha256: sha256(PATHS[key]) }]));
for (const [key, expected] of Object.entries(EXPECTED_INPUT_SHA256)) assert.equal(inputPins[key].sha256, expected, `${key} input pin drift`);
assert.deepEqual(output.inputs, inputPins, 'committed input pins drift');
const rebuilt = compile({ runtime, audit, sourceRegistry, inputPins });
assert.deepEqual(output, rebuilt, 'queue drift; run builder');
assert.equal(Buffer.compare(bytes(PATHS.output), Buffer.from(`${JSON.stringify(rebuilt, null, 2)}\n`)), 0, 'queue byte rebuild drift');
validate(output, { runtime, audit, sourceRegistry });

assert.deepEqual(output.entities.map(entity => entity.iso_alpha3), EXPECTED_TOP20, 'reviewed 2023 top-20 universe drift');
assert.deepEqual(output.entities.map(entity => entity.reviewed_2023_factual_rank), Array.from({ length: 20 }, (_, index) => index + 1));
assert.deepEqual(output.coverage, {
  ranked_entities: 20, ct11_countries_with_metadata: 4, countries_without_ct11_primary_source_audit: 16,
  official_inventory_documents_available: 0, active_ndc_metadata_entities: 3,
  legacy_indc_only_entities: 1, release_eligible_entities: 0,
});
const canonicalReasons = new Set(json('data/climate/schemas/enums.json').reason_codes);
for (const entity of output.entities) {
  entity.fail_closed_reason_codes.forEach(code => assert.ok(canonicalReasons.has(code), `${entity.country_id} unknown reason ${code}`));
  entity.document_requirements.forEach(requirement => requirement.reason_codes.forEach(code => assert.ok(canonicalReasons.has(code), `${entity.country_id} unknown document reason ${code}`)));
  Object.values(entity.field_completeness).forEach(group => group.reason_codes.forEach(code => assert.ok(canonicalReasons.has(code), `${entity.country_id} unknown field reason ${code}`)));
}
const audited = output.entities.filter(entity => entity.current_evidence_status === 'metadata_only_in_review');
assert.deepEqual(audited.map(entity => entity.iso_alpha3), ['CHN', 'IND', 'IDN', 'IRN']);
assert.ok(output.entities.every(entity => entity.document_requirements[0].evidence_status === 'source_missing'), 'official inventory evidence must remain absent');
assert.equal(output.entities.find(entity => entity.iso_alpha3 === 'IRN').document_requirements[1].evidence_status, 'legacy_indc_only');

const prohibitedKeys = new Set(['normalized_target', 'target_value', 'reduction_pct', 'reference_value', 'score_value', 'performance_status']);
for (const key of collectKeys(output)) assert.ok(!prohibitedKeys.has(key), `prohibited normalized claim key ${key}`);
for (const runtimeFile of ['index.html', 'js/data.js', 'js/globe.js', 'sw.js']) {
  assert.ok(!bytes(runtimeFile).toString().includes('top20-primary-source-gap-queue-2026-07-15.json'), `${runtimeFile} must not load the queue`);
}
const gatedSources = ['unfccc-ndc-registry-continuous-2026-07-15', 'unfccc-btr-continuous-2026-07-15', 'unfccc-nir-crt-2026-cycle', 'unfccc-ter-continuous-2026-07-15'];
for (const id of gatedSources) assert.equal(sourceRegistry.sources.find(source => source.id === id).approval.state, 'pending', `${id} approval must remain pending`);

const fixtures = json(PATHS.fixtures);
for (const mutation of fixtures.mutations) {
  const candidate = clone(output);
  mutate(candidate, mutation);
  assert.throws(() => validate(candidate, { runtime, audit, sourceRegistry }), undefined, `mutation accepted: ${mutation.id}`);
}

console.log(`CT-14 top-20 primary-source gap queue: PASS (20 entities; 4 CT-11 metadata-only; 16 audits not started; 0 official inventories; 3 active-NDC metadata; 1 legacy INDC; ${fixtures.mutations.length} adversarial mutations; release/runtime false)`);
