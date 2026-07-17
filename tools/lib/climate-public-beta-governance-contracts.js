'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseJsonNoDuplicateKeys,
  same,
  stable,
  validateJsonSchema,
} = require('./json-schema-lite');

const SCHEMA_VERSION = '1.0.0';
const REPOSITORY = 'earth-love-united/earthloveunited.org';
const PRODUCT_TIER = 'climate_public_beta';
const REVIEWER_ROLE = 'beta_ui_accessibility_reviewer';
const REVIEW_PROTOCOL_ID = 'elu-climate-public-beta-review-protocol-v1';
const PRIVACY_CONTRACT_ID = 'elu-climate-public-beta-feedback-privacy-v1';
const MATRIX_CATEGORIES = Object.freeze([
  'focus', 'forced_colors', 'keyboard', 'reduced_motion', 'screen_reader', 'zoom',
]);
const NO_AUTHORITY = Object.freeze({
  human_authority: false,
  publication_authority: false,
  assessed_production_authority: false,
});
const SCHEMA_PATHS = Object.freeze({
  reviewProtocol: 'data/climate/public-beta/schemas/climate-public-beta-review-protocol.schema.json',
  feedbackPrivacy: 'data/climate/public-beta/schemas/climate-public-beta-feedback-privacy-contract.schema.json',
  uiAccessibilityResults: 'data/climate/public-beta/schemas/climate-public-beta-ui-accessibility-results.schema.json',
});

const PROTOCOL_KEYS = sorted([
  'schema_version', 'protocol_id', 'status', 'repository', 'product_tier',
  'reviewer_role', 'protocol_owner_identity', 'frozen_at', 'decision_reference',
  'browser_matrix', 'required_checks', 'comprehension_prompts',
  'comprehension_pass_criteria', 'severity_taxonomy', 'no_go_severities',
  'invited_review', 'monitoring', 'withdrawal', 'assessed_production_authority',
]);
const MATRIX_KEYS = sorted([
  'matrix_id', 'browser', 'operating_system', 'device', 'viewport',
  'input_modes', 'screen_reader',
]);
const NAME_VERSION_KEYS = sorted(['name', 'version']);
const DEVICE_KEYS = sorted(['class', 'model']);
const VIEWPORT_KEYS = sorted([
  'width_css_px', 'height_css_px', 'device_pixel_ratio',
]);
const CHECK_KEYS = sorted([
  'check_id', 'category', 'coverage_rule', 'procedure', 'pass_criteria',
  'evidence_required',
]);
const PROMPT_KEYS = sorted([
  'prompt_id', 'prompt_text', 'required_concepts',
  'minimum_concepts_required', 'critical_misunderstanding_terms',
]);
const COMPREHENSION_CRITERIA_KEYS = sorted([
  'minimum_completed_sessions', 'minimum_session_pass_rate_basis_points',
  'maximum_critical_misunderstandings', 'all_prompts_required',
]);
const SEVERITY_KEYS = sorted([
  'severity', 'definition', 'release_effect', 'triage_target_seconds',
]);
const INVITED_KEYS = sorted([
  'duration_seconds', 'minimum_reviewers', 'minimum_sessions',
  'minimum_accessibility_sessions', 'authorized_access_probe_count',
  'unauthorized_access_probe_count',
]);
const MONITORING_KEYS = sorted([
  'window_seconds', 'cadence_seconds', 'minimum_probe_cycles',
]);
const WITHDRAWAL_KEYS = sorted([
  'acknowledgement_target_seconds', 'execution_target_seconds',
  'verification_target_seconds',
]);

const PRIVACY_KEYS = sorted([
  'schema_version', 'contract_id', 'status', 'repository', 'product_tier',
  'accountable_owner', 'controller', 'processors', 'feedback_url',
  'privacy_notice_url', 'feedback_collection', 'anonymity', 'consent',
  'retention', 'data_subject_requests', 'abuse_and_privacy_requests',
  'security_route_reference', 'correction_and_withdrawal', 'frozen_at',
  'decision_reference', 'assessed_production_authority',
]);
const OWNER_KEYS = sorted(['identity', 'role', 'contact_url']);
const CONTROLLER_KEYS = sorted(['legal_name', 'jurisdiction', 'contact_url']);
const PROCESSOR_KEYS = sorted([
  'processor_id', 'provider_name', 'service_purpose', 'privacy_url',
  'data_location', 'subprocessor_reference',
]);
const COLLECTION_KEYS = sorted([
  'collected_fields', 'allowed_purposes', 'free_text_enabled',
  'sensitive_data_prohibited', 'identity_collection_required',
]);
const FIELD_KEYS = sorted([
  'field_id', 'purpose_id', 'required', 'personal_data',
  'public_display_allowed',
]);
const PURPOSE_KEYS = sorted(['purpose_id', 'description']);
const ANONYMITY_KEYS = sorted([
  'anonymous_submission_available', 'identity_fields_optional',
  'anonymous_submissions_unlinked', 'public_identity_disclosure_prohibited',
]);
const CONSENT_KEYS = sorted([
  'consent_model', 'consent_text_reference', 'consent_withdrawal_url',
  'consent_record_retained',
]);
const RETENTION_KEYS = sorted([
  'primary_retention_seconds', 'deletion_completion_target_seconds',
  'backup_expiry_seconds', 'legal_hold_reference',
]);
const REQUEST_KEYS = sorted([
  'access_request_url', 'deletion_request_url', 'redaction_request_url',
  'acknowledgement_target_seconds', 'response_target_seconds',
]);
const ABUSE_KEYS = sorted([
  'abuse_report_url', 'privacy_request_url', 'triage_target_seconds',
  'escalation_target_seconds',
]);
const SECURITY_KEYS = sorted([
  'route_url', 'public_safe_description', 'sensitive_details_prohibited',
]);
const CORRECTION_KEYS = sorted([
  'correction_request_url', 'public_correction_log_url',
  'withdrawal_request_url', 'immutable_release_for_corrections_required',
  'public_correction_log_required', 'confirmed_harm_withdrawal_target_seconds',
  'correction_rule', 'withdrawal_rule',
]);

const RESULTS_KEYS = sorted([
  'schema_version', 'results_id', 'status', 'repository', 'product_tier',
  'beta_release_id', 'publication_level', 'reviewed_commit_sha',
  'review_protocol_id', 'review_protocol_sha256',
  'feedback_privacy_contract_id', 'feedback_privacy_contract_sha256',
  'started_at', 'completed_at', 'reviewer_identity', 'session_summaries',
  'matrix_check_results', 'comprehension_sessions', 'findings', 'aggregate',
  'result', 'assessed_production_authority', 'calculation_hash',
]);
const SESSION_KEYS = sorted([
  'session_id', 'reviewer_reference', 'started_at', 'completed_at',
  'matrix_ids', 'accessibility_session', 'evidence_reference',
]);
const MATRIX_RESULT_KEYS = sorted([
  'case_id', 'matrix_id', 'check_id', 'outcome', 'finding_ids',
  'observed_at', 'evidence_reference',
]);
const COMPREHENSION_SESSION_KEYS = sorted([
  'session_id', 'prompt_results', 'session_passed',
]);
const PROMPT_RESULT_KEYS = sorted([
  'prompt_id', 'identified_concepts', 'critical_misunderstanding_detected',
  'passed',
]);
const FINDING_KEYS = sorted([
  'finding_id', 'severity', 'status', 'summary', 'evidence_reference',
  'reported_at', 'resolved_at',
]);
const AGGREGATE_KEYS = sorted([
  'unique_reviewer_count', 'completed_session_count',
  'accessibility_session_count', 'matrix_case_count',
  'matrix_case_pass_count', 'open_no_go_finding_count',
  'comprehension_session_count', 'comprehension_session_pass_count',
  'comprehension_pass_rate_basis_points', 'critical_misunderstanding_count',
  'invited_duration_observed_seconds',
  'all_matrix_and_check_coverage_complete', 'minimums_satisfied',
  'no_go_clear',
]);

function sorted(values) {
  return Object.freeze(values.slice().sort());
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function serializeCanonical(value) {
  return JSON.stringify(stable(value), null, 2) + '\n';
}

function hashBytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashCanonical(value) {
  return hashBytes(Buffer.from(serializeCanonical(value), 'utf8'));
}

function calculationHash(results) {
  const clone = structuredClone(results);
  clone.calculation_hash = null;
  return hashCanonical(clone);
}

function exactKeys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert(same(Object.keys(value).sort(), expected), `${label} has unexpected or missing fields`);
}

function sortedUniqueStrings(values, label, options = {}) {
  assert(Array.isArray(values), `${label} must be an array`);
  if (options.minimum !== undefined) assert(values.length >= options.minimum, `${label} is too short`);
  if (options.maximum !== undefined) assert(values.length <= options.maximum, `${label} is too long`);
  assert(values.every(value => typeof value === 'string' && value === value.trim() && value.length > 0),
    `${label} must contain non-empty trimmed strings`);
  assert(new Set(values).size === values.length, `${label} contains duplicates`);
  assert(same(values, values.slice().sort()), `${label} must be sorted`);
}

function validReleaseId(value) {
  return typeof value === 'string' && /^(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/.test(value);
}

function validId(value, prefix) {
  return typeof value === 'string' && new RegExp(`^${prefix}[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$`).test(value);
}

function validTimestamp(value) {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function validReference(value) {
  return typeof value === 'string' && value === value.trim() && value.length >= 5 && value.length <= 512 &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    !/(?:^|[\s@._-])(?:fake|invented|unknown|example|placeholder|tbd|todo)(?:$|[\s@._-])/i.test(value);
}

function validIdentity(value) {
  return validReference(value) && value.length <= 256;
}

function validText(value, minimum = 20, maximum = 2000) {
  return typeof value === 'string' && value === value.trim() &&
    value.length >= minimum && value.length <= maximum &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function validHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
      !parsed.search && !parsed.hash && parsed.toString() === value;
  } catch (_) {
    return false;
  }
}

function validPublicSafeText(value) {
  return validText(value, 20, 1000) &&
    !/(?:private[ _-]?key|secret|credential|password|bearer\s+|api[ _-]?key|\/Users\/|\/home\/|[A-Za-z]:\\)/i.test(value) &&
    !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(value);
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateSchema(value, schema, label) {
  if (!schema) return;
  const errors = validateJsonSchema(value, schema);
  assert(errors.length === 0, `${label} schema validation failed: ${errors.slice(0, 5).join('; ')}`);
}

function validateReviewProtocol(protocol, options = {}) {
  validateSchema(protocol, options.schema, 'review protocol');
  exactKeys(protocol, PROTOCOL_KEYS, 'review protocol');
  assert(protocol.schema_version === SCHEMA_VERSION && protocol.protocol_id === REVIEW_PROTOCOL_ID &&
    protocol.status === 'frozen' && protocol.repository === REPOSITORY &&
    protocol.product_tier === PRODUCT_TIER && protocol.reviewer_role === REVIEWER_ROLE,
  'review protocol identity or status mismatch');
  assert(protocol.assessed_production_authority === false,
    'review protocol cannot grant assessed production authority');
  assert(validIdentity(protocol.protocol_owner_identity), 'review protocol owner identity is invalid');
  assert(validTimestamp(protocol.frozen_at), 'review protocol frozen_at must be an exact UTC timestamp');
  assert(validReference(protocol.decision_reference), 'review protocol decision reference is invalid');

  assert(Array.isArray(protocol.browser_matrix) && protocol.browser_matrix.length >= 2,
    'review protocol requires at least two browser matrix rows');
  const matrixIds = [];
  let screenReaderRows = 0;
  protocol.browser_matrix.forEach((row, index) => {
    exactKeys(row, MATRIX_KEYS, `browser matrix row ${index}`);
    assert(validId(row.matrix_id, 'matrix-'), `browser matrix row ${index} has an invalid matrix_id`);
    exactKeys(row.browser, NAME_VERSION_KEYS, `browser matrix row ${row.matrix_id} browser`);
    exactKeys(row.operating_system, NAME_VERSION_KEYS,
      `browser matrix row ${row.matrix_id} operating system`);
    exactKeys(row.device, DEVICE_KEYS, `browser matrix row ${row.matrix_id} device`);
    exactKeys(row.viewport, VIEWPORT_KEYS, `browser matrix row ${row.matrix_id} viewport`);
    assert(validText(row.browser.name, 2, 100) && validText(row.browser.version, 1, 100) &&
      validText(row.operating_system.name, 2, 100) &&
      validText(row.operating_system.version, 1, 100),
    `browser matrix row ${row.matrix_id} has invalid browser/OS identity`);
    assert(['desktop', 'mobile', 'tablet'].includes(row.device.class) &&
      validText(row.device.model, 2, 100),
    `browser matrix row ${row.matrix_id} has an invalid device`);
    assert(Number.isInteger(row.viewport.width_css_px) && row.viewport.width_css_px >= 240 &&
      row.viewport.width_css_px <= 10000 && Number.isInteger(row.viewport.height_css_px) &&
      row.viewport.height_css_px >= 240 && row.viewport.height_css_px <= 10000 &&
      typeof row.viewport.device_pixel_ratio === 'number' &&
      Number.isFinite(row.viewport.device_pixel_ratio) && row.viewport.device_pixel_ratio >= 0.5 &&
      row.viewport.device_pixel_ratio <= 10,
    `browser matrix row ${row.matrix_id} has an invalid viewport`);
    sortedUniqueStrings(row.input_modes, `browser matrix row ${row.matrix_id} input modes`, { minimum: 1 });
    assert(row.input_modes.every(mode => ['keyboard', 'pointer', 'touch', 'voice'].includes(mode)),
      `browser matrix row ${row.matrix_id} has an unsupported input mode`);
    if (row.screen_reader !== null) {
      exactKeys(row.screen_reader, NAME_VERSION_KEYS, `browser matrix row ${row.matrix_id} screen reader`);
      assert(validText(row.screen_reader.name, 2, 100) && validText(row.screen_reader.version, 1, 100),
        `browser matrix row ${row.matrix_id} has an invalid screen reader`);
      screenReaderRows += 1;
    }
    matrixIds.push(row.matrix_id);
  });
  sortedUniqueStrings(matrixIds, 'browser matrix IDs', { minimum: 2 });
  assert(screenReaderRows >= 1, 'review protocol must include at least one screen-reader matrix row');

  assert(Array.isArray(protocol.required_checks) && protocol.required_checks.length >= MATRIX_CATEGORIES.length,
    'review protocol required-check catalog is incomplete');
  const checkIds = [];
  const categories = [];
  protocol.required_checks.forEach((check, index) => {
    exactKeys(check, CHECK_KEYS, `required check ${index}`);
    assert(validId(check.check_id, 'check-'), `required check ${index} has an invalid check_id`);
    assert(MATRIX_CATEGORIES.includes(check.category), `required check ${check.check_id} has an invalid category`);
    const wantedCoverage = check.category === 'screen_reader'
      ? 'screen_reader_matrix_rows' : 'all_matrix_rows';
    assert(check.coverage_rule === wantedCoverage,
      `required check ${check.check_id} has an invalid coverage rule`);
    assert(validText(check.procedure, 20, 2000) && validText(check.pass_criteria, 20, 2000) &&
      check.evidence_required === true,
    `required check ${check.check_id} has incomplete procedure/pass criteria`);
    checkIds.push(check.check_id);
    categories.push(check.category);
  });
  sortedUniqueStrings(checkIds, 'required check IDs', { minimum: MATRIX_CATEGORIES.length });
  assert(same([...new Set(categories)].sort(), [...MATRIX_CATEGORIES]),
    'review protocol must cover every required accessibility category');

  assert(Array.isArray(protocol.comprehension_prompts) && protocol.comprehension_prompts.length >= 1,
    'review protocol requires comprehension prompts');
  const promptIds = [];
  protocol.comprehension_prompts.forEach((prompt, index) => {
    exactKeys(prompt, PROMPT_KEYS, `comprehension prompt ${index}`);
    assert(validId(prompt.prompt_id, 'prompt-'), `comprehension prompt ${index} has an invalid prompt_id`);
    assert(validText(prompt.prompt_text, 20, 1000), `comprehension prompt ${prompt.prompt_id} text is invalid`);
    sortedUniqueStrings(prompt.required_concepts,
      `comprehension prompt ${prompt.prompt_id} required concepts`, { minimum: 1 });
    assert(prompt.required_concepts.every(concept => validId(concept, 'concept-')),
      `comprehension prompt ${prompt.prompt_id} has an invalid concept ID`);
    assert(Number.isInteger(prompt.minimum_concepts_required) && prompt.minimum_concepts_required >= 1 &&
      prompt.minimum_concepts_required <= prompt.required_concepts.length,
    `comprehension prompt ${prompt.prompt_id} has invalid minimum concepts`);
    sortedUniqueStrings(prompt.critical_misunderstanding_terms,
      `comprehension prompt ${prompt.prompt_id} critical terms`);
    assert(prompt.critical_misunderstanding_terms.every(term => validText(term, 2, 120)),
      `comprehension prompt ${prompt.prompt_id} has an invalid critical term`);
    promptIds.push(prompt.prompt_id);
  });
  sortedUniqueStrings(promptIds, 'comprehension prompt IDs', { minimum: 1 });

  exactKeys(protocol.comprehension_pass_criteria, COMPREHENSION_CRITERIA_KEYS,
    'comprehension pass criteria');
  const comprehension = protocol.comprehension_pass_criteria;
  assert(positiveInteger(comprehension.minimum_completed_sessions) &&
    Number.isInteger(comprehension.minimum_session_pass_rate_basis_points) &&
    comprehension.minimum_session_pass_rate_basis_points >= 1 &&
    comprehension.minimum_session_pass_rate_basis_points <= 10000 &&
    comprehension.maximum_critical_misunderstandings === 0 &&
    comprehension.all_prompts_required === true,
  'comprehension pass criteria are incomplete or unsafe');

  assert(Array.isArray(protocol.severity_taxonomy) && protocol.severity_taxonomy.length >= 2,
    'review protocol severity taxonomy is incomplete');
  const severities = [];
  const taxonomyBySeverity = new Map();
  protocol.severity_taxonomy.forEach((entry, index) => {
    exactKeys(entry, SEVERITY_KEYS, `severity taxonomy entry ${index}`);
    assert(['critical', 'high', 'medium', 'low'].includes(entry.severity),
      `severity taxonomy entry ${index} is invalid`);
    assert(validText(entry.definition, 20, 1000) &&
      ['no_go', 'conditional', 'track'].includes(entry.release_effect) &&
      positiveInteger(entry.triage_target_seconds),
    `severity taxonomy entry ${entry.severity} is incomplete`);
    severities.push(entry.severity);
    taxonomyBySeverity.set(entry.severity, entry);
  });
  sortedUniqueStrings(severities, 'severity taxonomy names', { minimum: 2 });
  assert(taxonomyBySeverity.has('critical'), 'severity taxonomy must define critical findings');
  sortedUniqueStrings(protocol.no_go_severities, 'no-go severities', { minimum: 1 });
  assert(protocol.no_go_severities.every(severity => taxonomyBySeverity.has(severity)) &&
    protocol.no_go_severities.includes('critical'),
  'no-go severity list must be a taxonomy subset containing critical');
  taxonomyBySeverity.forEach(entry => {
    assert((entry.release_effect === 'no_go') === protocol.no_go_severities.includes(entry.severity),
      `severity ${entry.severity} release effect disagrees with no-go list`);
  });
  const triageOrder = ['critical', 'high', 'medium', 'low'].filter(severity => taxonomyBySeverity.has(severity));
  for (let index = 1; index < triageOrder.length; index += 1) {
    assert(taxonomyBySeverity.get(triageOrder[index - 1]).triage_target_seconds <=
      taxonomyBySeverity.get(triageOrder[index]).triage_target_seconds,
    'higher-severity findings cannot have a slower triage target');
  }

  exactKeys(protocol.invited_review, INVITED_KEYS, 'invited review requirements');
  const invited = protocol.invited_review;
  Object.values(invited).forEach(value => assert(positiveInteger(value),
    'invited review requirements must be positive integers'));
  assert(invited.minimum_sessions >= invited.minimum_reviewers &&
    invited.minimum_accessibility_sessions <= invited.minimum_sessions,
  'invited review session/reviewer minima are inconsistent');
  assert(comprehension.minimum_completed_sessions <= invited.minimum_sessions,
    'comprehension minimum cannot exceed invited session minimum');

  exactKeys(protocol.monitoring, MONITORING_KEYS, 'monitoring requirements');
  const monitoring = protocol.monitoring;
  assert(positiveInteger(monitoring.window_seconds) && positiveInteger(monitoring.cadence_seconds) &&
    positiveInteger(monitoring.minimum_probe_cycles) &&
    monitoring.window_seconds >= monitoring.cadence_seconds &&
    monitoring.window_seconds % monitoring.cadence_seconds === 0 &&
    monitoring.minimum_probe_cycles === monitoring.window_seconds / monitoring.cadence_seconds + 1,
  'monitoring window, cadence, and probe-cycle minimum are inconsistent');

  exactKeys(protocol.withdrawal, WITHDRAWAL_KEYS, 'withdrawal targets');
  const withdrawal = protocol.withdrawal;
  assert(positiveInteger(withdrawal.acknowledgement_target_seconds) &&
    positiveInteger(withdrawal.execution_target_seconds) &&
    positiveInteger(withdrawal.verification_target_seconds) &&
    withdrawal.acknowledgement_target_seconds <= withdrawal.execution_target_seconds &&
    withdrawal.execution_target_seconds <= withdrawal.verification_target_seconds,
  'withdrawal targets must be positive and ordered');

  const expectedCases = expectedMatrixCases(protocol);
  return {
    status: 'pass',
    protocol_sha256: hashCanonical(protocol),
    matrix_count: matrixIds.length,
    check_count: checkIds.length,
    expected_matrix_case_count: expectedCases.length,
    comprehension_prompt_count: promptIds.length,
    ...NO_AUTHORITY,
  };
}

function validateFeedbackPrivacyContract(contract, options = {}) {
  validateSchema(contract, options.schema, 'feedback/privacy contract');
  exactKeys(contract, PRIVACY_KEYS, 'feedback/privacy contract');
  assert(contract.schema_version === SCHEMA_VERSION && contract.contract_id === PRIVACY_CONTRACT_ID &&
    contract.status === 'frozen' && contract.repository === REPOSITORY &&
    contract.product_tier === PRODUCT_TIER,
  'feedback/privacy contract identity or status mismatch');
  assert(contract.assessed_production_authority === false,
    'feedback/privacy contract cannot grant assessed production authority');
  assert(validTimestamp(contract.frozen_at), 'feedback/privacy contract frozen_at is invalid');
  assert(validReference(contract.decision_reference), 'feedback/privacy contract decision reference is invalid');

  exactKeys(contract.accountable_owner, OWNER_KEYS, 'accountable owner');
  assert(validIdentity(contract.accountable_owner.identity) &&
    validText(contract.accountable_owner.role, 3, 120) &&
    validHttpsUrl(contract.accountable_owner.contact_url),
  'accountable owner identity, role, or contact is invalid');
  exactKeys(contract.controller, CONTROLLER_KEYS, 'controller');
  assert(validText(contract.controller.legal_name, 3, 256) &&
    validText(contract.controller.jurisdiction, 2, 120) &&
    validHttpsUrl(contract.controller.contact_url),
  'controller identity, jurisdiction, or contact is invalid');

  assert(Array.isArray(contract.processors) && contract.processors.length >= 1,
    'feedback/privacy contract must identify at least one processor/provider');
  const processorIds = [];
  contract.processors.forEach((processor, index) => {
    exactKeys(processor, PROCESSOR_KEYS, `processor ${index}`);
    assert(validId(processor.processor_id, 'processor-') &&
      validText(processor.provider_name, 2, 256) &&
      validText(processor.service_purpose, 20, 1000) &&
      validHttpsUrl(processor.privacy_url) && validText(processor.data_location, 2, 256) &&
      validReference(processor.subprocessor_reference),
    `processor ${index} is incomplete or invalid`);
    processorIds.push(processor.processor_id);
  });
  sortedUniqueStrings(processorIds, 'processor IDs', { minimum: 1 });

  assert(validHttpsUrl(contract.feedback_url) && validHttpsUrl(contract.privacy_notice_url) &&
    contract.feedback_url !== contract.privacy_notice_url,
  'feedback and privacy-notice URLs must be distinct exact HTTPS URLs');
  exactKeys(contract.feedback_collection, COLLECTION_KEYS, 'feedback collection');
  const collection = contract.feedback_collection;
  assert(typeof collection.free_text_enabled === 'boolean' &&
    collection.sensitive_data_prohibited === true &&
    typeof collection.identity_collection_required === 'boolean',
  'feedback collection safety flags are incomplete');
  assert(Array.isArray(collection.allowed_purposes) && collection.allowed_purposes.length >= 1,
    'feedback collection requires at least one allowed purpose');
  const purposeIds = [];
  collection.allowed_purposes.forEach((purpose, index) => {
    exactKeys(purpose, PURPOSE_KEYS, `allowed purpose ${index}`);
    assert(validId(purpose.purpose_id, 'purpose-') && validText(purpose.description, 20, 1000),
      `allowed purpose ${index} is invalid`);
    purposeIds.push(purpose.purpose_id);
  });
  sortedUniqueStrings(purposeIds, 'allowed purpose IDs', { minimum: 1 });
  assert(Array.isArray(collection.collected_fields) && collection.collected_fields.length >= 1,
    'feedback collection requires an exact collected-field inventory');
  const fieldIds = [];
  collection.collected_fields.forEach((field, index) => {
    exactKeys(field, FIELD_KEYS, `collected field ${index}`);
    assert(validId(field.field_id, 'field-') && purposeIds.includes(field.purpose_id) &&
      typeof field.required === 'boolean' && typeof field.personal_data === 'boolean' &&
      typeof field.public_display_allowed === 'boolean',
    `collected field ${index} is invalid or has an unknown purpose`);
    assert(!(field.personal_data && field.public_display_allowed),
      `personal field ${field.field_id} cannot be approved for public display`);
    fieldIds.push(field.field_id);
  });
  sortedUniqueStrings(fieldIds, 'collected field IDs', { minimum: 1 });

  exactKeys(contract.anonymity, ANONYMITY_KEYS, 'anonymity contract');
  const anonymity = contract.anonymity;
  assert(typeof anonymity.anonymous_submission_available === 'boolean' &&
    typeof anonymity.identity_fields_optional === 'boolean' &&
    typeof anonymity.anonymous_submissions_unlinked === 'boolean' &&
    anonymity.public_identity_disclosure_prohibited === true,
  'anonymity contract is incomplete');
  assert(anonymity.identity_fields_optional === !collection.identity_collection_required,
    'anonymity and identity-collection rules disagree');
  if (anonymity.anonymous_submission_available) {
    assert(!collection.identity_collection_required && anonymity.identity_fields_optional &&
      anonymity.anonymous_submissions_unlinked &&
      !collection.collected_fields.some(field => field.required && field.personal_data),
    'anonymous submission is incompatible with required or linkable identity data');
  }

  exactKeys(contract.consent, CONSENT_KEYS, 'consent contract');
  const consent = contract.consent;
  assert(['explicit_opt_in', 'notice_acknowledgement', 'no_personal_data'].includes(consent.consent_model) &&
    validReference(consent.consent_text_reference) &&
    validHttpsUrl(consent.consent_withdrawal_url) &&
    typeof consent.consent_record_retained === 'boolean',
  'consent contract is invalid');
  const hasPersonalFields = collection.collected_fields.some(field => field.personal_data);
  assert((consent.consent_model === 'no_personal_data') === !hasPersonalFields,
    'consent model disagrees with the collected-field inventory');
  assert(consent.consent_record_retained === (consent.consent_model !== 'no_personal_data'),
    'consent-record retention disagrees with consent model');

  exactKeys(contract.retention, RETENTION_KEYS, 'retention/deletion contract');
  const retention = contract.retention;
  assert(positiveInteger(retention.primary_retention_seconds) &&
    positiveInteger(retention.deletion_completion_target_seconds) &&
    positiveInteger(retention.backup_expiry_seconds) &&
    retention.backup_expiry_seconds >= retention.deletion_completion_target_seconds &&
    validReference(retention.legal_hold_reference),
  'retention, deletion, backup, or legal-hold rule is invalid');

  exactKeys(contract.data_subject_requests, REQUEST_KEYS, 'data subject request contract');
  const requests = contract.data_subject_requests;
  assert(validHttpsUrl(requests.access_request_url) && validHttpsUrl(requests.deletion_request_url) &&
    validHttpsUrl(requests.redaction_request_url) &&
    positiveInteger(requests.acknowledgement_target_seconds) &&
    positiveInteger(requests.response_target_seconds) &&
    requests.acknowledgement_target_seconds <= requests.response_target_seconds,
  'data access/deletion/redaction request contract is invalid');

  exactKeys(contract.abuse_and_privacy_requests, ABUSE_KEYS, 'abuse/privacy request contract');
  const abuse = contract.abuse_and_privacy_requests;
  assert(validHttpsUrl(abuse.abuse_report_url) && validHttpsUrl(abuse.privacy_request_url) &&
    positiveInteger(abuse.triage_target_seconds) && positiveInteger(abuse.escalation_target_seconds) &&
    abuse.triage_target_seconds <= abuse.escalation_target_seconds,
  'abuse/privacy request routes or targets are invalid');

  exactKeys(contract.security_route_reference, SECURITY_KEYS, 'security route reference');
  assert(validHttpsUrl(contract.security_route_reference.route_url) &&
    validPublicSafeText(contract.security_route_reference.public_safe_description) &&
    contract.security_route_reference.sensitive_details_prohibited === true,
  'security route reference is not public-safe');

  exactKeys(contract.correction_and_withdrawal, CORRECTION_KEYS,
    'correction/withdrawal contract');
  const correction = contract.correction_and_withdrawal;
  assert(validHttpsUrl(correction.correction_request_url) &&
    validHttpsUrl(correction.public_correction_log_url) &&
    validHttpsUrl(correction.withdrawal_request_url) &&
    correction.immutable_release_for_corrections_required === true &&
    correction.public_correction_log_required === true &&
    positiveInteger(correction.confirmed_harm_withdrawal_target_seconds) &&
    validText(correction.correction_rule, 20, 1500) &&
    validText(correction.withdrawal_rule, 20, 1500),
  'correction/withdrawal routes or rules are invalid');

  return {
    status: 'pass',
    feedback_privacy_contract_sha256: hashCanonical(contract),
    processor_count: processorIds.length,
    collected_field_count: fieldIds.length,
    allowed_purpose_count: purposeIds.length,
    ...NO_AUTHORITY,
  };
}

function expectedMatrixCases(protocol) {
  const rows = [];
  protocol.required_checks.forEach(check => {
    protocol.browser_matrix.forEach(matrix => {
      if (check.coverage_rule === 'screen_reader_matrix_rows' && matrix.screen_reader === null) return;
      rows.push({
        case_id: `${matrix.matrix_id}--${check.check_id}`,
        matrix_id: matrix.matrix_id,
        check_id: check.check_id,
      });
    });
  });
  return rows.sort((left, right) => left.case_id.localeCompare(right.case_id));
}

function deriveResultsAggregate(protocol, results) {
  const reviewerCount = new Set(results.session_summaries.map(session => session.reviewer_reference)).size;
  const accessibilityCount = results.session_summaries.filter(session => session.accessibility_session).length;
  const casePassCount = results.matrix_check_results.filter(item => item.outcome === 'pass').length;
  const noGo = new Set(protocol.no_go_severities);
  const openNoGoCount = results.findings.filter(finding =>
    noGo.has(finding.severity) && finding.status !== 'resolved').length;
  const comprehensionPassCount = results.comprehension_sessions.filter(session => session.session_passed).length;
  const criticalMisunderstandingCount = results.comprehension_sessions.reduce((sum, session) =>
    sum + session.prompt_results.filter(item => item.critical_misunderstanding_detected).length, 0);
  const durationSeconds = Math.floor((new Date(results.completed_at) - new Date(results.started_at)) / 1000);
  const comprehensionRate = results.comprehension_sessions.length === 0 ? 0 :
    Math.floor(comprehensionPassCount * 10000 / results.comprehension_sessions.length);
  const expected = expectedMatrixCases(protocol);
  const actual = results.matrix_check_results.map(item => ({
    case_id: item.case_id,
    matrix_id: item.matrix_id,
    check_id: item.check_id,
  }));
  const coverageComplete = same(actual, expected);
  const minimumsSatisfied =
    reviewerCount >= protocol.invited_review.minimum_reviewers &&
    results.session_summaries.length >= protocol.invited_review.minimum_sessions &&
    accessibilityCount >= protocol.invited_review.minimum_accessibility_sessions &&
    durationSeconds >= protocol.invited_review.duration_seconds &&
    results.comprehension_sessions.length >= protocol.comprehension_pass_criteria.minimum_completed_sessions &&
    comprehensionRate >= protocol.comprehension_pass_criteria.minimum_session_pass_rate_basis_points &&
    criticalMisunderstandingCount <= protocol.comprehension_pass_criteria.maximum_critical_misunderstandings;
  return {
    unique_reviewer_count: reviewerCount,
    completed_session_count: results.session_summaries.length,
    accessibility_session_count: accessibilityCount,
    matrix_case_count: results.matrix_check_results.length,
    matrix_case_pass_count: casePassCount,
    open_no_go_finding_count: openNoGoCount,
    comprehension_session_count: results.comprehension_sessions.length,
    comprehension_session_pass_count: comprehensionPassCount,
    comprehension_pass_rate_basis_points: comprehensionRate,
    critical_misunderstanding_count: criticalMisunderstandingCount,
    invited_duration_observed_seconds: durationSeconds,
    all_matrix_and_check_coverage_complete: coverageComplete,
    minimums_satisfied: minimumsSatisfied,
    no_go_clear: openNoGoCount === 0 &&
      criticalMisunderstandingCount <= protocol.comprehension_pass_criteria.maximum_critical_misunderstandings,
  };
}

function validateUiAccessibilityResults(results, context) {
  assert(context && context.protocol && context.privacyContract,
    'UI/accessibility results require the exact review protocol and feedback/privacy contract');
  const protocol = context.protocol;
  const privacyContract = context.privacyContract;
  validateReviewProtocol(protocol, { schema: context.schemas?.reviewProtocol });
  validateFeedbackPrivacyContract(privacyContract, { schema: context.schemas?.feedbackPrivacy });
  validateSchema(results, context.schemas?.uiAccessibilityResults, 'UI/accessibility results');
  exactKeys(results, RESULTS_KEYS, 'UI/accessibility results');
  assert(results.schema_version === SCHEMA_VERSION && results.status === 'completed' &&
    results.repository === REPOSITORY && results.product_tier === PRODUCT_TIER,
  'UI/accessibility results identity or status mismatch');
  assert(validReleaseId(results.beta_release_id), 'UI/accessibility results beta release ID is invalid');
  if (context.betaReleaseId !== undefined) {
    assert(results.beta_release_id === context.betaReleaseId,
      'UI/accessibility results belong to a different beta release');
  }
  assert(results.results_id ===
    `elu-climate-public-beta-${results.beta_release_id}-ui-accessibility-v1`,
  'UI/accessibility results ID does not bind the exact beta release');
  assert(['invited_beta', 'public_beta'].includes(results.publication_level),
    'UI/accessibility results publication level is invalid');
  assert(/^[0-9a-f]{40}$/.test(results.reviewed_commit_sha || ''),
    'UI/accessibility results require an exact reviewed commit SHA');
  assert(results.review_protocol_id === protocol.protocol_id &&
    results.review_protocol_sha256 === hashCanonical(protocol),
  'UI/accessibility results do not bind the exact canonical review protocol');
  assert(results.feedback_privacy_contract_id === privacyContract.contract_id &&
    results.feedback_privacy_contract_sha256 === hashCanonical(privacyContract),
  'UI/accessibility results do not bind the exact canonical feedback/privacy contract');
  assert(validTimestamp(results.started_at) && validTimestamp(results.completed_at) &&
    new Date(results.started_at) < new Date(results.completed_at),
  'UI/accessibility review time window is invalid');
  assert(validIdentity(results.reviewer_identity) &&
    results.reviewer_identity !== protocol.protocol_owner_identity,
  'UI/accessibility reviewer identity is invalid or not independent of the protocol owner');
  assert(results.assessed_production_authority === false,
    'UI/accessibility results cannot grant assessed production authority');

  assert(Array.isArray(results.session_summaries) && results.session_summaries.length >= 1,
    'UI/accessibility results require session summaries');
  const matrixById = new Map(protocol.browser_matrix.map(row => [row.matrix_id, row]));
  const sessionIds = [];
  const sessionMatrixIds = new Set();
  results.session_summaries.forEach((session, index) => {
    exactKeys(session, SESSION_KEYS, `session summary ${index}`);
    assert(validId(session.session_id, 'session-') &&
      /^reviewer:[0-9a-f]{16,64}$/.test(session.reviewer_reference || ''),
    `session summary ${index} has an invalid privacy-safe ID/reference`);
    assert(validTimestamp(session.started_at) && validTimestamp(session.completed_at) &&
      new Date(session.started_at) >= new Date(results.started_at) &&
      new Date(session.started_at) < new Date(session.completed_at) &&
      new Date(session.completed_at) <= new Date(results.completed_at),
    `session ${session.session_id} time window is invalid`);
    sortedUniqueStrings(session.matrix_ids, `session ${session.session_id} matrix IDs`, { minimum: 1 });
    assert(session.matrix_ids.every(id => matrixById.has(id)),
      `session ${session.session_id} references an unknown matrix row`);
    const shouldBeAccessibility = session.matrix_ids.some(id => matrixById.get(id).screen_reader !== null);
    assert(session.accessibility_session === shouldBeAccessibility,
      `session ${session.session_id} accessibility flag disagrees with its matrix rows`);
    assert(validReference(session.evidence_reference),
      `session ${session.session_id} evidence reference is invalid`);
    session.matrix_ids.forEach(id => sessionMatrixIds.add(id));
    sessionIds.push(session.session_id);
  });
  sortedUniqueStrings(sessionIds, 'session IDs', { minimum: 1 });
  assert(same([...sessionMatrixIds].sort(), [...matrixById.keys()].sort()),
    'session summaries do not cover the exact browser matrix');

  assert(Array.isArray(results.findings), 'UI/accessibility findings must be an array');
  const taxonomy = new Map(protocol.severity_taxonomy.map(item => [item.severity, item]));
  const findingIds = [];
  const findingById = new Map();
  results.findings.forEach((finding, index) => {
    exactKeys(finding, FINDING_KEYS, `finding ${index}`);
    assert(/^finding-[0-9a-f]{16,64}$/.test(finding.finding_id || '') && taxonomy.has(finding.severity) &&
      ['open', 'resolved', 'accepted_beta_limitation'].includes(finding.status) &&
      validText(finding.summary, 20, 1000) && validReference(finding.evidence_reference) &&
      validTimestamp(finding.reported_at) && new Date(finding.reported_at) >= new Date(results.started_at) &&
      new Date(finding.reported_at) <= new Date(results.completed_at),
    `finding ${index} is invalid`);
    if (finding.status === 'resolved') {
      assert(validTimestamp(finding.resolved_at) &&
        new Date(finding.resolved_at) >= new Date(finding.reported_at) &&
        new Date(finding.resolved_at) <= new Date(results.completed_at),
      `resolved finding ${finding.finding_id} has invalid resolution time`);
    } else {
      assert(finding.resolved_at === null,
        `unresolved finding ${finding.finding_id} cannot have a resolution time`);
    }
    findingIds.push(finding.finding_id);
    findingById.set(finding.finding_id, finding);
  });
  sortedUniqueStrings(findingIds, 'finding IDs');

  assert(Array.isArray(results.matrix_check_results), 'matrix/check results must be an array');
  const expectedCases = expectedMatrixCases(protocol);
  const actualCases = [];
  const referencedFindings = new Set();
  results.matrix_check_results.forEach((item, index) => {
    exactKeys(item, MATRIX_RESULT_KEYS, `matrix/check result ${index}`);
    assert(item.case_id === `${item.matrix_id}--${item.check_id}` &&
      ['pass', 'finding_recorded'].includes(item.outcome),
    `matrix/check result ${index} has an invalid case or outcome`);
    sortedUniqueStrings(item.finding_ids, `matrix/check result ${item.case_id} finding IDs`);
    assert(item.finding_ids.every(id => findingById.has(id)),
      `matrix/check result ${item.case_id} references an unknown finding`);
    assert((item.outcome === 'pass') === (item.finding_ids.length === 0),
      `matrix/check result ${item.case_id} outcome disagrees with findings`);
    assert(validTimestamp(item.observed_at) &&
      new Date(item.observed_at) >= new Date(results.started_at) &&
      new Date(item.observed_at) <= new Date(results.completed_at) &&
      validReference(item.evidence_reference),
    `matrix/check result ${item.case_id} observation/evidence is invalid`);
    item.finding_ids.forEach(id => referencedFindings.add(id));
    actualCases.push({ case_id: item.case_id, matrix_id: item.matrix_id, check_id: item.check_id });
  });
  assert(same(actualCases, expectedCases),
    'matrix/check results do not provide exact, sorted protocol coverage');
  assert(same([...referencedFindings].sort(), findingIds),
    'finding inventory and matrix/check finding references disagree');

  assert(Array.isArray(results.comprehension_sessions),
    'comprehension session results must be an array');
  const promptById = new Map(protocol.comprehension_prompts.map(prompt => [prompt.prompt_id, prompt]));
  const comprehensionSessionIds = [];
  results.comprehension_sessions.forEach((session, index) => {
    exactKeys(session, COMPREHENSION_SESSION_KEYS, `comprehension session ${index}`);
    assert(sessionIds.includes(session.session_id),
      `comprehension session ${index} references an unknown review session`);
    assert(Array.isArray(session.prompt_results),
      `comprehension session ${session.session_id} prompt results must be an array`);
    const promptResults = [];
    session.prompt_results.forEach((item, promptIndex) => {
      exactKeys(item, PROMPT_RESULT_KEYS,
        `comprehension session ${session.session_id} prompt ${promptIndex}`);
      const prompt = promptById.get(item.prompt_id);
      assert(prompt, `comprehension session ${session.session_id} references an unknown prompt`);
      sortedUniqueStrings(item.identified_concepts,
        `comprehension session ${session.session_id} prompt ${item.prompt_id} concepts`);
      assert(item.identified_concepts.every(concept => prompt.required_concepts.includes(concept)) &&
        typeof item.critical_misunderstanding_detected === 'boolean',
      `comprehension session ${session.session_id} prompt ${item.prompt_id} has invalid concepts`);
      const expectedPass = item.identified_concepts.length >= prompt.minimum_concepts_required &&
        item.critical_misunderstanding_detected === false;
      assert(item.passed === expectedPass,
        `comprehension session ${session.session_id} prompt ${item.prompt_id} pass calculation is wrong`);
      promptResults.push(item.prompt_id);
    });
    assert(same(promptResults, [...promptById.keys()].sort()),
      `comprehension session ${session.session_id} lacks exact, sorted prompt coverage`);
    assert(session.session_passed === session.prompt_results.every(item => item.passed),
      `comprehension session ${session.session_id} pass calculation is wrong`);
    comprehensionSessionIds.push(session.session_id);
  });
  assert(same(comprehensionSessionIds, sessionIds),
    'every review session must have exactly one sorted comprehension result');

  exactKeys(results.aggregate, AGGREGATE_KEYS, 'UI/accessibility aggregate');
  const derived = deriveResultsAggregate(protocol, results);
  assert(same(results.aggregate, derived), 'UI/accessibility aggregate calculation mismatch');
  assert(derived.all_matrix_and_check_coverage_complete && derived.minimums_satisfied && derived.no_go_clear,
    'UI/accessibility results do not clear frozen coverage, minimum, or no-go gates');
  assert(results.result === 'review_complete_no_go_clear',
    'UI/accessibility result must explicitly record review completion and no-go clearance');
  assert(/^[0-9a-f]{64}$/.test(results.calculation_hash || '') &&
    results.calculation_hash === calculationHash(results),
  'UI/accessibility results calculation hash mismatch');

  return {
    status: 'pass',
    beta_release_id: results.beta_release_id,
    reviewed_commit_sha: results.reviewed_commit_sha,
    review_protocol_sha256: results.review_protocol_sha256,
    feedback_privacy_contract_sha256: results.feedback_privacy_contract_sha256,
    results_sha256: hashCanonical(results),
    expected_matrix_case_count: expectedCases.length,
    aggregate: structuredClone(derived),
    ...NO_AUTHORITY,
  };
}

function loadSchemas(root = path.resolve(__dirname, '../..')) {
  const loaded = {};
  for (const [name, relative] of Object.entries(SCHEMA_PATHS)) {
    const absolute = path.resolve(root, relative);
    const rootAbsolute = path.resolve(root);
    const rel = path.relative(rootAbsolute, absolute);
    assert(rel && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel),
      `schema path escapes repository root: ${relative}`);
    const stat = fs.lstatSync(absolute);
    assert(stat.isFile() && !stat.isSymbolicLink(), `schema must be a regular non-symlink file: ${relative}`);
    const bytes = fs.readFileSync(absolute);
    assert(bytes.length > 0 && bytes.length <= 1048576, `schema has invalid size: ${relative}`);
    try { loaded[name] = parseJsonNoDuplicateKeys(bytes.toString('utf8'), relative); }
    catch (error) { throw new Error(`schema is invalid JSON (${relative}): ${error.message}`); }
  }
  return loaded;
}

function validateGovernanceContracts({
  protocol,
  privacyContract,
  results,
  schemas = loadSchemas(),
  betaReleaseId,
}) {
  const checks = [];
  const outputs = {};
  const run = (id, action) => {
    try {
      outputs[id] = action();
      checks.push({ id, pass: true });
    } catch (error) {
      checks.push({ id, pass: false, message: error.message });
    }
  };
  run('review-protocol-valid', () =>
    validateReviewProtocol(protocol, { schema: schemas.reviewProtocol }));
  run('feedback-privacy-contract-valid', () =>
    validateFeedbackPrivacyContract(privacyContract, { schema: schemas.feedbackPrivacy }));
  run('ui-accessibility-results-valid', () =>
    validateUiAccessibilityResults(results, {
      protocol,
      privacyContract,
      schemas,
      betaReleaseId,
    }));
  const failureIds = checks.filter(check => !check.pass).map(check => check.id);
  return {
    status: failureIds.length ? 'fail' : 'pass',
    checks,
    failure_ids: failureIds,
    beta_release_id: results?.beta_release_id || null,
    review_protocol_sha256: outputs['review-protocol-valid']?.protocol_sha256 || null,
    feedback_privacy_contract_sha256:
      outputs['feedback-privacy-contract-valid']?.feedback_privacy_contract_sha256 || null,
    ui_accessibility_results_sha256: outputs['ui-accessibility-results-valid']?.results_sha256 || null,
    ...NO_AUTHORITY,
  };
}

module.exports = {
  SCHEMA_VERSION,
  REPOSITORY,
  PRODUCT_TIER,
  REVIEWER_ROLE,
  REVIEW_PROTOCOL_ID,
  PRIVACY_CONTRACT_ID,
  MATRIX_CATEGORIES,
  SCHEMA_PATHS,
  stable,
  canonicalJson,
  serializeCanonical,
  hashBytes,
  hashCanonical,
  calculationHash,
  expectedMatrixCases,
  deriveResultsAggregate,
  validateReviewProtocol,
  validateFeedbackPrivacyContract,
  validateUiAccessibilityResults,
  validateGovernanceContracts,
  loadSchemas,
};
