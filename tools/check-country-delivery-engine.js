#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { assessDelivery, EVIDENCE_REASON_CODES, ASSESSMENT_BASIS_CODES } = require('./lib/country-delivery-engine.js');

const ROOT = path.resolve(__dirname, '..');
const fixturePath = path.join(ROOT, 'data/climate/fixtures/delivery-engine.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const vocabulary = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/delivery-reason-vocabulary.json'), 'utf8'));
const resultSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/delivery-result.schema.json'), 'utf8'));

const BASE_SCOPE = {
  accounting_frame: 'economy_wide_ghg',
  gases: ['CO2', 'CH4', 'N2O'],
  gwp_convention: 'AR5 GWP100',
  sectors: ['energy', 'industry', 'agriculture', 'waste'],
  lulucf: 'excluded',
  geography: 'national_territory'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function compound(start, rate, count) {
  return Array.from({ length: count }, (_, index) => Number((start * Math.pow(1 + rate, index)).toFixed(8)));
}

function points(values, startYear, uncertaintyFraction) {
  return values.map((value, index) => ({
    fact_id: `fact:fixture.zzz.observed.${startYear + index}`,
    year: startYear + index,
    value,
    uncertainty: uncertaintyFraction
      ? {
          lower: Number((value * (1 - uncertaintyFraction)).toFixed(8)),
          upper: Number((value * (1 + uncertaintyFraction)).toFixed(8)),
          confidence: 0.95,
          method: 'fictional symmetric test interval'
        }
      : null
  }));
}

function observedSeries(name) {
  const series = {
    series_id: `series:fixture.zzz.${name}`,
    country_id: 'iso3166-1:ZZZ',
    data_role: 'observed_annual',
    evidence_plane: 'harmonized',
    state: 'available',
    metric: 'territorial_ghg_excluding_lulucf',
    unit: 'MtCO2e/yr',
    scope: clone(BASE_SCOPE),
    points: []
  };
  if (name === 'fast_decline') series.points = points(compound(200, -0.06, 10), 2015);
  else if (name === 'slow_decline') series.points = points(compound(150, -0.01, 10), 2015);
  else if (name === 'already_below_decline') series.points = points(compound(100, -0.05, 10), 2015);
  else if (name === 'already_below_rising') series.points = points(compound(50, 0.04, 10), 2015);
  else if (name === 'uncertain_decline') series.points = points(compound(200, -0.06, 10), 2015, 0.2);
  else if (name === 'zero_crossing') series.points = points([10, 8, 6, 4, 2, 0], 2019);
  else if (name === 'negative_lulucf') {
    series.metric = 'lulucf_net_emissions';
    series.scope = {
      accounting_frame: 'lulucf', gases: ['CO2'], gwp_convention: null,
      sectors: ['lulucf'], lulucf: 'included', geography: 'national_territory'
    };
    series.points = points([-10, -12, -14, -16, -18, -20], 2019);
  } else if (name === 'projection_role') {
    series.data_role = 'scenario_projection_only';
    series.points = points(compound(200, -0.06, 10), 2015);
  } else if (name === 'projection_point') {
    series.points = points(compound(200, -0.06, 10), 2015);
    series.points[5].data_role = 'scenario_projection_only';
  } else if (name === 'five_points') series.points = points(compound(150, -0.03, 5), 2020);
  else if (name === 'recent_gap') {
    series.points = points(compound(200, -0.03, 10), 2014);
    series.points.splice(7, 1);
    series.points.forEach((point, index) => { if (index >= 7) point.fact_id += '.after-gap'; });
  } else if (name === 'stale') series.points = points(compound(200, -0.06, 10), 2005);
  else if (name === 'conflicting') {
    series.points = points(compound(200, -0.06, 10), 2015);
    series.state = 'conflicting';
  } else if (name === 'reporting_optional') {
    series.points = [];
    series.state = 'reporting_optional';
  } else throw new Error(`Unknown series fixture: ${name}`);
  return series;
}

function endpoint(name, observed) {
  if (name === 'missing') return null;
  const result = {
    engine_version: '1.0.0',
    methodology_version: '0.1.0',
    target_id: `target:fixture.zzz.${name}`,
    country_id: 'iso3166-1:ZZZ',
    target_type: 'fixed_level',
    condition: 'unconditional',
    comparability: 'comparable',
    eligible: true,
    reason_codes: [],
    normalized_endpoint: { year: 2030, value: { kind: 'exact', amount: 80, unit: 'MtCO2e/yr' }, condition: 'unconditional' },
    accounting_frame: {
      accounting_frame: BASE_SCOPE.accounting_frame,
      gases: clone(BASE_SCOPE.gases),
      gwp_convention: BASE_SCOPE.gwp_convention,
      sectors: clone(BASE_SCOPE.sectors),
      lulucf: BASE_SCOPE.lulucf,
      geography: BASE_SCOPE.geography,
      article6_treatment: 'not_applicable'
    },
    uncertainty: null,
    input_fact_ids: ['fact:fixture.zzz.target'],
    lineage: {
      formula: 'fictional fixed endpoint preserved without transformation',
      formula_version: '1.0.0',
      target_source_fact_ids: ['fact:fixture.zzz.target'],
      reviewed_against_fact_ids: ['fact:fixture.zzz.target']
    },
    independent_review: { passed: true, status: 'reviewed', extractor_id: 'fixture-extractor', reviewer_id: 'fixture-reviewer', reviewed_at: '2026-07-15T00:00:00Z' }
  };
  if (name === 'negative_endpoint') result.normalized_endpoint.value.amount = -12;
  else if (name === 'range') {
    result.normalized_endpoint.value = { kind: 'range', lower: 75, upper: 85, unit: 'MtCO2e/yr' };
    result.uncertainty = { kind: 'bounded_range', lower: 75, upper: 85, unit: 'MtCO2e/yr' };
  }
  else if (name === 'negative_lulucf') {
    result.normalized_endpoint.value.amount = -30;
    result.accounting_frame = {
      accounting_frame: observed.scope.accounting_frame,
      gases: clone(observed.scope.gases),
      gwp_convention: observed.scope.gwp_convention,
      sectors: clone(observed.scope.sectors),
      lulucf: observed.scope.lulucf,
      geography: observed.scope.geography,
      article6_treatment: 'not_applicable'
    };
  } else if (name === 'expired') result.normalized_endpoint.year = 2024;
  else if (name === 'far_future') result.normalized_endpoint.year = 2040;
  else if (name === 'non_comparable') {
    result.comparability = 'non_comparable';
    result.eligible = false;
    result.normalized_endpoint = null;
    result.reason_codes = ['reference_value_missing'];
  } else if (name === 'not_reviewed') result.independent_review = { passed: false, status: 'independent_review_required', extractor_id: 'fixture-extractor', reviewer_id: null, reviewed_at: null };
  else if (name === 'invalid_range') result.normalized_endpoint.value = { kind: 'range', lower: 90, upper: 70, unit: 'MtCO2e/yr' };
  else if (name === 'scope_mismatch') result.accounting_frame.accounting_frame = 'fossil_co2';
  else if (name === 'gas_mismatch') result.accounting_frame.gases = ['CO2'];
  else if (name === 'gwp_mismatch') result.accounting_frame.gwp_convention = 'AR6 GWP100';
  else if (name === 'geography_mismatch') result.accounting_frame.geography = 'metropolitan_territory';
  else if (name === 'lulucf_mismatch') result.accounting_frame.lulucf = 'included';
  else if (name === 'unit_mismatch') result.normalized_endpoint.value.unit = 'ktCO2e/yr';
  return result;
}

function projection(name) {
  if (!name) return null;
  const result = {
    projection_id: `projection:fixture.zzz.${name}`,
    country_id: 'iso3166-1:ZZZ',
    data_role: 'scenario_projection_only',
    evidence_plane: 'independent',
    state: 'modeled',
    scenario: { name: 'Fictional current policies', vintage: 'fixture-2026' },
    scope: clone(BASE_SCOPE),
    unit: 'MtCO2e/yr',
    points: [{ year: 2030, value: 75, uncertainty: null }],
    source_fact_ids: ['fact:fixture.zzz.projection'],
    review: { status: 'reviewed', extractor_id: 'fixture-extractor', reviewer_id: 'fixture-reviewer', reviewed_at: '2026-07-15T00:00:00Z' }
  };
  if (name === 'misses') result.points[0].value = 90;
  else if (name === 'overlaps') {
    result.points[0].value = 80;
    result.points[0].uncertainty = { lower: 75, upper: 85, confidence: 0.95, method: 'fictional range' };
  } else if (name === 'scope_mismatch') result.scope.gases = ['CO2'];
  return result;
}

function makeInput(testCase) {
  const observed = observedSeries(testCase.series);
  return {
    country_id: 'iso3166-1:ZZZ',
    as_of_year: 2026,
    max_staleness_years: 3,
    calculated_at: '2026-07-15T00:00:00Z',
    unresolved_plane_conflict: testCase.unresolved_plane_conflict === true,
    observed_series: observed,
    target_endpoint: endpoint(testCase.target, observed),
    policy_projection: projection(testCase.projection)
  };
}

assert.equal(fixture._meta.fictional_entities, true, 'Fixture metadata must state that entities are fictional');
assert.ok(fixture.cases.length >= 24, 'Expected broad synthetic coverage');

const hashes = new Set();
const evidenceReasonSet = new Set(EVIDENCE_REASON_CODES);
const assessmentBasisSet = new Set(ASSESSMENT_BASIS_CODES);
assert.equal(evidenceReasonSet.size, EVIDENCE_REASON_CODES.length, 'Evidence reason enum contains duplicates');
assert.equal(assessmentBasisSet.size, ASSESSMENT_BASIS_CODES.length, 'Assessment basis enum contains duplicates');
assert.equal(EVIDENCE_REASON_CODES.length, 55, 'CT-02 evidence reason enum must stay exact');
assert.deepEqual(vocabulary.evidence_reason_codes, EVIDENCE_REASON_CODES, 'Published CT-02 evidence reason vocabulary drifted from engine');
assert.deepEqual(vocabulary.assessment_basis_codes, ASSESSMENT_BASIS_CODES, 'Published assessment basis vocabulary drifted from engine');
assert.deepEqual(resultSchema.$defs.evidenceReasons.items.enum, EVIDENCE_REASON_CODES, 'Result schema evidence reasons drifted from engine');
assert.deepEqual(resultSchema.$defs.assessmentReasons.items.enum, ASSESSMENT_BASIS_CODES, 'Result schema assessment reasons drifted from engine');
const frozenEndpointFixture = endpoint('standard', observedSeries('fast_decline'));
assert.deepEqual(Object.keys(frozenEndpointFixture).sort(), [
  'accounting_frame', 'comparability', 'condition', 'country_id', 'eligible', 'engine_version',
  'independent_review', 'input_fact_ids', 'lineage', 'methodology_version', 'normalized_endpoint',
  'reason_codes', 'target_id', 'target_type', 'uncertainty'
].sort(), 'Fixture must match the frozen CT-20 result keys exactly');
assert.deepEqual(Object.keys(frozenEndpointFixture.independent_review).sort(), ['extractor_id', 'passed', 'reviewed_at', 'reviewer_id', 'status'].sort());
for (const testCase of fixture.cases) {
  const input = makeInput(testCase);
  const first = assessDelivery(input);
  const second = assessDelivery(clone(input));
  assert.deepEqual(first, second, `${testCase.id}: output must be deterministic`);
  const allEvidenceReasons = first.evidence_reason_codes.concat(first.policy_projection ? first.policy_projection.evidence_reason_codes : []);
  const allBasisCodes = first.assessment_basis_codes.concat(first.policy_projection ? first.policy_projection.assessment_basis_codes : []);
  const allCodes = allEvidenceReasons.concat(allBasisCodes);
  assert.ok(first.evidence_reason_codes.every(code => evidenceReasonSet.has(code)), `${testCase.id}: non-canonical evidence reason`);
  assert.ok(first.assessment_basis_codes.every(code => assessmentBasisSet.has(code)), `${testCase.id}: non-canonical assessment basis`);
  assert.equal(first.status, testCase.expected_status, `${testCase.id}: wrong status; reasons=${allCodes.join(',')}`);
  if (testCase.expected_reason) {
    assert.ok(allCodes.includes(testCase.expected_reason), `${testCase.id}: missing ${testCase.expected_reason}`);
  }
  if (testCase.expected_mode) assert.equal(first.observed_pace.mode, testCase.expected_mode, `${testCase.id}: wrong rate mode`);
  if (testCase.expected_level) assert.equal(first.level_comparison.relation, testCase.expected_level, `${testCase.id}: wrong level relation`);
  if (testCase.expected_projection_status) assert.equal(first.policy_projection.status, testCase.expected_projection_status, `${testCase.id}: wrong projection result`);
  if (testCase.expected_projection_null) {
    assert.equal(first.policy_projection.status, 'not_assessed', `${testCase.id}: incompatible projection must be nested and rejected`);
    assert.equal(first.policy_projection.eligible, false, `${testCase.id}: incompatible projection cannot be eligible`);
  }

  if (first.status !== 'not_assessed') {
    assert.match(first.lineage.calculation_hash, /^[a-f0-9]{64}$/, `${testCase.id}: invalid calculation hash`);
    hashes.add(first.lineage.calculation_hash);
    assert.ok(first.lineage.input_fact_ids.length >= 7, `${testCase.id}: incomplete fact lineage`);
    assert.equal(first.illustrative_required_path.data_role, 'illustrative_required_path');
    assert.equal(first.illustrative_required_path.is_observation, false);
    assert.ok(first.observed_pace.fact_ids.every(id => id.startsWith('fact:')), `${testCase.id}: observed lineage must use facts`);
    assert.equal(first.required_pace.unit, first.observed_pace.unit, `${testCase.id}: pace units differ`);
  }
}

// A level gap cannot independently create a favorable pace classification.
const worseningBelow = assessDelivery(makeInput(fixture.cases.find(item => item.id === 'below-target-but-worsening-is-not-ahead')));
assert.equal(worseningBelow.level_comparison.relation, 'below_target_interval');
assert.equal(worseningBelow.status, 'off_course');

// Policy scenario points cannot be relabelled and fed to the observation estimator.
const rejectedProjection = assessDelivery(makeInput(fixture.cases.find(item => item.id === 'projection-labelled-point-rejected')));
assert.equal(rejectedProjection.status, 'not_assessed');
assert.ok(rejectedProjection.assessment_basis_codes.includes('projection_point_rejected_as_observation'));

console.log(`country delivery engine: PASS (${fixture.cases.length} fictional cases, ${hashes.size} assessed calculation hashes)`);
