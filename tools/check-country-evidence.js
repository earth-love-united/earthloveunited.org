#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CLIMATE = path.join(ROOT, 'data', 'climate');
const SCHEMAS = path.join(CLIMATE, 'schemas');
const FIXTURES = path.join(CLIMATE, 'fixtures');

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

function resolveRef(rootSchema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local schema references are supported: ${ref}`);
  return ref.slice(2).split('/').reduce((node, part) => node[part.replace(/~1/g, '/').replace(/~0/g, '~')], rootSchema);
}

function validFormat(value, format) {
  if (value === null) return true;
  if (format === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  if (format === 'date-time') return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && /T/.test(value);
  return true;
}

function validateSchema(value, schema, rootSchema = schema, at = '$') {
  const errors = [];
  if (schema.$ref) return validateSchema(value, resolveRef(rootSchema, schema.$ref), rootSchema, at);
  if (schema.oneOf) {
    const branchErrors = schema.oneOf.map((branch) => validateSchema(value, branch, rootSchema, at));
    if (branchErrors.filter((branch) => branch.length === 0).length !== 1) errors.push(`${at} must match exactly one schema option`);
    return errors;
  }
  if (schema.allOf) schema.allOf.forEach((branch) => errors.push(...validateSchema(value, branch, rootSchema, at)));
  if (Object.prototype.hasOwnProperty.call(schema, 'const') && !same(value, schema.const)) errors.push(`${at} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => same(item, value))) errors.push(`${at} value ${JSON.stringify(value)} is not in enum`);

  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : null;
  if (types && !types.some((type) => typeMatches(value, type))) {
    errors.push(`${at} must have type ${types.join('|')}`);
    return errors;
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at} is shorter than ${schema.minLength}`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) errors.push(`${at} does not match ${schema.pattern}`);
    if (schema.format && !validFormat(value, schema.format)) errors.push(`${at} is not a valid ${schema.format}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at} is below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at} is above maximum ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at} has fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at} has more than ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at} contains duplicate items`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, rootSchema, `${at}[${index}]`)));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    (schema.required || []).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${at}.${key} is required`);
    });
    Object.entries(value).forEach(([key, item]) => {
      if (properties[key]) errors.push(...validateSchema(item, properties[key], rootSchema, `${at}.${key}`));
      else if (schema.additionalProperties === false && key !== '$defs') errors.push(`${at}.${key} is not allowed`);
    });
  }
  return errors;
}

function duplicateErrors(items, field, label = field) {
  const seen = new Set();
  const errors = [];
  for (const item of items) {
    const value = item[field];
    if (value === null || value === undefined) continue;
    if (seen.has(value)) errors.push(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
  return errors;
}

function enumErrors(values, allowed, at) {
  return values.filter((value) => !allowed.includes(value)).map((value) => `${at} contains unknown reason code ${value}`);
}

function validateRegistry(registry, schema, enums) {
  const errors = validateSchema(registry, schema);
  if (registry.entity_count !== registry.entities.length) errors.push('entity_count does not match entities length');
  errors.push(...duplicateErrors(registry.entities, 'country_id'));
  errors.push(...duplicateErrors(registry.entities, 'iso_alpha2'));
  errors.push(...duplicateErrors(registry.entities, 'iso_alpha3'));
  errors.push(...duplicateErrors(registry.entities, 'iso_numeric'));
  errors.push(...enumErrors(registry.publication_gates.identity_redistribution.reason_codes, enums.reason_codes, 'publication_gates.identity_redistribution'));
  errors.push(...enumErrors(registry.publication_gates.assessment_overlays.reason_codes, enums.reason_codes, 'publication_gates.assessment_overlays'));
  if (registry.source.source_registry_id !== 'debian-iso-codes-4.20.1-1-iso-3166-1') errors.push('registry must reference the exact CT-01 Debian identity source');
  if (registry.publication_gates.identity_redistribution.release_eligible !== true) errors.push('approved Debian identity redistribution gate must pass');
  if (registry.publication_gates.assessment_overlays.release_eligible !== false) errors.push('unreviewed assessment overlays must fail closed');
  if (registry.source.normalized_rows_checksum_sha256 !== crypto.createHash('sha256').update(JSON.stringify(registry.entities)).digest('hex')) {
    errors.push('normalized identity checksum does not match entities');
  }
  for (const entity of registry.entities) {
    if (entity.country_id !== `iso3166-1:${entity.iso_alpha3}`) errors.push(`${entity.country_id} does not match iso_alpha3`);
    if (!enums.onboarding_states.includes(entity.onboarding.state)) errors.push(`${entity.country_id} has unknown onboarding state`);
    if (!enums.evidence_states.includes(entity.onboarding.evidence_state)) errors.push(`${entity.country_id} has unknown evidence state`);
    if (!entity.onboarding.reason_codes.length) errors.push(`${entity.country_id} onboarding requires a reason`);
    errors.push(...enumErrors(entity.onboarding.reason_codes, enums.reason_codes, `${entity.country_id}.onboarding`));
    for (const field of ['region', 'subregion', 'un_membership', 'unfccc_party', 'territory_status', 'geometry']) {
      const claim = entity[field];
      if (claim.status === 'not_reviewed' && (claim.value !== null || claim.source_id !== null)) {
        errors.push(`${entity.country_id}.${field}: not_reviewed must preserve null value and source`);
      }
      if (!enums.reason_codes.includes(claim.reason_code)) errors.push(`${entity.country_id}.${field} has unknown reason code`);
    }
    for (const field of ['ldc', 'lldc', 'sids']) {
      const claim = entity.groups[field];
      if (claim.status !== 'not_reviewed' || claim.value !== null || claim.source_id !== null) errors.push(`${entity.country_id}.groups.${field} must remain null/not_reviewed`);
      if (!enums.reason_codes.includes(claim.reason_code)) errors.push(`${entity.country_id}.groups.${field} has unknown reason code`);
    }
    if (entity.assessment_eligibility.status !== 'not_reviewed' || entity.assessment_eligibility.eligible !== null || entity.assessment_eligibility.source_id !== null) errors.push(`${entity.country_id} assessment eligibility must remain explicit and not_reviewed`);
    errors.push(...enumErrors(entity.assessment_eligibility.reason_codes, enums.reason_codes, `${entity.country_id}.assessment_eligibility`));
  }
  for (const file of [registry.source.licence.notice_file, registry.source.licence.licence_file, registry.separable_asset.transformation_source]) {
    if (!fs.existsSync(path.join(ROOT, file))) errors.push(`required identity notice/source file is missing: ${file}`);
  }
  for (const [fileField, checksumField] of [['notice_file', 'notice_sha256'], ['licence_file', 'licence_sha256']]) {
    const file = path.join(ROOT, registry.source.licence[fileField]);
    if (fs.existsSync(file) && crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== registry.source.licence[checksumField]) {
      errors.push(`${fileField} checksum does not match registry metadata`);
    }
  }
  return errors;
}

const AVAILABLE_STATES = new Set(['available', 'estimated', 'modeled', 'stale', 'conflicting']);

function validateObservation(observation, schema, enums, countryIds) {
  const errors = validateSchema(observation, schema);
  if (!countryIds.has(observation.country_id)) errors.push(`unknown country_id ${observation.country_id}`);
  if (observation.evidence.class === 'independent_assessment' && observation.scope.plane !== 'independent') {
    errors.push('independent_assessment requires the independent evidence plane');
  }
  if (observation.scope.plane === 'independent' && observation.evidence.class !== 'independent_assessment') {
    errors.push('independent evidence plane requires independent_assessment class');
  }
  const value = observation.value;
  if (value === null) {
    if (AVAILABLE_STATES.has(observation.evidence.state)) errors.push('null value requires an explicit unavailable evidence state');
    if (!observation.evidence.reason_codes.length) errors.push('null value requires a reason code');
  } else {
    if (!AVAILABLE_STATES.has(observation.evidence.state)) errors.push('non-null value requires an available, estimated, modeled, stale, or conflicting state');
    if (typeof value !== observation.value_type) errors.push(`value does not match value_type ${observation.value_type}`);
  }
  if (observation.value_type === 'number' && !observation.unit) errors.push('numeric observation requires a unit even when value is null');
  if (observation.value_type === 'boolean' && observation.unit !== null) errors.push('boolean observation unit must be null');
  errors.push(...enumErrors(observation.evidence.reason_codes, enums.reason_codes, `${observation.fact_id}.evidence`));
  const needsDerivation = ['derived', 'modeled'].includes(observation.evidence.class);
  if (needsDerivation && !observation.derivation) errors.push('derived or modeled fact requires derivation with input IDs and formula version');
  if (!needsDerivation && observation.derivation !== null) errors.push('non-derived fact must have null derivation');
  if (observation.derivation) {
    if (!observation.derivation.input_fact_ids.length) errors.push('derived fact requires input_fact_ids');
    if (!observation.derivation.formula_version) errors.push('derived fact requires formula_version');
  }
  if (observation.evidence.uncertainty && observation.evidence.uncertainty.lower > observation.evidence.uncertainty.upper) {
    errors.push('uncertainty lower bound exceeds upper bound');
  }
  if (observation.review.status === 'reviewed' && (!observation.review.reviewer_id || !observation.review.reviewed_at)) {
    errors.push('reviewed observation requires reviewer_id and reviewed_at');
  }
  return errors;
}

function isQuantity(value) {
  return value && typeof value.amount === 'number' && Number.isFinite(value.amount) && typeof value.unit === 'string' && value.unit.length > 0;
}

function validateTarget(target, schema, enums, countryIds) {
  const errors = validateSchema(target, schema);
  if (!countryIds.has(target.country_id)) errors.push(`unknown country_id ${target.country_id}`);
  errors.push(...enumErrors(target.comparability.reason_codes, enums.reason_codes, `${target.target_id}.comparability`));
  const comparable = target.comparability.status === 'comparable';
  if (comparable && target.comparability.reason_codes.length) errors.push('comparable target must not carry failure reason codes');
  if (!comparable && !target.comparability.reason_codes.length) errors.push('non-comparable or unassessed target requires reason codes');
  if (target.review.status === 'reviewed') {
    if (!target.review.extractor_id || !target.review.reviewer_id || !target.review.reviewed_at) errors.push('reviewed target requires extractor, independent reviewer, and reviewed_at');
    if (target.review.extractor_id === target.review.reviewer_id) errors.push('reviewer must differ from extractor');
  }

  switch (target.target_type) {
    case 'base_year':
      if (comparable && (!target.target_year || typeof target.reduction_pct !== 'number' || !target.reference || !target.reference.year || !isQuantity(target.reference.value) || !target.reference.fact_id)) {
        errors.push('comparable base-year target requires target year, reduction, and sourced reference year/value');
      }
      break;
    case 'bau':
      if (comparable && (!target.target_year || typeof target.reduction_pct !== 'number' || !target.bau || !target.bau.scenario_id || !target.bau.vintage || !isQuantity(target.bau.target_year_value) || !target.bau.source_fact_id)) {
        errors.push('comparable BAU target requires scenario, vintage, target-year value, and source fact');
      }
      break;
    case 'intensity':
      if (comparable && (!target.target_year || typeof target.reduction_pct !== 'number' || !target.intensity || !target.intensity.denominator_metric || !target.intensity.denominator_unit || !target.intensity.target_year_denominator_fact_id)) {
        errors.push('comparable intensity target requires denominator metric, unit, and target-year denominator fact');
      }
      break;
    case 'fixed_level':
      if (comparable && (!target.target_year || !isQuantity(target.target_value))) errors.push('comparable fixed-level target requires target_value and target year');
      break;
    case 'trajectory':
      if (comparable && (!target.trajectory || target.trajectory.pathway_fact_ids.length < 2)) errors.push('comparable trajectory target requires pathway facts');
      break;
    case 'peaking':
      if (!target.peak_year) errors.push('peaking target requires peak_year');
      break;
    case 'sectoral':
      if (comparable) errors.push('sectoral target cannot be economy-wide comparable');
      if (!target.scope.sectors.length || !target.statement) errors.push('sectoral target requires sectors and statement');
      break;
    case 'qualitative':
      if (comparable) errors.push('qualitative target cannot be quantitatively comparable');
      if (!target.statement) errors.push('qualitative target requires statement');
      break;
    case 'net_zero':
      if (comparable && (!target.target_year || !target.net_zero || !isQuantity(target.net_zero.residual_emissions) || !target.net_zero.removals_treatment || !target.net_zero.offsets_treatment || !target.scope.gases.length || !target.scope.sectors.length)) {
        errors.push('comparable net-zero target requires details for residuals, removals, offsets, gases, sectors, and year');
      }
      break;
    default:
      break;
  }
  if (comparable) {
    if (!target.scope.gases.length) errors.push('comparable target requires gas basket');
    if (!target.scope.sectors.length) errors.push('comparable target requires sector coverage');
    if (!target.scope.geography) errors.push('comparable target requires geography');
    if (!target.scope.gwp_convention) errors.push('comparable target requires GWP convention');
    if (target.scope.lulucf === 'not_reported') errors.push('comparable target requires LULUCF treatment');
    if (!target.scope.article6_treatment) errors.push('comparable target requires Article 6 treatment');
    if (!target.comparability.reviewed_against_fact_ids.length) errors.push('comparable target requires reviewed comparison facts');
  }
  return errors;
}

function validateProfile(profile, schema, enums, countryIds) {
  const errors = validateSchema(profile, schema);
  if (!countryIds.has(profile.country_id)) errors.push(`unknown country_id ${profile.country_id}`);
  errors.push(...enumErrors(profile.headline.reason_codes, enums.reason_codes, `${profile.profile_id}.headline`));
  for (const [axisName, axis] of Object.entries(profile.axes)) {
    errors.push(...enumErrors(axis.reason_codes, enums.reason_codes, `${profile.profile_id}.${axisName}`));
    if ((axis.status === 'not_assessed' || axis.status === 'D') && !axis.reason_codes.length) errors.push(`${axisName} requires reason codes for ${axis.status}`);
  }
  if (profile.headline.status === 'available' && (profile.axes.ambition.status === 'not_assessed' || profile.axes.delivery.status === 'not_assessed')) {
    errors.push('headline must be withheld when ambition or delivery is not assessed');
  }
  return errors;
}

function validateRelease(release, schema) {
  const errors = validateSchema(release, schema);
  const coverage = release.coverage;
  if (coverage.profiles > coverage.registry_entities) errors.push('profile coverage exceeds registry universe');
  if (coverage.release_eligible > coverage.profiles) errors.push('release_eligible exceeds profile count');
  if (release.review.status === 'reviewed') {
    if (!release.review.reviewer_ids.length || !release.review.reviewed_at) errors.push('reviewed release requires reviewers and reviewed_at');
    if (release.review.reviewer_ids.includes(release.review.builder_id)) errors.push('release builder cannot self-review');
  }
  return errors;
}

function applyMutations(base, mutations = []) {
  const value = structuredClone(base);
  for (const mutation of mutations) {
    const parts = mutation.path.split('/').slice(1).map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
    const key = parts.pop();
    const parent = parts.reduce((node, part) => node[part], value);
    if (mutation.op === 'set') parent[key] = mutation.value;
    else if (mutation.op === 'delete') delete parent[key];
    else throw new Error(`Unknown fixture mutation ${mutation.op}`);
  }
  return value;
}

function assertNoErrors(label, errors) {
  if (errors.length) throw new Error(`${label} failed validation:\n  - ${errors.join('\n  - ')}`);
}

const schemas = {
  registry: readJson(path.join(SCHEMAS, 'country-registry.schema.json')),
  observation: readJson(path.join(SCHEMAS, 'observation.schema.json')),
  target: readJson(path.join(SCHEMAS, 'target.schema.json')),
  profile: readJson(path.join(SCHEMAS, 'profile.schema.json')),
  release: readJson(path.join(SCHEMAS, 'release.schema.json'))
};
const enums = readJson(path.join(SCHEMAS, 'enums.json'));
const registry = readJson(path.join(CLIMATE, 'country-registry.json'));
const valid = readJson(path.join(FIXTURES, 'valid-evidence.json'));
const invalid = readJson(path.join(FIXTURES, 'invalid-evidence.json'));
const countryIds = new Set(registry.entities.map((entity) => entity.country_id));

for (const [name, values] of Object.entries(enums)) {
  if (name === 'schema_version') continue;
  if (!Array.isArray(values) || new Set(values).size !== values.length) throw new Error(`Enum ${name} must be a unique array`);
}

assertNoErrors('country registry', validateRegistry(registry, schemas.registry, enums));
valid.observations.forEach((item, index) => assertNoErrors(`valid observation ${index}`, validateObservation(item, schemas.observation, enums, countryIds)));
valid.targets.forEach((item, index) => assertNoErrors(`valid target ${index}`, validateTarget(item, schemas.target, enums, countryIds)));
assertNoErrors('valid profile', validateProfile(valid.profile, schemas.profile, enums, countryIds));
assertNoErrors('valid release', validateRelease(valid.release, schemas.release));

for (const testCase of invalid.cases) {
  let errors;
  if (testCase.kind === 'observation') {
    errors = validateObservation(applyMutations(valid.observations[testCase.base_index], testCase.mutations), schemas.observation, enums, countryIds);
  } else if (testCase.kind === 'target') {
    errors = validateTarget(applyMutations(valid.targets[testCase.base_index], testCase.mutations), schemas.target, enums, countryIds);
  } else if (testCase.kind === 'profile') {
    errors = validateProfile(applyMutations(valid.profile, testCase.mutations), schemas.profile, enums, countryIds);
  } else if (testCase.kind === 'registry_duplicate') {
    const duplicate = structuredClone(registry);
    duplicate.entities.push(structuredClone(duplicate.entities[0]));
    duplicate.entity_count += 1;
    errors = validateRegistry(duplicate, schemas.registry, enums);
  } else if (testCase.kind === 'registry_overlay_bypass') {
    const bypass = structuredClone(registry);
    bypass.publication_gates.assessment_overlays.release_eligible = true;
    errors = validateRegistry(bypass, schemas.registry, enums);
  } else {
    throw new Error(`Unknown invalid fixture kind ${testCase.kind}`);
  }
  if (!errors.length) throw new Error(`Invalid fixture unexpectedly passed: ${testCase.name}`);
  if (!errors.some((error) => error.includes(testCase.expected_error))) {
    throw new Error(`Invalid fixture did not produce expected error: ${testCase.name}\nExpected: ${testCase.expected_error}\nActual: ${errors.join('; ')}`);
  }
}

const sourceArgIndex = process.argv.indexOf('--source');
if (sourceArgIndex !== -1) {
  const sourcePath = process.argv[sourceArgIndex + 1];
  if (!sourcePath) throw new Error('--source requires the pinned Debian iso_3166-1.json path');
  const checksum = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
  if (checksum !== registry.source.checksum_sha256) throw new Error(`Debian iso-codes source checksum mismatch: ${checksum}`);
}

if (process.argv.includes('--require-release-eligible') && registry.publication_gates.identity_redistribution.release_eligible !== true) {
  process.stderr.write('Identity release blocked: Debian iso-codes redistribution gate is not eligible.\n');
  process.exit(1);
}
if (process.argv.includes('--require-assessment-overlays') && registry.publication_gates.assessment_overlays.release_eligible !== true) {
  process.stderr.write('Assessment release blocked: eligibility, membership, Party, development-group, territory, region, and geometry overlays are not reviewed.\n');
  process.exit(1);
}

process.stdout.write([
  'Country evidence contracts: PASS',
  `  registry entities: ${registry.entity_count}`,
  `  ISO alpha-3 codes: ${registry.entities.filter((entity) => entity.iso_alpha3).length}`,
  `  assessment eligibility not reviewed: ${registry.entities.filter((entity) => entity.assessment_eligibility.status === 'not_reviewed').length}`,
  `  identity redistribution eligible: ${registry.publication_gates.identity_redistribution.release_eligible}`,
  `  assessment overlays eligible: ${registry.publication_gates.assessment_overlays.release_eligible}`,
  `  valid observations / targets: ${valid.observations.length} / ${valid.targets.length}`,
  `  invalid cases rejected: ${invalid.cases.length}`,
  `  source checksum: ${registry.source.checksum_sha256}`
].join('\n') + '\n');
