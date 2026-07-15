'use strict';

const childProcess = require('node:child_process');

const {
  EXPECTED_ASSETS,
  EXPECTED_MANIFEST_SHA256,
  MANIFEST_PATH,
} = require('./globe-runtime-assets');

const CANDIDATE_MISSING = Object.freeze([
  'reviewed-release-diff',
  'reviewed-runtime-manifest',
]);
const RUNTIME_ASSET_REVIEW_ID = 'elu-globe-runtime-assets-production-review-v1';
const RUNTIME_ASSET_REVIEW_KEYS = Object.freeze([
  'assets',
  'builder_identity',
  'decision',
  'independent',
  'manifest_path',
  'manifest_sha256',
  'production_use_approved',
  'release_authority',
  'review_id',
  'reviewed_at',
  'reviewed_commit_sha',
  'reviewer_identity',
  'rights_review_status',
  'schema_version',
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

function exactRuntimeAssetApproval(runtimeAssets) {
  const approval = runtimeAssets?.approval;
  if (!runtimeAssets?.approval_review_present || runtimeAssets?.approval_file_regular !== true || !approval) return false;
  const timestamp = typeof approval.reviewed_at === 'string' ? new Date(approval.reviewed_at) : null;
  const timestampValid = timestamp && !Number.isNaN(timestamp.getTime()) && timestamp.toISOString() === approval.reviewed_at;
  return JSON.stringify(Object.keys(approval).sort()) === JSON.stringify(RUNTIME_ASSET_REVIEW_KEYS) &&
    approval.schema_version === '1.0.0' && approval.review_id === RUNTIME_ASSET_REVIEW_ID &&
    approval.decision === 'approve' && approval.manifest_path === MANIFEST_PATH &&
    approval.manifest_sha256 === EXPECTED_MANIFEST_SHA256 &&
    runtimeAssets.manifest_sha256 === EXPECTED_MANIFEST_SHA256 &&
    exactAssetPins(approval.assets) && exactAssetPins(runtimeAssets.asset_pins) &&
    typeof approval.reviewed_commit_sha === 'string' && /^[0-9a-f]{40}$/.test(approval.reviewed_commit_sha) &&
    runtimeAssets.reviewed_commit_binding_passed === true && timestampValid &&
    validReviewIdentity(approval.builder_identity) && validReviewIdentity(approval.reviewer_identity) &&
    approval.builder_identity !== approval.reviewer_identity && approval.independent === true &&
    approval.rights_review_status === 'reviewed' && approval.production_use_approved === true &&
    approval.release_authority === true;
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

function evaluateReadiness(input) {
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

  if (input.mode === 'candidate') {
    const coverage = input.top20_queue?.coverage || {};
    const missing = [...(truthCi.missing_required_components || [])].sort();
    check('real-ct40-deny', ct40.decision === 'deny' && ct40.eligible === false && ct40.release_authority === false,
      'The current real CT-40 result must remain a non-authoritative DENY.');
    check('deny-reasons-present', Array.isArray(ct40.reason_codes) && ct40.reason_codes.length > 0,
      'A denied candidate must disclose canonical reason codes.');
    check('top20-queue-fail-closed', coverage.ranked_entities === 20 && coverage.release_eligible_entities === 0,
      'The top-20 acquisition queue must cover 20 entities and authorize none.');
    check('evidence-plan-fail-closed', input.evidence_readiness?.status === 'blocked' && input.evidence_readiness?.release_authority === false && input.evidence_readiness?.required_next_compiler?.status === 'not_implemented',
      'The evidence work package must remain blocked and require a new reviewed production-candidate compiler.');
    check('release-artifacts-absent', !artifacts.runtime_manifest && !artifacts.release_diff && !artifacts.allow_manifest,
      'Runtime manifest, reviewed release diff, and CT-40 allow manifest must be absent while denied.');
    check('truth-ci-incomplete-only', truthCi.status === 'incomplete' && JSON.stringify(missing) === JSON.stringify(CANDIDATE_MISSING),
      'Candidate CI may be incomplete only for the reviewed runtime manifest and release diff.');
    check('runtime-assets-candidate-release-blocked', runtimeAssets.manifest?.rights_review_status === 'not_reviewed' &&
      runtimeAssets.manifest?.third_party_notices_review_status === 'not_reviewed' &&
      runtimeAssets.manifest?.production_use_approved === false && runtimeAssets.manifest?.release_authority === false &&
      runtimeAssets.approval_review_present === false && runtimeAssets.notices_integrity_passed !== true,
      'Candidate integrity may pass only while runtime-asset rights/notices, production use, and release authority remain explicitly blocked.');
  } else {
    check('real-ct40-allow', ct40.decision === 'allow' && ct40.eligible === true && ct40.release_authority === true,
      'Release requires an authentic, independently reviewed CT-40 ALLOW.');
    check('top20-primary-review-complete', input.top20_primary_source_review_complete === true,
      'All required top-20 primary-source reviews must be complete.');
    check('licence-decisions-complete', input.licence_decisions_complete === true,
      'Explicit redistribution and scoring licence decisions must be complete.');
    check('field-reviews-complete', input.field_level_fact_reviews_complete === true,
      'Required field-level fact reviews must be complete.');
    check('independent-release-review', input.independent_release_review_passed === true,
      'An independent CT-40 release review must pass.');
    check('reviewed-release-artifacts', artifacts.runtime_manifest === true && artifacts.release_diff === true && artifacts.allow_manifest === true,
      'Reviewed runtime manifest, release diff, and CT-40 allow manifest must exist.');
    check('rollback-proof', artifacts.rollback_proof === true,
      'A reviewed executable rollback proof must exist.');
    check('strict-truth-ci', truthCi.status === 'pass' && (truthCi.missing_required_components || []).length === 0,
      'Strict climate truth CI must pass with no missing components.');
    check('release-worktree-clean', input.release_worktree_clean_passed === true,
      'Release staging requires a usable Git checkout with no tracked, staged, or untracked non-ignored changes.');
    check('runtime-asset-exact-independent-approval', exactRuntimeAssetApproval(runtimeAssets),
      'Release requires a regular-file, exact-manifest/exact-five-digest approval tied to this commit, with distinct non-placeholder builder and independent reviewer identities.');
    check('runtime-asset-notices-integrity', runtimeAssets.notices_integrity_passed === true,
      'Release remains blocked until the separate exact notice inventory and staged notice verification pass; a review boolean is not proof.');
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
  evaluateReadiness,
  exactAssetPins,
  exactRuntimeAssetApproval,
  parseReadinessArgs,
  releaseWorktreeCleanPasses,
  validReviewIdentity,
};
