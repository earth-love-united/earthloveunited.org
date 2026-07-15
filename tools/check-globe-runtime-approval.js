#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const approvalPolicy = require('./lib/globe-runtime-approval');

const ROOT = path.resolve(__dirname, '..');
const REVIEWED_AT = '2026-07-15T12:00:00.000Z';
const REVIEWED_COMMIT = '1234567890abcdef1234567890abcdef12345678';
const IDENTITIES = Object.freeze({
  asset_rights_reviewer: 'asset-rights-reviewer@earthloveunited.org',
  licensing_counsel: 'licensing-counsel@earthloveunited.org',
  release_authorizer: 'release-authorizer@earthloveunited.org',
});

function jsonText(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function clone(value) {
  return structuredClone(value);
}

function generatedAuthority(role) {
  const pair = crypto.generateKeyPairSync('ed25519');
  const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
  const publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
  return {
    authority: {
      algorithm: 'Ed25519',
      identity: IDENTITIES[role],
      key_id: 'ed25519:' + approvalPolicy.sha256(publicDer),
      public_key_spki_pem: publicPem,
      revoked_at: null,
      role: role,
      status: 'active',
      valid_from: '2026-01-01T00:00:00.000Z',
      valid_until: '2027-01-01T00:00:00.000Z',
    },
    privateKey: pair.privateKey,
  };
}

function makeBaseline() {
  const generated = approvalPolicy.REQUIRED_ROLES.map(generatedAuthority);
  const registry = {
    schema_version: approvalPolicy.POLICY_VERSION,
    registry_id: 'elu-globe-runtime-approval-trust-v1',
    status: 'provisioned',
    repository: approvalPolicy.REPOSITORY,
    required_roles: [...approvalPolicy.REQUIRED_ROLES],
    authorities: generated.map(item => item.authority),
  };
  const registryText = jsonText(registry);
  const registrySha = approvalPolicy.sha256(registryText);
  const keyIds = Object.fromEntries(registry.authorities.map(authority => [authority.role, authority.key_id]));
  const approval = {
    schema_version: '2.0.0',
    review_id: 'elu-globe-runtime-assets-production-review-v2',
    reviewed_commit_sha: REVIEWED_COMMIT,
    reviewed_at: REVIEWED_AT,
    builder_identity: 'release-builder@earthloveunited.org',
    reviewer_identity: IDENTITIES.asset_rights_reviewer,
    counsel_reviewer_identity: IDENTITIES.licensing_counsel,
    release_authority_identity: IDENTITIES.release_authorizer,
    authority_bindings: {
      key_ids: keyIds,
      trust_registry_path: approvalPolicy.TRUST_REGISTRY_PATH,
      trust_registry_sha256: registrySha,
    },
  };
  const approvalText = jsonText(approval);
  const approvalSha = approvalPolicy.sha256(approvalText);
  const signatures = approvalPolicy.REQUIRED_ROLES.map(function (role, index) {
    const message = approvalPolicy.signatureMessage({
      repository: approvalPolicy.REPOSITORY,
      approval_path: approvalPolicy.APPROVAL_PATH,
      approval_sha256: approvalSha,
      trust_registry_path: approvalPolicy.TRUST_REGISTRY_PATH,
      trust_registry_sha256: registrySha,
      reviewed_commit_sha: REVIEWED_COMMIT,
      role: role,
    });
    return {
      key_id: keyIds[role],
      role: role,
      signature_base64: crypto.sign(null, Buffer.from(message, 'utf8'), generated[index].privateKey).toString('base64'),
    };
  });
  const signatureBundle = {
    schema_version: approvalPolicy.POLICY_VERSION,
    signature_bundle_id: 'elu-globe-runtime-assets-production-review-signatures-v1',
    repository: approvalPolicy.REPOSITORY,
    approval_path: approvalPolicy.APPROVAL_PATH,
    approval_sha256: approvalSha,
    trust_registry_path: approvalPolicy.TRUST_REGISTRY_PATH,
    trust_registry_sha256: registrySha,
    reviewed_commit_sha: REVIEWED_COMMIT,
    signatures: signatures,
  };
  return {
    input: {
      approval: approval,
      approval_text: approvalText,
      approval_file_regular: true,
      trust_registry: registry,
      trust_registry_text: registryText,
      trust_registry_file_regular: true,
      expected_trust_registry_sha256: registrySha,
      signature_bundle: signatureBundle,
      signature_bundle_text: jsonText(signatureBundle),
      signature_bundle_file_regular: true,
      reviewed_commit_binding_passed: true,
    },
    privateKeys: generated.map(item => item.privateKey),
  };
}

function refreshText(input, name) {
  input[name + '_text'] = jsonText(input[name]);
}

function assertRejected(id, mutate) {
  const baseline = makeBaseline();
  mutate(baseline.input, baseline);
  const report = approvalPolicy.evaluateApprovalAuthority(baseline.input);
  assert.equal(report.status, 'fail', id + ' unexpectedly passed');
}

const baseline = makeBaseline();
const baselineReport = approvalPolicy.evaluateApprovalAuthority(baseline.input);
assert.equal(baselineReport.status, 'pass', 'ephemeral Ed25519 baseline must pass');
assert.equal(baselineReport.failure_ids.length, 0);

const trustText = fs.readFileSync(path.join(ROOT, approvalPolicy.TRUST_REGISTRY_PATH), 'utf8');
const trust = JSON.parse(trustText);
assert.equal(approvalPolicy.sha256(trustText), approvalPolicy.EXPECTED_TRUST_REGISTRY_SHA256);
assert.equal(approvalPolicy.exactUnprovisionedTrust(trust), true);
assert.equal(fs.existsSync(path.join(ROOT, approvalPolicy.APPROVAL_PATH)), false,
  'no self-attested approval artifact may be committed');
assert.equal(fs.existsSync(path.join(ROOT, approvalPolicy.SIGNATURE_BUNDLE_PATH)), false,
  'no signature bundle may be committed before real authorities sign it');

const mutations = [
  ['approval-missing', input => { input.approval = null; input.approval_text = null; }],
  ['approval-not-regular', input => { input.approval_file_regular = false; }],
  ['registry-missing', input => { input.trust_registry = null; input.trust_registry_text = null; }],
  ['registry-not-regular', input => { input.trust_registry_file_regular = false; }],
  ['bundle-missing', input => { input.signature_bundle = null; input.signature_bundle_text = null; }],
  ['bundle-not-regular', input => { input.signature_bundle_file_regular = false; }],
  ['registry-hash-unpinned', input => { input.expected_trust_registry_sha256 = '0'.repeat(64); }],
  ['private-key-material', (input, state) => {
    input.trust_registry.authorities[0].public_key_spki_pem = state.privateKeys[0].export({ type: 'pkcs8', format: 'pem' });
    refreshText(input, 'trust_registry');
  }],
  ['rsa-key', input => {
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    input.trust_registry.authorities[0].public_key_spki_pem = pair.publicKey.export({ type: 'spki', format: 'pem' });
    refreshText(input, 'trust_registry');
  }],
  ['malformed-key', input => {
    input.trust_registry.authorities[0].public_key_spki_pem = '-----BEGIN PUBLIC KEY-----\nmalformed\n-----END PUBLIC KEY-----\n';
    refreshText(input, 'trust_registry');
  }],
  ['key-id-mismatch', input => {
    input.trust_registry.authorities[0].key_id = 'ed25519:' + '0'.repeat(64);
    refreshText(input, 'trust_registry');
  }],
  ['false-registry-status', input => { input.trust_registry.status = 'unprovisioned'; refreshText(input, 'trust_registry'); }],
  ['expired-key', input => {
    input.trust_registry.authorities[0].valid_until = '2026-07-15T11:00:00.000Z';
    refreshText(input, 'trust_registry');
  }],
  ['revoked-key', input => {
    input.trust_registry.authorities[0].status = 'revoked';
    input.trust_registry.authorities[0].revoked_at = '2026-07-15T11:00:00.000Z';
    input.trust_registry.status = 'incomplete';
    refreshText(input, 'trust_registry');
  }],
  ['wrong-role-key', input => {
    input.trust_registry.authorities[0].role = 'licensing_counsel';
    refreshText(input, 'trust_registry');
  }],
  ['duplicate-key-id', input => {
    input.trust_registry.authorities[1].key_id = input.trust_registry.authorities[0].key_id;
    input.trust_registry.authorities[1].public_key_spki_pem = input.trust_registry.authorities[0].public_key_spki_pem;
    refreshText(input, 'trust_registry');
  }],
  ['signature-bitflip', input => {
    const bytes = Buffer.from(input.signature_bundle.signatures[0].signature_base64, 'base64');
    bytes[0] ^= 1;
    input.signature_bundle.signatures[0].signature_base64 = bytes.toString('base64');
    refreshText(input, 'signature_bundle');
  }],
  ['signature-noncanonical', input => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const current = input.signature_bundle.signatures[0].signature_base64;
    const chars = current.split('');
    const canonicalIndex = alphabet.indexOf(chars[85]);
    chars[85] = alphabet[canonicalIndex + 1];
    input.signature_bundle.signatures[0].signature_base64 = chars.join('');
    refreshText(input, 'signature_bundle');
  }],
  ['signature-wrong-length', input => {
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
  ['signature-role-duplicated', input => {
    input.signature_bundle.signatures[1] = clone(input.signature_bundle.signatures[0]);
    refreshText(input, 'signature_bundle');
  }],
  ['approval-mutated-after-signing', input => {
    input.approval.builder_identity = 'different-builder@earthloveunited.org';
    refreshText(input, 'approval');
  }],
  ['registry-mutated-after-signing', input => {
    input.trust_registry.authorities[0].valid_from = '2026-01-02T00:00:00.000Z';
    refreshText(input, 'trust_registry');
  }],
  ['approval-registry-binding-disagrees', input => {
    input.approval.authority_bindings.trust_registry_sha256 = '1'.repeat(64);
    refreshText(input, 'approval');
  }],
  ['approval-key-binding-disagrees', input => {
    input.approval.authority_bindings.key_ids.asset_rights_reviewer = input.approval.authority_bindings.key_ids.licensing_counsel;
    refreshText(input, 'approval');
  }],
  ['bundle-approval-hash-disagrees', input => {
    input.signature_bundle.approval_sha256 = '2'.repeat(64);
    refreshText(input, 'signature_bundle');
  }],
  ['bundle-registry-hash-disagrees', input => {
    input.signature_bundle.trust_registry_sha256 = '3'.repeat(64);
    refreshText(input, 'signature_bundle');
  }],
  ['bundle-commit-disagrees', input => {
    input.signature_bundle.reviewed_commit_sha = '4'.repeat(40);
    refreshText(input, 'signature_bundle');
  }],
  ['bundle-repository-disagrees', input => {
    input.signature_bundle.repository = 'attacker/example';
    refreshText(input, 'signature_bundle');
  }],
  ['authority-identity-disagrees', input => {
    input.approval.counsel_reviewer_identity = 'different-counsel@earthloveunited.org';
    refreshText(input, 'approval');
  }],
  ['builder-reuses-authority-identity', input => {
    input.approval.builder_identity = input.approval.reviewer_identity;
    refreshText(input, 'approval');
  }],
  ['reviewed-commit-paths-drifted', input => { input.reviewed_commit_binding_passed = false; }],
];

mutations.forEach(function (entry) { assertRejected(entry[0], entry[1]); });

process.stdout.write(
  'Globe runtime approval trust: PASS (ephemeral Ed25519 baseline; ' + mutations.length +
  ' fail-closed mutations; committed registry remains unprovisioned)\n'
);
