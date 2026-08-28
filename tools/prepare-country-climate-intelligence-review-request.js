#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
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
const SUBJECT_BINDING_DOMAIN = 'ELU-CCI-REVIEW-SUBJECT-ARTIFACT-PINS-AND-ABSENCES-V1';
const REQUIRED_ABSENT_PATHS = Object.freeze([
  'data/climate/releases/country-climate-intelligence-v1/climate-trace-ghg.json',
  'tools/compile-climate-trace.js',
  'tools/migrate-climate-trace-source-identity.js',
].sort());
// globe.gl is fetched only after checkout and is independently constrained by
// the pinned vendor-integrity policy, fixture, fetcher, and staged-byte checks.
// The AI review outputs are created only after reviewers inspect this subject;
// their checker binds the subject digest, exact request, complete reports, and
// public bytes. Keeping review outputs outside the subject avoids a hash cycle.
const EXTERNAL_GENERATED_DEPENDENCIES = Object.freeze([
  'data/climate/reviews/cci-v1-ai-reports/luna-rights.md',
  'data/climate/reviews/cci-v1-ai-reports/luna-science.md',
  'data/climate/reviews/cci-v1-ai-reports/sol-red-team.md',
  'data/climate/reviews/cci-v1-ai-reports/terra-runtime.md',
  'data/climate/reviews/country-climate-intelligence-v1-multi-model-ai-review.json',
  'data/climate/reviews/country-climate-intelligence-v1-multi-model-ai-prepublication-review.json',
  'js/vendor/globe.gl.js',
].sort());
const SUBJECT_PATHS = Object.freeze([
  '404.html',
  '.github/workflows/ci.yml',
  '.github/CODEOWNERS',
  '.gitignore',
  'ARCHITECTURE.md',
  'CREDITS.md',
  'LICENSE',
  'README.md',
  'THIRD_PARTY_NOTICES.txt',
  '_headers',
  '_redirects',
  'assets/globe/runtime/earth-blue-marble.jpg',
  'assets/globe/runtime/earth-night.jpg',
  'assets/globe/runtime/earth-topology.png',
  'assets/globe/runtime/manifest.json',
  'assets/globe/runtime/ne_110m_admin_0_countries.geojson',
  'assets/globe/runtime/night-sky.png',
  'assets/legacy/brandon.jpg',
  'assets/legacy/ekmel.jpg',
  'assets/legacy/elu-logo-light.png',
  'assets/legacy/elu-logo.png',
  'assets/legacy/mike.png',
  'assets/legacy/video-what-is-elu.jpg',
  'assets/partners/climate-change-ai.png',
  'assets/partners/connecticut-green-bank.png',
  'assets/partners/avocademy.svg',
  'assets/partners/save-planet-earth.svg',
  'assets/partners/st-vincents-wordmark.png',
  'css/carbon-clock.css',
  'css/globe-system.css',
  'css/guided-first-orbit.css',
  'data/climate/country-registry.json',
  'data/climate/governance/country-climate-intelligence-release-trust.json',
  'data/climate/mappings/gcb-2025-country-map.json',
  'data/climate/operations/ct42-runtime-rollback.patch.b64',
  'data/climate/evidence/major-emitter-ndc-source-audit.json',
  'data/climate/releases/country-climate-intelligence-v1/TRANSFORMATION-LOG.md',
  'data/climate/releases/country-climate-intelligence-v1/cckp-physical.json',
  'data/climate/releases/country-climate-intelligence-v1/cckp-cmip6-raw-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/cckp-era5-precipitation-normalized-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/cckp-era5-precipitation-raw-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/cckp-era5-temperature-normalized-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/cckp-era5-temperature-raw-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/ember-2026-08-25-raw-receipt.json',
  'data/climate/releases/country-climate-intelligence-v1/ember-power.json',
  'data/climate/releases/country-climate-intelligence-v1/gcb-carbon.json',
  'data/climate/releases/country-climate-intelligence-v1/release-manifest.json',
  'data/climate/releases/country-climate-intelligence-v1/source-receipts.json',
  'data/climate/releases/country-climate-intelligence-v1/wpp-population.json',
  'data/climate/releases/country-climate-intelligence-v1/wpp-2024-raw-receipt.json',
  'data/climate/releases/source-routing-policy-v2-2026-07-15.json',
  'data/climate/releases/top20-primary-source-gap-queue-2026-07-15.json',
  'data/climate/releases/top20-source-routing-queue-v2-2026-07-15.json',
  'data/climate/reviews/source-rights-review-packets-2026-07-15.json',
  'data/climate/runtime/country-climate-intelligence.json',
  'data/climate/schemas/country-climate-intelligence-release-approval.schema.json',
  'data/climate/schemas/country-climate-intelligence-release-signatures.schema.json',
  'data/climate/schemas/country-climate-intelligence-review-request.schema.json',
  'data/climate/schemas/country-climate-intelligence-reviewed-runtime-manifest.schema.json',
  'data/climate/schemas/country-climate-intelligence.schema.json',
  'data/climate/schemas/country-registry.schema.json',
  'data/climate/schemas/reviewed-release-diff.schema.json',
  'data/climate/schemas/reviewed-runtime-rollback-proof.schema.json',
  'data/climate/source-registry.json',
  'data/performance/first-paint-mobile-2026-08-28.json',
  'docs/COUNTRY-CLIMATE-METHODOLOGY.md',
  'docs/CLIMATE-PRODUCTION-READINESS.md',
  'docs/COUNTRY-CLIMATE-RELEASE-REVIEW.md',
  'docs/COUNTRY-CLIMATE-SOURCE-RIGOR-AUDIT.md',
  'docs/COUNTRY-CLIMATE-TRUTH-PLAN.md',
  'docs/COUNTRY-CLIMATE-TRUTH-CI.md',
  'docs/FACTUAL-PUBLIC-DEPLOYMENT.md',
  'docs/LEGACY-COUNTRY-DATA-EXIT.md',
  'docs/agents/README.md',
  'docs/operations/GO_PUBLIC.md',
  'favicon.svg',
  'index.html',
  'js/app.js',
  'js/carbon-clock.js',
  'js/country-climate-view-model.js',
  'js/country-climate-intelligence.js',
  'js/country-ranking-compiler.js',
  'js/data-schema.js',
  'js/data.js',
  'js/event-bus.js',
  'js/gaia-utils.js',
  'js/globe.js',
  'js/guided-first-orbit.js',
  'js/module-contracts.js',
  'js/storage-adapter.js',
  'js/storage.js',
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  'sw.js',
  'tools/build-deploy.sh',
  'tools/build-cci-factual-public-deploy.sh',
  'tools/build-factual-public-deploy.sh',
  'tools/build-country-climate-intelligence.js',
  'tools/build-ct42-runtime-rollback-proof.js',
  'tools/build-major-emitter-ndc-release.js',
  'tools/acquire-cckp-cmip6.js',
  'tools/acquire-gcb-2025.js',
  'tools/acquire-wpp-2024.js',
  'tools/check-climate-factual-public-readiness.js',
  'tools/check-climate-factual-runtime-candidate.js',
  'tools/check-climate-factual-runtime-data-review.js',
  'tools/check-climate-factual-runtime-ui-review.js',
  'tools/check-climate-production-readiness-policy.js',
  'tools/check-climate-production-readiness.js',
  'tools/check-climate-release-gate.js',
  'tools/check-climate-source-registry.js',
  'tools/check-climate-runtime-diff-boundary.js',
  'tools/check-country-accessibility.js',
  'tools/check-country-climate-intelligence-ui.js',
  'tools/check-country-climate-intelligence-ci.js',
  'tools/check-country-climate-intelligence-release-gate.js',
  'tools/check-country-climate-intelligence-release-signatures.js',
  'tools/check-country-climate-public-release-boundary.js',
  'tools/check-country-climate-intelligence.js',
  'tools/check-country-climate-runtime-atomic.js',
  'tools/check-ct42-runtime-rollback-review.js',
  'tools/check-globe-runtime-approval.js',
  'tools/check-globe-runtime-assets.js',
  'tools/check-globe-third-party-notices.js',
  'tools/check-globe-vendor-integrity.js',
  'tools/check-globe-webgl-fallback.js',
  'tools/check-first-paint-performance-receipt.js',
  'scripts/verify_load_order.py',
  'tools/check-public-copy.js',
  'tools/check-climate-truth-ci.js',
  'tools/check-cci-factual-public-deploy.js',
  'tools/check-cci-factual-public-review.js',
  'tools/check-public-climate-release-profile.js',
  'tools/check-public-deploy-surface.js',
  'tools/check-source-rights-review-packets.js',
  'tools/check-source-routing-policy.js',
  'tools/check-staged-production-integrity.js',
  'tools/check-staged-cci-factual-public-integrity.js',
  'tools/check-staged-factual-public-integrity.js',
  'tools/check-top20-primary-source-gap-queue.js',
  'tools/climate-truth-ci.js',
  'tools/compile-cckp-physical.js',
  'tools/compile-ember-power.js',
  'tools/compile-gcb-emissions.js',
  'tools/compile-wpp-population.js',
  'tools/reconstruct-gcb-country-map.js',
  'tools/revalidate-cckp-cmip6-projections.js',
  'tools/extract-reviewed-country-climate-components.js',
  'tools/impact-analyzer.js',
  'tools/fixtures/globe-runtime-assets.json',
  'data/climate/fixtures/climate-runtime-diff-boundary.json',
  'data/climate/fixtures/globe-webgl-fallback.json',
  'tools/apply-country-climate-rigor-corrections.js',
  'tools/migrate-wpp-medium-projection-id.js',
  'tools/normalize-cckp-era5-country-timeseries.js',
  'tools/refresh-cckp-observed-temperature.js',
  'tools/refresh-cckp-observed-variable.js',
  'tools/lib/country-climate-intelligence.js',
  'tools/lib/gcb-country-intelligence.js',
  'tools/lib/country-climate-intelligence-release-gate.js',
  'tools/lib/country-climate-intelligence-release-signatures.js',
  'tools/lib/cci-factual-public.js',
  'tools/lib/climate-truth-component-plan.js',
  'tools/lib/climate-runtime-diff-boundary.js',
  'tools/lib/globe-runtime-assets.js',
  'tools/lib/globe-third-party-notices.js',
  'tools/lib/globe-vendor-integrity.js',
  'tools/lib/json-schema-lite.js',
  'tools/lib/public-climate-release-profile.js',
  'tools/lib/public-deploy-surface.js',
  'tools/lib/reviewed-runtime-rollback-proof.js',
  'tools/lib/source-rights-review-packets.js',
  'tools/lib/xlsx-table.js',
  'tools/prepare-country-climate-intelligence-review-request.js',
  'tools/stage-cci-factual-public-deploy.js',
  'tools/stage-public-deploy.js',
  'tools/smoke-test.js',
  'tools/stack-lint.js',
  'tools/test-climate-source-registry.js',
  'tools/test-country-climate-compilers.js',
  'tools/test-country-climate-intelligence-derivations.js',
  'tools/validate-visual-truth-fixtures.js',
  'tools/verify-legacy-country-exit.js',
  'tools/check-canonical-source-links.js',
  'tools/check-country-card-evidence-model.js',
  'tools/check-country-coverage-gap-queue.js',
  'tools/check-country-delivery-engine.js',
  'tools/check-country-emissions-evidence.js',
  'tools/check-country-evidence.js',
  'tools/check-country-profile-compiler.js',
  'tools/check-country-ranking.js',
  'tools/check-country-view-model.js',
  'tools/check-ct42-ct40-release-review-candidate.js',
  'tools/check-ct42-runtime-rollback-proof.js',
  'tools/check-legacy-country-exit-review.js',
  'tools/check-major-emitter-ndc-evidence.js',
  'tools/check-policy-finance-evidence.js',
  'tools/check-primap-economy-wide.js',
  'tools/check-primap-factual-display-promotion.js',
  'tools/check-primap-factual-display-review.js',
  'tools/check-primap-review-attestation.js',
  'tools/check-reviewed-climate-release.js',
  'tools/check-target-comparability.js',
  'tools/lib/climate-factual-runtime-candidate.js',
  'tools/lib/climate-production-readiness.js',
  'tools/lib/climate-release-gate.js',
  'tools/lib/climate-reviewed-release.js',
  'tools/lib/climate-truth-ci-policy.js',
  'tools/lib/country-accessibility-model.js',
  'tools/lib/country-card-evidence-model.js',
  'tools/lib/country-coverage-gap-queue.js',
  'tools/lib/country-delivery-engine.js',
  'tools/lib/country-profile-compiler.js',
  'tools/lib/ct42-ct40-release-review.js',
  'tools/lib/ct42-runtime-rollback-proof.js',
  'tools/lib/ct42-runtime-rollback-review.js',
  'tools/lib/globe-runtime-approval.js',
  'tools/lib/primap-factual-display-promotion.js',
  'tools/lib/primap-hist-ingest.js',
  'tools/lib/primap-observation-boundary.js',
  'tools/lib/source-routing-policy.js',
  'tools/lib/target-comparability.js',
  'tools/lib/top20-primary-source-gap-queue.js',
  'tools/rehearse-ct42-runtime-rollback.js',
  'tools/run-first-paint-benchmark.js',
  'data/carbon-projects.json',
  'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json',
  'data/climate/fixtures/climate-factual-runtime-candidate.json',
  'data/climate/fixtures/climate-factual-runtime-data-review.json',
  'data/climate/fixtures/country-accessibility.json',
  'data/climate/fixtures/country-card-evidence-model.json',
  'data/climate/fixtures/country-coverage-gap-queue.json',
  'data/climate/fixtures/country-profile-compiler.json',
  'data/climate/fixtures/country-ranking.json',
  'data/climate/fixtures/country-view-model.json',
  'data/climate/fixtures/ct42-ct40-release-review.json',
  'data/climate/fixtures/ct42-runtime-rollback-proof.json',
  'data/climate/fixtures/ct42-runtime-rollback-review.json',
  'data/climate/fixtures/delivery-engine.json',
  'data/climate/fixtures/primap-factual-display-promotion.json',
  'data/climate/fixtures/primap-ingest.json',
  'data/climate/fixtures/release-eligibility.json',
  'data/climate/fixtures/reviewed-climate-release.json',
  'data/climate/fixtures/source-rights-review-packets.json',
  'data/climate/fixtures/source-routing-policy.json',
  'data/climate/fixtures/target-comparability.json',
  'data/climate/fixtures/top20-primary-source-gap-queue.json',
  'data/climate/fixtures/truth-ci-policy.json',
  'data/climate/governance/globe-runtime-approval-trust.json',
  'data/climate/releases/climate-evidence-licensing-readiness-2026-07-15.json',
  'data/climate/releases/country-coverage-gap-queue-2026-07-15.json',
  'data/climate/releases/ct11-primary-source-pilot-2026-07-15.json',
  'data/climate/releases/primap-hist-2.6.1-economy-wide-2026-07-15.json',
  'data/climate/releases/primap-hist-2.6.1-factual-display-2026-07-15.json',
  'data/climate/reviews/climate-factual-runtime-candidate-ct42-data-review.json',
  'data/climate/reviews/climate-factual-runtime-ct42-ui-review.json',
  'data/climate/reviews/ct42-candidate-rollback-rehearsal.json',
  'data/climate/reviews/ct42-ct40-release-review-input.json',
  'data/climate/reviews/ct42-ct40-release-review-result.json',
  'data/climate/reviews/legacy-country-data-exit-ct04-review.json',
  'data/climate/reviews/primap-hist-2.6.1-economy-wide-ct10b-review.json',
  'data/climate/reviews/primap-hist-2.6.1-factual-display-ct10c-review.json',
  'data/climate/runtime/candidate-manifest.json',
  'data/climate/runtime/country-factual-candidate.json',
  'data/climate/runtime/ct10c-batch-attestation-wrapper.json',
  'data/climate/runtime/published-facts-candidate.json',
  'data/climate/runtime/rollback-plan.json',
  'data/climate/schemas/compiled-profile.schema.json',
  'data/climate/schemas/country-accessibility.schema.json',
  'data/climate/schemas/country-card-evidence-model.schema.json',
  'data/climate/schemas/country-coverage-gap-queue.schema.json',
  'data/climate/schemas/ct40-reviewed-release-input.schema.json',
  'data/climate/schemas/ct42-runtime-rollback-review.schema.json',
  'data/climate/schemas/delivery-reason-vocabulary.json',
  'data/climate/schemas/delivery-result.schema.json',
  'data/climate/schemas/enums.json',
  'data/climate/schemas/globe-runtime-assets-production-review.schema.json',
  'data/climate/schemas/observation.schema.json',
  'data/climate/schemas/primap-batch-candidate.schema.json',
  'data/climate/schemas/primap-factual-display-promotion.schema.json',
  'data/climate/schemas/profile.schema.json',
  'data/climate/schemas/ranking-release.schema.json',
  'data/climate/schemas/release-eligibility-result.schema.json',
  'data/climate/schemas/reviewed-climate-runtime-manifest.schema.json',
  'data/climate/schemas/source-rights-review-packet.schema.json',
  'data/climate/schemas/source-routing-policy.schema.json',
  'data/climate/schemas/target-comparability-result.schema.json',
  'data/climate/schemas/top20-source-routing-queue.schema.json',
  'data/governance/vendor/globe-gl-2.46.1-notices-integration.json',
  'data/governance/vendor/globe-gl-2.46.1-notices.json',
  'data/pledge-nodes.json',
  'data/small-nations.json',
  'tools/authoring/fetch-nasa-black-marble.sh',
  'tools/fetch-globe-vendor.sh',
  'tools/fixtures/globe-third-party-notices.json',
  'tools/fixtures/globe-vendor-integrity.json',
  'wrangler.jsonc',
].sort());

const SOURCE_REVIEWS = Object.freeze([
  {
    source_registry_id: 'gcp-gcb-2025-v1.0',
    values_in_release: true,
    raw_receipt_state: 'exact_receipts_independently_refetched_and_reproduced',
    source_identity_state: 'exact_object_pinned',
    rights_state: 'documented_pending_independent_confirmation',
    attribution_candidate: 'Global Carbon Project (2025), Supplemental data of Global Carbon Budget 2025, version 1.0, DOI 10.18160/GCP-2025; Earth Love United changes and unit conversions identified.',
    official_evidence_urls: [
      'https://doi.org/10.18160/GCP-2025',
      'https://meta.icos-cp.eu/collections/AxnIW-ydMBT4BdKjxV63DGQl',
    ],
    required_evidence: [
      'Confirm the independently reproduced object byte counts and SHA-256 digests from the publisher collection.',
      'Confirm the fossil, consumption, transfer-sign, cumulative, and land-use field selections against the release workbook.',
      'Approve the exact attribution and normalized-value redistribution scope for this release.',
    ],
    blocker_codes: ['independent_rights_attestation_missing', 'scientific_review_missing'],
  },
  {
    source_registry_id: 'un-wpp-2024',
    values_in_release: true,
    raw_receipt_state: 'exact_receipt_independently_refetched_and_reproduced',
    source_identity_state: 'official_2024_medium_csv_gzip_pinned',
    rights_state: 'documented_pending_independent_confirmation',
    attribution_candidate: 'United Nations, Department of Economic and Social Affairs, Population Division (2024), World Population Prospects 2024, 2024 Medium projection; Earth Love United denominator selection identified.',
    official_evidence_urls: [
      'https://population.un.org/wpp/',
      'https://population.un.org/wpp/assets/Files/WPP2024_Methodology-Report_Final.pdf',
    ],
    required_evidence: [
      'Confirm the retained WPP source filename, bytes, SHA-256 digest, retrieval URL, retrieval time, and response metadata.',
      'Confirm that 1 January 2024 begins the projection period and approve population.wpp_medium_projection as the denominator identity.',
      'Approve CC BY 3.0 IGO attribution, change notice, and normalized-value redistribution.',
    ],
    blocker_codes: ['demography_review_missing', 'independent_rights_attestation_missing'],
  },
  {
    source_registry_id: 'ember-yearly-electricity-data-2026-08-25',
    values_in_release: true,
    raw_receipt_state: 'exact_receipt_independently_refetched_and_reproduced',
    source_identity_state: 'retrieval_snapshot_pinned',
    rights_state: 'documented_pending_independent_confirmation',
    attribution_candidate: 'Ember, Yearly Electricity Data, full long-format release retrieved 2026-08-25; Earth Love United selections and transformations identified.',
    official_evidence_urls: [
      'https://ember-energy.org/data/yearly-electricity-data/',
      'https://api.ember-energy.org/v1/docs',
    ],
    required_evidence: [
      'Confirm the independently reproduced 49,079,981-byte snapshot SHA-256 and publisher retrieval path.',
      'Review aggregate and nine-fuel taxonomy, actual-year selection, blank preservation, 2019-2024 change, and plus or minus 0.02 percentage-point reconciliation.',
      'Approve the exact attribution and normalized-value redistribution scope.',
    ],
    blocker_codes: ['power_systems_review_missing', 'independent_rights_attestation_missing'],
  },
  {
    source_registry_id: 'world-bank-cckp-cmip6-2026-08-24',
    values_in_release: true,
    raw_receipt_state: 'ten_exact_api_receipts_independently_refetched_2450_values_reproduced',
    source_identity_state: 'exact_country_ensemble_routes_pinned',
    rights_state: 'cckp_cc_by_4_documented_pending_independent_confirmation',
    attribution_candidate: 'World Bank Climate Change Knowledge Portal, CMIP6 0.25-degree country aggregates; WCRP CMIP6 and ESGF acknowledged; API responses re-fetched 2026-08-27. Earth Love United selected variables, scenarios, period, and percentiles.',
    official_evidence_urls: [
      'https://climateknowledgeportal.worldbank.org/index.php/metadata',
      'https://worldbank.github.io/climateknowledgeportal/docs/collections/cmip6-x0.25.html',
      'https://wcrp-cmip.github.io/CMIP6_CVs/docs/CMIP6_source_id_licenses.html',
    ],
    required_evidence: [
      'Confirm the ten exact API receipts, checksums, parameters, response metadata, ensemble_all_mean identity, and country aggregation chain.',
      'Confirm the World Bank portal CC BY 4.0 decision and the WCRP/ESGF acknowledgement language for this processed portal dataset.',
      'Review SSP2-4.5 p10, median, p90 and SSP1-2.6 and SSP5-8.5 median selections, reference period, country aggregation, and explicit gaps.',
    ],
    blocker_codes: ['physical_climate_review_missing', 'independent_rights_attestation_missing'],
  },
  {
    source_registry_id: 'world-bank-cckp-era5-2026-08-25',
    values_in_release: true,
    raw_receipt_state: 'both_exact_api_receipts_independently_refetched',
    source_identity_state: 'retrieval_snapshot_pinned',
    rights_state: 'cckp_cc_by_4_and_copernicus_attribution_documented_pending_independent_confirmation',
    attribution_candidate: 'World Bank Climate Change Knowledge Portal ERA5 0.25-degree annual country temperature and precipitation aggregates, 1950-2025 API snapshots retrieved 2026-08-25; 1970-2025 selection and Earth Love United OLS transformations identified.',
    official_evidence_urls: [
      'https://worldbank.github.io/climateknowledgeportal/docs/collections/era5-x0.25.html',
      'https://cds.climate.copernicus.eu/licences/licence-to-use-copernicus-products',
      'https://doi.org/10.1002/qj.3803',
    ],
    required_evidence: [
      'Confirm both independently reproduced variable-specific API response and normalized receipt hashes.',
      'Confirm the CCKP CC BY 4.0 decision and retained ERA5/Copernicus attribution.',
      'Review annual tas and pr semantics, 1970-2025 selection, units, OLS per-decade derivation, KSV exception, and four explicit registry gaps.',
    ],
    blocker_codes: ['physical_climate_review_missing', 'independent_rights_attestation_missing'],
  },
]);

const INDEPENDENT_REVIEWS = Object.freeze([
  ['carbon_accounting', [
    'GCB country mapping and 2024 territorial fossil CO2 selection.',
    'Cumulative, consumption, transfer-sign, land-use mean and population-standard-deviation derivations.',
    'Scope separation between fossil and land-use CO2.',
  ]],
  ['demography', [
    'WPP 2024 Medium projection identity, year classification, unit conversion, and 236-country mapping.',
    'Per-capita denominator lineage and modeled evidence class.',
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
    'Current reviewed artifact-set release diff and runtime-manifest pin closure.',
    'The sole external/generated dependency, js/vendor/globe.gl.js, is fetched by the pinned script and must satisfy the pinned vendor-integrity policy, fixture, and staged-byte checks.',
  ]],
  ['ui_accessibility_runtime', [
    'Globe and fallback parity, keyboard and screen-reader operation, focus return, reduced motion, mobile layouts, and slow-runtime behavior.',
    'Public copy, source visibility, cache staging, and non-color-dependent evidence.',
  ]],
  ['source_rights', [
    'Release-specific normalized-value, derivative-database, attribution, notice, and external-source exception decisions.',
    'CCKP CC BY 4.0, WCRP/ESGF acknowledgement, ERA5/Copernicus attribution, and release-owner confirmation.',
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

function artifactPinDigest(pins, requiredAbsentPaths = REQUIRED_ABSENT_PATHS) {
  if (!Array.isArray(pins) || !pins.length || !Array.isArray(requiredAbsentPaths)) return null;
  if (pins.some(item => !item || Object.keys(item).sort().join(',') !== 'path,sha256' ||
      typeof item.path !== 'string' || !/^[a-f0-9]{64}$/.test(item.sha256 || '')) ||
      new Set(pins.map(item => item.path)).size !== pins.length ||
      requiredAbsentPaths.some(relative => typeof relative !== 'string') ||
      new Set(requiredAbsentPaths).size !== requiredAbsentPaths.length) return null;
  const canonicalPins = pins.map(item => ({ path: item.path, sha256: item.sha256 }))
    .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const canonicalBoundary = {
    artifact_pins: canonicalPins,
    required_absent_paths: [...requiredAbsentPaths].sort(),
  };
  return sha256(`${SUBJECT_BINDING_DOMAIN}\n${JSON.stringify(canonicalBoundary)}\n`);
}

function localSubjectDependencies(relative) {
  if (!/\.(?:js|sh)$/.test(relative)) return [];
  const text = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const dependencies = new Set();
  if (relative.endsWith('.js')) {
    for (const match of text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (!match[1].startsWith('.')) continue;
      const unresolved = path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1]));
      const candidates = [unresolved, unresolved + '.js', path.posix.join(unresolved, 'index.js')];
      const resolved = candidates.find(candidate => fs.existsSync(path.join(ROOT, candidate)) &&
        fs.statSync(path.join(ROOT, candidate)).isFile());
      if (resolved) dependencies.add(resolved);
    }
  }
  const quotedPathPattern = /['"]((?:(?:\.github|tools|scripts|data|docs|js|css|assets)\/[A-Za-z0-9_.\/-]+\.(?:js|py|sh|json|md|html|css|txt|yml|yaml|b64|jpg|png|svg|geojson)|(?:404\.html|README\.md|CREDITS\.md|ARCHITECTURE\.md|LICENSE|\.gitignore|_headers|_redirects|favicon\.svg|index\.html|manifest\.json|robots\.txt|sitemap\.xml|sw\.js|THIRD_PARTY_NOTICES\.txt|wrangler\.jsonc)))['"]/g;
  for (const match of text.matchAll(quotedPathPattern)) {
    if (fs.existsSync(path.join(ROOT, match[1]))) dependencies.add(match[1]);
  }
  if (relative.endsWith('.sh')) {
    for (const match of text.matchAll(/(?:^|\s)((?:tools|scripts|data|docs|js|css|assets)\/[A-Za-z0-9_.\/-]+\.(?:js|py|sh|json|md|html|css|txt|yml|yaml|b64|jpg|png|svg|geojson))(?:\s|$)/gm)) {
      if (fs.existsSync(path.join(ROOT, match[1]))) dependencies.add(match[1]);
    }
  }
  return [...dependencies].sort();
}

function assertSubjectDependencyClosure(subjectPaths = SUBJECT_PATHS) {
  const subject = new Set(subjectPaths);
  const externalGenerated = new Set(EXTERNAL_GENERATED_DEPENDENCIES);
  const missing = [];
  subjectPaths.forEach(function (relative) {
    localSubjectDependencies(relative).forEach(function (dependency) {
      if (dependency !== OUTPUT && !externalGenerated.has(dependency) && !subject.has(dependency)) {
        missing.push(relative + ' -> ' + dependency);
      }
    });
  });
  if (missing.length) throw new Error('CCI review subject dependency closure is incomplete:\n' + missing.sort().join('\n'));
  return true;
}

function build(args) {
  assertSubjectDependencyClosure();
  const manifest = readJson(path.join(ROOT, 'data/climate/releases/country-climate-intelligence-v1/release-manifest.json'));
  const artifactPins = SUBJECT_PATHS.map(pin);
  const request = {
    schema_version: '1.0.0',
    request_id: `${manifest.release.id}-review-request.3`,
    release_id: manifest.release.id,
    created_at: option(args, '--created-at', '2026-08-27T00:00:00Z'),
    status: 'requires_independent_review',
    release_authority: false,
    production_runtime_release: false,
    subject: {
      artifact_pin_digest: artifactPinDigest(artifactPins, REQUIRED_ABSENT_PATHS),
      artifact_pins: artifactPins,
    },
    governance_boundaries: {
      composite_score: false,
      target_assessment: false,
      finance_judgment: false,
      mismatched_scope_deltas: false,
      offset_adjustment: false,
      ct40_reuse_allowed: false,
    },
    required_absent_paths: REQUIRED_ABSENT_PATHS,
    source_reviews: SOURCE_REVIEWS,
    independent_reviews: INDEPENDENT_REVIEWS,
    required_release_artifacts: {
      approval: 'data/climate/releases/country-climate-intelligence-v1/release-approval.json',
      release_diff: 'data/climate/releases/country-climate-intelligence-v1/reviewed-release-diff.json',
      runtime_manifest: 'data/climate/releases/country-climate-intelligence-v1/reviewed-runtime-manifest.json',
      rollback_proof: 'data/climate/releases/country-climate-intelligence-v1/reviewed-rollback-proof.json',
      signatures: 'data/climate/releases/country-climate-intelligence-v1/release-signatures.json',
    },
    prohibited_substitutions: [
      'Do not reuse CT-40 scoring, NDC, inventory, or top-20 review decisions for this no-score runtime.',
      'Do not treat source-registry configuration as release-specific rights approval.',
      'Do not treat compiler or UI tests as independent scientific review.',
      'Do not label API response metadata as an immutable publisher release without a receipt binding.',
      'Do not promote a candidate runtime whose own release metadata still denies production.',
      'Do not infer approval from a missing, partial, stale, placeholder, or hash-mismatched review artifact.',
      'Do not treat reviewer identity strings, timestamps, or CODEOWNERS approval as detached release signatures.',
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
  process.stdout.write(`Subject artifact-pin digest: ${request.subject.artifact_pin_digest}. Request SHA-256: ${digest}\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = {
  EXTERNAL_GENERATED_DEPENDENCIES,
  INDEPENDENT_REVIEWS,
  OUTPUT,
  REQUIRED_ABSENT_PATHS,
  SOURCE_REVIEWS,
  SUBJECT_PATHS,
  SUBJECT_BINDING_DOMAIN,
  assertSubjectDependencyClosure,
  artifactPinDigest,
  build,
  calculationHash,
  localSubjectDependencies,
};
