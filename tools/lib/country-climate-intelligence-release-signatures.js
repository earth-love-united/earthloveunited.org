'use strict';

const crypto = require('node:crypto');

const POLICY_VERSION = '1.0.0';
const REPOSITORY = 'earth-love-united/earthloveunited.org';
const RELEASE_DIR = 'data/climate/releases/country-climate-intelligence-v1';
const TRUST_REGISTRY_PATH = 'data/climate/governance/country-climate-intelligence-release-trust.json';
const SIGNATURE_BUNDLE_PATH = RELEASE_DIR + '/release-signatures.json';
const SIGNATURE_SCHEMA_PATH = 'data/climate/schemas/country-climate-intelligence-release-signatures.schema.json';
const EXPECTED_TRUST_REGISTRY_SHA256 = 'd83ac383e755ef37dc95f542efd26b85f7fb452d81a7c51f8870fe28caf9e435';
const SIGNATURE_DOMAIN = 'ELU-COUNTRY-CLIMATE-INTELLIGENCE-RELEASE-SIGNATURE-V2';
const REQUIRED_ROLES = Object.freeze([
  'carbon_accounting',
  'demography',
  'power_systems',
  'physical_climate',
  'reproducibility',
  'ui_accessibility_runtime',
  'source_rights',
  'release_authorizer',
]);
const PACKAGE_PATHS = Object.freeze([
  RELEASE_DIR + '/release-approval.json',
  RELEASE_DIR + '/review-request.json',
  RELEASE_DIR + '/reviewed-release-diff.json',
  RELEASE_DIR + '/reviewed-rollback-proof.json',
  RELEASE_DIR + '/reviewed-runtime-manifest.json',
].sort());
const AUTHORITY_KEYS = Object.freeze([
  'algorithm', 'identity', 'key_id', 'public_key_spki_pem', 'revoked_at',
  'role', 'status', 'valid_from', 'valid_until',
]);
const REGISTRY_KEYS = Object.freeze([
  'authorities', 'registry_id', 'repository', 'required_roles', 'schema_version', 'status',
]);
const BUNDLE_KEYS = Object.freeze([
  'package_pins', 'release_id', 'repository', 'schema_version', 'signature_bundle_id',
  'signatures', 'subject_artifact_pin_digest', 'trust_registry',
]);
const PIN_KEYS = Object.freeze(['path', 'sha256']);
const SIGNATURE_KEYS = Object.freeze(['key_id', 'role', 'signature_base64', 'signed_at']);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function exactKeys(value, expected) {
  return Boolean(value) && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected);
}

function validTimestamp(value) {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  return Boolean(parsed) && !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function validIdentity(value) {
  return typeof value === 'string' && value.trim() === value && value.length >= 5 &&
    !/(?:^|[\s@._-])(fake|self|invented|unknown|example|placeholder|test|fixture|tbd|todo)(?:$|[\s@._-])/i.test(value);
}

function publicKeyRecord(authority) {
  if (!exactKeys(authority, AUTHORITY_KEYS) || authority.algorithm !== 'Ed25519' ||
      !REQUIRED_ROLES.includes(authority.role) || !validIdentity(authority.identity) ||
      !['active', 'revoked'].includes(authority.status) || !validTimestamp(authority.valid_from) ||
      !validTimestamp(authority.valid_until) || new Date(authority.valid_until) <= new Date(authority.valid_from) ||
      typeof authority.public_key_spki_pem !== 'string' ||
      !authority.public_key_spki_pem.startsWith('-----BEGIN PUBLIC KEY-----\n') ||
      !authority.public_key_spki_pem.endsWith('-----END PUBLIC KEY-----\n') ||
      authority.public_key_spki_pem.includes('PRIVATE KEY')) {
    return { ok: false, key: null, derived_key_id: null };
  }
  if ((authority.status === 'active' && authority.revoked_at !== null) ||
      (authority.status === 'revoked' && !validTimestamp(authority.revoked_at))) {
    return { ok: false, key: null, derived_key_id: null };
  }
  try {
    const key = crypto.createPublicKey(authority.public_key_spki_pem);
    if (key.asymmetricKeyType !== 'ed25519' ||
        key.export({ type: 'spki', format: 'pem' }) !== authority.public_key_spki_pem) {
      return { ok: false, key: null, derived_key_id: null };
    }
    const derivedKeyId = 'ed25519:' + sha256(key.export({ type: 'spki', format: 'der' }));
    return { ok: authority.key_id === derivedKeyId, key, derived_key_id: derivedKeyId };
  } catch (_) {
    return { ok: false, key: null, derived_key_id: null };
  }
}

function derivedRegistryStatus(registry, records) {
  if (!Array.isArray(registry && registry.authorities) || registry.authorities.length === 0) return 'unprovisioned';
  const activeRoles = new Set(registry.authorities.map(function (authority, index) {
    return records[index] && records[index].ok && authority.status === 'active' ? authority.role : null;
  }).filter(Boolean));
  return REQUIRED_ROLES.every(role => activeRoles.has(role)) ? 'provisioned' : 'incomplete';
}

function evaluateTrustRegistry(registry) {
  const authorities = Array.isArray(registry && registry.authorities) ? registry.authorities : [];
  const records = authorities.map(publicKeyRecord);
  const authorityCoordinates = authorities.map(authority => authority && authority.role + '|' + authority.key_id);
  const failures = [];
  if (!exactKeys(registry, REGISTRY_KEYS) || registry.schema_version !== POLICY_VERSION ||
      registry.registry_id !== 'elu-country-climate-intelligence-release-trust-v1' ||
      registry.repository !== REPOSITORY ||
      JSON.stringify(registry.required_roles) !== JSON.stringify(REQUIRED_ROLES)) failures.push('registry_identity');
  if (records.some(record => !record.ok) || new Set(authorityCoordinates).size !== authorityCoordinates.length) {
    failures.push('registry_authorities');
  }
  if (registry && registry.status !== derivedRegistryStatus(registry, records)) failures.push('registry_status');
  return {
    status: failures.length === 0 ? 'pass' : 'fail',
    failures,
    records,
    derived_status: derivedRegistryStatus(registry, records),
  };
}

function exactUnprovisionedTrust(registry) {
  const report = evaluateTrustRegistry(registry);
  return report.status === 'pass' && report.derived_status === 'unprovisioned' &&
    Array.isArray(registry.authorities) && registry.authorities.length === 0;
}

function canonicalSignature(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value)) return null;
  const bytes = Buffer.from(value, 'base64');
  return bytes.length === 64 && bytes.toString('base64') === value ? bytes : null;
}

function expectedRoleCoordinates(approval) {
  const coordinates = {};
  const reviews = Array.isArray(approval && approval.independent_reviews) ? approval.independent_reviews : [];
  REQUIRED_ROLES.slice(0, -1).forEach(function (role) {
    const review = reviews.find(item => item && item.role === role);
    coordinates[role] = { identity: review && review.reviewer_id, signed_at: review && review.reviewed_at };
  });
  coordinates.release_authorizer = {
    identity: approval && approval.decision && approval.decision.approved_by,
    approved_at: approval && approval.decision && approval.decision.approved_at,
    signed_at: null,
  };
  return coordinates;
}

function allAtOrBefore(timestamps, boundary) {
  return validTimestamp(boundary) && timestamps.length > 0 &&
    timestamps.every(timestamp => validTimestamp(timestamp) && new Date(timestamp) <= new Date(boundary));
}

function approvalPrerequisiteTimestamps(approval) {
  return [
    ...(Array.isArray(approval && approval.source_reviews) ? approval.source_reviews.map(item => item && item.reviewed_at) : []),
    ...(Array.isArray(approval && approval.independent_reviews) ? approval.independent_reviews.map(item => item && item.reviewed_at) : []),
    approval && approval.protected_file_review && approval.protected_file_review.reviewed_at,
  ];
}

function packageAttestationTimestamps(records, approval) {
  const values = Object.fromEntries(records.map(record => [record && record.path, record && record.value]));
  return [
    ...approvalPrerequisiteTimestamps(approval),
    approval && approval.decision && approval.decision.approved_at,
    values[RELEASE_DIR + '/reviewed-release-diff.json']?.review?.reviewed_at,
    values[RELEASE_DIR + '/reviewed-rollback-proof.json']?.review?.reviewed_at,
    values[RELEASE_DIR + '/reviewed-runtime-manifest.json']?.review?.reviewed_at,
  ];
}

function signatureMessage(fields) {
  const packageLines = fields.package_pins.map(pin => 'package=' + pin.path + '#' + pin.sha256).join('\n');
  return SIGNATURE_DOMAIN + '\n' +
    'repository=' + fields.repository + '\n' +
    'release_id=' + fields.release_id + '\n' +
    'subject_artifact_pin_digest=' + fields.subject_artifact_pin_digest + '\n' +
    'trust_registry=' + fields.trust_registry.path + '#' + fields.trust_registry.sha256 + '\n' +
    packageLines + '\n' +
    'role=' + fields.role + '\n' +
    'identity=' + fields.identity + '\n' +
    'signed_at=' + fields.signed_at + '\n';
}

function packagePins(records) {
  if (!Array.isArray(records)) return [];
  return records.slice().sort((left, right) => String(left.path).localeCompare(String(right.path)))
    .map(record => ({ path: record.path, sha256: Buffer.isBuffer(record.bytes) ? sha256(record.bytes) : null }));
}

function textParsesAs(text, expected) {
  if (typeof text !== 'string') return false;
  try { return JSON.stringify(JSON.parse(text)) === JSON.stringify(expected); }
  catch (_) { return false; }
}

function byteTextBinding(bytes, text, expected) {
  return Buffer.isBuffer(bytes) && typeof text === 'string' &&
    bytes.equals(Buffer.from(text, 'utf8')) && textParsesAs(text, expected);
}

function evaluateReleaseSignatures(input) {
  const approval = input && input.approval;
  const registry = input && input.trust_registry;
  const registryText = input && input.trust_registry_text;
  const registryBytes = input && input.trust_registry_bytes;
  const bundle = input && input.signature_bundle;
  const bundleText = input && input.signature_bundle_text;
  const bundleBytes = input && input.signature_bundle_bytes;
  const records = Array.isArray(input && input.package_records) ? input.package_records : [];
  const registrySha = Buffer.isBuffer(registryBytes) ? sha256(registryBytes) : null;
  const bundleSha = Buffer.isBuffer(bundleBytes) ? sha256(bundleBytes) : null;
  const expectedPins = packagePins(records);
  const trustReport = evaluateTrustRegistry(registry);
  const checks = [];
  const check = function (id, pass) { checks.push({ id, pass: pass === true }); };

  check('signature-files-regular', input && input.trust_registry_file_regular === true &&
    input.signature_bundle_file_regular === true && records.length === PACKAGE_PATHS.length &&
    records.every(record => record && record.regular_file === true));
  check('signature-json-byte-bindings', byteTextBinding(registryBytes, registryText, registry) &&
    byteTextBinding(bundleBytes, bundleText, bundle) &&
    records.every(record => byteTextBinding(record.bytes, record.text, record.value)));
  check('trust-registry-exact-pin', registrySha === input.expected_trust_registry_sha256);
  check('trust-registry-provisioned', trustReport.status === 'pass' && trustReport.derived_status === 'provisioned');
  check('signature-bundle-raw-hash', /^[0-9a-f]{64}$/.test(bundleSha || ''));
  check('package-path-set', JSON.stringify(expectedPins.map(pin => pin.path)) === JSON.stringify(PACKAGE_PATHS));

  const requestRecord = records.find(record => record.path === RELEASE_DIR + '/review-request.json');
  const request = requestRecord && requestRecord.value;
  const releaseId = request && request.release_id;
  const subjectArtifactPinDigest = request && request.subject && request.subject.artifact_pin_digest;
  check('signature-bundle-identity', exactKeys(bundle, BUNDLE_KEYS) &&
    bundle.schema_version === POLICY_VERSION &&
    bundle.signature_bundle_id === 'elu-country-climate-intelligence-v1-release-signatures-v2' &&
    bundle.repository === REPOSITORY && bundle.release_id === releaseId &&
    bundle.subject_artifact_pin_digest === subjectArtifactPinDigest && exactKeys(bundle.trust_registry, PIN_KEYS) &&
    bundle.trust_registry.path === TRUST_REGISTRY_PATH && bundle.trust_registry.sha256 === registrySha);
  check('signature-package-pins', Array.isArray(bundle && bundle.package_pins) &&
    JSON.stringify(bundle.package_pins) === JSON.stringify(expectedPins) &&
    bundle.package_pins.every(pin => exactKeys(pin, PIN_KEYS)));

  const signatures = Array.isArray(bundle && bundle.signatures) ? bundle.signatures : [];
  check('signature-role-set', signatures.length === REQUIRED_ROLES.length && signatures.every(function (signature, index) {
    return exactKeys(signature, SIGNATURE_KEYS) && signature.role === REQUIRED_ROLES[index];
  }));
  const coordinates = expectedRoleCoordinates(approval);
  check('signature-review-coordinates', REQUIRED_ROLES.slice(0, -1).every(function (role) {
    return validIdentity(coordinates[role] && coordinates[role].identity) &&
      validTimestamp(coordinates[role] && coordinates[role].signed_at);
  }) && validIdentity(coordinates.release_authorizer && coordinates.release_authorizer.identity) &&
    validTimestamp(coordinates.release_authorizer && coordinates.release_authorizer.approved_at));
  check('approval-decision-chronology', allAtOrBefore(
    approvalPrerequisiteTimestamps(approval),
    approval && approval.decision && approval.decision.approved_at
  ));
  const authorizerSignature = signatures.find(signature => signature && signature.role === 'release_authorizer');
  check('release-authorizer-final-chronology', allAtOrBefore(
    packageAttestationTimestamps(records, approval),
    authorizerSignature && authorizerSignature.signed_at
  ));
  check('signature-subject-coordinate', approval && approval.release_id === releaseId &&
    approval.subject_artifact_pin_digest === subjectArtifactPinDigest &&
    /^[a-f0-9]{64}$/.test(subjectArtifactPinDigest || ''));

  const selectedCoordinates = [];
  let valid = signatures.length === REQUIRED_ROLES.length;
  signatures.forEach(function (signature) {
    const coordinate = coordinates[signature.role] || {};
    const index = Array.isArray(registry && registry.authorities) ? registry.authorities.findIndex(function (authority) {
      return authority.role === signature.role && authority.key_id === signature.key_id;
    }) : -1;
    const authority = index >= 0 ? registry.authorities[index] : null;
    const record = index >= 0 ? trustReport.records[index] : null;
    const signatureBytes = canonicalSignature(signature.signature_base64);
    const signedAt = signature.role === 'release_authorizer' ? signature.signed_at : coordinate.signed_at;
    const roleValid = authority && record && record.ok && authority.status === 'active' &&
      authority.identity === coordinate.identity && validTimestamp(signature.signed_at) &&
      (signature.role === 'release_authorizer' || signature.signed_at === coordinate.signed_at) &&
      new Date(authority.valid_from) <= new Date(signature.signed_at) &&
      new Date(signature.signed_at) < new Date(authority.valid_until) && authority.revoked_at === null;
    const message = signatureMessage({
      repository: REPOSITORY,
      release_id: releaseId,
      subject_artifact_pin_digest: subjectArtifactPinDigest,
      trust_registry: { path: TRUST_REGISTRY_PATH, sha256: registrySha },
      package_pins: expectedPins,
      role: signature.role,
      identity: coordinate.identity,
      signed_at: signedAt,
    });
    let verified = false;
    try {
      verified = Boolean(roleValid && signatureBytes &&
        crypto.verify(null, Buffer.from(message, 'utf8'), record.key, signatureBytes));
    } catch (_) { verified = false; }
    if (!verified) valid = false;
    selectedCoordinates.push(signature.role + '|' + signature.key_id);
  });
  check('detached-ed25519-signatures', valid && new Set(selectedCoordinates).size === REQUIRED_ROLES.length);
  check('builder-not-signatory', validIdentity(approval && approval.builder_id) &&
    !REQUIRED_ROLES.some(role => coordinates[role] && coordinates[role].identity === approval.builder_id));

  const failures = checks.filter(item => !item.pass);
  return {
    policy_version: POLICY_VERSION,
    status: failures.length === 0 ? 'pass' : 'fail',
    trust_registry_sha256: registrySha,
    signature_bundle_sha256: bundleSha,
    package_pins: expectedPins,
    checks,
    failure_ids: failures.map(item => item.id),
  };
}

module.exports = {
  EXPECTED_TRUST_REGISTRY_SHA256,
  PACKAGE_PATHS,
  POLICY_VERSION,
  REPOSITORY,
  REQUIRED_ROLES,
  SIGNATURE_BUNDLE_PATH,
  SIGNATURE_DOMAIN,
  SIGNATURE_SCHEMA_PATH,
  TRUST_REGISTRY_PATH,
  canonicalSignature,
  approvalPrerequisiteTimestamps,
  derivedRegistryStatus,
  evaluateReleaseSignatures,
  evaluateTrustRegistry,
  exactUnprovisionedTrust,
  expectedRoleCoordinates,
  packagePins,
  packageAttestationTimestamps,
  publicKeyRecord,
  sha256,
  signatureMessage,
  validIdentity,
  validTimestamp,
};
