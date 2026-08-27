#!/usr/bin/env node
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const FOSSIL = {
  component: 'fossil',
  file_name: 'National_Fossil_Carbon_Emissions_2025_v1.0.xlsx',
  bytes: 755198,
  sha256: '968097cacb1a6a5bfa0cf74ee90763f74a90ef10499e060ab43d1a74c671d46b',
  landing_url: 'https://meta.icos-cp.eu/objects/loCXyssaalv6DPdO6Qdj90qQ',
  doi: 'https://doi.org/10.18160/GCP-2025',
};

const LAND_USE = {
  component: 'land-use',
  file_name: 'National_LandUseChange_Carbon_Emissions_2025_v1.0.xlsx',
  bytes: 1271678,
  sha256: '9a29536d6925d06f8c4a97581b720121fcf219732c240e970bc24167d74e38d1',
  landing_url: 'https://meta.icos-cp.eu/objects/milTbWkl0G-MSpdYG3IBIfzy',
  doi: 'https://doi.org/10.18160/GCP-2025',
};

const EXPECTED = FOSSIL;
const EXPECTED_ARTIFACTS = { fossil: FOSSIL, 'land-use': LAND_USE };

function usage() {
  console.log('Usage: node tools/acquire-gcb-2025.js --verify /absolute/path/to/workbook.xlsx');
  console.log('       node tools/acquire-gcb-2025.js --verify fossil /absolute/path/to/fossil.xlsx');
  console.log('       node tools/acquire-gcb-2025.js --verify land-use /absolute/path/to/land-use.xlsx');
  console.log('       node tools/acquire-gcb-2025.js --metadata');
}

function checksum(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function verify(file, component = 'fossil') {
  const expected = EXPECTED_ARTIFACTS[component];
  if (!expected) throw new Error(`Unknown GCB component: ${component}`);
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) throw new Error(`Workbook not found: ${absolute}`);
  const stats = fs.statSync(absolute);
  const sha256 = checksum(absolute);
  if (stats.size !== expected.bytes || sha256 !== expected.sha256) {
    throw new Error(
      `Source mismatch: expected ${expected.bytes} bytes / ${expected.sha256}, ` +
      `received ${stats.size} bytes / ${sha256}. Refusing to compile a different release.`
    );
  }
  console.log(`GCB source verified: ${expected.file_name}`);
  console.log(`SHA-256: ${sha256}`);
  return absolute;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--metadata') {
    console.log(JSON.stringify(EXPECTED_ARTIFACTS, null, 2));
    return;
  }
  if (args.length === 2 && args[0] === '--verify') {
    verify(args[1]);
    return;
  }
  if (args.length === 3 && args[0] === '--verify') {
    verify(args[2], args[1]);
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

module.exports = { EXPECTED, EXPECTED_ARTIFACTS, verify };
