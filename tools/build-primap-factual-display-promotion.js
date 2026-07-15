#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PINS, buildPromotion } = require('./lib/primap-factual-display-promotion');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data/climate/releases/primap-hist-2.6.1-factual-display-2026-07-15.json');

function main() {
  const createdAt = process.argv[2];
  if (!createdAt) throw new Error('usage: node tools/build-primap-factual-display-promotion.js YYYY-MM-DDTHH:mm:ssZ');
  const candidateBytes = fs.readFileSync(path.join(ROOT, PINS.candidate_path));
  const attestationBytes = fs.readFileSync(path.join(ROOT, PINS.attestation_path));
  const artifact = buildPromotion(
    JSON.parse(candidateBytes),
    candidateBytes,
    JSON.parse(attestationBytes),
    attestationBytes,
    createdAt,
  );
  const output = JSON.stringify(artifact, null, 2) + '\n';
  fs.writeFileSync(OUTPUT, output);
  console.log(`${path.relative(ROOT, OUTPUT)}: ${artifact.coverage.promoted_country_series} series, ${artifact.coverage.promoted_observations} observations`);
}

try { main(); } catch (error) {
  console.error(`PRIMAP CT-10C build: FAIL — ${error.message}`);
  process.exit(1);
}
