#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { compileCoverageQueue } = require('./lib/country-coverage-gap-queue.js');

const ROOT = path.resolve(__dirname, '..');
const generatedAt = process.argv[2];
if (!generatedAt) {
  console.error('usage: node tools/build-country-coverage-gap-queue.js <generated_at_utc>');
  process.exit(1);
}

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

const output = compileCoverageQueue(
  read('data/climate/country-registry.json'),
  read('data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json'),
  read('data/climate/releases/primap-hist-2.6.1-economy-wide-2026-07-15.json'),
  generatedAt
);
const destination = path.join(ROOT, 'data/climate/releases/country-coverage-gap-queue-2026-07-15.json');
fs.writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`);
console.log(`coverage gap queue: wrote ${output.counts.registry_entities} rows and ${output.counts.queue_tasks} tasks to ${path.relative(ROOT, destination)}`);
