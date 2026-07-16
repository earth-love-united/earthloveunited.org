#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('./lib/source-rights-review-packets');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = 'data/climate/reviews/source-rights-review-packets-2026-07-15.json';
const PATHS = Object.freeze({
  source_registry: 'data/climate/source-registry.json',
  ct15_readiness: 'data/climate/releases/climate-evidence-licensing-readiness-2026-07-15.json',
  ct16_policy: 'data/climate/releases/source-routing-policy-v2-2026-07-15.json',
  ct16_queue: 'data/climate/releases/top20-source-routing-queue-v2-2026-07-15.json',
  ct40_result: 'data/climate/reviews/ct42-ct40-release-review-result.json',
});

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(relative) { return crypto.createHash('sha256').update(bytes(relative)).digest('hex'); }

const inputPins = Object.fromEntries(Object.entries(PATHS).map(([key, relative]) => [key, { path: relative, sha256: sha256(relative) }]));
const output = compile({
  sourceRegistry: json(PATHS.source_registry),
  ct15Readiness: json(PATHS.ct15_readiness),
  ct40Result: json(PATHS.ct40_result),
  inputPins,
});
const serialized = JSON.stringify(output, null, 2) + '\n';
const destination = path.join(ROOT, OUTPUT);

if (process.argv.includes('--check')) {
  if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== serialized) {
    console.error('CT-17 source-rights review packet drift; run the builder.');
    process.exit(1);
  }
  console.log('CT-17 source-rights review packet deterministic rebuild: PASS');
} else {
  fs.writeFileSync(destination, serialized);
  console.log('Wrote ' + OUTPUT);
}
