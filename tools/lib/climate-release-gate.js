'use strict';

const crypto = require('crypto');

const GATE_VERSION = '1.0.0';
const BLOCKED_EVIDENCE_STATES = new Set(['not_reported', 'not_assessed', 'non_comparable', 'stale', 'conflicting', 'withheld', 'source_unavailable', 'not_reviewed']);
const ASSESSMENT_ONLY_STATE_REASONS = Object.freeze({
  not_yet_due: 'reporting_not_yet_due',
  reporting_optional: 'reporting_optional',
  not_applicable: 'not_applicable'
});
const HIGH_IMPACT_PREFIXES = ['emissions.', 'target.', 'ambition.', 'delivery.', 'impact.'];

const REASON_CODES = Object.freeze([
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

const REASON_ORDER = new Map(REASON_CODES.map((code, index) => [code, index]));

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
}

function isVersion(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => {
    const ai = REASON_ORDER.has(a) ? REASON_ORDER.get(a) : Number.MAX_SAFE_INTEGER;
    const bi = REASON_ORDER.has(b) ? REASON_ORDER.get(b) : Number.MAX_SAFE_INTEGER;
    return ai - bi || String(a).localeCompare(String(b));
  });
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function stateReason(state) {
  return {
    not_reported: 'value_not_reported',
    not_assessed: 'climate_evidence_not_reviewed',
    non_comparable: 'evidence_insufficient',
    stale: 'stale_source',
    conflicting: 'unresolved_source_conflict',
    withheld: 'value_withheld',
    source_unavailable: 'source_unavailable',
    not_reviewed: 'climate_evidence_not_reviewed'
  }[state] || null;
}

function isHighImpactTransformation(fact) {
  const transformed = fact && (fact.evidence_class === 'derived' || fact.evidence_class === 'modeled' || fact.derivation);
  return Boolean(transformed && HIGH_IMPACT_PREFIXES.some((prefix) => String(fact.metric || '').startsWith(prefix)));
}

function reviewReasons(fact, review, methodologyVersion) {
  const reasons = [];
  if (!review || review.status !== 'reviewed') reasons.push('climate_evidence_not_reviewed');
  if (!review || !isText(review.extractor_id) || !isText(review.reviewer_id) || review.extractor_id === review.reviewer_id) reasons.push('independent_review_required');
  if (!review || !isTimestamp(review.reviewed_at)) reasons.push('source_not_reviewed');
  if (!review || !isSha256(review.source_checksum_sha256) || review.source_checksum_sha256 !== fact.source_checksum_sha256) reasons.push('source_not_reviewed');
  if (!review || review.methodology_version !== methodologyVersion) reasons.push('evidence_insufficient');

  const requiredFields = isHighImpactTransformation(fact)
    ? ['metric', 'period', 'scope', 'source', 'evidence', 'derivation']
    : ['metric', 'period', 'scope', 'source', 'evidence'];
  const fieldReviews = review && Array.isArray(review.field_reviews) ? review.field_reviews : [];
  for (const field of requiredFields) {
    const item = fieldReviews.find((entry) => entry && entry.field_path === field);
    const requiredFactIds = field === 'derivation' && fact.derivation && Array.isArray(fact.derivation.input_fact_ids)
      ? [fact.fact_id, ...fact.derivation.input_fact_ids]
      : [fact.fact_id];
    if (!item || item.status !== 'reviewed' || !Array.isArray(item.fact_ids) ||
        new Set(item.fact_ids).size !== item.fact_ids.length ||
        requiredFactIds.some((factId) => !item.fact_ids.includes(factId))) {
      reasons.push('climate_evidence_not_reviewed');
    }
  }
  return reasons;
}

function transformationReasons(fact, factIds, methodologyVersion) {
  if (!isHighImpactTransformation(fact)) return [];
  const derivation = fact.derivation;
  const reasons = [];
  if (!derivation || !isText(derivation.transformation) || !isVersion(derivation.formula_version) ||
      derivation.methodology_version !== methodologyVersion || !isTimestamp(derivation.calculated_at) ||
      !isSha256(derivation.calculation_hash)) reasons.push('evidence_insufficient');
  const inputs = derivation && Array.isArray(derivation.input_fact_ids) ? derivation.input_fact_ids : [];
  if (!inputs.length || inputs.some((id) => id === fact.fact_id || !factIds.has(id))) reasons.push('evidence_insufficient');
  return reasons;
}

function conflictReasons(factId, conflicts, factIds) {
  const related = conflicts.filter((conflict) => Array.isArray(conflict.fact_ids) && conflict.fact_ids.includes(factId));
  const reasons = [];
  for (const conflict of related) {
    if (conflict.status !== 'resolved' || !isText(conflict.resolution) ||
        !Array.isArray(conflict.resolution_fact_ids) || !conflict.resolution_fact_ids.length ||
        conflict.resolution_fact_ids.some((id) => !factIds.has(id)) ||
        !isText(conflict.reviewer_id) || !isTimestamp(conflict.resolved_at)) {
      reasons.push('unresolved_source_conflict');
    }
  }
  return reasons;
}

function sourceReasons(source, fact, forScoring) {
  if (!source) return ['source_missing'];
  const reasons = [];
  if (!isSha256(source.checksum_sha256) || source.checksum_sha256 !== fact.source_checksum_sha256) reasons.push('source_missing');
  if (!source.licence || !isText(source.licence.decision_id) || source.licence.redistribution_approved !== true) reasons.push('licence_not_approved');
  if (forScoring && (!source.licence || source.licence.scoring_approved !== true)) reasons.push('licence_not_approved');
  return reasons;
}

function queueItem(subjectType, subjectId, reasons, requiredFields) {
  return {
    queue_id: `review:${subjectType}:${subjectId}`,
    subject_type: subjectType,
    subject_id: subjectId,
    reason_codes: uniqueSorted(reasons),
    required_fields: [...new Set(requiredFields)].sort()
  };
}

function requiredFieldsForReasons(reasons) {
  const fields = [];
  if (reasons.includes('climate_evidence_not_reviewed') || reasons.includes('independent_review_required') || reasons.includes('source_not_reviewed')) fields.push('review');
  if (reasons.includes('source_missing') || reasons.includes('source_unavailable')) fields.push('source');
  if (reasons.includes('licence_not_approved')) fields.push('source.licence');
  if (reasons.includes('unresolved_source_conflict')) fields.push('conflict_resolution');
  if (reasons.includes('evidence_insufficient')) fields.push('evidence_or_derivation');
  if (reasons.includes('value_withheld') || reasons.includes('value_not_reported')) fields.push('value_state');
  if (reasons.includes('stale_source')) fields.push('source_recency');
  if (reasons.includes('reporting_not_yet_due') || reasons.includes('reporting_optional') || reasons.includes('not_applicable')) fields.push('assessment_eligibility');
  return fields;
}

function factDecision(fact, context, forScoring) {
  const reasons = [];
  const state = fact && fact.evidence_state;
  if (BLOCKED_EVIDENCE_STATES.has(state)) reasons.push(stateReason(state));
  if (forScoring && ASSESSMENT_ONLY_STATE_REASONS[state]) reasons.push(ASSESSMENT_ONLY_STATE_REASONS[state]);
  if (!fact || !isText(fact.fact_id) || !isText(fact.metric)) reasons.push('evidence_insufficient');
  if (!fact || !isSha256(fact.source_checksum_sha256)) reasons.push('source_missing');
  if (!fact || fact.methodology_version !== context.methodologyVersion) reasons.push('evidence_insufficient');
  const source = fact ? context.sources.get(fact.source_id) : null;
  reasons.push(...sourceReasons(source, fact || {}, forScoring));
  reasons.push(...reviewReasons(fact || {}, fact ? context.reviews.get(fact.fact_id) : null, context.methodologyVersion));
  reasons.push(...transformationReasons(fact || {}, context.factIds, context.methodologyVersion));
  reasons.push(...conflictReasons(fact && fact.fact_id, context.conflicts, context.factIds));
  const canonical = uniqueSorted(reasons.filter(Boolean));
  return {
    fact_id: fact && fact.fact_id ? fact.fact_id : null,
    eligible: canonical.length === 0,
    reason_codes: canonical
  };
}

function profileDecision(profile, factDecisions, methodologyVersion) {
  const reasons = [];
  const inputs = Array.isArray(profile.input_fact_ids) ? [...new Set(profile.input_fact_ids)].sort() : [];
  if (!isText(profile.profile_id) || !inputs.length || profile.methodology_version !== methodologyVersion ||
      !isTimestamp(profile.generated_at) || !isSha256(profile.calculation_hash)) reasons.push('evidence_insufficient');
  const review = profile.review || {};
  if (review.status !== 'reviewed' || !isTimestamp(review.reviewed_at)) reasons.push('climate_evidence_not_reviewed');
  if (!isText(review.compiler_id) || !isText(review.reviewer_id) || review.compiler_id === review.reviewer_id) reasons.push('independent_review_required');
  if (review.methodology_version !== methodologyVersion || !Array.isArray(review.input_fact_ids) ||
      review.input_fact_ids.length !== inputs.length || inputs.some((id) => !review.input_fact_ids.includes(id))) reasons.push('evidence_insufficient');
  for (const factId of inputs) {
    const decision = factDecisions.get(factId);
    if (!decision) reasons.push('source_missing');
    else reasons.push(...decision.reason_codes);
  }
  const canonical = uniqueSorted(reasons);
  return { profile_id: profile.profile_id || null, eligible: canonical.length === 0, reason_codes: canonical, input_fact_ids: inputs };
}

function releaseReviewReasons(candidate) {
  const review = candidate.review || {};
  const reasons = [];
  if (review.status !== 'reviewed' || !isTimestamp(review.reviewed_at)) reasons.push('climate_evidence_not_reviewed');
  const reviewerIds = Array.isArray(review.reviewer_ids) ? review.reviewer_ids : [];
  if (!isText(review.builder_id) || !reviewerIds.length || reviewerIds.some((id) => !isText(id)) ||
      new Set(reviewerIds).size !== reviewerIds.length || reviewerIds.includes(review.builder_id)) reasons.push('independent_review_required');
  return reasons;
}

function hasDuplicateIds(items, key) {
  const ids = items.map((item) => item && item[key]).filter(isText);
  return ids.length !== new Set(ids).size;
}

function deterministicSort(items, key) {
  return [...items].sort((left, right) => {
    const idOrder = String(left && left[key]).localeCompare(String(right && right[key]));
    return idOrder || JSON.stringify(stable(left)).localeCompare(JSON.stringify(stable(right)));
  });
}

function evaluateRelease(candidate) {
  if (!candidate || typeof candidate !== 'object') throw new TypeError('candidate must be an object');
  if (!isTimestamp(candidate.evaluated_at)) throw new TypeError('candidate.evaluated_at must be an explicit UTC timestamp');
  if (!isVersion(candidate.methodology_version)) throw new TypeError('candidate.methodology_version must be semantic version');

  const rawFacts = Array.isArray(candidate.facts) ? candidate.facts : [];
  const rawSources = Array.isArray(candidate.sources) ? candidate.sources : [];
  const rawReviews = Array.isArray(candidate.fact_reviews) ? candidate.fact_reviews : [];
  const rawProfiles = Array.isArray(candidate.profiles) ? candidate.profiles : [];
  const facts = deterministicSort(rawFacts, 'fact_id');
  const sources = new Map(deterministicSort(rawSources, 'source_id').map((source) => [source.source_id, source]));
  const reviews = new Map(deterministicSort(rawReviews, 'fact_id').map((review) => [review.fact_id, review]));
  const context = {
    methodologyVersion: candidate.methodology_version,
    sources,
    reviews,
    conflicts: candidate.conflicts || [],
    factIds: new Set(facts.map((fact) => fact.fact_id))
  };

  const factReleaseDecisions = facts.map((fact) => factDecision(fact, context, false));
  const factAssessmentDecisions = facts.map((fact) => factDecision(fact, context, true));
  const assessmentById = new Map(factAssessmentDecisions.map((decision) => [decision.fact_id, decision]));
  const profiles = deterministicSort(rawProfiles, 'profile_id');
  const profileDecisions = profiles.map((profile) => profileDecision(profile, assessmentById, candidate.methodology_version));
  const releaseLevelReasons = releaseReviewReasons(candidate);
  if (!facts.length || hasDuplicateIds(rawFacts, 'fact_id') || hasDuplicateIds(rawSources, 'source_id') ||
      hasDuplicateIds(rawReviews, 'fact_id') || hasDuplicateIds(rawProfiles, 'profile_id')) releaseLevelReasons.push('evidence_insufficient');
  const releaseReasons = [...releaseLevelReasons];
  factReleaseDecisions.forEach((decision) => releaseReasons.push(...decision.reason_codes));
  profileDecisions.forEach((decision) => releaseReasons.push(...decision.reason_codes));

  const reasonCodes = uniqueSorted(releaseReasons);
  const reviewQueue = [];
  for (const decision of factReleaseDecisions) {
    if (!decision.eligible) reviewQueue.push(queueItem('fact', decision.fact_id || 'missing', decision.reason_codes, requiredFieldsForReasons(decision.reason_codes)));
  }
  for (const decision of profileDecisions) {
    if (!decision.eligible) reviewQueue.push(queueItem('profile', decision.profile_id || 'missing', decision.reason_codes, requiredFieldsForReasons(decision.reason_codes)));
  }
  if (releaseLevelReasons.length) {
    const reasons = uniqueSorted(releaseLevelReasons);
    reviewQueue.push(queueItem('release', candidate.data_release_id || 'missing', reasons, requiredFieldsForReasons(reasons).length ? requiredFieldsForReasons(reasons) : ['review']));
  }
  reviewQueue.sort((a, b) => a.queue_id.localeCompare(b.queue_id));

  const output = {
    gate_version: GATE_VERSION,
    data_release_id: candidate.data_release_id || null,
    methodology_version: candidate.methodology_version,
    evaluated_at: candidate.evaluated_at,
    decision: reasonCodes.length ? 'deny' : 'allow',
    eligible: reasonCodes.length === 0,
    reason_codes: reasonCodes,
    fact_decisions: factReleaseDecisions,
    profile_decisions: profileDecisions,
    review_queue: reviewQueue,
    manifest: {
      decision: reasonCodes.length ? 'deny' : 'allow',
      release_eligible: reasonCodes.length === 0,
      reason_codes: reasonCodes,
      eligible_fact_ids: factReleaseDecisions.filter((item) => item.eligible).map((item) => item.fact_id).sort(),
      eligible_profile_ids: profileDecisions.filter((item) => item.eligible).map((item) => item.profile_id).sort(),
      calculation_hash: null
    }
  };
  output.manifest.calculation_hash = hash(output);
  return output;
}

module.exports = { GATE_VERSION, REASON_CODES, evaluateRelease };
