#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  APP_CALLED_GLOBE_APIS,
  CACHE_NAME,
  CONTROL_FILES,
  EXPECTED_VENDOR_SPEC,
  PATCH_FILES,
  PROHIBITED_OUTPUTS,
  REQUIRED_GLOBE_LIFECYCLE_APIS,
  ROLLBACK_PLAN_SHA256,
  RUNTIME_CONTROL_COMMIT,
  RUNTIME_DEPENDENCIES,
  RUNTIME_EXCLUSIONS,
  SERVICE_WORKER_REGISTRATION,
  calculationHash,
  sha256,
} = require('./lib/ct42-runtime-rollback-proof');

const ROOT = path.resolve(__dirname, '..');
const CANDIDATE_BUILDER_COMMIT = '793eade295ae3fa787749e4d6ee112cf374a7634';
const PATCH_PATH = 'data/climate/operations/ct42-runtime-rollback.patch.b64';
const PROOF_PATH = 'data/climate/reviews/ct42-candidate-rollback-rehearsal.json';

function cliValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  assert.ok(process.argv[index + 1], `${flag} requires a value`);
  return process.argv[index + 1];
}

const reviewChainHead = cliValue('--review-chain-head');
if (reviewChainHead !== null) assert.match(reviewChainHead, /^[a-f0-9]{40}$/, '--review-chain-head must be a full Git SHA');

function git(args, options = {}) {
  const run = childProcess.spawnSync('git', args, {
    cwd: options.cwd || ROOT,
    encoding: options.encoding || 'buffer',
  });
  assert.equal(run.status, 0, `git ${args.join(' ')} failed: ${String(run.stderr || run.stdout || '').trim()}`);
  return run.stdout;
}

function gitFile(commit, relative) {
  return git(['show', `${commit}:${relative}`]);
}

function assertReviewChainCommit(commit, relative, expectedBytes) {
  if (commit === null) return;
  const object = childProcess.spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(object.status, 0, '--review-chain-head must identify an existing commit object');
  const ancestry = childProcess.spawnSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(ancestry.status, 0, '--review-chain-head must be an ancestor of the current builder HEAD');
  assert.deepEqual(gitFile(commit, relative), expectedBytes, `--review-chain-head does not contain the exact ${relative} bytes`);
}

function write(root, relative, bytes) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}

function replaceOnce(text, from, to, label) {
  assert.equal(text.split(from).length - 1, 1, `${label} replacement anchor drift`);
  return text.replace(from, to);
}

function replaceSection(text, start, end, replacement, label) {
  const startIndex = text.indexOf(start);
  assert.notEqual(startIndex, -1, `${label} start anchor drift`);
  const endIndex = text.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `${label} end anchor drift`);
  assert.equal(text.indexOf(start, startIndex + start.length), -1, `${label} start anchor is ambiguous`);
  return text.slice(0, startIndex) + replacement + text.slice(endIndex);
}

function encodePatchArtifact(patch) {
  const base64 = patch.toString('base64');
  return Buffer.from(`${base64.match(/.{1,76}/g).join('\n')}\n`);
}

function neutralIndex(bytes) {
  let index = bytes.toString('utf8');
  index = index.replace(/^<link href="https:\/\/fonts\.googleapis\.com\/css2[^\n]*\n/m, '');
  index = index.replace(/^<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n/m, '');
  index = index.replace(/^<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n/m, '');
  index = replaceOnce(index,
    '.hex-legend-swatch{width:10px;height:10px;border-radius:2px}.hex-legend-swatch.magnitude-low{background:#5b4a97}.hex-legend-swatch.magnitude-high{background:#f6913a}.hex-legend-swatch.magnitude-gap{background:repeating-linear-gradient(135deg,#91a0ac 0 2px,transparent 2px 4px);border:1px solid #aeb9c1}.hex-legend-note{max-width:230px;margin-top:3px;padding-top:4px;border-top:1px solid rgba(255,255,255,.08);line-height:1.35}',
    '.hex-legend-swatch{width:10px;height:10px;border-radius:2px;background:rgba(145,160,172,.46);border:1px solid rgba(205,225,235,.52)}.hex-legend-note{max-width:230px;margin-top:3px;padding-top:4px;border-top:1px solid rgba(255,255,255,.08);line-height:1.35}',
    'neutral inline legend styles');
  index = replaceOnce(index, 'href="css/globe-system.css?v=v19"', 'href="css/globe-system.css?v=ct42-neutral-rollback-1"', 'rollback CSS key');
  index = replaceOnce(index, 'href="js/data.js?v=v2" as="script"', 'href="js/data.js?v=ct42-neutral-rollback-1" as="script"', 'rollback data preload key');
  index = replaceOnce(index, 'src="js/data.js?v=v2"', 'src="js/data.js?v=ct42-neutral-rollback-1"', 'rollback data key');
  index = replaceOnce(index, 'src="js/globe.js?v=v13"', 'src="js/globe.js?v=ct42-neutral-rollback-1"', 'rollback globe key');
  index = replaceOnce(index, "'tools/smoke-test.js?v=v1'", "'tools/smoke-test.js?v=ct42-neutral-rollback-1'", 'rollback SmokeTest key');
  index = replaceOnce(index,
    '<button id="globe-evidence-browse" class="glass-btn" data-action="browseEvidence" disabled aria-disabled="true" aria-label="Browse all 249 evidence records"><span class="browse-label-full">Browse all 249 evidence records</span><span class="browse-label-short" aria-hidden="true">249 records</span></button>',
    '<button id="globe-evidence-browse" class="glass-btn" data-action="browseEvidence" disabled aria-disabled="true" aria-label="Browse 201 neutral navigation entities"><span class="browse-label-full">Browse 201 neutral entities</span><span class="browse-label-short" aria-hidden="true">201 entities</span></button>',
    'neutral browse control');
  index = replaceSection(index,
    '<div class="hex-legend" id="hex-legend"',
    '\n\n<!-- ═══ GLOBE ═══ -->',
    `<div class="hex-legend" id="hex-legend" role="note" aria-label="Country evidence withheld legend">
  <div class="hex-legend-row"><span class="hex-legend-swatch" aria-hidden="true"></span> Uniform neutral surface · country evidence withheld</div>
  <div class="hex-legend-note">201 navigation entities in alphabetical order · no commitment, target, delivery, performance, emissions, impact, finance, rating, or score claim.</div>
</div>`,
    'neutral fixed legend');
  index = replaceSection(index,
    '    <h2 id="globe-h">The Living Globe</h2>',
    '    <button class="card-cta big-cta glass-btn" data-action="enterGlobe">',
    `    <h2 id="globe-h">The Living Globe</h2>
    <p class="sec-lead">The rollback globe keeps 201 neutral navigation entities usable while country climate evidence is withheld: 173 retained Natural Earth polygons plus 28 approximate small-state navigation points. Every entity is presented alphabetically with the same surface height and color.</p>
    <div class="globe-key" role="list" aria-label="Country evidence availability legend">
      <span role="listitem"><i style="background:rgba(145,160,172,.46);border:1px solid rgba(205,225,235,.52)"></i> Uniform neutral surface · evidence withheld for every entity</span>
    </div>
    <p class="data-note">Map boundaries use the pinned local Natural Earth 1:110m geometry for navigation only. Twenty-eight small states absent from that dataset use approximate navigation points, not boundaries or precise centroids. Disputed subfeatures including Northern Cyprus and Somaliland are excluded. No remote geometry or image texture is used by this rollback surface.</p>
    <div class="card-grid">
      <div class="card">
        <div class="card-tag">Evidence quarantine</div>
        <p>Country climate values are not loaded. Commitment, target, ambition, delivery, finance, rating, emissions, performance, impact-band, and climate-score claims remain withheld pending reviewed evidence.</p>
      </div>
      <div class="card">
        <div class="card-tag">Neutral navigation</div>
        <p>The 201 neutral navigation entities are ordered alphabetically. Missing or withheld information cannot look like better climate performance.</p>
      </div>
    </div>
`,
    'neutral Living Globe copy');
  index = replaceOnce(index,
    '<!-- Accessible evidence route. GlobeModule reveals this body-level region\n     when critical candidate data, geometry, visual assets, the renderer,\n     WebGL, or globe construction fail closed. -->',
    '<!-- Accessible neutral navigation route. GlobeModule reveals this body-level region\n     when local geometry, the renderer, WebGL, or globe construction fail closed. -->',
    'neutral fallback comment');
  index = replaceOnce(index,
    'This view shows emissions records and source gaps. Emissions magnitude is not a climate-performance score. Map boundaries are navigational and are not a sovereignty judgment.',
    'This accessible view contains neutral country navigation only. Country climate evidence, commitments, targets, delivery, finance, ratings, performance, impact bands, emissions values, and climate scores are withheld. Map boundaries are navigational and are not a sovereignty or performance judgment.',
    'neutral fallback boundary');
  index = replaceOnce(index, '<h3 id="globe-fallback-evidence-title">Country emissions evidence</h3>', '<h3 id="globe-fallback-evidence-title">Neutral country navigation</h3>', 'neutral fallback heading');
  index = replaceOnce(index, '<p id="globe-fallback-summary">Loading emissions coverage…</p>', '<p id="globe-fallback-summary">Loading the neutral navigation set…</p>', 'neutral fallback summary');
  index = replaceOnce(index, 'aria-label="Countries and registry entities in the emissions dataset"', 'aria-label="Neutral country navigation entities"', 'neutral fallback list label');
  index = replaceOnce(index,
    'Choose an item to inspect its emissions series or source-gap state. Climate performance is not scored in this view.',
    'Choose an entity to inspect its explicit evidence-withheld state. No climate value, commitment, target, delivery, performance, impact, finance, rating, or score conclusion is shown here.',
    'neutral fallback detail');
  index = replaceOnce(index, "navigator.serviceWorker.register('/sw.js?v=37-return-contrast'", `navigator.serviceWorker.register('${SERVICE_WORKER_REGISTRATION}'`, 'rollback service worker registration');
  return Buffer.from(index);
}

function neutralCss(bytes) {
  let css = bytes.toString('utf8');
  css = css.replace(/^\.elu-rank-dot\.is-magnitude[^\n]*\n/m, '');
  css = css.replace(/^\.elu-rank-dot\.is-gap[^\n]*\n/m, '');
  css = css.replace(/^#hex-country-tooltip \.tt-status-magnitude[^\n]*\n/m, '');
  css = css.replace(/^#hex-country-tooltip \.tt-candidate[^\n]*\n/m, '');
  css = css.replace(/^#hex-country-tooltip \.tt-factual h3[\s\S]*?^#hex-country-tooltip \.tt-source a[^\n]*\n/m, '');
  css = css.replace(/^html\[data-theme="light"\] body\.globe-mode #hex-country-tooltip \.tt-status-magnitude,[\s\S]*?^}\n\n/m, '');
  css = replaceOnce(css, "    content: '2023';", "    content: 'A–Z';", 'neutral mobile rail title');
  css = replaceOnce(css,
    '#globe-evidence-browse {\n  min-height: 32px;',
    '#globe-evidence-browse {\n  min-height: 44px;',
    'evidence browser minimum touch target');
  css = replaceOnce(css,
    '#globe-theme-toggle {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex: 0 0 auto;\n  width: 30px;\n  height: 30px;',
    '#globe-theme-toggle {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex: 0 0 auto;\n  width: 44px;\n  height: 44px;',
    'theme toggle minimum touch target');
  css = replaceOnce(css,
    '.elu-rank-toggle {\n  width: 23px;\n  height: 23px;',
    '.elu-rank-toggle {\n  width: 44px;\n  height: 44px;\n  flex: 0 0 44px;',
    'rank toggle minimum touch target');
  return Buffer.from(css);
}

function neutralData(bytes) {
  const current = bytes.toString('utf8');
  for (const token of ['window.Data = Data;', "MODULE_CONTRACTS.register('Data'", 'getClimateCountry', 'reloadClimateCandidate']) {
    assert.ok(current.includes(token), `current Data contract drift: ${token}`);
  }
  return Buffer.from(`// ═══════════════════════════════════════════════
// DATA — rollback-safe shared state
//
// Country climate evidence is deliberately withheld. The denied CT-42
// candidate remains an evidence artifact in the repository but is not loaded
// by this runtime surface.
// ═══════════════════════════════════════════════

const DATA_FETCH_TIMEOUT_MS = 8000;

function _fetchTextWithTimeout(url, options = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new Error('Timed out after ' + DATA_FETCH_TIMEOUT_MS + 'ms: ' + url));
    }, DATA_FETCH_TIMEOUT_MS);
  });
  const request = fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) })
    .then(async response => ({ ok: response.ok, status: response.status, text: await response.text() }));
  return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}

const Data = {
  biomes: null,
  sites: null,
  carbonProjects: null,
  climateCandidate: null,
  climateCountries: null,
  climateRanking: null,
  climateCandidateState: 'withheld',
  version: 'ct42-neutral-rollback-1',

  async init() {
    const [carbonProjectsRes] = await Promise.allSettled([
      _fetchTextWithTimeout('data/carbon-projects.json?v=' + this.version),
    ]);
    this.carbonProjects = await this._parseResponse(carbonProjectsRes, 'carbon-projects');
    this.climateCandidate = null;
    this.climateCountries = null;
    this.climateRanking = null;
    this.climateCandidateState = 'withheld';
    return this;
  },

  async _parseResponse(settledResult, name) {
    try {
      if (settledResult.status === 'rejected') {
        reportWarn('Data', 'Fetch failed for ' + name + ': ' + (settledResult.reason?.message || 'network error'));
        return null;
      }
      const response = settledResult.value;
      if (!response.ok) {
        reportWarn('Data', 'HTTP ' + response.status + ' for ' + name);
        return null;
      }
      const raw = JSON.parse(response.text);
      if (raw && typeof raw === 'object' && '_meta' in raw && 'data' in raw) {
        this._meta = this._meta || {};
        this._meta[name] = raw._meta;
        return raw.data;
      }
      return raw;
    } catch (error) {
      reportWarn('Data', 'Parse error for ' + name + ': ' + (error?.message || 'invalid JSON'));
      return null;
    }
  },

  async reloadClimateCandidate() {
    this.climateCandidate = null;
    this.climateCountries = null;
    this.climateRanking = null;
    this.climateCandidateState = 'withheld';
    return false;
  },

  getBiome(key) { return this.biomes ? this.biomes[key] : null; },
  getSite(id) { return this.sites ? this.sites.find(site => site.id === id) : null; },
  getCarbonProjects(iso) { return this.carbonProjects ? this.carbonProjects[iso] || null : null; },
  getClimateCountry() { return null; },
  getClimateRanking() { return null; },
  getClimateMagnitudeDomain() { return null; },
  isClimateCandidateReady() { return false; },
  _indexClimateCandidate() {
    this.climateCandidate = null;
    this.climateCountries = null;
    this.climateRanking = null;
    this.climateCandidateState = 'withheld';
    return false;
  },
  getAllBiomes() { return this.biomes ? Object.entries(this.biomes).filter(([key]) => key !== '_meta').map(([key, value]) => ({ key, ...value })) : []; },

  transitionCarbon(from, to, ha, years = 30) {
    if (!this.biomes) return null;
    const source = this.biomes[from], destination = this.biomes[to];
    if (!source || !destination) return null;
    const stock = (destination.density - source.density) * ha;
    const flux = (destination.seq - source.seq) * ha;
    const cumulative = stock + flux * years;
    return { stock_co2: stock * 3.67, flux_co2: flux * 3.67, cumulative_co2: cumulative * 3.67, years };
  },

  scaleContext(co2) {
    const amount = Math.abs(co2);
    return {
      fraction: amount / 20e9,
      cars: amount / 4.6,
      flights: amount,
      summary: this.fmt(amount) + ' t CO₂ = ' + (amount / 4.6).toFixed(0) + ' cars removed for a year, or ' + amount.toFixed(0) + ' transatlantic flights offset',
    };
  },

  fmt(number) {
    return number >= 1e9 ? (number / 1e9).toFixed(1) + 'B' :
      number >= 1e6 ? (number / 1e6).toFixed(1) + 'M' :
      number >= 1e3 ? (number / 1e3).toFixed(1) + 'K' : number.toFixed(0);
  },

  reset() {
    console.debug('[SML] Data.reset');
    return true;
  },
  destroy() {
    console.debug('[SML] Data.destroy');
    return true;
  },
  getState() {
    return { climateCandidateState: this.climateCandidateState };
  },
};

window.Data = Data;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('Data', {
    provides: ['init', 'reloadClimateCandidate', 'isClimateCandidateReady', 'fmt', 'getClimateCountry', 'getClimateRanking', 'getClimateMagnitudeDomain', 'reset', 'destroy', 'getState'],
    requires: ['STORAGE_ADAPTER'],
  });
}
`);
}

function neutralGlobe(bytes) {
  let globe = bytes.toString('utf8');
  globe = replaceSection(globe,
    'const EXPECTED_INTERACTIVE_ENTITY_COUNT = 201;',
    '\n\n// ── Point-in-polygon',
    `const EXPECTED_INTERACTIVE_ENTITY_COUNT = 201;
const EXPECTED_RETAINED_POLYGON_COUNT = 173;
const EXPECTED_SMALL_NATION_POINT_COUNT = 28;`,
    'neutral runtime constants');
  globe = replaceSection(globe,
    'const COUNTRY_STATUS = {',
    '\n\nconst GLOBE_FALLBACK_REASONS',
    `const COUNTRY_STATUS = Object.freeze({ WITHHELD: 'withheld' });

const COUNTRY_STATUS_LABELS = Object.freeze({
  [COUNTRY_STATUS.WITHHELD]: 'Country evidence withheld',
});

const COUNTRY_STATUS_BADGE_CLASSES = Object.freeze({
  [COUNTRY_STATUS.WITHHELD]: 'neutral',
});`,
    'neutral country status');
  globe = replaceSection(globe,
    'const GLOBE_FALLBACK_REASONS = Object.freeze({',
    '\n\nfunction _resolveCountryIso',
    `const GLOBE_FALLBACK_REASONS = Object.freeze({
  evidence_browse_requested: 'All 201 neutral navigation entities are available here. Climate evidence is withheld for every entity; this browser supplies navigation only and does not infer values or performance.',
  candidate_data_unavailable: 'Climate evidence is quarantined in this rollback. No climate values, commitments, scores, rankings, or performance assessments are inferred.',
  country_geometry_unavailable: 'The local neutral navigation geometry is unavailable or invalid. No climate values or assessments are inferred.',
  visual_assets_unavailable: 'The neutral rollback uses a solid globe and background and does not depend on visual image assets. No climate values or assessments are inferred.',
  library_load_failed: 'The 3D globe library could not be loaded. Neutral navigation is available below; no climate values or assessments are inferred.',
  library_unavailable: 'The 3D globe library is unavailable. Neutral navigation is available below; no climate values or assessments are inferred.',
  webgl_unavailable: 'This browser or device could not start WebGL. Neutral navigation is available below; no climate values or assessments are inferred.',
  globe_construction_failed: 'The 3D globe could not start safely. Neutral navigation is available below; no climate values or assessments are inferred.',
  globe_container_missing: 'The 3D globe container is unavailable. Neutral navigation is available below; no climate values or assessments are inferred.',
});`,
    'neutral fallback reasons');
  globe = replaceSection(globe,
    'function _getCountryDisplayData(feature) {',
    '\n\n// Pledge records contain',
    `function _getCountryDisplayData(feature) {
  if (!feature) return null;
  const props = feature.properties || {};
  const iso = _resolveCountryIso(feature);
  const mapArea = props.ADMIN || props.NAME || props.name || iso;
  return {
    iso,
    country: mapArea,
    mapArea,
    mapAreaDiffers: false,
    emissions: null,
    lat: _isFiniteNumber(Number(props.__lat)) ? Number(props.__lat) : null,
    lng: _isFiniteNumber(Number(props.__lng)) ? Number(props.__lng) : null,
    hasData: false,
    climate: null,
    evidenceState: 'withheld',
  };
}`,
    'neutral country display adapter');
  globe = replaceSection(globe,
    'function _getCountryStatusKey(d) {',
    'function _isCountryModeActive() {',
    `function _getCountryStatusKey() {
  return COUNTRY_STATUS.WITHHELD;
}

function _getCountryStatusText() {
  return COUNTRY_STATUS_LABELS[COUNTRY_STATUS.WITHHELD];
}

function _getCountryStatusClass() {
  return COUNTRY_STATUS_BADGE_CLASSES[COUNTRY_STATUS.WITHHELD];
}

function _getCountryStatusAttr() {
  return 'withheld';
}

const GLOBE_THEME_CONFIG = Object.freeze({
  dark: Object.freeze({
    surface: null,
    backgroundImage: null,
    backgroundColor: '#050509',
    globeColor: 0x18242a,
    atmosphere: '#4ecdc4',
    atmosphereAltitude: 0.25,
  }),
  light: Object.freeze({
    surface: null,
    backgroundImage: null,
    backgroundColor: '#dfe9e3',
    globeColor: 0x9ba9aa,
    atmosphere: '#2fa77f',
    atmosphereAltitude: 0.33,
  }),
});

function _getGlobeThemeConfig(theme) {
  return theme === 'light' ? GLOBE_THEME_CONFIG.light : GLOBE_THEME_CONFIG.dark;
}

function _renderCountryTrajectory() {
  return '<div class="elu-trajectory"><div class="elu-trajectory-head"><span class="elu-trajectory-title">Assessment boundary</span><span class="elu-trajectory-note">Evidence withheld</span></div><div class="elu-trajectory-empty">Commitment, target, ambition, delivery, finance, rating, emissions, performance, impact band, and climate score are not shown.</div></div>';
}

function _getCountryGaiaComment() {
  return 'This entity remains equally navigable while reviewed country climate evidence is unavailable.';
}

`,
    'neutral status and theme helpers');
  globe = replaceSection(globe,
    'function _preloadImageAsset(asset, timeoutMs) {',
    '\n\nconst GlobeModule = {',
    '',
    'remove image preloader');
  globe = replaceSection(globe,
    '  async _prepareRuntimeAssets(options) {',
    '  _failPreparation(reason, error) {',
    `  async _prepareRuntimeAssets(options) {
    let countries;
    try {
      countries = _validateCountryGeoJson(await _fetchJsonWithTimeout(
        COUNTRY_GEOJSON_URL,
        COUNTRY_GEOJSON_TIMEOUT_MS,
        options.force ? 'reload' : 'default'
      ));
    } catch (error) {
      return this._failPreparation('country_geometry_unavailable', error);
    }

    this._countryFeatures = countries.features.filter(feature =>
      feature.properties.ISO_A2 !== 'AQ' && !_isNonAssessingMapArea(feature));
    const retainedPolygons = this._countryFeatures.length;
    this._appendSmallNationFeatures();
    this._buildCountryDeck();
    const smallNationPoints = this._countryFeatures.filter(feature => feature?.properties?.__smallNation).length;
    const uniqueFeatureIsos = new Set(this._countryFeatures.map(feature => _resolveCountryIso(feature)));
    const uniqueDeckIsos = new Set(this._countryDeck.map(entry => entry.iso));
    const alphabetic = this._countryDeck.every((entry, index, deck) => index === 0 ||
      String(deck[index - 1].country).localeCompare(String(entry.country)) < 0 ||
      (String(deck[index - 1].country).localeCompare(String(entry.country)) === 0 && deck[index - 1].iso.localeCompare(entry.iso) <= 0));
    const allNeutral = this._countryDeck.every(entry => entry.data?.evidenceState === 'withheld' && entry.data?.hasData === false && entry.data?.emissions === null);
    if (retainedPolygons !== EXPECTED_RETAINED_POLYGON_COUNT ||
        smallNationPoints !== EXPECTED_SMALL_NATION_POINT_COUNT ||
        this._countryFeatures.length !== EXPECTED_INTERACTIVE_ENTITY_COUNT ||
        uniqueFeatureIsos.size !== EXPECTED_INTERACTIVE_ENTITY_COUNT ||
        this._countryDeck.length !== EXPECTED_INTERACTIVE_ENTITY_COUNT ||
        uniqueDeckIsos.size !== EXPECTED_INTERACTIVE_ENTITY_COUNT || !alphabetic || !allNeutral ||
        [...uniqueFeatureIsos].some(iso => !uniqueDeckIsos.has(iso))) {
      return this._failPreparation('country_geometry_unavailable', new Error('Neutral rollback navigation failed its exact 173 + 28 = 201 alphabetical boundary'));
    }
    this._countryDataState = 'ready';
    this._countryDataError = null;
    this._prepared = true;
    this._preparationFailure = null;
    return { ok: true, reason: null };
  },

`,
    'neutral runtime preparation');
  globe = replaceOnce(globe,
    `      .globeImageUrl(themeConfig.surface)
      .bumpImageUrl(GLOBE_VISUAL_ASSETS.bump.url)
      .backgroundImageUrl(themeConfig.backgroundImage)`,
    `      .globeImageUrl(null)
      .backgroundImageUrl(null)`,
    'solid initial globe');
  globe = replaceOnce(globe,
    `    const m = this.world.globeMaterial();
    // Low shininess + dark specular:`,
    `    const m = this.world.globeMaterial();
    m.map = null;
    m.bumpMap = null;
    if (m.color?.setHex) m.color.setHex(themeConfig.globeColor);
    m.needsUpdate = true;
    // Low shininess + dark specular:`,
    'solid material state');
  globe = replaceOnce(globe,
    `    $text('globe-fallback-title', browseRequested ? 'Browse all 249 country evidence records' : 'The 3D view is unavailable.');`,
    `    $text('globe-fallback-title', browseRequested ? 'Browse 201 neutral country navigation entities' : 'The 3D view is unavailable.');`,
    'neutral fallback title');
  globe = replaceSection(globe,
    '  _renderFallbackEvidence() {',
    '  _filterFallbackEntries(value) {',
    `  _renderFallbackEvidence() {
    const list = $('globe-fallback-country-list');
    const summary = $('globe-fallback-summary');
    const detail = $('globe-fallback-country-detail');
    if (!list || !summary || !detail) return false;
    const deck = Array.isArray(this._countryDeck) ? this._countryDeck : [];
    if (deck.length !== EXPECTED_INTERACTIVE_ENTITY_COUNT) {
      this._fallbackEntries = [];
      list.replaceChildren();
      summary.textContent = 'Neutral country navigation is unavailable. No climate values or assessments are being inferred.';
      $text('globe-fallback-results', '0 entities available');
      detail.innerHTML = '<h3>Navigation unavailable</h3><p>The pinned local country geometry did not pass its runtime checks. Return to the Foundation and try again later.</p>';
      return false;
    }
    this._fallbackEntries = deck.map(entry => ({
      country: { iso_alpha3: entry.iso, name: entry.country, flag_emoji: '' },
      evidenceState: 'withheld',
    }));
    summary.textContent = this._fallbackEntries.length + ' neutral navigation entities · all country climate evidence withheld · alphabetical order.';
    list.innerHTML = this._fallbackEntries.map(entry => {
      const country = entry.country;
      const iso = _escapeHtml(country.iso_alpha3);
      const name = _escapeHtml(country.name);
      return '<li data-fallback-search="' + _escapeHtml((country.name + ' ' + country.iso_alpha3).toLowerCase()) + '"><button type="button" class="elu-fallback-country-row" data-fallback-country-iso="' + iso + '" data-fallback-evidence-state="withheld" aria-label="' + name + ', country climate evidence withheld"><span class="elu-fallback-country-name">' + name + '<small>' + iso + ' · alphabetical navigation</small></span><span class="elu-fallback-country-state is-gap">Evidence withheld</span></button></li>';
    }).join('');
    this._filterFallbackEntries($('globe-fallback-search')?.value || '');
    return true;
  },

`,
    'neutral fallback list');
  globe = replaceSection(globe,
    '  _renderFallbackCountry(iso, focusDetail) {',
    '  hideFallback(options = {}) {',
    `  _renderFallbackCountry(iso, focusDetail) {
    const entry = this._fallbackEntries.find(item => item.country.iso_alpha3 === iso);
    const detail = $('globe-fallback-country-detail');
    const list = $('globe-fallback-country-list');
    if (!entry || !detail || !list) return false;
    this._fallbackSelectedIso = iso;
    list.querySelectorAll('[data-fallback-country-iso]').forEach(row => {
      if (row.getAttribute('data-fallback-country-iso') === iso) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
    const name = _escapeHtml(entry.country.name);
    const code = _escapeHtml(entry.country.iso_alpha3);
    detail.innerHTML = '<h3 id="globe-fallback-detail-title">' + name + '</h3><span class="elu-fallback-detail-badge">' + code + ' · evidence withheld</span><p class="elu-fallback-detail-value"><strong>No country climate value shown</strong></p><p>This neutral navigation state does not indicate better or worse climate performance.</p><h4>Assessment boundary</h4><p>Commitment, target, ambition, delivery, finance, rating, emissions, performance, impact band, and climate score are withheld.</p><button type="button" class="elu-fallback-back-to-list" data-globe-fallback-action="list">Back to ' + name + ' in the list</button>';
    if (focusDetail) detail.focus({ preventScroll: true });
    return true;
  },

`,
    'neutral fallback detail');
  globe = replaceSection(globe,
    '  setTheme(theme) {',
    '  // Compatibility entry point retained',
    `  setTheme(theme) {
    if (!this.world) return false;
    const themeConfig = _getGlobeThemeConfig(theme);
    safeChain(this.world, 'Globe.theme')
      .globeImageUrl(null)
      .backgroundImageUrl(null)
      .backgroundColor(themeConfig.backgroundColor)
      .atmosphereColor(themeConfig.atmosphere)
      .atmosphereAltitude(themeConfig.atmosphereAltitude);
    const material = this.world.globeMaterial?.();
    if (material) {
      material.map = null;
      material.bumpMap = null;
      if (material.color?.setHex) material.color.setHex(themeConfig.globeColor);
      material.needsUpdate = true;
    }
    return true;
  },

`,
    'solid theme method');
  globe = replaceSection(globe,
    '  // CT-42 candidate: factual magnitude only.',
    '  _updateRankRail() {',
    `  // Uniform neutral country surface. No climate quantity controls color or height.
  _countryHexColorFn() {
    return 'rgba(145,160,172,0.34)';
  },

  _countryHexAltitudeFn() {
    return 0.004;
  },

  _buildCountryDeck() {
    const featureByIso = this._featureByIso || {};
    this._countryDeck = Object.keys(featureByIso)
      .filter(iso => iso && iso !== 'UNK' && iso !== '-99' && iso !== 'ATA')
      .map(iso => {
        const feature = featureByIso[iso];
        const data = _getCountryDisplayData(feature);
        return { iso, feature, data, country: data?.country || iso, rank: null };
      })
      .filter(entry => entry.feature && entry.data)
      .sort((a, b) => String(a.country).localeCompare(String(b.country)) || a.iso.localeCompare(b.iso));
  },

  _renderRankRail() {
    const previous = $('elu-country-rank-rail');
    if (previous) previous.remove();
    if (!document.body || this._countryDeck.length !== EXPECTED_INTERACTIVE_ENTITY_COUNT) {
      this._rankRail = null;
      return;
    }
    const rail = document.createElement('aside');
    rail.id = 'elu-country-rank-rail';
    rail.setAttribute('aria-label', 'Alphabetical country navigation; climate evidence withheld for every entity');
    const rows = this._countryDeck.map((entry, index) => '<button type="button" class="elu-rank-row" data-country-rail-iso="' + _escapeHtml(entry.iso) + '" aria-label="' + _escapeHtml(entry.country) + ', alphabetical position ' + (index + 1) + ' of 201, climate evidence withheld"><span class="elu-rank-number">' + (index + 1) + '</span><span class="elu-rank-dot" aria-hidden="true"></span><span class="elu-rank-name">' + _escapeHtml(entry.country) + '</span><span class="elu-rank-code">' + _escapeHtml(entry.iso) + '</span><span class="elu-rank-gap">Withheld</span></button>').join('');
    rail.innerHTML = '<div class="elu-rank-head"><div><div class="elu-rank-title">A–Z country navigation</div><div class="elu-rank-subtitle">201 neutral entities · evidence withheld</div></div><button type="button" class="elu-rank-toggle" aria-label="Collapse alphabetical country navigation" aria-expanded="true">−</button></div><div class="elu-rank-list"><div class="elu-rank-disclosure">173 retained polygons + 28 approximate small-state points</div><div role="list" aria-label="Countries in alphabetical order">' + rows + '</div></div>';
    rail.addEventListener('click', event => {
      const toggle = event.target.closest('.elu-rank-toggle');
      if (toggle) {
        const collapsed = rail.classList.toggle('is-collapsed');
        toggle.textContent = collapsed ? '+' : '−';
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.setAttribute('aria-label', collapsed ? 'Expand alphabetical country navigation' : 'Collapse alphabetical country navigation');
        return;
      }
      const row = event.target.closest('[data-country-rail-iso]');
      if (!row) return;
      const feature = this._featureByIso?.[row.getAttribute('data-country-rail-iso')];
      if (feature) this._selectCountryFeature(feature, { focus: true });
    });
    document.body.appendChild(rail);
    this._rankRail = rail;
  },

`,
    'alphabetical navigation deck');
  globe = replaceOnce(globe,
    `  selectDefaultCountry() {
    if (this._selectedCountryFeature || this._defaultCountrySelected || !this._countryDeck.length) return;
    const entry = this._countryDeck[0];
    if (!entry?.feature) return;
    this._defaultCountrySelected = true;
    this._selectCountryFeature(entry.feature, { focus: false });
  },`,
    `  selectDefaultCountry() {
    return false;
  },`,
    'no default dialog');
  globe = replaceSection(globe,
    '  _renderCountryInfoCard(feature, selected) {',
    '  // ── Card deck navigation',
    `  _renderCountryInfoCard(feature, selected) {
    const d = _getCountryDisplayData(feature);
    if (!d) return;
    let tt = $('hex-country-tooltip');
    if (!tt) {
      tt = document.createElement('div');
      tt.id = 'hex-country-tooltip';
      document.body.appendChild(tt);
    }
    if (!this._countryTooltipBound) {
      this._countryTooltipBound = true;
      tt.addEventListener('click', event => {
        if (event.target.closest('[data-country-close]')) {
          event.preventDefault();
          event.stopPropagation();
          this.clearCountrySelection();
          return;
        }
        const nav = event.target.closest('[data-country-nav]');
        if (nav) {
          event.preventDefault();
          event.stopPropagation();
          this.navigateCountry(parseInt(nav.getAttribute('data-country-nav'), 10) || 1);
        }
      });
      window.addEventListener('resize', () => {
        if (tt.classList.contains('selected') && tt.classList.contains('visible')) this._dockCountryCard();
      });
    }
    const approximatePointNote = feature?.properties?.__smallNation
      ? '<div class="tt-detail">Approximate navigation point; not a boundary or precise centroid.</div>'
      : '';
    if (selected) {
      const wrap = this._ensureCountryCardWrap(tt);
      if (wrap) {
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.setAttribute('aria-labelledby', 'country-card-heading');
      }
    } else {
      this._unmountCountryCard();
    }
    tt.classList.toggle('selected', !!selected);
    tt.setAttribute('aria-hidden', 'false');
    tt.dataset.status = 'withheld';
    if (selected) tt.removeAttribute('role');
    else tt.setAttribute('role', 'tooltip');
    if (selected) tt.removeAttribute('aria-label');
    else tt.setAttribute('aria-label', d.country + ', country climate evidence withheld');
    if (!selected) tt.removeAttribute('tabindex');
    let html = '<div class="tt-topline">'
      + (selected ? '<h2 class="tt-country" id="country-card-heading" tabindex="-1">' + _escapeHtml(d.country) + '</h2>' : '<div class="tt-country">' + _escapeHtml(d.country) + '</div>')
      + '<div class="tt-pill tt-status-neutral">Country evidence withheld</div>'
      + (selected ? '<button type="button" class="tt-close" data-country-close aria-label="Close">✕</button>' : '')
      + '</div><div class="tt-detail">No country climate values are loaded.</div>'
      + approximatePointNote;
    if (!selected) html += '<div class="tt-comment">' + _escapeHtml(_getCountryGaiaComment(d)) + '</div>';
    else html += this._renderCountryMetrics(d);
    tt.innerHTML = html;
    tt.classList.add('visible');
  },

`,
    'neutral country card');
  globe = replaceSection(globe,
    '  _renderCountryMetrics(d) {',
    '  // ── Project markers:',
    `  _renderCountryMetrics() {
    return '<div class="tt-comment" style="margin-top:8px"><strong>Evidence withheld.</strong> No country climate value, ranking, target, delivery assessment, performance judgment, finance claim, rating, impact band, or climate score is available in this rollback state.</div>'
      + _renderCountryTrajectory()
      + '<div class="tt-hint">Alphabetical navigation · ← → · esc closes</div>';
  },

`,
    'neutral country metrics');
  globe = replaceSection(globe,
    '  _countryPolygonPaintColorFn(feature) {',
    '  _supportsCountryBorders() {',
    `  _countryPolygonPaintColorFn(feature) {
    const hovered = feature === this._countryHoverFeature;
    const selected = feature === this._selectedCountryFeature;
    const alpha = feature?.properties?.__smallNation
      ? (hovered ? 0.96 : (selected ? 0.90 : 0.82))
      : (hovered ? 0.46 : (selected ? 0.40 : 0.32));
    return 'rgba(145,160,172,' + alpha + ')';
  },

`,
    'uniform country paint');
  globe = replaceSection(globe,
    '  /**\n   * Swap the globe\'s surface texture.',
    '  _bindCanvasDragGuard() {',
    `  // Compatibility APIs remain callable but cannot introduce image textures
  // while the rollback surface is active.
  setGlobeTexture() {
    return false;
  },

  restoreDefaultTexture() {
    if (!this.world) return false;
    const themeConfig = _getGlobeThemeConfig(document.documentElement?.dataset?.theme);
    safeChain(this.world, 'Globe.restoreDefaultTexture').globeImageUrl(null).backgroundImageUrl(null);
    const material = this.world.globeMaterial?.();
    if (material) {
      material.map = null;
      material.bumpMap = null;
      if (material.color?.setHex) material.color.setHex(themeConfig.globeColor);
      material.needsUpdate = true;
    }
    return true;
  },

  setGlobeTextureFromCanvas() {
    return false;
  },

  setOnGlobeClick(fn) {
    _globeClickHandler = fn;
    console.log('[Globe] Click handler', fn ? 'SET' : 'CLEARED');
  },

  clearOnGlobeClick() {
    _globeClickHandler = null;
    console.log('[Globe] Click handler CLEARED');
  },

`,
    'solid texture compatibility APIs');
  globe = replaceOnce(globe,
    `      countryFeatureCount: this._countryFeatures?.length || 0,
      countryDeckCount: this._countryDeck.length,`,
    `      countryFeatureCount: this._countryFeatures?.length || 0,
      retainedPolygonCount: this._countryFeatures?.filter(feature => !feature?.properties?.__smallNation).length || 0,
      smallNationPointCount: this._countryFeatures?.filter(feature => feature?.properties?.__smallNation).length || 0,
      countryDeckCount: this._countryDeck.length,
      countryDeckAlphabetical: this._countryDeck.every((entry, index, deck) => index === 0 || String(deck[index - 1].country).localeCompare(String(entry.country)) <= 0),
      neutralEntityCount: this._countryDeck.filter(entry => entry.data?.evidenceState === 'withheld' && entry.data?.emissions === null).length,`,
    'neutral getState boundary');
  globe = replaceSection(globe,
    '  getRuntimeTextureState() {',
    '\n};\n\n// ═══════════════════════════════════════════════\n// PANEL',
    `  getRuntimeTextureState() {
    const material = this.world?.globeMaterial?.();
    return {
      surface: material?.map?.image ? { src: material.map.image.currentSrc || material.map.image.src || '' } : null,
      bump: material?.bumpMap?.image ? { src: material.bumpMap.image.currentSrc || material.bumpMap.image.src || '' } : null,
      sky: null,
      backgroundImageConfigured: false,
    };
  },
`,
    'neutral runtime texture state');
  return Buffer.from(globe);
}

function neutralServiceWorker(bytes) {
  let sw = bytes.toString('utf8');
  sw = replaceSection(sw,
    '/**',
    '\nconst STATIC_ASSETS = [',
    `/**
 * Service Worker — Earth Love United
 * Network-first code/data with a v34 rollback cache. The denied candidate and
 * all globe image assets are excluded; only pinned local geometry remains.
 */
const CACHE_NAME = '${CACHE_NAME}';`,
    'rollback service worker header');
  const removals = [
    "  '/assets/globe/runtime/manifest.json',\n",
    "  '/assets/globe/runtime/earth-night.jpg?v=373e5a08c9f3',\n",
    "  '/assets/globe/runtime/night-sky.png?v=7e1d5e780301',\n",
    "  '/assets/globe/runtime/earth-blue-marble.jpg?v=228deba2e4b6',\n",
    "  '/assets/globe/runtime/earth-topology.png?v=839b12da2e4d',\n",
    "  '/data/climate/runtime/country-factual-candidate.json?v=ct42candidate1',\n",
  ];
  for (const line of removals) sw = replaceOnce(sw, line, '', `remove precache ${line.trim()}`);
  sw = replaceOnce(sw, "'/css/globe-system.css?v=v19'", "'/css/globe-system.css?v=ct42-neutral-rollback-1'", 'rollback CSS precache');
  sw = replaceOnce(sw, "'/js/data.js?v=v2'", "'/js/data.js?v=ct42-neutral-rollback-1'", 'rollback data precache');
  sw = replaceOnce(sw, "'/js/globe.js?v=v13'", "'/js/globe.js?v=ct42-neutral-rollback-1'", 'rollback globe precache');
  sw = replaceOnce(sw, "'/data/carbon-projects.json?v=ct42candidate1'", "'/data/carbon-projects.json?v=ct42-neutral-rollback-1'", 'rollback carbon data key');
  return Buffer.from(sw);
}

function neutralSmokeTest(bytes) {
  const current = bytes.toString('utf8');
  for (const token of ['const SmokeTest = (() => {', 'SmokeTest.run()', 'window.SmokeTest = SmokeTest;']) {
    assert.ok(current.includes(token), `current SmokeTest contract drift: ${token}`);
  }
  return Buffer.from(`/**
 * SMOKE TEST SUITE — CT-42 neutral rollback surface
 * Run in browser console: SmokeTest.run()
 */
const SmokeTest = (() => {
  let results = [];
  let running = false;
  const test = (category, name, critical, fn) => ({ category, name, critical, fn });
  const appApis = ${JSON.stringify(APP_CALLED_GLOBE_APIS)};
  const lifecycleApis = ${JSON.stringify(REQUIRED_GLOBE_LIFECYCLE_APIS)};
  const tests = [
    test('modules', 'Core modules on window', true, () => {
      const required = ['Data', 'GlobeModule', 'CARBON_CLOCK', 'App', 'EventBus', 'MODULE_CONTRACTS', 'STORAGE_ADAPTER', 'Storage', 'DATA_SCHEMA'];
      const missing = required.filter(name => typeof window[name] === 'undefined');
      return { pass: missing.length === 0, detail: missing.length ? 'Missing: ' + missing.join(', ') : 'All core and infrastructure modules present' };
    }),
    test('modules', 'App-called GlobeModule APIs remain compatible', true, () => {
      const required = appApis.concat(lifecycleApis);
      const missing = required.filter(name => typeof window.GlobeModule?.[name] !== 'function');
      return { pass: missing.length === 0 && GlobeModule._initialized === true, detail: missing.length ? 'Missing: ' + missing.join(', ') : 'All App calls and lifecycle APIs callable; renderer init returned boolean true' };
    }),
    test('data', 'Neutral rollback keeps all climate evidence withheld', true, () => {
      const pass = Data.climateCandidate === null && Data.climateCountries === null && Data.getClimateCountry('CHN') === null && Data.getClimateRanking() === null && Data.climateCandidateState === 'withheld' && Data.isClimateCandidateReady() === false;
      return { pass, detail: pass ? 'No candidate, ranking, country climate value, or release state is loaded' : JSON.stringify(Data.getState()) };
    }),
    test('runtime', 'Exact neutral country navigation boundary', true, () => {
      const state = GlobeModule.getState();
      const pass = state.runtimeAssetsPrepared === true && state.countryFeatureCount === 201 && state.retainedPolygonCount === 173 && state.smallNationPointCount === 28 && state.countryDeckCount === 201 && state.neutralEntityCount === 201;
      return { pass, detail: pass ? '201 = 173 retained polygons + 28 approximate points; all neutral' : JSON.stringify(state) };
    }),
    test('runtime', 'Neutral country deck is alphabetical', true, () => {
      const names = GlobeModule._countryDeck.map(entry => entry.country + '|' + entry.iso);
      const sorted = names.slice().sort((a, b) => a.split('|')[0].localeCompare(b.split('|')[0]) || a.split('|')[1].localeCompare(b.split('|')[1]));
      const pass = names.length === 201 && names.every((name, index) => name === sorted[index]) && GlobeModule.getState().countryDeckAlphabetical === true;
      return { pass, detail: pass ? 'All 201 entities ordered by country name then ISO' : 'Alphabetical order drift' };
    }),
    test('runtime', 'Every interactive entity is evidence-withheld', true, () => {
      const leaked = GlobeModule._countryDeck.filter(entry => entry.data?.evidenceState !== 'withheld' || entry.data?.hasData !== false || entry.data?.emissions !== null);
      return { pass: leaked.length === 0, detail: leaked.length ? leaked.length + ' non-neutral entities' : 'No climate values, ranks, or assessments in the deck' };
    }),
    test('runtime', 'Solid globe and background have no image textures', true, () => {
      const texture = GlobeModule.getRuntimeTextureState();
      const pass = texture.surface === null && texture.bump === null && texture.sky === null && texture.backgroundImageConfigured === false;
      return { pass, detail: pass ? 'Solid material and solid background; surface, bump, and sky maps absent' : JSON.stringify(texture) };
    }),
    test('runtime', 'Exactly one live renderer canvas exists', true, () => {
      const canvases = document.querySelectorAll('#globeViz canvas').length;
      return { pass: GlobeModule._initialized === true && canvases === 1, detail: canvases + ' canvas element(s)' };
    }),
    test('runtime', 'Alphabetical rail exposes all neutral entities', true, () => {
      const rail = document.getElementById('elu-country-rank-rail');
      const rows = rail?.querySelectorAll('[data-country-rail-iso]').length || 0;
      const pass = rows === 201 && /Alphabetical country navigation/.test(rail?.getAttribute('aria-label') || '');
      return { pass, detail: pass ? '201 neutral A–Z controls' : rows + ' controls' };
    }),
    test('runtime', 'Disputed subfeatures remain excluded', true, () => {
      const prohibited = new Set(['N. Cyprus', 'Northern Cyprus', 'Somaliland', 'Kosovo']);
      const leaked = GlobeModule.getCountryFeatures().filter(feature => [feature?.properties?.ADMIN, feature?.properties?.NAME].some(name => prohibited.has(name)));
      return { pass: leaked.length === 0, detail: leaked.length ? leaked.length + ' prohibited subfeatures' : 'No disputed subfeature inherits an interactive entity' };
    }),
    test('interaction', 'Country card is not open by default', true, () => {
      const dialogs = document.querySelectorAll('#elu-country-card-wrap[role="dialog"][aria-modal="true"]');
      return { pass: dialogs.length === 0, detail: dialogs.length ? 'Unexpected default dialog' : 'No country dialog before user action' };
    }),
    test('interaction', 'Fallback remains body-level and inert while closed', true, () => {
      const panel = document.getElementById('globe-fallback');
      const pass = panel?.parentElement === document.body && panel.hidden && panel.getAttribute('aria-hidden') === 'true';
      return { pass, detail: pass ? 'Body-level fallback is hidden and inert' : 'Fallback containment/state drift' };
    }),
    test('interaction', 'Neutral evidence browser entry control is enabled', true, () => {
      const button = document.getElementById('globe-evidence-browse');
      const pass = button && !button.disabled && button.getAttribute('aria-label') === 'Browse 201 neutral navigation entities';
      return { pass, detail: pass ? '201-entity neutral browser is available from the live renderer' : 'Neutral browser control unavailable' };
    }),
    test('accessibility', 'Critical controls retain minimum target size', true, () => {
      const controls = [...document.querySelectorAll('#topbar button,#globe-back-btn,#elu-country-rank-rail button')].filter(element => getComputedStyle(element).display !== 'none');
      const undersized = controls.filter(element => { const rect = element.getBoundingClientRect(); return rect.width < 44 || rect.height < 44; });
      return { pass: undersized.length === 0, detail: undersized.length ? undersized.map(element => element.id || element.className).join(', ') : 'All visible critical controls are at least 44px' };
    }),
    test('stacking', 'No invisible fullscreen blockers', true, () => {
      const blockers = [...document.querySelectorAll('*')].filter(element => {
        const style = getComputedStyle(element);
        return style.position === 'fixed' && style.pointerEvents !== 'none' && style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) < 0.1 && element.offsetWidth > innerWidth * 0.8 && element.offsetHeight > innerHeight * 0.8;
      });
      return { pass: blockers.length === 0, detail: blockers.length ? blockers.map(element => element.id || element.tagName).join(', ') : 'No invisible fullscreen blockers' };
    }),
    test('resources', 'Runtime made no candidate or globe-image request', true, () => {
      const names = performance.getEntriesByType('resource').map(entry => entry.name);
      const forbidden = ['country-factual-candidate.json', 'earth-night.jpg', 'night-sky.png', 'earth-blue-marble.jpg', 'earth-topology.png'];
      const leaked = names.filter(name => forbidden.some(token => name.includes(token)));
      return { pass: leaked.length === 0, detail: leaked.length ? leaked.join(', ') : 'No candidate JSON or globe image request observed' };
    }),
    test('resources', 'Runtime resource loads remain same-origin', true, () => {
      const external = performance.getEntriesByType('resource').map(entry => entry.name).filter(name => { try { return new URL(name, location.href).origin !== location.origin; } catch { return false; } });
      return { pass: external.length === 0, detail: external.length ? external.join(', ') : 'No remote runtime resource request observed' };
    }),
    test('resources', 'CSP keeps globe data and images same-origin', true, () => {
      const content = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') || '';
      const pass = content.includes("connect-src 'self';") && content.includes("img-src 'self' data:;");
      return { pass, detail: pass ? 'connect/img policies remain same-origin' : 'CSP boundary drift' };
    }),
  ];

  async function run(category = null) {
    if (running) return { passed: 0, failed: 1, criticalFailed: 1, results: [{ pass: false, detail: 'Already running' }] };
    running = true;
    results = [];
    for (const item of tests.filter(entry => !category || entry.category === category)) {
      try {
        const outcome = await item.fn();
        results.push({ category: item.category, name: item.name, critical: item.critical, ...outcome });
      } catch (error) {
        results.push({ category: item.category, name: item.name, critical: item.critical, pass: false, detail: 'THREW: ' + error.message });
      }
    }
    running = false;
    const passed = results.filter(result => result.pass).length;
    const failed = results.length - passed;
    const criticalFailed = results.filter(result => !result.pass && result.critical).length;
    if (failed) console.error('[SmokeTest] ' + passed + '/' + results.length + ' passed; ' + criticalFailed + ' critical failures');
    else console.log('[SmokeTest] ' + passed + '/' + results.length + ' all tests passed');
    return { passed, failed, criticalFailed, results: results.slice() };
  }

  return {
    run,
    table() { console.table(results); },
    get results() { return results.slice(); },
    get categories() { return [...new Set(tests.map(entry => entry.category))]; },
  };
})();
window.SmokeTest = SmokeTest;
`);
}

function rollbackTargets(current) {
  const targets = { ...current };
  targets['index.html'] = neutralIndex(current['index.html']);
  targets['css/globe-system.css'] = neutralCss(current['css/globe-system.css']);
  targets['js/data.js'] = neutralData(current['js/data.js']);
  targets['js/globe.js'] = neutralGlobe(current['js/globe.js']);
  targets['sw.js'] = neutralServiceWorker(current['sw.js']);
  targets['tools/smoke-test.js'] = neutralSmokeTest(current['tools/smoke-test.js']);
  assert.deepEqual(targets['js/app.js'], current['js/app.js'], 'App compatibility control must remain byte-identical');
  return targets;
}

function buildPatch(current, targets) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-ct42-neutral-rollback-build-'));
  try {
    git(['init', '-q'], { cwd: temp });
    git(['config', 'user.name', 'Earth Love United rollback builder'], { cwd: temp });
    git(['config', 'user.email', 'rollback-builder@invalid.example'], { cwd: temp });
    PATCH_FILES.forEach(relative => write(temp, relative, current[relative]));
    git(['add', '--', ...PATCH_FILES], { cwd: temp });
    git(['commit', '-q', '-m', 'candidate surface'], { cwd: temp });
    PATCH_FILES.forEach(relative => write(temp, relative, targets[relative]));
    const patch = git(['diff', '--binary', '--full-index', '--no-ext-diff', '--', ...PATCH_FILES], { cwd: temp });
    assert.ok(patch.length > 0, 'rollback patch unexpectedly empty');
    const changed = git(['diff', '--name-only', '--', ...PATCH_FILES], { cwd: temp, encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
    assert.deepEqual(changed.sort(), [...PATCH_FILES].sort(), 'rollback patch file coverage drift');
    return patch;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

const current = Object.fromEntries(CONTROL_FILES.map(relative => {
  const bytes = fs.readFileSync(path.join(ROOT, relative));
  assert.deepEqual(bytes, gitFile(RUNTIME_CONTROL_COMMIT, relative), `${relative} no longer matches the exact hardened runtime-control commit`);
  return [relative, bytes];
}));
const dependencyBytes = Object.fromEntries(RUNTIME_DEPENDENCIES.map(dependency => {
  const bytes = fs.readFileSync(path.join(ROOT, dependency.path));
  if (dependency.path !== EXPECTED_VENDOR_SPEC.destination) {
    assert.deepEqual(bytes, gitFile(RUNTIME_CONTROL_COMMIT, dependency.path), `${dependency.path} no longer matches the exact hardened runtime-control commit`);
  }
  return [dependency.path, bytes];
}));
const targets = rollbackTargets(current);
const patch = buildPatch(current, targets);
const encodedPatch = encodePatchArtifact(patch);

const ct40Path = 'data/climate/reviews/ct42-ct40-release-review-result.json';
const manifestPath = 'data/climate/runtime/candidate-manifest.json';
const runtimePath = 'data/climate/runtime/country-factual-candidate.json';
const rollbackPlanPath = 'data/climate/runtime/rollback-plan.json';
const ct40 = JSON.parse(fs.readFileSync(path.join(ROOT, ct40Path)));
const ct40Bytes = fs.readFileSync(path.join(ROOT, ct40Path));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, manifestPath)));
assertReviewChainCommit(reviewChainHead, ct40Path, ct40Bytes);
assert.equal(ct40.decision, 'deny');
assert.equal(ct40.decision_scope, 'assessed_climate_release');
assert.equal(ct40.eligible, false);
assert.equal(ct40.release_authority, false);
assert.equal(ct40.publication_tiers.factual_display.status, 'eligible');
assert.equal(ct40.publication_tiers.factual_display.eligible_count, 2060);
assert.equal(ct40.publication_tiers.magnitude_comparison.status, 'eligible');
assert.equal(ct40.publication_tiers.magnitude_comparison.eligible_count, 2060);
for (const tier of ['commitment_display', 'derived_metrics', 'performance_assessment', 'score']) {
  assert.equal(ct40.publication_tiers[tier].status, 'not_present');
}
assert.equal(manifest.review_status, 'not_reviewed');
assert.equal(manifest.production_runtime_release, false);
assert.equal(sha256(fs.readFileSync(path.join(ROOT, rollbackPlanPath))), ROLLBACK_PLAN_SHA256, 'rollback plan must remain byte-identical');
PROHIBITED_OUTPUTS.forEach(relative => assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `${relative} must remain absent`));

const roles = {
  'index.html': 'neutral_public_copy_and_v34_registration',
  'css/globe-system.css': 'neutral_accessible_presentation',
  'js/data.js': 'withheld_country_climate_adapter',
  'js/globe.js': 'hardened_neutral_globe_runtime',
  'js/app.js': 'unchanged_app_globe_compatibility_pin',
  'sw.js': 'v34_cache_and_precache_exclusions',
  'tools/smoke-test.js': 'rollback_browser_runtime_assertions',
};

const proof = {
  schema_version: '2.3.0',
  proof_id: 'ct-42-neutral-runtime-rollback-rehearsal-2026-07-15',
  status: 'built_not_reviewed_browser_gate_required',
  release_authority: false,
  deploy_authority: false,
  review: {
    status: 'not_reviewed',
    builder_id: 'ct-42-neutral-rollback-builder',
    reviewer_id: null,
    reviewed_at: null,
    independent_review_required: true,
  },
  candidate: {
    builder_commit: CANDIDATE_BUILDER_COMMIT,
    runtime_control_commit: RUNTIME_CONTROL_COMMIT,
    review_chain_head: reviewChainHead,
    review_chain_late_bound: reviewChainHead === null,
    review_chain_ct40_sha256: reviewChainHead === null ? null : sha256(ct40Bytes),
    candidate_id: 'ct-42-factual-runtime-candidate-2026-07-15',
    decision: 'deny',
    decision_scope: 'assessed_climate_release',
    publication_tiers: Object.fromEntries(Object.entries(ct40.publication_tiers).map(([tier, state]) => [tier, {
      status: state.status,
      eligible_count: state.eligible_count,
      blocked_count: state.blocked_count,
    }])),
    release_eligible: false,
    production_runtime_release: false,
    candidate_manifest: { path: manifestPath, sha256: sha256(fs.readFileSync(path.join(ROOT, manifestPath))) },
    runtime_data: { path: runtimePath, sha256: sha256(fs.readFileSync(path.join(ROOT, runtimePath))) },
    ct40_result: { path: ct40Path, sha256: sha256(fs.readFileSync(path.join(ROOT, ct40Path))) },
    rollback_plan: { path: rollbackPlanPath, sha256: ROLLBACK_PLAN_SHA256 },
  },
  rollback: {
    strategy: 'current_hardened_runtime_to_neutral_surface',
    source_runtime_commit: RUNTIME_CONTROL_COMMIT,
    baseline_commit: null,
    cache_name: CACHE_NAME,
    service_worker_registration: SERVICE_WORKER_REGISTRATION,
    workspace_mutation: false,
    entity_boundary: {
      total: 201,
      retained_natural_earth_polygons: 173,
      approximate_small_state_points: 28,
      ordering: 'alphabetical_country_name_then_iso',
      climate_values: 0,
      evidence_state: 'withheld_for_all',
    },
    runtime_resources: {
      geometry: '/assets/globe/runtime/ne_110m_admin_0_countries.geojson?v=a4d67eac9c75',
      surface: 'solid_color',
      background: 'solid_color',
      remote_runtime_urls: [],
      candidate_json_precached: false,
      visual_assets_precached: false,
    },
    app_globe_compatibility: {
      app_path: 'js/app.js',
      app_sha256: sha256(targets['js/app.js']),
      app_called_apis: APP_CALLED_GLOBE_APIS,
      lifecycle_apis: REQUIRED_GLOBE_LIFECYCLE_APIS,
      boolean_init_required: true,
    },
    patch: {
      path: PATCH_PATH,
      encoding: 'base64',
      sha256: sha256(encodedPatch),
      decoded_sha256: sha256(patch),
      changed_files: PATCH_FILES,
    },
    controls: CONTROL_FILES.map(relative => ({
      path: relative,
      role: roles[relative],
      changed: PATCH_FILES.includes(relative),
      candidate_sha256: sha256(current[relative]),
      rollback_sha256: sha256(targets[relative]),
    })),
    runtime_dependency_closure: RUNTIME_DEPENDENCIES.map(dependency => ({
      path: dependency.path,
      role: dependency.role,
      source_commit: dependency.path === EXPECTED_VENDOR_SPEC.destination ? null : RUNTIME_CONTROL_COMMIT,
      source_sha256: sha256(dependencyBytes[dependency.path]),
      materialized_sha256: sha256(dependencyBytes[dependency.path]),
    })),
    runtime_exclusions: RUNTIME_EXCLUSIONS,
    assertions: [
      'rollback targets are deterministic transformations of the pinned current hardened runtime, not a historical baseline transplant',
      'App is byte-identical and every App-called Globe API plus reset/destroy/getState remains callable',
      'GlobeModule.init retains a boolean success boundary and renderer failure stays fail-closed',
      'exact 201 alphabetical neutral entities equal 173 retained polygons plus 28 approximate navigation points',
      'all country climate values, rankings, trajectories, status distinctions, and performance implications are absent',
      'solid globe and background use no image textures; geometry remains pinned and same-origin',
      'the root PWA manifest remains byte-identical to the hardened runtime and is included in the materialized dependency closure',
      'service-worker cache is v34 and candidate JSON plus all globe visual assets are absent from pre-cache',
      'browser-ready materialization requires all 14 pinned runtime dependencies, including the verified local renderer',
      'rollback plan bytes, CT-40 DENY, and no-release/no-deploy authority remain unchanged',
      'the static checker proves exact temporary-site materialization but browser execution remains an external required gate with independently reviewed evidence',
    ],
  },
  prohibited_outputs: PROHIBITED_OUTPUTS,
  execution: {
    builder: 'node tools/build-ct42-runtime-rollback-proof.js',
    command: 'node tools/rehearse-ct42-runtime-rollback.js',
    materialize_temporary_site: 'node tools/rehearse-ct42-runtime-rollback.js --site /absolute/new/temp/directory',
    checker: 'node tools/check-ct42-runtime-rollback-proof.js',
    builder_requires_git_objects: [RUNTIME_CONTROL_COMMIT],
    late_bound_regeneration: reviewChainHead === null
      ? 'rerun builder with --review-chain-head <final exact review-chain commit>, then refresh checker pins after final CT-40 DENY regeneration'
      : null,
    browser_rehearsal: [
      'serve the materialized temporary site from localhost with service workers blocked or a fresh origin',
      'await App and Data.climateCandidateState === withheld',
      'call App.enterGlobe() and require boolean true',
      'require one canvas; 173 retained polygons; 28 approximate points; 201 alphabetical neutral entities',
      'require getRuntimeTextureState() surface/bump/sky null and zero remote/candidate/image runtime requests',
      'exercise neutral evidence browser open/close and fallback focus restoration',
      'run SmokeTest.run() and require every result pass with failed=0 and criticalFailed=0',
      'run StackLint.audit() and require an empty issue array',
    ],
    browser_gate: {
      status: 'external_required_not_recorded',
      checker_enforced: false,
      evidence_artifact: null,
      independent_review_required: true,
      release_authority: false,
      deploy_authority: false,
    },
    mode: 'temporary_copy_only',
    writes_workspace: false,
    deploys: false,
  },
  calculation_hash: null,
};
proof.calculation_hash = calculationHash(proof);

fs.writeFileSync(path.join(ROOT, PATCH_PATH), encodedPatch);
fs.writeFileSync(path.join(ROOT, PROOF_PATH), JSON.stringify(proof, null, 2) + '\n');
process.stdout.write([
  `CT-42 neutral rollback proof built: ${proof.calculation_hash}`,
  `  patch artifact ${proof.rollback.patch.sha256}`,
  `  decoded patch ${proof.rollback.patch.decoded_sha256}`,
  `  current runtime ${RUNTIME_CONTROL_COMMIT}`,
  `  review chain ${reviewChainHead || 'late-bound (no authority)'}`,
].join('\n') + '\n');
