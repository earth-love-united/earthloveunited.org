#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const governance = require('./lib/climate-public-beta-governance-contracts');
const { parseJsonNoDuplicateKeys } = require('./lib/json-schema-lite');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_ID = 'elu-beta-governance-fixture-v1';
const STARTED_AT = '2040-01-02T12:00:00.000Z';
const COMPLETED_AT = '2040-01-02T14:00:00.000Z';

function usage() {
  return [
    'usage:',
    '  node tools/check-climate-public-beta-governance-contracts.js --self-test',
    '  node tools/check-climate-public-beta-governance-contracts.js \\',
    '    --review-protocol <canonical-json> \\',
    '    --feedback-privacy-contract <canonical-json> \\',
    '    --ui-accessibility-results <canonical-json> \\',
    '    --beta-release-id <release-id>',
  ].join('\n');
}

function clone(value) {
  return structuredClone(value);
}

function makeProtocol() {
  return {
    schema_version: governance.SCHEMA_VERSION,
    protocol_id: governance.REVIEW_PROTOCOL_ID,
    status: 'frozen',
    repository: governance.REPOSITORY,
    product_tier: governance.PRODUCT_TIER,
    reviewer_role: governance.REVIEWER_ROLE,
    protocol_owner_identity: 'urn:elu:ephemeral:governance-protocol-owner',
    frozen_at: '2040-01-01T00:00:00.000Z',
    decision_reference: 'urn:elu:ephemeral:governance-protocol-decision',
    browser_matrix: [
      {
        matrix_id: 'matrix-desktop-keyboard',
        browser: { name: 'Ephemeral Browser Alpha', version: '100.0' },
        operating_system: { name: 'Ephemeral Desktop OS', version: '10.0' },
        device: { class: 'desktop', model: 'Ephemeral desktop fixture' },
        viewport: { width_css_px: 1440, height_css_px: 900, device_pixel_ratio: 1 },
        input_modes: ['keyboard', 'pointer'],
        screen_reader: null,
      },
      {
        matrix_id: 'matrix-mobile-screenreader',
        browser: { name: 'Ephemeral Browser Beta', version: '101.0' },
        operating_system: { name: 'Ephemeral Mobile OS', version: '11.0' },
        device: { class: 'mobile', model: 'Ephemeral mobile fixture' },
        viewport: { width_css_px: 390, height_css_px: 844, device_pixel_ratio: 3 },
        input_modes: ['keyboard', 'touch'],
        screen_reader: { name: 'Ephemeral Screen Reader', version: '12.0' },
      },
    ],
    required_checks: [
      {
        check_id: 'check-focus-visibility',
        category: 'focus',
        coverage_rule: 'all_matrix_rows',
        procedure: 'Traverse every interactive control and observe focus placement and visibility.',
        pass_criteria: 'Focus remains visible, ordered, persistent, and never becomes trapped or lost.',
        evidence_required: true,
      },
      {
        check_id: 'check-forced-colors-rendering',
        category: 'forced_colors',
        coverage_rule: 'all_matrix_rows',
        procedure: 'Enable forced-colors mode and inspect content, controls, state, and focus cues.',
        pass_criteria: 'All content, controls, states, and focus cues remain perceivable and operable.',
        evidence_required: true,
      },
      {
        check_id: 'check-keyboard-operation',
        category: 'keyboard',
        coverage_rule: 'all_matrix_rows',
        procedure: 'Operate every interactive path using only standard keyboard navigation commands.',
        pass_criteria: 'Every action is reachable and operable without pointer input or keyboard traps.',
        evidence_required: true,
      },
      {
        check_id: 'check-reduced-motion-behavior',
        category: 'reduced_motion',
        coverage_rule: 'all_matrix_rows',
        procedure: 'Enable reduced motion and trigger each transition, animation, and state change.',
        pass_criteria: 'Nonessential motion is removed while information and interaction remain complete.',
        evidence_required: true,
      },
      {
        check_id: 'check-screen-reader-semantics',
        category: 'screen_reader',
        coverage_rule: 'screen_reader_matrix_rows',
        procedure: 'Navigate headings, landmarks, controls, notices, and data with the named screen reader.',
        pass_criteria: 'Names, roles, states, reading order, notices, and factual data are announced clearly.',
        evidence_required: true,
      },
      {
        check_id: 'check-zoom-reflow',
        category: 'zoom',
        coverage_rule: 'all_matrix_rows',
        procedure: 'Increase browser zoom to the frozen review level and inspect reflow and operation.',
        pass_criteria: 'Content reflows without loss, overlap, clipped controls, or two-axis reading.',
        evidence_required: true,
      },
    ],
    comprehension_prompts: [
      {
        prompt_id: 'prompt-beta-boundary',
        prompt_text: 'Explain what the public beta can and cannot claim about a country climate record.',
        required_concepts: ['concept-factual-only', 'concept-no-assessment'],
        minimum_concepts_required: 2,
        critical_misunderstanding_terms: ['official ranking', 'performance score'],
      },
      {
        prompt_id: 'prompt-source-limitations',
        prompt_text: 'Describe where the displayed values come from and how known gaps are communicated.',
        required_concepts: ['concept-known-gaps', 'concept-source-provenance'],
        minimum_concepts_required: 2,
        critical_misunderstanding_terms: ['complete official inventory', 'verified national target'],
      },
    ],
    comprehension_pass_criteria: {
      minimum_completed_sessions: 2,
      minimum_session_pass_rate_basis_points: 10000,
      maximum_critical_misunderstandings: 0,
      all_prompts_required: true,
    },
    severity_taxonomy: [
      {
        severity: 'critical',
        definition: 'A condition causing harmful false claims, material exposure, or inaccessible core use.',
        release_effect: 'no_go',
        triage_target_seconds: 300,
      },
      {
        severity: 'high',
        definition: 'A serious failure of required access, comprehension, privacy, or factual presentation.',
        release_effect: 'no_go',
        triage_target_seconds: 600,
      },
      {
        severity: 'low',
        definition: 'A minor issue that does not prevent access, comprehension, safety, or factual use.',
        release_effect: 'track',
        triage_target_seconds: 3600,
      },
      {
        severity: 'medium',
        definition: 'A bounded issue with a documented workaround and no material user harm.',
        release_effect: 'conditional',
        triage_target_seconds: 1800,
      },
    ],
    no_go_severities: ['critical', 'high'],
    invited_review: {
      duration_seconds: 3600,
      minimum_reviewers: 2,
      minimum_sessions: 2,
      minimum_accessibility_sessions: 1,
      authorized_access_probe_count: 2,
      unauthorized_access_probe_count: 2,
    },
    monitoring: {
      window_seconds: 3600,
      cadence_seconds: 300,
      minimum_probe_cycles: 13,
    },
    withdrawal: {
      acknowledgement_target_seconds: 300,
      execution_target_seconds: 900,
      verification_target_seconds: 1200,
    },
    assessed_production_authority: false,
  };
}

function makePrivacyContract() {
  return {
    schema_version: governance.SCHEMA_VERSION,
    contract_id: governance.PRIVACY_CONTRACT_ID,
    status: 'frozen',
    repository: governance.REPOSITORY,
    product_tier: governance.PRODUCT_TIER,
    accountable_owner: {
      identity: 'urn:elu:ephemeral:feedback-accountable-owner',
      role: 'Ephemeral feedback and privacy owner',
      contact_url: 'https://governance.invalid/accountable-owner',
    },
    controller: {
      legal_name: 'Ephemeral Earth Love United Controller',
      jurisdiction: 'Ephemeral fixture jurisdiction',
      contact_url: 'https://governance.invalid/controller',
    },
    processors: [
      {
        processor_id: 'processor-ephemeral-feedback',
        provider_name: 'Ephemeral Feedback Processor',
        service_purpose: 'Receive and protect invited feedback for this in-process validation fixture.',
        privacy_url: 'https://processor.invalid/privacy',
        data_location: 'Ephemeral isolated fixture region',
        subprocessor_reference: 'urn:elu:ephemeral:processor-subprocessor-inventory',
      },
    ],
    feedback_url: 'https://feedback.invalid/submit',
    privacy_notice_url: 'https://feedback.invalid/privacy',
    feedback_collection: {
      collected_fields: [
        {
          field_id: 'field-category',
          purpose_id: 'purpose-error-triage',
          required: true,
          personal_data: false,
          public_display_allowed: true,
        },
        {
          field_id: 'field-comment',
          purpose_id: 'purpose-beta-improvement',
          required: true,
          personal_data: false,
          public_display_allowed: true,
        },
        {
          field_id: 'field-contact',
          purpose_id: 'purpose-error-triage',
          required: false,
          personal_data: true,
          public_display_allowed: false,
        },
      ],
      allowed_purposes: [
        {
          purpose_id: 'purpose-beta-improvement',
          description: 'Understand usability and comprehension feedback for bounded beta improvements.',
        },
        {
          purpose_id: 'purpose-error-triage',
          description: 'Investigate factual, accessibility, privacy, abuse, and security reports safely.',
        },
      ],
      free_text_enabled: true,
      sensitive_data_prohibited: true,
      identity_collection_required: false,
    },
    anonymity: {
      anonymous_submission_available: true,
      identity_fields_optional: true,
      anonymous_submissions_unlinked: true,
      public_identity_disclosure_prohibited: true,
    },
    consent: {
      consent_model: 'explicit_opt_in',
      consent_text_reference: 'urn:elu:ephemeral:feedback-consent-text',
      consent_withdrawal_url: 'https://feedback.invalid/consent-withdrawal',
      consent_record_retained: true,
    },
    retention: {
      primary_retention_seconds: 2592000,
      deletion_completion_target_seconds: 604800,
      backup_expiry_seconds: 1209600,
      legal_hold_reference: 'urn:elu:ephemeral:feedback-legal-hold-rule',
    },
    data_subject_requests: {
      access_request_url: 'https://feedback.invalid/request-access',
      deletion_request_url: 'https://feedback.invalid/request-deletion',
      redaction_request_url: 'https://feedback.invalid/request-redaction',
      acknowledgement_target_seconds: 86400,
      response_target_seconds: 2592000,
    },
    abuse_and_privacy_requests: {
      abuse_report_url: 'https://feedback.invalid/report-abuse',
      privacy_request_url: 'https://feedback.invalid/privacy-request',
      triage_target_seconds: 3600,
      escalation_target_seconds: 14400,
    },
    security_route_reference: {
      route_url: 'https://feedback.invalid/security-report',
      public_safe_description: 'Submit a minimal security report through the controlled public intake route.',
      sensitive_details_prohibited: true,
    },
    correction_and_withdrawal: {
      correction_request_url: 'https://feedback.invalid/request-correction',
      public_correction_log_url: 'https://feedback.invalid/corrections',
      withdrawal_request_url: 'https://feedback.invalid/request-withdrawal',
      immutable_release_for_corrections_required: true,
      public_correction_log_required: true,
      confirmed_harm_withdrawal_target_seconds: 900,
      correction_rule: 'Confirmed factual corrections require a new immutable beta release and public correction record.',
      withdrawal_rule: 'Confirmed material harm triggers controlled withdrawal, verification, and a recorded disposition.',
    },
    frozen_at: '2040-01-01T00:00:00.000Z',
    decision_reference: 'urn:elu:ephemeral:feedback-privacy-decision',
    assessed_production_authority: false,
  };
}

function makeResults(protocol, privacyContract) {
  const results = {
    schema_version: governance.SCHEMA_VERSION,
    results_id: `elu-climate-public-beta-${RELEASE_ID}-ui-accessibility-v1`,
    status: 'completed',
    repository: governance.REPOSITORY,
    product_tier: governance.PRODUCT_TIER,
    beta_release_id: RELEASE_ID,
    publication_level: 'invited_beta',
    reviewed_commit_sha: 'a'.repeat(40),
    review_protocol_id: protocol.protocol_id,
    review_protocol_sha256: governance.hashCanonical(protocol),
    feedback_privacy_contract_id: privacyContract.contract_id,
    feedback_privacy_contract_sha256: governance.hashCanonical(privacyContract),
    started_at: STARTED_AT,
    completed_at: COMPLETED_AT,
    reviewer_identity: 'urn:elu:ephemeral:independent-ui-accessibility-reviewer',
    session_summaries: [
      {
        session_id: 'session-desktop-review',
        reviewer_reference: 'reviewer:1111111111111111',
        started_at: '2040-01-02T12:05:00.000Z',
        completed_at: '2040-01-02T12:55:00.000Z',
        matrix_ids: ['matrix-desktop-keyboard'],
        accessibility_session: false,
        evidence_reference: 'urn:elu:ephemeral:session-desktop-evidence',
      },
      {
        session_id: 'session-mobile-review',
        reviewer_reference: 'reviewer:2222222222222222',
        started_at: '2040-01-02T13:00:00.000Z',
        completed_at: '2040-01-02T13:55:00.000Z',
        matrix_ids: ['matrix-mobile-screenreader'],
        accessibility_session: true,
        evidence_reference: 'urn:elu:ephemeral:session-mobile-evidence',
      },
    ],
    matrix_check_results: governance.expectedMatrixCases(protocol).map(item => ({
      ...item,
      outcome: 'pass',
      finding_ids: [],
      observed_at: '2040-01-02T13:30:00.000Z',
      evidence_reference: `urn:elu:ephemeral:${item.case_id}:evidence`,
    })),
    comprehension_sessions: [
      {
        session_id: 'session-desktop-review',
        prompt_results: protocol.comprehension_prompts.map(prompt => ({
          prompt_id: prompt.prompt_id,
          identified_concepts: [...prompt.required_concepts],
          critical_misunderstanding_detected: false,
          passed: true,
        })),
        session_passed: true,
      },
      {
        session_id: 'session-mobile-review',
        prompt_results: protocol.comprehension_prompts.map(prompt => ({
          prompt_id: prompt.prompt_id,
          identified_concepts: [...prompt.required_concepts],
          critical_misunderstanding_detected: false,
          passed: true,
        })),
        session_passed: true,
      },
    ],
    findings: [],
    aggregate: null,
    result: 'review_complete_no_go_clear',
    assessed_production_authority: false,
    calculation_hash: null,
  };
  results.aggregate = governance.deriveResultsAggregate(protocol, results);
  results.calculation_hash = governance.calculationHash(results);
  return results;
}

function recalculate(protocol, results) {
  results.aggregate = governance.deriveResultsAggregate(protocol, results);
  results.calculation_hash = governance.calculationHash(results);
  return results;
}

function expectReject(label, action) {
  assert.throws(action, undefined, `${label} must fail closed`);
}

function runSelfTest() {
  const schemas = governance.loadSchemas(ROOT);
  const protocol = makeProtocol();
  const privacyContract = makePrivacyContract();
  const results = makeResults(protocol, privacyContract);
  let positiveCases = 0;
  let failClosedCases = 0;

  assert.equal(governance.validateReviewProtocol(protocol, { schema: schemas.reviewProtocol }).status, 'pass');
  positiveCases += 1;
  assert.equal(governance.validateFeedbackPrivacyContract(privacyContract,
    { schema: schemas.feedbackPrivacy }).status, 'pass');
  positiveCases += 1;
  assert.equal(governance.validateUiAccessibilityResults(results, {
    protocol,
    privacyContract,
    schemas,
    betaReleaseId: RELEASE_ID,
  }).status, 'pass');
  positiveCases += 1;
  const combined = governance.validateGovernanceContracts({
    protocol,
    privacyContract,
    results,
    schemas,
    betaReleaseId: RELEASE_ID,
  });
  assert.equal(combined.status, 'pass');
  assert.equal(combined.human_authority, false);
  assert.equal(combined.publication_authority, false);
  assert.equal(combined.assessed_production_authority, false);
  positiveCases += 1;

  const protocolMutations = [
    ['protocol unexpected field', value => { value.unexpected = true; }],
    ['protocol assessed authority', value => { value.assessed_production_authority = true; }],
    ['protocol invalid freeze timestamp', value => { value.frozen_at = '2040-01-01'; }],
    ['protocol placeholder decision', value => { value.decision_reference = 'TODO placeholder decision'; }],
    ['protocol unsorted matrix', value => { value.browser_matrix.reverse(); }],
    ['protocol duplicate matrix ID', value => { value.browser_matrix[1].matrix_id = value.browser_matrix[0].matrix_id; }],
    ['protocol missing screen reader', value => { value.browser_matrix[1].screen_reader = null; }],
    ['protocol invalid viewport', value => { value.browser_matrix[0].viewport.width_css_px = 100; }],
    ['protocol unsorted input modes', value => { value.browser_matrix[0].input_modes.reverse(); }],
    ['protocol missing required category', value => { value.required_checks.pop(); }],
    ['protocol screen-reader coverage drift', value => { value.required_checks[4].coverage_rule = 'all_matrix_rows'; }],
    ['protocol short procedure', value => { value.required_checks[0].procedure = 'short'; }],
    ['protocol unsorted checks', value => { value.required_checks.reverse(); }],
    ['protocol unsorted prompt concepts', value => { value.comprehension_prompts[0].required_concepts.reverse(); }],
    ['protocol permits critical misunderstanding', value => {
      value.comprehension_pass_criteria.maximum_critical_misunderstandings = 1;
    }],
    ['protocol unsorted taxonomy', value => { value.severity_taxonomy.reverse(); }],
    ['protocol no-go missing critical', value => { value.no_go_severities = ['high']; }],
    ['protocol release effect mismatch', value => { value.severity_taxonomy[1].release_effect = 'conditional'; }],
    ['protocol inconsistent session minima', value => { value.invited_review.minimum_sessions = 1; }],
    ['protocol inconsistent monitoring cycles', value => { value.monitoring.minimum_probe_cycles = 12; }],
    ['protocol unordered withdrawal targets', value => { value.withdrawal.execution_target_seconds = 100; }],
  ];
  protocolMutations.forEach(([label, mutate]) => {
    const value = clone(protocol);
    mutate(value);
    expectReject(label, () => governance.validateReviewProtocol(value, { schema: schemas.reviewProtocol }));
    failClosedCases += 1;
  });

  const privacyMutations = [
    ['privacy unexpected field', value => { value.unexpected = true; }],
    ['privacy assessed authority', value => { value.assessed_production_authority = true; }],
    ['privacy invalid freeze timestamp', value => { value.frozen_at = 'not-a-time'; }],
    ['privacy placeholder decision', value => { value.decision_reference = 'placeholder legal decision'; }],
    ['privacy feedback URL query', value => { value.feedback_url += '?source=fixture'; }],
    ['privacy duplicate feedback/privacy URL', value => { value.privacy_notice_url = value.feedback_url; }],
    ['privacy missing processor', value => { value.processors = []; }],
    ['privacy unsorted processors', value => {
      value.processors.push({ ...clone(value.processors[0]), processor_id: 'processor-alpha-fixture' });
    }],
    ['privacy personal field public', value => {
      value.feedback_collection.collected_fields[2].public_display_allowed = true;
    }],
    ['privacy unknown purpose', value => {
      value.feedback_collection.collected_fields[0].purpose_id = 'purpose-missing';
    }],
    ['privacy unsorted fields', value => { value.feedback_collection.collected_fields.reverse(); }],
    ['privacy permits sensitive data', value => { value.feedback_collection.sensitive_data_prohibited = false; }],
    ['privacy anonymity mismatch', value => { value.anonymity.identity_fields_optional = false; }],
    ['privacy required personal field while anonymous', value => {
      value.feedback_collection.collected_fields[2].required = true;
    }],
    ['privacy consent model mismatch', value => { value.consent.consent_model = 'no_personal_data'; }],
    ['privacy consent retention mismatch', value => { value.consent.consent_record_retained = false; }],
    ['privacy backup expiry too short', value => { value.retention.backup_expiry_seconds = 1; }],
    ['privacy request targets reversed', value => {
      value.data_subject_requests.response_target_seconds = 1;
    }],
    ['privacy abuse targets reversed', value => {
      value.abuse_and_privacy_requests.escalation_target_seconds = 1;
    }],
    ['privacy security description exposes contact', value => {
      value.security_route_reference.public_safe_description =
        'Send sensitive security details directly to person@fixture.invalid for immediate review.';
    }],
    ['privacy correction immutability disabled', value => {
      value.correction_and_withdrawal.immutable_release_for_corrections_required = false;
    }],
    ['privacy correction rule too short', value => {
      value.correction_and_withdrawal.correction_rule = 'replace it';
    }],
  ];
  privacyMutations.forEach(([label, mutate]) => {
    const value = clone(privacyContract);
    mutate(value);
    expectReject(label, () => governance.validateFeedbackPrivacyContract(value,
      { schema: schemas.feedbackPrivacy }));
    failClosedCases += 1;
  });

  const resultMutations = [
    ['results unexpected field', value => { value.unexpected = true; }],
    ['results assessed authority', value => { value.assessed_production_authority = true; }],
    ['results release mismatch', value => { value.beta_release_id = 'different-beta-release'; }],
    ['results ID mismatch', value => { value.results_id = 'elu-climate-public-beta-wrong-ui-accessibility-v1'; }],
    ['results invalid commit', value => { value.reviewed_commit_sha = 'a'.repeat(39); }],
    ['results protocol hash drift', value => { value.review_protocol_sha256 = 'b'.repeat(64); }],
    ['results privacy hash drift', value => { value.feedback_privacy_contract_sha256 = 'c'.repeat(64); }],
    ['results reviewer not independent', value => { value.reviewer_identity = protocol.protocol_owner_identity; }],
    ['results unsorted sessions', value => { value.session_summaries.reverse(); }],
    ['results reviewer minimum not met', value => {
      value.session_summaries[1].reviewer_reference = value.session_summaries[0].reviewer_reference;
      recalculate(protocol, value);
    }],
    ['results invalid session time', value => {
      value.session_summaries[0].started_at = '2039-01-01T00:00:00.000Z';
    }],
    ['results incomplete session matrix coverage', value => {
      value.session_summaries[1].matrix_ids = ['matrix-desktop-keyboard'];
      value.session_summaries[1].accessibility_session = false;
      recalculate(protocol, value);
    }],
    ['results accessibility flag drift', value => { value.session_summaries[1].accessibility_session = false; }],
    ['results omitted matrix case', value => {
      value.matrix_check_results.pop();
      recalculate(protocol, value);
    }],
    ['results unsorted matrix cases', value => { value.matrix_check_results.reverse(); }],
    ['results case identity drift', value => { value.matrix_check_results[0].case_id = 'wrong-case-id'; }],
    ['results outcome finding mismatch', value => { value.matrix_check_results[0].outcome = 'finding_recorded'; }],
    ['results unknown finding reference', value => {
      value.matrix_check_results[0].finding_ids = ['finding-1111111111111111'];
      value.matrix_check_results[0].outcome = 'finding_recorded';
    }],
    ['results unreferenced finding', value => {
      value.findings.push({
        finding_id: 'finding-1111111111111111',
        severity: 'low',
        status: 'open',
        summary: 'An ephemeral nonblocking finding that is intentionally left unreferenced.',
        evidence_reference: 'urn:elu:ephemeral:unreferenced-finding-evidence',
        reported_at: '2040-01-02T13:20:00.000Z',
        resolved_at: null,
      });
      recalculate(protocol, value);
    }],
    ['results open no-go finding', value => {
      value.findings.push({
        finding_id: 'finding-1111111111111111',
        severity: 'critical',
        status: 'open',
        summary: 'An ephemeral critical finding that must prevent no-go clearance.',
        evidence_reference: 'urn:elu:ephemeral:critical-finding-evidence',
        reported_at: '2040-01-02T13:20:00.000Z',
        resolved_at: null,
      });
      value.matrix_check_results[0].finding_ids = ['finding-1111111111111111'];
      value.matrix_check_results[0].outcome = 'finding_recorded';
      recalculate(protocol, value);
    }],
    ['results missing comprehension session', value => {
      value.comprehension_sessions.pop();
      recalculate(protocol, value);
    }],
    ['results unsorted comprehension prompts', value => {
      value.comprehension_sessions[0].prompt_results.reverse();
    }],
    ['results unknown comprehension concept', value => {
      value.comprehension_sessions[0].prompt_results[0].identified_concepts = ['concept-not-in-protocol'];
    }],
    ['results prompt pass calculation drift', value => {
      value.comprehension_sessions[0].prompt_results[0].passed = false;
    }],
    ['results critical misunderstanding', value => {
      value.comprehension_sessions[0].prompt_results[0].critical_misunderstanding_detected = true;
      value.comprehension_sessions[0].prompt_results[0].passed = false;
      value.comprehension_sessions[0].session_passed = false;
      recalculate(protocol, value);
    }],
    ['results aggregate drift', value => { value.aggregate.completed_session_count += 1; }],
    ['results invalid result state', value => { value.result = 'publication_approved'; }],
    ['results calculation hash drift', value => { value.calculation_hash = 'd'.repeat(64); }],
    ['results insufficient invited duration', value => {
      value.completed_at = '2040-01-02T12:30:00.000Z';
      value.session_summaries[0].completed_at = '2040-01-02T12:25:00.000Z';
      value.session_summaries[1].started_at = '2040-01-02T12:10:00.000Z';
      value.session_summaries[1].completed_at = '2040-01-02T12:25:00.000Z';
      value.matrix_check_results.forEach(item => { item.observed_at = '2040-01-02T12:20:00.000Z'; });
      recalculate(protocol, value);
    }],
    ['results invalid publication level', value => { value.publication_level = 'assessed_production'; }],
  ];
  resultMutations.forEach(([label, mutate]) => {
    const value = clone(results);
    mutate(value);
    expectReject(label, () => governance.validateUiAccessibilityResults(value, {
      protocol,
      privacyContract,
      schemas,
      betaReleaseId: RELEASE_ID,
    }));
    failClosedCases += 1;
  });

  const failedCombined = governance.validateGovernanceContracts({
    protocol,
    privacyContract,
    results: { ...results, calculation_hash: 'e'.repeat(64) },
    schemas,
    betaReleaseId: RELEASE_ID,
  });
  assert.equal(failedCombined.status, 'fail');
  assert.deepEqual(failedCombined.failure_ids, ['ui-accessibility-results-valid']);
  assert.equal(failedCombined.human_authority, false);
  failClosedCases += 1;

  return {
    status: 'pass',
    positive_cases: positiveCases,
    fail_closed_cases: failClosedCases,
    fixture_scope: 'in_process_ephemeral_only',
    fixture_values_are_not_production_evidence: true,
    human_authority: false,
    publication_authority: false,
    assessed_production_authority: false,
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--self-test') {
      options.selfTest = true;
      continue;
    }
    const keyByFlag = {
      '--review-protocol': 'reviewProtocol',
      '--feedback-privacy-contract': 'feedbackPrivacyContract',
      '--ui-accessibility-results': 'uiAccessibilityResults',
      '--beta-release-id': 'betaReleaseId',
    };
    const key = keyByFlag[arg];
    if (!key || index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
      throw new Error(`invalid or incomplete argument: ${arg}`);
    }
    assert(options[key] === undefined, `duplicate argument: ${arg}`);
    options[key] = argv[index + 1];
    index += 1;
  }
  return options;
}

function readCanonicalArtifact(filePath, label) {
  const absolute = path.resolve(filePath);
  const stat = fs.lstatSync(absolute);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular non-symlink file`);
  const bytes = fs.readFileSync(absolute);
  assert(bytes.length > 0 && bytes.length <= 2097152, `${label} has invalid size`);
  let value;
  try { value = parseJsonNoDuplicateKeys(bytes.toString('utf8'), label); }
  catch (error) { throw new Error(`${label} is invalid JSON: ${error.message}`); }
  assert(bytes.equals(Buffer.from(governance.serializeCanonical(value), 'utf8')),
    `${label} must use stable-key canonical two-space JSON plus one trailing newline`);
  return value;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.selfTest) {
      assert.equal(Object.keys(options).length, 1, '--self-test cannot be combined with artifact arguments');
      process.stdout.write(JSON.stringify(runSelfTest(), null, 2) + '\n');
      return;
    }
    const required = [
      'reviewProtocol', 'feedbackPrivacyContract', 'uiAccessibilityResults', 'betaReleaseId',
    ];
    if (!required.every(key => options[key]) || Object.keys(options).length !== required.length) {
      throw new Error(usage());
    }
    const schemas = governance.loadSchemas(ROOT);
    const report = governance.validateGovernanceContracts({
      protocol: readCanonicalArtifact(options.reviewProtocol, 'review protocol'),
      privacyContract: readCanonicalArtifact(options.feedbackPrivacyContract, 'feedback/privacy contract'),
      results: readCanonicalArtifact(options.uiAccessibilityResults, 'UI/accessibility results'),
      schemas,
      betaReleaseId: options.betaReleaseId,
    });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (report.status !== 'pass') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(JSON.stringify({
      status: 'fail',
      error: error.message,
      human_authority: false,
      publication_authority: false,
      assessed_production_authority: false,
    }, null, 2) + '\n');
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  makeProtocol,
  makePrivacyContract,
  makeResults,
  runSelfTest,
};
