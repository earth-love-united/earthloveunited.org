#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  PINS,
  SUPERSEDED_ATTESTATION,
  hashBytes,
  assertAttestationPin,
  assertPromotionSemantics,
  assertPromotionInputs,
  buildPromotion,
} = require('./lib/primap-factual-display-promotion');
const { calculationHash } = require('./lib/primap-hist-ingest');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'data/climate/releases/primap-hist-2.6.1-factual-display-2026-07-15.json');
const FIXTURE_PATH = path.join(ROOT, 'data/climate/fixtures/primap-factual-display-promotion.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) { return structuredClone(value); }

function mustDeny(fn, id) {
  let denied = false;
  try { fn(); } catch (_) { denied = true; }
  assert(denied, `${id} did not fail closed`);
}

function main() {
  const candidateBytes = fs.readFileSync(path.join(ROOT, PINS.candidate_path));
  const attestationBytes = fs.readFileSync(path.join(ROOT, PINS.attestation_path));
  const candidate = JSON.parse(candidateBytes);
  const attestation = JSON.parse(attestationBytes);
  const outputBytes = fs.readFileSync(OUTPUT_PATH);
  const output = JSON.parse(outputBytes);
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

  assert(fixture.fictional_or_mutated_inputs_only === true, 'fixture must contain only mutations');
  assertPromotionInputs(candidate, candidateBytes, attestation, attestationBytes);
  const rebuilt = buildPromotion(candidate, candidateBytes, attestation, attestationBytes, output.created_at);
  assert(JSON.stringify(rebuilt, null, 2) + '\n' === outputBytes.toString('utf8'), 'promotion is not a byte-exact deterministic rebuild');
  assert(output.calculation_hash === calculationHash(output), 'promotion calculation hash mismatch');
  assert(output.schema_ref === 'data/climate/schemas/primap-factual-display-promotion.schema.json', 'promotion schema boundary mismatch');
  assert(output.inputs.candidate.sha256 === PINS.candidate_sha256, 'candidate pin changed');
  assert(output.inputs.independent_attestation.sha256 === PINS.attestation_sha256, 'attestation pin changed');
  assert(output.inputs.independent_attestation.independent_of_builder === true, 'input review is not independent');
  assert(output.inputs.independent_attestation.reviewer_id !== output.inputs.independent_attestation.builder_id, 'builder reviewed own input');

  const allowed = output.release_use_flags;
  assert(allowed.factual_emissions_display === true, 'factual display must be permitted');
  assert(allowed.emissions_time_series_display === true, 'time-series display must be permitted');
  assert(allowed.annual_emissions_magnitude_comparison === true, 'magnitude comparison must be permitted');
  assert(allowed.annual_emissions_magnitude_ranking === true, 'magnitude ranking must be permitted');
  ['target_or_commitment_assessment', 'delivery_assessment', 'performance_assessment', 'assessed_country_status', 'impact_band_assignment', 'composite_score', 'normative_climate_score', 'production_runtime_release']
    .forEach(key => assert(allowed[key] === false, `${key} must remain forbidden`));
  assert(Object.values(output.forbidden_outputs).every(value => value === false), 'a forbidden assessment output was assigned');
  assert(output.interpretation_guardrails.ranking_is_performance_judgment === false, 'magnitude ranking became a performance judgment');
  assert(output.interpretation_guardrails.missing_target_implies_good_performance === false, 'missing target became good performance');
  assert(output.promotion_review.status === 'not_reviewed', 'CT-10C promotion must await independent review');
  assert(output.promotion_review.production_runtime_release_allowed === false, 'CT-10C crossed production runtime gate');

  assert(output.coverage.registry_entities === 249, 'registry coverage changed');
  assert(output.coverage.promoted_country_series === 206 && output.series.length === 206, 'promoted series count changed');
  assert(output.coverage.source_unavailable === 43, 'source gap count changed');
  assert(output.coverage.promoted_observations === 2060, 'observation count changed');
  assert(output.coverage.latest_year_values === 206, 'latest-year count changed');
  assert(new Set(output.series.map(item => item.country_id)).size === 206, 'country IDs must be unique');
  const values = output.series.flatMap(series => series.values);
  assert(values.length === 2060, 'series must contain 2,060 observations');
  assert(new Set(values.map(value => value.fact_id)).size === 2060, 'normalized fact IDs must be unique');
  assert(values.every(value => value.value_mtco2e !== null), 'promotion must not claim a missing value');
  assert(output.series.every(series => series.values.map(value => value.year).join(',') === '2014,2015,2016,2017,2018,2019,2020,2021,2022,2023'), 'series years changed');

  mustDeny(() => assertPromotionInputs(candidate, Buffer.concat([candidateBytes, Buffer.from(' ')]), attestation, attestationBytes), 'candidate-byte-mismatch');
  mustDeny(() => assertPromotionInputs(candidate, candidateBytes, attestation, Buffer.concat([attestationBytes, Buffer.from(' ')])), 'attestation-byte-mismatch');
  const semanticMutations = {
    'attestation-not-pass': review => { review.decision = 'fail'; },
    'independence-not-asserted': review => { review.reviewer.independent_of_builder = false; },
    'same-builder-reviewer': review => { review.reviewer.reviewer_id = review.reviewer.builder_id; },
    'attestation-calculation-mismatch': review => { review.calculation_hash = '0'.repeat(64); },
    'scoring-boundary-crossed': review => { review.publication_boundary.scoring_allowed = true; },
  };
  Object.entries(semanticMutations).forEach(([id, mutate]) => {
    const changed = clone(attestation);
    mutate(changed);
    mustDeny(() => assertPromotionSemantics(candidate, changed), id);
  });
  const changedCandidate = clone(candidate);
  changedCandidate.calculation_hash = '0'.repeat(64);
  mustDeny(() => assertPromotionSemantics(changedCandidate, attestation), 'candidate-calculation-mismatch');
  assert(JSON.stringify(fixture.superseded_attestation) === JSON.stringify(SUPERSEDED_ATTESTATION), 'superseded attestation fixture changed');
  mustDeny(
    () => assertAttestationPin(SUPERSEDED_ATTESTATION.sha256, SUPERSEDED_ATTESTATION.calculation_hash),
    'superseded-attestation-rejected',
  );
  assert(fixture.fail_closed_cases.length === 9 && fixture.fail_closed_cases.every(item => item.expected === 'deny'), 'fixture denial matrix changed');

  console.log(`PRIMAP CT-10C: PASS (${output.coverage.promoted_country_series} series; ${output.coverage.promoted_observations} factual observations; artifact ${hashBytes(outputBytes)}; 9 fail-closed mutations including superseded attestation; production/scoring/performance false)`);
}

try { main(); } catch (error) {
  console.error(`PRIMAP CT-10C: FAIL — ${error.message}`);
  process.exit(1);
}
