#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { compile, hashBytes } = require('./lib/climate-factual-runtime-candidate');

const ROOT = path.resolve(__dirname, '..');
const paths = {
  registry: 'data/climate/country-registry.json',
  promotion: 'data/climate/releases/primap-hist-2.6.1-factual-display-2026-07-15.json',
  review: 'data/climate/reviews/primap-hist-2.6.1-factual-display-ct10c-review.json',
  sourceRegistry: 'data/climate/source-registry.json',
  runtime: 'data/climate/runtime/country-factual-candidate.json',
  facts: 'data/climate/runtime/published-facts-candidate.json',
  batch: 'data/climate/runtime/ct10c-batch-attestation-wrapper.json',
  manifest: 'data/climate/runtime/candidate-manifest.json',
  rollback: 'data/climate/runtime/rollback-plan.json',
};

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function serialize(value) { return Buffer.from(JSON.stringify(value, null, 2) + '\n'); }
function write(relative, value) { fs.mkdirSync(path.dirname(path.join(ROOT, relative)), { recursive: true }); fs.writeFileSync(path.join(ROOT, relative), serialize(value)); }

const promotionBytes = bytes(paths.promotion);
const reviewBytes = bytes(paths.review);
const output = compile({ registry: json(paths.registry), promotion: JSON.parse(promotionBytes), promotionBytes, review: JSON.parse(reviewBytes), reviewBytes, sourceRegistry: json(paths.sourceRegistry) });
write(paths.runtime, output.runtime);
write(paths.facts, output.publishedFacts);
write(paths.batch, output.batchAttestation);

const manifest = {
  schema_version: '1.0.0', candidate_id: output.runtime.candidate_id,
  review_status: 'not_reviewed', decision: 'deny', release_eligible: false,
  production_runtime_release: false,
  reason_codes: ['ct42_independent_review_required', 'ct40_allow_manifest_absent', 'browser_accessibility_gates_pending'],
  inputs: [paths.registry, paths.promotion, paths.review, paths.sourceRegistry].map(file => ({ path: file, sha256: hashBytes(bytes(file)) })),
  outputs: [paths.runtime, paths.facts, paths.batch].map(file => ({ path: file, sha256: hashBytes(bytes(file)) })),
  runtime_files: ['index.html', 'css/globe-system.css', 'js/data.js', 'js/globe.js', 'sw.js', paths.runtime],
  compiler_files: ['js/country-ranking-compiler.js', 'js/country-climate-view-model.js', 'tools/lib/country-card-evidence-model.js', 'tools/lib/country-accessibility-model.js'],
  prohibited_release_files: ['data/climate/runtime-manifest.json', 'data/climate/releases/reviewed-release-diff.json', 'data/climate/releases/ct40-allow-manifest.json'],
};
write(paths.manifest, manifest);
write(paths.rollback, {
  schema_version: '1.0.0', candidate_id: output.runtime.candidate_id, review_status: 'not_reviewed',
  trigger: 'Any failed CT-42 review, CT-40 denial, factual pin mismatch, browser regression, or accessibility regression.',
  actions: [
    'Remove the candidate data fetch from js/data.js and restore the fail-closed empty country evidence state.',
    'Restore neutral country surfaces, alphabetical navigation, and the explicit evidence-withheld card copy.',
    'Remove candidate ranking and chart presentation without changing the reviewed CT-10C/CT-10C-R artifacts.',
    'Advance the service-worker cache version again and remove the CT-42 candidate JSON from pre-cache so no stale candidate survives rollback.',
    'Re-run legacy exit, truth CI partial mode, static checks, SmokeTest, and StackLint before another review.',
  ],
  automatic_release_authority: false,
});
console.log(`CT-42 candidate build: PASS (${output.runtime.coverage.registry_entities} entities; ${output.runtime.coverage.reviewed_series} reviewed factual series; ${output.runtime.coverage.source_gaps} gaps; ${output.publishedFacts.fact_count} facts)`);
