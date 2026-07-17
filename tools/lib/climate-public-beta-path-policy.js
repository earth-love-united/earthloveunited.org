'use strict';

const RUNTIME_MANIFEST_PATH = 'data/climate/public-beta/runtime/runtime-manifest.json';

const BETA_PREFIXES = Object.freeze([
  'climate-public-beta/',
  'data/climate/public-beta/',
]);

const BETA_EXACT_PATHS = Object.freeze([
  '.github/CODEOWNERS',
  '.github/workflows/ci.yml',
  '.gitignore',
  'docs/CLIMATE-PUBLIC-BETA-ACTION-LEDGER.md',
  'docs/CLIMATE-PUBLIC-BETA-RELEASE-PLAN.md',
  'tools/build-climate-public-beta.sh',
  'tools/check-climate-public-beta-assessed-boundary.js',
  'tools/check-climate-public-beta-browser.mjs',
  'tools/check-climate-public-beta-diff-boundary.js',
  'tools/check-climate-public-beta-readiness.js',
  'tools/check-climate-public-beta-surface.js',
  'tools/check-remote-climate-public-beta.js',
  'tools/check-staged-climate-public-beta-integrity.js',
  'tools/generate-climate-public-beta-artifacts.js',
  'tools/lib/climate-public-beta-path-policy.js',
  'tools/lib/json-schema-lite.js',
  'tools/lib/primap-hist-ingest.js',
  'tools/stage-climate-public-beta.js',
]);

// These paths can change what bytes are authorized, built, uploaded, exposed,
// or rolled back. Keep the authority-producing readiness/diff controls here
// as well as the direct builder/stager/hosting controls. The pure path policy
// in this file is intentionally separate so the non-deploying foundation can
// classify later controls without importing them.
const DEPLOYMENT_CONTROL_EXACT_PATHS = Object.freeze([
  '.firebaserc',
  '.openai/hosting.json',
  'CNAME',
  '_headers',
  '_redirects',
  '_routes.json',
  '_worker.js',
  'climate-public-beta/_headers',
  'firebase.json',
  'netlify.toml',
  'tools/build-climate-public-beta.sh',
  'tools/build-deploy.sh',
  'tools/check-climate-public-beta-diff-boundary.js',
  'tools/check-climate-public-beta-readiness.js',
  'tools/check-public-deploy-surface.js',
  'tools/check-staged-climate-public-beta-integrity.js',
  'tools/check-staged-production-integrity.js',
  'tools/lib/climate-public-beta-diff-boundary.js',
  'tools/lib/public-deploy-surface.js',
  'tools/org-setup.sh',
  'tools/stage-climate-public-beta.js',
  'tools/stage-public-deploy.js',
  'vercel.json',
  'wrangler.json',
  'wrangler.jsonc',
  'wrangler.toml',
]);

const DEPLOYMENT_CONTROL_PREFIXES = Object.freeze([
  '.github/workflows/',
  'functions/',
]);

const BETA_TOOL_PREFIXES = Object.freeze([
  'tools/lib/climate-public-beta-',
]);

const BETA_SCHEMA_PATTERN = /^data\/climate\/schemas\/public-beta-[^/]+\.schema\.json$/;
const BETA_FIXTURE_PATTERN = /^data\/climate\/fixtures\/(?:public-beta|climate-public-beta)-[^/]+\.json$/;
const BETA_TOOL_FIXTURE_PATTERN = /^tools\/fixtures\/climate-public-beta-[^/]+\.json$/;
const BETA_CHECKER_PATTERN = /^tools\/check-climate-public-beta-[^/]+\.(?:js|mjs)$/;
const BETA_TOOL_PATTERN = /^tools\/[^/]*climate-public-beta[^/]*$/;
const RELEASE_ARTIFACT_EXACT_PATHS = Object.freeze([
  RUNTIME_MANIFEST_PATH,
  'data/climate/public-beta/governance/approval-trust.json',
  'data/climate/public-beta/governance/feedback-privacy-contract.json',
  'data/climate/public-beta/governance/policy.json',
  'data/climate/public-beta/governance/public-surface-manifest.json',
  'data/climate/public-beta/governance/review-protocol.json',
]);
const RELEASE_ARTIFACT_PREFIXES = Object.freeze([
  'data/climate/public-beta/runtime/releases/',
  'data/climate/public-beta/governance/releases/',
]);

function normalizePath(value) {
  const raw = String(value || '');
  const segments = raw.split('/');
  if (!raw || raw.includes('\\') || raw.includes('\0') || raw.startsWith('/') ||
      segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('unsafe beta diff path: ' + value);
  }
  return raw;
}

function isDeploymentControlPath(value) {
  const relative = normalizePath(value);
  return DEPLOYMENT_CONTROL_EXACT_PATHS.includes(relative) ||
    DEPLOYMENT_CONTROL_PREFIXES.some(prefix => relative.startsWith(prefix));
}

function isBetaAffectingPath(value) {
  const relative = normalizePath(value);
  return isDeploymentControlPath(relative) ||
    BETA_EXACT_PATHS.includes(relative) ||
    BETA_PREFIXES.some(prefix => relative.startsWith(prefix)) ||
    BETA_TOOL_PREFIXES.some(prefix => relative.startsWith(prefix)) ||
    BETA_SCHEMA_PATTERN.test(relative) || BETA_FIXTURE_PATTERN.test(relative) ||
    BETA_TOOL_FIXTURE_PATTERN.test(relative) || BETA_TOOL_PATTERN.test(relative) ||
    BETA_CHECKER_PATTERN.test(relative);
}

function isReleaseArtifactPath(value) {
  const relative = normalizePath(value);
  return RELEASE_ARTIFACT_EXACT_PATHS.includes(relative) ||
    RELEASE_ARTIFACT_PREFIXES.some(prefix => relative.startsWith(prefix));
}

module.exports = {
  BETA_CHECKER_PATTERN,
  BETA_EXACT_PATHS,
  BETA_FIXTURE_PATTERN,
  BETA_PREFIXES,
  BETA_SCHEMA_PATTERN,
  BETA_TOOL_FIXTURE_PATTERN,
  BETA_TOOL_PATTERN,
  BETA_TOOL_PREFIXES,
  DEPLOYMENT_CONTROL_EXACT_PATHS,
  DEPLOYMENT_CONTROL_PREFIXES,
  RELEASE_ARTIFACT_EXACT_PATHS,
  RELEASE_ARTIFACT_PREFIXES,
  RUNTIME_MANIFEST_PATH,
  isBetaAffectingPath,
  isDeploymentControlPath,
  isReleaseArtifactPath,
  normalizePath,
};
