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

const SOURCE_ID = 'ember-yearly-electricity-data-2026-08-25';
const MIX_TOLERANCE_PP = 0.02;
const CLEAN_FUEL_IDS = Object.freeze([
  'electricity.generation_share.bioenergy',
  'electricity.generation_share.hydro',
  'electricity.generation_share.nuclear',
  'electricity.generation_share.other_renewables',
  'electricity.generation_share.solar',
  'electricity.generation_share.wind',
]);
const FOSSIL_FUEL_IDS = Object.freeze([
  'electricity.generation_share.coal',
  'electricity.generation_share.gas',
  'electricity.generation_share.other_fossil',
]);
const FUEL_METRIC_IDS = Object.freeze([...CLEAN_FUEL_IDS, ...FOSSIL_FUEL_IDS]);

function fuelConfig(variable, fuelGroup, taxonomyNote = null) {
  return {
    aliases: [variable],
    category: 'Electricity generation',
    subcategories: ['Fuel'],
    unit: '%',
    input_units: ['%'],
    ignored_units: ['TWh'],
    frame: 'national_electricity_generation',
    gases: [],
    fuel_group: fuelGroup,
    published_variable: variable,
    taxonomy_note: taxonomyNote,
  };
}

const METRIC_CONFIG = Object.freeze({
  'electricity.clean_share': {
    aliases: ['Clean', 'Clean share'], category: 'Electricity generation', subcategories: ['', 'Aggregate fuel'],
    unit: '%', input_units: ['%'], ignored_units: ['TWh'], frame: 'national_electricity_generation', gases: [],
  },
  'electricity.fossil_share': {
    aliases: ['Fossil', 'Fossil share'], category: 'Electricity generation', subcategories: ['', 'Aggregate fuel'],
    unit: '%', input_units: ['%'], ignored_units: ['TWh'], frame: 'national_electricity_generation', gases: [],
  },
  'electricity.wind_solar_share': {
    aliases: ['Wind and Solar', 'Wind and solar', 'Wind & solar'], category: 'Electricity generation', subcategories: ['', 'Aggregate fuel'],
    unit: '%', input_units: ['%'], ignored_units: ['TWh'], frame: 'national_electricity_generation', gases: [],
  },
  'electricity.carbon_intensity': {
    aliases: ['CO2 intensity', 'Carbon intensity'], categories: ['Power sector emissions', 'Electricity generation'], subcategories: ['', 'CO2 intensity'],
    unit: 'gCO2/kWh', input_units: ['gCO2/kWh'], ignored_units: [], frame: 'national_electricity_generation', gases: ['CO2'],
  },
  'electricity.emissions': {
    aliases: ['Total emissions', 'Total', 'Power sector emissions'], category: 'Power sector emissions', subcategories: ['', 'Total'],
    unit: 'MtCO2/yr', input_units: ['mtCO2', 'MtCO2'], ignored_units: [], frame: 'national_electricity_generation', gases: ['CO2'],
  },
  'electricity.generation_share.bioenergy': fuelConfig('Bioenergy', 'clean'),
  'electricity.generation_share.coal': fuelConfig('Coal', 'fossil'),
  'electricity.generation_share.gas': fuelConfig('Gas', 'fossil'),
  'electricity.generation_share.hydro': fuelConfig('Hydro', 'clean'),
  'electricity.generation_share.nuclear': fuelConfig('Nuclear', 'clean'),
  'electricity.generation_share.other_fossil': fuelConfig('Other Fossil', 'fossil'),
  'electricity.generation_share.other_renewables': fuelConfig('Other Renewables', 'clean', 'Ember combines geothermal, tidal, and wave generation in this standardized category.'),
  'electricity.generation_share.solar': fuelConfig('Solar', 'clean'),
  'electricity.generation_share.wind': fuelConfig('Wind', 'clean'),
});

function field(row, names) {
  for (const name of names) if (row[name] !== undefined && row[name] !== '') return row[name];
  return '';
}

function matchesConfig(row, config) {
  const category = field(row, ['Category']);
  const subcategory = field(row, ['Subcategory']);
  const variable = field(row, ['Variable']);
  const categories = config.categories || [config.category];
  return categories.includes(category) && config.subcategories.includes(subcategory) && config.aliases.includes(variable);
}

function selectedMetric(row) {
  return Object.entries(METRIC_CONFIG).find(([, config]) => matchesConfig(row, config)) || null;
}

function upstreamId(row) {
  return [
    field(row, ['Area type']) || 'unspecified_area_type',
    field(row, ['ISO 3 code', 'Entity code']) || field(row, ['Area', 'Entity']) || 'unspecified_area',
    field(row, ['Year']),
    field(row, ['Category']),
    field(row, ['Subcategory']) || 'unspecified_subcategory',
    field(row, ['Variable']),
    field(row, ['Unit']),
  ].join('|');
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
    taxonomy: config.fuel_group ? 'ember_published_generation_fuel' : 'ember_published_aggregate_fuel',
    unit: config.unit,
  };
  const context = {
    source_evidence_class: 'annual_actual',
    taxonomy: config.fuel_group ? 'Ember published generation-fuel taxonomy' : 'Ember published aggregate fuel taxonomy',
  };
  if (config.fuel_group) {
    context.fuel_group = config.fuel_group;
    context.published_variable = config.published_variable;
    if (config.taxonomy_note) context.taxonomy_note = config.taxonomy_note;
  }
  return {
    context,
    fact_ids: [`ember:${entity.iso_alpha3}:${metricId}:${metricId.endsWith('_5y') ? '2019-2024' : year}`],
    gap_reason: null,
    id: metricId,
    period: metricId.endsWith('_5y')
      ? { end: 2024, label: '2019–2024 change', start: 2019 }
      : { end: year, label: String(year), start: year },
    review_state: 'normalized_candidate_pending_independent_scientific_review',
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

function sumAvailable(countryValues, metricIds) {
  const publishedValues = metricIds
    .map(metricId => countryValues.get(`${metricId}:2024`))
    .filter(value => Number.isFinite(value));
  return round(publishedValues.reduce((sum, value) => sum + value, 0));
}

function fuelMixReconciliation(entity, countryValues) {
  const availableFuelIds = FUEL_METRIC_IDS.filter(metricId => Number.isFinite(countryValues.get(`${metricId}:2024`)));
  if (!availableFuelIds.length) return {
    available: false,
    gap: 'Ember publishes no non-blank 2024 generation-fuel shares for this entity; missing fuel values are not converted to zero.',
  };
  const cleanAggregate = countryValues.get('electricity.clean_share:2024');
  const fossilAggregate = countryValues.get('electricity.fossil_share:2024');
  if (!Number.isFinite(cleanAggregate) || !Number.isFinite(fossilAggregate)) {
    throw new Error(`${entity.iso_alpha3} has fuel shares without both exact 2024 clean and fossil anchors`);
  }
  const cleanComponents = sumAvailable(countryValues, CLEAN_FUEL_IDS);
  const fossilComponents = sumAvailable(countryValues, FOSSIL_FUEL_IDS);
  const publishedComponentSum = round(cleanComponents + fossilComponents);
  const publishedAggregateSum = round(cleanAggregate + fossilAggregate);
  const cleanDelta = round(cleanComponents - cleanAggregate);
  const fossilDelta = round(fossilComponents - fossilAggregate);
  if (Math.abs(cleanDelta) > MIX_TOLERANCE_PP || Math.abs(fossilDelta) > MIX_TOLERANCE_PP ||
      Math.abs(publishedComponentSum - 100) > MIX_TOLERANCE_PP || Math.abs(publishedAggregateSum - 100) > MIX_TOLERANCE_PP) {
    throw new Error(`${entity.iso_alpha3} fuel mix does not reconcile within ±${MIX_TOLERANCE_PP} percentage points`);
  }
  return {
    available: true,
    available_fuel_metric_ids: availableFuelIds,
    unavailable_fuel_metric_ids: FUEL_METRIC_IDS.filter(metricId => !availableFuelIds.includes(metricId)),
    clean_aggregate: round(cleanAggregate),
    clean_component_sum: cleanComponents,
    clean_delta_pp: cleanDelta,
    fossil_aggregate: round(fossilAggregate),
    fossil_component_sum: fossilComponents,
    fossil_delta_pp: fossilDelta,
    published_aggregate_sum: publishedAggregateSum,
    published_component_sum: publishedComponentSum,
    rounding_variance_from_100_pp: round(publishedComponentSum - 100),
    tolerance_pp: MIX_TOLERANCE_PP,
    visual_normalization_applied: false,
  };
}

function compile(args) {
  const inputPath = path.resolve(option(args, '--input'));
  const receipt = readJson(path.resolve(option(args, '--receipt')));
  const outputPath = path.resolve(option(args, '--output'));
  if (receipt.source_registry_id !== SOURCE_ID || receipt.year_status_2024 !== 'actual' || receipt.year_status_2019 !== 'actual') {
    throw new Error('Ember receipt must pin the reviewed source and classify the 2019/2024 selected rows as annual actuals');
  }
  verifySnapshot(inputPath, receipt);
  const sourceRegistry = readJson(path.join(ROOT, 'data/climate/source-registry.json'));
  assertSourceApproved(sourceRegistry, SOURCE_ID, [
    'Entity', 'Entity code', 'Area', 'ISO 3 code', 'Year', 'Area type', 'Category', 'Subcategory', 'Variable', 'Unit', 'Value', 'Evidence class',
  ]);
  const source = sourceRegistry.sources.find(candidate => candidate.id === SOURCE_ID);
  if (JSON.stringify(source?.ingestion_gate?.metric_permitlist || []) !== JSON.stringify(Object.keys(METRIC_CONFIG))) {
    throw new Error('Ember source registry metric permitlist does not match the compiler metric contract');
  }
  const registry = loadCountryRegistry();
  const registryByIso3 = new Map(registry.entities.map(entity => [entity.iso_alpha3, entity]));
  const rows = readCsvSnapshot(inputPath);
  const exceptions = new Map((receipt.identity_exceptions || []).map(exception => [exception.upstream_iso3 || exception.upstream_id, exception]));
  const usedExceptions = new Set();
  const values = new Map();
  const dispositions = [];
  for (const row of rows) {
    const year = Number(field(row, ['Year']));
    if (![2019, 2024].includes(year)) continue;
    const metricEntry = selectedMetric(row);
    if (!metricEntry) continue;
    const [metricId, config] = metricEntry;
    if (year === 2019 && metricId !== 'electricity.clean_share') continue;
    const unit = field(row, ['Unit']);
    if (!config.input_units.includes(unit)) {
      if (config.ignored_units.includes(unit)) continue;
      throw new Error(`Ember ${metricId} unit mismatch: expected ${config.input_units.join(' or ')}, received ${unit || '(blank)'}`);
    }

    const id = upstreamId(row);
    const areaType = field(row, ['Area type']) || 'Country or economy';
    if (areaType === 'Region') {
      dispositions.push({ aggregate_exception: 'Published regional aggregate excluded from the 249-entity country component.', upstream_id: id });
      continue;
    }
    if (areaType !== 'Country or economy') throw new Error(`Unsupported Ember area type ${areaType} for ${id}`);

    const iso3 = field(row, ['Entity code', 'ISO 3 code']);
    const entity = registryByIso3.get(iso3);
    if (!entity) {
      const exceptionKey = exceptions.has(iso3) ? iso3 : id;
      const exception = exceptions.get(exceptionKey);
      if (!exception || !['aggregate_exception', 'territory_exception', 'unmapped_exception'].includes(exception.kind) || !exception.reason) {
        throw new Error(`Ember upstream row ${id} has no mapping or enumerated exception`);
      }
      dispositions.push({ [exception.kind]: exception.reason, upstream_id: id });
      usedExceptions.add(exceptionKey);
      continue;
    }

    dispositions.push({ country_id: entity.country_id, upstream_id: id });
    const rawValue = field(row, ['Value']);
    if (rawValue === '') continue;
    const evidenceClass = field(row, ['Evidence class']) || receipt.default_evidence_class;
    if (evidenceClass !== 'actual') throw new Error(`Ember comparison input ${id} is not actual-year evidence`);
    const value = Number(rawValue);
    if (!Number.isFinite(value)) throw new Error(`Ember upstream row ${id} has a non-finite value`);
    if (config.unit === '%' && (value < 0 || value > 100)) throw new Error(`Ember share outside 0–100 for ${iso3}`);
    const key = `${metricId}:${year}`;
    const countryValues = values.get(iso3) || new Map();
    if (countryValues.has(key)) throw new Error(`Duplicate Ember ${key} value for ${iso3}`);
    countryValues.set(key, value);
    values.set(iso3, countryValues);
  }
  const unusedExceptions = [...exceptions.keys()].filter(key => !usedExceptions.has(key));
  if (unusedExceptions.length) throw new Error(`Ember receipt contains unused identity exceptions: ${unusedExceptions.join(', ')}`);

  const countries = registry.entities.map(entity => {
    const countryValues = values.get(entity.iso_alpha3) || new Map();
    const metrics = {};
    for (const [metricId, config] of Object.entries(METRIC_CONFIG)) {
      const value = countryValues.get(`${metricId}:2024`);
      metrics[metricId] = value === undefined
        ? gapMetric(metricId, SOURCE_ID, 'source_value_missing', `Ember has no non-blank exact 2024 ${metricId} value for this entity; the value is not converted to zero.`)
        : metricRecord(entity, metricId, value, 2024, config);
    }
    const start = countryValues.get('electricity.clean_share:2019');
    const end = countryValues.get('electricity.clean_share:2024');
    const changeConfig = { ...METRIC_CONFIG['electricity.clean_share'], unit: 'percentage points' };
    metrics['electricity.clean_share_change_5y'] = start === undefined || end === undefined
      ? gapMetric('electricity.clean_share_change_5y', SOURCE_ID, 'matched_endpoint_missing', 'The 2019 and 2024 clean-share endpoints are not both available.')
      : metricRecord(entity, 'electricity.clean_share_change_5y', end - start, 2024, changeConfig, 'clean_share_2024_minus_clean_share_2019');

    const reconciliation = fuelMixReconciliation(entity, countryValues);
    if (metrics['electricity.clean_share'].value !== null) {
      metrics['electricity.clean_share'].context.fuel_mix_reconciliation = reconciliation.available ? reconciliation : null;
      metrics['electricity.clean_share'].context.fuel_mix_gap_reason = reconciliation.available ? null : reconciliation.gap;
    }
    return { country_id: entity.country_id, iso_alpha3: entity.iso_alpha3, metrics };
  });
  assertEntityPartition(countries, dispositions);
  const artifact = {
    artifact_type: 'normalized_country_climate_component',
    countries,
    entity_count: ENTITY_COUNT,
    generated_on: receipt.retrieved_on,
    identity_accounting: {
      aggregate_exception_rows: dispositions.filter(item => item.aggregate_exception).length,
      dispositions,
      mapped_rows: dispositions.filter(item => item.country_id).length,
      rule: 'Every selected exact-period aggregate or fuel row maps once or has one enumerated aggregate, territory, or unmapped exception.',
      selected_rows: dispositions.length,
      unmapped_exception_rows: dispositions.filter(item => item.unmapped_exception).length,
    },
    input_receipt: receipt,
    metric_ids: [...Object.keys(METRIC_CONFIG), 'electricity.clean_share_change_5y'],
    review_state: 'normalized_factual_candidate_pending_independent_scientific_review',
    schema_version: '1.0.0',
    source_registry_ids: [SOURCE_ID],
  };
  const digest = writeJson(outputPath, artifact);
  return { artifact, digest };
}

function main() {
  const result = compile(process.argv.slice(2));
  console.log(`Compiled Ember aggregate and fuel-mix facts for ${result.artifact.entity_count} registry entities.`);
  console.log(`Artifact SHA-256: ${result.digest}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { CLEAN_FUEL_IDS, FOSSIL_FUEL_IDS, FUEL_METRIC_IDS, METRIC_CONFIG, MIX_TOLERANCE_PP, SOURCE_ID, compile };
