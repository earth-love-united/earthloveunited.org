#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const EXPECTED = {
  file_name: 'National_Fossil_Carbon_Emissions_2025_v1.0.xlsx',
  bytes: 755198,
  sha256: '968097cacb1a6a5bfa0cf74ee90763f74a90ef10499e060ab43d1a74c671d46b',
  landing_url: 'https://meta.icos-cp.eu/objects/loCXyssaalv6DPdO6Qdj90qQ',
  doi: 'https://doi.org/10.18160/GCP-2025',
};

function usage() {
  console.log('Usage: node tools/acquire-gcb-2025.js --verify /absolute/path/to/workbook.xlsx');
  console.log('       node tools/acquire-gcb-2025.js --metadata');
}

function checksum(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function verify(file) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) throw new Error(`Workbook not found: ${absolute}`);
  const stats = fs.statSync(absolute);
  const sha256 = checksum(absolute);
  if (stats.size !== EXPECTED.bytes || sha256 !== EXPECTED.sha256) {
    throw new Error(
      `Source mismatch: expected ${EXPECTED.bytes} bytes / ${EXPECTED.sha256}, ` +
      `received ${stats.size} bytes / ${sha256}. Refusing to compile a different release.`
    );
  }
  console.log(`GCB source verified: ${EXPECTED.file_name}`);
  console.log(`SHA-256: ${sha256}`);
  return absolute;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--metadata') {
    console.log(JSON.stringify(EXPECTED, null, 2));
    return;
  }
  if (args.length === 2 && args[0] === '--verify') {
    verify(args[1]);
    return;
  }
  if (args.includes('--download')) {
    throw new Error(
      `Automated download is disabled because ${EXPECTED.landing_url} requires a person to accept ` +
      'external licence terms. Download it manually after authorization, then use --verify.'
    );
  }
  usage();
  process.exitCode = 2;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { EXPECTED, verify };
