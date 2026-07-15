#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateReadiness } = require('./lib/climate-production-readiness');

const ROOT = path.resolve(__dirname, '..');
const mode = process.argv.includes('--release') ? 'release' : 'candidate';
const jsonOnly = process.argv.includes('--json');
const P = Object.freeze({
  dataReview: 'data/climate/reviews/climate-factual-runtime-candidate-ct42-data-review.json',
  uiReview: 'data/climate/reviews/climate-factual-runtime-ct42-ui-review.json',
  ct40Deny: 'data/climate/reviews/ct42-ct40-release-review-result.json',
  top20Queue: 'data/climate/releases/top20-primary-source-gap-queue-2026-07-15.json',
  runtimeManifest: 'data/climate/runtime-manifest.json',
  releaseDiff: 'data/climate/releases/reviewed-release-diff.json',
  allowManifest: 'data/climate/releases/ct40-allow-manifest.json',
  rollbackProof: 'data/climate/releases/reviewed-rollback-proof.json',
});

function exists(relative) { return fs.existsSync(path.join(ROOT, relative)); }
function read(relative) { return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')); }
function required(relative) {
  if (!exists(relative)) throw new Error(`required readiness input missing: ${relative}`);
  return read(relative);
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

const dataReview = required(P.dataReview);
const uiReview = required(P.uiReview);
const top20Queue = required(P.top20Queue);
const denyResult = required(P.ct40Deny);
const allowManifest = exists(P.allowManifest) ? read(P.allowManifest) : null;
const ct40 = mode === 'release' && allowManifest ? allowManifest : denyResult;
const truthCi = runTruthCi();
const canonicalLinks = run(process.execPath, ['tools/check-canonical-source-links.js']);
const publicCopy = run(process.execPath, ['tools/check-public-copy.js']);
const loadOrder = run('python3', ['scripts/verify_load_order.py']);
const reviewContext = allowManifest?.review_context || {};
const releaseReview = allowManifest?.review || {};

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
    release_authority: ct40.release_authority === true,
    reason_codes: ct40.reason_codes || [],
  },
  top20_queue: top20Queue,
  top20_primary_source_review_complete: reviewContext.top20_primary_source_review_complete === true,
  licence_decisions_complete: reviewContext.licence_decisions_complete === true,
  field_level_fact_reviews_complete: reviewContext.field_level_fact_reviews_complete === true,
  independent_release_review_passed: releaseReview.status === 'reviewed' && releaseReview.independent === true,
  artifacts: {
    runtime_manifest: exists(P.runtimeManifest),
    release_diff: exists(P.releaseDiff),
    allow_manifest: exists(P.allowManifest),
    rollback_proof: exists(P.rollbackProof),
  },
  truth_ci: truthCi,
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
