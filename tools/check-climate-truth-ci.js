#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { POLICY_VERSION, evaluateTruthPolicy, resolveRunStatus } = require('./lib/climate-truth-ci-policy');

const ROOT = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/fixtures/truth-ci-policy.json'), 'utf8'));
const canonical = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/enums.json'), 'utf8')).reason_codes;

function materialize(value) {
  if (value === '$canonical') return structuredClone(canonical);
  if (Array.isArray(value)) return value.map(materialize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, materialize(item)]));
}

function mutate(candidate, mutation) {
  const parts = mutation.path.split('.');
  let cursor = candidate;
  for (let index = 0; index < parts.length - 1; index += 1) cursor = cursor[parts[index]];
  cursor[parts[parts.length - 1]] = structuredClone(mutation.value);
}

assert.strictEqual(POLICY_VERSION, fixture._meta.fixture_version);
assert.deepStrictEqual(resolveRunStatus({ hardFailure: false, missingCount: 2, strict: true, allowIncomplete: false, reviewedCandidate: false }), { status: 'fail', exit_code: 1 });
assert.deepStrictEqual(resolveRunStatus({ hardFailure: false, missingCount: 2, strict: false, allowIncomplete: true, reviewedCandidate: false }), { status: 'incomplete', exit_code: 0 });
assert.deepStrictEqual(resolveRunStatus({ hardFailure: false, missingCount: 2, strict: false, allowIncomplete: true, reviewedCandidate: true }), { status: 'fail', exit_code: 1 });
let passed = 0;
let failedAsExpected = 0;
for (const testCase of fixture.cases) {
  const input = materialize(fixture.base);
  testCase.mutations.forEach((mutation) => mutate(input, mutation));
  const result = evaluateTruthPolicy(input);
  const repeat = evaluateTruthPolicy(structuredClone(input));
  assert.deepStrictEqual(result, repeat, `${testCase.id}: nondeterministic result`);
  assert.strictEqual(result.status, testCase.expected_status, `${testCase.id}: status`);
  const actualCodes = [...new Set(result.failures.map((failure) => failure.code))].sort();
  assert.deepStrictEqual(actualCodes, [...testCase.expected_codes].sort(), `${testCase.id}: failure codes`);
  assert(/^[a-f0-9]{64}$/.test(result.calculation_hash), `${testCase.id}: hash`);
  if (result.status === 'pass') passed += 1; else failedAsExpected += 1;
}

process.stdout.write([
  'CT-41 climate truth CI policy: PASS',
  `  fictional cases: ${fixture.cases.length}`,
  `  pass / expected fail: ${passed} / ${failedAsExpected}`,
  '  legacy runtime, truth language, release, diff, enums, lineage, licence, review, and drift: covered'
].join('\n') + '\n');
