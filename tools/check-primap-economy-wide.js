#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  CONFIG,
  parseCsvLine,
  gigagramToMegatonne,
  gigagramTextToMegatonneDecimal,
  classifyArea,
  buildCoverage,
  assertPinnedSource,
  readSelectedRows,
  buildArtifact,
  calculationHash,
} = require('./lib/primap-hist-ingest');
const { compileAllObservations } = require('./lib/primap-observation-boundary');

const ROOT = path.join(__dirname, '..');
const ARTIFACT_PATH = path.join(ROOT, 'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json');
const MANIFEST_PATH = path.join(ROOT, 'data/climate/releases/primap-hist-2.6.1-economy-wide-2026-07-15.json');
const FIXTURE_PATH = path.join(ROOT, 'data/climate/fixtures/primap-ingest.json');
const DEFAULT_SOURCE = '/tmp/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv';

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
  if (!ref.startsWith('#/')) throw new Error(`only local schema references are supported: ${ref}`);
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
  if (Object.prototype.hasOwnProperty.call(schema, 'const') && !same(value, schema.const)) errors.push(`${at} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some(item => same(item, value))) errors.push(`${at} is outside enum`);
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : null;
  if (types && !types.some(type => typeMatches(value, type))) return [`${at} must have type ${types.join('|')}`];
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at} is too short`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) errors.push(`${at} does not match ${schema.pattern}`);
    if (schema.format && !validFormat(value, schema.format)) errors.push(`${at} is not a valid ${schema.format}`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${at} is below minimum`);
  if (typeof value === 'number' && schema.maximum !== undefined && value > schema.maximum) errors.push(`${at} is above maximum`);
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at} has too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at} has too many items`);
    if (schema.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at} contains duplicate items`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, rootSchema, `${at}[${index}]`)));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    (schema.required || []).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${at}.${key} is required`);
    });
    Object.entries(value).forEach(([key, item]) => {
      if (properties[key]) errors.push(...validateSchema(item, properties[key], rootSchema, `${at}.${key}`));
      else if (schema.additionalProperties === false && key !== '$defs') errors.push(`${at}.${key} is not allowed`);
    });
  }
  return errors;
}

async function main() {
  const committedOnly = process.argv.includes('--committed-only');
  const sourcePath = process.argv.slice(2).find(argument => !argument.startsWith('--')) || DEFAULT_SOURCE;
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert(fixture._meta.fictional_entities === true, 'parser fixtures must remain fictional');

  fixture.csv_lines.forEach(item => assert(JSON.stringify(parseCsvLine(item.line)) === JSON.stringify(item.expected), 'quoted CSV parser fixture failed'));
  fixture.unit_cases.forEach(item => {
    assert(Object.is(gigagramToMegatonne(item.source_ggco2e), item.expected_mtco2e), `unit conversion fixture failed for ${item.id}`);
    const decimal = item.source_text === null ? null : gigagramTextToMegatonneDecimal(item.source_text);
    assert(decimal === item.expected_decimal, `decimal conversion fixture failed for ${item.id}`);
    if (decimal !== null) assert(JSON.stringify(Number(decimal)) === JSON.stringify(item.expected_mtco2e), `JSON serialization fixture failed for ${item.id}`);
  });
  const fictionalRegistry = new Set(fixture.classification.registry_iso3);
  fixture.classification.cases.forEach(item => assert(classifyArea(item.area, fictionalRegistry) === item.expected, `classification fixture failed for ${item.area}`));
  const fictionalSeries = new Map(fixture.coverage.mapped_series.map(item => [item.country_id, item]));
  const fictionalCoverage = buildCoverage(fixture.coverage.registry, fictionalSeries);
  Object.entries(fixture.coverage.expected_states).forEach(([countryId, state]) => {
    assert(fictionalCoverage.find(item => item.country_id === countryId)?.state === state, `coverage fixture failed for ${countryId}`);
  });

  let selected = null;
  if (!committedOnly) {
    assertPinnedSource(sourcePath);
    ({ selected } = await readSelectedRows(sourcePath));
    assert(selected.length === CONFIG.source_row_count, `selected source rows must be ${CONFIG.source_row_count}`);
    assert(selected.filter(item => item.row['2023'] !== '').length === CONFIG.source_2023_nonempty, `2023 nonempty source rows must be ${CONFIG.source_2023_nonempty}`);
  }

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/country-registry.json'), 'utf8'));
  const enums = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/enums.json'), 'utf8'));
  const batchSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/primap-batch-candidate.schema.json'), 'utf8'));
  const observationSchema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/observation.schema.json'), 'utf8'));
  const registryIds = new Set(registry.entities.map(item => item.country_id));
  const rebuiltArtifact = committedOnly ? null : buildArtifact(registry, selected, artifact.created_at);

  const batchSchemaErrors = validateSchema(artifact, batchSchema);
  assert(batchSchemaErrors.length === 0, `batch candidate schema failed: ${batchSchemaErrors.slice(0, 5).join('; ')}`);
  assert(artifact.schema_ref === 'data/climate/schemas/primap-batch-candidate.schema.json', 'batch schema_ref mismatch');
  if (!committedOnly) {
    assert(JSON.stringify(rebuiltArtifact) === JSON.stringify(artifact), 'artifact is not an exact deterministic rebuild of the pinned source');
  }
  assert(artifact.calculation_hash === calculationHash(artifact), 'artifact calculation hash mismatch');
  assert(manifest.calculation_hash === calculationHash(manifest), 'manifest calculation hash mismatch');
  assert(manifest.artifact.checksum_sha256 === hashFile(ARTIFACT_PATH), 'manifest artifact checksum mismatch');
  assert(manifest.artifact.schema_ref === artifact.schema_ref, 'manifest must identify the batch schema boundary');
  assert(manifest.input_hash_sha256 === CONFIG.source_sha256, 'manifest input hash mismatch');
  assert(artifact.source.input_hash_sha256 === CONFIG.source_sha256, 'artifact input hash mismatch');
  assert(artifact.source.source_decision_introducing_commit_sha === 'd49b7d062e3805fd50c158bfa3b8f31a0115ff2f', 'source decision introducing commit mismatch');
  assert(artifact.source.source_registry_reviewed_state_commit_sha === '8b99e70829ea5d6182fc1c05ec6d8c6ffa3eb8f2', 'source registry reviewed-state commit mismatch');
  assert(fs.statSync(ARTIFACT_PATH).size < 10 * 1024 * 1024, 'normalized artifact must remain below 10MB');

  assert(artifact.selection.scenario === 'HISTTP', 'scenario must remain HISTTP');
  assert(artifact.selection.evidence_plane === 'harmonized', 'PRIMAP HISTTP must remain harmonized');
  assert(artifact.selection.official_plane_claimed === false, 'PRIMAP HISTTP must never claim official plane');
  assert(artifact.selection.histcr_included === false, 'HISTCR must remain separate');
  assert(artifact.selection.entity === 'KYOTOGHG (AR6GWP100)', 'gas/GWP entity changed');
  assert(artifact.selection.category === 'M.0.EL', 'category changed');
  assert(artifact.selection.lulucf === 'excluded', 'LULUCF treatment changed');
  assert(artifact.selection.international_bunkers === 'not_specified_for_selected_category', 'international-bunker uncertainty must remain explicit');
  assert(artifact.selection.uncertainty.status === 'not_provided_in_selected_rows', 'source uncertainty absence must remain explicit');
  assert(artifact.selection.formula === 'value_mtco2e = source_value_ggco2e / 1000', 'unit formula changed');
  assert(artifact.source.licence === 'CC-BY-4.0' && artifact.source.attribution.includes('Gütschow'), 'licence or attribution missing');

  assert(artifact.review.status === 'not_reviewed' && artifact.review.reviewer_id === null, 'real values must remain not_reviewed');
  assert(artifact.review.builder_id !== artifact.review.reviewer_id, 'artifact builder and reviewer identities must remain separate');
  assert(artifact.publication_gates.assessed_use.allowed === false, 'assessed use must fail closed');
  assert(artifact.publication_gates.scoring.allowed === false, 'scoring must fail closed');
  assert(artifact.publication_gates.scoring.reason_codes.includes('independent_review_required'), 'scoring denial must require independent review');
  assert(artifact.publication_gates.candidate_redistribution.allowed === true && artifact.publication_gates.candidate_redistribution.reviewed_site_release === false, 'candidate redistribution must remain distinct from reviewed site release');
  assert(manifest.gates.candidate_redistribution_allowed === true && manifest.gates.reviewed_site_release_allowed === false, 'manifest release boundary mismatch');
  assert(manifest.coverage.release_eligible === 0 && manifest.coverage.scoring_eligible === 0, 'release/scoring eligibility must be zero');
  assert(!manifest.review.reviewer_ids.includes(manifest.review.builder_id), 'manifest builder cannot review the release');
  assert(manifest.gates.ct40_required_result === 'deny_not_reviewed', 'CT-40 required denial is missing');
  assert(Object.values(artifact.forbidden_outputs).every(value => value === false), 'artifact assigned a forbidden assessment output');

  assert(artifact.source_row_audit.selected_rows === 215, 'source row audit mismatch');
  assert(artifact.source_row_audit.nonempty_2023 === 215, '2023 audit mismatch');
  assert(artifact.source_row_audit.mapped_country_rows === 206, 'mapped row count mismatch');
  assert(artifact.source_row_audit.aggregate_rows === 8, 'aggregate row count mismatch');
  assert(artifact.source_row_audit.obsolete_rows === 1, 'obsolete row count mismatch');
  assert(artifact.source_row_audit.unmapped_rows === 0, 'unmapped row count mismatch');
  assert(artifact.registry_coverage.length === 249, 'all registry entities need a state');
  assert(artifact.registry_coverage.filter(item => item.state === 'source_unavailable').length === 43, 'registry gap count mismatch');
  assert(artifact.registry_coverage.every(item => enums.evidence_states.includes(item.state)), 'coverage uses a non-canonical CT-02 evidence state');
  assert(artifact.registry_coverage.every(item => item.reason_codes.every(code => enums.reason_codes.includes(code))), 'coverage uses a non-canonical CT-02 reason code');
  assert(artifact.registry_coverage.every(item => registryIds.has(item.country_id)), 'coverage contains a non-canonical country ID');
  assert(artifact.series.length === 206, 'series count mismatch');
  assert(new Set(artifact.series.map(item => item.country_id)).size === 206, 'series country IDs must be unique');
  assert(artifact.series.every(item => registryIds.has(item.country_id)), 'series contains a non-canonical country ID');
  assert(artifact.series.every(item => item.review_status === 'not_reviewed' && item.release_eligible === false && item.scoring_eligible === false), 'series review gate mismatch');
  assert(artifact.series.every(item => item.reason_codes.every(code => enums.reason_codes.includes(code))), 'series uses a non-canonical CT-02 reason code');
  assert(artifact.series.every(item => item.values.length === 10), 'each series must cover 2014–2023');

  const normalizedFactIds = artifact.series.flatMap(item => item.values.map(value => value.fact_id));
  const sourceFactIds = artifact.series.flatMap(item => item.values.map(value => value.source_fact_id));
  const combinedFactIds = normalizedFactIds.concat(sourceFactIds);
  assert(normalizedFactIds.length === 2060 && new Set(normalizedFactIds).size === 2060, '2,060 normalized fact IDs must be globally unique');
  assert(combinedFactIds.length === 4120 && new Set(combinedFactIds).size === 4120, '4,120 source and normalized fact IDs must be globally unique');

  const nru2014 = artifact.series.find(item => item.iso_alpha3 === 'NRU')?.values.find(value => value.year === 2014);
  assert(nru2014?.source_value_text === '53.7' && nru2014?.normalized_value_decimal === '0.0537' && JSON.stringify(nru2014?.value_mtco2e) === '0.0537', 'NRU 2014 must serialize exactly as 0.0537 MtCO2e');
  const ata2023 = artifact.series.find(item => item.iso_alpha3 === 'ATA')?.values.find(value => value.year === 2023);
  assert(ata2023?.source_value_text === '3.34' && ata2023?.normalized_value_decimal === '0.00334' && JSON.stringify(ata2023?.value_mtco2e) === '0.00334', 'ATA 2023 decimal conversion mismatch');

  if (!committedOnly) {
    const rebuiltValues = new Map(selected.map(item => [item.row['area (ISO3)'], item]));
    artifact.series.forEach(series => {
      const source = rebuiltValues.get(series.iso_alpha3);
      assert(source && source.csv_row === series.source_locator.csv_row, `${series.iso_alpha3} locator mismatch`);
      assert(JSON.stringify(series.source_locator.row_key) === JSON.stringify({
        source: source.row.source,
        scenario: source.row['scenario (PRIMAP-hist)'],
        provenance: source.row.provenance,
        area: source.row['area (ISO3)'],
        entity: source.row.entity,
        unit: source.row.unit,
        category: source.row['category (IPCC2006_PRIMAP)'],
      }), `${series.iso_alpha3} row key mismatch`);
      series.values.forEach(value => {
        const sourceText = source.row[String(value.year)];
        const sourceNumber = sourceText === '' ? null : Number(sourceText);
        const normalizedDecimal = sourceText === '' ? null : gigagramTextToMegatonneDecimal(sourceText);
        assert(value.source_value_text === (sourceText === '' ? null : sourceText), `${series.iso_alpha3} ${value.year} source text mismatch`);
        assert(Object.is(value.source_value_ggco2e, sourceNumber), `${series.iso_alpha3} ${value.year} source value mismatch`);
        assert(value.normalized_value_decimal === normalizedDecimal, `${series.iso_alpha3} ${value.year} normalized decimal mismatch`);
        assert(Object.is(value.value_mtco2e, normalizedDecimal === null ? null : Number(normalizedDecimal)), `${series.iso_alpha3} ${value.year} normalized value mismatch`);
        const sourceFactId = `fact:primap-hist-2.6.1:source:histtp:m0el:${series.iso_alpha3.toLowerCase()}:${value.year}`;
        assert(value.source_fact_id === sourceFactId, `${series.iso_alpha3} ${value.year} source fact ID mismatch`);
        assert(value.fact_id === `fact:primap-hist-2.6.1:normalized:histtp:m0el:${series.iso_alpha3.toLowerCase()}:${value.year}`, `${series.iso_alpha3} ${value.year} fact ID mismatch`);
        assert(JSON.stringify(value.input_fact_ids) === JSON.stringify([sourceFactId]), `${series.iso_alpha3} ${value.year} input lineage mismatch`);
      });
    });
  }

  const observations = compileAllObservations(artifact);
  assert(observations.length === 2060, 'boundary compiler must emit 2,060 CT-02 observations');
  observations.forEach((observation, index) => {
    const errors = validateSchema(observation, observationSchema);
    assert(errors.length === 0, `CT-02 observation ${index} failed schema: ${errors.slice(0, 3).join('; ')}`);
    assert(registryIds.has(observation.country_id), `CT-02 observation ${index} has unknown country ID`);
    assert(observation.scope.plane === 'harmonized' && observation.evidence.class === 'harmonized_estimate', `CT-02 observation ${index} changed evidence plane/class`);
    assert(observation.review.status === 'not_reviewed' && observation.review.reviewer_id === null, `CT-02 observation ${index} crossed the review gate`);
    assert(observation.evidence.reason_codes.every(code => enums.reason_codes.includes(code)), `CT-02 observation ${index} has non-canonical reason`);
  });

  const mode = committedOnly ? 'committed candidate; raw-source rebuild not run' : 'pinned raw-source rebuild';
  console.log(`PRIMAP CT-10B: PASS (${mode}; 215 source rows; 206 mapped; 8 aggregates; 1 obsolete; 0 unmapped; 43 registry gaps; 2,060 CT-02 boundary observations; 4,120 unique fact IDs; ${fs.statSync(ARTIFACT_PATH).size} bytes)`);
}

main().catch(error => {
  console.error(`PRIMAP CT-10B: FAIL — ${error.message}`);
  process.exit(1);
});
