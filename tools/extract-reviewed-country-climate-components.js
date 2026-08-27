#!/usr/bin/env node
'use strict';

/**
 * One-way recovery/import gate for reviewed normalized facts.
 *
 * This is deliberately not a source compiler. It exists so an exact, hashed,
 * already-reviewed factual candidate can be separated into component artifacts
 * after loss of an uncommitted mission worktree. Future releases must use the
 * component-specific raw snapshot compilers instead.
 */

const fs = require('fs');
const path = require('path');
const {
  ENTITY_COUNT,
  ROOT,
  assertEntityPartition,
  assertMetricRecord,
  fileSha256,
  option,
  readJson,
  writeJson,
} = require('./lib/country-climate-intelligence');

const COMPONENTS = {
  gcb: {
    file: 'gcb-carbon.json',
    metrics: [
      'emissions.fossil_co2.territorial',
      'emissions.fossil_co2.cumulative',
      'emissions.fossil_co2.consumption',
      'emissions.fossil_co2.net_transfer',
      'emissions.land_use_co2.net',
    ],
    source_registry_ids: ['gcp-gcb-2025-v1.0'],
  },
  wpp: {
    file: 'wpp-population.json',
    metrics: ['population.wpp_medium_projection'],
    source_registry_ids: ['un-wpp-2024'],
  },
  ember: {
    file: 'ember-power.json',
    metrics: [
      'electricity.clean_share',
      'electricity.fossil_share',
      'electricity.wind_solar_share',
      'electricity.carbon_intensity',
      'electricity.emissions',
      'electricity.clean_share_change_5y',
      'electricity.generation_share.bioenergy',
      'electricity.generation_share.coal',
      'electricity.generation_share.gas',
      'electricity.generation_share.hydro',
      'electricity.generation_share.nuclear',
      'electricity.generation_share.other_fossil',
      'electricity.generation_share.other_renewables',
      'electricity.generation_share.solar',
      'electricity.generation_share.wind',
    ],
    source_registry_ids: ['ember-yearly-electricity-data-2026-08-25'],
  },
  cckp: {
    file: 'cckp-physical.json',
    metrics: [
      'climate.temperature.observed_trend',
      'climate.precipitation.observed_trend',
      'climate.temperature.change',
      'climate.precipitation.change',
    ],
    source_registry_ids: [
      'world-bank-cckp-cmip6-2026-08-24',
      'world-bank-cckp-era5-2026-08-24',
    ],
  },
};
const COMPONENT_REVIEW_STATES = Object.freeze({
  cckp: 'normalized_factual_candidate_pending_independent_scientific_review',
  ember: 'normalized_factual_candidate_pending_independent_scientific_review',
  gcb: 'normalized_factual_candidate_pending_independent_scientific_review',
  wpp: 'normalized_factual_candidate_pending_independent_scientific_review',
});
const RELEASE_PENDING_SOURCE_IDS = new Set([
  'ember-yearly-electricity-data-2026-08-25',
  'un-wpp-2024',
  'world-bank-cckp-cmip6-2026-08-24',
]);

function main() {
  const args = process.argv.slice(2);
  const input = path.resolve(option(args, '--input', path.join(ROOT, 'data/climate/runtime/country-climate-intelligence.json')));
  const expectedSha = option(args, '--expected-sha');
  const outputDir = path.resolve(option(args, '--output-dir', path.join(ROOT, 'data/climate/releases/country-climate-intelligence-v1')));
  if (!/^[a-f0-9]{64}$/.test(expectedSha || '')) throw new Error('--expected-sha is required and must be a lowercase SHA-256 digest');
  const actualSha = fileSha256(input);
  if (actualSha !== expectedSha) throw new Error(`Reviewed candidate SHA mismatch: expected ${expectedSha}, received ${actualSha}`);

  const runtime = readJson(input);
  if (runtime.release?.production_runtime_release !== false || runtime.release?.status !== 'candidate') {
    throw new Error('Only a non-production factual candidate may enter the reviewed recovery path');
  }
  if (!Array.isArray(runtime.countries) || runtime.countries.length !== ENTITY_COUNT) {
    throw new Error(`Reviewed candidate must contain exactly ${ENTITY_COUNT} countries`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const artifacts = {};
  for (const [componentId, definition] of Object.entries(COMPONENTS)) {
    const countries = runtime.countries.map(country => {
      const metrics = {};
      for (const metricId of definition.metrics) {
        assertMetricRecord(country.metrics?.[metricId], metricId);
        metrics[metricId] = country.metrics[metricId];
      }
      return {
        country_id: country.country_id,
        iso_alpha3: country.iso_alpha3,
        metrics,
      };
    });
    assertEntityPartition(countries);
    const artifact = {
      artifact_type: 'recovered_normalized_country_facts_pending_source_revalidation',
      countries,
      entity_count: ENTITY_COUNT,
      generated_on: runtime.release.generated_on,
      identity_accounting: {
        country_rows: ENTITY_COUNT,
        gap_records_preserved: true,
        imputation_allowed: false,
        missing_as_zero_allowed: false,
        rule: 'Every registry entity has one row. Raw snapshot compilers separately require every upstream row to map once or receive an enumerated exception.',
      },
      metric_ids: definition.metrics,
      provenance_recovery: {
        input_kind: 'exact_sha_candidate_runtime',
        input_sha256: actualSha,
        reason: 'Recovered normalized candidate facts after an uncommitted temporary mission worktree was purged. No value was recalculated or independently reviewed in this step.',
        reusable_for_future_source_release: false,
      },
      release_id: runtime.release.id,
      review_state: COMPONENT_REVIEW_STATES[componentId],
      schema_version: '1.0.0',
      source_registry_ids: definition.source_registry_ids,
    };
    const artifactPath = path.join(outputDir, definition.file);
    const sha256 = writeJson(artifactPath, artifact);
    artifacts[componentId] = {
      path: path.relative(ROOT, artifactPath),
      sha256,
    };
  }

  const officialPath = path.join(ROOT, 'data/climate/evidence/major-emitter-ndc-source-audit.json');
  const sourceReceiptsPath = path.join(outputDir, 'source-receipts.json');
  const transformationLogPath = path.join(outputDir, 'TRANSFORMATION-LOG.md');
  const manifest = {
    artifact_type: 'country_climate_intelligence_release_manifest',
    boundaries: runtime.boundaries,
    component_artifacts: artifacts,
    gates: {
      atomic_service_worker_staging: false,
      independent_scientific_review: false,
      runtime_validation: false,
      raw_receipt_revalidation: true,
      redistribution_rights_revalidation: false,
      source_registry_approval: true,
      visual_review: false,
    },
    lens_catalog: runtime.lens_catalog,
    metric_definitions: runtime.metric_definitions,
    official_context: {
      path: path.relative(ROOT, officialPath),
      redistribution: 'metadata_only',
      sha256: fileSha256(officialPath),
    },
    prior_runtime_retained_for_rollback: runtime.release.prior_runtime_retained_for_rollback,
    release: {
      comparison_baseline_year: runtime.release.comparison_baseline_year,
      entity_count: ENTITY_COUNT,
      generated_on: runtime.release.generated_on,
      id: runtime.release.id,
      production_runtime_release: false,
      review_state: runtime.release.review_state,
      status: 'candidate',
    },
    reviewed_candidate_recovery_sha256: actualSha,
    ...(fs.existsSync(sourceReceiptsPath) ? {
      source_receipts: { path: path.relative(ROOT, sourceReceiptsPath), sha256: fileSha256(sourceReceiptsPath) },
    } : {}),
    ...(fs.existsSync(transformationLogPath) ? {
      transformation_log: { path: path.relative(ROOT, transformationLogPath), sha256: fileSha256(transformationLogPath) },
    } : {}),
    schema_ref: 'data/climate/schemas/country-climate-intelligence.schema.json',
    schema_version: '1.0.0',
    source_catalog: runtime.source_catalog.map(source => RELEASE_PENDING_SOURCE_IDS.has(source.id)
      ? { ...source, review_state: 'pending' }
      : source),
    validation_receipts: [],
  };
  writeJson(path.join(outputDir, 'release-manifest.json'), manifest);
  console.log(`Extracted ${Object.keys(COMPONENTS).length} reviewed component artifacts for ${ENTITY_COUNT} registry entities.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { COMPONENTS };
