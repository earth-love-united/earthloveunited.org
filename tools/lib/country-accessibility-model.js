'use strict';

const crypto = require('node:crypto');

const CONTRACT_VERSION = '1.0.0';
const POSITIVE_CUES = new Set(['checkmark', 'double_chevron']);
const UNKNOWN_STATES = new Set(['unknown', 'not_assessed', 'uncertain', 'withheld', 'source_unavailable']);
const REQUIRED_SECTIONS = ['responsibility', 'commitment', 'ambition', 'delivery', 'evidence', 'projects_markets'];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stable(value[key]);
      return result;
    }, {});
  }
  return value;
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function text(value, label) {
  assert(typeof value === 'string' && value.trim().length > 0, `${label} is required`);
  return value;
}

function isUtc(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value));
}

function sorted(values) {
  return [...new Set(values || [])].sort();
}

function validateStatus(status, label) {
  text(status.id, `${label}.id`);
  text(status.state, `${label}.state`);
  text(status.label, `${label}.label`);
  text(status.non_color_cue, `${label}.non_color_cue`);
  text(status.color_token, `${label}.color_token`);
  assert(status.non_color_cue !== 'color_only', `${label} cannot be color-only`);
  if (UNKNOWN_STATES.has(status.state)) {
    assert(status.tone !== 'positive', `${label} unknown state cannot be positive`);
    assert(!POSITIVE_CUES.has(status.non_color_cue), `${label} unknown state cannot use a positive cue`);
  }
  assert(status.glyph_aria_hidden === true, `${label} decorative glyph must be aria-hidden`);
  return {
    id: status.id,
    state: status.state,
    label: status.label,
    non_color_cue: status.non_color_cue,
    color_token: status.color_token,
    tone: status.tone || 'neutral',
    glyph_aria_hidden: status.glyph_aria_hidden === true
  };
}

function validateFocus(input) {
  const order = input.focus_order || [];
  assert(order.length > 0, 'focus_order is required');
  const ids = new Set();
  order.forEach((item, index) => {
    text(item.id, `focus_order[${index}].id`);
    assert(!ids.has(item.id), `duplicate focus target ${item.id}`);
    ids.add(item.id);
    text(item.role, `focus_order[${index}].role`);
    text(item.label, `focus_order[${index}].label`);
    assert(item.focusable === true, `${item.id} must be focusable`);
    assert(item.tab_index === 0, `${item.id} must use logical tab order`);
    assert(item.target_size && item.target_size.width >= 44 && item.target_size.height >= 44, `${item.id} target must be at least 44px`);
  });
  return {
    order: order.map((item, index) => ({
      sequence: index + 1, id: item.id, role: item.role, label: item.label,
      target_size: { width: item.target_size.width, height: item.target_size.height },
      tab_index: item.tab_index
    })),
    logical_order: true,
    minimum_target_css_px: 44,
    focus_indicators_removed: false,
    arrow_key_navigation: { scope: 'dialog_only', announced: true, hijacks_page_scroll: false }
  };
}

function validateDialog(dialog, focusIds) {
  assert(dialog && dialog.role === 'dialog', 'country card must use dialog semantics');
  assert(dialog.aria_modal === true, 'country card dialog must be modal');
  text(dialog.id, 'dialog.id');
  text(dialog.label, 'dialog.label');
  text(dialog.heading_id, 'dialog.heading_id');
  assert(dialog.labelledby === dialog.heading_id, 'dialog must be labelled by its heading');
  assert(dialog.focus_on_open === dialog.heading_id || dialog.focus_on_open === dialog.id, 'dialog opening focus is invalid');
  assert(dialog.escape_closes === true, 'Escape must close the country card');
  assert(dialog.focus_trap === true, 'dialog must trap focus while open');
  assert(focusIds.has(dialog.restore_focus_to), 'focus restoration target must exist in focus order');
  assert(focusIds.has(dialog.close_control_id), 'dialog close control must exist in focus order');
  return stable(dialog);
}

function validateHeadings(headings) {
  assert(Array.isArray(headings) && headings.length > 0, 'heading_order is required');
  let previous = 0;
  return headings.map((heading, index) => {
    assert(Number.isInteger(heading.level) && heading.level >= 1 && heading.level <= 6, `heading_order[${index}].level is invalid`);
    if (previous) assert(heading.level <= previous + 1, `heading order skips from h${previous} to h${heading.level}`);
    previous = heading.level;
    return { id: text(heading.id, `heading_order[${index}].id`), level: heading.level, text: text(heading.text, `heading_order[${index}].text`) };
  });
}

function validateLayerSafety(layers) {
  assert(layers && Array.isArray(layers.elements), 'layer safety elements are required');
  layers.elements.forEach((item, index) => {
    if (item.interactive) assert(item.parent_id !== 'globeViz', `${item.id || index} interactive element cannot be under #globeViz`);
    if (item.hidden || item.offscreen) {
      assert(item.pointer_events === 'none', `${item.id || index} hidden/offscreen element must disable pointer events`);
    }
    if (item.opacity === 0) assert(item.pointer_events === 'none', `${item.id || index} transparent element must disable pointer events`);
  });
  assert(layers.globe_canvas && layers.globe_canvas.decorative_mesh_aria_hidden === true, 'decorative globe mesh must be aria-hidden');
  assert(layers.globe_canvas.keyboard_proxy_id, 'globe requires adjacent keyboard proxy');
  return stable(layers);
}

function pointLabel(point, series) {
  assert(Number.isInteger(point.year), `${series.series_id} point is missing a real year`);
  assert(typeof point.value === 'number' && Number.isFinite(point.value), `${series.series_id} point value is invalid`);
  text(point.unit, `${series.series_id} point unit`);
  text(point.fact_id, `${series.series_id} point fact_id`);
  const uncertainty = point.uncertainty
    ? `, uncertainty ${point.uncertainty.lower} to ${point.uncertainty.upper} ${point.unit}` : '';
  return `${series.label || series.series_id}, ${point.year}: ${point.value} ${point.unit}, ${series.evidence_plane} evidence${uncertainty}`;
}

function validateCardArtifact(card) {
  if (!card) return null;
  assert(card.composite_score === null, 'CT-32 card must not expose a composite score');
  assert(JSON.stringify(card.section_order) === JSON.stringify(REQUIRED_SECTIONS), 'CT-32 section order is incompatible');
  assert(card.chart && card.chart.accessible, 'CT-32 chart accessible payload is required');
  const accessible = card.chart.accessible;
  text(accessible.title, 'chart accessible title');
  text(accessible.description, 'chart accessible description');
  text(accessible.text_summary, 'chart text summary');
  const pointLabels = [];
  (card.chart.measured_series || []).forEach(series => {
    text(series.series_id, 'measured series ID');
    text(series.evidence_plane, `${series.series_id}.evidence_plane`);
    (series.points || []).forEach(point => pointLabels.push({ fact_id: point.fact_id, label: pointLabel(point, series) }));
  });
  const projects = card.sections && card.sections.projects_markets;
  assert(projects && projects.affects_profile === false, 'projects must not affect profile');
  assert(projects.disclaimer === 'Not part of the national climate performance profile', 'projects disclaimer is inaccessible or changed');
  return {
    svg: {
      role: 'img',
      title_id: 'country-chart-title', title: accessible.title,
      description_id: 'country-chart-description', description: accessible.description,
      labelledby: 'country-chart-title country-chart-description'
    },
    text_summary: accessible.text_summary,
    data_disclosure: { control_label: 'Show chart data', table_caption: `${accessible.title} data`, point_labels: pointLabels },
    projects: { heading: projects.heading, disclaimer: projects.disclaimer, affects_profile: false }
  };
}

function validateViewModel(view) {
  if (!view) return null;
  assert(view.composite_score === null, 'CT-30 view model must not expose a composite score');
  assert(Array.isArray(view.axes) && view.axes.length === 6, 'CT-30 must expose six separate axes');
  const statuses = [];
  const markers = view.globe || {};
  [['target', markers.target_marker], ['delivery', markers.delivery_marker], ['evidence', markers.evidence_marker]].forEach(([id, marker]) => {
    if (!marker) return;
    const inferredState = /not assessed|uncertain|withheld|unavailable/i.test(marker.label || '') ? 'not_assessed' :
      (marker.state || (marker.tone === 'unknown' ? 'unknown' : id));
    statuses.push(validateStatus({
      id, state: inferredState,
      label: marker.label, non_color_cue: marker.cue,
      color_token: `semantic-${marker.tone || 'neutral'}`, tone: marker.tone,
      glyph_aria_hidden: true
    }, `CT-30 ${id} marker`));
  });
  if (view.card && view.card.projects_separate) {
    assert(view.card.projects_separate.affects_profile === false, 'CT-30 projects must not affect profile');
    assert(view.card.projects_separate.disclaimer === 'Not part of the national climate performance profile', 'CT-30 projects disclaimer changed');
  }
  return { statuses, accessible_summary: text(view.accessible_summary, 'CT-30 accessible_summary') };
}

function periodText(period) {
  assert(period && Number.isInteger(period.start_year) && Number.isInteger(period.end_year), 'ranking period is required');
  return period.start_year === period.end_year
    ? String(period.start_year)
    : `${period.start_year}–${period.end_year}`;
}

function validateRanking(release) {
  if (!release) return null;
  const disclosure = release.disclosure || {};
  assert(Number.isInteger(disclosure.eligible_count) && Number.isInteger(disclosure.mapped_count), 'ranking denominator is required');
  assert(disclosure.eligible_count === (release.ranked || []).length, 'ranking eligible denominator mismatch');
  assert(disclosure.mapped_count === disclosure.eligible_count + disclosure.unranked_count, 'ranking mapped denominator mismatch');
  text(disclosure.metric, 'ranking metric');
  text(disclosure.plane, 'ranking plane');
  text(disclosure.unit, 'ranking unit');
  assert(disclosure.period && Number.isInteger(disclosure.period.start_year) && Number.isInteger(disclosure.period.end_year), 'ranking period is required');
  assert(release.unranked && release.unranked.numbered === false, 'unranked group cannot be numbered');
  const denominator = `${disclosure.eligible_count} of ${disclosure.mapped_count} mapped entities ranked`;
  const context = `${disclosure.metric}, ${periodText(disclosure.period)}, ${disclosure.plane}, ${disclosure.unit}`;
  return {
    live_region: { politeness: 'polite', atomic: true, announcement: `${denominator}. ${context}.` },
    denominator,
    context,
    ranked_rows: (release.ranked || []).map(row => ({
      country_id: row.country_id,
      announcement: `Rank ${row.ordinal} of ${disclosure.eligible_count}: ${row.label}, ${row.value} ${row.unit}, observation ${periodText(row.observation_period)}`
    })),
    unranked: {
      heading: release.unranked.heading,
      numbered: false,
      announcement: `${release.unranked.entries.length} mapped entities not ranked because evidence is unavailable or incompatible`,
      rows: release.unranked.entries.map(row => ({ country_id: row.country_id, announcement: `${row.label}: not ranked; ${row.reason_codes.join(', ')}` }))
    }
  };
}

function validateSources(sources) {
  assert(Array.isArray(sources) && sources.length > 0, 'evidence source links are required');
  return sources.map((source, index) => {
    text(source.id, `sources[${index}].id`);
    text(source.title, `sources[${index}].title`);
    assert(/^https:\/\//.test(source.href || ''), `${source.id} requires an HTTPS source link`);
    text(source.accessible_name, `${source.id}.accessible_name`);
    assert(source.focusable === true, `${source.id} must be keyboard reachable`);
    return stable(source);
  });
}

function compileAccessibility(input) {
  assert(input && typeof input === 'object', 'accessibility input is required');
  assert(isUtc(input.generated_at), 'generated_at must be a UTC timestamp');
  const focus = validateFocus(input.interaction);
  const focusIds = new Set(focus.order.map(item => item.id));
  const dialog = validateDialog(input.interaction.dialog, focusIds);
  const headings = validateHeadings(input.heading_order);
  const layers = validateLayerSafety(input.layers);
  const statuses = (input.statuses || []).map((status, index) => validateStatus(status, `statuses[${index}]`));
  assert(statuses.length > 0, 'non-color status contract is required');
  const card = validateCardArtifact(input.artifacts && input.artifacts.ct32_card);
  const view = validateViewModel(input.artifacts && input.artifacts.ct30_view_model);
  const ranking = validateRanking(input.artifacts && input.artifacts.ct31_ranking);
  const sources = validateSources(input.sources);
  assert(focusIds.has(layers.globe_canvas.keyboard_proxy_id), 'globe keyboard proxy must exist in focus order');
  assert(focusIds.has('chart-data-disclosure'), 'chart data disclosure must exist in focus order');
  sources.forEach(source => assert(focusIds.has(source.id), `${source.id} source link must exist in focus order`));
  assert(headings.some(heading => heading.id === dialog.heading_id), 'dialog heading must exist in heading order');
  const layout = input.layout || {};
  assert(layout.narrow && layout.narrow.width_css_px <= 320 && layout.narrow.single_column === true && layout.narrow.two_dimensional_scroll === false, 'narrow layout contract is incomplete');
  assert(layout.zoom_200 && layout.zoom_200.zoom_percent === 200 && layout.zoom_200.content_clipped === false && layout.zoom_200.two_dimensional_scroll === false, '200% zoom contract is incomplete');
  assert(layout.long_text_wraps === true && layout.sticky_controls_cover_content === false, 'responsive text/sticky safety is incomplete');
  const motion = input.motion || {};
  assert(motion.reduced_motion && motion.reduced_motion.transitions === 'none' && motion.reduced_motion.auto_rotation === 'paused', 'reduced-motion contract is incomplete');
  assert(motion.focus_or_card_open_auto_rotation === 'paused', 'auto-rotation must pause for focus/card open');
  const contrast = input.contrast || {};
  assert(contrast.normal_text && contrast.normal_text.minimum_ratio === 4.5 && contrast.normal_text.token_pair, 'normal text contrast token requirement is missing');
  ['large_text', 'focus_ring', 'meaningful_graphics', 'controls'].forEach(key => {
    assert(contrast[key] && contrast[key].minimum_ratio === 3 && contrast[key].token_pair, `${key} contrast token requirement is missing`);
  });
  assert(contrast.final_css_values_assigned === false, 'CT-33 must not invent final CSS colors');

  const output = {
    schema_version: '1.0.0', contract_version: CONTRACT_VERSION,
    generated_at: input.generated_at,
    interaction: { focus, dialog, keyboard_globe_proxy_id: layers.globe_canvas.keyboard_proxy_id },
    statuses: sorted(statuses.map(item => item.id)).map(id => statuses.find(item => item.id === id)),
    chart: card,
    ranking,
    view_model: view,
    layout: stable(layout), motion: stable(motion), contrast: stable(contrast),
    sources, headings, layers,
    announcements: {
      card_opened: `${dialog.label}: dialog opened`,
      card_closed: `Country card closed; focus returned to ${dialog.restore_focus_to}`,
      ranking_changed: ranking ? ranking.live_region.announcement : null
    },
    browser_verification_required: [
      'keyboard transcript and focus restoration', 'screen-reader dialog/chart/ranking announcements',
      'computed light/dark contrast', '320px and 200% zoom reflow',
      'reduced-motion and auto-rotation behavior', 'StackLint pointer-event and stacking audit'
    ],
    calculation_hash: null
  };
  output.calculation_hash = hash(Object.assign({}, output, { calculation_hash: null }));
  return output;
}

module.exports = { CONTRACT_VERSION, REQUIRED_SECTIONS, compileAccessibility, hash, stable };
