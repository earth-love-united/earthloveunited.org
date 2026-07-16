#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUDIT_PATH = path.join(ROOT, 'data/climate/evidence/major-emitter-ndc-source-audit.json');

const EVIDENCE_STATES = new Set([
  'available', 'estimated', 'modeled', 'not_reported', 'not_assessed',
  'non_comparable', 'not_applicable', 'not_yet_due', 'reporting_optional',
  'stale', 'conflicting', 'withheld', 'source_unavailable', 'not_reviewed',
]);
const TARGET_TYPES = new Set([
  'base_year', 'bau', 'intensity', 'fixed_level', 'trajectory', 'peaking',
  'sectoral', 'qualitative', 'net_zero',
]);
const CONDITIONS = new Set(['unconditional', 'conditional', 'combined', 'not_stated']);
const COMPARABILITY = new Set([
  'comparable', 'partially_comparable', 'non_comparable',
  'qualitative_or_sectoral', 'no_active_target_found', 'not_assessed',
]);
const REASON_CODES = new Set([
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
  'assessment_eligibility_not_reviewed',
]);

const REQUIRED_COMMON_FIELDS = [
  'target_year', 'gases', 'sectors', 'geography', 'lulucf',
  'gwp_convention', 'article6_treatment',
];
const REQUIRED_TYPE_FIELDS = {
  bau: ['reduction_pct', 'bau_scenario', 'bau_vintage', 'bau_target_value'],
  intensity: ['reduction_pct', 'reference_year', 'intensity_denominator', 'intensity_denominator_projection'],
  fixed_level: ['target_value', 'reference_year', 'reference_value'],
  trajectory: ['reduction_pct', 'reference_year', 'reference_value', 'trajectory'],
};

function fail(errors, message) {
  errors.push(message);
}

function checkReasons(errors, values, at) {
  if (!Array.isArray(values) || !values.length) {
    fail(errors, `${at} must contain at least one reason code`);
    return;
  }
  for (const value of values) {
    if (!REASON_CODES.has(value)) fail(errors, `${at} contains unknown canonical reason code ${value}`);
  }
  if (new Set(values).size !== values.length) fail(errors, `${at} contains duplicate reason codes`);
}

function checkAuditField(errors, field, at) {
  const exactKeys = ['evidence_state', 'release_state', 'locator', 'reason_codes'];
  if (!field || typeof field !== 'object' || Array.isArray(field)) {
    fail(errors, `${at} must be an audit object`);
    return;
  }
  const keys = Object.keys(field).sort();
  if (JSON.stringify(keys) !== JSON.stringify(exactKeys.slice().sort())) {
    fail(errors, `${at} may contain presence/release metadata only; found keys ${keys.join(', ')}`);
  }
  if (!EVIDENCE_STATES.has(field.evidence_state)) fail(errors, `${at}.evidence_state is not canonical`);
  if (!EVIDENCE_STATES.has(field.release_state)) fail(errors, `${at}.release_state is not canonical`);
  if (typeof field.locator !== 'string' || !field.locator.trim()) fail(errors, `${at}.locator is required`);
  checkReasons(errors, field.reason_codes, `${at}.reason_codes`);
  if (field.evidence_state === 'available' && field.release_state !== 'withheld') {
    fail(errors, `${at}: available Party evidence must remain withheld while the licence gate is closed`);
  }
  if (field.release_state === 'withheld' && !field.reason_codes.includes('licence_not_approved')) {
    fail(errors, `${at}: withheld Party evidence must cite licence_not_approved`);
  }
}

function main() {
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  const errors = [];

  if (audit.schema_version !== '1.0.0') fail(errors, 'unexpected audit schema version');
  if (audit.canonical_contract.target_schema_id !== 'https://earthloveunited.org/schemas/climate/target-2.0.0.json') fail(errors, 'wrong target schema dependency');
  if (audit.canonical_contract.enum_schema_version !== '2.0.0') fail(errors, 'wrong canonical enum version');
  if (audit.release_gate.status !== 'metadata_only' || audit.release_gate.normalized_values_allowed !== false || audit.release_gate.source_files_allowed !== false || audit.release_gate.metadata_and_links_allowed !== true) {
    fail(errors, 'UNFCCC evidence release gate must remain metadata-only and fail closed');
  }
  checkReasons(errors, audit.release_gate.reason_codes, 'release_gate.reason_codes');
  if (audit.review.status === 'reviewed' || audit.review.release_eligible !== false) fail(errors, 'pilot must not be marked reviewed or release eligible');
  if (!audit.review.extractor_id || audit.review.reviewer_id !== null || audit.review.reviewed_at !== null) fail(errors, 'independent reviewer must remain unassigned before review');
  checkReasons(errors, audit.review.reason_codes, 'review.reason_codes');

  const documentIds = new Set();
  const countryIds = new Set();
  for (const document of audit.documents) {
    const at = `document ${document.source_document_id}`;
    if (!document.source_document_id || documentIds.has(document.source_document_id)) fail(errors, `${at} is missing or duplicated`);
    documentIds.add(document.source_document_id);
    countryIds.add(document.country_id);
    for (const key of ['publisher', 'title', 'document_type', 'language', 'registry_status', 'metadata_url', 'direct_url', 'registry_locator', 'licence_id']) {
      if (!document[key]) fail(errors, `${at}.${key} is required`);
    }
    for (const key of ['metadata_url', 'direct_url']) {
      if (typeof document[key] === 'string' && !document[key].startsWith('https://')) fail(errors, `${at}.${key} must use HTTPS`);
    }
    if (document.redistribution !== 'metadata_only' || document.raw_storage !== 'external_only') fail(errors, `${at} violates the source registry storage or redistribution gate`);
    const raw = document.raw_file_acquisition;
    const locatorReview = document.content_locator_verification;
    if (!raw || raw.state !== 'source_unavailable' || raw.checksum_sha256 !== null) fail(errors, `${at} must preserve blocked raw-file acquisition and a null source checksum`);
    if (raw) checkReasons(errors, raw.reason_codes, `${at}.raw_file_acquisition.reason_codes`);
    if (!locatorReview || locatorReview.state !== 'available' || locatorReview.channel !== 'official_unfccc_pdf_index' || locatorReview.checked_at !== '2026-07-15' || locatorReview.local_raw_file !== false || locatorReview.supports !== 'in_review_field_presence_only') {
      fail(errors, `${at} must distinguish official index locator verification from unavailable raw-file acquisition`);
    }
    if (!locatorReview || typeof locatorReview.limitation !== 'string' || !locatorReview.limitation.includes('does not provide a source checksum') || !locatorReview.limitation.includes('cannot authorize normalized public values')) {
      fail(errors, `${at}.content_locator_verification must state checksum and normalized-value limitations`);
    }
    if (document.submission_date === null) {
      if (document.submission_date_state !== 'not_reported') fail(errors, `${at} requires explicit not_reported submission date state`);
      checkReasons(errors, document.submission_date_reason_codes, `${at}.submission_date_reason_codes`);
    }
  }
  const expectedCountries = ['iso3166-1:CHN', 'iso3166-1:IDN', 'iso3166-1:IND', 'iso3166-1:IRN'];
  if (JSON.stringify([...countryIds].sort()) !== JSON.stringify(expectedCountries)) fail(errors, 'pilot must cover exactly China, India, Indonesia, and Iran');

  const componentIds = new Set();
  for (const component of audit.target_components) {
    const at = `component ${component.target_component_id}`;
    if (!component.target_component_id || componentIds.has(component.target_component_id)) fail(errors, `${at} is missing or duplicated`);
    componentIds.add(component.target_component_id);
    if (!documentIds.has(component.source_document_id)) fail(errors, `${at} references an unknown source document`);
    if (!TARGET_TYPES.has(component.target_type)) fail(errors, `${at}.target_type is not canonical`);
    if (!CONDITIONS.has(component.condition)) fail(errors, `${at}.condition is not canonical`);
    if (!COMPARABILITY.has(component.target_type_eligibility.comparability)) fail(errors, `${at}.comparability is not canonical`);
    if (component.target_type_eligibility.eligible_after_licence_and_review !== false) fail(errors, `${at} cannot be eligible while licence and review gates are closed`);
    checkReasons(errors, component.target_type_eligibility.reason_codes, `${at}.eligibility.reason_codes`);
    for (const fieldName of [...REQUIRED_COMMON_FIELDS, ...(REQUIRED_TYPE_FIELDS[component.target_type] || [])]) {
      if (!component.field_audit[fieldName]) fail(errors, `${at}.field_audit.${fieldName} is required for ${component.target_type}`);
    }
    for (const [fieldName, field] of Object.entries(component.field_audit)) checkAuditField(errors, field, `${at}.field_audit.${fieldName}`);
    const sourceDocument = audit.documents.find(item => item.source_document_id === component.source_document_id);
    const hasPageLocator = Object.values(component.field_audit).some(field => /\bpages?\b/i.test(field.locator));
    if (hasPageLocator && sourceDocument?.raw_file_acquisition?.state === 'source_unavailable') {
      if (sourceDocument.content_locator_verification?.state !== 'available' || sourceDocument.content_locator_verification.local_raw_file !== false) {
        fail(errors, `${at}: page locators with source_unavailable require separate official index content verification`);
      }
    }
  }

  const requiredComponents = [
    ['iso3166-1:CHN', 'trajectory', 'not_stated'],
    ['iso3166-1:IND', 'intensity', 'not_stated'],
    ['iso3166-1:IDN', 'fixed_level', 'combined'],
    ['iso3166-1:IDN', 'bau', 'unconditional'],
    ['iso3166-1:IDN', 'bau', 'conditional'],
    ['iso3166-1:IRN', 'bau', 'unconditional'],
    ['iso3166-1:IRN', 'bau', 'conditional'],
  ];
  for (const [countryId, targetType, condition] of requiredComponents) {
    if (!audit.target_components.some(item => item.country_id === countryId && item.target_type === targetType && item.condition === condition)) {
      fail(errors, `missing required separated component ${countryId}/${targetType}/${condition}`);
    }
  }

  const iranDocument = audit.documents.find(item => item.country_id === 'iso3166-1:IRN');
  if (!iranDocument || iranDocument.document_type !== 'indc' || iranDocument.registry_status !== 'not_applicable' || iranDocument.party_status.interpretation !== 'signatory_not_party') {
    fail(errors, 'Iran must remain an INDC from a signatory that is not a Paris Agreement Party, not an active NDC');
  }
  const chinaDocument = audit.documents.find(item => item.country_id === 'iso3166-1:CHN');
  if (!chinaDocument || chinaDocument.metadata_url !== 'https://unfccc.int/documents/497393' || !Array.isArray(chinaDocument.related_metadata_urls) || !chinaDocument.related_metadata_urls.includes('https://unfccc.int/documents/497392')) {
    fail(errors, 'China metadata must retain both related UNFCCC document records 497393 and 497392');
  }

  const forbidden = [];
  function walk(value, at) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['value', 'amount', 'unit', 'statement', 'normalized_value'].includes(key)) forbidden.push(`${at}.${key}`);
      walk(child, `${at}.${key}`);
    }
  }
  walk(audit.target_components, 'target_components');
  if (forbidden.length) fail(errors, `normalized/copy fields are forbidden in this metadata-only pilot: ${forbidden.join(', ')}`);

  const pdfs = [];
  function findPdfs(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) findPdfs(full);
      else if (entry.name.toLowerCase().endsWith('.pdf')) pdfs.push(path.relative(ROOT, full));
    }
  }
  findPdfs(path.join(ROOT, 'data/climate'));
  if (pdfs.length) fail(errors, `raw Party PDFs must remain external/uncommitted: ${pdfs.join(', ')}`);

  if (errors.length) {
    console.error('Major-emitter NDC evidence check failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Major-emitter NDC evidence check passed (${audit.documents.length} documents, ${audit.target_components.length} separated target components, 4 countries).`);
}

main();
