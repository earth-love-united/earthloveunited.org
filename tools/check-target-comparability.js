#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  ENGINE_VERSION,
  REASON_CODES,
  assessTarget
} = require('./lib/target-comparability');

const ROOT = path.join(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/fixtures/target-comparability.json'), 'utf8'));
const enums = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/enums.json'), 'utf8'));
const resultSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/target-comparability-result.schema.json'), 'utf8'));

function clone(value) {
  return structuredClone(value);
}

function merge(base, patch) {
  if (patch === undefined) return clone(base);
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
  const output = base && typeof base === 'object' && !Array.isArray(base) ? clone(base) : {};
  for (const [key, value] of Object.entries(patch)) output[key] = merge(output[key], value);
  return output;
}

function scoped(value) {
  return merge(value, { scope: merge(fixture.scope, value.scope || {}) });
}

function targetTemplate(name) {
  const target = merge(fixture.base_target, { scope: fixture.scope });
  const templates = {
    base_year: {},
    bau: {
      target_id: 'target:fixture:bau-2030', target_type: 'bau', target_year: 2030,
      reduction_pct: 25, reference: null,
      bau: { scenario_id: 'fixture-bau-v1', vintage: '2025', target_year_value: { amount: 1200, unit: 'MtCO2e_AR5' }, source_fact_id: 'fact:fixture:bau-2030' }
    },
    intensity: {
      target_id: 'target:fixture:intensity-2030', target_type: 'intensity', target_year: 2030,
      reduction_pct: 30,
      reference: { year: 2005, value: { amount: 100, unit: 'MtCO2e_AR5/trillion_USD_2015' }, fact_id: 'fact:fixture:intensity-2005' },
      intensity: { denominator_metric: 'economy.gdp_real', denominator_unit: 'trillion_USD_2015', target_year_denominator_fact_id: 'fact:fixture:gdp-2030' }
    },
    fixed_level: {
      target_id: 'target:fixture:fixed-2035', target_type: 'fixed_level', target_year: 2035,
      reduction_pct: null, reference: null, target_value: { amount: 625, unit: 'MtCO2e_AR5' }
    },
    trajectory: {
      target_id: 'target:fixture:trajectory-2035', target_type: 'trajectory', target_year: 2035,
      reduction_pct: null, reference: null,
      trajectory: { pathway_fact_ids: ['fact:fixture:path-2025', 'fact:fixture:path-2035'] }
    },
    peaking: {
      target_id: 'target:fixture:peaking-2030', target_type: 'peaking', target_year: null,
      reduction_pct: null, reference: null, peak_year: 2030
    },
    sectoral: {
      target_id: 'target:fixture:sectoral-2030', target_type: 'sectoral', target_year: 2030,
      reduction_pct: null, reference: null, statement: 'Phase down fictional power-sector emissions.',
      scope: { accounting_frame: 'sectoral', gases: ['CO2'], sectors: ['electricity'], lulucf: 'not_applicable', gwp_convention: 'not_applicable' }
    },
    qualitative: {
      target_id: 'target:fixture:qualitative', target_type: 'qualitative', target_year: null,
      reduction_pct: null, reference: null, statement: 'Pursue low-emissions development.'
    },
    net_zero: {
      target_id: 'target:fixture:net-zero-2050', target_type: 'net_zero', target_year: 2050,
      reduction_pct: null, reference: null,
      net_zero: { residual_emissions: { amount: 50, unit: 'MtCO2e_AR5' }, removals_treatment: 'domestic removals stated separately', offsets_treatment: 'no international offsets', interim_target_ids: ['target:fixture:base-2035'] }
    }
  };
  if (!Object.hasOwn(templates, name)) throw new Error(`Unknown fixture template ${name}`);
  return merge(target, templates[name]);
}

function defaultFactNames(template) {
  return {
    base_year: ['reference'],
    bau: ['bau'],
    intensity: ['intensity_reference', 'gdp_2030'],
    trajectory: ['path_2025', 'path_2035']
  }[template] || [];
}

function buildCase(testCase) {
  const target = merge(targetTemplate(testCase.template), testCase.target_patch || {});
  const names = testCase.evidence_facts || defaultFactNames(testCase.template);
  const facts = names.map((name) => {
    if (!fixture.facts[name]) throw new Error(`${testCase.id}: unknown fact ${name}`);
    return scoped(merge(fixture.facts[name], (testCase.fact_patches && testCase.fact_patches[name]) || {}));
  });
  const evidence = merge({ licence_approved: true, facts }, testCase.evidence_patch || {});
  return { target, evidence };
}

function assertReasons(testCase, output) {
  if (testCase.expected.reasons) {
    assert.deepStrictEqual(output.reason_codes, testCase.expected.reasons, `${testCase.id}: exact reason codes`);
  }
  for (const code of testCase.expected.reasons_include || []) {
    assert(output.reason_codes.includes(code), `${testCase.id}: missing reason ${code}; got ${output.reason_codes.join(', ')}`);
  }
  for (const code of testCase.expected.reasons_exclude || []) {
    assert(!output.reason_codes.includes(code), `${testCase.id}: forbidden reason ${code}; got ${output.reason_codes.join(', ')}`);
  }
  for (const code of output.reason_codes) assert(REASON_CODES.includes(code), `${testCase.id}: non-canonical reason ${code}`);
}

function assertEndpoint(testCase, output) {
  if (testCase.expected.endpoint) {
    assert(output.normalized_endpoint, `${testCase.id}: endpoint missing`);
    assert.strictEqual(output.normalized_endpoint.value.kind, 'exact', `${testCase.id}: endpoint kind`);
    assert.strictEqual(output.normalized_endpoint.value.amount, testCase.expected.endpoint.amount, `${testCase.id}: endpoint amount`);
    assert.strictEqual(output.normalized_endpoint.value.unit, testCase.expected.endpoint.unit, `${testCase.id}: endpoint unit`);
  }
  if (testCase.expected.endpoint_range) {
    assert(output.normalized_endpoint, `${testCase.id}: endpoint missing`);
    assert.strictEqual(output.normalized_endpoint.value.kind, 'range', `${testCase.id}: endpoint kind`);
    assert.strictEqual(output.normalized_endpoint.value.lower, testCase.expected.endpoint_range.lower, `${testCase.id}: endpoint lower`);
    assert.strictEqual(output.normalized_endpoint.value.upper, testCase.expected.endpoint_range.upper, `${testCase.id}: endpoint upper`);
    assert.strictEqual(output.normalized_endpoint.value.unit, testCase.expected.endpoint_range.unit, `${testCase.id}: endpoint unit`);
  }
  if (!testCase.expected.eligible) assert.strictEqual(output.normalized_endpoint, null, `${testCase.id}: ineligible output leaked endpoint`);
}

function assertNoPerformance(value, location = 'output') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!/(delivery|performance|on[_-]?pace|off[_-]?course)/i.test(key), `${location}: forbidden performance field ${key}`);
    assertNoPerformance(child, `${location}.${key}`);
  }
}

function assertFrozenContract(output, testId) {
  const required = [...resultSchema.required].sort();
  const actual = Object.keys(output).sort();
  assert.deepStrictEqual(actual, required, `${testId}: output drifted from frozen top-level contract`);
  assert(resultSchema.properties.comparability.enum.includes(output.comparability), `${testId}: invalid comparability enum`);
  if (output.eligible) {
    assert.strictEqual(output.comparability, 'comparable', `${testId}: eligible result must be comparable`);
    assert(output.normalized_endpoint, `${testId}: eligible result requires endpoint`);
    assert.strictEqual(output.reason_codes.length, 0, `${testId}: eligible result cannot carry failure reasons`);
  }
}

assert.strictEqual(ENGINE_VERSION, fixture._meta.fixture_version, 'fixture and engine versions must match');
assert.strictEqual(REASON_CODES.length, 55, 'CT-02 canonical reason-code count changed');
assert.deepStrictEqual(REASON_CODES, enums.reason_codes, 'engine reason codes must exactly match CT-02 order and vocabulary');
assert.strictEqual(new Set(REASON_CODES).size, 55, 'reason codes must be unique');

let comparable = 0;
let deliberatelyWithheld = 0;
for (const testCase of fixture.cases) {
  const { target, evidence } = buildCase(testCase);
  const output = assessTarget(target, evidence);
  const reversed = assessTarget(clone(target), { ...clone(evidence), facts: [...clone(evidence.facts)].reverse() });

  assert.deepStrictEqual(output, reversed, `${testCase.id}: fact order changed deterministic output`);
  assert.strictEqual(output.comparability, testCase.expected.comparability, `${testCase.id}: comparability`);
  assert.strictEqual(output.eligible, testCase.expected.eligible, `${testCase.id}: eligibility`);
  assertReasons(testCase, output);
  assertEndpoint(testCase, output);
  assertNoPerformance(output);
  assertFrozenContract(output, testCase.id);
  if (testCase.expected.condition) assert.strictEqual(output.normalized_endpoint.condition, testCase.expected.condition, `${testCase.id}: condition`);
  if (output.comparability === 'comparable') comparable += 1;
  if (!output.eligible) deliberatelyWithheld += 1;
}

// Null target and explicit zero must retain different meanings.
const missing = assessTarget(null, {});
assert.strictEqual(missing.comparability, 'no_active_target_found');
assert.deepStrictEqual(missing.reason_codes, ['target_not_found']);
assert.strictEqual(missing.normalized_endpoint, null);

// Options can support internal structural diagnostics, but public defaults are gated.
const diagnosticInput = buildCase(fixture.cases.find((item) => item.id === 'licence-gate'));
const diagnostic = assessTarget(diagnosticInput.target, diagnosticInput.evidence, { requireLicence: false });
assert.strictEqual(diagnostic.comparability, 'comparable');
assert.strictEqual(diagnostic.eligible, true);

process.stdout.write([
  'CT-20 target comparability: PASS',
  `  engine version: ${ENGINE_VERSION}`,
  `  canonical reason codes: ${REASON_CODES.length}`,
  `  golden cases: ${fixture.cases.length}`,
  `  comparable endpoints: ${comparable}`,
  `  deliberately withheld/non-comparable: ${deliberatelyWithheld}`,
  '  proxy baselines / mixed scopes / performance fields: rejected'
].join('\n') + '\n');
