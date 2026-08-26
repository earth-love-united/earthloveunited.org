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

const SOURCE_ID = 'un-wpp-2024';
const METRIC_ID = 'population.wpp_medium_projection';

function compile(args) {
  const inputPath = path.resolve(option(args, '--input'));
  const receiptPath = path.resolve(option(args, '--receipt'));
  const outputPath = path.resolve(option(args, '--output'));
  const receipt = readJson(receiptPath);
  if (receipt.source_registry_id !== SOURCE_ID || receipt.year_classification_2024 !== 'projection') {
    throw new Error('WPP receipt must identify un-wpp-2024 and classify the 2024 Medium variant as a projection');
  }
  verifySnapshot(inputPath, receipt);
  const sourceRegistry = readJson(path.join(ROOT, 'data/climate/source-registry.json'));
  assertSourceApproved(sourceRegistry, SOURCE_ID, ['ISO3_code', 'Location', 'Time', 'Year', 'Variant', 'PopTotal']);
  const registry = loadCountryRegistry();
  const registryByIso3 = new Map(registry.entities.map(entity => [entity.iso_alpha3, entity]));
  const rows = readCsvSnapshot(inputPath);
  const selected = rows.filter(row => Number(row.Time || row.Year) === 2024 && row.Variant === 'Medium');
  if (!selected.length) throw new Error('WPP snapshot contains no 2024 Medium rows');
  const exceptions = new Map((receipt.identity_exceptions || []).map(exception => [exception.upstream_id, exception]));
  const values = new Map();
  const dispositions = [];
  for (const [index, row] of selected.entries()) {
    const upstreamId = row.ISO3_code || `row:${index + 2}`;
    const iso3 = row.ISO3_code;
    if (registryByIso3.has(iso3)) {
      if (values.has(iso3)) throw new Error(`Duplicate WPP 2024 population row for ${iso3}`);
      const raw = Number(row.PopTotal);
      if (!Number.isFinite(raw) || raw < 0) throw new Error(`Invalid WPP PopTotal for ${iso3}`);
      values.set(iso3, { location: row.Location, value: round(raw * 1000, 0) });
      dispositions.push({ country_id: registryByIso3.get(iso3).country_id, upstream_id: upstreamId });
    } else {
      const exception = exceptions.get(upstreamId);
      if (!exception || !['aggregate_exception', 'territory_exception', 'unmapped_exception'].includes(exception.kind) || !exception.reason) {
        throw new Error(`WPP upstream row ${upstreamId} has neither a registry mapping nor an enumerated exception`);
      }
      dispositions.push({ [exception.kind]: exception.reason, upstream_id: upstreamId });
    }
  }
  const unusedExceptions = [...exceptions.keys()].filter(id => !dispositions.some(item => item.upstream_id === id));
  if (unusedExceptions.length) throw new Error(`WPP receipt contains unused identity exceptions: ${unusedExceptions.join(', ')}`);

  const countries = registry.entities.map(entity => {
    const population = values.get(entity.iso_alpha3);
    let metric;
    if (!population) {
      metric = gapMetric(METRIC_ID, SOURCE_ID, 'source_value_missing', 'WPP 2024 has no year-matched Medium population projection for this registry entity.');
    } else {
      const scope = {
        accounting_frame: 'resident_population_mid_year',
        gases: [],
        geography: 'registry_entity_population',
        gwp: 'not_applicable',
        lulucf_treatment: 'not_applicable',
        metric: METRIC_ID,
        period: '2024',
        sectors: [],
        unit: 'persons',
      };
      metric = {
        context: {
          different_year_or_variant_substitution_allowed: false,
          release_year_classification: 'year_matched_2024_medium_projection',
          source_location_name: population.location,
          source_variant: 'Medium',
        },
        fact_ids: [`wpp-2024:${entity.iso_alpha3}:population:2024`],
        gap_reason: null,
        id: METRIC_ID,
        period: { end: 2024, label: '2024', start: 2024 },
        review_state: 'compiler_candidate_requires_scientific_review',
        scope,
        scope_fingerprint: scopeFingerprint(scope),
        source_ids: [SOURCE_ID],
        status: 'modeled',
        transformation: 'PopTotal_thousands_times_1000;year_2024_and_Medium_projection_selected',
        uncertainty: { kind: 'not_provided_in_selected_table', lower: null, upper: null },
        unit: 'persons',
        value: population.value,
      };
    }
    return { country_id: entity.country_id, iso_alpha3: entity.iso_alpha3, metrics: { [METRIC_ID]: metric } };
  });
  assertEntityPartition(countries, dispositions);
  const artifact = {
    artifact_type: 'normalized_country_climate_component',
    countries,
    entity_count: ENTITY_COUNT,
    generated_on: receipt.retrieved_on,
    identity_accounting: { dispositions, rule: 'Every selected 2024 Medium upstream row maps once or has one enumerated exception.' },
    input_receipt: receipt,
    metric_ids: [METRIC_ID],
    review_state: 'compiler_candidate_requires_scientific_review',
    schema_version: '1.0.0',
    source_registry_ids: [SOURCE_ID],
  };
  const digest = writeJson(outputPath, artifact);
  return { artifact, digest };
}

function main() {
  const result = compile(process.argv.slice(2));
  console.log(`Compiled WPP population for ${result.artifact.entity_count} registry entities.`);
  console.log(`Artifact SHA-256: ${result.digest}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { compile };
