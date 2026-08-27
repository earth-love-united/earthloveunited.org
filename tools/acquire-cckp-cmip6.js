#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  fileSha256,
  loadCountryRegistry,
  writeJson,
} = require('./lib/country-climate-intelligence');

const API_ROOT = 'https://cckpapi.worldbank.org/api/v1';
const GEOGRAPHY = 'global_countries';
const ROUTE_SUFFIX = 'ensemble_all_mean';
const EXPECTED = Object.freeze([
  ['pr-ssp126-median', 'pr', 'SSP1-2.6', 'ssp126', 'median', 5994, '135f2a4142fb8a7feba478d9598f9c2f8b783d09d6395291237b363dfb8969be', 'mm/year'],
  ['pr-ssp245-median', 'pr', 'SSP2-4.5', 'ssp245', 'median', 6012, '74d995363c4b5a91f527f45abf56ea845794f7dee5475144b2fdff5b7805e9f9', 'mm/year'],
  ['pr-ssp245-p10', 'pr', 'SSP2-4.5', 'ssp245', 'p10', 6219, 'c971a5bd6c03ee677f9571451d54f4e2ee49de0a2fab43bf3e04652e81ec0a6d', 'mm/year'],
  ['pr-ssp245-p90', 'pr', 'SSP2-4.5', 'ssp245', 'p90', 6037, '658e818d04b3b892bf5275e612071fd0d6f3418293845153e30fb50edb3f501b', 'mm/year'],
  ['pr-ssp585-median', 'pr', 'SSP5-8.5', 'ssp585', 'median', 6069, '8517fad49e794372a60e9c2f84f211e18f2f943558b6231bffe03b4157d20cb4', 'mm/year'],
  ['tas-ssp126-median', 'tas', 'SSP1-2.6', 'ssp126', 'median', 5704, 'aa89f3a01b517cdf10c993e4b7ee57730071674ac69c385aa313b602d3fd36c6', '°C'],
  ['tas-ssp245-median', 'tas', 'SSP2-4.5', 'ssp245', 'median', 5699, '931ea3fafa620ef92e3a48eb71406f673fae143a0df0191fd85b8227d7781b3b', '°C'],
  ['tas-ssp245-p10', 'tas', 'SSP2-4.5', 'ssp245', 'p10', 5711, '32f61e4290023112271f99f9270bb87dd804c3754705f78a547b0a02ee4b082b', '°C'],
  ['tas-ssp245-p90', 'tas', 'SSP2-4.5', 'ssp245', 'p90', 5713, '0195938a1f036784bbb0ef210d49841e08d22a8b9314b6b7422752110e6684f2', '°C'],
  ['tas-ssp585-median', 'tas', 'SSP5-8.5', 'ssp585', 'median', 5703, '635bc1c1d135105ec8870f11f686dd759a82b9d8518e1de1869dc127f9899476', '°C'],
].map(([id, variable, scenario, scenario_code, percentile, bytes, sha256, unit]) => Object.freeze({
  bytes,
  file_name: `${id}.json`,
  id,
  percentile,
  scenario,
  scenario_code,
  sha256,
  unit,
  url: `${API_ROOT}/cmip6-x0.25_climatology_${variable}_anomaly_annual_2040-2059_${percentile}_${scenario_code}_${ROUTE_SUFFIX}/${GEOGRAPHY}?_format=json`,
  variable,
})));

function verify(directory) {
  const absolute = path.resolve(directory);
  const registryIso3 = new Set(loadCountryRegistry().entities.map(entity => entity.iso_alpha3));
  let upstreamCodes = null;
  const verified = EXPECTED.map(expected => {
    const file = path.join(absolute, expected.file_name);
    if (!fs.existsSync(file)) throw new Error(`CCKP response not found: ${file}`);
    const bytes = fs.statSync(file).size;
    const sha256 = fileSha256(file);
    if (bytes !== expected.bytes || sha256 !== expected.sha256) {
      throw new Error(`CCKP ${expected.id} mismatch: expected ${expected.bytes}/${expected.sha256}, received ${bytes}/${sha256}`);
    }
    const response = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (response.metadata?.status !== 'success' || !response.data || Array.isArray(response.data)) {
      throw new Error(`CCKP ${expected.id} is not a successful country-keyed response`);
    }
    const codes = Object.keys(response.data).sort();
    if (codes.length !== 246 || !codes.includes('KSV')) throw new Error(`CCKP ${expected.id} must contain 246 upstream entities including KSV`);
    if (upstreamCodes && JSON.stringify(codes) !== JSON.stringify(upstreamCodes)) {
      throw new Error(`CCKP ${expected.id} country keys differ from the other projection responses`);
    }
    upstreamCodes = codes;
    for (const code of codes) {
      const periods = Object.keys(response.data[code] || {});
      if (periods.length !== 1 || periods[0] !== '2040-07' || !Number.isFinite(Number(response.data[code]['2040-07']))) {
        throw new Error(`CCKP ${expected.id}/${code} must contain one finite 2040-07 value`);
      }
    }
    return { expected, file, response };
  });

  const mapped = upstreamCodes.filter(code => registryIso3.has(code));
  const unexpected = upstreamCodes.filter(code => !registryIso3.has(code) && code !== 'KSV');
  if (mapped.length !== 245 || unexpected.length) throw new Error('CCKP projection identity accounting differs from 245 mappings plus KSV');
  return verified;
}

function buildReceipt(directory) {
  verify(directory);
  return {
    artifact_type: 'raw_cckp_cmip6_country_projection_receipt',
    raw_storage_policy: 'upstream_only_unarchived',
    artifacts: EXPECTED.map(expected => ({
      bytes: expected.bytes,
      content_type: 'application/json',
      file_name: expected.file_name,
      percentile: expected.percentile,
      retrieval_url: expected.url,
      scenario: expected.scenario,
      sha256: expected.sha256,
      unit: expected.unit,
      variable: expected.variable,
    })),
    identity_accounting: {
      mapped_registry_entities: 245,
      registry_gaps: ['ATA', 'ESH', 'FLK', 'SGS'],
      unmapped_exception: {
        reason: 'CCKP uses KSV for Kosovo, which is not an ISO 3166-1 entity in the fixed 249-entity registry.',
        upstream_code: 'KSV',
      },
      upstream_entities: 246,
    },
    period: '2040–2059 vs 1995–2014',
    response_metadata: {
      api_version: 'v1',
      content_type: 'application/json',
      retrieved_at: '2026-08-27T04:16:17Z',
      status: 'success',
    },
    retrieval_interface: 'https://climateknowledgeportal.worldbank.org/download-data',
    source_registry_id: 'world-bank-cckp-cmip6-2026-08-24',
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--metadata') {
    console.log(JSON.stringify(EXPECTED, null, 2));
    return;
  }
  if (args.length === 2 && args[0] === '--verify') {
    verify(args[1]);
    console.log(`Verified ${EXPECTED.length} exact CCKP CMIP6 country responses.`);
    return;
  }
  if (args.length === 3 && args[0] === '--receipt') {
    const digest = writeJson(path.resolve(args[2]), buildReceipt(args[1]));
    console.log(`CCKP CMIP6 raw receipt written: ${args[2]}`);
    console.log(`Receipt SHA-256: ${digest}`);
    return;
  }
  console.log('Usage: node tools/acquire-cckp-cmip6.js --metadata');
  console.log('       node tools/acquire-cckp-cmip6.js --verify /absolute/path/to/response-directory');
  console.log('       node tools/acquire-cckp-cmip6.js --receipt /absolute/path/to/response-directory /absolute/path/to/receipt.json');
  process.exitCode = 2;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { EXPECTED, buildReceipt, verify };
