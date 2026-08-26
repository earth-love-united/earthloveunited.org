'use strict';

const crypto = require('node:crypto');
const {
  ACTIVE_GLOBE_TRUTH_RUNTIME_SCRIPT_PATHS,
  UI_REVIEW_PATH,
} = require('./globe-runtime-assets');

const POLICY_VERSION = '2.0.0';
const PROFILE_CCI = 'cci';
const PROFILE_LEGACY_CT40 = 'legacy_ct40';

const PROHIBITED_RELEASE_PATHS = Object.freeze([
  'data/climate/runtime-manifest.json',
  'data/climate/releases/reviewed-release-diff.json',
  'data/climate/releases/ct40-allow-manifest.json',
]);

const FIXED_RUNTIME_PATHS = Object.freeze([
  'index.html',
  'sw.js',
  'css/globe-system.css',
  'css/guided-first-orbit.css',
  ...ACTIVE_GLOBE_TRUTH_RUNTIME_SCRIPT_PATHS,
  'js/country-climate-view-model.js',
  'js/country-ranking-compiler.js',
  'js/vendor/globe.gl.js',
  'data/climate/source-registry.json',
  'data/climate/schemas/country-climate-intelligence.schema.json',
  'data/small-nations.json',
  'THIRD_PARTY_NOTICES.txt',
  '_headers',
  '_redirects',
  'wrangler.jsonc',
  'docs/LEGACY-COUNTRY-DATA-EXIT.md',
  'data/governance/vendor/globe-gl-2.46.1-notices.json',
  'data/governance/vendor/globe-gl-2.46.1-notices-integration.json',
  'data/climate/schemas/globe-runtime-assets-production-review.schema.json',
  'data/climate/governance/globe-runtime-approval-trust.json',
  'data/climate/reviews/globe-runtime-assets-production-review.json',
  'data/climate/reviews/globe-runtime-assets-production-review.signatures.json',
  UI_REVIEW_PATH,
  'tools/build-deploy.sh',
  'tools/stage-public-deploy.js',
  'tools/check-public-deploy-surface.js',
  'tools/lib/public-deploy-surface.js',
  'tools/check-public-climate-release-profile.js',
  'tools/lib/public-climate-release-profile.js',
  'tools/fetch-globe-vendor.sh',
  'tools/check-globe-vendor-integrity.js',
  'tools/lib/globe-vendor-integrity.js',
  'tools/check-globe-runtime-assets.js',
  'tools/lib/globe-runtime-assets.js',
  'tools/fixtures/globe-runtime-assets.json',
  'tools/authoring/fetch-nasa-black-marble.sh',
  'tools/check-globe-third-party-notices.js',
  'tools/lib/globe-third-party-notices.js',
  'tools/fixtures/globe-third-party-notices.json',
  'tools/check-globe-runtime-approval.js',
  'tools/lib/globe-runtime-approval.js',
  'tools/check-staged-production-integrity.js',
  'tools/acquire-gcb-2025.js',
  'tools/build-country-climate-intelligence.js',
  'tools/extract-reviewed-country-climate-components.js',
  'tools/compile-gcb-emissions.js',
  'tools/compile-wpp-population.js',
  'tools/compile-climate-trace.js',
  'tools/compile-ember-power.js',
  'tools/compile-cckp-physical.js',
  'tools/check-climate-source-registry.js',
  'tools/test-climate-source-registry.js',
  'tools/check-country-climate-intelligence.js',
  'tools/check-country-climate-intelligence-ui.js',
  'tools/check-country-climate-intelligence-ci.js',
  'tools/check-country-climate-public-release-boundary.js',
  'tools/check-country-climate-runtime-atomic.js',
  'tools/test-country-climate-compilers.js',
  'tools/test-country-climate-intelligence-derivations.js',
  'tools/lib/country-climate-intelligence.js',
  'tools/lib/gcb-country-intelligence.js',
  'tools/climate-truth-ci.js',
  'tools/lib/country-accessibility-model.js',
  'tools/lib/country-card-evidence-model.js',
  ...PROHIBITED_RELEASE_PATHS,
]);

const RUNTIME_PATH_PREFIXES = Object.freeze([
  'data/climate/runtime/',
  'data/climate/releases/country-climate-intelligence-v1/',
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

function cciCandidateReasons(runtime, releaseManifest) {
  const reasons = [];
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    return ['cci_runtime_missing'];
  }
  const release = runtime.release || {};
  if (release.status !== 'candidate') reasons.push('cci_runtime_status_not_candidate');
  if (release.production_runtime_release !== false) reasons.push('cci_runtime_production_release_not_false');
  if (!/pending_source_revalidation/.test(release.review_state || '')) {
    reasons.push('cci_runtime_review_state_not_fail_closed');
  }
  const gates = releaseManifest && typeof releaseManifest === 'object' && !Array.isArray(releaseManifest)
    ? releaseManifest.gates || {}
    : {};
  if (gates.raw_receipt_revalidation !== false) reasons.push('cci_raw_receipt_gate_not_false');
  if (gates.redistribution_rights_revalidation !== false) reasons.push('cci_redistribution_rights_gate_not_false');
  if (gates.independent_scientific_review !== false) reasons.push('cci_scientific_review_gate_not_false');
  return reasons.sort();
}

function activeStateReasons(profile, phase) {
  const reasons = [];
  if (![PROFILE_CCI, PROFILE_LEGACY_CT40].includes(profile)) reasons.push('active_profile_unknown');
  if (!['candidate', 'release'].includes(phase)) reasons.push('active_phase_unknown');
  return reasons;
}

function evaluateRuntimeDiffBoundary(input) {
  const changedPaths = uniquePaths(input && input.changed_paths);
  const declaredPaths = uniquePaths(input && input.declared_runtime_paths);
  const runtimePaths = changedPaths.filter(filePath => isRuntimeAffectingPath(filePath, declaredPaths));
  const artifactsPresent = Object.fromEntries(PROHIBITED_RELEASE_PATHS.map(filePath => [
    filePath,
    Boolean(input && input.artifacts_present && input.artifacts_present[filePath]),
  ]));

  const activeProfile = input && input.active_profile;
  const activePhase = input && input.active_phase;
  let mode = 'no-runtime-change';
  let strictRequired = false;
  let releaseRequired = false;
  let reasons = activeStateReasons(activeProfile, activePhase);

  if (reasons.length) {
    mode = 'invalid-active-state';
  } else if (runtimePaths.length) {
    if (activeProfile === PROFILE_CCI && activePhase === 'release') {
      mode = 'cci-reviewed-release-required';
      releaseRequired = true;
    } else if (activeProfile === PROFILE_CCI) {
      mode = 'cci-candidate';
      reasons = cciCandidateReasons(input.cci_runtime, input.cci_release_manifest);
    } else if (activePhase === 'release') {
      mode = 'reviewed-runtime-strict-required';
      strictRequired = true;
      releaseRequired = true;
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
    release_required: releaseRequired,
    active_profile: activeProfile,
    active_phase: activePhase,
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
  PROFILE_CCI,
  PROFILE_LEGACY_CT40,
  FIXED_RUNTIME_PATHS,
  RUNTIME_PATH_PREFIXES,
  activeStateReasons,
  candidateBoundaryReasons,
  cciCandidateReasons,
  evaluateRuntimeDiffBoundary,
  isRuntimeAffectingPath,
  normalizePath,
  reviewedManifestReasons,
};
