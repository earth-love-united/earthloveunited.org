#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DOMAINS, ROUTE_TYPES, compileCoverageQueue, hash } = require('./lib/country-coverage-gap-queue.js');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data/climate/releases/country-coverage-gap-queue-2026-07-15.json');
const FIXTURE = path.join(ROOT, 'data/climate/fixtures/country-coverage-gap-queue.json');
const SCHEMA = path.join(ROOT, 'data/climate/schemas/country-coverage-gap-queue.schema.json');

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}
function resolveRef(root, ref) {
  assert(ref.startsWith('#/'), `schema reference must be local: ${ref}`);
  const result = ref.slice(2).split('/').reduce((node, key) => node && node[key.replace(/~1/g, '/').replace(/~0/g, '~')], root);
  assert(result, `unresolved schema reference: ${ref}`);
  return result;
}
function validateSchema(value, schema, root = schema, at = '$') {
  if (schema.$ref) return validateSchema(value, resolveRef(root, schema.$ref), root, at);
  const errors = [];
  if (Object.prototype.hasOwnProperty.call(schema, 'const') && !same(value, schema.const)) errors.push(`${at} const mismatch`);
  if (schema.enum && !schema.enum.some(item => same(item, value))) errors.push(`${at} outside enum`);
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : null;
  if (types && !types.some(type => typeMatches(value, type))) return [`${at} type mismatch`];
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at} too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at} pattern mismatch`);
    if (schema.format === 'date-time' && (Number.isNaN(Date.parse(value)) || !value.includes('T'))) errors.push(`${at} invalid date-time`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at} below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at} above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at} too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at} too many items`);
    if (schema.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at} duplicates`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, root, `${at}[${index}]`)));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    (schema.required || []).forEach(key => { if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${at}.${key} required`); });
    Object.entries(value).forEach(([key, item]) => {
      if (properties[key]) errors.push(...validateSchema(item, properties[key], root, `${at}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${at}.${key} not allowed`);
    });
  }
  return errors;
}

function alpha3(index) {
  return String.fromCharCode(65 + Math.floor(index / 676), 65 + Math.floor(index / 26) % 26, 65 + index % 26);
}
function overlay(reasonCode) { return { status: 'not_reviewed', value: null, reason_code: reasonCode, source_id: null }; }
function fictionalInputs() {
  const entities = Array.from({ length: 249 }, (_, index) => {
    const code = alpha3(index);
    return {
      country_id: `iso3166-1:${code}`, name: `Fixture Entity ${String(index + 1).padStart(3, '0')}`,
      official_name: index === 0 ? null : `Fixture Official ${index + 1}`, common_name: null,
      iso_alpha2: code.slice(1), iso_alpha3: code, iso_numeric: String(index).padStart(3, '0'),
      region: overlay('region_not_reviewed'), subregion: overlay('region_not_reviewed'),
      un_membership: overlay('membership_not_reviewed'), unfccc_party: overlay('party_status_not_reviewed'),
      territory_status: overlay('territory_status_not_reviewed'), geometry: overlay('geometry_not_reviewed'),
      groups: { ldc: overlay('ldc_status_not_reviewed'), lldc: overlay('lldc_status_not_reviewed'), sids: overlay('sids_status_not_reviewed') },
      assessment_eligibility: { status: 'not_reviewed', eligible: null, reason_codes: ['assessment_eligibility_not_reviewed'], source_id: null, reviewed_at: null }
    };
  });
  const candidateIds = new Set(entities.slice(0, 206).map(item => item.country_id));
  const registry = {
    entity_count: 249, data_release_id: 'fictional-registry-release', entities,
    source: { source_registry_id: 'fictional-identity-source', title: 'Fictional identity fixture', source_url: 'https://example.invalid/identity', normalized_rows_checksum_sha256: '0'.repeat(64) }
  };
  const primap = {
    artifact_id: 'fictional-harmonized-candidates', calculation_hash: '1'.repeat(64),
    source: { source_registry_id: 'fictional-harmonized-source', title: 'Fictional harmonized fixture', doi_url: 'https://example.invalid/harmonized' },
    selection: { period: { start_year: 2014, end_year: 2023 } }, review: { status: 'not_reviewed' },
    registry_coverage: entities.map(entity => ({
      country_id: entity.country_id,
      state: candidateIds.has(entity.country_id) ? 'not_reviewed' : 'source_unavailable'
    })),
    series: entities.slice(0, 206).map(entity => ({
      country_id: entity.country_id, series_id: `series:fixture:${entity.iso_alpha3.toLowerCase()}`,
      values: Array.from({ length: 10 }, () => ({ fixture_only: true }))
    }))
  };
  const release = {
    release_id: 'fictional-harmonized-release', calculation_hash: '2'.repeat(64),
    coverage: { mapped_candidates: 206, registry_gaps: 43 }
  };
  return { registry, primap, release };
}

function semanticErrors(output, expected) {
  const errors = [];
  const error = message => errors.push(message);
  if (typeof output.generated_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(output.generated_at) || Number.isNaN(Date.parse(output.generated_at))) error('generated_at invalid');
  const expectedCounts = {
    registry_entities: expected.registry_entities, primap_candidates_not_reviewed: expected.candidate_entities,
    primap_source_gaps: expected.source_gap_entities, reviewed_harmonized_emissions: 0,
    reviewed_active_targets: 0, reviewed_profiles: 0, queue_tasks: expected.queue_tasks,
    mapped_visibility_and_status_tasks: expected.mapped_visibility_and_status_tasks,
    critical_evidence_coverage_tasks: expected.critical_evidence_coverage_tasks,
    dependent_assessment_coverage_tasks: expected.dependent_assessment_coverage_tasks
  };
  if (!same(output.counts, expectedCounts)) error('counts mismatch');
  if (!Array.isArray(output.matrix) || output.matrix.length !== 249) error('matrix size mismatch');
  if (!Array.isArray(output.queue) || output.queue.length !== 2490) error('queue size mismatch');
  const overlayNames = ['region', 'subregion', 'un_membership', 'unfccc_party', 'territory_status', 'geometry'];
  (output.matrix || []).forEach((row, rowIndex) => {
    if (!same(Object.keys(row.domains || {}), DOMAINS)) error(`domain set/order mismatch row ${rowIndex}`);
    if (row.performance_status !== null) error(`performance must be null row ${rowIndex}`);
    if (row.score !== null) error(`score must be null row ${rowIndex}`);
    if (row.rank !== null) error(`rank must be null row ${rowIndex}`);
    const overlays = row.status_overlays || {};
    const claims = overlayNames.map(name => overlays[name]).concat(overlays.groups ? [overlays.groups.ldc, overlays.groups.lldc, overlays.groups.sids] : []);
    if (claims.length !== 9 || claims.some(claim => !claim || claim.status !== 'not_reviewed' || claim.value !== null || claim.source_id !== null)) error(`overlay inferred row ${rowIndex}`);
    if (!overlays.assessment_eligibility || overlays.assessment_eligibility.status !== 'not_reviewed' || overlays.assessment_eligibility.eligible !== null) error(`eligibility overlay inferred row ${rowIndex}`);
    DOMAINS.filter(domain => domain !== 'identity').forEach(domain => {
      const record = row.domains && row.domains[domain];
      if (!record || record.value !== null) error(`climate domain value published row ${rowIndex} ${domain}`);
      if (!record || record.review_status !== 'not_reviewed' || !same(record.fact_ids, [])) error(`review boundary failed row ${rowIndex} ${domain}`);
    });
  });
  const allowedStates = new Set(['status_overlays_not_reviewed', 'not_reviewed', 'source_missing', 'source_unavailable']);
  (output.queue || []).forEach((task, index) => {
    if (task.queue_sequence !== index + 1) error(`queue sequence mismatch ${index}`);
    if (task.priority_basis !== 'mapped visibility and missing critical evidence only') error(`priority basis invalid task ${index}`);
    if (!allowedStates.has(task.state)) error(`task state invalid task ${index}`);
    if (!Array.isArray(task.route_types) || !task.route_types.length || task.route_types.some(route => !ROUTE_TYPES.includes(route))) error(`route type invalid task ${index}`);
    if (task.value !== null || !same(task.fact_ids, [])) error(`task fact/value boundary failed task ${index}`);
    if (task.claims_copied !== false) error(`copied claim found task ${index}`);
    if (task.performance_priority_used !== false || task.score_or_rank_assigned !== false) error(`assessment priority found task ${index}`);
    if ((task.source_candidates || []).some(source => source.metadata_only !== true || !/^https:\/\//.test(source.url))) error(`source candidate is not metadata-only task ${index}`);
  });
  const usedRoutes = new Set((output.queue || []).flatMap(task => task.route_types || []));
  if (ROUTE_TYPES.some(route => !usedRoutes.has(route))) error('route type coverage incomplete');
  if (output.priority_policy.high_impact_priority_allowed !== false || output.priority_policy.missing_target_or_data_is_positive !== false) error('priority policy rewards performance or absence');
  if (Object.values(output.forbidden_outputs || {}).some(value => value !== false)) error('forbidden output assigned');
  if (output.calculation_hash !== hash(Object.assign({}, output, { calculation_hash: null }))) error('calculation hash mismatch');
  return errors;
}

function mutate(value, mutation) {
  const clone = JSON.parse(JSON.stringify(value));
  const parts = mutation.path.split('.');
  let cursor = clone;
  parts.slice(0, -1).forEach(part => { cursor = cursor[Number.isInteger(Number(part)) && String(Number(part)) === part ? Number(part) : part]; });
  cursor[parts[parts.length - 1]] = mutation.value;
  return clone;
}

function main() {
  const fixture = read(FIXTURE);
  const schema = read(SCHEMA);
  assert(fixture._meta.fictional_entities === true, 'checker fixture must remain fictional');
  const inputs = fictionalInputs();
  const first = compileCoverageQueue(inputs.registry, inputs.primap, inputs.release, fixture.generated_at);
  const second = compileCoverageQueue(inputs.registry, inputs.primap, inputs.release, fixture.generated_at);
  assert(same(first, second), 'fictional compilation is not deterministic');
  assert(first.matrix[0].domains.identity.value.iso_numeric === '000', 'exact zero-like identity code was not preserved');
  assert(first.matrix[0].domains.harmonized_emissions.value === null, 'candidate history leaked into country-facing value');
  assert(first.matrix[205].domains.harmonized_emissions.state === 'not_reviewed', '206th candidate state mismatch');
  assert(first.matrix[206].domains.harmonized_emissions.state === 'source_unavailable', 'first source gap state mismatch');
  assert(first.matrix[206].domains.harmonized_emissions.reason_codes.includes('source_missing'), 'source gap must emit source_missing');
  assert(semanticErrors(first, fixture.expected).length === 0, `fictional output failed: ${semanticErrors(first, fixture.expected).slice(0, 5).join('; ')}`);

  fixture.invalid_mutations.forEach(mutation => {
    const errors = semanticErrors(mutate(first, mutation), fixture.expected);
    assert(errors.some(message => message.includes(mutation.expected_error)), `${mutation.id} did not fail with ${mutation.expected_error}: ${errors.slice(0, 3).join('; ')}`);
  });

  const output = read(OUTPUT);
  const schemaErrors = validateSchema(output, schema);
  assert(schemaErrors.length === 0, `schema failed: ${schemaErrors.slice(0, 8).join('; ')}`);
  const semantic = semanticErrors(output, fixture.expected);
  assert(semantic.length === 0, `generated artifact failed: ${semantic.slice(0, 8).join('; ')}`);
  const rebuilt = compileCoverageQueue(
    read(path.join(ROOT, 'data/climate/country-registry.json')),
    read(path.join(ROOT, 'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json')),
    read(path.join(ROOT, 'data/climate/releases/primap-hist-2.6.1-economy-wide-2026-07-15.json')),
    output.generated_at
  );
  assert(same(output, rebuilt), 'generated artifact is not an exact deterministic rebuild');
  assert(fs.statSync(OUTPUT).size < 10 * 1024 * 1024, 'generated artifact exceeds 10MB');
  console.log(`coverage gap queue: PASS (${output.counts.registry_entities} entities, ${output.counts.queue_tasks} tasks, ${fixture.invalid_mutations.length} fail-closed mutations)`);
}

main();
