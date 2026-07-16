#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  CANDIDATE_MARKER_PATH,
  CANDIDATE_MARKER_TEXT,
  expectedSourcePaths,
  inspectRegular,
} = require('./lib/public-deploy-surface');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const stagedIndex = argv.indexOf('--staged');
  const modeIndex = argv.indexOf('--mode');
  if (stagedIndex === -1 || !argv[stagedIndex + 1]) throw new Error('--staged is required');
  if (modeIndex === -1 || !argv[modeIndex + 1]) throw new Error('--mode is required');
  const allowed = new Set(['--staged', argv[stagedIndex + 1], '--mode', argv[modeIndex + 1]]);
  if (argv.some(value => !allowed.has(value))) throw new Error('unknown stage-public-deploy argument');
  return { staged: argv[stagedIndex + 1], mode: argv[modeIndex + 1] };
}

function resolveStaged(requested) {
  if (typeof requested !== 'string' || !requested || requested.includes('\0')) throw new Error('unsafe staged directory');
  const candidate = path.resolve(ROOT, requested);
  const relative = path.relative(ROOT, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('staged directory must be inside the repository');
  }
  const rootStat = fs.lstatSync(ROOT);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('repository root must be a real directory');
  let current = ROOT;
  relative.split(path.sep).forEach(part => {
    current = path.join(current, part);
    if (!fs.existsSync(current)) fs.mkdirSync(current);
    const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('staged path must contain only real directories');
  });
  const realRoot = fs.realpathSync.native(ROOT);
  const realCandidate = fs.realpathSync.native(candidate);
  const realRelative = path.relative(realRoot, realCandidate);
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error('staged real path must remain inside repository');
  }
  return realCandidate;
}

function copyExact(sourceRoot, stagedRoot, relative) {
  const source = inspectRegular(sourceRoot, relative);
  const destination = path.join(stagedRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source.absolute, destination, fs.constants.COPYFILE_EXCL);
  const staged = inspectRegular(stagedRoot, relative);
  if (source.sha256 !== staged.sha256) throw new Error('copy verification failed: ' + relative);
}

function main() {
  const { staged, mode } = parseArgs(process.argv.slice(2));
  const stagedRoot = resolveStaged(staged);
  const existing = fs.readdirSync(stagedRoot);
  if (existing.some(name => name !== 'THIRD_PARTY_NOTICES.txt')) {
    throw new Error('staged directory must be empty except for the separately verified notice');
  }
  const paths = expectedSourcePaths(ROOT, mode);
  paths.filter(relative => relative !== 'THIRD_PARTY_NOTICES.txt')
    .forEach(relative => copyExact(ROOT, stagedRoot, relative));
  if (!fs.existsSync(path.join(stagedRoot, 'THIRD_PARTY_NOTICES.txt'))) {
    throw new Error('separately verified third-party notice is missing');
  }
  if (mode === 'candidate') {
    fs.writeFileSync(path.join(stagedRoot, CANDIDATE_MARKER_PATH), CANDIDATE_MARKER_TEXT, { flag: 'wx' });
  }
  process.stdout.write(`Public deploy staging: PASS (${paths.length} exact source files; ${mode})\n`);
}

if (require.main === module) main();

module.exports = { copyExact, parseArgs, resolveStaged };
