#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  ROOT,
  fileSha256,
  option,
  readJson,
  writeJson,
} = require('./lib/country-climate-intelligence');

const FROM_ID = 'climate-trace-v5.9.0-country-annual';
const TO_ID = 'climate-trace-api-v7-2026-08-24-country-annual';
const DEFAULT_COMPONENT = path.join(
  ROOT,
  'data/climate/releases/country-climate-intelligence-v1/climate-trace-ghg.json'
);

function migrate(args) {
  const inputPath = path.resolve(option(args, '--input', DEFAULT_COMPONENT));
  const outputPath = path.resolve(option(args, '--output', inputPath));
  const expectedSha256 = option(args, '--expected-sha256');
  if (!/^[a-f0-9]{64}$/.test(expectedSha256 || '')) {
    throw new Error('--expected-sha256 is required and must be a lowercase SHA-256 digest');
  }
  const actualSha256 = fileSha256(inputPath);
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Climate TRACE component SHA mismatch: expected ${expectedSha256}, received ${actualSha256}`);
  }

  const artifact = readJson(inputPath);
  if (artifact.source_registry_ids?.length !== 1 || artifact.source_registry_ids[0] !== FROM_ID) {
    throw new Error('Climate TRACE component does not contain the expected legacy source identity');
  }
  let available = 0;
  artifact.countries.forEach(country => {
    const metric = country.metrics?.['emissions.ghg.independent'];
    if (!metric || metric.source_ids?.length !== 1 || metric.source_ids[0] !== FROM_ID) {
      throw new Error(`${country.iso_alpha3 || country.country_id} does not contain one legacy Climate TRACE source identity`);
    }
    metric.source_ids = [TO_ID];
    if (metric.value !== null) {
      metric.fact_ids = [`climate-trace-api-v7:${country.iso_alpha3}:co2e100:2024`];
      metric.context.source_identity = {
        api_version: 'v7',
        immutable_inventory_release_confirmed: false,
        reported_inventory_version: '5.9.0',
        retrieval_date: '2026-08-24',
      };
      available += 1;
    }
  });
  if (available !== 249) throw new Error(`Expected 249 available Climate TRACE records, received ${available}`);
  artifact.source_registry_ids = [TO_ID];
  artifact.contract_migration = {
    from_source_id: FROM_ID,
    input_sha256: actualSha256,
    script: 'tools/migrate-climate-trace-source-identity.js',
    to_source_id: TO_ID,
    value_changes: false,
  };
  const digest = writeJson(outputPath, artifact);
  return { available, digest };
}

function main() {
  const result = migrate(process.argv.slice(2));
  process.stdout.write(`Migrated ${result.available} Climate TRACE source identities without changing values.\n`);
  process.stdout.write(`Artifact SHA-256: ${result.digest}\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { FROM_ID, TO_ID, migrate };
