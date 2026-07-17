'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { parseJsonNoDuplicateKeys } = require('./json-schema-lite');

const PUBLIC_SURFACE_MANIFEST_PATH =
  'data/climate/public-beta/governance/public-surface-manifest.json';
const RUNTIME_MANIFEST_PATH =
  'data/climate/public-beta/runtime/runtime-manifest.json';
const RUNTIME_LICENSE_PATH =
  'data/climate/public-beta/runtime/licenses/LGPL-2.1.txt';
const RELEASE_ROOT_PREFIX = 'data/climate/public-beta/runtime/releases/';

const FIXED_MAPPINGS = Object.freeze([
  { source_path: 'climate-public-beta/index.html', destination_path: 'index.html' },
  { source_path: 'climate-public-beta/_headers', destination_path: '_headers' },
  {
    source_path: 'climate-public-beta/THIRD_PARTY_NOTICES.txt',
    destination_path: 'THIRD_PARTY_NOTICES.txt',
  },
  { source_path: 'climate-public-beta/css/beta.css', destination_path: 'css/beta.css' },
  { source_path: 'climate-public-beta/js/beta.js', destination_path: 'js/beta.js' },
  { source_path: RUNTIME_MANIFEST_PATH, destination_path: RUNTIME_MANIFEST_PATH },
  { source_path: RUNTIME_LICENSE_PATH, destination_path: RUNTIME_LICENSE_PATH },
]);

const RELEASE_FILENAMES = Object.freeze([
  'country-factual.json',
  'country-identity.json',
  'country-identity.SOURCE.md',
  'country-identity-transform.json',
  'fact-lineage.json',
  'known-limitations.json',
  'correction-log.json',
]);

const MANIFEST_KEYS = Object.freeze([
  'assessed_production_authority',
  'beta_release_id',
  'calculation_hash',
  'files',
  'manifest_id',
  'publication_channel',
  'schema_version',
]);

const FILE_KEYS = Object.freeze(['destination_path', 'sha256', 'source_path']);
const SHA256 = /^[0-9a-f]{64}$/;
const BETA_ID = /^(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/;

const FORBIDDEN_PUBLIC_PATHS = Object.freeze([
  'CANDIDATE-NOT-FOR-PUBLICATION.txt',
  'manifest.json',
  'sw.js',
]);

const FORBIDDEN_PUBLIC_PREFIXES = Object.freeze([
  'assets/',
  'data/climate/fixtures/',
  'data/climate/operations/',
  'data/climate/reviews/',
  'data/climate/releases/',
  'data/climate/runtime/',
  'data/governance/',
  'docs/',
  'js/vendor/',
  'tools/',
]);

const UI_TEXT_PATHS = Object.freeze([
  'index.html',
  '_headers',
  'THIRD_PARTY_NOTICES.txt',
  'css/beta.css',
  'js/beta.js',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function hashBytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashJson(value) {
  return hashBytes(Buffer.from(JSON.stringify(stable(value))));
}

function exactKeys(value, expected) {
  return Boolean(value) && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function safeRelative(relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\0') || relative.includes('\\')) {
    throw new Error('unsafe public-beta path');
  }
  const normalized = path.posix.normalize(relative);
  if (normalized !== relative || normalized === '..' || normalized.startsWith('../') ||
      path.posix.isAbsolute(normalized)) {
    throw new Error('unsafe public-beta path: ' + relative);
  }
  return normalized;
}

function safeReleaseRoot(betaReleaseId) {
  if (typeof betaReleaseId !== 'string' || !BETA_ID.test(betaReleaseId)) {
    throw new Error('invalid beta release id');
  }
  return RELEASE_ROOT_PREFIX + betaReleaseId;
}

function releaseMappings(betaReleaseId) {
  const releaseRoot = safeReleaseRoot(betaReleaseId);
  return RELEASE_FILENAMES.map(filename => {
    const relative = path.posix.join(releaseRoot, filename);
    return { source_path: relative, destination_path: relative };
  });
}

function requiredMappings(betaReleaseId) {
  return [...FIXED_MAPPINGS, ...releaseMappings(betaReleaseId)]
    .sort((left, right) => left.destination_path.localeCompare(right.destination_path));
}

function inspectRegular(root, relative) {
  const normalized = safeRelative(relative);
  const absoluteRoot = path.resolve(root);
  const rootStat = fs.lstatSync(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('public-beta root must be a real directory');
  }
  let current = absoluteRoot;
  normalized.split('/').forEach((part, index, parts) => {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('public-beta paths must not contain symlinks: ' + normalized);
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error('public-beta parent must be a directory: ' + normalized);
    }
    if (index === parts.length - 1 && !stat.isFile()) {
      throw new Error('public-beta path must be a regular file: ' + normalized);
    }
  });
  const bytes = fs.readFileSync(current);
  return { path: normalized, absolute: current, bytes, sha256: hashBytes(bytes) };
}

function listFiles(root) {
  const absoluteRoot = path.resolve(root);
  const rootStat = fs.lstatSync(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('staged public-beta root must be a real directory');
  }
  const output = [];
  function visit(absolute, relative) {
    fs.readdirSync(absolute, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach(entry => {
        const childRelative = safeRelative(relative ? path.posix.join(relative, entry.name) : entry.name);
        const childAbsolute = path.join(absolute, entry.name);
        const stat = fs.lstatSync(childAbsolute);
        if (stat.isSymbolicLink()) throw new Error('staged public-beta surface contains a symlink: ' + childRelative);
        if (stat.isDirectory()) visit(childAbsolute, childRelative);
        else if (stat.isFile()) output.push(childRelative);
        else throw new Error('staged public-beta surface contains a non-regular entry: ' + childRelative);
      });
  }
  visit(absoluteRoot, '');
  return output.sort();
}

function assertAllowedDestination(relative) {
  const normalized = safeRelative(relative);
  if (FORBIDDEN_PUBLIC_PATHS.includes(normalized) ||
      FORBIDDEN_PUBLIC_PREFIXES.some(prefix => normalized.startsWith(prefix))) {
    throw new Error('forbidden public-beta destination: ' + normalized);
  }
  return normalized;
}

function buildExpectedManifest({ sourceRoot, betaReleaseId }) {
  const files = requiredMappings(betaReleaseId).map(mapping => ({
    ...mapping,
    sha256: inspectRegular(sourceRoot, mapping.source_path).sha256,
  }));
  const manifest = {
    schema_version: '1.0.0',
    manifest_id: 'elu-climate-public-beta-surface-' + betaReleaseId,
    beta_release_id: betaReleaseId,
    publication_channel: 'climate_public_beta',
    assessed_production_authority: false,
    files,
    calculation_hash: null,
  };
  manifest.calculation_hash = hashJson(manifest);
  return manifest;
}

function validateExpectedManifest(manifest, sourceRoot) {
  if (!exactKeys(manifest, MANIFEST_KEYS)) throw new Error('public-beta surface manifest keys mismatch');
  if (manifest.schema_version !== '1.0.0' ||
      manifest.manifest_id !== 'elu-climate-public-beta-surface-' + manifest.beta_release_id ||
      manifest.publication_channel !== 'climate_public_beta' ||
      manifest.assessed_production_authority !== false || !SHA256.test(manifest.calculation_hash || '')) {
    throw new Error('public-beta surface manifest boundary mismatch');
  }
  const hashInput = { ...manifest, calculation_hash: null };
  if (hashJson(hashInput) !== manifest.calculation_hash) {
    throw new Error('public-beta surface manifest calculation hash mismatch');
  }
  if (!Array.isArray(manifest.files)) throw new Error('public-beta surface files must be an array');
  const expected = requiredMappings(manifest.beta_release_id);
  if (manifest.files.length !== expected.length) throw new Error('public-beta surface file count mismatch');
  const seenSource = new Set();
  const seenDestination = new Set();
  manifest.files.forEach((entry, index) => {
    if (!exactKeys(entry, FILE_KEYS) || !SHA256.test(entry.sha256 || '')) {
      throw new Error('invalid public-beta surface file entry');
    }
    const sourcePath = safeRelative(entry.source_path);
    const destinationPath = assertAllowedDestination(entry.destination_path);
    const required = expected[index];
    if (sourcePath !== required.source_path || destinationPath !== required.destination_path) {
      throw new Error('public-beta surface paths are not canonical');
    }
    if (seenSource.has(sourcePath) || seenDestination.has(destinationPath)) {
      throw new Error('duplicate public-beta surface path');
    }
    seenSource.add(sourcePath);
    seenDestination.add(destinationPath);
    const source = inspectRegular(sourceRoot, sourcePath);
    if (source.sha256 !== entry.sha256) throw new Error('public-beta source hash mismatch: ' + sourcePath);
  });
  return { status: 'pass', beta_release_id: manifest.beta_release_id, file_count: manifest.files.length };
}

function scanAutomaticRuntimeReferences(stagedRoot) {
  const forbidden = [
    { id: 'candidate marker', pattern: /CANDIDATE-NOT-FOR-PUBLICATION|country-factual-candidate|candidate-manifest\.json/i },
    { id: 'production climate runtime', pattern: /data\/climate\/runtime(?:\/|\b)/i },
    { id: 'globe runtime', pattern: /globe\.gl|assets\/globe\/runtime/i },
    { id: 'service worker', pattern: /navigator\.serviceWorker|serviceWorker\.register/i },
    { id: 'external script', pattern: /<script\b[^>]*\bsrc\s*=\s*["']https?:/i },
    { id: 'external stylesheet', pattern: /<link\b[^>]*\b(?:href)\s*=\s*["']https?:/i },
    { id: 'external image', pattern: /<(?:img|source)\b[^>]*\b(?:src|srcset)\s*=\s*["']https?:/i },
    { id: 'external css resource', pattern: /(?:@import\s+|url\(\s*["']?)https?:/i },
    { id: 'external fetch', pattern: /\bfetch\s*\(\s*["']https?:/i },
  ];
  UI_TEXT_PATHS.forEach(relative => {
    const text = inspectRegular(stagedRoot, relative).bytes.toString('utf8');
    forbidden.forEach(rule => {
      if (rule.pattern.test(text)) throw new Error('forbidden ' + rule.id + ' reference in ' + relative);
    });
  });
}

function verifyStagedSurface({ sourceRoot, stagedRoot, manifest }) {
  validateExpectedManifest(manifest, sourceRoot);
  const expectedFiles = manifest.files.map(entry => entry.destination_path).sort();
  const actualFiles = listFiles(stagedRoot);
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    const actual = new Set(actualFiles);
    const expected = new Set(expectedFiles);
    const missing = expectedFiles.filter(relative => !actual.has(relative));
    const unexpected = actualFiles.filter(relative => !expected.has(relative));
    throw new Error('staged public-beta surface mismatch; missing=[' + missing.join(', ') +
      '] unexpected=[' + unexpected.join(', ') + ']');
  }
  manifest.files.forEach(entry => {
    const source = inspectRegular(sourceRoot, entry.source_path);
    const staged = inspectRegular(stagedRoot, entry.destination_path);
    if (source.sha256 !== entry.sha256 || staged.sha256 !== entry.sha256 || source.sha256 !== staged.sha256) {
      throw new Error('public-beta source/staged byte mismatch: ' + entry.destination_path);
    }
  });
  scanAutomaticRuntimeReferences(stagedRoot);
  return {
    status: 'pass',
    beta_release_id: manifest.beta_release_id,
    file_count: actualFiles.length,
    paths: actualFiles,
  };
}

function readExpectedManifest(sourceRoot) {
  const record = inspectRegular(sourceRoot, PUBLIC_SURFACE_MANIFEST_PATH);
  let manifest;
  try {
    manifest = parseJsonNoDuplicateKeys(
      record.bytes.toString('utf8'), 'public-beta surface manifest');
  }
  catch (_) { throw new Error('public-beta surface manifest must be valid JSON'); }
  return { manifest, text: record.bytes.toString('utf8'), sha256: record.sha256 };
}

module.exports = {
  FILE_KEYS,
  FIXED_MAPPINGS,
  FORBIDDEN_PUBLIC_PATHS,
  FORBIDDEN_PUBLIC_PREFIXES,
  MANIFEST_KEYS,
  PUBLIC_SURFACE_MANIFEST_PATH,
  RELEASE_FILENAMES,
  RELEASE_ROOT_PREFIX,
  RUNTIME_LICENSE_PATH,
  RUNTIME_MANIFEST_PATH,
  UI_TEXT_PATHS,
  assertAllowedDestination,
  buildExpectedManifest,
  hashBytes,
  hashJson,
  inspectRegular,
  listFiles,
  readExpectedManifest,
  releaseMappings,
  requiredMappings,
  safeRelative,
  scanAutomaticRuntimeReferences,
  stable,
  validateExpectedManifest,
  verifyStagedSurface,
};
