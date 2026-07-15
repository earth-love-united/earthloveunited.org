#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { compile, hashBytes } = require('./lib/climate-factual-runtime-candidate');
const { evaluateTruthPolicy } = require('./lib/climate-truth-ci-policy');
const { releaseDiffCalculationHash } = require('./lib/climate-reviewed-release');

const ROOT = path.resolve(__dirname, '..');
const P = {
  registry: 'data/climate/country-registry.json', promotion: 'data/climate/releases/primap-hist-2.6.1-factual-display-2026-07-15.json',
  review: 'data/climate/reviews/primap-hist-2.6.1-factual-display-ct10c-review.json', source: 'data/climate/source-registry.json',
  runtime: 'data/climate/runtime/country-factual-candidate.json', facts: 'data/climate/runtime/published-facts-candidate.json',
  batch: 'data/climate/runtime/ct10c-batch-attestation-wrapper.json', manifest: 'data/climate/runtime/candidate-manifest.json',
};
function bytes(file) { return fs.readFileSync(path.join(ROOT, file)); }
function json(file) { return JSON.parse(bytes(file)); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function set(target, dotted, value) { const parts = dotted.split('.'); const key = parts.pop(); const owner = parts.reduce((node, part) => node[Number.isInteger(Number(part)) ? Number(part) : part], target); owner[key] = value; }
function inputs() {
  const promotionBytes = bytes(P.promotion), reviewBytes = bytes(P.review);
  return { registry: json(P.registry), promotion: JSON.parse(promotionBytes), promotionBytes, review: JSON.parse(reviewBytes), reviewBytes, sourceRegistry: json(P.source) };
}
function fixtureReleaseDiff() {
  const diff = { initial_release: true, data_release_id: 'fixture-only', previous_release_id: null, change_summary: 'Checker fixture.', changed_entity_ids: [], source_revision_ids: [], diff_hash: null, review: { status: 'reviewed', builder_id: 'fixture-builder', reviewer_id: 'fixture-reviewer', reviewed_at: '2026-07-15T00:00:00Z' } };
  diff.diff_hash = releaseDiffCalculationHash(diff);
  return diff;
}

const output = compile(inputs());
assert.deepEqual(output.runtime, json(P.runtime), 'runtime candidate drift; run builder');
assert.deepEqual(output.publishedFacts, json(P.facts), 'published facts drift; run builder');
assert.deepEqual(output.batchAttestation, json(P.batch), 'batch wrapper drift; run builder');
assert.deepEqual(output.runtime.coverage, { registry_entities: 249, reviewed_series: 206, source_gaps: 43, observations: 2060 });
assert.equal(output.runtime.countries.filter(item => item.emissions.status === 'reviewed_factual').length, 206);
assert.equal(output.runtime.countries.filter(item => item.emissions.status === 'source_gap').length, 43);
assert.deepEqual(output.runtime.interpretation.magnitude_domain, {
  min_mtco2e_per_year: Math.min(...output.runtime.countries.filter(item => item.emissions.latest).map(item => item.emissions.latest.value)),
  max_mtco2e_per_year: Math.max(...output.runtime.countries.filter(item => item.emissions.latest).map(item => item.emissions.latest.value)),
  offset_mtco2e_per_year: 0.01,
});
assert.equal(output.runtime.production_runtime_release, false);
assert.equal(output.runtime.review_status, 'not_reviewed');
assert.ok(output.runtime.countries.every(item => item.assessment.commitment === 'not_reviewed' && item.assessment.target === 'not_reviewed' && item.assessment.delivery === 'not_assessed' && item.assessment.performance === 'not_assessed' && item.assessment.impact_band === 'not_assessed' && item.assessment.score === null));

const manifest = json(P.manifest);
assert.equal(manifest.review_status, 'not_reviewed'); assert.equal(manifest.decision, 'deny'); assert.equal(manifest.release_eligible, false);
for (const item of manifest.inputs.concat(manifest.outputs)) assert.equal(hashBytes(bytes(item.path)), item.sha256, `${item.path} hash drift`);
for (const forbidden of manifest.prohibited_release_files) assert.equal(fs.existsSync(path.join(ROOT, forbidden)), false, `${forbidden} must not exist in candidate`);

const index = bytes('index.html').toString(); const data = bytes('js/data.js').toString(); const globe = bytes('js/globe.js').toString(); const css = bytes('css/globe-system.css').toString();
assert.ok(index.includes('country-factual-candidate') || data.includes('country-factual-candidate.json'));
assert.ok(manifest.compiler_files.includes('js/country-ranking-compiler.js') && manifest.compiler_files.includes('js/country-climate-view-model.js'));
assert.ok(!data.includes('pledge-nodes.json') && !globe.includes('pledge-nodes.json'));
['Reviewed emissions data', 'Climate performance', 'not reviewed', 'Annual harmonized emissions estimates', 'Source gaps · unnumbered', 'not a performance score', 'excludes LULUCF', 'Source &amp; methodology'].forEach(text => assert.ok(globe.includes(text) || index.includes(text), `missing public truth disclosure: ${text}`));
['CT-42 candidate preview', 'runtime and release not reviewed', 'facts reviewed through CT-10C / CT-10C-R'].forEach(text => assert.ok(!globe.includes(text) && !index.includes(text), `internal governance language leaked into public copy: ${text}`));
assert.ok(globe.includes('elu-trajectory-point') && globe.includes('elu-chart-axis') && globe.includes('Show chart data'));
assert.ok(globe.includes("wrap.setAttribute('role', 'dialog')") && globe.includes("wrap.setAttribute('aria-modal', 'true')") && globe.includes('country-card-heading'));
assert.ok(globe.includes("tt.removeAttribute('aria-modal')") && globe.includes("tt.setAttribute('aria-hidden', 'true')"), 'closed modal must leave the accessibility tree');
assert.ok(globe.includes('restoreHeadingFocus') && globe.includes("heading.focus({ preventScroll: true })"), 'country navigation must restore focus after replacing dialog content');
assert.ok(globe.includes('node.getClientRects().length > 0') && globe.includes("style.visibility !== 'hidden'"), 'dialog focus trap must exclude responsive controls hidden by CSS');
assert.ok(css.includes('.elu-rank-dot.is-magnitude') && css.includes('.elu-rank-dot.is-gap') && css.includes('.tt-candidate'));
assert.ok(!/Measured \/ harmonized emissions|Measured annual observations/.test(JSON.stringify(output.runtime) + globe));
assert.ok(!/Math\.log10\((?:0\.00334|15000)/.test(globe), 'hard-coded visual magnitude bounds leaked');

// Execute the exact CT-31 browser compiler and verify competition-rank/gap semantics.
const context = { window: {}, hasModule: () => false, safeCall: () => undefined, console };
vm.createContext(context); vm.runInContext(bytes('js/country-ranking-compiler.js').toString(), context);
const records = output.runtime.countries.map(country => ({
  country_id: country.country_id, label: country.name,
  latest_observation: country.emissions.latest ? { value: country.emissions.latest.value, metric: country.emissions.metric, period: { start_year: 2023, end_year: 2023 }, plane: 'harmonized', accounting_frame: 'economy_wide_ghg_excluding_lulucf', scope: 'economy_wide_excluding_lulucf', unit: country.emissions.unit, review_state: 'reviewed', evidence_gate_passed: true, evidence_flags: [] } : {},
  evidence_flags: country.emissions.latest ? [] : ['source_unavailable'],
}));
const ranking = context.window.COUNTRY_RANKING_COMPILER.compile(records, { lens: 'annual_emissions', metric: 'annual_economy_wide_ghg_excluding_lulucf', period: { start_year: 2023, end_year: 2023 }, plane: 'harmonized', accounting_frame: 'economy_wide_ghg_excluding_lulucf', scope: 'economy_wide_excluding_lulucf', unit: 'MtCO2e/yr' }, { release_id: output.runtime.candidate_id, compiled_at: output.runtime.created_at, input_hash: output.runtime.calculation_hash });
assert.equal(ranking.disclosure.eligible_count, 206); assert.equal(ranking.disclosure.unranked_count, 43); assert.equal(ranking.unranked.numbered, false);
ranking.ranked.slice(1).forEach((entry, index) => { if (entry.value === ranking.ranked[index].value) assert.equal(entry.ordinal, ranking.ranked[index].ordinal); });

// CT-41 compatibility of the published facts and exact CT-10C-R batch wrapper.
const factIds = output.publishedFacts.facts.map(fact => fact.fact_id);
const policy = evaluateTruthPolicy({
  methodology_version: '0.1.0',
  runtime: { review_status: 'reviewed', files: [{ path: 'fixture/runtime.js', content: 'const status = "Progress not assessed";' }], data_files: [P.facts], claims: {}, rankings: [{ ranking_id: 'ct42-same-metric-2023', metric: 'annual_economy_wide_ghg_excluding_lulucf', unit: 'MtCO2e/yr', period: '2023', plane: 'harmonized', source_fact_ids: factIds.filter(id => id.endsWith(':2023')) }] },
  release_manifest: { decision: 'allow', release_eligible: true, reason_codes: [], calculation_hash: '1'.repeat(64) },
  release_diff: fixtureReleaseDiff(),
  facts: output.publishedFacts.facts, sources: json(P.source).sources, batch_attestations: [output.batchAttestation], canonical_reason_codes: [], embedded_reason_enums: [], generated_drift: false,
});
assert.equal(policy.status, 'pass', JSON.stringify(policy.failures.slice(0, 3)));

const fixture = json('data/climate/fixtures/climate-factual-runtime-candidate.json');
for (const mutation of fixture.mutations) {
  const changed = inputs();
  const target = mutation.target === 'source' ? changed.sourceRegistry.sources.find(item => item.id === 'primap-hist-2.6.1-final') : changed[mutation.target];
  if (mutation.operation === 'pop') mutation.path.split('.').reduce((node, part) => node[Number.isInteger(Number(part)) ? Number(part) : part], target).pop();
  else set(target, mutation.path, mutation.value);
  assert.throws(() => compile(changed), new RegExp(mutation.expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), mutation.id);
}

console.log(`CT-42 factual runtime candidate: PASS (249 entities; 206 series; 43 gaps; 2,060 facts; ${fixture.mutations.length} adversarial mutations; CT-31/32/41 boundaries checked; release remains denied)`);
