#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compile, validate, EXPECTED_TOP20, SOURCE_IDS } = require('./lib/climate-evidence-licensing-readiness');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = 'data/climate/releases/climate-evidence-licensing-readiness-2026-07-15.json';
const FIXTURE = 'data/climate/fixtures/climate-evidence-licensing-readiness.json';
const PATHS = Object.freeze({
  ct40Result: 'data/climate/reviews/ct42-ct40-release-review-result.json',
  ct40Input: 'data/climate/reviews/ct42-ct40-release-review-input.json',
  ct14Queue: 'data/climate/releases/top20-primary-source-gap-queue-2026-07-15.json',
  sourceRegistry: 'data/climate/source-registry.json',
  audit: 'data/climate/evidence/major-emitter-ndc-source-audit.json',
  publishedFacts: 'data/climate/runtime/published-facts-candidate.json',
  targetSchema: 'data/climate/schemas/target.schema.json',
  observationSchema: 'data/climate/schemas/observation.schema.json',
  releaseGate: 'tools/lib/climate-release-gate.js',
  ct40Adapter: 'tools/lib/ct42-ct40-release-review.js',
  ct14Compiler: 'tools/lib/top20-primary-source-gap-queue.js',
});
const PROHIBITED = Object.freeze([
  'data/climate/runtime-manifest.json',
  'data/climate/releases/reviewed-release-diff.json',
  'data/climate/releases/ct40-allow-manifest.json',
]);

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(relative) { return crypto.createHash('sha256').update(bytes(relative)).digest('hex'); }
function clone(value) { return structuredClone(value); }
function locate(target, dotted) {
  const parts = dotted.split('.');
  const key = parts.pop();
  const owner = parts.reduce((value, part) => value[Number.isInteger(Number(part)) ? Number(part) : part], target);
  return { owner, key };
}
function mutate(target, mutation) {
  const { owner, key } = locate(target, mutation.path);
  if (mutation.operation === 'pop') owner[key].pop();
  else if (mutation.operation === 'delete') delete owner[key];
  else owner[key] = clone(mutation.value);
}

const inputPins = Object.fromEntries(Object.entries(PATHS).map(([name, relative]) => [name, { path: relative, sha256: sha256(relative) }]));
const input = {
  ct40Result: json(PATHS.ct40Result),
  ct40Input: json(PATHS.ct40Input),
  ct14Queue: json(PATHS.ct14Queue),
  sourceRegistry: json(PATHS.sourceRegistry),
  audit: json(PATHS.audit),
  publishedFacts: json(PATHS.publishedFacts),
  inputPins,
};
const actual = json(OUTPUT);
const rebuilt = compile(input);

assert.deepEqual(actual, rebuilt, 'CT-15 readiness artifact drift; run builder');
assert.equal(Buffer.compare(bytes(OUTPUT), Buffer.from(`${JSON.stringify(rebuilt, null, 2)}\n`)), 0, 'CT-15 byte rebuild drift');
validate(actual, input);
assert.deepEqual(actual.country_work_items.map(item => item.iso_alpha3), EXPECTED_TOP20);
assert.deepEqual(actual.source_decision_work.map(item => item.source_registry_id), SOURCE_IDS);
assert.equal(actual.audit_findings.ct40.facts_with_evidence_state_not_reviewed, 2060);
assert.equal(actual.audit_findings.ct40.factual_display_eligible_facts, 2060);
assert.equal(actual.audit_findings.ct40.magnitude_comparison_eligible_facts, 2060);
assert.equal(actual.audit_findings.ct14.metadata_only_entities, 4);
assert.equal(actual.audit_findings.ct14.audits_not_started, 16);
assert.equal(actual.audit_findings.ct14.official_inventory_documents_available, 0);
PROHIBITED.forEach(relative => assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `${relative} must remain absent`));

let rejected = 0;
for (const mutation of json(FIXTURE).mutations) {
  const changed = clone(actual);
  mutate(changed, mutation);
  assert.throws(() => validate(changed, input), undefined, `mutation accepted: ${mutation.id}`);
  rejected += 1;
}

console.log([
  'CT-15 production evidence/licensing readiness: PASS (assessed release remains blocked)',
  '  CT-40 factual tiers: 2,060/2,060 eligible for factual display and magnitude comparison',
  '  CT-40 assessed release: DENY; 0 field-level assessment reviews; 0 assessment/scoring rights decisions; 0 release reviewers',
  '  CT-14: 20 countries; 0 official inventories; 4 metadata-only; 16 audits not started',
  `  source-decision work items: ${SOURCE_IDS.length}; country work items: ${EXPECTED_TOP20.length}`,
  `  adversarial mutations rejected: ${rejected}`,
].join('\n'));
