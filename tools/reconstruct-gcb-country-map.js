#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { verify } = require('./acquire-gcb-2025');
const { readSheet } = require('./lib/xlsx-table');
const { fossilMetrics, landMetric, matrix } = require('./lib/gcb-country-intelligence');
const {
  fileSha256,
  option,
  readJson,
  writeJson,
} = require('./lib/country-climate-intelligence');

const REFERENCE_SHA256 = '0423f8150939455e07260dec49951575ee4123f174f00ceefbda441364b66825';
const METRIC_IDS = Object.freeze([
  'emissions.fossil_co2.territorial',
  'emissions.fossil_co2.cumulative',
  'emissions.fossil_co2.consumption',
  'emissions.fossil_co2.net_transfer',
  'emissions.land_use_co2.net',
]);
const DIRECT_NAME_MAPPINGS = Object.freeze({
  Austria: 'AUT',
  Gabon: 'GAB',
  Monaco: 'MCO',
  Panama: 'PAN',
  Paraguay: 'PRY',
  'South Korea': 'KOR',
  'Vatican City': 'VAT',
  Yemen: 'YEM',
});
const EXCEPTIONS = Object.freeze({
  Africa: ['aggregate', 'GCB regional aggregate; not a registry country.'],
  Asia: ['aggregate', 'GCB regional aggregate; not a registry country.'],
  'Central America': ['aggregate', 'GCB regional aggregate; not a registry country.'],
  DISPUTED: ['aggregate', 'GCB bookkeeping category; not a registry country.'],
  EU27: ['aggregate', 'GCB regional aggregate; not a registry country.'],
  Europe: ['aggregate', 'GCB regional aggregate; not a registry country.'],
  Global: ['aggregate', 'GCB global aggregate; not a registry country.'],
  'International Aviation': ['aggregate', 'International bunker category excluded from country values.'],
  'International Shipping': ['aggregate', 'International bunker category excluded from country values.'],
  'KP Annex B': ['aggregate', 'GCB policy grouping; not a registry country.'],
  Kosovo: ['unmapped', 'GCB publishes Kosovo separately, but it is not an ISO 3166-1 entity in the fixed 249-entity registry.'],
  'Middle East': ['aggregate', 'GCB regional aggregate; not a registry country.'],
  'Non KP Annex B': ['aggregate', 'GCB policy grouping; not a registry country.'],
  'Non-OECD': ['aggregate', 'GCB economic grouping; not a registry country.'],
  'North America': ['aggregate', 'GCB regional aggregate; not a registry country.'],
  OECD: ['aggregate', 'GCB economic grouping; not a registry country.'],
  OTHER: ['aggregate', 'GCB bookkeeping category; not a registry country.'],
  Oceania: ['aggregate', 'GCB regional aggregate; not a registry country.'],
  'South America': ['aggregate', 'GCB regional aggregate; not a registry country.'],
  'Statistical Difference': ['aggregate', 'GCB balancing category; not a registry country.'],
  World: ['aggregate', 'GCB global aggregate; not a registry country.'],
});

function signature(metrics) {
  return JSON.stringify(METRIC_IDS.map(id => metrics[id]?.value === null || metrics[id]?.value === undefined
    ? null
    : Number(metrics[id].value.toFixed(4))));
}

function seriesByName(file, sheetName) {
  return new Map(matrix(readSheet(file, sheetName), sheetName).map(item => [item.source_name, item.observations]));
}

function reconstruct(args) {
  const fossilPath = verify(option(args, '--input'), 'fossil');
  const landPath = verify(option(args, '--land-input'), 'land-use');
  const referencePath = path.resolve(option(args, '--reference'));
  const outputPath = path.resolve(option(args, '--output'));
  if (fileSha256(referencePath) !== REFERENCE_SHA256) {
    throw new Error('GCB reconstruction reference is not the exact reviewed recovered candidate');
  }
  const reference = readJson(referencePath);
  const referenceBySignature = new Map();
  for (const country of reference.countries) {
    const key = signature(country.metrics);
    const values = referenceBySignature.get(key) || [];
    values.push(country.iso_alpha3);
    referenceBySignature.set(key, values);
  }

  const series = {
    territorial: seriesByName(fossilPath, 'Territorial Emissions'),
    consumption: seriesByName(fossilPath, 'Consumption Emissions'),
    transfers: seriesByName(fossilPath, 'Emissions Transfers'),
    BLUE: seriesByName(landPath, 'BLUE'),
    OSCAR: seriesByName(landPath, 'OSCAR'),
    LUCE: seriesByName(landPath, 'LUCE'),
  };
  const sourceNames = [...new Set(Object.values(series).flatMap(values => [...values.keys()]))].sort();
  const mappings = [];
  const exceptions = [];

  for (const sourceName of sourceNames) {
    if (EXCEPTIONS[sourceName]) {
      const [kind, reason] = EXCEPTIONS[sourceName];
      exceptions.push({ kind, reason, source_name: sourceName });
      continue;
    }
    const direct = DIRECT_NAME_MAPPINGS[sourceName];
    if (direct) {
      mappings.push({
        iso_alpha3: direct,
        match_basis: 'exact_source_name_reviewed_against_iso_registry',
        source_name: sourceName,
      });
      continue;
    }
    const metrics = {
      ...fossilMetrics('XXX', series.territorial.get(sourceName), series.consumption.get(sourceName), series.transfers.get(sourceName)),
      'emissions.land_use_co2.net': landMetric('XXX', {
        BLUE: series.BLUE.get(sourceName),
        OSCAR: series.OSCAR.get(sourceName),
        LUCE: series.LUCE.get(sourceName),
      }),
    };
    const candidates = referenceBySignature.get(signature(metrics)) || [];
    if (candidates.length !== 1) {
      throw new Error(`GCB source ${sourceName} has ${candidates.length} rounded five-metric reference matches`);
    }
    mappings.push({
      iso_alpha3: candidates[0],
      match_basis: 'unique_five_metric_signature_match_at_four_decimal_places',
      source_name: sourceName,
    });
  }

  if (sourceNames.length !== 237 || mappings.length !== 216 || exceptions.length !== 21) {
    throw new Error(`GCB identity partition differs from 237 = 216 mappings + 21 exceptions`);
  }
  if (new Set(mappings.map(mapping => mapping.iso_alpha3)).size !== mappings.length) {
    throw new Error('GCB identity reconstruction maps more than one source name to the same ISO entity');
  }
  const artifact = {
    artifact_type: 'gcb_2025_country_identity_map',
    derivation: {
      direct_name_reviews: Object.keys(DIRECT_NAME_MAPPINGS).length,
      fossil_workbook_sha256: fileSha256(fossilPath),
      land_use_workbook_sha256: fileSha256(landPath),
      reference_candidate_sha256: REFERENCE_SHA256,
      signature_matches: mappings.length - Object.keys(DIRECT_NAME_MAPPINGS).length,
      signature_precision_decimal_places: 4,
    },
    exceptions,
    mappings,
    review_state: 'candidate_mapping_ledger_requires_independent_scientific_review',
    schema_version: '1.0.0',
    source_registry_id: 'gcp-gcb-2025-v1.0',
  };
  const digest = writeJson(outputPath, artifact);
  return { digest, artifact };
}

function main() {
  const result = reconstruct(process.argv.slice(2));
  console.log(`Reconstructed ${result.artifact.mappings.length} GCB country mappings and ${result.artifact.exceptions.length} exceptions.`);
  console.log(`Artifact SHA-256: ${result.digest}`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}

module.exports = { reconstruct };
