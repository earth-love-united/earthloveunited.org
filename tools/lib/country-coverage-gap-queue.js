'use strict';

const crypto = require('node:crypto');

const COMPILER_VERSION = '1.0.0';
const DOMAINS = Object.freeze([
  'identity', 'harmonized_emissions', 'official_inventory', 'active_ndc_target',
  'target_comparability', 'policy_projection', 'finance',
  'ambition_assessment', 'delivery', 'profile_review'
]);
const ROUTE_TYPES = Object.freeze([
  'official_unfccc_national_discovery',
  'harmonized_source_gap_investigation',
  'identity_status_review',
  'licence_review',
  'independent_interpretation_review'
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isUtc(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function nullDomain(state, reasons, acquisitionRequired = true) {
  return {
    state,
    review_status: 'not_reviewed',
    value: null,
    fact_ids: [],
    source_ids: [],
    reason_codes: sorted(reasons),
    acquisition_required: acquisitionRequired
  };
}

function identityDomain(entity, registry) {
  return {
    state: 'available',
    review_status: 'reviewed_source_registry',
    value: {
      country_id: entity.country_id,
      iso_alpha2: entity.iso_alpha2,
      iso_alpha3: entity.iso_alpha3,
      iso_numeric: entity.iso_numeric,
      name: entity.name,
      official_name: entity.official_name,
      common_name: entity.common_name
    },
    fact_ids: [],
    source_ids: [registry.source.source_registry_id],
    reason_codes: [],
    acquisition_required: false
  };
}

function overlaySnapshot(entity) {
  const claims = {
    region: entity.region,
    subregion: entity.subregion,
    un_membership: entity.un_membership,
    unfccc_party: entity.unfccc_party,
    territory_status: entity.territory_status,
    geometry: entity.geometry,
    ldc: entity.groups && entity.groups.ldc,
    lldc: entity.groups && entity.groups.lldc,
    sids: entity.groups && entity.groups.sids
  };
  Object.entries(claims).forEach(([name, claim]) => {
    assert(claim && claim.status === 'not_reviewed' && claim.value === null && claim.source_id === null,
      `${entity.country_id}.${name} must remain null/not_reviewed`);
  });
  assert(entity.assessment_eligibility && entity.assessment_eligibility.status === 'not_reviewed' &&
    entity.assessment_eligibility.eligible === null && entity.assessment_eligibility.source_id === null,
    `${entity.country_id}.assessment_eligibility must remain null/not_reviewed`);
  return {
    region: stable(claims.region), subregion: stable(claims.subregion),
    un_membership: stable(claims.un_membership), unfccc_party: stable(claims.unfccc_party),
    territory_status: stable(claims.territory_status), geometry: stable(claims.geometry),
    groups: { ldc: stable(claims.ldc), lldc: stable(claims.lldc), sids: stable(claims.sids) },
    assessment_eligibility: stable(entity.assessment_eligibility)
  };
}

function sourceCandidates(domain, registry, primap) {
  if (domain === 'identity') return [{
    source_id: registry.source.source_registry_id,
    title: registry.source.title,
    url: registry.source.source_url,
    status: 'approved_identity_source',
    metadata_only: true
  }];
  if (domain === 'harmonized_emissions') return [{
    source_id: primap.source.source_registry_id,
    title: primap.source.title,
    url: primap.source.doi_url,
    status: 'approved_candidate_source_not_independently_reviewed',
    metadata_only: true
  }];
  if (domain === 'active_ndc_target') return [{
    source_id: 'unfccc-ndc-registry-discovery-candidate',
    title: 'UNFCCC NDC Registry',
    url: 'https://unfccc.int/NDCREG',
    status: 'metadata_only_unreviewed_candidate',
    metadata_only: true
  }];
  return [];
}

function routeTypes(domain, hasPrimapCandidate) {
  if (domain === 'identity') return ['identity_status_review'];
  if (domain === 'harmonized_emissions') return hasPrimapCandidate
    ? ['independent_interpretation_review']
    : ['harmonized_source_gap_investigation', 'licence_review', 'independent_interpretation_review'];
  if (domain === 'official_inventory' || domain === 'active_ndc_target') {
    return ['official_unfccc_national_discovery', 'licence_review', 'independent_interpretation_review'];
  }
  if (domain === 'policy_projection' || domain === 'finance' || domain === 'ambition_assessment') {
    return ['licence_review', 'independent_interpretation_review'];
  }
  return ['independent_interpretation_review'];
}

function priorityBand(domain) {
  if (domain === 'identity') return 'mapped_visibility_and_status';
  if (['harmonized_emissions', 'official_inventory', 'active_ndc_target'].includes(domain)) return 'critical_evidence_coverage';
  return 'dependent_assessment_coverage';
}

function taskFor(entity, domain, domainRecord, registry, primap, hasPrimapCandidate) {
  return {
    task_id: `coverage:${entity.iso_alpha3}:${domain}`,
    country_id: entity.country_id,
    domain,
    priority_band: priorityBand(domain),
    priority_basis: 'mapped visibility and missing critical evidence only',
    state: domain === 'identity' ? 'status_overlays_not_reviewed' : domainRecord.state,
    route_types: routeTypes(domain, hasPrimapCandidate),
    reason_codes: domain === 'identity'
      ? ['assessment_eligibility_not_reviewed', 'membership_not_reviewed', 'party_status_not_reviewed', 'territory_status_not_reviewed']
      : domainRecord.reason_codes,
    source_candidates: sourceCandidates(domain, registry, primap),
    fact_ids: [],
    value: null,
    claims_copied: false,
    performance_priority_used: false,
    score_or_rank_assigned: false
  };
}

function compileCoverageQueue(registry, primap, release, generatedAt) {
  assert(registry && registry.entity_count === 249 && registry.entities.length === 249, 'CT-02 registry must contain 249 entities');
  assert(primap && primap.series && primap.registry_coverage, 'CT-10B PRIMAP artifact is required');
  assert(release && release.coverage, 'CT-10B release manifest is required');
  assert(isUtc(generatedAt), 'generated_at must be a valid UTC timestamp');
  assert(primap.review.status === 'not_reviewed', 'PRIMAP artifact must remain not_reviewed');
  assert(release.coverage.mapped_candidates === 206 && release.coverage.registry_gaps === 43, 'PRIMAP release coverage must be 206/43');

  const coverageByCountry = new Map(primap.registry_coverage.map(item => [item.country_id, item]));
  const seriesByCountry = new Map(primap.series.map(item => [item.country_id, item]));
  assert(coverageByCountry.size === 249 && seriesByCountry.size === 206, 'PRIMAP country coverage dimensions are invalid');
  const matrix = [];
  const queue = [];

  [...registry.entities].sort((a, b) => a.country_id.localeCompare(b.country_id)).forEach(entity => {
    const coverage = coverageByCountry.get(entity.country_id);
    assert(coverage, `${entity.country_id} missing PRIMAP coverage row`);
    const series = seriesByCountry.get(entity.country_id) || null;
    const hasCandidate = Boolean(series);
    assert(hasCandidate === (coverage.state === 'not_reviewed'), `${entity.country_id} PRIMAP state/series mismatch`);
    const harmonized = hasCandidate
      ? nullDomain('not_reviewed', ['climate_evidence_not_reviewed', 'independent_review_required'])
      : nullDomain('source_unavailable', ['source_missing', 'source_unavailable']);
    harmonized.source_ids = hasCandidate ? [primap.source.source_registry_id] : [];
    harmonized.candidate = hasCandidate ? {
      series_id: series.series_id,
      period: stable(primap.selection.period),
      source_id: primap.source.source_registry_id,
      value_count: series.values.length,
      values_published_to_profile: false
    } : null;

    const domains = {
      identity: identityDomain(entity, registry),
      harmonized_emissions: harmonized,
      official_inventory: nullDomain('source_missing', ['source_missing', 'source_not_reviewed']),
      active_ndc_target: nullDomain('source_missing', ['source_missing', 'source_not_reviewed']),
      target_comparability: nullDomain('not_reviewed', ['climate_evidence_not_reviewed', 'assessment_eligibility_not_reviewed']),
      policy_projection: nullDomain('source_missing', ['source_missing', 'source_not_reviewed']),
      finance: nullDomain('source_missing', ['source_missing', 'source_not_reviewed']),
      ambition_assessment: nullDomain('not_reviewed', ['climate_evidence_not_reviewed', 'independent_review_required']),
      delivery: nullDomain('not_reviewed', ['climate_evidence_not_reviewed', 'evidence_insufficient']),
      profile_review: nullDomain('not_reviewed', ['climate_evidence_not_reviewed', 'independent_review_required'])
    };
    assert(JSON.stringify(Object.keys(domains)) === JSON.stringify(DOMAINS), `${entity.country_id} domain order drift`);
    matrix.push({
      country_id: entity.country_id,
      iso_alpha3: entity.iso_alpha3,
      identity_label: entity.name,
      status_overlays: overlaySnapshot(entity),
      domains,
      performance_status: null,
      score: null,
      rank: null
    });
    DOMAINS.forEach(domain => {
      if (domain === 'identity' || domains[domain].acquisition_required) {
        queue.push(taskFor(entity, domain, domains[domain], registry, primap, hasCandidate));
      }
    });
  });

  const priorityOrder = new Map([
    ['mapped_visibility_and_status', 0], ['critical_evidence_coverage', 1], ['dependent_assessment_coverage', 2]
  ]);
  queue.sort((a, b) => priorityOrder.get(a.priority_band) - priorityOrder.get(b.priority_band) ||
    a.domain.localeCompare(b.domain) || a.country_id.localeCompare(b.country_id));
  queue.forEach((task, index) => { task.queue_sequence = index + 1; });

  const output = {
    schema_version: '1.0.0',
    artifact_id: 'country-climate-coverage-gap-queue-2026-07-15',
    compiler_version: COMPILER_VERSION,
    generated_at: generatedAt,
    inputs: {
      registry_release_id: registry.data_release_id,
      registry_rows_hash: registry.source.normalized_rows_checksum_sha256,
      primap_artifact_id: primap.artifact_id,
      primap_calculation_hash: primap.calculation_hash,
      primap_release_id: release.release_id,
      primap_release_calculation_hash: release.calculation_hash
    },
    domains: DOMAINS.slice(),
    acquisition_route_types: ROUTE_TYPES.slice(),
    priority_policy: {
      type: 'evidence_coverage_only',
      bands: ['mapped_visibility_and_status', 'critical_evidence_coverage', 'dependent_assessment_coverage'],
      high_impact_priority_allowed: false,
      missing_target_or_data_is_positive: false,
      performance_used: false,
      score_used: false,
      rank_used: false,
      explanation: 'Queue order reflects mapped visibility and missing critical evidence only. Impact priority is prohibited until emissions facts are independently reviewed.'
    },
    source_candidate_policy: {
      metadata_only: true,
      copied_claims_allowed: false,
      approval_or_review_required_before_use: true
    },
    counts: {
      registry_entities: matrix.length,
      primap_candidates_not_reviewed: matrix.filter(row => row.domains.harmonized_emissions.state === 'not_reviewed').length,
      primap_source_gaps: matrix.filter(row => row.domains.harmonized_emissions.state === 'source_unavailable').length,
      reviewed_harmonized_emissions: 0,
      reviewed_active_targets: 0,
      reviewed_profiles: 0,
      queue_tasks: queue.length,
      mapped_visibility_and_status_tasks: queue.filter(task => task.priority_band === 'mapped_visibility_and_status').length,
      critical_evidence_coverage_tasks: queue.filter(task => task.priority_band === 'critical_evidence_coverage').length,
      dependent_assessment_coverage_tasks: queue.filter(task => task.priority_band === 'dependent_assessment_coverage').length
    },
    matrix,
    queue,
    forbidden_outputs: {
      performance_assigned: false,
      impact_priority_assigned: false,
      missing_data_rewarded: false,
      score_assigned: false,
      rank_assigned: false,
      inferred_status_overlay: false
    },
    calculation_hash: null
  };
  output.calculation_hash = hash(Object.assign({}, output, { calculation_hash: null }));
  return output;
}

module.exports = { COMPILER_VERSION, DOMAINS, ROUTE_TYPES, compileCoverageQueue, hash, stable };
