#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('./lib/ct42-ct40-release-review');

const ROOT = path.resolve(__dirname, '..');
const PATHS = Object.freeze({
  runtime: 'data/climate/runtime/country-factual-candidate.json',
  facts: 'data/climate/runtime/published-facts-candidate.json',
  sourceRegistry: 'data/climate/source-registry.json',
  candidateManifest: 'data/climate/runtime/candidate-manifest.json',
  dataReview: 'data/climate/reviews/climate-factual-runtime-candidate-ct42-data-review.json',
  uiReview: 'data/climate/reviews/climate-factual-runtime-ct42-ui-review.json',
  primarySourcePilot: 'data/climate/releases/ct11-primary-source-pilot-2026-07-15.json',
  inputArtifact: 'data/climate/reviews/ct42-ct40-release-review-input.json',
  resultArtifact: 'data/climate/reviews/ct42-ct40-release-review-result.json',
});

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function write(relative, value) { fs.writeFileSync(path.join(ROOT, relative), `${JSON.stringify(value, null, 2)}\n`); }

const dataReview = json(PATHS.dataReview);
const uiReview = json(PATHS.uiReview);
const referenced = new Set([
  ...Object.keys(dataReview.reviewed_input_sha256 || {}),
  ...(uiReview.reviewed_file_pins || []).map(item => item.path),
  PATHS.dataReview,
  PATHS.uiReview,
  PATHS.primarySourcePilot,
]);
const fileHashes = Object.fromEntries([...referenced].sort().map(relative => [relative, sha256(bytes(relative))]));

const output = compile({
  runtime: json(PATHS.runtime),
  facts: json(PATHS.facts),
  sourceRegistry: json(PATHS.sourceRegistry),
  candidateManifest: json(PATHS.candidateManifest),
  dataReview,
  uiReview,
  primarySourcePilot: json(PATHS.primarySourcePilot),
  fileHashes,
});

write(PATHS.inputArtifact, output.inputArtifact);
write(PATHS.resultArtifact, output.resultArtifact);
process.stdout.write(`CT-42→CT-40 real release-review candidate: ${output.resultArtifact.decision.toUpperCase()} (${output.resultArtifact.counts.facts_evaluated} facts; ${output.resultArtifact.reason_codes.join(', ')})\n`);
