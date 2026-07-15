#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT_REL = 'data/climate/evidence/major-emitter-ndc-source-audit.json';
const OUTPUT_REL = 'data/climate/releases/ct11-primary-source-pilot-2026-07-15.json';
const INPUT = path.join(ROOT, INPUT_REL);
const OUTPUT = path.join(ROOT, OUTPUT_REL);

const inputBytes = fs.readFileSync(INPUT);
const audit = JSON.parse(inputBytes);
const manifest = {
  schema_version: '1.0.0',
  data_release_id: 'ct11-primary-source-pilot-2026-07-15',
  methodology_version: audit.methodology_version,
  created_at: '2026-07-15T00:00:00Z',
  publication_status: 'blocked',
  release_gate: {
    status: audit.release_gate.status,
    normalized_values_allowed: audit.release_gate.normalized_values_allowed,
    reason_codes: audit.release_gate.reason_codes,
  },
  source_release_ids: [audit.canonical_contract.source_registry_id],
  artifacts: [
    {
      path: INPUT_REL,
      media_type: 'application/json',
      checksum_sha256: crypto.createHash('sha256').update(inputBytes).digest('hex'),
      document_count: audit.documents.length,
      target_component_count: audit.target_components.length,
    },
  ],
  coverage: {
    countries: [...new Set(audit.documents.map(item => item.country_id))].sort(),
    documents: audit.documents.length,
    target_components: audit.target_components.length,
    release_eligible: 0,
  },
  source_checksums: audit.documents.map(document => ({
    source_document_id: document.source_document_id,
    checksum_sha256: document.acquisition.checksum_sha256,
    checksum_state: document.acquisition.state,
    reason_codes: document.acquisition.reason_codes,
  })),
  review: audit.review,
  change_summary: 'Initial metadata-only primary-source audit for four high-emitter legacy cases. No Party text or normalized numeric target value is redistributed.',
};

const rendered = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
    console.error(`${OUTPUT_REL} is stale; run node tools/build-major-emitter-ndc-release.js`);
    process.exit(1);
  }
  console.log(`CT-11 release manifest is deterministic (${manifest.artifacts[0].checksum_sha256}).`);
} else {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, rendered);
  console.log(`Wrote ${OUTPUT_REL}`);
}
