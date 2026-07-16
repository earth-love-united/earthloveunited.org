#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateTruthPolicy } = require('./lib/climate-truth-ci-policy');
const { releaseDiffCalculationHash } = require('./lib/climate-reviewed-release');

const ROOT = path.resolve(__dirname, '..');
const PATHS = Object.freeze({
  registry: 'data/climate/country-registry.json',
  promotion: 'data/climate/releases/primap-hist-2.6.1-factual-display-2026-07-15.json',
  upstreamReview: 'data/climate/reviews/primap-hist-2.6.1-factual-display-ct10c-review.json',
  sourceRegistry: 'data/climate/source-registry.json',
  runtime: 'data/climate/runtime/country-factual-candidate.json',
  facts: 'data/climate/runtime/published-facts-candidate.json',
  wrapper: 'data/climate/runtime/ct10c-batch-attestation-wrapper.json',
  manifest: 'data/climate/runtime/candidate-manifest.json',
  rollback: 'data/climate/runtime/rollback-plan.json',
  attestation: 'data/climate/reviews/climate-factual-runtime-candidate-ct42-data-review.json',
  fixtures: 'data/climate/fixtures/climate-factual-runtime-data-review.json',
});
const EXPECTED_SHA256 = Object.freeze({
  [PATHS.registry]: '51fb321661684a88e80254cd5721ee70d0f52d95587222727fb9e9722e86b075',
  [PATHS.promotion]: '129cc563cbad1fa5c71d6953430a8eba510f4c26106d4f6e76cb7cbd11a7e76d',
  [PATHS.upstreamReview]: 'c2f233511db35ff98738a1d7df5b8a3b083009e03a128d9e406f6bd98678cfda',
  [PATHS.sourceRegistry]: 'ae32cc5799a96115d1b8568250638759020ff36cb1b6d1fa6aa032f56d07634d',
  [PATHS.runtime]: '7f002bc18396d827179cef0a3dda5bb83c3a1538dd6beffd6e4b80c2f7583664',
  [PATHS.facts]: '307b0a7c9edc59f6360ce05e66ccf54624f3233d809dd0f4232338b324b07e19',
  [PATHS.wrapper]: 'fd1e5e0a8863b082574a175639abe30b3f5b8722c430019267dac907e09ef034',
  [PATHS.manifest]: '96e74966e40a65c838d7030de07c8cead4c05fe28d49876814c8e0cd4b8c7a1c',
  [PATHS.rollback]: 'c23bd5caf21bf05b6e637c6f599742e13a47b822b298054ca8d56e968d8aeaae',
});
const REQUIRED_FALSE_USES = Object.freeze([
  'target', 'commitment', 'delivery', 'performance', 'assessed_status', 'impact_bands',
  'composite', 'normative_scoring', 'scoring', 'runtime_profile',
]);
const FORBIDDEN_RELEASE_FILES = Object.freeze([
  'data/climate/runtime-manifest.json',
  'data/climate/releases/reviewed-release-diff.json',
  'data/climate/releases/ct40-allow-manifest.json',
]);

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function hashJson(value) { return sha256(Buffer.from(JSON.stringify(stable(value)))); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fixtureReleaseDiff() {
  const diff = {
    initial_release: true, data_release_id: 'review-fixture-only', previous_release_id: null,
    change_summary: 'Independent CT-42 data review fixture.', changed_entity_ids: [], source_revision_ids: [], diff_hash: null,
    review: { status: 'reviewed', builder_id: 'fixture-builder', reviewer_id: 'fixture-reviewer', reviewed_at: '2026-07-15T00:00:00Z' },
  };
  diff.diff_hash = releaseDiffCalculationHash(diff);
  return diff;
}
function unique(values, label) { assert.equal(new Set(values).size, values.length, `${label} must be unique`); }
function exactKeys(actual, expected, label) { assert.deepEqual(Object.keys(actual).sort(), [...expected].sort(), `${label} keys drift`); }
function get(target, dotted) { return dotted.split('.').reduce((node, key) => node[Number.isInteger(Number(key)) ? Number(key) : key], target); }
function set(target, dotted, value) { const parts = dotted.split('.'); const key = parts.pop(); const owner = parts.length ? get(target, parts.join('.')) : target; owner[key] = value; }

function independentlyValidate(input) {
  const { registry, promotion, upstreamReview, sourceRegistry, runtime, facts, wrapper, manifest, rollback } = input;
  assert.equal(registry.entity_count, 249, 'registry entity_count must be 249');
  assert.equal(registry.entities.length, 249, 'registry entities must be 249');
  const registryIds = registry.entities.map(entity => entity.country_id);
  unique(registryIds, 'registry country IDs');
  assert.ok(registry.entities.every(entity => entity.country_id === `iso3166-1:${entity.iso_alpha3}`), 'registry country/ISO identity drift');

  const source = sourceRegistry.sources.find(item => item.id === 'primap-hist-2.6.1-final');
  assert.ok(source, 'pinned PRIMAP source absent');
  assert.equal(source.version, '2.6.1 final, 13 March 2025');
  assert.equal(source.approval.state, 'approved');
  assert.equal(source.licence.identifier, 'CC-BY-4.0');
  assert.equal(source.licence.status, 'confirmed');
  assert.equal(source.redistribution.normalized_values, true);
  assert.equal(source.artifact.sha256, '7607f2b7c5b00d3ddbb19e5c7b100ff7bd8c2d8c2bfc8959c40f41d2cfecf4d9');

  assert.equal(upstreamReview.decision, 'pass', 'CT-10C-R must pass');
  assert.equal(upstreamReview.reviewer.independent_of_builder, true, 'CT-10C-R must be independent');
  assert.notEqual(upstreamReview.reviewer.reviewer_id, upstreamReview.reviewer.builder_id, 'CT-10C-R identities must differ');
  assert.equal(upstreamReview.reviewed_inputs.promotion_sha256, EXPECTED_SHA256[PATHS.promotion]);
  assert.equal(upstreamReview.reviewed_inputs.promotion_calculation_hash, promotion.calculation_hash);
  assert.equal(upstreamReview.publication_boundary.factual_display_review_passed, true);
  assert.equal(upstreamReview.publication_boundary.production_runtime_release_allowed, false);
  assert.equal(upstreamReview.publication_boundary.ct40_runtime_gate_required, true);

  assert.equal(promotion.coverage.registry_entities, 249);
  assert.equal(promotion.coverage.promoted_country_series, 206);
  assert.equal(promotion.coverage.source_unavailable, 43);
  assert.equal(promotion.coverage.promoted_observations, 2060);
  assert.equal(promotion.release_use_flags.production_runtime_release, false);
  const promotionIds = promotion.series.map(series => series.country_id);
  unique(promotionIds, 'promotion country IDs');
  assert.ok(promotionIds.every(id => registryIds.includes(id)), 'promotion contains an entity outside CT-02');
  const gapIds = registryIds.filter(id => !promotionIds.includes(id));
  assert.equal(gapIds.length, 43, 'mapped/unmapped universe must be 206/43');

  const promotionPointByFact = new Map();
  const sourceFactIds = [];
  const latest = [];
  for (const series of promotion.series) {
    assert.equal(series.iso_alpha3, series.country_id.slice(-3), `ISO mismatch for ${series.country_id}`);
    assert.equal(series.values.length, 10, `ten annual points required for ${series.country_id}`);
    assert.deepEqual(series.values.map(point => point.year), [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]);
    for (const point of series.values) {
      assert.match(point.normalized_value_decimal, /^(?:0|[1-9]\d*)(?:\.\d+)?$/, `non-canonical decimal ${point.fact_id}`);
      assert.equal(Number(point.normalized_value_decimal), point.value_mtco2e, `numeric/decimal drift ${point.fact_id}`);
      assert.equal(point.fact_id, `fact:primap-hist-2.6.1:normalized:histtp:m0el:${series.iso_alpha3.toLowerCase()}:${point.year}`);
      assert.equal(point.source_fact_id, `fact:primap-hist-2.6.1:source:histtp:m0el:${series.iso_alpha3.toLowerCase()}:${point.year}`);
      promotionPointByFact.set(point.fact_id, { ...point, country_id: series.country_id });
      sourceFactIds.push(point.source_fact_id);
    }
    latest.push({ country_id: series.country_id, value: Number(series.values[9].normalized_value_decimal) });
  }
  assert.equal(promotionPointByFact.size, 2060, '2,060 unique normalized fact IDs required');
  unique(sourceFactIds, 'source fact IDs');
  assert.equal(new Set([...promotionPointByFact.keys(), ...sourceFactIds]).size, 4120, 'normalized and source ID universes must not overlap');

  assert.equal(runtime.review_status, 'not_reviewed');
  assert.equal(runtime.production_runtime_release, false);
  assert.match(runtime.required_next_gate, /CT-40 allow decision/);
  assert.deepEqual(runtime.coverage, { registry_entities: 249, reviewed_series: 206, source_gaps: 43, observations: 2060 });
  assert.equal(runtime.countries.length, 249);
  assert.deepEqual(runtime.countries.map(country => country.country_id), registryIds, 'runtime must preserve the CT-02 universe and order');
  assert.equal(runtime.source_chain.promotion_sha256, EXPECTED_SHA256[PATHS.promotion]);
  assert.equal(runtime.source_chain.review_sha256, EXPECTED_SHA256[PATHS.upstreamReview]);
  assert.equal(runtime.source_chain.promotion_calculation_hash, promotion.calculation_hash);
  assert.equal(runtime.source_chain.review_calculation_hash, upstreamReview.calculation_hash);

  const runtimeIds = [];
  for (const country of runtime.countries) {
    assert.deepEqual(country.assessment, {
      commitment: 'not_reviewed', target: 'not_reviewed', delivery: 'not_assessed',
      performance: 'not_assessed', impact_band: 'not_assessed', score: null,
    }, `${country.country_id} assessment must remain unavailable`);
    const sourceSeries = promotion.series.find(series => series.country_id === country.country_id);
    if (!sourceSeries) {
      assert.deepEqual(country.emissions, { status: 'source_gap', reason_code: 'source_unavailable', series: [], latest: null });
      continue;
    }
    assert.equal(country.emissions.status, 'reviewed_factual');
    assert.equal(country.emissions.source_id, source.id);
    assert.equal(country.emissions.review_id, upstreamReview.review_id);
    assert.equal(country.emissions.series.length, 10);
    country.emissions.series.forEach((point, index) => {
      const expected = sourceSeries.values[index];
      assert.deepEqual(point, {
        year: expected.year, value: expected.value_mtco2e, value_decimal: expected.normalized_value_decimal,
        fact_id: expected.fact_id, source_fact_id: expected.source_fact_id,
      }, `runtime preservation drift ${expected.fact_id}`);
      runtimeIds.push(point.fact_id, point.source_fact_id);
    });
    assert.deepEqual(country.emissions.latest, country.emissions.series[9]);
  }
  assert.equal(runtimeIds.length, 4120);
  unique(runtimeIds, 'runtime combined fact IDs');

  const latestValues = latest.map(item => item.value);
  assert.deepEqual(runtime.interpretation.magnitude_domain, {
    min_mtco2e_per_year: Math.min(...latestValues),
    max_mtco2e_per_year: Math.max(...latestValues),
    offset_mtco2e_per_year: 0.01,
  });
  assert.equal(runtime.interpretation.magnitude_domain.min_mtco2e_per_year, 0.0023);
  assert.equal(runtime.interpretation.magnitude_domain.max_mtco2e_per_year, 15000);
  assert.equal(runtime.interpretation.performance_judgment, false);

  const expectedRanking = [...latest].sort((a, b) => b.value - a.value || a.country_id.localeCompare(b.country_id));
  let priorValue = null;
  let rank = 0;
  expectedRanking.forEach((item, index) => {
    if (item.value !== priorValue) { rank = index + 1; priorValue = item.value; }
    item.ordinal = rank;
  });
  assert.equal(runtime.ranking.ranked.length, 206);
  assert.equal(runtime.ranking.unranked.entries.length, 43);
  assert.equal(runtime.ranking.unranked.numbered, false);
  assert.deepEqual(runtime.ranking.unranked.entries.map(item => item.country_id).sort(), [...gapIds].sort());
  runtime.ranking.ranked.forEach((entry, index) => {
    assert.equal(entry.country_id, expectedRanking[index].country_id, `ranking order drift at ${index}`);
    assert.equal(entry.value, expectedRanking[index].value, `ranking value drift for ${entry.country_id}`);
    assert.equal(entry.ordinal, expectedRanking[index].ordinal, `competition rank drift for ${entry.country_id}`);
    assert.equal(entry.delivery_inferred, false);
  });
  assert.ok(runtime.ranking.ranked.some((entry, index, all) => index && entry.ordinal === all[index - 1].ordinal), 'review fixture must exercise a competition tie');
  const runtimeForHash = clone(runtime); delete runtimeForHash.calculation_hash;
  assert.equal(hashJson(runtimeForHash), runtime.calculation_hash, 'runtime calculation hash drift');

  assert.equal(facts.fact_count, 2060);
  assert.equal(facts.facts.length, 2060);
  assert.equal(facts.review_status, 'not_reviewed');
  assert.equal(facts.production_runtime_release, false);
  unique(facts.facts.map(fact => fact.fact_id), 'published fact IDs');
  for (const fact of facts.facts) {
    const expected = promotionPointByFact.get(fact.fact_id);
    assert.ok(expected, `published fact outside promotion ${fact.fact_id}`);
    assert.equal(fact.entity_id, expected.country_id);
    assert.equal(fact.value, expected.normalized_value_decimal, `published decimal drift ${fact.fact_id}`);
    assert.equal(fact.period, String(expected.year));
    assert.equal(fact.source_id, source.id);
    assert.equal(fact.source_checksum_sha256, source.artifact.sha256);
    assert.equal(fact._artifact_sha256, EXPECTED_SHA256[PATHS.promotion]);
    assert.equal(fact.review.batch_attestation_sha256, EXPECTED_SHA256[PATHS.upstreamReview]);
    assert.equal(fact.review.status, 'reviewed');
    assert.equal(fact.review.mode, 'batch_attestation');
    assert.equal(fact.derivation, null);
    exactKeys(fact.allowed_uses, ['factual_display', 'time_series', 'magnitude_comparison', 'annual_emissions_ranking', ...REQUIRED_FALSE_USES], `${fact.fact_id} allowed_uses`);
    assert.equal(fact.allowed_uses.factual_display, true);
    assert.equal(fact.allowed_uses.time_series, true);
    assert.equal(fact.allowed_uses.magnitude_comparison, true);
    assert.equal(fact.allowed_uses.annual_emissions_ranking, true);
    REQUIRED_FALSE_USES.forEach(key => assert.equal(fact.allowed_uses[key], false, `${fact.fact_id} forbidden use ${key}`));
  }
  const factsForHash = clone(facts); delete factsForHash.calculation_hash;
  assert.equal(hashJson(factsForHash), facts.calculation_hash, 'published facts calculation hash drift');

  assert.equal(wrapper.attestation_id, upstreamReview.review_id);
  assert.equal(wrapper.batch_id, promotion.promotion_id);
  assert.equal(wrapper.decision, 'pass');
  assert.equal(wrapper.artifact.sha256, EXPECTED_SHA256[PATHS.promotion]);
  assert.equal(wrapper._file_sha256, EXPECTED_SHA256[PATHS.upstreamReview]);
  assert.equal(wrapper.production_runtime_release, false);
  assert.deepEqual(wrapper.fact_ids, facts.facts.map(fact => fact.fact_id), 'batch wrapper fact universe drift');
  assert.equal(wrapper.review.status, 'reviewed');
  assert.notEqual(wrapper.review.builder_id, wrapper.review.reviewer_id);

  assert.equal(manifest.review_status, 'not_reviewed');
  assert.equal(manifest.decision, 'deny');
  assert.equal(manifest.release_eligible, false);
  assert.equal(manifest.production_runtime_release, false);
  assert.ok(manifest.reason_codes.includes('ct40_allow_manifest_absent'));
  assert.deepEqual(manifest.unpassed_gates, [
    'independent CT-42 runtime review',
    'CT-40 allow decision',
    'reviewed runtime manifest and release diff',
    'screen-reader, formal contrast, 320px/200% zoom, and reduced-motion verification',
    'polygon and fallback rendering plus color-removal comprehension review',
  ], 'candidate must disclose every unpassed release and accessibility gate');
  assert.deepEqual(manifest.prohibited_release_files, FORBIDDEN_RELEASE_FILES);
  assert.deepEqual(manifest.inputs.map(item => item.path), [PATHS.registry, PATHS.promotion, PATHS.upstreamReview, PATHS.sourceRegistry]);
  assert.deepEqual(manifest.outputs.map(item => item.path), [PATHS.runtime, PATHS.facts, PATHS.wrapper]);
  manifest.inputs.concat(manifest.outputs).forEach(item => assert.equal(item.sha256, EXPECTED_SHA256[item.path], `${item.path} manifest pin drift`));
  FORBIDDEN_RELEASE_FILES.forEach(file => assert.equal(fs.existsSync(path.join(ROOT, file)), false, `${file} must remain absent`));
  assert.equal(rollback.review_status, 'not_reviewed');
  assert.equal(rollback.automatic_release_authority, false);
  assert.ok(rollback.actions.some(action => /service-worker cache version/.test(action)), 'rollback must invalidate the candidate cache');
  assert.ok(rollback.actions.some(action => /fail-closed empty country evidence state/.test(action)), 'rollback must restore fail-closed evidence');

  const policy = evaluateTruthPolicy({
    methodology_version: '0.1.0',
    runtime: {
      review_status: 'reviewed', files: [{ path: 'review-fixture/runtime.js', content: 'const status = "Progress not assessed";' }],
      data_files: [PATHS.facts], claims: {}, rankings: [{
        ranking_id: 'ct42-reviewed-data-reconstruction', metric: promotion.metric.id, unit: promotion.metric.unit,
        period: '2023', plane: promotion.metric.plane,
        source_fact_ids: facts.facts.filter(fact => fact.period === '2023').map(fact => fact.fact_id),
      }],
    },
    release_manifest: { decision: 'allow', release_eligible: true, reason_codes: [], calculation_hash: '1'.repeat(64) },
    release_diff: fixtureReleaseDiff(),
    facts: facts.facts, sources: sourceRegistry.sources, batch_attestations: [wrapper],
    canonical_reason_codes: [], embedded_reason_enums: [], generated_drift: false,
  });
  assert.equal(policy.status, 'pass', `CT-41 wrapper incompatibility: ${JSON.stringify(policy.failures.slice(0, 3))}`);

  return {
    counts: { registry_entities: 249, reviewed_series: 206, source_gaps: 43, observations: 2060, normalized_fact_ids: 2060, combined_lineage_ids: 4120 },
    magnitude_domain: clone(runtime.interpretation.magnitude_domain),
    calculation_hashes: { promotion: promotion.calculation_hash, upstream_review: upstreamReview.calculation_hash, runtime: runtime.calculation_hash, published_facts: facts.calculation_hash, ranking: runtime.ranking.calculation_hash },
    universe_hashes: { registry_ids: hashJson(registryIds), promoted_ids: hashJson(promotionIds), gap_ids: hashJson(gapIds), fact_ids: hashJson(facts.facts.map(fact => fact.fact_id)), source_fact_ids: hashJson(sourceFactIds) },
    ct41_status: policy.status,
  };
}

function load() {
  const result = {};
  for (const [key, relative] of Object.entries(PATHS)) {
    if (key === 'attestation' || key === 'fixtures') continue;
    result[key] = json(relative);
  }
  return result;
}

for (const [relative, expected] of Object.entries(EXPECTED_SHA256)) assert.equal(sha256(bytes(relative)), expected, `${relative} byte pin drift`);
const result = independentlyValidate(load());
const fixtures = json(PATHS.fixtures);
for (const mutation of fixtures.mutations) {
  const changed = load();
  const target = changed[mutation.target];
  if (mutation.operation === 'pop') get(target, mutation.path).pop();
  else set(target, mutation.path, mutation.value);
  assert.throws(() => independentlyValidate(changed), undefined, `mutation was accepted: ${mutation.id}`);
}

const attestation = json(PATHS.attestation);
assert.equal(attestation.decision, 'pass');
assert.equal(attestation.reviewer.independent_of_builder, true);
assert.notEqual(attestation.reviewer.reviewer_id, attestation.reviewer.builder_id);
assert.deepEqual(attestation.reviewed_input_sha256, EXPECTED_SHA256);
assert.deepEqual(attestation.counts, result.counts);
assert.deepEqual(attestation.magnitude_domain, result.magnitude_domain);
assert.deepEqual(attestation.calculation_hashes, result.calculation_hashes);
assert.deepEqual(attestation.universe_hashes, result.universe_hashes);
assert.equal(attestation.ct41_compatibility.status, result.ct41_status);
assert.equal(attestation.counts.adversarial_mutations_rejected, undefined);
assert.equal(attestation.adversarial_mutations_rejected, fixtures.mutations.length);
assert.equal(attestation.publication_boundary.ct42_data_review_passed, true);
assert.equal(attestation.publication_boundary.visual_accessibility_reviewed, false);
assert.equal(attestation.publication_boundary.production_runtime_release_allowed, false);
assert.equal(attestation.publication_boundary.ct40_allow_decision_required, true);

console.log(`CT-42 independent data review: PASS (249/206/43; 2,060 facts; 4,120 lineage IDs; ${fixtures.mutations.length} adversarial mutations; CT-41 compatible; CT-40/runtime release remains denied)`);
