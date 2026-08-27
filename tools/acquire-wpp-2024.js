#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  fileSha256,
  loadCountryRegistry,
  readCsvSnapshot,
  writeJson,
} = require('./lib/country-climate-intelligence');

const EXPECTED = Object.freeze({
  bytes: 16557272,
  content_md5: 'ozQZwRtAcIbbevlCUsWpXQ==',
  file_name: 'WPP2024_Demographic_Indicators_Medium.csv.gz',
  last_modified: 'Fri, 13 Dec 2024 19:11:17 GMT',
  retrieval_url: 'https://population.un.org/wpp/assets/Excel%20Files/1_Indicator%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_Medium.csv.gz',
  sha256: '286ac36bb1415e2e1ade03acfef0a29f0e4c087e2f78e38c48f50c5df89082bc',
  source_catalog_url: 'https://population.un.org/wpp/assets/downloads.json',
});

function upstreamId(row) {
  return row.ISO3_code
    ? `wpp-2024:iso3:${row.ISO3_code}:2024:Medium`
    : `wpp-2024:loc:${row.LocID}:2024:Medium`;
}

function verify(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) throw new Error(`WPP snapshot not found: ${absolute}`);
  const bytes = fs.statSync(absolute).size;
  const sha256 = fileSha256(absolute);
  if (bytes !== EXPECTED.bytes || sha256 !== EXPECTED.sha256) {
    throw new Error(`WPP source mismatch: expected ${EXPECTED.bytes}/${EXPECTED.sha256}, received ${bytes}/${sha256}`);
  }
  return absolute;
}

function buildReceipt(file) {
  const absolute = verify(file);
  const registryIso3 = new Set(loadCountryRegistry().entities.map(entity => entity.iso_alpha3));
  const selected = readCsvSnapshot(absolute)
    .filter(row => Number(row.Time) === 2024 && row.Variant === 'Medium');
  if (selected.length !== 555) throw new Error(`Expected 555 WPP 2024 Medium rows, received ${selected.length}`);

  const identityExceptions = selected
    .filter(row => !registryIso3.has(row.ISO3_code))
    .map(row => {
      if (row.ISO3_code === 'XKX') {
        return {
          kind: 'unmapped_exception',
          reason: 'WPP publishes XKX for Kosovo, which is not an ISO 3166-1 entity in the fixed 249-entity registry.',
          upstream_id: upstreamId(row),
        };
      }
      if (row.ISO3_code) throw new Error(`Unexpected WPP country code outside the registry: ${row.ISO3_code}`);
      return {
        kind: 'aggregate_exception',
        reason: `UN WPP row “${row.Location}” is an aggregate or non-country grouping outside the fixed ISO registry.`,
        upstream_id: upstreamId(row),
      };
    });
  if (selected.length - identityExceptions.length !== 236 || identityExceptions.length !== 319) {
    throw new Error('WPP identity accounting differs from the reviewed 236 mappings / 319 exceptions');
  }

  return {
    artifact_type: 'raw_wpp_2024_receipt',
    raw_storage_policy: 'upstream_only_unarchived',
    bytes: EXPECTED.bytes,
    content_md5: EXPECTED.content_md5,
    content_type: 'application/x-gzip',
    file_name: EXPECTED.file_name,
    identity_accounting: {
      aggregate_exceptions: 318,
      mapped_registry_entities: 236,
      selected_rows: 555,
      unmapped_exceptions: 1,
    },
    identity_exceptions: identityExceptions,
    last_modified: EXPECTED.last_modified,
    retrieval_url: EXPECTED.retrieval_url,
    retrieved_on: '2026-08-27',
    selected_field: 'TPopulation1July',
    selected_period: '2024',
    selected_variant: 'Medium',
    sha256: EXPECTED.sha256,
    source_catalog_url: EXPECTED.source_catalog_url,
    source_registry_id: 'un-wpp-2024',
    year_classification_2024: 'projection',
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
    console.log(`WPP source verified: ${EXPECTED.file_name}`);
    console.log(`SHA-256: ${EXPECTED.sha256}`);
    return;
  }
  if (args.length === 3 && args[0] === '--receipt') {
    const receipt = buildReceipt(args[1]);
    const digest = writeJson(path.resolve(args[2]), receipt);
    console.log(`WPP raw receipt written: ${args[2]}`);
    console.log(`Receipt SHA-256: ${digest}`);
    return;
  }
  console.log('Usage: node tools/acquire-wpp-2024.js --metadata');
  console.log('       node tools/acquire-wpp-2024.js --verify /absolute/path/to/WPP2024_Demographic_Indicators_Medium.csv.gz');
  console.log('       node tools/acquire-wpp-2024.js --receipt /absolute/path/to/source.csv.gz /absolute/path/to/receipt.json');
  process.exitCode = 2;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { EXPECTED, buildReceipt, upstreamId, verify };
