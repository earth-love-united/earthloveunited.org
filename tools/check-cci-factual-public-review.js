#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  EXCLUDED_GLOBE_PATHS,
  REVIEW_PATH,
  expectedBytes,
  sha256,
} = require('./lib/cci-factual-public');
const { inspectRegular } = require('./lib/public-deploy-surface');

const ROOT = path.resolve(__dirname, '..');
const REVIEW_REQUEST_PATH = 'data/climate/releases/country-climate-intelligence-v1/review-request.json';
const REQUIRED_REVIEWERS = Object.freeze({
  'ai-reviewer:luna-science': 'gpt-5.6-luna',
  'ai-reviewer:luna-rights': 'gpt-5.6-luna',
  'ai-reviewer:terra-runtime': 'gpt-5.6-terra',
  'ai-reviewer:sol-red-team': 'gpt-5.6-sol',
});
const REQUIRED_SOURCE_FAMILIES = Object.freeze(['gcb', 'wpp', 'ember', 'cckp_cmip6', 'cckp_era5']);

function fail(message) {
  throw new Error(message);
}

function readJson(relative) {
  const record = inspectRegular(ROOT, relative);
  try { return JSON.parse(record.bytes.toString('utf8')); }
  catch (error) { fail(relative + ' is not valid JSON: ' + error.message); }
}

function calculationHash(artifact) {
  const copy = JSON.parse(JSON.stringify(artifact));
  copy.calculation_hash = null;
  return crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

function verifyPins(pins, label, expectedResolver) {
  if (!Array.isArray(pins) || pins.length === 0) fail(label + ' pins are absent');
  const paths = pins.map(pin => pin?.path);
  if (paths.some(value => typeof value !== 'string') || new Set(paths).size !== paths.length) {
    fail(label + ' pin paths must be unique strings');
  }
  pins.forEach(pin => {
    if (!/^[a-f0-9]{64}$/.test(pin.sha256 || '')) fail(label + ' pin has invalid SHA-256: ' + pin.path);
    const actual = expectedResolver(pin.path);
    if (actual !== pin.sha256) fail(label + ' pin mismatch: ' + pin.path);
  });
}

function verifyReviewArtifact() {
  const artifact = readJson(REVIEW_PATH);
  const reviewRequest = readJson(REVIEW_REQUEST_PATH);
  if (artifact.schema_version !== '1.0.0' || artifact.artifact_id !== 'country-climate-intelligence-v1-multi-model-ai-review-2026-08-28') {
    fail('unexpected AI-review artifact identity');
  }
  if (artifact.status !== 'ai_factual_public_authorized') fail('AI-factual artifact is not authorized');
  if (artifact.review_type !== 'multi_model_ai' || artifact.human_review !== false ||
      artifact.legal_certification !== false || artifact.independent_institutional_review !== false) {
    fail('AI-review boundary must explicitly deny human, legal, and institutional certification');
  }
  if (artifact.subject?.release_id !== 'country-climate-intelligence-2026-08-27-candidate.7' ||
      artifact.subject?.review_request_artifact_pin_digest !== reviewRequest.subject?.artifact_pin_digest) {
    fail('AI-review subject does not bind the exact CCI candidate');
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
  if (!Array.isArray(reviewers) || reviewers.length !== 4) fail('exactly four AI reviews are required');
  const byId = new Map(reviewers.map(review => [review.reviewer_id, review]));
  if (byId.size !== 4) fail('AI reviewer ids must be unique');
  Object.entries(REQUIRED_REVIEWERS).forEach(([id, model]) => {
    const review = byId.get(id);
    if (!review || review.model !== model || !['approve', 'approve_with_conditions'].includes(review.post_mitigation_verdict)) {
      fail('missing final approving AI review: ' + id);
    }
    if (!review.report?.path || !review.report?.sha256) fail('complete AI report pin missing: ' + id);
  });
  const modelCounts = reviewers.reduce((counts, review) => {
    counts[review.model] = (counts[review.model] || 0) + 1;
    return counts;
  }, {});
  if (modelCounts['gpt-5.6-luna'] !== 2 || modelCounts['gpt-5.6-terra'] !== 1 || modelCounts['gpt-5.6-sol'] !== 1) {
    fail('reviewer composition must be two Luna, one Terra, and one Sol');
  }
  if (artifact.review_count !== 4 || artifact.model_family_count !== 3) fail('review diversity counts are inaccurate');
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
  verifyPins(artifact.artifact_pins, 'artifact', relative => inspectRegular(ROOT, relative).sha256);
  verifyPins(artifact.public_output_pins, 'public output', relative => sha256(expectedBytes(ROOT, relative)));
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
  };
}

function main() {
  if (process.argv.length !== 2) fail('usage: node tools/check-cci-factual-public-review.js');
  const report = verifyReviewArtifact();
  process.stdout.write(`CCI multi-model AI review: PASS (${report.reviewers} AI reviews; ${report.calculation_hash})\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write('CCI multi-model AI review: BLOCKED — ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { calculationHash, verifyPins, verifyReviewArtifact };
