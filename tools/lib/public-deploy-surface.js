'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CANDIDATE_MARKER_PATH = 'CANDIDATE-NOT-FOR-PUBLICATION.txt';
const APPROVAL_PATH = 'data/climate/reviews/globe-runtime-assets-production-review.json';
const SIGNATURE_BUNDLE_PATH = 'data/climate/reviews/globe-runtime-assets-production-review.signatures.json';

// This is the complete public artifact surface. Internal fixtures, reviews,
// operations patches, authoring tools, knowledge indices, and NDVI experiments
// are deliberately absent.
const ALWAYS_PUBLIC_PATHS = Object.freeze([
  'THIRD_PARTY_NOTICES.txt',
  '_headers',
  'index.html',
  'manifest.json',
  'sw.js',
  'css/carbon-clock.css',
  'css/globe-system.css',
  'js/gaia-utils.js',
  'js/module-contracts.js',
  'js/event-bus.js',
  'js/storage-adapter.js',
  'js/storage.js',
  'js/data-schema.js',
  'js/data.js',
  'js/globe.js',
  'js/carbon-clock.js',
  'js/app.js',
  'js/vendor/globe.gl.js',
  'assets/globe/runtime/manifest.json',
  'assets/globe/runtime/ne_110m_admin_0_countries.geojson',
  'assets/globe/runtime/earth-night.jpg',
  'assets/globe/runtime/night-sky.svg',
  'assets/globe/runtime/earth-blue-marble.jpg',
  'assets/globe/runtime/earth-topology.png',
  'assets/legacy/brandon.jpg',
  'assets/legacy/ekmel.jpg',
  'assets/legacy/elu-logo.png',
  'assets/legacy/mike.png',
  'assets/legacy/video-what-is-elu.jpg',
  'assets/partners/avocademy.svg',
  'assets/partners/climate-change-ai.png',
  'assets/partners/connecticut-green-bank.png',
  'assets/partners/save-planet-earth.svg',
  'assets/partners/st-vincents-wordmark.png',
  'data/carbon-projects.json',
  'data/small-nations.json',
  'data/climate/runtime/candidate-manifest.json',
  'data/climate/runtime/country-factual-candidate.json',
  'data/climate/governance/globe-runtime-approval-trust.json',
  'data/climate/schemas/globe-runtime-assets-production-review.schema.json',
  'data/governance/vendor/globe-gl-2.46.1-notices.json',
  'data/governance/vendor/globe-gl-2.46.1-notices-integration.json',
].sort());

const CANDIDATE_ONLY_PATHS = Object.freeze([
  'tools/smoke-test.js',
  'tools/stack-lint.js',
].sort());

const OPTIONAL_APPROVAL_PATHS = Object.freeze([
  APPROVAL_PATH,
  SIGNATURE_BUNDLE_PATH,
].sort());

function safeRelative(relative) {
  const normalized = path.posix.normalize(String(relative || '').replaceAll(path.sep, '/'));
  if (!normalized || normalized === '..' || normalized.startsWith('../') ||
      path.posix.isAbsolute(normalized) || normalized.includes('\0')) {
    throw new Error('unsafe public deploy path: ' + relative);
  }
  return normalized;
}

function inspectRegular(root, relative) {
  const normalized = safeRelative(relative);
  const absoluteRoot = path.resolve(root);
  const rootStat = fs.lstatSync(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('public deploy root must be a real directory: ' + absoluteRoot);
  }
  let current = absoluteRoot;
  const parts = normalized.split('/');
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('public deploy path must not contain symlinks: ' + normalized);
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error('public deploy path has a non-directory parent: ' + normalized);
    }
    if (index === parts.length - 1 && !stat.isFile()) {
      throw new Error('public deploy path must be a regular file: ' + normalized);
    }
  }
  const bytes = fs.readFileSync(current);
  return {
    path: normalized,
    absolute: current,
    bytes,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

function approvalPaths(sourceRoot) {
  const records = OPTIONAL_APPROVAL_PATHS.map(relative => {
    try {
      return { relative, stat: fs.lstatSync(path.join(sourceRoot, relative)) };
    } catch (error) {
      if (error.code === 'ENOENT') return { relative, stat: null };
      throw error;
    }
  });
  const present = records.filter(record => record.stat !== null);
  if (present.length === 0) return [];
  if (present.length !== OPTIONAL_APPROVAL_PATHS.length) {
    throw new Error('runtime approval and detached signature bundle must be present together');
  }
  records.forEach(record => inspectRegular(sourceRoot, record.relative));
  return [...OPTIONAL_APPROVAL_PATHS];
}

function expectedSourcePaths(sourceRoot, mode) {
  if (!['candidate', 'release'].includes(mode)) throw new Error('deploy mode must be candidate or release');
  const paths = [
    ...ALWAYS_PUBLIC_PATHS,
    ...(mode === 'candidate' ? CANDIDATE_ONLY_PATHS : []),
    ...approvalPaths(sourceRoot),
  ];
  const normalized = paths.map(safeRelative).sort();
  if (new Set(normalized).size !== normalized.length) throw new Error('public deploy path list contains duplicates');
  return normalized;
}

function expectedStagedPaths(sourceRoot, mode) {
  return [
    ...expectedSourcePaths(sourceRoot, mode),
    ...(mode === 'candidate' ? [CANDIDATE_MARKER_PATH] : []),
  ].sort();
}

function listFiles(root) {
  const absoluteRoot = path.resolve(root);
  const output = [];
  const visit = (absolute, relative) => {
    const entries = fs.readdirSync(absolute, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    entries.forEach(entry => {
      const childRelative = safeRelative(relative ? path.posix.join(relative, entry.name) : entry.name);
      const childAbsolute = path.join(absolute, entry.name);
      const stat = fs.lstatSync(childAbsolute);
      if (stat.isSymbolicLink()) throw new Error('staged public surface contains a symlink: ' + childRelative);
      if (stat.isDirectory()) visit(childAbsolute, childRelative);
      else if (stat.isFile()) output.push(childRelative);
      else throw new Error('staged public surface contains a non-regular entry: ' + childRelative);
    });
  };
  const rootStat = fs.lstatSync(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('staged root must be a real directory');
  visit(absoluteRoot, '');
  return output.sort();
}

function verifyPublicDeploySurface(options) {
  const sourceRoot = path.resolve(options.sourceRoot);
  const stagedRoot = path.resolve(options.stagedRoot);
  const mode = options.mode;
  const expected = expectedStagedPaths(sourceRoot, mode);
  const actual = listFiles(stagedRoot);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    const missing = expected.filter(relative => !actualSet.has(relative));
    const unexpected = actual.filter(relative => !expectedSet.has(relative));
    throw new Error('staged public surface mismatch; missing=[' + missing.join(', ') + '] unexpected=[' + unexpected.join(', ') + ']');
  }
  expectedSourcePaths(sourceRoot, mode).forEach(relative => {
    const source = inspectRegular(sourceRoot, relative);
    const staged = inspectRegular(stagedRoot, relative);
    if (source.sha256 !== staged.sha256) throw new Error('source/staged public byte mismatch: ' + relative);
  });
  if (mode === 'candidate') {
    const marker = inspectRegular(stagedRoot, CANDIDATE_MARKER_PATH).bytes.toString('utf8');
    for (const token of ['LOCAL QA CANDIDATE — DO NOT PUBLISH', 'production_use_approved=false', 'release_authority=false']) {
      if (!marker.includes(token)) throw new Error('candidate marker missing boundary: ' + token);
    }
  }
  return { status: 'pass', mode, file_count: actual.length, paths: actual };
}

module.exports = {
  ALWAYS_PUBLIC_PATHS,
  APPROVAL_PATH,
  CANDIDATE_MARKER_PATH,
  CANDIDATE_ONLY_PATHS,
  OPTIONAL_APPROVAL_PATHS,
  SIGNATURE_BUNDLE_PATH,
  expectedSourcePaths,
  expectedStagedPaths,
  inspectRegular,
  listFiles,
  safeRelative,
  verifyPublicDeploySurface,
};
