'use strict';

// Pure CT-20 target normalization and comparability engine. This module does
// no I/O, reads no clock, and deliberately has no delivery/performance logic.

const ENGINE_VERSION = '1.0.0';
const METHODOLOGY_VERSION = '0.1.0';

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

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => {
    const ai = REASON_ORDER.has(a) ? REASON_ORDER.get(a) : Number.MAX_SAFE_INTEGER;
    const bi = REASON_ORDER.has(b) ? REASON_ORDER.get(b) : Number.MAX_SAFE_INTEGER;
    return ai - bi || String(a).localeCompare(String(b));
  });
}

function sameSet(left, right) {
  const a = [...new Set(left || [])].sort();
  const b = [...new Set(right || [])].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function quantityFrom(value, unit) {
  if (value && isFiniteNumber(value.amount) && isText(value.unit)) {
    return { kind: 'exact', amount: value.amount, unit: value.unit };
  }
  if (value && isFiniteNumber(value.lower) && isFiniteNumber(value.upper) &&
      value.lower <= value.upper && isText(value.unit)) {
    return { kind: 'range', lower: value.lower, upper: value.upper, unit: value.unit };
  }
  if (isFiniteNumber(value) && isText(unit)) {
    return { kind: 'exact', amount: value, unit };
  }
  return null;
}

function normalizeFact(raw) {
  if (!raw || !isText(raw.fact_id)) return null;
  let year = raw.year;
  if (!Number.isInteger(year) && raw.period && isText(raw.period.start)) {
    year = Number(raw.period.start.slice(0, 4));
  }
  const value = quantityFrom(raw.value, raw.unit);
  const uncertainty = raw.uncertainty || (raw.evidence && raw.evidence.uncertainty) || null;
  return {
    fact_id: raw.fact_id,
    metric: raw.metric || null,
    year: Number.isInteger(year) ? year : null,
    value,
    scope: raw.scope || null,
    uncertainty,
    evidence_state: raw.evidence_state || (raw.evidence && raw.evidence.state) || 'available',
    review_status: raw.review_status || (raw.review && raw.review.status) || null
  };
}

function makeFactIndex(evidence) {
  const facts = Array.isArray(evidence.facts) ? evidence.facts : [];
  return new Map(facts.map(normalizeFact).filter(Boolean).map((fact) => [fact.fact_id, fact]));
}

function targetScope(target) {
  const scope = target && target.scope ? target.scope : {};
  return {
    accounting_frame: scope.accounting_frame || 'not_reported',
    gases: [...(scope.gases || [])],
    sectors: [...(scope.sectors || [])],
    geography: scope.geography ?? null,
    lulucf: scope.lulucf || 'not_reported',
    gwp_convention: scope.gwp_convention ?? null,
    article6_treatment: scope.article6_treatment ?? null
  };
}

function scopeReasons(scope) {
  const reasons = [];
  if (!scope || !isText(scope.accounting_frame) || scope.accounting_frame === 'not_reported') reasons.push('target_scope_missing');
  if (!scope || !scope.gases || !scope.gases.length) reasons.push('gas_basket_missing');
  if (!scope || !scope.sectors || !scope.sectors.length) reasons.push('sector_coverage_missing');
  if (!scope || !isText(scope.geography)) reasons.push('geographic_coverage_missing');
  if (!scope || scope.lulucf === 'not_reported' || !isText(scope.lulucf)) reasons.push('lulucf_treatment_missing');
  if (scope && scope.accounting_frame !== 'fossil_co2' && !isText(scope.gwp_convention)) reasons.push('gwp_convention_missing');
  if (!scope || !isText(scope.article6_treatment)) reasons.push('article6_treatment_missing');
  return reasons;
}

function compareScope(expected, actual) {
  const reasons = [];
  if (!actual) return ['scope_mismatch'];
  if (expected.accounting_frame !== actual.accounting_frame) reasons.push('scope_mismatch');
  if (!sameSet(expected.gases, actual.gases)) reasons.push('gas_basket_mismatch');
  if (expected.gwp_convention !== actual.gwp_convention && expected.accounting_frame !== 'fossil_co2') reasons.push('gwp_mismatch');
  if (!sameSet(expected.sectors, actual.sectors)) reasons.push('sector_mismatch');
  if (expected.geography !== actual.geography) reasons.push('geographic_boundary_mismatch');
  if (expected.lulucf !== actual.lulucf) reasons.push('lulucf_mismatch');
  return reasons;
}

function factReasons(fact, expectedScope, expectedYear) {
  if (!fact) return ['source_missing', 'reference_value_missing'];
  const reasons = [];
  if (fact.evidence_state === 'source_unavailable') reasons.push('source_unavailable');
  if (fact.evidence_state === 'not_reported') reasons.push('value_not_reported');
  if (fact.evidence_state === 'withheld') reasons.push('value_withheld');
  if (!fact.value) reasons.push('reference_value_missing');
  if (Number.isInteger(expectedYear) && fact.year !== expectedYear) reasons.push('year_mismatch');
  reasons.push(...compareScope(expectedScope, fact.scope));
  return reasons;
}

function scaleQuantity(quantity, factor) {
  if (!quantity || !isFiniteNumber(factor)) return null;
  if (quantity.kind === 'exact') return { kind: 'exact', amount: quantity.amount * factor, unit: quantity.unit };
  const values = [quantity.lower * factor, quantity.upper * factor].sort((a, b) => a - b);
  return { kind: 'range', lower: values[0], upper: values[1], unit: quantity.unit };
}

function quantitiesEqual(left, right) {
  const a = quantityFrom(left);
  const b = quantityFrom(right);
  if (!a || !b || a.kind !== b.kind || a.unit !== b.unit) return false;
  if (a.kind === 'exact') return a.amount === b.amount;
  return a.lower === b.lower && a.upper === b.upper;
}

function multiplyQuantities(left, right) {
  if (!left || !right || !isText(left.unit) || !isText(right.unit)) return null;
  const suffix = `/${right.unit}`;
  if (!left.unit.endsWith(suffix)) return null;
  const outputUnit = left.unit.slice(0, -suffix.length);
  if (!outputUnit) return null;
  const a = left.kind === 'range' ? [left.lower, left.upper] : [left.amount, left.amount];
  const b = right.kind === 'range' ? [right.lower, right.upper] : [right.amount, right.amount];
  const values = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]].sort((x, y) => x - y);
  return values[0] === values[3]
    ? { kind: 'exact', amount: values[0], unit: outputUnit }
    : { kind: 'range', lower: values[0], upper: values[3], unit: outputUnit };
}

function applyUncertainty(quantity, uncertainty) {
  if (!quantity || !uncertainty || !isFiniteNumber(uncertainty.lower) || !isFiniteNumber(uncertainty.upper)) return quantity;
  if (uncertainty.lower > uncertainty.upper || uncertainty.lower < 0) return quantity;
  if (quantity.kind !== 'exact') return quantity;
  return { kind: 'range', lower: uncertainty.lower, upper: uncertainty.upper, unit: quantity.unit };
}

function uncertaintyTooLarge(quantity, maxRelativeUncertainty) {
  if (!quantity || quantity.kind !== 'range' || !isFiniteNumber(maxRelativeUncertainty)) return false;
  const midpoint = (quantity.lower + quantity.upper) / 2;
  if (midpoint === 0) return quantity.lower !== quantity.upper;
  return (quantity.upper - quantity.lower) / (2 * Math.abs(midpoint)) > maxRelativeUncertainty;
}

function reviewGate(target) {
  const review = target && target.review ? target.review : {};
  const independent = review.status === 'reviewed' && isText(review.extractor_id) &&
    isText(review.reviewer_id) && review.extractor_id !== review.reviewer_id &&
    isText(review.reviewed_at);
  return {
    passed: independent,
    status: independent ? 'reviewed' : 'independent_review_required',
    extractor_id: review.extractor_id ?? null,
    reviewer_id: review.reviewer_id ?? null,
    reviewed_at: review.reviewed_at ?? null
  };
}

function baseResult(target) {
  const scope = targetScope(target);
  return {
    engine_version: ENGINE_VERSION,
    methodology_version: METHODOLOGY_VERSION,
    target_id: target && target.target_id ? target.target_id : null,
    country_id: target && target.country_id ? target.country_id : null,
    target_type: target && target.target_type ? target.target_type : null,
    condition: target && target.condition ? target.condition : null,
    comparability: 'not_assessed',
    eligible: false,
    reason_codes: [],
    normalized_endpoint: null,
    accounting_frame: scope,
    uncertainty: null,
    input_fact_ids: [],
    lineage: {
      formula: null,
      formula_version: ENGINE_VERSION,
      target_source_fact_ids: [...((target && target.source_fact_ids) || [])].sort(),
      reviewed_against_fact_ids: []
    },
    independent_review: reviewGate(target)
  };
}

function finish(result, reasons, endpoint, formula, inputs, options) {
  const allReasons = uniqueSorted(reasons);
  const structural = allReasons.filter((code) => code !== 'licence_not_approved' && code !== 'independent_review_required');
  const gateOnly = structural.length === 0 && allReasons.length > 0;
  result.reason_codes = allReasons;
  result.input_fact_ids = [...new Set(inputs)].sort();
  result.lineage.reviewed_against_fact_ids = [...result.input_fact_ids];
  result.lineage.formula = formula;
  result.uncertainty = endpoint && endpoint.value && endpoint.value.kind === 'range'
    ? { kind: 'bounded_range', lower: endpoint.value.lower, upper: endpoint.value.upper, unit: endpoint.value.unit }
    : null;
  if (!allReasons.length && endpoint) {
    result.comparability = 'comparable';
    result.eligible = true;
    result.normalized_endpoint = endpoint;
  } else if (gateOnly) {
    result.comparability = 'not_assessed';
  } else if (options.partial === true) {
    result.comparability = 'partially_comparable';
  } else {
    result.comparability = 'non_comparable';
  }
  return result;
}

function assessTarget(target, evidence = {}, requestedOptions = {}) {
  const options = {
    requireLicence: requestedOptions.requireLicence !== false,
    requireIndependentReview: requestedOptions.requireIndependentReview !== false,
    maxRelativeUncertainty: isFiniteNumber(requestedOptions.maxRelativeUncertainty)
      ? requestedOptions.maxRelativeUncertainty : 0.5,
    partial: false
  };
  const result = baseResult(target);
  if (!target || !isText(target.target_type)) {
    result.comparability = 'no_active_target_found';
    result.reason_codes = ['target_not_found'];
    return result;
  }

  const reasons = [];
  const inputs = [];
  const facts = makeFactIndex(evidence);
  const scope = result.accounting_frame;
  let endpoint = null;
  let formula = null;

  if (target.status === 'expired' || target.status === 'superseded' || target.status === 'withdrawn') {
    reasons.push('target_expired');
  } else if (target.status !== 'active') {
    reasons.push('climate_evidence_not_reviewed', 'source_not_reviewed');
  }
  if (!isText(target.condition) || target.condition === 'not_stated') reasons.push('conditionality_missing');
  reasons.push(...scopeReasons(scope));
  if (options.requireLicence && evidence.licence_approved !== true) reasons.push('licence_not_approved');
  if (options.requireIndependentReview && !result.independent_review.passed) reasons.push('independent_review_required');

  const reduction = isFiniteNumber(target.reduction_pct) ? 1 - target.reduction_pct / 100 : null;
  const year = Number.isInteger(target.target_year) ? target.target_year : null;

  switch (target.target_type) {
    case 'base_year': { // Stated reduction from an explicit, scope-matched reference inventory.
      if (!year) reasons.push('target_year_missing');
      if (!target.reference || !Number.isInteger(target.reference.year)) reasons.push('reference_year_missing');
      if (!target.reference || !target.reference.value || !isFiniteNumber(target.reference.value.amount)) reasons.push('reference_value_missing');
      if (!isFiniteNumber(reduction)) reasons.push('evidence_insufficient');
      const factId = target.reference && target.reference.fact_id;
      const fact = factId ? facts.get(factId) : null;
      if (factId) inputs.push(factId);
      else reasons.push('source_missing');
      reasons.push(...factReasons(fact, scope, target.reference && target.reference.year));
      if (fact && fact.value && target.reference && target.reference.value && fact.value.unit !== target.reference.value.unit) reasons.push('scope_mismatch');
      if (fact && fact.value && target.reference && target.reference.value && !quantitiesEqual(fact.value, target.reference.value)) reasons.push('unresolved_source_conflict');
      const base = fact && applyUncertainty(fact.value, fact.uncertainty);
      if (base && isFiniteNumber(reduction)) endpoint = { year, value: scaleQuantity(base, reduction), condition: target.condition };
      if (endpoint && target.target_value && !quantitiesEqual(endpoint.value, target.target_value)) reasons.push('unresolved_source_conflict');
      formula = 'scope-matched reference emissions × (1 − stated reduction percentage / 100)';
      break;
    }
    case 'bau': { // Current or first observed emissions are never substituted for BAU.
      if (!year) reasons.push('target_year_missing');
      if (!target.bau || !isText(target.bau.scenario_id)) reasons.push('bau_scenario_missing');
      if (!target.bau || !isText(target.bau.vintage)) reasons.push('bau_vintage_missing');
      if (!target.bau || !target.bau.target_year_value) reasons.push('bau_target_value_missing');
      if (!isFiniteNumber(reduction)) reasons.push('evidence_insufficient');
      const factId = target.bau && target.bau.source_fact_id;
      const fact = factId ? facts.get(factId) : null;
      if (factId) inputs.push(factId);
      else reasons.push('source_missing');
      const factSpecific = factReasons(fact, scope, year).map((code) => code === 'reference_value_missing' ? 'bau_target_value_missing' : code);
      reasons.push(...factSpecific);
      const baseline = fact && applyUncertainty(fact.value, fact.uncertainty);
      if (baseline && target.bau && target.bau.target_year_value && baseline.unit !== target.bau.target_year_value.unit) reasons.push('scope_mismatch');
      if (baseline && target.bau && target.bau.target_year_value && !quantitiesEqual(baseline, target.bau.target_year_value)) reasons.push('unresolved_source_conflict');
      if (baseline && isFiniteNumber(reduction)) endpoint = { year, value: scaleQuantity(baseline, reduction), condition: target.condition };
      if (endpoint && target.target_value && !quantitiesEqual(endpoint.value, target.target_value)) reasons.push('unresolved_source_conflict');
      formula = 'published target-year BAU scenario value × (1 − stated reduction percentage / 100)';
      break;
    }
    case 'intensity': { // Unit algebra is deliberately exact; no GDP or population proxy.
      if (!year) reasons.push('target_year_missing');
      if (!target.reference || !target.reference.fact_id || !target.reference.value) reasons.push('reference_value_missing');
      if (!target.intensity || !isText(target.intensity.denominator_metric) || !isText(target.intensity.denominator_unit)) reasons.push('intensity_denominator_missing');
      if (!target.intensity || !isText(target.intensity.target_year_denominator_fact_id)) reasons.push('intensity_denominator_projection_missing');
      if (!isFiniteNumber(reduction)) reasons.push('evidence_insufficient');
      const refId = target.reference && target.reference.fact_id;
      const denId = target.intensity && target.intensity.target_year_denominator_fact_id;
      const ref = refId ? facts.get(refId) : null;
      const denominator = denId ? facts.get(denId) : null;
      if (refId) inputs.push(refId); else reasons.push('source_missing');
      if (denId) inputs.push(denId); else reasons.push('source_missing');
      if (!ref || !ref.value) reasons.push('reference_value_missing');
      if (!denominator || !denominator.value) reasons.push('intensity_denominator_projection_missing');
      if (ref) {
        if (target.reference && Number.isInteger(target.reference.year) && ref.year !== target.reference.year) reasons.push('year_mismatch');
        reasons.push(...compareScope(scope, ref.scope));
        if (target.reference && target.reference.value && ref.value && !quantitiesEqual(ref.value, target.reference.value)) reasons.push('unresolved_source_conflict');
      }
      if (denominator) {
        if (denominator.year !== year) reasons.push('year_mismatch');
        if (target.intensity && denominator.metric !== target.intensity.denominator_metric) reasons.push('intensity_denominator_projection_missing');
        if (target.intensity && denominator.value && denominator.value.unit !== target.intensity.denominator_unit) reasons.push('scope_mismatch');
      }
      const targetIntensity = ref && ref.value && isFiniteNumber(reduction) ? scaleQuantity(applyUncertainty(ref.value, ref.uncertainty), reduction) : null;
      const absolute = targetIntensity && denominator ? multiplyQuantities(targetIntensity, applyUncertainty(denominator.value, denominator.uncertainty)) : null;
      if (targetIntensity && denominator && !absolute) reasons.push('scope_mismatch');
      if (absolute) endpoint = { year, value: absolute, condition: target.condition };
      if (endpoint && target.target_value && !quantitiesEqual(endpoint.value, target.target_value)) reasons.push('unresolved_source_conflict');
      formula = 'scope-matched reference intensity × (1 − stated reduction percentage / 100) × target-year denominator';
      break;
    }
    case 'fixed_level': {
      if (!year) reasons.push('target_year_missing');
      const value = quantityFrom(target.target_value);
      if (!value) reasons.push('fixed_level_missing');
      if (value) endpoint = { year, value, condition: target.condition };
      formula = 'official stated absolute target level (no transformation)';
      break;
    }
    case 'trajectory': {
      const ids = target.trajectory && Array.isArray(target.trajectory.pathway_fact_ids) ? target.trajectory.pathway_fact_ids : [];
      if (ids.length < 2) reasons.push('trajectory_missing');
      const path = ids.map((id) => { inputs.push(id); return facts.get(id); });
      if (path.some((fact) => !fact || !fact.value)) reasons.push('trajectory_missing');
      for (const fact of path.filter(Boolean)) reasons.push(...compareScope(scope, fact.scope));
      const ordered = path.filter((fact) => fact && fact.value).sort((a, b) => a.year - b.year || a.fact_id.localeCompare(b.fact_id));
      if (ordered.some((fact, index) => index > 0 && fact.year <= ordered[index - 1].year)) reasons.push('year_mismatch');
      const last = ordered[ordered.length - 1];
      if (year && last && last.year !== year) reasons.push('year_mismatch');
      if (!year && last) result.accounting_frame.target_period_endpoint_year = last.year;
      if (last) endpoint = { year: year || last.year, value: applyUncertainty(last.value, last.uncertainty), condition: target.condition };
      formula = 'final stated official pathway fact (no interpolation)';
      break;
    }
    case 'peaking':
      if (!Number.isInteger(target.peak_year)) reasons.push('peaking_year_missing');
      reasons.push('evidence_insufficient');
      options.partial = Number.isInteger(target.peak_year);
      formula = 'peak-year indicator preserved; no absolute endpoint inferred';
      break;
    case 'sectoral':
      result.comparability = 'qualitative_or_sectoral';
      result.reason_codes = uniqueSorted([...reasons, 'sectoral_target']);
      result.lineage.formula = 'sectoral target preserved without economy-wide normalization';
      return result;
    case 'qualitative':
      result.comparability = 'qualitative_or_sectoral';
      result.reason_codes = uniqueSorted([...reasons, 'qualitative_target']);
      result.lineage.formula = 'qualitative target preserved without quantitative normalization';
      return result;
    case 'net_zero': {
      if (!year) reasons.push('target_year_missing');
      const nz = target.net_zero;
      if (!nz || !quantityFrom(nz.residual_emissions) || !isText(nz.removals_treatment) ||
          !isText(nz.offsets_treatment) || !Array.isArray(nz.interim_target_ids)) reasons.push('net_zero_details_missing');
      if (nz && quantityFrom(nz.residual_emissions)) {
        endpoint = { year, value: quantityFrom(nz.residual_emissions), condition: target.condition,
          residual_emissions: true, removals_treatment: nz.removals_treatment,
          offsets_treatment: nz.offsets_treatment, interim_target_ids: [...nz.interim_target_ids].sort() };
      }
      formula = 'official stated residual emissions level (gross emissions pathway not inferred)';
      break;
    }
    default:
      reasons.push('evidence_insufficient');
  }

  if (endpoint && uncertaintyTooLarge(endpoint.value, options.maxRelativeUncertainty)) reasons.push('uncertainty_too_large');
  return finish(result, reasons, endpoint, formula, inputs, options);
}

module.exports = { ENGINE_VERSION, METHODOLOGY_VERSION, REASON_CODES, assessTarget };
