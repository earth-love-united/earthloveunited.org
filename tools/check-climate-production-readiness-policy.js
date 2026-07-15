#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { evaluateReadiness, parseReadinessArgs, releaseWorktreeCleanPasses } = require('./lib/climate-production-readiness');
const { EXPECTED_ASSETS, EXPECTED_MANIFEST_SHA256, MANIFEST_PATH } = require('./lib/globe-runtime-assets');

const REVIEWED_COMMIT = '1234567890abcdef1234567890abcdef12345678';
const exactPins = () => EXPECTED_ASSETS.map(asset => ({ path: asset.path, sha256: asset.sha256 }));
const exactApproval = () => ({
  schema_version: '1.0.0',
  review_id: 'elu-globe-runtime-assets-production-review-v1',
  decision: 'approve',
  manifest_path: MANIFEST_PATH,
  manifest_sha256: EXPECTED_MANIFEST_SHA256,
  assets: exactPins(),
  reviewed_commit_sha: REVIEWED_COMMIT,
  reviewed_at: '2026-07-15T12:00:00.000Z',
  builder_identity: 'release-builder@earthloveunited.org',
  reviewer_identity: 'independent-reviewer@earthloveunited.org',
  independent: true,
  rights_review_status: 'reviewed',
  production_use_approved: true,
  release_authority: true,
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
    manifest_sha256: EXPECTED_MANIFEST_SHA256,
    asset_pins: exactPins(),
    current_commit_sha: REVIEWED_COMMIT,
    reviewed_commit_binding_passed: false,
    notices_integrity_passed: false,
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
    manifest_sha256: EXPECTED_MANIFEST_SHA256,
    asset_pins: exactPins(),
    current_commit_sha: REVIEWED_COMMIT,
    reviewed_commit_binding_passed: true,
    notices_integrity_passed: true,
  },
};

assert.equal(evaluateReadiness(candidate).status, 'candidate_integrity_ready_release_blocked');
assert.equal(evaluateReadiness(release).status, 'release_ready');

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
  input => { input.runtime_assets.notices_integrity_passed = true; },
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
  input => { input.runtime_assets.approval.schema_version = '2.0.0'; },
  input => { input.runtime_assets.approval.review_id = 'invented-review'; },
  input => { input.runtime_assets.approval.decision = 'deny'; },
  input => { input.runtime_assets.approval.manifest_path = 'assets/globe/runtime/other.json'; },
  input => { input.runtime_assets.approval.manifest_sha256 = 'a'.repeat(64); },
  input => { input.runtime_assets.manifest_sha256 = 'b'.repeat(64); },
  input => { input.runtime_assets.approval.assets.pop(); },
  input => { input.runtime_assets.approval.assets.push({ path: 'extra', sha256: 'c'.repeat(64) }); },
  input => { input.runtime_assets.approval.assets[0].sha256 = 'd'.repeat(64); },
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
  input => { input.runtime_assets.approval.production_use_approved = false; },
  input => { input.runtime_assets.approval.release_authority = false; },
  input => { input.runtime_assets.approval.extra_claim = true; },
  input => { input.runtime_assets.notices_integrity_passed = false; },
];
for (const mutate of releaseMutations) {
  const changed = structuredClone(release);
  mutate(changed);
  assert.equal(evaluateReadiness(changed).ready, false, 'release mutation bypassed readiness policy');
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
