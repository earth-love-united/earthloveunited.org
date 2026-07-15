'use strict';

const crypto = require('node:crypto');

const PACKAGE_ID = 'ct15-production-evidence-readiness-2026-07-15';
const CREATED_AT = '2026-07-15T16:00:00Z';
const EXPECTED_TOP20 = Object.freeze([
  'CHN', 'USA', 'IND', 'RUS', 'IDN', 'BRA', 'JPN', 'IRN', 'SAU', 'CAN',
  'MEX', 'KOR', 'DEU', 'AUS', 'TUR', 'ZAF', 'VNM', 'PAK', 'THA', 'NGA',
]);
const SOURCE_IDS = Object.freeze([
  'primap-hist-2.6.1-final',
  'unfccc-ndc-registry-continuous-2026-07-15',
  'unfccc-nir-crt-2026-cycle',
  'unfccc-btr-continuous-2026-07-15',
  'unfccc-ter-continuous-2026-07-15',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function hashJson(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function sourceDecision(source, config) {
  return {
    source_registry_id: source.id,
    purpose: config.purpose,
    required_for: config.requiredFor,
    mandatory_if_used: true,
    current_registry_state: {
      approval_state: source.approval.state,
      licence_status: source.licence.status,
      licence_identifier: source.licence.identifier,
      redistribution_status: source.redistribution.status,
      source_files_allowed: source.redistribution.source_files,
      normalized_values_allowed: source.redistribution.normalized_values,
      metadata_and_links_allowed: source.redistribution.metadata_and_links,
      artifact_checksum_sha256: source.artifact?.sha256 || null,
    },
    ct40_decision_state: config.ct40DecisionState,
    registry_change_required_before_normalized_use: config.registryChangeRequired,
    registry_transition_fields: config.registryChangeRequired ? [
      'licence.status',
      'licence.evidence_url',
      'licence.summary',
      'licence.restrictions',
      'redistribution.status',
      'redistribution.source_files',
      'redistribution.normalized_values',
      'redistribution.metadata_and_links',
      'approval.state',
      'approval.decision',
      'approval.required_action',
      'storage.raw',
    ] : [],
    ct40_candidate_decision_path: `ct40_candidate.sources[source_id=${source.id}].licence`,
    decision_must_not_be_inferred: true,
    required_decision_record_fields: [
      'decision_id',
      'source_registry_id',
      'reviewed_source_version',
      'reviewed_source_checksum_sha256_or_per_document_checksums',
      'licence_identifier',
      'terms_url',
      'licence_evidence_url_or_written_clarification_reference',
      'redistribution_approved',
      'scoring_approved',
      'source_files_approved',
      'normalized_values_approved',
      'attribution_template',
      'restrictions',
      'decision_by',
      'decision_at',
      'decision_notes',
    ],
    transition_conditions: {
      factual_publication: [
        'non-empty decision_id',
        'checksum pin matches every released fact',
        'redistribution_approved is true',
        'normalized_values_approved is true',
      ],
      assessment_or_scoring: [
        'all factual-publication conditions',
        'scoring_approved is true',
      ],
      note: 'These are gate conditions, not approvals. The independent rights reviewer may deny or narrow any use.',
    },
    accepted_decision_basis: config.acceptedDecisionBasis,
    prohibited_basis: [
      'inference from public availability',
      'acceptance of click-through terms by an agent',
      'a metadata-only source-registry entry',
      'a batch scientific attestation without a rights decision',
    ],
    routing_note: config.routingNote || null,
  };
}

function countrySpecialRequirements(iso) {
  const common = [
    'verify current Party status from an official treaty or UNFCCC record',
    'verify the latest active submission and every superseded version',
    'record source-unavailable or not-reported states without inference',
  ];
  if (iso === 'IRN') return [...common, 'do not promote the legacy INDC to an active NDC', 'independently review Party status and active-target absence'];
  if (iso === 'DEU') return [...common, 'review EU joint-NDC applicability, membership, and any Germany-specific allocation separately'];
  return common;
}

function buildCountryWorkItem(entity) {
  return {
    priority: entity.priority,
    country_id: entity.country_id,
    iso_alpha3: entity.iso_alpha3,
    name: entity.name,
    current_evidence_status: entity.current_evidence_status,
    required_document_roles: entity.document_requirements.map(item => ({
      role: item.role,
      current_status: item.evidence_status,
      source_registry_ids: item.acceptable_source_registry_ids,
      known_source_document_ids: item.source_document_ids,
      current_reason_codes: item.reason_codes,
    })),
    field_gap_groups: entity.field_completeness,
    status_and_identity_fields_required: [
      'party_status',
      'registry_status',
      'submission_version',
      'submission_date',
      'latest_active_or_reviewed_absence_determination',
      'supersedes',
      'superseded_by',
    ],
    country_specific_review_requirements: countrySpecialRequirements(entity.iso_alpha3),
    current_release_eligible: false,
  };
}

function compile(input) {
  const { ct40Result, ct40Input, ct14Queue, sourceRegistry, audit, publishedFacts, inputPins } = input;
  assert(ct40Result.decision === 'deny' && ct40Result.eligible === false && ct40Result.release_authority === false, 'CT-40 DENY snapshot required');
  assert(ct40Result.counts?.facts_evaluated === 2060 && ct40Result.counts?.facts_eligible === 0, 'CT-40 fact counts drift');
  assert(ct40Input.ct40_candidate?.facts?.length === 2060, 'CT-40 input fact universe drift');
  assert(ct40Input.ct40_candidate.fact_reviews.length === 0, 'CT-40 denial input unexpectedly contains fact reviews');
  assert(ct40Input.ct40_candidate.facts.every(fact => fact.evidence_state === 'not_reviewed'), 'CT-40 denial input must preserve not_reviewed evidence');
  assert(ct40Input.ct40_candidate.review?.status === 'not_reviewed', 'CT-40 denial input unexpectedly contains a release review');
  assert(ct40Input.ct40_candidate.sources.every(source => source.licence?.decision_id === null && source.licence?.redistribution_approved === null && source.licence?.scoring_approved === null), 'CT-40 denial input unexpectedly contains licence approvals');
  assert(publishedFacts.fact_count === 2060 && publishedFacts.facts.length === 2060, 'published factual candidate drift');
  assert(ct14Queue.review_status === 'not_reviewed' && ct14Queue.release_eligible === false && ct14Queue.production_runtime_release === false, 'CT-14 denial snapshot required');
  assert(ct14Queue.entities.length === 20, 'CT-14 top-20 universe drift');
  assert(JSON.stringify(ct14Queue.entities.map(item => item.iso_alpha3)) === JSON.stringify(EXPECTED_TOP20), 'CT-14 top-20 order drift');
  assert(audit.documents.length === 5 && audit.target_components.length === 7, 'CT-11 metadata-only audit drift');

  const sourceMap = new Map(sourceRegistry.sources.map(source => [source.id, source]));
  SOURCE_IDS.forEach(id => assert(sourceMap.has(id), `missing source registry entry: ${id}`));

  const sourceConfigs = [
    {
      id: SOURCE_IDS[0], purpose: 'Current 2,060-fact harmonized factual runtime', requiredFor: ['factual_runtime'],
      ct40DecisionState: 'missing',
      registryChangeRequired: false,
      acceptedDecisionBasis: ['pinned CC BY 4.0 evidence', 'exact v2.6.1 artifact checksum', 'reviewed attribution and transformation notice'],
    },
    {
      id: SOURCE_IDS[1], purpose: 'Active NDC identity, target text, and target methodology', requiredFor: ['target_facts', 'comparability', 'country_assessment'],
      ct40DecisionState: 'pending_metadata_only',
      registryChangeRequired: true,
      acceptedDecisionBasis: ['written interpretation or clarification covering normalized fact extraction', 'document-specific rights review', 'explicitly licensed official data interface'],
    },
    {
      id: SOURCE_IDS[2], purpose: 'Official Party inventory documents and common reporting tables', requiredFor: ['official_inventory_facts', 'delivery', 'country_assessment'],
      ct40DecisionState: 'pending_metadata_only',
      registryChangeRequired: true,
      acceptedDecisionBasis: ['written interpretation covering normalized inventory facts', 'document-specific rights review', 'explicitly licensed official data interface'],
    },
    {
      id: SOURCE_IDS[3], purpose: 'BTR progress, policy, finance, and any explicitly routed CTF inventory facts', requiredFor: ['official_progress', 'policy_projection', 'climate_finance', 'official_inventory_only_if_registry_domain_is_corrected'],
      ct40DecisionState: 'pending_metadata_only',
      registryChangeRequired: true,
      acceptedDecisionBasis: ['written interpretation covering normalized factual extraction', 'document-specific rights review', 'explicitly licensed official data interface'],
      routingNote: 'CT-14 routes BTR to official_inventory, but this registry entry does not declare the official_inventory domain. Correct the registry domain or do not use BTR as an inventory source.',
    },
    {
      id: SOURCE_IDS[4], purpose: 'Technical expert review documents and reviewed findings', requiredFor: ['conflict_resolution_or_review_findings_if_used'],
      ct40DecisionState: 'pending_metadata_only',
      registryChangeRequired: true,
      acceptedDecisionBasis: ['unchanged-document public-domain basis for source-file archiving', 'separate written decision for normalized findings'],
      routingNote: 'TER can corroborate or qualify an inventory but is not a substitute for the Party submission that supplies inventory values.',
    },
  ];

  const output = {
    schema_version: '1.0.0',
    work_package_id: PACKAGE_ID,
    created_at: CREATED_AT,
    status: 'blocked',
    release_authority: false,
    production_runtime_release: false,
    scope: 'Evidence, rights, and independent-review work required before a new production candidate may be evaluated. This package does not authorize release.',
    inputs: inputPins,
    audit_findings: {
      ct40: {
        decision: 'deny',
        facts_evaluated: 2060,
        facts_eligible: 0,
        facts_with_evidence_state_not_reviewed: 2060,
        field_level_fact_reviews_present: 0,
        source_licence_decisions_present: 0,
        release_reviewer_ids_present: 0,
        canonical_reason_codes: ct40Result.reason_codes,
      },
      ct14: {
        ranked_entities: 20,
        metadata_only_entities: ct14Queue.coverage.ct11_countries_with_metadata,
        audits_not_started: ct14Queue.coverage.countries_without_ct11_primary_source_audit,
        official_inventory_documents_available: ct14Queue.coverage.official_inventory_documents_available,
        active_ndc_metadata_entities: ct14Queue.coverage.active_ndc_metadata_entities,
        legacy_indc_only_entities: ct14Queue.coverage.legacy_indc_only_entities,
        release_eligible_entities: 0,
      },
      routing_mismatches: [
        {
          id: 'btr-official-inventory-domain',
          status: 'unresolved',
          detail: 'CT-14 accepts the BTR source family for official_inventory, while its CT-01 source-registry domains omit official_inventory.',
          required_resolution: 'Add the domain through reviewed source governance or remove BTR from the official-inventory route before acquisition.',
        },
      ],
    },
    snapshot_boundaries: [
      {
        snapshot_id: ct40Result.review_candidate_id,
        transitionable: false,
        reason: 'The denial adapter intentionally writes not_reviewed facts, an empty fact-review array, null licence decisions, and an unreviewed release block.',
      },
      {
        snapshot_id: ct14Queue.queue_id,
        transitionable: false,
        reason: 'The CT-14 checker pins zero inventories, four metadata-only audits, sixteen not-started audits, and pending source approvals.',
      },
    ],
    required_next_compiler: {
      status: 'not_implemented',
      name: 'reviewed production candidate compiler',
      rule: 'Consume new independently reviewed source decisions, document manifests, fact reviews, profiles, and release review inputs; preserve CT-14 and the CT-40 DENY snapshot unchanged.',
    },
    readiness_tracks: [
      {
        track_id: 'factual_runtime',
        status: 'blocked',
        can_proceed_independently_of_country_scoring: true,
        current: { facts: 2060, fact_reviews: 0, ct40_source_decisions: 0, release_reviews: 0 },
        required: [
          'explicit PRIMAP CT-40 rights decision tied to the exact checksum',
          '2,060 CT-40 fact-review records with exact field reviews',
          'independent release review on the assembled candidate',
          'reviewed runtime manifest, release diff, and executable rollback proof after an authentic allow decision',
        ],
        boundary: 'No target, commitment, delivery, performance, impact-band, or score claims.',
      },
      {
        track_id: 'top20_country_assessment',
        status: 'blocked',
        can_block_factual_only_publication_by_policy_only: true,
        current: { countries: 20, official_inventory_packages: 0, metadata_only_countries: 4, audits_not_started: 16, eligible_profiles: 0 },
        required: [
          'reviewed source-family and per-document rights decisions',
          'latest official inventory package or explicit source-unavailable outcome for every country',
          'latest active NDC package or independently reviewed absence/status determination for every country',
          'target-methodology extraction and field review',
          'comparability, delivery, and profile review using only eligible input facts',
        ],
        boundary: 'Scores remain withheld until all facts used by a profile also have scoring_approved rights decisions.',
      },
    ],
    source_decision_work: sourceConfigs.map(config => sourceDecision(sourceMap.get(config.id), config)),
    known_ndc_artifact_work: audit.documents.map(document => ({
      source_document_id: document.source_document_id,
      country_id: document.country_id,
      document_type: document.document_type,
      registry_status: document.registry_status,
      submission_date: document.submission_date || null,
      metadata_url: document.metadata_url,
      direct_url: document.direct_url,
      current_acquisition_state: document.raw_file_acquisition.state,
      current_checksum_sha256: document.raw_file_acquisition.checksum_sha256,
      checksum_required: true,
      required_next_state: 'exact_artifact_acquired_and_independently_verified_or_explicit_fail_closed_outcome',
      normalized_extraction_allowed_now: false,
    })),
    official_inventory_artifact_work: ct14Queue.entities.map(entity => ({
      country_id: entity.country_id,
      iso_alpha3: entity.iso_alpha3,
      acceptable_source_registry_ids: entity.document_requirements.find(item => item.role === 'official_inventory').acceptable_source_registry_ids,
      known_source_document_ids: [],
      known_checksums_sha256: [],
      current_status: 'source_missing',
      checksum_required_for_every_acquired_attachment: true,
    })),
    artifact_contracts: {
      document_identity_manifest: {
        required_fields: [
          'source_document_id', 'country_id', 'document_role', 'source_registry_id', 'publisher', 'title',
          'document_type', 'language', 'registry_status', 'submission_date', 'submission_version',
          'registry_page_url', 'metadata_url', 'direct_url', 'retrieved_at', 'mime_type', 'byte_length',
          'checksum_sha256', 'rights_notice_locator', 'licence_decision_id', 'raw_storage_state',
          'latest_active_status_verified_at', 'supersedes', 'superseded_by', 'acquisition_outcome',
        ],
        acquisition_outcomes: ['exact_artifact_acquired', 'source_unavailable', 'clickthrough_blocked', 'rights_blocked'],
        checksum_rule: 'Every acquired file and attachment must have a SHA-256 over exact bytes; a locator or search index is not a checksum substitute.',
      },
      official_inventory_package: {
        required_artifact_roles: [
          'official Party submission metadata',
          'national inventory document or BTR inventory chapter',
          'CRT/CTF/common reporting tables used for values',
          'methodology and recalculation annexes used for interpretation',
          'TER only when used as corroboration or conflict evidence',
        ],
        required_fact_fields: [
          'country_id', 'metric', 'value', 'unit', 'period', 'evidence_plane', 'accounting_frame',
          'gases', 'sectors', 'geography', 'lulucf', 'gwp_convention', 'source_id', 'publisher',
          'title', 'version', 'url', 'locator', 'publication_date', 'retrieved_at', 'checksum_sha256',
          'licence_id', 'attribution', 'evidence_state', 'uncertainty', 'review',
        ],
        selection_rule: 'Use the latest official Party submission appropriate to the reporting obligation and retain older vintages needed to explain recalculations.',
      },
      ndc_and_target_package: {
        required_artifact_roles: ['official registry metadata', 'latest active Party NDC document', 'official ICTU or methodology annexes', 'superseded submissions needed for status history'],
        common_target_fields: [
          'target_id', 'country_id', 'target_type', 'condition', 'status', 'target_year', 'target_period',
          'reduction_pct', 'target_value', 'statement', 'scope.accounting_frame', 'scope.gases',
          'scope.sectors', 'scope.geography', 'scope.lulucf', 'scope.gwp_convention',
          'scope.article6_treatment', 'source_fact_ids', 'review',
        ],
        conditional_target_fields: {
          base_year: ['reference.year', 'reference.value', 'reference.fact_id'],
          bau: ['bau.scenario_id', 'bau.vintage', 'bau.target_year_value', 'bau.source_fact_id'],
          intensity: ['intensity.denominator_metric', 'intensity.denominator_unit', 'intensity.target_year_denominator_fact_id'],
          trajectory_or_peaking: ['trajectory.pathway_fact_ids', 'peak_year'],
          net_zero: ['net_zero.residual_emissions', 'net_zero.removals_treatment', 'net_zero.offsets_treatment', 'net_zero.interim_target_ids'],
        },
        absence_rule: 'No active target found is a reviewed result requiring current Party status and registry coverage; it must never be inferred from a failed download.',
      },
    },
    field_review_contracts: {
      current_runtime_fact: {
        review_records_required: 2060,
        review_records_present: 0,
        review_record_fields: ['fact_id', 'status', 'extractor_id', 'reviewer_id', 'reviewed_at', 'source_checksum_sha256', 'methodology_version', 'field_reviews'],
        required_field_paths: ['metric', 'period', 'scope', 'source', 'evidence'],
        additional_high_impact_field_path: 'derivation',
        independence_rule: 'extractor_id must differ from reviewer_id',
        checksum_rule: 'review.source_checksum_sha256 must equal the fact and source-decision checksum',
        derivation_rule: 'A derivation review must include the output fact_id and every input_fact_id.',
      },
      target_and_inventory_fact: {
        required_field_paths: ['metric', 'period', 'scope', 'source', 'evidence'],
        target_specific_paths: ['target identity and status', 'endpoint', 'reference or BAU or intensity basis', 'conditionality', 'Article 6 treatment', 'comparability inputs'],
        review_states: ['reviewed', 'rejected', 'not_reported', 'source_unavailable', 'non_comparable'],
        rule: 'Null, missing, withheld, and not-applicable values keep explicit evidence states and canonical reason codes.',
      },
      profile: {
        required_fields: ['profile_id', 'input_fact_ids', 'methodology_version', 'generated_at', 'calculation_hash', 'review.status', 'review.compiler_id', 'review.reviewer_id', 'review.reviewed_at', 'review.methodology_version', 'review.input_fact_ids'],
        independence_rule: 'compiler_id must differ from reviewer_id',
        eligibility_rule: 'Every input fact must pass the assessment path, including scoring_approved rights.',
      },
      release: {
        required_fields: ['status', 'builder_id', 'reviewer_ids', 'reviewed_at'],
        independence_rule: 'reviewer_ids must be non-empty, unique, and exclude builder_id',
      },
    },
    review_roles: [
      { role: 'document_acquirer', responsibility: 'Record official URLs, immutable identity metadata, exact bytes or fail-closed acquisition outcomes; makes no rights or scientific approval.' },
      { role: 'source_identity_reviewer', responsibility: 'Independently verify publisher, latest/superseded status, document role, attachment completeness, and checksums.' },
      { role: 'licence_and_redistribution_reviewer', responsibility: 'Record the explicit rights decision for source files, normalized values, redistribution, and scoring; may approve, narrow, or deny.' },
      { role: 'fact_extractor', responsibility: 'Create draft observations and targets with locators, evidence states, and no inferred values.' },
      { role: 'field_level_climate_reviewer', responsibility: 'Independently review every required fact field against the pinned source bytes and methodology.' },
      { role: 'comparability_reviewer', responsibility: 'Review target type, reference basis, scope alignment, transformations, and non-comparability reasons.' },
      { role: 'profile_compiler', responsibility: 'Compile candidate delivery/performance/profile outputs only from eligible facts.' },
      { role: 'profile_reviewer', responsibility: 'Independently review inputs, method version, calculation hash, and output boundaries.' },
      { role: 'release_builder', responsibility: 'Assemble a new candidate without modifying denial snapshots.' },
      { role: 'ct40_release_reviewer', responsibility: 'Independently review the assembled release candidate and issue allow or deny; no earlier attestation grants this authority.' },
    ],
    required_independence_pairs: [
      ['document_acquirer', 'source_identity_reviewer'],
      ['fact_extractor', 'field_level_climate_reviewer'],
      ['profile_compiler', 'profile_reviewer'],
      ['release_builder', 'ct40_release_reviewer'],
    ],
    country_work_items: ct14Queue.entities.map(buildCountryWorkItem),
    ordered_worklist: [
      { order: 1, work: 'Preserve CT-14 and the CT-40 DENY artifacts as immutable audit evidence.', status: 'required' },
      { order: 2, work: 'Complete the explicit PRIMAP CT-40 rights decision for the pinned v2.6.1 checksum; do not infer it from CT-01 approval.', status: 'not_started' },
      { order: 3, work: 'Resolve UNFCCC source-family normalized-extraction and scoring rights with counsel, written clarification, or an explicitly licensed official interface.', status: 'not_started' },
      { order: 4, work: 'Resolve the BTR official-inventory routing mismatch before using BTR values as inventory facts.', status: 'not_started' },
      { order: 5, work: 'Acquire or fail-close exact official inventory and NDC artifact packages for all 20 countries; hash every acquired attachment.', status: 'not_started' },
      { order: 6, work: 'Independently review document identity, current Party/submission status, rights exceptions, and checksums.', status: 'not_started' },
      { order: 7, work: 'Produce and independently review 2,060 current-runtime fact reviews plus any new official inventory and target fact reviews.', status: 'not_started' },
      { order: 8, work: 'Compile and review target comparability and country profiles only from facts eligible for assessment/scoring.', status: 'not_started' },
      { order: 9, work: 'Build a new reviewed release candidate and run CT-40; retain DENY if any condition remains unmet.', status: 'not_started' },
      { order: 10, work: 'Only after an authentic allow: independently verify runtime manifest, release diff, deployment checks, and executable rollback proof.', status: 'blocked_on_authentic_allow' },
    ],
    prohibited_actions: [
      'accept click-through terms',
      'download gated data through circumvention',
      'infer reuse permission from public access',
      'treat CT-42 data/UI attestations as CT-40 fact, rights, profile, or release review',
      'promote an INDC to active NDC status',
      'fill missing country fields from legacy pledge data',
      'create a production runtime manifest or allow manifest from this package',
    ],
  };
  output.calculation_hash = hashJson(output);
  validate(output, input);
  return output;
}

function validate(output, input) {
  assert(output.status === 'blocked' && output.release_authority === false && output.production_runtime_release === false, 'readiness package leaked release authority');
  assert(output.snapshot_boundaries.length === 2 && output.snapshot_boundaries.every(item => item.transitionable === false), 'denial snapshot became transitionable');
  assert(output.required_next_compiler.status === 'not_implemented', 'unimplemented production compiler claimed ready');
  assert(output.readiness_tracks.length === 2 && output.readiness_tracks.every(item => item.status === 'blocked'), 'readiness track claimed ready');
  assert(output.audit_findings.ct40.facts_evaluated === 2060 && output.audit_findings.ct40.facts_eligible === 0, 'CT-40 counts drift');
  assert(output.audit_findings.ct40.field_level_fact_reviews_present === 0 && output.field_review_contracts.current_runtime_fact.review_records_present === 0, 'fact reviews were invented');
  assert(output.field_review_contracts.current_runtime_fact.review_records_required === 2060, 'fact-review requirement drift');
  assert(output.audit_findings.ct14.official_inventory_documents_available === 0 && output.audit_findings.ct14.release_eligible_entities === 0, 'official evidence or eligibility invented');
  assert(output.source_decision_work.length === SOURCE_IDS.length, 'source-decision work coverage drift');
  const decisions = new Map(output.source_decision_work.map(item => [item.source_registry_id, item]));
  assert(decisions.get(SOURCE_IDS[0])?.ct40_decision_state === 'missing', 'PRIMAP CT-40 decision was invented');
  assert(decisions.get(SOURCE_IDS[0])?.registry_change_required_before_normalized_use === false, 'PRIMAP registry was needlessly reopened');
  assert(decisions.get(SOURCE_IDS[0])?.current_registry_state.artifact_checksum_sha256 === '7607f2b7c5b00d3ddbb19e5c7b100ff7bd8c2d8c2bfc8959c40f41d2cfecf4d9', 'PRIMAP checksum drift');
  for (const id of SOURCE_IDS.slice(1)) {
    const decision = decisions.get(id);
    assert(decision?.current_registry_state.approval_state === 'pending', `${id} approval was inferred`);
    assert(decision.current_registry_state.normalized_values_allowed === false, `${id} normalized values were prematurely allowed`);
    assert(decision.ct40_decision_state === 'pending_metadata_only', `${id} CT-40 decision drift`);
    assert(decision.registry_change_required_before_normalized_use === true && decision.registry_transition_fields.length > 0, `${id} registry transition work missing`);
  }
  assert(output.known_ndc_artifact_work.length === 5, 'known NDC artifact work drift');
  assert(output.known_ndc_artifact_work.every(item => item.current_checksum_sha256 === null && item.checksum_required === true && item.normalized_extraction_allowed_now === false), 'NDC checksum or extraction permission was invented');
  assert(output.official_inventory_artifact_work.length === 20, 'official inventory artifact work coverage drift');
  assert(output.official_inventory_artifact_work.every(item => item.known_source_document_ids.length === 0 && item.known_checksums_sha256.length === 0 && item.current_status === 'source_missing'), 'official inventory artifacts were invented');
  assert(output.audit_findings.routing_mismatches.some(item => item.id === 'btr-official-inventory-domain' && item.status === 'unresolved'), 'BTR routing mismatch was hidden');
  assert(output.country_work_items.length === 20, 'top-20 work coverage drift');
  assert(JSON.stringify(output.country_work_items.map(item => item.iso_alpha3)) === JSON.stringify(EXPECTED_TOP20), 'top-20 work order drift');
  const queueMap = new Map(input.ct14Queue.entities.map(item => [item.iso_alpha3, item]));
  for (const item of output.country_work_items) {
    const source = queueMap.get(item.iso_alpha3);
    assert(source, `${item.iso_alpha3} is outside CT-14`);
    assert(item.current_release_eligible === false, `${item.iso_alpha3} eligibility was invented`);
    assert(JSON.stringify(item.field_gap_groups) === JSON.stringify(source.field_completeness), `${item.iso_alpha3} field gaps drift`);
    assert(JSON.stringify(item.required_document_roles.map(role => role.role)) === JSON.stringify(['official_inventory', 'active_ndc', 'target_methodology']), `${item.iso_alpha3} document roles drift`);
  }
  assert(output.country_work_items.find(item => item.iso_alpha3 === 'IRN').country_specific_review_requirements.some(item => item.includes('legacy INDC')), 'Iran INDC boundary missing');
  assert(output.country_work_items.find(item => item.iso_alpha3 === 'DEU').country_specific_review_requirements.some(item => item.includes('EU joint-NDC')), 'Germany joint-NDC applicability review missing');
  assert(output.required_independence_pairs.length === 4, 'review independence coverage drift');
  assert(output.ordered_worklist.length === 10 && output.ordered_worklist.every((item, index) => item.order === index + 1), 'ordered worklist drift');
  assert(output.prohibited_actions.includes('accept click-through terms') && output.prohibited_actions.some(item => item.includes('production runtime manifest')), 'safety boundary missing');
  const forHash = structuredClone(output);
  delete forHash.calculation_hash;
  assert(hashJson(forHash) === output.calculation_hash, 'readiness package calculation hash drift');
  return true;
}

module.exports = { PACKAGE_ID, CREATED_AT, EXPECTED_TOP20, SOURCE_IDS, compile, validate, hashJson, stable };
