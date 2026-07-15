#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('./lib/top20-primary-source-gap-queue');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = 'data/climate/releases/top20-primary-source-gap-queue-2026-07-15.json';
const INPUTS = {
  runtime: 'data/climate/runtime/country-factual-candidate.json',
  audit: 'data/climate/evidence/major-emitter-ndc-source-audit.json',
  sourceRegistry: 'data/climate/source-registry.json',
};
function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(relative) { return crypto.createHash('sha256').update(bytes(relative)).digest('hex'); }
const inputPins = Object.fromEntries(Object.entries(INPUTS).map(([key, relative]) => [key, { path: relative, sha256: sha256(relative) }]));
const output = compile({ runtime: json(INPUTS.runtime), audit: json(INPUTS.audit), sourceRegistry: json(INPUTS.sourceRegistry), inputPins });
const rendered = `${JSON.stringify(output, null, 2)}\n`;
const outputPath = path.join(ROOT, OUTPUT);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== rendered) throw new Error(`${OUTPUT} is stale; run the builder`);
  console.log(`CT-14 top-20 primary-source gap queue deterministic: PASS (${output.calculation_hash})`);
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered);
  console.log(`Wrote ${OUTPUT} (${output.entities.length} entities; ${output.coverage.ct11_countries_with_metadata} metadata-only; ${output.coverage.countries_without_ct11_primary_source_audit} not started)`);
}
