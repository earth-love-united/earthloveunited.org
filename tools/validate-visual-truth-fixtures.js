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
  if (input.target?.type === 'intensity' && input.target?.reason_codes?.includes('denominator_missing')) {
    assert(expected.overshoot_ranking?.eligible === false, prefix + ': intensity target without denominator cannot enter overshoot ranking');
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
