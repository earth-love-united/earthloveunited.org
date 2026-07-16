#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const PATHS = Object.freeze({
  candidate: 'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json',
  inputReview: 'data/climate/reviews/primap-hist-2.6.1-economy-wide-ct10b-review.json',
  promotion: 'data/climate/releases/primap-hist-2.6.1-factual-display-2026-07-15.json',
  schema: 'data/climate/schemas/primap-factual-display-promotion.schema.json',
  review: 'data/climate/reviews/primap-hist-2.6.1-factual-display-ct10c-review.json',
});
const PINS = Object.freeze({
  candidateSha256: 'e242e5a49ba963eaeafe472c8c6702a193e79f60cf6762083f4ba72e9aa239b6',
  candidateCalculationHash: '8182081d7ef30e24731aac43e28f5f2b1b1316dd4721100bb8c069972cd1be49',
  inputReviewSha256: 'e0c17b4191a0e62a0c91076f054d14df49325c867763f5f9f9907dddff421c84',
  inputReviewCalculationHash: '4494782a4e968e8826b192e04fe8dcafdc4c089f9ac87bff7261f04628b7bc20',
  promotionSha256: '129cc563cbad1fa5c71d6953430a8eba510f4c26106d4f6e76cb7cbd11a7e76d',
  promotionCalculationHash: '1301ce57a7f8b9af28fefe9e8fd5507d131f35d689fb30d1da27f6265734decb',
  schemaSha256: '7b6b92a27bd14e4d2a1969d75209e073339d6099f8b016525cc18b48cc679158',
  builderCommit: 'bf9ce4d1a299e1392e73719e92189240a7866fe8',
  inputReviewCommit: '5f3b778',
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function bytes(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
}

function calculationHash(value) {
  const copy = structuredClone(value);
  delete copy.calculation_hash;
  return sha256(canonicalJson(copy));
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function resolveRef(schema, ref) {
  assert(ref.startsWith('#/'), `non-local schema reference: ${ref}`);
  return ref.slice(2).split('/').reduce((node, part) => node[part.replace(/~1/g, '/').replace(/~0/g, '~')], schema);
}

function validateSchema(value, rule, root = rule, at = '$') {
  const errors = [];
  if (rule.$ref) return validateSchema(value, resolveRef(root, rule.$ref), root, at);
  if (Object.hasOwn(rule, 'const') && !same(value, rule.const)) errors.push(`${at} violates const`);
  if (rule.enum && !rule.enum.some(item => same(item, value))) errors.push(`${at} is outside enum`);
  const types = rule.type ? (Array.isArray(rule.type) ? rule.type : [rule.type]) : null;
  if (types && !types.some(type => typeMatches(value, type))) return [`${at} has invalid type`];
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) errors.push(`${at} is too short`);
    if (rule.pattern && !(new RegExp(rule.pattern)).test(value)) errors.push(`${at} violates pattern`);
    if (rule.format === 'date-time' && (Number.isNaN(Date.parse(value)) || !value.includes('T'))) errors.push(`${at} is not date-time`);
  }
  if (typeof value === 'number' && rule.minimum !== undefined && value < rule.minimum) errors.push(`${at} is below minimum`);
  if (typeof value === 'number' && rule.maximum !== undefined && value > rule.maximum) errors.push(`${at} is above maximum`);
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at} has too few items`);
    if (rule.maxItems !== undefined && value.length > rule.maxItems) errors.push(`${at} has too many items`);
    if (rule.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) errors.push(`${at} has duplicates`);
    if (rule.items) value.forEach((item, index) => errors.push(...validateSchema(item, rule.items, root, `${at}[${index}]`)));
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = rule.properties || {};
    (rule.required || []).forEach(key => {
      if (!Object.hasOwn(value, key)) errors.push(`${at}.${key} is required`);
    });
    Object.entries(value).forEach(([key, item]) => {
      if (properties[key]) errors.push(...validateSchema(item, properties[key], root, `${at}.${key}`));
      else if (rule.additionalProperties === false && key !== '$defs') errors.push(`${at}.${key} is not allowed`);
    });
  }
  return errors;
}

function expectedPromotion(candidate, inputReview, createdAt) {
  const result = {
    schema_version: '1.0.0',
    schema_ref: PATHS.schema,
    promotion_id: 'ct-10c:primap-hist-2.6.1:economy-wide:2014-2023',
    created_at: createdAt,
    calculation_hash: null,
    inputs: {
      candidate: { path: PATHS.candidate, sha256: PINS.candidateSha256, calculation_hash: PINS.candidateCalculationHash },
      independent_attestation: {
        path: PATHS.inputReview,
        sha256: PINS.inputReviewSha256,
        calculation_hash: PINS.inputReviewCalculationHash,
        review_id: inputReview.review_id,
        reviewer_id: inputReview.reviewer.reviewer_id,
        builder_id: inputReview.reviewer.builder_id,
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
      status: 'not_reviewed', builder_id: 'ct-10c-display-promotion', reviewer_id: null,
      reviewed_at: null, independent_review_required: true, production_runtime_release_allowed: false,
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
      target_assigned: false, commitment_status_assigned: false, delivery_assigned: false,
      performance_assigned: false, impact_band_assigned: false, composite_score_assigned: false,
      normative_climate_score_assigned: false, performance_rank_assigned: false,
    },
  };
  result.calculation_hash = calculationHash(result);
  return result;
}

function auditPromotion(candidate, inputReview, promotion, schema) {
  assert(sha256(bytes(PATHS.candidate)) === PINS.candidateSha256, 'candidate byte pin mismatch');
  assert(calculationHash(candidate) === PINS.candidateCalculationHash, 'candidate calculation pin mismatch');
  assert(sha256(bytes(PATHS.inputReview)) === PINS.inputReviewSha256, 'input review byte pin mismatch');
  assert(calculationHash(inputReview) === PINS.inputReviewCalculationHash, 'input review calculation pin mismatch');
  assert(sha256(bytes(PATHS.schema)) === PINS.schemaSha256, 'promotion schema byte pin mismatch');
  assert(inputReview.decision === 'pass', 'input review is not a pass');
  assert(inputReview.reviewer.independent_of_builder === true, 'input review independence is false');
  assert(inputReview.reviewer.reviewer_id !== inputReview.reviewer.builder_id, 'input reviewer is builder');
  assert(inputReview.publication_boundary.assessed_use_allowed === false, 'input review permits assessment');
  assert(inputReview.publication_boundary.scoring_allowed === false, 'input review permits scoring');
  assert(inputReview.publication_boundary.reviewed_site_release_allowed === false, 'input review permits site release');

  const schemaErrors = validateSchema(promotion, schema);
  assert(schemaErrors.length === 0, `promotion schema failed: ${schemaErrors.slice(0, 3).join('; ')}`);
  const expected = expectedPromotion(candidate, inputReview, promotion.created_at);
  assert(JSON.stringify(expected, null, 2) + '\n' === bytes(PATHS.promotion).toString('utf8'), 'independent byte rebuild differs');
  assert(same(promotion, expected), 'independent structural rebuild differs');
  assert(sha256(bytes(PATHS.promotion)) === PINS.promotionSha256, 'promotion byte pin mismatch');
  assert(calculationHash(promotion) === PINS.promotionCalculationHash, 'promotion calculation pin mismatch');

  assert(promotion.series.length === 206 && promotion.coverage.promoted_country_series === 206, 'series count differs');
  assert(promotion.coverage.promoted_observations === 2060 && promotion.coverage.latest_year_values === 206, 'observation count differs');
  assert(promotion.coverage.registry_entities === 249 && promotion.coverage.source_unavailable === 43, 'registry coverage differs');
  assert(new Set(promotion.series.map(series => series.country_id)).size === 206, 'duplicate country ID');
  const values = promotion.series.flatMap(series => series.values);
  assert(values.length === 2060 && new Set(values.map(value => value.fact_id)).size === 2060, 'normalized fact IDs differ');
  assert(new Set(values.flatMap(value => [value.fact_id, value.source_fact_id])).size === 4120, 'combined fact IDs differ');
  assert(promotion.series.every(series => series.values.map(value => value.year).join(',') === '2014,2015,2016,2017,2018,2019,2020,2021,2022,2023'), 'year sequence differs');

  const flags = promotion.release_use_flags;
  ['factual_emissions_display', 'emissions_time_series_display', 'annual_emissions_magnitude_comparison', 'annual_emissions_magnitude_ranking']
    .forEach(key => assert(flags[key] === true, `${key} is not permitted`));
  ['target_or_commitment_assessment', 'delivery_assessment', 'performance_assessment', 'assessed_country_status', 'impact_band_assignment', 'composite_score', 'normative_climate_score', 'production_runtime_release']
    .forEach(key => assert(flags[key] === false, `${key} leaked`));
  assert(Object.values(promotion.forbidden_outputs).every(value => value === false), 'forbidden output leaked');
  assert(promotion.promotion_review.status === 'not_reviewed', 'embedded builder artifact claims review');
  assert(promotion.promotion_review.production_runtime_release_allowed === false, 'runtime eligibility leaked');
  assert(promotion.interpretation_guardrails.ranking_is_performance_judgment === false, 'magnitude ranking became performance');
  assert(promotion.interpretation_guardrails.missing_target_implies_good_performance === false, 'missing target became good performance');
  assert(promotion.interpretation_guardrails.missing_target_implies_bad_performance === false, 'missing target became bad performance');
}

function expectReject(id, candidate, inputReview, promotion, schema, mutate) {
  const changed = { candidate: structuredClone(candidate), inputReview: structuredClone(inputReview), promotion: structuredClone(promotion), schema: structuredClone(schema) };
  mutate(changed);
  let rejected = false;
  try { auditMutated(changed.candidate, changed.inputReview, changed.promotion, changed.schema, promotion); } catch (_) { rejected = true; }
  assert(rejected, `${id} mutation was accepted`);
}

function auditMutated(candidate, inputReview, promotion, schema, originalPromotion) {
  assert(calculationHash(candidate) === PINS.candidateCalculationHash, 'mutated candidate calculation differs');
  assert(calculationHash(inputReview) === PINS.inputReviewCalculationHash, 'mutated input review calculation differs');
  assert(inputReview.decision === 'pass', 'mutated input review is not a pass');
  assert(inputReview.reviewer.independent_of_builder === true, 'mutated input review independence differs');
  assert(inputReview.reviewer.reviewer_id !== inputReview.reviewer.builder_id, 'mutated input reviewer is builder');
  assert(inputReview.publication_boundary.assessed_use_allowed === false, 'mutated input review permits assessment');
  assert(inputReview.publication_boundary.scoring_allowed === false, 'mutated input review permits scoring');
  const schemaErrors = validateSchema(promotion, schema);
  assert(schemaErrors.length === 0, 'mutated promotion violates schema');
  const expected = expectedPromotion(candidate, inputReview, originalPromotion.created_at);
  assert(same(promotion, expected), 'mutated promotion differs from independent rebuild');
  assert(calculationHash(promotion) === PINS.promotionCalculationHash, 'mutated promotion calculation differs');
}

function runMutations(candidate, inputReview, promotion, schema) {
  const cases = [
    ['candidate-value', x => { x.candidate.series[0].values[0].value_mtco2e += 1; }],
    ['input-review-decision', x => { x.inputReview.decision = 'fail'; }],
    ['promotion-value', x => { x.promotion.series[0].values[0].value_mtco2e += 1; }],
    ['promotion-source-locator', x => { x.promotion.series[0].source_locator.csv_row += 1; }],
    ['promotion-fact-id', x => { x.promotion.series[0].values[0].fact_id += ':changed'; }],
    ['metric-plane', x => { x.promotion.metric.plane = 'official'; }],
    ['performance-flag', x => { x.promotion.release_use_flags.performance_assessment = true; }],
    ['runtime-flag', x => { x.promotion.release_use_flags.production_runtime_release = true; }],
    ['impact-band-output', x => { x.promotion.forbidden_outputs.impact_band_assigned = true; }],
    ['performance-rank-output', x => { x.promotion.forbidden_outputs.performance_rank_assigned = true; }],
    ['missing-target-good', x => { x.promotion.interpretation_guardrails.missing_target_implies_good_performance = true; }],
    ['duplicate-country', x => { x.promotion.series[1] = structuredClone(x.promotion.series[0]); }],
    ['missing-observation', x => { x.promotion.series[0].values.pop(); }],
    ['untyped-extra-field', x => { x.promotion.performance_score = 100; }],
  ];
  cases.forEach(([id, mutate]) => expectReject(id, candidate, inputReview, promotion, schema, mutate));
  return cases.length;
}

function verifyReview(review, promotion, mutations) {
  assert(review.schema_version === '1.0.0' && review.decision === 'pass', 'review decision is not a typed pass');
  assert(review.calculation_hash === calculationHash(review), 'review calculation hash differs');
  assert(review.reviewer.independent_of_builder === true, 'review independence is false');
  assert(review.reviewer.reviewer_id !== review.reviewer.builder_id, 'reviewer is promotion builder');
  assert(review.reviewed_commits.promotion_commit_sha === PINS.builderCommit, 'reviewed promotion commit differs');
  assert(review.reviewed_commits.input_review_commit_sha === '5f3b7784cfd5818cd8bbb4f5d9fc160a9362fc1b', 'reviewed input-review commit differs');
  assert(review.reviewed_inputs.raw_source_sha256 === '7607f2b7c5b00d3ddbb19e5c7b100ff7bd8c2d8c2bfc8959c40f41d2cfecf4d9', 'review raw-source pin differs');
  assert(review.reviewed_inputs.candidate_sha256 === PINS.candidateSha256, 'review candidate pin differs');
  assert(review.reviewed_inputs.candidate_calculation_hash === PINS.candidateCalculationHash, 'review candidate calculation differs');
  assert(review.reviewed_inputs.input_review_sha256 === PINS.inputReviewSha256, 'review input-attestation pin differs');
  assert(review.reviewed_inputs.input_review_calculation_hash === PINS.inputReviewCalculationHash, 'review input-attestation calculation differs');
  assert(review.reviewed_inputs.promotion_sha256 === PINS.promotionSha256, 'review promotion pin differs');
  assert(review.reviewed_inputs.promotion_calculation_hash === PINS.promotionCalculationHash, 'review promotion calculation differs');
  assert(review.reviewed_inputs.promotion_schema_sha256 === PINS.schemaSha256, 'review schema pin differs');
  assert(review.counts.promoted_country_series === 206 && review.counts.promoted_observations === 2060, 'review output counts differ');
  assert(review.counts.unique_normalized_fact_ids === 2060 && review.counts.unique_combined_fact_ids === 4120, 'review fact-ID counts differ');
  assert(review.counts.adversarial_mutations_rejected === mutations, 'review mutation count differs');
  assert(review.representative_latest_values.length === 8 && review.counts.representative_entities_checked === 8, 'representative review count differs');
  review.representative_latest_values.forEach(sample => {
    const series = promotion.series.find(item => item.iso_alpha3 === sample.iso_alpha3);
    const latest = series?.values.find(value => value.year === 2023);
    assert(latest?.normalized_value_decimal === sample.value_2023_mtco2e, `${sample.iso_alpha3} representative value differs`);
    assert(latest?.fact_id === sample.fact_id_2023, `${sample.iso_alpha3} representative fact ID differs`);
  });
  assert(review.prior_blocker_resolution.incorrect_ata_row_and_2014_value === 'resolved', 'ATA blocker is not resolved');
  assert(review.prior_blocker_resolution.all_ct10b_sample_fields_checked_against_raw_and_candidate === true, 'complete CT-10B sample validation is absent');
  assert(review.prior_blocker_resolution.superseded_attestation_pin_rejected === true, 'superseded attestation rejection is absent');
  assert(review.publication_boundary.factual_display_review_passed === true, 'review does not pass factual display');
  assert(review.publication_boundary.performance_assessment_allowed === false, 'review permits performance');
  assert(review.publication_boundary.target_or_commitment_assessment_allowed === false, 'review permits target assessment');
  assert(review.publication_boundary.impact_band_allowed === false, 'review permits impact band');
  assert(review.publication_boundary.composite_or_normative_score_allowed === false, 'review permits score');
  assert(review.publication_boundary.production_runtime_release_allowed === false, 'review permits production runtime');
  assert(review.publication_boundary.ct40_runtime_gate_required === true, 'review bypasses CT-40');
}

function main() {
  const committedOnly = process.argv.includes('--committed-only');
  const rawPath = process.argv.slice(2).find(argument => !argument.startsWith('--'));
  assert(committedOnly || rawPath, 'usage: node tools/check-primap-factual-display-review.js /path/to/PRIMAP.csv [or --committed-only]');
  const prerequisiteArgs = committedOnly ? ['--committed-only'] : [rawPath];
  const prerequisite = spawnSync(process.execPath, [path.join(ROOT, 'tools/check-primap-review-attestation.js'), ...prerequisiteArgs], { cwd: ROOT, encoding: 'utf8' });
  assert(prerequisite.status === 0, `CT-10B-R prerequisite failed: ${(prerequisite.stderr || prerequisite.stdout).trim()}`);

  const candidate = JSON.parse(bytes(PATHS.candidate));
  const inputReview = JSON.parse(bytes(PATHS.inputReview));
  const promotion = JSON.parse(bytes(PATHS.promotion));
  const schema = JSON.parse(bytes(PATHS.schema));
  const review = JSON.parse(bytes(PATHS.review));
  auditPromotion(candidate, inputReview, promotion, schema);
  const mutations = runMutations(candidate, inputReview, promotion, schema);
  verifyReview(review, promotion, mutations);

  process.stdout.write(prerequisite.stdout);
  const mode = committedOnly ? 'committed review pins; raw-source rerun not performed' : 'pinned raw-source prerequisite';
  console.log(`PRIMAP CT-10C-R: PASS (${mode}; byte-exact independent rebuild; 206 series; 2,060 observations; ${mutations} adversarial mutations rejected; factual display reviewed; performance/scoring/runtime false)`);
}

try { main(); } catch (error) {
  console.error(`PRIMAP CT-10C-R: FAIL — ${error.message}`);
  process.exit(1);
}
