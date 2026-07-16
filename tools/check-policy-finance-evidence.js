#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT, 'data', 'climate', 'schemas');
const FIXTURE_DIR = path.join(ROOT, 'data', 'climate', 'fixtures', 'policy-finance');
const RELEASE = path.join(ROOT, 'data', 'climate', 'releases', 'policy-finance-2026-07-15', 'manifest.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local schema references are supported: ${ref}`);
  return ref.slice(2).split('/').reduce((node, part) => node[part.replace(/~1/g, '/').replace(/~0/g, '~')], root);
}

function validateSchema(value, schema, root = schema, at = '$') {
  const errors = [];
  if (schema.$ref) return validateSchema(value, resolveRef(root, schema.$ref), root, at);
  if (Object.prototype.hasOwnProperty.call(schema, 'const') && !same(value, schema.const)) errors.push(`${at} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => same(item, value))) errors.push(`${at} is outside its enum`);
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : null;
  if (types && !types.some((type) => typeMatches(value, type))) return [`${at} must have type ${types.join('|')}`];
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at} is too short`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) errors.push(`${at} does not match ${schema.pattern}`);
    if (schema.format === 'date' && (Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || !/^\d{4}-\d{2}-\d{2}$/.test(value))) errors.push(`${at} is not a date`);
    if (schema.format === 'date-time' && (Number.isNaN(Date.parse(value)) || !value.includes('T'))) errors.push(`${at} is not a date-time`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at} is below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at} is above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at} has too few items`);
    if (schema.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at} has duplicate items`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, root, `${at}[${index}]`)));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const key of schema.required || []) if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${at}.${key} is required`);
    for (const [key, item] of Object.entries(value)) {
      if (properties[key]) errors.push(...validateSchema(item, properties[key], root, `${at}.${key}`));
      else if (schema.additionalProperties === false && key !== '$defs') errors.push(`${at}.${key} is not allowed`);
    }
  }
  return errors;
}

function validateReview(record, errors) {
  if (record.review.status === 'reviewed') {
    if (!record.review.reviewer_id || !record.review.reviewed_at) errors.push('reviewed record requires reviewer and review timestamp');
    if (record.review.extractor_id === record.review.reviewer_id) errors.push('reviewer must differ from extractor');
  }
}

function validateUncertainty(uncertainty, errors, label) {
  if (uncertainty && uncertainty.lower > uncertainty.upper) errors.push(`${label} uncertainty lower exceeds upper`);
}

function validatePolicy(record, schema) {
  const errors = validateSchema(record, schema);
  if (record.evidence_plane === 'official' && !record.source.source_registry_id.includes('unfccc') && !record.source.source_registry_id.startsWith('fixture-')) {
    errors.push('official policy requires an official source');
  }
  if (record.legal_status === 'in_force' && !record.effective_date) errors.push('in_force policy requires effective_date');
  if (record.adoption_date && record.effective_date && record.adoption_date > record.effective_date) errors.push('policy adoption_date cannot follow effective_date');
  const expectedFacts = new Set(record.effects.expected.map((effect) => effect.source_fact_id));
  for (const effect of record.effects.expected) {
    if (!['modeled', 'projected'].includes(effect.method)) errors.push('expected policy effects must use modeled or projected methods');
    validateUncertainty(effect.uncertainty, errors, effect.effect_id);
  }
  for (const effect of record.effects.observed) {
    if (!['measured', 'evaluated', 'official_reported'].includes(effect.method)) errors.push('observed policy effects must use measured, evaluated, or official_reported methods');
    if (expectedFacts.has(effect.source_fact_id)) errors.push('expected and observed effects must not reuse a source fact');
    validateUncertainty(effect.uncertainty, errors, effect.effect_id);
  }
  validateReview(record, errors);
  return errors;
}

function validateProjection(record, schema) {
  const errors = validateSchema(record, schema);
  if (record.data_role !== 'scenario_projection_only') errors.push('projection data_role must remain scenario_projection_only');
  if (!['official', 'harmonized', 'independent'].includes(record.evidence_plane)) errors.push('projection evidence_plane must be official, harmonized, or independent');
  if (record.source.source_registry_id.startsWith('unfccc-') && record.evidence_plane !== 'official') errors.push('UNFCCC source records must remain on the official evidence plane');
  const years = record.points.map((point) => point.year);
  if (years.some((year, index) => index && year <= years[index - 1])) errors.push('projection years must be unique and strictly increasing');
  record.points.forEach((point) => validateUncertainty(point.uncertainty, errors, `${record.projection_id}:${point.year}`));
  if (record.scope.accounting_frame === 'economy_wide_ghg' && !record.scope.gwp_convention) errors.push('economy-wide GHG projection requires GWP convention');
  validateReview(record, errors);
  return errors;
}

function validateFinance(record, schema) {
  const errors = validateSchema(record, schema);
  if (Object.prototype.hasOwnProperty.call(record, 'finance_total_bn') || Object.prototype.hasOwnProperty.call(record, 'total')) errors.push('ambiguous finance total fields are prohibited');
  if (['provided', 'mobilized'].includes(record.flow_stage) && record.country_role !== 'provider') errors.push('provided and mobilized flows require provider country_role');
  if (['needed', 'received'].includes(record.flow_stage) && record.country_role !== 'recipient') errors.push('needed and received flows require recipient country_role');
  if (record.origin === 'domestic' && record.channel !== 'domestic') errors.push('domestic origin requires domestic channel');
  if (record.origin === 'international' && record.channel === 'domestic') errors.push('international origin cannot use domestic channel');
  if (record.price_basis.type === 'constant' && (!record.price_basis.base_year || !record.price_basis.conversion_method)) errors.push('constant prices require a base year and conversion method');
  if (record.price_basis.type === 'current' && (record.price_basis.base_year !== null || record.price_basis.conversion_method !== null)) errors.push('current prices must not declare constant-price conversion fields');
  if (record.period.start_date > record.period.end_date) errors.push('finance period start must not follow end');
  if (record.source.source_registry_id.startsWith('unfccc-') && record.evidence_plane !== 'official') errors.push('UNFCCC source records must remain on the official evidence plane');
  validateUncertainty(record.uncertainty, errors, record.finance_id);
  validateReview(record, errors);
  return errors;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split('.');
  let node = target;
  for (const part of parts.slice(0, -1)) node = node[Number.isInteger(Number(part)) && String(Number(part)) === part ? Number(part) : part];
  node[parts[parts.length - 1]] = value;
}

function main() {
  const schemas = {
    policies: readJson(path.join(SCHEMA_DIR, 'policy-measure.schema.json')),
    projections: readJson(path.join(SCHEMA_DIR, 'policy-projection.schema.json')),
    finance: readJson(path.join(SCHEMA_DIR, 'climate-finance.schema.json')),
  };
  const validators = { policies: validatePolicy, projections: validateProjection, finance: validateFinance };
  const valid = readJson(path.join(FIXTURE_DIR, 'valid-synthetic.json'));
  const invalid = readJson(path.join(FIXTURE_DIR, 'invalid-semantic-cases.json'));
  const release = readJson(RELEASE);
  const failures = [];

  if (!valid.fixture_notice.startsWith('FICTIONAL CONTRACT DATA ONLY')) failures.push('valid fixture lacks unmistakable fictional notice');
  for (const family of Object.keys(validators)) {
    for (const record of valid[family]) {
      if (record.country_id !== 'iso3166-1:ZZZ') failures.push(`${record.record_kind} fixture must use reserved fictional ZZZ identity`);
      const errors = validators[family](record, schemas[family]);
      if (errors.length) failures.push(`${record.record_kind} valid fixture failed: ${errors.join('; ')}`);
    }
  }

  for (const test of invalid.cases) {
    const record = clone(valid[test.record_family][test.base_index]);
    for (const [at, value] of Object.entries(test.set)) setPath(record, at, value);
    const errors = validators[test.record_family](record, schemas[test.record_family]);
    if (!errors.includes(test.expected_error)) failures.push(`${test.case_id} did not produce expected error; got: ${errors.join('; ')}`);
  }

  if (release.release_status !== 'blocked') failures.push('release manifest must remain blocked');
  if (release.publication.normalized_country_record_count !== 0) failures.push('blocked release must publish zero normalized country records');
  if (release.publication.country_values_included !== false) failures.push('blocked release must declare that no country values are included');
  if (!release.gates.every((gate) => gate.state === 'blocked' && gate.reason_codes.includes('licence_not_approved'))) failures.push('every source gate must fail closed on licence_not_approved');
  if (release.artifacts.some((artifact) => artifact.content !== 'metadata_and_links_only')) failures.push('release artifacts must remain metadata/link-only');
  if (JSON.stringify(release).includes('finance_total_bn')) failures.push('release manifest contains prohibited finance_total_bn');

  if (failures.length) {
    console.error('Policy/finance evidence contract failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  const count = valid.policies.length + valid.projections.length + valid.finance.length;
  console.log(`Policy/finance evidence contract passed (${count} fictional valid records, ${invalid.cases.length} rejected semantic conflations, release blocked).`);
}

main();
