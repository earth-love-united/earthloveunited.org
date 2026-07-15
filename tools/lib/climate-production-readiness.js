'use strict';

const CANDIDATE_MISSING = Object.freeze([
  'reviewed-release-diff',
  'reviewed-runtime-manifest',
]);

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

module.exports = { CANDIDATE_MISSING, evaluateReadiness };
