'use strict';

const crypto = require('node:crypto');

const COMPILER_VERSION = '1.0.0';
const METHODOLOGY_VERSION = '0.1.0';
const SECTION_ORDER = Object.freeze([
  'responsibility', 'commitment', 'ambition', 'delivery', 'evidence',
  'projects_markets'
]);
const PLANES = new Set(['official', 'harmonized', 'independent', 'context', 'derived']);
const MEASURED_PLANES = new Set(['official', 'harmonized']);
const MEASURED_STATES = new Set(['available', 'estimated']);
const TARGET_CONDITIONS = new Set(['unconditional', 'conditional', 'combined', 'not_stated']);
const SYNTHETIC_ROLES = new Set([
  'scenario_projection_only', 'illustrative_required_path', 'project_outcome',
  'market_credit', 'synthetic', 'modeled'
]);

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

function isUtc(value) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function finite(value, label) {
  assert(typeof value === 'number' && Number.isFinite(value), `${label} must be a finite number`);
  return value;
}

function text(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} is required`);
  return value;
}

function factId(value, label) {
  assert(typeof value === 'string' && value.startsWith('fact:'), `${label} must be a fact ID`);
  return value;
}

function preserveQuantity(value, label) {
  assert(value && typeof value === 'object', `${label} is required`);
  assert(['exact', 'range'].includes(value.kind), `${label}.kind is invalid`);
  text(value.unit, `${label}.unit`);
  if (value.kind === 'exact') return { kind: 'exact', amount: finite(value.amount, `${label}.amount`), unit: value.unit };
  const lower = finite(value.lower, `${label}.lower`);
  const upper = finite(value.upper, `${label}.upper`);
  assert(lower <= upper, `${label} range is inverted`);
  return { kind: 'range', lower, upper, unit: value.unit };
}

function preserveUncertainty(value, label) {
  if (value === null || value === undefined) return null;
  assert(value && typeof value === 'object', `${label} must be an object or null`);
  const lower = finite(value.lower, `${label}.lower`);
  const upper = finite(value.upper, `${label}.upper`);
  assert(lower <= upper, `${label} range is inverted`);
  return {
    lower,
    upper,
    confidence: value.confidence === null || value.confidence === undefined
      ? null : finite(value.confidence, `${label}.confidence`),
    method: value.method || null
  };
}

function preserveScope(scope, label) {
  assert(scope && typeof scope === 'object' && !Array.isArray(scope), `${label} is required`);
  const gases = sorted(scope.gases);
  const sectors = sorted(scope.sectors);
  assert(gases.length > 0, `${label}.gases are required`);
  assert(sectors.length > 0, `${label}.sectors are required`);
  return {
    accounting_frame: text(scope.accounting_frame, `${label}.accounting_frame`),
    gases,
    sectors,
    geography: text(scope.geography, `${label}.geography`),
    lulucf: text(scope.lulucf, `${label}.lulucf`),
    gwp_convention: scope.gwp_convention === undefined ? null : scope.gwp_convention
  };
}

function reviewedAt(review, label) {
  assert(review && review.status === 'reviewed' && review.reviewer_id, `${label} must be reviewed`);
  assert(isUtc(review.reviewed_at), `${label}.reviewed_at must be a UTC timestamp`);
  return review.reviewed_at;
}

function compileObservationSeries(series, countryId) {
  assert(series && typeof series === 'object', 'observation series must be an object');
  text(series.series_id, 'observation series_id');
  assert(series.country_id === countryId, `${series.series_id} country mismatch`);
  assert(series.data_role === 'observed_annual', `${series.series_id} must have observed_annual role`);
  assert(series.is_observation === true, `${series.series_id} must explicitly be an observation`);
  assert(!SYNTHETIC_ROLES.has(series.data_role), `${series.series_id} synthetic role rejected`);
  assert(series.source_kind !== 'project_market' && series.source_kind !== 'project', `${series.series_id} project data rejected`);
  assert(MEASURED_PLANES.has(series.evidence_plane), `${series.series_id} plane is not measured evidence`);
  assert(MEASURED_STATES.has(series.state), `${series.series_id} state is not chartable measured evidence`);
  text(series.metric, `${series.series_id}.metric`);
  text(series.unit, `${series.series_id}.unit`);
  const scope = preserveScope(series.scope, `${series.series_id}.scope`);
  const seriesReviewDate = reviewedAt(series.review, `${series.series_id}.review`);
  const sourceIds = sorted(series.source_ids);
  assert(sourceIds.length > 0, `${series.series_id} requires source IDs`);
  assert(Array.isArray(series.points) && series.points.length > 0, `${series.series_id} requires annual points`);
  const years = new Set();
  const points = series.points.map((point, index) => {
    assert(point && typeof point === 'object', `${series.series_id}.points[${index}] is invalid`);
    assert(!point.data_role || point.data_role === 'observed_annual', `${series.series_id}.points[${index}] synthetic point rejected`);
    assert(point.is_observation !== false, `${series.series_id}.points[${index}] non-observation rejected`);
    assert(Number.isInteger(point.year), `${series.series_id}.points[${index}].year must be an integer`);
    assert(!years.has(point.year), `${series.series_id} has duplicate year ${point.year}`);
    years.add(point.year);
    return {
      year: point.year,
      value: finite(point.value, `${series.series_id}.points[${index}].value`),
      unit: series.unit,
      uncertainty: preserveUncertainty(point.uncertainty, `${series.series_id}.points[${index}].uncertainty`),
      fact_id: factId(point.fact_id, `${series.series_id}.points[${index}].fact_id`),
      source_ids: sorted(point.source_ids && point.source_ids.length ? point.source_ids : sourceIds),
      reviewed_at: point.review ? reviewedAt(point.review, `${series.series_id}.points[${index}].review`) : seriesReviewDate
    };
  }).sort((a, b) => a.year - b.year || a.fact_id.localeCompare(b.fact_id));
  return {
    series_id: series.series_id,
    metric: series.metric,
    unit: series.unit,
    scope,
    evidence_plane: series.evidence_plane,
    evidence_state: series.state,
    source_ids: sourceIds,
    fact_ids: sorted(points.map(point => point.fact_id)),
    reviewed_at: seriesReviewDate,
    points
  };
}

function compileTargetEndpoint(target, countryId) {
  assert(target && typeof target === 'object', 'target result must be an object');
  if (target.country_id !== countryId) throw new Error(`${target.target_id || 'target'} country mismatch`);
  if (target.comparability !== 'comparable' || target.eligible !== true || !target.normalized_endpoint) return null;
  assert(target.independent_review && target.independent_review.passed === true, `${target.target_id} review gate failed`);
  const reviewDate = reviewedAt(target.independent_review, `${target.target_id}.independent_review`);
  assert(TARGET_CONDITIONS.has(target.condition), `${target.target_id}.condition is invalid`);
  assert(Number.isInteger(target.normalized_endpoint.year), `${target.target_id} endpoint year is invalid`);
  const quantity = preserveQuantity(target.normalized_endpoint.value, `${target.target_id}.normalized_endpoint.value`);
  assert(target.normalized_endpoint.condition === target.condition, `${target.target_id} endpoint condition mismatch`);
  const targetFactIds = sorted([
    ...(target.input_fact_ids || []),
    ...((target.lineage && target.lineage.target_source_fact_ids) || []),
    ...((target.lineage && target.lineage.reviewed_against_fact_ids) || [])
  ]).map((id, index) => factId(id, `${target.target_id}.fact_ids[${index}]`));
  assert(targetFactIds.length > 0, `${target.target_id} requires fact lineage`);
  return {
    target_id: text(target.target_id, 'target_id'),
    target_type: target.target_type || null,
    condition: target.condition,
    year: target.normalized_endpoint.year,
    value: quantity,
    scope: preserveScope(target.accounting_frame, `${target.target_id}.accounting_frame`),
    evidence_plane: 'official',
    fact_ids: targetFactIds,
    reviewed_at: reviewDate
  };
}

function compileProjection(projection, countryId) {
  assert(projection && projection.country_id === countryId, `${projection && projection.projection_id || 'projection'} country mismatch`);
  assert(projection.data_role === 'scenario_projection_only', `${projection.projection_id} must remain scenario-only`);
  assert(projection.is_observation === false, `${projection.projection_id} cannot be an observation`);
  assert(PLANES.has(projection.evidence_plane), `${projection.projection_id} plane is invalid`);
  const reviewDate = reviewedAt(projection.review, `${projection.projection_id}.review`);
  const sourceIds = sorted(projection.source_ids);
  const factIds = sorted(projection.fact_ids || projection.input_fact_ids || projection.source_fact_ids);
  factIds.forEach((id, index) => factId(id, `${projection.projection_id}.fact_ids[${index}]`));
  assert(sourceIds.length > 0, `${projection.projection_id} requires source IDs`);
  assert(factIds.length > 0, `${projection.projection_id} requires fact IDs`);
  const projectionYears = new Set();
  return {
    projection_id: text(projection.projection_id, 'projection_id'),
    data_role: 'scenario_projection_only',
    is_observation: false,
    label: projection.label || 'Scenario projection',
    scenario_name: projection.scenario && projection.scenario.name || null,
    scenario_vintage: projection.scenario && projection.scenario.vintage || null,
    unit: text(projection.unit, `${projection.projection_id}.unit`),
    scope: preserveScope(projection.scope, `${projection.projection_id}.scope`),
    evidence_plane: projection.evidence_plane,
    source_ids: sourceIds,
    fact_ids: factIds,
    reviewed_at: reviewDate,
    points: (projection.points || []).map((point, index) => {
      assert(Number.isInteger(point.year), `${projection.projection_id}.points[${index}].year is invalid`);
      assert(!projectionYears.has(point.year), `${projection.projection_id} has duplicate year ${point.year}`);
      projectionYears.add(point.year);
      return {
        year: point.year,
        value: finite(point.value, `${projection.projection_id}.points[${index}].value`),
        unit: projection.unit,
        uncertainty: preserveUncertainty(point.uncertainty, `${projection.projection_id}.points[${index}].uncertainty`)
      };
    }).sort((a, b) => a.year - b.year)
  };
}

function compileRequiredPath(delivery, comparableTargets) {
  if (!delivery || !delivery.illustrative_required_path) return null;
  if (!comparableTargets.length || delivery.status === 'not_assessed') return null;
  const path = delivery.illustrative_required_path;
  assert(path.data_role === 'illustrative_required_path' && path.is_observation === false,
    'required pathway must be explicitly non-observational CT-21 output');
  assert(delivery.lineage && delivery.lineage.calculation_hash, 'required pathway requires CT-21 lineage');
  const pathFactIds = sorted(delivery.lineage.input_fact_ids);
  pathFactIds.forEach((id, index) => factId(id, `required pathway fact_ids[${index}]`));
  assert(pathFactIds.length > 0, 'required pathway requires fact lineage');
  const matched = comparableTargets.find(target => target.year === path.target_year &&
    target.value.unit === path.unit && (target.value.kind === 'exact'
      ? target.value.amount === path.target_value
      : target.value.lower <= path.target_value && path.target_value <= target.value.upper));
  assert(matched, 'required pathway does not match a comparable target endpoint');
  return {
    data_role: 'illustrative_required_path',
    is_observation: false,
    label: path.label || 'Illustrative required pathway',
    interpolation: text(path.interpolation, 'required pathway interpolation'),
    unit: text(path.unit, 'required pathway unit'),
    target_id: matched.target_id,
    condition: matched.condition,
    points: [
      { year: path.start_year, value: finite(path.start_value, 'required pathway start_value') },
      { year: path.target_year, value: finite(path.target_value, 'required pathway target_value') }
    ],
    fact_ids: pathFactIds,
    lineage_hash: delivery.lineage.calculation_hash
  };
}

function conflictSummary(series) {
  const groups = new Map();
  series.forEach(item => item.points.forEach(point => {
    const key = JSON.stringify([item.metric, item.unit, item.scope, point.year]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ plane: item.evidence_plane, value: point.value, fact_id: point.fact_id });
  }));
  return [...groups.entries()].flatMap(([key, entries]) => {
    const values = new Set(entries.map(item => item.value));
    const planes = new Set(entries.map(item => item.plane));
    if (values.size < 2 || planes.size < 2) return [];
    const parsed = JSON.parse(key);
    return [{
      metric: parsed[0], unit: parsed[1], scope: parsed[2], year: parsed[3],
      reason_code: 'unresolved_source_conflict', entries
    }];
  }).sort((a, b) => a.year - b.year || a.metric.localeCompare(b.metric));
}

function axis(profile, name, fallbackStatus) {
  const value = profile && profile.axes && profile.axes[name];
  return value || {
    status: fallbackStatus,
    availability: 'not_assessed',
    evidence_reason_codes: ['evidence_insufficient'],
    assessment_basis_codes: [], fact_ids: [], method_id: null,
    methodology_version: null, value: null, lineage: null
  };
}

function assertUnique(items, field, label) {
  const seen = new Set();
  items.forEach(item => {
    assert(!seen.has(item[field]), `${label} contains duplicate ${item[field]}`);
    seen.add(item[field]);
  });
}

function compileCard(input) {
  assert(input && typeof input === 'object', 'card input is required');
  assert(/^iso3166-1:[A-Z]{3}$/.test(input.country_id || ''), 'valid country_id is required');
  assert(isUtc(input.generated_at), 'caller-supplied generated_at must be a UTC timestamp');
  text(input.data_release_id, 'data_release_id');
  const profile = input.profile || {};
  assert(!profile.country_id || profile.country_id === input.country_id, 'profile country mismatch');

  const impact = axis(profile, 'impact', 'not_assessed');
  const target = axis(profile, 'target_integrity', 'not_assessed');
  const ambition = axis(profile, 'ambition', 'not_assessed');
  const delivery = axis(profile, 'delivery', 'not_assessed');
  const evidence = axis(profile, 'evidence_quality', 'D');

  const measured = (input.observation_series || []).map(series => compileObservationSeries(series, input.country_id))
    .sort((a, b) => a.metric.localeCompare(b.metric) || a.evidence_plane.localeCompare(b.evidence_plane) || a.series_id.localeCompare(b.series_id));
  const compiledEndpoints = (input.target_results || []).map(item => compileTargetEndpoint(item, input.country_id)).filter(Boolean)
    .sort((a, b) => a.year - b.year || a.condition.localeCompare(b.condition) || a.target_id.localeCompare(b.target_id));
  const endpoints = target.status === 'comparable' && target.availability === 'available' ? compiledEndpoints : [];
  const projections = (input.scenario_projections || []).map(item => compileProjection(item, input.country_id))
    .sort((a, b) => a.projection_id.localeCompare(b.projection_id));
  assertUnique(measured, 'series_id', 'measured series');
  assertUnique(endpoints, 'target_id', 'target endpoints');
  assertUnique(projections, 'projection_id', 'scenario projections');
  const deliveryEligible = delivery.availability === 'available' && delivery.status !== 'not_assessed';
  const requiredPath = compileRequiredPath(deliveryEligible ? input.delivery_result : null, endpoints);
  const conflicts = conflictSummary(measured);

  const latest = measured.flatMap(series => series.points.map(point => ({ series, point })))
    .sort((a, b) => b.point.year - a.point.year || a.series.series_id.localeCompare(b.series.series_id))[0] || null;
  const allFactIds = sorted([
    ...measured.flatMap(series => series.fact_ids),
    ...endpoints.flatMap(item => item.fact_ids),
    ...projections.flatMap(item => item.fact_ids),
    ...Object.values(profile.axes || {}).flatMap(item => item.fact_ids || [])
  ]);
  const allSourceIds = sorted([
    ...measured.flatMap(series => series.source_ids),
    ...projections.flatMap(item => item.source_ids)
  ]);
  const reviewDates = sorted([
    ...measured.map(series => series.reviewed_at),
    ...endpoints.map(item => item.reviewed_at),
    ...projections.map(item => item.reviewed_at)
  ]);
  const reasons = sorted([
    ...Object.values(profile.axes || {}).flatMap(item => item.evidence_reason_codes || []),
    ...conflicts.map(item => item.reason_code)
  ]);
  const title = `${input.entity_label || input.country_id} climate evidence`;
  const description = 'Measured annual observations, comparable target endpoints, and non-observational pathways are shown as separate evidence layers.';
  const summaryParts = [
    `${measured.length} measured series`,
    `${endpoints.length} comparable target endpoint${endpoints.length === 1 ? '' : 's'}`,
    requiredPath ? 'one illustrative required pathway' : 'no illustrative required pathway',
    `${projections.length} separate scenario projection${projections.length === 1 ? '' : 's'}`
  ];
  if (conflicts.length) summaryParts.push(`${conflicts.length} unresolved cross-plane conflict${conflicts.length === 1 ? '' : 's'}`);

  const output = {
    schema_version: '1.0.0',
    compiler_version: COMPILER_VERSION,
    methodology_version: METHODOLOGY_VERSION,
    country_id: input.country_id,
    entity_label: input.entity_label || null,
    data_release_id: input.data_release_id,
    generated_at: input.generated_at,
    section_order: SECTION_ORDER.slice(),
    composite_score: null,
    sections: {
      responsibility: {
        status: impact.status,
        availability: impact.availability,
        latest_measured: latest ? {
          year: latest.point.year, value: latest.point.value, unit: latest.point.unit,
          scope: latest.series.scope, evidence_plane: latest.series.evidence_plane,
          fact_id: latest.point.fact_id, source_ids: latest.point.source_ids,
          reviewed_at: latest.point.reviewed_at, uncertainty: latest.point.uncertainty
        } : null,
        evidence_reason_codes: sorted(impact.evidence_reason_codes),
        fact_ids: sorted(impact.fact_ids)
      },
      commitment: {
        status: target.status,
        availability: target.availability,
        target_endpoints: endpoints,
        evidence_reason_codes: sorted(target.evidence_reason_codes),
        fact_ids: sorted(target.fact_ids)
      },
      ambition: {
        status: ambition.status,
        availability: ambition.availability,
        evidence_reason_codes: sorted(ambition.evidence_reason_codes),
        fact_ids: sorted(ambition.fact_ids),
        method_id: ambition.method_id || null,
        methodology_version: ambition.methodology_version || null
      },
      delivery: {
        status: delivery.status,
        availability: delivery.availability,
        evidence_reason_codes: sorted(delivery.evidence_reason_codes),
        assessment_basis_codes: sorted(delivery.assessment_basis_codes),
        fact_ids: sorted(delivery.fact_ids),
        illustrative_required_path: requiredPath,
        scenario_projections: projections
      },
      evidence: {
        grade: evidence.status,
        availability: evidence.availability,
        evidence_reason_codes: reasons,
        fact_ids: allFactIds,
        source_ids: allSourceIds,
        review_dates: reviewDates,
        conflicts
      },
      projects_markets: {
        heading: 'Projects and markets',
        disclaimer: 'Not part of the national climate performance profile',
        affects_profile: false,
        state: input.projects_markets && input.projects_markets.state || 'not_assessed',
        items: input.projects_markets && Array.isArray(input.projects_markets.items)
          ? input.projects_markets.items.map(item => stable(item)) : []
      }
    },
    chart: {
      measured_series: measured,
      comparable_target_endpoints: endpoints,
      illustrative_required_path: requiredPath,
      scenario_projections: projections,
      accessible: {
        title,
        description,
        text_summary: `${title}. ${summaryParts.join('. ')}.`
      }
    },
    provenance: {
      fact_ids: allFactIds,
      source_ids: allSourceIds,
      review_dates: reviewDates,
      profile_calculation_hash: profile.calculation_hash || null
    },
    calculation_hash: null
  };
  output.calculation_hash = hash(Object.assign({}, output, { calculation_hash: null }));
  return output;
}

module.exports = {
  COMPILER_VERSION,
  METHODOLOGY_VERSION,
  SECTION_ORDER,
  compileCard,
  hash,
  stable
};
