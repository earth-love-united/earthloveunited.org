'use strict';

const crypto = require('node:crypto');
const { calculationHash } = require('./primap-hist-ingest');

const PINS = Object.freeze({
  candidate_path: 'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json',
  candidate_sha256: 'e242e5a49ba963eaeafe472c8c6702a193e79f60cf6762083f4ba72e9aa239b6',
  candidate_calculation_hash: '8182081d7ef30e24731aac43e28f5f2b1b1316dd4721100bb8c069972cd1be49',
  attestation_path: 'data/climate/reviews/primap-hist-2.6.1-economy-wide-ct10b-review.json',
  attestation_sha256: 'e0c17b4191a0e62a0c91076f054d14df49325c867763f5f9f9907dddff421c84',
  attestation_calculation_hash: '4494782a4e968e8826b192e04fe8dcafdc4c089f9ac87bff7261f04628b7bc20',
});

const SUPERSEDED_ATTESTATION = Object.freeze({
  sha256: '2a7feeb62278bacf48234b1b82befbff28bd4ed30e55c5b548eeb54db32bf8a7',
  calculation_hash: 'ceb246700220dfc26bb50460668417f15dea1e7c4b2ffec1fdaf228aaea56135',
});

function hashBytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertAttestationPin(byteHash, contentHash) {
  assert(byteHash === PINS.attestation_sha256, 'attestation byte hash mismatch');
  assert(contentHash === PINS.attestation_calculation_hash, 'attestation calculation hash mismatch');
}

function assertPromotionSemantics(candidate, attestation) {
  assert(candidate.calculation_hash === PINS.candidate_calculation_hash, 'candidate calculation hash mismatch');
  assert(calculationHash(candidate) === PINS.candidate_calculation_hash, 'candidate content calculation hash mismatch');
  assert(attestation.calculation_hash === PINS.attestation_calculation_hash, 'attestation calculation hash mismatch');
  assert(calculationHash(attestation) === PINS.attestation_calculation_hash, 'attestation content calculation hash mismatch');
  assert(attestation.decision === 'pass', 'attestation decision must be pass');
  assert(attestation.reviewer?.independent_of_builder === true, 'reviewer independence must be asserted');
  assert(attestation.reviewer.reviewer_id !== attestation.reviewer.builder_id, 'reviewer and builder must differ');
  assert(attestation.reviewed_inputs.artifact_sha256 === PINS.candidate_sha256, 'attestation does not pin candidate bytes');
  assert(attestation.reviewed_inputs.artifact_calculation_hash === PINS.candidate_calculation_hash, 'attestation does not pin candidate calculation');
  assert(attestation.publication_boundary.review_attestation_passed === true, 'review attestation boundary is not passed');
  assert(attestation.publication_boundary.assessed_use_allowed === false, 'input attestation crossed assessed-use boundary');
  assert(attestation.publication_boundary.scoring_allowed === false, 'input attestation crossed scoring boundary');
  assert(candidate.series.length === 206, 'candidate must contain exactly 206 country series');
  assert(candidate.series.every(series => series.values.length === 10), 'every candidate series must contain 2014–2023');
}

function assertPromotionInputs(candidate, candidateBytes, attestation, attestationBytes) {
  assert(hashBytes(candidateBytes) === PINS.candidate_sha256, 'candidate byte hash mismatch');
  assertAttestationPin(hashBytes(attestationBytes), attestation.calculation_hash);
  assertPromotionSemantics(candidate, attestation);
}

function buildPromotion(candidate, candidateBytes, attestation, attestationBytes, createdAt) {
  assertPromotionInputs(candidate, candidateBytes, attestation, attestationBytes);
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(createdAt), 'created_at must be a UTC second timestamp');

  const artifact = {
    schema_version: '1.0.0',
    schema_ref: 'data/climate/schemas/primap-factual-display-promotion.schema.json',
    promotion_id: 'ct-10c:primap-hist-2.6.1:economy-wide:2014-2023',
    created_at: createdAt,
    calculation_hash: null,
    inputs: {
      candidate: {
        path: PINS.candidate_path,
        sha256: PINS.candidate_sha256,
        calculation_hash: PINS.candidate_calculation_hash,
      },
      independent_attestation: {
        path: PINS.attestation_path,
        sha256: PINS.attestation_sha256,
        calculation_hash: PINS.attestation_calculation_hash,
        review_id: attestation.review_id,
        reviewer_id: attestation.reviewer.reviewer_id,
        builder_id: attestation.reviewer.builder_id,
        independent_of_builder: true,
        decision: 'pass',
      },
    },
    metric: {
      id: 'annual_economy_wide_ghg_excluding_lulucf',
      plane: 'harmonized',
      evidence_class: 'harmonized_estimate',
      unit: 'MtCO2e/yr',
      period: { start_year: 2014, end_year: 2023, latest_year: 2023 },
      gas_basket: candidate.selection.gas_basket.slice(),
      gwp_convention: candidate.selection.gwp_convention,
      lulucf: candidate.selection.lulucf,
      international_bunkers: candidate.selection.international_bunkers,
      uncertainty_status: candidate.selection.uncertainty.status,
    },
    release_use_flags: {
      factual_emissions_display: true,
      emissions_time_series_display: true,
      annual_emissions_magnitude_comparison: true,
      annual_emissions_magnitude_ranking: true,
      target_or_commitment_assessment: false,
      delivery_assessment: false,
      performance_assessment: false,
      assessed_country_status: false,
      impact_band_assignment: false,
      composite_score: false,
      normative_climate_score: false,
      production_runtime_release: false,
    },
    interpretation_guardrails: {
      ranking_definition: 'Descending 2023 MtCO2e/yr for this one harmonized metric only; ties must remain ties.',
      ranking_is_performance_judgment: false,
      missing_target_implies_good_performance: false,
      missing_target_implies_bad_performance: false,
      required_label: 'Harmonized estimate: economy-wide GHG excluding LULUCF (AR6 GWP100)',
      required_caveats: candidate.selection.limitations.slice(),
    },
    promotion_review: {
      status: 'not_reviewed',
      builder_id: 'ct-10c-display-promotion',
      reviewer_id: null,
      reviewed_at: null,
      independent_review_required: true,
      production_runtime_release_allowed: false,
    },
    coverage: {
      registry_entities: candidate.registry_coverage.length,
      promoted_country_series: candidate.series.length,
      source_unavailable: candidate.registry_coverage.filter(item => item.state === 'source_unavailable').length,
      promoted_observations: candidate.series.reduce((sum, series) => sum + series.values.length, 0),
      latest_year_values: candidate.series.filter(series => series.values.some(value => value.year === 2023 && value.value_mtco2e !== null)).length,
    },
    series: candidate.series.map(series => ({
      country_id: series.country_id,
      iso_alpha3: series.iso_alpha3,
      source_locator: series.source_locator,
      values: series.values.map(value => ({
        year: value.year,
        value_mtco2e: value.value_mtco2e,
        normalized_value_decimal: value.normalized_value_decimal,
        fact_id: value.fact_id,
        source_fact_id: value.source_fact_id,
      })),
    })),
    forbidden_outputs: {
      target_assigned: false,
      commitment_status_assigned: false,
      delivery_assigned: false,
      performance_assigned: false,
      impact_band_assigned: false,
      composite_score_assigned: false,
      normative_climate_score_assigned: false,
      performance_rank_assigned: false,
    },
  };
  artifact.calculation_hash = calculationHash(artifact);
  return artifact;
}

module.exports = { PINS, SUPERSEDED_ATTESTATION, hashBytes, assertAttestationPin, assertPromotionSemantics, assertPromotionInputs, buildPromotion };
