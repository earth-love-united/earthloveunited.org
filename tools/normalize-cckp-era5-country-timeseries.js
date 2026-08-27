#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT,
  assertSourceApproved,
  fileSha256,
  loadCountryRegistry,
  option,
  readJson,
  round,
  serializeCompact,
  sha256,
  verifySnapshot,
  writeJson,
} = require('./lib/country-climate-intelligence');

const SOURCE_ID = 'world-bank-cckp-era5-2026-08-25';
const VARIABLE_CONFIG = Object.freeze({
  pr: Object.freeze({ unit: 'mm/year' }),
  tas: Object.freeze({ unit: '°C' }),
});
const FIRST_SELECTED_YEAR = 1970;
const LAST_COMPLETE_YEAR = 2025;
const EXPECTED_RAW_ENTITY_COUNT = 246;
const EXPECTED_MAPPED_ENTITY_COUNT = 245;
const EXPECTED_REGISTRY_GAPS = ['ATA', 'ESH', 'FLK', 'SGS'];

function normalize(args) {
  const variable = option(args, '--variable', 'tas');
  const variableConfig = VARIABLE_CONFIG[variable];
  if (!variableConfig) throw new Error('--variable must be tas or pr');
  const inputPath = path.resolve(option(args, '--input'));
  const rawReceiptPath = path.resolve(option(args, '--raw-receipt'));
  const outputPath = path.resolve(option(args, '--output'));
  const outputReceiptPath = path.resolve(option(args, '--output-receipt'));
  const rawReceipt = readJson(rawReceiptPath);

  if (rawReceipt.source_registry_id !== SOURCE_ID) throw new Error('ERA5 raw receipt does not match the reviewed source component');
  if (rawReceipt.source_shape?.variable !== variable) throw new Error(`ERA5 raw receipt variable does not match ${variable}`);
  verifySnapshot(inputPath, rawReceipt);
  const sourceRegistry = readJson(path.join(ROOT, 'data/climate/source-registry.json'));
  assertSourceApproved(sourceRegistry, SOURCE_ID, ['iso_alpha3', 'variable', 'year', 'value', 'unit']);

  const raw = readJson(inputPath);
  if (raw?.metadata?.status !== 'success' || !raw.data || Array.isArray(raw.data) || typeof raw.data !== 'object') {
    throw new Error('CCKP ERA5 country response must contain a successful metadata record and a country-keyed data object');
  }
  const upstreamCodes = Object.keys(raw.data).sort();
  if (upstreamCodes.length !== EXPECTED_RAW_ENTITY_COUNT) {
    throw new Error(`CCKP ERA5 response contains ${upstreamCodes.length} upstream entities; expected ${EXPECTED_RAW_ENTITY_COUNT}`);
  }

  const registry = loadCountryRegistry();
  const registryByIso3 = new Map(registry.entities.map(entity => [entity.iso_alpha3, entity]));
  const dispositions = [];
  const rows = [];

  for (const upstreamCode of upstreamCodes) {
    const series = raw.data[upstreamCode];
    const upstreamId = `cckp-era5:${upstreamCode}:${variable}`;
    if (upstreamCode === 'KSV') {
      dispositions.push({
        unmapped_exception: 'CCKP uses KSV for Kosovo, which is not an ISO 3166-1 entity in the fixed 249-entity registry.',
        upstream_id: upstreamId,
      });
      continue;
    }
    const entity = registryByIso3.get(upstreamCode);
    if (!entity) throw new Error(`CCKP ERA5 upstream entity ${upstreamCode} has no registry mapping or reviewed exception`);
    if (!series || Array.isArray(series) || typeof series !== 'object') throw new Error(`CCKP ERA5 ${upstreamCode} series is not an object`);
    dispositions.push({ country_id: entity.country_id, upstream_id: upstreamId });

    const observations = Object.entries(series).map(([period, value]) => {
      const match = /^(\d{4})-07$/.exec(period);
      if (!match || !Number.isFinite(Number(value))) throw new Error(`CCKP ERA5 ${upstreamCode} contains an invalid annual observation at ${period}`);
      return { year: Number(match[1]), value: Number(value) };
    }).sort((left, right) => left.year - right.year);
    if (observations.length !== 76 || observations[0].year !== 1950 || observations.at(-1).year !== LAST_COMPLETE_YEAR) {
      throw new Error(`CCKP ERA5 ${upstreamCode} must contain one annual value for every year from 1950 through ${LAST_COMPLETE_YEAR}`);
    }
    if (new Set(observations.map(point => point.year)).size !== observations.length) {
      throw new Error(`CCKP ERA5 ${upstreamCode} contains duplicate annual observations`);
    }
    for (const point of observations.filter(point => point.year >= FIRST_SELECTED_YEAR)) {
      rows.push({
        iso_alpha3: entity.iso_alpha3,
        unit: variableConfig.unit,
        upstream_id: `${upstreamId}:${point.year}`,
        value: round(point.value),
        variable,
        year: point.year,
      });
    }
  }

  const mappedEntities = new Set(rows.map(row => row.iso_alpha3));
  if (mappedEntities.size !== EXPECTED_MAPPED_ENTITY_COUNT) {
    throw new Error(`CCKP ERA5 normalized snapshot maps ${mappedEntities.size} registry entities; expected ${EXPECTED_MAPPED_ENTITY_COUNT}`);
  }
  const registryGaps = registry.entities.map(entity => entity.iso_alpha3).filter(iso => !mappedEntities.has(iso)).sort();
  if (JSON.stringify(registryGaps) !== JSON.stringify(EXPECTED_REGISTRY_GAPS)) {
    throw new Error(`Unexpected CCKP ERA5 registry gaps: ${registryGaps.join(', ')}`);
  }
  if (rows.length !== EXPECTED_MAPPED_ENTITY_COUNT * (LAST_COMPLETE_YEAR - FIRST_SELECTED_YEAR + 1)) {
    throw new Error('CCKP ERA5 normalized row count is not deterministic');
  }

  const normalized = {
    rows,
    selection: {
      aggregation: 'annual',
      first_year: FIRST_SELECTED_YEAR,
      last_complete_year: LAST_COMPLETE_YEAR,
      model: 'ERA5 0.25-degree',
      source_aggregation: 'World Bank CCKP country area aggregate',
      unit: variableConfig.unit,
      variable,
    },
  };
  const normalizedSha256 = writeJson(outputPath, normalized);
  const receipt = {
    artifact_type: 'normalized_cckp_era5_country_timeseries_receipt',
    bytes: fs.statSync(outputPath).size,
    identity_accounting: {
      disposition_sha256: sha256(serializeCompact(dispositions)),
      mapped_iso_alpha3: Array.from(mappedEntities).sort(),
      mapped_registry_entities: mappedEntities.size,
      registry_gaps: registryGaps,
      rule: 'Each upstream country series maps once or receives one documented non-ISO exception; no parent-country substitution is allowed.',
      unmapped_exceptions: dispositions.filter(disposition => disposition.unmapped_exception),
      upstream_entities: upstreamCodes.length,
    },
    last_complete_year: LAST_COMPLETE_YEAR,
    normalized_fields: ['iso_alpha3', 'variable', 'year', 'value', 'unit'],
    raw_snapshot: {
      bytes: rawReceipt.bytes,
      retrieval_url: rawReceipt.retrieval_url,
      sha256: rawReceipt.sha256,
    },
    retrieved_on: rawReceipt.retrieved_on,
    sha256: normalizedSha256,
    source_registry_id: SOURCE_ID,
  };
  writeJson(outputReceiptPath, receipt);
  return { normalized, receipt };
}

function main() {
  const result = normalize(process.argv.slice(2));
  console.log(`Normalized ${result.receipt.identity_accounting.mapped_registry_entities} CCKP ERA5 country series through ${result.receipt.last_complete_year}.`);
  console.log(`Normalized SHA-256: ${result.receipt.sha256}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { normalize };
