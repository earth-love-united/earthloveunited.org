'use strict';

const crypto = require('node:crypto');

const POLICY_VERSION = '1.0.0';

const PROHIBITED_RELEASE_PATHS = Object.freeze([
  'data/climate/runtime-manifest.json',
  'data/climate/releases/reviewed-release-diff.json',
  'data/climate/releases/ct40-allow-manifest.json',
]);

const FIXED_RUNTIME_PATHS = Object.freeze([
  'index.html',
  'sw.js',
  'css/globe-system.css',
  'js/app.js',
  'js/data.js',
  'js/globe.js',
  'js/country-climate-view-model.js',
  'js/country-ranking-compiler.js',
  'js/vendor/globe.gl.js',
  'data/small-nations.json',
  'data/climate/reviews/globe-runtime-assets-production-review.json',
  'tools/build-deploy.sh',
  'tools/fetch-globe-vendor.sh',
  'tools/check-globe-vendor-integrity.js',
  'tools/lib/globe-vendor-integrity.js',
  'tools/check-globe-runtime-assets.js',
  'tools/lib/globe-runtime-assets.js',
  'tools/fixtures/globe-runtime-assets.json',
  'tools/climate-truth-ci.js',
  'tools/lib/country-accessibility-model.js',
  'tools/lib/country-card-evidence-model.js',
  ...PROHIBITED_RELEASE_PATHS,
]);

const RUNTIME_PATH_PREFIXES = Object.freeze([
  'data/climate/runtime/',
  'assets/globe/runtime/',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function normalizePath(value) {
  return String(value || '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function uniquePaths(values) {
  return [...new Set((values || []).map(normalizePath).filter(Boolean))].sort();
}

function isRuntimeAffectingPath(filePath, declaredPaths = []) {
  const normalized = normalizePath(filePath);
  const exact = new Set([...FIXED_RUNTIME_PATHS, ...uniquePaths(declaredPaths)]);
  return exact.has(normalized) || RUNTIME_PATH_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

function candidateBoundaryReasons(candidateManifest, artifactsPresent) {
  const reasons = [];
  if (!candidateManifest || typeof candidateManifest !== 'object' || Array.isArray(candidateManifest)) {
    reasons.push('candidate_manifest_missing');
    return reasons;
  }
  if (candidateManifest.review_status !== 'not_reviewed') reasons.push('candidate_review_state_not_denied');
  if (candidateManifest.decision !== 'deny') reasons.push('candidate_decision_not_denied');
  if (candidateManifest.release_eligible !== false) reasons.push('candidate_release_eligibility_not_false');
  if (candidateManifest.production_runtime_release !== false) reasons.push('candidate_production_release_not_false');

  const declaredProhibited = uniquePaths(candidateManifest.prohibited_release_files);
  for (const requiredPath of PROHIBITED_RELEASE_PATHS) {
    if (!declaredProhibited.includes(requiredPath)) reasons.push(`candidate_prohibited_path_not_declared:${requiredPath}`);
    if (artifactsPresent[requiredPath] === true) reasons.push(`prohibited_release_artifact_present:${requiredPath}`);
  }
  return reasons.sort();
}

function reviewedManifestReasons(runtimeManifest) {
  if (!runtimeManifest || typeof runtimeManifest !== 'object' || Array.isArray(runtimeManifest)) {
    return ['reviewed_runtime_manifest_invalid'];
  }
  if (!runtimeManifest.runtime || runtimeManifest.runtime.review_status !== 'reviewed') {
    return ['reviewed_runtime_state_missing'];
  }
  return [];
}

function evaluateRuntimeDiffBoundary(input) {
  const changedPaths = uniquePaths(input && input.changed_paths);
  const declaredPaths = uniquePaths(input && input.declared_runtime_paths);
  const runtimePaths = changedPaths.filter(filePath => isRuntimeAffectingPath(filePath, declaredPaths));
  const artifactsPresent = Object.fromEntries(PROHIBITED_RELEASE_PATHS.map(filePath => [
    filePath,
    Boolean(input && input.artifacts_present && input.artifacts_present[filePath]),
  ]));

  let mode = 'no-runtime-change';
  let strictRequired = false;
  let reasons = [];

  if (runtimePaths.length) {
    if (artifactsPresent['data/climate/runtime-manifest.json']) {
      mode = 'reviewed-runtime-strict-required';
      strictRequired = true;
      reasons = reviewedManifestReasons(input && input.runtime_manifest);
    } else {
      mode = 'denied-candidate';
      reasons = candidateBoundaryReasons(input && input.candidate_manifest, artifactsPresent);
    }
  }

  const output = {
    policy_version: POLICY_VERSION,
    status: reasons.length ? 'fail' : 'pass',
    mode,
    strict_required: strictRequired,
    changed_paths: changedPaths,
    runtime_affecting_paths: runtimePaths,
    reasons,
    calculation_hash: null,
  };
  output.calculation_hash = digest(output);
  return output;
}

module.exports = {
  POLICY_VERSION,
  PROHIBITED_RELEASE_PATHS,
  FIXED_RUNTIME_PATHS,
  RUNTIME_PATH_PREFIXES,
  candidateBoundaryReasons,
  evaluateRuntimeDiffBoundary,
  isRuntimeAffectingPath,
  normalizePath,
  reviewedManifestReasons,
};
