#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { rehearse } = require('./lib/ct42-runtime-rollback-proof');

const ROOT = path.resolve(__dirname, '..');
const proof = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/reviews/ct42-candidate-rollback-rehearsal.json')));
const result = rehearse(ROOT, proof);

process.stdout.write([
  'CT-42 runtime rollback rehearsal: PASS',
  `  candidate decision: ${result.candidate_decision}`,
  `  fail-closed files restored: ${result.changed_files}`,
  `  service-worker cache: ${result.cache_name}`,
  `  prohibited production outputs absent: ${result.prohibited_outputs_absent}`,
  '  workspace mutation / deploy: false',
].join('\n') + '\n');
