'use strict';

const childProcess = require('node:child_process');

const {
  EXPECTED_ASSETS,
  EXPECTED_MANIFEST_SHA256,
  MANIFEST_PATH,
} = require('./globe-runtime-assets');
const {
  APPROVAL_PATH: RUNTIME_ASSET_APPROVAL_PATH,
  APPROVAL_SCHEMA_PATH: RUNTIME_ASSET_APPROVAL_SCHEMA_PATH,
  EXPECTED_ASSET_RIGHTS_ROWS,
  EXPECTED_INTEGRATION_SHA256,
  EXPECTED_MANIFEST_SHA256: EXPECTED_NOTICE_MANIFEST_SHA256,
  EXPECTED_NOTICE_SHA256,
  INTEGRATION_PATH: NOTICE_INTEGRATION_PATH,
  MANIFEST_PATH: NOTICE_MANIFEST_PATH,
  NOTICE_PATH,
  exactUnresolvedAssetRights,
} = require('./globe-third-party-notices');
const {
  EXPECTED_TRUST_REGISTRY_SHA256,
  SIGNATURE_BUNDLE_PATH: RUNTIME_ASSET_SIGNATURE_BUNDLE_PATH,
  TRUST_REGISTRY_PATH: RUNTIME_ASSET_TRUST_REGISTRY_PATH,
  evaluateApprovalAuthority,
  exactUnprovisionedTrust,
  sha256,
} = require('./globe-runtime-approval');

const CANDIDATE_MISSING = Object.freeze([
  'reviewed-release-diff',
  'reviewed-runtime-manifest',
]);
const RUNTIME_ASSET_REVIEW_ID = 'elu-globe-runtime-assets-production-review-v2';
const RUNTIME_ASSET_REVIEW_KEYS = Object.freeze([
  'asset_rights_dispositions',
  'authority_bindings',
  'builder_identity',
  'counsel_resolutions',
  'counsel_reviewer_identity',
  'decision',
  'independent',
  'production_use_approved',
  'release_authority',
  'release_authority_identity',
  'review_id',
  'reviewed_at',
  'reviewed_commit_sha',
  'reviewer_identity',
  'rights_review_status',
  'runtime_asset_manifest',
  'schema_version',
  'third_party_notice_inventory',
  'third_party_notices_review_status',
]);

const ASSET_RIGHTS_REVIEW_KEYS = Object.freeze([
  'asset_id',
  'attribution_notice_obligation',
  'decision_reference',
  'notice_disposition_status',
  'origin_evidence',
  'path',
  'production_use_approved',
  'redistribution_decision',
  'release_authority',
  'reviewed_at',
  'reviewer_identity',
  'rights_holder_or_authority_basis',
  'rights_review_status',
  'sha256',
  'source_asset_id',
  'source_origin_verified',
  'source_path',
  'source_type',
  'source_url',
]);

const COUNSEL_QUESTION_IDS = Object.freeze([
  'helvetiker-mgopen',
  'unlicense-jurisdiction',
  'emscripten-musl-runtime',
  'h3-notice-scope',
]);

const COUNSEL_RESOLUTION_KEYS = Object.freeze([
  'decision_reference',
  'question_id',
  'resolution',
  'resolved',
  'reviewed_at',
  'reviewer_identity',
]);

const NOTICE_INVENTORY_KEYS = Object.freeze([
  'integration_path',
  'integration_sha256',
  'integrity_verified',
  'manifest_path',
  'manifest_sha256',
  'notice_path',
  'notice_sha256',
]);

function validReviewIdentity(value) {
  return typeof value === 'string' && value.trim() === value && value.length >= 5 &&
    !/(?:^|[\s@._-])(fake|self|invented|unknown|example|placeholder|test|tbd|todo)(?:$|[\s@._-])/i.test(value);
}

function exactAssetPins(value) {
  if (!Array.isArray(value) || value.length !== EXPECTED_ASSETS.length) return false;
  const expected = EXPECTED_ASSETS.map(asset => ({ path: asset.path, sha256: asset.sha256 }));
  return value.every((item, index) => item &&
    JSON.stringify(Object.keys(item).sort()) === JSON.stringify(['path', 'sha256']) &&
    item.path === expected[index].path && item.sha256 === expected[index].sha256);
}

function exactKeys(value, expected) {
  return Boolean(value) && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected);
}

function validTimestamp(value) {
  const timestamp = typeof value === 'string' ? new Date(value) : null;
  return Boolean(timestamp) && !Number.isNaN(timestamp.getTime()) && timestamp.toISOString() === value;
}

function validDecisionText(value, minimum = 5) {
  return typeof value === 'string' && value.trim() === value && value.length >= minimum &&
    !/(?:^|[\s@._-])(fake|invented|unknown|example|placeholder|test|tbd|todo)(?:$|[\s@._-])/i.test(value);
}

function exactApprovedAssetRights(rows, approval) {
  if (!Array.isArray(rows) || rows.length !== EXPECTED_ASSET_RIGHTS_ROWS.length) return false;
  return rows.every((row, index) => {
    const expected = EXPECTED_ASSET_RIGHTS_ROWS[index];
    return exactKeys(row, ASSET_RIGHTS_REVIEW_KEYS) &&
      ['asset_id', 'path', 'sha256', 'source_asset_id', 'source_path', 'source_type', 'source_url']
        .every(key => row[key] === expected[key]) &&
      row.source_origin_verified === true &&
      validDecisionText(row.origin_evidence, 20) &&
      validDecisionText(row.rights_holder_or_authority_basis, 20) &&
      row.rights_review_status === 'reviewed' &&
      row.notice_disposition_status === 'resolved' &&
      row.redistribution_decision === 'approved_for_redistribution' &&
      validDecisionText(row.attribution_notice_obligation, 1) &&
      validReviewIdentity(row.reviewer_identity) && row.reviewer_identity === approval.reviewer_identity &&
      validTimestamp(row.reviewed_at) && validDecisionText(row.decision_reference) &&
      row.production_use_approved === true && row.release_authority === true;
  });
}

function exactCounselResolutions(rows, approval) {
  if (!Array.isArray(rows) || rows.length !== COUNSEL_QUESTION_IDS.length) return false;
  return rows.every((row, index) => exactKeys(row, COUNSEL_RESOLUTION_KEYS) &&
    row.question_id === COUNSEL_QUESTION_IDS[index] && row.resolved === true &&
    validDecisionText(row.resolution, 20) &&
    validReviewIdentity(row.reviewer_identity) && row.reviewer_identity === approval.counsel_reviewer_identity &&
    validTimestamp(row.reviewed_at) && validDecisionText(row.decision_reference));
}

function exactCandidateNoticeBoundary(runtimeAssets) {
  const integration = runtimeAssets?.notice_integration || {};
  const boundary = integration.approval_boundary || {};
  return integration.integration_id === 'elu-globe-notices-integration-2026-07-15' &&
    integration.status === 'implemented_unreviewed' &&
    exactUnresolvedAssetRights(runtimeAssets.asset_rights_dispositions) &&
    boundary.review_status === 'not_reviewed' &&
    boundary.rights_review_status === 'not_reviewed' &&
    boundary.third_party_notices_review_status === 'not_reviewed' &&
    boundary.counsel_review_complete === false &&
    boundary.production_use_approved === false && boundary.release_authority === false &&
    boundary.approval_artifact_path === RUNTIME_ASSET_APPROVAL_PATH &&
    boundary.approval_artifact_present === false &&
    boundary.approval_schema_path === RUNTIME_ASSET_APPROVAL_SCHEMA_PATH &&
    boundary.trust_registry_path === RUNTIME_ASSET_TRUST_REGISTRY_PATH &&
    boundary.trust_registry_sha256 === EXPECTED_TRUST_REGISTRY_SHA256 &&
    boundary.trust_registry_status === 'unprovisioned' &&
    boundary.signature_bundle_path === RUNTIME_ASSET_SIGNATURE_BUNDLE_PATH &&
    boundary.signature_bundle_present === false &&
    boundary.authority_model === 'detached_ed25519_role_signatures' &&
    boundary.integrity_is_not_approval === true;
}

function exactRuntimeAssetApproval(runtimeAssets, expectedTrustRegistrySha256 = EXPECTED_TRUST_REGISTRY_SHA256) {
  const approval = runtimeAssets?.approval;
  if (!runtimeAssets?.approval_review_present || runtimeAssets?.approval_file_regular !== true || !approval) return false;
  const runtimeManifest = approval.runtime_asset_manifest;
  const noticeInventory = approval.third_party_notice_inventory;
  const authorityReport = evaluateApprovalAuthority({
    approval,
    approval_text: runtimeAssets.approval_text,
    approval_file_regular: runtimeAssets.approval_file_regular,
    trust_registry: runtimeAssets.trust_registry,
    trust_registry_text: runtimeAssets.trust_registry_text,
    trust_registry_file_regular: runtimeAssets.trust_registry_file_regular,
    expected_trust_registry_sha256: expectedTrustRegistrySha256,
    signature_bundle: runtimeAssets.signature_bundle,
    signature_bundle_text: runtimeAssets.signature_bundle_text,
    signature_bundle_file_regular: runtimeAssets.signature_bundle_file_regular,
    reviewed_commit_binding_passed: runtimeAssets.reviewed_commit_binding_passed,
  });
  return authorityReport.status === 'pass' && runtimeAssets.reviewed_release_passed === true &&
    exactKeys(approval, RUNTIME_ASSET_REVIEW_KEYS) &&
    approval.schema_version === '2.0.0' && approval.review_id === RUNTIME_ASSET_REVIEW_ID &&
    approval.decision === 'approve' && exactKeys(runtimeManifest, ['path', 'sha256']) &&
    runtimeManifest.path === MANIFEST_PATH && runtimeManifest.sha256 === EXPECTED_MANIFEST_SHA256 &&
    exactKeys(noticeInventory, NOTICE_INVENTORY_KEYS) &&
    noticeInventory.notice_path === NOTICE_PATH && noticeInventory.notice_sha256 === EXPECTED_NOTICE_SHA256 &&
    noticeInventory.manifest_path === NOTICE_MANIFEST_PATH &&
    noticeInventory.manifest_sha256 === EXPECTED_NOTICE_MANIFEST_SHA256 &&
    noticeInventory.integration_path === NOTICE_INTEGRATION_PATH &&
    noticeInventory.integration_sha256 === EXPECTED_INTEGRATION_SHA256 &&
    noticeInventory.integrity_verified === true && runtimeAssets.notices_integrity_passed === true &&
    runtimeAssets.manifest_sha256 === EXPECTED_MANIFEST_SHA256 &&
    exactAssetPins(runtimeAssets.asset_pins) && exactApprovedAssetRights(approval.asset_rights_dispositions, approval) &&
    exactCounselResolutions(approval.counsel_resolutions, approval) &&
    typeof approval.reviewed_commit_sha === 'string' && /^[0-9a-f]{40}$/.test(approval.reviewed_commit_sha) &&
    runtimeAssets.reviewed_commit_binding_passed === true && validTimestamp(approval.reviewed_at) &&
    validReviewIdentity(approval.builder_identity) && validReviewIdentity(approval.reviewer_identity) &&
    validReviewIdentity(approval.counsel_reviewer_identity) && validReviewIdentity(approval.release_authority_identity) &&
    new Set([approval.builder_identity, approval.reviewer_identity, approval.counsel_reviewer_identity,
      approval.release_authority_identity]).size === 4 && approval.independent === true &&
    approval.rights_review_status === 'reviewed' && approval.production_use_approved === true &&
    approval.third_party_notices_review_status === 'reviewed' && approval.release_authority === true;
}

function parseReadinessArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const unknown = args.filter(arg => !['--candidate', '--release', '--json'].includes(arg));
  if (unknown.length) throw new Error(`unknown readiness argument: ${unknown[0]}`);
  const modes = args.filter(arg => arg === '--candidate' || arg === '--release');
  if (modes.length !== 1) throw new Error('exactly one of --candidate or --release is required');
  return { mode: modes[0].slice(2), jsonOnly: args.includes('--json') };
}

function releaseWorktreeCleanPasses(root, spawnSync = childProcess.spawnSync) {
  if (typeof root !== 'string' || !root) return false;
  const options = { cwd: root, encoding: 'utf8' };
  const tracked = spawnSync('git', ['diff', '--quiet', 'HEAD', '--', '.'], options);
  if (tracked.error || tracked.status !== 0) return false;
  const untracked = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], options);
  return !untracked.error && untracked.status === 0 && typeof untracked.stdout === 'string' && untracked.stdout.length === 0;
}

function evaluateReadiness(input, options = {}) {
  if (!input || !['candidate', 'release'].includes(input.mode)) {
    throw new Error('mode must be candidate or release');
  }

  const checks = [];
  const check = (id, pass, detail) => checks.push({ id, pass: pass === true, detail });
  const dataReview = input.data_review || {};
  const uiReview = input.ui_review || {};
  const ct40 = input.ct40 || {};
  const artifacts = input.artifacts || {};
  const truthCi = input.truth_ci || {};
  const runtimeAssets = input.runtime_assets || {};
  const reviewedRelease = input.reviewed_release || {};
  const expectedTrustRegistrySha256 = options.expectedTrustRegistrySha256 || EXPECTED_TRUST_REGISTRY_SHA256;

  check('independent-data-review', dataReview.decision === 'pass' && dataReview.independent === true,
    'CT-42 data review must pass and remain independent.');
  check('independent-ui-review', uiReview.decision === 'pass' && uiReview.independent === true,
    'CT-42 UI review must pass and remain independent.');
  check('canonical-source-links', input.canonical_source_links_passed === true,
    'Public source links must point to the canonical organization repository.');
  check('public-copy', input.public_copy_passed === true,
    'Public climate copy checks must pass.');
  check('load-order', input.load_order_passed === true,
    'The classic-script load-order DAG must pass.');
  check('javascript-syntax', input.javascript_syntax_passed === true,
    'All active JavaScript outside vendor directories must parse.');
  check('ct45-runtime-asset-integrity', runtimeAssets.integrity_passed === true,
    'CT-45 localized runtime-asset integrity must pass in every mode.');
  check('ct45-notice-integrity', runtimeAssets.notices_integrity_passed === true,
    'Exact source and staged third-party notice integrity must pass in every mode; integrity grants no rights approval.');
  check('approval-trust-registry-integrity', runtimeAssets.trust_registry_file_regular === true &&
    typeof runtimeAssets.trust_registry_text === 'string' &&
    sha256(runtimeAssets.trust_registry_text) === expectedTrustRegistrySha256,
    'The protected approval trust registry must be a regular file with the policy-pinned exact hash.');

  if (input.mode === 'candidate') {
    const coverage = input.top20_queue?.coverage || {};
    const missing = [...(truthCi.missing_required_components || [])].sort();
    check('real-ct40-deny', ct40.decision === 'deny' && ct40.eligible === false &&
      ct40.content_eligible === false && ct40.release_authority === false,
      'The current real CT-40 result must remain a non-authoritative DENY.');
    check('deny-reasons-present', Array.isArray(ct40.reason_codes) && ct40.reason_codes.length > 0,
      'A denied candidate must disclose canonical reason codes.');
    check('top20-queue-fail-closed', coverage.ranked_entities === 20 && coverage.release_eligible_entities === 0,
      'The top-20 acquisition queue must cover 20 entities and authorize none.');
    check('evidence-plan-fail-closed', input.evidence_readiness?.status === 'blocked' && input.evidence_readiness?.release_authority === false && input.evidence_readiness?.required_next_compiler?.status === 'not_implemented',
      'The evidence work package must remain blocked and require a new reviewed production-candidate compiler.');
    check('release-artifacts-absent', !artifacts.runtime_manifest && !artifacts.release_input && !artifacts.release_diff &&
      !artifacts.allow_manifest && !artifacts.rollback_proof && reviewedRelease.status === 'absent' && reviewedRelease.pass === true,
      'Runtime manifest, CT-40 reviewed input/ALLOW, release diff, and production rollback proof must all remain absent while denied.');
    check('truth-ci-incomplete-only', truthCi.status === 'incomplete' && JSON.stringify(missing) === JSON.stringify(CANDIDATE_MISSING),
      'Candidate CI may be incomplete only for the reviewed runtime manifest and release diff.');
    check('runtime-assets-candidate-release-blocked', runtimeAssets.manifest?.rights_review_status === 'not_reviewed' &&
      runtimeAssets.manifest?.third_party_notices_review_status === 'not_reviewed' &&
      runtimeAssets.manifest?.production_use_approved === false && runtimeAssets.manifest?.release_authority === false &&
      runtimeAssets.approval_review_present === false && runtimeAssets.approval_file_regular === false &&
      runtimeAssets.approval === null && runtimeAssets.approval_text === null &&
      runtimeAssets.signature_bundle_present === false && runtimeAssets.signature_bundle_file_regular === false &&
      runtimeAssets.signature_bundle === null && runtimeAssets.signature_bundle_text === null &&
      exactUnprovisionedTrust(runtimeAssets.trust_registry) && exactCandidateNoticeBoundary(runtimeAssets),
      'Candidate integrity may pass only with exact notice bytes while all five asset rights decisions, counsel questions, production use, and release authority remain explicitly blocked.');
  } else {
    check('real-ct40-allow', reviewedRelease.status === 'validated' && reviewedRelease.pass === true &&
      ct40.decision === 'allow' && ct40.eligible === true && ct40.content_eligible === true &&
      ct40.release_authority === false,
      'Release requires an authentic, independently reviewed CT-40 ALLOW that grants content eligibility only.');
    check('canonical-reviewed-release-package', reviewedRelease.status === 'validated' && reviewedRelease.pass === true &&
      reviewedRelease.content_eligible === true && reviewedRelease.release_authority === false,
      'The shared release-package validator must recompute CT-40, schemas, artifact pins, release diff, and rollback proof.');
    check('top20-primary-review-complete', input.top20_primary_source_review_complete === true,
      'All required top-20 primary-source reviews must be complete.');
    check('licence-decisions-complete', input.licence_decisions_complete === true,
      'Explicit redistribution and scoring licence decisions must be complete.');
    check('field-reviews-complete', input.field_level_fact_reviews_complete === true,
      'Required field-level fact reviews must be complete.');
    check('independent-release-review', input.independent_release_review_passed === true,
      'An independent CT-40 release review must pass.');
    check('reviewed-release-artifacts', artifacts.runtime_manifest === true && artifacts.release_input === true &&
      artifacts.release_diff === true && artifacts.allow_manifest === true && artifacts.rollback_proof === true,
      'Reviewed runtime manifest, CT-40 input/ALLOW, release diff, and rollback proof must exist as regular validated files.');
    check('rollback-proof', reviewedRelease.rollback_proof_passed === true,
      'The canonical reviewed rollback proof must apply successfully and restore exact pinned baseline bytes.');
    check('strict-truth-ci', truthCi.status === 'pass' && (truthCi.missing_required_components || []).length === 0,
      'Strict climate truth CI must pass with no missing components.');
    check('release-worktree-clean', input.release_worktree_clean_passed === true,
      'Release staging requires a usable Git checkout with no tracked, staged, or untracked non-ignored changes.');
    check('runtime-approval-trust-registry-provisioned', runtimeAssets.trust_registry?.status === 'provisioned',
      'Release requires a protected trust registry provisioned with an active Ed25519 authority for every required role.');
    check('runtime-approval-signature-bundle-present', runtimeAssets.signature_bundle_present === true &&
      runtimeAssets.signature_bundle_file_regular === true,
      'Release requires the detached approval signature bundle as a regular non-symlink file.');
    check('runtime-asset-exact-independent-approval',
      exactRuntimeAssetApproval(runtimeAssets, options.expectedTrustRegistrySha256 || EXPECTED_TRUST_REGISTRY_SHA256),
      'Release requires an exact commit-bound approval with verified, distinct Ed25519 signatures for asset rights, counsel, and release authority.');
  }

  const failures = checks.filter(item => !item.pass);
  return {
    schema_version: '1.0.0',
    mode: input.mode,
    status: failures.length === 0
      ? input.mode === 'candidate' ? 'candidate_integrity_ready_release_blocked' : 'release_ready'
      : 'blocked',
    ready: failures.length === 0,
    checks,
    blockers: failures.map(item => item.id),
  };
}

module.exports = {
  CANDIDATE_MISSING,
  RUNTIME_ASSET_REVIEW_ID,
  RUNTIME_ASSET_REVIEW_KEYS,
  COUNSEL_QUESTION_IDS,
  evaluateReadiness,
  exactApprovedAssetRights,
  exactAssetPins,
  exactCandidateNoticeBoundary,
  exactCounselResolutions,
  exactRuntimeAssetApproval,
  parseReadinessArgs,
  releaseWorktreeCleanPasses,
  validReviewIdentity,
};
