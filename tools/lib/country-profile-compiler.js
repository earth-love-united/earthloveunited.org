'use strict';

// CT-22 is a pure compiler: it joins reviewed axis results without inventing
// country evidence, an ambition method, a fairness method, or a composite score.
const crypto = require('node:crypto');

const COMPILER_VERSION = '1.0.0';
const PROFILE_METHODOLOGY_VERSION = '0.1.0';

const AXIS_NAMES = Object.freeze([
  'impact', 'target_integrity', 'ambition', 'delivery',
  'fair_contribution', 'evidence_quality'
]);

const EVIDENCE_REASON_CODES = Object.freeze([
  'climate_evidence_not_reviewed', 'source_not_reviewed', 'source_missing',
  'source_unavailable', 'licence_not_approved', 'value_not_reported',
  'value_withheld', 'reporting_not_yet_due', 'reporting_optional',
  'not_applicable', 'stale_source', 'unresolved_source_conflict',
  'target_not_found', 'target_expired', 'target_scope_missing',
  'target_year_missing', 'reference_year_missing', 'reference_value_missing',
  'gas_basket_missing', 'gwp_convention_missing', 'sector_coverage_missing',
  'geographic_coverage_missing', 'lulucf_treatment_missing',
  'conditionality_missing', 'article6_treatment_missing',
  'bau_scenario_missing', 'bau_vintage_missing', 'bau_target_value_missing',
  'intensity_denominator_missing', 'intensity_denominator_projection_missing',
  'fixed_level_missing', 'trajectory_missing', 'peaking_year_missing',
  'qualitative_target', 'sectoral_target', 'net_zero_details_missing',
  'scope_mismatch', 'gas_basket_mismatch', 'gwp_mismatch', 'sector_mismatch',
  'geographic_boundary_mismatch', 'lulucf_mismatch', 'year_mismatch',
  'evidence_insufficient', 'uncertainty_too_large',
  'independent_review_required', 'membership_not_reviewed',
  'party_status_not_reviewed', 'territory_status_not_reviewed',
  'geometry_not_reviewed', 'region_not_reviewed', 'ldc_status_not_reviewed',
  'lldc_status_not_reviewed', 'sids_status_not_reviewed',
  'assessment_eligibility_not_reviewed'
]);

const ASSESSMENT_BASIS_CODES = Object.freeze([
  'calculation_time_missing', 'assessment_year_missing', 'country_mismatch',
  'target_non_comparable', 'target_endpoint_missing',
  'target_endpoint_invalid_range', 'target_endpoint_contract_invalid',
  'unit_mismatch', 'observed_series_incomplete', 'observed_series_invalid',
  'observation_fact_id_missing', 'projection_rejected_as_observation',
  'projection_point_rejected_as_observation',
  'observed_pace_at_least_required',
  'target_level_already_met_and_pace_sufficient',
  'observed_pace_slower_than_required', 'observed_required_intervals_overlap',
  'projection_role_invalid', 'projection_target_year_missing',
  'projection_invalid', 'policy_projection_meets_target',
  'policy_projection_misses_target', 'projection_target_intervals_overlap',
  'delivery_signals_disagree'
]);

const EVIDENCE_REASONS = new Set(EVIDENCE_REASON_CODES);
const ASSESSMENT_BASES = new Set(ASSESSMENT_BASIS_CODES);
const WITHHOLDING_REASONS = new Set(['licence_not_approved', 'value_withheld']);

const ALLOWED_STATUS = Object.freeze({
  impact: new Set(['very_high', 'high', 'medium', 'low', 'not_assessed']),
  target_integrity: new Set([
    'comparable', 'partially_comparable', 'non_comparable',
    'qualitative_or_sectoral', 'no_active_target_found', 'not_assessed'
  ]),
  ambition: new Set([
    'aligned', 'almost_sufficient', 'insufficient', 'highly_insufficient',
    'critically_insufficient', 'not_assessed'
  ]),
  delivery: new Set(['ahead', 'on_pace', 'uncertain', 'off_course', 'not_assessed']),
  fair_contribution: new Set(['context_only', 'not_assessed']),
  evidence_quality: new Set(['A', 'B', 'C', 'D'])
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stable(value[key]);
      return result;
    }, {});
  }
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function sorted(values) {
  return [...new Set(values || [])].sort();
}

function assertCodes(values, allowed, label) {
  sorted(values).forEach(code => {
    if (!allowed.has(code)) throw new Error(`Unknown ${label}: ${code}`);
  });
}

function isUtcTimestamp(value) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function isReviewed(review) {
  return Boolean(
    review && review.status === 'reviewed' && review.passed === true &&
    review.extractor_id && review.reviewer_id &&
    review.extractor_id !== review.reviewer_id && isUtcTimestamp(review.reviewed_at)
  );
}

function reasonsFrom(input) {
  return sorted([
    ...((input && input.evidence_reason_codes) || []),
    ...((input && input.reason_codes) || [])
  ]);
}

function factsFrom(input) {
  return sorted([
    ...((input && input.fact_ids) || []),
    ...((input && input.input_fact_ids) || [])
  ]).filter(id => typeof id === 'string' && id.startsWith('fact:'));
}

function withheld(reasons, state) {
  return state === 'withheld' || reasons.some(code => WITHHOLDING_REASONS.has(code));
}

function axisBase(name, status, availability, evidenceReasons, basisCodes, factIds, input) {
  if (!ALLOWED_STATUS[name].has(status)) throw new Error(`Invalid ${name} status: ${status}`);
  assertCodes(evidenceReasons, EVIDENCE_REASONS, 'evidence reason code');
  assertCodes(basisCodes, ASSESSMENT_BASES, 'assessment basis code');
  return {
    status,
    availability,
    evidence_reason_codes: sorted(evidenceReasons),
    assessment_basis_codes: sorted(basisCodes),
    fact_ids: sorted(factIds),
    method_id: input && input.method_id || null,
    methodology_version: input && input.methodology_version || null,
    value: input && Object.prototype.hasOwnProperty.call(input, 'value') ? input.value : null,
    lineage: input && input.lineage || null
  };
}

function failClosedAxis(name, input, fallbackReason = 'evidence_insufficient') {
  const evidenceReasons = reasonsFrom(input);
  const basisCodes = sorted(input && input.assessment_basis_codes);
  const reasons = evidenceReasons.length ? evidenceReasons : [fallbackReason];
  return axisBase(
    name,
    name === 'evidence_quality' ? 'D' : 'not_assessed',
    withheld(reasons, input && input.state) ? 'withheld' : 'not_assessed',
    reasons,
    basisCodes,
    factsFrom(input),
    input
  );
}

function compileReviewedAxis(name, input) {
  if (!input) return failClosedAxis(name, null);
  const evidenceReasons = reasonsFrom(input);
  const basisCodes = sorted(input.assessment_basis_codes);
  const status = input.status || 'not_assessed';
  if (withheld(evidenceReasons, input.state)) return failClosedAxis(name, input);
  if (!isReviewed(input.review) || input.eligible !== true || status === 'not_assessed') {
    const gated = Object.assign({}, input, {
      evidence_reason_codes: evidenceReasons.length
        ? evidenceReasons
        : [isReviewed(input.review) ? 'evidence_insufficient' : 'independent_review_required']
    });
    return failClosedAxis(name, gated);
  }
  if (!input.method_id || !input.methodology_version) {
    return failClosedAxis(name, Object.assign({}, input, {
      evidence_reason_codes: sorted([...evidenceReasons, 'assessment_eligibility_not_reviewed'])
    }));
  }
  const availability = name === 'fair_contribution' ? 'context_only' : 'available';
  return axisBase(name, status, availability, evidenceReasons, basisCodes, factsFrom(input), input);
}

function compileTargetIntegrity(input) {
  if (!input) return failClosedAxis('target_integrity', null, 'target_not_found');
  const result = input.result || input;
  const evidenceReasons = reasonsFrom(result);
  const basisCodes = sorted(input.assessment_basis_codes || result.assessment_basis_codes);
  const status = result.comparability || result.status || 'not_assessed';
  const review = input.review || result.independent_review;
  const reviewPassed = isReviewed(review);
  const gateReasons = evidenceReasons.filter(code => WITHHOLDING_REASONS.has(code));
  const factIds = sorted([
    ...factsFrom(result),
    ...((result.lineage && result.lineage.target_source_fact_ids) || []),
    ...((result.lineage && result.lineage.reviewed_against_fact_ids) || [])
  ]);
  const normalized = {
    status,
    evidence_reason_codes: evidenceReasons,
    assessment_basis_codes: basisCodes,
    fact_ids: factIds,
    method_id: input.method_id || 'ct20-target-comparability',
    methodology_version: result.methodology_version || input.methodology_version || null,
    value: null,
    lineage: result.lineage || null,
    review
  };
  if (gateReasons.length) return failClosedAxis('target_integrity', normalized);
  const reviewedFinding = reviewPassed && status !== 'not_assessed';
  if (!reviewedFinding) {
    normalized.evidence_reason_codes = sorted([
      ...evidenceReasons,
      ...(reviewPassed ? [] : ['independent_review_required'])
    ]);
    return failClosedAxis('target_integrity', normalized, 'target_not_found');
  }
  return axisBase(
    'target_integrity', status, 'available', evidenceReasons, basisCodes,
    factIds, normalized
  );
}

function compileDelivery(input) {
  if (!input) return failClosedAxis('delivery', null);
  const result = input.result || input;
  const evidenceReasons = sorted(result.evidence_reason_codes);
  const basisCodes = sorted(result.assessment_basis_codes);
  const normalized = {
    status: result.status,
    evidence_reason_codes: evidenceReasons,
    assessment_basis_codes: basisCodes,
    fact_ids: sorted([
      ...factsFrom(result),
      ...((result.lineage && result.lineage.observed_fact_ids) || []),
      ...((result.lineage && result.lineage.projection_fact_ids) || [])
    ]),
    method_id: input.method_id || 'ct21-country-delivery',
    methodology_version: result.methodology_version || input.methodology_version || null,
    lineage: result.lineage || null,
    review: input.review,
    state: input.state
  };
  if (withheld(evidenceReasons, input.state)) return failClosedAxis('delivery', normalized);
  if (result.status === 'not_assessed') return failClosedAxis('delivery', normalized);
  if (!isReviewed(input.review)) {
    normalized.evidence_reason_codes = sorted([...evidenceReasons, 'independent_review_required']);
    return failClosedAxis('delivery', normalized);
  }
  if (!result.methodology_version || !result.formula_version || !result.lineage) {
    normalized.evidence_reason_codes = sorted([...evidenceReasons, 'evidence_insufficient']);
    return failClosedAxis('delivery', normalized);
  }
  return axisBase(
    'delivery', result.status, 'available', evidenceReasons, basisCodes,
    normalized.fact_ids, normalized
  );
}

function compileImpact(input) {
  if (input && (input.value === null || input.value === undefined)) {
    return failClosedAxis('impact', Object.assign({}, input, {
      evidence_reason_codes: sorted([...reasonsFrom(input), 'value_not_reported'])
    }));
  }
  if (input && (!input.value || typeof input.value.amount !== 'number' || !Number.isFinite(input.value.amount) || !input.value.unit)) {
    return failClosedAxis('impact', Object.assign({}, input, {
      evidence_reason_codes: sorted([...reasonsFrom(input), 'evidence_insufficient'])
    }));
  }
  return compileReviewedAxis('impact', input);
}

function compileHeadline(axes) {
  const highImpact = axes.impact.availability === 'available' &&
    (axes.impact.status === 'very_high' || axes.impact.status === 'high');
  const targetMissing = axes.target_integrity.availability === 'available' &&
    ['no_active_target_found', 'non_comparable', 'qualitative_or_sectoral', 'partially_comparable']
      .includes(axes.target_integrity.status);
  const allEvidenceReasons = sorted(AXIS_NAMES.flatMap(name => axes[name].evidence_reason_codes));
  const facts = sorted(AXIS_NAMES.flatMap(name => axes[name].fact_ids));
  const availability = Object.fromEntries(AXIS_NAMES.map(name => [name, axes[name].availability]));

  if (AXIS_NAMES.some(name => axes[name].availability === 'withheld')) {
    return {
      status: 'withheld',
      classification: 'evidence_withheld',
      evidence_reason_codes: allEvidenceReasons,
      fact_ids: facts,
      axis_availability: availability
    };
  }
  if (highImpact && targetMissing) {
    return {
      status: 'available',
      classification: 'high_impact_without_comparable_target',
      evidence_reason_codes: sorted([
        ...allEvidenceReasons,
        ...(axes.target_integrity.status === 'no_active_target_found' ? ['target_not_found'] : [])
      ]),
      fact_ids: facts,
      axis_availability: availability
    };
  }
  if (axes.impact.availability === 'available' && targetMissing) {
    return {
      status: 'available',
      classification: 'without_comparable_target',
      evidence_reason_codes: sorted([
        ...allEvidenceReasons,
        ...(axes.target_integrity.status === 'no_active_target_found' ? ['target_not_found'] : [])
      ]),
      fact_ids: facts,
      axis_availability: availability
    };
  }
  if (axes.impact.availability === 'available' &&
      axes.target_integrity.availability === 'available' &&
      axes.delivery.availability === 'available') {
    return {
      status: 'available',
      classification: 'core_axes_available',
      evidence_reason_codes: allEvidenceReasons,
      fact_ids: facts,
      axis_availability: availability
    };
  }
  return {
    status: 'not_assessed',
    classification: 'insufficient_evidence',
    evidence_reason_codes: allEvidenceReasons.length ? allEvidenceReasons : ['evidence_insufficient'],
    fact_ids: facts,
    axis_availability: availability
  };
}

function compileProfile(input) {
  if (!input || typeof input !== 'object') throw new Error('profile input is required');
  if (!/^iso3166-1:[A-Z]{3}$/.test(input.country_id || '')) throw new Error('valid country_id is required');
  if (!isUtcTimestamp(input.generated_at)) {
    throw new Error('caller-supplied generated_at is required');
  }
  if (!input.data_release_id) throw new Error('data_release_id is required');

  const axes = {
    impact: compileImpact(input.axes && input.axes.impact),
    target_integrity: compileTargetIntegrity(input.axes && input.axes.target_integrity),
    ambition: compileReviewedAxis('ambition', input.axes && input.axes.ambition),
    delivery: compileDelivery(input.axes && input.axes.delivery),
    fair_contribution: compileReviewedAxis('fair_contribution', input.axes && input.axes.fair_contribution),
    evidence_quality: compileReviewedAxis('evidence_quality', input.axes && input.axes.evidence_quality)
  };
  const profile = {
    schema_version: '2.0.0',
    profile_id: input.profile_id || `profile:${input.country_id}:${input.data_release_id}`,
    country_id: input.country_id,
    data_release_id: input.data_release_id,
    compiler_version: COMPILER_VERSION,
    methodology_versions: {
      profile: PROFILE_METHODOLOGY_VERSION,
      impact: axes.impact.methodology_version,
      target_integrity: axes.target_integrity.methodology_version,
      ambition: axes.ambition.methodology_version,
      delivery: axes.delivery.methodology_version,
      fair_contribution: axes.fair_contribution.methodology_version,
      evidence_quality: axes.evidence_quality.methodology_version
    },
    generated_at: input.generated_at,
    headline: compileHeadline(axes),
    axes,
    calculation_hash: null
  };
  profile.calculation_hash = hash(Object.assign({}, profile, { calculation_hash: null }));
  return profile;
}

// Compatibility projection for the CT-02 public profile contract. The richer
// CT-22 envelope keeps availability, lineage, and CT-21 assessment bases; this
// projection deliberately contains only fields accepted by profile.schema.json.
function toCt02Profile(compiled) {
  const axes = Object.fromEntries(AXIS_NAMES.map(name => {
    const axis = compiled.axes[name];
    return [name, {
      status: axis.status,
      reason_codes: axis.evidence_reason_codes,
      fact_ids: axis.fact_ids,
      method_id: axis.method_id
    }];
  }));
  const publicHeadlineStatus = compiled.headline.status === 'withheld'
    ? 'withheld'
    : (axes.ambition.status !== 'not_assessed' && axes.delivery.status !== 'not_assessed'
      ? compiled.headline.status : 'not_assessed');
  const profile = {
    schema_version: '2.0.0',
    profile_id: compiled.profile_id,
    country_id: compiled.country_id,
    data_release_id: compiled.data_release_id,
    methodology_version: compiled.methodology_versions.profile,
    headline: {
      status: publicHeadlineStatus,
      reason_codes: compiled.headline.evidence_reason_codes
    },
    axes,
    generated_at: compiled.generated_at,
    calculation_hash: null
  };
  profile.calculation_hash = hash(Object.assign({}, profile, { calculation_hash: null }));
  return profile;
}

module.exports = {
  ASSESSMENT_BASIS_CODES,
  AXIS_NAMES,
  COMPILER_VERSION,
  EVIDENCE_REASON_CODES,
  PROFILE_METHODOLOGY_VERSION,
  compileProfile,
  toCt02Profile,
  hash,
  stable
};
