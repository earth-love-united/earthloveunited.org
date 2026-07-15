#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  ALWAYS_PUBLIC_PATHS,
  CANDIDATE_MARKER_PATH,
  CANDIDATE_ONLY_PATHS,
  expectedSourcePaths,
  verifyPublicDeploySurface,
} = require('./lib/public-deploy-surface');

const ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') return { selfTest: true };
  const stagedIndex = argv.indexOf('--staged');
  const modeIndex = argv.indexOf('--mode');
  if (stagedIndex === -1 || !argv[stagedIndex + 1]) throw new Error('--staged is required');
  if (modeIndex === -1 || !argv[modeIndex + 1]) throw new Error('--mode is required');
  if (argv.length !== 4) throw new Error('unknown public deploy checker argument');
  return { staged: argv[stagedIndex + 1], mode: argv[modeIndex + 1], selfTest: false };
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
  const realRelative = path.relative(fs.realpathSync.native(ROOT), fs.realpathSync.native(candidate));
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error('staged real root must remain inside repository');
  }
  return candidate;
}

function copyFixture(sourceRoot, stagedRoot, mode) {
  expectedSourcePaths(sourceRoot, mode).forEach(relative => {
    const destination = path.join(stagedRoot, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, relative), destination);
  });
  if (mode === 'candidate') {
    fs.writeFileSync(path.join(stagedRoot, CANDIDATE_MARKER_PATH), [
      'LOCAL QA CANDIDATE — DO NOT PUBLISH',
      'Runtime image rights and third-party notices are not reviewed.',
      'production_use_approved=false',
      'release_authority=false',
      '',
    ].join('\n'));
  }
}

function makeSyntheticSource(root) {
  [...ALWAYS_PUBLIC_PATHS, ...CANDIDATE_ONLY_PATHS].forEach(relative => {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, 'fixture:' + relative + '\n');
  });
}

function withFixture(mode, callback) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-public-surface-'));
  const source = path.join(fixtureRoot, 'source');
  const staged = path.join(fixtureRoot, 'staged');
  fs.mkdirSync(source);
  fs.mkdirSync(staged);
  try {
    makeSyntheticSource(source);
    copyFixture(source, staged, mode);
    callback({ source, staged });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function rejected(id, mode, mutate) {
  withFixture(mode, fixture => {
    mutate(fixture.staged);
    assert.throws(() => verifyPublicDeploySurface({ sourceRoot: fixture.source, stagedRoot: fixture.staged, mode }), undefined, id);
  });
}

function runSelfTest() {
  let cases = 0;
  for (const mode of ['candidate', 'release']) {
    withFixture(mode, fixture => {
      assert.equal(verifyPublicDeploySurface({ sourceRoot: fixture.source, stagedRoot: fixture.staged, mode }).status, 'pass');
    });
    cases += 1;
  }
  rejected('unexpected internal fixture', 'candidate', staged => {
    const relative = 'data/climate/fixtures/should-not-publish.json';
    fs.mkdirSync(path.dirname(path.join(staged, relative)), { recursive: true });
    fs.writeFileSync(path.join(staged, relative), '{}');
  }); cases += 1;
  rejected('unexpected NDVI texture', 'candidate', staged => {
    const relative = 'textures/ndvi/ndvi_2024-07.png';
    fs.mkdirSync(path.dirname(path.join(staged, relative)), { recursive: true });
    fs.writeFileSync(path.join(staged, relative), 'not public');
  }); cases += 1;
  rejected('unexpected authoring tool', 'release', staged => {
    const relative = 'tools/build-deploy.sh';
    fs.mkdirSync(path.dirname(path.join(staged, relative)), { recursive: true });
    fs.writeFileSync(path.join(staged, relative), 'not public');
  }); cases += 1;
  rejected('missing runtime script', 'candidate', staged => fs.unlinkSync(path.join(staged, 'js/gaia-utils.js'))); cases += 1;
  rejected('runtime byte tamper', 'candidate', staged => fs.appendFileSync(path.join(staged, 'js/app.js'), '\n// tamper\n')); cases += 1;
  rejected('candidate marker tamper', 'candidate', staged => fs.writeFileSync(path.join(staged, CANDIDATE_MARKER_PATH), 'publish')); cases += 1;
  rejected('release candidate marker leak', 'release', staged => fs.writeFileSync(path.join(staged, CANDIDATE_MARKER_PATH), 'LOCAL QA CANDIDATE — DO NOT PUBLISH')); cases += 1;
  rejected('leaf symlink', 'candidate', staged => {
    fs.unlinkSync(path.join(staged, 'js/app.js'));
    fs.symlinkSync(path.join(staged, 'js/data.js'), path.join(staged, 'js/app.js'));
  }); cases += 1;
  rejected('directory symlink', 'candidate', staged => {
    fs.rmSync(path.join(staged, 'css'), { recursive: true });
    fs.symlinkSync(path.join(staged, 'js'), path.join(staged, 'css'));
  }); cases += 1;
  assert.throws(() => resolveExistingStaged('../escape'), /inside repository/); cases += 1;
  assert.throws(() => parseArgs(['--staged', '_deploy', '--mode', 'candidate', '--extra']), /unknown/); cases += 1;
  process.stdout.write(`Public deploy surface self-test: PASS (${cases} fail-closed cases)\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) return runSelfTest();
  const stagedRoot = resolveExistingStaged(args.staged);
  const report = verifyPublicDeploySurface({ sourceRoot: ROOT, stagedRoot, mode: args.mode });
  process.stdout.write(`Public deploy surface: PASS (${report.file_count} exact files; ${report.mode})\n`);
}

if (require.main === module) main();

module.exports = { copyFixture, parseArgs, resolveExistingStaged, runSelfTest };
