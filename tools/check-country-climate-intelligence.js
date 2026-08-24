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
  populationStdDev,
  readJson,
  round,
  scopeFingerprint,
  scopesExactlyMatch,
} = require('./lib/country-climate-intelligence');

const RUNTIME_PATH = path.join(ROOT, 'data/climate/runtime/country-climate-intelligence.json');
const MANIFEST_PATH = path.join(ROOT, 'data/climate/releases/country-climate-intelligence-v1/release-manifest.json');
const EXPECTED_COVERAGE = {
  'climate.precipitation.change': 245,
  'climate.precipitation.observed_trend': 0,
  'climate.temperature.change': 245,
  'climate.temperature.observed_trend': 0,
  'electricity.carbon_intensity': 195,
  'electricity.clean_share': 195,
  'electricity.clean_share_change_5y': 195,
  'electricity.emissions': 195,
  'electricity.fossil_share': 195,
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
    if (observed.value !== null && Array.isArray(observed.series)) {
      assert.strictEqual(observed.value, olsSlopePerDecade(observed.series), `${country.iso_alpha3} ${metricId} OLS mismatch`);
    }
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
  assert.strictEqual(manifest.gates.independent_scientific_review, false, 'candidate must not claim independent scientific review');
  checkComponentReceipts(runtime, manifest);

  assert.strictEqual(runtime.countries.length, ENTITY_COUNT);
  const countryIds = runtime.countries.map(country => country.country_id);
  assert.strictEqual(new Set(countryIds).size, ENTITY_COUNT, 'country_id values must be unique');
  assert.deepStrictEqual(new Set(countryIds), new Set(registry.entities.map(entity => entity.country_id)), 'runtime and registry entity universes differ');
  const metricIds = Object.keys(runtime.metric_definitions).sort();
  assert.strictEqual(metricIds.length, 18);
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
  console.log(`Country Climate Intelligence runtime check passed (SHA-256 ${result.runtimeSha}; 249 entities; 18 metrics; 3 lenses).`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { EXPECTED_COVERAGE, check };
