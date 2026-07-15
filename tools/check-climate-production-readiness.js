#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateReadiness, parseReadinessArgs, releaseWorktreeCleanPasses } = require('./lib/climate-production-readiness');
const { PATHS: REVIEWED_RELEASE_PATHS, SCHEMAS: REVIEWED_RELEASE_SCHEMAS, inspectReviewedClimateRelease } = require('./lib/climate-reviewed-release');
const { EXPECTED_ASSETS, REQUIRED_UI_REVIEW_PIN_PATHS } = require('./lib/globe-runtime-assets');
const {
  APPROVAL_SCHEMA_PATH,
  INTEGRATION_PATH: NOTICE_INTEGRATION_PATH,
  MANIFEST_PATH: NOTICE_MANIFEST_PATH,
  NOTICE_PATH,
} = require('./lib/globe-third-party-notices');
const {
  APPROVAL_PATH: RUNTIME_ASSET_APPROVAL_PATH,
  SIGNATURE_BUNDLE_PATH,
  TRUST_REGISTRY_PATH,
} = require('./lib/globe-runtime-approval');

const ROOT = path.resolve(__dirname, '..');
const { mode, jsonOnly } = parseReadinessArgs(process.argv.slice(2));
const P = Object.freeze({
  dataReview: 'data/climate/reviews/climate-factual-runtime-candidate-ct42-data-review.json',
  uiReview: 'data/climate/reviews/climate-factual-runtime-ct42-ui-review.json',
  ct40Deny: 'data/climate/reviews/ct42-ct40-release-review-result.json',
  top20Queue: 'data/climate/releases/top20-primary-source-gap-queue-2026-07-15.json',
  evidenceReadiness: 'data/climate/releases/climate-evidence-licensing-readiness-2026-07-15.json',
  runtimeManifest: REVIEWED_RELEASE_PATHS.runtimeManifest,
  releaseInput: REVIEWED_RELEASE_PATHS.releaseInput,
  releaseDiff: REVIEWED_RELEASE_PATHS.releaseDiff,
  allowManifest: REVIEWED_RELEASE_PATHS.allowManifest,
  rollbackProof: REVIEWED_RELEASE_PATHS.rollbackProof,
  runtimeAssets: 'assets/globe/runtime/manifest.json',
  noticeIntegration: NOTICE_INTEGRATION_PATH,
  runtimeAssetApproval: RUNTIME_ASSET_APPROVAL_PATH,
  runtimeAssetSignatureBundle: SIGNATURE_BUNDLE_PATH,
  runtimeAssetTrustRegistry: TRUST_REGISTRY_PATH,
});

function exists(relative) { return fs.existsSync(path.join(ROOT, relative)); }
function sha256(relative) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relative))).digest('hex'); }
function read(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')); }
function required(relative) {
  if (!exists(relative)) throw new Error(`required readiness input missing: ${relative}`);
  return read(relative);
}

function entryPresent(relative) {
  try { fs.lstatSync(path.join(ROOT, relative)); return true; }
  catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function readRegularJson(relative) {
  if (!regularNonSymlink(relative)) return { value: null, text: null };
  const text = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  return { value: JSON.parse(text), text };
}

function run(command, args) {
  const result = childProcess.spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' } });
  return { pass: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}` };
}

function javascriptSyntaxPasses() {
  const roots = ['js', 'dis', 'tools'];
  const files = [];
  const visit = relative => {
    if (!exists(relative)) return;
    for (const entry of fs.readdirSync(path.join(ROOT, relative), { withFileTypes: true })) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isDirectory() && entry.name !== 'vendor') visit(child);
      else if (entry.isFile() && child.endsWith('.js')) files.push(child);
    }
  };
  roots.forEach(visit);
  return files.every(relative => childProcess.spawnSync(process.execPath, ['--check', relative], { cwd: ROOT, encoding: 'utf8' }).status === 0);
}

function runTruthCi() {
  const args = ['tools/climate-truth-ci.js', mode === 'release' ? '--strict' : '--allow-incomplete'];
  const run = childProcess.spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' } });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const statusMatch = output.match(/^\[(PASS|INCOMPLETE|FAIL)\] climate truth CI /m);
  const missingMatch = output.match(/^\[INCOMPLETE\] missing required stack components: (.+)$/m);
  return {
    status: statusMatch ? statusMatch[1].toLowerCase() : 'fail',
    missing_required_components: missingMatch ? missingMatch[1].split(',').map(value => value.trim()).filter(Boolean) : [],
    exit_code: run.status,
    output,
  };
}

function regularNonSymlink(relative) {
  try {
    const normalized = path.posix.normalize(String(relative).replaceAll(path.sep, '/'));
    if (!normalized || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) return false;
    const rootStat = fs.lstatSync(ROOT);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return false;
    let current = ROOT;
    const parts = normalized.split('/');
    for (let index = 0; index < parts.length; index += 1) {
      current = path.join(current, parts[index]);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return false;
      if (index < parts.length - 1 && !stat.isDirectory()) return false;
      if (index === parts.length - 1 && !stat.isFile()) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function currentCommitSha() {
  const result = childProcess.spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  const value = result.status === 0 ? result.stdout.trim() : '';
  return /^[0-9a-f]{40}$/.test(value) ? value : null;
}

function reviewedCommitBindingPasses(approval) {
  const reviewed = approval?.reviewed_commit_sha;
  if (!/^[0-9a-f]{40}$/.test(reviewed || '')) return false;
  const ancestor = childProcess.spawnSync('git', ['merge-base', '--is-ancestor', reviewed, 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  if (ancestor.status !== 0) return false;
  const reviewedPaths = [...new Set([
    ...REQUIRED_UI_REVIEW_PIN_PATHS,
    NOTICE_PATH,
    NOTICE_MANIFEST_PATH,
    NOTICE_INTEGRATION_PATH,
    APPROVAL_SCHEMA_PATH,
    TRUST_REGISTRY_PATH,
    'index.html',
    'CREDITS.md',
    '.github/workflows/ci.yml',
    'tools/check-globe-runtime-assets.js',
    'tools/lib/globe-runtime-assets.js',
    'tools/fixtures/globe-runtime-assets.json',
    'tools/check-globe-third-party-notices.js',
    'tools/lib/globe-third-party-notices.js',
    'tools/fixtures/globe-third-party-notices.json',
    'tools/check-globe-runtime-approval.js',
    'tools/lib/globe-runtime-approval.js',
    'tools/check-staged-production-integrity.js',
    'tools/build-deploy.sh',
    'tools/stage-public-deploy.js',
    'tools/check-public-deploy-surface.js',
    'tools/lib/public-deploy-surface.js',
    '_headers',
    'docs/LEGACY-COUNTRY-DATA-EXIT.md',
    'tools/climate-truth-ci.js',
    'tools/check-climate-release-gate.js',
    'tools/lib/climate-release-gate.js',
    'tools/check-climate-truth-ci.js',
    'tools/lib/climate-truth-ci-policy.js',
    'tools/check-reviewed-climate-release.js',
    'tools/lib/climate-reviewed-release.js',
    'tools/lib/reviewed-runtime-rollback-proof.js',
    'tools/lib/json-schema-lite.js',
    ...Object.values(REVIEWED_RELEASE_SCHEMAS),
    ...Object.values(REVIEWED_RELEASE_PATHS),
    'tools/lib/climate-runtime-diff-boundary.js',
    'tools/lib/climate-production-readiness.js',
    'tools/check-climate-production-readiness.js',
    'tools/check-climate-production-readiness-policy.js',
  ])];
  const diff = childProcess.spawnSync('git', ['diff', '--quiet', reviewed, 'HEAD', '--', ...reviewedPaths], { cwd: ROOT, encoding: 'utf8' });
  return diff.status === 0;
}

const dataReview = required(P.dataReview);
const uiReview = required(P.uiReview);
const top20Queue = required(P.top20Queue);
const evidenceReadiness = required(P.evidenceReadiness);
const denyResult = required(P.ct40Deny);
const reviewedRelease = inspectReviewedClimateRelease(ROOT);
const ct40 = mode === 'release' ? (reviewedRelease.canonical_output || {}) : denyResult;
const truthCi = runTruthCi();
const canonicalLinks = run(process.execPath, ['tools/check-canonical-source-links.js']);
const publicCopy = run(process.execPath, ['tools/check-public-copy.js']);
const ct45 = run(process.execPath, ['tools/check-globe-runtime-assets.js']);
const notices = run(process.execPath, ['tools/check-globe-third-party-notices.js']);
const loadOrder = run('python3', ['scripts/verify_load_order.py']);
const runtimeAssetApprovalPresent = entryPresent(P.runtimeAssetApproval);
const runtimeAssetApprovalRegular = regularNonSymlink(P.runtimeAssetApproval);
const runtimeAssetApprovalRecord = readRegularJson(P.runtimeAssetApproval);
const runtimeAssetApproval = runtimeAssetApprovalRecord.value;
const runtimeAssetSignatureBundlePresent = entryPresent(P.runtimeAssetSignatureBundle);
const runtimeAssetSignatureBundleRegular = regularNonSymlink(P.runtimeAssetSignatureBundle);
const runtimeAssetSignatureBundleRecord = readRegularJson(P.runtimeAssetSignatureBundle);
const runtimeAssetTrustRegistryRegular = regularNonSymlink(P.runtimeAssetTrustRegistry);
const runtimeAssetTrustRegistryRecord = readRegularJson(P.runtimeAssetTrustRegistry);
const noticeIntegration = required(P.noticeIntegration);

const report = evaluateReadiness({
  mode,
  data_review: {
    decision: dataReview.decision,
    independent: dataReview.reviewer?.independent_of_builder === true,
  },
  ui_review: {
    decision: uiReview.decision,
    independent: uiReview.independent === true,
  },
  canonical_source_links_passed: canonicalLinks.pass,
  public_copy_passed: publicCopy.pass,
  load_order_passed: loadOrder.pass,
  javascript_syntax_passed: javascriptSyntaxPasses(),
  ct40: {
    decision: ct40.decision,
    eligible: ct40.eligible ?? ct40.release_eligible,
    release_authority: reviewedRelease.content_eligible === true,
    reason_codes: ct40.reason_codes || [],
  },
  reviewed_release: reviewedRelease,
  top20_queue: top20Queue,
  evidence_readiness: evidenceReadiness,
  top20_primary_source_review_complete: reviewedRelease.top20_primary_source_review_complete === true,
  licence_decisions_complete: reviewedRelease.licence_decisions_complete === true,
  field_level_fact_reviews_complete: reviewedRelease.field_level_fact_reviews_complete === true,
  independent_release_review_passed: reviewedRelease.independent_release_review_passed === true,
  release_worktree_clean_passed: releaseWorktreeCleanPasses(ROOT),
  artifacts: {
    runtime_manifest: entryPresent(P.runtimeManifest),
    release_input: entryPresent(P.releaseInput),
    release_diff: entryPresent(P.releaseDiff),
    allow_manifest: entryPresent(P.allowManifest),
    rollback_proof: entryPresent(P.rollbackProof),
  },
  truth_ci: truthCi,
  runtime_assets: {
    integrity_passed: ct45.pass,
    notices_integrity_passed: notices.pass,
    manifest: required(P.runtimeAssets),
    notice_integration: noticeIntegration,
    asset_rights_dispositions: noticeIntegration.asset_rights_dispositions,
    manifest_sha256: sha256(P.runtimeAssets),
    asset_pins: EXPECTED_ASSETS.map(asset => ({ path: asset.path, sha256: sha256(asset.path) })),
    current_commit_sha: currentCommitSha(),
    reviewed_commit_binding_passed: reviewedCommitBindingPasses(runtimeAssetApproval),
    reviewed_release_passed: reviewedRelease.pass === true && reviewedRelease.status === 'validated',
    approval_review_present: runtimeAssetApprovalPresent,
    approval_file_regular: runtimeAssetApprovalRegular,
    approval: runtimeAssetApproval,
    approval_text: runtimeAssetApprovalRecord.text,
    trust_registry_file_regular: runtimeAssetTrustRegistryRegular,
    trust_registry: runtimeAssetTrustRegistryRecord.value,
    trust_registry_text: runtimeAssetTrustRegistryRecord.text,
    signature_bundle_present: runtimeAssetSignatureBundlePresent,
    signature_bundle_file_regular: runtimeAssetSignatureBundleRegular,
    signature_bundle: runtimeAssetSignatureBundleRecord.value,
    signature_bundle_text: runtimeAssetSignatureBundleRecord.text,
  },
});

if (jsonOnly) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`Climate production readiness: ${report.status.toUpperCase()} (${mode})\n`);
  report.checks.forEach(item => process.stdout.write(`[${item.pass ? 'PASS' : 'BLOCK'}] ${item.id} — ${item.detail}\n`));
  if (mode === 'candidate' && report.ready) {
    process.stdout.write('Candidate integrity is ready; production release remains intentionally blocked.\n');
  }
}

if (!report.ready) process.exitCode = 1;

module.exports = { report };
