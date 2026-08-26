#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ROOT, fileSha256 } = require('./lib/country-climate-intelligence');

function run(script, args = []) {
  childProcess.execFileSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-cci-ci-'));
try {
  run('tools/check-climate-source-registry.js');
  run('tools/test-climate-source-registry.js');
  run('tools/test-country-climate-compilers.js');
  run('tools/test-country-climate-intelligence-derivations.js');

  const rebuilt = path.join(temporaryDirectory, 'country-climate-intelligence.json');
  run('tools/build-country-climate-intelligence.js', ['--output', rebuilt]);
  assert.strictEqual(
    fileSha256(rebuilt),
    fileSha256(path.join(ROOT, 'data/climate/runtime/country-climate-intelligence.json')),
    'deterministic rebuild differs from committed runtime'
  );

  run('tools/check-country-climate-intelligence.js');
  run('tools/check-country-climate-intelligence-ui.js');
  run('tools/check-country-climate-runtime-atomic.js');
  run('tools/check-country-climate-intelligence-release-gate.js', ['--self-test']);
  run('tools/check-country-climate-intelligence-release-gate.js');
  run('tools/check-country-climate-public-release-boundary.js', ['--self-test']);
  run('tools/check-country-climate-public-release-boundary.js');
  console.log('Country Climate Intelligence CI passed (governance, compilers, derivations, deterministic build, runtime, UI, atomic staging, and candidate-only public boundary).');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
