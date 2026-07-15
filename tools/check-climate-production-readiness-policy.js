#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { COUNSEL_QUESTION_IDS, evaluateReadiness, parseReadinessArgs, releaseWorktreeCleanPasses } = require('./lib/climate-production-readiness');
const { EXPECTED_ASSETS, EXPECTED_MANIFEST_SHA256, MANIFEST_PATH } = require('./lib/globe-runtime-assets');
const {
  APPROVAL_PATH,
  APPROVAL_SCHEMA_PATH,
  EXPECTED_ASSET_RIGHTS_ROWS,
  EXPECTED_INTEGRATION_SHA256,
  EXPECTED_MANIFEST_SHA256: EXPECTED_NOTICE_MANIFEST_SHA256,
  EXPECTED_NOTICE_SHA256,
  INTEGRATION_PATH,
  MANIFEST_PATH: NOTICE_MANIFEST_PATH,
  NOTICE_PATH,
} = require('./lib/globe-third-party-notices');
const approvalPolicy = require('./lib/globe-runtime-approval');

const REVIEWED_COMMIT = '1234567890abcdef1234567890abcdef12345678';
const REVIEWED_AT = '2026-07-15T12:00:00.000Z';
const REVIEWER = 'independent-reviewer@earthloveunited.org';
const COUNSEL_REVIEWER = 'licensing-counsel@earthloveunited.org';
const RELEASE_AUTHORIZER = 'release-authorizer@earthloveunited.org';
const EMPTY_TRUST_TEXT = fs.readFileSync(path.resolve(__dirname, '..', approvalPolicy.TRUST_REGISTRY_PATH), 'utf8');
const EMPTY_TRUST = JSON.parse(EMPTY_TRUST_TEXT);

function jsonText(value) { return JSON.stringify(value, null, 2) + '\n'; }

function makeSigningAuthorities() {
  const identities = {
    asset_rights_reviewer: REVIEWER,
    licensing_counsel: COUNSEL_REVIEWER,
    release_authorizer: RELEASE_AUTHORIZER,
  };
  const generated = approvalPolicy.REQUIRED_ROLES.map(role => {
    const pair = crypto.generateKeyPairSync('ed25519');
    const pem = pair.publicKey.export({ type: 'spki', format: 'pem' });
    const der = pair.publicKey.export({ type: 'spki', format: 'der' });
    return {
      privateKey: pair.privateKey,
      authority: {
        algorithm: 'Ed25519',
        identity: identities[role],
        key_id: 'ed25519:' + approvalPolicy.sha256(der),
        public_key_spki_pem: pem,
        revoked_at: null,
        role,
        status: 'active',
        valid_from: '2026-01-01T00:00:00.000Z',
        valid_until: '2027-01-01T00:00:00.000Z',
      },
    };
  });
  const registry = {
    schema_version: '1.0.0',
    registry_id: 'elu-globe-runtime-approval-trust-v1',
    status: 'provisioned',
    repository: approvalPolicy.REPOSITORY,
    required_roles: [...approvalPolicy.REQUIRED_ROLES],
    authorities: generated.map(item => item.authority),
  };
  const registryText = jsonText(registry);
  return {
    generated,
    registry,
    registryText,
    registrySha: approvalPolicy.sha256(registryText),
    keyIds: Object.fromEntries(registry.authorities.map(authority => [authority.role, authority.key_id])),
  };
}

const SIGNING = makeSigningAuthorities();
const exactPins = () => EXPECTED_ASSETS.map(asset => ({ path: asset.path, sha256: asset.sha256 }));
const unresolvedRights = () => EXPECTED_ASSET_RIGHTS_ROWS.map(row => ({
  ...row,
  origin_evidence: 'Pinned package provenance is present; authorized production rights review remains unresolved.',
  rights_review_status: 'not_reviewed',
  notice_disposition_status: 'not_reviewed',
  redistribution_decision: null,
  attribution_notice_obligation: null,
  reviewer_identity: null,
  reviewed_at: null,
  decision_reference: null,
  production_use_approved: false,
  release_authority: false,
}));
const approvedRights = () => EXPECTED_ASSET_RIGHTS_ROWS.map(row => ({
  asset_id: row.asset_id,
  path: row.path,
  sha256: row.sha256,
  source_asset_id: row.source_asset_id,
  source_path: row.source_path,
  source_type: row.source_type,
  source_url: row.source_url,
  source_origin_verified: true,
  origin_evidence: 'Authorized primary-source origin evidence was reviewed for ' + row.asset_id + '.',
  rights_holder_or_authority_basis: 'Authorized production redistribution basis was recorded for ' + row.asset_id + '.',
  rights_review_status: 'reviewed',
  notice_disposition_status: 'resolved',
  redistribution_decision: 'approved_for_redistribution',
  attribution_notice_obligation: 'The reviewed notice disposition is recorded for ' + row.asset_id + '.',
  reviewer_identity: REVIEWER,
  reviewed_at: REVIEWED_AT,
  decision_reference: 'rights-decision-' + row.asset_id,
  production_use_approved: true,
  release_authority: true,
}));
const counselResolutions = () => COUNSEL_QUESTION_IDS.map(questionId => ({
  question_id: questionId,
  resolved: true,
  resolution: 'Authorized counsel resolution recorded for the exact question ' + questionId + '.',
  reviewer_identity: COUNSEL_REVIEWER,
  reviewed_at: REVIEWED_AT,
  decision_reference: 'counsel-decision-' + questionId,
}));
const exactApproval = () => ({
  schema_version: '2.0.0',
  review_id: 'elu-globe-runtime-assets-production-review-v2',
  decision: 'approve',
  reviewed_commit_sha: REVIEWED_COMMIT,
  reviewed_at: REVIEWED_AT,
  builder_identity: 'release-builder@earthloveunited.org',
  reviewer_identity: REVIEWER,
  counsel_reviewer_identity: COUNSEL_REVIEWER,
  release_authority_identity: RELEASE_AUTHORIZER,
  authority_bindings: {
    key_ids: { ...SIGNING.keyIds },
    trust_registry_path: approvalPolicy.TRUST_REGISTRY_PATH,
    trust_registry_sha256: SIGNING.registrySha,
  },
  independent: true,
  runtime_asset_manifest: { path: MANIFEST_PATH, sha256: EXPECTED_MANIFEST_SHA256 },
  third_party_notice_inventory: {
    notice_path: NOTICE_PATH,
    notice_sha256: EXPECTED_NOTICE_SHA256,
    manifest_path: NOTICE_MANIFEST_PATH,
    manifest_sha256: EXPECTED_NOTICE_MANIFEST_SHA256,
    integration_path: INTEGRATION_PATH,
    integration_sha256: EXPECTED_INTEGRATION_SHA256,
    integrity_verified: true,
  },
  asset_rights_dispositions: approvedRights(),
  counsel_resolutions: counselResolutions(),
  rights_review_status: 'reviewed',
  third_party_notices_review_status: 'reviewed',
  production_use_approved: true,
  release_authority: true,
});
const candidateNoticeIntegration = () => ({
  integration_id: 'elu-globe-notices-integration-2026-07-15',
  status: 'implemented_unreviewed',
  approval_boundary: {
    review_status: 'not_reviewed',
    rights_review_status: 'not_reviewed',
    third_party_notices_review_status: 'not_reviewed',
    counsel_review_complete: false,
    production_use_approved: false,
    release_authority: false,
    approval_artifact_path: APPROVAL_PATH,
    approval_artifact_present: false,
    approval_schema_path: APPROVAL_SCHEMA_PATH,
    trust_registry_path: approvalPolicy.TRUST_REGISTRY_PATH,
    trust_registry_sha256: approvalPolicy.EXPECTED_TRUST_REGISTRY_SHA256,
    trust_registry_status: 'unprovisioned',
    signature_bundle_path: approvalPolicy.SIGNATURE_BUNDLE_PATH,
    signature_bundle_present: false,
    authority_model: 'detached_ed25519_role_signatures',
    integrity_is_not_approval: true,
  },
});

const candidate = {
  mode: 'candidate',
  data_review: { decision: 'pass', independent: true },
  ui_review: { decision: 'pass', independent: true },
  canonical_source_links_passed: true,
  public_copy_passed: true,
  load_order_passed: true,
  javascript_syntax_passed: true,
  ct40: { decision: 'deny', eligible: false, release_authority: false, reason_codes: ['evidence_insufficient'] },
  top20_queue: { coverage: { ranked_entities: 20, release_eligible_entities: 0 } },
  evidence_readiness: { status: 'blocked', release_authority: false, required_next_compiler: { status: 'not_implemented' } },
  artifacts: { runtime_manifest: false, release_diff: false, allow_manifest: false, rollback_proof: false },
  truth_ci: { status: 'incomplete', missing_required_components: ['reviewed-release-diff', 'reviewed-runtime-manifest'] },
  runtime_assets: {
    integrity_passed: true,
    manifest: { rights_review_status: 'not_reviewed', third_party_notices_review_status: 'not_reviewed', production_use_approved: false, release_authority: false },
    approval_review_present: false,
    approval_file_regular: false,
    approval: null,
    approval_text: null,
    manifest_sha256: EXPECTED_MANIFEST_SHA256,
    asset_pins: exactPins(),
    current_commit_sha: REVIEWED_COMMIT,
    reviewed_commit_binding_passed: false,
    notices_integrity_passed: true,
    trust_registry_file_regular: true,
    trust_registry: EMPTY_TRUST,
    trust_registry_text: EMPTY_TRUST_TEXT,
    signature_bundle_present: false,
    signature_bundle_file_regular: false,
    signature_bundle: null,
    signature_bundle_text: null,
    notice_integration: candidateNoticeIntegration(),
    asset_rights_dispositions: unresolvedRights(),
  },
};
const release = {
  mode: 'release',
  data_review: { decision: 'pass', independent: true },
  ui_review: { decision: 'pass', independent: true },
  canonical_source_links_passed: true,
  public_copy_passed: true,
  load_order_passed: true,
  javascript_syntax_passed: true,
  ct40: { decision: 'allow', eligible: true, release_authority: true, reason_codes: [] },
  top20_primary_source_review_complete: true,
  licence_decisions_complete: true,
  field_level_fact_reviews_complete: true,
  independent_release_review_passed: true,
  release_worktree_clean_passed: true,
  artifacts: { runtime_manifest: true, release_diff: true, allow_manifest: true, rollback_proof: true },
  truth_ci: { status: 'pass', missing_required_components: [] },
  runtime_assets: {
    integrity_passed: true,
    manifest: { rights_review_status: 'not_reviewed', third_party_notices_review_status: 'not_reviewed', production_use_approved: false, release_authority: false },
    approval_review_present: true,
    approval_file_regular: true,
    approval: exactApproval(),
    trust_registry_file_regular: true,
    trust_registry: SIGNING.registry,
    trust_registry_text: SIGNING.registryText,
    manifest_sha256: EXPECTED_MANIFEST_SHA256,
    asset_pins: exactPins(),
    current_commit_sha: REVIEWED_COMMIT,
    reviewed_commit_binding_passed: true,
    notices_integrity_passed: true,
  },
};

function attachSignedAuthority(input) {
  const approval = input.runtime_assets.approval;
  const approvalText = jsonText(approval);
  const approvalSha = approvalPolicy.sha256(approvalText);
  const signatures = approvalPolicy.REQUIRED_ROLES.map((role, index) => {
    const message = approvalPolicy.signatureMessage({
      repository: approvalPolicy.REPOSITORY,
      approval_path: approvalPolicy.APPROVAL_PATH,
      approval_sha256: approvalSha,
      trust_registry_path: approvalPolicy.TRUST_REGISTRY_PATH,
      trust_registry_sha256: SIGNING.registrySha,
      reviewed_commit_sha: REVIEWED_COMMIT,
      role,
    });
    return {
      key_id: SIGNING.keyIds[role],
      role,
      signature_base64: crypto.sign(null, Buffer.from(message, 'utf8'), SIGNING.generated[index].privateKey).toString('base64'),
    };
  });
  const bundle = {
    schema_version: '1.0.0',
    signature_bundle_id: 'elu-globe-runtime-assets-production-review-signatures-v1',
    repository: approvalPolicy.REPOSITORY,
    approval_path: approvalPolicy.APPROVAL_PATH,
    approval_sha256: approvalSha,
    trust_registry_path: approvalPolicy.TRUST_REGISTRY_PATH,
    trust_registry_sha256: SIGNING.registrySha,
    reviewed_commit_sha: REVIEWED_COMMIT,
    signatures,
  };
  input.runtime_assets.approval_text = approvalText;
  input.runtime_assets.signature_bundle_present = true;
  input.runtime_assets.signature_bundle_file_regular = true;
  input.runtime_assets.signature_bundle = bundle;
  input.runtime_assets.signature_bundle_text = jsonText(bundle);
}

attachSignedAuthority(release);

assert.equal(evaluateReadiness(candidate).status, 'candidate_integrity_ready_release_blocked');
const signedReleaseReport = evaluateReadiness(release, { expectedTrustRegistrySha256: SIGNING.registrySha });
assert.equal(signedReleaseReport.status, 'release_ready', signedReleaseReport.blockers.join(', '));

const candidateMutations = [
  input => { input.data_review.independent = false; },
  input => { input.ui_review.decision = 'deny'; },
  input => { input.canonical_source_links_passed = false; },
  input => { input.public_copy_passed = false; },
  input => { input.load_order_passed = false; },
  input => { input.javascript_syntax_passed = false; },
  input => { input.ct40.decision = 'allow'; },
  input => { input.ct40.reason_codes = []; },
  input => { input.top20_queue.coverage.ranked_entities = 19; },
  input => { input.top20_queue.coverage.release_eligible_entities = 1; },
  input => { input.evidence_readiness.release_authority = true; },
  input => { input.artifacts.runtime_manifest = true; },
  input => { input.artifacts.release_diff = true; },
  input => { input.artifacts.allow_manifest = true; },
  input => { input.truth_ci.status = 'pass'; },
  input => { input.truth_ci.missing_required_components.push('unexpected'); },
  input => { input.runtime_assets.integrity_passed = false; },
  input => { input.runtime_assets.manifest.production_use_approved = true; },
  input => { input.runtime_assets.approval_review_present = true; },
  input => { input.runtime_assets.notices_integrity_passed = false; },
  input => { input.runtime_assets.asset_rights_dispositions.pop(); },
  input => { input.runtime_assets.asset_rights_dispositions[0].production_use_approved = true; },
  input => { input.runtime_assets.notice_integration.approval_boundary.counsel_review_complete = true; },
  input => { input.runtime_assets.notice_integration.approval_boundary.approval_artifact_present = true; },
];
for (const mutate of candidateMutations) {
  const changed = structuredClone(candidate);
  mutate(changed);
  assert.equal(evaluateReadiness(changed).ready, false, 'candidate mutation bypassed readiness policy');
}

const releaseMutations = [
  input => { input.ct40.release_authority = false; },
  input => { input.top20_primary_source_review_complete = false; },
  input => { input.licence_decisions_complete = false; },
  input => { input.field_level_fact_reviews_complete = false; },
  input => { input.independent_release_review_passed = false; },
  input => { input.artifacts.runtime_manifest = false; },
  input => { input.artifacts.release_diff = false; },
  input => { input.artifacts.allow_manifest = false; },
  input => { input.artifacts.rollback_proof = false; },
  input => { input.truth_ci.status = 'incomplete'; },
  input => { input.truth_ci.missing_required_components = ['reviewed-release-diff']; },
  input => { input.release_worktree_clean_passed = false; },
  input => { input.runtime_assets.integrity_passed = false; },
  input => { input.runtime_assets.approval_review_present = false; },
  input => { input.runtime_assets.approval_file_regular = false; },
  input => { input.runtime_assets.approval.schema_version = '1.0.0'; },
  input => { input.runtime_assets.approval.review_id = 'invented-review'; },
  input => { input.runtime_assets.approval.decision = 'deny'; },
  input => { input.runtime_assets.approval.runtime_asset_manifest.path = 'assets/globe/runtime/other.json'; },
  input => { input.runtime_assets.approval.runtime_asset_manifest.sha256 = 'a'.repeat(64); },
  input => { input.runtime_assets.approval.runtime_asset_manifest.extra_claim = true; },
  input => { input.runtime_assets.manifest_sha256 = 'b'.repeat(64); },
  input => { input.runtime_assets.approval.third_party_notice_inventory.notice_sha256 = 'c'.repeat(64); },
  input => { input.runtime_assets.approval.third_party_notice_inventory.manifest_sha256 = 'd'.repeat(64); },
  input => { input.runtime_assets.approval.third_party_notice_inventory.integration_sha256 = 'e'.repeat(64); },
  input => { input.runtime_assets.approval.third_party_notice_inventory.integrity_verified = false; },
  input => { input.runtime_assets.approval.asset_rights_dispositions.pop(); },
  input => { input.runtime_assets.approval.asset_rights_dispositions.push({ asset_id: 'blanket-approval' }); },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].sha256 = 'f'.repeat(64); },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].source_url = 'https://invalid.example/asset'; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].source_origin_verified = false; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].origin_evidence = 'short'; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].rights_holder_or_authority_basis = 'unknown'; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].rights_review_status = 'not_reviewed'; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].notice_disposition_status = 'not_reviewed'; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].redistribution_decision = 'blanket_approved'; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].attribution_notice_obligation = ''; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].reviewer_identity = 'self'; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].reviewed_at = 'not-a-time'; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].decision_reference = 'fake'; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].production_use_approved = false; },
  input => { input.runtime_assets.approval.asset_rights_dispositions[0].release_authority = false; },
  input => { input.runtime_assets.asset_pins[0].sha256 = 'e'.repeat(64); },
  input => { input.runtime_assets.approval.reviewed_commit_sha = 'short'; },
  input => { input.runtime_assets.approval.reviewed_commit_sha = 'f'.repeat(40); input.runtime_assets.reviewed_commit_binding_passed = false; },
  input => { input.runtime_assets.reviewed_commit_binding_passed = false; },
  input => { input.runtime_assets.approval.reviewed_at = 'not-a-time'; },
  input => { input.runtime_assets.approval.builder_identity = 'fake'; },
  input => { input.runtime_assets.approval.reviewer_identity = 'self'; },
  input => { input.runtime_assets.approval.reviewer_identity = input.runtime_assets.approval.builder_identity; },
  input => { input.runtime_assets.approval.independent = false; },
  input => { input.runtime_assets.approval.rights_review_status = 'not_reviewed'; },
  input => { input.runtime_assets.approval.third_party_notices_review_status = 'not_reviewed'; },
  input => { input.runtime_assets.approval.production_use_approved = false; },
  input => { input.runtime_assets.approval.release_authority = false; },
  input => { input.runtime_assets.approval.counsel_resolutions.pop(); },
  input => { input.runtime_assets.approval.counsel_resolutions[0].question_id = 'blanket-counsel'; },
  input => { input.runtime_assets.approval.counsel_resolutions[0].resolved = false; },
  input => { input.runtime_assets.approval.counsel_resolutions[0].resolution = 'short'; },
  input => { input.runtime_assets.approval.counsel_resolutions[0].reviewer_identity = 'self'; },
  input => { input.runtime_assets.approval.counsel_resolutions[0].reviewed_at = 'not-a-time'; },
  input => { input.runtime_assets.approval.counsel_resolutions[0].decision_reference = 'fake'; },
  input => { input.runtime_assets.approval.extra_claim = true; },
  input => { input.runtime_assets.notices_integrity_passed = false; },
];
for (const mutate of releaseMutations) {
  const changed = structuredClone(release);
  mutate(changed);
  assert.equal(evaluateReadiness(changed, { expectedTrustRegistrySha256: SIGNING.registrySha }).ready, false,
    'release mutation bypassed readiness policy');
}

assert.throws(() => evaluateReadiness({ mode: 'preview' }), /mode must be candidate or release/);
assert.deepEqual(parseReadinessArgs(['--candidate']), { mode: 'candidate', jsonOnly: false });
assert.deepEqual(parseReadinessArgs(['--release', '--json']), { mode: 'release', jsonOnly: true });
assert.throws(() => parseReadinessArgs([]), /exactly one/);
assert.throws(() => parseReadinessArgs(['--candidate', '--release']), /exactly one/);
assert.throws(() => parseReadinessArgs(['--releas']), /unknown readiness argument/);
assert.throws(() => parseReadinessArgs(['--release', '--release']), /exactly one/);

function runGit(root, args) {
  const result = childProcess.spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
}

function checkReleaseWorktreeBehavior() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-readiness-worktree-'));
  const noRepository = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-readiness-no-git-'));
  let cases = 0;
  try {
    runGit(root, ['init', '--quiet']);
    fs.writeFileSync(path.join(root, '.gitignore'), '_deploy/\njs/vendor/\n');
    fs.writeFileSync(path.join(root, 'tracked.txt'), 'reviewed\n');
    runGit(root, ['add', '.gitignore', 'tracked.txt']);
    runGit(root, ['-c', 'user.name=Readiness Fixture', '-c', 'user.email=readiness@invalid.example', 'commit', '--quiet', '-m', 'fixture']);

    assert.equal(releaseWorktreeCleanPasses(root), true, 'clean reviewed checkout must pass');
    cases += 1;
    fs.mkdirSync(path.join(root, '_deploy'));
    fs.writeFileSync(path.join(root, '_deploy', 'ignored.txt'), 'local candidate');
    assert.equal(releaseWorktreeCleanPasses(root), true, 'ignored candidate output must not block release cleanliness');
    cases += 1;

    fs.writeFileSync(path.join(root, 'tracked.txt'), 'unstaged drift\n');
    assert.equal(releaseWorktreeCleanPasses(root), false, 'unstaged tracked drift must block release');
    cases += 1;
    fs.writeFileSync(path.join(root, 'tracked.txt'), 'staged drift\n');
    runGit(root, ['add', 'tracked.txt']);
    assert.equal(releaseWorktreeCleanPasses(root), false, 'staged tracked drift must block release');
    cases += 1;
    runGit(root, ['-c', 'user.name=Readiness Fixture', '-c', 'user.email=readiness@invalid.example', 'commit', '--quiet', '-m', 'staged fixture']);

    fs.writeFileSync(path.join(root, 'untracked.txt'), 'unreviewed\n');
    assert.equal(releaseWorktreeCleanPasses(root), false, 'untracked non-ignored files must block release');
    cases += 1;
    assert.equal(releaseWorktreeCleanPasses(noRepository), false, 'missing or unusable Git metadata must block release');
    cases += 1;
    return cases;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(noRepository, { recursive: true, force: true });
  }
}

const worktreeBehaviorCases = checkReleaseWorktreeBehavior();
process.stdout.write(`Climate production readiness policy: PASS (${candidateMutations.length + releaseMutations.length + 7} fail-closed cases; ${worktreeBehaviorCases} executable worktree cases)\n`);
