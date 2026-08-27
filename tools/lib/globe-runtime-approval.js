'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const POLICY_VERSION = '1.0.0';
const REPOSITORY = 'earth-love-united/earthloveunited.org';
const APPROVAL_PATH = 'data/climate/reviews/globe-runtime-assets-production-review.json';
const TRUST_REGISTRY_PATH = 'data/climate/governance/globe-runtime-approval-trust.json';
const SIGNATURE_BUNDLE_PATH = 'data/climate/reviews/globe-runtime-assets-production-review.signatures.json';
const EXPECTED_TRUST_REGISTRY_SHA256 = '9bb47c15abef171c340b9389edf680f5a2d01cac5a505ca3d208281fef63cf73';
const SIGNATURE_DOMAIN = 'ELU-GLOBE-RUNTIME-APPROVAL-SIGNATURE-V2';
const REVIEW_SUBJECT_DOMAIN = 'ELU-GLOBE-RUNTIME-APPROVAL-ARTIFACT-PINS-V1';
const REQUIRED_ROLES = Object.freeze([
  'asset_rights_reviewer',
  'licensing_counsel',
  'release_authorizer',
]);
const AUTHORITY_KEYS = Object.freeze([
  'algorithm',
  'identity',
  'key_id',
  'public_key_spki_pem',
  'revoked_at',
  'role',
  'status',
  'valid_from',
  'valid_until',
]);
const REGISTRY_KEYS = Object.freeze([
  'authorities',
  'registry_id',
  'repository',
  'required_roles',
  'schema_version',
  'status',
]);
const BUNDLE_KEYS = Object.freeze([
  'approval_path',
  'approval_sha256',
  'repository',
  'reviewed_artifact_pin_digest',
  'schema_version',
  'signature_bundle_id',
  'signatures',
  'trust_registry_path',
  'trust_registry_sha256',
]);
const SIGNATURE_KEYS = Object.freeze(['key_id', 'role', 'signature_base64']);
const AUTHORITY_BINDING_KEYS = Object.freeze(['key_ids', 'trust_registry_path', 'trust_registry_sha256']);
const REVIEWED_PATHS = Object.freeze([
  '404.html',
  '.github/workflows/ci.yml',
  '.github/CODEOWNERS',
  '.gitignore',
  'CREDITS.md',
  'LICENSE',
  'README.md',
  'THIRD_PARTY_NOTICES.txt',
  '_headers',
  '_redirects',
  'assets/partners/avocademy.svg',
  'assets/partners/save-planet-earth.svg',
  'assets/globe/runtime/earth-blue-marble.jpg',
  'assets/globe/runtime/earth-night.jpg',
  'assets/globe/runtime/earth-topology.png',
  'assets/globe/runtime/manifest.json',
  'assets/globe/runtime/ne_110m_admin_0_countries.geojson',
  'assets/globe/runtime/night-sky.png',
  'css/globe-system.css',
  'css/guided-first-orbit.css',
  'data/climate/fixtures/release-eligibility.json',
  'data/climate/fixtures/reviewed-climate-release.json',
  'data/climate/fixtures/truth-ci-policy.json',
  'data/climate/governance/globe-runtime-approval-trust.json',
  'data/climate/reviews/climate-factual-runtime-ct42-ui-review.json',
  'data/climate/runtime/candidate-manifest.json',
  'data/climate/runtime/country-climate-intelligence.json',
  'data/climate/runtime/country-factual-candidate.json',
  'data/climate/schemas/ct40-reviewed-release-input.schema.json',
  'data/climate/schemas/globe-runtime-assets-production-review.schema.json',
  'data/climate/schemas/reviewed-climate-runtime-manifest.schema.json',
  'data/climate/schemas/reviewed-release-diff.schema.json',
  'data/climate/schemas/reviewed-runtime-rollback-proof.schema.json',
  'data/governance/vendor/globe-gl-2.46.1-notices-integration.json',
  'data/governance/vendor/globe-gl-2.46.1-notices.json',
  'data/small-nations.json',
  'docs/CLIMATE-PRODUCTION-READINESS.md',
  'docs/COUNTRY-CLIMATE-TRUTH-CI.md',
  'docs/LEGACY-COUNTRY-DATA-EXIT.md',
  'docs/operations/GO_PUBLIC.md',
  'favicon.svg',
  'index.html',
  'js/app.js',
  'js/carbon-clock.js',
  'js/country-climate-intelligence.js',
  'js/data-schema.js',
  'js/data.js',
  'js/event-bus.js',
  'js/gaia-utils.js',
  'js/globe.js',
  'js/guided-first-orbit.js',
  'js/module-contracts.js',
  'js/storage-adapter.js',
  'js/storage.js',
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  'sw.js',
  'tools/build-deploy.sh',
  'tools/build-factual-public-deploy.sh',
  'tools/authoring/fetch-nasa-black-marble.sh',
  'tools/check-climate-factual-public-readiness.js',
  'tools/check-climate-factual-runtime-candidate.js',
  'tools/check-climate-factual-runtime-data-review.js',
  'tools/check-climate-production-readiness-policy.js',
  'tools/check-climate-production-readiness.js',
  'tools/check-globe-runtime-approval.js',
  'tools/check-globe-runtime-assets.js',
  'tools/check-globe-third-party-notices.js',
  'tools/check-globe-vendor-integrity.js',
  'tools/check-public-climate-release-profile.js',
  'tools/check-public-deploy-surface.js',
  'tools/check-reviewed-climate-release.js',
  'tools/check-staged-factual-public-integrity.js',
  'tools/check-staged-production-integrity.js',
  'tools/climate-truth-ci.js',
  'tools/fixtures/globe-runtime-assets.json',
  'tools/fixtures/globe-third-party-notices.json',
  'tools/fixtures/globe-vendor-integrity.json',
  'tools/fetch-globe-vendor.sh',
  'tools/lib/climate-production-readiness.js',
  'tools/lib/climate-release-gate.js',
  'tools/lib/climate-reviewed-release.js',
  'tools/lib/climate-runtime-diff-boundary.js',
  'tools/lib/climate-truth-ci-policy.js',
  'tools/lib/globe-runtime-approval.js',
  'tools/lib/globe-runtime-assets.js',
  'tools/lib/globe-third-party-notices.js',
  'tools/lib/json-schema-lite.js',
  'tools/lib/public-climate-release-profile.js',
  'tools/lib/public-deploy-surface.js',
  'tools/lib/reviewed-runtime-rollback-proof.js',
  'tools/smoke-test.js',
  'tools/stage-public-deploy.js',
  'wrangler.jsonc',
].sort());

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function artifactPinDigest(pins) {
  if (!Array.isArray(pins) || pins.length !== REVIEWED_PATHS.length) return null;
  const normalized = pins.map(function (pin) {
    if (!exactKeys(pin, ['path', 'sha256']) || typeof pin.path !== 'string' ||
        !/^[0-9a-f]{64}$/.test(pin.sha256 || '')) return null;
    return { path: pin.path, sha256: pin.sha256 };
  });
  if (normalized.includes(null)) return null;
  normalized.sort(function (left, right) {
    return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
  });
  if (new Set(normalized.map(function (pin) { return pin.path; })).size !== normalized.length ||
      JSON.stringify(normalized.map(function (pin) { return pin.path; })) !== JSON.stringify(REVIEWED_PATHS)) return null;
  return sha256(REVIEW_SUBJECT_DOMAIN + '\n' + JSON.stringify(normalized) + '\n');
}

function reviewedArtifactPins(root) {
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('review subject root must be a regular directory');
  return REVIEWED_PATHS.map(function (relative) {
    let current = root;
    relative.split('/').forEach(function (part, index, parts) {
      current = path.join(current, part);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
        throw new Error('reviewed artifact must be a regular non-symlink file: ' + relative);
      }
    });
    return { path: relative, sha256: sha256(fs.readFileSync(current)) };
  });
}

function reviewedArtifactBindingPasses(root, approval) {
  try {
    const declared = approval && approval.reviewed_artifact_pins;
    const declaredDigest = approval && approval.reviewed_artifact_pin_digest;
    const current = reviewedArtifactPins(root);
    return /^[0-9a-f]{64}$/.test(declaredDigest || '') &&
      artifactPinDigest(declared) === declaredDigest &&
      JSON.stringify(declared) === JSON.stringify(current) &&
      artifactPinDigest(current) === declaredDigest;
  } catch (_) {
    return false;
  }
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
    !/(?:^|[\s@._-])(fake|self|invented|unknown|example|placeholder|test|tbd|todo)(?:$|[\s@._-])/i.test(value);
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
    if (key.asymmetricKeyType !== 'ed25519') return { ok: false, key: null, derived_key_id: null };
    if (key.export({ type: 'spki', format: 'pem' }) !== authority.public_key_spki_pem) {
      return { ok: false, key: null, derived_key_id: null };
    }
    const der = key.export({ type: 'spki', format: 'der' });
    const derivedKeyId = 'ed25519:' + sha256(der);
    return { ok: authority.key_id === derivedKeyId, key: key, derived_key_id: derivedKeyId };
  } catch (_) {
    return { ok: false, key: null, derived_key_id: null };
  }
}

function derivedRegistryStatus(registry, records) {
  if (!Array.isArray(registry && registry.authorities) || registry.authorities.length === 0) return 'unprovisioned';
  const activeRoles = new Set(registry.authorities.map(function (authority, index) {
    return records[index] && records[index].ok && authority.status === 'active' ? authority.role : null;
  }).filter(Boolean));
  return REQUIRED_ROLES.every(function (role) { return activeRoles.has(role); }) ? 'provisioned' : 'incomplete';
}

function evaluateTrustRegistry(registry) {
  const authorities = Array.isArray(registry && registry.authorities) ? registry.authorities : [];
  const records = authorities.map(publicKeyRecord);
  const keyIds = authorities.map(function (authority) { return authority && authority.key_id; });
  const failures = [];
  if (!exactKeys(registry, REGISTRY_KEYS) || registry.schema_version !== POLICY_VERSION ||
      registry.registry_id !== 'elu-globe-runtime-approval-trust-v1' || registry.repository !== REPOSITORY ||
      JSON.stringify(registry.required_roles) !== JSON.stringify(REQUIRED_ROLES)) failures.push('registry_identity');
  if (records.some(function (record) { return !record.ok; }) || new Set(keyIds).size !== keyIds.length) {
    failures.push('registry_authorities');
  }
  if (registry && registry.status !== derivedRegistryStatus(registry, records)) failures.push('registry_status');
  return {
    status: failures.length === 0 ? 'pass' : 'fail',
    failures: failures,
    records: records,
    derived_status: derivedRegistryStatus(registry, records),
  };
}

function exactUnprovisionedTrust(registry) {
  const report = evaluateTrustRegistry(registry);
  return report.status === 'pass' && report.derived_status === 'unprovisioned' &&
    Array.isArray(registry.authorities) && registry.authorities.length === 0;
}

function signatureMessage(fields) {
  return SIGNATURE_DOMAIN + '\n' +
    'repository=' + fields.repository + '\n' +
    'approval_path=' + fields.approval_path + '\n' +
    'approval_sha256=' + fields.approval_sha256 + '\n' +
    'trust_registry_path=' + fields.trust_registry_path + '\n' +
    'trust_registry_sha256=' + fields.trust_registry_sha256 + '\n' +
    'reviewed_artifact_pin_digest=' + fields.reviewed_artifact_pin_digest + '\n' +
    'role=' + fields.role + '\n';
}

function canonicalSignature(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value)) return null;
  const bytes = Buffer.from(value, 'base64');
  return bytes.length === 64 && bytes.toString('base64') === value ? bytes : null;
}

function textParsesAs(text, expected) {
  if (typeof text !== 'string') return false;
  try { return JSON.stringify(JSON.parse(text)) === JSON.stringify(expected); }
  catch (_) { return false; }
}

function rawBytesMatchText(bytes, text) {
  return Buffer.isBuffer(bytes) && typeof text === 'string' && bytes.toString('utf8') === text &&
    Buffer.from(text, 'utf8').equals(bytes);
}

function evaluateApprovalAuthority(input) {
  const approval = input && input.approval;
  const registry = input && input.trust_registry;
  const bundle = input && input.signature_bundle;
  const approvalBytes = input && input.approval_bytes;
  const registryBytes = input && input.trust_registry_bytes;
  const bundleBytes = input && input.signature_bundle_bytes;
  const approvalText = input && input.approval_text;
  const registryText = input && input.trust_registry_text;
  const bundleText = input && input.signature_bundle_text;
  const approvalSha = Buffer.isBuffer(approvalBytes) ? sha256(approvalBytes) : null;
  const registrySha = Buffer.isBuffer(registryBytes) ? sha256(registryBytes) : null;
  const bundleSha = Buffer.isBuffer(bundleBytes) ? sha256(bundleBytes) : null;
  const trustReport = evaluateTrustRegistry(registry);
  const checks = [];
  const check = function (id, pass) { checks.push({ id: id, pass: pass === true }); };

  check('authority-files-regular', input && input.approval_file_regular === true &&
    input.trust_registry_file_regular === true && input.signature_bundle_file_regular === true);
  check('authority-json-byte-bindings', rawBytesMatchText(approvalBytes, approvalText) &&
    rawBytesMatchText(registryBytes, registryText) && rawBytesMatchText(bundleBytes, bundleText) &&
    textParsesAs(approvalText, approval) && textParsesAs(registryText, registry) && textParsesAs(bundleText, bundle));
  check('trust-registry-exact-pin', registrySha === input.expected_trust_registry_sha256);
  check('trust-registry-provisioned', trustReport.status === 'pass' && trustReport.derived_status === 'provisioned');
  check('approval-raw-hash', /^[0-9a-f]{64}$/.test(approvalSha || ''));
  check('signature-bundle-raw-hash', /^[0-9a-f]{64}$/.test(bundleSha || ''));

  const bindings = approval && approval.authority_bindings;
  const keyIds = bindings && bindings.key_ids;
  check('approval-authority-bindings', exactKeys(bindings, AUTHORITY_BINDING_KEYS) &&
    exactKeys(keyIds, REQUIRED_ROLES.slice().sort()) &&
    bindings.trust_registry_path === TRUST_REGISTRY_PATH &&
    bindings.trust_registry_sha256 === registrySha &&
    REQUIRED_ROLES.every(function (role) { return typeof keyIds[role] === 'string'; }) &&
    new Set(REQUIRED_ROLES.map(function (role) { return keyIds[role]; })).size === REQUIRED_ROLES.length);

  check('signature-bundle-identity', exactKeys(bundle, BUNDLE_KEYS) &&
    bundle.schema_version === POLICY_VERSION &&
    bundle.signature_bundle_id === 'elu-globe-runtime-assets-production-review-signatures-v2' &&
    bundle.repository === REPOSITORY && bundle.approval_path === APPROVAL_PATH &&
    bundle.approval_sha256 === approvalSha && bundle.trust_registry_path === TRUST_REGISTRY_PATH &&
    bundle.trust_registry_sha256 === registrySha &&
    bundle.reviewed_artifact_pin_digest === approval?.reviewed_artifact_pin_digest);

  const signatures = Array.isArray(bundle && bundle.signatures) ? bundle.signatures : [];
  check('signature-role-set', signatures.length === REQUIRED_ROLES.length && signatures.every(function (item, index) {
    return exactKeys(item, SIGNATURE_KEYS) && item.role === REQUIRED_ROLES[index];
  }));

  const reviewedAt = approval && approval.reviewed_at;
  check('approval-review-coordinate', validTimestamp(reviewedAt) &&
    /^[0-9a-f]{64}$/.test(approval && approval.reviewed_artifact_pin_digest || '') &&
    artifactPinDigest(approval && approval.reviewed_artifact_pins) === approval?.reviewed_artifact_pin_digest);
  const expectedIdentities = {
    asset_rights_reviewer: approval && approval.reviewer_identity,
    licensing_counsel: approval && approval.counsel_reviewer_identity,
    release_authorizer: approval && approval.release_authority_identity,
  };
  const selected = [];
  let signaturesValid = signatures.length === REQUIRED_ROLES.length && validTimestamp(reviewedAt);
  signatures.forEach(function (signature) {
    const index = registry && Array.isArray(registry.authorities) ? registry.authorities.findIndex(function (authority) {
      return authority.key_id === signature.key_id;
    }) : -1;
    const authority = index >= 0 ? registry.authorities[index] : null;
    const record = index >= 0 ? trustReport.records[index] : null;
    const signatureBytes = canonicalSignature(signature.signature_base64);
    const roleValid = authority && record && record.ok && authority.status === 'active' &&
      authority.role === signature.role && authority.identity === expectedIdentities[signature.role] &&
      keyIds && keyIds[signature.role] === signature.key_id &&
      new Date(authority.valid_from) <= new Date(reviewedAt) && new Date(reviewedAt) < new Date(authority.valid_until) &&
      authority.revoked_at === null;
    const message = signatureMessage({
      repository: REPOSITORY,
      approval_path: APPROVAL_PATH,
      approval_sha256: approvalSha,
      trust_registry_path: TRUST_REGISTRY_PATH,
      trust_registry_sha256: registrySha,
      reviewed_artifact_pin_digest: approval && approval.reviewed_artifact_pin_digest,
      role: signature.role,
    });
    let verified = false;
    try { verified = Boolean(roleValid && signatureBytes && crypto.verify(null, Buffer.from(message, 'utf8'), record.key, signatureBytes)); }
    catch (_) { verified = false; }
    if (!verified) signaturesValid = false;
    selected.push(signature.key_id);
  });
  check('detached-ed25519-signatures', signaturesValid && new Set(selected).size === REQUIRED_ROLES.length);
  check('authority-identities-distinct', REQUIRED_ROLES.every(function (role) { return validIdentity(expectedIdentities[role]); }) &&
    validIdentity(approval && approval.builder_identity) &&
    new Set([approval.builder_identity].concat(REQUIRED_ROLES.map(function (role) { return expectedIdentities[role]; }))).size === 4);
  check('reviewed-artifact-binding', input && input.reviewed_artifact_binding_passed === true);

  const failures = checks.filter(function (item) { return !item.pass; });
  return {
    policy_version: POLICY_VERSION,
    status: failures.length === 0 ? 'pass' : 'fail',
    approval_sha256: approvalSha,
    trust_registry_sha256: registrySha,
    signature_bundle_sha256: bundleSha,
    checks: checks,
    failure_ids: failures.map(function (item) { return item.id; }),
  };
}

module.exports = {
  APPROVAL_PATH,
  AUTHORITY_BINDING_KEYS,
  EXPECTED_TRUST_REGISTRY_SHA256,
  POLICY_VERSION,
  REPOSITORY,
  REVIEWED_PATHS,
  REVIEW_SUBJECT_DOMAIN,
  REQUIRED_ROLES,
  SIGNATURE_BUNDLE_PATH,
  SIGNATURE_DOMAIN,
  TRUST_REGISTRY_PATH,
  artifactPinDigest,
  canonicalSignature,
  derivedRegistryStatus,
  evaluateApprovalAuthority,
  evaluateTrustRegistry,
  exactUnprovisionedTrust,
  publicKeyRecord,
  rawBytesMatchText,
  reviewedArtifactBindingPasses,
  reviewedArtifactPins,
  sha256,
  signatureMessage,
  validIdentity,
  validTimestamp,
};
