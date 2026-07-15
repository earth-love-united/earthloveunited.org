#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'js/country-climate-view-model.js');
const fixturePath = path.join(root, 'data/climate/fixtures/country-view-model.json');
const errors = [];
const contracts = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

const context = {
  window: {},
  MODULE_CONTRACTS: { register: (name, contract) => contracts.push({ name, contract }) },
  hasModule: name => name === 'MODULE_CONTRACTS',
  safeCall: (name, method, ...args) => context[name][method](...args),
  Set,
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(modulePath, 'utf8'), context, { filename: modulePath });

const api = context.window.COUNTRY_CLIMATE_VIEW_MODEL;
assert(api && typeof api.build === 'function', 'module must expose window.COUNTRY_CLIMATE_VIEW_MODEL.build');
assert(contracts.length === 1 && contracts[0].name === 'COUNTRY_CLIMATE_VIEW_MODEL', 'module contract must be registered exactly once');
assert(contracts[0]?.contract?.provides?.includes('build'), 'module contract must provide build');

let fixture;
try {
  fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
} catch (error) {
  console.error('country view model: unable to parse fixtures: ' + error.message);
  process.exit(1);
}

assert(fixture?._meta?.fictional_entities === true, 'fixtures must be explicitly fictional');
const cases = Array.isArray(fixture?.cases) ? fixture.cases : [];
assert(cases.length >= 11, 'at least 11 golden cases are required');
assert(new Set(cases.map(item => item.id)).size === cases.length, 'fixture IDs must be unique');

const forbiddenPositive = /\b(good|leader|leading|success|successful|on track)\b/i;
const requiredSections = ['identity', 'responsibility', 'commitment', 'ambition', 'delivery', 'fair_contribution', 'evidence', 'projects_separate'];

cases.forEach(item => {
  const prefix = item.id + ': ';
  const output = api.build(item.input);
  const expected = item.expected;

  assert(output.composite_score === null, prefix + 'composite score must remain null');
  assert(output.axes?.length === 6, prefix + 'six axes must remain separate');
  assert(JSON.stringify(output.card?.section_order) === JSON.stringify(requiredSections), prefix + 'card section order changed');
  assert(output.globe?.impact_height === expected.impact_height, prefix + 'impact height mismatch');
  assert(output.globe?.target_marker?.tone === expected.target_tone, prefix + 'target tone mismatch');
  assert(output.globe?.delivery_marker?.tone === expected.delivery_tone, prefix + 'delivery tone mismatch');
  assert(output.card?.delivery?.state === expected.delivery_state, prefix + 'delivery state mismatch');
  assert(output.ranking?.emissions?.eligible === false, prefix + 'view model cannot declare final emissions eligibility');
  assert(output.ranking?.overshoot?.eligible === false, prefix + 'view model cannot declare final overshoot eligibility');
  assert(output.ranking?.emissions?.state === expected.emissions_state, prefix + 'emissions candidate state mismatch');
  assert(output.ranking?.overshoot?.state === expected.overshoot_state, prefix + 'overshoot candidate state mismatch');
  assert(output.ranking?.emissions?.ordinal === null, prefix + 'view model must not invent emissions rank');
  assert(output.ranking?.overshoot?.ordinal === null, prefix + 'view model must not invent overshoot rank');
  assert(output.card?.projects_separate?.affects_profile === false, prefix + 'projects must not affect profile');
  assert(output.card?.projects_separate?.disclaimer === 'Not part of the national climate performance profile', prefix + 'projects disclaimer changed');
  assert(!forbiddenPositive.test(output.headline), prefix + 'headline contains unsupported positive copy');
  expected.headline_contains.forEach(fragment => assert(output.headline.includes(fragment), prefix + 'headline missing "' + fragment + '"'));

  if (expected.evidence_cue) assert(output.globe?.evidence_marker?.cue === expected.evidence_cue, prefix + 'evidence cue mismatch');
  if (Object.prototype.hasOwnProperty.call(expected, 'latest_value')) {
    assert(output.card?.responsibility?.latest_value === expected.latest_value, prefix + 'zero/null value fidelity failed');
  }

  const missingOrWeak = output.card?.delivery?.state !== 'ahead' && output.card?.delivery?.state !== 'on_pace';
  if (missingOrWeak) {
    assert(output.globe?.delivery_marker?.tone !== 'positive', prefix + 'non-positive delivery received positive tone');
    assert(output.globe?.delivery_marker?.cue !== 'checkmark', prefix + 'non-positive delivery received checkmark');
  }
});

const nullValue = api.build({ impact: { state: 'available', band: 'low', latest_observation: { value: null } } });
const zeroValue = api.build({ impact: { state: 'available', band: 'low', latest_observation: { value: 0 } } });
const ungatedPositive = api.build({
  impact: { state: 'available', band: 'high' },
  target_integrity: { integrity: 'comparable' },
  delivery: { state: 'available', value: 'on_pace' },
  evidence: { grade: 'A', flags: [] },
});
assert(nullValue.card.responsibility.latest_value === null, 'explicit null must remain null');
assert(zeroValue.card.responsibility.latest_value === 0, 'numeric zero must remain zero');
assert(ungatedPositive.card.delivery.state === 'not_assessed', 'positive delivery needs an explicit CT-22 evidence gate');
assert(ungatedPositive.globe.delivery_marker.tone !== 'positive', 'ungated delivery cannot receive positive treatment');

if (errors.length) {
  console.error('country view model: FAIL (' + errors.length + ')');
  errors.forEach(error => console.error('  - ' + error));
  process.exit(1);
}

console.log('country view model: PASS (' + cases.length + ' golden cases, 2 null/zero fidelity checks, 2 delivery-gate checks, 1 module contract check)');
