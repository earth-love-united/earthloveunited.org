#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const policy = require('./lib/country-climate-intelligence-release-signatures');
const { validateJsonSchema } = require('./lib/json-schema-lite');

const ROOT = path.resolve(__dirname, '..');
const SUBJECT_ARTIFACT_PIN_DIGEST = '1234567890abcdef'.repeat(4);
const RELEASE_ID = 'country-climate-intelligence-v1-signature-fixture';
const REVIEWED_AT = '2026-08-27T12:00:00.000Z';
const APPROVED_AT = '2026-08-27T12:05:00.000Z';
const RUNTIME_REVIEWED_AT = '2026-08-27T12:06:00.000Z';
const DIFF_REVIEWED_AT = '2026-08-27T12:07:00.000Z';
const ROLLBACK_REVIEWED_AT = '2026-08-27T12:08:00.000Z';
const AUTHORIZER_SIGNED_AT = '2026-08-27T12:10:00.000Z';
const IDENTITIES = Object.freeze(Object.fromEntries(policy.REQUIRED_ROLES.map(function (role) {
  return [role, 'reviewer-' + role.replaceAll('_', '-') + '@earthloveunited.org'];
})));

function jsonText(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function generatedAuthority(role) {
  const pair = crypto.generateKeyPairSync('ed25519');
  const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
  const publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
  return {
    authority: {
      algorithm: 'Ed25519',
      identity: IDENTITIES[role],
      key_id: 'ed25519:' + policy.sha256(publicDer),
      public_key_spki_pem: publicPem,
      revoked_at: null,
      role,
      status: 'active',
      valid_from: '2026-01-01T00:00:00.000Z',
      valid_until: '2027-01-01T00:00:00.000Z',
    },
    privateKey: pair.privateKey,
  };
}

function fixtureDocuments() {
  const independentReviews = policy.REQUIRED_ROLES.slice(0, -1).map(role => ({
    role,
    reviewer_id: IDENTITIES[role],
    reviewed_at: REVIEWED_AT,
  }));
  return {
    [policy.PACKAGE_PATHS[0]]: {
      release_id: RELEASE_ID,
      subject_artifact_pin_digest: SUBJECT_ARTIFACT_PIN_DIGEST,
      builder_id: 'release-builder@earthloveunited.org',
      source_reviews: Array.from({ length: 5 }, (_, index) => ({
        source_registry_id: 'fixture-source-' + index,
        reviewer_id: 'source-reviewer-' + index + '@earthloveunited.org',
        reviewed_at: REVIEWED_AT,
      })),
      independent_reviews: independentReviews,
      protected_file_review: {
        reviewer_id: 'protected-reviewer@earthloveunited.org',
        reviewed_at: REVIEWED_AT,
      },
      decision: { approved_by: IDENTITIES.release_authorizer, approved_at: APPROVED_AT },
    },
    [policy.PACKAGE_PATHS[1]]: {
      release_id: RELEASE_ID,
      subject: { artifact_pin_digest: SUBJECT_ARTIFACT_PIN_DIGEST },
    },
    [policy.PACKAGE_PATHS[2]]: {
      data_release_id: RELEASE_ID,
      diff_hash: 'a'.repeat(64),
      review: { reviewed_at: DIFF_REVIEWED_AT },
    },
    [policy.PACKAGE_PATHS[3]]: {
      data_release_id: RELEASE_ID,
      calculation_hash: 'b'.repeat(64),
      review: { reviewed_at: ROLLBACK_REVIEWED_AT },
    },
    [policy.PACKAGE_PATHS[4]]: {
      release_id: RELEASE_ID,
      calculation_hash: 'c'.repeat(64),
      review: { reviewed_at: RUNTIME_REVIEWED_AT },
    },
  };
}

function makeBaseline() {
  const generated = policy.REQUIRED_ROLES.map(generatedAuthority);
  const registry = {
    schema_version: policy.POLICY_VERSION,
    registry_id: 'elu-country-climate-intelligence-release-trust-v1',
    status: 'provisioned',
    repository: policy.REPOSITORY,
    required_roles: [...policy.REQUIRED_ROLES],
    authorities: generated.map(item => item.authority),
  };
  const registryText = jsonText(registry);
  const registrySha = policy.sha256(registryText);
  const values = fixtureDocuments();
  const packageRecords = policy.PACKAGE_PATHS.map(relative => ({
    path: relative,
    value: values[relative],
    text: jsonText(values[relative]),
    bytes: Buffer.from(jsonText(values[relative]), 'utf8'),
    regular_file: true,
  }));
  const pins = policy.packagePins(packageRecords);
  const approval = values[policy.PACKAGE_PATHS[0]];
  const signatures = policy.REQUIRED_ROLES.map(function (role, index) {
    const signedAt = role === 'release_authorizer' ? AUTHORIZER_SIGNED_AT : REVIEWED_AT;
    const message = policy.signatureMessage({
      repository: policy.REPOSITORY,
      release_id: RELEASE_ID,
      subject_artifact_pin_digest: SUBJECT_ARTIFACT_PIN_DIGEST,
      trust_registry: { path: policy.TRUST_REGISTRY_PATH, sha256: registrySha },
      package_pins: pins,
      role,
      identity: IDENTITIES[role],
      signed_at: signedAt,
    });
    return {
      role,
      key_id: generated[index].authority.key_id,
      signed_at: signedAt,
      signature_base64: crypto.sign(null, Buffer.from(message, 'utf8'), generated[index].privateKey).toString('base64'),
    };
  });
  const signatureBundle = {
    schema_version: policy.POLICY_VERSION,
    signature_bundle_id: 'elu-country-climate-intelligence-v1-release-signatures-v2',
    repository: policy.REPOSITORY,
    release_id: RELEASE_ID,
    subject_artifact_pin_digest: SUBJECT_ARTIFACT_PIN_DIGEST,
    trust_registry: { path: policy.TRUST_REGISTRY_PATH, sha256: registrySha },
    package_pins: pins,
    signatures,
  };
  return {
    input: {
      approval,
      trust_registry: registry,
      trust_registry_text: registryText,
      trust_registry_bytes: Buffer.from(registryText, 'utf8'),
      trust_registry_file_regular: true,
      expected_trust_registry_sha256: registrySha,
      signature_bundle: signatureBundle,
      signature_bundle_text: jsonText(signatureBundle),
      signature_bundle_bytes: Buffer.from(jsonText(signatureBundle), 'utf8'),
      signature_bundle_file_regular: true,
      package_records: packageRecords,
    },
    generated,
  };
}

function refreshText(input, name) {
  input[name + '_text'] = jsonText(input[name]);
  input[name + '_bytes'] = Buffer.from(input[name + '_text'], 'utf8');
}

function assertRejected(id, mutate) {
  const state = makeBaseline();
  mutate(state.input, state);
  const report = policy.evaluateReleaseSignatures(state.input);
  assert.equal(report.status, 'fail', id + ' unexpectedly passed');
}

function checkedInReleaseState(registry, signatureBundlePresent) {
  const trustReport = policy.evaluateTrustRegistry(registry);
  if (trustReport.status !== 'pass') {
    throw new Error('checked-in CCI trust and signature-bundle state is partial or incoherent');
  }
  if (signatureBundlePresent === false && ['unprovisioned', 'provisioned'].includes(trustReport.derived_status)) {
    return 'candidate';
  }
  if (trustReport.status === 'pass' && trustReport.derived_status === 'provisioned' && signatureBundlePresent === true) {
    return 'release';
  }
  throw new Error('checked-in CCI trust and signature-bundle state is partial or incoherent');
}

function resignAuthorizer(input, state, signedAt) {
  const signature = input.signature_bundle.signatures.find(item => item.role === 'release_authorizer');
  const index = policy.REQUIRED_ROLES.indexOf('release_authorizer');
  signature.signed_at = signedAt;
  const message = policy.signatureMessage({
    repository: policy.REPOSITORY,
    release_id: RELEASE_ID,
    subject_artifact_pin_digest: SUBJECT_ARTIFACT_PIN_DIGEST,
    trust_registry: input.signature_bundle.trust_registry,
    package_pins: input.signature_bundle.package_pins,
    role: signature.role,
    identity: IDENTITIES.release_authorizer,
    signed_at: signedAt,
  });
  signature.signature_base64 = crypto.sign(
    null,
    Buffer.from(message, 'utf8'),
    state.generated[index].privateKey
  ).toString('base64');
  refreshText(input, 'signature_bundle');
}

const baseline = makeBaseline();
const baselineReport = policy.evaluateReleaseSignatures(baseline.input);
assert.equal(baselineReport.status, 'pass', 'ephemeral eight-role Ed25519 baseline must pass');
assert.deepEqual(baselineReport.failure_ids, []);
const signatureSchema = JSON.parse(fs.readFileSync(path.join(ROOT, policy.SIGNATURE_SCHEMA_PATH), 'utf8'));
assert.deepEqual(validateJsonSchema(baseline.input.signature_bundle, signatureSchema), []);

const trustText = fs.readFileSync(path.join(ROOT, policy.TRUST_REGISTRY_PATH), 'utf8');
const trust = JSON.parse(trustText);
assert.equal(policy.sha256(trustText), policy.EXPECTED_TRUST_REGISTRY_SHA256);
const candidateTrustFixture = {
  schema_version: policy.POLICY_VERSION,
  registry_id: 'elu-country-climate-intelligence-release-trust-v1',
  status: 'unprovisioned',
  repository: policy.REPOSITORY,
  required_roles: [...policy.REQUIRED_ROLES],
  authorities: [],
};
assert.equal(checkedInReleaseState(candidateTrustFixture, false), 'candidate');
assert.equal(checkedInReleaseState(baseline.input.trust_registry, false), 'candidate');
assert.equal(checkedInReleaseState(baseline.input.trust_registry, true), 'release');
assert.throws(() => checkedInReleaseState(candidateTrustFixture, true), /partial or incoherent/);
const signatureBundlePresent = fs.existsSync(path.join(ROOT, policy.SIGNATURE_BUNDLE_PATH));
const checkedInState = checkedInReleaseState(trust, signatureBundlePresent);
if (checkedInState === 'release') {
  const checkedInBundle = JSON.parse(fs.readFileSync(path.join(ROOT, policy.SIGNATURE_BUNDLE_PATH), 'utf8'));
  assert.deepEqual(validateJsonSchema(checkedInBundle, signatureSchema), []);
}

const mutations = [
  ['registry-not-regular', input => { input.trust_registry_file_regular = false; }],
  ['bundle-not-regular', input => { input.signature_bundle_file_regular = false; }],
  ['package-not-regular', input => { input.package_records[0].regular_file = false; }],
  ['package-raw-byte-mutation', input => {
    const bytes = Buffer.from(input.package_records[0].bytes);
    const stringByte = bytes.indexOf(Buffer.from('release-builder'));
    bytes[stringByte] = 0xff;
    input.package_records[0].bytes = bytes;
  }],
  ['registry-hash-unpinned', input => { input.expected_trust_registry_sha256 = '0'.repeat(64); }],
  ['private-key-material', (input, state) => {
    input.trust_registry.authorities[0].public_key_spki_pem = state.generated[0].privateKey.export({ type: 'pkcs8', format: 'pem' });
    refreshText(input, 'trust_registry');
  }],
  ['rsa-key', input => {
    input.trust_registry.authorities[0].public_key_spki_pem = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
      .publicKey.export({ type: 'spki', format: 'pem' });
    refreshText(input, 'trust_registry');
  }],
  ['key-id-mismatch', input => {
    input.trust_registry.authorities[0].key_id = 'ed25519:' + '0'.repeat(64);
    refreshText(input, 'trust_registry');
  }],
  ['false-registry-status', input => { input.trust_registry.status = 'unprovisioned'; refreshText(input, 'trust_registry'); }],
  ['expired-key', input => {
    input.trust_registry.authorities[0].valid_until = '2026-08-27T11:00:00.000Z';
    refreshText(input, 'trust_registry');
  }],
  ['revoked-key', input => {
    input.trust_registry.authorities[0].status = 'revoked';
    input.trust_registry.authorities[0].revoked_at = '2026-08-27T11:00:00.000Z';
    input.trust_registry.status = 'incomplete';
    refreshText(input, 'trust_registry');
  }],
  ['signature-bitflip', input => {
    const bytes = Buffer.from(input.signature_bundle.signatures[0].signature_base64, 'base64');
    bytes[0] ^= 1;
    input.signature_bundle.signatures[0].signature_base64 = bytes.toString('base64');
    refreshText(input, 'signature_bundle');
  }],
  ['signature-noncanonical', input => {
    input.signature_bundle.signatures[0].signature_base64 = Buffer.alloc(63).toString('base64');
    refreshText(input, 'signature_bundle');
  }],
  ['cross-role-replay', input => {
    input.signature_bundle.signatures[0].signature_base64 = input.signature_bundle.signatures[1].signature_base64;
    refreshText(input, 'signature_bundle');
  }],
  ['signature-role-swap', input => {
    input.signature_bundle.signatures.reverse();
    refreshText(input, 'signature_bundle');
  }],
  ['signature-role-missing', input => {
    input.signature_bundle.signatures.pop();
    refreshText(input, 'signature_bundle');
  }],
  ['package-mutated-after-signing', input => {
    input.package_records[2].value.diff_hash = 'd'.repeat(64);
    input.package_records[2].text = jsonText(input.package_records[2].value);
    input.package_records[2].bytes = Buffer.from(input.package_records[2].text, 'utf8');
  }],
  ['bundle-package-pin-disagrees', input => {
    input.signature_bundle.package_pins[0].sha256 = 'e'.repeat(64);
    refreshText(input, 'signature_bundle');
  }],
  ['bundle-subject-digest-disagrees', input => {
    input.signature_bundle.subject_artifact_pin_digest = 'f'.repeat(64);
    refreshText(input, 'signature_bundle');
  }],
  ['review-identity-disagrees', input => {
    input.approval.independent_reviews[0].reviewer_id = 'different-reviewer@earthloveunited.org';
    input.package_records[0].value = input.approval;
    input.package_records[0].text = jsonText(input.approval);
    input.package_records[0].bytes = Buffer.from(input.package_records[0].text, 'utf8');
  }],
  ['review-time-disagrees', input => {
    input.approval.independent_reviews[0].reviewed_at = '2026-08-27T13:00:00.000Z';
    input.package_records[0].value = input.approval;
    input.package_records[0].text = jsonText(input.approval);
    input.package_records[0].bytes = Buffer.from(input.package_records[0].text, 'utf8');
  }],
  ['approval-decision-precedes-independent-review', input => {
    input.approval.independent_reviews[0].reviewed_at = '2026-08-27T12:05:01.000Z';
    input.package_records[0].value = input.approval;
    input.package_records[0].text = jsonText(input.approval);
    input.package_records[0].bytes = Buffer.from(input.package_records[0].text, 'utf8');
  }],
  ['release-authorizer-precedes-final-package-review', (input, state) => {
    resignAuthorizer(input, state, '2026-08-27T12:07:30.000Z');
  }],
  ['builder-reuses-signatory', input => {
    input.approval.builder_id = IDENTITIES.carbon_accounting;
    input.package_records[0].value = input.approval;
    input.package_records[0].text = jsonText(input.approval);
    input.package_records[0].bytes = Buffer.from(input.package_records[0].text, 'utf8');
  }],
];

mutations.forEach(entry => assertRejected(entry[0], entry[1]));

process.stdout.write(
  'Country Climate Intelligence release signatures: PASS (ephemeral eight-role Ed25519 baseline; ' +
  mutations.length + ' fail-closed mutations; checked-in state: ' + checkedInState + ')\n'
);
