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

expectFailure('Climate TRACE checksum gate bypass', candidate => {
  sourceById(candidate, 'climate-trace-v5.9.0-country-annual')
    .ingestion_gate.exact_checksum_required = false;
}, /must pass every Country Climate Intelligence ingestion gate/);

expectFailure('Ember field permit removal', candidate => {
  const source = sourceById(candidate, 'ember-yearly-electricity-data-2026-08-25');
  source.ingestion_gate.field_permitlist = source.ingestion_gate.field_permitlist.filter(field => field !== 'Subcategory');
}, /must permitlist Subcategory/);

expectFailure('Ember metric permit extension bypass', candidate => {
  const source = sourceById(candidate, 'ember-yearly-electricity-data-2026-08-25');
  source.ingestion_gate.metric_permitlist = source.ingestion_gate.metric_permitlist.filter(metric => metric !== 'electricity.generation_share.nuclear');
}, /must retain the exact maintainer-authorized metric permitlist/);

expectFailure('ERA5 empty snapshot bypass', candidate => {
  const source = sourceById(candidate, 'world-bank-cckp-era5-2026-08-24');
  source.approval.state = 'approved';
  source.redistribution.status = 'permitted';
  source.redistribution.normalized_values = true;
  source.ingestion_gate.normalized_value_redistribution_approved = true;
}, /must remain an empty-snapshot gap source/);

expectFailure('ERA5 reviewed snapshot checksum gate bypass', candidate => {
  sourceById(candidate, 'world-bank-cckp-era5-2026-08-25')
    .ingestion_gate.exact_checksum_required = false;
}, /must pass every Country Climate Intelligence ingestion gate/);

expectFailure('PRIMAP v2.7 public ingestion', candidate => {
  const source = sourceById(candidate, 'primap-hist-2.7-final');
  source.approval.state = 'approved';
  source.redistribution.status = 'permitted';
  source.redistribution.normalized_values = true;
  source.storage.raw = 'external_only';
}, /must remain blocked from public value ingestion/);

console.log('Climate source registry regression tests passed (12 fail-closed mutations rejected).');
