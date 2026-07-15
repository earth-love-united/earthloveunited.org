#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compileAccessibility, hash } = require('./lib/country-accessibility-model.js');

const ROOT = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/fixtures/country-accessibility.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/country-accessibility.schema.json'), 'utf8'));

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function resolveRef(root, ref) { return ref.slice(2).split('/').reduce((node, key) => node[key], root); }
function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}
function validate(value, rule, root = rule, at = '$') {
  const errors = [];
  assert.ok(rule && typeof rule === 'object', `schema rule unresolved at ${at}`);
  if (rule.$ref) {
    const resolved = resolveRef(root, rule.$ref);
    assert.ok(resolved, `unresolved schema ref ${rule.$ref} at ${at}`);
    return validate(value, resolved, root, at);
  }
  if (rule.oneOf) {
    if (rule.oneOf.filter(item => validate(value, item, root, at).length === 0).length !== 1) errors.push(`${at} must match one option`);
    return errors;
  }
  if (rule.not && validate(value, rule.not, root, at).length === 0) errors.push(`${at} matches forbidden schema`);
  if (Object.prototype.hasOwnProperty.call(rule, 'const') && JSON.stringify(value) !== JSON.stringify(rule.const)) errors.push(`${at} violates const`);
  if (rule.enum && !rule.enum.includes(value)) errors.push(`${at} outside enum`);
  const types = rule.type ? (Array.isArray(rule.type) ? rule.type : [rule.type]) : null;
  if (types && !types.some(type => matchesType(value, type))) return errors.concat(`${at} wrong type`);
  if (typeof value === 'string') {
    if (rule.minLength && value.length < rule.minLength) errors.push(`${at} too short`);
    if (rule.pattern && !(new RegExp(rule.pattern)).test(value)) errors.push(`${at} fails pattern`);
    if (rule.format === 'date-time' && Number.isNaN(Date.parse(value))) errors.push(`${at} invalid date-time`);
  }
  if (typeof value === 'number' && rule.minimum !== undefined && value < rule.minimum) errors.push(`${at} below minimum`);
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) errors.push(`${at} too few items`);
    if (rule.items) value.forEach((item, index) => errors.push(...validate(item, rule.items, root, `${at}[${index}]`)));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const properties = rule.properties || {};
    (rule.required || []).forEach(key => { if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${at}.${key} required`); });
    Object.entries(value).forEach(([key, item]) => {
      if (properties[key]) errors.push(...validate(item, properties[key], root, `${at}.${key}`));
      else if (rule.additionalProperties === false) errors.push(`${at}.${key} not allowed`);
    });
  }
  return errors;
}

function mutate(target, mutations) {
  const output = clone(target);
  (mutations || []).forEach(mutation => {
    const parts = mutation.path.split('.');
    const key = parts.pop();
    const owner = parts.reduce((node, part) => node[Number.isInteger(Number(part)) ? Number(part) : part], output);
    owner[key] = clone(mutation.value);
  });
  return output;
}

function ct32Card() {
  return {
    composite_score: null,
    section_order: ['responsibility', 'commitment', 'ambition', 'delivery', 'evidence', 'projects_markets'],
    sections: {
      projects_markets: {
        heading: 'Projects and markets',
        disclaimer: 'Not part of the national climate performance profile',
        affects_profile: false
      }
    },
    chart: {
      accessible: {
        title: 'Fixture Republic climate evidence',
        description: 'Measured annual emissions and target evidence are distinct.',
        text_summary: 'Fixture Republic. One measured series from 2023 to 2024. One comparable 2030 target endpoint.'
      },
      measured_series: [{
        series_id: 'series:fixture.zzz.harmonized', label: 'Harmonized annual emissions',
        evidence_plane: 'harmonized',
        points: [
          { year: 2023, value: 90, unit: 'fictional-MtCO2e/yr', uncertainty: { lower: 88, upper: 92 }, fact_id: 'fact:fixture.zzz.2023' },
          { year: 2024, value: 80, unit: 'fictional-MtCO2e/yr', uncertainty: null, fact_id: 'fact:fixture.zzz.2024' }
        ]
      }]
    }
  };
}

function ct30View() {
  return {
    composite_score: null,
    accessible_summary: 'High impact. Target comparable. On pace. Evidence B.',
    axes: Array.from({ length: 6 }, (_, index) => ({ id: `axis-${index}` })),
    globe: {
      target_marker: { label: 'Target comparable', cue: 'target_ring', tone: 'neutral' },
      delivery_marker: { label: 'On pace', cue: 'checkmark', tone: 'positive' },
      evidence_marker: { label: 'Evidence B', cue: 'evidence_grade', tone: 'neutral' }
    },
    card: { projects_separate: { disclaimer: 'Not part of the national climate performance profile', affects_profile: false } }
  };
}

function ct31Ranking() {
  return {
    disclosure: {
      eligible_count: 2, mapped_count: 3, unranked_count: 1,
      metric: 'fictional economy-wide GHG', period: { start_year: 2024, end_year: 2024 },
      plane: 'harmonized', unit: 'fictional-MtCO2e/yr'
    },
    ranked: [
      { ordinal: 1, country_id: 'AAA', label: 'Fixture Alpha', value: 100, unit: 'fictional-MtCO2e/yr', observation_period: { start_year: 2024, end_year: 2024 } },
      { ordinal: 2, country_id: 'ZZZ', label: 'Fixture Republic', value: 80, unit: 'fictional-MtCO2e/yr', observation_period: { start_year: 2024, end_year: 2024 } }
    ],
    unranked: {
      heading: 'Not ranked — evidence unavailable or incompatible', numbered: false,
      entries: [{ country_id: 'BBB', label: 'Fixture Missing', ordinal: null, reason_codes: ['ranking_value_missing'] }]
    }
  };
}

function baseInput() {
  return {
    generated_at: '2026-07-15T12:00:00Z',
    interaction: {
      focus_order: [
        { id: 'country-search', role: 'searchbox', label: 'Search countries', focusable: true, tab_index: 0, target_size: { width: 240, height: 44 } },
        { id: 'ranking-row-ZZZ', role: 'button', label: 'Open Fixture Republic profile', focusable: true, tab_index: 0, target_size: { width: 180, height: 44 } },
        { id: 'country-card-close', role: 'button', label: 'Close country profile', focusable: true, tab_index: 0, target_size: { width: 44, height: 44 } },
        { id: 'chart-data-disclosure', role: 'button', label: 'Show chart data', focusable: true, tab_index: 0, target_size: { width: 160, height: 44 } },
        { id: 'source-fixture-one', role: 'link', label: 'Open source: Fictional inventory', focusable: true, tab_index: 0, target_size: { width: 180, height: 44 } }
      ],
      dialog: {
        id: 'country-card', label: 'Fixture Republic climate profile', role: 'dialog', aria_modal: true,
        heading_id: 'country-card-heading', labelledby: 'country-card-heading',
        focus_on_open: 'country-card-heading', escape_closes: true, focus_trap: true,
        restore_focus_to: 'ranking-row-ZZZ', close_control_id: 'country-card-close'
      }
    },
    statuses: [
      { id: 'impact', state: 'high', label: 'High impact', non_color_cue: 'height_and_text', color_token: 'impact-high', tone: 'neutral', glyph_aria_hidden: true },
      { id: 'delivery', state: 'not_assessed', label: 'Progress not assessed', non_color_cue: 'open_circle', color_token: 'status-unknown', tone: 'unknown', glyph_aria_hidden: true },
      { id: 'evidence', state: 'B', label: 'Evidence B', non_color_cue: 'letter_badge', color_token: 'evidence-b', tone: 'neutral', glyph_aria_hidden: true }
    ],
    artifacts: { ct30_view_model: ct30View(), ct31_ranking: ct31Ranking(), ct32_card: ct32Card() },
    layout: {
      narrow: { width_css_px: 320, single_column: true, two_dimensional_scroll: false, rail_mode: 'labelled_drawer' },
      zoom_200: { zoom_percent: 200, content_clipped: false, two_dimensional_scroll: false, chart_data_reachable: true },
      long_text_wraps: true, sticky_controls_cover_content: false
    },
    motion: {
      reduced_motion: { transitions: 'none', globe_entrance: 'none', card_entrance: 'none', swipe_animation: 'none', auto_rotation: 'paused', state_changes_preserved: true },
      focus_or_card_open_auto_rotation: 'paused'
    },
    contrast: {
      normal_text: { minimum_ratio: 4.5, token_pair: 'text-primary/on-surface' },
      large_text: { minimum_ratio: 3, token_pair: 'text-large/on-surface' },
      focus_ring: { minimum_ratio: 3, token_pair: 'focus-ring/adjacent-surface' },
      meaningful_graphics: { minimum_ratio: 3, token_pair: 'chart-line/plot-surface' },
      controls: { minimum_ratio: 3, token_pair: 'control-boundary/adjacent-surface' },
      final_css_values_assigned: false
    },
    sources: [{ id: 'source-fixture-one', title: 'Fictional inventory 2024', href: 'https://example.invalid/fixture-inventory', accessible_name: 'Open source: Fictional inventory 2024', focusable: true }],
    heading_order: [
      { id: 'country-card-heading', level: 2, text: 'Fixture Republic climate profile' },
      { id: 'responsibility-heading', level: 3, text: 'Responsibility' },
      { id: 'commitment-heading', level: 3, text: 'Commitment' },
      { id: 'chart-heading', level: 3, text: 'Delivery and observed chart' },
      { id: 'evidence-heading', level: 3, text: 'Evidence and sources' },
      { id: 'projects-heading', level: 3, text: 'Projects and markets' }
    ],
    layers: {
      globe_canvas: { id: 'globeViz', decorative_mesh_aria_hidden: true, keyboard_proxy_id: 'country-search' },
      elements: [
        { id: 'country-card', parent_id: 'body', interactive: true, hidden: false, offscreen: false, pointer_events: 'auto' },
        { id: 'country-card-hidden', parent_id: 'body', interactive: true, hidden: true, offscreen: true, pointer_events: 'none' },
        { id: 'globe-decoration', parent_id: 'globeViz', interactive: false, hidden: false, offscreen: false, pointer_events: 'none' }
      ]
    }
  };
}

assert.equal(fixture._meta.fictional_entities, true);
assert.ok(fixture.cases.length >= 16);
const schemaRefs = [];
(function collectRefs(node) {
  if (!node || typeof node !== 'object') return;
  if (node.$ref) schemaRefs.push(node.$ref);
  Object.values(node).forEach(collectRefs);
})(schema);
schemaRefs.forEach(ref => assert.ok(resolveRef(schema, ref), `schema contains unresolved ref ${ref}`));
assert.ok(schemaRefs.length >= 10, 'schema reference self-check did not cover expected definitions');
let passCount = 0;
let rejectionCount = 0;
for (const testCase of fixture.cases) {
  const input = mutate(baseInput(), testCase.mutations);
  if (testCase.expected_error) {
    assert.throws(() => compileAccessibility(input), new RegExp(testCase.expected_error, 'i'), `${testCase.id}: invalid contract accepted`);
    rejectionCount += 1;
    continue;
  }
  const first = compileAccessibility(input);
  const second = compileAccessibility(clone(input));
  assert.deepEqual(first, second, `${testCase.id}: output is not deterministic`);
  assert.deepEqual(validate(first, schema), [], `${testCase.id}: output violates schema`);
  assert.equal(first.calculation_hash, hash(Object.assign({}, first, { calculation_hash: null })));
  if (testCase.calculation_hash) assert.equal(first.calculation_hash, testCase.calculation_hash);
  if (process.env.PRINT_CT33_HASH === testCase.id) console.log(`${testCase.id}: ${first.calculation_hash}`);
  assert.ok(first.chart.svg.title && first.chart.svg.description && first.chart.text_summary);
  assert.ok(first.chart.data_disclosure.point_labels.every(point => /\d{4}.*fictional-MtCO2e\/yr/.test(point.label)));
  assert.match(first.ranking.denominator, /^2 of 3 mapped entities ranked$/);
  assert.match(first.ranking.ranked_rows[0].announcement, /Rank 1 of 2/);
  assert.equal(first.ranking.unranked.numbered, false);
  assert.equal(first.interaction.dialog.restore_focus_to, 'ranking-row-ZZZ');
  assert.equal(first.layout.zoom_200.zoom_percent, 200);
  assert.equal(first.motion.reduced_motion.auto_rotation, 'paused');
  assert.equal(first.contrast.final_css_values_assigned, false);
  assert.equal(first.browser_verification_required.length, 6);
  passCount += 1;
}

console.log(`country accessibility contract: PASS (${passCount} deterministic payload, ${rejectionCount} expected failures, 12 runtime domains)`);
