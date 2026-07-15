#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('./lib/climate-evidence-licensing-readiness');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = 'data/climate/releases/climate-evidence-licensing-readiness-2026-07-15.json';
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

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(relative) { return crypto.createHash('sha256').update(bytes(relative)).digest('hex'); }

const inputPins = Object.fromEntries(Object.entries(PATHS).map(([name, relative]) => [name, { path: relative, sha256: sha256(relative) }]));
const output = compile({
  ct40Result: json(PATHS.ct40Result),
  ct40Input: json(PATHS.ct40Input),
  ct14Queue: json(PATHS.ct14Queue),
  sourceRegistry: json(PATHS.sourceRegistry),
  audit: json(PATHS.audit),
  publishedFacts: json(PATHS.publishedFacts),
  inputPins,
});
const serialized = `${JSON.stringify(output, null, 2)}\n`;
const destination = path.join(ROOT, OUTPUT);

if (process.argv.includes('--check')) {
  if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== serialized) {
    console.error('CT-15 production evidence-readiness artifact drift; run the builder.');
    process.exit(1);
  }
  console.log('CT-15 production evidence-readiness deterministic rebuild: PASS');
} else {
  fs.writeFileSync(destination, serialized);
  console.log(`Wrote ${OUTPUT}`);
}
