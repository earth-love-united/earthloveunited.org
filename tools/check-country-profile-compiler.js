#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ASSESSMENT_BASIS_CODES,
  AXIS_NAMES,
  EVIDENCE_REASON_CODES,
  compileProfile,
  hash,
  toCt02Profile
} = require('./lib/country-profile-compiler.js');

const ROOT = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/fixtures/country-profile-compiler.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/compiled-profile.schema.json'), 'utf8'));
const ct02Schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/profile.schema.json'), 'utf8'));
const canonical = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/enums.json'), 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function merge(base, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
  const output = base && typeof base === 'object' && !Array.isArray(base) ? clone(base) : {};
  Object.keys(patch).forEach(key => { output[key] = merge(output[key], patch[key]); });
  return output;
}

function resolveRef(root, ref) {
  return ref.slice(2).split('/').reduce((node, key) => node[key], root);
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  return typeof value === type;
}

function validate(value, rule, root = rule, at = '$') {
  const errors = [];
  if (rule.$ref) return validate(value, resolveRef(root, rule.$ref), root, at);
  if (rule.allOf) rule.allOf.forEach(item => errors.push(...validate(value, item, root, at)));
  if (Object.prototype.hasOwnProperty.call(rule, 'const') && value !== rule.const) errors.push(`${at} must equal ${rule.const}`);
  if (rule.enum && !rule.enum.includes(value)) errors.push(`${at} is not in enum`);
  const types = rule.type ? (Array.isArray(rule.type) ? rule.type : [rule.type]) : null;
  if (types && !types.some(type => matchesType(value, type))) return errors.concat(`${at} has wrong type`);
  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) errors.push(`${at} is too short`);
    if (rule.pattern && !(new RegExp(rule.pattern)).test(value)) errors.push(`${at} does not match ${rule.pattern}`);
    if (rule.format === 'date-time' && Number.isNaN(Date.parse(value))) errors.push(`${at} is not a date-time`);
  }
  if (Array.isArray(value)) {
    if (rule.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at} has duplicates`);
    if (rule.items) value.forEach((item, index) => errors.push(...validate(item, rule.items, root, `${at}[${index}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const properties = rule.properties || {};
    (rule.required || []).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${at}.${key} is required`);
    });
    Object.entries(value).forEach(([key, item]) => {
      if (properties[key]) errors.push(...validate(item, properties[key], root, `${at}.${key}`));
      else if (rule.additionalProperties === false) errors.push(`${at}.${key} is not allowed`);
    });
  }
  return errors;
}

const review = {
  status: 'reviewed',
  passed: true,
  extractor_id: 'fixture-extractor',
  reviewer_id: 'fixture-independent-reviewer',
  reviewed_at: '2026-07-15T00:00:00Z'
};

function baseInput() {
  return {
    country_id: 'iso3166-1:ZZZ',
    data_release_id: 'fixture-2026-07-15',
    generated_at: '2026-07-15T12:00:00Z',
    axes: {
      impact: {
        status: 'high',
        state: 'available',
        eligible: true,
        evidence_reason_codes: [],
        fact_ids: ['fact:fixture.zzz.impact.2024'],
        method_id: 'fictional-impact-bands',
        methodology_version: '9.9.9',
        value: { amount: 500, unit: 'fictional-MtCO2/yr' },
        review,
        lineage: { source: 'fictional-impact-fixture' }
      },
      target_integrity: {
        method_id: 'ct20-target-comparability',
        review,
        result: {
          engine_version: '1.0.0',
          methodology_version: '0.1.0',
          target_id: 'target:fixture.zzz.2030',
          country_id: 'iso3166-1:ZZZ',
          comparability: 'comparable',
          eligible: true,
          reason_codes: [],
          input_fact_ids: ['fact:fixture.zzz.target'],
          normalized_endpoint: { year: 2030, value: { kind: 'exact', amount: 80, unit: 'fictional-MtCO2e/yr' }, condition: 'unconditional' },
          lineage: {
            formula: 'fictional fixed endpoint',
            formula_version: '1.0.0',
            target_source_fact_ids: ['fact:fixture.zzz.target'],
            reviewed_against_fact_ids: ['fact:fixture.zzz.target']
          },
          independent_review: {
            passed: true,
            status: 'reviewed',
            reviewer_id: 'fixture-independent-reviewer',
            reviewed_at: '2026-07-15T00:00:00Z'
          }
        }
      },
      ambition: null,
      delivery: {
        review,
        result: {
          status: 'on_pace',
          formula_version: '1.0.0',
          methodology_version: '0.1.0',
          evidence_reason_codes: [],
          assessment_basis_codes: ['observed_pace_at_least_required'],
          lineage: {
            calculation_hash: 'a'.repeat(64),
            observed_fact_ids: ['fact:fixture.zzz.observed.2020', 'fact:fixture.zzz.observed.2021'],
            projection_fact_ids: [],
            input_fact_ids: ['fact:fixture.zzz.target', 'fact:fixture.zzz.observed.2020', 'fact:fixture.zzz.observed.2021'],
            target_lineage_hash: 'b'.repeat(64)
          }
        }
      },
      fair_contribution: null,
      evidence_quality: {
        status: 'B',
        eligible: true,
        evidence_reason_codes: [],
        fact_ids: ['fact:fixture.zzz.quality'],
        method_id: 'fictional-evidence-quality-review',
        methodology_version: '9.9.9',
        value: null,
        review,
        lineage: { source: 'fictional-quality-fixture' }
      }
    }
  };
}

assert.equal(fixture._meta.fictional_entities, true);
assert.equal(EVIDENCE_REASON_CODES.length, 55, 'CT-02 evidence reason set must stay exact');
assert.deepEqual(EVIDENCE_REASON_CODES, canonical.reason_codes, 'Compiler evidence reasons drifted from CT-02');
assert.deepEqual(schema.$defs.evidenceReasons.items.enum, EVIDENCE_REASON_CODES, 'Schema evidence reasons drifted');
assert.deepEqual(schema.$defs.assessmentBases.items.enum, ASSESSMENT_BASIS_CODES, 'Schema assessment vocabulary drifted from CT-21');

const seenHashes = new Set();
for (const testCase of fixture.cases) {
  const input = merge(baseInput(), testCase.patch);
  const first = compileProfile(input);
  const second = compileProfile(clone(input));
  assert.deepEqual(first, second, `${testCase.id}: compiler must be deterministic`);
  assert.deepEqual(validate(first, schema), [], `${testCase.id}: output violates schema`);
  const ct02 = toCt02Profile(first);
  assert.deepEqual(validate(ct02, ct02Schema), [], `${testCase.id}: CT-02 compatibility projection violates profile schema`);
  if (ct02.headline.status === 'available') {
    assert.notEqual(ct02.axes.ambition.status, 'not_assessed', `${testCase.id}: CT-02 available headline requires ambition`);
    assert.notEqual(ct02.axes.delivery.status, 'not_assessed', `${testCase.id}: CT-02 available headline requires delivery`);
  }
  assert.equal(first.calculation_hash, hash(Object.assign({}, first, { calculation_hash: null })), `${testCase.id}: hash does not cover stable output`);
  assert.equal(first.headline.status, testCase.expected.headline_status, `${testCase.id}: headline status`);
  if (testCase.expected.headline_classification) assert.equal(first.headline.classification, testCase.expected.headline_classification, `${testCase.id}: headline classification`);
  if (testCase.expected.impact_status) assert.equal(first.axes.impact.status, testCase.expected.impact_status, `${testCase.id}: impact status`);
  if (Object.prototype.hasOwnProperty.call(testCase.expected, 'impact_value')) {
    const value = first.axes.impact.value;
    assert.equal(value && value.amount, testCase.expected.impact_value, `${testCase.id}: zero/null distinction`);
  }
  if (testCase.expected.impact_availability) assert.equal(first.axes.impact.availability, testCase.expected.impact_availability, `${testCase.id}: impact availability`);
  if (testCase.expected.target_status) assert.equal(first.axes.target_integrity.status, testCase.expected.target_status, `${testCase.id}: target status`);
  if (testCase.expected.delivery_status) assert.equal(first.axes.delivery.status, testCase.expected.delivery_status, `${testCase.id}: delivery status`);
  if (testCase.expected.ambition_status) assert.equal(first.axes.ambition.status, testCase.expected.ambition_status, `${testCase.id}: ambition status`);
  if (testCase.expected.ambition_availability) assert.equal(first.axes.ambition.availability, testCase.expected.ambition_availability, `${testCase.id}: ambition availability`);
  if (testCase.expected.fair_status) assert.equal(first.axes.fair_contribution.status, testCase.expected.fair_status, `${testCase.id}: fair status`);
  if (testCase.expected.fair_availability) assert.equal(first.axes.fair_contribution.availability, testCase.expected.fair_availability, `${testCase.id}: fair availability`);
  if (testCase.expected.calculation_hash) assert.equal(first.calculation_hash, testCase.expected.calculation_hash, `${testCase.id}: golden hash drifted`);
  if (process.env.PRINT_CT22_HASH === testCase.id) console.log(`${testCase.id}: ${first.calculation_hash}`);
  (testCase.expected.reasons_include || []).forEach(code => {
    assert.ok(first.headline.evidence_reason_codes.includes(code), `${testCase.id}: missing headline reason ${code}`);
  });
  assert.equal(Object.prototype.hasOwnProperty.call(first, 'score'), false, `${testCase.id}: composite score is forbidden`);
  assert.deepEqual(Object.keys(first.axes), AXIS_NAMES, `${testCase.id}: six axes must remain separate and ordered`);
  seenHashes.add(first.calculation_hash);
}

const major = compileProfile(merge(baseInput(), fixture.cases.find(item => item.id === 'major-emitter-no-target').patch));
const small = compileProfile(merge(baseInput(), fixture.cases.find(item => item.id === 'small-emitter-no-target').patch));
assert.notEqual(major.headline.classification, 'core_axes_available', 'missing target cannot receive a favorable core headline');
assert.notEqual(small.headline.classification, 'core_axes_available', 'small emitter missing target cannot receive a favorable core headline');
assert.equal(major.axes.ambition.status, 'not_assessed', 'compiler must not invent ambition');
assert.equal(major.axes.fair_contribution.status, 'not_assessed', 'compiler must not invent fairness');

assert.throws(() => compileProfile(merge(baseInput(), { axes: { delivery: { result: { assessment_basis_codes: ['made_up_delivery_code'] } } } })), /Unknown assessment basis code/);
assert.throws(() => compileProfile(merge(baseInput(), { axes: { impact: { evidence_reason_codes: ['made_up_evidence_code'] } } })), /Unknown evidence reason code/);
assert.throws(() => compileProfile(merge(baseInput(), { generated_at: null })), /caller-supplied generated_at/);
const malformedReviewTime = compileProfile(merge(baseInput(), {
  axes: { impact: { review: { reviewed_at: '2026-07-15T00:00:00+03:00' } } }
}));
assert.equal(malformedReviewTime.axes.impact.status, 'not_assessed', 'non-UTC review time must fail closed');
assert.ok(malformedReviewTime.axes.impact.evidence_reason_codes.includes('independent_review_required'));
const selfReviewed = compileProfile(merge(baseInput(), {
  axes: { impact: { review: { reviewer_id: 'fixture-extractor' } } }
}));
assert.equal(selfReviewed.axes.impact.status, 'not_assessed', 'self-review must fail closed');
const unreviewedDelivery = compileProfile(merge(baseInput(), { axes: { delivery: { review: null } } }));
assert.equal(unreviewedDelivery.axes.delivery.status, 'not_assessed', 'delivery requires independent review');
const passedOnlyTarget = compileProfile(merge(baseInput(), { axes: { target_integrity: { review: null } } }));
assert.equal(passedOnlyTarget.axes.target_integrity.status, 'not_assessed', 'passed=true alone cannot review a target finding');

console.log(`country profile compiler: PASS (${fixture.cases.length} fictional golden cases, ${seenHashes.size} stable hashes, 7 rejection/gating cases)`);
