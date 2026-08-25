#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  ENTITY_COUNT,
  ROOT,
  assertMetricRecord,
  fileSha256,
  mean,
  olsSlopePerDecade,
  olsTrendLine,
  populationStdDev,
  readJson,
  round,
  scopeFingerprint,
  scopesExactlyMatch,
} = require('./lib/country-climate-intelligence');

const RUNTIME_PATH = path.join(ROOT, 'data/climate/runtime/country-climate-intelligence.json');
const MANIFEST_PATH = path.join(ROOT, 'data/climate/releases/country-climate-intelligence-v1/release-manifest.json');
const CLEAN_FUEL_IDS = [
  'electricity.generation_share.bioenergy',
  'electricity.generation_share.hydro',
  'electricity.generation_share.nuclear',
  'electricity.generation_share.other_renewables',
  'electricity.generation_share.solar',
  'electricity.generation_share.wind',
];
const FOSSIL_FUEL_IDS = [
  'electricity.generation_share.coal',
  'electricity.generation_share.gas',
  'electricity.generation_share.other_fossil',
];
const FUEL_IDS = [...CLEAN_FUEL_IDS, ...FOSSIL_FUEL_IDS];
const EXPECTED_COVERAGE = {
  'climate.precipitation.change': 245,
  'climate.precipitation.observed_trend': 245,
  'climate.temperature.change': 245,
  'climate.temperature.observed_trend': 245,
  'electricity.carbon_intensity': 194,
  'electricity.clean_share': 195,
  'electricity.clean_share_change_5y': 195,
  'electricity.emissions': 195,
  'electricity.fossil_share': 195,
  'electricity.generation_share.bioenergy': 194,
  'electricity.generation_share.coal': 192,
  'electricity.generation_share.gas': 191,
  'electricity.generation_share.hydro': 191,
  'electricity.generation_share.nuclear': 183,
  'electricity.generation_share.other_fossil': 194,
  'electricity.generation_share.other_renewables': 170,
  'electricity.generation_share.solar': 194,
  'electricity.generation_share.wind': 192,
  'electricity.wind_solar_share': 195,
  'emissions.fossil_co2.consumption': 120,
  'emissions.fossil_co2.cumulative': 213,
  'emissions.fossil_co2.net_transfer': 120,
  'emissions.fossil_co2.territorial': 213,
  'emissions.fossil_co2.territorial_per_capita': 213,
  'emissions.ghg.independent': 249,
  'emissions.land_use_co2.net': 197,
  'population.estimate': 236,
};

function checkComponentReceipts(runtime, manifest) {
  for (const [id, receipt] of Object.entries(manifest.component_artifacts)) {
    assert.strictEqual(fileSha256(path.join(ROOT, receipt.path)), receipt.sha256, `${id} component checksum mismatch`);
    assert.deepStrictEqual(runtime.release.input_artifacts[id], receipt, `${id} runtime receipt differs from release manifest`);
  }
  assert.strictEqual(fileSha256(path.join(ROOT, manifest.official_context.path)), manifest.official_context.sha256, 'official context checksum mismatch');
  assert.deepStrictEqual(runtime.release.input_artifacts.official_context, manifest.official_context, 'official context receipt mismatch');
  for (const receipt of [manifest.source_receipts, manifest.transformation_log]) {
    assert(receipt?.path && receipt?.sha256, 'release manifest is missing a source/transformation receipt');
    assert.strictEqual(fileSha256(path.join(ROOT, receipt.path)), receipt.sha256, `${receipt.path} checksum mismatch`);
  }
  const sourceReceipts = readJson(path.join(ROOT, manifest.source_receipts.path));
  const ember = sourceReceipts.sources.find(source => source.source_registry_id === 'ember-yearly-electricity-data-2026-08-25');
  assert(ember?.raw_receipt?.path && ember.raw_receipt.receipt_sha256, 'Ember exact raw receipt is missing');
  assert.strictEqual(fileSha256(path.join(ROOT, ember.raw_receipt.path)), ember.raw_receipt.receipt_sha256, 'Ember raw receipt checksum mismatch');
  assert.strictEqual(ember.raw_receipt.snapshot_sha256, '259e1095ee8ffeaf0aff37ad557916ae1823a2da13312da50ba4cec6b4574c3b', 'Ember external snapshot pin changed');
  assert.strictEqual(ember.fuel_mix_reconciliation.reconciled_entities, 194, 'Ember reconciled fuel-mix count changed');
  assert.deepStrictEqual(ember.fuel_mix_reconciliation.explicit_fuel_mix_gaps, ['LSO'], 'Ember fuel-mix gap ledger changed');
  assert.strictEqual(ember.fuel_mix_reconciliation.missing_as_zero_allowed, false, 'Ember blanks must never become zero');
  assert.strictEqual(ember.fuel_mix_reconciliation.visual_normalization_applied, false, 'Ember fuel bars must not silently normalize shares');
  const observed = sourceReceipts.sources.find(source => source.source_registry_id === 'world-bank-cckp-era5-2026-08-25');
  assert(observed, 'ERA5 source receipt bundle is missing');
  for (const key of ['raw_receipt', 'normalized_receipt', 'precipitation_raw_receipt', 'precipitation_normalized_receipt']) {
    const receipt = observed[key];
    assert(receipt?.path && receipt?.receipt_sha256, `ERA5 ${key} is missing`);
    assert.strictEqual(fileSha256(path.join(ROOT, receipt.path)), receipt.receipt_sha256, `ERA5 ${key} checksum mismatch`);
  }
}

function checkDerived(country) {
  const metrics = country.metrics;
  const territorial = metrics['emissions.fossil_co2.territorial'];
  const population = metrics['population.estimate'];
  const perCapita = metrics['emissions.fossil_co2.territorial_per_capita'];
  if (territorial.value !== null && population.value !== null) {
    assert.strictEqual(perCapita.value, round((territorial.value * 1000000) / population.value), `${country.iso_alpha3} per-capita derivation mismatch`);
  } else {
    assert.strictEqual(perCapita.value, null, `${country.iso_alpha3} per-capita value must remain a gap`);
  }

  const change = metrics['electricity.clean_share_change_5y'];
  if (change.value !== null) {
    assert.strictEqual(change.transformation, 'clean_share_2024_minus_clean_share_2019');
    assert.strictEqual(change.status, 'actual');
  }

  const cleanShare = metrics['electricity.clean_share'];
  const fossilShare = metrics['electricity.fossil_share'];
  const reconciliation = cleanShare.context?.fuel_mix_reconciliation || null;
  const availableFuelIds = FUEL_IDS.filter(metricId => metrics[metricId].value !== null);
  for (const metricId of FUEL_IDS) {
    const fuel = metrics[metricId];
    if (fuel.value === null) continue;
    assert(fuel.value >= 0 && fuel.value <= 100, `${country.iso_alpha3} ${metricId} must remain a published 0–100 share`);
    assert.strictEqual(fuel.status, 'actual', `${country.iso_alpha3} ${metricId} must be annual actual`);
    assert.strictEqual(fuel.transformation, 'source_value_selected_without_derivation');
  }
  if (reconciliation) {
    const cleanComponents = round(CLEAN_FUEL_IDS.reduce((sum, metricId) => sum + (metrics[metricId].value || 0), 0));
    const fossilComponents = round(FOSSIL_FUEL_IDS.reduce((sum, metricId) => sum + (metrics[metricId].value || 0), 0));
    assert(availableFuelIds.length > 0, `${country.iso_alpha3} reconciliation has no published fuel rows`);
    assert.strictEqual(reconciliation.clean_component_sum, cleanComponents, `${country.iso_alpha3} clean components changed`);
    assert.strictEqual(reconciliation.fossil_component_sum, fossilComponents, `${country.iso_alpha3} fossil components changed`);
    assert.strictEqual(reconciliation.clean_aggregate, cleanShare.value, `${country.iso_alpha3} clean anchor changed`);
    assert.strictEqual(reconciliation.fossil_aggregate, fossilShare.value, `${country.iso_alpha3} fossil anchor changed`);
    assert(Math.abs(reconciliation.clean_delta_pp) <= reconciliation.tolerance_pp, `${country.iso_alpha3} clean mix does not reconcile`);
    assert(Math.abs(reconciliation.fossil_delta_pp) <= reconciliation.tolerance_pp, `${country.iso_alpha3} fossil mix does not reconcile`);
    assert(Math.abs(reconciliation.published_component_sum - 100) <= reconciliation.tolerance_pp, `${country.iso_alpha3} published mix exceeds rounding boundary`);
    assert.strictEqual(reconciliation.visual_normalization_applied, false, `${country.iso_alpha3} fuel mix must copy, not rescale, source values`);
  } else {
    assert.strictEqual(availableFuelIds.length, 0, `${country.iso_alpha3} fuel rows exist without a reconciliation receipt`);
  }

  const land = metrics['emissions.land_use_co2.net'];
  if (land.value !== null) {
    const models = ['BLUE', 'OSCAR', 'LUCE'].map(model => land.context.model_means[model]);
    assert.strictEqual(land.value, round(mean(models)), `${country.iso_alpha3} land-use mean mismatch`);
    assert.strictEqual(land.uncertainty.sigma, round(populationStdDev(models)), `${country.iso_alpha3} land-use sigma mismatch`);
    assert.strictEqual(land.context.negative_values_are_removals, true);
  }

  for (const metricId of ['climate.temperature.change', 'climate.precipitation.change']) {
    const projection = metrics[metricId];
    if (projection.value !== null) {
      assert(projection.uncertainty.p10 <= projection.uncertainty.median && projection.uncertainty.median <= projection.uncertainty.p90,
        `${country.iso_alpha3} ${metricId} percentile order invalid`);
      assert.strictEqual(projection.value, projection.uncertainty.median);
      assert.deepStrictEqual(Object.keys(projection.context.scenario_medians).sort(), ['SSP1-2.6', 'SSP2-4.5', 'SSP5-8.5']);
    }
  }

  for (const metricId of ['climate.temperature.observed_trend', 'climate.precipitation.observed_trend']) {
    const observed = metrics[metricId];
    assert.strictEqual(observed.evidence_kind, 'reanalysis', `${country.iso_alpha3} ${metricId} must expose reanalysis evidence semantics`);
    if (observed.value !== null && Array.isArray(observed.series)) {
      assert.strictEqual(observed.value, olsSlopePerDecade(observed.series), `${country.iso_alpha3} ${metricId} OLS mismatch`);
      const fit = olsTrendLine(observed.series);
      assert.deepStrictEqual(observed.context.trend_line, [fit.start, fit.end], `${country.iso_alpha3} ${metricId} trend-line mismatch`);
    }
  }

  const observedTemperature = metrics['climate.temperature.observed_trend'];
  if (observedTemperature.value !== null) {
    assert.strictEqual(observedTemperature.series.length, 56, `${country.iso_alpha3} ERA5 series must cover 1970–2025`);
    assert.strictEqual(observedTemperature.series[0].year, 1970);
    assert.strictEqual(observedTemperature.series.at(-1).year, 2025);
    assert.strictEqual(observedTemperature.period.label, '1970–2025');
    assert.strictEqual(observedTemperature.context.series_unit, '°C');
    assert.strictEqual(observedTemperature.context.reanalysis, 'ERA5');
  }

  const observedPrecipitation = metrics['climate.precipitation.observed_trend'];
  if (observedPrecipitation.value !== null) {
    assert.strictEqual(observedPrecipitation.series.length, 56, `${country.iso_alpha3} ERA5 precipitation series must cover 1970–2025`);
    assert.strictEqual(observedPrecipitation.series[0].year, 1970);
    assert.strictEqual(observedPrecipitation.series.at(-1).year, 2025);
    assert.strictEqual(observedPrecipitation.period.label, '1970–2025');
    assert.strictEqual(observedPrecipitation.unit, 'mm/year/decade');
    assert.strictEqual(observedPrecipitation.context.series_unit, 'mm/year');
    assert.strictEqual(observedPrecipitation.context.annual_statistic_label, 'Annual total');
    assert.strictEqual(observedPrecipitation.context.reanalysis, 'ERA5');
  }
}

function checkGoldenCountries(byIso3, runtime) {
  assert.strictEqual(runtime.lens_orders.carbon.ordered[0].iso_alpha3, 'CHN');
  assert.strictEqual(runtime.lens_orders.carbon.ordered[1].iso_alpha3, 'USA');
  assert.strictEqual(runtime.lens_orders.carbon.ordered[2].iso_alpha3, 'IND');
  assert(byIso3.get('BRA').metrics['emissions.land_use_co2.net'].uncertainty.sigma > 0, 'Brazil land-use spread missing');
  assert(byIso3.get('FRA').metrics['emissions.fossil_co2.consumption'].value !== null, 'France consumption context missing');
  assert(byIso3.get('NOR').metrics['electricity.clean_share'].value > 90, 'Norway clean-power fixture unexpected');
  assert(byIso3.get('TUV'), 'Tuvalu must remain navigable');
  assert(byIso3.get('ATA'), 'Antarctica must remain navigable');
  assert.strictEqual(byIso3.get('ATA').metrics['climate.temperature.change'].value, null, 'Antarctica projection must remain an explicit gap');
  assert(byIso3.get('JPN').metrics['climate.temperature.observed_trend'].value !== null, 'Japan observed temperature trend missing');
  assert(byIso3.get('JPN').metrics['climate.precipitation.observed_trend'].value !== null, 'Japan observed precipitation trend missing');
  assert.strictEqual(byIso3.get('FRA').metrics['electricity.clean_share'].value, 94.9, 'France clean-share anchor changed');
  assert.strictEqual(byIso3.get('FRA').metrics['electricity.generation_share.nuclear'].value, 67.7, 'France nuclear share changed');
  assert.strictEqual(byIso3.get('COD').metrics['electricity.generation_share.hydro'].value, 84.17, 'DR Congo hydro share changed');
  assert.strictEqual(byIso3.get('ISL').metrics['electricity.generation_share.other_renewables'].value, 29.24, 'Iceland Other Renewables share changed');
  assert(byIso3.get('ISL').metrics['electricity.generation_share.other_renewables'].context.taxonomy_note.includes('geothermal, tidal, and wave'), 'Other Renewables taxonomy must stay aggregated');
  assert.strictEqual(byIso3.get('KEN').metrics['electricity.clean_share'].context.fuel_mix_reconciliation.published_component_sum, 100.01, 'Kenya rounding disclosure fixture changed');
  assert.strictEqual(byIso3.get('LSO').metrics['electricity.carbon_intensity'].value, null, 'Lesotho blank intensity must remain a gap');
  assert(FUEL_IDS.every(metricId => byIso3.get('LSO').metrics[metricId].value === null), 'Lesotho blank fuel cells must not become zeroes');
  assert.strictEqual(byIso3.get('LSO').metrics['electricity.clean_share'].context.fuel_mix_reconciliation, null, 'Lesotho must not receive a fabricated fuel mix');
  const observedTemperatureGaps = Array.from(byIso3.values())
    .filter(country => country.metrics['climate.temperature.observed_trend'].value === null)
    .map(country => country.iso_alpha3)
    .sort();
  assert.deepStrictEqual(observedTemperatureGaps, ['ATA', 'ESH', 'FLK', 'SGS'], 'Observed temperature gaps differ from the reviewed CCKP identity ledger');
  const observedPrecipitationGaps = Array.from(byIso3.values())
    .filter(country => country.metrics['climate.precipitation.observed_trend'].value === null)
    .map(country => country.iso_alpha3)
    .sort();
  assert.deepStrictEqual(observedPrecipitationGaps, ['ATA', 'ESH', 'FLK', 'SGS'], 'Observed precipitation gaps differ from the reviewed CCKP identity ledger');
}

function check() {
  const runtime = readJson(RUNTIME_PATH);
  const manifest = readJson(MANIFEST_PATH);
  const registry = readJson(path.join(ROOT, 'data/climate/country-registry.json'));
  const runtimeSha = fileSha256(RUNTIME_PATH);
  const dataSource = fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8');
  const pinnedSha = dataSource.match(/CLIMATE_INTELLIGENCE_SHA256 = '([a-f0-9]{64})'/)?.[1];
  assert.strictEqual(pinnedSha, runtimeSha, 'js/data.js does not pin the exact runtime SHA-256');
  assert.strictEqual(runtime.schema_version, '1.0.0');
  assert.strictEqual(runtime.release.status, 'candidate');
  assert.strictEqual(runtime.release.production_runtime_release, false);
  assert.strictEqual(runtime.release.entity_count, ENTITY_COUNT);
  assert.strictEqual(runtime.release.comparison_baseline_year, 2024);
  assert.strictEqual(runtime.release.review_state, 'normalized_factual_candidate_pending_source_revalidation');
  assert.strictEqual(manifest.gates.independent_scientific_review, false, 'candidate must not claim independent scientific review');
  assert.strictEqual(manifest.gates.raw_receipt_revalidation, false, 'candidate must not claim raw-receipt revalidation');
  assert.strictEqual(manifest.gates.redistribution_rights_revalidation, false, 'candidate must not claim release-specific redistribution-rights revalidation');
  checkComponentReceipts(runtime, manifest);

  assert.strictEqual(runtime.countries.length, ENTITY_COUNT);
  const countryIds = runtime.countries.map(country => country.country_id);
  assert.strictEqual(new Set(countryIds).size, ENTITY_COUNT, 'country_id values must be unique');
  assert.deepStrictEqual(new Set(countryIds), new Set(registry.entities.map(entity => entity.country_id)), 'runtime and registry entity universes differ');
  const metricIds = Object.keys(runtime.metric_definitions).sort();
  assert.strictEqual(metricIds.length, 27);
  const coverage = Object.fromEntries(metricIds.map(id => [id, 0]));
  for (const country of runtime.countries) {
    assert.deepStrictEqual(Object.keys(country.metrics).sort(), metricIds, `${country.country_id} metric set differs`);
    for (const metricId of metricIds) {
      const metric = country.metrics[metricId];
      assertMetricRecord(metric, metricId);
      if (metric.value !== null) {
        coverage[metricId] += 1;
        assert.strictEqual(metric.scope_fingerprint, scopeFingerprint(metric.scope), `${country.iso_alpha3}/${metricId} scope checksum mismatch`);
      }
    }
    checkDerived(country);
    const population = country.metrics['population.estimate'];
    if (population.value !== null) {
      assert.strictEqual(population.status, 'modeled', `${country.iso_alpha3} WPP 2024 denominator must be labeled as a projection`);
      assert.strictEqual(population.context.release_year_classification, 'year_matched_2024_medium_projection');
    }
  }
  assert.deepStrictEqual(coverage, EXPECTED_COVERAGE, 'candidate metric coverage changed');
  for (const metricId of metricIds) {
    assert.deepStrictEqual(runtime.coverage[metricId], { available: coverage[metricId], gaps: ENTITY_COUNT - coverage[metricId] });
  }

  assert.deepStrictEqual(runtime.lens_catalog.map(lens => lens.id), ['carbon', 'power', 'physical']);
  for (const lens of runtime.lens_catalog) {
    const order = runtime.lens_orders[lens.id];
    assert.strictEqual(order.ordered.length, order.eligible_count);
    assert.strictEqual(order.unranked.length, order.unranked_count);
    assert.strictEqual(order.eligible_count + order.unranked_count, ENTITY_COUNT);
    assert.strictEqual(new Set([...order.ordered, ...order.unranked].map(row => row.country_id)).size, ENTITY_COUNT);
    order.ordered.forEach((row, index) => {
      const country = runtime.countries.find(candidate => candidate.country_id === row.country_id);
      const metric = country.metrics[lens.comparison_metric_id];
      assert.strictEqual(row.ordinal, index + 1);
      assert.strictEqual(row.value, metric.value);
      assert.strictEqual(metric.period.label, lens.period);
      assert.strictEqual(metric.status, lens.evidence_status);
      if (lens.evidence_status === 'actual') assert.strictEqual(metric.status, 'actual', `${lens.id} order contains an estimate or model`);
      if (index) assert(order.ordered[index - 1].value >= row.value, `${lens.id} order is not descending`);
    });
    order.unranked.forEach(row => assert(row.reason?.code && row.reason?.detail, `${lens.id} gap lacks a reason`));
  }

  assert.strictEqual(scopesExactlyMatch(
    runtime.countries[0].metrics['emissions.fossil_co2.territorial'].scope,
    runtime.countries[0].metrics['emissions.ghg.independent'].scope
  ), false, 'mismatched carbon scopes must not match');
  assert.strictEqual(runtime.boundaries.mismatched_scope_deltas, false);
  assert.strictEqual(runtime.boundaries.composite_score, false);
  const raw = fs.readFileSync(RUNTIME_PATH, 'utf8');
  assert(!/"(?:source_)?disagreement_percentage"\s*:|"composite_climate_score"\s*:/i.test(raw), 'runtime contains a forbidden disagreement-percentage or composite-score value');
  assert(!raw.includes('primap-hist-2.7-final'), 'PRIMAP v2.7 must not enter the runtime');
  const primap = runtime.source_catalog.find(source => source.id === 'primap-hist-2.6.1-final');
  assert(primap && primap.public_role === 'citation_only' && primap.values_in_release === false, 'PRIMAP v2.6.1 must be citation-only');
  checkGoldenCountries(new Map(runtime.countries.map(country => [country.iso_alpha3, country])), runtime);
  return { runtimeSha, coverage };
}

function main() {
  const result = check();
  console.log(`Country Climate Intelligence runtime check passed (SHA-256 ${result.runtimeSha}; 249 entities; 27 metrics; 3 lenses).`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { EXPECTED_COVERAGE, check };
