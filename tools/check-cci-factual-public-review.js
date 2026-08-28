#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  EXCLUDED_GLOBE_PATHS,
  REVIEW_PATH,
  expectedBytes,
  expectedSourcePaths,
  sha256,
} = require('./lib/cci-factual-public');
const { EXPECTED_SPEC: EXPECTED_VENDOR } = require('./lib/globe-vendor-integrity');
const { inspectRegular } = require('./lib/public-deploy-surface');
const {
  BASE_REVIEW_REQUEST_PATH,
  BASE_SUBJECT,
  CURRENT_REVIEW_REQUEST_PATH,
  DELTA_REVIEW_PATH,
  REQUIRED_ARTIFACT_PIN_PATHS,
  REQUIRED_PUBLIC_OUTPUT_PATHS,
  calculationHash,
  runSelfTest,
  verifyBaseReports,
  verifyCurrentRequest,
  verifyScopedDeltaArtifact,
} = require('./lib/cci-scoped-delta-review');

const ROOT = path.resolve(__dirname, '..');
const REQUIRED_SOURCE_FAMILIES = Object.freeze(['gcb', 'wpp', 'ember', 'cckp_cmip6', 'cckp_era5']);

function fail(message) {
  throw new Error(message);
}

function readJson(relative) {
  const record = inspectRegular(ROOT, relative);
  try { return JSON.parse(record.bytes.toString('utf8')); }
  catch (error) { fail(relative + ' is not valid JSON: ' + error.message); }
}

function verifyPins(pins, label, expectedResolver, requiredPaths = null) {
  if (!Array.isArray(pins) || pins.length === 0) fail(label + ' pins are absent');
  const paths = pins.map(pin => pin?.path);
  if (paths.some(value => typeof value !== 'string') || new Set(paths).size !== paths.length) {
    fail(label + ' pin paths must be unique strings');
  }
  if (requiredPaths && JSON.stringify([...paths].sort()) !== JSON.stringify([...requiredPaths].sort())) {
    fail(label + ' pin paths do not match the exact required set');
  }
  pins.forEach(pin => {
    if (!/^[a-f0-9]{64}$/.test(pin.sha256 || '')) fail(label + ' pin has invalid SHA-256: ' + pin.path);
    const actual = expectedResolver(pin.path);
    if (actual !== pin.sha256) fail(label + ' pin mismatch: ' + pin.path);
  });
}

function expectedPublicOutputSha(relative) {
  try {
    return sha256(expectedBytes(ROOT, relative));
  } catch (error) {
    if (relative === EXPECTED_VENDOR.destination && error?.code === 'ENOENT') {
      return EXPECTED_VENDOR.sha256;
    }
    throw error;
  }
}

function verifyReviewArtifact() {
  const artifact = readJson(REVIEW_PATH);
  const current = verifyCurrentRequest(ROOT);
  const deltaRecord = inspectRegular(ROOT, DELTA_REVIEW_PATH);
  const delta = readJson(DELTA_REVIEW_PATH);
  const deltaReport = verifyScopedDeltaArtifact(ROOT, delta);
  if (artifact.schema_version !== '1.1.0' ||
      artifact.artifact_id !== 'country-climate-intelligence-v1-composite-ai-review-2026-08-29') {
    fail('unexpected AI-review artifact identity');
  }
  if (artifact.status !== 'ai_factual_public_authorized') fail('AI-factual artifact is not authorized');
  if (artifact.publication_authority?.authorized !== true ||
      artifact.publication_authority?.scope !== 'country_climate_intelligence_ai_factual_public_lane_only') {
    fail('AI-factual publication authority is absent or out of scope');
  }
  if (artifact.review_type !== 'multi_model_ai_base_with_single_ai_scoped_presentation_performance_delta' ||
      artifact.human_review !== false ||
      artifact.legal_certification !== false || artifact.independent_institutional_review !== false) {
    fail('AI-review boundary must explicitly deny human, legal, and institutional certification');
  }
  if (artifact.subject?.release_id !== 'country-climate-intelligence-2026-08-27-candidate.7' ||
      artifact.subject?.review_request_path !== CURRENT_REVIEW_REQUEST_PATH ||
      artifact.subject?.review_request_artifact_pin_digest !== current.artifact_pin_digest ||
      artifact.subject?.review_request_sha256 !== current.sha256 ||
      artifact.subject?.public_file_count !== expectedSourcePaths().length) {
    fail('AI-review subject does not bind the exact CCI candidate');
  }
  if (artifact.base_subject?.review_request_path !== BASE_REVIEW_REQUEST_PATH ||
      artifact.base_subject?.review_request_sha256 !== BASE_SUBJECT.review_request_sha256 ||
      artifact.base_subject?.review_request_artifact_pin_digest !== BASE_SUBJECT.artifact_pin_digest ||
      artifact.base_subject?.review_request_calculation_hash !== BASE_SUBJECT.calculation_hash ||
      artifact.base_subject?.artifact_pin_count !== BASE_SUBJECT.pin_count ||
      artifact.base_subject?.reviewed_head !== BASE_SUBJECT.reviewed_head) {
    fail('four-review base subject binding mismatch');
  }
  if (artifact.presentation_performance_delta_review?.path !== DELTA_REVIEW_PATH ||
      artifact.presentation_performance_delta_review?.sha256 !== deltaRecord.sha256 ||
      artifact.presentation_performance_delta_review?.calculation_hash !== delta.calculation_hash ||
      artifact.presentation_performance_delta_review?.reviewer_id !== delta.reviewer?.reviewer_id ||
      artifact.presentation_performance_delta_review?.verdict !== delta.reviewer?.verdict ||
      artifact.presentation_performance_delta_review?.change_count !== delta.changes?.length ||
      artifact.presentation_performance_delta_review?.scope !== delta.maintainer_authorization?.scope ||
      JSON.stringify(artifact.delta_authorization) !== JSON.stringify(delta.maintainer_authorization)) {
    fail('focused presentation/performance delta binding mismatch');
  }
  if (artifact.maintainer_authorization?.authorized !== true ||
      artifact.maintainer_authorization?.policy !== 'ai_reviewed_source_data_publication' ||
      artifact.maintainer_authorization?.human_review_substitute !== false) {
    fail('explicit maintainer AI-factual authorization is absent or overstated');
  }
  if (artifact.existing_human_signature_gate !== 'unchanged_and_unsatisfied') {
    fail('existing human-signature gate boundary was not preserved');
  }
  const reviewers = artifact.reviewers;
  verifyBaseReports(ROOT, reviewers);
  const modelCounts = reviewers.reduce((counts, review) => {
    counts[review.model] = (counts[review.model] || 0) + 1;
    return counts;
  }, {});
  if (modelCounts['gpt-5.6-luna'] !== 2 || modelCounts['gpt-5.6-terra'] !== 1 || modelCounts['gpt-5.6-sol'] !== 1) {
    fail('reviewer composition must be two Luna, one Terra, and one Sol');
  }
  if (artifact.review_count !== 4 || artifact.model_family_count !== 3 || artifact.delta_review_count !== 1 ||
      artifact.total_ai_review_artifact_count !== 5 ||
      artifact.aggregation_policy?.base_review_count !== 4 ||
      artifact.aggregation_policy?.base_model_family_count !== 3 ||
      artifact.aggregation_policy?.focused_delta_review_count !== 1 ||
      artifact.aggregation_policy?.focused_delta_model_identity !== 'not_attested' ||
      artifact.aggregation_policy?.institutional_independence_claim !== false) {
    fail('base-plus-delta review diversity counts are inaccurate');
  }
  const boundary = artifact.publication_boundary || {};
  ['composite_score', 'target_assessment', 'finance_judgment', 'performance_grade',
    'offset_adjustment', 'mismatched_scope_comparison', 'climate_trace_included',
    'inverted_carbon_relief_experiment'].forEach(field => {
    if (boundary[field] !== false) fail('factual-only boundary must keep ' + field + '=false');
  });
  const families = new Map((artifact.source_rights || []).map(entry => [entry.id, entry]));
  REQUIRED_SOURCE_FAMILIES.forEach(id => {
    const entry = families.get(id);
    if (!entry || entry.ai_reviewed_publication_decision !== 'allow_with_attribution' || !entry.licence_basis) {
      fail('source rights decision missing: ' + id);
    }
  });
  const assets = new Map((artifact.globe_asset_decisions || []).map(entry => [entry.path, entry]));
  EXCLUDED_GLOBE_PATHS.slice(1).forEach(relative => {
    if (assets.get(relative)?.decision !== 'exclude') fail('ambiguous globe asset is not excluded: ' + relative);
  });
  ['assets/globe/runtime/ne_110m_admin_0_countries.geojson', 'assets/globe/runtime/earth-night.jpg'].forEach(relative => {
    if (assets.get(relative)?.decision !== 'retain_with_attribution_and_limits') {
      fail('retained globe asset decision missing: ' + relative);
    }
  });
  if (!Array.isArray(artifact.condition_resolutions) || artifact.condition_resolutions.length === 0 ||
      artifact.condition_resolutions.some(item => item.status !== 'resolved')) {
    fail('all AI-review conditions must have explicit resolved receipts');
  }
  if (!artifact.condition_resolutions.some(item => item.id === 'scoped_presentation_performance_delta')) {
    fail('focused delta condition resolution is absent');
  }
  verifyPins(artifact.artifact_pins, 'artifact', relative => inspectRegular(ROOT, relative).sha256, REQUIRED_ARTIFACT_PIN_PATHS);
  verifyPins(artifact.public_output_pins, 'public output', expectedPublicOutputSha, REQUIRED_PUBLIC_OUTPUT_PATHS);
  verifyPins(reviewers.map(review => review.report), 'review report', relative => inspectRegular(ROOT, relative).sha256);
  if (!/^[a-f0-9]{64}$/.test(artifact.calculation_hash || '') || calculationHash(artifact) !== artifact.calculation_hash) {
    fail('AI-review calculation hash mismatch');
  }
  const serialized = JSON.stringify(artifact).toLowerCase();
  ['independently scientifically reviewed', 'human certified', 'legal certified', 'rights cleared'].forEach(claim => {
    if (serialized.includes(claim)) fail('prohibited review claim appears in artifact: ' + claim);
  });
  return {
    status: 'pass',
    artifact_sha256: inspectRegular(ROOT, REVIEW_PATH).sha256,
    calculation_hash: artifact.calculation_hash,
    reviewers: reviewers.length,
    delta_reviews: artifact.delta_review_count,
    delta_changes: deltaReport.changes,
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') {
    const cases = runSelfTest();
    process.stdout.write(`CCI scoped delta-review self-test: PASS (${cases} positive and fail-closed policy cases)\n`);
    return;
  }
  if (args.length !== 0) fail('usage: node tools/check-cci-factual-public-review.js [--self-test]');
  const report = verifyReviewArtifact();
  process.stdout.write(`CCI composite AI review: PASS (${report.reviewers} base reviews + ${report.delta_reviews} scoped delta review; ${report.delta_changes} exact changed pins; ${report.calculation_hash})\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write('CCI composite AI review: BLOCKED — ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { calculationHash, verifyPins, verifyReviewArtifact };
