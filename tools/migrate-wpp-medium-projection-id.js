#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
  ROOT,
  fileSha256,
  option,
  readJson,
  scopeFingerprint,
  writeJson,
} = require('./lib/country-climate-intelligence');

const FROM_ID = 'population.estimate';
const TO_ID = 'population.wpp_medium_projection';
const DEFAULT_COMPONENT = path.join(
  ROOT,
  'data/climate/releases/country-climate-intelligence-v1/wpp-population.json'
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
    throw new Error(`WPP component SHA mismatch: expected ${expectedSha256}, received ${actualSha256}`);
  }

  const artifact = readJson(inputPath);
  if (artifact.metric_ids?.length !== 1 || artifact.metric_ids[0] !== FROM_ID) {
    throw new Error(`WPP component must contain exactly the legacy ${FROM_ID} metric`);
  }
  let available = 0;
  artifact.countries.forEach(country => {
    const legacy = country.metrics?.[FROM_ID];
    if (!legacy || legacy.id !== FROM_ID || Object.hasOwn(country.metrics, TO_ID)) {
      throw new Error(`${country.iso_alpha3 || country.country_id} does not contain one legacy WPP metric`);
    }
    if (legacy.value !== null) {
      if (legacy.status !== 'modeled' || legacy.context?.release_year_classification !== 'year_matched_2024_medium_projection') {
        throw new Error(`${country.iso_alpha3} legacy WPP value is not already classified as a modeled 2024 Medium projection`);
      }
      if (legacy.scope?.metric !== FROM_ID) throw new Error(`${country.iso_alpha3} legacy WPP scope is inconsistent`);
      legacy.scope.metric = TO_ID;
      legacy.scope_fingerprint = scopeFingerprint(legacy.scope);
      available += 1;
    }
    legacy.id = TO_ID;
    country.metrics = { [TO_ID]: legacy };
  });
  if (available !== 236) throw new Error(`Expected 236 available WPP projections, received ${available}`);
  artifact.metric_ids = [TO_ID];
  artifact.contract_migration = {
    from_metric_id: FROM_ID,
    input_sha256: actualSha256,
    script: 'tools/migrate-wpp-medium-projection-id.js',
    to_metric_id: TO_ID,
    value_changes: false,
  };
  const digest = writeJson(outputPath, artifact);
  return { digest, available };
}

function main() {
  const result = migrate(process.argv.slice(2));
  process.stdout.write(`Migrated ${result.available} WPP projection records without changing values.\n`);
  process.stdout.write(`Artifact SHA-256: ${result.digest}\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { FROM_ID, TO_ID, migrate };
