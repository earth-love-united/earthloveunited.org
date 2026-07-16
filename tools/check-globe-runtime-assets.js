#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { inspectCanonicalSvg } = require('./authoring/generate-globe-starfield');
const {
  ACTIVE_GLOBE_TRUTH_RUNTIME_SCRIPT_PATHS,
  EXPECTED_ASSETS,
  EXPECTED_INDEX_SW_KEYS,
  MANIFEST_PATH,
  REQUIRED_UI_REVIEW_PIN_PATHS,
  digest,
  evaluateRuntimeAssets,
  exactAssetManifest,
  exactLocalAssets,
} = require('./lib/globe-runtime-assets');
const { FIXED_RUNTIME_PATHS, RUNTIME_PATH_PREFIXES } = require('./lib/climate-runtime-diff-boundary');

const ROOT = path.resolve(__dirname, '..');
const JSON_ONLY = process.argv.includes('--json');
const STAGED_INDEX = process.argv.indexOf('--staged');
const FIXTURE_PATH = 'tools/fixtures/globe-runtime-assets.json';
const STAGED_RUNTIME_FILES = REQUIRED_UI_REVIEW_PIN_PATHS;
const PATHS = Object.freeze({
  index: 'index.html',
  globe: 'js/globe.js',
  app: 'js/app.js',
  data: 'js/data.js',
  globe_css: 'css/globe-system.css',
  sw: 'sw.js',
  build_deploy: 'tools/build-deploy.sh',
  stage_public_deploy: 'tools/stage-public-deploy.js',
  public_deploy_surface: 'tools/lib/public-deploy-surface.js',
  ci: '.github/workflows/ci.yml',
  climate_truth_ci: 'tools/climate-truth-ci.js',
  final_integrity: 'tools/check-staged-production-integrity.js',
  review_adapter: 'tools/lib/ct42-ct40-release-review.js',
  runtime_boundary: 'tools/lib/climate-runtime-diff-boundary.js',
  smoke: 'tools/smoke-test.js',
  credits: 'CREDITS.md',
  architecture: 'ARCHITECTURE.md',
  codeowners: '.github/CODEOWNERS',
  starfield_generator: 'tools/authoring/generate-globe-starfield.js',
  nasa_fetcher: 'tools/authoring/fetch-nasa-black-marble.sh',
});

function absolute(root, relative) { return path.join(root, relative); }
function read(root, relative) { return fs.readFileSync(absolute(root, relative), 'utf8'); }
function json(root, relative) { return JSON.parse(read(root, relative)); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function pngDimensions(bytes) {
  const signature = '89504e470d0a1a0a';
  if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== signature || bytes.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 7) return null;
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  return null;
}

function validRing(ring) {
  return Array.isArray(ring) && ring.length >= 4 && ring.every(position =>
    Array.isArray(position) && position.length >= 2 && Number.isFinite(position[0]) && Number.isFinite(position[1]));
}

function validGeometry(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return false;
  if (geometry.type === 'Polygon') return geometry.coordinates.length > 0 && geometry.coordinates.every(validRing);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.length > 0 && geometry.coordinates.every(polygon =>
    Array.isArray(polygon) && polygon.length > 0 && polygon.every(validRing));
  return false;
}

function assetRecord(root, expected) {
  const destination = absolute(root, expected.path);
  let stat;
  try {
    stat = fs.lstatSync(destination);
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false };
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return { exists: true, regular_file: false };
  const bytes = fs.readFileSync(destination);
  const record = { exists: true, regular_file: true, bytes: bytes.length, sha256: sha256(bytes) };
  if (expected.kind === 'image') {
    if (expected.path.endsWith('.svg')) {
      const source = bytes.toString('utf8');
      const svgSafety = inspectCanonicalSvg(bytes);
      return { ...record, width: svgSafety.width, height: svgSafety.height, svg_source: source, svg_safety: svgSafety };
    }
    const dimensions = expected.path.endsWith('.png') ? pngDimensions(bytes) : jpegDimensions(bytes);
    return { ...record, width: dimensions?.width ?? null, height: dimensions?.height ?? null };
  }
  try {
    const payload = JSON.parse(bytes.toString('utf8'));
    const features = Array.isArray(payload?.features) ? payload.features : [];
    return {
      ...record,
      feature_collection_type: payload?.type,
      feature_count: features.length,
      geometry_valid: features.every(feature => feature?.type === 'Feature' && validGeometry(feature.geometry)),
    };
  } catch {
    return { ...record, feature_collection_type: null, feature_count: null, geometry_valid: false };
  }
}

function parseNavigationPoints(globeSource) {
  const match = globeSource.match(/const SMALL_NATION_NAVIGATION_POINTS = Object\.freeze\((\[[\s\S]*?\])\);/);
  if (!match) return null;
  try {
    const points = vm.runInNewContext(match[1], Object.create(null), { timeout: 100 });
    return JSON.parse(JSON.stringify(points));
  } catch {
    return null;
  }
}

function parseRuntimeConfig(globeSource) {
  const geometryMatch = globeSource.match(/const COUNTRY_GEOJSON_URL = (['"][^'"]+['"]);/);
  const visualMatch = globeSource.match(/const GLOBE_VISUAL_ASSETS = Object\.freeze\((\{[\s\S]*?\n\})\);/);
  if (!geometryMatch || !visualMatch) return null;
  try {
    const geometryUrl = vm.runInNewContext(geometryMatch[1], Object.create(null), { timeout: 100 });
    const visual = vm.runInNewContext(`(${visualMatch[1]})`, Object.create(null), { timeout: 100 });
    return {
      geometry_url: geometryUrl,
      visual_assets: Object.values(visual).map(asset => ({
        url: asset.url,
        width: asset.width,
        height: asset.height,
      })),
    };
  } catch {
    return null;
  }
}

function parseIndexRuntimeRequests(indexSource) {
  const requests = [];
  const tags = indexSource.match(/<(?:script|link)\b[^>]*>/gi) || [];
  tags.forEach(tag => {
    const isScript = /^<script\b/i.test(tag);
    const isStylesheet = /^<link\b/i.test(tag) && /\brel=["']stylesheet["']/i.test(tag);
    if (!isScript && !isStylesheet) return;
    const attribute = tag.match(isScript ? /\bsrc=["']([^"']+)["']/i : /\bhref=["']([^"']+)["']/i);
    if (!attribute || !/^(?:js|css)\//.test(attribute[1])) return;
    requests.push('/' + attribute[1]);
  });
  return [...new Set(requests)];
}

async function inspectServiceWorker(source) {
  const listeners = Object.create(null);
  let addAllCalled = false;
  let waited = null;
  const context = {
    URL,
    Promise,
    setTimeout,
    clearTimeout,
    fetch: () => Promise.reject(new Error('network disabled in CT-45 service-worker probe')),
    Request: class Request {},
    Response: class Response {},
    caches: {
      open: () => Promise.resolve({
        addAll: () => {
          addAllCalled = true;
          return Promise.reject(new Error('synthetic critical precache failure'));
        },
      }),
      keys: () => Promise.resolve([]),
      delete: () => Promise.resolve(true),
      match: () => Promise.resolve(undefined),
    },
    self: {
      location: { origin: 'https://example.invalid' },
      clients: { claim() {} },
      skipWaiting() {},
      addEventListener(name, listener) { listeners[name] = listener; },
    },
  };
  context.globalThis = context;
  try {
    vm.runInNewContext(`${source}\n;globalThis.__CT45_STATIC_ASSETS__ = STATIC_ASSETS;`, context, { timeout: 250 });
    if (typeof listeners.install === 'function') {
      listeners.install({ waitUntil(promise) { waited = Promise.resolve(promise); } });
    }
    let rejected = false;
    if (waited) {
      try {
        await Promise.race([
          waited,
          new Promise((_, reject) => setTimeout(() => reject(new Error('service-worker install probe timeout')), 500)),
        ]);
      } catch {
        rejected = true;
      }
    }
    return {
      static_assets: JSON.parse(JSON.stringify(context.__CT45_STATIC_ASSETS__ || [])),
      install_rejects_on_add_all_failure: addAllCalled && rejected,
    };
  } catch {
    return { static_assets: null, install_rejects_on_add_all_failure: false };
  }
}

function inspectDeployBehavior(source) {
  const cutoff = source.indexOf('# ── Fetch or verify');
  if (cutoff === -1) return {
    denied_release_removed_output: false,
    later_failure_removed_output: false,
    unknown_environment_rejected: false,
    conflicting_selectors_rejected: false,
    cloudflare_preview_forces_release: false,
  };
  const prefix = source.slice(0, cutoff);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-ct45-deploy-'));
  try {
    const toolsDir = path.join(temp, 'tools');
    const binDir = path.join(temp, 'bin');
    fs.mkdirSync(toolsDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });
    const probe = path.join(toolsDir, 'build-deploy.sh');
    fs.writeFileSync(probe, prefix);
    fs.chmodSync(probe, 0o755);
    const nodeStub = path.join(binDir, 'node');
    fs.writeFileSync(nodeStub, '#!/bin/sh\nexit "${CT45_NODE_STATUS:-0}"\n');
    fs.chmodSync(nodeStub, 0o755);
    const baseEnv = { ...process.env, PATH: `${binDir}:${process.env.PATH}`, ELU_DEPLOY_MODE: '', CF_PAGES_BRANCH: '' };
    const run = (args, env = baseEnv, append = '') => {
      fs.writeFileSync(probe, prefix + append);
      fs.mkdirSync(path.join(temp, '_deploy'), { recursive: true });
      fs.writeFileSync(path.join(temp, '_deploy', 'stale.txt'), 'stale');
      const result = childProcess.spawnSync('bash', [probe, ...args], { cwd: temp, env, encoding: 'utf8' });
      return { failed: result.status !== 0, outputAbsent: !fs.existsSync(path.join(temp, '_deploy')) };
    };
    const denied = run(['--release'], { ...baseEnv, CT45_NODE_STATUS: '1' });
    const later = run(['--candidate'], baseEnv, '\nfalse\n');
    const unknown = run([], { ...baseEnv, ELU_DEPLOY_MODE: 'prodution' });
    const conflict = run(['--candidate'], { ...baseEnv, ELU_DEPLOY_MODE: 'release' });
    const cloudflarePreview = run(['--candidate'], {
      ...baseEnv,
      CF_PAGES_BRANCH: 'feature/ct45-preview',
      CT45_NODE_STATUS: '1',
    });
    return {
      denied_release_removed_output: denied.failed && denied.outputAbsent,
      later_failure_removed_output: later.failed && later.outputAbsent,
      unknown_environment_rejected: unknown.failed && unknown.outputAbsent,
      conflicting_selectors_rejected: conflict.failed && conflict.outputAbsent,
      cloudflare_preview_forces_release: cloudflarePreview.failed && cloudflarePreview.outputAbsent,
    };
  } catch {
    return {
      denied_release_removed_output: false,
      later_failure_removed_output: false,
      unknown_environment_rejected: false,
      conflicting_selectors_rejected: false,
      cloudflare_preview_forces_release: false,
    };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function inspectFinalVerifierCleanup() {
  const stagedRoot = fs.mkdtempSync(path.join(ROOT, '.ct45-final-failure-'));
  try {
    const requested = path.relative(ROOT, stagedRoot);
    const result = childProcess.spawnSync(process.execPath, [
      'tools/check-staged-production-integrity.js', '--staged', requested,
    ], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ELU_VERIFIED_DEPLOY_MODE: 'candidate' } });
    return result.status !== 0 && !fs.existsSync(stagedRoot);
  } finally {
    fs.rmSync(stagedRoot, { recursive: true, force: true });
  }
}

async function refreshDerived(input, mutation = null) {
  const sourceChanged = key => !mutation || mutation.path === `files.${key}`;
  if (!mutation || mutation.path?.startsWith('manifest')) {
    input.manifest_semantic_sha256 = digest(input.manifest);
    if (mutation) input.manifest_sha256 = sha256(Buffer.from(JSON.stringify(input.manifest)));
  }
  if (sourceChanged('globe')) input.runtime_config = parseRuntimeConfig(input.files.globe);
  if (sourceChanged('sw')) input.service_worker = await inspectServiceWorker(input.files.sw);
  if (sourceChanged('index')) input.index_runtime_requests = parseIndexRuntimeRequests(input.files.index);
  if (sourceChanged('build_deploy')) {
    const finalCleanupPassed = input.deploy_behavior?.final_integrity_failure_removed_output === true;
    input.deploy_behavior = {
      ...inspectDeployBehavior(input.files.build_deploy),
      final_integrity_failure_removed_output: finalCleanupPassed,
    };
  }
  return input;
}

async function loadInput(root = ROOT) {
  const files = Object.fromEntries(Object.entries(PATHS).map(([key, relative]) => [key, read(ROOT, relative)]));
  files.production_docs = [
    read(ROOT, 'docs/CLIMATE-PRODUCTION-READINESS.md'),
    read(ROOT, 'docs/COUNTRY-CLIMATE-TRUTH-CI.md'),
  ].join('\n');
  const globeSource = read(root, PATHS.globe);
  const navigationSourceBytes = fs.readFileSync(absolute(root, 'data/small-nations.json'));
  const navigationSource = JSON.parse(navigationSourceBytes.toString('utf8'));
  if (root !== ROOT) {
    files.index = read(root, PATHS.index);
    files.globe = globeSource;
    files.app = read(root, PATHS.app);
    files.data = read(root, PATHS.data);
    files.sw = read(root, PATHS.sw);
  }
  const manifestBytes = fs.readFileSync(absolute(root, MANIFEST_PATH));
  const input = {
    manifest: JSON.parse(manifestBytes.toString('utf8')),
    manifest_sha256: sha256(manifestBytes),
    assets: Object.fromEntries(EXPECTED_ASSETS.map(asset => [asset.path, assetRecord(root, asset)])),
    navigation_points: parseNavigationPoints(globeSource),
    navigation_source: {
      sha256: sha256(navigationSourceBytes),
      points: navigationSource.data,
      meta: navigationSource._meta,
    },
    review_scope: {
      active_runtime_scripts: [...ACTIVE_GLOBE_TRUTH_RUNTIME_SCRIPT_PATHS],
      ui_pins: [...REQUIRED_UI_REVIEW_PIN_PATHS],
      runtime_fixed: [...FIXED_RUNTIME_PATHS],
      runtime_prefixes: [...RUNTIME_PATH_PREFIXES],
    },
    deploy_behavior: {
      final_integrity_failure_removed_output: inspectFinalVerifierCleanup(),
    },
    files,
  };
  return refreshDerived(input);
}

function get(target, dotted) {
  return dotted.split('.').reduce((node, key) => node[Number.isInteger(Number(key)) ? Number(key) : key], target);
}

function set(target, dotted, value) {
  const parts = dotted.split('.');
  const key = parts.pop();
  const owner = parts.length ? get(target, parts.join('.')) : target;
  owner[Number.isInteger(Number(key)) ? Number(key) : key] = value;
}

function applyMutation(input, mutation) {
  if (mutation.operation === 'asset-set') {
    input.assets[mutation.asset][mutation.field] = structuredClone(mutation.value);
    return;
  }
  if (mutation.operation === 'asset-text-replace') {
    const record = input.assets[mutation.asset];
    assert.equal(typeof record?.svg_source, 'string', `${mutation.id}: SVG asset source missing`);
    assert.ok(record.svg_source.includes(mutation.from), `${mutation.id}: SVG replacement anchor missing`);
    record.svg_source = record.svg_source.replace(mutation.from, mutation.to);
    const bytes = Buffer.from(record.svg_source, 'utf8');
    record.bytes = bytes.length;
    record.sha256 = sha256(bytes);
    record.svg_safety = inspectCanonicalSvg(bytes);
    record.width = record.svg_safety.width;
    record.height = record.svg_safety.height;
    return;
  }
  if (mutation.operation === 'set') {
    set(input, mutation.path, structuredClone(mutation.value));
    return;
  }
  if (mutation.operation === 'replace') {
    const current = get(input, mutation.path);
    assert.equal(typeof current, 'string', `${mutation.id}: replacement target must be text`);
    assert.ok(current.includes(mutation.from), `${mutation.id}: replacement anchor missing`);
    set(input, mutation.path, current.replace(mutation.from, mutation.to));
    return;
  }
  if (mutation.operation === 'replace-all') {
    const current = get(input, mutation.path);
    assert.equal(typeof current, 'string', `${mutation.id}: replacement target must be text`);
    assert.ok(current.includes(mutation.from), `${mutation.id}: replacement anchor missing`);
    set(input, mutation.path, current.split(mutation.from).join(mutation.to));
    return;
  }
  if (mutation.operation === 'append') {
    const current = get(input, mutation.path);
    assert.equal(typeof current, 'string', `${mutation.id}: append target must be text`);
    set(input, mutation.path, current + mutation.value);
    return;
  }
  if (mutation.operation === 'replace-append') {
    const current = get(input, mutation.path);
    assert.equal(typeof current, 'string', `${mutation.id}: replace-append target must be text`);
    assert.ok(current.includes(mutation.from), `${mutation.id}: replace-append anchor missing`);
    set(input, mutation.path, current.replace(mutation.from, mutation.to) + mutation.value);
    return;
  }
  if (mutation.operation === 'delete') {
    const parts = mutation.path.split('.');
    const key = parts.pop();
    delete get(input, parts.join('.'))[key];
    return;
  }
  throw new Error(`${mutation.id}: unsupported operation ${mutation.operation}`);
}

async function runFixtures(input) {
  const fixture = json(ROOT, FIXTURE_PATH);
  assert.equal(fixture._meta.policy_version, '1.2.0', 'CT-45 fixture/policy version drift');
  let rejected = 0;
  for (const mutation of fixture.mutations) {
    const changed = structuredClone(input);
    applyMutation(changed, mutation);
    await refreshDerived(changed, mutation);
    const result = evaluateRuntimeAssets(changed);
    assert.equal(result.status, 'fail', `${mutation.id}: unsafe runtime-asset mutation was accepted`);
    assert.ok(result.failure_ids.includes(mutation.expected_failure),
      `${mutation.id}: expected ${mutation.expected_failure}, got ${result.failure_ids.join(', ')}`);
    rejected += 1;
  }
  return rejected;
}

function runSvgSafetySelfTests() {
  const canonical = read(ROOT, 'assets/globe/runtime/night-sky.svg');
  const root = '<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="2048" viewBox="0 0 4096 2048">';
  const background = '<rect x="0" y="0" width="4096" height="2048" fill="#02040a"/>';
  const firstCircle = canonical.match(/^<circle[^\n]+$/m)?.[0];
  const seamCircle = canonical.split('\n').find(line => {
    const match = line.match(/^<circle cx="(-?\d+)"/);
    return match && (Number(match[1]) < 0 || Number(match[1]) >= 4096);
  });
  assert.ok(firstCircle && seamCircle, 'canonical SVG self-test anchors missing');

  const afterRoot = payload => canonical.replace(root, `${root}\n${payload}`);
  const afterBackground = payload => canonical.replace(background, `${background}\n${payload}`);
  const rootAttribute = attribute => canonical.replace(' viewBox="0 0 4096 2048">', ` viewBox="0 0 4096 2048" ${attribute}>`);
  const cases = [
    { id: 'doctype', expected: 'active_or_noncanonical_declaration', source: `<!DOCTYPE svg>\n${canonical}` },
    { id: 'entity', expected: 'active_or_noncanonical_declaration', source: `<!ENTITY star "x">\n${canonical}` },
    { id: 'xml-declaration', expected: 'active_or_noncanonical_declaration', source: `<?xml version="1.0"?>\n${canonical}` },
    { id: 'cdata', expected: 'active_or_noncanonical_declaration', source: afterRoot('<![CDATA[unreviewed]]>') },
    { id: 'comment', expected: 'active_or_noncanonical_declaration', source: afterRoot('<!-- unreviewed -->') },
    { id: 'processing-instruction', expected: 'active_or_noncanonical_declaration', source: afterRoot('<?elu unreviewed?>') },
    { id: 'style-element', expected: 'forbidden_element', source: afterBackground('<style>circle{fill:red}</style>') },
    { id: 'use-element', expected: 'forbidden_element', source: afterBackground('<use href="#star"/>') },
    { id: 'anchor-element', expected: 'forbidden_element', source: afterBackground('<a href="https://example.invalid/"></a>') },
    { id: 'image-element', expected: 'forbidden_element', source: afterBackground('<image href="https://example.invalid/sky.png"/>') },
    { id: 'script-element', expected: 'forbidden_element', source: afterBackground('<script>alert(1)</script>') },
    { id: 'foreign-object', expected: 'forbidden_element', source: afterBackground('<foreignObject width="1" height="1"></foreignObject>') },
    { id: 'animate-element', expected: 'forbidden_element', source: afterBackground('<animate attributeName="opacity"/>') },
    { id: 'filter-element', expected: 'forbidden_element', source: afterBackground('<filter></filter>') },
    { id: 'mask-element', expected: 'forbidden_element', source: afterBackground('<mask></mask>') },
    { id: 'pattern-element', expected: 'forbidden_element', source: afterBackground('<pattern></pattern>') },
    { id: 'gradient-element', expected: 'forbidden_element', source: afterBackground('<linearGradient></linearGradient>') },
    { id: 'filter-primitive', expected: 'forbidden_element', source: afterBackground('<feGaussianBlur stdDeviation="1"/>') },
    { id: 'href-attribute', expected: 'forbidden_reference_or_attribute', source: rootAttribute('href="#star"') },
    { id: 'xlink-attribute', expected: 'forbidden_reference_or_attribute', source: rootAttribute('xlink:href="#star"') },
    { id: 'event-attribute', expected: 'forbidden_reference_or_attribute', source: rootAttribute('onload="alert(1)"') },
    { id: 'style-attribute', expected: 'forbidden_reference_or_attribute', source: rootAttribute('style="opacity:1"') },
    { id: 'class-attribute', expected: 'forbidden_reference_or_attribute', source: rootAttribute('class="sky"') },
    { id: 'id-attribute', expected: 'forbidden_reference_or_attribute', source: rootAttribute('id="sky"') },
    { id: 'transform-attribute', expected: 'forbidden_reference_or_attribute', source: rootAttribute('transform="scale(1)"') },
    { id: 'url-reference', expected: 'forbidden_reference_or_attribute', source: canonical.replace('fill="#02040a"', 'fill="url(#paint)"') },
    { id: 'data-reference', expected: 'forbidden_reference_or_attribute', source: rootAttribute('data-source="data:image/png;base64,AA=="') },
    { id: 'http-reference', expected: 'forbidden_reference_or_attribute', source: rootAttribute('source="https://example.invalid/sky"') },
    { id: 'wrong-root-dimensions', expected: 'root_dimensions_or_attributes', source: canonical.replace('width="4096"', 'width="4000"') },
    { id: 'wrong-nesting', expected: 'generated_bytes_drift', source: canonical.replace(firstCircle, `<g>\n${firstCircle}\n</g>`) },
    { id: 'coordinate-range', expected: 'circle_sequence:', source: canonical.replace(firstCircle, firstCircle.replace(/cx="-?\d+"/, 'cx="99999"')) },
    { id: 'seam-twin-drift', expected: 'circle_sequence:', source: canonical.replace(seamCircle, seamCircle.replace(/cx="(-?\d+)"/, (_, value) => `cx="${Number(value) + 1}"`)) },
    { id: 'noncanonical-line-endings', expected: 'noncanonical_line_endings', source: canonical.replaceAll('\n', '\r\n') },
    { id: 'control-character', expected: 'control_character', source: canonical.replace(background, `${background}\u0001`) },
  ];

  assert.ok(cases.length >= 20, 'SVG safety matrix must retain at least 20 hostile payload classes');
  assert.equal(new Set(cases.map(test => test.id)).size, cases.length, 'SVG safety payload ids must be unique');
  assert.equal(inspectCanonicalSvg(Buffer.from(canonical, 'utf8')).ok, true, 'canonical SVG must pass its direct parser self-test');
  cases.forEach(test => {
    assert.notEqual(test.source, canonical, `${test.id}: hostile SVG payload did not mutate source`);
    const inspection = inspectCanonicalSvg(Buffer.from(test.source, 'utf8'));
    assert.equal(inspection.ok, false, `${test.id}: hostile SVG payload was accepted`);
    assert.ok(inspection.failures.some(failure => failure === test.expected || failure.startsWith(test.expected)),
      `${test.id}: expected parser failure ${test.expected}, got ${inspection.failures.join(', ')}`);
  });
  return cases.length;
}

function assertSafeStagedPath(root, relative, expectedType = 'file') {
  assert.equal(path.isAbsolute(root), true, 'staged root must be absolute');
  const normalized = path.posix.normalize(String(relative).replaceAll(path.sep, '/'));
  assert.ok(normalized && normalized !== '..' && !normalized.startsWith('../') && !path.posix.isAbsolute(normalized),
    `unsafe staged relative path: ${relative}`);
  const rootStat = fs.lstatSync(root);
  assert.ok(rootStat.isDirectory() && !rootStat.isSymbolicLink(), `staged root must be a real directory: ${root}`);
  let current = root;
  const parts = normalized.split('/');
  parts.forEach((part, index) => {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    assert.equal(stat.isSymbolicLink(), false, `staged path must not contain a symbolic link: ${normalized}`);
    if (index < parts.length - 1 || expectedType === 'directory') {
      assert.equal(stat.isDirectory(), true, `staged path component must be a directory: ${normalized}`);
    } else {
      assert.equal(stat.isFile(), true, `staged runtime file must be regular: ${normalized}`);
    }
  });
  return current;
}

function resolveStagedRoot(repoRoot, requested) {
  assert.equal(typeof requested, 'string', '--staged requires a staged directory');
  assert.ok(requested && !requested.includes('\0'), '--staged requires a safe staged directory');
  const lexicalRoot = path.resolve(repoRoot);
  const lexicalCandidate = path.resolve(lexicalRoot, requested);
  const lexicalRelative = path.relative(lexicalRoot, lexicalCandidate);
  assert.ok(lexicalRelative && !lexicalRelative.startsWith('..') && !path.isAbsolute(lexicalRelative),
    '--staged must be a directory inside the repository');

  const rootStat = fs.lstatSync(lexicalRoot);
  assert.ok(rootStat.isDirectory() && !rootStat.isSymbolicLink(), 'repository root must be a real directory');
  let current = lexicalRoot;
  lexicalRelative.split(path.sep).forEach(part => {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    assert.equal(stat.isSymbolicLink(), false, '--staged path must not contain symbolic links');
    assert.equal(stat.isDirectory(), true, '--staged path components must be directories');
  });

  const realRoot = fs.realpathSync.native(lexicalRoot);
  const realCandidate = fs.realpathSync.native(lexicalCandidate);
  const realRelative = path.relative(realRoot, realCandidate);
  assert.ok(realRelative && !realRelative.startsWith('..') && !path.isAbsolute(realRelative),
    '--staged real path must remain inside the repository');
  return realCandidate;
}

function runStagedSymlinkSelfTests() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-ct45-stage-'));
  try {
    const runtime = path.join(temp, 'assets', 'globe', 'runtime');
    fs.mkdirSync(runtime, { recursive: true });
    const target = path.join(runtime, 'target.json');
    fs.writeFileSync(target, '{}');
    fs.symlinkSync('target.json', path.join(runtime, 'manifest.json'));
    assert.throws(() => assertSafeStagedPath(temp, 'assets/globe/runtime/manifest.json'), /symbolic link/,
      'manifest symlink must be rejected');
    fs.mkdirSync(path.join(temp, 'real-runtime'));
    fs.symlinkSync(path.join(temp, 'real-runtime'), path.join(temp, 'runtime-link'), 'dir');
    fs.writeFileSync(path.join(temp, 'real-runtime', 'asset.bin'), 'x');
    assert.throws(() => assertSafeStagedPath(temp, 'runtime-link/asset.bin'), /symbolic link/,
      'runtime directory symlink must be rejected');
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-ct45-outside-'));
    try {
      fs.mkdirSync(path.join(outside, '_deploy'));
      fs.symlinkSync(outside, path.join(temp, 'escape'), 'dir');
      assert.throws(() => resolveStagedRoot(temp, 'escape/_deploy'), /symbolic links/,
        'intermediate staged-root symlink must be rejected');
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
    return 3;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function verifyStaged(root) {
  assertSafeStagedPath(root, 'assets/globe/runtime', 'directory');
  const exactRuntimeEntries = [path.basename(MANIFEST_PATH), ...EXPECTED_ASSETS.map(asset => path.basename(asset.path))].sort();
  assert.deepEqual(fs.readdirSync(path.join(root, 'assets/globe/runtime')).sort(), exactRuntimeEntries,
    'staged globe runtime directory must contain exactly the manifest and five pinned assets');
  const requiredPaths = [...new Set([...STAGED_RUNTIME_FILES, ...EXPECTED_ASSETS.map(asset => asset.path), 'js/vendor/globe.gl.js'])];
  requiredPaths.forEach(relative => assertSafeStagedPath(root, relative));
  const marker = path.join(root, 'CANDIDATE-NOT-FOR-PUBLICATION.txt');
  if (fs.existsSync(marker)) assertSafeStagedPath(root, 'CANDIDATE-NOT-FOR-PUBLICATION.txt');
  const manifest = json(root, MANIFEST_PATH);
  const sourceManifest = json(ROOT, MANIFEST_PATH);
  const records = Object.fromEntries(EXPECTED_ASSETS.map(asset => [asset.path, assetRecord(root, asset)]));
  STAGED_RUNTIME_FILES.forEach(relative => {
    const sourceBytes = fs.readFileSync(absolute(ROOT, relative));
    const stagedBytes = fs.readFileSync(absolute(root, relative));
    assert.equal(sha256(stagedBytes), sha256(sourceBytes), `staged runtime consumer/source drift: ${relative}`);
  });
  assert.equal(exactAssetManifest(manifest), true, 'staged globe runtime manifest differs from the exact reviewed pin set');
  assert.equal(exactLocalAssets(records), true, 'staged globe runtime files differ from exact pinned bytes/shape');
  ['rights_review_status', 'third_party_notices_review_status', 'production_use_approved', 'release_authority'].forEach(field => {
    assert.equal(manifest[field], sourceManifest[field], `staged manifest changed ${field}`);
  });
  assert.equal(sha256(fs.readFileSync(absolute(root, 'data/climate/runtime/country-factual-candidate.json'))),
    '7f002bc18396d827179cef0a3dda5bb83c3a1538dd6beffd6e4b80c2f7583664',
    'staged critical candidate SHA-256 drift');
  assert.equal(parseNavigationPoints(read(root, 'js/globe.js'))?.length, 28, 'staged navigation point set drift');
  return { root, assets: EXPECTED_ASSETS.length, releaseAuthority: manifest.release_authority === true };
}

async function main() {
  const svgSafetyPayloads = runSvgSafetySelfTests();
  if (STAGED_INDEX !== -1) {
    const requested = process.argv[STAGED_INDEX + 1];
    if (!requested) throw new Error('--staged requires a staged directory');
    const stagedRoot = resolveStagedRoot(ROOT, requested);
    const result = verifyStaged(stagedRoot);
    process.stdout.write(`CT-45 staged globe runtime assets: PASS (${result.assets} exact files; ${svgSafetyPayloads} hostile SVG payload classes rejected; release authority ${result.releaseAuthority})\n`);
    return;
  }
  const input = await loadInput();
  const report = evaluateRuntimeAssets(input);
  const rejected = await runFixtures(input);
  const stagedSymlinkCases = runStagedSymlinkSelfTests();
  if (JSON_ONLY) {
    process.stdout.write(`${JSON.stringify({ ...report, adversarial_mutations_rejected: rejected, svg_safety_payloads_rejected: svgSafetyPayloads, staged_symlink_cases_rejected: stagedSymlinkCases }, null, 2)}\n`);
  } else {
    process.stdout.write([
      `CT-45 globe runtime assets: ${report.status.toUpperCase()}`,
      `  exact localized assets: ${report.asset_count}`,
      `  manifest SHA-256: ${input.manifest_sha256}`,
      `  policy checks: ${report.checks.filter(item => item.pass).length}/${report.checks.length}`,
      `  adversarial mutations rejected: ${rejected}`,
      `  hostile SVG payload classes rejected: ${svgSafetyPayloads}`,
      `  staged symlink cases rejected: ${stagedSymlinkCases}`,
      '  rights / notices review: not reviewed',
      '  production use / release authority: false',
    ].join('\n') + '\n');
    report.checks.filter(item => !item.pass).forEach(item => process.stderr.write(`  [FAIL] ${item.id}: ${item.detail}\n`));
  }
  if (report.status !== 'pass') process.exitCode = 1;
}

if (require.main === module) main().catch(error => {
  process.stderr.write(`CT-45 globe runtime assets: FAIL (${error.stack || error.message})\n`);
  process.exitCode = 1;
});

module.exports = { assetRecord, assertSafeStagedPath, inspectServiceWorker, loadInput, parseIndexRuntimeRequests, parseNavigationPoints, parseRuntimeConfig, resolveStagedRoot, runSvgSafetySelfTests, verifyStaged };
