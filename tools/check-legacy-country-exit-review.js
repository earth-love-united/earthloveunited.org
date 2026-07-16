#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const REVIEW_PATH = path.join(ROOT, 'data/climate/reviews/legacy-country-data-exit-ct04-review.json');
const EXPECTED = Object.freeze({
  commit: '5a507feeccacaaa8ca2d2a0e891ca5ad0f0d99a7',
  tree: '2cf44117c8d55b61baf4060eae44f8335b0f5bac',
  digest: 'a6d52e448979c3569c804ff10db7734e9cb9deefe090cfa5ac5fa2a1ac84cf75',
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function gitTreeIfAvailable(commit) {
  const result = spawnSync('git', ['show', '-s', '--format=%T', commit], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function main() {
  const guard = spawnSync(process.execPath, [path.join(ROOT, 'tools/verify-legacy-country-exit.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert(guard.status === 0, `CT-04 exit guard failed: ${(guard.stderr || guard.stdout).trim()}`);

  const review = JSON.parse(fs.readFileSync(REVIEW_PATH, 'utf8'));
  assert(review.schema_version === '1.0.0', 'review schema version changed');
  assert(review.verdict === 'APPROVED_WITH_LATER_RUNTIME_GATES', 'review verdict changed');
  assert(review.reviewer.independent_of_builder === true, 'review independence is not asserted');
  assert(review.reviewer.reviewer_id !== review.reviewer.builder_id, 'builder and reviewer must differ');
  assert(review.reviewed_revision.commit_sha === EXPECTED.commit, 'reviewed commit pin changed');
  assert(review.reviewed_revision.tree_sha === EXPECTED.tree, 'reviewed tree pin changed');
  const availableTree = gitTreeIfAvailable(EXPECTED.commit);
  if (availableTree !== null) {
    assert(availableTree === EXPECTED.tree, 'reviewed commit no longer resolves to the attested tree');
  }
  assert(review.reviewer_verdict_digest_sha256 === EXPECTED.digest, 'reviewer verdict digest changed');
  assert(review.review_evidence.adversarial_mutations_passed === 9, 'adversarial mutation count changed');
  assert(review.review_evidence.legitimate_use_controls_passed === 1, 'legitimate-use control count changed');
  assert(review.review_evidence.prior_blockers_resolved === true, 'review retains an unresolved blocker');
  assert(review.scope.ct04_legacy_runtime_exit_approved === true, 'CT-04 exit is not approved');
  ['full_webgl_gate_run_by_reviewer', 'stacklint_gate_run_by_reviewer', 'ct33_accessibility_gate_run_by_reviewer', 'ct40_release_gate_run_by_reviewer']
    .forEach(key => assert(review.scope[key] === false, `${key} must remain an explicit later gate`));
  Object.entries(review.authorization).forEach(([key, allowed]) => {
    assert(allowed === false, `${key} must not be authorized by the CT-04 review`);
  });

  process.stdout.write(guard.stdout);
  const treeCheck = availableTree === null ? 'tree object unavailable in shallow checkout' : 'tree object verified';
  console.log(`CT-04-R review: PASS (${EXPECTED.commit.slice(0, 8)} / ${EXPECTED.tree.slice(0, 8)}; ${treeCheck}; legacy exit only; runtime/scoring/release false)`);
}

try { main(); } catch (error) {
  console.error(`CT-04-R review: FAIL — ${error.message}`);
  process.exit(1);
}
