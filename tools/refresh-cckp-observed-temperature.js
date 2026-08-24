#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  ENTITY_COUNT,
  ROOT,
  assertEntityPartition,
  fileSha256,
  option,
  readJson,
  verifySnapshot,
  writeJson,
} = require('./lib/country-climate-intelligence');
const { observedMetric } = require('./compile-cckp-physical');

const SOURCE_ID = 'world-bank-cckp-era5-2026-08-25';
const METRIC_ID = 'climate.temperature.observed_trend';

function refresh(args) {
  const basePath = path.resolve(option(args, '--base'));
  const expectedBaseSha = option(args, '--expected-base-sha');
  const observedPath = path.resolve(option(args, '--observed-input'));
  const observedReceiptPath = path.resolve(option(args, '--observed-receipt'));
  const outputPath = path.resolve(option(args, '--output'));
  const releaseId = option(args, '--release-id');
  if (!/^[a-f0-9]{64}$/.test(expectedBaseSha || '')) throw new Error('--expected-base-sha must pin the reviewed component');
  if (fileSha256(basePath) !== expectedBaseSha) throw new Error('Reviewed CCKP base component checksum mismatch');

  const base = readJson(basePath);
  const receipt = readJson(observedReceiptPath);
  if (receipt.source_registry_id !== SOURCE_ID) throw new Error('Observed receipt source does not match the reviewed ERA5 component');
  verifySnapshot(observedPath, receipt);
  const observed = readJson(observedPath);
  if (!Array.isArray(observed.rows)) throw new Error('Normalized observed snapshot must contain rows');
  if (base.entity_count !== ENTITY_COUNT || !Array.isArray(base.countries) || base.countries.length !== ENTITY_COUNT) {
    throw new Error('Reviewed CCKP base component must contain exactly 249 entities');
  }

  const rowsByIso3 = new Map();
  for (const row of observed.rows) {
    if (row.variable !== 'tas' || row.unit !== '°C') throw new Error('Observed temperature refresh accepts only annual tas values in °C');
    const rows = rowsByIso3.get(row.iso_alpha3) || [];
    rows.push(row);
    rowsByIso3.set(row.iso_alpha3, rows);
  }

  const countries = base.countries.map(country => {
    const metric = observedMetric(country, 'tas', rowsByIso3.get(country.iso_alpha3) || [], receipt.last_complete_year, false);
    if (metric.value !== null) metric.review_state = 'normalized_candidate_pending_source_revalidation';
    return {
      ...country,
      metrics: {
        ...country.metrics,
        [METRIC_ID]: metric,
      },
    };
  });
  assertEntityPartition(countries);
  const available = countries.filter(country => Number.isFinite(country.metrics[METRIC_ID].value)).length;
  if (available !== 245) throw new Error(`Observed temperature refresh produced ${available} values; expected 245`);

  const artifact = {
    ...base,
    candidate_metadata_correction: {
      ...(base.candidate_metadata_correction || {}),
      observed_temperature_values_changed: true,
      reason: 'Replaced reviewed empty-response gaps with the exact-checksummed CCKP ERA5 1970–2025 country series and derived OLS slopes.',
    },
    countries,
    generated_on: receipt.retrieved_on,
    observed_temperature_refresh: {
      base_component_sha256: expectedBaseSha,
      normalized_receipt_path: path.relative(ROOT, observedReceiptPath),
      normalized_receipt_sha256: fileSha256(observedReceiptPath),
      precipitation_values_changed: false,
      projection_values_changed: false,
      source_registry_id: SOURCE_ID,
    },
    release_id: releaseId,
    source_registry_ids: ['world-bank-cckp-cmip6-2026-08-24', SOURCE_ID],
  };
  const sha256 = writeJson(outputPath, artifact);
  return { available, sha256 };
}

function main() {
  const result = refresh(process.argv.slice(2));
  console.log(`Refreshed observed temperature for ${result.available} registry entities.`);
  console.log(`Component SHA-256: ${result.sha256}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { refresh };
