'use strict';

const crypto = require('node:crypto');

const FORMULA_VERSION = '1.0.0';
const METHODOLOGY_VERSION = '0.1.0';
const ALLOWED_RESULTS = new Set(['ahead', 'on_pace', 'uncertain', 'off_course', 'not_assessed']);
const OBSERVED_STATES = new Set(['available', 'estimated']);
const BLOCKING_STATES = new Set([
  'not_reported', 'not_assessed', 'non_comparable', 'not_applicable',
  'not_yet_due', 'reporting_optional', 'stale', 'conflicting', 'withheld',
  'source_unavailable', 'not_reviewed'
]);
const EVIDENCE_REASON_CODES = Object.freeze([
  'climate_evidence_not_reviewed', 'source_not_reviewed', 'source_missing', 'source_unavailable',
  'licence_not_approved', 'value_not_reported', 'value_withheld', 'reporting_not_yet_due',
  'reporting_optional', 'not_applicable', 'stale_source', 'unresolved_source_conflict',
  'target_not_found', 'target_expired', 'target_scope_missing', 'target_year_missing',
  'reference_year_missing', 'reference_value_missing', 'gas_basket_missing', 'gwp_convention_missing',
  'sector_coverage_missing', 'geographic_coverage_missing', 'lulucf_treatment_missing',
  'conditionality_missing', 'article6_treatment_missing', 'bau_scenario_missing',
  'bau_vintage_missing', 'bau_target_value_missing', 'intensity_denominator_missing',
  'intensity_denominator_projection_missing', 'fixed_level_missing', 'trajectory_missing',
  'peaking_year_missing', 'qualitative_target', 'sectoral_target', 'net_zero_details_missing',
  'scope_mismatch', 'gas_basket_mismatch', 'gwp_mismatch', 'sector_mismatch',
  'geographic_boundary_mismatch', 'lulucf_mismatch', 'year_mismatch', 'evidence_insufficient',
  'uncertainty_too_large', 'independent_review_required', 'membership_not_reviewed',
  'party_status_not_reviewed', 'territory_status_not_reviewed', 'geometry_not_reviewed',
  'region_not_reviewed', 'ldc_status_not_reviewed', 'lldc_status_not_reviewed',
  'sids_status_not_reviewed', 'assessment_eligibility_not_reviewed'
]);
const ASSESSMENT_BASIS_CODES = Object.freeze([
  'calculation_time_missing', 'assessment_year_missing', 'country_mismatch',
  'target_non_comparable', 'target_endpoint_missing', 'target_endpoint_invalid_range', 'target_endpoint_contract_invalid',
  'unit_mismatch', 'observed_series_incomplete', 'observed_series_invalid', 'observation_fact_id_missing',
  'projection_rejected_as_observation', 'projection_point_rejected_as_observation',
  'observed_pace_at_least_required', 'target_level_already_met_and_pace_sufficient',
  'observed_pace_slower_than_required', 'observed_required_intervals_overlap',
  'projection_role_invalid', 'projection_target_year_missing', 'projection_invalid',
  'policy_projection_meets_target', 'policy_projection_misses_target',
  'projection_target_intervals_overlap', 'delivery_signals_disagree'
]);
const EVIDENCE_REASON_SET = new Set(EVIDENCE_REASON_CODES);
const ASSESSMENT_BASIS_SET = new Set(ASSESSMENT_BASIS_CODES);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function assertCodes(codes, allowed, label) {
  codes.forEach(code => {
    if (!allowed.has(code)) throw new Error(`Unknown ${label}: ${code}`);
  });
}

function reason(status, evidenceCodes, basisCodes, extra) {
  assertCodes(evidenceCodes, EVIDENCE_REASON_SET, 'evidence reason code');
  assertCodes(basisCodes, ASSESSMENT_BASIS_SET, 'assessment basis code');
  const result = Object.assign({
    status,
    evidence_reason_codes: uniqueSorted(evidenceCodes),
    assessment_basis_codes: uniqueSorted(basisCodes),
    observed_pace: null,
    required_pace: null,
    level_comparison: null,
    policy_projection: null,
    illustrative_required_path: null,
    lineage: null
  }, extra || {});
  if (!ALLOWED_RESULTS.has(result.status)) throw new Error(`Invalid delivery result: ${result.status}`);
  return result;
}

function partitionCodes(codes) {
  const evidence = [];
  const basis = [];
  (codes || []).forEach(code => {
    if (EVIDENCE_REASON_SET.has(code)) evidence.push(code);
    else if (ASSESSMENT_BASIS_SET.has(code)) basis.push(code);
    else throw new Error(`Unknown reason code: ${code}`);
  });
  return { evidence, basis };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function interval(value, label) {
  if (!isFiniteNumber(value.value)) throw new Error(`${label}.value must be a finite number`);
  const uncertainty = value.uncertainty;
  if (uncertainty === null || uncertainty === undefined) {
    return { central: value.value, lower: value.value, upper: value.value, uncertainty: 'not_provided' };
  }
  if (!isFiniteNumber(uncertainty.lower) || !isFiniteNumber(uncertainty.upper)) {
    throw new Error(`${label}.uncertainty bounds must be finite numbers`);
  }
  if (uncertainty.lower > value.value || uncertainty.upper < value.value || uncertainty.lower > uncertainty.upper) {
    throw new Error(`${label}.uncertainty must contain the central value`);
  }
  return {
    central: value.value,
    lower: uncertainty.lower,
    upper: uncertainty.upper,
    uncertainty: uncertainty.method || 'provided_interval'
  };
}

function scopeMismatch(left, right) {
  const reasons = [];
  if (!left || !right) return ['scope_mismatch'];
  if ((left.accounting_frame || left.frame) !== (right.accounting_frame || right.frame)) reasons.push('scope_mismatch');
  if (JSON.stringify(uniqueSorted(left.gases || [])) !== JSON.stringify(uniqueSorted(right.gases || []))) reasons.push('gas_basket_mismatch');
  if ((left.gwp_convention || null) !== (right.gwp_convention || null)) reasons.push('gwp_mismatch');
  if (JSON.stringify(uniqueSorted(left.sectors || [])) !== JSON.stringify(uniqueSorted(right.sectors || []))) reasons.push('sector_mismatch');
  if ((left.geography || null) !== (right.geography || null)) reasons.push('geographic_boundary_mismatch');
  if ((left.lulucf || null) !== (right.lulucf || null)) reasons.push('lulucf_mismatch');
  return uniqueSorted(reasons);
}

function endpointInterval(endpoint) {
  const normalized = endpoint.normalized_endpoint;
  if (!normalized || !normalized.value) throw new Error('target_endpoint_missing');
  const quantity = normalized.value;
  if (quantity.kind === 'exact') {
    if (!isFiniteNumber(quantity.amount)) throw new Error('target_endpoint_missing');
    return { central: quantity.amount, lower: quantity.amount, upper: quantity.amount, uncertainty: 'exact_endpoint' };
  }
  if (quantity.kind === 'range') {
    if (!isFiniteNumber(quantity.lower) || !isFiniteNumber(quantity.upper) || quantity.lower > quantity.upper) {
      throw new Error('target_endpoint_invalid_range');
    }
    return {
      central: (quantity.lower + quantity.upper) / 2,
      lower: quantity.lower,
      upper: quantity.upper,
      uncertainty: 'target_endpoint_range'
    };
  }
  throw new Error('target_endpoint_missing');
}

function quantile(sorted, probability) {
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function pairwiseSlopes(points, pickY) {
  const slopes = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      slopes.push((pickY(points[j]) - pickY(points[i])) / (points[j].year - points[i].year));
    }
  }
  return slopes.sort((a, b) => a - b);
}

function median(values) {
  return quantile(values, 0.5);
}

function recentContiguousWindow(rawPoints) {
  const byYear = new Map();
  rawPoints.forEach((point, index) => {
    if (!Number.isInteger(point.year)) throw new Error(`observed_series.points[${index}].year must be an integer`);
    if (typeof point.fact_id !== 'string' || !point.fact_id.startsWith('fact:')) throw new Error('observation_fact_id_missing');
    if (byYear.has(point.year)) throw new Error('duplicate_observation_year');
    if (point.data_role && point.data_role !== 'observed_annual') throw new Error('projection_point_rejected_as_observation');
    byYear.set(point.year, Object.assign({}, point, interval(point, `observed_series.points[${index}]`)));
  });
  const points = [...byYear.values()].sort((a, b) => a.year - b.year);
  if (!points.length) return [];
  const contiguous = [points[points.length - 1]];
  for (let i = points.length - 2; i >= 0; i -= 1) {
    if (contiguous[0].year - points[i].year !== 1) break;
    contiguous.unshift(points[i]);
  }
  return contiguous.slice(-10);
}

function observedTrend(points, mode) {
  const transform = mode === 'compound_fractional' ? Math.log : value => value;
  const central = pairwiseSlopes(points, point => transform(point.central));
  const fastest = pairwiseSlopes(points, point => transform(point.lower));
  const slowest = pairwiseSlopes(points, point => transform(point.upper));
  // Bound each pair in the conservative direction by combining the later and earlier uncertainty endpoints.
  const lowerEnvelope = [];
  const upperEnvelope = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const years = points[j].year - points[i].year;
      lowerEnvelope.push((transform(points[j].lower) - transform(points[i].upper)) / years);
      upperEnvelope.push((transform(points[j].upper) - transform(points[i].lower)) / years);
    }
  }
  lowerEnvelope.sort((a, b) => a - b);
  upperEnvelope.sort((a, b) => a - b);
  const convert = mode === 'compound_fractional' ? slope => Math.exp(slope) - 1 : slope => slope;
  return {
    central: convert(median(central)),
    lower: convert(quantile(lowerEnvelope, 0.025)),
    upper: convert(quantile(upperEnvelope, 0.975)),
    diagnostic_lower_series_median: convert(median(fastest)),
    diagnostic_upper_series_median: convert(median(slowest))
  };
}

function requiredPace(current, target, years, mode) {
  const rates = [];
  const currents = [current.lower, current.central, current.upper];
  const targets = [target.lower, target.central, target.upper];
  currents.forEach(from => targets.forEach(to => {
    rates.push(mode === 'compound_fractional'
      ? Math.pow(to / from, 1 / years) - 1
      : (to - from) / years);
  }));
  rates.sort((a, b) => a - b);
  const central = mode === 'compound_fractional'
    ? Math.pow(target.central / current.central, 1 / years) - 1
    : (target.central - current.central) / years;
  return { central, lower: rates[0], upper: rates[rates.length - 1] };
}

function levelComparison(current, target) {
  let relation = 'overlap';
  if (current.upper < target.lower) relation = 'below_target_interval';
  else if (current.upper <= target.lower) relation = 'at_or_below_target_interval';
  else if (current.lower > target.upper) relation = 'above_target_interval';
  return {
    relation,
    gap: {
      central: current.central - target.central,
      lower: current.lower - target.upper,
      upper: current.upper - target.lower
    }
  };
}

function paceStatus(observed, required, level) {
  const epsilon = 1e-12;
  if (observed.upper <= required.lower + epsilon) {
    if ((level.relation === 'below_target_interval' || level.relation === 'at_or_below_target_interval') && observed.upper <= epsilon) {
      return { status: 'ahead', reasons: ['observed_pace_at_least_required', 'target_level_already_met_and_pace_sufficient'] };
    }
    return { status: 'on_pace', reasons: ['observed_pace_at_least_required'] };
  }
  if (observed.lower > required.upper + epsilon) {
    return { status: 'off_course', reasons: ['observed_pace_slower_than_required'] };
  }
  return { status: 'uncertain', reasons: ['observed_required_intervals_overlap'] };
}

function projectionComparison(projection, endpoint, targetInterval) {
  if (!projection) return null;
  const projectionFactIds = uniqueSorted(projection.input_fact_ids || projection.source_fact_ids || []);
  const rejected = (evidenceCodes, basisCodes) => ({
    status: 'not_assessed',
    eligible: false,
    evidence_reason_codes: uniqueSorted(evidenceCodes),
    assessment_basis_codes: uniqueSorted(basisCodes),
    projection_id: projection.projection_id || null,
    evidence_plane: projection.evidence_plane || null,
    scenario_name: projection.scenario && projection.scenario.name || null,
    scenario_vintage: projection.scenario && projection.scenario.vintage || null,
    target_year: endpoint.normalized_endpoint.year,
    projected_interval: null,
    target_interval: targetInterval,
    input_fact_ids: projectionFactIds
  });
  if (projection.country_id !== endpoint.country_id) return rejected([], ['country_mismatch']);
  if (projection.data_role !== 'scenario_projection_only') {
    return rejected([], ['projection_role_invalid']);
  }
  if (projection.state && BLOCKING_STATES.has(projection.state)) {
    const stateReasons = {
      stale: 'stale_source', conflicting: 'unresolved_source_conflict', source_unavailable: 'source_unavailable',
      not_reviewed: 'climate_evidence_not_reviewed', not_reported: 'value_not_reported', withheld: 'value_withheld',
      reporting_optional: 'reporting_optional', not_yet_due: 'reporting_not_yet_due'
    };
    return rejected([stateReasons[projection.state] || 'evidence_insufficient'], []);
  }
  if (!projection.review || projection.review.status !== 'reviewed') return rejected(['independent_review_required'], []);
  const mismatches = scopeMismatch(projection.scope, endpoint.accounting_frame);
  const basisMismatches = [];
  if (projection.unit !== endpoint.normalized_endpoint.value.unit) basisMismatches.push('unit_mismatch');
  if (mismatches.length || basisMismatches.length) return rejected(uniqueSorted(mismatches), basisMismatches);
  const targetPoints = (projection.points || []).filter(point => point.year === endpoint.normalized_endpoint.year);
  if (targetPoints.length !== 1) return rejected([], ['projection_target_year_missing']);
  let projected;
  try {
    projected = interval(targetPoints[0], 'policy_projection target-year point');
  } catch (error) {
    return rejected([], ['projection_invalid']);
  }
  let status = 'uncertain';
  let reasonCode = 'projection_target_intervals_overlap';
  if (projected.upper <= targetInterval.lower) {
    status = 'on_pace';
    reasonCode = 'policy_projection_meets_target';
  } else if (projected.lower > targetInterval.upper) {
    status = 'off_course';
    reasonCode = 'policy_projection_misses_target';
  }
  return {
      status,
      eligible: true,
      evidence_reason_codes: [],
      assessment_basis_codes: [reasonCode],
      projection_id: projection.projection_id,
      evidence_plane: projection.evidence_plane,
      scenario_name: projection.scenario && projection.scenario.name,
      scenario_vintage: projection.scenario && projection.scenario.vintage,
      target_year: endpoint.normalized_endpoint.year,
      projected_interval: projected,
      target_interval: targetInterval,
      input_fact_ids: projectionFactIds
  };
}

function combine(measured, projection) {
  if (!projection) return measured;
  if (projection === 'not_assessed') return measured;
  if (measured === 'not_assessed') return projection;
  if (measured === 'uncertain' || projection === 'uncertain') return 'uncertain';
  const measuredPositive = measured === 'ahead' || measured === 'on_pace';
  const projectionPositive = projection === 'on_pace';
  if (measuredPositive !== projectionPositive) return 'uncertain';
  return measured;
}

function assessDelivery(input) {
  if (!input || typeof input !== 'object') return reason('not_assessed', ['evidence_insufficient'], [], {});
  const endpoint = input.target_endpoint;
  const observedSeries = input.observed_series;
  const rawObservedFactIds = uniqueSorted(((observedSeries && observedSeries.points) || []).map(point => point.fact_id).filter(Boolean));
  const rawProjectionFactIds = uniqueSorted(
    ((input.policy_projection && (input.policy_projection.input_fact_ids || input.policy_projection.source_fact_ids)) || [])
  );
  const baseLineage = {
    formula_version: FORMULA_VERSION,
    methodology_version: METHODOLOGY_VERSION,
    calculated_at: input.calculated_at || null,
    country_id: input.country_id || null,
    observed_fact_ids: rawObservedFactIds,
    projection_fact_ids: rawProjectionFactIds,
    target_endpoint: endpoint ? stable(endpoint) : null,
    target_lineage_hash: endpoint && endpoint.lineage ? hash(endpoint.lineage) : null
  };

  if (!input.calculated_at || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(input.calculated_at)) {
    return reason('not_assessed', [], ['calculation_time_missing'], { lineage: baseLineage });
  }
  if (!Number.isInteger(input.as_of_year)) return reason('not_assessed', [], ['assessment_year_missing'], { lineage: baseLineage });
  if (!endpoint) return reason('not_assessed', ['target_not_found'], [], { lineage: baseLineage });
  if (!input.country_id || endpoint.country_id !== input.country_id || (observedSeries && observedSeries.country_id !== input.country_id)) {
    return reason('not_assessed', [], ['country_mismatch'], { lineage: baseLineage });
  }
  if (endpoint.engine_version !== '1.0.0' || endpoint.methodology_version !== METHODOLOGY_VERSION ||
      !endpoint.accounting_frame || !endpoint.lineage || endpoint.lineage.formula_version !== '1.0.0' ||
      !Array.isArray(endpoint.input_fact_ids) || !Array.isArray(endpoint.lineage.target_source_fact_ids) ||
      !Array.isArray(endpoint.lineage.reviewed_against_fact_ids)) {
    return reason('not_assessed', [], ['target_endpoint_contract_invalid'], { lineage: baseLineage });
  }
  if (endpoint.eligible !== true || endpoint.comparability !== 'comparable' || !endpoint.normalized_endpoint) {
    const endpointCodes = partitionCodes(endpoint.reason_codes || []);
    return reason('not_assessed', endpointCodes.evidence, uniqueSorted(endpointCodes.basis.concat('target_non_comparable')), { lineage: baseLineage });
  }
  if (!endpoint.independent_review || endpoint.independent_review.passed !== true || endpoint.independent_review.status !== 'reviewed') {
    return reason('not_assessed', ['independent_review_required'], [], { lineage: baseLineage });
  }
  if (!Number.isInteger(endpoint.normalized_endpoint.year)) return reason('not_assessed', ['target_year_missing'], [], { lineage: baseLineage });
  if (!endpoint.normalized_endpoint.value || typeof endpoint.normalized_endpoint.value.unit !== 'string') {
    return reason('not_assessed', [], ['target_endpoint_missing'], { lineage: baseLineage });
  }
  if (!observedSeries) return reason('not_assessed', ['evidence_insufficient'], [], { lineage: baseLineage });
  if (observedSeries.data_role !== 'observed_annual') return reason('not_assessed', [], ['projection_rejected_as_observation'], { lineage: baseLineage });
  if (observedSeries.state === 'conflicting' || input.unresolved_plane_conflict === true) {
    return reason('not_assessed', ['unresolved_source_conflict'], [], { lineage: baseLineage });
  }
  if (observedSeries.state === 'stale') return reason('not_assessed', ['stale_source'], [], { lineage: baseLineage });
  if (!OBSERVED_STATES.has(observedSeries.state)) {
    const stateReason = observedSeries.state === 'reporting_optional' ? 'reporting_optional' : 'evidence_insufficient';
    return reason('not_assessed', [stateReason], [], { lineage: baseLineage });
  }
  const mismatches = scopeMismatch(observedSeries.scope, endpoint.accounting_frame);
  const basisMismatches = observedSeries.unit !== endpoint.normalized_endpoint.value.unit ? ['unit_mismatch'] : [];
  if (mismatches.length || basisMismatches.length) return reason('not_assessed', uniqueSorted(mismatches), basisMismatches, { lineage: baseLineage });

  let points;
  try {
    points = recentContiguousWindow(observedSeries.points || []);
  } catch (error) {
    const code = EVIDENCE_REASON_SET.has(error.message) || ASSESSMENT_BASIS_SET.has(error.message) ? error.message : 'observed_series_invalid';
    const codes = partitionCodes([code]);
    return reason('not_assessed', codes.evidence, codes.basis, { lineage: baseLineage });
  }
  if (points.length < 6) return reason('not_assessed', [], ['observed_series_incomplete'], { lineage: baseLineage });
  const latest = points[points.length - 1];
  if (Number.isInteger(input.as_of_year) && input.as_of_year - latest.year > (input.max_staleness_years || 3)) {
    return reason('not_assessed', ['stale_source'], [], { lineage: baseLineage });
  }
  if (endpoint.normalized_endpoint.year <= latest.year) {
    return reason('not_assessed', ['target_expired'], [], { lineage: baseLineage });
  }

  let targetInterval;
  try {
    targetInterval = endpointInterval(endpoint);
  } catch (error) {
    const codes = partitionCodes([error.message]);
    return reason('not_assessed', codes.evidence, codes.basis, { lineage: baseLineage });
  }
  const strictlyPositive = points.every(point => point.lower > 0) && targetInterval.lower > 0;
  const mode = observedSeries.scope.accounting_frame === 'lulucf' || !strictlyPositive
    ? 'additive_absolute'
    : 'compound_fractional';
  const observed = observedTrend(points, mode);
  const required = requiredPace(latest, targetInterval, endpoint.normalized_endpoint.year - latest.year, mode);
  const level = levelComparison(latest, targetInterval);
  const measured = paceStatus(observed, required, level);
  const projection = projectionComparison(input.policy_projection || null, endpoint, targetInterval);
  const combinedStatus = combine(measured.status, projection && projection.status);
  const assessmentBasisCodes = measured.reasons.slice();
  if (projection && projection.eligible && combinedStatus === 'uncertain' && measured.status !== 'uncertain' && projection.status !== 'uncertain') {
    assessmentBasisCodes.push('delivery_signals_disagree');
  }

  const observedFactIds = uniqueSorted(points.map(point => point.fact_id).filter(Boolean));
  const inputFactIds = uniqueSorted(
    observedFactIds
      .concat(endpoint.input_fact_ids || [])
      .concat(projection ? projection.input_fact_ids : [])
  );
  const paceUnit = mode === 'compound_fractional' ? 'fraction/year' : `${observedSeries.unit}/year`;
  const illustrativePath = {
    data_role: 'illustrative_required_path',
    is_observation: false,
    start_year: latest.year,
    start_value: latest.central,
    target_year: endpoint.normalized_endpoint.year,
    target_value: targetInterval.central,
    unit: observedSeries.unit,
    interpolation: mode === 'compound_fractional' ? 'constant_compound_rate' : 'constant_absolute_change',
    label: 'Illustrative required pathway'
  };
  const lineage = Object.assign({}, baseLineage, {
    input_fact_ids: inputFactIds,
    observed_series_id: observedSeries.series_id,
    target_id: endpoint.target_id,
    policy_projection_id: projection ? projection.projection_id : null,
    observed_evidence_plane: observedSeries.evidence_plane,
    target_evidence_plane: 'official_target_evidence_via_ct20',
    projection_evidence_plane: projection ? projection.evidence_plane : null,
    observed_fact_ids: observedFactIds,
    projection_fact_ids: projection ? projection.input_fact_ids : [],
    target_endpoint: stable(endpoint),
    target_lineage_hash: hash(endpoint.lineage),
    transformation: 'Recent contiguous annual window; Theil-Sen pairwise median; conservative 2.5%/97.5% uncertainty envelope; interval comparison.',
    formulas: {
      compound_required: '(target/latest)^(1/(target_year-latest_year))-1',
      additive_required: '(target-latest)/(target_year-latest_year)',
      robust_observed: 'median((transform(y_j)-transform(y_i))/(year_j-year_i)); compound mode back-transforms with exp(slope)-1'
    },
    parameters: {
      minimum_observations: 6,
      maximum_recent_observations: 10,
      contiguous_annual_required: true,
      uncertainty_quantiles: [0.025, 0.975],
      mode
    }
  });
  lineage.calculation_hash = hash({ input, result: { status: combinedStatus, measured, projection, observed, required, level }, lineage });

  return reason(combinedStatus, [], assessmentBasisCodes, {
    observed_pace: {
      status: measured.status,
      evidence_reason_codes: [],
      assessment_basis_codes: measured.reasons,
      mode,
      unit: paceUnit,
      interval: observed,
      observation_count: points.length,
      start_year: points[0].year,
      end_year: latest.year,
      evidence_plane: observedSeries.evidence_plane,
      fact_ids: observedFactIds
    },
    required_pace: {
      mode,
      unit: paceUnit,
      interval: required,
      start_year: latest.year,
      target_year: endpoint.normalized_endpoint.year
    },
    level_comparison: level,
    policy_projection: projection,
    illustrative_required_path: illustrativePath,
    lineage
  });
}

module.exports = {
  FORMULA_VERSION,
  METHODOLOGY_VERSION,
  EVIDENCE_REASON_CODES,
  ASSESSMENT_BASIS_CODES,
  assessDelivery,
  stable,
  hash
};
