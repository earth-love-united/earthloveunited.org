#!/usr/bin/env node
// Deterministic CT-04 guard: the historical country payload is documentation-only.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const historicalPath = ['data', 'pledge-nodes.json'].join('/');
const retiredAliases = [
  ['pledge', 'Nodes'].join(''),
  ['country', 'HexColors'].join(''),
  ['get', 'PledgeNode'].join(''),
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function listJs(relativeDir) {
  const absoluteDir = path.join(ROOT, relativeDir);
  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap(entry => {
    const relative = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return listJs(relative);
    return entry.isFile() && entry.name.endsWith('.js') ? [relative] : [];
  });
}

const runtimeFiles = [
  'index.html',
  'sw.js',
  ...listJs('js'),
  'tools/smoke-test.js',
  'tools/impact-analyzer.js',
];

for (const relativePath of runtimeFiles) {
  const source = read(relativePath);
  if (source.includes(historicalPath)) {
    failures.push(`${relativePath}: live historical payload path`);
  }
  for (const alias of retiredAliases) {
    if (source.includes(alias)) failures.push(`${relativePath}: retired runtime alias ${alias}`);
  }
}

const dataSource = read('js/data.js');
if (/fetch\s*\([^)]*pledge/i.test(dataSource)) failures.push('js/data.js: legacy country fetch detected');

const serviceWorker = read('sw.js');
if (serviceWorker.includes(historicalPath)) failures.push('sw.js: legacy payload remains in cache manifest');
if (!serviceWorker.includes("const CACHE_NAME = 'elu-v26'")) failures.push('sw.js: cache version was not advanced to elu-v26');

const index = read('index.html');
if (!index.includes('docs/LEGACY-COUNTRY-DATA-EXIT.md')) failures.push('index.html: public exit-ledger link missing');
if (!index.includes("navigator.serviceWorker.register('/sw.js?v=26'")) failures.push('index.html: service-worker registration is not v26');

const ledger = read('docs/LEGACY-COUNTRY-DATA-EXIT.md');
const payload = JSON.parse(read(historicalPath));
const rows = Array.isArray(payload.data) ? payload.data : payload;
const fields = [...new Set(rows.flatMap(row => Object.keys(row)))].sort();
if (fields.length !== 27) failures.push(`historical payload: expected 27 fields, found ${fields.length}`);
for (const field of fields) {
  if (!ledger.includes('`' + field + '`')) failures.push(`exit ledger: missing field ${field}`);
}
if (!ledger.includes('None of its fields may be used in public country cards')) {
  failures.push('exit ledger: explicit public-use prohibition missing');
}

if (failures.length) {
  failures.forEach(message => console.error('FAIL:', message));
  process.exit(1);
}

console.log(`legacy country exit: PASS (${fields.length} fields ledgered; ${runtimeFiles.length} live files clean)`);
