#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  assertPinnedSource,
  readSelectedRows,
  buildArtifact,
  calculationHash,
  sha256,
} = require('./lib/primap-hist-ingest');

const ROOT = path.join(__dirname, '..');
const ARTIFACT_PATH = path.join(ROOT, 'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json');
const MANIFEST_PATH = path.join(ROOT, 'data/climate/releases/primap-hist-2.6.1-economy-wide-2026-07-15.json');

async function main() {
  const sourcePath = process.argv[2];
  const createdAt = process.argv[3];
  if (!sourcePath || !createdAt) {
    throw new Error('usage: node tools/build-primap-economy-wide.js /path/to/PRIMAP.csv YYYY-MM-DDTHH:mm:ssZ');
  }
  const hashes = assertPinnedSource(sourcePath);
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/country-registry.json'), 'utf8'));
  const { selected } = await readSelectedRows(sourcePath);
  const artifact = buildArtifact(registry, selected, createdAt);
  const artifactJson = JSON.stringify(artifact, null, 2) + '\n';
  const artifactHash = sha256(artifactJson);
  const manifest = {
    schema_version: '1.0.0',
    release_id: 'primap-hist-2.6.1-economy-wide-candidates-2026-07-15',
    created_at: createdAt,
    input_hash_sha256: hashes.sha256,
    calculation_hash: null,
    source_release_id: 'primap-hist-2.6.1-final',
    artifact: {
      path: 'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json',
      schema_ref: 'data/climate/schemas/primap-batch-candidate.schema.json',
      media_type: 'application/json',
      checksum_sha256: artifactHash,
      size_bytes: Buffer.byteLength(artifactJson),
      series_count: artifact.series.length,
      fact_count: artifact.series.reduce((total, item) => total + item.values.length, 0),
    },
    coverage: {
      registry_entities: artifact.registry_coverage.length,
      mapped_candidates: artifact.source_row_audit.mapped_country_rows,
      registry_gaps: artifact.registry_coverage.filter(item => item.state === 'source_unavailable').length,
      aggregate_rows: artifact.source_row_audit.aggregate_rows,
      obsolete_rows: artifact.source_row_audit.obsolete_rows,
      unmapped_rows: artifact.source_row_audit.unmapped_rows,
      release_eligible: 0,
      scoring_eligible: 0,
    },
    review: {
      status: 'not_reviewed',
      builder_id: 'ct-10b-ingestion',
      reviewer_ids: [],
      reviewed_at: null,
    },
    gates: {
      assessed_use_allowed: false,
      scoring_allowed: false,
      candidate_redistribution_allowed: true,
      reviewed_site_release_allowed: false,
      ct40_required_result: 'deny_not_reviewed',
      reason_codes: ['climate_evidence_not_reviewed', 'independent_review_required'],
    },
  };
  manifest.calculation_hash = calculationHash(manifest);

  fs.mkdirSync(path.dirname(ARTIFACT_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(ARTIFACT_PATH, artifactJson);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ artifact: ARTIFACT_PATH, manifest: MANIFEST_PATH, coverage: manifest.coverage, artifact_sha256: artifactHash }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
