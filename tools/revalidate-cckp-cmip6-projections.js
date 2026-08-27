#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { EXPECTED, verify } = require('./acquire-cckp-cmip6');
const { projectedMetric } = require('./compile-cckp-physical');
const {
  fileSha256,
  loadCountryRegistry,
  option,
  readJson,
  writeJson,
} = require('./lib/country-climate-intelligence');

const METRIC_IDS = Object.freeze({
  pr: 'climate.precipitation.change',
  tas: 'climate.temperature.change',
});

function rebuild(args) {
  const basePath = path.resolve(option(args, '--base'));
  const rawDirectory = path.resolve(option(args, '--raw-dir'));
  const receiptPath = path.resolve(option(args, '--receipt'));
  const outputPath = path.resolve(option(args, '--output'));
  const receipt = readJson(receiptPath);
  if (receipt.source_registry_id !== 'world-bank-cckp-cmip6-2026-08-24' || receipt.artifacts?.length !== EXPECTED.length) {
    throw new Error('CCKP projection receipt does not identify the ten reviewed responses');
  }
  const verified = verify(rawDirectory);
  for (const item of verified) {
    const pin = receipt.artifacts.find(artifact => artifact.file_name === item.expected.file_name);
    if (!pin || pin.bytes !== item.expected.bytes || pin.sha256 !== item.expected.sha256 || pin.retrieval_url !== item.expected.url) {
      throw new Error(`CCKP projection receipt pin mismatch for ${item.expected.id}`);
    }
  }

  const base = readJson(basePath);
  if (!Array.isArray(base.countries) || base.countries.length !== 249) throw new Error('CCKP base component must contain 249 country rows');
  const responseById = new Map(verified.map(item => [item.expected.id, item.response.data]));
  const registry = loadCountryRegistry();
  const componentByIso3 = new Map(base.countries.map(country => [country.iso_alpha3, country]));
  let reproducedValues = 0;
  let valueMismatches = 0;

  for (const entity of registry.entities) {
    const country = componentByIso3.get(entity.iso_alpha3);
    if (!country) throw new Error(`CCKP base component is missing ${entity.iso_alpha3}`);
    for (const variable of ['tas', 'pr']) {
      const rows = EXPECTED
        .filter(expected => expected.variable === variable)
        .flatMap(expected => {
          const value = responseById.get(expected.id)?.[entity.iso_alpha3]?.['2040-07'];
          if (!Number.isFinite(Number(value))) return [];
          return [{
            iso_alpha3: entity.iso_alpha3,
            period: '2040–2059 vs 1995–2014',
            percentile: expected.percentile,
            scenario: expected.scenario,
            unit: expected.unit,
            value: Number(value),
            variable,
          }];
        });
      const rebuilt = projectedMetric(entity, variable, rows);
      const previous = country.metrics[METRIC_IDS[variable]];
      const previousValues = previous.value === null ? null : {
        p10: previous.uncertainty.p10,
        median: previous.value,
        p90: previous.uncertainty.p90,
        scenario_medians: previous.context.scenario_medians,
      };
      const rebuiltValues = rebuilt.value === null ? null : {
        p10: rebuilt.uncertainty.p10,
        median: rebuilt.value,
        p90: rebuilt.uncertainty.p90,
        scenario_medians: rebuilt.context.scenario_medians,
      };
      if (JSON.stringify(previousValues) !== JSON.stringify(rebuiltValues)) valueMismatches += 1;
      if (rebuilt.value !== null) reproducedValues += 5;
      country.metrics[METRIC_IDS[variable]] = rebuilt;
    }
    for (const metric of Object.values(country.metrics)) {
      if (metric.review_state !== 'gap_reviewed') {
        metric.review_state = 'normalized_candidate_pending_independent_scientific_review';
      }
    }
  }
  if (reproducedValues !== 2450 || valueMismatches !== 0) {
    throw new Error(`CCKP projection reproduction expected 2,450 exact values and zero mismatches; received ${reproducedValues}/${valueMismatches}`);
  }

  base.artifact_type = 'normalized_country_climate_component';
  delete base.candidate_metadata_correction;
  delete base.provenance_recovery;
  delete base.release_id;
  base.generated_on = '2026-08-27';
  base.projected_climate_revalidation = {
    raw_receipt_path: 'data/climate/releases/country-climate-intelligence-v1/cckp-cmip6-raw-receipt.json',
    raw_receipt_sha256: fileSha256(receiptPath),
    reproduced_values: reproducedValues,
    script: 'tools/revalidate-cckp-cmip6-projections.js',
    value_changes: false,
  };
  base.review_state = 'normalized_factual_candidate_pending_independent_scientific_review';
  const digest = writeJson(outputPath, base);
  return { digest, reproducedValues };
}

function main() {
  const result = rebuild(process.argv.slice(2));
  console.log(`Reproduced ${result.reproducedValues} CCKP projection values with zero differences.`);
  console.log(`Artifact SHA-256: ${result.digest}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { rebuild };
