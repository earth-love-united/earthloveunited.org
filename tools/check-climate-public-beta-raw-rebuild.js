#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseJsonNoDuplicateKeys } = require('./lib/json-schema-lite');
const {
  assertPinnedSource,
  buildArtifact,
  calculationHash,
  readSelectedRows,
  sha256,
} = require('./lib/primap-hist-ingest');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = 'data/climate/country-registry.json';
const CANDIDATE_PATH = 'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json';
const PROMOTION_PATH = 'data/climate/releases/primap-hist-2.6.1-factual-display-2026-07-15.json';
const EXPECTED_CANDIDATE_SHA256 = 'e242e5a49ba963eaeafe472c8c6702a193e79f60cf6762083f4ba72e9aa239b6';
const EXPECTED_CANDIDATE_CALCULATION = '8182081d7ef30e24731aac43e28f5f2b1b1316dd4721100bb8c069972cd1be49';
const FIXED_BUILD_TIME = '2026-07-15T00:00:00Z';

function readJson(relative) {
  return parseJsonNoDuplicateKeys(
    fs.readFileSync(path.join(ROOT, relative), 'utf8'), relative);
}

function canonicalSeries(series) {
  return series.map(item => ({
    country_id: item.country_id,
    iso_alpha3: item.iso_alpha3,
    source_locator: item.source_locator,
    values: item.values.map(point => ({
      year: point.year,
      value_mtco2e: point.value_mtco2e,
      normalized_value_decimal: point.normalized_value_decimal,
      fact_id: point.fact_id,
      source_fact_id: point.source_fact_id,
    })),
  }));
}

function compareRebuild(rebuilt, candidate, promotion) {
  assert.equal(rebuilt.schema_version, '1.0.0', 'raw rebuild schema drift');
  assert.equal(rebuilt.created_at, FIXED_BUILD_TIME, 'raw rebuild uses an unexpected deterministic build time');
  assert.equal(calculationHash(rebuilt), EXPECTED_CANDIDATE_CALCULATION, 'raw rebuild calculation hash drift');
  assert.equal(rebuilt.calculation_hash, EXPECTED_CANDIDATE_CALCULATION, 'raw rebuild embedded calculation hash drift');
  assert.deepEqual(rebuilt, candidate, 'fresh raw rebuild differs from the pinned CT-10B candidate bytes');
  const serialized = JSON.stringify(rebuilt, null, 2) + '\n';
  assert.equal(sha256(serialized), EXPECTED_CANDIDATE_SHA256, 'fresh raw rebuild serialized hash drift');
  assert.equal(promotion.inputs?.candidate?.sha256, EXPECTED_CANDIDATE_SHA256, 'CT-10C promotion candidate byte pin drift');
  assert.equal(promotion.inputs?.candidate?.calculation_hash, EXPECTED_CANDIDATE_CALCULATION,
    'CT-10C promotion candidate calculation pin drift');
  assert.deepEqual(canonicalSeries(rebuilt.series), promotion.series,
    'fresh raw rebuild factual series differ from the pinned CT-10C promotion');
  assert.equal(rebuilt.series.length, 206, 'fresh raw rebuild series count drift');
  assert.equal(rebuilt.series.reduce((total, item) => total + item.values.length, 0), 2060,
    'fresh raw rebuild observation count drift');
  assert.equal(rebuilt.registry_coverage.length, 249, 'fresh raw rebuild registry coverage drift');
  assert.equal(rebuilt.registry_coverage.filter(item => item.state === 'source_unavailable').length, 43,
    'fresh raw rebuild source-gap count drift');
  return {
    status: 'pass',
    candidate_sha256: EXPECTED_CANDIDATE_SHA256,
    candidate_calculation_hash: EXPECTED_CANDIDATE_CALCULATION,
    series: 206,
    observations: 2060,
    source_gaps: 43,
  };
}

function runSelfTest() {
  const candidate = readJson(CANDIDATE_PATH);
  const promotion = readJson(PROMOTION_PATH);
  assert.equal(compareRebuild(structuredClone(candidate), candidate, promotion).status, 'pass');
  const mutations = [
    rebuilt => { rebuilt.series[0].values[0].normalized_value_decimal = '0'; },
    rebuilt => { rebuilt.series[0].values[0].source_fact_id += ':drift'; },
    rebuilt => { rebuilt.series.pop(); },
    rebuilt => { rebuilt.registry_coverage.pop(); },
    rebuilt => { rebuilt.source_row_audit.mapped_country_rows -= 1; },
    rebuilt => { rebuilt.calculation_hash = '0'.repeat(64); },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(candidate);
    mutate(changed);
    assert.throws(() => compareRebuild(changed, candidate, promotion));
  }
  process.stdout.write(
    `Climate Public Beta raw-rebuild policy: PASS (${mutations.length} fail-closed mutations; no raw source fetched or release artifact created)\n`,
  );
}

async function runSource(sourcePath) {
  const sourceStat = fs.lstatSync(sourcePath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) throw new Error('--source must be a regular non-symlink file');
  const sourceHashes = assertPinnedSource(sourcePath);
  const registry = readJson(REGISTRY_PATH);
  const candidate = readJson(CANDIDATE_PATH);
  const promotion = readJson(PROMOTION_PATH);
  const selected = await readSelectedRows(sourcePath);
  const rebuilt = buildArtifact(registry, selected.selected, FIXED_BUILD_TIME);
  const report = compareRebuild(rebuilt, candidate, promotion);
  process.stdout.write(JSON.stringify({ ...report, source_sha256: sourceHashes.sha256 }, null, 2) + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') return runSelfTest();
  if (args.length === 2 && args[0] === '--source' && args[1]) return runSource(path.resolve(args[1]));
  throw new Error('usage: --self-test or --source /absolute/path/to/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv');
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write('Climate Public Beta raw rebuild: FAIL — ' + error.message + '\n');
    process.exitCode = 1;
  });
}

module.exports = { canonicalSeries, compareRebuild, runSelfTest };
