#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SECTION_ORDER, compileCard, hash } = require('./lib/country-card-evidence-model.js');

const ROOT = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/fixtures/country-card-evidence-model.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/country-card-evidence-model.schema.json'), 'utf8'));

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function resolveRef(root, ref) { return ref.slice(2).split('/').reduce((node, key) => node[key], root); }
function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}
function validate(value, rule, root = rule, at = '$') {
  const errors = [];
  if (rule.$ref) return validate(value, resolveRef(root, rule.$ref), root, at);
  if (rule.oneOf) {
    const passing = rule.oneOf.filter(item => validate(value, item, root, at).length === 0);
    if (passing.length !== 1) errors.push(`${at} must match one schema option`);
    return errors;
  }
  if (rule.allOf) rule.allOf.forEach(item => errors.push(...validate(value, item, root, at)));
  if (Object.prototype.hasOwnProperty.call(rule, 'const') && JSON.stringify(value) !== JSON.stringify(rule.const)) errors.push(`${at} violates const`);
  if (rule.enum && !rule.enum.includes(value)) errors.push(`${at} is not in enum`);
  const types = rule.type ? (Array.isArray(rule.type) ? rule.type : [rule.type]) : null;
  if (types && !types.some(type => matchesType(value, type))) return errors.concat(`${at} has wrong type`);
  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) errors.push(`${at} is too short`);
    if (rule.pattern && !(new RegExp(rule.pattern)).test(value)) errors.push(`${at} fails pattern`);
    if (rule.format === 'date-time' && Number.isNaN(Date.parse(value))) errors.push(`${at} is not date-time`);
  }
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at} has too few items`);
    if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at} has too many items`);
    if (rule.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at} has duplicates`);
    if (rule.items) value.forEach((item, index) => errors.push(...validate(item, rule.items, root, `${at}[${index}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const properties = rule.properties || {};
    (rule.required || []).forEach(key => { if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${at}.${key} required`); });
    Object.entries(value).forEach(([key, item]) => {
      if (properties[key]) errors.push(...validate(item, properties[key], root, `${at}.${key}`));
      else if (rule.additionalProperties === false) errors.push(`${at}.${key} not allowed`);
    });
  }
  return errors;
}

const COUNTRY_ID = 'iso3166-1:ZZZ';
const REVIEW = { status: 'reviewed', reviewer_id: 'fixture-reviewer', reviewed_at: '2026-07-15T00:00:00Z' };
const SCOPE = {
  accounting_frame: 'economy_wide_ghg', gases: ['CO2', 'CH4', 'N2O'],
  sectors: ['energy', 'industry', 'agriculture', 'waste'],
  geography: 'fictional_national_territory', lulucf: 'excluded',
  gwp_convention: 'fictional-GWP100'
};

function axis(status, availability, facts, reasons) {
  return {
    status, availability, evidence_reason_codes: reasons || [],
    assessment_basis_codes: [], fact_ids: facts || [], method_id: 'fixture-method',
    methodology_version: '9.9.9', value: null, lineage: { fixture: true }
  };
}

function profile() {
  return {
    country_id: COUNTRY_ID,
    calculation_hash: 'c'.repeat(64),
    axes: {
      impact: axis('high', 'available', ['fact:fixture.zzz.observed.2024']),
      target_integrity: axis('comparable', 'available', ['fact:fixture.zzz.target']),
      ambition: axis('not_assessed', 'not_assessed', [], ['evidence_insufficient']),
      delivery: Object.assign(axis('on_pace', 'available', ['fact:fixture.zzz.observed.2024', 'fact:fixture.zzz.target']), {
        assessment_basis_codes: ['observed_pace_at_least_required']
      }),
      fair_contribution: axis('not_assessed', 'not_assessed', [], ['evidence_insufficient']),
      evidence_quality: axis('B', 'available', ['fact:fixture.zzz.observed.2024', 'fact:fixture.zzz.target'])
    }
  };
}

function observation(plane = 'harmonized', latest = 80) {
  return {
    series_id: `series:fixture.zzz.${plane}`,
    country_id: COUNTRY_ID,
    data_role: 'observed_annual',
    is_observation: true,
    source_kind: 'national_inventory',
    evidence_plane: plane,
    state: plane === 'official' ? 'available' : 'estimated',
    metric: 'fictional_economy_wide_ghg', unit: 'fictional-MtCO2e/yr', scope: clone(SCOPE),
    source_ids: [`source:fixture:${plane}`], review: clone(REVIEW),
    points: [
      { year: 2022, value: 100, uncertainty: null, fact_id: `fact:fixture.zzz.${plane}.2022` },
      { year: 2023, value: 90, uncertainty: { lower: 88, upper: 92, confidence: 0.95, method: 'fictional interval' }, fact_id: `fact:fixture.zzz.${plane}.2023` },
      { year: 2024, value: latest, uncertainty: null, fact_id: `fact:fixture.zzz.${plane}.2024` }
    ]
  };
}

function target(condition = 'unconditional', amount = 50, suffix = 'unconditional') {
  return {
    engine_version: '1.0.0', methodology_version: '0.1.0',
    target_id: `target:fixture.zzz.${suffix}`, country_id: COUNTRY_ID,
    target_type: 'fixed_level', condition, comparability: 'comparable', eligible: true,
    reason_codes: [], normalized_endpoint: { year: 2030, value: { kind: 'exact', amount, unit: 'fictional-MtCO2e/yr' }, condition },
    accounting_frame: Object.assign(clone(SCOPE), { article6_treatment: 'not_applicable' }),
    input_fact_ids: [`fact:fixture.zzz.target.${suffix}`],
    lineage: { target_source_fact_ids: [`fact:fixture.zzz.target.${suffix}`], reviewed_against_fact_ids: [`fact:fixture.zzz.target.${suffix}`] },
    independent_review: Object.assign({ passed: true, extractor_id: 'fixture-extractor' }, clone(REVIEW))
  };
}

function delivery() {
  return {
    status: 'on_pace', formula_version: '1.0.0', methodology_version: '0.1.0',
    evidence_reason_codes: [], assessment_basis_codes: ['observed_pace_at_least_required'],
    illustrative_required_path: {
      data_role: 'illustrative_required_path', is_observation: false,
      start_year: 2024, start_value: 80, target_year: 2030, target_value: 50,
      unit: 'fictional-MtCO2e/yr', interpolation: 'constant_absolute_change',
      label: 'Illustrative required pathway'
    },
    lineage: {
      input_fact_ids: ['fact:fixture.zzz.harmonized.2022', 'fact:fixture.zzz.harmonized.2023', 'fact:fixture.zzz.harmonized.2024', 'fact:fixture.zzz.target.unconditional'],
      calculation_hash: 'd'.repeat(64)
    }
  };
}

function projection() {
  return {
    projection_id: 'projection:fixture.zzz.current-policies', country_id: COUNTRY_ID,
    data_role: 'scenario_projection_only', is_observation: false,
    label: 'Fictional current-policies scenario', evidence_plane: 'independent',
    scenario: { name: 'Fictional current policies', vintage: 'fixture-2026' },
    unit: 'fictional-MtCO2e/yr', scope: clone(SCOPE), source_ids: ['source:fixture:projection'],
    fact_ids: ['fact:fixture.zzz.projection'], review: clone(REVIEW),
    points: [{ year: 2025, value: 78, uncertainty: null }, { year: 2030, value: 65, uncertainty: { lower: 60, upper: 70, confidence: 0.8, method: 'fictional scenario range' } }]
  };
}

function baseInput() {
  return {
    country_id: COUNTRY_ID, entity_label: 'Fixture Republic',
    data_release_id: 'fixture-2026-07-15', generated_at: '2026-07-15T12:00:00Z',
    profile: profile(), observation_series: [observation()], target_results: [target()],
    delivery_result: delivery(), scenario_projections: [],
    projects_markets: { state: 'available', items: [{ id: 'project:fixture:one', claim: 'Synthetic project context only' }] }
  };
}

function inputFor(variant) {
  const input = baseInput();
  if (variant === 'base') return input;
  if (variant === 'non_comparable') {
    input.profile.axes.target_integrity.status = 'non_comparable';
    input.profile.axes.target_integrity.evidence_reason_codes = ['scope_mismatch'];
    input.profile.axes.delivery.status = 'not_assessed';
    input.target_results[0].comparability = 'non_comparable';
    input.target_results[0].eligible = false;
    input.target_results[0].normalized_endpoint = null;
    return input;
  }
  if (variant === 'missing') {
    input.profile.axes.impact = axis('not_assessed', 'not_assessed', [], ['source_missing']);
    input.profile.axes.target_integrity = axis('not_assessed', 'not_assessed', [], ['target_not_found']);
    input.profile.axes.delivery = axis('not_assessed', 'not_assessed', [], ['evidence_insufficient']);
    input.observation_series = []; input.target_results = []; input.delivery_result = null;
    return input;
  }
  if (variant === 'conflict') {
    input.observation_series.push(observation('official', 85));
    return input;
  }
  if (variant === 'dual_targets') {
    input.target_results.push(target('conditional', 40, 'conditional'));
    return input;
  }
  if (variant === 'projection') {
    input.scenario_projections = [projection()];
    return input;
  }
  if (variant === 'zero') {
    input.observation_series = [observation('harmonized', 0)];
    input.delivery_result.illustrative_required_path.start_value = 0;
    return input;
  }
  if (variant === 'synthetic_series') {
    input.observation_series[0].data_role = 'scenario_projection_only';
    input.observation_series[0].is_observation = false;
    return input;
  }
  if (variant === 'project_series') {
    input.observation_series[0].source_kind = 'project_market';
    return input;
  }
  if (variant === 'synthetic_point') {
    input.observation_series[0].points[1].data_role = 'illustrative_required_path';
    input.observation_series[0].points[1].is_observation = false;
    return input;
  }
  throw new Error(`unknown fixture variant ${variant}`);
}

assert.equal(fixture._meta.fictional_entities, true);
assert.ok(fixture.cases.length >= 10);
assert.equal(new Set(fixture.cases.map(item => item.id)).size, fixture.cases.length);
let compiledCount = 0;
let rejectedCount = 0;
const hashes = new Set();

for (const testCase of fixture.cases) {
  const input = inputFor(testCase.variant);
  if (testCase.expected_error) {
    assert.throws(() => compileCard(input), new RegExp(testCase.expected_error), `${testCase.id}: unsafe input was accepted`);
    rejectedCount += 1;
    continue;
  }
  const first = compileCard(input);
  const second = compileCard(clone(input));
  assert.deepEqual(first, second, `${testCase.id}: output is not deterministic`);
  assert.deepEqual(validate(first, schema), [], `${testCase.id}: output violates schema`);
  assert.equal(first.calculation_hash, hash(Object.assign({}, first, { calculation_hash: null })));
  assert.deepEqual(first.section_order, SECTION_ORDER);
  assert.equal(first.composite_score, null);
  assert.equal(first.chart.measured_series.length, testCase.expected.measured);
  assert.equal(first.chart.comparable_target_endpoints.length, testCase.expected.endpoints);
  assert.equal(Boolean(first.chart.illustrative_required_path), testCase.expected.path);
  assert.equal(first.chart.scenario_projections.length, testCase.expected.projections);
  assert.equal(first.sections.projects_markets.affects_profile, false);
  assert.equal(first.sections.projects_markets.disclaimer, 'Not part of the national climate performance profile');
  assert.ok(first.chart.accessible.title && first.chart.accessible.description && first.chart.accessible.text_summary);
  assert.ok(first.chart.measured_series.every(series => ['official', 'harmonized'].includes(series.evidence_plane)));
  assert.ok(first.chart.measured_series.every(series => series.points.every(point => point.fact_id.startsWith('fact:'))));
  assert.ok(first.chart.scenario_projections.every(item => item.is_observation === false && item.data_role === 'scenario_projection_only'));
  if (Object.prototype.hasOwnProperty.call(testCase.expected, 'latest_value')) {
    assert.equal(first.sections.responsibility.latest_measured && first.sections.responsibility.latest_measured.value, testCase.expected.latest_value);
  }
  if (testCase.expected.conditions) assert.deepEqual(first.chart.comparable_target_endpoints.map(item => item.condition).sort(), testCase.expected.conditions);
  if (testCase.expected.conflicts) assert.equal(first.sections.evidence.conflicts.length, testCase.expected.conflicts);
  if (testCase.expected.reason) assert.ok(first.sections.evidence.evidence_reason_codes.includes(testCase.expected.reason));
  if (testCase.expected.projection_role) assert.equal(first.chart.scenario_projections[0].data_role, testCase.expected.projection_role);
  if (testCase.expected.headline_fragment) assert.ok(first.chart.accessible.text_summary.includes(testCase.expected.headline_fragment));
  if (testCase.expected.calculation_hash) assert.equal(first.calculation_hash, testCase.expected.calculation_hash);
  if (process.env.PRINT_CT32_HASH === testCase.id) console.log(`${testCase.id}: ${first.calculation_hash}`);
  hashes.add(first.calculation_hash);
  compiledCount += 1;
}

const separated = compileCard(inputFor('projection'));
assert.equal(separated.chart.measured_series.length, 1, 'projection must not expand measured series');
assert.equal(separated.chart.measured_series[0].points.length, 3, 'projection points must not merge into observations');
const dual = compileCard(inputFor('dual_targets'));
assert.equal(dual.chart.illustrative_required_path.condition, 'unconditional', 'required path must match its endpoint value and condition');
const profileBlocksEndpoint = baseInput();
profileBlocksEndpoint.profile.axes.target_integrity.status = 'non_comparable';
profileBlocksEndpoint.profile.axes.target_integrity.evidence_reason_codes = ['scope_mismatch'];
const blockedEndpoint = compileCard(profileBlocksEndpoint);
assert.equal(blockedEndpoint.chart.comparable_target_endpoints.length, 0, 'CT-22 non-comparable status must block an inconsistent endpoint input');
assert.equal(blockedEndpoint.chart.illustrative_required_path, null, 'blocked endpoint cannot retain a pathway');
const profileBlocksPath = baseInput();
profileBlocksPath.profile.axes.delivery.status = 'not_assessed';
profileBlocksPath.profile.axes.delivery.availability = 'not_assessed';
assert.equal(compileCard(profileBlocksPath).chart.illustrative_required_path, null, 'CT-22 delivery gate must block an inconsistent pathway input');
assert.throws(() => compileCard(Object.assign(baseInput(), { generated_at: '2026-07-15T15:00:00+03:00' })), /UTC timestamp/);

console.log(`country card evidence model: PASS (${compiledCount} fictional golden outputs, ${rejectedCount + 3} rejection/gating cases, ${hashes.size} stable hashes)`);
