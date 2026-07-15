'use strict';

const crypto = require('node:crypto');

const SCHEMA_VERSION = '1.1.0';
const ROUTING_MODEL_VERSION = '2.1.0';
const CREATED_AT = '2026-07-15T14:00:00Z';
const POLICY_ID = 'ct-16-source-routing-policy-v2-2026-07-15';
const QUEUE_ID = 'ct-16-top20-source-routing-queue-v2-2026-07-15';

const SOURCE_IDS = Object.freeze({
  nir: 'unfccc-nir-crt-2026-cycle',
  btr: 'unfccc-btr-continuous-2026-07-15',
  ter: 'unfccc-ter-continuous-2026-07-15',
  ndc: 'unfccc-ndc-registry-continuous-2026-07-15',
});

const ROUTE_IDS = Object.freeze({
  nir: 'official-inventory:nir-crt:primary',
  btr: 'official-inventory:btr-component:conditional-primary',
  ter: 'official-inventory:ter:corroboration-only',
  ndc: 'active-ndc:ndc-registry:primary-document',
  target: 'target-methodology:ndc-registry:primary-document',
});

const REASON_CODES = Object.freeze([
  'source_rights_pending',
  'source_governance_pending',
  'source_role_domain_mismatch',
  'explicit_component_identity_missing',
  'document_checksum_missing',
  'independent_review_missing',
  'primary_value_source_missing',
  'corroboration_not_primary',
  'normalized_values_not_authorized',
  'scoring_not_authorized',
  'release_not_authorized',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function hashJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function unique(values) {
  return [...new Set(values)].sort();
}

function sourceMap(registry) {
  return new Map(registry.sources.map(source => [source.id, source]));
}

function requireSource(sources, id) {
  const source = sources.get(id);
  assert(source, `source registry missing ${id}`);
  return source;
}

function assertPendingMetadataOnly(source) {
  assert(source.approval?.state === 'pending', `${source.id} must remain pending`);
  assert(source.redistribution?.status === 'metadata_only', `${source.id} must remain metadata-only`);
  assert(source.redistribution?.normalized_values === false, `${source.id} normalized values must remain blocked`);
}

function currentGate(source, state, domainPresent) {
  return {
    state,
    registry_domain_present: domainPresent,
    registry_approval_state: source.approval.state,
    registry_redistribution_state: source.redistribution.status,
    registry_normalized_values_allowed: source.redistribution.normalized_values,
    governance_decision_id: null,
    rights_decision_id: null,
    independent_review_id: null,
    normalized_fact_eligible: false,
    scoring_eligible: false,
  };
}

function route({
  routeId,
  evidenceRole,
  source,
  sourceRole,
  requiredDomain,
  sufficiency,
  state,
  reasons,
  explicitComponent,
  prohibitedEvidenceRoles = [],
}) {
  const domainPresent = source.domains.includes(requiredDomain);
  return {
    route_id: routeId,
    evidence_role: evidenceRole,
    source_registry_id: source.id,
    source_role: sourceRole,
    required_registry_domain: requiredDomain,
    structural_sufficiency: sufficiency,
    family_level_inventory_authorization: false,
    explicit_component: explicitComponent,
    prohibited_evidence_roles: prohibitedEvidenceRoles,
    current_gate: currentGate(source, state, domainPresent),
    reason_codes: unique(reasons),
  };
}

function compilePolicy(sourceRegistry, inputPins, publicationBoundary) {
  assert(publicationBoundary?.state === 'eligible_unchanged' && publicationBoundary.factual_facts === 2060, 'CT-15 factual publication boundary is absent');
  const sources = sourceMap(sourceRegistry);
  const nir = requireSource(sources, SOURCE_IDS.nir);
  const btr = requireSource(sources, SOURCE_IDS.btr);
  const ter = requireSource(sources, SOURCE_IDS.ter);
  const ndc = requireSource(sources, SOURCE_IDS.ndc);

  [nir, btr, ter, ndc].forEach(assertPendingMetadataOnly);
  assert(nir.domains.includes('official_inventory'), 'NIR/CRT must retain official_inventory domain');
  assert(!btr.domains.includes('official_inventory'), 'current BTR snapshot must retain the unresolved official_inventory domain gap');
  assert(ter.domains.includes('official_inventory'), 'TER must retain its corroborating official_inventory domain');
  assert(ndc.domains.includes('ndc_target'), 'NDC Registry must retain ndc_target domain');
  assert(!ndc.domains.includes('official_inventory'), 'NDC Registry must not route to official_inventory');

  const routes = [
    route({
      routeId: ROUTE_IDS.nir,
      evidenceRole: 'official_inventory',
      source: nir,
      sourceRole: 'primary_value_source',
      requiredDomain: 'official_inventory',
      sufficiency: 'primary_only_after_all_gates',
      state: 'blocked_pending_rights_and_review',
      reasons: ['source_rights_pending', 'source_governance_pending', 'document_checksum_missing', 'independent_review_missing', 'normalized_values_not_authorized', 'scoring_not_authorized'],
      explicitComponent: {
        required: false,
        permitted_types: [],
        component_id: null,
        document_checksum_sha256: null,
      },
    }),
    route({
      routeId: ROUTE_IDS.btr,
      evidenceRole: 'official_inventory',
      source: btr,
      sourceRole: 'conditional_primary_component',
      requiredDomain: 'official_inventory',
      sufficiency: 'primary_only_for_explicit_governance_approved_component',
      state: 'blocked_role_domain_mismatch',
      reasons: ['source_role_domain_mismatch', 'source_rights_pending', 'source_governance_pending', 'explicit_component_identity_missing', 'document_checksum_missing', 'independent_review_missing', 'normalized_values_not_authorized', 'scoring_not_authorized'],
      explicitComponent: {
        required: true,
        permitted_types: ['ctf_inventory_table', 'inventory_chapter', 'national_inventory_document'],
        component_id: null,
        document_checksum_sha256: null,
      },
    }),
    route({
      routeId: ROUTE_IDS.ter,
      evidenceRole: 'official_inventory_corroboration',
      source: ter,
      sourceRole: 'corroboration_only',
      requiredDomain: 'official_inventory',
      sufficiency: 'never_sufficient_as_primary_value_source',
      state: 'blocked_normalized_findings_pending',
      reasons: ['source_rights_pending', 'source_governance_pending', 'independent_review_missing', 'corroboration_not_primary', 'primary_value_source_missing', 'normalized_values_not_authorized', 'scoring_not_authorized'],
      explicitComponent: {
        required: false,
        permitted_types: ['technical_expert_review_report'],
        component_id: null,
        document_checksum_sha256: null,
      },
    }),
    route({
      routeId: ROUTE_IDS.ndc,
      evidenceRole: 'active_ndc',
      source: ndc,
      sourceRole: 'primary_document_source',
      requiredDomain: 'ndc_target',
      sufficiency: 'primary_only_after_all_gates',
      state: 'blocked_pending_rights_and_review',
      reasons: ['source_rights_pending', 'source_governance_pending', 'document_checksum_missing', 'independent_review_missing', 'normalized_values_not_authorized', 'scoring_not_authorized'],
      explicitComponent: {
        required: true,
        permitted_types: ['active_party_ndc'],
        component_id: null,
        document_checksum_sha256: null,
      },
      prohibitedEvidenceRoles: ['official_inventory'],
    }),
    route({
      routeId: ROUTE_IDS.target,
      evidenceRole: 'target_methodology',
      source: ndc,
      sourceRole: 'primary_document_source',
      requiredDomain: 'ndc_target',
      sufficiency: 'primary_only_after_all_gates',
      state: 'blocked_pending_rights_and_review',
      reasons: ['source_rights_pending', 'source_governance_pending', 'document_checksum_missing', 'independent_review_missing', 'normalized_values_not_authorized', 'scoring_not_authorized'],
      explicitComponent: {
        required: true,
        permitted_types: ['active_party_ndc', 'ictu_or_methodology_annex'],
        component_id: null,
        document_checksum_sha256: null,
      },
      prohibitedEvidenceRoles: ['official_inventory'],
    }),
  ];

  const policy = {
    schema_version: SCHEMA_VERSION,
    policy_id: POLICY_ID,
    routing_model_version: ROUTING_MODEL_VERSION,
    created_at: CREATED_AT,
    status: 'blocked_pending_governance',
    purpose: 'Versioned successor to CT-14 flat source-family routing; separates primary, conditional-component, and corroborating evidence roles without granting rights or release authority.',
    immutable_inputs: inputPins,
    governance_boundary: {
      source_registry_modified: false,
      rights_decisions_made: false,
      ct40_decision_modified: false,
      preexisting_factual_tier_state: publicationBoundary.state,
      preexisting_factual_facts: publicationBoundary.factual_facts,
      new_normalized_fact_uses_authorized: false,
      scoring_authorized: false,
      release_authority: false,
      production_runtime_release: false,
    },
    route_rules: {
      official_inventory: {
        required_primary_source_roles: ['primary_value_source', 'conditional_primary_component'],
        corroboration_never_satisfies_primary: true,
        btr_family_authorization_forbidden: true,
        btr_component_identity_and_governance_required: true,
        ter_primary_values_forbidden: true,
      },
      ndc_and_target: {
        required_source_registry_id: SOURCE_IDS.ndc,
        official_inventory_use_forbidden: true,
        active_or_reviewed_absence_status_required: true,
      },
    },
    routes,
    reason_vocabulary: REASON_CODES.map(code => ({ code })),
    prohibited_outputs: [
      'source licence approval',
      'normalized official inventory facts',
      'normalized target facts',
      'commitment or performance claims',
      'climate scoring',
      'production runtime facts',
      'release authority',
    ],
    calculation_hash: null,
  };
  policy.calculation_hash = hashJson(policy);
  validatePolicy(policy, { sourceRegistry, inputPins });
  return policy;
}

function routeById(policy, routeId) {
  const item = policy.routes.find(candidate => candidate.route_id === routeId);
  assert(item, `missing route ${routeId}`);
  return item;
}

function compileInventoryRoute(policy) {
  const nir = routeById(policy, ROUTE_IDS.nir);
  const btr = routeById(policy, ROUTE_IDS.btr);
  const ter = routeById(policy, ROUTE_IDS.ter);
  return {
    status: 'blocked_primary_source_missing',
    primary_requirement_satisfied: false,
    normalized_values_eligible: false,
    scoring_eligible: false,
    primary_candidates: [
      {
        route_id: nir.route_id,
        source_registry_id: nir.source_registry_id,
        source_role: nir.source_role,
        route_state: nir.current_gate.state,
        source_document_ids: [],
        explicit_component_id: null,
        document_checksum_sha256: null,
        governance_decision_id: null,
        rights_decision_id: null,
        independent_review_id: null,
        family_level_authorized: false,
        primary_requirement_satisfied: false,
      },
      {
        route_id: btr.route_id,
        source_registry_id: btr.source_registry_id,
        source_role: btr.source_role,
        route_state: btr.current_gate.state,
        source_document_ids: [],
        explicit_component_id: null,
        document_checksum_sha256: null,
        governance_decision_id: null,
        rights_decision_id: null,
        independent_review_id: null,
        family_level_authorized: false,
        primary_requirement_satisfied: false,
      },
    ],
    corroboration_candidates: [{
      route_id: ter.route_id,
      source_registry_id: ter.source_registry_id,
      source_role: ter.source_role,
      route_state: ter.current_gate.state,
      source_document_ids: [],
      document_checksum_sha256: null,
      rights_decision_id: null,
      independent_review_id: null,
      sufficient_as_primary: false,
    }],
    reason_codes: unique(['primary_value_source_missing', 'source_rights_pending', 'source_governance_pending', 'source_role_domain_mismatch', 'explicit_component_identity_missing', 'document_checksum_missing', 'independent_review_missing', 'corroboration_not_primary', 'normalized_values_not_authorized', 'scoring_not_authorized']),
  };
}

function compileDocumentRoute(policy, ct14Requirement, routeId) {
  const policyRoute = routeById(policy, routeId);
  const knownDocuments = [...ct14Requirement.source_document_ids].sort();
  return {
    status: ct14Requirement.evidence_status,
    route_id: policyRoute.route_id,
    source_registry_id: policyRoute.source_registry_id,
    source_role: policyRoute.source_role,
    source_document_ids: knownDocuments,
    exact_artifacts_acquired: 0,
    exact_artifact_checksums_sha256: [],
    active_or_reviewed_absence_status_verified: false,
    governance_decision_id: null,
    rights_decision_id: null,
    independent_review_id: null,
    normalized_values_eligible: false,
    scoring_eligible: false,
    reason_codes: unique([
      ...(knownDocuments.length ? ['document_checksum_missing'] : ['primary_value_source_missing']),
      'source_rights_pending',
      'source_governance_pending',
      'independent_review_missing',
      'normalized_values_not_authorized',
      'scoring_not_authorized',
    ]),
  };
}

function compileQueue(ct14, policy, inputPins) {
  const entities = ct14.entities.map(entity => {
    const activeNdc = entity.document_requirements.find(item => item.role === 'active_ndc');
    const targetMethodology = entity.document_requirements.find(item => item.role === 'target_methodology');
    assert(activeNdc && targetMethodology, `${entity.country_id} CT-14 document requirements incomplete`);
    return {
      priority: entity.priority,
      country_id: entity.country_id,
      iso_alpha3: entity.iso_alpha3,
      name: entity.name,
      reviewed_2023_factual_rank: entity.reviewed_2023_factual_rank,
      routing: {
        official_inventory: compileInventoryRoute(policy),
        active_ndc: compileDocumentRoute(policy, activeNdc, ROUTE_IDS.ndc),
        target_methodology: compileDocumentRoute(policy, targetMethodology, ROUTE_IDS.target),
      },
      gates: {
        primary_sources_complete: false,
        rights_complete: false,
        independent_review_complete: false,
        assessment_eligible: false,
        scoring_eligible: false,
        release_eligible: false,
        production_runtime_release: false,
      },
    };
  });

  const queue = {
    schema_version: SCHEMA_VERSION,
    queue_id: QUEUE_ID,
    routing_policy_id: policy.policy_id,
    routing_policy_calculation_hash: policy.calculation_hash,
    created_at: CREATED_AT,
    review_status: 'not_reviewed',
    release_eligible: false,
    scoring_authorized: false,
    production_runtime_release: false,
    inputs: inputPins,
    coverage: {
      ranked_entities: entities.length,
      primary_inventory_routes_satisfied: 0,
      btr_components_governance_approved: 0,
      ter_only_inventory_packages_eligible: 0,
      active_ndc_or_reviewed_absence_routes_complete: 0,
      release_eligible_entities: 0,
    },
    entities,
    prohibited_outputs: [
      'normalized official inventory values',
      'normalized target values',
      'commitment status',
      'delivery or performance status',
      'climate scores',
      'production runtime facts',
    ],
    calculation_hash: null,
  };
  queue.calculation_hash = hashJson(queue);
  validateQueue(queue, { ct14, policy, inputPins });
  return queue;
}

function validateHash(document, label) {
  const clone = structuredClone(document);
  const actual = clone.calculation_hash;
  clone.calculation_hash = null;
  assert(hashJson(clone) === actual, `${label} calculation hash drift`);
}

function validateInputPins(actual, expected, label) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} immutable input pins drift`);
}

function validatePolicy(policy, { sourceRegistry, inputPins }) {
  assert(policy.schema_version === SCHEMA_VERSION, 'source-routing policy schema version drift');
  assert(policy.policy_id === POLICY_ID && policy.routing_model_version === ROUTING_MODEL_VERSION, 'source-routing policy identity drift');
  assert(policy.status === 'blocked_pending_governance', 'source-routing policy must remain blocked');
  validateInputPins(policy.immutable_inputs, inputPins, 'source-routing policy');
  const boundary = policy.governance_boundary;
  assert(boundary?.preexisting_factual_tier_state === 'eligible_unchanged' && boundary.preexisting_factual_facts === 2060, 'source-routing policy hid or changed the pre-existing factual tier');
  for (const field of ['source_registry_modified', 'rights_decisions_made', 'ct40_decision_modified', 'new_normalized_fact_uses_authorized', 'scoring_authorized', 'release_authority', 'production_runtime_release']) {
    assert(boundary[field] === false, `source-routing policy leaked authority through ${field}`);
  }
  assert(policy.routes.length === 5, 'source-routing policy must contain five routes');
  assert(new Set(policy.routes.map(item => item.route_id)).size === 5, 'source-routing route IDs must be unique');
  assert(JSON.stringify(policy.reason_vocabulary.map(item => item.code)) === JSON.stringify(REASON_CODES), 'source-routing reason vocabulary drift');

  const sources = sourceMap(sourceRegistry);
  for (const item of policy.routes) {
    const source = requireSource(sources, item.source_registry_id);
    assertPendingMetadataOnly(source);
    assert(item.current_gate.registry_domain_present === source.domains.includes(item.required_registry_domain), `${item.route_id} registry-domain reflection drift`);
    assert(item.current_gate.registry_approval_state === source.approval.state, `${item.route_id} registry approval reflection drift`);
    assert(item.current_gate.registry_redistribution_state === source.redistribution.status, `${item.route_id} redistribution reflection drift`);
    assert(item.current_gate.registry_normalized_values_allowed === false, `${item.route_id} normalized registry use enabled`);
    assert(item.family_level_inventory_authorization === false, `${item.route_id} family-level inventory authorization enabled`);
    ['governance_decision_id', 'rights_decision_id', 'independent_review_id'].forEach(field => assert(item.current_gate[field] === null, `${item.route_id} invented ${field}`));
    assert(item.current_gate.normalized_fact_eligible === false && item.current_gate.scoring_eligible === false, `${item.route_id} eligibility leaked`);
    assert(item.reason_codes.length > 0 && item.reason_codes.every(code => REASON_CODES.includes(code)), `${item.route_id} reason vocabulary invalid`);
  }

  const nir = routeById(policy, ROUTE_IDS.nir);
  assert(nir.evidence_role === 'official_inventory' && nir.source_role === 'primary_value_source', 'NIR/CRT primary route drift');
  assert(nir.required_registry_domain === 'official_inventory' && nir.current_gate.registry_domain_present === true, 'NIR/CRT inventory domain missing');
  assert(nir.structural_sufficiency === 'primary_only_after_all_gates', 'NIR/CRT sufficiency drift');

  const btr = routeById(policy, ROUTE_IDS.btr);
  assert(btr.evidence_role === 'official_inventory' && btr.source_role === 'conditional_primary_component', 'BTR conditional role drift');
  assert(btr.required_registry_domain === 'official_inventory' && btr.current_gate.registry_domain_present === false, 'BTR unresolved inventory-domain mismatch must remain explicit');
  assert(btr.current_gate.state === 'blocked_role_domain_mismatch', 'BTR must remain blocked on domain mismatch');
  assert(btr.explicit_component.required === true && btr.explicit_component.component_id === null && btr.explicit_component.document_checksum_sha256 === null, 'BTR explicit-component gate bypassed');
  assert(JSON.stringify(btr.explicit_component.permitted_types) === JSON.stringify(['ctf_inventory_table', 'inventory_chapter', 'national_inventory_document']), 'BTR permitted component types drift');
  assert(policy.route_rules.official_inventory.btr_family_authorization_forbidden === true, 'flat BTR family authorization enabled');

  const ter = routeById(policy, ROUTE_IDS.ter);
  assert(ter.evidence_role === 'official_inventory_corroboration' && ter.source_role === 'corroboration_only', 'TER corroboration role drift');
  assert(ter.structural_sufficiency === 'never_sufficient_as_primary_value_source', 'TER became sufficient as primary source');
  assert(ter.reason_codes.includes('corroboration_not_primary') && ter.reason_codes.includes('primary_value_source_missing'), 'TER fail-closed reasons missing');
  assert(policy.route_rules.official_inventory.ter_primary_values_forbidden === true && policy.route_rules.official_inventory.corroboration_never_satisfies_primary === true, 'TER primary-value prohibition disabled');

  for (const routeId of [ROUTE_IDS.ndc, ROUTE_IDS.target]) {
    const item = routeById(policy, routeId);
    assert(item.source_registry_id === SOURCE_IDS.ndc && item.required_registry_domain === 'ndc_target', `${routeId} must remain NDC-only`);
    assert(item.prohibited_evidence_roles.includes('official_inventory'), `${routeId} official-inventory prohibition missing`);
  }
  assert(policy.route_rules.ndc_and_target.official_inventory_use_forbidden === true, 'NDC Registry inventory use enabled');
  validateHash(policy, 'source-routing policy');
  return true;
}

function validateQueue(queue, { ct14, policy, inputPins }) {
  assert(queue.schema_version === SCHEMA_VERSION && queue.queue_id === QUEUE_ID, 'successor routing queue identity drift');
  assert(queue.routing_policy_id === policy.policy_id && queue.routing_policy_calculation_hash === policy.calculation_hash, 'successor queue policy pin drift');
  assert(queue.review_status === 'not_reviewed', 'successor queue review invented');
  assert(queue.release_eligible === false && queue.scoring_authorized === false && queue.production_runtime_release === false, 'successor queue granted scoring, runtime, or release authority');
  validateInputPins(queue.inputs, inputPins, 'successor routing queue');
  assert(queue.entities.length === 20 && queue.coverage.ranked_entities === 20, 'successor queue must retain exact top-20 coverage');
  assert(queue.coverage.primary_inventory_routes_satisfied === 0, 'successor queue invented a primary inventory route');
  assert(queue.coverage.btr_components_governance_approved === 0, 'successor queue invented BTR component governance');
  assert(queue.coverage.ter_only_inventory_packages_eligible === 0, 'successor queue accepted TER-only inventory evidence');
  assert(queue.coverage.active_ndc_or_reviewed_absence_routes_complete === 0 && queue.coverage.release_eligible_entities === 0, 'successor queue invented completed evidence');

  queue.entities.forEach((entity, index) => {
    const prior = ct14.entities[index];
    assert(entity.priority === prior.priority && entity.country_id === prior.country_id && entity.iso_alpha3 === prior.iso_alpha3 && entity.name === prior.name, `successor queue entity drift at ${index + 1}`);
    assert(entity.reviewed_2023_factual_rank === prior.reviewed_2023_factual_rank, `${entity.country_id} reviewed rank drift`);
    assert(Object.values(entity.gates).every(value => value === false), `${entity.country_id} gate or release authority invented`);

    const inventory = entity.routing.official_inventory;
    assert(inventory.status === 'blocked_primary_source_missing' && inventory.primary_requirement_satisfied === false, `${entity.country_id} inventory primary requirement invented`);
    assert(inventory.normalized_values_eligible === false && inventory.scoring_eligible === false, `${entity.country_id} inventory eligibility invented`);
    assert(JSON.stringify(inventory.primary_candidates.map(item => item.route_id)) === JSON.stringify([ROUTE_IDS.nir, ROUTE_IDS.btr]), `${entity.country_id} inventory primary routes drift`);
    assert(inventory.corroboration_candidates.length === 1 && inventory.corroboration_candidates[0].route_id === ROUTE_IDS.ter, `${entity.country_id} TER corroboration route drift`);
    const btr = inventory.primary_candidates[1];
    assert(btr.source_role === 'conditional_primary_component' && btr.route_state === 'blocked_role_domain_mismatch', `${entity.country_id} BTR flat-family route enabled`);
    assert(btr.explicit_component_id === null && btr.document_checksum_sha256 === null && btr.governance_decision_id === null && btr.rights_decision_id === null, `${entity.country_id} BTR component evidence invented`);
    assert(btr.family_level_authorized === false && btr.primary_requirement_satisfied === false, `${entity.country_id} BTR authorization invented`);
    const ter = inventory.corroboration_candidates[0];
    assert(ter.source_role === 'corroboration_only' && ter.sufficient_as_primary === false, `${entity.country_id} TER became a primary source`);
    assert(inventory.reason_codes.every(code => REASON_CODES.includes(code)), `${entity.country_id} inventory reason vocabulary invalid`);

    const activeNdcPrior = prior.document_requirements.find(item => item.role === 'active_ndc');
    const targetPrior = prior.document_requirements.find(item => item.role === 'target_methodology');
    const activeNdc = entity.routing.active_ndc;
    const target = entity.routing.target_methodology;
    assert(activeNdc.route_id === ROUTE_IDS.ndc && target.route_id === ROUTE_IDS.target, `${entity.country_id} NDC/target route drift`);
    assert(JSON.stringify(activeNdc.source_document_ids) === JSON.stringify([...activeNdcPrior.source_document_ids].sort()), `${entity.country_id} active-NDC metadata drift`);
    assert(JSON.stringify(target.source_document_ids) === JSON.stringify([...targetPrior.source_document_ids].sort()), `${entity.country_id} target metadata drift`);
    for (const item of [activeNdc, target]) {
      assert(item.exact_artifacts_acquired === 0 && item.exact_artifact_checksums_sha256.length === 0, `${entity.country_id} exact source artifact invented`);
      assert(item.active_or_reviewed_absence_status_verified === false, `${entity.country_id} active/absence review invented`);
      assert(item.governance_decision_id === null && item.rights_decision_id === null && item.independent_review_id === null, `${entity.country_id} document decision invented`);
      assert(item.normalized_values_eligible === false && item.scoring_eligible === false, `${entity.country_id} document eligibility invented`);
      assert(item.reason_codes.every(code => REASON_CODES.includes(code)), `${entity.country_id} document reason vocabulary invalid`);
    }
  });
  assert(new Set(queue.entities.map(entity => entity.country_id)).size === 20, 'successor queue country IDs must be unique');
  validateHash(queue, 'successor routing queue');
  return true;
}

function compile({ sourceRegistry, ct14, ct15, policyInputPins, queueInputPins }) {
  assert(ct14.review_status === 'not_reviewed' && ct14.release_eligible === false && ct14.production_runtime_release === false, 'CT-14 immutable deny boundary drift');
  assert(ct14.entities.length === 20 && ct14.coverage.official_inventory_documents_available === 0, 'CT-14 immutable coverage drift');
  assert(ct15.status === 'blocked' && ct15.release_authority === false && ct15.production_runtime_release === false, 'CT-15 immutable deny boundary drift');
  const ct15Tracks = new Map(ct15.readiness_tracks.map(item => [item.track_id, item]));
  assert(ct15Tracks.get('factual_display_and_magnitude_comparison')?.status === 'eligible', 'CT-15 factual publication eligibility drift');
  assert(ct15Tracks.get('factual_display_and_magnitude_comparison')?.current?.eligible_facts === 2060, 'CT-15 factual publication count drift');
  assert(ct15Tracks.get('assessed_runtime_and_scoring')?.status === 'blocked' && ct15Tracks.get('top20_country_assessment')?.status === 'blocked', 'CT-15 assessed boundary drift');
  const mismatch = ct15.audit_findings?.routing_mismatches?.find(item => item.id === 'btr-official-inventory-domain');
  assert(mismatch?.status === 'unresolved', 'CT-15 BTR routing mismatch must remain an immutable unresolved finding');
  const policy = compilePolicy(sourceRegistry, policyInputPins, { state: 'eligible_unchanged', factual_facts: 2060 });
  const resolvedQueuePins = structuredClone(queueInputPins);
  assert(resolvedQueuePins.source_routing_policy?.calculation_hash === null, 'queue policy input must begin unresolved');
  resolvedQueuePins.source_routing_policy.calculation_hash = policy.calculation_hash;
  const queue = compileQueue(ct14, policy, resolvedQueuePins);
  return { policy, queue };
}

module.exports = {
  CREATED_AT,
  POLICY_ID,
  QUEUE_ID,
  REASON_CODES,
  ROUTE_IDS,
  ROUTING_MODEL_VERSION,
  SCHEMA_VERSION,
  SOURCE_IDS,
  compile,
  compilePolicy,
  compileQueue,
  hashJson,
  stable,
  validatePolicy,
  validateQueue,
};
