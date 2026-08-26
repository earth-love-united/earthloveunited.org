'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { stable, validateJsonSchema } = require('./json-schema-lite');
const {
  calculationHash: rollbackCalculationHash,
  regularNonSymlink,
  validateReviewedRollbackProof,
} = require('./reviewed-runtime-rollback-proof');
const {
  INDEPENDENT_REVIEWS,
  SOURCE_REVIEWS,
  SUBJECT_PATHS,
  calculationHash: requestCalculationHash,
} = require('../prepare-country-climate-intelligence-review-request');
const { fileSha256, sha256 } = require('./country-climate-intelligence');

const RELEASE_DIR = 'data/climate/releases/country-climate-intelligence-v1';
const PATHS = Object.freeze({
  request: `${RELEASE_DIR}/review-request.json`,
  approval: `${RELEASE_DIR}/release-approval.json`,
  releaseDiff: `${RELEASE_DIR}/reviewed-release-diff.json`,
  runtimeManifest: `${RELEASE_DIR}/reviewed-runtime-manifest.json`,
  rollbackProof: `${RELEASE_DIR}/reviewed-rollback-proof.json`,
  runtime: 'data/climate/runtime/country-climate-intelligence.json',
  releaseManifest: `${RELEASE_DIR}/release-manifest.json`,
  sourceReceipts: `${RELEASE_DIR}/source-receipts.json`,
  sourceRegistry: 'data/climate/source-registry.json',
  transformationLog: `${RELEASE_DIR}/TRANSFORMATION-LOG.md`,
});
const SCHEMAS = Object.freeze({
  request: 'data/climate/schemas/country-climate-intelligence-review-request.schema.json',
  approval: 'data/climate/schemas/country-climate-intelligence-release-approval.schema.json',
  releaseDiff: 'data/climate/schemas/reviewed-release-diff.schema.json',
  runtimeManifest: 'data/climate/schemas/country-climate-intelligence-reviewed-runtime-manifest.schema.json',
  rollbackProof: 'data/climate/schemas/reviewed-runtime-rollback-proof.schema.json',
});
const SOURCE_IDS = Object.freeze(SOURCE_REVIEWS.map(item => item.source_registry_id).sort());
const REVIEW_ROLES = Object.freeze(INDEPENDENT_REVIEWS.map(item => item.role).sort());
const CORE_RELEASE_PIN_PATHS = Object.freeze([
  PATHS.releaseManifest,
  PATHS.runtime,
  PATHS.sourceReceipts,
  PATHS.sourceRegistry,
  PATHS.transformationLog,
].sort());

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function entryPresent(root, relative) {
  try { fs.lstatSync(path.join(root, relative)); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function pin(root, relative) {
  return { path: relative, sha256: fileSha256(path.join(root, relative)) };
}

function canonicalHash(value) {
  const copy = structuredClone(value);
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function releaseDiffHash(value) {
  const copy = structuredClone(value);
  copy.diff_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function add(errors, code, detail) {
  errors.push({ code, detail });
}

function validIdentity(value, allowFixtureIdentities = false) {
  return typeof value === 'string' && value.trim() === value && value.length >= 5 &&
    (allowFixtureIdentities || !/(?:^|[\s@._-])(fake|self|invented|unknown|example|placeholder|test|fixture|tbd|todo)(?:$|[\s@._-])/i.test(value));
}

function exactIdSet(items, key, expected) {
  const actual = Array.isArray(items) ? items.map(item => item && item[key]).sort() : [];
  return actual.length === expected.length && new Set(actual).size === actual.length &&
    JSON.stringify(actual) === JSON.stringify(expected);
}

function exactPins(root, actual, expectedPaths, errors, code) {
  const expected = [...expectedPaths].sort();
  if (!Array.isArray(actual) || actual.length !== expected.length ||
      JSON.stringify(actual.map(item => item && item.path)) !== JSON.stringify(expected)) {
    add(errors, code, 'Artifact pins are not the exact sorted canonical path set.');
    return false;
  }
  let pass = true;
  actual.forEach((item, index) => {
    const relative = expected[index];
    if (!item || Object.keys(item).sort().join(',') !== 'path,sha256' ||
        !regularNonSymlink(root, relative) || item.sha256 !== pin(root, relative).sha256) {
      add(errors, code, `${relative} is missing, non-regular, or hash-mismatched.`);
      pass = false;
    }
  });
  return pass;
}

function validateEvidencePins(root, pins, errors, code) {
  if (!Array.isArray(pins) || !pins.length) {
    add(errors, code, 'At least one exact evidence pin is required.');
    return;
  }
  pins.forEach(item => {
    if (!item || Object.keys(item).sort().join(',') !== 'path,sha256' ||
        !regularNonSymlink(root, item.path) || item.sha256 !== pin(root, item.path).sha256) {
      add(errors, code, `${item?.path || '(missing path)'} is absent, non-regular, or hash-mismatched.`);
    }
  });
}

function validateAgainstSchema(root, id, value, errors) {
  if (!regularNonSymlink(root, SCHEMAS[id])) {
    add(errors, `${id}_schema_unavailable`, SCHEMAS[id]);
    return;
  }
  const schema = readJson(root, SCHEMAS[id]);
  validateJsonSchema(value, schema).forEach(detail => add(errors, `${id}_schema_invalid`, detail));
}

function inspectReviewRequest(root, requestOverride = null) {
  const errors = [];
  const blockers = [];
  if (!requestOverride && !regularNonSymlink(root, PATHS.request)) {
    return {
      pass: false,
      status: 'invalid',
      errors: [{ code: 'review_request_missing', detail: PATHS.request }],
      blockers,
      request: null,
    };
  }
  let request;
  try { request = requestOverride || readJson(root, PATHS.request); }
  catch (error) {
    return {
      pass: false,
      status: 'invalid',
      errors: [{ code: 'review_request_json_invalid', detail: error.message }],
      blockers,
      request: null,
    };
  }
  validateAgainstSchema(root, 'request', request, errors);
  if (request.calculation_hash !== requestCalculationHash(request)) {
    add(errors, 'review_request_calculation_hash_mismatch', 'Review request hash is not canonical.');
  }
  exactPins(root, request.subject?.artifact_pins, SUBJECT_PATHS, errors, 'review_request_artifact_pin_mismatch');
  if (!exactIdSet(request.source_reviews, 'source_registry_id', SOURCE_IDS)) {
    add(errors, 'review_request_source_set_mismatch', 'The six value-producing sources are not the exact required set.');
  }
  if (!exactIdSet(request.independent_reviews, 'role', REVIEW_ROLES)) {
    add(errors, 'review_request_role_set_mismatch', 'The eight independent review roles are not the exact required set.');
  }
  const runtime = readJson(root, PATHS.runtime);
  const manifest = readJson(root, PATHS.releaseManifest);
  if (request.release_id !== runtime.release?.id || request.release_id !== manifest.release?.id) {
    add(errors, 'review_request_release_id_mismatch', 'Request, runtime, and release manifest do not identify one release.');
  }
  if (request.subject?.commit_binding_state !== 'bound_candidate_commit' ||
      !/^[a-f0-9]{40}$/.test(request.subject?.subject_commit_sha || '')) {
    blockers.push({
      code: 'review_request_commit_unbound',
      detail: 'Regenerate the request with --subject-commit after the candidate implementation commit.',
    });
  }
  return {
    pass: errors.length === 0 && blockers.length === 0,
    status: errors.length ? 'invalid' : blockers.length ? 'blocked' : 'ready_for_external_review',
    errors: errors.sort((a, b) => a.code.localeCompare(b.code) || a.detail.localeCompare(b.detail)),
    blockers,
    request,
  };
}

function inspectReleaseApproval(root, options = {}) {
  const requestResult = inspectReviewRequest(root, options.request || null);
  const errors = [...requestResult.errors];
  const blockers = [...requestResult.blockers];
  if (errors.length) return { ...requestResult, production_runtime_release: false, release_authority: false };

  const packagePaths = [PATHS.approval, PATHS.releaseDiff, PATHS.runtimeManifest, PATHS.rollbackProof];
  const present = packagePaths.filter(relative => entryPresent(root, relative));
  if (present.length === 0) {
    blockers.push({
      code: 'reviewed_release_package_absent',
      detail: 'Independent approval, reviewed release diff, reviewed runtime manifest, and executable rollback proof are all required.',
    });
    return {
      pass: false,
      status: 'blocked',
      errors: [],
      blockers,
      request: requestResult.request,
      production_runtime_release: false,
      release_authority: false,
    };
  }
  if (present.length !== packagePaths.length) {
    add(errors, 'reviewed_release_package_partial', `Present: ${present.join(', ')}`);
    return {
      pass: false, status: 'invalid', errors, blockers,
      request: requestResult.request, production_runtime_release: false, release_authority: false,
    };
  }
  packagePaths.forEach(relative => {
    if (!regularNonSymlink(root, relative)) add(errors, 'reviewed_release_artifact_not_regular', relative);
  });
  if (errors.length) {
    return {
      pass: false, status: 'invalid', errors, blockers,
      request: requestResult.request, production_runtime_release: false, release_authority: false,
    };
  }

  const documents = {};
  try {
    documents.approval = readJson(root, PATHS.approval);
    documents.releaseDiff = readJson(root, PATHS.releaseDiff);
    documents.runtimeManifest = readJson(root, PATHS.runtimeManifest);
    documents.rollbackProof = readJson(root, PATHS.rollbackProof);
  } catch (error) {
    add(errors, 'reviewed_release_json_invalid', error.message);
  }
  if (errors.length) {
    return {
      pass: false, status: 'invalid', errors, blockers,
      request: requestResult.request, production_runtime_release: false, release_authority: false,
    };
  }

  validateAgainstSchema(root, 'approval', documents.approval, errors);
  validateAgainstSchema(root, 'releaseDiff', documents.releaseDiff, errors);
  validateAgainstSchema(root, 'runtimeManifest', documents.runtimeManifest, errors);
  if (documents.approval.calculation_hash !== canonicalHash(documents.approval)) {
    add(errors, 'approval_calculation_hash_mismatch', 'Approval hash is not canonical.');
  }
  if (documents.releaseDiff.diff_hash !== releaseDiffHash(documents.releaseDiff)) {
    add(errors, 'release_diff_calculation_hash_mismatch', 'Release diff hash is not canonical.');
  }
  if (documents.runtimeManifest.calculation_hash !== canonicalHash(documents.runtimeManifest)) {
    add(errors, 'runtime_manifest_calculation_hash_mismatch', 'Runtime manifest hash is not canonical.');
  }

  const request = requestResult.request;
  const releaseId = request.release_id;
  const subjectCommit = request.subject.subject_commit_sha;
  [documents.approval, documents.releaseDiff, documents.runtimeManifest, documents.rollbackProof].forEach(document => {
    const documentReleaseId = document.release_id ?? document.data_release_id;
    if (documentReleaseId !== releaseId) {
      add(errors, 'reviewed_release_id_mismatch', 'Every reviewed release artifact must identify the request release.');
    }
  });
  if (documents.approval.subject_commit_sha !== subjectCommit ||
      documents.runtimeManifest.subject_commit_sha !== subjectCommit ||
      documents.approval.protected_file_review?.reviewed_commit_sha !== subjectCommit) {
    add(errors, 'reviewed_subject_commit_mismatch', 'Approval, protected review, runtime manifest, and request must bind one candidate commit.');
  }

  const requestPin = pin(root, PATHS.request);
  if (JSON.stringify(documents.approval.review_request) !== JSON.stringify(requestPin)) {
    add(errors, 'approval_request_pin_mismatch', 'Approval does not pin the exact review request.');
  }
  exactPins(root, documents.approval.release_artifact_pins, CORE_RELEASE_PIN_PATHS, errors, 'approval_release_pin_mismatch');
  if (!exactIdSet(documents.approval.source_reviews, 'source_registry_id', SOURCE_IDS)) {
    add(errors, 'approval_source_set_mismatch', 'Approval does not review the exact six value-producing sources.');
  }
  if (!exactIdSet(documents.approval.independent_reviews, 'role', REVIEW_ROLES)) {
    add(errors, 'approval_role_set_mismatch', 'Approval does not contain the exact eight independent review roles.');
  }
  (documents.approval.source_reviews || []).forEach(review =>
    validateEvidencePins(root, review.evidence_pins, errors, 'source_review_evidence_pin_mismatch'));
  (documents.approval.independent_reviews || []).forEach(review =>
    validateEvidencePins(root, review.report ? [review.report] : [], errors, 'independent_review_report_pin_mismatch'));
  const reviewerIds = [
    ...(documents.approval.source_reviews || []).map(item => item.reviewer_id),
    ...(documents.approval.independent_reviews || []).map(item => item.reviewer_id),
    documents.approval.protected_file_review?.reviewer_id,
    documents.approval.decision?.approved_by,
    documents.runtimeManifest.review?.reviewer_id,
  ];
  if (!validIdentity(documents.approval.builder_id, options.allowFixtureIdentities) ||
      reviewerIds.some(identity => !validIdentity(identity, options.allowFixtureIdentities))) {
    add(errors, 'review_identity_invalid', 'Builder and reviewers must use non-placeholder identities.');
  }
  if (reviewerIds.includes(documents.approval.builder_id)) {
    add(errors, 'approval_self_review', 'The candidate builder cannot supply an independent review or release approval.');
  }
  if (documents.runtimeManifest.review?.builder_id === documents.runtimeManifest.review?.reviewer_id ||
      !validIdentity(documents.runtimeManifest.review?.builder_id, options.allowFixtureIdentities)) {
    add(errors, 'runtime_manifest_self_review', 'Runtime-manifest builder and reviewer must be independent identities.');
  }
  if (documents.releaseDiff.review?.builder_id === documents.releaseDiff.review?.reviewer_id ||
      !validIdentity(documents.releaseDiff.review?.builder_id, options.allowFixtureIdentities) ||
      !validIdentity(documents.releaseDiff.review?.reviewer_id, options.allowFixtureIdentities)) {
    add(errors, 'release_diff_review_identity_invalid', 'Release-diff builder and reviewer must be independent identities.');
  }
  if (new Set((documents.approval.independent_reviews || []).map(item => item.reviewer_id)).size < 4) {
    add(errors, 'independent_reviewer_diversity_missing', 'At least four independent people must cover the eight review roles.');
  }

  const manifestPinPaths = [...SUBJECT_PATHS, PATHS.approval, PATHS.request].sort();
  exactPins(root, documents.runtimeManifest.artifact_pins, manifestPinPaths, errors, 'runtime_manifest_artifact_pin_mismatch');
  if (JSON.stringify(documents.runtimeManifest.source_registry) !== JSON.stringify(pin(root, PATHS.sourceRegistry)) ||
      JSON.stringify(documents.runtimeManifest.source_receipts) !== JSON.stringify(pin(root, PATHS.sourceReceipts))) {
    add(errors, 'runtime_manifest_source_pin_mismatch', 'Runtime manifest source pins are stale or mismatched.');
  }
  if (documents.runtimeManifest.runtime?.sha256 !== pin(root, PATHS.runtime).sha256) {
    add(errors, 'runtime_manifest_runtime_pin_mismatch', 'Reviewed runtime hash does not match deployed bytes.');
  }

  const diffPinPaths = [PATHS.approval, PATHS.request, PATHS.runtimeManifest].sort();
  exactPins(root, documents.releaseDiff.artifact_pins, diffPinPaths, errors, 'release_diff_artifact_pin_mismatch');
  const rollbackExpectedPins = [PATHS.approval, PATHS.releaseDiff, PATHS.request, PATHS.runtimeManifest]
    .sort().map(relative => pin(root, relative));
  const rollbackResult = validateReviewedRollbackProof(root, documents.rollbackProof, {
    allowFixtureIdentities: options.allowFixtureIdentities,
    allowedControlPaths: ['index.html', 'js/country-climate-intelligence.js', 'js/data.js', 'js/globe.js', 'sw.js'],
    expectedPackagePins: rollbackExpectedPins,
    ...(options.baselineReader ? { baselineReader: options.baselineReader } : {}),
  });
  rollbackResult.errors.forEach(error => add(errors, error.code, error.detail));

  const runtime = readJson(root, PATHS.runtime);
  const releaseManifest = readJson(root, PATHS.releaseManifest);
  if (runtime.release?.status !== 'production' || runtime.release?.review_state !== 'independently_reviewed' ||
      runtime.release?.production_runtime_release !== true) {
    add(errors, 'runtime_not_promoted', 'The exact runtime must self-identify as independently reviewed production data.');
  }
  const requiredGates = [
    'atomic_service_worker_staging', 'independent_scientific_review', 'raw_receipt_revalidation',
    'redistribution_rights_revalidation', 'runtime_validation', 'source_registry_approval', 'visual_review',
  ];
  if (releaseManifest.release?.status !== 'production' ||
      releaseManifest.release?.production_runtime_release !== true ||
      requiredGates.some(key => releaseManifest.gates?.[key] !== true)) {
    add(errors, 'release_manifest_not_promoted', 'Release manifest status and every production gate must be true.');
  }
  const unapprovedSources = (runtime.source_catalog || [])
    .filter(source => source.values_in_release === true && source.review_state !== 'approved')
    .map(source => source.id);
  if (unapprovedSources.length) {
    add(errors, 'runtime_source_review_pending', `Value-producing sources remain pending: ${unapprovedSources.join(', ')}`);
  }
  if (documents.approval.decision?.release_authority !== true ||
      documents.approval.decision?.production_runtime_release !== true) {
    add(errors, 'release_authority_missing', 'The exact release decision does not authorize production.');
  }
  if (JSON.stringify(documents).includes('ct40')) {
    add(errors, 'ct40_review_reuse_forbidden', 'CCI approval artifacts must not reuse CT-40 scoring/NDC review bindings.');
  }

  errors.sort((a, b) => a.code.localeCompare(b.code) || a.detail.localeCompare(b.detail));
  return {
    pass: errors.length === 0 && blockers.length === 0,
    status: errors.length ? 'invalid' : blockers.length ? 'blocked' : 'approved',
    errors,
    blockers,
    request,
    production_runtime_release: errors.length === 0 && blockers.length === 0,
    release_authority: errors.length === 0 && blockers.length === 0,
    rollback_rehearsal: rollbackResult.rehearsal,
  };
}

module.exports = {
  CORE_RELEASE_PIN_PATHS,
  PATHS,
  REVIEW_ROLES,
  SCHEMAS,
  SOURCE_IDS,
  canonicalHash,
  inspectReleaseApproval,
  inspectReviewRequest,
  releaseDiffHash,
};
