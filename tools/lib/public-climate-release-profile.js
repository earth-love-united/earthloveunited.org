'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROFILE_CCI = 'cci';
const PROFILE_LEGACY_CT40 = 'legacy_ct40';
const ENTRYPOINTS = Object.freeze(['index.html', 'js/data.js', 'sw.js']);
const CCI_RUNTIME_PATH = 'data/climate/runtime/country-climate-intelligence.json';
const LEGACY_RUNTIME_PATH = 'data/climate/runtime/country-factual-candidate.json';
const CCI_MODULE_PATH = 'js/country-climate-intelligence.js';
const DATA_SCRIPT_PATH = 'js/data.js';

function safeRelative(relative) {
  const normalized = path.posix.normalize(String(relative || '').replaceAll(path.sep, '/'));
  if (!normalized || normalized === '..' || normalized.startsWith('../') ||
      path.posix.isAbsolute(normalized) || normalized.includes('\0')) {
    throw new Error('unsafe climate release-profile path: ' + relative);
  }
  return normalized;
}

function readRegular(root, relative) {
  const normalized = safeRelative(relative);
  const absoluteRoot = path.resolve(root);
  const rootStat = fs.lstatSync(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('climate release-profile root must be a real directory');
  }
  let current = absoluteRoot;
  const parts = normalized.split('/');
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error('climate release-profile entrypoint is missing: ' + normalized);
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error('climate release-profile path must not contain symlinks: ' + normalized);
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error('climate release-profile path has a non-directory parent: ' + normalized);
    }
    if (index === parts.length - 1 && !stat.isFile()) {
      throw new Error('climate release-profile entrypoint must be a regular file: ' + normalized);
    }
  }
  return fs.readFileSync(current, 'utf8');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function attribute(tag, name) {
  const match = new RegExp('\\b' + escapeRegExp(name) + '\\s*=\\s*([\"\\\'])(.*?)\\1', 'i').exec(tag);
  return match ? match[2] : null;
}

function activeHtmlTags(text, name) {
  const active = text.replace(/<!--[\s\S]*?-->/g, '');
  return [...active.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map(match => match[0]);
}

function exactVersionedHtmlReference(tags, attributeName, basePath, label, required) {
  const candidates = tags.map(tag => attribute(tag, attributeName))
    .filter(value => typeof value === 'string' && value.split('?')[0] === basePath);
  if (!candidates.length && required === false) return null;
  if (candidates.length !== 1) throw new Error(label + ' must occur exactly once');
  const match = new RegExp('^' + escapeRegExp(basePath) + '\\?v=([A-Za-z0-9._-]+)$').exec(candidates[0]);
  if (!match) throw new Error(label + ' must use one strict versioned same-origin path');
  return match[1];
}

function parseIndex(text) {
  const scripts = activeHtmlTags(text, 'script');
  const links = activeHtmlTags(text, 'link');
  const preloadLinks = links.filter(tag => (attribute(tag, 'rel') || '').toLowerCase().split(/\s+/).includes('preload'));
  const dataScriptVersion = exactVersionedHtmlReference(scripts, 'src', DATA_SCRIPT_PATH, 'index data script', true);
  const dataPreloadVersion = exactVersionedHtmlReference(preloadLinks, 'href', DATA_SCRIPT_PATH, 'index data preload', true);
  if (dataScriptVersion !== dataPreloadVersion) throw new Error('index data script and preload generations conflict');
  const cciScriptVersion = exactVersionedHtmlReference(scripts, 'src', CCI_MODULE_PATH, 'index CCI script', false);
  const cciPreloadVersion = exactVersionedHtmlReference(preloadLinks, 'href', CCI_MODULE_PATH, 'index CCI preload', false);
  if ((cciScriptVersion || null) !== (cciPreloadVersion || null)) {
    throw new Error('index CCI script and preload generations conflict');
  }
  const registrations = [...text.matchAll(/navigator\.serviceWorker\.register\(\s*['\"]\/sw\.js\?v=([A-Za-z0-9._-]+)['\"]/g)]
    .map(match => match[1]);
  if (registrations.length !== 1) throw new Error('index must register exactly one strict service-worker generation');
  return {
    data_script_version: dataScriptVersion,
    cci_script_version: cciScriptVersion,
    service_worker_generation: registrations[0],
  };
}

function parseData(text) {
  const versions = [...text.matchAll(/\bversion:\s*['\"]([A-Za-z0-9._-]+)['\"]/g)].map(match => match[1]);
  if (versions.length !== 1) throw new Error('data runtime must declare exactly one strict version');
  const runtimePaths = [...new Set([...text.matchAll(/_fetchTextWithTimeout\(\s*['\"](data\/climate\/runtime\/[^'\"]+\.json)['\"]\s*\+\s*v/g)]
    .map(match => match[1]))].sort();
  if (!runtimePaths.length) throw new Error('data runtime does not actively fetch a recognized climate artifact');
  return {
    version: versions[0],
    runtime_paths: runtimePaths,
    has_cci_hash: /\bconst CLIMATE_INTELLIGENCE_SHA256\s*=\s*['\"][0-9a-f]{64}['\"]/.test(text),
    has_legacy_hash: /\bconst CLIMATE_CANDIDATE_SHA256\s*=\s*['\"][0-9a-f]{64}['\"]/.test(text),
  };
}

function parseServiceWorker(text) {
  const cacheNames = [...text.matchAll(/\bconst CACHE_NAME\s*=\s*['\"]([^'\"]+)['\"]/g)].map(match => match[1]);
  if (cacheNames.length !== 1) throw new Error('service worker must declare exactly one cache name');
  const list = /\bconst STATIC_ASSETS\s*=\s*\[([\s\S]*?)\n\];/.exec(text);
  if (!list) throw new Error('service worker must declare one static asset array');
  const staticAssets = [...list[1].matchAll(/['\"]([^'\"]+)['\"]/g)].map(match => match[1]);
  return { cache_name: cacheNames[0], static_assets: staticAssets };
}

function exactAssetVersion(assets, basePath, label, required) {
  const candidates = assets.filter(value => value.split('?')[0] === '/' + basePath);
  if (!candidates.length && required === false) return null;
  if (candidates.length !== 1) throw new Error(label + ' must occur exactly once in the service worker');
  const match = new RegExp('^/' + escapeRegExp(basePath) + '\\?v=([A-Za-z0-9._-]+)$').exec(candidates[0]);
  if (!match) throw new Error(label + ' must use one strict versioned service-worker key');
  return match[1];
}

function detectPublicClimateReleaseProfile(root) {
  const index = parseIndex(readRegular(root, 'index.html'));
  const data = parseData(readRegular(root, 'js/data.js'));
  const sw = parseServiceWorker(readRegular(root, 'sw.js'));
  if (sw.cache_name !== 'elu-v' + index.service_worker_generation) {
    throw new Error('service-worker registration and cache generations conflict');
  }
  const swDataVersion = exactAssetVersion(sw.static_assets, DATA_SCRIPT_PATH, 'service-worker data script', true);
  if (swDataVersion !== index.data_script_version) throw new Error('index and service-worker data script generations conflict');

  const cciActive = data.runtime_paths.includes(CCI_RUNTIME_PATH);
  const legacyActive = data.runtime_paths.includes(LEGACY_RUNTIME_PATH);
  const unknownActive = data.runtime_paths.filter(value => ![CCI_RUNTIME_PATH, LEGACY_RUNTIME_PATH].includes(value));
  if (unknownActive.length || cciActive === legacyActive) {
    throw new Error('climate release profile is mixed, unknown, or absent');
  }

  let profile;
  let activeRuntimePath;
  let activeModuleVersion = null;
  if (cciActive) {
    if (!data.has_cci_hash || data.has_legacy_hash) throw new Error('CCI data identity is incomplete or mixed');
    if (!index.cci_script_version) throw new Error('CCI data is active without the CCI presentation module');
    const swCciVersion = exactAssetVersion(sw.static_assets, CCI_MODULE_PATH, 'service-worker CCI module', true);
    if (swCciVersion !== index.cci_script_version) throw new Error('index and service-worker CCI module generations conflict');
    const swRuntimeVersion = exactAssetVersion(sw.static_assets, CCI_RUNTIME_PATH, 'service-worker CCI runtime', true);
    if (swRuntimeVersion !== data.version) throw new Error('CCI data and service-worker runtime generations conflict');
    exactAssetVersion(sw.static_assets, LEGACY_RUNTIME_PATH, 'service-worker legacy rollback runtime', false);
    profile = PROFILE_CCI;
    activeRuntimePath = CCI_RUNTIME_PATH;
    activeModuleVersion = index.cci_script_version;
  } else {
    if (!data.has_legacy_hash || data.has_cci_hash) throw new Error('legacy CT40 data identity is incomplete or mixed');
    if (index.cci_script_version) throw new Error('legacy CT40 data is active with the CCI presentation module');
    if (sw.static_assets.some(value => value.split('?')[0] === '/' + CCI_MODULE_PATH || value.split('?')[0] === '/' + CCI_RUNTIME_PATH)) {
      throw new Error('legacy CT40 service worker contains an active CCI generation');
    }
    const swRuntimeVersion = exactAssetVersion(sw.static_assets, LEGACY_RUNTIME_PATH, 'service-worker legacy runtime', true);
    if (swRuntimeVersion !== data.version) throw new Error('legacy data and service-worker runtime generations conflict');
    profile = PROFILE_LEGACY_CT40;
    activeRuntimePath = LEGACY_RUNTIME_PATH;
  }

  const fingerprint = {
    profile,
    active_runtime_path: activeRuntimePath,
    data_version: data.version,
    data_script_version: index.data_script_version,
    cci_script_version: activeModuleVersion,
    service_worker_generation: index.service_worker_generation,
    service_worker_cache_name: sw.cache_name,
  };
  return { profile, fingerprint, entrypoints: [...ENTRYPOINTS] };
}

function assertPublicClimateReleaseProfileParity(sourceRoot, stagedRoot) {
  const source = detectPublicClimateReleaseProfile(sourceRoot);
  const staged = detectPublicClimateReleaseProfile(stagedRoot);
  if (source.profile !== staged.profile || JSON.stringify(source.fingerprint) !== JSON.stringify(staged.fingerprint)) {
    throw new Error('source and staged climate release profiles differ');
  }
  return { source, staged };
}

function fixtureFiles(profile) {
  const cci = profile === PROFILE_CCI;
  const dataVersion = cci ? 'cci-fixture-1' : 'ct40-fixture-1';
  const dataScriptVersion = cci ? '11' : '2';
  const cciScriptVersion = '14';
  const epoch = cci ? '72-fixture' : '40-fixture';
  const runtime = cci ? CCI_RUNTIME_PATH : LEGACY_RUNTIME_PATH;
  const index = [
    '<link rel="preload" href="' + DATA_SCRIPT_PATH + '?v=v' + dataScriptVersion + '" as="script">',
    cci ? '<link rel="preload" href="' + CCI_MODULE_PATH + '?v=v' + cciScriptVersion + '" as="script">' : '',
    '<script src="' + DATA_SCRIPT_PATH + '?v=v' + dataScriptVersion + '"></script>',
    cci ? '<script src="' + CCI_MODULE_PATH + '?v=v' + cciScriptVersion + '"></script>' : '',
    "navigator.serviceWorker.register('/sw.js?v=" + epoch + "', { updateViaCache: 'none' });",
  ].join('\n');
  const data = [
    cci ? "const CLIMATE_INTELLIGENCE_SHA256 = '" + 'a'.repeat(64) + "';" :
      "const CLIMATE_CANDIDATE_SHA256 = '" + 'b'.repeat(64) + "';",
    "const Data = { version: '" + dataVersion + "',",
    "init() { return _fetchTextWithTimeout('" + runtime + "' + v); } };",
  ].join('\n');
  const assets = [
    "'/js/data.js?v=v" + dataScriptVersion + "'",
    cci ? "'/js/country-climate-intelligence.js?v=v" + cciScriptVersion + "'" : null,
    "'/" + runtime + '?v=' + dataVersion + "'",
    cci ? "'/data/climate/runtime/country-factual-candidate.json?v=ct40-rollback'" : null,
  ].filter(Boolean);
  const sw = "const CACHE_NAME = 'elu-v" + epoch + "';\nconst STATIC_ASSETS = [\n  " + assets.join(',\n  ') + "\n];\n";
  return { 'index.html': index, 'js/data.js': data, 'sw.js': sw };
}

function writeFixture(root, profile) {
  const files = fixtureFiles(profile);
  Object.entries(files).forEach(([relative, text]) => {
    const destination = path.join(root, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, text);
  });
}

function runSelfTest() {
  let cases = 0;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-climate-profile-'));
  try {
    writeFixture(root, PROFILE_CCI);
    assert.equal(detectPublicClimateReleaseProfile(root).profile, PROFILE_CCI); cases += 1;
    writeFixture(root, PROFILE_LEGACY_CT40);
    assert.equal(detectPublicClimateReleaseProfile(root).profile, PROFILE_LEGACY_CT40); cases += 1;

    writeFixture(root, PROFILE_CCI);
    fs.appendFileSync(path.join(root, 'js/data.js'), "\n_fetchTextWithTimeout('" + LEGACY_RUNTIME_PATH + "' + v);\n");
    assert.throws(() => detectPublicClimateReleaseProfile(root), /mixed, unknown, or absent/); cases += 1;

    writeFixture(root, PROFILE_CCI);
    fs.writeFileSync(path.join(root, 'js/data.js'), "const Data = { version: 'none' };\n");
    assert.throws(() => detectPublicClimateReleaseProfile(root), /does not actively fetch/); cases += 1;

    writeFixture(root, PROFILE_CCI);
    fs.writeFileSync(path.join(root, 'sw.js'), fs.readFileSync(path.join(root, 'sw.js'), 'utf8')
      .replace('cci-fixture-1', 'stale-fixture'));
    assert.throws(() => detectPublicClimateReleaseProfile(root), /runtime generations conflict/); cases += 1;

    writeFixture(root, PROFILE_CCI);
    fs.writeFileSync(path.join(root, 'sw.js'), fs.readFileSync(path.join(root, 'sw.js'), 'utf8')
      .replace('/js/data.js?v=v11', '/js/data.js?v=stale'));
    assert.throws(() => detectPublicClimateReleaseProfile(root), /data script generations conflict/); cases += 1;

    writeFixture(root, PROFILE_CCI);
    fs.writeFileSync(path.join(root, 'sw.js'), fs.readFileSync(path.join(root, 'sw.js'), 'utf8')
      .replace('elu-v72-fixture', 'elu-v71-fixture'));
    assert.throws(() => detectPublicClimateReleaseProfile(root), /registration and cache generations conflict/); cases += 1;

    const staged = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-climate-profile-staged-'));
    try {
      writeFixture(root, PROFILE_CCI);
      writeFixture(staged, PROFILE_LEGACY_CT40);
      assert.throws(() => assertPublicClimateReleaseProfileParity(root, staged), /profiles differ/); cases += 1;
    } finally {
      fs.rmSync(staged, { recursive: true, force: true });
    }

    writeFixture(root, PROFILE_CCI);
    const external = path.join(root, 'external-data.js');
    fs.copyFileSync(path.join(root, 'js/data.js'), external);
    fs.unlinkSync(path.join(root, 'js/data.js'));
    fs.symlinkSync(external, path.join(root, 'js/data.js'));
    assert.throws(() => detectPublicClimateReleaseProfile(root), /symlinks/); cases += 1;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  return cases;
}

module.exports = {
  CCI_MODULE_PATH,
  CCI_RUNTIME_PATH,
  DATA_SCRIPT_PATH,
  ENTRYPOINTS,
  LEGACY_RUNTIME_PATH,
  PROFILE_CCI,
  PROFILE_LEGACY_CT40,
  assertPublicClimateReleaseProfileParity,
  detectPublicClimateReleaseProfile,
  readRegular,
  runSelfTest,
};
