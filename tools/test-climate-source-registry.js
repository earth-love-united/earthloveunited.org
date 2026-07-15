#!/usr/bin/env node
/**
 * Regression tests for the source-registry fail-closed gates.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateRegistry } = require('./check-climate-source-registry');

const ROOT = path.resolve(__dirname, '..');
const registry = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data/climate/source-registry.json'), 'utf8')
);

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function sourceById(value, id) {
  return value.sources.find(source => source.id === id);
}

function expectFailure(name, mutate, pattern) {
  const candidate = copy(registry);
  mutate(candidate);
  const errors = validateRegistry(candidate);
  assert(
    errors.some(error => pattern.test(error)),
    `${name} did not fail as expected. Errors: ${errors.join(' | ')}`
  );
}

assert.deepStrictEqual(validateRegistry(registry), [], 'Reviewed registry must pass.');

expectFailure('Debian checksum mutation', candidate => {
  sourceById(candidate, 'debian-iso-codes-4.20.1-1-iso-3166-1').artifact.sha256 = '0'.repeat(64);
}, /reviewed SHA-256/);

expectFailure('Debian 248-row truncation', candidate => {
  sourceById(candidate, 'debian-iso-codes-4.20.1-1-iso-3166-1').artifact.expected_record_count = 248;
}, /exactly 249 source rows/);

expectFailure('Debian separate-asset bypass', candidate => {
  sourceById(candidate, 'debian-iso-codes-4.20.1-1-iso-3166-1').storage.separate_asset_required = false;
}, /separate_asset_required must remain true/);

expectFailure('UN M49 premature approval', candidate => {
  const source = sourceById(candidate, 'un-m49-continuous-2026-07-15');
  source.approval.state = 'approved';
  source.licence.status = 'confirmed';
  source.redistribution.status = 'permitted';
  source.redistribution.normalized_values = true;
}, /must remain pending and metadata-only/);

expectFailure('Legacy lineage bypass', candidate => {
  sourceById(candidate, 'legacy-pledge-nodes-climate-watch-wri-family-2025-07-18')
    .legacy_gate.field_lineage_required = false;
}, /must require field-level lineage/);

expectFailure('Legacy scoring bypass', candidate => {
  sourceById(candidate, 'legacy-pledge-nodes-climate-watch-wri-family-2025-07-18')
    .legacy_gate.scoring_allowed = true;
}, /scoring_allowed must remain false/);

console.log('Climate source registry regression tests passed (6 fail-closed mutations rejected).');
