#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const fixturePath = path.resolve(__dirname, '../data/climate/fixtures/visual-truth.json');
const REQUIRED_IDS = [
  'high-impact-target-non-comparable',
  'high-impact-intensity-target',
  'positive-level-gap-on-pace',
  'comparable-off-course',
  'reporting-optional-sids',
  'official-harmonized-conflict',
  'fully-missing-evidence',
  'high-impact-no-documented-target',
];
const REQUIRED_SECTIONS = [
  'responsibility',
  'commitment',
  'ambition',
  'delivery',
  'fair_contribution',
  'evidence',
  'projects_separate',
];

// Temporary mirror of CT-02 data/climate/schemas/enums.json. This branch
// cannot import that file until the contract branches integrate. Replace this
// duplication with the shared schema enum during reconciliation.
const CANONICAL_REASON_CODES = new Set([
  'climate_evidence_not_reviewed',
  'source_not_reviewed',
  'source_missing',
  'source_unavailable',
  'licence_not_approved',
  'value_not_reported',
  'value_withheld',
  'reporting_not_yet_due',
  'reporting_optional',
  'not_applicable',
  'stale_source',
  'unresolved_source_conflict',
  'target_not_found',
  'target_expired',
  'target_scope_missing',
  'target_year_missing',
  'reference_year_missing',
  'reference_value_missing',
  'gas_basket_missing',
  'gwp_convention_missing',
  'sector_coverage_missing',
  'geographic_coverage_missing',
  'lulucf_treatment_missing',
  'conditionality_missing',
  'article6_treatment_missing',
  'bau_scenario_missing',
  'bau_vintage_missing',
  'bau_target_value_missing',
  'intensity_denominator_missing',
  'intensity_denominator_projection_missing',
  'fixed_level_missing',
  'trajectory_missing',
  'peaking_year_missing',
  'qualitative_target',
  'sectoral_target',
  'net_zero_details_missing',
  'scope_mismatch',
  'gas_basket_mismatch',
  'gwp_mismatch',
  'sector_mismatch',
  'geographic_boundary_mismatch',
  'lulucf_mismatch',
  'year_mismatch',
  'evidence_insufficient',
  'uncertainty_too_large',
  'independent_review_required',
  'membership_not_reviewed',
  'party_status_not_reviewed',
  'territory_status_not_reviewed',
  'geometry_not_reviewed',
  'region_not_reviewed',
  'ldc_status_not_reviewed',
  'lldc_status_not_reviewed',
  'sids_status_not_reviewed',
  'assessment_eligibility_not_reviewed',
]);

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

let doc;
try {
  doc = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
} catch (error) {
  console.error('visual-truth fixtures: unable to parse JSON: ' + error.message);
  process.exit(1);
}

assert(doc?._meta?.fictional_entities === true, '_meta.fictional_entities must be true');
assert(/^\d+\.\d+\.\d+$/.test(doc?._meta?.fixture_version || ''), 'fixture_version must be semver');
assert(Array.isArray(doc?.cases), 'cases must be an array');

const cases = Array.isArray(doc?.cases) ? doc.cases : [];
const ids = cases.map(item => item?.id);
assert(new Set(ids).size === ids.length, 'fixture IDs must be unique');
REQUIRED_IDS.forEach(id => assert(ids.includes(id), 'missing required fixture: ' + id));

cases.forEach(item => {
  const prefix = item?.id || '<unknown>';
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(prefix), prefix + ': ID must be kebab-case');
  assert(/^Fixture [A-Z]$/.test(item?.entity_label || ''), prefix + ': entity_label must be fictional');
  assert(typeof item?.scenario === 'string' && item.scenario.length > 20, prefix + ': scenario is required');

  const input = item?.input || {};
  const expected = item?.expected || {};
  assert(typeof expected.headline === 'string' && expected.headline.length > 0, prefix + ': headline is required');
  assert(expected.projects_affect_profile === false, prefix + ': projects must not affect profile');
  assert(expected.chart?.modeled_as_observed === false, prefix + ': modeled values must never be observed points');
  assert(Array.isArray(expected.accessible_summary_contains) && expected.accessible_summary_contains.length >= 4,
    prefix + ': accessible summary needs at least four semantic phrases');
  REQUIRED_SECTIONS.forEach(section => assert(
    expected.required_card_sections?.includes(section),
    prefix + ': missing card section ' + section
  ));

  const targetReasonCodes = input.target?.reason_codes;
  assert(Array.isArray(targetReasonCodes), prefix + ': target reason_codes must be an array');
  (Array.isArray(targetReasonCodes) ? targetReasonCodes : []).forEach(code => {
    assert(CANONICAL_REASON_CODES.has(code), prefix + ': non-canonical target reason code ' + code);
  });
  if (input.target?.integrity !== 'comparable') {
    assert(targetReasonCodes?.length > 0, prefix + ': non-comparable/unassessed target requires a canonical reason code');
  }
  if (expected.overshoot_ranking?.eligible === false) {
    assert(CANONICAL_REASON_CODES.has(expected.overshoot_ranking?.reason),
      prefix + ': ineligible overshoot ranking requires a canonical reason');
  }

  const impactBand = input.impact?.band;
  if (impactBand !== 'not_assessed') {
    assert(expected.impact_height === impactBand, prefix + ': impact height must preserve the impact band');
    assert(expected.emissions_ranking?.eligible === true, prefix + ': available impact must remain emissions-rank eligible');
  } else {
    assert(expected.impact_height === 'geographic_minimum_unknown', prefix + ': missing impact needs visible unknown geometry');
    assert(expected.emissions_ranking?.eligible === false, prefix + ': missing impact cannot be ranked');
    assert(expected.emissions_ranking?.ordinal === null, prefix + ': unranked entity cannot have an ordinal');
  }

  const delivery = input.delivery?.value;
  const deliveryAssessable = input.delivery?.state === 'available';
  if (!deliveryAssessable || delivery === 'uncertain' || delivery === 'off_course') {
    assert(expected.positive_treatment_allowed === false, prefix + ': unavailable/uncertain/off-course delivery cannot be positive');
  }
  if (expected.positive_treatment_allowed === true) {
    assert(delivery === 'ahead' || delivery === 'on_pace', prefix + ': positive treatment requires ahead or on_pace');
  }

  if (input.target?.integrity !== 'comparable') {
    assert(expected.chart?.required_path === false, prefix + ': non-comparable target cannot draw a required path');
    assert(expected.chart?.absolute_target_endpoint === false, prefix + ': non-comparable target cannot draw an absolute endpoint');
  }
  if (input.target?.type === 'intensity' && input.target?.reason_codes?.includes('intensity_denominator_missing')) {
    assert(expected.overshoot_ranking?.eligible === false, prefix + ': intensity target without denominator cannot enter overshoot ranking');
    assert(expected.overshoot_ranking?.reason === 'intensity_denominator_missing', prefix + ': overshoot reason must use canonical intensity code');
  }
  if (input.planes?.conflict) {
    assert(expected.chart?.show_both_planes === true, prefix + ': conflict must show both evidence planes');
    assert(expected.chart?.reconciled_value === false, prefix + ': conflict cannot invent a reconciled value');
  }
  if (input.entity_context?.reporting_state === 'reporting_optional') {
    assert(expected.reporting_flexibility_is_failure === false, prefix + ': reporting flexibility cannot be a failure');
  }
});

if (errors.length) {
  console.error('visual-truth fixtures: FAIL (' + errors.length + ')');
  errors.forEach(error => console.error('  - ' + error));
  process.exit(1);
}

console.log('visual-truth fixtures: PASS (' + cases.length + ' cases, ' + REQUIRED_IDS.length + ' required scenarios)');
