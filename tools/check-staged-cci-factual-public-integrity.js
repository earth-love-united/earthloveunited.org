#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  CCI_RUNTIME_PATH,
  REVIEW_PATH,
  verifyCciFactualPublicSurface,
} = require('./lib/cci-factual-public');
const { inspectRegular } = require('./lib/public-deploy-surface');

const ROOT = path.resolve(__dirname, '..');
const ROLLBACK_RUNTIME_PATH = 'data/climate/runtime/country-factual-candidate.json';

function resolveStaged(requested) {
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

function run(args) {
  const result = childProcess.spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  if (result.status !== 0) throw new Error(args.join(' ') + ' failed:\n' + (result.stdout || '') + (result.stderr || ''));
  if (result.stdout) process.stdout.write(result.stdout);
}

function verifyExactRollback(sourceRoot, stagedRoot) {
  const source = inspectRegular(sourceRoot, ROLLBACK_RUNTIME_PATH);
  const staged = inspectRegular(stagedRoot, ROLLBACK_RUNTIME_PATH);
  if (source.sha256 !== staged.sha256) throw new Error('rollback runtime byte mismatch');
  const payload = JSON.parse(staged.bytes.toString('utf8'));
  if (!Array.isArray(payload.countries) || payload.countries.length !== 249) {
    throw new Error('rollback runtime must retain the exact 249-registry-entity legacy snapshot');
  }
  return staged.sha256;
}

function verifyStagedIntegrity(stagedRoot) {
  run(['tools/check-public-climate-release-profile.js', '--cci-ai-factual']);
  run(['tools/check-cci-factual-public-review.js']);
  run(['tools/check-country-climate-intelligence.js']);
  run(['tools/check-globe-third-party-notices.js', '--staged', stagedRoot]);
  const surface = verifyCciFactualPublicSurface({ sourceRoot: ROOT, stagedRoot });
  [CCI_RUNTIME_PATH, REVIEW_PATH].forEach(relative => {
    if (inspectRegular(ROOT, relative).sha256 !== inspectRegular(stagedRoot, relative).sha256) {
      throw new Error('source/staged authority byte mismatch: ' + relative);
    }
  });
  const rollbackSha256 = verifyExactRollback(ROOT, stagedRoot);
  return { status: 'pass', file_count: surface.file_count, rollback_sha256: rollbackSha256 };
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length !== 2 || argv[0] !== '--staged' || !argv[1]) {
    throw new Error('usage: node tools/check-staged-cci-factual-public-integrity.js --staged <directory>');
  }
  const report = verifyStagedIntegrity(resolveStaged(argv[1]));
  process.stdout.write(`Final staged CCI AI-factual integrity: PASS (${report.file_count} files; rollback ${report.rollback_sha256})\n`);
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write('Final staged CCI AI-factual integrity: BLOCKED — ' + error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { resolveStaged, verifyExactRollback, verifyStagedIntegrity };
