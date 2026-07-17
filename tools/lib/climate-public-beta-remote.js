'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const surface = require('./climate-public-beta-surface');
const { parseJsonNoDuplicateKeys } = require('./json-schema-lite');

const REPOSITORY = 'earth-love-united/earthloveunited.org';
const INDEX_FILENAME = 'beta-run-artifact-index.json';
const ATTESTATION_FILENAME = 'beta-run-artifact-index.attestation.json';
const SIGNATURE_FILENAME = 'beta-run-artifact-index.attestation.signatures.json';
const MAX_REMOTE_FILE_BYTES = 32 * 1024 * 1024;

const RECORD_FILES = Object.freeze({
  deployment: 'beta-deployment-record.json',
  access_control: 'beta-access-control-results.json',
  remote_surface: 'beta-remote-surface-results.json',
  browser_accessibility: 'beta-browser-accessibility-results.json',
  production_baseline: 'beta-production-baseline-results.json',
  monitoring: 'beta-monitoring-results.json',
  rollback_withdrawal: 'beta-rollback-withdrawal-results.json',
  invited_feedback: 'beta-invited-feedback-summary.json',
});

const RECORD_TYPES = Object.freeze(Object.keys(RECORD_FILES));
const REMOTE_ROLES = Object.freeze(['beta_release_operator', 'beta_rollback_reviewer']);
const PUBLICATION_LEVELS = Object.freeze(['invited_beta', 'public_beta']);
const PUBLIC_STATES = Object.freeze([
  'authorized_for_public_activation',
  'live_public_beta_monitoring',
  'verified_live_public_beta',
]);
const TRANSITION_KINDS = Object.freeze([
  'l1_remote_preflight',
  'l1_invited_evidence_index',
  'l2_remote_preflight',
  'public_activation',
  'live_monitoring',
]);

const INDEX_KEYS = Object.freeze([
  'schema_version',
  'evidence_id',
  'repository',
  'beta_release_id',
  'publication_level',
  'release_state',
  'transition_kind',
  'approved_origin',
  'approved_aliases',
  'deployment_origin',
  'reviewed_commit_sha',
  'approval_reviewed_commit_sha',
  'canonical_scope_sha256',
  'release_builder_identity',
  'prior_evidence_sha256',
  'expected_public_surface_manifest_sha256',
  'approval_binding',
  'records',
  'prior_transition_packages',
  'evidence_attestation_path',
  'signature_bundle_path',
  'canonical_index_sha256',
  'assessed_production_authority',
]);

const APPROVAL_BINDING_KEYS = Object.freeze([
  'approval_path',
  'approval_sha256',
  'approval_signature_bundle_path',
  'approval_signature_bundle_sha256',
  'prior_l1_approval',
  'invited_evidence_index',
]);
const PRIOR_L1_KEYS = Object.freeze([
  'approval_path',
  'approval_sha256',
  'signature_bundle_path',
  'signature_bundle_sha256',
  'approval_commit_sha',
]);
const INVITED_EVIDENCE_KEYS = Object.freeze([
  'evidence_id',
  'evidence_sha256',
  'signature_bundle_sha256',
]);

const DESCRIPTOR_KEYS = Object.freeze([
  'record_type',
  'path',
  'raw_sha256',
  'canonical_json_sha256',
]);
const PRIOR_PACKAGE_KEYS = Object.freeze([
  'transition_kind',
  'index_path',
  'index_raw_sha256',
  'attestation_raw_sha256',
  'signature_bundle_raw_sha256',
]);

const BASE_RECORD_KEYS = Object.freeze([
  'schema_version',
  'record_type',
  'evidence_id',
  'repository',
  'beta_release_id',
  'publication_level',
]);

const RECORD_KEYS = Object.freeze({
  deployment: Object.freeze([
    ...BASE_RECORD_KEYS,
    'deployment_id',
    'source_commit_sha',
    'approved_origin',
    'deployment_origin',
    'aliases',
    'exposure_state',
    'observed_at',
  ]),
  access_control: Object.freeze([
    ...BASE_RECORD_KEYS,
    'aliases',
    'mode_at_observation',
    'unauthorized_probes',
    'authorized_test_count',
    'observed_at',
  ]),
  remote_surface: Object.freeze([
    ...BASE_RECORD_KEYS,
    'access_context',
    'aliases',
    'file_probes',
    'forbidden_path_probes',
    'sw_probes',
    'header_probes',
    'observed_at',
  ]),
  browser_accessibility: Object.freeze([
    ...BASE_RECORD_KEYS,
    'sessions',
    'browser_smoke_passed',
    'manual_accessibility_passed',
    'observed_at',
  ]),
  production_baseline: Object.freeze([
    ...BASE_RECORD_KEYS,
    'production_origin',
    'before_inventory_sha256',
    'after_inventory_sha256',
    'before_files',
    'after_files',
    'unchanged',
    'observed_at',
  ]),
  monitoring: Object.freeze([
    ...BASE_RECORD_KEYS,
    'state',
    'immediate_probes_passed',
    'window_started_at',
    'window_ended_at',
    'required_window_seconds',
    'probe_interval_seconds',
    'probe_count',
    'successful_probe_count',
    'failures',
    'withdrawal_triggered',
  ]),
  rollback_withdrawal: Object.freeze([
    ...BASE_RECORD_KEYS,
    'target_type',
    'target_reference',
    'target_frozen',
    'rehearsal_result',
    'rehearsal_elapsed_seconds',
    'response_target_seconds',
    'alias_results',
    'withdrawal',
    'observed_at',
  ]),
  invited_feedback: Object.freeze([
    ...BASE_RECORD_KEYS,
    'state',
    'privacy_safe',
    'reviewer_count',
    'session_count',
    'unresolved_no_go_count',
    'triage_complete',
    'observed_at',
  ]),
});

const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT_SHA = /^[0-9a-f]{40}$/;
const BETA_ID = /^(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/;

const EXPECTED_CSP_DIRECTIVES = Object.freeze([
  ['default-src', ["'none'"]],
  ['script-src', ["'self'"]],
  ['style-src', ["'self'"]],
  ['connect-src', ["'self'"]],
  ['img-src', ["'none'"]],
  ['font-src', ["'none'"]],
  ['media-src', ["'none'"]],
  ['object-src', ["'none'"]],
  ['frame-src', ["'none'"]],
  ['child-src', ["'none'"]],
  ['worker-src', ["'none'"]],
  ['manifest-src', ["'none'"]],
  ['base-uri', ["'none'"]],
  ['form-action', ["'none'"]],
  ['frame-ancestors', ["'none'"]],
  ['upgrade-insecure-requests', []],
]);

const EXPECTED_PERMISSION_FEATURES = Object.freeze([
  'accelerometer', 'ambient-light-sensor', 'autoplay', 'bluetooth', 'camera',
  'display-capture', 'encrypted-media', 'fullscreen', 'geolocation', 'gyroscope',
  'hid', 'idle-detection', 'local-fonts', 'magnetometer', 'microphone', 'midi',
  'payment', 'publickey-credentials-create', 'publickey-credentials-get',
  'screen-wake-lock', 'serial', 'speaker-selection', 'storage-access', 'usb',
  'web-share', 'window-management', 'xr-spatial-tracking',
].sort());

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function hashBytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashJson(value) {
  return hashBytes(Buffer.from(JSON.stringify(stable(value)), 'utf8'));
}

function exactKeys(value, expected) {
  return Boolean(value) && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function canonicalIndexHash(index) {
  return hashJson({ ...index, canonical_index_sha256: null });
}

function accessWithdrawalSubset(index) {
  const records = Array.isArray(index && index.records) ? index.records : [];
  return {
    schema_version: '1.0.0',
    evidence_id: index && index.evidence_id,
    repository: index && index.repository,
    beta_release_id: index && index.beta_release_id,
    publication_level: index && index.publication_level,
    approved_origin: index && index.approved_origin,
    approved_aliases: index && index.approved_aliases,
    deployment_origin: index && index.deployment_origin,
    records: records.filter(item => item &&
      (item.record_type === 'access_control' || item.record_type === 'rollback_withdrawal')),
  };
}

function accessWithdrawalSubsetHash(index) {
  return hashJson(accessWithdrawalSubset(index));
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    return false;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() ===
    (value.includes('.') ? value : value.replace('Z', '.000Z'));
}

function canonicalOrigin(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
        parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.origin !== value) {
      return null;
    }
    return parsed.origin;
  } catch (_) {
    return null;
  }
}

function canonicalUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) return null;
    return parsed.toString();
  } catch (_) {
    return null;
  }
}

function uniqueSortedStrings(values) {
  return Array.isArray(values) && values.length > 0 && values.every(value => typeof value === 'string') &&
    new Set(values).size === values.length &&
    JSON.stringify(values) === JSON.stringify([...values].sort());
}

function sameArray(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function observedAliases(index) {
  const approved = Array.isArray(index && index.approved_aliases) ? index.approved_aliases : [];
  const deployment = typeof (index && index.deployment_origin) === 'string'
    ? [index.deployment_origin]
    : [];
  return [...new Set(approved.concat(deployment))].sort();
}

function deploymentOriginMatchesSuffix(origin, hostnameSuffix) {
  if (typeof origin !== 'string' || canonicalOrigin(origin) !== origin ||
      typeof hostnameSuffix !== 'string' ||
      !/^\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.pages\.dev$/.test(hostnameSuffix)) {
    return false;
  }
  const parsed = new URL(origin);
  if (parsed.port || !parsed.hostname.endsWith(hostnameSuffix)) return false;
  const label = parsed.hostname.slice(0, -hostnameSuffix.length);
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) &&
    parsed.hostname === label + hostnameSuffix;
}

function transitionContract(kind) {
  const contracts = {
    l1_remote_preflight: { level: 'invited_beta', state: 'shareable_l1' },
    l1_invited_evidence_index: { level: 'invited_beta', state: 'shareable_l1' },
    l2_remote_preflight: { level: 'public_beta', state: 'authorized_for_public_activation' },
    public_activation: { level: 'public_beta', state: 'live_public_beta_monitoring' },
    live_monitoring: { level: 'public_beta', state: 'verified_live_public_beta' },
  };
  return contracts[kind] || null;
}

function expectedPriorTransitionKinds(kind) {
  const index = TRANSITION_KINDS.indexOf(kind);
  return index < 0 ? null : TRANSITION_KINDS.slice(0, index);
}

function safePrivateRelative(relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\0') || relative.includes('\\')) {
    throw new Error('unsafe private evidence path');
  }
  const normalized = path.posix.normalize(relative);
  if (normalized !== relative || path.posix.isAbsolute(normalized) || normalized === '..' ||
      normalized.startsWith('../')) {
    throw new Error('unsafe private evidence path');
  }
  return normalized;
}

function readRegularJsonFile(absolute) {
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('evidence path must be a regular file');
  const bytes = fs.readFileSync(absolute);
  let value;
  try { value = parseJsonNoDuplicateKeys(bytes.toString('utf8'), 'private remote evidence'); }
  catch (_) { throw new Error('evidence path must contain valid JSON'); }
  return {
    absolute,
    bytes,
    text: bytes.toString('utf8'),
    value,
    raw_sha256: hashBytes(bytes),
    canonical_json_sha256: hashJson(value),
  };
}

function readPrivateRelative(root, relative) {
  const normalized = safePrivateRelative(relative);
  let current = path.resolve(root);
  const rootStat = fs.lstatSync(current);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('private evidence root must be a real directory');
  }
  normalized.split('/').forEach((part, index, parts) => {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('private evidence paths must not contain symlinks');
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error('private evidence parent must be a directory');
    }
    if (index === parts.length - 1 && !stat.isFile()) {
      throw new Error('private evidence path must be a regular file');
    }
  });
  return readRegularJsonFile(current);
}

function loadEvidencePackage(indexPath, traversal) {
  const absoluteIndex = path.resolve(indexPath);
  const state = traversal || { seen: new Set(), depth: 0 };
  if (state.depth > TRANSITION_KINDS.length) throw new Error('private evidence transition chain is too deep');
  if (state.seen.has(absoluteIndex)) throw new Error('private evidence transition chain contains a cycle');
  state.seen.add(absoluteIndex);
  if (path.basename(absoluteIndex) !== INDEX_FILENAME) {
    throw new Error('private evidence index must be named ' + INDEX_FILENAME);
  }
  const indexRecord = readRegularJsonFile(absoluteIndex);
  const index = indexRecord.value;
  const root = path.dirname(absoluteIndex);
  const descriptors = Array.isArray(index && index.records) ? index.records : [];
  const records = {};
  descriptors.forEach(descriptor => {
    if (!descriptor || typeof descriptor.record_type !== 'string' || typeof descriptor.path !== 'string') return;
    if (records[descriptor.record_type]) return;
    records[descriptor.record_type] = readPrivateRelative(root, descriptor.path);
  });
  const attestationPath = index && index.evidence_attestation_path;
  const attestation = typeof attestationPath === 'string'
    ? readPrivateRelative(root, attestationPath)
    : null;
  const signaturePath = index && index.signature_bundle_path;
  const signatureBundle = typeof signaturePath === 'string'
    ? readPrivateRelative(root, signaturePath)
    : null;
  const priorDescriptors = Array.isArray(index && index.prior_transition_packages)
    ? index.prior_transition_packages
    : [];
  const priorPackages = priorDescriptors.map(descriptor => {
    const relative = safePrivateRelative(descriptor && descriptor.index_path);
    readPrivateRelative(root, relative);
    return loadEvidencePackage(path.join(root, relative), {
      seen: state.seen,
      depth: state.depth + 1,
    });
  });
  return { index: indexRecord, records, attestation, signatureBundle, priorPackages, root };
}

function expectedSurfaceInfo(manifestRecord) {
  const manifest = manifestRecord && manifestRecord.value;
  const text = manifestRecord && manifestRecord.text;
  const rawSha = manifestRecord && manifestRecord.raw_sha256;
  const checks = [];
  const add = (id, passed) => checks.push({ id, passed: Boolean(passed) });
  add('surface-manifest-object', Boolean(manifest) && !Array.isArray(manifest));
  add('surface-manifest-raw-hash', typeof text === 'string' && hashBytes(Buffer.from(text, 'utf8')) === rawSha && SHA256.test(rawSha || ''));
  add('surface-manifest-keys', exactKeys(manifest, surface.MANIFEST_KEYS));
  add('surface-manifest-identity', manifest && manifest.schema_version === '1.0.0' &&
    manifest.publication_channel === 'climate_public_beta' &&
    manifest.assessed_production_authority === false && BETA_ID.test(manifest.beta_release_id || ''));
  const files = Array.isArray(manifest && manifest.files) ? manifest.files : [];
  const destinations = [];
  let filesValid = files.length > 0;
  files.forEach(file => {
    try {
      filesValid = filesValid && exactKeys(file, surface.FILE_KEYS) && SHA256.test(file.sha256 || '') &&
        surface.safeRelative(file.source_path) === file.source_path &&
        surface.assertAllowedDestination(file.destination_path) === file.destination_path;
      destinations.push(file.destination_path);
    } catch (_) { filesValid = false; }
  });
  add('surface-manifest-files', filesValid && new Set(destinations).size === destinations.length &&
    JSON.stringify(destinations) === JSON.stringify([...destinations].sort()) && destinations.includes('index.html'));
  add('surface-manifest-calculation', manifest && SHA256.test(manifest.calculation_hash || '') &&
    manifest.calculation_hash === hashJson({ ...manifest, calculation_hash: null }));
  return { checks, ok: checks.every(check => check.passed), files, destinations, rawSha };
}

function headerMapValid(headers) {
  if (!headers || Array.isArray(headers) || typeof headers !== 'object') return false;
  if (Object.keys(headers).some(name => name !== name.toLowerCase() || typeof headers[name] !== 'string')) return false;
  const csp = headers['content-security-policy'] || '';
  const cspParts = csp.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const [name, ...tokens] = part.split(/\s+/);
    return [name, tokens];
  });
  const directiveNames = cspParts.map(part => part[0]);
  if (new Set(directiveNames).size !== directiveNames.length ||
      directiveNames.some(name => name !== name.toLowerCase())) return false;
  const expectedCspNames = EXPECTED_CSP_DIRECTIVES.map(item => item[0]);
  const cspExact = sameArray(directiveNames, expectedCspNames) &&
    cspParts.every((part, index) => sameArray(part[1], EXPECTED_CSP_DIRECTIVES[index][1]) &&
      new Set(part[1]).size === part[1].length);
  const permissionParts = (headers['permissions-policy'] || '').split(',')
    .map(part => part.trim()).filter(Boolean);
  const permissionFeatures = permissionParts.map(part => {
    const match = /^([a-z0-9-]+)\s*=\s*\(\)$/.exec(part);
    return match ? match[1] : null;
  });
  const permissionsExact = permissionFeatures.every(Boolean) &&
    new Set(permissionFeatures).size === permissionFeatures.length &&
    sameArray(permissionFeatures.slice().sort(), EXPECTED_PERMISSION_FEATURES);
  return cspExact &&
    headers['cross-origin-opener-policy'] === 'same-origin' &&
    headers['cross-origin-resource-policy'] === 'same-origin' &&
    permissionsExact &&
    headers['referrer-policy'] === 'no-referrer' &&
    /^max-age=31536000;\s*includeSubDomains$/.test(headers['strict-transport-security'] || '') &&
    headers['x-content-type-options'] === 'nosniff' && headers['x-frame-options'] === 'DENY' &&
    headers['cache-control'] === 'no-store' &&
    !Object.prototype.hasOwnProperty.call(headers, 'set-cookie');
}

function makeCollector() {
  const checks = [];
  function check(id, passed, detail) {
    const entry = { id, passed: Boolean(passed) };
    if (!passed && detail) entry.detail = detail;
    checks.push(entry);
    return Boolean(passed);
  }
  return { checks, check };
}

function validatePolicyVerification(policy, index, requestedLevel, requestedOrigin, collector) {
  const { check } = collector;
  check('signed-evidence-policy-verifier-available', Boolean(policy) && typeof policy === 'object');
  if (!policy || typeof policy !== 'object') return null;
  const thresholds = policy.frozen_thresholds || {};
  const accessPolicy = policy.unauthorized_access_policy || {};
  check('signed-evidence-policy-pass', policy.status === 'pass');
  check('signed-evidence-transition-authority', policy.approval_verified === true &&
    policy.transition_authorized === true && policy.verified_release_state === index.release_state);
  check('signed-evidence-signatures', policy.evidence_signatures_verified === true &&
    sameArray(policy.verified_remote_roles, REMOTE_ROLES));
  check('policy-level-origin-binding', policy.publication_level === requestedLevel &&
    policy.approved_origin === requestedOrigin && index.publication_level === policy.publication_level &&
    index.approved_origin === policy.approved_origin);
  check('policy-alias-binding', uniqueSortedStrings(policy.approved_aliases) &&
    sameArray(index.approved_aliases, policy.approved_aliases));
  check('policy-deployment-alias-binding',
    deploymentOriginMatchesSuffix(index.deployment_origin,
      policy.deployment_alias_hostname_suffix));
  check('policy-package-binding', policy.reviewed_commit_sha === index.reviewed_commit_sha &&
    policy.expected_public_surface_manifest_sha256 === index.expected_public_surface_manifest_sha256);
  check('policy-production-baseline-binding', canonicalOrigin(policy.production_baseline_origin) ===
    policy.production_baseline_origin && !observedAliases(index).includes(policy.production_baseline_origin) &&
    SHA256.test(policy.production_baseline_inventory_sha256 || ''));
  check('policy-rollback-target-binding', exactKeys(policy.rollback_target, ['type', 'reference']) &&
    ['access_locked_holding_page', 'withdrawn_origin', 'project_access_lock'].includes(policy.rollback_target.type) &&
    typeof policy.rollback_target.reference === 'string' && policy.rollback_target.reference.length >= 5);
  const integerThresholds = [
    'unauthorized_access_test_count',
    'authorized_access_test_count',
    'accessibility_session_minimum',
    'invited_reviewer_minimum',
    'invited_session_minimum',
    'monitoring_window_seconds',
    'remote_probe_interval_seconds',
    'rollback_response_target_seconds',
  ];
  check('policy-frozen-thresholds', integerThresholds.every(name => Number.isInteger(thresholds[name]) && thresholds[name] > 0));
  check('policy-approval-evidence-time-bindings',
    validTimestamp(policy.approval_approved_at) && validTimestamp(policy.approval_valid_from) &&
    validTimestamp(policy.approval_valid_until) && validTimestamp(policy.evidence_signed_at) &&
    validTimestamp(policy.verification_time) &&
    new Date(policy.approval_valid_from) <= new Date(policy.approval_approved_at) &&
    new Date(policy.approval_approved_at) < new Date(policy.approval_valid_until) &&
    new Date(policy.approval_approved_at) <= new Date(policy.verification_time) &&
    new Date(policy.evidence_signed_at) < new Date(policy.approval_valid_until) &&
    new Date(policy.evidence_signed_at) <= new Date(policy.verification_time));
  check('policy-unauthorized-denial-contract', Array.isArray(accessPolicy.allowed_statuses) &&
    accessPolicy.allowed_statuses.length > 0 && accessPolicy.allowed_statuses.every(status => Number.isInteger(status) && status >= 300 && status <= 599) &&
    Array.isArray(accessPolicy.allowed_redirect_origins) && accessPolicy.allowed_redirect_origins.every(origin => canonicalOrigin(origin) === origin));
  return {
    thresholds,
    productionBaselineOrigin: policy.production_baseline_origin,
    productionBaselineInventorySha256: policy.production_baseline_inventory_sha256,
    deploymentAliasHostnameSuffix: policy.deployment_alias_hostname_suffix,
    rollbackTarget: policy.rollback_target || {},
    approvalApprovedAt: policy.approval_approved_at,
    approvalValidFrom: policy.approval_valid_from,
    approvalValidUntil: policy.approval_valid_until,
    evidenceSignedAt: policy.evidence_signed_at,
    verificationTime: policy.verification_time,
    accessPolicy: {
      allowed_statuses: Array.isArray(accessPolicy.allowed_statuses) ? accessPolicy.allowed_statuses : [],
      allowed_redirect_origins: Array.isArray(accessPolicy.allowed_redirect_origins)
        ? accessPolicy.allowed_redirect_origins
        : [],
    },
  };
}

function validateIndex(pkg, requestedLevel, requestedOrigin, collector) {
  const { check } = collector;
  const index = pkg.index && pkg.index.value;
  check('run-index-regular-json', Boolean(pkg.index) && Boolean(index));
  check('run-index-keys', exactKeys(index, INDEX_KEYS));
  check('run-index-identity', index && index.schema_version === '1.0.0' &&
    typeof index.evidence_id === 'string' && index.evidence_id.length >= 12 &&
    index.repository === REPOSITORY && BETA_ID.test(index.beta_release_id || '') &&
    index.assessed_production_authority === false);
  check('run-index-request-binding', index && PUBLICATION_LEVELS.includes(requestedLevel) &&
    index.publication_level === requestedLevel && canonicalOrigin(requestedOrigin) === requestedOrigin &&
    index.approved_origin === requestedOrigin);
  const contract = index && transitionContract(index.transition_kind);
  const stateValid = Boolean(contract) && contract.level === requestedLevel &&
    index.publication_level === contract.level && index.release_state === contract.state;
  check('run-index-release-state', stateValid);
  check('run-index-package-binding', index && COMMIT_SHA.test(index.reviewed_commit_sha || '') &&
    COMMIT_SHA.test(index.approval_reviewed_commit_sha || '') &&
    SHA256.test(index.canonical_scope_sha256 || '') &&
    typeof index.release_builder_identity === 'string' && index.release_builder_identity.length >= 5 &&
    (index.transition_kind === 'l1_remote_preflight'
      ? index.prior_evidence_sha256 === null
      : SHA256.test(index.prior_evidence_sha256 || '')) &&
    SHA256.test(index.expected_public_surface_manifest_sha256 || ''));
  check('run-index-origin-aliases', index && canonicalOrigin(index.approved_origin) === index.approved_origin &&
    uniqueSortedStrings(index.approved_aliases) && index.approved_aliases.every(alias => canonicalOrigin(alias) === alias) &&
    index.approved_aliases.includes(index.approved_origin));
  check('run-index-deployment-origin', index &&
    typeof index.deployment_origin === 'string' &&
    canonicalOrigin(index.deployment_origin) === index.deployment_origin &&
    !index.approved_aliases.includes(index.deployment_origin));
  check('run-index-approval-binding', index && exactKeys(index.approval_binding, APPROVAL_BINDING_KEYS) &&
    typeof index.approval_binding.approval_path === 'string' &&
    typeof index.approval_binding.approval_signature_bundle_path === 'string' &&
    SHA256.test(index.approval_binding.approval_sha256 || '') &&
    SHA256.test(index.approval_binding.approval_signature_bundle_sha256 || '') &&
    (index.publication_level === 'invited_beta'
      ? index.approval_binding.prior_l1_approval === null &&
        index.approval_binding.invited_evidence_index === null
      : exactKeys(index.approval_binding.prior_l1_approval, PRIOR_L1_KEYS) &&
        exactKeys(index.approval_binding.invited_evidence_index, INVITED_EVIDENCE_KEYS) &&
        typeof index.approval_binding.prior_l1_approval.approval_path === 'string' &&
        typeof index.approval_binding.prior_l1_approval.signature_bundle_path === 'string' &&
        SHA256.test(index.approval_binding.prior_l1_approval.approval_sha256 || '') &&
        SHA256.test(index.approval_binding.prior_l1_approval.signature_bundle_sha256 || '') &&
        COMMIT_SHA.test(index.approval_binding.prior_l1_approval.approval_commit_sha || '') &&
        typeof index.approval_binding.invited_evidence_index.evidence_id === 'string' &&
        SHA256.test(index.approval_binding.invited_evidence_index.evidence_sha256 || '') &&
        SHA256.test(index.approval_binding.invited_evidence_index.signature_bundle_sha256 || '') &&
        SHA256.test(index.prior_evidence_sha256 || '')));
  const descriptors = Array.isArray(index && index.records) ? index.records : [];
  const descriptorTypes = descriptors.map(item => item && item.record_type);
  let descriptorValid = descriptors.length === RECORD_TYPES.length && sameArray(descriptorTypes, RECORD_TYPES);
  descriptors.forEach(descriptor => {
    descriptorValid = descriptorValid && exactKeys(descriptor, DESCRIPTOR_KEYS) &&
      RECORD_FILES[descriptor.record_type] === descriptor.path && SHA256.test(descriptor.raw_sha256 || '') &&
      SHA256.test(descriptor.canonical_json_sha256 || '');
  });
  check('run-index-record-descriptors', descriptorValid);
  const prior = Array.isArray(index && index.prior_transition_packages)
    ? index.prior_transition_packages
    : [];
  const transitionPosition = TRANSITION_KINDS.indexOf(index && index.transition_kind);
  let priorValid = transitionPosition === 0 ? prior.length === 0 : prior.length === 1;
  if (prior.length === 1) {
    const descriptor = prior[0];
    const expectedKind = TRANSITION_KINDS[transitionPosition - 1];
    priorValid = priorValid && exactKeys(descriptor, PRIOR_PACKAGE_KEYS) &&
      descriptor.transition_kind === expectedKind &&
      descriptor.index_path === 'prior/' + expectedKind + '/' + INDEX_FILENAME &&
      SHA256.test(descriptor.index_raw_sha256 || '') &&
      SHA256.test(descriptor.attestation_raw_sha256 || '') &&
      SHA256.test(descriptor.signature_bundle_raw_sha256 || '');
  }
  check('run-index-prior-transition-descriptor', priorValid);
  check('run-index-authority-paths', index && index.evidence_attestation_path === ATTESTATION_FILENAME &&
    index.signature_bundle_path === SIGNATURE_FILENAME);
  check('run-index-canonical-hash', index && SHA256.test(index.canonical_index_sha256 || '') &&
    index.canonical_index_sha256 === canonicalIndexHash(index));
  return index;
}

function validateRecordIntegrity(pkg, index, collector) {
  const { check } = collector;
  let valid = true;
  const descriptors = Array.isArray(index && index.records) ? index.records : [];
  RECORD_TYPES.forEach((type, typeIndex) => {
    const descriptor = descriptors[typeIndex];
    const record = pkg.records && pkg.records[type];
    const value = record && record.value;
    valid = valid && Boolean(record) && Boolean(descriptor) &&
      descriptor.record_type === type && descriptor.path === RECORD_FILES[type] &&
      record.raw_sha256 === descriptor.raw_sha256 &&
      record.canonical_json_sha256 === descriptor.canonical_json_sha256 &&
      exactKeys(value, RECORD_KEYS[type]) && value.schema_version === '1.0.0' &&
      value.record_type === type && value.evidence_id === index.evidence_id &&
      value.repository === index.repository && value.beta_release_id === index.beta_release_id &&
      value.publication_level === index.publication_level;
  });
  check('run-record-byte-and-canonical-integrity', valid);
}

function flattenPriorPackages(pkg) {
  const output = [];
  function visit(current) {
    const prior = Array.isArray(current && current.priorPackages) ? current.priorPackages : [];
    prior.forEach(item => {
      visit(item);
      output.push(item);
    });
  }
  visit(pkg);
  return output;
}

function validatePriorTransitionChain(pkg, index, collector) {
  const { check } = collector;
  const flattened = flattenPriorPackages(pkg);
  const expectedKinds = expectedPriorTransitionKinds(index.transition_kind) || [];
  let valid = flattened.length === expectedKinds.length && flattened.every((prior, position) => {
    const priorIndex = prior.index && prior.index.value;
    return priorIndex && priorIndex.transition_kind === expectedKinds[position] &&
      priorIndex.beta_release_id === index.beta_release_id &&
      priorIndex.canonical_scope_sha256 === index.canonical_scope_sha256 &&
      priorIndex.expected_public_surface_manifest_sha256 === index.expected_public_surface_manifest_sha256;
  });
  const immediate = Array.isArray(pkg.priorPackages) && pkg.priorPackages.length === 1
    ? pkg.priorPackages[0]
    : null;
  if (expectedKinds.length === 0) {
    valid = valid && index.prior_evidence_sha256 === null;
  } else {
    const descriptor = index.prior_transition_packages[0];
    valid = valid && Boolean(immediate && immediate.index && immediate.attestation && immediate.signatureBundle) &&
      descriptor.index_raw_sha256 === (immediate && immediate.index && immediate.index.raw_sha256) &&
      descriptor.attestation_raw_sha256 === (immediate && immediate.attestation && immediate.attestation.raw_sha256) &&
      descriptor.signature_bundle_raw_sha256 === (immediate && immediate.signatureBundle && immediate.signatureBundle.raw_sha256) &&
      index.prior_evidence_sha256 === (immediate && immediate.attestation && immediate.attestation.raw_sha256);
  }
  if (index.publication_level === 'public_beta') {
    const invited = index.approval_binding.invited_evidence_index;
    const invitedPackage = flattened.find(item =>
      item.index.value.transition_kind === 'l1_invited_evidence_index');
    valid = valid && Boolean(invitedPackage && invitedPackage.attestation && invitedPackage.signatureBundle) &&
      invited.evidence_id === (invitedPackage && invitedPackage.attestation.value.evidence_id) &&
      invited.evidence_sha256 === (invitedPackage && invitedPackage.attestation.raw_sha256) &&
      invited.signature_bundle_sha256 === (invitedPackage && invitedPackage.signatureBundle.raw_sha256);
    const l1Package = flattened.find(item => item.index.value.transition_kind === 'l1_remote_preflight');
    const l1Index = l1Package && l1Package.index.value;
    const priorL1 = index.approval_binding.prior_l1_approval;
    valid = valid && Boolean(l1Index) &&
      priorL1.approval_path === l1Index.approval_binding.approval_path &&
      priorL1.approval_sha256 === l1Index.approval_binding.approval_sha256 &&
      priorL1.signature_bundle_path === l1Index.approval_binding.approval_signature_bundle_path &&
      priorL1.signature_bundle_sha256 === l1Index.approval_binding.approval_signature_bundle_sha256 &&
      priorL1.approval_commit_sha === l1Index.reviewed_commit_sha;
  }
  check('run-index-prior-transition-chain', valid);
}

function remoteEvidenceKind(index) {
  return TRANSITION_KINDS.includes(index && index.transition_kind) ? index.transition_kind : null;
}

function expectedArtifactPins(pkg) {
  const pins = [{ path: INDEX_FILENAME, sha256: pkg.index.raw_sha256 }];
  RECORD_TYPES.forEach(type => {
    const record = pkg.records && pkg.records[type];
    if (record) pins.push({ path: RECORD_FILES[type], sha256: record.raw_sha256 });
  });
  return pins.sort((left, right) => left.path.localeCompare(right.path));
}

function validateAuthorityArtifacts(pkg, index, policy, collector, requireCurrentFreshness) {
  const { check } = collector;
  const attestationRecord = pkg.attestation;
  const attestation = attestationRecord && attestationRecord.value;
  check('remote-evidence-attestation-regular-json', Boolean(attestationRecord) && Boolean(attestation));
  check('remote-signature-bundle-regular-json', Boolean(pkg.signatureBundle) &&
    Boolean(pkg.signatureBundle.value));
  check('remote-attestation-index-bindings', attestation &&
    attestation.repository === index.repository && attestation.beta_release_id === index.beta_release_id &&
    attestation.evidence_id === index.evidence_id &&
    attestation.evidence_kind === remoteEvidenceKind(index) &&
    attestation.publication_level === index.publication_level &&
    attestation.intended_origin === index.approved_origin &&
    sameArray(attestation.intended_aliases, index.approved_aliases) &&
    attestation.reviewed_commit_sha === index.reviewed_commit_sha &&
    attestation.canonical_scope_sha256 === index.canonical_scope_sha256 &&
    attestation.expected_public_surface_manifest_sha256 === index.expected_public_surface_manifest_sha256 &&
    attestation.approval_sha256 === index.approval_binding.approval_sha256 &&
    attestation.prior_evidence_sha256 === index.prior_evidence_sha256 &&
    attestation.remote_index_sha256 === index.canonical_index_sha256 &&
    attestation.rollback_subset_sha256 === accessWithdrawalSubsetHash(index) &&
    sameArray(attestation.reviewed_artifacts, expectedArtifactPins(pkg)));
  const observedAt = Date.parse(attestation && attestation.observed_at);
  const observationTimes = Object.values(pkg.records || {}).flatMap(record => {
    const value = record && record.value;
    return [value && value.observed_at, value && value.window_started_at, value && value.window_ended_at]
      .filter(item => item !== null && item !== undefined);
  });
  check('remote-attestation-after-observations', Number.isFinite(observedAt) &&
    validTimestamp(attestation && attestation.observed_at) && observationTimes.length > 0 &&
    observationTimes.every(value => validTimestamp(value) && Date.parse(value) <= observedAt));
  const approvalFloor = Math.max(Date.parse(policy.approvalApprovedAt), Date.parse(policy.approvalValidFrom));
  const approvalCeiling = Date.parse(policy.approvalValidUntil);
  const signedAt = Date.parse(policy.evidenceSignedAt);
  const verificationTime = Date.parse(policy.verificationTime);
  check('remote-attestation-approval-and-signing-chronology',
    Number.isFinite(approvalFloor) && Number.isFinite(approvalCeiling) &&
    Number.isFinite(signedAt) && Number.isFinite(verificationTime) &&
    observedAt >= approvalFloor && observedAt < approvalCeiling &&
    signedAt >= observedAt && signedAt < approvalCeiling && signedAt <= verificationTime &&
    signedAt - observedAt <= policy.thresholds.remote_probe_interval_seconds * 1000);
  const orderedRecordTimes = [
    'deployment', 'access_control', 'remote_surface', 'browser_accessibility',
    'production_baseline', 'rollback_withdrawal', 'invited_feedback',
  ].map(type => Date.parse(pkg.records && pkg.records[type] && pkg.records[type].value &&
    pkg.records[type].value.observed_at));
  check('remote-record-observation-chronology', orderedRecordTimes.every((value, position) =>
    Number.isFinite(value) && value >= approvalFloor && value <= observedAt &&
    (position === 0 || value >= orderedRecordTimes[position - 1])) &&
    observationTimes.every(value => {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) && parsed >= approvalFloor && parsed < approvalCeiling && parsed <= observedAt;
    }));
  const freshnessCriticalTimes = [
    'access_control', 'remote_surface', 'browser_accessibility',
    'production_baseline', 'rollback_withdrawal', 'invited_feedback',
  ].map(type => Date.parse(pkg.records && pkg.records[type] && pkg.records[type].value &&
    pkg.records[type].value.observed_at));
  const monitoring = pkg.records && pkg.records.monitoring && pkg.records.monitoring.value;
  const monitoringFreshnessTime = monitoring && (monitoring.window_ended_at || monitoring.window_started_at);
  if (monitoringFreshnessTime) freshnessCriticalTimes.push(Date.parse(monitoringFreshnessTime));
  check('remote-evidence-current-freshness', requireCurrentFreshness !== true ||
    (verificationTime >= observedAt &&
      verificationTime - observedAt <= policy.thresholds.remote_probe_interval_seconds * 1000 &&
      freshnessCriticalTimes.length >= 6 && freshnessCriticalTimes.every(value =>
        Number.isFinite(value) && verificationTime >= value &&
        verificationTime - value <= policy.thresholds.remote_probe_interval_seconds * 1000)));
}

function expectedProbeMap(manifest, aliases) {
  const map = new Map();
  aliases.forEach(alias => {
    manifest.files.forEach(file => map.set(alias + '\n' + file.destination_path, file));
  });
  return map;
}

function forbiddenRemotePaths(betaReleaseId) {
  if (!BETA_ID.test(betaReleaseId || '')) throw new Error('invalid beta release ID for forbidden probes');
  return [
    '__elu_surface_canary__',
    'data/climate/public-beta/governance/approval-trust.json',
    'data/climate/public-beta/governance/policy.json',
    `data/climate/public-beta/governance/releases/${betaReleaseId}/scope-manifest.json`,
    'data/climate/runtime-manifest.json',
    'data/climate/runtime/country-factual-candidate.json',
    'gaia.html',
    'tools/check-climate-public-beta-readiness.js',
  ].sort();
}

function unauthorizedProbeUrls(alias, manifest) {
  const urls = [
    alias + '/',
    new URL('/sw.js', alias).toString(),
    ...forbiddenRemotePaths(manifest.beta_release_id)
      .map(relative => publicFileUrl(alias, relative)),
  ];
  (Array.isArray(manifest && manifest.files) ? manifest.files : []).forEach(file => {
    urls.push(publicFileUrl(alias, file.destination_path));
  });
  return [...new Set(urls)].sort();
}

function validateAccessRecord(record, index, policy, manifest, collector) {
  const { check } = collector;
  const thresholds = policy.thresholds || {};
  const accessPolicy = policy.accessPolicy || {};
  const probes = Array.isArray(record && record.unauthorized_probes) ? record.unauthorized_probes : [];
  const aliases = observedAliases(index);
  const expectedAuthorizedCount = aliases.length * (manifest.files.length + 1);
  check('access-control-record-binding', record && sameArray(record.aliases, aliases) &&
    record.mode_at_observation === 'access_controlled' && Number.isInteger(record.authorized_test_count) &&
    record.authorized_test_count === expectedAuthorizedCount &&
    record.authorized_test_count >= thresholds.authorized_access_test_count && validTimestamp(record.observed_at));
  const manifestReleaseValid = BETA_ID.test(manifest && manifest.beta_release_id || '');
  const expectedUrls = manifestReleaseValid ? aliases.flatMap(alias =>
    unauthorizedProbeUrls(alias, manifest).map(requestUrl => ({ alias, requestUrl }))) : [];
  let probesValid = manifestReleaseValid && probes.length === expectedUrls.length &&
    probes.length >= thresholds.unauthorized_access_test_count;
  probes.forEach((probe, position) => {
    const expected = expectedUrls[position];
    const alias = probe && probe.alias;
    const statusAllowed = probe && accessPolicy.allowed_statuses.includes(probe.status);
    const redirectStatus = probe && [301, 302, 303, 307, 308].includes(probe.status);
    const redirectValid = !redirectStatus
      ? probe.redirect_origin === null
      : canonicalOrigin(probe.redirect_origin) === probe.redirect_origin &&
        accessPolicy.allowed_redirect_origins.includes(probe.redirect_origin) &&
        !aliases.includes(probe.redirect_origin);
    const url = canonicalUrl(probe && probe.request_url);
    probesValid = probesValid && exactKeys(probe, [
      'alias', 'request_url', 'status', 'denied', 'redirect_origin', 'body_sha256',
    ]) && expected && alias === expected.alias && probe.request_url === expected.requestUrl &&
      aliases.includes(alias) && url === probe.request_url &&
      new URL(url).origin === alias && statusAllowed && probe.denied === true && redirectValid &&
      SHA256.test(probe.body_sha256 || '');
  });
  check('access-control-unauthorized-denial', probesValid);
}

function validateRemoteSurfaceRecord(record, index, manifest, collector) {
  const { check } = collector;
  const aliases = observedAliases(index);
  const livePublic = index.publication_level === 'public_beta' &&
    index.release_state !== 'authorized_for_public_activation';
  const expectedContext = livePublic ? 'public' : 'authorized';
  check('remote-surface-record-binding', record && record.access_context === expectedContext &&
    sameArray(record.aliases, aliases) && validTimestamp(record.observed_at));
  const expected = expectedProbeMap(manifest, aliases);
  const probes = Array.isArray(record && record.file_probes) ? record.file_probes : [];
  let probesValid = probes.length === expected.size;
  const seen = new Set();
  probes.forEach(probe => {
    const key = probe && (probe.alias + '\n' + probe.path);
    const file = expected.get(key);
    probesValid = probesValid && exactKeys(probe, ['alias', 'path', 'status', 'sha256', 'bytes']) &&
      Boolean(file) && !seen.has(key) && probe.status === 200 && probe.sha256 === file.sha256 &&
      Number.isInteger(probe.bytes) && probe.bytes >= 0;
    seen.add(key);
  });
  check('remote-surface-exact-authorized-bytes', probesValid && seen.size === expected.size);
  const releaseIdValid = BETA_ID.test(index && index.beta_release_id || '');
  const forbiddenPaths = releaseIdValid ? forbiddenRemotePaths(index.beta_release_id) : [];
  const forbidden = Array.isArray(record && record.forbidden_path_probes)
    ? record.forbidden_path_probes : [];
  const expectedForbidden = aliases.flatMap(alias =>
    forbiddenPaths.map(relative => ({ alias, path: relative })));
  check('remote-surface-forbidden-paths-absent',
    releaseIdValid && forbidden.length === expectedForbidden.length &&
    forbidden.every((probe, position) => exactKeys(probe, ['alias', 'path', 'status']) &&
      probe.alias === expectedForbidden[position].alias &&
      probe.path === expectedForbidden[position].path && probe.status === 404));
  const sw = Array.isArray(record && record.sw_probes) ? record.sw_probes : [];
  check('remote-surface-service-worker-absent', sw.length === aliases.length &&
    sw.every((probe, position) => exactKeys(probe, ['alias', 'status']) &&
      probe.alias === aliases[position] && probe.status === 404));
  const headers = Array.isArray(record && record.header_probes) ? record.header_probes : [];
  check('remote-surface-security-headers', headers.length === aliases.length &&
    headers.every((probe, position) => exactKeys(probe, ['alias', 'headers']) &&
      probe.alias === aliases[position] && headerMapValid(probe.headers)));
}

function validateBrowserRecord(record, index, policy, manifest, collector) {
  const { check } = collector;
  const aliases = observedAliases(index);
  const sessions = Array.isArray(record && record.sessions) ? record.sessions : [];
  const allowedPaths = new Set((Array.isArray(manifest && manifest.files) ? manifest.files : [])
    .map(file => '/' + file.destination_path));
  const aliasesSeen = new Set();
  let sessionsValid = sessions.length >= policy.thresholds.accessibility_session_minimum;
  sessions.forEach(session => {
    const documentUrl = canonicalUrl(session && session.document_url);
    const automatic = Array.isArray(session && session.automatic_requests) ? session.automatic_requests : [];
    const documentOrigin = documentUrl ? new URL(documentUrl).origin : null;
    sessionsValid = sessionsValid && exactKeys(session, [
      'alias', 'document_url', 'automatic_requests', 'browser_result', 'accessibility_result',
      'service_worker_controller_present',
    ]) && aliases.includes(session.alias) && documentUrl === session.document_url &&
      documentOrigin === session.alias && session.document_url === session.alias + '/' &&
      session.browser_result === 'pass' &&
      session.accessibility_result === 'pass' && session.service_worker_controller_present === false &&
      automatic.length > 0 && automatic.every(request => {
        const requestUrl = canonicalUrl(request && request.url);
        if (!requestUrl) return false;
        const parsedRequest = new URL(requestUrl);
        let decodedPath = null;
        try { decodedPath = decodeURIComponent(parsedRequest.pathname); } catch (_) { decodedPath = null; }
        return exactKeys(request, ['url', 'kind']) && typeof request.kind === 'string' && request.kind.length > 0 &&
          requestUrl === request.url && parsedRequest.origin === documentOrigin && !parsedRequest.search &&
          allowedPaths.has(decodedPath);
      });
    aliasesSeen.add(session.alias);
  });
  check('browser-same-origin-automatic-network', sessionsValid &&
    aliases.every(alias => aliasesSeen.has(alias)));
  check('browser-service-worker-controller-absent', sessions.length >= policy.thresholds.accessibility_session_minimum &&
    sessions.every(session => session && session.service_worker_controller_present === false));
  check('browser-accessibility-results', record && record.browser_smoke_passed === true &&
    record.manual_accessibility_passed === true && validTimestamp(record.observed_at));
}

function validInventory(files) {
  if (!Array.isArray(files) || files.length === 0) return false;
  const paths = files.map(item => item && item.path);
  let valid = true;
  files.forEach(item => {
    try {
      valid = valid && exactKeys(item, ['path', 'sha256']) && surface.safeRelative(item.path) === item.path &&
        SHA256.test(item.sha256 || '');
    } catch (_) { valid = false; }
  });
  return valid && new Set(paths).size === paths.length && sameArray(paths, [...paths].sort());
}

function validateProductionBaseline(record, index, policy, collector) {
  const { check } = collector;
  const before = record && record.before_files;
  const after = record && record.after_files;
  check('production-baseline-binding', record && record.production_origin === policy.productionBaselineOrigin &&
    canonicalOrigin(record.production_origin) === record.production_origin &&
    !observedAliases(index).includes(record.production_origin) && validTimestamp(record.observed_at));
  check('production-baseline-unchanged', record && validInventory(before) && validInventory(after) &&
    sameArray(before, after) && record.unchanged === true &&
    SHA256.test(record.before_inventory_sha256 || '') &&
    record.before_inventory_sha256 === record.after_inventory_sha256 &&
    record.before_inventory_sha256 === policy.productionBaselineInventorySha256 &&
    record.before_inventory_sha256 === hashJson(before));
}

function validateRollback(record, index, policy, collector) {
  const { check } = collector;
  const expectedAliases = observedAliases(index);
  const aliases = Array.isArray(record && record.alias_results) ? record.alias_results : [];
  check('rollback-target-and-rehearsal', record &&
    ['access_locked_holding_page', 'withdrawn_origin', 'project_access_lock'].includes(record.target_type) &&
    record.target_type === policy.rollbackTarget.type &&
    record.target_reference === policy.rollbackTarget.reference &&
    typeof record.target_reference === 'string' && record.target_reference.length >= 5 &&
    record.target_frozen === true && record.rehearsal_result === 'pass' &&
    Number.isFinite(record.rehearsal_elapsed_seconds) && record.rehearsal_elapsed_seconds >= 0 &&
    record.rehearsal_elapsed_seconds <= policy.thresholds.rollback_response_target_seconds &&
    record.response_target_seconds === policy.thresholds.rollback_response_target_seconds && validTimestamp(record.observed_at));
  check('rollback-all-aliases', aliases.length === expectedAliases.length && aliases.every((item, position) =>
    exactKeys(item, ['alias', 'result', 'inaccessible_or_access_locked', 'status', 'response_sha256']) &&
    item.alias === expectedAliases[position] && item.result === 'pass' &&
    item.inaccessible_or_access_locked === true && Number.isInteger(item.status) &&
    item.status >= 200 && item.status <= 599 && SHA256.test(item.response_sha256 || '')));
  const withdrawal = record && record.withdrawal;
  const withdrawalAliases = Array.isArray(withdrawal && withdrawal.alias_results) ? withdrawal.alias_results : [];
  const withdrawalShape = exactKeys(withdrawal, ['executed', 'triggered_by_failure', 'result', 'alias_results']);
  const executedValid = withdrawalShape && withdrawal.executed === true &&
    withdrawal.triggered_by_failure === true && withdrawal.result === 'pass' &&
    withdrawalAliases.length === expectedAliases.length && withdrawalAliases.every((item, position) =>
      exactKeys(item, ['alias', 'result', 'inaccessible_or_access_locked', 'status', 'response_sha256']) &&
      item.alias === expectedAliases[position] && item.result === 'pass' &&
      item.inaccessible_or_access_locked === true && SHA256.test(item.response_sha256 || ''));
  const notExecutedValid = withdrawalShape && withdrawal.executed === false &&
    withdrawal.triggered_by_failure === false && withdrawal.result === 'not_required' && withdrawalAliases.length === 0;
  check('withdrawal-evidence-structure', executedValid || notExecutedValid);
  check('release-not-withdrawn', notExecutedValid);
}

function validateMonitoring(record, index, policy, collector) {
  const { check } = collector;
  const thresholds = policy.thresholds;
  check('monitoring-frozen-values', record &&
    record.required_window_seconds === thresholds.monitoring_window_seconds &&
    record.probe_interval_seconds === thresholds.remote_probe_interval_seconds &&
    Array.isArray(record.failures));
  let stateValid = false;
  if (index.publication_level === 'invited_beta') {
    stateValid = record && record.state === 'not_applicable' && record.immediate_probes_passed === false &&
      record.window_started_at === null && record.window_ended_at === null && record.probe_count === 0 &&
      record.successful_probe_count === 0 && record.failures.length === 0 && record.withdrawal_triggered === false;
  } else if (index.release_state === 'authorized_for_public_activation') {
    stateValid = record && record.state === 'not_started' && record.immediate_probes_passed === false &&
      record.window_started_at === null && record.window_ended_at === null && record.probe_count === 0 &&
      record.successful_probe_count === 0 && record.failures.length === 0 && record.withdrawal_triggered === false;
  } else if (index.release_state === 'live_public_beta_monitoring') {
    stateValid = record && record.state === 'in_progress' && record.immediate_probes_passed === true &&
      validTimestamp(record.window_started_at) && record.window_ended_at === null &&
      Number.isInteger(record.probe_count) && record.probe_count >= 1 &&
      record.successful_probe_count === record.probe_count && record.failures.length === 0 &&
      record.withdrawal_triggered === false;
  } else if (index.release_state === 'verified_live_public_beta') {
    const start = Date.parse(record && record.window_started_at);
    const end = Date.parse(record && record.window_ended_at);
    const minimumProbes = Math.ceil(thresholds.monitoring_window_seconds /
      thresholds.remote_probe_interval_seconds) + 1;
    stateValid = record && record.state === 'completed' && record.immediate_probes_passed === true &&
      validTimestamp(record.window_started_at) && validTimestamp(record.window_ended_at) && end > start &&
      (end - start) / 1000 >= thresholds.monitoring_window_seconds &&
      Number.isInteger(record.probe_count) && record.probe_count >= minimumProbes &&
      record.successful_probe_count === record.probe_count && record.failures.length === 0 &&
      record.withdrawal_triggered === false;
  }
  check('monitoring-release-state', stateValid);
}

function validateFeedback(record, index, policy, collector) {
  const { check } = collector;
  check('feedback-record-privacy', record && record.privacy_safe === true && validTimestamp(record.observed_at) &&
    Number.isInteger(record.reviewer_count) && record.reviewer_count >= 0 &&
    Number.isInteger(record.session_count) && record.session_count >= 0 &&
    Number.isInteger(record.unresolved_no_go_count) && record.unresolved_no_go_count >= 0);
  if (index.transition_kind === 'l1_remote_preflight') {
    check('feedback-l1-state', record && ['not_started', 'collecting'].includes(record.state) &&
      record.triage_complete === false);
  } else {
    check('feedback-invited-triage', record && record.state === 'triaged' && record.triage_complete === true &&
      record.reviewer_count >= policy.thresholds.invited_reviewer_minimum &&
      record.session_count >= policy.thresholds.invited_session_minimum &&
      record.unresolved_no_go_count === 0);
  }
}

function validateDeployment(record, index, collector) {
  const { check } = collector;
  const aliases = observedAliases(index);
  const expectedExposure = index.publication_level === 'public_beta' &&
    index.release_state !== 'authorized_for_public_activation' ? 'public' : 'access_controlled';
  check('deployment-record-binding', record && typeof record.deployment_id === 'string' &&
    record.deployment_id.length >= 8 && record.source_commit_sha === index.reviewed_commit_sha &&
    record.approved_origin === index.approved_origin &&
    record.deployment_origin === index.deployment_origin && sameArray(record.aliases, aliases) &&
    record.exposure_state === expectedExposure && validTimestamp(record.observed_at));
}

function validateLiveResults(live, index, manifest, policy, collector) {
  const { check } = collector;
  const aliases = observedAliases(index);
  const expectPublic = index.publication_level === 'public_beta' &&
    index.release_state !== 'authorized_for_public_activation';
  const expectedMode = expectPublic ? 'public_surface' : 'unauthorized_denial';
  check('live-probe-present-and-bound', live && live.mode === expectedMode &&
    sameArray(live.aliases, aliases) && Array.isArray(live.alias_results) &&
    live.alias_results.length === aliases.length);
  if (!live || !Array.isArray(live.alias_results)) return;
  if (!expectPublic) {
    const manifestReleaseValid = BETA_ID.test(manifest && manifest.beta_release_id || '');
    const resultsValid = live.alias_results.every((result, position) => {
      const alias = aliases[position];
      const expectedUrls = manifestReleaseValid ? unauthorizedProbeUrls(alias, manifest) : [];
      const probes = Array.isArray(result && result.probes) ? result.probes : [];
      return manifestReleaseValid && result.alias === alias &&
        probes.length === expectedUrls.length && probes.every((probe, probeIndex) => {
        const redirect = [301, 302, 303, 307, 308].includes(probe.status);
        return probe.request_url === expectedUrls[probeIndex] &&
          policy.accessPolicy.allowed_statuses.includes(probe.status) &&
          (!redirect ? probe.redirect_origin === null :
            policy.accessPolicy.allowed_redirect_origins.includes(probe.redirect_origin) &&
            !aliases.includes(probe.redirect_origin));
      });
    });
    check('live-unauthorized-access-denied', resultsValid);
    return;
  }
  const expected = expectedProbeMap(manifest, aliases);
  const releaseIdValid = BETA_ID.test(index && index.beta_release_id || '');
  let allValid = true;
  const seen = new Set();
  live.alias_results.forEach((result, position) => {
    const expectedForbidden = releaseIdValid ? forbiddenRemotePaths(index.beta_release_id) : [];
    allValid = allValid && releaseIdValid && result.alias === aliases[position] && result.entry_status === 200 &&
      result.sw_status === 404 && headerMapValid(result.security_headers) && Array.isArray(result.files) &&
      Array.isArray(result.forbidden) && result.forbidden.length === expectedForbidden.length &&
      result.forbidden.every((probe, probeIndex) =>
        probe.path === expectedForbidden[probeIndex] && probe.status === 404);
    result.files.forEach(file => {
      const key = result.alias + '\n' + file.path;
      const expectedFile = expected.get(key);
      allValid = allValid && Boolean(expectedFile) && !seen.has(key) && file.status === 200 &&
        file.sha256 === expectedFile.sha256 && Number.isInteger(file.bytes) && file.bytes >= 0;
      seen.add(key);
    });
  });
  check('live-public-exact-surface-security-and-no-sw', allValid && seen.size === expected.size);
}

function evaluateRemoteEvidence(input) {
  const collector = makeCollector();
  const pkg = input && input.package;
  if (!pkg) {
    collector.check('evidence-package-present', false);
    return report(collector.checks, null);
  }
  const index = validateIndex(pkg, input.requestedLevel, input.requestedOrigin, collector);
  const manifestRecord = input.expectedSurfaceManifest || {};
  const manifestInfo = expectedSurfaceInfo(manifestRecord);
  manifestInfo.checks.forEach(item => collector.check(item.id, item.passed));
  collector.check('surface-index-binding', index && manifestInfo.ok &&
    index.expected_public_surface_manifest_sha256 === manifestInfo.rawSha &&
    index.beta_release_id === manifestRecord.value.beta_release_id);
  const policy = validatePolicyVerification(input.policyVerification, index || {},
    input.requestedLevel, input.requestedOrigin, collector);
  if (!index || !policy || !manifestInfo.ok) return report(collector.checks, index);
  validateRecordIntegrity(pkg, index, collector);
  validatePriorTransitionChain(pkg, index, collector);
  validateAuthorityArtifacts(pkg, index, policy, collector, input.requireCurrentFreshness === true);
  const records = pkg.records || {};
  validateDeployment(records.deployment && records.deployment.value, index, collector);
  validateAccessRecord(records.access_control && records.access_control.value,
    index, policy, manifestRecord.value, collector);
  validateRemoteSurfaceRecord(records.remote_surface && records.remote_surface.value,
    index, manifestRecord.value, collector);
  validateBrowserRecord(records.browser_accessibility && records.browser_accessibility.value,
    index, policy, manifestRecord.value, collector);
  validateProductionBaseline(records.production_baseline && records.production_baseline.value,
    index, policy, collector);
  validateMonitoring(records.monitoring && records.monitoring.value, index, policy, collector);
  validateRollback(records.rollback_withdrawal && records.rollback_withdrawal.value,
    index, policy, collector);
  validateFeedback(records.invited_feedback && records.invited_feedback.value,
    index, policy, collector);
  if (input.historical === true) {
    collector.check('historical-evidence-authenticated-without-current-live-probe',
      input.liveResults === null || input.liveResults === undefined);
  } else {
    validateLiveResults(input.liveResults, index, manifestRecord.value, policy, collector);
  }
  return report(collector.checks, index);
}

function report(checks, index) {
  const blockers = checks.filter(check => !check.passed).map(check => check.id);
  return {
    status: blockers.length === 0 ? (index && index.release_state) : 'blocked',
    publication_level: index && index.publication_level || null,
    release_state: index && index.release_state || null,
    passed: blockers.length === 0,
    checks,
    blockers,
  };
}

async function readResponseBytes(response, maximumBytes) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error('remote response exceeds maximum size');
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maximumBytes) throw new Error('remote response exceeds maximum size');
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    const chunk = Buffer.from(result.value);
    total += chunk.length;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error('remote response exceeds maximum size');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

function responseHeaders(response) {
  const output = {};
  response.headers.forEach((value, name) => { output[name.toLowerCase()] = value; });
  if (typeof response.headers.getSetCookie === 'function' && response.headers.getSetCookie().length > 0) {
    output['set-cookie'] = response.headers.getSetCookie().join(', ');
  }
  return output;
}

async function guardedFetch(fetcher, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function publicFileUrl(alias, relative) {
  const encoded = relative.split('/').map(part => encodeURIComponent(part)).join('/');
  return new URL('/' + encoded, alias).toString();
}

async function collectLiveResults(input) {
  const index = input.package.index.value;
  const manifest = input.expectedSurfaceManifest.value;
  const aliases = observedAliases(index);
  const fetcher = input.fetcher || globalThis.fetch;
  const timeoutMs = input.timeoutMs || 15000;
  if (typeof fetcher !== 'function') throw new Error('network fetch implementation is unavailable');
  const expectPublic = index.publication_level === 'public_beta' &&
    index.release_state !== 'authorized_for_public_activation';
  const output = {
    mode: expectPublic ? 'public_surface' : 'unauthorized_denial',
    aliases,
    alias_results: [],
  };
  for (const alias of aliases) {
    if (!expectPublic) {
      const result = { alias, probes: [] };
      for (const requestUrl of unauthorizedProbeUrls(alias, manifest)) {
        const response = await guardedFetch(fetcher, requestUrl,
          { redirect: 'manual', cache: 'no-store' }, timeoutMs);
        const location = response.headers.get('location');
        let redirectOrigin = null;
        if (location) {
          try { redirectOrigin = new URL(location, alias).origin; } catch (_) { redirectOrigin = null; }
        }
        if (response.body && typeof response.body.cancel === 'function') await response.body.cancel();
        result.probes.push({
          request_url: requestUrl,
          status: response.status,
          redirect_origin: redirectOrigin,
        });
      }
      output.alias_results.push(result);
      continue;
    }
    const result = {
      alias,
      entry_status: null,
      sw_status: null,
      security_headers: null,
      files: [],
      forbidden: [],
    };
    for (const file of manifest.files) {
      const response = await guardedFetch(fetcher, publicFileUrl(alias, file.destination_path),
        { redirect: 'manual', cache: 'no-store' }, timeoutMs);
      const bytes = await readResponseBytes(response, MAX_REMOTE_FILE_BYTES);
      result.files.push({
        path: file.destination_path,
        status: response.status,
        sha256: hashBytes(bytes),
        bytes: bytes.length,
      });
      if (file.destination_path === 'index.html') {
        result.entry_status = response.status;
        result.security_headers = responseHeaders(response);
      }
    }
    const swResponse = await guardedFetch(fetcher, new URL('/sw.js', alias).toString(),
      { redirect: 'manual', cache: 'no-store' }, timeoutMs);
    result.sw_status = swResponse.status;
    if (swResponse.body && typeof swResponse.body.cancel === 'function') await swResponse.body.cancel();
    for (const relative of forbiddenRemotePaths(index.beta_release_id)) {
      const response = await guardedFetch(fetcher, publicFileUrl(alias, relative),
        { redirect: 'manual', cache: 'no-store' }, timeoutMs);
      result.forbidden.push({ path: relative, status: response.status });
      if (response.body && typeof response.body.cancel === 'function') await response.body.cancel();
    }
    output.alias_results.push(result);
  }
  return output;
}

async function verifyWithPolicy(callback, context) {
  if (typeof callback !== 'function') return null;
  try {
    const result = await callback(context);
    return result && typeof result === 'object' ? result : null;
  } catch (_) {
    return null;
  }
}

function policyCallbackContext(pkg, expectedSurfaceManifest, requestedLevel, requestedOrigin) {
  const index = pkg.index.value;
  return {
    requested_level: requestedLevel,
    requested_origin: requestedOrigin,
    evidence_index: index,
    evidence_index_text: pkg.index.text,
    evidence_index_raw_sha256: pkg.index.raw_sha256,
    canonical_index_sha256: canonicalIndexHash(index),
    access_withdrawal_subset: accessWithdrawalSubset(index),
    access_withdrawal_subset_sha256: accessWithdrawalSubsetHash(index),
    evidence_attestation: pkg.attestation && pkg.attestation.value,
    evidence_attestation_text: pkg.attestation && pkg.attestation.text,
    evidence_attestation_raw_sha256: pkg.attestation && pkg.attestation.raw_sha256,
    evidence_signature_bundle: pkg.signatureBundle && pkg.signatureBundle.value,
    evidence_signature_bundle_text: pkg.signatureBundle && pkg.signatureBundle.text,
    records: Object.fromEntries(RECORD_TYPES.map(type => [type, {
      value: pkg.records[type] && pkg.records[type].value,
      text: pkg.records[type] && pkg.records[type].text,
      raw_sha256: pkg.records[type] && pkg.records[type].raw_sha256,
      canonical_json_sha256: pkg.records[type] && pkg.records[type].canonical_json_sha256,
    }])),
    expected_public_surface_manifest: expectedSurfaceManifest.value,
    expected_public_surface_manifest_text: expectedSurfaceManifest.text,
    expected_public_surface_manifest_sha256: expectedSurfaceManifest.raw_sha256,
    expected_reviewed_artifacts: expectedArtifactPins(pkg),
    expected_evidence_kind: remoteEvidenceKind(index),
  };
}

function buildPolicyRequests(context, authority) {
  const index = context.evidence_index;
  const trustSha = authority && authority.trust_registry_text
    ? hashBytes(Buffer.from(authority.trust_registry_text, 'utf8'))
    : null;
  return {
    approval: {
      input: {
        approval: authority && authority.approval,
        approval_text: authority && authority.approval_text,
        approval_file_regular: authority && authority.approval_file_regular === true,
        signature_bundle: authority && authority.approval_signature_bundle,
        signature_bundle_text: authority && authority.approval_signature_bundle_text,
        signature_bundle_file_regular: authority && authority.approval_signature_bundle_file_regular === true,
        trust_registry: authority && authority.trust_registry,
        trust_registry_text: authority && authority.trust_registry_text,
        trust_registry_file_regular: authority && authority.trust_registry_file_regular === true,
        verification_time: authority && authority.verification_time,
        policy: authority && authority.policy,
      },
      expected: {
        beta_release_id: index.beta_release_id,
        publication_level: index.publication_level,
        intended_origin: index.approved_origin,
        intended_aliases: index.approved_aliases,
        reviewed_commit_sha: index.approval_reviewed_commit_sha,
        canonical_scope_sha256: index.canonical_scope_sha256,
        expected_public_surface_manifest_sha256: index.expected_public_surface_manifest_sha256,
        trust_registry_sha256: trustSha,
        release_builder_identity: index.release_builder_identity,
        prior_l1_approval: index.approval_binding.prior_l1_approval,
        invited_evidence_index: index.approval_binding.invited_evidence_index,
      },
    },
    evidence: {
      input: {
        evidence: context.evidence_attestation,
        evidence_text: context.evidence_attestation_text,
        evidence_file_regular: Boolean(context.evidence_attestation_text),
        signature_bundle: context.evidence_signature_bundle,
        signature_bundle_text: context.evidence_signature_bundle_text,
        signature_bundle_file_regular: Boolean(context.evidence_signature_bundle_text),
        trust_registry: authority && authority.trust_registry,
        trust_registry_text: authority && authority.trust_registry_text,
        trust_registry_file_regular: authority && authority.trust_registry_file_regular === true,
        verification_time: authority && authority.verification_time,
      },
      expected: {
        evidence_kind: context.expected_evidence_kind,
        beta_release_id: index.beta_release_id,
        intended_origin: index.approved_origin,
        intended_aliases: index.approved_aliases,
        production_baseline_origin: authority && authority.policy && authority.policy.production_baseline_origin,
        production_baseline_inventory_sha256: authority && authority.policy &&
          authority.policy.production_baseline_inventory_sha256,
        reviewed_commit_sha: index.reviewed_commit_sha,
        canonical_scope_sha256: index.canonical_scope_sha256,
        expected_public_surface_manifest_sha256: index.expected_public_surface_manifest_sha256,
        approval_sha256: index.approval_binding.approval_sha256,
        prior_evidence_sha256: index.prior_evidence_sha256,
        reviewed_artifacts: context.expected_reviewed_artifacts,
        remote_index_sha256: context.canonical_index_sha256,
        rollback_subset_sha256: context.access_withdrawal_subset_sha256,
        trust_registry_sha256: trustSha,
      },
    },
  };
}

async function verifyPolicyChain(input) {
  const packages = [...flattenPriorPackages(input.package), input.package];
  const currentKind = input.package && input.package.index && input.package.index.value &&
    input.package.index.value.transition_kind;
  const priorKinds = expectedPriorTransitionKinds(currentKind);
  const expectedKinds = priorKinds ? priorKinds.concat(currentKind) : [];
  const reports = [];
  const remoteEvidence = {};
  const remoteBindings = {};
  const remotePins = {};
  let priorSignedAt = null;
  if (typeof input.requireCurrentFreshness !== 'boolean') {
    return {
      status: 'blocked',
      failure_ids: ['remote-current-freshness-selection-required'],
      reports,
      remote_evidence: null,
      remote_evidence_bindings: null,
      remote_evidence_artifact_pins: null,
    };
  }
  if (packages.length !== expectedKinds.length || typeof input.resolvePolicyVerification !== 'function') {
    return {
      status: 'blocked',
      failure_ids: ['remote-policy-chain-shape'],
      reports,
      remote_evidence: null,
      remote_evidence_bindings: null,
      remote_evidence_artifact_pins: null,
    };
  }
  for (let position = 0; position < packages.length; position += 1) {
    const pkg = packages[position];
    const index = pkg.index.value;
    const kind = expectedKinds[position];
    const context = policyCallbackContext(pkg, input.expectedSurfaceManifest,
      index.publication_level, index.approved_origin);
    const policyVerification = await verifyWithPolicy(input.resolvePolicyVerification, {
      ...context,
      package: pkg,
    });
    const currentSignedAt = Date.parse(pkg.signatureBundle && pkg.signatureBundle.value &&
      pkg.signatureBundle.value.signed_at);
    const currentAttestationAt = Date.parse(pkg.attestation && pkg.attestation.value &&
      pkg.attestation.value.observed_at);
    const currentObservationTimes = Object.values(pkg.records || {}).flatMap(record => {
      const value = record && record.value;
      return [value && value.observed_at, value && value.window_started_at, value && value.window_ended_at]
        .filter(item => item !== null && item !== undefined).map(item => Date.parse(item));
    });
    if (position > 0) {
      const earliestCurrentObservation = currentObservationTimes.length
        ? Math.min(...currentObservationTimes)
        : Number.NaN;
      const monitoringStart = Date.parse(pkg.records && pkg.records.monitoring &&
        pkg.records.monitoring.value && pkg.records.monitoring.value.window_started_at);
      const chronologyValid = Number.isFinite(priorSignedAt) && Number.isFinite(currentSignedAt) &&
        Number.isFinite(currentAttestationAt) && Number.isFinite(earliestCurrentObservation) &&
        earliestCurrentObservation > priorSignedAt && currentAttestationAt > priorSignedAt &&
        currentSignedAt > priorSignedAt &&
        (kind !== 'live_monitoring' || (Number.isFinite(monitoringStart) && monitoringStart > priorSignedAt));
      if (!chronologyValid) {
        return {
          status: 'blocked',
          failure_ids: ['remote-transition-chain-chronology'],
          reports,
          remote_evidence: null,
          remote_evidence_bindings: null,
          remote_evidence_artifact_pins: null,
        };
      }
      if (kind === 'l2_remote_preflight') {
        const approvalAt = Date.parse(policyVerification && policyVerification.approval_approved_at);
        if (!Number.isFinite(approvalAt) || approvalAt < priorSignedAt) {
          return {
            status: 'blocked',
            failure_ids: ['remote-l2-approval-chronology'],
            reports,
            remote_evidence: null,
            remote_evidence_bindings: null,
            remote_evidence_artifact_pins: null,
          };
        }
      }
    }
    const result = evaluateRemoteEvidence({
      package: pkg,
      requestedLevel: index.publication_level,
      requestedOrigin: index.approved_origin,
      expectedSurfaceManifest: input.expectedSurfaceManifest,
      policyVerification,
      liveResults: null,
      historical: true,
      requireCurrentFreshness: input.requireCurrentFreshness && position === packages.length - 1,
    });
    reports.push({ transition_kind: kind, result });
    if (!result.passed || index.transition_kind !== kind) {
      return {
        status: 'blocked',
        failure_ids: result.blockers.length ? result.blockers : ['remote-policy-chain-order'],
        reports,
        remote_evidence: null,
        remote_evidence_bindings: null,
        remote_evidence_artifact_pins: null,
      };
    }
    remoteEvidence[kind] = {
      evidence: pkg.attestation.value,
      evidence_text: pkg.attestation.text,
      evidence_file_regular: true,
      signature_bundle: pkg.signatureBundle.value,
      signature_bundle_text: pkg.signatureBundle.text,
      signature_bundle_file_regular: true,
    };
    remoteBindings[kind] = {
      remote_index_sha256: index.canonical_index_sha256,
      rollback_subset_sha256: accessWithdrawalSubsetHash(index),
    };
    remotePins[kind] = expectedArtifactPins(pkg);
    priorSignedAt = currentSignedAt;
  }
  return {
    status: 'pass',
    failure_ids: [],
    reports,
    remote_evidence: remoteEvidence,
    remote_evidence_bindings: remoteBindings,
    remote_evidence_artifact_pins: remotePins,
  };
}

module.exports = {
  ATTESTATION_FILENAME,
  INDEX_FILENAME,
  MAX_REMOTE_FILE_BYTES,
  PUBLICATION_LEVELS,
  PUBLIC_STATES,
  RECORD_FILES,
  RECORD_TYPES,
  REMOTE_ROLES,
  SIGNATURE_FILENAME,
  TRANSITION_KINDS,
  accessWithdrawalSubset,
  accessWithdrawalSubsetHash,
  buildPolicyRequests,
  canonicalIndexHash,
  canonicalOrigin,
  collectLiveResults,
  evaluateRemoteEvidence,
  expectedSurfaceInfo,
  forbiddenRemotePaths,
  hashBytes,
  hashJson,
  headerMapValid,
  loadEvidencePackage,
  observedAliases,
  unauthorizedProbeUrls,
  policyCallbackContext,
  remoteEvidenceKind,
  transitionContract,
  stable,
  validTimestamp,
  verifyWithPolicy,
  verifyPolicyChain,
};
