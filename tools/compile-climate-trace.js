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
  readJson,
  round,
  scopeFingerprint,
  verifySnapshot,
  writeJson,
} = require('./lib/country-climate-intelligence');

const SOURCE_ID = 'climate-trace-v5.9.0-country-annual';
const METRIC_ID = 'emissions.ghg.independent';
const EXCLUDED_SECTORS = new Set(['forestry-and-land-use', 'forestry', 'lulucf']);

function compile(args) {
  const inputPath = path.resolve(option(args, '--input'));
  const receipt = readJson(path.resolve(option(args, '--receipt')));
  const outputPath = path.resolve(option(args, '--output'));
  if (receipt.source_registry_id !== SOURCE_ID || receipt.source_version !== '5.9.0') {
    throw new Error('Climate TRACE receipt must pin source version 5.9.0');
  }
  verifySnapshot(inputPath, receipt);
  const sourceRegistry = readJson(path.join(ROOT, 'data/climate/source-registry.json'));
  assertSourceApproved(sourceRegistry, SOURCE_ID, [
    'iso_alpha3', 'country_name', 'year', 'sector', 'gas', 'emissions_tonnes',
    'co2e_100yr_tonnes', 'gwp_basis', 'estimate_status',
  ]);
  const snapshot = readJson(inputPath);
  if (snapshot.release_version !== '5.9.0' || !Array.isArray(snapshot.rows)) throw new Error('Invalid Climate TRACE v5.9.0 annual country snapshot');
  const registry = loadCountryRegistry();
  const registryByIso3 = new Map(registry.entities.map(entity => [entity.iso_alpha3, entity]));
  const exceptions = new Map((receipt.identity_exceptions || []).map(exception => [exception.upstream_id, exception]));
  const totals = new Map();
  const dispositions = [];
  for (const [index, row] of snapshot.rows.entries()) {
    if (Number(row.year) !== 2024 || EXCLUDED_SECTORS.has(String(row.sector).toLowerCase())) continue;
    if (row.gwp_basis !== 'IPCC_AR6_GWP100') throw new Error(`Climate TRACE row ${index} is not AR6 GWP100`);
    if (row.estimate_status !== 'estimated') throw new Error(`Climate TRACE 2024 row ${index} is not labelled estimated`);
    const upstreamId = row.upstream_id || `${row.iso_alpha3}:${row.sector}:${row.gas}:${index}`;
    const entity = registryByIso3.get(row.iso_alpha3);
    if (!entity) {
      const exception = exceptions.get(upstreamId);
      if (!exception || !['aggregate_exception', 'territory_exception', 'unmapped_exception'].includes(exception.kind) || !exception.reason) {
        throw new Error(`Climate TRACE upstream row ${upstreamId} has no mapping or enumerated exception`);
      }
      dispositions.push({ [exception.kind]: exception.reason, upstream_id: upstreamId });
      continue;
    }
    const emissionsTonnes = Number(row.emissions_tonnes);
    const co2eTonnes = Number(row.co2e_100yr_tonnes);
    if (!Number.isFinite(emissionsTonnes) || !Number.isFinite(co2eTonnes)) throw new Error(`Climate TRACE row ${upstreamId} contains a non-finite value`);
    const aggregate = totals.get(row.iso_alpha3) || {
      country_name: row.country_name,
      co2e: 0,
      gases: { co2: 0, ch4: 0, n2o: 0 },
      gasSeen: new Set(),
      sectors: {},
    };
    aggregate.co2e += co2eTonnes;
    const gas = String(row.gas).toLowerCase();
    if (gas in aggregate.gases) {
      aggregate.gases[gas] += emissionsTonnes;
      aggregate.gasSeen.add(gas);
    }
    aggregate.sectors[row.sector] = (aggregate.sectors[row.sector] || 0) + co2eTonnes;
    totals.set(row.iso_alpha3, aggregate);
    dispositions.push({ country_id: entity.country_id, upstream_id: upstreamId });
  }
  const unusedExceptions = [...exceptions.keys()].filter(id => !dispositions.some(item => item.upstream_id === id));
  if (unusedExceptions.length) throw new Error(`Climate TRACE receipt contains unused identity exceptions: ${unusedExceptions.join(', ')}`);

  const sectors = ['agriculture', 'buildings', 'fluorinated-gases', 'fossil-fuel-operations', 'manufacturing', 'mineral-extraction', 'power', 'transportation', 'waste'];
  const countries = registry.entities.map(entity => {
    const total = totals.get(entity.iso_alpha3);
    let metric;
    if (!total) {
      metric = gapMetric(METRIC_ID, SOURCE_ID, 'source_value_missing', 'No explicit 2024 non-forestry Climate TRACE country value is present; missing is not converted to zero.');
    } else {
      const scope = {
        accounting_frame: 'independent_country_inventory',
        gases: ['CO2', 'CH4', 'N2O', 'fluorinated_gases'],
        geography: 'country_or_territory',
        gwp: 'IPCC_AR6_GWP100',
        lulucf_treatment: 'forestry_and_land_use_excluded',
        metric: METRIC_ID,
        period: '2024',
        sectors,
        unit: 'MtCO2e/yr',
      };
      const gasUnits = { co2: 'MtCO2/yr', ch4: 'MtCH4/yr', n2o: 'MtN2O/yr' };
      const gasBreakdown = Object.fromEntries(Object.keys(total.gases).map(gas => [gas, {
        status: total.gasSeen.has(gas) ? 'estimated' : 'not_reported',
        unit: gasUnits[gas],
        value: total.gasSeen.has(gas) ? round(total.gases[gas] / 1000000) : null,
      }]));
      metric = {
        context: {
          comparison_note: 'Shown beside GCB fossil CO2 only. It is not scope-matched and no disagreement percentage is calculated.',
          evidence_class: 'independent_estimate',
          gas_breakdown: gasBreakdown,
          ranking_eligible: false,
          sector_breakdown_mtco2e: Object.fromEntries(Object.entries(total.sectors).sort().map(([sector, value]) => [sector, round(value / 1000000)])),
          source_percentage_ignored: true,
          source_rank_ignored: true,
        },
        fact_ids: [`climate-trace-5.9.0:${entity.iso_alpha3}:co2e100:2024`],
        gap_reason: null,
        id: METRIC_ID,
        period: { end: 2024, label: '2024', start: 2024 },
        review_state: 'compiler_candidate_requires_scientific_review',
        scope,
        scope_fingerprint: scopeFingerprint(scope),
        source_ids: [SOURCE_ID],
        status: 'estimated',
        transformation: 'API_tonnes_divided_by_1e6_to_Mt;all_no_forest_filter',
        uncertainty: { kind: 'available_on_request_not_in_api_snapshot', lower: null, upper: null },
        unit: 'MtCO2e/yr',
        value: round(total.co2e / 1000000),
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
    identity_accounting: { dispositions, rule: 'Every selected annual country/gas/sector row maps once or has one enumerated exception.' },
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
  console.log(`Compiled Climate TRACE context for ${result.artifact.entity_count} registry entities.`);
  console.log(`Artifact SHA-256: ${result.digest}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { compile };
