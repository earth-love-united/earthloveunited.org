'use strict';

const fs = require('fs');
const path = require('path');
const { readSheet } = require('./xlsx-table');
const {
  ENTITY_COUNT,
  ROOT,
  assertEntityPartition,
  assertSourceApproved,
  gapMetric,
  loadCountryRegistry,
  mean,
  option,
  populationStdDev,
  readJson,
  round,
  scopeFingerprint,
  writeJson,
} = require('./country-climate-intelligence');
const { EXPECTED_ARTIFACTS, verify } = require('../acquire-gcb-2025');

const SOURCE_ID = 'gcp-gcb-2025-v1.0';
const FACTOR = 3.664;
const METRICS = [
  'emissions.fossil_co2.territorial',
  'emissions.fossil_co2.cumulative',
  'emissions.fossil_co2.consumption',
  'emissions.fossil_co2.net_transfer',
  'emissions.land_use_co2.net',
];

function matrix(rows, sheetName) {
  const first = rows.findIndex(row => Number.isInteger(row.A) && row.A >= 1800 && row.A <= 2100);
  if (first < 1) throw new Error(`${sheetName}: could not find first annual row`);
  const header = rows[first - 1];
  const data = rows.slice(first).filter(row => Number.isInteger(row.A) && row.A >= 1800 && row.A <= 2100);
  const columns = Object.keys(header)
    .filter(column => column !== '_row' && column !== 'A' && typeof header[column] === 'string' && header[column].trim())
    .map(column => ({ column, source_name: header[column].trim() }));
  const series = columns.map(({ column, source_name }) => ({
    source_name,
    observations: data.map(row => {
      const raw = row[column];
      if (raw === '' || raw === null || raw === undefined) return { year: row.A, value: null };
      if (!Number.isFinite(raw)) throw new Error(`${sheetName}: non-numeric value for ${source_name}, ${row.A}`);
      return { year: row.A, value: raw };
    }),
  }));
  return series;
}

function loadIdentityMap(file) {
  const value = readJson(file);
  if (!Array.isArray(value.mappings) || !Array.isArray(value.exceptions)) {
    throw new Error('GCB identity map requires mappings and exceptions arrays');
  }
  const dispositions = new Map();
  for (const mapping of value.mappings) {
    if (!mapping.source_name || !/^[A-Z]{3}$/.test(mapping.iso_alpha3 || '')) throw new Error('Invalid GCB identity mapping');
    if (dispositions.has(mapping.source_name)) throw new Error(`Duplicate GCB identity disposition: ${mapping.source_name}`);
    dispositions.set(mapping.source_name, { kind: 'mapped', iso_alpha3: mapping.iso_alpha3 });
  }
  for (const exception of value.exceptions) {
    if (!exception.source_name || !['aggregate', 'territory', 'unmapped'].includes(exception.kind) || !exception.reason) {
      throw new Error('Invalid GCB identity exception');
    }
    if (dispositions.has(exception.source_name)) throw new Error(`Duplicate GCB identity disposition: ${exception.source_name}`);
    dispositions.set(exception.source_name, { kind: exception.kind, reason: exception.reason });
  }
  return dispositions;
}

function applyIdentity(seriesSets, dispositions, registry) {
  const registryByIso3 = new Map(registry.entities.map(entity => [entity.iso_alpha3, entity]));
  const sourceNames = [...new Set(seriesSets.flatMap(series => series.map(item => item.source_name)))].sort();
  const ledger = [];
  for (const sourceName of sourceNames) {
    const disposition = dispositions.get(sourceName);
    if (!disposition) throw new Error(`GCB source entity has no reviewed identity disposition: ${sourceName}`);
    if (disposition.kind === 'mapped' && !registryByIso3.has(disposition.iso_alpha3)) {
      throw new Error(`GCB source entity ${sourceName} maps to unknown ISO3 ${disposition.iso_alpha3}`);
    }
    ledger.push({ source_name: sourceName, ...disposition });
  }
  const unused = [...dispositions.keys()].filter(name => !sourceNames.includes(name));
  if (unused.length) throw new Error(`GCB identity map contains unused dispositions: ${unused.join(', ')}`);
  return ledger;
}

function byIso3(series, ledger) {
  const dispositionByName = new Map(ledger.map(item => [item.source_name, item]));
  return new Map(series.flatMap(item => {
    const disposition = dispositionByName.get(item.source_name);
    return disposition.kind === 'mapped' ? [[disposition.iso_alpha3, item.observations]] : [];
  }));
}

function scope(metric, frame, period, unit, sectors, lulucf) {
  const value = {
    accounting_frame: frame,
    gases: ['CO2'],
    geography: 'registry_entity_territory',
    gwp: 'not_applicable_single_gas',
    lulucf_treatment: lulucf,
    metric,
    period,
    sectors,
    unit,
  };
  return value;
}

function record({ iso3, metric, value, unit, period, accountingFrame, sectors, lulucf, transformation, context, uncertainty, factSuffix }) {
  const metricScope = scope(metric, accountingFrame, period.label, unit, sectors, lulucf);
  return {
    ...(context ? { context } : {}),
    fact_ids: [`gcb-2025:${iso3}:${metric}:${factSuffix || period.label}`],
    gap_reason: null,
    id: metric,
    period,
    review_state: 'normalized_candidate_pending_independent_scientific_review',
    scope: metricScope,
    scope_fingerprint: scopeFingerprint(metricScope),
    source_ids: [SOURCE_ID],
    status: 'estimated',
    transformation,
    uncertainty,
    unit,
    value: round(value),
  };
}

function annualValue(series, year) {
  const observation = series?.find(item => item.year === year);
  return Number.isFinite(observation?.value) ? observation.value : null;
}

function latestValue(series) {
  return [...(series || [])].reverse().find(item => Number.isFinite(item.value)) || null;
}

function fossilMetrics(iso3, territorial, consumption, transfer) {
  const sectors = ['fossil_fuel_combustion', 'industrial_processes', 'cement_carbonation_sink'];
  const uncertainty = { kind: 'not_provided_at_country_level', lower: null, upper: null };
  const territorial2024 = annualValue(territorial, 2024);
  const historic = (territorial || []).filter(item => item.year >= 1850 && item.year <= 2024 && Number.isFinite(item.value));
  const trend = (territorial || []).filter(item => item.year >= 1990 && item.year <= 2024 && Number.isFinite(item.value));
  const territorialRecord = territorial2024 === null
    ? gapMetric('emissions.fossil_co2.territorial', SOURCE_ID, 'source_entity_missing', 'The GCB fossil workbook has no exact 2024 country value for this registry entity.')
    : record({
      iso3,
      metric: 'emissions.fossil_co2.territorial',
      value: territorial2024 * FACTOR,
      unit: 'MtCO2/yr',
      period: { start: 2024, end: 2024, label: '2024' },
      accountingFrame: 'territorial',
      sectors,
      lulucf: 'excluded',
      transformation: 'source_MtC_times_3.664_to_MtCO2',
      uncertainty,
    });
  if (territorialRecord.value !== null) territorialRecord.series = trend.map(item => ({ year: item.year, value: round(item.value * FACTOR) }));
  const cumulative = historic.length
    ? record({
      iso3,
      metric: 'emissions.fossil_co2.cumulative',
      value: historic.reduce((sum, item) => sum + item.value, 0) * FACTOR,
      unit: 'MtCO2',
      period: { start: 1850, end: 2024, label: '1850–2024' },
      accountingFrame: 'territorial_cumulative',
      sectors,
      lulucf: 'excluded',
      transformation: 'sum_available_annual_source_MtC_1850_2024_times_3.664',
      uncertainty,
      context: { available_years: historic.length },
    })
    : gapMetric('emissions.fossil_co2.cumulative', SOURCE_ID, 'source_entity_missing', 'The GCB fossil workbook has no country column for this registry entity.');
  const latestConsumption = latestValue(consumption);
  const latestTransfer = latestValue(transfer);
  const latestRecord = (metric, observation, frame) => observation
    ? record({
      iso3,
      metric,
      value: observation.value * FACTOR,
      unit: 'MtCO2/yr',
      period: { start: observation.year, end: observation.year, label: String(observation.year) },
      accountingFrame: frame,
      sectors,
      lulucf: 'excluded',
      transformation: 'latest_available_source_MtC_times_3.664_to_MtCO2',
      uncertainty,
      context: { latest_available_year: observation.year },
      factSuffix: String(observation.year),
    })
    : gapMetric(metric, SOURCE_ID, 'source_value_missing', `No published ${metric.includes('consumption') ? 'consumption' : 'transfer'} value is available for this entity.`);
  return {
    'emissions.fossil_co2.territorial': territorialRecord,
    'emissions.fossil_co2.cumulative': cumulative,
    'emissions.fossil_co2.consumption': latestRecord('emissions.fossil_co2.consumption', latestConsumption, 'consumption'),
    'emissions.fossil_co2.net_transfer': latestRecord('emissions.fossil_co2.net_transfer', latestTransfer, 'net_emissions_transfer'),
  };
}

function landMetric(iso3, models) {
  const modelMeans = {};
  for (const model of ['BLUE', 'OSCAR', 'LUCE']) {
    const values = (models[model] || []).filter(item => item.year >= 2015 && item.year <= 2024 && Number.isFinite(item.value));
    if (values.length !== 10) {
      return gapMetric('emissions.land_use_co2.net', SOURCE_ID, 'three_model_coverage_missing', 'All 2015–2024 annual values for BLUE, OSCAR, and LUCE are required; no model is imputed.');
    }
    modelMeans[model] = round(mean(values.map(item => item.value)) * FACTOR);
  }
  const values = ['BLUE', 'OSCAR', 'LUCE'].map(model => modelMeans[model]);
  const central = round(mean(values));
  const sigma = round(populationStdDev(values));
  return record({
    iso3,
    metric: 'emissions.land_use_co2.net',
    value: central,
    unit: 'MtCO2/yr',
    period: { start: 2015, end: 2024, label: '2015–2024 mean' },
    accountingFrame: 'territorial_land_use_change',
    sectors: ['land_use_change'],
    lulucf: 'land_use_change_only_separate_from_fossil',
    transformation: 'mean_of_BLUE_OSCAR_LUCE_2015_2024_model_means;population_standard_deviation_across_three_models',
    uncertainty: {
      kind: 'model_spread_population_standard_deviation',
      lower: round(central - sigma),
      sigma,
      upper: round(central + sigma),
    },
    context: { model_means: modelMeans, negative_values_are_removals: true },
  });
}

function compile(args) {
  const fossilPath = verify(option(args, '--input'), 'fossil');
  const landPath = verify(option(args, '--land-input'), 'land-use');
  const identityPath = path.resolve(option(args, '--identity-map'));
  const outputPath = path.resolve(option(args, '--intelligence-output'));
  const sourceRegistry = readJson(path.join(ROOT, 'data/climate/source-registry.json'));
  assertSourceApproved(sourceRegistry, SOURCE_ID, ['year', 'source_entity_name', 'territorial_emissions', 'consumption_emissions', 'emissions_transfers', 'BLUE', 'OSCAR', 'LUCE']);
  const registry = loadCountryRegistry();
  const dispositions = loadIdentityMap(identityPath);
  const territorial = matrix(readSheet(fossilPath, 'Territorial Emissions'), 'Territorial Emissions');
  const consumption = matrix(readSheet(fossilPath, 'Consumption Emissions'), 'Consumption Emissions');
  const transfers = matrix(readSheet(fossilPath, 'Emissions Transfers'), 'Emissions Transfers');
  const blue = matrix(readSheet(landPath, 'BLUE'), 'BLUE');
  const oscar = matrix(readSheet(landPath, 'OSCAR'), 'OSCAR');
  const luce = matrix(readSheet(landPath, 'LUCE'), 'LUCE');
  const ledger = applyIdentity([territorial, consumption, transfers, blue, oscar, luce], dispositions, registry);
  const sets = {
    territorial: byIso3(territorial, ledger),
    consumption: byIso3(consumption, ledger),
    transfers: byIso3(transfers, ledger),
    BLUE: byIso3(blue, ledger),
    OSCAR: byIso3(oscar, ledger),
    LUCE: byIso3(luce, ledger),
  };
  const countries = registry.entities.map(entity => ({
    country_id: entity.country_id,
    iso_alpha3: entity.iso_alpha3,
    metrics: {
      ...fossilMetrics(entity.iso_alpha3, sets.territorial.get(entity.iso_alpha3), sets.consumption.get(entity.iso_alpha3), sets.transfers.get(entity.iso_alpha3)),
      'emissions.land_use_co2.net': landMetric(entity.iso_alpha3, {
        BLUE: sets.BLUE.get(entity.iso_alpha3),
        OSCAR: sets.OSCAR.get(entity.iso_alpha3),
        LUCE: sets.LUCE.get(entity.iso_alpha3),
      }),
    },
  }));
  assertEntityPartition(countries);
  const artifact = {
    artifact_type: 'normalized_country_climate_component',
    countries,
    entity_count: ENTITY_COUNT,
    generated_on: option(args, '--compiled-on', '2026-08-24'),
    identity_accounting: { dispositions: ledger, rule: 'Each distinct upstream country/aggregate column has exactly one reviewed mapping or exception.' },
    input_receipts: {
      fossil: { ...EXPECTED_ARTIFACTS.fossil },
      land_use: { ...EXPECTED_ARTIFACTS['land-use'] },
    },
    metric_ids: METRICS,
    review_state: 'normalized_factual_candidate_pending_independent_scientific_review',
    schema_version: '1.0.0',
    source_registry_ids: [SOURCE_ID],
  };
  const digest = writeJson(outputPath, artifact);
  return { artifact, digest };
}

module.exports = { FACTOR, METRICS, applyIdentity, compile, fossilMetrics, landMetric, loadIdentityMap, matrix };
