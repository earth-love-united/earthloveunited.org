#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  ROOT,
  fileSha256,
  option,
  readJson,
  sha256,
  stable,
  writeJson,
} = require('./lib/country-climate-intelligence');

const OUTPUT = 'data/climate/releases/country-climate-intelligence-v1/review-request.json';
const SUBJECT_PATHS = Object.freeze([
  '.github/workflows/ci.yml',
  '.github/CODEOWNERS',
  'ARCHITECTURE.md',
  'css/globe-system.css',
  'css/guided-first-orbit.css',
  'data/climate/country-registry.json',
  'data/climate/evidence/major-emitter-ndc-source-audit.json',
  'data/climate/releases/country-climate-intelligence-v1/TRANSFORMATION-LOG.md',
  'data/climate/releases/country-climate-intelligence-v1/cckp-physical.json',
  'data/climate/releases/country-climate-intelligence-v1/cckp-era5-precipitation-normalized-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/cckp-era5-precipitation-raw-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/cckp-era5-temperature-normalized-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/cckp-era5-temperature-raw-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/climate-trace-ghg.json',
  'data/climate/releases/country-climate-intelligence-v1/ember-2026-08-25-raw-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/ember-power.json',
  'data/climate/releases/country-climate-intelligence-v1/gcb-carbon.json',
  'data/climate/releases/country-climate-intelligence-v1/release-manifest.json',
  'data/climate/releases/country-climate-intelligence-v1/source-receipts.json',
  'data/climate/releases/country-climate-intelligence-v1/wpp-population.json',
  'data/climate/runtime/country-climate-intelligence.json',
  'data/climate/schemas/country-climate-intelligence-release-approval.schema.json',
  'data/climate/schemas/country-climate-intelligence-review-request.schema.json',
  'data/climate/schemas/country-climate-intelligence-reviewed-runtime-manifest.schema.json',
  'data/climate/schemas/country-climate-intelligence.schema.json',
  'data/climate/schemas/country-registry.schema.json',
  'data/climate/schemas/reviewed-release-diff.schema.json',
  'data/climate/schemas/reviewed-runtime-rollback-proof.schema.json',
  'data/climate/source-registry.json',
  'docs/COUNTRY-CLIMATE-METHODOLOGY.md',
  'docs/COUNTRY-CLIMATE-RELEASE-REVIEW.md',
  'docs/COUNTRY-CLIMATE-SOURCE-RIGOR-AUDIT.md',
  'docs/COUNTRY-CLIMATE-TRUTH-PLAN.md',
  'index.html',
  'js/app.js',
  'js/carbon-clock.js',
  'js/country-climate-intelligence.js',
  'js/data-schema.js',
  'js/data.js',
  'js/event-bus.js',
  'js/gaia-utils.js',
  'js/globe.js',
  'js/guided-first-orbit.js',
  'js/module-contracts.js',
  'js/storage-adapter.js',
  'js/storage.js',
  'sw.js',
  'tools/build-deploy.sh',
  'tools/build-country-climate-intelligence.js',
  'tools/check-climate-source-registry.js',
  'tools/check-climate-runtime-diff-boundary.js',
  'tools/check-country-accessibility.js',
  'tools/check-country-climate-intelligence-ui.js',
  'tools/check-country-climate-intelligence-ci.js',
  'tools/check-country-climate-intelligence-release-gate.js',
  'tools/check-country-climate-public-release-boundary.js',
  'tools/check-country-climate-intelligence.js',
  'tools/check-country-climate-runtime-atomic.js',
  'tools/check-ct42-runtime-rollback-review.js',
  'tools/check-globe-runtime-assets.js',
  'tools/check-globe-webgl-fallback.js',
  'scripts/verify_load_order.py',
  'tools/check-public-copy.js',
  'tools/check-public-climate-release-profile.js',
  'tools/check-public-deploy-surface.js',
  'tools/check-staged-production-integrity.js',
  'tools/compile-cckp-physical.js',
  'tools/compile-climate-trace.js',
  'tools/compile-ember-power.js',
  'tools/compile-gcb-emissions.js',
  'tools/compile-wpp-population.js',
  'tools/extract-reviewed-country-climate-components.js',
  'tools/fixtures/globe-runtime-assets.json',
  'data/climate/fixtures/climate-runtime-diff-boundary.json',
  'tools/migrate-climate-trace-source-identity.js',
  'tools/migrate-wpp-medium-projection-id.js',
  'tools/lib/country-climate-intelligence.js',
  'tools/lib/country-climate-intelligence-release-gate.js',
  'tools/lib/climate-runtime-diff-boundary.js',
  'tools/lib/globe-runtime-assets.js',
  'tools/lib/json-schema-lite.js',
  'tools/lib/public-climate-release-profile.js',
  'tools/lib/public-deploy-surface.js',
  'tools/lib/reviewed-runtime-rollback-proof.js',
  'tools/prepare-country-climate-intelligence-review-request.js',
  'tools/stage-public-deploy.js',
  'tools/smoke-test.js',
  'tools/stack-lint.js',
  'tools/test-climate-source-registry.js',
  'tools/test-country-climate-compilers.js',
  'tools/verify-legacy-country-exit.js',
].sort());

const SOURCE_REVIEWS = Object.freeze([
  {
    source_registry_id: 'gcp-gcb-2025-v1.0',
    values_in_release: true,
    raw_receipt_state: 'exact_receipt_pinned_pending_independent_revalidation',
    source_identity_state: 'exact_object_pinned',
    rights_state: 'documented_pending_independent_confirmation',
    attribution_candidate: 'Global Carbon Project (2025), Supplemental data of Global Carbon Budget 2025, version 1.0, DOI 10.18160/GCP-2025; Earth Love United changes and unit conversions identified.',
    official_evidence_urls: [
      'https://doi.org/10.18160/GCP-2025',
      'https://meta.icos-cp.eu/collections/AxnIW-ydMBT4BdKjxV63DGQl',
    ],
    required_evidence: [
      'Independently reproduce both object byte counts and SHA-256 digests from the publisher collection.',
      'Confirm the fossil, consumption, transfer-sign, cumulative, and land-use field selections against the release workbook.',
      'Approve the exact attribution and normalized-value redistribution scope for this release.',
    ],
    blocker_codes: ['independent_rights_attestation_missing', 'scientific_review_missing'],
  },
  {
    source_registry_id: 'un-wpp-2024',
    values_in_release: true,
    raw_receipt_state: 'raw_receipt_revalidation_required',
    source_identity_state: 'raw_object_unpinned',
    rights_state: 'documented_pending_independent_confirmation',
    attribution_candidate: 'United Nations, Department of Economic and Social Affairs, Population Division (2024), World Population Prospects 2024, 2024 Medium projection; Earth Love United denominator selection identified.',
    official_evidence_urls: [
      'https://population.un.org/wpp/',
      'https://population.un.org/wpp/assets/Files/WPP2024_Methodology-Report_Final.pdf',
    ],
    required_evidence: [
      'Retain the exact WPP source filename, bytes, SHA-256 digest, retrieval URL, retrieval time, and response metadata.',
      'Confirm that 1 January 2024 begins the projection period and approve population.wpp_medium_projection as the denominator identity.',
      'Approve CC BY 3.0 IGO attribution, change notice, and normalized-value redistribution.',
    ],
    blocker_codes: ['raw_receipt_missing', 'demography_review_missing', 'independent_rights_attestation_missing'],
  },
  {
    source_registry_id: 'climate-trace-api-v7-2026-08-24-country-annual',
    values_in_release: true,
    raw_receipt_state: 'raw_receipt_revalidation_required',
    source_identity_state: 'immutable_release_binding_unresolved',
    rights_state: 'external_dataset_exceptions_unresolved',
    attribution_candidate: 'Climate TRACE API v7 country-emissions response retrieved 2026-08-24; response reported inventory version 5.9.0; immutable release binding and field-level external-source rights remain subject to review.',
    official_evidence_urls: [
      'https://climatetrace.org/data',
      'https://climatetrace.org/terms',
    ],
    required_evidence: [
      'Retain the exact API request, parameters, response bytes, SHA-256 digest, response headers, retrieval time, and immutable inventory-release binding.',
      'Resolve the terms-page exceptions for every selected country, gas, and sector field, including EDGAR and FAOSTAT-derived fields.',
      'Confirm AR6 GWP100, 2024 estimate status, forestry and LULUCF exclusion, gas totals, sector totals, and non-comparability with fossil CO2.',
    ],
    blocker_codes: ['raw_receipt_missing', 'immutable_release_binding_missing', 'external_dataset_rights_unresolved', 'ghg_inventory_review_missing'],
  },
  {
    source_registry_id: 'ember-yearly-electricity-data-2026-08-25',
    values_in_release: true,
    raw_receipt_state: 'exact_receipt_pinned_pending_independent_revalidation',
    source_identity_state: 'retrieval_snapshot_pinned',
    rights_state: 'documented_pending_independent_confirmation',
    attribution_candidate: 'Ember, Yearly Electricity Data, full long-format release retrieved 2026-08-25; Earth Love United selections and transformations identified.',
    official_evidence_urls: [
      'https://ember-energy.org/data/yearly-electricity-data/',
      'https://api.ember-energy.org/v1/docs',
    ],
    required_evidence: [
      'Independently reproduce the 49,079,981-byte snapshot SHA-256 and confirm the publisher retrieval path.',
      'Review aggregate and nine-fuel taxonomy, actual-year selection, blank preservation, 2019-2024 change, and plus or minus 0.02 percentage-point reconciliation.',
      'Approve the exact attribution and normalized-value redistribution scope.',
    ],
    blocker_codes: ['independent_raw_receipt_revalidation_missing', 'power_systems_review_missing', 'independent_rights_attestation_missing'],
  },
  {
    source_registry_id: 'world-bank-cckp-cmip6-2026-08-24',
    values_in_release: true,
    raw_receipt_state: 'raw_receipt_revalidation_required',
    source_identity_state: 'raw_object_unpinned',
    rights_state: 'derivative_chain_unresolved',
    attribution_candidate: 'World Bank Climate Change Knowledge Portal CMIP6 0.25-degree country aggregates, API response retrieved 2026-08-24; CCKP processing, CMIP6 model roster, and Earth Love United selections identified.',
    official_evidence_urls: [
      'https://climateknowledgeportal.worldbank.org/index.php/metadata',
      'https://worldbank.github.io/climateknowledgeportal/docs/collections/cmip6-x0.25.html',
      'https://wcrp-cmip.github.io/CMIP6_CVs/docs/CMIP6_source_id_licenses.html',
    ],
    required_evidence: [
      'Retain exact API or model-file receipts, checksums, parameters, response metadata, model roster, and country aggregation chain.',
      'Resolve World Bank portal terms against every CMIP6 source-model licence and any share-alike obligations.',
      'Review SSP2-4.5 p10, median, p90 and SSP1-2.6 and SSP5-8.5 median selections, reference period, country aggregation, and explicit gaps.',
    ],
    blocker_codes: ['raw_receipt_missing', 'model_roster_missing', 'derivative_rights_unresolved', 'physical_climate_review_missing'],
  },
  {
    source_registry_id: 'world-bank-cckp-era5-2026-08-25',
    values_in_release: true,
    raw_receipt_state: 'exact_receipt_pinned_pending_independent_revalidation',
    source_identity_state: 'retrieval_snapshot_pinned',
    rights_state: 'derivative_chain_unresolved',
    attribution_candidate: 'World Bank Climate Change Knowledge Portal ERA5 0.25-degree annual country temperature and precipitation aggregates, 1950-2025 API snapshots retrieved 2026-08-25; 1970-2025 selection and Earth Love United OLS transformations identified.',
    official_evidence_urls: [
      'https://worldbank.github.io/climateknowledgeportal/docs/collections/era5-x0.25.html',
      'https://cds.climate.copernicus.eu/licences/licence-to-use-copernicus-products',
      'https://doi.org/10.1002/qj.3803',
    ],
    required_evidence: [
      'Independently reproduce both variable-specific API response and normalized receipt hashes.',
      'Resolve CCKP processing rights and ERA5 attribution through the derivative chain.',
      'Review annual tas and pr semantics, 1970-2025 selection, units, OLS per-decade derivation, KSV exception, and four explicit registry gaps.',
    ],
    blocker_codes: ['independent_raw_receipt_revalidation_missing', 'derivative_rights_unresolved', 'physical_climate_review_missing'],
  },
]);

const INDEPENDENT_REVIEWS = Object.freeze([
  ['carbon_accounting', [
    'GCB country mapping and 2024 territorial fossil CO2 selection.',
    'Cumulative, consumption, transfer-sign, land-use mean and population-standard-deviation derivations.',
    'Scope separation from land use and independent GHG context.',
  ]],
  ['demography', [
    'WPP 2024 Medium projection identity, year classification, unit conversion, and 236-country mapping.',
    'Per-capita denominator lineage and modeled evidence class.',
  ]],
  ['ghg_inventory', [
    'Climate TRACE API identity, gases, sectors, AR6 GWP100, forestry exclusion, estimate class, and uncertainty limits.',
    'Non-comparability with GCB fossil CO2.',
  ]],
  ['power_systems', [
    'Ember actual-year taxonomy, clean and fossil anchors, nine-fuel mix, carbon intensity, emissions, and five-year change.',
    'Blank-versus-zero handling and source-rounding reconciliation.',
  ]],
  ['physical_climate', [
    'CCKP CMIP6 scenarios, percentiles, baseline, model roster, country aggregation, and projection interpretation.',
    'ERA5 reanalysis semantics, annual tas and pr units, OLS trends, identity exceptions, and explicit gaps.',
  ]],
  ['reproducibility', [
    'All artifact hashes, deterministic rebuild, compiler denial tests, 249-entity partitions, and rollback rehearsal.',
    'Current-head release diff and runtime-manifest pin closure.',
  ]],
  ['ui_accessibility_runtime', [
    'Globe and fallback parity, keyboard and screen-reader operation, focus return, reduced motion, mobile layouts, and slow-runtime behavior.',
    'Public copy, source visibility, cache staging, and non-color-dependent evidence.',
  ]],
  ['source_rights', [
    'Release-specific normalized-value, derivative-database, attribution, notice, and external-source exception decisions.',
    'CCKP and CMIP6 derivative chain plus Climate TRACE field-level exception chain.',
  ]],
].map(([role, required_scope]) => ({ role, status: 'pending', reviewer_id: null, required_scope })));

function pin(relative) {
  return { path: relative, sha256: fileSha256(path.join(ROOT, relative)) };
}

function calculationHash(value) {
  const copy = structuredClone(value);
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function build(args) {
  const manifest = readJson(path.join(ROOT, 'data/climate/releases/country-climate-intelligence-v1/release-manifest.json'));
  const subjectCommit = option(args, '--subject-commit');
  if (subjectCommit !== null && !/^[a-f0-9]{40}$/.test(subjectCommit)) {
    throw new Error('--subject-commit must be a lowercase 40-character Git commit SHA');
  }
  const request = {
    schema_version: '1.0.0',
    request_id: `${manifest.release.id}-review-request.1`,
    release_id: manifest.release.id,
    created_at: option(args, '--created-at', '2026-08-26T00:00:00Z'),
    status: 'requires_independent_review',
    release_authority: false,
    production_runtime_release: false,
    subject: {
      commit_binding_state: subjectCommit ? 'bound_candidate_commit' : 'unbound_worktree_candidate',
      subject_commit_sha: subjectCommit,
      artifact_pins: SUBJECT_PATHS.map(pin),
    },
    governance_boundaries: {
      composite_score: false,
      target_assessment: false,
      finance_judgment: false,
      mismatched_scope_deltas: false,
      offset_adjustment: false,
      ct40_reuse_allowed: false,
    },
    source_reviews: SOURCE_REVIEWS,
    independent_reviews: INDEPENDENT_REVIEWS,
    required_release_artifacts: {
      approval: 'data/climate/releases/country-climate-intelligence-v1/release-approval.json',
      release_diff: 'data/climate/releases/country-climate-intelligence-v1/reviewed-release-diff.json',
      runtime_manifest: 'data/climate/releases/country-climate-intelligence-v1/reviewed-runtime-manifest.json',
      rollback_proof: 'data/climate/releases/country-climate-intelligence-v1/reviewed-rollback-proof.json',
    },
    prohibited_substitutions: [
      'Do not reuse CT-40 scoring, NDC, inventory, or top-20 review decisions for this no-score runtime.',
      'Do not treat source-registry configuration as release-specific rights approval.',
      'Do not treat compiler or UI tests as independent scientific review.',
      'Do not label API response metadata as an immutable publisher release without a receipt binding.',
      'Do not promote a candidate runtime whose own release metadata still denies production.',
      'Do not infer approval from a missing, partial, stale, placeholder, or hash-mismatched review artifact.',
    ],
    calculation_hash: null,
  };
  request.calculation_hash = calculationHash(request);
  return request;
}

function main() {
  const args = process.argv.slice(2);
  const outputPath = path.resolve(option(args, '--output', path.join(ROOT, OUTPUT)));
  const request = build(args);
  const digest = writeJson(outputPath, request);
  process.stdout.write(`Prepared CCI review request for ${request.subject.artifact_pins.length} exact artifacts.\n`);
  process.stdout.write(`Commit binding: ${request.subject.commit_binding_state}. SHA-256: ${digest}\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { INDEPENDENT_REVIEWS, OUTPUT, SOURCE_REVIEWS, SUBJECT_PATHS, build, calculationHash };
