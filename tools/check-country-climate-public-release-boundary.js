#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const publicSurface = require('./lib/public-deploy-surface');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME_PATH = publicSurface.CLIMATE_INTELLIGENCE_RUNTIME_PATH;
const MANIFEST_PATH = 'data/climate/releases/country-climate-intelligence-v1/release-manifest.json';

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function verifyBoundary(options = {}) {
  const runtime = options.runtime || readJson(RUNTIME_PATH);
  const manifest = options.manifest || readJson(MANIFEST_PATH);
  const always = options.always || publicSurface.ALWAYS_PUBLIC_PATHS;
  const candidate = options.candidate || publicSurface.CANDIDATE_ONLY_PATHS;
  const candidatePaths = options.candidatePaths || publicSurface.expectedSourcePaths(ROOT, 'candidate');
  const releaseProbe = options.releaseProbe || (() => publicSurface.expectedSourcePaths(ROOT, 'release'));

  assert.equal(always.includes(RUNTIME_PATH), false, 'CCI runtime must not be unconditionally public');
  assert.equal(candidate.includes(RUNTIME_PATH), true, 'CCI runtime must remain on the candidate-only surface');
  assert.equal(runtime?.release?.status, 'candidate', 'CCI runtime status must remain candidate');
  assert.equal(runtime?.release?.production_runtime_release, false, 'CCI runtime production release must remain false');
  assert.match(runtime?.release?.review_state || '', /pending_independent_scientific_review/,
    'CCI runtime must retain its pending independent-scientific-review state');
  assert.equal(manifest?.gates?.raw_receipt_revalidation, true, 'raw receipts must remain exactly revalidated');
  assert.equal(manifest?.gates?.redistribution_rights_revalidation, false, 'redistribution rights are not revalidated');
  assert.equal(manifest?.gates?.independent_scientific_review, false, 'independent scientific review is not complete');
  assert.equal(candidatePaths.includes(RUNTIME_PATH), true, 'local candidate surface must retain the CCI runtime');
  assert.throws(releaseProbe, /factual-public staging is blocked/,
    'active CCI entrypoints must refuse factual-public staging until approval');
  return true;
}

function runSelfTest() {
  const runtime = { release: { status: 'candidate', production_runtime_release: false, review_state: 'normalized_factual_candidate_pending_independent_scientific_review' } };
  const manifest = { gates: { raw_receipt_revalidation: true, redistribution_rights_revalidation: false, independent_scientific_review: false } };
  const base = {
    runtime,
    manifest,
    always: [],
    candidate: [RUNTIME_PATH],
    candidatePaths: [RUNTIME_PATH],
    releaseProbe() { throw new Error('factual-public staging is blocked'); },
  };
  assert.equal(verifyBoundary(base), true);
  assert.throws(() => verifyBoundary({ ...base, always: [RUNTIME_PATH] }), /unconditionally public/);
  assert.throws(() => verifyBoundary({ ...base, runtime: { release: { ...runtime.release, production_runtime_release: true } } }), /must remain false/);
  assert.throws(() => verifyBoundary({ ...base, manifest: { gates: { ...manifest.gates, independent_scientific_review: true } } }), /not complete/);
  assert.throws(() => verifyBoundary({ ...base, releaseProbe() { return []; } }), /must refuse/);
  process.stdout.write('Country Climate Intelligence public-release boundary self-test: PASS (5 fail-closed cases)\n');
}

function main() {
  if (process.argv.length === 3 && process.argv[2] === '--self-test') return runSelfTest();
  if (process.argv.length !== 2) throw new Error('usage: check-country-climate-public-release-boundary.js [--self-test]');
  verifyBoundary();
  process.stdout.write('Country Climate Intelligence public-release boundary: PASS (candidate retained; factual-public staging refused pending rights and scientific review)\n');
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write('Country Climate Intelligence public-release boundary: BLOCKED — ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { RUNTIME_PATH, verifyBoundary, runSelfTest };
