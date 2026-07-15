#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { calculationHash } = require('./lib/primap-hist-ingest');

const ROOT = path.join(__dirname, '..');
const ATTESTATION_PATH = path.join(ROOT, 'data/climate/reviews/primap-hist-2.6.1-economy-wide-ct10b-review.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function main() {
  const sourcePath = process.argv[2];
  assert(sourcePath, 'usage: node tools/check-primap-review-attestation.js /path/to/PRIMAP.csv');

  const audit = spawnSync(process.execPath, [path.join(ROOT, 'tools/check-primap-economy-wide.js'), sourcePath], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (audit.status !== 0) throw new Error(`underlying CT-10B audit failed: ${(audit.stderr || audit.stdout).trim()}`);

  const review = JSON.parse(fs.readFileSync(ATTESTATION_PATH, 'utf8'));
  const artifactPath = path.join(ROOT, review.reviewed_inputs.artifact_path);
  const manifestPath = path.join(ROOT, review.reviewed_inputs.manifest_path);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert(review.schema_version === '1.0.0' && review.decision === 'pass', 'review decision is not a typed pass');
  assert(review.calculation_hash === calculationHash(review), 'review calculation hash mismatch');
  assert(review.reviewer.independent_of_builder === true, 'reviewer independence is not asserted');
  assert(review.reviewer.reviewer_id !== review.reviewer.builder_id, 'reviewer and builder identities must differ');
  assert(review.reviewed_commits.candidate_commit_sha === '28fdd61d029ed3e3dd97918360624228f5dcd9ee', 'candidate commit mismatch');
  assert(review.reviewed_commits.amendment_commit_sha === 'de6552d37e60db61f5f1ae251ea1bbc3e7d80af3', 'amendment commit mismatch');
  assert(review.reviewed_commits.source_decision_introducing_commit_sha === artifact.source.source_decision_introducing_commit_sha, 'source decision commit mismatch');
  assert(review.reviewed_commits.source_registry_reviewed_state_commit_sha === artifact.source.source_registry_reviewed_state_commit_sha, 'source registry reviewed-state commit mismatch');
  assert(sha256(artifactPath) === review.reviewed_inputs.artifact_sha256, 'reviewed artifact bytes changed');
  assert(sha256(manifestPath) === review.reviewed_inputs.manifest_sha256, 'reviewed manifest bytes changed');
  assert(artifact.calculation_hash === review.reviewed_inputs.artifact_calculation_hash, 'artifact calculation hash changed');
  assert(manifest.calculation_hash === review.reviewed_inputs.manifest_calculation_hash, 'manifest calculation hash changed');
  assert(artifact.schema_ref === review.reviewed_inputs.batch_schema_path, 'batch schema_ref changed');

  assert(review.counts.normalized_observations === 2060, 'review observation count changed');
  assert(review.counts.unique_normalized_fact_ids === 2060, 'review normalized ID count changed');
  assert(review.counts.unique_combined_source_and_normalized_fact_ids === 4120, 'review combined ID count changed');
  assert(review.counts.long_binary_tail_tokens === 0, 'review reports binary-tail tokens');
  assert(review.sample.length === 13, 'review sample must retain all 13 cases');
  const nru = review.sample.find(item => item.iso_alpha3 === 'NRU');
  const ata = review.sample.find(item => item.iso_alpha3 === 'ATA');
  assert(nru?.normalized_2014_mtco2e === '0.0537', 'NRU exact decimal attestation changed');
  assert(ata?.normalized_2023_mtco2e === '0.00334', 'ATA exact decimal attestation changed');
  assert(Object.values(review.prior_blockers).every(value => value === 'resolved'), 'a prior blocker is unresolved');

  const gate = review.publication_boundary;
  assert(gate.review_attestation_passed === true && gate.candidate_redistribution_allowed === true, 'candidate review boundary changed');
  assert(gate.assessed_use_allowed === false && gate.scoring_allowed === false, 'attestation crossed assessed/scoring gate');
  assert(gate.reviewed_site_release_allowed === false && gate.ct40_release_gate_required === true, 'attestation crossed CT-40/site-release gate');
  assert(gate.attestation_changes_candidate_artifacts === false, 'attestation claims to mutate candidate artifacts');
  assert(artifact.publication_gates.assessed_use.allowed === false && artifact.publication_gates.scoring.allowed === false, 'artifact assessment gates changed');
  assert(manifest.gates.reviewed_site_release_allowed === false && manifest.gates.scoring_allowed === false, 'manifest release gates changed');
  assert(Object.values(artifact.forbidden_outputs).every(value => value === false), 'artifact assigns a forbidden assessment output');

  process.stdout.write(audit.stdout);
  console.log('PRIMAP CT-10B-R attestation: PASS (independent candidate review; assessed/scoring/site release remain false)');
}

try {
  main();
} catch (error) {
  console.error(`PRIMAP CT-10B-R attestation: FAIL — ${error.message}`);
  process.exit(1);
}
