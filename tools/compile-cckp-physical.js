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
  olsSlopePerDecade,
  olsTrendLine,
  option,
  readJson,
  round,
  scopeFingerprint,
  verifySnapshot,
  writeJson,
} = require('./lib/country-climate-intelligence');

const PROJECTED_SOURCE = 'world-bank-cckp-cmip6-2026-08-24';
const OBSERVED_SOURCE = 'world-bank-cckp-era5-2026-08-25';
const VARIABLE_CONFIG = {
  tas: {
    projected_id: 'climate.temperature.change',
    observed_id: 'climate.temperature.observed_trend',
    projected_unit: '°C',
    observed_unit: '°C/decade',
    interpretation: 'Projected warming; not vulnerability, damage, or responsibility.',
  },
  pr: {
    projected_id: 'climate.precipitation.change',
    observed_id: 'climate.precipitation.observed_trend',
    projected_unit: 'mm/year',
    observed_unit: 'mm/year/decade',
    interpretation: 'Projected precipitation change; not vulnerability or damage.',
  },
};

function identityDisposition(row, index, registryByIso3, exceptions, dispositions, prefix) {
  const upstreamId = row.upstream_id || `${prefix}:${row.iso_alpha3 || 'unmapped'}:${index}`;
  const entity = registryByIso3.get(row.iso_alpha3);
  if (entity) {
    dispositions.push({ country_id: entity.country_id, upstream_id: upstreamId });
    return entity;
  }
  const exception = exceptions.get(upstreamId);
  if (!exception || !['aggregate_exception', 'territory_exception', 'unmapped_exception'].includes(exception.kind) || !exception.reason) {
    throw new Error(`CCKP upstream row ${upstreamId} has no mapping or enumerated exception`);
  }
  dispositions.push({ [exception.kind]: exception.reason, upstream_id: upstreamId });
  return null;
}

function projectedMetric(entity, variable, rows) {
  const config = VARIABLE_CONFIG[variable];
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.scenario}:${row.percentile}`;
    if (byKey.has(key)) throw new Error(`Duplicate CCKP projection tuple for ${entity.iso_alpha3}/${variable}/${key}`);
    byKey.set(key, Number(row.value));
  }
  const required = ['SSP1-2.6:median', 'SSP2-4.5:p10', 'SSP2-4.5:median', 'SSP2-4.5:p90', 'SSP5-8.5:median'];
  if (required.some(key => !Number.isFinite(byKey.get(key)))) {
    return gapMetric(config.projected_id, PROJECTED_SOURCE, 'projection_percentile_or_scenario_missing', 'A complete SSP2-4.5 p10/median/p90 and SSP1-2.6/SSP5-8.5 median set is unavailable.');
  }
  const p10 = byKey.get('SSP2-4.5:p10');
  const median = byKey.get('SSP2-4.5:median');
  const p90 = byKey.get('SSP2-4.5:p90');
  if (!(p10 <= median && median <= p90)) throw new Error(`CCKP percentile ordering invalid for ${entity.iso_alpha3}/${variable}`);
  const scope = {
    accounting_frame: 'CMIP6_country_area_aggregate_anomaly',
    ensemble: 'multi_model_ensemble',
    gases: [],
    geography: 'CCKP_country_aggregation',
    gwp: 'not_applicable',
    lulucf_treatment: 'not_applicable',
    metric: config.projected_id,
    period: '2040–2059 vs 1995–2014',
    scenario: 'SSP2-4.5',
    sectors: [],
    statistic: 'annual_mean',
    unit: config.projected_unit,
  };
  return {
    context: {
      baseline: '1995–2014',
      interpretation: config.interpretation,
      scenario_medians: {
        'SSP1-2.6': round(byKey.get('SSP1-2.6:median')),
        'SSP2-4.5': round(median),
        'SSP5-8.5': round(byKey.get('SSP5-8.5:median')),
      },
    },
    fact_ids: [`cckp-cmip6:${entity.iso_alpha3}:${variable}:ssp245:2040-2059`],
    gap_reason: null,
    id: config.projected_id,
    period: { end: 2059, label: '2040–2059 vs 1995–2014', start: 2040 },
    review_state: 'normalized_candidate_pending_independent_scientific_review',
    scope,
    scope_fingerprint: scopeFingerprint(scope),
    source_ids: [PROJECTED_SOURCE],
    status: 'modeled',
    transformation: 'CCKP_country_anomaly_selected_without_additional_spatial_processing',
    uncertainty: {
      kind: 'multi_model_ensemble_percentile_range',
      lower: round(p10),
      median: round(median),
      p10: round(p10),
      p90: round(p90),
      upper: round(p90),
    },
    unit: config.projected_unit,
    value: round(median),
  };
}

function observedMetric(entity, variable, rows, lastYear, emptySnapshot) {
  const config = VARIABLE_CONFIG[variable];
  if (emptySnapshot) {
    const metric = gapMetric(config.observed_id, OBSERVED_SOURCE, 'source_snapshot_empty', 'The CCKP ERA5 country API returned an empty payload at compilation time; no observed trend is inferred.');
    metric.evidence_kind = 'reanalysis';
    return metric;
  }
  const series = rows
    .filter(row => Number(row.year) >= 1970 && Number(row.year) <= lastYear && Number.isFinite(Number(row.value)))
    .map(row => ({ year: Number(row.year), value: Number(row.value) }))
    .sort((left, right) => left.year - right.year);
  if (new Set(series.map(point => point.year)).size !== series.length) {
    throw new Error(`Duplicate CCKP observed year for ${entity.iso_alpha3}/${variable}`);
  }
  if (series.length < 2) {
    const metric = gapMetric(config.observed_id, OBSERVED_SOURCE, 'source_value_missing', `The ERA5 snapshot lacks a usable 1970–${lastYear} annual country series.`);
    metric.evidence_kind = 'reanalysis';
    return metric;
  }
  const fit = olsTrendLine(series);
  const scope = {
    accounting_frame: 'ERA5_country_area_aggregate_reanalysis',
    gases: [],
    geography: 'CCKP_country_aggregation',
    gwp: 'not_applicable',
    lulucf_treatment: 'not_applicable',
    metric: config.observed_id,
    period: `1970–${lastYear}`,
    sectors: [],
    statistic: 'OLS_slope_per_decade',
    unit: config.observed_unit,
  };
  return {
    context: {
      annual_statistic_label: variable === 'tas' ? 'Annual mean' : 'Annual total',
      attribution_claim: false,
      observations: series.length,
      reanalysis: 'ERA5',
      series_label: variable === 'tas' ? 'Annual mean surface air temperature' : 'Annual total precipitation',
      series_unit: variable === 'tas' ? '°C' : 'mm/year',
      trend_line: [fit.start, fit.end],
    },
    fact_ids: [`cckp-era5:${entity.iso_alpha3}:${variable}:trend:1970-${lastYear}`],
    evidence_kind: 'reanalysis',
    gap_reason: null,
    id: config.observed_id,
    period: { end: lastYear, label: `1970–${lastYear}`, start: 1970 },
    review_state: 'normalized_candidate_pending_independent_scientific_review',
    scope,
    scope_fingerprint: scopeFingerprint(scope),
    source_ids: [OBSERVED_SOURCE],
    status: 'modeled',
    series,
    transformation: 'OLS_slope_over_annual_country_aggregates_reported_per_decade',
    uncertainty: { kind: 'not_provided_for_derived_OLS_slope', lower: null, upper: null },
    unit: config.observed_unit,
    value: olsSlopePerDecade(series),
  };
}

function compile(args) {
  const projectedPath = path.resolve(option(args, '--projection-input'));
  const projectedReceipt = readJson(path.resolve(option(args, '--projection-receipt')));
  const observedPath = path.resolve(option(args, '--observed-input'));
  const observedReceipt = readJson(path.resolve(option(args, '--observed-receipt')));
  const outputPath = path.resolve(option(args, '--output'));
  if (projectedReceipt.source_registry_id !== PROJECTED_SOURCE || observedReceipt.source_registry_id !== OBSERVED_SOURCE) {
    throw new Error('CCKP receipts do not match the reviewed projected/observed components');
  }
  verifySnapshot(projectedPath, projectedReceipt);
  verifySnapshot(observedPath, observedReceipt);
  const sourceRegistry = readJson(path.join(ROOT, 'data/climate/source-registry.json'));
  assertSourceApproved(sourceRegistry, PROJECTED_SOURCE, ['iso_alpha3', 'variable', 'scenario', 'period', 'percentile', 'value', 'unit']);
  const projectedSnapshot = readJson(projectedPath);
  const observedSnapshot = readJson(observedPath);
  if (!Array.isArray(projectedSnapshot.rows) || !Array.isArray(observedSnapshot.rows)) throw new Error('CCKP snapshots must contain rows arrays');
  if (observedSnapshot.rows.length) {
    assertSourceApproved(sourceRegistry, OBSERVED_SOURCE, ['iso_alpha3', 'variable', 'year', 'value', 'unit']);
  }
  const registry = loadCountryRegistry();
  const registryByIso3 = new Map(registry.entities.map(entity => [entity.iso_alpha3, entity]));
  const exceptions = new Map([...(projectedReceipt.identity_exceptions || []), ...(observedReceipt.identity_exceptions || [])].map(exception => [exception.upstream_id, exception]));
  const dispositions = [];
  const projectedByCountry = new Map();
  for (const [index, row] of projectedSnapshot.rows.entries()) {
    if (!VARIABLE_CONFIG[row.variable] || row.period !== '2040–2059 vs 1995–2014' || !['SSP1-2.6', 'SSP2-4.5', 'SSP5-8.5'].includes(row.scenario)) continue;
    if (!['p10', 'median', 'p90'].includes(row.percentile)) continue;
    const config = VARIABLE_CONFIG[row.variable];
    if (row.unit !== config.projected_unit) throw new Error(`CCKP projected unit mismatch for ${row.variable}`);
    const entity = identityDisposition(row, index, registryByIso3, exceptions, dispositions, 'cmip6');
    if (!entity) continue;
    const key = `${entity.iso_alpha3}:${row.variable}`;
    const values = projectedByCountry.get(key) || [];
    values.push(row);
    projectedByCountry.set(key, values);
  }
  const observedByCountry = new Map();
  for (const [index, row] of observedSnapshot.rows.entries()) {
    if (!VARIABLE_CONFIG[row.variable]) continue;
    const entity = identityDisposition(row, index, registryByIso3, exceptions, dispositions, 'era5');
    if (!entity) continue;
    const key = `${entity.iso_alpha3}:${row.variable}`;
    const values = observedByCountry.get(key) || [];
    values.push(row);
    observedByCountry.set(key, values);
  }
  const lastYear = Number(observedReceipt.last_complete_year);
  if (!Number.isInteger(lastYear) || lastYear < 1970) throw new Error('Observed receipt must identify the last complete ERA5 year');
  const emptyObserved = observedSnapshot.rows.length === 0;
  const countries = registry.entities.map(entity => ({
    country_id: entity.country_id,
    iso_alpha3: entity.iso_alpha3,
    metrics: {
      'climate.temperature.change': projectedMetric(entity, 'tas', projectedByCountry.get(`${entity.iso_alpha3}:tas`) || []),
      'climate.precipitation.change': projectedMetric(entity, 'pr', projectedByCountry.get(`${entity.iso_alpha3}:pr`) || []),
      'climate.temperature.observed_trend': observedMetric(entity, 'tas', observedByCountry.get(`${entity.iso_alpha3}:tas`) || [], lastYear, emptyObserved),
      'climate.precipitation.observed_trend': observedMetric(entity, 'pr', observedByCountry.get(`${entity.iso_alpha3}:pr`) || [], lastYear, emptyObserved),
    },
  }));
  assertEntityPartition(countries, dispositions);
  const artifact = {
    artifact_type: 'normalized_country_climate_component',
    countries,
    entity_count: ENTITY_COUNT,
    generated_on: projectedReceipt.retrieved_on,
    identity_accounting: { dispositions, rule: 'Every selected CCKP country observation maps once or has one enumerated exception.' },
    input_receipts: { observed: observedReceipt, projected: projectedReceipt },
    metric_ids: Object.values(VARIABLE_CONFIG).flatMap(config => [config.observed_id, config.projected_id]),
    review_state: 'normalized_factual_candidate_pending_independent_scientific_review',
    schema_version: '1.0.0',
    source_registry_ids: [PROJECTED_SOURCE, OBSERVED_SOURCE],
  };
  const digest = writeJson(outputPath, artifact);
  return { artifact, digest };
}

function main() {
  const result = compile(process.argv.slice(2));
  console.log(`Compiled CCKP physical-climate facts for ${result.artifact.entity_count} registry entities.`);
  console.log(`Artifact SHA-256: ${result.digest}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { VARIABLE_CONFIG, compile, observedMetric, projectedMetric };
