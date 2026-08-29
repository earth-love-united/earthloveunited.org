#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CCI_RUNTIME_PATH,
  EXCLUDED_GLOBE_PATHS,
  PUBLIC_REVIEW_LABEL,
  REVIEW_PATH,
  expectedSourcePaths,
  replaceExact,
  transformText,
  verifyCciFactualPublicSurface,
} = require('./lib/cci-factual-public');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') return { selfTest: true };
  if (argv.length === 2 && argv[0] === '--staged' && argv[1]) return { selfTest: false, staged: argv[1] };
  throw new Error('usage: node tools/check-cci-factual-public-deploy.js --self-test | --staged <directory>');
}

function resolveExistingStaged(requested) {
  if (typeof requested !== 'string' || !requested || requested.includes('\0')) throw new Error('unsafe staged directory');
  const candidate = path.resolve(ROOT, requested);
  const relative = path.relative(ROOT, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('staged root must be inside repository');
  let current = ROOT;
  relative.split(path.sep).forEach(part => {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('staged root must contain only real directories');
  });
  return candidate;
}

function runSelfTest() {
  const paths = expectedSourcePaths();
  assert(paths.includes(CCI_RUNTIME_PATH));
  assert(paths.includes(REVIEW_PATH));
  EXCLUDED_GLOBE_PATHS.forEach(relative => assert(!paths.includes(relative), relative));
  const transformed = Object.fromEntries([
    'index.html',
    'js/country-climate-intelligence.js',
    'js/globe.js',
    'sw.js',
  ].map(relative => [relative, transformText(relative, fs.readFileSync(path.join(ROOT, relative), 'utf8'))]));
  assert(transformed['index.html'].includes(PUBLIC_REVIEW_LABEL));
  assert(transformed['index.html'].includes(REVIEW_PATH));
  assert(transformed['js/country-climate-intelligence.js'].includes('AI-reviewed source-data release'));
  assert(!transformed['js/country-climate-intelligence.js'].includes("query.get('carbon-relief')"));
  assert(transformed['js/globe.js'].includes('.bumpImageUrl(null)'));
  assert(transformed['js/globe.js'].includes(PUBLIC_REVIEW_LABEL));
  assert(transformed['sw.js'].includes('elu-v80-cci-factual-ai-review'));
  ['night-sky.png', 'earth-blue-marble.jpg', 'earth-topology.png'].forEach(name => {
    assert(!transformed['js/globe.js'].includes(name), name);
    assert(!transformed['sw.js'].includes(name), name);
  });
  assert.throws(() => replaceExact('one', 'missing', 'value', 1, 'fixture'), /expected 1 exact/);
  assert.throws(() => replaceExact('two two', 'two', 'value', 1, 'fixture'), /found 2/);
  process.stdout.write('CCI AI-factual deploy self-test: PASS (rights-safe surface, exact transforms, fail-closed drift)\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) return runSelfTest();
  const report = verifyCciFactualPublicSurface({
    sourceRoot: ROOT,
    stagedRoot: resolveExistingStaged(args.staged),
  });
  process.stdout.write(`CCI AI-factual deploy: PASS (${report.file_count} exact files)\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write('CCI AI-factual deploy: BLOCKED — ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, resolveExistingStaged, runSelfTest };
