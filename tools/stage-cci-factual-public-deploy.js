#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  TRANSFORMED_PATHS,
  expectedBytes,
  expectedSourcePaths,
  sha256,
} = require('./lib/cci-factual-public');
const { inspectRegular } = require('./lib/public-deploy-surface');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--staged' || !argv[1]) {
    throw new Error('usage: node tools/stage-cci-factual-public-deploy.js --staged <directory>');
  }
  return argv[1];
}

function resolveStaged(requested) {
  if (typeof requested !== 'string' || !requested || requested.includes('\0')) throw new Error('unsafe staged directory');
  const candidate = path.resolve(ROOT, requested);
  const relative = path.relative(ROOT, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('staged directory must be inside the repository');
  }
  let current = ROOT;
  relative.split(path.sep).forEach(part => {
    current = path.join(current, part);
    if (!fs.existsSync(current)) fs.mkdirSync(current);
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('staged path must contain only real directories');
  });
  const realRelative = path.relative(fs.realpathSync.native(ROOT), fs.realpathSync.native(candidate));
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error('staged real path must remain inside repository');
  }
  return candidate;
}

function writeExact(stagedRoot, relative) {
  const destination = path.join(stagedRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const bytes = expectedBytes(ROOT, relative);
  fs.writeFileSync(destination, bytes, { flag: 'wx' });
  const staged = inspectRegular(stagedRoot, relative);
  if (staged.sha256 !== sha256(bytes)) throw new Error('staged write verification failed: ' + relative);
}

function main() {
  const stagedRoot = resolveStaged(parseArgs(process.argv.slice(2)));
  const existing = fs.readdirSync(stagedRoot);
  if (existing.some(name => name !== 'THIRD_PARTY_NOTICES.txt')) {
    throw new Error('staged directory must be empty except for the separately verified notice');
  }
  expectedSourcePaths()
    .filter(relative => relative !== 'THIRD_PARTY_NOTICES.txt')
    .forEach(relative => writeExact(stagedRoot, relative));
  if (!fs.existsSync(path.join(stagedRoot, 'THIRD_PARTY_NOTICES.txt'))) {
    throw new Error('separately verified third-party notice is missing');
  }
  process.stdout.write(`CCI AI-factual staging: PASS (${expectedSourcePaths().length} files; ${TRANSFORMED_PATHS.length} deterministic transforms)\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write('CCI AI-factual staging: BLOCKED — ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, resolveStaged, writeExact };
