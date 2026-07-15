#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('./lib/source-routing-policy');

const ROOT = path.resolve(__dirname, '..');
const PATHS = Object.freeze({
  sourceRegistry: 'data/climate/source-registry.json',
  ct14: 'data/climate/releases/top20-primary-source-gap-queue-2026-07-15.json',
  ct15: 'data/climate/releases/climate-evidence-licensing-readiness-2026-07-15.json',
  policy: 'data/climate/releases/source-routing-policy-v2-2026-07-15.json',
  queue: 'data/climate/releases/top20-source-routing-queue-v2-2026-07-15.json',
});

function bytes(relative) { return fs.readFileSync(path.join(ROOT, relative)); }
function json(relative) { return JSON.parse(bytes(relative)); }
function sha256(relative) { return crypto.createHash('sha256').update(bytes(relative)).digest('hex'); }
function pin(relative) { return { path: relative, sha256: sha256(relative) }; }

const policyInputPins = {
  source_registry: pin(PATHS.sourceRegistry),
  ct14_immutable_snapshot: pin(PATHS.ct14),
  ct15_immutable_snapshot: pin(PATHS.ct15),
};
const output = compile({
  sourceRegistry: json(PATHS.sourceRegistry),
  ct14: json(PATHS.ct14),
  ct15: json(PATHS.ct15),
  policyInputPins,
  queueInputPins: {
    ct14_immutable_snapshot: pin(PATHS.ct14),
    source_routing_policy: { path: PATHS.policy, calculation_hash: null },
  },
});

function render(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function writeOrCheck(relative, value) {
  const destination = path.join(ROOT, relative);
  const rendered = render(value);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== rendered) {
      throw new Error(`${relative} is stale; run the builder`);
    }
    return;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, rendered);
}

writeOrCheck(PATHS.policy, output.policy);
writeOrCheck(PATHS.queue, output.queue);
process.stdout.write(`CT-16 source routing policy: ${process.argv.includes('--check') ? 'DETERMINISTIC' : 'WROTE'} (${output.policy.calculation_hash}; ${output.queue.entities.length} entities; release/runtime/scoring false)\n`);
