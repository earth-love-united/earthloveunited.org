#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  ROOT,
  readJson,
  writeJson,
} = require('./lib/country-climate-intelligence');
const {
  REVIEW_PATH,
  expectedBytes,
  expectedSourcePaths,
} = require('./lib/cci-factual-public');
const { inspectRegular } = require('./lib/public-deploy-surface');
const {
  BASE_REPORTS,
  BASE_REVIEW_REQUEST_PATH,
  CURRENT_REVIEW_REQUEST_PATH,
  DELTA_REVIEW_PATH,
  REQUIRED_ARTIFACT_PIN_PATHS,
  REQUIRED_PUBLIC_OUTPUT_PATHS,
  buildScopedDeltaArtifact,
  calculationHash,
  sha256,
  verifyScopedDeltaArtifact,
} = require('./lib/cci-scoped-delta-review');

const AUTHORIZED_AT = '2026-08-28T21:15:39Z';

function pinSource(relative) {
  const record = inspectRegular(ROOT, relative);
  return { path: relative, sha256: record.sha256 };
}

function pinPublicOutput(relative) {
  return { path: relative, sha256: sha256(expectedBytes(ROOT, relative)) };
}

function reviewerBindings(template) {
  const metadata = new Map((template.reviewers || []).map(review => [review.reviewer_id, review]));
  return Object.entries(BASE_REPORTS).map(([id, expected]) => {
    const prior = metadata.get(id) || {};
    return {
      reviewer_id: id,
      provider: prior.provider || 'OpenAI',
      model: expected.model,
      role: prior.role || id.split(':')[1],
      reviewed_at: prior.reviewed_at || AUTHORIZED_AT,
      scope: prior.scope || 'Exact frozen four-review base subject.',
      post_mitigation_verdict: expected.verdict,
      report: { path: expected.path, sha256: expected.sha256 },
    };
  });
}

function conditionResolutions(template, publicFileCount) {
  const retained = (template.condition_resolutions || [])
    .filter(item => item.id !== 'scoped_presentation_performance_delta')
    .map(item => {
      if (item.id === 'exclude_ambiguous_globe_images') {
        return { ...item, evidence: `The ${publicFileCount}-file allowlist excludes the three image paths and legacy manifest; negative checks reject paths, hashes, URLs, and executable tokens.` };
      }
      if (item.id === 'deterministic_stage_and_rollback') {
        return { ...item, evidence: `The exact ${publicFileCount}-file stage, four deterministic transforms, 249-entity rollback snapshot, cache epoch, and strict aggregate dispatch are independently verified.` };
      }
      if (item.id === 'four_ai_reports_three_model_families') {
        return { ...item, evidence: 'Two Luna, one Terra, and one Sol report remain byte-exact and bound to the immutable 300-pin base; the focused delta artifact separately binds every permitted base-to-current change.' };
      }
      return item;
    });
  retained.push({
    id: 'scoped_presentation_performance_delta',
    status: 'resolved',
    evidence: 'The single focused delta review lists every changed pin, rejects deletions and unclassified paths, proves climate/source/rights/globe invariants unchanged, and retains CODEOWNERS plus the existing signed-release gate.',
  });
  return retained;
}

function buildComposite(template, delta) {
  const publicFileCount = expectedSourcePaths().length;
  const current = delta.current_subject;
  const artifact = {
    ...template,
    schema_version: '1.1.0',
    artifact_id: 'country-climate-intelligence-v1-composite-ai-review-2026-08-29',
    status: 'ai_factual_public_authorized',
    review_type: 'multi_model_ai_base_with_single_ai_scoped_presentation_performance_delta',
    human_review: false,
    legal_certification: false,
    independent_institutional_review: false,
    public_label: 'AI-reviewed source-data release — four-model base plus one focused presentation/performance delta review; no human review or legal certification.',
    subject: {
      release_id: 'country-climate-intelligence-2026-08-27-candidate.7',
      review_request_path: CURRENT_REVIEW_REQUEST_PATH,
      review_request_sha256: current.review_request_sha256,
      review_request_artifact_pin_digest: current.artifact_pin_digest,
      runtime_sha256: '4939fbc6e26c0ef0fc283ecf98ab3924ccb93d93b7e5392eab2014f7ab3c57fe',
      registry_entity_count: 249,
      metric_count: 26,
      public_file_count: publicFileCount,
    },
    base_subject: {
      release_id: 'country-climate-intelligence-2026-08-27-candidate.7',
      review_request_path: BASE_REVIEW_REQUEST_PATH,
      review_request_sha256: delta.base_subject.review_request_sha256,
      review_request_artifact_pin_digest: delta.base_subject.artifact_pin_digest,
      review_request_calculation_hash: delta.base_subject.calculation_hash,
      artifact_pin_count: delta.base_subject.pin_count,
      reviewed_head: delta.base_subject.reviewed_head,
    },
    presentation_performance_delta_review: {
      path: DELTA_REVIEW_PATH,
      sha256: inspectRegular(ROOT, DELTA_REVIEW_PATH).sha256,
      artifact_id: delta.artifact_id,
      calculation_hash: delta.calculation_hash,
      reviewer_id: delta.reviewer.reviewer_id,
      verdict: delta.reviewer.verdict,
      change_count: delta.changes.length,
      scope: delta.maintainer_authorization.scope,
    },
    delta_authorization: delta.maintainer_authorization,
    aggregation_policy: {
      rule: 'The four specialist reports govern every unchanged base pin. The single focused review governs only the exact listed presentation/performance delta; deletions, unclassified paths, or high-risk invariant changes fail closed and require fresh specialist review.',
      base_review_count: 4,
      base_model_family_count: 3,
      focused_delta_review_count: 1,
      focused_delta_model_identity: 'not_attested',
      composition: 'two Luna reviews, one Terra review, one Sol review, and one separately scoped Codex presentation/runtime delta review',
      institutional_independence_claim: false,
    },
    review_count: 4,
    model_family_count: 3,
    delta_review_count: 1,
    total_ai_review_artifact_count: 5,
    reviewers: reviewerBindings(template),
    condition_resolutions: conditionResolutions(template, publicFileCount),
    known_limitations: [
      'This is a four-model AI base plus one focused AI presentation/performance delta review, not five institutions and not human scientific review.',
      'The focused delta reviewer model identity is deliberately not attested; the delta is bounded by exact byte pins and fail-closed path policy.',
      ...(template.known_limitations || []).filter(item =>
        !item.startsWith('This is four AI reviews') &&
        !item.startsWith('This is a four-model AI base plus one focused AI') &&
        !item.startsWith('The focused delta reviewer model identity is deliberately not attested')),
    ],
    artifact_pins: [...REQUIRED_ARTIFACT_PIN_PATHS].sort().map(pinSource),
    public_output_pins: [...REQUIRED_PUBLIC_OUTPUT_PATHS].sort().map(pinPublicOutput),
    calculation_hash: null,
  };
  artifact.calculation_hash = calculationHash(artifact);
  return artifact;
}

function main() {
  if (process.argv.length !== 2) throw new Error('usage: node tools/build-cci-scoped-delta-review.js');
  const template = readJson(path.join(ROOT, REVIEW_PATH));
  const delta = buildScopedDeltaArtifact(ROOT, AUTHORIZED_AT);
  writeJson(path.join(ROOT, DELTA_REVIEW_PATH), delta);
  verifyScopedDeltaArtifact(ROOT, readJson(path.join(ROOT, DELTA_REVIEW_PATH)));
  const composite = buildComposite(template, delta);
  const digest = writeJson(path.join(ROOT, REVIEW_PATH), composite);
  process.stdout.write(`Built scoped CCI delta review: ${delta.changes.length} exact changed pins; ${delta.calculation_hash}\n`);
  process.stdout.write(`Built composite AI-factual review: ${digest}; ${composite.calculation_hash}\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) { process.stderr.write(`CCI scoped delta review build: BLOCKED — ${error.message}\n`); process.exitCode = 1; }
}

module.exports = { AUTHORIZED_AT, buildComposite, conditionResolutions, reviewerBindings };
