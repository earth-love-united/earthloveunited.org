#!/usr/bin/env node
'use strict';

/**
 * One-time, value-preserving metadata correction for candidate.1.
 *
 * The reviewed normalized candidate survived without four retained raw source
 * snapshots. This correction therefore refuses to recalculate values. It only:
 * - marks optional-source facts and components as pending source revalidation;
 * - identifies WPP 2024 Medium as a projection and propagates that evidence
 *   class to the denominator metadata.
 *
 * Input hashes pin the exact pre-correction artifacts so this cannot silently
 * mutate a later source release.
 */

const path = require('path');
const {
  ROOT,
  fileSha256,
  readJson,
  writeJson,
} = require('./lib/country-climate-intelligence');

const COMPONENTS = Object.freeze({
  cckp: Object.freeze({
    file: 'cckp-physical.json',
    sha256: '7a27525cc8bff5e482049e2da185edfc4c8392a993e29ea84d424027e7c3b0e7',
  }),
  ember: Object.freeze({
    file: 'ember-power.json',
    sha256: '975f2bf780cb30da16aa1b618c8dc3ca7e9b76d6bf95d30842b0111841cdad15',
  }),
  wpp: Object.freeze({
    file: 'wpp-population.json',
    sha256: '41a44109a7a3ae3816141ec135ac3c0db6008e29669bcccaeecb1539e7a58f07',
  }),
});

const RELEASE_DIR = path.join(ROOT, 'data/climate/releases/country-climate-intelligence-v1');
const COMPONENT_STATE = 'normalized_factual_candidate_pending_source_revalidation';
const FACT_STATE = 'normalized_candidate_pending_source_revalidation';

function correctWpp(metric) {
  if (metric.value === null) {
    if (metric.gap_reason?.detail) {
      metric.gap_reason.detail = metric.gap_reason.detail.replace(
        'population estimate',
        'WPP Medium population projection'
      );
    }
    return;
  }
  if (metric.id !== 'population.estimate' || metric.status !== 'estimated') {
    throw new Error('Unexpected WPP candidate metric before projection correction');
  }
  const context = metric.context || {};
  if (context.release_year_classification !== 'year_matched_2024_central_estimate') {
    throw new Error('Unexpected WPP year classification before projection correction');
  }
  delete context.projection_substitution_allowed;
  context.different_year_or_variant_substitution_allowed = false;
  context.release_year_classification = 'year_matched_2024_medium_projection';
  context.source_variant = 'Medium';
  metric.context = context;
  metric.status = 'modeled';
  metric.transformation = 'PopTotal_thousands_times_1000;year_2024_and_Medium_projection_selected';
}

function correctComponent(id, definition) {
  const file = path.join(RELEASE_DIR, definition.file);
  const actual = fileSha256(file);
  if (actual !== definition.sha256) {
    throw new Error(`${id} pre-correction checksum mismatch: expected ${definition.sha256}, received ${actual}`);
  }
  const artifact = readJson(file);
  if (artifact.review_state !== 'source_validated_factual_candidate' || artifact.entity_count !== 249) {
    throw new Error(`${id} is not the expected 249-row pre-correction candidate`);
  }
  for (const country of artifact.countries) {
    for (const metric of Object.values(country.metrics || {})) {
      if (metric.value !== null) {
        if (metric.review_state !== 'source_validated_candidate') {
          throw new Error(`${id}/${country.iso_alpha3}/${metric.id} has an unexpected fact review state`);
        }
        metric.review_state = FACT_STATE;
      }
      if (id === 'wpp') correctWpp(metric);
    }
  }
  artifact.candidate_metadata_correction = {
    numeric_values_changed: false,
    reason: 'Independent audit corrected the WPP evidence class and made optional-source revalidation status explicit.',
  };
  artifact.review_state = COMPONENT_STATE;
  return writeJson(file, artifact);
}

function main() {
  for (const [id, definition] of Object.entries(COMPONENTS)) {
    console.log(`${id}: ${correctComponent(id, definition)}`);
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { COMPONENTS, correctComponent, correctWpp };
