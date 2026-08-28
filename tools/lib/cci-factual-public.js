'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { EXPECTED_SPEC: EXPECTED_VENDOR } = require('./globe-vendor-integrity');
const {
  ALWAYS_PUBLIC_PATHS,
  CANDIDATE_MARKER_PATH,
  inspectRegular,
  listFiles,
  safeRelative,
} = require('./public-deploy-surface');

const REVIEW_PATH = 'data/climate/reviews/country-climate-intelligence-v1-multi-model-ai-review.json';
const CCI_RUNTIME_PATH = 'data/climate/runtime/country-climate-intelligence.json';
const LOCAL_BROWSER_CHECK_PATHS = Object.freeze(['tools/smoke-test.js', 'tools/stack-lint.js']);
const PUBLIC_REVIEW_LABEL = 'AI-reviewed source-data release; no human review or legal certification.';
const EXCLUDED_GLOBE_PATHS = Object.freeze([
  'assets/globe/runtime/manifest.json',
  'assets/globe/runtime/night-sky.png',
  'assets/globe/runtime/earth-blue-marble.jpg',
  'assets/globe/runtime/earth-topology.png',
]);
const TRANSFORMED_PATHS = Object.freeze([
  'index.html',
  'js/country-climate-intelligence.js',
  'js/globe.js',
  'sw.js',
]);

function countOccurrences(text, value) {
  if (!value) return 0;
  return text.split(value).length - 1;
}

function replaceExact(text, from, to, expectedCount, label) {
  const actualCount = countOccurrences(text, from);
  if (actualCount !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} exact source occurrence(s), found ${actualCount}`);
  }
  return text.split(from).join(to);
}

function transformIndex(source) {
  let output = source;
  output = replaceExact(output,
    'js/country-climate-intelligence.js?v=v17',
    'js/country-climate-intelligence.js?v=v18-factual-ai-review', 2, 'index CCI cache pin');
  output = replaceExact(output,
    'js/globe.js?v=v40',
    'js/globe.js?v=v42-rights-safe', 1, 'index globe cache pin');
  output = replaceExact(output,
    '/sw.js?v=77-cci-raw-byte-boundary',
    '/sw.js?v=79-cci-factual-ai-review', 1, 'index service-worker epoch');
  output = replaceExact(output,
    'The live atlas reads one hashed, reproducible 249-entity factual release artifact.',
    'The live atlas reads one hashed, reproducible 249-entity source-data release.', 1, 'index factual copy');
  output = replaceExact(output,
    'Decorative background only. Original starfield from Three-Globe 2.45.2.',
    'Decorative historical surface only; no endorsement is implied. Three-Globe example images are excluded from this public release.',
    1, 'index rights-safe globe attribution');
  output = replaceExact(output,
    '    <div class="footer-copy">© 2026 Earth Love United Foundation · earthloveunited.org</div>',
    '    <div class="footer-copy" data-cci-review-disclosure>Climate Intelligence: AI-reviewed source-data release; no human review or legal certification. Includes source observations, estimates, modeled projections, and disclosed deterministic derivations. <a href="/data/climate/reviews/country-climate-intelligence-v1-multi-model-ai-review.json">Read the review artifact</a>.</div>\n    <div class="footer-copy">© 2026 Earth Love United Foundation · earthloveunited.org</div>',
    1, 'index public review disclosure');
  return output;
}

function transformClimateIntelligence(source) {
  let output = replaceExact(source,
    "return 'Normalized candidate · raw sources revalidated · independent review pending';",
    "return 'AI-reviewed source-data release · raw sources revalidated · no human/legal certification';",
    1, 'CCI review label');
  output = replaceExact(output,
    "  const CARBON_RELIEF_DEMO_VALUE = 'low-is-high';",
    '  const CARBON_RELIEF_DEMO_VALUE = null;',
    1, 'inverted relief value removal');
  output = replaceExact(output,
    `  function carbonReliefMode() {
    try {
      const query = new URLSearchParams(window.location.search);
      return query.get('carbon-relief') === CARBON_RELIEF_DEMO_VALUE
        ? 'lower_value_higher'
        : 'higher_value_higher';
    } catch (_) {
      return 'higher_value_higher';
    }
  }`,
    `  function carbonReliefMode() {
    // The inverted-relief experiment is deliberately unavailable in the
    // AI-reviewed public lane; magnitude always maps higher value to higher tile.
    return 'higher_value_higher';
  }`,
    1, 'inverted relief public exclusion');
  output = replaceExact(output,
    "        demoQuery: 'carbon-relief=' + CARBON_RELIEF_DEMO_VALUE,",
    '        demoQuery: null,',
    1, 'inverted relief state removal');
  return output;
}

function transformGlobe(source) {
  let output = source;
  const currentAssets = `const GLOBE_VISUAL_ASSET_TIMEOUT_MS = 8000;
const GLOBE_VISUAL_ASSETS = Object.freeze({
  darkSurface: Object.freeze({ url: '/assets/globe/runtime/earth-night.jpg?v=373e5a08c9f3', width: 3600, height: 1800 }),
  darkBackground: Object.freeze({ url: '/assets/globe/runtime/night-sky.png?v=7e1d5e780301', width: 4096, height: 2048 }),
  lightSurface: Object.freeze({ url: '/assets/globe/runtime/earth-blue-marble.jpg?v=228deba2e4b6', width: 4096, height: 2048 }),
  bump: Object.freeze({ url: '/assets/globe/runtime/earth-topology.png?v=839b12da2e4d', width: 2048, height: 1024 }),
});`;
  const rightsSafeAssets = `const GLOBE_VISUAL_ASSET_TIMEOUT_MS = 8000;
// AI-reviewed source-data build: one official NASA surface only. The
// Three-Globe example starfield, blue-marble, and topology images are absent.
const GLOBE_VISUAL_ASSETS = Object.freeze({
  surface: Object.freeze({ url: '/assets/globe/runtime/earth-night.jpg?v=373e5a08c9f3', width: 3600, height: 1800 }),
});`;
  output = replaceExact(output, currentAssets, rightsSafeAssets, 1, 'globe rights-safe asset set');
  output = replaceExact(output, 'GLOBE_VISUAL_ASSETS.darkSurface.url', 'GLOBE_VISUAL_ASSETS.surface.url', 1,
    'globe dark surface');
  output = replaceExact(output, 'GLOBE_VISUAL_ASSETS.lightSurface.url', 'GLOBE_VISUAL_ASSETS.surface.url', 1,
    'globe light surface');
  output = replaceExact(output, 'GLOBE_VISUAL_ASSETS.darkBackground.url', 'null', 1,
    'globe solid dark background');
  output = replaceExact(output, '.bumpImageUrl(GLOBE_VISUAL_ASSETS.bump.url)', '.bumpImageUrl(null)', 1,
    'globe bump removal');
  output = replaceExact(output,
    "      ' explicit gaps. ' + lens.interpretation;",
    "      ' explicit gaps. " + PUBLIC_REVIEW_LABEL + " ' + lens.interpretation;",
    1, 'fallback review disclosure');
  output = replaceExact(output,
    `    let sky = null;
    try {
      this.world?.scene?.().traverse(object => {
        const materials = Array.isArray(object?.material) ? object.material : [object?.material];
        materials.filter(Boolean).forEach(material => {
          const candidate = describe(material.map);
          if (candidate?.src.includes('/assets/globe/runtime/night-sky.png')) {
            sky = { ...candidate, materialSide: material.side, mesh: object.isMesh === true };
          }
        });
      });
    } catch (error) {
      reportWarn('GlobeModule', 'Unable to inspect live background texture: ' + (error?.message || 'unknown error'));
    }`,
    `    // The AI-reviewed public lane deliberately has no decorative sky mesh.
    const sky = null;`,
    1, 'globe sky inspection removal');
  return output;
}

function transformServiceWorker(source) {
  let output = source;
  output = replaceExact(output,
    "const CACHE_NAME = 'elu-v77-cci-raw-byte-boundary';",
    "const CACHE_NAME = 'elu-v79-cci-factual-ai-review';", 1, 'service-worker cache epoch');
  output = replaceExact(output,
    "  '/js/country-climate-intelligence.js?v=v17',",
    "  '/js/country-climate-intelligence.js?v=v18-factual-ai-review',", 1, 'service-worker CCI cache pin');
  output = replaceExact(output,
    "  '/js/globe.js?v=v40',",
    "  '/js/globe.js?v=v42-rights-safe',", 1, 'service-worker globe cache pin');
  [
    "  '/assets/globe/runtime/manifest.json',\n",
    "  '/assets/globe/runtime/night-sky.png?v=7e1d5e780301',\n",
    "  '/assets/globe/runtime/earth-blue-marble.jpg?v=228deba2e4b6',\n",
    "  '/assets/globe/runtime/earth-topology.png?v=839b12da2e4d',\n",
  ].forEach((line, index) => {
    output = replaceExact(output, line, '', 1, `service-worker excluded globe asset ${index + 1}`);
  });
  return output;
}

function transformText(relative, source) {
  if (relative === 'index.html') return transformIndex(source);
  if (relative === 'js/country-climate-intelligence.js') return transformClimateIntelligence(source);
  if (relative === 'js/globe.js') return transformGlobe(source);
  if (relative === 'sw.js') return transformServiceWorker(source);
  throw new Error('no AI-factual transform registered for ' + relative);
}

function expectedBytes(sourceRoot, relative) {
  const source = inspectRegular(sourceRoot, relative);
  if (!TRANSFORMED_PATHS.includes(relative)) return source.bytes;
  return Buffer.from(transformText(relative, source.bytes.toString('utf8')));
}

function expectedSourcePaths() {
  const excluded = new Set(EXCLUDED_GLOBE_PATHS);
  const paths = [
    ...ALWAYS_PUBLIC_PATHS.filter(relative => !excluded.has(relative)),
    CCI_RUNTIME_PATH,
    REVIEW_PATH,
    ...LOCAL_BROWSER_CHECK_PATHS,
  ].map(safeRelative).sort();
  if (new Set(paths).size !== paths.length) throw new Error('CCI AI-factual path list contains duplicates');
  return paths;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function verifyCciFactualPublicSurface(options) {
  const sourceRoot = path.resolve(options.sourceRoot);
  const stagedRoot = path.resolve(options.stagedRoot);
  const expected = expectedSourcePaths();
  const actual = listFiles(stagedRoot);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const expectedSet = new Set(expected);
    const actualSet = new Set(actual);
    const missing = expected.filter(relative => !actualSet.has(relative));
    const unexpected = actual.filter(relative => !expectedSet.has(relative));
    throw new Error(`CCI AI-factual surface mismatch; missing=[${missing.join(', ')}] unexpected=[${unexpected.join(', ')}]`);
  }
  expected.forEach(relative => {
    const staged = inspectRegular(stagedRoot, relative);
    const wanted = expectedBytes(sourceRoot, relative);
    if (staged.sha256 !== sha256(wanted)) throw new Error('CCI AI-factual byte mismatch: ' + relative);
    if (relative === EXPECTED_VENDOR.destination && staged.sha256 !== EXPECTED_VENDOR.sha256) {
      throw new Error('CCI AI-factual vendor bytes do not match the pinned globe.gl digest');
    }
  });
  EXCLUDED_GLOBE_PATHS.forEach(relative => {
    if (fs.existsSync(path.join(stagedRoot, relative))) throw new Error('excluded globe asset was staged: ' + relative);
  });
  if (fs.existsSync(path.join(stagedRoot, CANDIDATE_MARKER_PATH))) {
    throw new Error('local candidate marker must not appear in the AI-factual surface');
  }
  const globe = inspectRegular(stagedRoot, 'js/globe.js').bytes.toString('utf8');
  const sw = inspectRegular(stagedRoot, 'sw.js').bytes.toString('utf8');
  const index = inspectRegular(stagedRoot, 'index.html').bytes.toString('utf8');
  const cci = inspectRegular(stagedRoot, 'js/country-climate-intelligence.js').bytes.toString('utf8');
  const forbidden = [
    'night-sky.png',
    'earth-blue-marble.jpg',
    'earth-topology.png',
    '7e1d5e780301e3a33bd79fd3ac414f7a742465f33ae4605abca743d43a3ab983',
    '228deba2e4b600146bdcb6cfa359b8ead6aacc2b1c13550a29cd82824cfa1c01',
    '839b12da2e4dd346b256cebae72e10c479a102c8980a22084c41275e4b9a0e12',
  ];
  forbidden.forEach(token => {
    if (globe.includes(token) || sw.includes(token)) throw new Error('excluded globe asset token remains executable: ' + token);
  });
  if (!index.includes(PUBLIC_REVIEW_LABEL) || !cci.includes('AI-reviewed source-data release')) {
    throw new Error('public AI-review disclosure is absent');
  }
  if (index.includes('Original starfield from Three-Globe') ||
      !index.includes('Three-Globe example images are excluded from this public release.')) {
    throw new Error('public globe attribution does not describe the rights-safe asset boundary');
  }
  if (!globe.includes(PUBLIC_REVIEW_LABEL)) throw new Error('accessible fallback AI-review disclosure is absent');
  if (globe.includes('carbon-relief=low-is-high') || cci.includes('carbon-relief') || cci.includes('low-is-high')) {
    throw new Error('inverted carbon-relief experiment remains public');
  }
  return { status: 'pass', mode: 'cci_ai_factual', file_count: actual.length, paths: actual };
}

module.exports = {
  CCI_RUNTIME_PATH,
  EXCLUDED_GLOBE_PATHS,
  LOCAL_BROWSER_CHECK_PATHS,
  PUBLIC_REVIEW_LABEL,
  REVIEW_PATH,
  TRANSFORMED_PATHS,
  expectedBytes,
  expectedSourcePaths,
  replaceExact,
  sha256,
  transformText,
  verifyCciFactualPublicSurface,
};
