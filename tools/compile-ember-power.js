#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  ENTITY_COUNT,
  ROOT,
  assertEntityPartition,
  assertSourceApproved,
  gapMetric,
  loadCountryRegistry,
  option,
  readCsvSnapshot,
  readJson,
  round,
  scopeFingerprint,
  verifySnapshot,
  writeJson,
} = require('./lib/country-climate-intelligence');

const SOURCE_ID = 'ember-yearly-electricity-data-2026-08-24';
const METRIC_CONFIG = {
  'electricity.clean_share': { aliases: ['Clean', 'Clean share'], category: 'Electricity generation', unit: '%', frame: 'national_electricity_generation', gases: [] },
  'electricity.fossil_share': { aliases: ['Fossil', 'Fossil share'], category: 'Electricity generation', unit: '%', frame: 'national_electricity_generation', gases: [] },
  'electricity.wind_solar_share': { aliases: ['Wind and solar', 'Wind & solar'], category: 'Electricity generation', unit: '%', frame: 'national_electricity_generation', gases: [] },
  'electricity.carbon_intensity': { aliases: ['Carbon intensity'], category: 'Electricity generation', unit: 'gCO2/kWh', frame: 'national_electricity_generation', gases: ['CO2'] },
  'electricity.emissions': { aliases: ['Total', 'Power sector emissions'], category: 'Power sector emissions', unit: 'MtCO2/yr', frame: 'national_electricity_generation', gases: ['CO2'] },
};

function field(row, names) {
  for (const name of names) if (row[name] !== undefined && row[name] !== '') return row[name];
  return '';
}

function metricRecord(entity, metricId, value, year, config, transformation = 'source_value_selected_without_derivation') {
  const period = metricId === 'electricity.clean_share_change_5y' ? '2019–2024 change' : String(year);
  const scope = {
    accounting_frame: config.frame,
    gases: config.gases,
    geography: 'registry_entity_electricity_system',
    gwp: 'not_applicable_single_gas',
    lulucf_treatment: 'not_applicable',
    metric: metricId,
    period,
    sectors: ['power'],
    taxonomy: 'ember_published_aggregate_fuel',
    unit: config.unit,
  };
  return {
    context: { source_evidence_class: 'annual_actual', taxonomy: 'Ember published aggregate fuel taxonomy' },
    fact_ids: [`ember:${entity.iso_alpha3}:${metricId}:${metricId.endsWith('_5y') ? '2019-2024' : year}`],
    gap_reason: null,
    id: metricId,
    period: metricId.endsWith('_5y')
      ? { end: 2024, label: '2019–2024 change', start: 2019 }
      : { end: year, label: String(year), start: year },
    review_state: 'compiler_candidate_requires_scientific_review',
    scope,
    scope_fingerprint: scopeFingerprint(scope),
    source_ids: [SOURCE_ID],
    status: 'actual',
    transformation,
    uncertainty: { kind: 'not_provided_in_release', lower: null, upper: null },
    unit: config.unit,
    value: round(value),
  };
}

function compile(args) {
  const inputPath = path.resolve(option(args, '--input'));
  const receipt = readJson(path.resolve(option(args, '--receipt')));
  const outputPath = path.resolve(option(args, '--output'));
  if (receipt.source_registry_id !== SOURCE_ID || receipt.year_status_2024 !== 'actual') {
    throw new Error('Ember receipt must pin the reviewed source and classify 2024 comparison rows as actual');
  }
  verifySnapshot(inputPath, receipt);
  const sourceRegistry = readJson(path.join(ROOT, 'data/climate/source-registry.json'));
  assertSourceApproved(sourceRegistry, SOURCE_ID, [
    'Entity', 'Entity code', 'Area', 'ISO 3 code', 'Year', 'Category', 'Variable', 'Unit', 'Value', 'Evidence class',
  ]);
  const registry = loadCountryRegistry();
  const registryByIso3 = new Map(registry.entities.map(entity => [entity.iso_alpha3, entity]));
  const rows = readCsvSnapshot(inputPath);
  const exceptions = new Map((receipt.identity_exceptions || []).map(exception => [exception.upstream_id, exception]));
  const values = new Map();
  const dispositions = [];
  for (const [index, row] of rows.entries()) {
    const year = Number(field(row, ['Year']));
    if (![2019, 2024].includes(year)) continue;
    const variable = field(row, ['Variable']);
    const category = field(row, ['Category']);
    const metricEntry = Object.entries(METRIC_CONFIG).find(([, config]) => config.aliases.includes(variable) && config.category === category);
    if (!metricEntry) continue;
    const [metricId, config] = metricEntry;
    if (year === 2019 && metricId !== 'electricity.clean_share') continue;
    const iso3 = field(row, ['Entity code', 'ISO 3 code']);
    const upstreamId = field(row, ['Upstream id']) || `${iso3 || 'aggregate'}:${category}:${variable}:${year}:${index}`;
    const entity = registryByIso3.get(iso3);
    if (!entity) {
      const exception = exceptions.get(upstreamId);
      if (!exception || !['aggregate_exception', 'territory_exception', 'unmapped_exception'].includes(exception.kind) || !exception.reason) {
        throw new Error(`Ember upstream row ${upstreamId} has no mapping or enumerated exception`);
      }
      dispositions.push({ [exception.kind]: exception.reason, upstream_id: upstreamId });
      continue;
    }
    const evidenceClass = field(row, ['Evidence class']) || receipt.default_evidence_class;
    if (evidenceClass !== 'actual') throw new Error(`Ember comparison input ${upstreamId} is not actual-year evidence`);
    let unit = field(row, ['Unit']);
    let value = Number(field(row, ['Value']));
    if (!Number.isFinite(value)) throw new Error(`Ember upstream row ${upstreamId} has a non-finite value`);
    if (metricId === 'electricity.emissions' && ['mtCO2', 'MtCO2', 'MtCO2e'].includes(unit)) unit = 'MtCO2/yr';
    if (unit !== config.unit) throw new Error(`Ember ${metricId} unit mismatch: expected ${config.unit}, received ${unit}`);
    if (config.unit === '%' && (value < 0 || value > 100)) throw new Error(`Ember share outside 0–100 for ${iso3}`);
    const key = `${metricId}:${year}`;
    const countryValues = values.get(iso3) || new Map();
    if (countryValues.has(key)) throw new Error(`Duplicate Ember ${key} value for ${iso3}`);
    countryValues.set(key, value);
    values.set(iso3, countryValues);
    dispositions.push({ country_id: entity.country_id, upstream_id: upstreamId });
  }
  const unusedExceptions = [...exceptions.keys()].filter(id => !dispositions.some(item => item.upstream_id === id));
  if (unusedExceptions.length) throw new Error(`Ember receipt contains unused identity exceptions: ${unusedExceptions.join(', ')}`);

  const countries = registry.entities.map(entity => {
    const countryValues = values.get(entity.iso_alpha3) || new Map();
    const metrics = {};
    for (const [metricId, config] of Object.entries(METRIC_CONFIG)) {
      const value = countryValues.get(`${metricId}:2024`);
      metrics[metricId] = value === undefined
        ? gapMetric(metricId, SOURCE_ID, 'exact_period_missing', `Ember has no exact 2024 ${metricId} value for this entity.`)
        : metricRecord(entity, metricId, value, 2024, config);
    }
    const start = countryValues.get('electricity.clean_share:2019');
    const end = countryValues.get('electricity.clean_share:2024');
    const changeConfig = { ...METRIC_CONFIG['electricity.clean_share'], unit: 'percentage points' };
    metrics['electricity.clean_share_change_5y'] = start === undefined || end === undefined
      ? gapMetric('electricity.clean_share_change_5y', SOURCE_ID, 'matched_endpoint_missing', 'The 2019 and 2024 clean-share endpoints are not both available.')
      : metricRecord(entity, 'electricity.clean_share_change_5y', end - start, 2024, changeConfig, 'clean_share_2024_minus_clean_share_2019');
    return { country_id: entity.country_id, iso_alpha3: entity.iso_alpha3, metrics };
  });
  assertEntityPartition(countries, dispositions);
  const artifact = {
    artifact_type: 'normalized_country_climate_component',
    countries,
    entity_count: ENTITY_COUNT,
    generated_on: receipt.retrieved_on,
    identity_accounting: { dispositions, rule: 'Every selected exact-period aggregate row maps once or has one enumerated exception.' },
    input_receipt: receipt,
    metric_ids: [...Object.keys(METRIC_CONFIG), 'electricity.clean_share_change_5y'],
    review_state: 'compiler_candidate_requires_scientific_review',
    schema_version: '1.0.0',
    source_registry_ids: [SOURCE_ID],
  };
  const digest = writeJson(outputPath, artifact);
  return { artifact, digest };
}

function main() {
  const result = compile(process.argv.slice(2));
  console.log(`Compiled Ember power facts for ${result.artifact.entity_count} registry entities.`);
  console.log(`Artifact SHA-256: ${result.digest}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { METRIC_CONFIG, compile };
