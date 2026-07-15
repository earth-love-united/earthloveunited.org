'use strict';

const crypto = require('node:crypto');
const { compileCard } = require('./country-card-evidence-model');
const COUNTRY_RANKING_COMPILER = require('../../js/country-ranking-compiler');
const COUNTRY_CLIMATE_VIEW_MODEL = require('../../js/country-climate-view-model');

const CREATED_AT = '2026-07-15T00:00:00Z';
const SOURCE_ID = 'primap-hist-2.6.1-final';
const METRIC = 'annual_economy_wide_ghg_excluding_lulucf';
const UNIT = 'MtCO2e/yr';
const REQUIRED_LABEL = 'Harmonized estimate: economy-wide GHG excluding LULUCF (AR6 GWP100)';
const ALLOWED_USES = Object.freeze({
  factual_display: true, time_series: true, magnitude_comparison: true, annual_emissions_ranking: true,
  target: false, commitment: false, delivery: false, performance: false, assessed_status: false,
  impact_bands: false, composite: false, normative_scoring: false, scoring: false, runtime_profile: false,
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function hashJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function hashBytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compile({ registry, promotion, promotionBytes, review, reviewBytes, sourceRegistry }) {
  assert(registry.entity_count === 249 && registry.entities.length === 249, 'CT-02 registry must contain 249 entities');
  assert(review.decision === 'pass' && review.reviewer.independent_of_builder === true, 'CT-10C-R independent pass required');
  assert(review.publication_boundary.factual_display_review_passed === true, 'CT-10C-R factual display boundary not passed');
  assert(review.publication_boundary.production_runtime_release_allowed === false, 'CT-10C-R must not authorize runtime release');
  assert(hashBytes(promotionBytes) === review.reviewed_inputs.promotion_sha256, 'CT-10C promotion pin mismatch');
  assert(promotion.calculation_hash === review.reviewed_inputs.promotion_calculation_hash, 'CT-10C calculation pin mismatch');
  const source = sourceRegistry.sources.find(item => item.id === SOURCE_ID);
  assert(source && source.approval.state === 'approved', 'approved PRIMAP source decision required');
  assert(source.licence.status === 'confirmed' && source.redistribution.normalized_values === true, 'source licence and normalized redistribution must be approved');

  const byCountry = new Map(promotion.series.map(series => [series.country_id, series]));
  const countries = registry.entities.map(entity => {
    const series = byCountry.get(entity.country_id);
    const common = {
      country_id: entity.country_id,
      iso_alpha3: entity.iso_alpha3,
      name: entity.common_name || entity.name,
      flag_emoji: entity.flag_emoji,
      assessment: {
        commitment: 'not_reviewed', target: 'not_reviewed', delivery: 'not_assessed',
        performance: 'not_assessed', impact_band: 'not_assessed', score: null,
      },
    };
    if (!series) {
      const card = compileCard({
        country_id: entity.country_id, entity_label: common.name,
        data_release_id: 'ct-42-factual-runtime-candidate-2026-07-15', generated_at: CREATED_AT,
        profile: { country_id: entity.country_id }, observation_series: [], target_results: [], scenario_projections: [],
      });
      return Object.assign(common, {
      emissions: { status: 'source_gap', reason_code: 'source_unavailable', series: [], latest: null },
        ct32_separation_contract_hash: card.calculation_hash,
      });
    }
    const points = series.values.map(point => ({
      year: point.year,
      value: point.value_mtco2e,
      value_decimal: point.normalized_value_decimal,
      fact_id: point.fact_id,
      source_fact_id: point.source_fact_id,
    }));
    const card = compileCard({
      country_id: entity.country_id, entity_label: common.name,
      data_release_id: 'ct-42-factual-runtime-candidate-2026-07-15', generated_at: CREATED_AT,
      profile: { country_id: entity.country_id }, target_results: [], scenario_projections: [],
      observation_series: [{
        series_id: `series:primap-hist-2.6.1:${entity.iso_alpha3}:2014-2023`, country_id: entity.country_id,
        data_role: 'observed_annual', is_observation: true, source_kind: 'harmonized_dataset',
        evidence_plane: 'harmonized', state: 'estimated', metric: METRIC, unit: UNIT,
        scope: {
          accounting_frame: 'economy_wide_ghg_excluding_lulucf', gases: promotion.metric.gas_basket,
          sectors: ['economy_wide_excluding_lulucf'], geography: 'territorial_country',
          lulucf: 'excluded', gwp_convention: 'AR6GWP100',
        },
        source_ids: [SOURCE_ID],
        review: { status: 'reviewed', reviewer_id: review.reviewer.reviewer_id, reviewed_at: review.reviewed_at },
        points: points.map(point => ({
          year: point.year, value: point.value, uncertainty: null, fact_id: point.fact_id,
          source_ids: [SOURCE_ID], is_observation: true, data_role: 'observed_annual',
        })),
      }],
    });
    return Object.assign(common, {
      emissions: {
        status: 'reviewed_factual', metric: METRIC, label: REQUIRED_LABEL, unit: UNIT,
        plane: 'harmonized', period: '2014-2023', evidence_class: 'harmonized_estimate',
        source_id: SOURCE_ID, source_url: source.source_url,
        review_id: review.review_id,
        limitations: [
          'Harmonized estimates are not official Party inventories.',
          'LULUCF is excluded.',
          'The selected rows do not provide uncertainty bounds.',
          'International-bunker treatment is not asserted from the selected rows.',
          'This factual series does not assess commitments, targets, delivery, performance, impact bands, or scores.',
        ],
        series: points,
        latest: points[points.length - 1],
      },
      ct32_separation_contract_hash: card.calculation_hash,
    });
  });

  const reviewed = countries.filter(country => country.emissions.status === 'reviewed_factual');
  const gaps = countries.filter(country => country.emissions.status === 'source_gap');
  assert(reviewed.length === 206 && gaps.length === 43, 'expected 206 reviewed series and 43 gaps');
  assert(reviewed.reduce((sum, country) => sum + country.emissions.series.length, 0) === 2060, 'expected 2,060 observations');

  const latestValues = reviewed.map(country => country.emissions.latest.value);
  const rankingRecords = countries.map(country => ({
    country_id: country.country_id, label: country.name,
    latest_observation: country.emissions.latest ? {
      value: country.emissions.latest.value, metric: country.emissions.metric,
      period: { start_year: 2023, end_year: 2023 }, plane: 'harmonized',
      accounting_frame: 'economy_wide_ghg_excluding_lulucf', scope: 'economy_wide_excluding_lulucf', unit: country.emissions.unit,
      review_state: 'reviewed', evidence_gate_passed: true, evidence_flags: [],
    } : {},
    evidence_flags: country.emissions.latest ? [] : ['source_unavailable'],
  }));
  const ranking = COUNTRY_RANKING_COMPILER.compile(rankingRecords, {
    lens: 'annual_emissions', metric: METRIC, period: { start_year: 2023, end_year: 2023 },
    plane: 'harmonized', accounting_frame: 'economy_wide_ghg_excluding_lulucf',
    scope: 'economy_wide_excluding_lulucf', unit: UNIT,
  }, { release_id: 'ct-42-factual-runtime-candidate-2026-07-15', compiled_at: CREATED_AT, input_hash: promotion.calculation_hash });
  const viewGuards = countries.map(country => COUNTRY_CLIMATE_VIEW_MODEL.build({
    axes: {
      identity: { country_id: country.country_id, name: country.name },
      impact: { state: 'not_assessed', band: 'not_assessed' },
      target_integrity: { state: 'not_assessed', integrity: 'not_assessed', reason_codes: ['independent_review_required'] },
      ambition: { state: 'not_assessed' }, delivery: { state: 'not_assessed' }, fair_contribution: { state: 'not_assessed' },
      evidence: { state: country.emissions.status, grade: 'D', flags: country.emissions.latest ? [] : ['source_unavailable'] },
    },
  }));
  assert(viewGuards.every(view => view.composite_score === null && view.axes.length === 6 && view.card.delivery.state === 'not_assessed'), 'CT-30 presentation guard failed');
  assert(ranking.disclosure.eligible_count === 206 && ranking.disclosure.unranked_count === 43 && ranking.unranked.numbered === false, 'CT-31 ranking boundary failed');
  const runtime = {
    schema_version: '1.0.0', candidate_id: 'ct-42-factual-runtime-candidate-2026-07-15',
    review_status: 'not_reviewed', production_runtime_release: false,
    required_next_gate: 'independent CT-42 review followed by CT-40 allow decision',
    created_at: CREATED_AT,
    source_chain: {
      promotion_id: promotion.promotion_id, promotion_sha256: hashBytes(promotionBytes),
      promotion_calculation_hash: promotion.calculation_hash,
      review_id: review.review_id, review_sha256: hashBytes(reviewBytes), review_calculation_hash: review.calculation_hash,
    },
    metric: promotion.metric,
    interpretation: {
      magnitude_scale: 'log10(value_mtco2e + offset), normalized across the exact reviewed 2023 domain',
      magnitude_domain: { min_mtco2e_per_year: Math.min(...latestValues), max_mtco2e_per_year: Math.max(...latestValues), offset_mtco2e_per_year: 0.01 },
      color_channel: 'non-green sequential violet-to-amber magnitude treatment',
      missing_data_treatment: 'neutral visible hatch/dot treatment; never ranked',
      ranking: 'descending same-metric 2023 values with competition ties; data gaps separate and unnumbered',
      performance_judgment: false,
    },
    coverage: { registry_entities: countries.length, reviewed_series: reviewed.length, source_gaps: gaps.length, observations: 2060 },
    contract_validations: {
      ct30_version: COUNTRY_CLIMATE_VIEW_MODEL.VERSION,
      ct30_projection_hash: hashJson(viewGuards),
      ct31_version: COUNTRY_RANKING_COMPILER.VERSION,
      ct31_calculation_hash: ranking.calculation_hash,
      ct32_country_contract_hash: hashJson(countries.map(country => country.ct32_separation_contract_hash)),
      ct33_contract_version: '1.0.0',
      ct33_browser_verification_required: true,
    },
    ranking,
    countries,
  };
  runtime.calculation_hash = hashJson(runtime);

  const promotionSha = hashBytes(promotionBytes);
  const reviewSha = hashBytes(reviewBytes);
  const facts = reviewed.flatMap(country => country.emissions.series.map(point => ({
    fact_id: point.fact_id,
    entity_id: country.country_id,
    metric: METRIC,
    value: point.value_decimal,
    unit: UNIT,
    period: String(point.year),
    plane: 'harmonized',
    evidence_class: 'harmonized_estimate',
    source_id: SOURCE_ID,
    source_version: source.version,
    source_checksum_sha256: source.artifact.sha256,
    _artifact_path: review.reviewed_inputs.promotion_path,
    _artifact_sha256: promotionSha,
    review: {
      status: 'reviewed', mode: 'batch_attestation', batch_attestation_id: review.review_id,
      batch_artifact_sha256: promotionSha, batch_attestation_sha256: reviewSha, methodology_version: '0.1.0',
    },
    allowed_uses: ALLOWED_USES,
    derivation: null,
  })));

  const batchAttestation = {
    attestation_id: review.review_id,
    batch_id: promotion.promotion_id,
    decision: 'pass',
    source: { source_id: SOURCE_ID, version: source.version, checksum_sha256: source.artifact.sha256 },
    artifact: { path: review.reviewed_inputs.promotion_path, sha256: promotionSha },
    _path: 'data/climate/reviews/primap-hist-2.6.1-factual-display-ct10c-review.json',
    _file_sha256: reviewSha,
    fact_ids: facts.map(fact => fact.fact_id),
    review: {
      status: 'reviewed', builder_id: review.reviewer.builder_id,
      reviewer_id: review.reviewer.reviewer_id, reviewed_at: review.reviewed_at, methodology_version: '0.1.0',
    },
    production_runtime_release: false,
  };
  const publishedFacts = {
    schema_version: '1.0.0', release_id: 'ct-42-published-facts-candidate-2026-07-15',
    review_status: 'not_reviewed', production_runtime_release: false,
    methodology_version: '0.1.0', fact_count: facts.length, facts,
    batch_attestations: [batchAttestation],
  };
  publishedFacts.calculation_hash = hashJson(publishedFacts);

  return { runtime, publishedFacts, batchAttestation };
}

module.exports = { compile, stable, hashJson, hashBytes, ALLOWED_USES };
