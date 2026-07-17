'use strict';

const crypto = require('node:crypto');
const { canonicalJsonText, parseJsonNoDuplicateKeys } = require('./json-schema-lite');

const POLICY_VERSION = '1.0.0';
const REPOSITORY = 'earth-love-united/earthloveunited.org';
const TRUST_REGISTRY_PATH = 'data/climate/public-beta/governance/approval-trust.json';
const SIGNATURE_DOMAIN = 'ELU-CLIMATE-PUBLIC-BETA-APPROVAL-V1';
const EVIDENCE_SIGNATURE_DOMAIN = 'ELU-CLIMATE-PUBLIC-BETA-EVIDENCE-V1';

const PUBLICATION_LEVELS = Object.freeze(['invited_beta', 'public_beta']);
const RELEASE_STATES = Object.freeze([
  'package_valid_publication_blocked',
  'shareable_l1',
  'authorized_for_public_activation',
  'live_public_beta_monitoring',
  'verified_live_public_beta',
]);
const ALL_STATES = Object.freeze(['blocked'].concat(RELEASE_STATES));
const REQUIRED_ROLES = Object.freeze([
  'beta_data_reviewer',
  'beta_rights_reviewer',
  'beta_ui_accessibility_reviewer',
  'beta_package_reviewer',
  'beta_rollback_reviewer',
  'beta_release_operator',
  'beta_release_authorizer',
]);
const REQUIRED_REVIEW_ROLES = Object.freeze(REQUIRED_ROLES.slice(0, 5));
const REMOTE_EVIDENCE_ROLES = Object.freeze(['beta_release_operator', 'beta_rollback_reviewer']);
const APPROVAL_ROLE = 'beta_release_authorizer';

const APPROVAL_PATHS = Object.freeze({
  invited_beta: 'approvals/invited-beta.json',
  public_beta: 'approvals/public-beta.json',
});
const SIGNATURE_BUNDLE_PATHS = Object.freeze({
  invited_beta: 'approvals/invited-beta.signatures.json',
  public_beta: 'approvals/public-beta.signatures.json',
});

const REVIEW_KIND_BY_ROLE = Object.freeze({
  beta_data_reviewer: 'data_review',
  beta_rights_reviewer: 'rights_review',
  beta_ui_accessibility_reviewer: 'ui_accessibility_review',
  beta_package_reviewer: 'package_review',
  beta_rollback_reviewer: 'rollback_review',
});

const EVIDENCE_CONFIG = Object.freeze({
  data_review: { level: 'package', roles: ['beta_data_reviewer'], observation: 'review_complete' },
  rights_review: { level: 'package', roles: ['beta_rights_reviewer'], observation: 'review_complete' },
  ui_accessibility_review: { level: 'package', roles: ['beta_ui_accessibility_reviewer'], observation: 'review_complete' },
  package_review: { level: 'package', roles: ['beta_package_reviewer'], observation: 'review_complete' },
  rollback_review: { level: 'package', roles: ['beta_rollback_reviewer'], observation: 'review_complete' },
  l1_remote_preflight: { level: 'invited_beta', roles: REMOTE_EVIDENCE_ROLES, observation: 'access_controlled_preflight_passed' },
  l1_invited_evidence_index: { level: 'invited_beta', roles: REMOTE_EVIDENCE_ROLES, observation: 'invited_review_evidence_complete' },
  l2_remote_preflight: { level: 'public_beta', roles: REMOTE_EVIDENCE_ROLES, observation: 'public_activation_preflight_passed' },
  public_activation: { level: 'public_beta', roles: REMOTE_EVIDENCE_ROLES, observation: 'public_activation_immediate_probes_passed' },
  live_monitoring: { level: 'public_beta', roles: REMOTE_EVIDENCE_ROLES, observation: 'monitoring_window_complete' },
});
const EVIDENCE_KINDS = Object.freeze(Object.keys(EVIDENCE_CONFIG));

const POLICY_KEYS = sorted([
  'schema_version', 'policy_id', 'status', 'repository', 'product_tier',
  'assessed_production_authority', 'publication_levels', 'release_states',
  'required_roles', 'required_review_roles', 'remote_evidence_roles',
  'approval_role', 'approved_origins', 'approved_aliases', 'frozen_thresholds',
  'hosting_project',
  'unauthorized_access_policy',
  'production_baseline_origin', 'production_baseline_inventory_sha256',
  'rollback_target',
  'governance_contracts',
  'independence_rules', 'no_assessment_contract', 'decision_reference',
]);
const THRESHOLD_KEYS = sorted([
  'invited_reviewer_minimum', 'invited_session_minimum',
  'accessibility_session_minimum', 'monitoring_window_seconds',
  'remote_probe_interval_seconds', 'rollback_response_target_seconds',
  'approval_validity_max_seconds', 'authorized_access_test_count',
  'unauthorized_access_test_count',
]);
const INDEPENDENCE_KEYS = sorted([
  'data_builder_differs_from_data_reviewer',
  'rights_preparer_differs_from_rights_reviewer',
  'ui_builder_differs_from_ui_accessibility_reviewer',
  'diff_builder_differs_from_package_reviewer',
  'rollback_builder_differs_from_rollback_reviewer',
  'release_builder_differs_from_release_authorizer',
]);
const NO_ASSESSMENT_KEYS = sorted([
  'assessed_production_authority', 'official_inventory_claims',
  'target_or_commitment_claims', 'performance_or_normative_claims',
]);
const UNAUTHORIZED_ACCESS_KEYS = sorted(['allowed_statuses', 'allowed_redirect_origins']);
const HOSTING_PROJECT_KEYS = sorted([
  'provider', 'project_id', 'production_branch', 'access_scope',
  'access_policy_reference', 'pages_dev_origin', 'deployment_alias_hostname_suffix',
  'holding_content_sha256',
  'deployment_replacement_lock_required',
]);
const ROLLBACK_TARGET_KEYS = sorted(['type', 'reference']);
const GOVERNANCE_CONTRACT_KEYS = sorted([
  'review_protocol_path', 'review_protocol_sha256',
  'feedback_privacy_contract_path', 'feedback_privacy_contract_sha256',
]);
const REGISTRY_KEYS = sorted([
  'schema_version', 'registry_id', 'status', 'repository', 'required_roles', 'authorities',
]);
const AUTHORITY_KEYS = sorted([
  'algorithm', 'identity', 'key_id', 'public_key_spki_pem', 'revoked_at',
  'role', 'status', 'valid_from', 'valid_until',
]);
const APPROVAL_KEYS = sorted([
  'schema_version', 'approval_id', 'repository', 'beta_release_id', 'decision',
  'publication_level', 'intended_origin', 'intended_aliases', 'reviewed_commit_sha',
  'canonical_scope_sha256', 'expected_public_surface_manifest_sha256',
  'approved_at', 'valid_from', 'valid_until', 'revocation_reference',
  'revoked_at', 'authority_role', 'authorizer_identity', 'key_id',
  'decision_reference', 'trust_registry_path', 'trust_registry_sha256',
  'prior_l1_approval', 'invited_evidence_index', 'assessed_production_authority',
]);
const PRIOR_L1_KEYS = sorted([
  'approval_path', 'approval_sha256', 'signature_bundle_path',
  'signature_bundle_sha256', 'approval_commit_sha',
]);
const INVITED_INDEX_KEYS = sorted(['evidence_id', 'evidence_sha256', 'signature_bundle_sha256']);
const APPROVAL_BUNDLE_KEYS = sorted([
  'schema_version', 'signature_bundle_id', 'domain', 'repository',
  'beta_release_id', 'publication_level', 'approval_path', 'approval_sha256',
  'trust_registry_path', 'trust_registry_sha256', 'reviewed_commit_sha',
  'canonical_scope_sha256', 'expected_public_surface_manifest_sha256',
  'intended_origin', 'intended_aliases', 'signatures',
]);
const SIGNATURE_KEYS = sorted(['role', 'identity', 'key_id', 'signature_base64']);
const EVIDENCE_KEYS = sorted([
  'schema_version', 'evidence_id', 'evidence_kind', 'repository',
  'beta_release_id', 'publication_level', 'intended_origin', 'intended_aliases',
  'reviewed_commit_sha', 'canonical_scope_sha256',
  'expected_public_surface_manifest_sha256', 'approval_sha256',
  'prior_evidence_sha256', 'observed_at', 'observation', 'result',
  'producer_identity', 'reviewer_identity', 'reviewed_artifacts',
  'remote_index_sha256', 'rollback_subset_sha256', 'assessed_production_authority',
  'production_baseline_origin', 'production_baseline_inventory_sha256',
]);
const ARTIFACT_PIN_KEYS = sorted(['path', 'sha256']);
const EVIDENCE_BUNDLE_KEYS = sorted([
  'schema_version', 'signature_bundle_id', 'domain', 'repository',
  'beta_release_id', 'evidence_id', 'evidence_kind', 'evidence_sha256',
  'signed_at', 'signatures',
]);
const PACKAGE_KEYS = sorted([
  'repository', 'beta_release_id', 'package_commit_sha', 'current_commit_sha',
  'canonical_scope_sha256', 'recomputed_scope_sha256',
  'expected_public_surface_manifest_sha256',
  'recomputed_expected_public_surface_manifest_sha256', 'policy_sha256',
  'trust_registry_sha256', 'deterministic_package_checks_passed',
  'required_artifacts_present', 'public_surface_boundary_passed',
  'package_commit_ancestor_of_current', 'bound_package_paths_unchanged',
  'candidate_artifacts_absent', 'governance_excluded_from_staged_surface',
  'assessed_production_authority', 'release_builder_identity',
]);
const LINEAGE_KEYS = sorted([
  'l1_approval_commit_sha', 'l1_approval_commit_ancestor_of_current',
  'l1_bound_bytes_unchanged', 'l2_approval_commit_sha',
  'l2_approval_commit_ancestor_of_current', 'l2_bound_bytes_unchanged',
]);
const ASSESSED_BOUNDARY_KEYS = sorted([
  'schema_version', 'selected_state', 'baseline_id', 'expected_probe_sha256',
  'observed_probe_sha256', 'production_readiness_status', 'strict_truth_status',
  'beta_paths_counted_as_assessed_inputs', 'assessed_gate_semantics_unchanged',
  'assessed_production_authority_from_beta',
]);

function sorted(values) { return Object.freeze(values.slice().sort()); }

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function canonicalJson(value) { return JSON.stringify(stable(value)); }
function same(left, right) { return canonicalJson(left) === canonicalJson(right); }
function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    same(Object.keys(value).sort(), keys);
}
function exactArray(value, expected) {
  return Array.isArray(value) && same(value, expected);
}
function hex(value, length) {
  return typeof value === 'string' && new RegExp('^[0-9a-f]{' + length + '}$').test(value);
}
function validReleaseId(value) {
  return typeof value === 'string' && /^(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/.test(value);
}
function validTimestamp(value) {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}
function validOrigin(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
      parsed.pathname === '/' && !parsed.search && !parsed.hash && parsed.origin === value;
  } catch (_) { return false; }
}
function validReference(value) {
  return typeof value === 'string' && value.trim() === value && value.length >= 5 && value.length <= 512 &&
    !/[\u0000-\u001f]/.test(value) &&
    !/(?:^|[\s@._-])(fake|invented|unknown|example|placeholder|tbd|todo)(?:$|[\s@._-])/i.test(value);
}
function validArtifactPins(value) {
  if (!Array.isArray(value) || value.length === 0) return false;
  const paths = [];
  for (const pin of value) {
    if (!exactKeys(pin, ARTIFACT_PIN_KEYS) || typeof pin.path !== 'string' ||
        pin.path.startsWith('/') || pin.path.includes('\\') || pin.path.split('/').includes('..') ||
        pin.path.trim() !== pin.path || pin.path.length < 3 || !hex(pin.sha256, 64)) return false;
    paths.push(pin.path);
  }
  return new Set(paths).size === paths.length && same(paths, paths.slice().sort());
}
function validIdentity(value) {
  return validReference(value) && value.length <= 256;
}
function textParsesAs(text, value) {
  if (typeof text !== 'string') return false;
  try {
    return same(parseJsonNoDuplicateKeys(text, 'signed/control JSON'), value) &&
      text === canonicalJsonText(value);
  } catch (_) { return false; }
}
function canonicalSignature(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value)) return null;
  const bytes = Buffer.from(value, 'base64');
  return bytes.length === 64 && bytes.toString('base64') === value ? bytes : null;
}
function approvalPath(betaReleaseId, level) {
  if (!validReleaseId(betaReleaseId) || !PUBLICATION_LEVELS.includes(level)) return null;
  return 'data/climate/public-beta/governance/releases/' + betaReleaseId + '/' + APPROVAL_PATHS[level];
}
function signatureBundlePath(betaReleaseId, level) {
  if (!validReleaseId(betaReleaseId) || !PUBLICATION_LEVELS.includes(level)) return null;
  return 'data/climate/public-beta/governance/releases/' + betaReleaseId + '/' + SIGNATURE_BUNDLE_PATHS[level];
}
function report(checks, extra) {
  const failures = checks.filter(item => !item.pass).map(item => item.id);
  return Object.assign({ status: failures.length ? 'fail' : 'pass', checks, failure_ids: failures }, extra || {});
}
function checker() {
  const checks = [];
  return {
    add(id, pass) { checks.push({ id, pass: pass === true }); },
    done(extra) { return report(checks, extra); },
  };
}

function validatePolicy(policy) {
  const c = checker();
  c.add('policy-shape', exactKeys(policy, POLICY_KEYS));
  c.add('policy-identity', policy?.schema_version === POLICY_VERSION &&
    policy?.policy_id === 'elu-climate-public-beta-policy-v1' && policy?.status === 'frozen' &&
    policy?.repository === REPOSITORY && policy?.product_tier === 'climate_public_beta');
  c.add('policy-no-assessed-authority', policy?.assessed_production_authority === false);
  c.add('policy-levels-and-states', exactArray(policy?.publication_levels, PUBLICATION_LEVELS) &&
    exactArray(policy?.release_states, RELEASE_STATES));
  c.add('policy-role-sets', exactArray(policy?.required_roles, REQUIRED_ROLES) &&
    exactArray(policy?.required_review_roles, REQUIRED_REVIEW_ROLES) &&
    exactArray(policy?.remote_evidence_roles, REMOTE_EVIDENCE_ROLES) && policy?.approval_role === APPROVAL_ROLE);
  c.add('policy-origins', exactKeys(policy?.approved_origins, sorted(PUBLICATION_LEVELS)) &&
    PUBLICATION_LEVELS.every(level => validOrigin(policy?.approved_origins?.[level])));
  c.add('policy-aliases', exactKeys(policy?.approved_aliases, sorted(PUBLICATION_LEVELS)) &&
    PUBLICATION_LEVELS.every(level => {
      const aliases = policy?.approved_aliases?.[level];
      return Array.isArray(aliases) && aliases.length > 0 && aliases.every(validOrigin) &&
        new Set(aliases).size === aliases.length && same(aliases, aliases.slice().sort()) &&
        aliases.includes(policy?.approved_origins?.[level]);
    }));
  c.add('policy-hosting-project', exactKeys(policy?.hosting_project, HOSTING_PROJECT_KEYS) &&
    policy?.hosting_project?.provider === 'cloudflare_pages' &&
    typeof policy?.hosting_project?.project_id === 'string' &&
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(policy.hosting_project.project_id) &&
    policy?.hosting_project?.production_branch === 'main' &&
    policy?.hosting_project?.access_scope === 'project_wide_all_deployments' &&
    validReference(policy?.hosting_project?.access_policy_reference) &&
    policy?.hosting_project?.pages_dev_origin ===
      `https://${policy?.hosting_project?.project_id}.pages.dev` &&
    policy?.hosting_project?.deployment_alias_hostname_suffix ===
      `.${policy?.hosting_project?.project_id}.pages.dev` &&
    PUBLICATION_LEVELS.every(level =>
      policy?.approved_aliases?.[level]?.includes(policy.hosting_project.pages_dev_origin)) &&
    hex(policy?.hosting_project?.holding_content_sha256, 64) &&
    policy?.hosting_project?.deployment_replacement_lock_required === true);
  c.add('policy-production-baseline-origin', validOrigin(policy?.production_baseline_origin) &&
    !PUBLICATION_LEVELS.some(level => policy?.approved_aliases?.[level]?.includes(policy.production_baseline_origin)) &&
    hex(policy?.production_baseline_inventory_sha256, 64));
  c.add('policy-rollback-target', exactKeys(policy?.rollback_target, ROLLBACK_TARGET_KEYS) &&
    ['access_locked_holding_page', 'withdrawn_origin', 'project_access_lock'].includes(policy?.rollback_target?.type) &&
    validReference(policy?.rollback_target?.reference));
  c.add('policy-governance-contracts',
    exactKeys(policy?.governance_contracts, GOVERNANCE_CONTRACT_KEYS) &&
    policy?.governance_contracts?.review_protocol_path ===
      'data/climate/public-beta/governance/review-protocol.json' &&
    hex(policy?.governance_contracts?.review_protocol_sha256, 64) &&
    policy?.governance_contracts?.feedback_privacy_contract_path ===
      'data/climate/public-beta/governance/feedback-privacy-contract.json' &&
    hex(policy?.governance_contracts?.feedback_privacy_contract_sha256, 64));
  c.add('policy-thresholds-frozen', exactKeys(policy?.frozen_thresholds, THRESHOLD_KEYS) &&
    THRESHOLD_KEYS.every(key => Number.isInteger(policy?.frozen_thresholds?.[key]) && policy.frozen_thresholds[key] > 0) &&
    policy?.frozen_thresholds?.remote_probe_interval_seconds <= policy?.frozen_thresholds?.monitoring_window_seconds);
  const denialStatuses = policy?.unauthorized_access_policy?.allowed_statuses;
  const redirectOrigins = policy?.unauthorized_access_policy?.allowed_redirect_origins;
  c.add('policy-unauthorized-access-contract', exactKeys(policy?.unauthorized_access_policy, UNAUTHORIZED_ACCESS_KEYS) &&
    Array.isArray(denialStatuses) && denialStatuses.length > 0 &&
    denialStatuses.every(value => Number.isInteger(value) && [302, 401, 403, 404].includes(value)) &&
    new Set(denialStatuses).size === denialStatuses.length && same(denialStatuses, denialStatuses.slice().sort((a, b) => a - b)) &&
    Array.isArray(redirectOrigins) && redirectOrigins.every(validOrigin) &&
    new Set(redirectOrigins).size === redirectOrigins.length && same(redirectOrigins, redirectOrigins.slice().sort()));
  c.add('policy-independence', exactKeys(policy?.independence_rules, INDEPENDENCE_KEYS) &&
    INDEPENDENCE_KEYS.every(key => policy?.independence_rules?.[key] === true));
  c.add('policy-no-assessment-contract', exactKeys(policy?.no_assessment_contract, NO_ASSESSMENT_KEYS) &&
    NO_ASSESSMENT_KEYS.every(key => policy?.no_assessment_contract?.[key] === false));
  c.add('policy-decision-reference', validReference(policy?.decision_reference));
  return c.done();
}

function publicKeyRecord(authority) {
  if (!exactKeys(authority, AUTHORITY_KEYS) || authority.algorithm !== 'Ed25519' ||
      !REQUIRED_ROLES.includes(authority.role) || !validIdentity(authority.identity) ||
      !['active', 'revoked'].includes(authority.status) || !validTimestamp(authority.valid_from) ||
      !validTimestamp(authority.valid_until) || new Date(authority.valid_until) <= new Date(authority.valid_from) ||
      typeof authority.public_key_spki_pem !== 'string' ||
      !authority.public_key_spki_pem.startsWith('-----BEGIN PUBLIC KEY-----\n') ||
      !authority.public_key_spki_pem.endsWith('-----END PUBLIC KEY-----\n') ||
      /PRIVATE KEY/.test(authority.public_key_spki_pem)) {
    return { ok: false, key: null, derived_key_id: null };
  }
  if ((authority.status === 'active' && authority.revoked_at !== null) ||
      (authority.status === 'revoked' &&
        (!validTimestamp(authority.revoked_at) ||
          new Date(authority.revoked_at) < new Date(authority.valid_from) ||
          new Date(authority.revoked_at) >= new Date(authority.valid_until)))) {
    return { ok: false, key: null, derived_key_id: null };
  }
  try {
    const key = crypto.createPublicKey(authority.public_key_spki_pem);
    if (key.asymmetricKeyType !== 'ed25519' || key.export({ type: 'spki', format: 'pem' }) !== authority.public_key_spki_pem) {
      return { ok: false, key: null, derived_key_id: null };
    }
    const derivedKeyId = 'ed25519:' + sha256(key.export({ type: 'spki', format: 'der' }));
    return { ok: authority.key_id === derivedKeyId, key, derived_key_id: derivedKeyId };
  } catch (_) { return { ok: false, key: null, derived_key_id: null }; }
}

function derivedRegistryStatus(registry, records) {
  const authorities = Array.isArray(registry?.authorities) ? registry.authorities : [];
  if (!authorities.length) return 'unprovisioned';
  const activeRoles = new Set(authorities.map((authority, index) =>
    records[index]?.ok && authority.status === 'active' ? authority.role : null).filter(Boolean));
  return REQUIRED_ROLES.every(role => activeRoles.has(role)) ? 'provisioned' : 'incomplete';
}

function evaluateTrustRegistry(registry) {
  const c = checker();
  const authorities = Array.isArray(registry?.authorities) ? registry.authorities : [];
  const records = authorities.map(publicKeyRecord);
  c.add('trust-registry-shape', exactKeys(registry, REGISTRY_KEYS));
  c.add('trust-registry-identity', registry?.schema_version === POLICY_VERSION &&
    registry?.registry_id === 'elu-climate-public-beta-trust-v1' && registry?.repository === REPOSITORY &&
    exactArray(registry?.required_roles, REQUIRED_ROLES));
  c.add('trust-authority-records', records.every(record => record.ok) &&
    new Set(authorities.map(item => item.key_id)).size === authorities.length);
  const derived = derivedRegistryStatus(registry, records);
  c.add('trust-derived-status', registry?.status === derived);
  return c.done({ records, derived_status: derived });
}

function approvalSignatureMessage(fields) {
  return SIGNATURE_DOMAIN + '\n' +
    'repository=' + fields.repository + '\n' +
    'beta_release_id=' + fields.beta_release_id + '\n' +
    'publication_level=' + fields.publication_level + '\n' +
    'approval_path=' + fields.approval_path + '\n' +
    'approval_sha256=' + fields.approval_sha256 + '\n' +
    'trust_registry_path=' + fields.trust_registry_path + '\n' +
    'trust_registry_sha256=' + fields.trust_registry_sha256 + '\n' +
    'reviewed_commit_sha=' + fields.reviewed_commit_sha + '\n' +
    'canonical_scope_sha256=' + fields.canonical_scope_sha256 + '\n' +
    'expected_public_surface_manifest_sha256=' + fields.expected_public_surface_manifest_sha256 + '\n' +
    'intended_origin=' + fields.intended_origin + '\n' +
    'intended_aliases_sha256=' + sha256(canonicalJson(fields.intended_aliases)) + '\n' +
    'role=' + fields.role + '\n' +
    'identity=' + fields.identity + '\n' +
    'key_id=' + fields.key_id + '\n';
}

function evidenceSignatureMessage(fields) {
  return EVIDENCE_SIGNATURE_DOMAIN + '\n' +
    'repository=' + fields.repository + '\n' +
    'beta_release_id=' + fields.beta_release_id + '\n' +
    'evidence_id=' + fields.evidence_id + '\n' +
    'evidence_kind=' + fields.evidence_kind + '\n' +
    'evidence_sha256=' + fields.evidence_sha256 + '\n' +
    'signed_at=' + fields.signed_at + '\n' +
    'role=' + fields.role + '\n' +
    'identity=' + fields.identity + '\n' +
    'key_id=' + fields.key_id + '\n';
}

function authorityFor(reportValue, registry, signature, at) {
  if (!validTimestamp(at)) return null;
  const index = Array.isArray(registry?.authorities) ? registry.authorities.findIndex(item =>
    item.key_id === signature?.key_id) : -1;
  if (index < 0) return null;
  const authority = registry.authorities[index];
  const record = reportValue.records[index];
  if (!record?.ok || authority.status !== 'active' || authority.revoked_at !== null ||
      authority.role !== signature.role || authority.identity !== signature.identity ||
      new Date(authority.valid_from) > new Date(at) || new Date(at) >= new Date(authority.valid_until)) return null;
  return { authority, key: record.key };
}

function validateApprovalDocument(approval, expected, policy, verificationTime) {
  const c = checker();
  const level = expected.publication_level;
  c.add('approval-shape', exactKeys(approval, APPROVAL_KEYS));
  c.add('approval-identity', approval?.schema_version === POLICY_VERSION && approval?.repository === REPOSITORY &&
    approval?.approval_id === 'elu-climate-public-beta-' + expected.beta_release_id + '-' + level + '-approval-v1' &&
    approval?.beta_release_id === expected.beta_release_id && approval?.decision === 'approve');
  c.add('approval-level-origin', PUBLICATION_LEVELS.includes(level) && approval?.publication_level === level &&
    validOrigin(approval?.intended_origin) && approval?.intended_origin === expected.intended_origin &&
    approval?.intended_origin === policy?.approved_origins?.[level]);
  c.add('approval-level-aliases', Array.isArray(approval?.intended_aliases) &&
    same(approval.intended_aliases, expected.intended_aliases) &&
    same(approval.intended_aliases, policy?.approved_aliases?.[level]) &&
    approval.intended_aliases.every(validOrigin) &&
    new Set(approval.intended_aliases).size === approval.intended_aliases.length &&
    same(approval.intended_aliases, approval.intended_aliases.slice().sort()) &&
    approval.intended_aliases.includes(approval.intended_origin));
  c.add('approval-package-bindings', approval?.reviewed_commit_sha === expected.reviewed_commit_sha &&
    approval?.canonical_scope_sha256 === expected.canonical_scope_sha256 &&
    approval?.expected_public_surface_manifest_sha256 === expected.expected_public_surface_manifest_sha256 &&
    hex(approval?.reviewed_commit_sha, 40) && hex(approval?.canonical_scope_sha256, 64) &&
    hex(approval?.expected_public_surface_manifest_sha256, 64));
  c.add('approval-authority', approval?.authority_role === APPROVAL_ROLE &&
    validIdentity(approval?.authorizer_identity) && hex((approval?.key_id || '').replace(/^ed25519:/, ''), 64) &&
    validReference(approval?.decision_reference));
  c.add('approval-no-assessed-authority', approval?.assessed_production_authority === false);
  c.add('approval-trust-binding', approval?.trust_registry_path === TRUST_REGISTRY_PATH &&
    approval?.trust_registry_sha256 === expected.trust_registry_sha256 && hex(approval?.trust_registry_sha256, 64));
  const timesValid = validTimestamp(approval?.approved_at) && validTimestamp(approval?.valid_from) &&
    validTimestamp(approval?.valid_until) && validTimestamp(verificationTime);
  const validityMs = timesValid ? new Date(approval.valid_until) - new Date(approval.valid_from) : -1;
  c.add('approval-validity-window', timesValid && new Date(approval.valid_from) <= new Date(approval.approved_at) &&
    new Date(approval.approved_at) < new Date(approval.valid_until) &&
    new Date(approval.approved_at) <= new Date(verificationTime) &&
    new Date(approval.valid_from) <= new Date(verificationTime) && new Date(verificationTime) < new Date(approval.valid_until) &&
    validityMs > 0 && validityMs <= policy?.frozen_thresholds?.approval_validity_max_seconds * 1000 &&
    approval?.revoked_at === null && validReference(approval?.revocation_reference));
  if (level === 'invited_beta') {
    c.add('approval-l1-separation', approval?.prior_l1_approval === null && approval?.invited_evidence_index === null);
  } else {
    c.add('approval-l2-prior-l1-binding', exactKeys(approval?.prior_l1_approval, PRIOR_L1_KEYS) &&
      same(approval?.prior_l1_approval, expected.prior_l1_approval));
    c.add('approval-l2-invited-evidence-binding', exactKeys(approval?.invited_evidence_index, INVITED_INDEX_KEYS) &&
      same(approval?.invited_evidence_index, expected.invited_evidence_index));
  }
  return c.done();
}

function verifyApproval(input, expected) {
  const c = checker();
  const approval = input?.approval;
  const bundle = input?.signature_bundle;
  const registry = input?.trust_registry;
  const approvalSha = typeof input?.approval_text === 'string' ? sha256(input.approval_text) : null;
  const bundleSha = typeof input?.signature_bundle_text === 'string' ? sha256(input.signature_bundle_text) : null;
  const registrySha = typeof input?.trust_registry_text === 'string' ? sha256(input.trust_registry_text) : null;
  const trust = evaluateTrustRegistry(registry);
  const document = validateApprovalDocument(approval, Object.assign({}, expected, { trust_registry_sha256: registrySha }),
    input?.policy, input?.verification_time);
  c.add('approval-files-regular', input?.approval_file_regular === true &&
    input?.signature_bundle_file_regular === true && input?.trust_registry_file_regular === true);
  c.add('approval-json-byte-bindings', textParsesAs(input?.approval_text, approval) &&
    textParsesAs(input?.signature_bundle_text, bundle) && textParsesAs(input?.trust_registry_text, registry));
  c.add('approval-document-valid', document.status === 'pass');
  c.add('approval-policy-valid', validatePolicy(input?.policy).status === 'pass');
  c.add('approval-trust-provisioned', trust.status === 'pass' && trust.derived_status === 'provisioned');
  c.add('approval-trust-exact-binding', registrySha === expected?.trust_registry_sha256);
  c.add('approval-bundle-shape', exactKeys(bundle, APPROVAL_BUNDLE_KEYS));
  const level = expected?.publication_level;
  const path = approvalPath(expected?.beta_release_id, level);
  c.add('approval-bundle-bindings', bundle?.schema_version === POLICY_VERSION &&
    bundle?.signature_bundle_id === 'elu-climate-public-beta-' + expected?.beta_release_id + '-' + level + '-approval-signatures-v1' &&
    bundle?.domain === SIGNATURE_DOMAIN && bundle?.repository === REPOSITORY &&
    bundle?.beta_release_id === expected?.beta_release_id && bundle?.publication_level === level &&
    bundle?.approval_path === path && bundle?.approval_sha256 === approvalSha &&
    bundle?.trust_registry_path === TRUST_REGISTRY_PATH && bundle?.trust_registry_sha256 === registrySha &&
    bundle?.reviewed_commit_sha === expected?.reviewed_commit_sha &&
    bundle?.canonical_scope_sha256 === expected?.canonical_scope_sha256 &&
    bundle?.expected_public_surface_manifest_sha256 === expected?.expected_public_surface_manifest_sha256 &&
    bundle?.intended_origin === expected?.intended_origin &&
    same(bundle?.intended_aliases, expected?.intended_aliases));
  const signatures = Array.isArray(bundle?.signatures) ? bundle.signatures : [];
  c.add('approval-signature-role-set', signatures.length === 1 && exactKeys(signatures[0], SIGNATURE_KEYS) &&
    signatures[0].role === APPROVAL_ROLE && signatures[0].identity === approval?.authorizer_identity &&
    signatures[0].key_id === approval?.key_id);
  let signatureValid = false;
  if (signatures.length === 1) {
    const signature = signatures[0];
    const selected = authorityFor(trust, registry, signature, approval?.approved_at);
    const bytes = canonicalSignature(signature.signature_base64);
    const message = approvalSignatureMessage({
      repository: REPOSITORY, beta_release_id: expected?.beta_release_id,
      publication_level: level, approval_path: path, approval_sha256: approvalSha,
      trust_registry_path: TRUST_REGISTRY_PATH, trust_registry_sha256: registrySha,
      reviewed_commit_sha: expected?.reviewed_commit_sha,
      canonical_scope_sha256: expected?.canonical_scope_sha256,
      expected_public_surface_manifest_sha256: expected?.expected_public_surface_manifest_sha256,
      intended_origin: expected?.intended_origin, intended_aliases: expected?.intended_aliases,
      role: signature.role,
      identity: signature.identity, key_id: signature.key_id,
    });
    try { signatureValid = Boolean(selected && bytes && crypto.verify(null, Buffer.from(message, 'utf8'), selected.key, bytes)); }
    catch (_) { signatureValid = false; }
  }
  c.add('approval-detached-ed25519-signature', signatureValid);
  c.add('approval-authorizer-independent', validIdentity(expected?.release_builder_identity) &&
    approval?.authorizer_identity !== expected?.release_builder_identity);
  return c.done({ approval_sha256: approvalSha, signature_bundle_sha256: bundleSha,
    trust_registry_sha256: registrySha, document_report: document, trust_report: trust });
}

function verifySignedEvidence(input, expected) {
  const c = checker();
  const evidence = input?.evidence;
  const bundle = input?.signature_bundle;
  const registry = input?.trust_registry;
  const evidenceSha = typeof input?.evidence_text === 'string' ? sha256(input.evidence_text) : null;
  const bundleSha = typeof input?.signature_bundle_text === 'string' ? sha256(input.signature_bundle_text) : null;
  const trust = evaluateTrustRegistry(registry);
  const config = EVIDENCE_CONFIG[expected?.evidence_kind];
  c.add('evidence-files-regular', input?.evidence_file_regular === true &&
    input?.signature_bundle_file_regular === true && input?.trust_registry_file_regular === true);
  c.add('evidence-json-byte-bindings', textParsesAs(input?.evidence_text, evidence) &&
    textParsesAs(input?.signature_bundle_text, bundle) && textParsesAs(input?.trust_registry_text, registry));
  c.add('evidence-shape', exactKeys(evidence, EVIDENCE_KEYS) && exactKeys(bundle, EVIDENCE_BUNDLE_KEYS));
  c.add('evidence-kind-policy', Boolean(config) && evidence?.evidence_kind === expected?.evidence_kind &&
    evidence?.publication_level === config?.level && evidence?.observation === config?.observation);
  c.add('evidence-level-surface', config?.level === 'package'
    ? evidence?.intended_origin === null && evidence?.intended_aliases === null &&
      evidence?.production_baseline_origin === null && evidence?.production_baseline_inventory_sha256 === null
    : validOrigin(evidence?.intended_origin) && Array.isArray(evidence?.intended_aliases) &&
      evidence.intended_aliases.length > 0 && evidence.intended_aliases.every(validOrigin) &&
      new Set(evidence.intended_aliases).size === evidence.intended_aliases.length &&
      same(evidence.intended_aliases, evidence.intended_aliases.slice().sort()) &&
      evidence.intended_aliases.includes(evidence.intended_origin) &&
      validOrigin(evidence?.production_baseline_origin) &&
      !evidence.intended_aliases.includes(evidence.production_baseline_origin) &&
      hex(evidence?.production_baseline_inventory_sha256, 64));
  c.add('evidence-identity', evidence?.schema_version === POLICY_VERSION && evidence?.repository === REPOSITORY &&
    evidence?.beta_release_id === expected?.beta_release_id && evidence?.result === 'pass' &&
    evidence?.assessed_production_authority === false && validReference(evidence?.evidence_id));
  c.add('evidence-exact-bindings', evidence?.intended_origin === (expected?.intended_origin ?? null) &&
    same(evidence?.intended_aliases, expected?.intended_aliases ?? null) &&
    evidence?.production_baseline_origin === (expected?.production_baseline_origin ?? null) &&
    evidence?.production_baseline_inventory_sha256 === (expected?.production_baseline_inventory_sha256 ?? null) &&
    evidence?.reviewed_commit_sha === (expected?.reviewed_commit_sha ?? null) &&
    evidence?.canonical_scope_sha256 === (expected?.canonical_scope_sha256 ?? null) &&
    evidence?.expected_public_surface_manifest_sha256 === (expected?.expected_public_surface_manifest_sha256 ?? null) &&
    evidence?.approval_sha256 === (expected?.approval_sha256 ?? null) &&
    evidence?.prior_evidence_sha256 === (expected?.prior_evidence_sha256 ?? null));
  c.add('evidence-reviewed-artifacts', validArtifactPins(evidence?.reviewed_artifacts) &&
    same(evidence.reviewed_artifacts, expected?.reviewed_artifacts) &&
    (config?.level === 'package'
      ? evidence?.remote_index_sha256 === null && evidence?.rollback_subset_sha256 === null
      : hex(expected?.remote_index_sha256, 64) && hex(expected?.rollback_subset_sha256, 64) &&
        evidence?.remote_index_sha256 === expected?.remote_index_sha256 &&
        evidence?.rollback_subset_sha256 === expected?.rollback_subset_sha256));
  c.add('evidence-observation-time', validTimestamp(evidence?.observed_at) &&
    validTimestamp(input?.verification_time) && new Date(evidence?.observed_at) <= new Date(input.verification_time));
  c.add('evidence-signing-chronology', validTimestamp(bundle?.signed_at) &&
    new Date(bundle.signed_at) >= new Date(evidence?.observed_at) &&
    new Date(bundle.signed_at) <= new Date(input?.verification_time));
  c.add('evidence-independence', validIdentity(evidence?.producer_identity) &&
    validIdentity(evidence?.reviewer_identity) && evidence?.producer_identity !== evidence?.reviewer_identity);
  c.add('evidence-trust-provisioned', trust.status === 'pass' && trust.derived_status === 'provisioned' &&
    sha256(input?.trust_registry_text || '') === expected?.trust_registry_sha256);
  c.add('evidence-bundle-binding', bundle?.schema_version === POLICY_VERSION &&
    bundle?.signature_bundle_id === 'elu-climate-public-beta-' + evidence?.evidence_id + '-signatures-v1' &&
    bundle?.domain === EVIDENCE_SIGNATURE_DOMAIN && bundle?.repository === REPOSITORY &&
    bundle?.beta_release_id === expected?.beta_release_id && bundle?.evidence_id === evidence?.evidence_id &&
    bundle?.evidence_kind === expected?.evidence_kind && bundle?.evidence_sha256 === evidenceSha);
  const signatures = Array.isArray(bundle?.signatures) ? bundle.signatures : [];
  c.add('evidence-signature-role-set', Boolean(config) && signatures.length === config?.roles.length &&
    signatures.every((signature, index) => exactKeys(signature, SIGNATURE_KEYS) && signature.role === config.roles[index]) &&
    new Set(signatures.map(item => item.key_id)).size === signatures.length);
  let signaturesValid = Boolean(config) && signatures.length === config.roles.length;
  signatures.forEach(signature => {
    const selected = authorityFor(trust, registry, signature, bundle?.signed_at);
    const bytes = canonicalSignature(signature.signature_base64);
    const message = evidenceSignatureMessage({
      repository: REPOSITORY, beta_release_id: expected?.beta_release_id,
      evidence_id: evidence?.evidence_id, evidence_kind: expected?.evidence_kind,
      evidence_sha256: evidenceSha, signed_at: bundle?.signed_at,
      role: signature.role, identity: signature.identity,
      key_id: signature.key_id,
    });
    let verified = false;
    try { verified = Boolean(selected && bytes && crypto.verify(null, Buffer.from(message, 'utf8'), selected.key, bytes)); }
    catch (_) { verified = false; }
    if (!verified) signaturesValid = false;
  });
  if (config?.roles.length === 1) {
    c.add('evidence-signer-identities', signatures[0]?.identity === evidence?.reviewer_identity);
  } else {
    const byRole = Object.fromEntries(signatures.map(item => [item.role, item.identity]));
    c.add('evidence-signer-identities', byRole.beta_release_operator === evidence?.producer_identity &&
      byRole.beta_rollback_reviewer === evidence?.reviewer_identity);
  }
  c.add('evidence-detached-ed25519-signatures', signaturesValid);
  return c.done({ evidence_sha256: evidenceSha, signature_bundle_sha256: bundleSha, trust_report: trust });
}

function evaluateAssessedBoundary(boundary) {
  const c = checker();
  c.add('assessed-boundary-shape', exactKeys(boundary, ASSESSED_BOUNDARY_KEYS));
  c.add('assessed-boundary-identity', boundary?.schema_version === POLICY_VERSION &&
    ['candidate_or_incomplete', 'reviewed_release'].includes(boundary?.selected_state) &&
    validReference(boundary?.baseline_id));
  c.add('assessed-boundary-exact-probe', hex(boundary?.expected_probe_sha256, 64) &&
    boundary?.observed_probe_sha256 === boundary?.expected_probe_sha256);
  if (boundary?.selected_state === 'candidate_or_incomplete') {
    c.add('assessed-boundary-state-semantics', boundary?.production_readiness_status === 'blocked' &&
      boundary?.strict_truth_status === 'fail');
  } else {
    c.add('assessed-boundary-state-semantics', boundary?.production_readiness_status === 'release_ready' &&
      boundary?.strict_truth_status === 'pass');
  }
  c.add('assessed-boundary-isolation', boundary?.beta_paths_counted_as_assessed_inputs === false &&
    boundary?.assessed_gate_semantics_unchanged === true &&
    boundary?.assessed_production_authority_from_beta === false);
  return c.done();
}

function evaluatePolicy(input) {
  const packageChecks = checker();
  const policy = input?.policy;
  const registry = input?.trust_registry;
  const pkg = input?.package;
  const verificationTime = input?.verification_time;
  const policySha = typeof input?.policy_text === 'string' ? sha256(input.policy_text) : null;
  const registrySha = typeof input?.trust_registry_text === 'string' ? sha256(input.trust_registry_text) : null;
  const policyReport = validatePolicy(policy);
  const trustReport = evaluateTrustRegistry(registry);
  const assessedReport = evaluateAssessedBoundary(input?.assessed_boundary);
  packageChecks.add('package-control-files-regular', input?.policy_file_regular === true && input?.trust_registry_file_regular === true);
  packageChecks.add('package-control-json-byte-bindings', textParsesAs(input?.policy_text, policy) &&
    textParsesAs(input?.trust_registry_text, registry));
  packageChecks.add('package-policy-valid', policyReport.status === 'pass');
  packageChecks.add('package-trust-provisioned', trustReport.status === 'pass' && trustReport.derived_status === 'provisioned');
  packageChecks.add('package-shape', exactKeys(pkg, PACKAGE_KEYS));
  packageChecks.add('package-identity', pkg?.repository === REPOSITORY && validReleaseId(pkg?.beta_release_id) &&
    validIdentity(pkg?.release_builder_identity));
  packageChecks.add('package-commit-binding', hex(pkg?.package_commit_sha, 40) && hex(pkg?.current_commit_sha, 40) &&
    pkg?.package_commit_ancestor_of_current === true && pkg?.bound_package_paths_unchanged === true);
  packageChecks.add('package-scope-binding', hex(pkg?.canonical_scope_sha256, 64) &&
    pkg?.canonical_scope_sha256 === pkg?.recomputed_scope_sha256);
  packageChecks.add('package-surface-binding', hex(pkg?.expected_public_surface_manifest_sha256, 64) &&
    pkg?.expected_public_surface_manifest_sha256 === pkg?.recomputed_expected_public_surface_manifest_sha256 &&
    pkg?.public_surface_boundary_passed === true && pkg?.candidate_artifacts_absent === true &&
    pkg?.governance_excluded_from_staged_surface === true);
  packageChecks.add('package-control-hashes', pkg?.policy_sha256 === policySha && pkg?.trust_registry_sha256 === registrySha);
  packageChecks.add('package-deterministic-completeness', pkg?.deterministic_package_checks_passed === true &&
    pkg?.required_artifacts_present === true);
  packageChecks.add('package-no-assessed-authority', pkg?.assessed_production_authority === false);
  packageChecks.add('package-assessed-boundary', assessedReport.status === 'pass');
  packageChecks.add('package-verification-time', validTimestamp(verificationTime));

  const reviewReports = {};
  const reviewInput = input?.package_review_evidence;
  const reviewPins = input?.package_review_artifact_pins;
  const reviewSetExact = exactKeys(reviewInput, sorted(REQUIRED_REVIEW_ROLES));
  packageChecks.add('package-review-role-set', reviewSetExact);
  const reviewPinsExact = exactKeys(reviewPins, sorted(REQUIRED_REVIEW_ROLES)) &&
    REQUIRED_REVIEW_ROLES.every(role => validArtifactPins(reviewPins?.[role]));
  packageChecks.add('package-review-artifact-pin-sets', reviewPinsExact);
  REQUIRED_REVIEW_ROLES.forEach(role => {
    const kind = REVIEW_KIND_BY_ROLE[role];
    const wrapper = reviewInput?.[role];
    reviewReports[role] = verifySignedEvidence(Object.assign({}, wrapper, {
      trust_registry: registry, trust_registry_text: input?.trust_registry_text,
      trust_registry_file_regular: input?.trust_registry_file_regular,
      verification_time: verificationTime,
    }), {
      evidence_kind: kind, beta_release_id: pkg?.beta_release_id,
      intended_origin: null, intended_aliases: null, production_baseline_origin: null,
      production_baseline_inventory_sha256: null,
      reviewed_commit_sha: null, canonical_scope_sha256: null,
      expected_public_surface_manifest_sha256: null, approval_sha256: null,
      prior_evidence_sha256: null, reviewed_artifacts: reviewPins?.[role],
      trust_registry_sha256: registrySha,
    });
  });
  packageChecks.add('package-review-attestations', reviewSetExact && reviewPinsExact &&
    REQUIRED_REVIEW_ROLES.every(role => reviewReports[role].status === 'pass'));
  const packageReport = packageChecks.done({ policy_report: policyReport, trust_report: trustReport,
    assessed_boundary_report: assessedReport, review_reports: reviewReports });

  const lineage = input?.commit_lineage;
  const remoteBindings = input?.remote_evidence_bindings;
  const remotePins = input?.remote_evidence_artifact_pins;
  const lineageShape = exactKeys(lineage, LINEAGE_KEYS);
  const l1ApprovalInput = input?.approvals?.invited_beta;
  const l1Expected = {
    beta_release_id: pkg?.beta_release_id, publication_level: 'invited_beta',
    intended_origin: policy?.approved_origins?.invited_beta,
    intended_aliases: policy?.approved_aliases?.invited_beta,
    production_baseline_origin: policy?.production_baseline_origin,
    production_baseline_inventory_sha256: policy?.production_baseline_inventory_sha256,
    reviewed_commit_sha: pkg?.package_commit_sha,
    canonical_scope_sha256: pkg?.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: pkg?.expected_public_surface_manifest_sha256,
    trust_registry_sha256: registrySha, release_builder_identity: pkg?.release_builder_identity,
    prior_l1_approval: null, invited_evidence_index: null,
  };
  const l1ApprovalReport = verifyApproval(Object.assign({}, l1ApprovalInput, {
    trust_registry: registry, trust_registry_text: input?.trust_registry_text,
    trust_registry_file_regular: input?.trust_registry_file_regular,
    verification_time: verificationTime, policy,
  }), l1Expected);
  const l1PreflightReport = verifySignedEvidence(Object.assign({}, input?.remote_evidence?.l1_remote_preflight, {
    trust_registry: registry, trust_registry_text: input?.trust_registry_text,
    trust_registry_file_regular: input?.trust_registry_file_regular,
    verification_time: verificationTime,
  }), {
    evidence_kind: 'l1_remote_preflight', beta_release_id: pkg?.beta_release_id,
    intended_origin: policy?.approved_origins?.invited_beta,
    intended_aliases: policy?.approved_aliases?.invited_beta,
    production_baseline_origin: policy?.production_baseline_origin,
    production_baseline_inventory_sha256: policy?.production_baseline_inventory_sha256,
    reviewed_commit_sha: lineage?.l1_approval_commit_sha,
    canonical_scope_sha256: pkg?.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: pkg?.expected_public_surface_manifest_sha256,
    approval_sha256: l1ApprovalReport.approval_sha256, prior_evidence_sha256: null,
    reviewed_artifacts: remotePins?.l1_remote_preflight,
    remote_index_sha256: remoteBindings?.l1_remote_preflight?.remote_index_sha256,
    rollback_subset_sha256: remoteBindings?.l1_remote_preflight?.rollback_subset_sha256,
    trust_registry_sha256: registrySha,
  });
  const l1PreflightAuthorizationChecks = checker();
  l1PreflightAuthorizationChecks.add('l1-preflight-package-valid', packageReport.status === 'pass');
  l1PreflightAuthorizationChecks.add('l1-preflight-lineage', lineageShape &&
    hex(lineage?.l1_approval_commit_sha, 40) &&
    lineage?.l1_approval_commit_ancestor_of_current === true &&
    lineage?.l1_bound_bytes_unchanged === true &&
    (!hex(lineage?.l2_approval_commit_sha, 40)
      ? lineage?.l1_approval_commit_sha === pkg?.current_commit_sha
      : true));
  l1PreflightAuthorizationChecks.add('l1-preflight-level-approval', l1ApprovalReport.status === 'pass');
  const l1PreflightAuthorizationReport = l1PreflightAuthorizationChecks.done({
    description: 'Authorizes staging/deployment only behind the frozen L1 access controls so remote preflight evidence can be collected; it does not authorize sharing.',
  });
  const l1Checks = checker();
  l1Checks.add('l1-preflight-deployment-authorized', l1PreflightAuthorizationReport.status === 'pass');
  l1Checks.add('l1-remote-preflight', l1PreflightReport.status === 'pass');
  const l1Report = l1Checks.done({ approval_report: l1ApprovalReport,
    preflight_deployment_authorization_report: l1PreflightAuthorizationReport,
    remote_preflight_report: l1PreflightReport });

  const invitedEvidenceReport = verifySignedEvidence(Object.assign({}, input?.remote_evidence?.l1_invited_evidence_index, {
    trust_registry: registry, trust_registry_text: input?.trust_registry_text,
    trust_registry_file_regular: input?.trust_registry_file_regular,
    verification_time: verificationTime,
  }), {
    evidence_kind: 'l1_invited_evidence_index', beta_release_id: pkg?.beta_release_id,
    intended_origin: policy?.approved_origins?.invited_beta,
    intended_aliases: policy?.approved_aliases?.invited_beta,
    production_baseline_origin: policy?.production_baseline_origin,
    production_baseline_inventory_sha256: policy?.production_baseline_inventory_sha256,
    reviewed_commit_sha: lineage?.l1_approval_commit_sha,
    canonical_scope_sha256: pkg?.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: pkg?.expected_public_surface_manifest_sha256,
    approval_sha256: l1ApprovalReport.approval_sha256,
    prior_evidence_sha256: l1PreflightReport.evidence_sha256,
    reviewed_artifacts: remotePins?.l1_invited_evidence_index,
    remote_index_sha256: remoteBindings?.l1_invited_evidence_index?.remote_index_sha256,
    rollback_subset_sha256: remoteBindings?.l1_invited_evidence_index?.rollback_subset_sha256,
    trust_registry_sha256: registrySha,
  });
  const priorL1 = {
    approval_path: approvalPath(pkg?.beta_release_id, 'invited_beta'),
    approval_sha256: l1ApprovalReport.approval_sha256,
    signature_bundle_path: signatureBundlePath(pkg?.beta_release_id, 'invited_beta'),
    signature_bundle_sha256: l1ApprovalReport.signature_bundle_sha256,
    approval_commit_sha: lineage?.l1_approval_commit_sha,
  };
  const invitedIndex = {
    evidence_id: input?.remote_evidence?.l1_invited_evidence_index?.evidence?.evidence_id,
    evidence_sha256: invitedEvidenceReport.evidence_sha256,
    signature_bundle_sha256: invitedEvidenceReport.signature_bundle_sha256,
  };
  const l2ApprovalInput = input?.approvals?.public_beta;
  const l2Expected = {
    beta_release_id: pkg?.beta_release_id, publication_level: 'public_beta',
    intended_origin: policy?.approved_origins?.public_beta,
    intended_aliases: policy?.approved_aliases?.public_beta,
    production_baseline_origin: policy?.production_baseline_origin,
    production_baseline_inventory_sha256: policy?.production_baseline_inventory_sha256,
    reviewed_commit_sha: lineage?.l1_approval_commit_sha,
    canonical_scope_sha256: pkg?.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: pkg?.expected_public_surface_manifest_sha256,
    trust_registry_sha256: registrySha, release_builder_identity: pkg?.release_builder_identity,
    prior_l1_approval: priorL1, invited_evidence_index: invitedIndex,
  };
  const l2ApprovalReport = verifyApproval(Object.assign({}, l2ApprovalInput, {
    trust_registry: registry, trust_registry_text: input?.trust_registry_text,
    trust_registry_file_regular: input?.trust_registry_file_regular,
    verification_time: verificationTime, policy,
  }), l2Expected);
  const l2PreflightReport = verifySignedEvidence(Object.assign({}, input?.remote_evidence?.l2_remote_preflight, {
    trust_registry: registry, trust_registry_text: input?.trust_registry_text,
    trust_registry_file_regular: input?.trust_registry_file_regular,
    verification_time: verificationTime,
  }), {
    evidence_kind: 'l2_remote_preflight', beta_release_id: pkg?.beta_release_id,
    intended_origin: policy?.approved_origins?.public_beta,
    intended_aliases: policy?.approved_aliases?.public_beta,
    production_baseline_origin: policy?.production_baseline_origin,
    production_baseline_inventory_sha256: policy?.production_baseline_inventory_sha256,
    reviewed_commit_sha: lineage?.l2_approval_commit_sha,
    canonical_scope_sha256: pkg?.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: pkg?.expected_public_surface_manifest_sha256,
    approval_sha256: l2ApprovalReport.approval_sha256,
    prior_evidence_sha256: invitedEvidenceReport.evidence_sha256,
    reviewed_artifacts: remotePins?.l2_remote_preflight,
    remote_index_sha256: remoteBindings?.l2_remote_preflight?.remote_index_sha256,
    rollback_subset_sha256: remoteBindings?.l2_remote_preflight?.rollback_subset_sha256,
    trust_registry_sha256: registrySha,
  });
  const l2PreflightAuthorizationChecks = checker();
  l2PreflightAuthorizationChecks.add('l2-preflight-l1-shareable', l1Report.status === 'pass');
  l2PreflightAuthorizationChecks.add('l2-preflight-invited-evidence', invitedEvidenceReport.status === 'pass');
  l2PreflightAuthorizationChecks.add('l2-preflight-lineage', lineageShape && hex(lineage?.l2_approval_commit_sha, 40) &&
    lineage?.l2_approval_commit_sha === pkg?.current_commit_sha &&
    lineage?.l2_approval_commit_ancestor_of_current === true && lineage?.l2_bound_bytes_unchanged === true);
  l2PreflightAuthorizationChecks.add('l2-preflight-approval', l2ApprovalReport.status === 'pass');
  const l2PreflightAuthorizationReport = l2PreflightAuthorizationChecks.done({
    description: 'Authorizes staging/deployment only behind the frozen L2 access controls so public-activation preflight evidence can be collected; it does not authorize public activation.',
  });
  const l2Checks = checker();
  l2Checks.add('l2-preflight-deployment-authorized', l2PreflightAuthorizationReport.status === 'pass');
  l2Checks.add('l2-remote-preflight', l2PreflightReport.status === 'pass');
  const l2Report = l2Checks.done({ invited_evidence_report: invitedEvidenceReport,
    approval_report: l2ApprovalReport,
    preflight_deployment_authorization_report: l2PreflightAuthorizationReport,
    remote_preflight_report: l2PreflightReport });

  const activationReport = verifySignedEvidence(Object.assign({}, input?.remote_evidence?.public_activation, {
    trust_registry: registry, trust_registry_text: input?.trust_registry_text,
    trust_registry_file_regular: input?.trust_registry_file_regular,
    verification_time: verificationTime,
  }), {
    evidence_kind: 'public_activation', beta_release_id: pkg?.beta_release_id,
    intended_origin: policy?.approved_origins?.public_beta,
    intended_aliases: policy?.approved_aliases?.public_beta,
    production_baseline_origin: policy?.production_baseline_origin,
    production_baseline_inventory_sha256: policy?.production_baseline_inventory_sha256,
    reviewed_commit_sha: lineage?.l2_approval_commit_sha,
    canonical_scope_sha256: pkg?.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: pkg?.expected_public_surface_manifest_sha256,
    approval_sha256: l2ApprovalReport.approval_sha256,
    prior_evidence_sha256: l2PreflightReport.evidence_sha256,
    reviewed_artifacts: remotePins?.public_activation,
    remote_index_sha256: remoteBindings?.public_activation?.remote_index_sha256,
    rollback_subset_sha256: remoteBindings?.public_activation?.rollback_subset_sha256,
    trust_registry_sha256: registrySha,
  });
  const activationChecks = checker();
  activationChecks.add('activation-authorized', l2Report.status === 'pass');
  activationChecks.add('activation-signed-immediate-probes', activationReport.status === 'pass');
  const liveReport = activationChecks.done({ activation_evidence_report: activationReport });

  const monitoringReport = verifySignedEvidence(Object.assign({}, input?.remote_evidence?.live_monitoring, {
    trust_registry: registry, trust_registry_text: input?.trust_registry_text,
    trust_registry_file_regular: input?.trust_registry_file_regular,
    verification_time: verificationTime,
  }), {
    evidence_kind: 'live_monitoring', beta_release_id: pkg?.beta_release_id,
    intended_origin: policy?.approved_origins?.public_beta,
    intended_aliases: policy?.approved_aliases?.public_beta,
    production_baseline_origin: policy?.production_baseline_origin,
    production_baseline_inventory_sha256: policy?.production_baseline_inventory_sha256,
    reviewed_commit_sha: lineage?.l2_approval_commit_sha,
    canonical_scope_sha256: pkg?.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: pkg?.expected_public_surface_manifest_sha256,
    approval_sha256: l2ApprovalReport.approval_sha256,
    prior_evidence_sha256: activationReport.evidence_sha256,
    reviewed_artifacts: remotePins?.live_monitoring,
    remote_index_sha256: remoteBindings?.live_monitoring?.remote_index_sha256,
    rollback_subset_sha256: remoteBindings?.live_monitoring?.rollback_subset_sha256,
    trust_registry_sha256: registrySha,
  });
  const verifiedChecks = checker();
  verifiedChecks.add('monitoring-live-state', liveReport.status === 'pass');
  verifiedChecks.add('monitoring-window-signed-complete', monitoringReport.status === 'pass');
  const verifiedReport = verifiedChecks.done({ monitoring_evidence_report: monitoringReport });

  let state = 'blocked';
  if (packageReport.status === 'pass') state = 'package_valid_publication_blocked';
  if (l1Report.status === 'pass') state = 'shareable_l1';
  if (l2Report.status === 'pass') state = 'authorized_for_public_activation';
  if (liveReport.status === 'pass') state = 'live_public_beta_monitoring';
  if (verifiedReport.status === 'pass') state = 'verified_live_public_beta';
  const next = state === 'blocked' ? packageReport :
    state === 'package_valid_publication_blocked' ? l1Report :
      state === 'shareable_l1' ? l2Report :
        state === 'authorized_for_public_activation' ? liveReport :
          state === 'live_public_beta_monitoring' ? verifiedReport : null;
  return {
    policy_version: POLICY_VERSION,
    status: state === 'blocked' ? 'fail' : state === 'package_valid_publication_blocked' ? 'blocked' : 'pass',
    state,
    package_valid: packageReport.status === 'pass',
    l1_preflight_deployment_authorized: l1PreflightAuthorizationReport.status === 'pass',
    l2_preflight_deployment_authorized: l2PreflightAuthorizationReport.status === 'pass',
    shareable_l1: RELEASE_STATES.indexOf(state) >= RELEASE_STATES.indexOf('shareable_l1'),
    authorized_for_public_activation: RELEASE_STATES.indexOf(state) >= RELEASE_STATES.indexOf('authorized_for_public_activation'),
    live_public_beta_monitoring: RELEASE_STATES.indexOf(state) >= RELEASE_STATES.indexOf('live_public_beta_monitoring'),
    verified_live_public_beta: state === 'verified_live_public_beta',
    assessed_production_authority: false,
    failure_ids: state === 'blocked' || state === 'package_valid_publication_blocked' ? next.failure_ids : [],
    next_transition_failure_ids: next ? next.failure_ids : [],
    transitions: { package: packageReport, l1_preflight_deployment: l1PreflightAuthorizationReport,
      invited_beta: l1Report, l2_preflight_deployment: l2PreflightAuthorizationReport,
      public_beta: l2Report,
      activation: liveReport, monitoring: verifiedReport },
  };
}

function stateSatisfies(actual, required) {
  if (!ALL_STATES.includes(actual) || !RELEASE_STATES.includes(required)) return false;
  return RELEASE_STATES.indexOf(actual) >= RELEASE_STATES.indexOf(required);
}

module.exports = {
  ALL_STATES,
  APPROVAL_PATHS,
  APPROVAL_ROLE,
  EVIDENCE_CONFIG,
  EVIDENCE_KINDS,
  EVIDENCE_SIGNATURE_DOMAIN,
  POLICY_VERSION,
  PUBLICATION_LEVELS,
  RELEASE_STATES,
  REMOTE_EVIDENCE_ROLES,
  REPOSITORY,
  REQUIRED_REVIEW_ROLES,
  REQUIRED_ROLES,
  SIGNATURE_BUNDLE_PATHS,
  SIGNATURE_DOMAIN,
  TRUST_REGISTRY_PATH,
  approvalPath,
  approvalSignatureMessage,
  canonicalJson,
  canonicalSignature,
  derivedRegistryStatus,
  evaluateAssessedBoundary,
  evaluatePolicy,
  evaluateTransition: evaluatePolicy,
  evaluateTrustRegistry,
  evidenceSignatureMessage,
  validArtifactPins,
  publicKeyRecord,
  sha256,
  signatureBundlePath,
  stateSatisfies,
  validIdentity,
  validOrigin,
  validReleaseId,
  validTimestamp,
  validatePolicy,
  verifyApproval,
  verifySignedEvidence,
};
