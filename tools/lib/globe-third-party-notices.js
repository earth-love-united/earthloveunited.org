'use strict';

const crypto = require('crypto');
const { hasActiveCiJob, hasExactCiStep, stripJsComments } = require('./globe-vendor-integrity');
const { EXPECTED_MANIFEST_SHA256: EXPECTED_RUNTIME_MANIFEST_SHA256 } = require('./globe-runtime-assets');
const {
  APPROVAL_PATH,
  EXPECTED_TRUST_REGISTRY_SHA256: EXPECTED_APPROVAL_TRUST_SHA256,
  SIGNATURE_BUNDLE_PATH: APPROVAL_SIGNATURE_BUNDLE_PATH,
  TRUST_REGISTRY_PATH: APPROVAL_TRUST_PATH,
  exactUnprovisionedTrust,
} = require('./globe-runtime-approval');

const POLICY_VERSION = '1.0.0';
const NOTICE_PATH = 'THIRD_PARTY_NOTICES.txt';
const MANIFEST_PATH = 'data/governance/vendor/globe-gl-2.46.1-notices.json';
const INTEGRATION_PATH = 'data/governance/vendor/globe-gl-2.46.1-notices-integration.json';
const APPROVAL_SCHEMA_PATH = 'data/climate/schemas/globe-runtime-assets-production-review.schema.json';
const EXPECTED_MANIFEST_SHA256 = '542e9bf2043f1c670200be9c9b0455b93048514dfb8b602301ca1245918660c2';
const EXPECTED_MANIFEST_CALCULATION_HASH = '5b671c6e7357d35863b5bcd390a976939a279adc230ae84d43a702566413a66d';
const EXPECTED_NOTICE_SHA256 = '741fc18dfd4b0916884cbad6b4dddd3466b7e2399186e5dcd7ff555e482fd0f2';
const EXPECTED_INTEGRATION_SHA256 = '5faec989558a53787fa4c75f70a544348add64516d4ebf1db18f0710905e393e';
const EXPECTED_INTEGRATION_CALCULATION_HASH = 'daa2de1dc17a991c3251ca3a5c7709bbba39081a70d1416de5872c927a3f85cf';
const EXPECTED_APPROVAL_SCHEMA_SHA256 = '4e5b5e6360b280da9055c72daa84e2a3644f308a80c3f4f4c6e24bb92b6447f2';

const EXPECTED_BUNDLE = Object.freeze({
  name: 'globe.gl',
  version: '2.46.1',
  destination: 'js/vendor/globe.gl.js',
  blob_sha256: '2ab6767f47e2be0ac346cd7a5eb55d259ea3da06d479dc22f1820ddd698f496a',
  npm_tarball_url: 'https://registry.npmjs.org/globe.gl/-/globe.gl-2.46.1.tgz',
  npm_integrity: 'sha512-h+OvX52EBIPLtM0/2JkM+JZ9gPAhPJ4y3+hxUwD5Ey/O0Zk2ockuTiJ71bZbnNBGmNiIZzA5Vr3TMT0b3d35IQ==',
  npm_tarball_sha256: '8cf3f50af6c749d14718f6d8aee6ea0239831cd18af5de20198fbada5f188c9c',
  release_git_head: 'd0c8616306555b8dd09801fb7c34c80927159f05',
  release_lockfile_sha256: 'e2d4f42ff6b232884cdf51ca91d016f8a7df101f51b5b7757d212f342f88285c',
  source_map_url: 'https://cdn.jsdelivr.net/npm/globe.gl@2.46.1/dist/globe.gl.js.map',
  source_map_sha256: 'b5ce8d837207c289890ce40ca6dba4cdb1b417bfcb54ba53e1928e27702de800'
});

const EXPECTED_SOURCE_INVENTORY = Object.freeze({
  source_map_source_count: 225,
  root_source_count: 2,
  third_party_source_count: 223,
  source_mapped_package_count: 37,
  source_content_match_count: 223,
  source_content_mismatch_count: 0
});

const EXPECTED_COMPONENT_ROWS = Object.freeze([
  ['npm:globe.gl@2.46.1', 'globe.gl', '2.46.1', 'root_composite_package', 'MIT', 0],
  ['npm:@babel/runtime@7.29.2', '@babel/runtime', '7.29.2', 'source_mapped_dependency', 'MIT', 9],
  ['npm:@turf/boolean-point-in-polygon@7.3.4', '@turf/boolean-point-in-polygon', '7.3.4', 'source_mapped_dependency', 'MIT', 1],
  ['npm:@turf/invariant@7.3.4', '@turf/invariant', '7.3.4', 'source_mapped_dependency', 'MIT', 1],
  ['npm:@tweenjs/tween.js@25.0.0', '@tweenjs/tween.js', '25.0.0', 'source_mapped_dependency', 'MIT', 1],
  ['npm:accessor-fn@1.5.3', 'accessor-fn', '1.5.3', 'source_mapped_dependency', 'MIT', 1],
  ['npm:d3-array@3.2.4', 'd3-array', '3.2.4', 'source_mapped_dependency', 'ISC', 13],
  ['npm:d3-color@3.1.0', 'd3-color', '3.1.0', 'source_mapped_dependency', 'ISC', 2],
  ['npm:d3-delaunay@6.0.4', 'd3-delaunay', '6.0.4', 'source_mapped_dependency', 'ISC', 4],
  ['npm:d3-format@3.1.2', 'd3-format', '3.1.2', 'source_mapped_dependency', 'ISC', 15],
  ['npm:d3-geo@3.1.1', 'd3-geo', '3.1.1', 'source_mapped_dependency', 'ISC', 33],
  ['npm:d3-geo-voronoi@2.1.0', 'd3-geo-voronoi', '2.1.0', 'source_mapped_dependency', 'ISC', 4],
  ['npm:d3-interpolate@3.0.1', 'd3-interpolate', '3.0.1', 'source_mapped_dependency', 'ISC', 11],
  ['npm:d3-octree@1.1.0', 'd3-octree', '1.1.0', 'source_mapped_dependency', 'MIT', 16],
  ['npm:d3-scale@4.0.2', 'd3-scale', '4.0.2', 'source_mapped_dependency', 'ISC', 7],
  ['npm:d3-scale-chromatic@3.1.0', 'd3-scale-chromatic', '3.1.0', 'source_mapped_dependency', 'ISC', 1],
  ['npm:d3-selection@3.0.0', 'd3-selection', '3.0.0', 'source_mapped_dependency', 'ISC', 48],
  ['npm:data-bind-mapper@1.0.3', 'data-bind-mapper', '1.0.3', 'source_mapped_dependency', 'MIT', 1],
  ['npm:delaunator@5.1.0', 'delaunator', '5.1.0', 'source_mapped_dependency', 'ISC', 1],
  ['npm:earcut@3.0.2', 'earcut', '3.0.2', 'source_mapped_dependency', 'ISC', 1],
  ['npm:float-tooltip@1.7.5', 'float-tooltip', '1.7.5', 'source_mapped_dependency', 'MIT', 1],
  ['npm:frame-ticker@1.0.3', 'frame-ticker', '1.0.3', 'source_mapped_dependency', 'MIT', 1],
  ['npm:h3-js@4.4.0', 'h3-js', '4.4.0', 'source_mapped_dependency', 'Apache-2.0', 1],
  ['npm:index-array-by@1.4.2', 'index-array-by', '1.4.2', 'source_mapped_dependency', 'MIT', 1],
  ['npm:kapsule@1.16.3', 'kapsule', '1.16.3', 'source_mapped_dependency', 'MIT', 1],
  ['npm:lodash-es@4.18.1', 'lodash-es', '4.18.1', 'source_mapped_dependency', 'MIT', 14],
  ['npm:point-in-polygon-hao@1.2.4', 'point-in-polygon-hao', '1.2.4', 'source_mapped_dependency', 'MIT', 1],
  ['npm:polished@4.3.1', 'polished', '4.3.1', 'source_mapped_dependency', 'MIT', 1],
  ['npm:preact@10.29.1', 'preact', '10.29.1', 'source_mapped_dependency', 'MIT', 1],
  ['npm:robust-predicates@3.0.3', 'robust-predicates', '3.0.3', 'source_mapped_dependency', 'Unlicense', 2],
  ['npm:style-inject@0.3.0', 'style-inject', '0.3.0', 'source_mapped_dependency', 'MIT', 1],
  ['npm:three@0.183.2', 'three', '0.183.2', 'source_mapped_dependency', 'MIT', 22],
  ['npm:three-conic-polygon-geometry@2.1.2', 'three-conic-polygon-geometry', '2.1.2', 'source_mapped_dependency', 'MIT', 1],
  ['npm:three-geojson-geometry@2.1.1', 'three-geojson-geometry', '2.1.1', 'source_mapped_dependency', 'MIT', 1],
  ['npm:three-globe@2.45.2', 'three-globe', '2.45.2', 'source_mapped_dependency', 'MIT', 1],
  ['npm:three-render-objects@1.41.0', 'three-render-objects', '1.41.0', 'source_mapped_dependency', 'MIT', 1],
  ['npm:three-slippy-map-globe@1.0.6', 'three-slippy-map-globe', '1.0.6', 'source_mapped_dependency', 'MIT', 1],
  ['npm:tinycolor2@1.6.0', 'tinycolor2', '1.6.0', 'source_mapped_dependency', 'MIT', 1],
  ['embedded:h3-core@4.4.1', 'H3 core', '4.4.1', 'embedded_compiled_core', 'Apache-2.0', 0],
  ['attribution:dggrid@2015', 'DGGRID attribution', '2015', 'h3_attribution_notice', 'attribution-only', 0],
  ['embedded:@babel/helpers@7.29.2:regenerator', '@babel/helpers', '7.29.2', 'embedded_generated_helper', 'MIT', 0],
  ['embedded:helvetiker-regular@2004', 'Helvetiker Regular typeface', '1.00 (2004)', 'embedded_font_data', 'LicenseRef-MgOpen-MAGENTA-2004', 0],
  ['toolchain:emscripten@1.38.43', 'Emscripten', '1.38.43', 'conservative_generated_runtime_notice', 'MIT OR NCSA', 0],
  ['linked:musl@emscripten-1.38.43', 'musl libc notice corpus', 'Emscripten 1.38.43 snapshot', 'conservative_linked_runtime_notice', 'MIT and permissive subcomponent terms', 0]
]);

const EXPECTED_COMPONENTS = Object.freeze(Object.fromEntries(EXPECTED_COMPONENT_ROWS.map(function (row) {
  return [row[0], {
    name: row[1],
    version: row[2],
    component_role: row[3],
    licence_expression: row[4],
    source_map_source_count: row[5]
  }];
})));

const EXPECTED_NOTICE_ROWS = Object.freeze([
  ['attribution-114bd21151f748d5', '114bd21151f748d53ee6fe3a99433a6977cd9462f4a2c33e616fc9d0f0df7362'],
  ['font-embedded-license-7f7bfa942d72048b', '7f7bfa942d72048b702278c907ffe873a86b4ee5739e96dc271d2e63a1fe3fd1'],
  ['font-license-35e8279356d78908', '35e8279356d7890871c4fce804d157e3f21456a7311ef2caab5cb4705c71b6bd'],
  ['linked-runtime-notice-70ca142d257e2690', '70ca142d257e2690a1f8eda8a296e64a6d1b16d8aee6784f8ddcf67f3163635d'],
  ['package-license-07e7bf38169a0e26', '07e7bf38169a0e26e088a0a6e6ba7f60704b2d0442c4433044169924c68ba732'],
  ['package-license-0986d93944902cca', '0986d93944902cca9af86824b6a641b4b7c2d10602fc510c433a8bcd443919fe'],
  ['package-license-0b348fff56384b43', '0b348fff56384b43dbb37593906904e56d0f9deb51eae590d4dc6d427fbf1808'],
  ['package-license-117da2af0d4ce0fe', '117da2af0d4ce0fe1c8e19b5cff9dcd806adf973d328d27b11d4448c4ff24f76'],
  ['package-license-1fe6958409c8c257', '1fe6958409c8c257a70c587a18b6f7f412b179b456630790d30b2ec9a8e4b7d4'],
  ['package-license-2a6d2d5f32ba0b75', '2a6d2d5f32ba0b755ddbc1c833f766e30cdbe6ebe9a6d4e3e24427721f0b63d3'],
  ['package-license-324139c19d87af03', '324139c19d87af03fda38afea1590e00ca354c4159bdb2ae9e9cec070cfa46a8'],
  ['package-license-3e3edc1224eec9c3', '3e3edc1224eec9c39cd26491a21304a62883c1e5b6a65c5283ccc7a6cc94baee'],
  ['package-license-3e6849627f74ff73', '3e6849627f74ff73c257a3ae1efb574015d94fc1035c05ec3c15805165efcbc4'],
  ['package-license-4be9d87b56a30629', '4be9d87b56a306293223b490c0d0b245e9e94f39884147bf051a6c7b825aeb30'],
  ['package-license-529623055bb0365b', '529623055bb0365be40016e9776f6088115ca8b06a5fb7dae79509dcbbd6e608'],
  ['package-license-582c3022bd019423', '582c3022bd01942336095f92b58a90b1be624dc547d987555c6c956512dd24c1'],
  ['package-license-5b2b65f93264110b', '5b2b65f93264110b31282765de411acebf50303c0021ebdb44374739e0892fd0'],
  ['package-license-5b6dc9ce44c7b736', '5b6dc9ce44c7b73620b191c567339212bd00537af46fdedaf98304c34214cc9c'],
  ['package-license-671e164460e3edbb', '671e164460e3edbb93c0e22813d45dd37c1c643c6a7cbddde0f70c8914aab294'],
  ['package-license-7262e566e874d1ce', '7262e566e874d1ce8cfadace01d4f635f8d704b6bdf7b4345cc028e5faeafded'],
  ['package-license-88d9b4eb60579c19', '88d9b4eb60579c191ec391ca04c16130572d7eedc4a86daa58bf28c6e14c9bcd'],
  ['package-license-8b378ebe60e2fe50', '8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc'],
  ['package-license-a95799aea6b1548b', 'a95799aea6b1548b76f2a941dd9eaa8f1fe9aa3c348759ab0ee1217787b979d2'],
  ['package-license-bbba7cb786b64e6b', 'bbba7cb786b64e6b7f9d7cb6dacae5c78898752f7c60d3fc04c13ca67e4dc7f2'],
  ['package-license-bcd7e82c06802eec', 'bcd7e82c06802eecb0f0792ffd591bd82da3be813bcb8f55bcdf969334dab1d2'],
  ['package-license-c633a0da18abe420', 'c633a0da18abe4208665d9faf574f38084bbe38ce5bf743e9ecc06e50b941b59'],
  ['package-license-c71d239df91726fc', 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4'],
  ['package-license-c95fecd88f2709bf', 'c95fecd88f2709bfc34e4d1f1ccc36d17048990e6ba26c283cfecdef0432936b'],
  ['package-license-dd31f241bc0636dc', 'dd31f241bc0636dc4dda365fc8dac04cabbf70cb4fdb1ca23c64f1b630ad7b4d'],
  ['package-license-e008c5e25a6be382', 'e008c5e25a6be382593089c29bfabbc553c6378eee02895aec46ce396cc404ee'],
  ['package-license-f71e8ed126b46346', 'f71e8ed126b46346494aad5486874cd8f0aafe95092ed67d2e3cb6110f939abc'],
  ['package-license-f9b32b82fd5a1d3a', 'f9b32b82fd5a1d3a990526d86da97f42fb805d9f4d9f978125c4679b674fce44'],
  ['package-license-faa682e3e430941f', 'faa682e3e430941f958d26180458f5934a62f58dac4d70ccdd15608c15d0f884'],
  ['package-notice-aa869183968dc017', 'aa869183968dc0173cd1c218e19ec0249e6a18f3bf3e4b52538365715796f04c'],
  ['toolchain-license-51aea7641f81d560', '51aea7641f81d560eb039bc97ce35e2517e2656fe8731eb49ce6a18498eb22fe']
]);

const EXPECTED_NOTICE_HASHES = Object.freeze(Object.fromEntries(EXPECTED_NOTICE_ROWS));

const EXPECTED_COUNSEL_QUESTIONS = Object.freeze([
  'Does the unmodified Helvetiker JSON satisfy the MAGENTA/MgOpen notice, naming, modification and no-standalone-sale conditions when distributed inside the site bundle?',
  'Is Unlicense acceptable in every jurisdiction in which the foundation distributes the site, including jurisdictions that may not recognize public-domain dedication?',
  'Does including the complete Emscripten 1.38.43 and musl notice corpora fully satisfy any obligations arising from generated or linked runtime code inside h3-js?',
  'Does the H3 treatment require any notice beyond the full Apache-2.0 licence, H3 NOTICE, and DGGRID attribution recorded here?'
]);

const EXPECTED_ASSET_RIGHTS_ROWS = Object.freeze([
  Object.freeze({
    asset_id: 'country-geometry',
    path: 'assets/globe/runtime/ne_110m_admin_0_countries.geojson',
    sha256: 'a4d67eac9c75d5b6f20170d2b07bb53ea791536b0c8e5ebae3ba94df093f76e0',
    source_url: 'https://cdn.jsdelivr.net/npm/globe.gl@2.46.1/example/datasets/ne_110m_admin_0_countries.geojson',
    source_path: null,
    source_asset_id: 'ne_110m_admin_0_countries.geojson',
    source_type: 'third_party_package_asset',
    origin_evidence_status: 'primary_terms_identified_review_pending'
  }),
  Object.freeze({
    asset_id: 'earth-night',
    path: 'assets/globe/runtime/earth-night.jpg',
    sha256: '373e5a08c9f378a2ce6320214a613148e4b1e3946b3f39a516c9093b76cb7124',
    source_url: 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg',
    source_path: null,
    source_asset_id: 'dnb_land_ocean_ice.2012.3600x1800.jpg',
    source_type: 'official_publisher_asset',
    origin_evidence_status: 'official_nasa_source_pinned_review_pending'
  }),
  Object.freeze({
    asset_id: 'night-sky',
    path: 'assets/globe/runtime/night-sky.svg',
    sha256: '233713fa6ed8a495ed49deb97b89f46228aa49a83460e1379a60b3cee57c5688',
    source_url: null,
    source_path: 'tools/authoring/generate-globe-starfield.js',
    source_asset_id: 'elu-night-sky-v1',
    source_type: 'repo_authored_original',
    origin_evidence_status: 'repo_authored_original_review_pending'
  }),
  Object.freeze({
    asset_id: 'earth-blue-marble',
    path: 'assets/globe/runtime/earth-blue-marble.jpg',
    sha256: '228deba2e4b600146bdcb6cfa359b8ead6aacc2b1c13550a29cd82824cfa1c01',
    source_url: 'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-blue-marble.jpg',
    source_path: null,
    source_asset_id: 'earth-blue-marble.jpg',
    source_type: 'third_party_package_asset',
    origin_evidence_status: 'package_provenance_only_nasa_trace_unreviewed'
  }),
  Object.freeze({
    asset_id: 'earth-topology',
    path: 'assets/globe/runtime/earth-topology.png',
    sha256: '839b12da2e4dd346b256cebae72e10c479a102c8980a22084c41275e4b9a0e12',
    source_url: 'https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-topology.png',
    source_path: null,
    source_asset_id: 'earth-topology.png',
    source_type: 'third_party_package_asset',
    origin_evidence_status: 'package_provenance_only_gebco_trace_unreviewed'
  })
]);

const REQUIRED_INTEGRATION_OWNERS = Object.freeze([
  '/THIRD_PARTY_NOTICES.txt',
  '/' + MANIFEST_PATH,
  '/' + INTEGRATION_PATH,
  '/' + APPROVAL_SCHEMA_PATH,
  '/' + APPROVAL_PATH,
  '/' + APPROVAL_TRUST_PATH,
  '/' + APPROVAL_SIGNATURE_BUNDLE_PATH,
  '/tools/check-globe-third-party-notices.js',
  '/tools/lib/globe-third-party-notices.js',
  '/tools/fixtures/globe-third-party-notices.json',
  '/tools/check-globe-runtime-approval.js',
  '/tools/lib/globe-runtime-approval.js',
  '/tools/check-staged-production-integrity.js',
  '/tools/build-deploy.sh',
  '/tools/climate-truth-ci.js'
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce(function (result, key) {
    result[key] = stable(value[key]);
    return result;
  }, {});
}

function calculationHash(manifest) {
  const copy = JSON.parse(JSON.stringify(manifest));
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function parseNoticeFile(text) {
  const sections = new Map();
  const errors = [];
  const beginPattern = /^----- BEGIN NOTICE ([^\s]+) -----\n/gm;
  const endPattern = /^----- END NOTICE ([^\s]+) -----$/gm;
  let match;

  while ((match = beginPattern.exec(text)) !== null) {
    const noticeId = match[1];
    const payloadStart = beginPattern.lastIndex;
    const endMarker = '----- END NOTICE ' + noticeId + ' -----';
    const payloadEnd = text.indexOf(endMarker, payloadStart);

    if (payloadEnd === -1) {
      errors.push('Missing end marker for ' + noticeId);
      continue;
    }
    if (sections.has(noticeId)) {
      errors.push('Duplicate begin marker for ' + noticeId);
      continue;
    }

    const payload = text.slice(payloadStart, payloadEnd);
    sections.set(noticeId, {
      notice_id: noticeId,
      payload: payload,
      payload_sha256: sha256(payload)
    });
  }

  const endIds = [];
  while ((match = endPattern.exec(text)) !== null) endIds.push(match[1]);
  endIds.forEach(function (noticeId) {
    if (!sections.has(noticeId)) errors.push('Orphan end marker for ' + noticeId);
  });
  if (endIds.length !== sections.size) {
    errors.push('Begin/end marker count mismatch');
  }

  return { sections: sections, errors: errors };
}

function sameValue(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function findUrlFields(value, path, results) {
  if (Array.isArray(value)) {
    value.forEach(function (item, index) {
      findUrlFields(item, path + '[' + index + ']', results);
    });
    return results;
  }
  if (!value || typeof value !== 'object') return results;
  Object.keys(value).forEach(function (key) {
    const childPath = path ? path + '.' + key : key;
    if (/_url$/.test(key) && typeof value[key] === 'string') {
      results.push({ path: childPath, value: value[key] });
    }
    findUrlFields(value[key], childPath, results);
  });
  return results;
}

function findInventedAuthority(value, path, findings) {
  if (Array.isArray(value)) {
    value.forEach(function (item, index) {
      findInventedAuthority(item, path + '[' + index + ']', findings);
    });
    return findings;
  }
  if (!value || typeof value !== 'object') return findings;

  Object.keys(value).forEach(function (key) {
    const childPath = path ? path + '.' + key : key;
    const child = value[key];
    if ((/approved$/.test(key) || /authority$/.test(key) || key === 'counsel_review_complete') && child === true) {
      findings.push(childPath + '=true');
    }
    if (/^(reviewer_id|reviewer_role|reviewed_at|decision_id|decision|decision_at|decision_by)$/.test(key) && child !== null) {
      findings.push(childPath + '=' + JSON.stringify(child));
    }
    if (key === 'review_status' && child !== 'not_reviewed') {
      findings.push(childPath + '=' + JSON.stringify(child));
    }
    findInventedAuthority(child, childPath, findings);
  });
  return findings;
}

function evaluateThirdPartyNotices(input) {
  const manifest = input.manifest;
  const manifestText = input.manifestText;
  const noticeText = input.noticeText;
  const checks = [];
  const failures = [];

  function check(condition, id, message, details) {
    const result = { id: id, pass: Boolean(condition), message: message };
    if (details !== undefined) result.details = details;
    checks.push(result);
    if (!condition) failures.push(result);
  }

  check(
    manifest.schema_version === POLICY_VERSION &&
      manifest.artifact_id === 'globe-gl-2.46.1-third-party-notices-2026-07-15' &&
      manifest.status === 'not_reviewed',
    'artifact_identity',
    'The manifest has the pinned schema, artifact identity, and not-reviewed status.'
  );

  check(
    sha256(manifestText) === EXPECTED_MANIFEST_SHA256,
    'manifest_file_sha256',
    'The manifest bytes match the audited evidence artifact.',
    { expected: EXPECTED_MANIFEST_SHA256, actual: sha256(manifestText) }
  );

  check(
    manifest.calculation_hash === EXPECTED_MANIFEST_CALCULATION_HASH &&
      calculationHash(manifest) === EXPECTED_MANIFEST_CALCULATION_HASH,
    'manifest_calculation_hash',
    'The canonical manifest calculation hash is valid and pinned.',
    {
      expected: EXPECTED_MANIFEST_CALCULATION_HASH,
      recorded: manifest.calculation_hash,
      actual: calculationHash(manifest)
    }
  );

  check(
    Object.keys(EXPECTED_BUNDLE).every(function (key) {
      return manifest.bundle && manifest.bundle[key] === EXPECTED_BUNDLE[key];
    }),
    'bundle_identity',
    'The bundle blob, release, tarball, lockfile, and source-map pins match the audit.'
  );

  check(
    Object.keys(EXPECTED_SOURCE_INVENTORY).every(function (key) {
      return manifest.source_inventory && manifest.source_inventory[key] === EXPECTED_SOURCE_INVENTORY[key];
    }),
    'source_inventory',
    'The 225-source / 223-third-party / 37-package source-map inventory is complete.'
  );

  const rights = manifest.rights_review || {};
  const nullDecisionFields = [
    'reviewer_id',
    'reviewer_role',
    'reviewed_at',
    'decision_id',
    'decision',
    'decision_at',
    'decision_by',
    'notes'
  ];
  const falseApprovalFields = [
    'notices_approved',
    'redistribution_approved',
    'commercial_use_approved',
    'production_approved',
    'release_approved',
    'counsel_review_complete'
  ];
  check(
    rights.review_status === 'not_reviewed' &&
      nullDecisionFields.every(function (key) { return rights[key] === null; }) &&
      falseApprovalFields.every(function (key) { return rights[key] === false; }),
    'rights_review_boundary',
    'No reviewer, decision, approval, production, or release authority is invented.'
  );

  const governance = manifest.governance_boundary || {};
  check(
    [
      'rights_decision_made',
      'production_authority',
      'release_authority',
      'runtime_modified',
      'deployment_modified',
      'public_ui_modified'
    ].every(function (key) { return governance[key] === false; }),
    'governance_boundary',
    'The evidence artifact grants no authority and records no runtime or deployment mutation.'
  );

  const inventedAuthority = findInventedAuthority(manifest, '', []);
  check(
    inventedAuthority.length === 0,
    'invented_authority',
    'Recursive approval and decision fields contain no invented authority.',
    inventedAuthority
  );

  const components = Array.isArray(manifest.components) ? manifest.components : [];
  const componentIds = components.map(function (component) { return component.component_id; });
  const uniqueComponentIds = new Set(componentIds);
  const expectedComponentIds = Object.keys(EXPECTED_COMPONENTS);
  check(
    manifest.component_count === 44 &&
      components.length === 44 &&
      uniqueComponentIds.size === 44 &&
      expectedComponentIds.every(function (id) { return uniqueComponentIds.has(id); }) &&
      componentIds.every(function (id) { return Object.prototype.hasOwnProperty.call(EXPECTED_COMPONENTS, id); }),
    'component_inventory',
    'The manifest contains exactly the audited 44-component inventory with no duplicates.'
  );

  const componentMismatches = [];
  components.forEach(function (component) {
    const expected = EXPECTED_COMPONENTS[component.component_id];
    if (!expected) return;
    Object.keys(expected).forEach(function (key) {
      if (component[key] !== expected[key]) {
        componentMismatches.push(component.component_id + '.' + key);
      }
    });
    if (component.review_required !== true) {
      componentMismatches.push(component.component_id + '.review_required');
    }
  });
  check(
    componentMismatches.length === 0,
    'component_metadata',
    'Every component has the audited name, version, role, licence, source count, and review requirement.',
    componentMismatches
  );

  const sourceMapped = components.filter(function (component) {
    return component.component_role === 'source_mapped_dependency';
  });
  const licenceCounts = sourceMapped.reduce(function (counts, component) {
    counts[component.licence_expression] = (counts[component.licence_expression] || 0) + 1;
    return counts;
  }, {});
  check(
    sourceMapped.length === 37 &&
      sourceMapped.reduce(function (total, component) { return total + component.source_map_source_count; }, 0) === 223 &&
      sameValue(licenceCounts, { MIT: 23, ISC: 12, 'Apache-2.0': 1, Unlicense: 1 }),
    'source_mapped_distribution',
    'The 37 source-mapped packages account for all 223 third-party sources and the audited licence distribution.'
  );

  const urlFindings = findUrlFields(manifest, '', []).filter(function (entry) {
    return !entry.value.startsWith('https://') ||
      entry.value.startsWith('https://github.com/') && /\.git(?:$|#)/.test(entry.value) ||
      /\/(?:main|master)(?:\/|$)/.test(entry.value);
  });
  check(
    urlFindings.length === 0,
    'source_urls',
    'All recorded source URLs use HTTPS and avoid mutable default-branch references.',
    urlFindings
  );

  const parsed = parseNoticeFile(noticeText);
  check(
    parsed.errors.length === 0,
    'notice_structure',
    'Every notice begin marker has one matching end marker.',
    parsed.errors
  );

  check(
    sha256(noticeText) === EXPECTED_NOTICE_SHA256 &&
      manifest.notice_file &&
      manifest.notice_file.path === 'THIRD_PARTY_NOTICES.txt' &&
      manifest.notice_file.sha256 === EXPECTED_NOTICE_SHA256,
    'notice_file_sha256',
    'The notice file bytes and manifest pin match the audited notice corpus.',
    { expected: EXPECTED_NOTICE_SHA256, actual: sha256(noticeText) }
  );

  check(
    noticeText.startsWith('Earth Love United — Third-Party Notices\n\n') &&
      noticeText.includes('This notice file itself does not grant redistribution, commercial-use, production, or release authority.') &&
      noticeText.includes('Rights review and governance decisions are recorded separately in the machine-readable manifest.') &&
      !noticeText.includes('Production approved:') &&
      !noticeText.includes('Release approved:'),
    'notice_disclaimer',
    'The public notice makes durable no-authority statements without embedding mutable review or release state.'
  );

  const manifestSections = Array.isArray(manifest.notice_sections) ? manifest.notice_sections : [];
  const sectionById = Object.fromEntries(manifestSections.map(function (section) {
    return [section.notice_id, section];
  }));
  const parsedIds = Array.from(parsed.sections.keys());
  const expectedNoticeIds = Object.keys(EXPECTED_NOTICE_HASHES);
  check(
    manifest.notice_section_count === 35 &&
      manifestSections.length === 35 &&
      parsed.sections.size === 35 &&
      new Set(manifestSections.map(function (section) { return section.notice_id; })).size === 35 &&
      expectedNoticeIds.every(function (id) { return parsed.sections.has(id) && sectionById[id]; }) &&
      parsedIds.every(function (id) { return Object.prototype.hasOwnProperty.call(EXPECTED_NOTICE_HASHES, id); }),
    'notice_inventory',
    'The manifest and notice file contain exactly the audited 35 notice sections.'
  );

  const noticeMismatches = [];
  expectedNoticeIds.forEach(function (noticeId) {
    const parsedSection = parsed.sections.get(noticeId);
    const manifestSection = sectionById[noticeId];
    const expectedHash = EXPECTED_NOTICE_HASHES[noticeId];
    if (!parsedSection || parsedSection.payload_sha256 !== expectedHash) {
      noticeMismatches.push(noticeId + '.payload');
    }
    if (!manifestSection || manifestSection.payload_sha256 !== expectedHash) {
      noticeMismatches.push(noticeId + '.manifest');
    }
  });
  check(
    noticeMismatches.length === 0,
    'notice_payloads',
    'Every full notice payload matches its independently pinned normalized hash.',
    noticeMismatches
  );

  const noticeReferences = [];
  const componentById = Object.fromEntries(components.map(function (component) {
    return [component.component_id, component];
  }));
  components.forEach(function (component) {
    (component.notice_ids || []).forEach(function (noticeId) {
      if (!sectionById[noticeId] || !parsed.sections.has(noticeId)) {
        noticeReferences.push(component.component_id + ' -> ' + noticeId);
      }
    });
  });
  manifestSections.forEach(function (section) {
    (section.applies_to || []).forEach(function (componentId) {
      const component = componentById[componentId];
      if (!component || !(component.notice_ids || []).includes(section.notice_id)) {
        noticeReferences.push(section.notice_id + ' -> ' + componentId);
      }
    });
  });
  check(
    noticeReferences.length === 0,
    'notice_references',
    'Component-to-notice and notice-to-component references are reciprocal and complete.',
    noticeReferences
  );

  const h3Js = componentById['npm:h3-js@4.4.0'] || {};
  const h3Core = componentById['embedded:h3-core@4.4.1'] || {};
  const dggrid = componentById['attribution:dggrid@2015'] || {};
  check(
    h3Js.licence_file_sha256 === 'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4' &&
      sameValue(h3Js.notice_ids, [
        'package-license-c71d239df91726fc',
        'package-notice-aa869183968dc017',
        'attribution-114bd21151f748d5'
      ]) &&
      h3Core.source_version_evidence &&
      h3Core.source_version_evidence.value === '4.4.1' &&
      sameValue(h3Core.notice_ids, h3Js.notice_ids) &&
      dggrid.licence_file_sha256 === '912782af490333d62809e28b57eb7e8798461cd97cb9487e0398c8c16d9cbdf3',
    'h3_evidence',
    'H3 JS, embedded H3 core 4.4.1, Apache licence, NOTICE, and DGGRID attribution are all pinned.'
  );

  const babelHelper = componentById['embedded:@babel/helpers@7.29.2:regenerator'] || {};
  check(
    babelHelper.licence_file_sha256 === '4be9d87b56a306293223b490c0d0b245e9e94f39884147bf051a6c7b825aeb30' &&
      babelHelper.embedded_evidence &&
      babelHelper.embedded_evidence.three_globe_version === '2.45.2' &&
      babelHelper.embedded_evidence.three_globe_release_git_head === '017a3a5d182b2413f403154d3eb3ed4af3e598ca' &&
      babelHelper.embedded_evidence.three_globe_lockfile_sha256 === 'bda752b9e0c153bfe6be89c5a55f01c6c0d79021cf91af3cb7ee1a388be4ae43',
    'babel_helper_evidence',
    'The embedded Babel regenerator helper is tied to the exact three-globe lockfile and MIT licence.'
  );

  const font = componentById['embedded:helvetiker-regular@2004'] || {};
  check(
    font.artifact_sha256 === 'd5c5467690f74061179a292af83bd85c4c551e0f106b2af99714f11184c96981' &&
      font.artifact_bytes === 63182 &&
      font.unmodified === true &&
      font.comparison_evidence === 'Byte-identical to three@0.183.2 package/examples/fonts/helvetiker_regular.typeface.json' &&
      sameValue(font.notice_ids, [
        'font-license-35e8279356d78908',
        'font-embedded-license-7f7bfa942d72048b'
      ]),
    'font_evidence',
    'The embedded Helvetiker font is pinned, byte-identical, unmodified, and carries both licence payloads.'
  );

  const emscripten = componentById['toolchain:emscripten@1.38.43'] || {};
  const musl = componentById['linked:musl@emscripten-1.38.43'] || {};
  check(
    emscripten.licence_file_sha256 === '620a78084fc7ca97c0b5dea9abf891f3ffcadfdbf305276f099c9c4e12fc1d86' &&
      emscripten.version_evidence === 'h3-js@4.4.0 package.json build image trzeci/emscripten:sdk-tag-1.38.43-64bit' &&
      musl.licence_file_sha256 === '70ca142d257e2690a1f8eda8a296e64a6d1b16d8aee6784f8ddcf67f3163635d',
    'toolchain_evidence',
    'Conservative Emscripten 1.38.43 and musl runtime notice evidence is pinned.'
  );

  check(
    sameValue(manifest.counsel_questions, EXPECTED_COUNSEL_QUESTIONS),
    'counsel_questions',
    'The unresolved font, Unlicense, generated-runtime, and H3 questions remain explicit for counsel.'
  );

  return {
    policy_version: POLICY_VERSION,
    status: failures.length === 0 ? 'pass' : 'fail',
    review_status: rights.review_status || null,
    production_approved: rights.production_approved === true,
    release_approved: rights.release_approved === true,
    component_count: components.length,
    source_mapped_package_count: sourceMapped.length,
    third_party_source_count: sourceMapped.reduce(function (total, component) {
      return total + (component.source_map_source_count || 0);
    }, 0),
    notice_section_count: parsed.sections.size,
    checks: checks,
    failures: failures,
    failure_ids: Array.from(new Set(failures.map(function (failure) { return failure.id; })))
  };
}

function integrationCalculationHash(integration) {
  const copy = JSON.parse(JSON.stringify(integration));
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function stripHtmlComments(value) {
  return String(value || '').replace(/<!--[\s\S]*?-->/g, '');
}

function activeShellLines(value) {
  return String(value || '').split('\n').map(function (line) {
    return line.trim();
  }).filter(function (line) {
    return line && !line.startsWith('#');
  });
}

function hasBackgroundOperator(line) {
  return /(^|[^&>])&(?=\s|$)/.test(String(line || ''));
}

function exactUnresolvedAssetRights(rows) {
  if (!Array.isArray(rows) || rows.length !== EXPECTED_ASSET_RIGHTS_ROWS.length) return false;
  return rows.every(function (row, index) {
    const expected = EXPECTED_ASSET_RIGHTS_ROWS[index];
    return Object.keys(expected).every(function (key) { return row[key] === expected[key]; }) &&
      typeof row.origin_evidence === 'string' && row.origin_evidence.length >= 20 &&
      row.rights_review_status === 'not_reviewed' &&
      row.notice_disposition_status === 'not_reviewed' &&
      row.redistribution_decision === null &&
      row.attribution_notice_obligation === null &&
      row.reviewer_identity === null &&
      row.reviewed_at === null &&
      row.decision_reference === null &&
      row.production_use_approved === false &&
      row.release_authority === false;
  });
}

function evaluateNoticeIntegration(input) {
  const integration = input.integration || {};
  const files = input.files || {};
  const records = input.source_records || {};
  const approvalBoundary = integration.approval_boundary || {};
  const changes = integration.integration_changes || {};
  const checks = [];
  const check = function (pass, id, detail) {
    checks.push({ id: id, pass: Boolean(pass), detail: detail });
  };

  check(
    integration.schema_version === '1.0.0' &&
      integration.integration_id === 'elu-globe-notices-integration-2026-07-15' &&
      integration.status === 'implemented_unreviewed',
    'integration_identity',
    'The integration record must identify the exact unreviewed implementation boundary.'
  );
  check(
    sha256(input.integrationText || '') === EXPECTED_INTEGRATION_SHA256,
    'integration_file_sha256',
    'The integration record bytes must match the pinned reviewed candidate.'
  );
  check(
    integration.calculation_hash === EXPECTED_INTEGRATION_CALCULATION_HASH &&
      integrationCalculationHash(integration) === EXPECTED_INTEGRATION_CALCULATION_HASH,
    'integration_calculation_hash',
    'The canonical integration record calculation hash must be valid and pinned.'
  );

  const coreGovernance = input.coreManifest && input.coreManifest.governance_boundary;
  check(
    coreGovernance &&
      coreGovernance.runtime_modified === false &&
      coreGovernance.deployment_modified === false &&
      coreGovernance.public_ui_modified === false &&
      integration.inventory_core &&
      integration.inventory_core.sha256 === EXPECTED_MANIFEST_SHA256 &&
      /historical artifact properties, not assertions about the later repository integration/.test(integration.inventory_core.governance_scope || ''),
    'historical_core_scope',
    'The immutable core booleans must be explicitly scoped as historical inventory-only properties.'
  );
  check(
    changes.deployment_modified === true &&
      changes.public_ui_modified === true &&
      changes.control_plane_modified === true &&
      changes.runtime_asset_bytes_modified === false &&
      changes.notice_payload_modified === false &&
      changes.inventory_core_modified === false,
    'integration_changes',
    'The integration record must truthfully record deploy, public-link, and control changes without claiming asset or notice-payload changes.'
  );

  check(
    records[NOTICE_PATH] && records[NOTICE_PATH].regular_file === true &&
      records[NOTICE_PATH].sha256 === EXPECTED_NOTICE_SHA256 &&
      records[MANIFEST_PATH] && records[MANIFEST_PATH].regular_file === true &&
      records[MANIFEST_PATH].sha256 === EXPECTED_MANIFEST_SHA256 &&
      records[INTEGRATION_PATH] && records[INTEGRATION_PATH].regular_file === true &&
      records[INTEGRATION_PATH].sha256 === EXPECTED_INTEGRATION_SHA256 &&
      records[APPROVAL_SCHEMA_PATH] && records[APPROVAL_SCHEMA_PATH].regular_file === true &&
      records[APPROVAL_SCHEMA_PATH].sha256 === EXPECTED_APPROVAL_SCHEMA_SHA256 &&
      records[APPROVAL_TRUST_PATH] && records[APPROVAL_TRUST_PATH].regular_file === true &&
      records[APPROVAL_TRUST_PATH].sha256 === EXPECTED_APPROVAL_TRUST_SHA256,
    'source_regular_file_integrity',
    'Notice, inventory, integration record, approval schema, and empty trust root must be regular source files with exact hashes.'
  );

  check(
    exactUnresolvedAssetRights(integration.asset_rights_dispositions),
    'asset_rights_unresolved',
    'Natural Earth geometry and all four texture rows must remain individually unresolved, unapproved, and non-authoritative.'
  );
  check(
    sha256(input.approvalTrustText || '') === EXPECTED_APPROVAL_TRUST_SHA256 &&
      exactUnprovisionedTrust(input.approvalTrust),
    'approval_trust_empty',
    'The protected approval trust registry must remain exact and unprovisioned until real role authorities are supplied.'
  );
  check(
    approvalBoundary.review_status === 'not_reviewed' &&
      approvalBoundary.rights_review_status === 'not_reviewed' &&
      approvalBoundary.third_party_notices_review_status === 'not_reviewed' &&
      approvalBoundary.counsel_review_complete === false &&
      approvalBoundary.production_use_approved === false &&
      approvalBoundary.release_authority === false &&
      approvalBoundary.approval_artifact_path === APPROVAL_PATH &&
      approvalBoundary.approval_artifact_present === false &&
      approvalBoundary.approval_schema_path === APPROVAL_SCHEMA_PATH &&
      approvalBoundary.trust_registry_path === APPROVAL_TRUST_PATH &&
      approvalBoundary.trust_registry_sha256 === EXPECTED_APPROVAL_TRUST_SHA256 &&
      approvalBoundary.trust_registry_status === 'unprovisioned' &&
      approvalBoundary.signature_bundle_path === APPROVAL_SIGNATURE_BUNDLE_PATH &&
      approvalBoundary.signature_bundle_present === false &&
      approvalBoundary.authority_model === 'detached_ed25519_role_signatures' &&
      approvalBoundary.approval_hash_pinned === false &&
      approvalBoundary.detached_signatures_verified === false &&
      approvalBoundary.integrity_is_not_approval === true &&
      input.approval_artifact_present === false &&
      input.signature_bundle_present === false &&
      sameValue(integration.unresolved_counsel_question_ids, [
        'helvetiker-mgopen',
        'unlicense-jurisdiction',
        'emscripten-musl-runtime',
        'h3-notice-scope'
      ]),
    'approval_boundary',
    'Integrity remains separate from absent human approval, unresolved counsel questions, production use, and release authority.'
  );

  const approvalSchema = input.approvalSchema || {};
  const approvalNotice = approvalSchema.properties && approvalSchema.properties.third_party_notice_inventory;
  const approvalRows = approvalSchema.properties && approvalSchema.properties.asset_rights_dispositions;
  const approvalBindings = approvalSchema.properties && approvalSchema.properties.authority_bindings;
  const approvalManifest = approvalSchema.properties && approvalSchema.properties.runtime_asset_manifest;
  const schemaRequired = Array.isArray(approvalSchema.required) ? approvalSchema.required : [];
  const skyDisposition = approvalSchema.$defs && approvalSchema.$defs.nightSkyDisposition;
  const skyProperties = skyDisposition && skyDisposition.allOf && skyDisposition.allOf[1] &&
    skyDisposition.allOf[1].properties;
  check(
    sha256(input.approvalSchemaText || '') === EXPECTED_APPROVAL_SCHEMA_SHA256 &&
      approvalSchema.properties &&
      approvalSchema.properties.schema_version && approvalSchema.properties.schema_version.const === '2.0.0' &&
      approvalSchema.properties.review_id && approvalSchema.properties.review_id.const === 'elu-globe-runtime-assets-production-review-v2' &&
      approvalNotice && approvalNotice.properties &&
      approvalNotice.properties.notice_sha256.const === EXPECTED_NOTICE_SHA256 &&
      approvalNotice.properties.manifest_sha256.const === EXPECTED_MANIFEST_SHA256 &&
      approvalNotice.properties.integration_sha256.const === EXPECTED_INTEGRATION_SHA256 &&
      approvalManifest && approvalManifest.properties &&
      approvalManifest.properties.sha256.const === EXPECTED_RUNTIME_MANIFEST_SHA256 &&
      ['authority_bindings', 'counsel_reviewer_identity', 'release_authority_identity'].every(function (key) {
        return schemaRequired.includes(key);
      }) &&
      approvalBindings && approvalBindings.properties &&
      approvalBindings.properties.trust_registry_path.const === APPROVAL_TRUST_PATH &&
      approvalBindings.properties.trust_registry_sha256.const === EXPECTED_APPROVAL_TRUST_SHA256 &&
      approvalBindings.properties.key_ids && approvalBindings.properties.key_ids.properties &&
      ['asset_rights_reviewer', 'licensing_counsel', 'release_authorizer'].every(function (role) {
        return approvalBindings.properties.key_ids.required.includes(role) &&
          approvalBindings.properties.key_ids.properties[role].pattern === '^ed25519:[0-9a-f]{64}$';
      }) &&
      approvalRows && approvalRows.minItems === 5 && approvalRows.maxItems === 5 &&
      Array.isArray(approvalRows.prefixItems) && approvalRows.prefixItems.length === 5 &&
      skyProperties && skyProperties.path.const === 'assets/globe/runtime/night-sky.svg' &&
      skyProperties.source_url.const === null &&
      skyProperties.source_path.const === 'tools/authoring/generate-globe-starfield.js' &&
      approvalSchema.properties.counsel_resolutions.minItems === 4 &&
      approvalSchema.properties.counsel_resolutions.maxItems === 4,
    'approval_schema',
    'The future approval schema must pin the notice pair, integration record, five non-blanket asset decisions, and four counsel resolutions.'
  );

  const buildLines = activeShellLines(files.build_deploy);
  const sourceCommand = 'node tools/check-globe-third-party-notices.js';
  const copyCommand = 'cp THIRD_PARTY_NOTICES.txt "$DEPLOY_DIR/"';
  const stagedCommand = 'node tools/check-globe-third-party-notices.js --staged "$DEPLOY_DIR"';
  const finalAggregateVerifier = 'node tools/check-staged-production-integrity.js --staged "$DEPLOY_DIR"';
  const finalAggregateCommand = 'exec ' + finalAggregateVerifier;
  const sourceIndex = buildLines.indexOf(sourceCommand);
  const copyIndex = buildLines.indexOf(copyCommand);
  const stagedIndex = buildLines.indexOf(stagedCommand);
  const finalIndex = buildLines.indexOf(finalAggregateCommand);
  check(
    buildLines.filter(function (line) { return line === sourceCommand; }).length === 1 &&
      buildLines.filter(function (line) { return line === copyCommand; }).length === 1 &&
      buildLines.filter(function (line) { return line === stagedCommand; }).length === 1 &&
      buildLines.filter(function (line) { return line === finalAggregateCommand; }).length === 1 &&
      sourceIndex !== -1 && copyIndex > sourceIndex && stagedIndex > copyIndex &&
      finalIndex > stagedIndex &&
      buildLines[buildLines.length - 1] === finalAggregateCommand &&
      !buildLines.some(hasBackgroundOperator) &&
      !/trap\s+[^\n]*\b(?:DEBUG|RETURN)\b/.test(files.build_deploy),
    'deploy_notice_verification',
    'Build staging must verify source notices, copy the root notice, verify staged notice bytes, then exec the aggregate verifier as the exact tail with no direct shell background operator.'
  );

  const activeIndex = stripHtmlComments(files.index);
  const publicLink = '<a href="/THIRD_PARTY_NOTICES.txt">Third-party notices</a>';
  check(
    activeIndex.split(publicLink).length - 1 === 1 &&
      integration.public_notice &&
      integration.public_notice.same_origin_url === '/THIRD_PARTY_NOTICES.txt' &&
      /THIRD_PARTY_NOTICES\.txt/.test(files.credits || '') &&
      /globe-gl-2\.46\.1-notices\.json/.test(files.credits || ''),
    'public_notice_link',
    'The public footer and Credits must expose the exact same-origin readable notice and machine inventory.'
  );

  check(
    hasActiveCiJob(files.ci, 'static') &&
      hasActiveCiJob(files.ci, 'smoke') &&
      hasExactCiStep(files.ci, 'Globe third-party notices integrity', sourceCommand) &&
      hasExactCiStep(files.ci, 'Globe runtime approval cryptographic policy', 'node tools/check-globe-runtime-approval.js') &&
      hasExactCiStep(files.ci, 'Final staged production integrity policy self-test', 'node tools/check-staged-production-integrity.js --self-test') &&
      hasExactCiStep(files.ci, 'Verify final staged production integrity independently', 'node tools/check-staged-production-integrity.js --staged _deploy'),
    'ci_notice_wiring',
    'Active CI must run both the source and staged notice checkers without optional or commented bypasses.'
  );
  const truthLine = "{ id: 'CT-45-NOTICES', script: 'tools/check-globe-third-party-notices.js', required: true }";
  check(
    stripJsComments(files.climate_truth_ci).split('\n').filter(function (line) {
      return line.trim().replace(/,$/, '') === truthLine;
    }).length === 1,
    'truth_ci_notice_required',
    'Climate truth CI must contain exactly one active required CT-45 notice component.'
  );
  check(
    [
      NOTICE_PATH,
      MANIFEST_PATH,
      INTEGRATION_PATH,
      APPROVAL_SCHEMA_PATH,
      APPROVAL_PATH,
      APPROVAL_TRUST_PATH,
      APPROVAL_SIGNATURE_BUNDLE_PATH,
      'tools/check-globe-third-party-notices.js',
      'tools/lib/globe-third-party-notices.js',
      'tools/fixtures/globe-third-party-notices.json',
      'tools/check-globe-runtime-approval.js',
      'tools/lib/globe-runtime-approval.js',
      'tools/check-staged-production-integrity.js'
    ].every(function (required) {
      return Array.isArray(input.runtime_fixed_paths) && input.runtime_fixed_paths.includes(required);
    }),
    'runtime_diff_notice_scope',
    'Runtime-diff policy must classify the notice pair, integration record, approval contract, and enforcement controls as runtime-affecting.'
  );
  check(
    REQUIRED_INTEGRATION_OWNERS.every(function (required) {
      return String(files.codeowners || '').split('\n').some(function (line) {
        return line.trim().startsWith(required + ' ') && line.includes('@earth-love-united/maintainers');
      });
    }),
    'notice_control_owners',
    'Every notice, approval, deployment, truth, and enforcement path must require maintainer review.'
  );
  check(
    /inventory integrity is not rights approval/i.test(files.production_docs || '') &&
      /historical inventory-only properties/i.test(files.production_docs || '') &&
      /five asset-specific rights dispositions/i.test(files.production_docs || ''),
    'notice_integration_docs',
    'Production documentation must distinguish integrity from approval, scope historical core flags, and require five asset-specific rights decisions.'
  );

  const failures = checks.filter(function (item) { return !item.pass; });
  return {
    policy_version: POLICY_VERSION,
    status: failures.length === 0 ? 'pass' : 'fail',
    integrity_passed: failures.length === 0,
    review_status: 'not_reviewed',
    production_use_approved: false,
    release_authority: false,
    checks: checks,
    failures: failures,
    failure_ids: failures.map(function (item) { return item.id; })
  };
}

module.exports = {
  APPROVAL_PATH: APPROVAL_PATH,
  APPROVAL_SCHEMA_PATH: APPROVAL_SCHEMA_PATH,
  APPROVAL_SIGNATURE_BUNDLE_PATH: APPROVAL_SIGNATURE_BUNDLE_PATH,
  APPROVAL_TRUST_PATH: APPROVAL_TRUST_PATH,
  EXPECTED_APPROVAL_SCHEMA_SHA256: EXPECTED_APPROVAL_SCHEMA_SHA256,
  EXPECTED_APPROVAL_TRUST_SHA256: EXPECTED_APPROVAL_TRUST_SHA256,
  EXPECTED_ASSET_RIGHTS_ROWS: EXPECTED_ASSET_RIGHTS_ROWS,
  POLICY_VERSION: POLICY_VERSION,
  EXPECTED_BUNDLE: EXPECTED_BUNDLE,
  EXPECTED_COMPONENTS: EXPECTED_COMPONENTS,
  EXPECTED_INTEGRATION_CALCULATION_HASH: EXPECTED_INTEGRATION_CALCULATION_HASH,
  EXPECTED_INTEGRATION_SHA256: EXPECTED_INTEGRATION_SHA256,
  EXPECTED_MANIFEST_SHA256: EXPECTED_MANIFEST_SHA256,
  EXPECTED_MANIFEST_CALCULATION_HASH: EXPECTED_MANIFEST_CALCULATION_HASH,
  EXPECTED_NOTICE_HASHES: EXPECTED_NOTICE_HASHES,
  EXPECTED_NOTICE_SHA256: EXPECTED_NOTICE_SHA256,
  INTEGRATION_PATH: INTEGRATION_PATH,
  MANIFEST_PATH: MANIFEST_PATH,
  NOTICE_PATH: NOTICE_PATH,
  calculationHash: calculationHash,
  evaluateNoticeIntegration: evaluateNoticeIntegration,
  evaluateThirdPartyNotices: evaluateThirdPartyNotices,
  exactUnresolvedAssetRights: exactUnresolvedAssetRights,
  exactUnprovisionedTrust: exactUnprovisionedTrust,
  integrationCalculationHash: integrationCalculationHash,
  parseNoticeFile: parseNoticeFile,
  sha256: sha256,
  stable: stable
};
