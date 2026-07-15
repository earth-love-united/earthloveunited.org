'use strict';

const crypto = require('node:crypto');
const { hasActiveCiJob, hasExactCiStep } = require('./globe-vendor-integrity');

const POLICY_VERSION = '1.0.0';
const MANIFEST_PATH = 'assets/globe/runtime/manifest.json';
const EXPECTED_MANIFEST_SHA256 = 'd384bdcf57c73540a19782d0336ad84b604525eccab40acd716fcb1e52b17a76';
const EXPECTED_MANIFEST_SEMANTIC_SHA256 = '84edb0ce95986629353dbba8a97ba6c2d25a5c9f8603040fcd31feceb28a4e33';
const EXPECTED_NATURAL_EARTH_SOURCES = Object.freeze({
  about_url: 'https://www.naturalearthdata.com/about/',
  terms_url: 'https://www.naturalearthdata.com/about/terms-of-use/',
  disputed_boundaries_policy_url: 'https://www.naturalearthdata.com/about/disputed-boundaries-policy/',
});
const EXPECTED_ASSETS = Object.freeze([
  Object.freeze({ id: 'country-geometry', kind: 'geojson', path: 'assets/globe/runtime/ne_110m_admin_0_countries.geojson', runtime_url: '/assets/globe/runtime/ne_110m_admin_0_countries.geojson?v=a4d67eac9c75', source_url: 'https://cdn.jsdelivr.net/npm/globe.gl@2.46.1/example/datasets/ne_110m_admin_0_countries.geojson', source_package: 'globe.gl', source_version: '2.46.1', sha256: 'a4d67eac9c75d5b6f20170d2b07bb53ea791536b0c8e5ebae3ba94df093f76e0', bytes: 488013, feature_count: 177 }),
  Object.freeze({ id: 'earth-night', kind: 'image', path: 'assets/globe/runtime/earth-night.jpg', runtime_url: '/assets/globe/runtime/earth-night.jpg?v=355ab23dd132', source_url: 'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-night.jpg', source_package: 'three-globe', source_version: '2.45.2', sha256: '355ab23dd1323315b393d7b91dd2d7ee223a1cbaaba2b48dc72ba90d371ced24', bytes: 715000, width: 4096, height: 2048 }),
  Object.freeze({ id: 'night-sky', kind: 'image', path: 'assets/globe/runtime/night-sky.png', runtime_url: '/assets/globe/runtime/night-sky.png?v=7e1d5e780301', source_url: 'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/night-sky.png', source_package: 'three-globe', source_version: '2.45.2', sha256: '7e1d5e780301e3a33bd79fd3ac414f7a742465f33ae4605abca743d43a3ab983', bytes: 904154, width: 4096, height: 2048 }),
  Object.freeze({ id: 'earth-blue-marble', kind: 'image', path: 'assets/globe/runtime/earth-blue-marble.jpg', runtime_url: '/assets/globe/runtime/earth-blue-marble.jpg?v=228deba2e4b6', source_url: 'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-blue-marble.jpg', source_package: 'three-globe', source_version: '2.45.2', sha256: '228deba2e4b600146bdcb6cfa359b8ead6aacc2b1c13550a29cd82824cfa1c01', bytes: 1461877, width: 4096, height: 2048 }),
  Object.freeze({ id: 'earth-topology', kind: 'image', path: 'assets/globe/runtime/earth-topology.png', runtime_url: '/assets/globe/runtime/earth-topology.png?v=839b12da2e4d', source_url: 'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-topology.png', source_package: 'three-globe', source_version: '2.45.2', sha256: '839b12da2e4dd346b256cebae72e10c479a102c8980a22084c41275e4b9a0e12', bytes: 378243, width: 2048, height: 1024 }),
]);
const EXPECTED_ASSET_MANIFEST_EXTRAS = Object.freeze({
  'country-geometry': Object.freeze({
    feature_collection_type: 'FeatureCollection',
    geometry_types: Object.freeze(['Polygon', 'MultiPolygon']),
    rights_basis: 'Natural Earth source data: public domain; exact packaged bytes pinned here for reproducible navigation.',
    rights_review_status: 'not_reviewed',
    production_use_approved: false,
  }),
  'earth-night': Object.freeze({
    rights_basis: 'Exact file included in three-globe 2.45.2. Package inclusion establishes provenance, not underlying image-rights clearance.',
    rights_review_status: 'not_reviewed',
    production_use_approved: false,
  }),
  'night-sky': Object.freeze({
    rights_basis: 'Exact file included in three-globe 2.45.2. Package inclusion establishes provenance, not underlying image-rights clearance.',
    rights_review_status: 'not_reviewed',
    production_use_approved: false,
  }),
  'earth-blue-marble': Object.freeze({
    rights_basis: 'Exact file included in three-globe 2.45.2. Package inclusion establishes provenance, not underlying image-rights clearance.',
    rights_review_status: 'not_reviewed',
    production_use_approved: false,
  }),
  'earth-topology': Object.freeze({
    rights_basis: 'Exact file included in three-globe 2.45.2. Package inclusion establishes provenance, not underlying image-rights clearance.',
    rights_review_status: 'not_reviewed',
    production_use_approved: false,
  }),
});
const EXPECTED_SMALL_NATION_POINTS = Object.freeze([
  ['AND', 42.55, 1.58], ['ATG', 17.08, -61.80], ['BHR', 26.05, 50.55],
  ['BRB', 13.17, -59.55], ['CPV', 15.10, -23.62], ['COM', -11.65, 43.35],
  ['DMA', 15.42, -61.34], ['FSM', 6.92, 158.25], ['GRD', 12.11, -61.68],
  ['KIR', 1.45, 172.98], ['KNA', 17.30, -62.73], ['LCA', 13.90, -60.97],
  ['LIE', 47.16, 9.55], ['MCO', 43.73, 7.42], ['MDV', 3.25, 73.22],
  ['MHL', 7.10, 171.38], ['MLT', 35.90, 14.51], ['MUS', -20.28, 57.55],
  ['NRU', -0.52, 166.93], ['PLW', 7.50, 134.62], ['SMR', 43.94, 12.46],
  ['SGP', 1.35, 103.82], ['STP', 0.33, 6.73], ['SYC', -4.68, 55.48],
  ['TON', -21.18, -175.20], ['TUV', -8.52, 179.20], ['VCT', 13.25, -61.20],
  ['WSM', -13.83, -171.77],
].map(point => Object.freeze(point)));
const EXPECTED_SMALL_NATION_NAMES = Object.freeze([
  'Andorra', 'Antigua and Barbuda', 'Bahrain', 'Barbados', 'Cabo Verde', 'Comoros', 'Dominica',
  'Micronesia, Federated States of', 'Grenada', 'Kiribati', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Liechtenstein', 'Monaco', 'Maldives', 'Marshall Islands', 'Malta', 'Mauritius', 'Nauru', 'Palau',
  'San Marino', 'Singapore', 'Sao Tome and Principe', 'Seychelles', 'Tonga', 'Tuvalu',
  'Saint Vincent and the Grenadines', 'Samoa',
]);
const REQUIRED_UI_REVIEW_PIN_PATHS = Object.freeze([
  'index.html',
  'css/globe-system.css',
  'js/app.js',
  'js/globe.js',
  'js/data.js',
  'tools/smoke-test.js',
  'data/climate/runtime/country-factual-candidate.json',
  'data/climate/runtime/candidate-manifest.json',
  'data/small-nations.json',
  'sw.js',
  MANIFEST_PATH,
  ...EXPECTED_ASSETS.map(asset => asset.path),
]);
const EXPECTED_INDEX_SW_KEYS = Object.freeze([
  '/css/carbon-clock.css?v=v2',
  '/css/globe-system.css?v=v13',
  '/js/gaia-utils.js',
  '/js/module-contracts.js',
  '/js/event-bus.js',
  '/js/storage-adapter.js',
  '/js/storage.js',
  '/js/data-schema.js?v=v1',
  '/js/data.js?v=v2',
  '/js/globe.js?v=v7',
  '/js/carbon-clock.js?v=v1',
  '/js/app.js?v=v3',
]);
const REQUIRED_CONTROL_OWNERS = Object.freeze([
  '/tools/check-globe-runtime-assets.js',
  '/tools/lib/globe-runtime-assets.js',
  '/tools/fixtures/globe-runtime-assets.json',
  '/tools/build-deploy.sh',
  '/tools/check-climate-production-readiness.js',
  '/tools/check-climate-production-readiness-policy.js',
  '/tools/lib/climate-production-readiness.js',
  '/tools/check-climate-runtime-diff-boundary.js',
  '/tools/lib/climate-runtime-diff-boundary.js',
  '/data/climate/fixtures/climate-runtime-diff-boundary.json',
  '/tools/lib/ct42-ct40-release-review.js',
  '/tools/check-ct42-ct40-release-review-candidate.js',
  '/data/climate/fixtures/ct42-ct40-release-review.json',
  '/tools/check-climate-factual-runtime-ui-review.js',
  '/data/climate/reviews/climate-factual-runtime-ct42-ui-review.json',
  '/data/climate/reviews/globe-runtime-assets-production-review.json',
  '/tools/smoke-test.js',
  '/tools/check-globe-webgl-fallback.js',
  '/data/climate/fixtures/globe-webgl-fallback.json',
  '/assets/globe/runtime/',
  '/data/small-nations.json',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function occurrences(value, needle) {
  return String(value || '').split(needle).length - 1;
}

function stripComments(value) {
  return String(value || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trimStart().startsWith('//'))
    .join('\n');
}

function workflowStep(source, name) {
  const marker = `- name: ${name}`;
  const start = source.indexOf(marker);
  if (start === -1) return '';
  const next = source.indexOf('\n      - ', start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

function activeFailClosedStep(source, name, command) {
  const step = workflowStep(source, name);
  return step.includes(`run: ${command}`) &&
    !/continue-on-error:\s*true|if:\s*(?:\$\{\{\s*)?false|\|\|\s*true|;\s*true|#.*(?:skip|optional|disabled)/i.test(step);
}

function exactAssetManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.assets) || manifest.assets.length !== EXPECTED_ASSETS.length) return false;
  return EXPECTED_ASSETS.every((expected, index) => {
    const actual = manifest.assets[index];
    const exact = { ...expected, ...EXPECTED_ASSET_MANIFEST_EXTRAS[expected.id] };
    return JSON.stringify(stable(actual)) === JSON.stringify(stable(exact));
  });
}

function exactRuntimeConfig(config) {
  if (!config || config.geometry_url !== EXPECTED_ASSETS[0].runtime_url) return false;
  const expected = EXPECTED_ASSETS.filter(asset => asset.kind === 'image').map(asset => ({
    url: asset.runtime_url,
    width: asset.width,
    height: asset.height,
  }));
  return JSON.stringify(config.visual_assets) === JSON.stringify(expected) &&
    ![config.geometry_url, ...config.visual_assets.map(asset => asset.url)].some(url => /^https?:/i.test(url));
}

function exactLocalAssets(records) {
  return EXPECTED_ASSETS.every(expected => {
    const record = records?.[expected.path];
    if (!record?.exists || record.sha256 !== expected.sha256 || record.bytes !== expected.bytes) return false;
    if (expected.kind === 'image') return record.width === expected.width && record.height === expected.height;
    return record.feature_count === expected.feature_count && record.feature_collection_type === 'FeatureCollection' && record.geometry_valid === true;
  });
}

function exactNavigationPoints(points) {
  if (!Array.isArray(points) || points.length !== EXPECTED_SMALL_NATION_POINTS.length) return false;
  const isoCodes = new Set();
  return points.every((point, index) => {
    const expected = EXPECTED_SMALL_NATION_POINTS[index];
    if (!point || point.country !== EXPECTED_SMALL_NATION_NAMES[index] ||
        typeof point.iso !== 'string' || !/^[A-Z]{3}$/.test(point.iso) || isoCodes.has(point.iso) ||
        !Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90 ||
        !Number.isFinite(point.lng) || point.lng < -180 || point.lng > 180) return false;
    isoCodes.add(point.iso);
    return point.iso === expected[0] && point.lat === expected[1] && point.lng === expected[2];
  });
}

function evaluateRuntimeAssets(input) {
  const manifest = input?.manifest;
  const files = input?.files || {};
  const records = input?.assets || {};
  const checks = [];
  const check = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });
  const index = stripComments(files.index);
  const globe = stripComments(files.globe);
  const app = stripComments(files.app);
  const data = stripComments(files.data);
  const sw = stripComments(files.sw);
  const buildDeploy = stripComments(files.build_deploy);
  // CI is YAML with embedded shell/JavaScript globs. JavaScript block-comment
  // stripping would misread paths such as */vendor/* and delete active steps.
  const ci = String(files.ci || '');
  const climateTruthCi = stripComments(files.climate_truth_ci);
  const reviewAdapter = stripComments(files.review_adapter);
  const runtimeBoundary = stripComments(files.runtime_boundary);
  const smoke = stripComments(files.smoke);

  check('manifest-identity', manifest?.schema_version === '1.0.0' && manifest?.manifest_id === 'elu-globe-runtime-assets-2026-07-15' && manifest?.retrieved_at === '2026-07-15',
    'The committed manifest must identify the exact retrieval and schema boundary.');
  check('exact-full-manifest', input?.manifest_sha256 === EXPECTED_MANIFEST_SHA256 &&
    input?.manifest_semantic_sha256 === EXPECTED_MANIFEST_SEMANTIC_SHA256,
    'The complete manifest bytes and normalized content must match the reviewed candidate, including every source, limitation, normalization, and denied-authority field.');
  check('https-only-retrieval', manifest?.transport?.protocol === 'https-only' && manifest?.transport?.redirect_protocol === 'https-only' && manifest?.transport?.minimum_tls === '1.2',
    'Asset retrieval must be HTTPS-only, including redirects, with TLS 1.2 or newer.');
  check('exact-pinned-manifest', exactAssetManifest(manifest),
    'The manifest must contain exactly the five approved versioned URLs, paths, digests, sizes, dimensions, and feature count.');
  check('exact-local-bytes', exactLocalAssets(records),
    'Every committed asset must exist and match its approved SHA-256, byte size, dimensions, and GeoJSON structure.');

  const textureEntries = Array.isArray(manifest?.assets) ? manifest.assets.filter(asset => asset.kind === 'image') : [];
  check('texture-rights-fail-closed', textureEntries.length === 4 && textureEntries.every(asset =>
    asset.rights_review_status === 'not_reviewed' && asset.production_use_approved === false &&
    /provenance, not underlying image-rights clearance/.test(asset.rights_basis || '')) &&
    manifest?.sources?.three_globe?.texture_rights_review_status === 'not_reviewed' &&
    manifest?.sources?.three_globe?.texture_production_use_approved === false,
  'Package inclusion is provenance only; CT-45 must preserve absent texture-rights review and production approval.');
  const geometry = manifest?.assets?.find?.(asset => asset.id === 'country-geometry');
  check('geometry-rights-and-limits', /public domain/i.test(geometry?.rights_basis || '') && geometry?.rights_review_status === 'not_reviewed' && geometry?.production_use_approved === false &&
    Object.entries(EXPECTED_NATURAL_EARTH_SOURCES).every(([key, value]) => manifest?.sources?.natural_earth?.[key] === value) &&
    manifest?.runtime_boundary?.geometry_is_navigational_only === true && manifest?.runtime_boundary?.sovereignty_judgment === false && manifest?.runtime_boundary?.climate_performance_judgment === false &&
    /de-facto and disputed-boundary/.test(manifest?.runtime_boundary?.limitation || ''),
  'Natural Earth public-domain provenance must retain generalized/disputed-boundary limits without manufacturing human approval.');
  check('runtime-rights-release-blocked', manifest?.rights_review_status === 'not_reviewed' &&
    manifest?.third_party_notices_review_status === 'not_reviewed' &&
    manifest?.production_use_approved === false && manifest?.release_authority === false,
    'The runtime-asset candidate must explicitly remain blocked on rights/notices review, production use, and release authority.');
  check('small-nation-point-boundary', exactNavigationPoints(input?.navigation_points) &&
    manifest?.navigation_points?.count === 28 && manifest?.navigation_points?.source_status === 'manually_curated_approximate_points' &&
    manifest?.navigation_points?.source_path === 'data/small-nations.json' &&
    manifest?.navigation_points?.source_sha256 === '81086c45ee1a2d10a2859c2bdd1737db4e74be8f50aaad037307dda44cfe670a' &&
    input?.navigation_source?.sha256 === manifest?.navigation_points?.source_sha256 &&
    input?.navigation_source?.meta?.count === 28 && Array.isArray(input?.navigation_source?.points) &&
    input.navigation_source.points.length === 28 &&
    input.navigation_source.points.every((point, index) => point.iso === EXPECTED_SMALL_NATION_POINTS[index][0] && point.lat === EXPECTED_SMALL_NATION_POINTS[index][1] && point.lng === EXPECTED_SMALL_NATION_POINTS[index][2]) &&
    /candidate registry entity name keyed by ISO/.test(manifest?.navigation_points?.display_name_authority || '') &&
    manifest?.navigation_points?.review_status === 'not_reviewed' && manifest?.navigation_points?.production_use_approved === false &&
    /not Natural Earth geometry/.test(manifest?.navigation_points?.limitation || '') &&
    globe.includes('Approximate navigation point; not a boundary or precise centroid.') &&
    index.includes('Twenty-eight small states absent from that dataset use manually curated approximate navigation points'),
    'Exactly 28 unique, finite, range-valid point affordances must retain source/review/approval and visible representation limits.');
  check('canonical-evidence-headings', globe.includes('const country = climate?.name || mapArea;') &&
    globe.includes('Map geometry label: ') && globe.includes('. Evidence entity: '),
    'Assessed card headings must use canonical candidate entity names and disclose any differing map-geometry label.');
  check('disputed-subfeatures-nonassessing', globe.includes('NON_ASSESSING_MAP_AREAS') &&
    globe.includes("'Northern Cyprus'") && globe.includes("'Somaliland'") && globe.includes("'Kosovo'") &&
    globe.includes("feature.properties.ISO_A2 !== 'AQ' && !_isNonAssessingMapArea(feature)") &&
    !globe.includes("'Northern Cyprus': 'CYP'") && !globe.includes("Somaliland: 'SOM'") &&
    index.includes('excluded from the assessed overlay and never inherit a parent entity’s evidence'),
    'Disputed Natural Earth subfeatures must be noninteractive and must never inherit Cyprus or Somalia evidence.');
  check('complete-evidence-browser', index.includes('Browse all 249 evidence records') &&
    index.includes('aria-label="Browse all 249 evidence records"') && index.includes('browse-label-short') &&
    globe.includes("evidence_browse_requested: 'All 249 registry entities") &&
    globe.includes("stableReason === 'evidence_browse_requested'") &&
    app.includes("browseEvidence: () => this.browseEvidence()") &&
    app.includes("GlobeModule._initialized !== true") && app.includes("querySelectorAll('canvas').length !== 1") &&
    globe.includes("this._fallbackEntries.length + ' registry entities") &&
    globe.includes("factualCount") && globe.includes("gapCount") &&
    globe.includes("if (name === 'close')") && globe.includes('const hasLiveRenderer = this._initialized === true') &&
    files.globe_css?.includes('body.globe-fallback-active #globe-evidence-browse'),
    'A first-class, searchable 249-entity evidence browser must remain reachable from a live globe and unable to hide a genuine failure.');

  check('runtime-local-only', exactRuntimeConfig(input?.runtime_config),
    'Runtime geometry and textures must use only the committed same-origin files.');
  check('strong-geometry-validation', globe.includes('COUNTRY_GEOJSON_FEATURE_COUNT = 177') && globe.includes("payload.type !== 'FeatureCollection'") && globe.includes("feature?.type !== 'Feature'") && globe.includes("requiredStrings = ['ISO_A2', 'ISO_A3', 'ADMIN', 'NAME']") && globe.includes("geometry.type === 'Polygon'") && globe.includes("geometry.type === 'MultiPolygon'"),
    'Runtime preparation must validate the exact FeatureCollection count, identities, and Polygon/MultiPolygon coordinate shapes.');
  check('geometry-fetch-timeout', globe.includes('COUNTRY_GEOJSON_TIMEOUT_MS = 8000') &&
    globe.includes('Promise.race([request, timeout])') && globe.includes('controller?.abort()'),
    'Geometry body parsing must have a deterministic timeout even when AbortController is unavailable.');
  check('visual-preload-validation', globe.includes('Promise.all(Object.values(GLOBE_VISUAL_ASSETS)') && globe.includes('image.naturalWidth !== asset.width') && globe.includes('image.naturalHeight !== asset.height') && globe.includes('GLOBE_VISUAL_ASSET_TIMEOUT_MS = 8000'),
    'Every globe image must preload with timeout and exact natural dimensions.');
  check('candidate-fail-closed', data.includes("climateCandidateState = 'unavailable'") && data.includes('countries.length === 249') && data.includes('factualCount === 206') && data.includes('gapCount === 43') && data.includes('new Set(isoCodes).size === countries.length') && data.includes("CLIMATE_CANDIDATE_SHA256 = '7f002bc18396d827179cef0a3dda5bb83c3a1538dd6beffd6e4b80c2f7583664'") && data.includes('if (actual !== CLIMATE_CANDIDATE_SHA256)') && data.includes("crypto.subtle.digest('SHA-256'") && data.includes('DATA_FETCH_TIMEOUT_MS = 8000') && app.includes("reason: 'globe_construction_failed'") && globe.includes("'candidate_data_unavailable'"),
    'Missing or malformed candidate data must become a deterministic unavailable state before rendering.');
  check('exact-interactive-boundary', globe.includes('EXPECTED_INTERACTIVE_ENTITY_COUNT = 201') &&
    globe.includes('EXPECTED_INTERACTIVE_FACTUAL_COUNT = 194') && globe.includes('EXPECTED_INTERACTIVE_GAP_COUNT = 7') &&
    globe.includes('this._countryFeatures.length !== EXPECTED_INTERACTIVE_ENTITY_COUNT') &&
    globe.includes('uniqueFeatureIsos.size !== EXPECTED_INTERACTIVE_ENTITY_COUNT') &&
    globe.includes('uniqueDeckIsos.size !== EXPECTED_INTERACTIVE_ENTITY_COUNT') && globe.includes('!setsMatch'),
    'The rendered feature set and evidence deck must be the same 201 unique registry ISOs with exactly 194 factual and 7 gap records.');
  check('stable-preparation-failures', ['candidate_data_unavailable', 'country_geometry_unavailable', 'visual_assets_unavailable'].every(reason => occurrences(globe, reason) >= 2) && app.includes("safeCall('GlobeModule', 'showFallback', reason)"),
    'Candidate, geometry, and image failures must route to stable accessible fallback reasons.');
  const prepareCall = app.indexOf('preparation = await GlobeModule.prepare(');
  const vendorCall = app.indexOf('await loadGlobeGL();');
  const initCall = app.indexOf('GlobeModule._initialized = GlobeModule.init() === true;');
  check('prepare-before-renderer', prepareCall !== -1 && vendorCall > prepareCall && initCall > vendorCall,
    'Critical candidate, geometry, and images must prepare before the vendor is loaded or a renderer is initialized.');
  const deckActivation = globe.indexOf('this._renderRankRail();');
  check('render-ready-after-deck', deckActivation !== -1 && globe.indexOf("EventBus.emit('globe:render-ready'") > deckActivation && globe.indexOf("EventBus.emit('globe:country-data-ready'") > deckActivation,
    'Readiness events must follow prepared country-deck activation.');
  check('retry-single-renderer', app.includes("safeCall('GlobeModule', 'teardownFailedRenderer')") && app.includes('forcePrepare: true, reloadCandidate: true') && globe.includes('this._canvasDragGuardBound = false') && globe.includes("if (!this._canvasEl) throw new Error('Prepared renderer did not expose a canvas')"),
    'Retry must tear down stale renderer state, force revalidation, and retain a single canvas/listener set.');
  check('explicit-renderer-state', globe.includes('const GlobeModule = {\n  _initialized: false,'),
    'GlobeModule must expose an explicit false renderer invariant before the first preparation attempt.');
  check('activation-cancellation', app.includes('const activationAttempt = ++this._globeActivationAttempt;') && occurrences(app, 'if (!isCurrentActivation()) return false;') >= 4 && app.includes('this._globeActivationAttempt += 1;'),
    'Leaving or superseding an asynchronous globe entry must invalidate every later renderer continuation.');
  check('preparation-rejection-recovery', globe.includes("this._failPreparation('globe_construction_failed', error)") && globe.includes('this._preparationPromise === promise') && globe.includes('this._preparationPromise = null;'),
    'Unexpected preparation rejection must fail closed and clear sticky promise state for a safe retry.');
  check('renderer-destructor', globe.includes("typeof this.world._destructor === 'function'") && globe.includes('destroyRenderer.call(this.world)'),
    'Retry teardown must invoke the globe.gl 2.46.1 Kapsule destructor when available.');
  const closeBrowserStart = globe.indexOf('closeEvidenceBrowser() {');
  const closeBrowserEnd = globe.indexOf('\n  setTheme(theme)', closeBrowserStart);
  const closeBrowserBody = closeBrowserStart === -1 || closeBrowserEnd === -1 ? '' : globe.slice(closeBrowserStart, closeBrowserEnd);
  check('guarded-renderer-loss', globe.includes("addEventListener('webglcontextlost', this._onCanvasWebGLContextLost)") &&
    occurrences(globe, "removeEventListener('webglcontextlost', this._onCanvasWebGLContextLost)") >= 2 &&
    closeBrowserBody.includes('this._teardownFailedRenderer();') && closeBrowserBody.includes("this.showFallback('globe_construction_failed')") &&
    globe.includes("this.showFallback('webgl_unavailable')"),
    'Evidence-browser return and WebGL context loss must tear down stale renderer state and expose a stable failure.');
  check('safe-error-reporting', !/console\.error\s*\(/.test(`${app}\n${data}\n${globe}`) && app.includes("reportError('GlobeModule.prepare()'") && globe.includes("reportWarn('GlobeModule'"),
    'Runtime failures must use the shared reportError/reportWarn utilities.');

  check('csp-minimized', index.includes("connect-src 'self';") && index.includes("img-src 'self' data:;") && !/raw\.githubusercontent\.com|api\.carbonmark\.com|cdn\.jsdelivr\.net/.test(index),
    'CSP and resource hints must not retain obsolete runtime origins or the unused Carbonmark permission.');
  check('visible-boundary-disclaimer', occurrences(index, 'not a sovereignty or performance judgment') >= 2 && index.includes('Map boundaries use generalized Natural Earth 1:110m geometry for navigation only.'),
    'Foundation, globe, and fallback surfaces must expose the navigational boundary limitation.');

  check('service-worker-epoch', sw.includes("const CACHE_NAME = 'elu-v29-ct42-runtime-assets';") && files.index.includes("navigator.serviceWorker.register('/sw.js?v=29-ct42-runtime-assets'"),
    'Service-worker code and registration must share the runtime-asset cache epoch.');
  const requiredCachePaths = ['/js/vendor/globe.gl.js', `/${MANIFEST_PATH}`, ...EXPECTED_ASSETS.map(asset => asset.runtime_url)];
  check('service-worker-required-assets', Array.isArray(input?.service_worker?.static_assets) &&
    requiredCachePaths.every(assetPath => input.service_worker.static_assets.filter(item => item === assetPath).length === 1) &&
    !input.service_worker.static_assets.some(item => /^https?:/i.test(item)),
    'The verified vendor, manifest, and all five localized assets must be precached exactly once.');
  check('service-worker-install-fails-closed', input?.service_worker?.install_rejects_on_add_all_failure === true,
    'A missing critical precache file must reject service-worker installation.');
  check('service-worker-index-key-coupling',
    JSON.stringify([...(input?.index_runtime_requests || [])].sort()) === JSON.stringify([...EXPECTED_INDEX_SW_KEYS].sort()) &&
    EXPECTED_INDEX_SW_KEYS.every(key => input?.service_worker?.static_assets?.filter(item => item === key).length === 1),
    'Every versioned CSS/JS request used by the globe entry path must have the exact same service-worker precache key.');
  check('service-worker-data-fallback', sw.includes("url.pathname.startsWith('/data/')") &&
    data.includes("version: 'ct42candidate1'") &&
    sw.includes("'/data/carbon-projects.json?v=ct42candidate1'") &&
    sw.includes("'/data/climate/runtime/country-factual-candidate.json?v=ct42candidate1'") &&
    occurrences(sw, 'caches.match(request)') >= 2 && !sw.includes('ignoreSearch'),
    'Runtime data remain network-first with exact versioned precache keys and exact-request fallback.');

  const stagedBuildCommand = 'node tools/check-globe-runtime-assets.js --staged "$DEPLOY_DIR"';
  const stagedBuildIndex = buildDeploy.indexOf(stagedBuildCommand);
  const afterStagedVerification = stagedBuildIndex === -1 ? '' : buildDeploy.slice(stagedBuildIndex + stagedBuildCommand.length);
  check('deploy-staged-verification', buildDeploy.split('\n').filter(line => line.trim() === stagedBuildCommand).length === 1 &&
    !/\|\|\s*true|;\s*true/.test(buildDeploy.slice(stagedBuildIndex, stagedBuildIndex + stagedBuildCommand.length + 40)) &&
    !/(?:^|\n)\s*(?:exit|return)\s+0(?:\s|$)/.test(buildDeploy) &&
    afterStagedVerification.split('\n').every(line => !line.trim() || line.trimStart().startsWith('#')),
    'Deployment staging must verify the exact copied asset bytes.');
  const releaseGuard = buildDeploy.indexOf('if [ "$DEPLOY_MODE" = "release" ]; then');
  const readinessCommand = buildDeploy.indexOf('node tools/check-climate-production-readiness.js --release');
  const stagingStart = buildDeploy.indexOf('mkdir -p "$DEPLOY_DIR"');
  check('deploy-release-boundary', releaseGuard !== -1 && readinessCommand > releaseGuard && stagingStart > readinessCommand &&
    occurrences(buildDeploy, 'node tools/check-climate-production-readiness.js --release') === 1 &&
    buildDeploy.includes('case "$DEPLOY_MODE" in') && buildDeploy.includes('candidate|release) ;;') &&
    buildDeploy.includes('if [ -n "${CF_PAGES_BRANCH:-}" ]; then') &&
    buildDeploy.includes('Conflicting build modes: CLI=$ARG_DEPLOY_MODE ELU_DEPLOY_MODE=$ENV_DEPLOY_MODE'),
    'Release mode must be explicit, strictly validated, forced for every externally reachable Cloudflare build, and pass readiness before staging starts.');
  check('deploy-failure-cleanup', input?.deploy_behavior?.denied_release_removed_output === true &&
    input?.deploy_behavior?.later_failure_removed_output === true &&
    input?.deploy_behavior?.unknown_environment_rejected === true &&
    input?.deploy_behavior?.conflicting_selectors_rejected === true &&
    input?.deploy_behavior?.cloudflare_preview_forces_release === true,
    'Denied releases, Cloudflare previews, later staging failures, unknown environment modes, and conflicting selectors must fail closed without a publishable output directory.');
  check('candidate-publication-marker', buildDeploy.includes('CANDIDATE-NOT-FOR-PUBLICATION.txt') &&
    buildDeploy.includes('LOCAL QA CANDIDATE — DO NOT PUBLISH') &&
    buildDeploy.includes('production_use_approved=false') && buildDeploy.includes('release_authority=false') &&
    buildDeploy.includes('Do not upload, deploy, or expose this candidate as a public preview.'),
    'Candidate staging must carry an explicit non-publication marker and never print public deployment instructions.');
  check('ci-policy-wired',
    hasActiveCiJob(ci, 'static') && hasActiveCiJob(ci, 'smoke') &&
    hasExactCiStep(ci, 'CT-45 localized runtime asset policy', 'node tools/check-globe-runtime-assets.js') &&
    hasExactCiStep(ci, 'Climate production readiness policy fixtures', 'node tools/check-climate-production-readiness-policy.js') &&
    hasExactCiStep(ci, 'Build candidate deploy directory', './tools/build-deploy.sh --candidate') &&
    hasExactCiStep(ci, 'Verify staged CT-45 bytes independently', 'node tools/check-globe-runtime-assets.js --staged _deploy'),
    'CI must enforce CT-45 source policy and independently verify staged deployment bytes.');
  const browserLifecycleStep = workflowStep(ci, 'Run SmokeTest + StackLint in headless Chromium');
  check('ci-browser-runtime-lifecycle', occurrences(ci, '- name: Run SmokeTest + StackLint in headless Chromium') === 1 && [
    "serviceWorkers: 'block'",
    "exercisePreRenderFailure('**/data/climate/runtime/country-factual-candidate.json*', 'candidate_data_unavailable'",
    "exercisePreRenderFailure('**/assets/globe/runtime/ne_110m_admin_0_countries.geojson*', 'country_geometry_unavailable'",
    "exercisePreRenderFailure('**/assets/globe/runtime/earth-night.jpg*', 'visual_assets_unavailable'",
    'stale async activation must not construct a renderer',
    'countryFeatureCount === 201',
    'browserCounts.factual === 206 && browserCounts.gaps === 43',
    "new Event('webglcontextlost', { cancelable: true })",
    'rendererCanvasCount === 0',
    'for (const width of [320, 375])',
    'rects.browse.height >= 44 && rects.theme.height >= 44',
    'if (!condition) throw new Error(message);',
    "document.querySelector('#globeViz canvas').dispatchEvent(new Event('webglcontextlost', { cancelable: true }))",
  ].every(token => browserLifecycleStep.includes(token)) &&
    !/continue-on-error:\s*true|\n\s*if:\s*false|assert\(true\s*\|\|/.test(browserLifecycleStep),
  'Headless CI must execute the real success, failure, cancellation, evidence-browser, renderer-loss/retry, and narrow-viewport lifecycle.');
  const truthComponent = "{ id: 'CT-45-ASSETS', script: 'tools/check-globe-runtime-assets.js', required: true }";
  check('truth-ci-required', climateTruthCi.split('\n').filter(line => line.trim().replace(/,$/, '') === truthComponent).length === 1,
    'Climate truth CI must require exactly one active CT-45 component.');

  check('ui-review-pin-scope', JSON.stringify(input?.review_scope?.ui_pins) === JSON.stringify(REQUIRED_UI_REVIEW_PIN_PATHS),
  'Independent UI review must pin the existing runtime scope plus SW, manifest, and all five committed assets.');
  check('runtime-diff-boundary', input?.review_scope?.runtime_prefixes?.includes('assets/globe/runtime/') &&
    ['tools/check-globe-runtime-assets.js', 'tools/lib/globe-runtime-assets.js', 'tools/fixtures/globe-runtime-assets.json', 'data/small-nations.json']
      .every(item => input?.review_scope?.runtime_fixed?.includes(item)),
    'Runtime-diff policy must classify localized assets and CT-45 controls as runtime-affecting.');
  check('control-files-owned', REQUIRED_CONTROL_OWNERS.every(required =>
    files.codeowners?.split('\n').some(line => line.trim().startsWith(required + ' ') && line.includes('@earth-love-united/maintainers'))),
  'CT-45 controls, localized assets, and point provenance must require maintainer review.');
  check('smoke-contract', ['runtime assets are prepared before renderer init', 'candidate_data_unavailable', 'country_geometry_unavailable', 'visual_assets_unavailable'].every(token => smoke.includes(token)),
    'SmokeTest must cover preparation state and all stable pre-render failure reasons.');
  check('credits-provenance-boundary', /globe runtime assets/i.test(files.credits || '') && /Package inclusion establishes byte provenance,\s+not production\s+image-rights clearance/.test(files.credits || '') && /not reviewed/i.test(files.credits || ''),
    'Credits must document exact localization while preserving the unresolved image-rights boundary.');
  check('architecture-and-production-docs', /preload and validate/i.test(files.architecture || '') && /CT-45/i.test(files.production_docs || '') && /does not grant texture rights/i.test(files.production_docs || ''),
    'Architecture and production docs must describe pre-render preparation and CT-45 non-authority.');

  const failures = checks.filter(item => !item.pass);
  const output = {
    policy_version: POLICY_VERSION,
    status: failures.length ? 'fail' : 'pass',
    asset_count: EXPECTED_ASSETS.length,
    checks,
    failure_ids: failures.map(item => item.id),
    rights_review_status: 'not_reviewed',
    production_use_approved: false,
    release_authority: false,
    calculation_hash: null,
  };
  output.calculation_hash = digest(output);
  return output;
}

module.exports = {
  EXPECTED_ASSETS,
  EXPECTED_INDEX_SW_KEYS,
  EXPECTED_MANIFEST_SEMANTIC_SHA256,
  EXPECTED_MANIFEST_SHA256,
  EXPECTED_SMALL_NATION_POINTS,
  MANIFEST_PATH,
  POLICY_VERSION,
  REQUIRED_UI_REVIEW_PIN_PATHS,
  digest,
  evaluateRuntimeAssets,
  exactAssetManifest,
  exactLocalAssets,
  exactNavigationPoints,
  exactRuntimeConfig,
  occurrences,
  stripComments,
  activeFailClosedStep,
  workflowStep,
};
