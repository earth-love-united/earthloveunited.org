#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'js/country-ranking-compiler.js');
const fixturePath = path.join(root, 'data/climate/fixtures/country-ranking.json');
const schemaPath = path.join(root, 'data/climate/schemas/ranking-release.schema.json');
const errors = [];
const contracts = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const context = {
  window: {},
  MODULE_CONTRACTS: { register: (name, contract) => contracts.push({ name, contract }) },
  hasModule: name => name === 'MODULE_CONTRACTS',
  safeCall: (name, method, ...args) => context[name][method](...args),
  Set,
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context, { filename: sourcePath });
const api = context.window.COUNTRY_RANKING_COMPILER;
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const options = fixture.release_metadata.valid;

assert(api && typeof api.compile === 'function', 'compiler must expose window.COUNTRY_RANKING_COMPILER.compile');
assert(contracts.length === 1 && contracts[0].name === 'COUNTRY_RANKING_COMPILER', 'module contract must register exactly once');
assert(fixture?._meta?.fictional_entities === true, 'fixtures must be explicitly fictional');
assert(schema?.$schema === 'https://json-schema.org/draft/2020-12/schema', 'release schema must use JSON Schema 2020-12');
assert(schema?.properties?.composite_score_used?.const === false, 'schema must prohibit composite-score use');
assert(schema?.properties?.project_data_used?.const === false, 'schema must prohibit project-data use');
const schemaReasonCodes = schema?.$defs?.unrankedRow?.properties?.reason_codes?.items?.enum || [];
assert(JSON.stringify(schemaReasonCodes) === JSON.stringify(api.REASON_CODES), 'schema and compiler reason vocabularies must match exactly');

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
}

function expectedCalculationHash(release) {
  const copy = Object.assign({}, release);
  delete copy.calculation_hash;
  return crypto.createHash('sha256').update(canonicalJson(copy), 'utf8').digest('hex');
}

const emissions = api.compile(fixture.records, fixture.selections.emissions_2024, options);
const expectedEmissions = fixture.expected.emissions;
assert(emissions.disclosure.mapped_count === expectedEmissions.mapped_count, 'emissions mapped denominator mismatch');
assert(emissions.disclosure.eligible_count === expectedEmissions.eligible_count, 'emissions eligible denominator mismatch');
assert(JSON.stringify(emissions.ranked.map(row => row.country_id)) === JSON.stringify(expectedEmissions.ranked_country_ids), 'emissions ranked order mismatch');
assert(JSON.stringify(emissions.ranked.map(row => row.ordinal)) === JSON.stringify(expectedEmissions.ordinals), 'competition ranking must be 1,2,2,4');
assert(emissions.unranked.numbered === false, 'unranked group must be unnumbered');
assert(emissions.unranked.entries.every(row => row.ordinal === null), 'unranked rows must have null ordinals');
assert(emissions.composite_score_used === false, 'composite score must not be used');
assert(emissions.project_data_used === false, 'project data must not be used');
assert(emissions.calculation_hash === expectedCalculationHash(emissions), 'calculation hash must cover the canonical release payload');

const zeroRow = emissions.ranked.find(row => row.country_id === expectedEmissions.zero_country_id);
assert(zeroRow?.value === 0, 'numeric zero must remain a valid ranked value');
Object.entries(expectedEmissions.required_unranked_reasons).forEach(([countryId, reason]) => {
  const row = emissions.unranked.entries.find(entry => entry.country_id === countryId);
  assert(row?.reason_codes?.includes(reason), countryId + ' must be unranked for ' + reason);
});

const overshoot = api.compile(fixture.records, fixture.selections.overshoot_2030_unconditional, options);
const expectedOvershoot = fixture.expected.overshoot;
assert(overshoot.disclosure.mapped_count === expectedOvershoot.mapped_count, 'overshoot mapped denominator mismatch');
assert(overshoot.disclosure.eligible_count === expectedOvershoot.eligible_count, 'overshoot eligible denominator mismatch');
assert(JSON.stringify(overshoot.ranked.map(row => row.country_id)) === JSON.stringify(expectedOvershoot.ranked_country_ids), 'overshoot ranked order mismatch');
assert(JSON.stringify(overshoot.ranked.map(row => row.value)) === JSON.stringify(expectedOvershoot.values), 'overshoot values mismatch');
assert(JSON.stringify(overshoot.ranked.map(row => row.ordinal)) === JSON.stringify(expectedOvershoot.ordinals), 'overshoot ordinals mismatch');
assert(overshoot.ranked.every(row => row.delivery_inferred === false), 'gap sign must never infer delivery');

const majorEmissions = emissions.ranked.find(row => row.country_id === expectedOvershoot.major_no_target);
const majorOvershoot = overshoot.unranked.entries.find(row => row.country_id === expectedOvershoot.major_no_target);
assert(majorEmissions?.ordinal === 1, 'major emitter without target must remain ranked by emissions');
assert(majorOvershoot?.ordinal === null, 'lens switch must clear the major emitter ordinal');
assert(majorOvershoot?.reason_codes?.includes('ranking_target_not_comparable'), 'major emitter must state why overshoot is unavailable');

const repeat = api.compile(fixture.records, fixture.selections.emissions_2024, options);
assert(JSON.stringify(repeat) === JSON.stringify(emissions), 'same input and caller metadata must compile byte-identically');
const reversed = api.compile(fixture.records.slice().reverse(), fixture.selections.emissions_2024, options);
assert(JSON.stringify(reversed) === JSON.stringify(emissions), 'input record order must not affect release bytes');
const changedMetadata = api.compile(fixture.records, fixture.selections.emissions_2024, {
  release_id: 'fictional-release-2',
  compiled_at: '2026-07-16T00:00:00Z',
  input_hash: 'b'.repeat(64),
});
assert(changedMetadata.compiled_at === '2026-07-16T00:00:00Z' && changedMetadata.input_hash === 'b'.repeat(64), 'caller time/hash must pass through unchanged');
assert(changedMetadata.calculation_hash !== emissions.calculation_hash, 'caller metadata must affect calculation hash');

const withoutReview = JSON.parse(JSON.stringify(fixture.records[0]));
delete withoutReview.latest_observation.review_state;
const unreviewed = api.compile([withoutReview], fixture.selections.emissions_2024, options);
assert(unreviewed.unranked.entries[0]?.reason_codes?.includes('ranking_observation_not_reviewed'), 'unreviewed observation must be blocked');

const duplicateRecords = [fixture.records[0], JSON.parse(JSON.stringify(fixture.records[0]))];
let duplicateRejected = false;
try {
  api.compile(duplicateRecords, fixture.selections.emissions_2024, options);
} catch (error) {
  duplicateRejected = /duplicate mapped country_id/.test(error.message);
}
assert(duplicateRejected, 'duplicate mapped country IDs must be rejected');

const changedProjects = JSON.parse(JSON.stringify(fixture.records));
changedProjects[0].projects.count = 0;
const projectVariant = api.compile(changedProjects, fixture.selections.emissions_2024, options);
assert(JSON.stringify(projectVariant) === JSON.stringify(emissions), 'project data must not affect ranking output');

const invalidMetadataCases = fixture.release_metadata.invalid_cases;
invalidMetadataCases.forEach(item => {
  let rejected = false;
  try {
    api.compile(fixture.records, fixture.selections.emissions_2024, item.options);
  } catch (error) {
    rejected = error?.name === 'TypeError';
  }
  assert(rejected, item.id + ' must fail closed');
});

['metric', 'period', 'plane', 'accounting_frame', 'scope', 'unit'].forEach(key => {
  assert(JSON.stringify(emissions.disclosure[key]) === JSON.stringify(emissions.selection[key]), 'disclosure must expose selected ' + key);
});
assert(overshoot.disclosure.condition === 'unconditional' && overshoot.disclosure.target_year === 2030, 'overshoot disclosure must expose condition and target year');

if (errors.length) {
  console.error('country ranking compiler: FAIL (' + errors.length + ')');
  errors.forEach(error => console.error('  - ' + error));
  process.exit(1);
}

console.log('country ranking compiler: PASS (2 ranking releases, 13 mapped entities, 4 emissions eligible, 3 overshoot eligible, 9 incompatibility gates, 10 safety/provenance checks)');
