#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const surface = require('./lib/climate-public-beta-surface');

const ROOT = path.resolve(__dirname, '..');
const LEVELS = new Set(['invited_beta', 'public_beta']);

function serialize(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function write(root, relative, bytes) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}

function fixtureBytes(relative) {
  if (relative.endsWith('index.html')) {
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="css/beta.css"></head><body><main>Climate Public Beta</main><script src="js/beta.js"></script></body></html>\n';
  }
  if (relative.endsWith('beta.css')) return ':root{color-scheme:dark} body{font-family:system-ui}\n';
  if (relative.endsWith('beta.js')) return "'use strict'; window.CLIMATE_BETA_APP = Object.freeze({ status: 'fixture' });\n";
  if (relative.endsWith('_headers')) return '/*\n  X-Content-Type-Options: nosniff\n\n/sw.js\n  Cache-Control: no-store\n\n';
  if (relative.endsWith('THIRD_PARTY_NOTICES.txt')) return 'Climate Public Beta fixture notices\n';
  if (relative.endsWith('LGPL-2.1.txt')) return 'Fixture license text\n';
  if (relative.endsWith('.SOURCE.md')) return '# Fixture identity source\n';
  return serialize({ fixture: relative, assessed_production_authority: false });
}

function rehash(manifest) {
  const next = structuredClone(manifest);
  next.calculation_hash = null;
  next.calculation_hash = surface.hashJson(next);
  return next;
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-public-beta-surface-'));
  const sourceRoot = path.join(root, 'source');
  const stagedRoot = path.join(root, 'staged');
  fs.mkdirSync(sourceRoot);
  fs.mkdirSync(stagedRoot);
  const betaReleaseId = 'fixture-beta-1';
  surface.requiredMappings(betaReleaseId).forEach(mapping => {
    write(sourceRoot, mapping.source_path, fixtureBytes(mapping.source_path));
  });
  const manifest = surface.buildExpectedManifest({ sourceRoot, betaReleaseId });
  write(sourceRoot, surface.PUBLIC_SURFACE_MANIFEST_PATH, serialize(manifest));
  manifest.files.forEach(entry => {
    write(stagedRoot, entry.destination_path, fs.readFileSync(path.join(sourceRoot, entry.source_path)));
  });
  return { root, sourceRoot, stagedRoot, manifest, betaReleaseId };
}

function withFixture(callback) {
  const fixture = makeFixture();
  try { callback(fixture); }
  finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
}

function rejected(id, mutate) {
  withFixture(fixture => {
    mutate(fixture);
    assert.throws(() => surface.verifyStagedSurface(fixture), undefined, id);
  });
}

function pairUiMutation(fixture, destination, text) {
  const entry = fixture.manifest.files.find(item => item.destination_path === destination);
  assert(entry, 'fixture destination must exist');
  write(fixture.sourceRoot, entry.source_path, text);
  write(fixture.stagedRoot, entry.destination_path, text);
  fixture.manifest = surface.buildExpectedManifest({
    sourceRoot: fixture.sourceRoot,
    betaReleaseId: fixture.betaReleaseId,
  });
}

function runSelfTest() {
  let cases = 0;
  withFixture(fixture => {
    const report = surface.verifyStagedSurface(fixture);
    assert.equal(report.status, 'pass');
    assert.equal(report.file_count, surface.requiredMappings(fixture.betaReleaseId).length);
  }); cases += 1;
  rejected('unexpected file', fixture => write(fixture.stagedRoot, 'unexpected.txt', 'no\n')); cases += 1;
  rejected('missing file', fixture => fs.unlinkSync(path.join(fixture.stagedRoot, 'js/beta.js'))); cases += 1;
  rejected('staged byte drift', fixture => fs.appendFileSync(path.join(fixture.stagedRoot, 'js/beta.js'), '// drift\n')); cases += 1;
  rejected('source byte drift', fixture => fs.appendFileSync(path.join(fixture.sourceRoot, 'climate-public-beta/js/beta.js'), '// drift\n')); cases += 1;
  rejected('staged leaf symlink', fixture => {
    const target = path.join(fixture.stagedRoot, 'js/beta.js');
    fs.unlinkSync(target);
    fs.symlinkSync(path.join(fixture.stagedRoot, 'css/beta.css'), target);
  }); cases += 1;
  rejected('staged directory symlink', fixture => {
    fs.rmSync(path.join(fixture.stagedRoot, 'css'), { recursive: true });
    fs.symlinkSync(path.join(fixture.stagedRoot, 'js'), path.join(fixture.stagedRoot, 'css'));
  }); cases += 1;
  rejected('manifest calculation drift', fixture => { fixture.manifest.calculation_hash = '0'.repeat(64); }); cases += 1;
  rejected('manifest file hash drift', fixture => {
    fixture.manifest.files[0].sha256 = '0'.repeat(64);
    fixture.manifest = rehash(fixture.manifest);
  }); cases += 1;
  rejected('manifest duplicate path', fixture => {
    fixture.manifest.files[1] = structuredClone(fixture.manifest.files[0]);
    fixture.manifest = rehash(fixture.manifest);
  }); cases += 1;
  rejected('manifest extra path', fixture => {
    fixture.manifest.files.push({
      source_path: 'climate-public-beta/extra.txt',
      destination_path: 'extra.txt',
      sha256: '0'.repeat(64),
    });
    fixture.manifest = rehash(fixture.manifest);
  }); cases += 1;
  rejected('candidate destination', fixture => {
    fixture.manifest.files[0].destination_path = 'data/climate/runtime/country-factual-candidate.json';
    fixture.manifest = rehash(fixture.manifest);
  }); cases += 1;
  rejected('service worker destination', fixture => {
    fixture.manifest.files[0].destination_path = 'sw.js';
    fixture.manifest = rehash(fixture.manifest);
  }); cases += 1;
  rejected('external script', fixture => pairUiMutation(
    fixture,
    'index.html',
    '<!doctype html><script src="https://example.invalid/app.js"></script>\n',
  )); cases += 1;
  rejected('external CSS resource', fixture => pairUiMutation(
    fixture,
    'css/beta.css',
    'body{background:url(https://example.invalid/image.png)}\n',
  )); cases += 1;
  rejected('external fetch', fixture => pairUiMutation(
    fixture,
    'js/beta.js',
    "fetch('https://example.invalid/data.json');\n",
  )); cases += 1;
  rejected('service worker registration', fixture => pairUiMutation(
    fixture,
    'js/beta.js',
    "navigator.serviceWorker.register('/sw.js');\n",
  )); cases += 1;
  rejected('candidate content reference', fixture => pairUiMutation(
    fixture,
    'js/beta.js',
    "fetch('data/climate/runtime/country-factual-candidate.json');\n",
  )); cases += 1;
  assert.throws(() => surface.safeRelative('../escape'), /unsafe/); cases += 1;
  assert.throws(() => surface.safeRelative('safe/../escape'), /unsafe/); cases += 1;
  assert.throws(() => surface.requiredMappings('../release'), /invalid beta release id/); cases += 1;
  ['a1', 'fixture_beta-1', 'fixture..beta-1', `a${'b'.repeat(63)}1`].forEach(invalidReleaseId => {
    assert.throws(() => surface.requiredMappings(invalidReleaseId), /invalid beta release id/);
    cases += 1;
  });
  assert.throws(() => surface.assertAllowedDestination('tools/internal.js'), /forbidden/); cases += 1;

  process.stdout.write(`Climate public-beta surface policy: PASS (${cases} fail-closed cases)\n`);
}

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') return { selfTest: true };
  if (argv.length !== 4 || argv[0] !== '--staged' || argv[2] !== '--level' ||
      !argv[1] || !LEVELS.has(argv[3])) {
    throw new Error('usage: --self-test or --staged <directory> --level <invited_beta|public_beta>');
  }
  return { selfTest: false, staged: argv[1], level: argv[3] };
}

function resolveStaged(requested) {
  const absolute = path.resolve(ROOT, requested);
  const relative = path.relative(ROOT, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('staged public-beta directory must be inside the repository');
  }
  return absolute;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) return runSelfTest();
  const { manifest } = surface.readExpectedManifest(ROOT);
  const report = surface.verifyStagedSurface({
    sourceRoot: ROOT,
    stagedRoot: resolveStaged(args.staged),
    manifest,
  });
  process.stdout.write(`Climate public-beta surface: PASS (${args.level}; ${report.file_count} exact files; ${report.beta_release_id})\n`);
}

if (require.main === module) main();

module.exports = { makeFixture, parseArgs, resolveStaged, runSelfTest };
