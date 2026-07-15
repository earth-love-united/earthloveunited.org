#!/usr/bin/env node
// Fail closed if quarantined legacy fields return to the public country UI.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const globe = fs.readFileSync(path.join(ROOT, 'js/globe.js'), 'utf8');
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pledge-nodes.json'), 'utf8'));
const rows = Array.isArray(payload.data) ? payload.data : payload;

const failures = [];
function requireText(source, text, label) {
  if (!source.includes(text)) failures.push(`${label}: missing ${JSON.stringify(text)}`);
}
function forbidText(source, text, label) {
  if (source.includes(text)) failures.push(`${label}: quarantined text remains ${JSON.stringify(text)}`);
}

const quarantinedFields = [
  'reality_gap_mt',
  'on_track',
  'required_cagr',
  'divergence',
  'cat_rating',
  'cat_score',
  'globe_color',
  'finance_total_bn',
];
quarantinedFields.forEach(field => forbidText(globe, field, 'globe runtime'));

[
  'COUNTRY_STATUS.NO_TARGET',
  'COUNTRY_STATUS.OVERSHOOTING',
  'COUNTRY_STATUS.ON_TRACK',
  'd.gap',
  'rgba(245,210,160',
  'rgba(214,184,138',
  'rgba(255,150,128',
  'rgba(255,132,112',
  'rgba(136,245,188',
  'rgba(116,232,172',
  'rgba(224,172,110',
  'rgba(255,84,58',
  'rgba(46,214,118',
  'rgba(212,165,116',
  'rgba(46,204,113',
].forEach(text => forbidText(globe, text, 'legacy paint semantics'));

[
  'Overshooting',
  'ON TRACK',
  'On track',
  'Off track',
  'No target',
  'Reality gap',
  'Climate Action Tracker',
  'Carbonmark',
  'credits/yr',
  'Request a sourcing brief',
].forEach(text => {
  forbidText(globe, text, 'globe runtime');
  forbidText(index, text, 'public copy');
});

requireText(globe, 'Legacy evidence — not yet verified', 'globe disclosure');
requireText(globe, 'Performance withheld', 'globe disclosure');
requireText(globe, 'provisional legacy value', 'magnitude disclosure');
requireText(index, 'Provisional fossil CO₂ magnitude · legacy, unverified', 'public legend');
requireText(index, 'Target, ambition, delivery, finance, and rating claims are withheld', 'public disclosure');
forbidText(globe, "rail.id = 'elu-country-rank-rail'", 'ranking rail');

if (!Array.isArray(rows) || !rows.length) failures.push('legacy payload: expected non-empty data rows');
const seen = new Set();
rows.forEach((row, index) => {
  if (!row || !/^[A-Z]{3}$/.test(row.iso || '')) failures.push(`legacy row ${index}: invalid ISO3`);
  if (seen.has(row.iso)) failures.push(`legacy row ${index}: duplicate ISO3 ${row.iso}`);
  seen.add(row.iso);
  if (!Number.isFinite(row.fossil_co2_mt)) failures.push(`legacy row ${index}: provisional magnitude missing`);
});

if (failures.length) {
  failures.forEach(message => console.error('FAIL:', message));
  process.exit(1);
}

console.log(`legacy country quarantine: PASS (${rows.length} navigation records, performance fields withheld)`);
