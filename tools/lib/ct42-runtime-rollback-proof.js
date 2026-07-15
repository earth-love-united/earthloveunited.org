'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EXPECTED_ASSETS } = require('./globe-runtime-assets');
const { EXPECTED_SPEC: EXPECTED_VENDOR_SPEC } = require('./globe-vendor-integrity');

const RUNTIME_CONTROL_COMMIT = 'c7ba0560b164e5f3b67c01e96abf75720ad3fd7a';
const ROLLBACK_PLAN_SHA256 = 'c23bd5caf21bf05b6e637c6f599742e13a47b822b298054ca8d56e968d8aeaae';
const CACHE_NAME = 'elu-v34-ct42-neutral-rollback';
const SERVICE_WORKER_REGISTRATION = '/sw.js?v=34-ct42-neutral-rollback';

const EXPECTED_GEOMETRY = EXPECTED_ASSETS.find(asset => asset.id === 'country-geometry');
assert.ok(EXPECTED_GEOMETRY, 'canonical country geometry specification is absent');

const CONTROL_FILES = Object.freeze([
  'index.html',
  'css/globe-system.css',
  'js/data.js',
  'js/globe.js',
  'js/app.js',
  'sw.js',
  'tools/smoke-test.js',
]);

const PATCH_FILES = Object.freeze(CONTROL_FILES.filter(relative => relative !== 'js/app.js'));

const RUNTIME_DEPENDENCIES = Object.freeze([
  Object.freeze({ path: 'manifest.json', role: 'pwa_manifest_metadata' }),
  Object.freeze({ path: 'css/carbon-clock.css', role: 'supporting_runtime_style' }),
  Object.freeze({ path: 'js/gaia-utils.js', role: 'foundation_runtime' }),
  Object.freeze({ path: 'js/module-contracts.js', role: 'module_contract_runtime' }),
  Object.freeze({ path: 'js/event-bus.js', role: 'event_runtime' }),
  Object.freeze({ path: 'js/storage-adapter.js', role: 'storage_runtime' }),
  Object.freeze({ path: 'js/storage.js', role: 'storage_facade_runtime' }),
  Object.freeze({ path: 'js/data-schema.js', role: 'data_schema_runtime' }),
  Object.freeze({ path: 'js/carbon-clock.js', role: 'carbon_clock_runtime' }),
  Object.freeze({ path: EXPECTED_VENDOR_SPEC.destination, role: 'verified_globe_renderer' }),
  Object.freeze({ path: EXPECTED_GEOMETRY.path, role: 'pinned_country_geometry' }),
  Object.freeze({ path: 'data/carbon-projects.json', role: 'noncritical_runtime_data' }),
  Object.freeze({ path: 'tools/stack-lint.js', role: 'browser_rehearsal_stack_audit' }),
  Object.freeze({ path: 'scripts/verify_load_order.py', role: 'static_rehearsal_load_order' }),
]);

const RUNTIME_DEPENDENCY_FILES = Object.freeze(RUNTIME_DEPENDENCIES.map(entry => entry.path));

const APP_CALLED_GLOBE_APIS = Object.freeze([
  'prepare',
  'init',
  'teardownFailedRenderer',
  'rememberFallbackOpener',
  'showFallback',
  'hideFallback',
  'closeEvidenceBrowser',
  'clearCountrySelection',
  'selectDefaultCountry',
]);

const REQUIRED_GLOBE_LIFECYCLE_APIS = Object.freeze([
  'reset',
  'destroy',
  'getState',
]);

const RUNTIME_EXCLUSIONS = Object.freeze([
  'data/climate/runtime/country-factual-candidate.json',
  'assets/globe/runtime/manifest.json',
  'assets/globe/runtime/earth-night.jpg',
  'assets/globe/runtime/night-sky.svg',
  'assets/globe/runtime/earth-blue-marble.jpg',
  'assets/globe/runtime/earth-topology.png',
]);

const PROHIBITED_OUTPUTS = Object.freeze([
  'data/climate/runtime-manifest.json',
  'data/climate/releases/reviewed-release-diff.json',
  'data/climate/releases/ct40-allow-manifest.json',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function calculationHash(value) {
  const copy = structuredClone(value);
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function assertSafeRelativePath(relative) {
  assert.equal(typeof relative, 'string', 'runtime path must be a string');
  assert.ok(relative.length > 0 && !path.isAbsolute(relative), `runtime path must be relative: ${relative}`);
  const normalized = path.normalize(relative);
  assert.ok(normalized !== '..' && !normalized.startsWith(`..${path.sep}`), `runtime path escapes its root: ${relative}`);
  assert.equal(normalized, relative, `runtime path is not canonical: ${relative}`);
  return normalized;
}

function readRegularFile(root, relative) {
  const normalized = assertSafeRelativePath(relative);
  const rootReal = fs.realpathSync(root);
  let current = rootReal;
  const parts = normalized.split(path.sep);
  parts.forEach((part, index) => {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    assert.equal(stat.isSymbolicLink(), false, `${relative} must not traverse a symlink`);
    if (index === parts.length - 1) assert.equal(stat.isFile(), true, `${relative} must be a regular file`);
    else assert.equal(stat.isDirectory(), true, `${relative} ancestor ${parts.slice(0, index + 1).join('/')} must be a directory`);
  });
  const fileReal = fs.realpathSync(current);
  assert.ok(fileReal.startsWith(rootReal + path.sep), `${relative} resolves outside its root`);
  return fs.readFileSync(current);
}

function read(root, relative) {
  return readRegularFile(root, relative);
}

function pathEntryExists(root, relative) {
  try {
    fs.lstatSync(path.join(root, assertSafeRelativePath(relative)));
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function allowedMissingVendor(root, options = {}) {
  return options.allowMissingVendor === true &&
    !options.sourceOverrides?.[EXPECTED_VENDOR_SPEC.destination] &&
    !pathEntryExists(root, EXPECTED_VENDOR_SPEC.destination);
}

function readJson(root, relative) {
  return JSON.parse(read(root, relative));
}

function normalizeFiles(files) {
  return [...files].sort();
}

function assertExactFileSet(actual, expected, label) {
  assert.deepEqual(normalizeFiles(actual), normalizeFiles(expected), `${label} file set drift`);
}

function controlByPath(proof) {
  return new Map(proof.rollback.controls.map(control => [control.path, control]));
}

function dependencyByPath(proof) {
  return new Map(proof.rollback.runtime_dependency_closure.map(dependency => [dependency.path, dependency]));
}

function assertRegularTree(root) {
  const rootStat = fs.lstatSync(root);
  assert.equal(rootStat.isSymbolicLink(), false, 'materialized rollback root must not be a symlink');
  assert.equal(rootStat.isDirectory(), true, 'materialized rollback root must be a directory');
  const walk = directory => {
    for (const name of fs.readdirSync(directory)) {
      const absolute = path.join(directory, name);
      const relative = path.relative(root, absolute);
      const stat = fs.lstatSync(absolute);
      assert.equal(stat.isSymbolicLink(), false, `${relative} must not be a symlink in the materialized rollback site`);
      if (stat.isDirectory()) walk(absolute);
      else assert.equal(stat.isFile(), true, `${relative} must be a regular file in the materialized rollback site`);
    }
  };
  walk(root);
}

function assertCommitOrLateBound(proof) {
  const value = proof.candidate.review_chain_head;
  if (proof.candidate.review_chain_late_bound) {
    assert.equal(value, null, 'late-bound review chain must remain null');
    return;
  }
  assert.match(value, /^[a-f0-9]{40}$/, 'review chain head must be a full Git SHA');
}

function validateProofDocument(root, proof, options = {}) {
  assert.equal(proof.schema_version, '2.2.0');
  assert.equal(proof.proof_id, 'ct-42-neutral-runtime-rollback-rehearsal-2026-07-15');
  assert.equal(proof.status, 'built_not_reviewed_browser_gate_required');
  assert.equal(proof.release_authority, false);
  assert.equal(proof.deploy_authority, false);
  assert.deepEqual(proof.review, {
    status: 'not_reviewed',
    builder_id: 'ct-42-neutral-rollback-builder',
    reviewer_id: null,
    reviewed_at: null,
    independent_review_required: true,
  });
  assert.equal(proof.calculation_hash, calculationHash(proof), 'rollback proof calculation hash drift');
  if (options.expectedCalculationHash) {
    assert.equal(proof.calculation_hash, options.expectedCalculationHash, 'rollback proof is not the independently pinned artifact');
  }

  assert.equal(proof.candidate.runtime_control_commit, RUNTIME_CONTROL_COMMIT);
  assertCommitOrLateBound(proof);
  assert.equal(proof.candidate.candidate_id, 'ct-42-factual-runtime-candidate-2026-07-15');
  assert.equal(proof.candidate.decision, 'deny');
  assert.equal(proof.candidate.decision_scope, 'assessed_climate_release');
  assert.deepEqual(proof.candidate.publication_tiers, {
    factual_display: { status: 'eligible', eligible_count: 2060, blocked_count: 0 },
    magnitude_comparison: { status: 'eligible', eligible_count: 2060, blocked_count: 0 },
    commitment_display: { status: 'not_present', eligible_count: 0, blocked_count: 0 },
    derived_metrics: { status: 'not_present', eligible_count: 0, blocked_count: 0 },
    performance_assessment: { status: 'not_present', eligible_count: 0, blocked_count: 0 },
    score: { status: 'not_present', eligible_count: 0, blocked_count: 0 },
  });
  assert.equal(proof.candidate.release_eligible, false);
  assert.equal(proof.candidate.production_runtime_release, false);
  assert.equal(proof.candidate.rollback_plan.path, 'data/climate/runtime/rollback-plan.json');
  assert.equal(proof.candidate.rollback_plan.sha256, ROLLBACK_PLAN_SHA256);
  assert.equal(sha256(read(root, proof.candidate.rollback_plan.path)), ROLLBACK_PLAN_SHA256, 'rollback plan bytes changed');

  assert.equal(proof.rollback.strategy, 'current_hardened_runtime_to_neutral_surface');
  assert.equal(proof.rollback.source_runtime_commit, RUNTIME_CONTROL_COMMIT);
  assert.equal(proof.rollback.baseline_commit, null, 'rollback must not transplant a historical baseline');
  assert.equal(proof.rollback.cache_name, CACHE_NAME);
  assert.equal(proof.rollback.service_worker_registration, SERVICE_WORKER_REGISTRATION);
  assert.equal(proof.rollback.workspace_mutation, false);
  assert.deepEqual(proof.rollback.entity_boundary, {
    total: 201,
    retained_natural_earth_polygons: 173,
    approximate_small_state_points: 28,
    ordering: 'alphabetical_country_name_then_iso',
    climate_values: 0,
    evidence_state: 'withheld_for_all',
  });
  assert.deepEqual(proof.rollback.runtime_resources, {
    geometry: '/assets/globe/runtime/ne_110m_admin_0_countries.geojson?v=a4d67eac9c75',
    surface: 'solid_color',
    background: 'solid_color',
    remote_runtime_urls: [],
    candidate_json_precached: false,
    visual_assets_precached: false,
  });
  assert.deepEqual(proof.rollback.app_globe_compatibility.app_called_apis, APP_CALLED_GLOBE_APIS);
  assert.deepEqual(proof.rollback.app_globe_compatibility.lifecycle_apis, REQUIRED_GLOBE_LIFECYCLE_APIS);
  assert.equal(proof.rollback.app_globe_compatibility.boolean_init_required, true);
  assert.equal(proof.rollback.app_globe_compatibility.app_path, 'js/app.js');
  assert.match(proof.rollback.app_globe_compatibility.app_sha256, /^[a-f0-9]{64}$/);
  assert.equal(proof.rollback.patch.path, 'data/climate/operations/ct42-runtime-rollback.patch.b64');
  assert.equal(proof.rollback.patch.encoding, 'base64');
  assertExactFileSet(proof.rollback.patch.changed_files, PATCH_FILES, 'rollback patch');
  assertExactFileSet(proof.rollback.controls.map(control => control.path), CONTROL_FILES, 'rollback control');
  assertExactFileSet(proof.rollback.runtime_dependency_closure.map(dependency => dependency.path), RUNTIME_DEPENDENCY_FILES, 'rollback runtime dependency closure');
  assert.deepEqual(proof.rollback.runtime_exclusions, RUNTIME_EXCLUSIONS);
  assert.deepEqual(proof.prohibited_outputs, PROHIBITED_OUTPUTS);
  assert.deepEqual(proof.execution.browser_gate, {
    status: 'external_required_not_recorded',
    checker_enforced: false,
    evidence_artifact: null,
    independent_review_required: true,
    release_authority: false,
    deploy_authority: false,
  });

  const manifest = readJson(root, proof.candidate.candidate_manifest.path);
  assert.equal(sha256(read(root, proof.candidate.candidate_manifest.path)), proof.candidate.candidate_manifest.sha256);
  assert.equal(manifest.candidate_id, proof.candidate.candidate_id);
  assert.equal(manifest.review_status, 'not_reviewed');
  assert.equal(manifest.decision, 'deny');
  assert.equal(manifest.release_eligible, false);
  assert.equal(manifest.production_runtime_release, false);

  const runtime = readJson(root, proof.candidate.runtime_data.path);
  assert.equal(sha256(read(root, proof.candidate.runtime_data.path)), proof.candidate.runtime_data.sha256);
  assert.equal(runtime.candidate_id, proof.candidate.candidate_id);
  assert.equal(runtime.review_status, 'not_reviewed');
  assert.equal(runtime.production_runtime_release, false);

  const ct40 = readJson(root, proof.candidate.ct40_result.path);
  assert.equal(sha256(read(root, proof.candidate.ct40_result.path)), proof.candidate.ct40_result.sha256);
  assert.equal(ct40.decision, 'deny');
  assert.equal(ct40.decision_scope, proof.candidate.decision_scope);
  assert.equal(ct40.eligible, false);
  assert.equal(ct40.release_authority, false);
  assert.deepEqual(
    Object.fromEntries(Object.entries(ct40.publication_tiers).map(([tier, state]) => [tier, {
      status: state.status,
      eligible_count: state.eligible_count,
      blocked_count: state.blocked_count,
    }])),
    proof.candidate.publication_tiers,
  );
  assert.deepEqual(ct40.prohibited_outputs_absent, PROHIBITED_OUTPUTS);

  const patchArtifactBytes = options.patchBytes || read(root, proof.rollback.patch.path);
  assert.equal(sha256(patchArtifactBytes), proof.rollback.patch.sha256, 'rollback patch artifact hash drift');
  if (options.expectedPatchSha256) {
    assert.equal(proof.rollback.patch.sha256, options.expectedPatchSha256, 'rollback patch is not the independently pinned artifact');
  }
  const patchArtifactText = patchArtifactBytes.toString('utf8');
  const encodedPatch = patchArtifactText.replace(/\s/g, '');
  assert.match(encodedPatch, /^[A-Za-z0-9+/]+={0,2}$/, 'rollback patch is not base64');
  const canonicalArtifact = `${encodedPatch.match(/.{1,76}/g).join('\n')}\n`;
  assert.equal(patchArtifactText, canonicalArtifact, 'rollback patch artifact wrapping drift');
  const patchBytes = Buffer.from(encodedPatch, 'base64');
  assert.equal(patchBytes.toString('base64'), encodedPatch, 'rollback patch base64 round-trip drift');
  assert.equal(sha256(patchBytes), proof.rollback.patch.decoded_sha256, 'decoded rollback patch hash drift');

  const controls = controlByPath(proof);
  for (const relative of CONTROL_FILES) {
    const control = controls.get(relative);
    assert.ok(control, `missing rollback control ${relative}`);
    const bytes = options.sourceOverrides?.[relative] || read(root, relative);
    assert.equal(sha256(bytes), control.candidate_sha256, `${relative} candidate pin drift`);
    assert.match(control.rollback_sha256, /^[a-f0-9]{64}$/);
    assert.equal(control.changed, PATCH_FILES.includes(relative), `${relative} changed flag drift`);
  }
  assert.equal(
    controls.get('js/app.js').rollback_sha256,
    proof.rollback.app_globe_compatibility.app_sha256,
    'App compatibility pin drift',
  );
  assert.equal(controls.get('js/app.js').candidate_sha256, controls.get('js/app.js').rollback_sha256, 'App must remain byte-identical');

  const dependencies = dependencyByPath(proof);
  for (const expected of RUNTIME_DEPENDENCIES) {
    const dependency = dependencies.get(expected.path);
    assert.ok(dependency, `missing rollback runtime dependency ${expected.path}`);
    assert.equal(dependency.role, expected.role, `${expected.path} dependency role drift`);
    assert.equal(
      dependency.source_commit,
      expected.path === EXPECTED_VENDOR_SPEC.destination ? null : RUNTIME_CONTROL_COMMIT,
      `${expected.path} dependency source commit drift`,
    );
    assert.match(dependency.source_sha256, /^[a-f0-9]{64}$/);
    assert.equal(dependency.materialized_sha256, dependency.source_sha256, `${expected.path} source/materialized pin drift`);
    const missingExternalVendor = expected.path === EXPECTED_VENDOR_SPEC.destination && allowedMissingVendor(root, options);
    if (!missingExternalVendor) {
      const bytes = options.sourceOverrides?.[expected.path] || read(root, expected.path);
      assert.equal(sha256(bytes), dependency.source_sha256, `${expected.path} source dependency pin drift`);
    }
  }
  assert.equal(dependencies.get(EXPECTED_GEOMETRY.path).source_sha256, EXPECTED_GEOMETRY.sha256, 'country geometry is not bound to the canonical CT-45 digest');
  assert.equal(dependencies.get(EXPECTED_VENDOR_SPEC.destination).source_sha256, EXPECTED_VENDOR_SPEC.sha256, 'globe.gl is not bound to the canonical vendor digest');

  for (const relative of PROHIBITED_OUTPUTS) {
    assert.equal(fs.existsSync(path.join(root, relative)), false, `${relative} must remain absent before rollback rehearsal`);
  }

  return { patchBytes, controls };
}

function write(root, relative, bytes) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}

function copyIfPresent(sourceRoot, destinationRoot, relative) {
  const source = path.join(sourceRoot, relative);
  if (!fs.existsSync(source)) return false;
  assert.equal(fs.lstatSync(source).isSymbolicLink(), false, `${relative} copy source must not be a symlink`);
  const destination = path.join(destinationRoot, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
  return true;
}

function stageCandidateTree(root, sourceRoot, controls, options = {}) {
  const sourceOverrides = options.sourceOverrides || {};
  for (const dependency of RUNTIME_DEPENDENCIES) {
    if (dependency.path === EXPECTED_VENDOR_SPEC.destination && allowedMissingVendor(sourceRoot, options)) continue;
    write(root, dependency.path, sourceOverrides[dependency.path] || read(sourceRoot, dependency.path));
  }

  for (const relative of CONTROL_FILES) {
    const bytes = sourceOverrides[relative] || read(sourceRoot, relative);
    write(root, relative, bytes);
    assert.equal(sha256(read(root, relative)), controls.get(relative).candidate_sha256, `${relative} staged candidate drift`);
  }
  assertRegularTree(root);
}

function applyPatch(rehearsalRoot, patchBytes) {
  const patchPath = path.join(rehearsalRoot, '.ct42-rollback.patch');
  fs.writeFileSync(patchPath, patchBytes);
  const check = childProcess.spawnSync('git', ['apply', '--check', '--no-index', patchPath], {
    cwd: rehearsalRoot,
    encoding: 'utf8',
  });
  assert.equal(check.status, 0, `rollback patch preflight failed: ${(check.stderr || check.stdout || '').trim()}`);
  const apply = childProcess.spawnSync('git', ['apply', '--no-index', patchPath], {
    cwd: rehearsalRoot,
    encoding: 'utf8',
  });
  assert.equal(apply.status, 0, `rollback patch application failed: ${(apply.stderr || apply.stdout || '').trim()}`);
  fs.rmSync(patchPath);
}

function removeRuntimeExclusions(root) {
  for (const relative of RUNTIME_EXCLUSIONS) {
    fs.rmSync(path.join(root, relative), { force: true });
  }
}

function appApiTokens(api) {
  if (api === 'prepare' || api === 'init') return [`GlobeModule.${api}(`];
  return [`'GlobeModule', '${api}'`, `GlobeModule.${api}(`];
}

function assertAppGlobeCompatibility(app, globe) {
  for (const api of APP_CALLED_GLOBE_APIS) {
    assert.ok(appApiTokens(api).some(token => app.includes(token)), `App call to GlobeModule.${api} is absent`);
    assert.match(globe, new RegExp(`\\n  (?:async\\s+)?${api.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\(`), `GlobeModule.${api} implementation is absent`);
  }
  for (const api of REQUIRED_GLOBE_LIFECYCLE_APIS) {
    assert.match(globe, new RegExp(`\\n  ${api}\\s*\\(`), `GlobeModule.${api} lifecycle implementation is absent`);
  }
  assert.ok(app.includes('GlobeModule._initialized = GlobeModule.init() === true'), 'App boolean init boundary changed');
  assert.ok(app.includes('GlobeModule._initialized = false'), 'App init failure state changed');
  assert.ok(globe.includes('_initialized: false'), 'Globe renderer initialization state is absent');

  const contract = globe.match(/MODULE_CONTRACTS\.register\('GlobeModule',[\s\S]*?provides:\s*\[([\s\S]*?)\]/);
  assert.ok(contract, 'GlobeModule contract is absent');
  for (const api of [...APP_CALLED_GLOBE_APIS, ...REQUIRED_GLOBE_LIFECYCLE_APIS]) {
    assert.ok(contract[1].includes(`'${api}'`), `GlobeModule contract no longer provides ${api}`);
  }
}

function validateGeometryBoundary(rehearsalRoot) {
  const geometry = readJson(rehearsalRoot, 'assets/globe/runtime/ne_110m_admin_0_countries.geojson');
  assert.equal(geometry.type, 'FeatureCollection');
  assert.equal(geometry.features.length, 177, 'Natural Earth source feature count drift');
  const nonAssessing = new Set(['N. Cyprus', 'Northern Cyprus', 'Somaliland', 'Kosovo']);
  const retained = geometry.features.filter(feature =>
    feature?.properties?.ISO_A2 !== 'AQ' &&
    ![feature?.properties?.ADMIN, feature?.properties?.NAME, feature?.properties?.name].some(name => nonAssessing.has(name)));
  assert.equal(retained.length, 173, 'neutral rollback retained polygon count drift');
  return retained.length;
}

function validateRollbackState(rehearsalRoot, proof, options = {}) {
  const controls = controlByPath(proof);
  const dependencies = dependencyByPath(proof);
  assertRegularTree(rehearsalRoot);
  for (const relative of CONTROL_FILES) {
    assert.equal(
      sha256(read(rehearsalRoot, relative)),
      controls.get(relative).rollback_sha256,
      `${relative} rollback output drift`,
    );
  }
  const materializedRuntimeDependencies = [];
  for (const relative of RUNTIME_DEPENDENCY_FILES) {
    if (relative === EXPECTED_VENDOR_SPEC.destination && allowedMissingVendor(rehearsalRoot, options)) continue;
    assert.equal(
      sha256(read(rehearsalRoot, relative)),
      dependencies.get(relative).materialized_sha256,
      `${relative} materialized runtime dependency drift`,
    );
    materializedRuntimeDependencies.push(relative);
  }
  const runtimeDependenciesComplete = materializedRuntimeDependencies.length === RUNTIME_DEPENDENCY_FILES.length;

  const index = read(rehearsalRoot, 'index.html').toString('utf8');
  const data = read(rehearsalRoot, 'js/data.js').toString('utf8');
  const globe = read(rehearsalRoot, 'js/globe.js').toString('utf8');
  const app = read(rehearsalRoot, 'js/app.js').toString('utf8');
  const css = read(rehearsalRoot, 'css/globe-system.css').toString('utf8');
  const sw = read(rehearsalRoot, 'sw.js').toString('utf8');
  const smoke = read(rehearsalRoot, 'tools/smoke-test.js').toString('utf8');

  ['js/data.js', 'js/globe.js', 'js/app.js', 'sw.js', 'tools/smoke-test.js'].forEach(relative => {
    const syntax = childProcess.spawnSync(process.execPath, ['--check', relative], {
      cwd: rehearsalRoot,
      encoding: 'utf8',
    });
    assert.equal(syntax.status, 0, `${relative} rollback syntax failed: ${(syntax.stderr || syntax.stdout || '').trim()}`);
  });

  const loadOrder = childProcess.spawnSync('python3', ['scripts/verify_load_order.py'], {
    cwd: rehearsalRoot,
    encoding: 'utf8',
  });
  assert.equal(loadOrder.status, 0, `rollback load-order verification failed: ${(loadOrder.stderr || loadOrder.stdout || '').trim()}`);

  assertAppGlobeCompatibility(app, globe);
  const retainedPolygons = validateGeometryBoundary(rehearsalRoot);
  assert.equal(retainedPolygons, proof.rollback.entity_boundary.retained_natural_earth_polygons);

  assert.ok(!data.includes('country-factual-candidate.json'), 'candidate runtime data pointer survived rollback');
  assert.ok(!data.includes('CLIMATE_CANDIDATE_SHA256'), 'candidate digest boundary survived rollback');
  assert.ok(data.includes("climateCandidateState: 'withheld'"), 'Data fail-closed state is absent');
  assert.ok(data.includes('getClimateCountry() { return null; }'), 'neutral country adapter is absent');
  assert.ok(data.includes('getClimateRanking() { return null; }'), 'neutral ranking adapter is absent');

  assert.ok(globe.includes('EXPECTED_RETAINED_POLYGON_COUNT = 173'), 'retained polygon boundary is absent');
  assert.ok(globe.includes('EXPECTED_SMALL_NATION_POINT_COUNT = 28'), 'small-state point boundary is absent');
  assert.ok(globe.includes(".sort((a, b) => String(a.country).localeCompare(String(b.country)) || a.iso.localeCompare(b.iso));"), 'alphabetical deck order is absent');
  assert.ok(globe.includes("evidenceState: 'withheld'"), 'neutral evidence state is absent');
  assert.ok(globe.includes('All 201 neutral navigation entities are available here.'), 'neutral fallback entity boundary is absent');
  assert.ok(!globe.includes('All 249 registry entities'), 'stale candidate fallback entity count survived rollback');
  assert.ok(!globe.includes('_magnitudeColor') && !globe.includes('_magnitudePosition'), 'candidate magnitude encoding survived rollback');
  assert.ok(!globe.includes('Data.getClimateCountry') && !globe.includes('Data.getClimateRanking'), 'candidate climate adapter survived rollback');
  assert.ok(globe.includes("surface: null") && globe.includes("backgroundImage: null"), 'solid globe/background configuration is absent');
  assert.ok(!globe.includes('/assets/globe/runtime/earth-night.jpg') &&
    !globe.includes('/assets/globe/runtime/night-sky.svg') &&
    !globe.includes('/assets/globe/runtime/earth-blue-marble.jpg') &&
    !globe.includes('/assets/globe/runtime/earth-topology.png'), 'visual asset URL survived rollback');
  assert.ok(!/https?:\/\//.test(globe) && !/https?:\/\//.test(data) && !/https?:\/\//.test(sw), 'remote runtime URL survived rollback');
  assert.ok(globe.includes("selectDefaultCountry() {\n    return false;"), 'App compatibility no-op must not auto-open a dialog');

  assert.ok(!css.includes('.elu-rank-dot.is-magnitude'), 'candidate magnitude rail styling survived rollback');
  assert.ok(!css.includes('.tt-candidate'), 'candidate disclosure styling survived rollback');
  assert.ok(css.includes("content: 'A–Z';"), 'rollback mobile rail is not alphabetical');
  assert.ok(css.includes('#globe-evidence-browse {\n  min-height: 44px;'), 'evidence browser touch target is below 44px');
  assert.ok(css.includes('#globe-theme-toggle {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex: 0 0 auto;\n  width: 44px;\n  height: 44px;'), 'theme toggle touch target is below 44px');
  assert.ok(css.includes('.elu-rank-toggle {\n  width: 44px;\n  height: 44px;\n  flex: 0 0 44px;'), 'rank toggle touch target is below 44px');
  assert.ok(index.includes('Uniform neutral surface · country evidence withheld'), 'neutral legend missing after rollback');
  assert.ok(index.includes('201 neutral navigation entities'), 'neutral entity boundary missing from public copy');
  assert.ok(!index.includes('CT-42 candidate previews') && !index.includes('Lower 2023 emissions magnitude'), 'candidate public presentation survived rollback');
  assert.ok(index.includes("navigator.serviceWorker.register('/sw.js?v=34-ct42-neutral-rollback'"), 'rollback service-worker registration mismatch');
  ['css/globe-system.css?v=ct42-neutral-rollback-1', 'js/data.js?v=ct42-neutral-rollback-1', 'js/globe.js?v=ct42-neutral-rollback-1'].forEach(asset => {
    assert.ok(index.includes(asset), `rollback asset cache key missing for ${asset}`);
  });
  assert.ok(!index.includes('fonts.googleapis.com/css2') && !index.includes('rel="preconnect" href="https://fonts.'), 'remote font runtime request survived rollback');

  assert.ok(sw.includes(`const CACHE_NAME = '${CACHE_NAME}';`), 'rollback cache epoch mismatch');
  assert.ok(!sw.includes('/data/climate/runtime/country-factual-candidate.json'), 'candidate data remains in rollback pre-cache');
  for (const relative of RUNTIME_EXCLUSIONS.slice(1)) {
    assert.ok(!sw.includes('/' + relative), `${relative} remains in rollback pre-cache`);
  }
  assert.ok(sw.includes('/assets/globe/runtime/ne_110m_admin_0_countries.geojson?v=a4d67eac9c75'), 'local geometry missing from rollback pre-cache');
  assert.ok(sw.includes("keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))"), 'rollback cache eviction behavior missing');

  assert.ok(smoke.includes('Neutral rollback keeps all climate evidence withheld'), 'rollback-specific SmokeTest is absent');
  assert.ok(smoke.includes('Exact neutral country navigation boundary'), 'rollback entity-boundary SmokeTest is absent');
  assert.ok(smoke.includes('Solid globe and background have no image textures'), 'rollback texture SmokeTest is absent');
  assert.ok(smoke.includes('App-called GlobeModule APIs remain compatible'), 'rollback App compatibility SmokeTest is absent');

  for (const relative of [...RUNTIME_EXCLUSIONS, ...PROHIBITED_OUTPUTS]) {
    assert.equal(fs.existsSync(path.join(rehearsalRoot, relative)), false, `${relative} appeared in rollback rehearsal site`);
  }

  return {
    outputHashes: Object.fromEntries(CONTROL_FILES.map(relative => [relative, sha256(read(rehearsalRoot, relative))])),
    retainedPolygons,
    smallNationPoints: proof.rollback.entity_boundary.approximate_small_state_points,
    materializedRuntimeDependencies,
    runtimeDependenciesComplete,
    vendorMaterialized: materializedRuntimeDependencies.includes(EXPECTED_VENDOR_SPEC.destination),
  };
}

function rehearse(root, proof, options = {}) {
  const validated = validateProofDocument(root, proof, options);
  const rehearsalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-ct42-neutral-rollback-'));
  try {
    stageCandidateTree(rehearsalRoot, root, validated.controls, options);
    applyPatch(rehearsalRoot, validated.patchBytes);
    removeRuntimeExclusions(rehearsalRoot);
    if (options.afterApply) options.afterApply(rehearsalRoot);
    const state = validateRollbackState(rehearsalRoot, proof, options);
    return {
      proof_id: proof.proof_id,
      candidate_decision: proof.candidate.decision,
      cache_name: proof.rollback.cache_name,
      changed_files: PATCH_FILES.length,
      pinned_control_files: CONTROL_FILES.length,
      pinned_runtime_dependencies: RUNTIME_DEPENDENCY_FILES.length,
      materialized_runtime_dependencies: state.materializedRuntimeDependencies.length,
      runtime_dependencies_complete: state.runtimeDependenciesComplete,
      vendor_materialized: state.vendorMaterialized,
      output_hashes: state.outputHashes,
      retained_polygons: state.retainedPolygons,
      small_nation_points: state.smallNationPoints,
      prohibited_outputs_absent: PROHIBITED_OUTPUTS.length,
      runtime_exclusions_absent: RUNTIME_EXCLUSIONS.length,
      workspace_mutation: false,
    };
  } finally {
    fs.rmSync(rehearsalRoot, { recursive: true, force: true });
  }
}

function copyPublicTree(sourceRoot, destinationRoot) {
  for (const relative of ['index.html', 'sw.js', 'THIRD_PARTY_NOTICES.txt', 'css', 'js', 'assets', 'data']) {
    copyIfPresent(sourceRoot, destinationRoot, relative);
  }
  for (const relative of ['tools/smoke-test.js', 'tools/stack-lint.js', 'scripts/verify_load_order.py']) {
    copyIfPresent(sourceRoot, destinationRoot, relative);
  }
}

function materializeRollbackSite(root, proof, destination, options = {}) {
  const validated = validateProofDocument(root, proof, options);
  assert.ok(path.isAbsolute(destination), 'temporary rollback site destination must be absolute');
  assert.equal(fs.existsSync(destination), false, 'temporary rollback site destination already exists');
  fs.mkdirSync(destination, { recursive: true });
  try {
    copyPublicTree(root, destination);
    assertRegularTree(destination);
    for (const relative of CONTROL_FILES) {
      write(destination, relative, options.sourceOverrides?.[relative] || read(root, relative));
    }
    for (const relative of RUNTIME_DEPENDENCY_FILES) {
      if (relative === EXPECTED_VENDOR_SPEC.destination && allowedMissingVendor(root, options)) continue;
      write(destination, relative, options.sourceOverrides?.[relative] || read(root, relative));
    }
    applyPatch(destination, validated.patchBytes);
    removeRuntimeExclusions(destination);
    const state = validateRollbackState(destination, proof, options);
    return {
      destination,
      output_hashes: state.outputHashes,
      retained_polygons: state.retainedPolygons,
      small_nation_points: state.smallNationPoints,
      materialized_runtime_dependencies: state.materializedRuntimeDependencies.length,
      runtime_dependencies_complete: state.runtimeDependenciesComplete,
      vendor_materialized: state.vendorMaterialized,
      browser_ready: state.vendorMaterialized && state.runtimeDependenciesComplete,
      browser_commands: proof.execution.browser_rehearsal,
    };
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}

module.exports = {
  APP_CALLED_GLOBE_APIS,
  CACHE_NAME,
  CONTROL_FILES,
  EXPECTED_GEOMETRY,
  EXPECTED_VENDOR_SPEC,
  PATCH_FILES,
  PROHIBITED_OUTPUTS,
  REQUIRED_GLOBE_LIFECYCLE_APIS,
  ROLLBACK_PLAN_SHA256,
  RUNTIME_CONTROL_COMMIT,
  RUNTIME_DEPENDENCIES,
  RUNTIME_DEPENDENCY_FILES,
  RUNTIME_EXCLUSIONS,
  SERVICE_WORKER_REGISTRATION,
  calculationHash,
  assertRegularTree,
  materializeRollbackSite,
  rehearse,
  sha256,
  stable,
  validateProofDocument,
  validateRollbackState,
};
