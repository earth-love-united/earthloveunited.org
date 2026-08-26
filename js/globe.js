// GLOBE v3.0 — Country Climate Intelligence renderer
// ═══════════════════════════════════════════════
// GLOBE — Globe.gl init, panel open/close
// ═══════════════════════════════════════════════

// Module-level closure: mode click handler lives OUTSIDE GlobeModule
// because safeChain wraps `this` in a Proxy — `this._handler` won't work
// inside chained arrow functions. This variable is shared between
// the onPointClick/onLabelClick/onGlobeClick callbacks and setOnGlobeClick.
let _globeClickHandler = null;
const GLOBE_DRAG_CLICK_THRESHOLD_PX = 6;
const GLOBE_DRAG_SUPPRESS_MS = 350;
const GLOBE_TARGET_FPS = 120;
const GLOBE_FRAME_BUDGET_MS = 1000 / GLOBE_TARGET_FPS;
const COUNTRY_GEOJSON_URL = '/assets/globe/runtime/ne_110m_admin_0_countries.geojson?v=a4d67eac9c75';
const COUNTRY_GEOJSON_TIMEOUT_MS = 8000;
const COUNTRY_GEOJSON_FEATURE_COUNT = 177;
const EXPECTED_INTERACTIVE_ENTITY_COUNT = 201;
const GLOBE_VISUAL_ASSET_TIMEOUT_MS = 8000;
const GLOBE_VISUAL_ASSETS = Object.freeze({
  darkSurface: Object.freeze({ url: '/assets/globe/runtime/earth-night.jpg?v=373e5a08c9f3', width: 3600, height: 1800 }),
  darkBackground: Object.freeze({ url: '/assets/globe/runtime/night-sky.png?v=7e1d5e780301', width: 4096, height: 2048 }),
  lightSurface: Object.freeze({ url: '/assets/globe/runtime/earth-blue-marble.jpg?v=228deba2e4b6', width: 4096, height: 2048 }),
  bump: Object.freeze({ url: '/assets/globe/runtime/earth-topology.png?v=839b12da2e4d', width: 2048, height: 1024 }),
});

// ── Point-in-polygon (ray casting) ──
function _pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function _pointInFeature(lng, lat, feature) {
  const geom = feature.geometry;
  if (!geom) return false;
  const coords = geom.coordinates;
  if (!coords) return false;
  if (geom.type === 'Polygon') {
    if (!_pointInRing(lng, lat, coords[0])) return false;
    for (let h = 1; h < coords.length; h++) {
      if (_pointInRing(lng, lat, coords[h])) return false;
    }
    return true;
  }
  if (geom.type === 'MultiPolygon') {
    for (let p = 0; p < coords.length; p++) {
      if (!_pointInRing(lng, lat, coords[p][0])) continue;
      let inHole = false;
      for (let h = 1; h < coords[p].length; h++) {
        if (_pointInRing(lng, lat, coords[p][h])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

function _findCountryAtPoint(lng, lat, features) {
  for (let i = features.length - 1; i >= 0; i--) {
    const f = features[i];
    // Small-nation dot markers: hit-test by angular distance so the hover
    // target stays comfortable even though the visual dot is ~3px.
    const p = f.properties;
    if (p && p.__smallNation) {
      const dLat = lat - p.__lat;
      let dLng = lng - p.__lng;
      if (dLng > 180) dLng -= 360;
      if (dLng < -180) dLng += 360;
      dLng *= Math.max(0.2, Math.cos(p.__lat * Math.PI / 180));
      if (dLat * dLat + dLng * dLng <= p.__hitR * p.__hitR) return f;
      continue;
    }
    if (_pointInFeature(lng, lat, f)) return f;
  }
  return null;
}

const COUNTRY_ISO_FALLBACKS = {
  France: 'FRA',
  Norway: 'NOR',
};

// These Natural Earth subfeatures must never inherit evidence from a parent
// registry entity. They remain visible only in the base texture; the assessed
// overlay excludes them and supplies no hover/card/rank interaction.
const NON_ASSESSING_MAP_AREAS = Object.freeze(new Set([
  'N. Cyprus',
  'Northern Cyprus',
  'Somaliland',
  'Kosovo',
]));

// Natural Earth 110m omits these small states. These approximate navigation
// points are only clickable affordances; they are not boundaries, sovereignty
// assertions, or precise geographic centroids.
const SMALL_NATION_NAVIGATION_POINTS = Object.freeze([
  { iso: 'AND', country: 'Andorra', lat: 42.55, lng: 1.58 },
  { iso: 'ATG', country: 'Antigua and Barbuda', lat: 17.08, lng: -61.80 },
  { iso: 'BHR', country: 'Bahrain', lat: 26.05, lng: 50.55 },
  { iso: 'BRB', country: 'Barbados', lat: 13.17, lng: -59.55 },
  { iso: 'CPV', country: 'Cabo Verde', lat: 15.10, lng: -23.62 },
  { iso: 'COM', country: 'Comoros', lat: -11.65, lng: 43.35 },
  { iso: 'DMA', country: 'Dominica', lat: 15.42, lng: -61.34 },
  { iso: 'FSM', country: 'Micronesia, Federated States of', lat: 6.92, lng: 158.25 },
  { iso: 'GRD', country: 'Grenada', lat: 12.11, lng: -61.68 },
  { iso: 'KIR', country: 'Kiribati', lat: 1.45, lng: 172.98 },
  { iso: 'KNA', country: 'Saint Kitts and Nevis', lat: 17.30, lng: -62.73 },
  { iso: 'LCA', country: 'Saint Lucia', lat: 13.90, lng: -60.97 },
  { iso: 'LIE', country: 'Liechtenstein', lat: 47.16, lng: 9.55 },
  { iso: 'MCO', country: 'Monaco', lat: 43.73, lng: 7.42 },
  { iso: 'MDV', country: 'Maldives', lat: 3.25, lng: 73.22 },
  { iso: 'MHL', country: 'Marshall Islands', lat: 7.10, lng: 171.38 },
  { iso: 'MLT', country: 'Malta', lat: 35.90, lng: 14.51 },
  { iso: 'MUS', country: 'Mauritius', lat: -20.28, lng: 57.55 },
  { iso: 'NRU', country: 'Nauru', lat: -0.52, lng: 166.93 },
  { iso: 'PLW', country: 'Palau', lat: 7.50, lng: 134.62 },
  { iso: 'SMR', country: 'San Marino', lat: 43.94, lng: 12.46 },
  { iso: 'SGP', country: 'Singapore', lat: 1.35, lng: 103.82 },
  { iso: 'STP', country: 'Sao Tome and Principe', lat: 0.33, lng: 6.73 },
  { iso: 'SYC', country: 'Seychelles', lat: -4.68, lng: 55.48 },
  { iso: 'TON', country: 'Tonga', lat: -21.18, lng: -175.20 },
  { iso: 'TUV', country: 'Tuvalu', lat: -8.52, lng: 179.20 },
  { iso: 'VCT', country: 'Saint Vincent and the Grenadines', lat: 13.25, lng: -61.20 },
  { iso: 'WSM', country: 'Samoa', lat: -13.83, lng: -171.77 },
]);

const COUNTRY_STATUS = {
  FACTUAL: 'factual',
  MISSING: 'missing',
};

const COUNTRY_STATUS_LABELS = {
  [COUNTRY_STATUS.FACTUAL]: 'Metric available',
  [COUNTRY_STATUS.MISSING]: 'Data gap',
};

const COUNTRY_STATUS_BADGE_CLASSES = {
  [COUNTRY_STATUS.FACTUAL]: 'magnitude',
  [COUNTRY_STATUS.MISSING]: 'neutral',
};

const GLOBE_FALLBACK_REASONS = Object.freeze({
  evidence_browse_requested: 'All 249 registry entities are available here, including those without reliable 1:110m geometry. The same metrics and lens summaries appear in this accessible view.',
  candidate_data_unavailable: 'Country climate intelligence is unavailable or invalid. No values are being inferred.',
  country_geometry_unavailable: 'The navigational country geometry is unavailable or invalid. The complete country evidence remains available below.',
  visual_assets_unavailable: 'One or more verified globe images could not be loaded. The complete country evidence remains available below.',
  library_load_failed: 'The 3D globe library could not be loaded. The complete country evidence remains available below.',
  library_unavailable: 'The 3D globe library is unavailable. The complete country evidence remains available below.',
  webgl_unavailable: 'This browser or device could not start WebGL. The complete country evidence remains available below.',
  globe_construction_failed: 'The 3D globe could not start safely. The complete country evidence remains available below.',
  globe_container_missing: 'The 3D globe container is unavailable. The complete country evidence remains available below.',
});

function _resolveCountryIso(feature) {
  const props = feature?.properties || {};
  if (props.ISO_A3 && props.ISO_A3 !== '-99') return props.ISO_A3;

  const names = [props.ADMIN, props.NAME, props.name].filter(Boolean);
  for (const name of names) {
    if (COUNTRY_ISO_FALLBACKS[name]) return COUNTRY_ISO_FALLBACKS[name];
  }

  return props.ISO_A3 || props.ISO_A2 || 'UNK';
}

function _isNonAssessingMapArea(feature) {
  const properties = feature?.properties || {};
  return [properties.ADMIN, properties.NAME, properties.name]
    .some(name => NON_ASSESSING_MAP_AREAS.has(name));
}

function _getCountryDisplayData(feature) {
  if (!feature) return null;
  const props = feature.properties || {};
  const iso = _resolveCountryIso(feature);
  const mapArea = props.ADMIN || props.NAME || props.name || iso;
  const lens = window.GlobeModule?.currentLens || 'carbon';
  const view = safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getCountryView', iso, lens);
  const climate = Data.getClimateIntelligenceCountry ? Data.getClimateIntelligenceCountry(iso) : null;
  const country = view?.country?.name || climate?.name || mapArea;
  return {
    iso,
    country,
    mapArea,
    mapAreaDiffers: Boolean(climate?.name && climate.name !== mapArea),
    view,
    lat: _isFiniteNumber(Number(props.__lat)) ? Number(props.__lat) : null,
    lng: _isFiniteNumber(Number(props.__lng)) ? Number(props.__lng) : null,
    hasData: view?.primary?.available === true,
    climate,
  };
}

// Polygon accessors are evaluated hundreds of times whenever globe.gl updates
// a layer. Keep that hot path on the compact visual contract instead of
// rebuilding the analyst-grade country-card model for every cap and side.
function _getCountryVisualData(feature) {
  if (!feature) return null;
  const iso = _resolveCountryIso(feature);
  const lens = window.GlobeModule?.currentLens || 'carbon';
  return safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getCountryVisual', iso, lens);
}

function _getCountryNavigationData(feature) {
  if (!feature) return null;
  const props = feature.properties || {};
  const iso = _resolveCountryIso(feature);
  const climate = Data.getClimateIntelligenceCountry ? Data.getClimateIntelligenceCountry(iso) : null;
  return {
    iso,
    country: climate?.name || props.ADMIN || props.NAME || props.name || iso,
    lat: _isFiniteNumber(Number(props.__lat)) ? Number(props.__lat) : null,
    lng: _isFiniteNumber(Number(props.__lng)) ? Number(props.__lng) : null,
  };
}

// Mapped country records may contain a deliberate focus point. Entities without
// one still need to be navigable from the full atlas, so use the small
// nation's injected point, a Natural Earth label point, or a lightweight
// geometry centroid in that order.
function _getCountryFocus(feature, data) {
  if (_isFiniteNumber(data?.lat) && _isFiniteNumber(data?.lng)) {
    return { lat: data.lat, lng: data.lng };
  }

  const props = feature?.properties || {};
  const labelLat = Number(props.LABEL_Y ?? props.label_y ?? props.latitude);
  const labelLng = Number(props.LABEL_X ?? props.label_x ?? props.longitude);
  if (_isFiniteNumber(labelLat) && _isFiniteNumber(labelLng)) {
    return { lat: labelLat, lng: labelLng };
  }

  const points = [];
  const collect = value => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      points.push(value);
      return;
    }
    value.forEach(collect);
  };
  collect(feature?.geometry?.coordinates);
  if (!points.length) return null;

  const anchorLng = points[0][0];
  const normalizedLngs = points.map(point => anchorLng + ((((point[0] - anchorLng) + 540) % 360) - 180));
  const lng = normalizedLngs.reduce((sum, value) => sum + value, 0) / normalizedLngs.length;
  const lat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  return { lat, lng: ((lng + 540) % 360) - 180 };
}

function _escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function _isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function _getCountryStatusKey(d) {
  return d?.hasData ? COUNTRY_STATUS.FACTUAL : COUNTRY_STATUS.MISSING;
}

function _getCountryStatusText(d) {
  return COUNTRY_STATUS_LABELS[_getCountryStatusKey(d)];
}

function _getCountryStatusClass(d) {
  return COUNTRY_STATUS_BADGE_CLASSES[_getCountryStatusKey(d)];
}

function _getCountryStatusAttr(d) {
  return d?.hasData ? 'factual' : 'nodata';
}

const GLOBE_THEME_CONFIG = Object.freeze({
  dark: Object.freeze({
    surface: GLOBE_VISUAL_ASSETS.darkSurface.url,
    backgroundImage: GLOBE_VISUAL_ASSETS.darkBackground.url,
    backgroundColor: '#050509',
    atmosphere: '#4ecdc4',
    atmosphereAltitude: 0.25,
  }),
  light: Object.freeze({
    surface: GLOBE_VISUAL_ASSETS.lightSurface.url,
    backgroundImage: null,
    backgroundColor: '#dfe9e3',
    atmosphere: '#2fa77f',
    atmosphereAltitude: 0.33,
  }),
});

function _getGlobeThemeConfig(theme) {
  return theme === 'light' ? GLOBE_THEME_CONFIG.light : GLOBE_THEME_CONFIG.dark;
}

function _isCountryModeActive() {
  return safeGet('GLOBE_MODES', 'getMode', document.body?.dataset?.globeMode || 'countries') === 'countries';
}

function _fetchJsonWithTimeout(url, timeoutMs, cacheMode) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer;
  const options = {};
  if (controller) options.signal = controller.signal;
  if (cacheMode) options.cache = cacheMode;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Country GeoJSON timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  const request = fetch(url, options)
    .then(resp => {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    });
  return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}

function _validGeoJsonRing(ring) {
  return Array.isArray(ring) && ring.length >= 4 && ring.every(position =>
    Array.isArray(position) && position.length >= 2 &&
    Number.isFinite(position[0]) && Number.isFinite(position[1]));
}

function _validGeoJsonGeometry(geometry) {
  if (!geometry || !Array.isArray(geometry.coordinates)) return false;
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.length > 0 && geometry.coordinates.every(_validGeoJsonRing);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.length > 0 && geometry.coordinates.every(polygon =>
      Array.isArray(polygon) && polygon.length > 0 && polygon.every(_validGeoJsonRing));
  }
  return false;
}

function _validateCountryGeoJson(payload) {
  if (!payload || payload.type !== 'FeatureCollection' || !Array.isArray(payload.features) ||
      payload.features.length !== COUNTRY_GEOJSON_FEATURE_COUNT) {
    throw new Error('Country GeoJSON is not the reviewed 177-feature FeatureCollection');
  }
  payload.features.forEach((feature, index) => {
    const properties = feature?.properties;
    const requiredStrings = ['ISO_A2', 'ISO_A3', 'ADMIN', 'NAME'];
    if (feature?.type !== 'Feature' || !properties ||
        requiredStrings.some(key => typeof properties[key] !== 'string' || properties[key].length === 0) ||
        !_validGeoJsonGeometry(feature.geometry)) {
      throw new Error(`Country GeoJSON feature ${index} has an invalid identity or geometry shape`);
    }
  });
  return payload;
}

function _preloadImageAsset(asset, timeoutMs) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve(asset);
    };
    const timer = setTimeout(() => finish(new Error(`Image timeout: ${asset.url}`)), timeoutMs);
    image.onload = () => {
      if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height) {
        finish(new Error(`Image dimensions rejected: ${asset.url}`));
        return;
      }
      finish(null);
    };
    image.onerror = () => finish(new Error(`Image unavailable: ${asset.url}`));
    image.decoding = 'async';
    image.src = asset.url;
  });
}

const GlobeModule = {
  _initialized: false,
  world: null,
  userTotal: 0,
  currentLens: 'carbon', // 'carbon' | 'power' | 'physical'
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || (window.innerWidth < 768),
  _globeLoadRetries: 0,
  _canvasPointer: null,
  _suppressGlobeClickUntil: 0,
  _canvasDragGuardBound: false,
  _countryBordersVisible: false,
  _countryBorderWarned: false,
  _countryHoverClearTimer: null,
  _selectedCountryFeature: null,
  _countryDataState: 'idle',
  _countryDataError: null,
  _countryDeck: [],
  _countryDeckByLens: {},
  _rankRail: null,
  _countryCardWrap: null,
  _countryTooltipBound: false,
  _countryTooltipResizeObserver: null,
  _hoverTooltipSize: null,
  _rankRailCollapsed: false,
  _defaultCountrySelected: false,
  _countrySwipeCueShown: false,
  _countrySwipeCueToken: 0,
  _countrySwipeCueFinish: null,
  _fallbackReasonCode: null,
  _fallbackOpener: null,
  _fallbackEntries: [],
  _fallbackBound: false,
  _fallbackSelectedIso: null,
  _onFallbackClick: null,
  _onFallbackInput: null,
  _onCountryCardResize: null,
  _lensControlsBound: false,
  _reducedMotionMedia: null,
  _onReducedMotionChange: null,
  _animationPaused: false,
  _onVisibilityChange: null,
  _prepared: false,
  _preparationPromise: null,
  _preparationFailure: null,

  async prepare(options = {}) {
    if (this._prepared && !options.force) return { ok: true, reason: null };
    if (this._preparationPromise && (!options.force || !this._prepared)) return this._preparationPromise;
    if (options.force) {
      this._preparationPromise = null;
      this._prepared = false;
      this._preparationFailure = null;
      this._countryFeatures = null;
      this._featureByIso = {};
      this._countryDeck = [];
      this._countryDeckByLens = {};
      this._countryDataState = 'idle';
      this._countryDataError = null;
    }

    const promise = this._prepareRuntimeAssets(options);
    this._preparationPromise = promise;
    try {
      const result = await promise;
      if (!result.ok && this._preparationPromise === promise) this._preparationPromise = null;
      return result;
    } catch (error) {
      const result = this._failPreparation('globe_construction_failed', error);
      if (this._preparationPromise === promise) this._preparationPromise = null;
      return result;
    }
  },

  async _prepareRuntimeAssets(options) {
    if (!Data.isClimateIntelligenceReady?.() && options.reloadCandidate) {
      try {
        await Data.reloadClimateIntelligence?.();
        safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'init');
      } catch (error) {
        reportWarn('GlobeModule', 'Climate intelligence reload failed: ' + (error?.message || 'unknown error'));
      }
    }
    if (!Data.isClimateIntelligenceReady?.() || !safeGet('COUNTRY_CLIMATE_INTELLIGENCE', 'getState', {}).initialized) {
      return this._failPreparation('candidate_data_unavailable', new Error('Country Climate Intelligence candidate is unavailable or invalid'));
    }

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

    try {
      await Promise.all(Object.values(GLOBE_VISUAL_ASSETS).map(asset =>
        _preloadImageAsset(asset, GLOBE_VISUAL_ASSET_TIMEOUT_MS)));
    } catch (error) {
      return this._failPreparation('visual_assets_unavailable', error);
    }

    this._countryFeatures = countries.features.filter(feature =>
      feature.properties.ISO_A2 !== 'AQ' && !_isNonAssessingMapArea(feature) &&
      Boolean(Data.getClimateIntelligenceCountry?.(_resolveCountryIso(feature))));
    this._appendSmallNationFeatures();
    this._countryDeckByLens = {};
    const lensIds = (Data.getClimateLensCatalog?.() || []).map(lens => lens.id);
    lensIds.forEach(lensId => this._buildCountryDeck(lensId, { force: true }));
    this._countryDeck = this._countryDeckByLens[this.currentLens] || [];
    const featureIsos = this._countryFeatures.map(feature => _resolveCountryIso(feature));
    const deckIsos = this._countryDeck.map(entry => entry.iso);
    const uniqueFeatureIsos = new Set(featureIsos);
    const uniqueDeckIsos = new Set(deckIsos);
    const setsMatch = uniqueFeatureIsos.size === uniqueDeckIsos.size &&
      [...uniqueFeatureIsos].every(iso => uniqueDeckIsos.has(iso));
    if (this._countryFeatures.length !== EXPECTED_INTERACTIVE_ENTITY_COUNT ||
        uniqueFeatureIsos.size !== EXPECTED_INTERACTIVE_ENTITY_COUNT ||
        this._countryDeck.length !== EXPECTED_INTERACTIVE_ENTITY_COUNT ||
        uniqueDeckIsos.size !== EXPECTED_INTERACTIVE_ENTITY_COUNT || !setsMatch ||
        this._countryDeck.some(entry => !Data.getClimateIntelligenceCountry?.(entry.iso))) {
      return this._failPreparation('country_geometry_unavailable', new Error('Prepared country navigation deck failed its exact 201-entity registry boundary'));
    }
    this._countryDataState = 'ready';
    this._countryDataError = null;
    this._prepared = true;
    this._preparationFailure = null;
    return { ok: true, reason: null };
  },

  _failPreparation(reason, error) {
    this._prepared = false;
    this._preparationFailure = reason;
    this._countryDataState = 'unavailable';
    this._countryDataError = error?.message || reason;
    this._countryFeatures = [];
    this._featureByIso = {};
    this._countryDeck = [];
    this._countryDeckByLens = {};
    reportWarn('GlobeModule', `${reason}: ${this._countryDataError}`);
    return { ok: false, reason };
  },

  init() {
    if (!this._prepared || !this._countryFeatures?.length || !this._countryDeck?.length) {
      reportWarn('GlobeModule', 'Renderer init refused before runtime assets were prepared.');
      this.showFallback(this._preparationFailure || 'country_geometry_unavailable');
      return false;
    }
    // App lazy-loads the vendored renderer before calling init. If that load
    // failed, fail immediately into the evidence view instead of retrying a
    // missing global for 30 seconds.
    if (typeof window.Globe !== 'function') {
      reportWarn('GlobeModule', 'Globe constructor unavailable; showing the non-WebGL evidence view.');
      this.showFallback('library_unavailable');
      return false;
    }
    const el = $('globeViz');
    if (!el) {
      reportError('GlobeModule.init()', new Error('globeViz element not found'));
      this.showFallback('globe_container_missing');
      return false;
    }
    if (!this.hasWebGLSupport()) {
      reportWarn('GlobeModule', 'WebGL unavailable; showing the non-WebGL evidence view.');
      this.showFallback('webgl_unavailable');
      return false;
    }
    const themeConfig = _getGlobeThemeConfig(document.documentElement?.dataset?.theme);

    // safeChain: if any method doesn't exist, it's skipped with a dev
    // warning instead of crashing the entire init.
    let renderer;
    try {
      renderer = new window.Globe(el, {
        animateIn: true,
        waitForGlobeReady: true,
        rendererConfig: {
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        },
      });
    } catch (error) {
      reportError('GlobeModule.init()', error);
      this._teardownFailedRenderer();
      this.showFallback('globe_construction_failed');
      return false;
    }
    this.world = safeChain(renderer, 'Globe')
      .globeImageUrl(themeConfig.surface)
      .bumpImageUrl(GLOBE_VISUAL_ASSETS.bump.url)
      .backgroundImageUrl(themeConfig.backgroundImage)
      .backgroundColor(themeConfig.backgroundColor)
      .showAtmosphere(!this.isMobile).atmosphereColor(themeConfig.atmosphere).atmosphereAltitude(themeConfig.atmosphereAltitude)
      .pointsData(Data.sites || [])
      .pointLat('lat').pointLng('lng').pointAltitude(0.01).pointRadius(0.6)
      .pointColor(() => '#4ecdc4').pointResolution(this.isMobile ? 8 : 16)
      .labelsData(Data.sites || [])
      .labelLat('lat').labelLng('lng').labelText('name').labelSize(1.4)
      .labelDotRadius(0.4).labelDotOrientation(() => 'bottom')
      .labelColor(() => 'rgba(123,232,208,0.9)').labelResolution(3).labelAltitude(0.02)
      .ringsData(Data.sites || [])
      .ringLat('lat').ringLng('lng')
      .ringColor(() => t => `rgba(78,205,196,${1 - t})`)
      .ringMaxRadius(4).ringPropagationSpeed(1.5).ringRepeatPeriod(1200)
      .onPointHover(site => {
        if (site && hasModule('GAIA_NODES')) {
          GAIA_NODES.onNodeHover(site.id);
        } else if (site && hasModule('GAIA_PRESENCE')) {
          GAIA_PRESENCE.speakTeaser(site.id);
          if (hasModule('GAIA_ENGAGEMENT')) GAIA_ENGAGEMENT.interact();
        }
      })
      .onLabelHover(site => {
        if (site && hasModule('GAIA_NODES')) {
          GAIA_NODES.onNodeHover(site.id);
        } else if (site && hasModule('GAIA_PRESENCE')) {
          GAIA_PRESENCE.speakTeaser(site.id);
          if (hasModule('GAIA_ENGAGEMENT')) GAIA_ENGAGEMENT.interact();
        }
      })
      .onPointClick(site => {
        if (GlobeModule.shouldIgnoreCanvasClick()) return;
        // Mode handler intercepts ALL clicks when active
        if (_globeClickHandler && site) {
          _globeClickHandler(site.lat, site.lng);
          return;
        }
        if (hasModule('GAIA_NODES')) {
          GAIA_NODES.onNodeClick(site.id);
        } else if (hasModule('SITE_PANEL')) {
          SITE_PANEL.open(site);
        }
      })
      .onLabelClick(site => {
        if (GlobeModule.shouldIgnoreCanvasClick()) return;
        if (_globeClickHandler && site) {
          _globeClickHandler(site.lat, site.lng);
          return;
        }
        if (hasModule('GAIA_NODES')) {
          GAIA_NODES.onNodeClick(site.id);
        } else if (hasModule('SITE_PANEL')) {
          SITE_PANEL.open(site);
        }
      });
    this._animationPaused = false;

    // onGlobeClick MUST be set AFTER safeChain, directly on the world object
    // (safeChain Proxy can silently swallow unknown methods)
    if (typeof this.world.onGlobeClick === 'function') {
      this.world.onGlobeClick(({ lat, lng }) => {
        if (GlobeModule.shouldIgnoreCanvasClick()) return;
        if (_globeClickHandler) {
          _globeClickHandler(lat, lng);
        }
      });
    }

    // safeChain returns a Proxy — unwrap to get the real Globe instance
    // (the Proxy target IS the Globe, so direct property access still works)
    console.log('[Globe] init — ' + (this.world.pointsData()?.length || 0) + ' points loaded');

    // Country intelligence is rendered on the polygon layer. Project and site
    // points remain separate from every country climate record.

    // Country geometry and every globe image were prepared and validated before
    // the renderer was constructed. Activation is synchronous so render-ready
    // cannot race ahead of the country deck.
    try {
        this._bindLensControls();
        this._syncLensControls();
        this._renderLegend();
        this._renderRankRail();
        // Only build the H3 hex layer when the solid polygon-border layer is
        // NOT available (old globe.gl builds). Building world-wide hexes just
        // to clear them two calls later (applyCountrySurface) blocked the
        // main thread for seconds-to-minutes on real GPUs/DPR-2 screens.
        if (!this._supportsCountryBorders()) {
          const hexRes = this.isMobile ? 2 : 3;
          const hexMargin = this.isMobile ? 0.7 : 0.62;
          this.world
            .hexPolygonsData(this._countryFeatures)
            .hexPolygonResolution(hexRes).hexPolygonMargin(hexMargin)
            .hexPolygonUseDots(false)
            .hexPolygonColor(() => 'rgba(78,205,196,0.08)')
            .hexPolygonAltitude(() => 0.003)
            .hexPolygonCurvatureResolution(0);
        }

        // Apply country visuals only when the country tab is active. GeoJSON
        // can resolve after a fast mode switch into NDVI/events.
        const currentMode = safeGet('GLOBE_MODES', 'getMode', document.body.dataset.globeMode || 'countries');
        if (currentMode === 'countries') {
          this.applyCountrySurface();
          this.applyCountryBorders();
        } else {
          this.clearCountryBorders();
        }

        // ── Country hover/click via globe surface raycasting ──
        // Instead of per-hex hit testing (which misses gaps between hexes),
        // we raycast against the globe sphere and do point-in-polygon against
        // the GeoJSON country features. This means ANY point over a country
        // triggers hover/click, regardless of hex tile boundaries.
        this._countryHoverFeature = null;
        this._countryHoverThrottle = 0;

        // Globe surface raycasting for country detection
        this._globeRadius = this.world.getGlobeRadius();

        this._countryFeatureFromCanvasEvent = (e) => {
          const canvas = this._canvasEl;
          if (!canvas || !this._countryFeatures || !this._countryFeatures.length) return null;
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const ndcX = (x / rect.width) * 2 - 1;
          const ndcY = -(y / rect.height) * 2 + 1;

          // Raycast against globe sphere to get 3D hit point
          const camera = this.world.camera();
          if (!camera) { this._clearCountryHover(); return; }
          const r = this._globeRadius;
          const aspect = rect.width / rect.height;
          const fov = camera.fov * Math.PI / 180;
          const tanHalfFov = Math.tan(fov / 2);
          // Direction in camera space
          const dirCamX = ndcX * tanHalfFov * aspect;
          const dirCamY = ndcY * tanHalfFov;
          const dirCamZ = -1;
          // Rotate by camera quaternion to get world-space direction
          const q = camera.quaternion;
          const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
          const vx = dirCamX, vy = dirCamY, vz = dirCamZ;
          const tx = 2 * (qy * vz - qz * vy);
          const ty = 2 * (qz * vx - qx * vz);
          const tz = 2 * (qx * vy - qy * vx);
          const wx = vx + qw * tx + qy * tz - qz * ty;
          const wy = vy + qw * ty + qz * tx - qx * tz;
          const wz = vz + qw * tz + qx * ty - qy * tx;
          // Sphere intersection: |camPos + t*w|^2 = r^2
          const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
          const a = wx*wx + wy*wy + wz*wz;
          const b = 2*(ox*wx + oy*wy + oz*wz);
          const c = ox*ox + oy*oy + oz*oz - r*r;
          const disc = b*b - 4*a*c;
          if (disc < 0) return null;
          const t = (-b - Math.sqrt(disc)) / (2*a);
          if (t < 0) return null;
          const hitX = ox + t*wx, hitY = oy + t*wy, hitZ = oz + t*wz;
          // Convert 3D hit point to lat/lng using globe.gl's own method
          const geo = this.world.toGeoCoords({x: hitX, y: hitY, z: hitZ});
          if (!geo || isNaN(geo.lat) || isNaN(geo.lng)) return null;
          return _findCountryAtPoint(geo.lng, geo.lat, this._countryFeatures);
        };

        this._onCanvasPointerMove = (e) => {
          if (!this._countryFeatures || !this._countryFeatures.length) return;
          if (!_isCountryModeActive()) return;
          if (this._selectedCountryFeature) return;
          const now = Date.now();
          if (now - this._countryHoverThrottle < 30) return;
          this._countryHoverThrottle = now;

          // Find country at this lat/lng
          const feature = this._countryFeatureFromCanvasEvent(e);
          if (!feature) { this._scheduleCountryHoverClear(); return; }

          if (this._countryHoverClearTimer) {
            clearTimeout(this._countryHoverClearTimer);
            this._countryHoverClearTimer = null;
          }

          const d = _getCountryDisplayData(feature);
          if (!d) { this._scheduleCountryHoverClear(); return; }

          // Only update DOM if country changed
          if (this._countryHoverFeature !== feature) {
            this._countryHoverFeature = feature;
            this._refreshCountryBorders();
            this._renderCountryInfoCard(feature, false);
          }

          // Position tooltip
          this._positionCountryInfoCard(e);
        };

        this._onCanvasClick = (e) => {
          if (this.shouldIgnoreCanvasClick()) return;
          if (!_isCountryModeActive()) return;
          if (this._countryHoverClearTimer) {
            clearTimeout(this._countryHoverClearTimer);
            this._countryHoverClearTimer = null;
          }
          const feature = this._countryFeatureFromCanvasEvent(e);
          if (!feature) {
            this.clearCountrySelection();
            return;
          }
          const d = _getCountryDisplayData(feature);
          if (!d) return;
          this._selectCountryFeature(feature, { focus: true, event: e });
        };

        // Attach to the globe canvas
        this._canvasEl = this.world.renderer?.()?.domElement;
        if (!this._canvasEl) throw new Error('Prepared renderer did not expose a canvas');
        this._onCanvasWebGLContextLost = event => {
          event.preventDefault();
          this._teardownFailedRenderer();
          this.showFallback('webgl_unavailable');
        };
        this._canvasEl.addEventListener('webglcontextlost', this._onCanvasWebGLContextLost);
        this._bindCanvasDragGuard();
        this._canvasEl.addEventListener('pointermove', this._onCanvasPointerMove);
        this._canvasEl.addEventListener('click', this._onCanvasClick);

        // Do not auto-open a country panel. The non-modal country dialog is
        // user-triggered so it always has a real opener for focus restoration.

        // Notify mode modules that country data are ready
        safeCall('GLOBE_MODES', 'onCountryDataReady');
        if (hasModule('EventBus')) {
          EventBus.emit('globe:country-data-ready', {
            featureCount: this._countryFeatures.length,
            deckCount: this._countryDeck.length,
          });
          EventBus.emit('globe:render-ready', {
            featureCount: this._countryFeatures.length,
            deckCount: this._countryDeck.length,
            timestamp: Date.now(),
          });
        }
    } catch (error) {
      reportError('GlobeModule.initPreparedAssets()', error);
      this._prepared = false;
      this._preparationPromise = null;
      this._teardownFailedRenderer();
      this.showFallback('globe_construction_failed');
      return false;
    }

    // ── Hex country tooltip mouse tracking ──
    // (removed — tooltip positioning now handled in _onCanvasPointerMove)

    // ── Country hover helper ──
    this._clearCountryHover = () => {
      if (this._countryHoverClearTimer) {
        clearTimeout(this._countryHoverClearTimer);
        this._countryHoverClearTimer = null;
      }

      if (this._selectedCountryFeature) {
        if (this._countryHoverFeature && this._countryHoverFeature !== this._selectedCountryFeature) {
          this._countryHoverFeature = null;
          this._refreshCountryBorders();
        }
        return;
      }

      const tt = $('hex-country-tooltip');
      if (tt) tt.classList.remove('visible');
      if (this._countryHoverFeature) {
        this._countryHoverFeature = null;
        this._refreshCountryBorders();
      }
    };

    this._scheduleCountryHoverClear = () => {
      if (this._countryHoverClearTimer) return;
      this._countryHoverClearTimer = setTimeout(() => {
        this._countryHoverClearTimer = null;
        this._clearCountryHover();
      }, 90);
    };

    if (!this._countryKeydownBound) {
      this._countryKeydownBound = true;
      this._onCountryKeydown = (event) => {
        if (event.key === 'Escape' && this._selectedCountryFeature) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.clearCountrySelection();
          return;
        }
        // Arrow keys browse the pinned card deck
        if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && this._selectedCountryFeature) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.navigateCountry(event.key === 'ArrowRight' ? 1 : -1, { source: 'keyboard' });
        }
      };
      document.addEventListener('keydown', this._onCountryKeydown);
    }

    this.world.pointOfView({ lat: 20, lng: 40, altitude: 2.2 });
    this.world.controls().autoRotateSpeed = 0.4;
    this.world.controls().enableDamping = true;
    this.world.controls().dampingFactor = 0.1;
    this._bindReducedMotionPreference();
    this._bindVisibilityLifecycle();
    this._syncAnimationLifecycle();
    this._syncAutoRotation();

    const m = this.world.globeMaterial();
    // Low shininess + dark specular: the vendored globe.gl build has no
    // specularImageUrl(), so a high shininess puts a milky Phong sheen over
    // the WHOLE sphere (not just water) and washes out the night texture.
    m.bumpScale = 12; m.emissive.setHex(0x040810); m.emissiveIntensity = 0.05;
    m.shininess = 4;
    if (m.specular?.setHex) m.specular.setHex(0x0a0f14);

    // The bundled three.js uses physical light units, but globe.gl seeds its
    // default lights with legacy-style intensities pre-multiplied by π
    // (ambient 3.14, directional 1.88) — ~3x overbright, washing out the
    // night texture. The lights are added asynchronously after globe-ready,
    // so rescale on a couple of deferred ticks. The >1.5 guard makes this
    // idempotent (rescaled values are 1.0 / 0.6) and protects against a
    // future vendor bump that fixes intensities upstream.
    const _fixLights = () => {
      if (typeof this.world?.scene !== 'function') return;
      this.world.scene().traverse(o => {
        if (o.isLight && o.intensity > 1.5) o.intensity = o.intensity / Math.PI;
      });
    };
    _fixLights();
    setTimeout(_fixLights, 500);
    setTimeout(_fixLights, 2500);

    // Apply initial node visual states
    this.updateNodeVisuals();

    // Country climate point tooltips remain disabled.
    this.hideFallback({ restoreFocus: false, preserveOpener: true });
    return true;
  },

  hasWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl');
      if (!context) return false;
      const loseContext = typeof context.getExtension === 'function'
        ? context.getExtension('WEBGL_lose_context')
        : null;
      if (loseContext && typeof loseContext.loseContext === 'function') loseContext.loseContext();
      return true;
    } catch (error) {
      reportWarn('GlobeModule', 'WebGL capability check failed: ' + (error?.message || 'unknown error'));
      return false;
    }
  },

  pause() {
    if (!this.world || typeof this.world.pauseAnimation !== 'function') return false;
    if (this._animationPaused) return true;
    try {
      this.world.pauseAnimation();
      this._animationPaused = true;
      return true;
    } catch (error) {
      reportWarn('GlobeModule', 'Renderer animation could not be paused.');
      return false;
    }
  },

  resume() {
    const canRender = this.world && typeof this.world.resumeAnimation === 'function' &&
      document.visibilityState !== 'hidden' &&
      document.body?.classList.contains('globe-mode') &&
      !document.body.classList.contains('globe-fallback-active');
    if (!canRender) return false;
    if (!this._animationPaused) return true;
    try {
      this.world.resumeAnimation();
      this._animationPaused = false;
      this._syncAutoRotation();
      return true;
    } catch (error) {
      reportWarn('GlobeModule', 'Renderer animation could not be resumed.');
      return false;
    }
  },

  _syncAnimationLifecycle() {
    const shouldRender = this.world &&
      document.visibilityState !== 'hidden' &&
      document.body?.classList.contains('globe-mode') &&
      !document.body.classList.contains('globe-fallback-active');
    return shouldRender ? this.resume() : this.pause();
  },

  _bindVisibilityLifecycle() {
    this._unbindVisibilityLifecycle();
    this._onVisibilityChange = () => this._syncAnimationLifecycle();
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  },

  _unbindVisibilityLifecycle() {
    if (this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      this._onVisibilityChange = null;
    }
  },

  _syncAutoRotation() {
    const controls = typeof this.world?.controls === 'function' ? this.world.controls() : null;
    if (!controls) return false;
    const reducedMotion = this._reducedMotionMedia?.matches === true ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    const panelOpen = $('site-panel')?.classList.contains('open') === true;
    controls.autoRotate = !reducedMotion && !panelOpen && !this._selectedCountryFeature;
    return controls.autoRotate;
  },

  _bindReducedMotionPreference() {
    this._unbindReducedMotionPreference();
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    this._reducedMotionMedia = media;
    this._onReducedMotionChange = () => this._syncAutoRotation();
    if (typeof media.addEventListener === 'function') media.addEventListener('change', this._onReducedMotionChange);
    else if (typeof media.addListener === 'function') media.addListener(this._onReducedMotionChange);
  },

  _unbindReducedMotionPreference() {
    const media = this._reducedMotionMedia;
    const listener = this._onReducedMotionChange;
    if (media && listener) {
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', listener);
      else if (typeof media.removeListener === 'function') media.removeListener(listener);
    }
    this._reducedMotionMedia = null;
    this._onReducedMotionChange = null;
  },

  _teardownFailedRenderer() {
    this._unbindReducedMotionPreference();
    this._unbindVisibilityLifecycle();
    if (this._canvasEl) {
      if (this._onCanvasPointerMove) this._canvasEl.removeEventListener('pointermove', this._onCanvasPointerMove);
      if (this._onCanvasClick) this._canvasEl.removeEventListener('click', this._onCanvasClick);
      if (this._onCanvasPointerDown) this._canvasEl.removeEventListener('pointerdown', this._onCanvasPointerDown);
      if (this._onCanvasPointerMoveGuard) this._canvasEl.removeEventListener('pointermove', this._onCanvasPointerMoveGuard);
      if (this._onCanvasPointerUp) this._canvasEl.removeEventListener('pointerup', this._onCanvasPointerUp);
      if (this._onCanvasPointerCancel) this._canvasEl.removeEventListener('pointercancel', this._onCanvasPointerCancel);
      if (this._onCanvasMouseDown) this._canvasEl.removeEventListener('mousedown', this._onCanvasMouseDown);
      if (this._onCanvasMouseMoveGuard) this._canvasEl.removeEventListener('mousemove', this._onCanvasMouseMoveGuard);
      if (this._onCanvasMouseUp) this._canvasEl.removeEventListener('mouseup', this._onCanvasMouseUp);
      if (this._onCanvasWebGLContextLost) this._canvasEl.removeEventListener('webglcontextlost', this._onCanvasWebGLContextLost);
    }
    if (this.world && (typeof this.world._destructor === 'function' || typeof this.world.destroy === 'function')) {
      try {
        const destroyRenderer = typeof this.world._destructor === 'function'
          ? this.world._destructor
          : this.world.destroy;
        destroyRenderer.call(this.world);
      } catch (error) {
        reportWarn('GlobeModule', 'Failed renderer cleanup was incomplete.');
      }
    }
    this.world = null;
    this._initialized = false;
    this._animationPaused = false;
    this._canvasEl = null;
    this._onCanvasWebGLContextLost = null;
    this._canvasDragGuardBound = false;
    this._canvasPointer = null;
    if (this._countryKeydownBound && this._onCountryKeydown) {
      document.removeEventListener('keydown', this._onCountryKeydown);
      this._countryKeydownBound = false;
    }
    if (this._rankRail) {
      this._rankRail.remove();
      this._rankRail = null;
    }
    this._unmountCountryCard();
    const el = $('globeViz');
    if (el) el.replaceChildren();
  },

  teardownFailedRenderer() {
    this._teardownFailedRenderer();
    return true;
  },

  rememberFallbackOpener(element) {
    if (element instanceof HTMLElement && element !== document.body && !element.closest('#globe-fallback')) {
      this._fallbackOpener = element;
      return true;
    }
    return false;
  },

  showFallback(reasonCode) {
    const panel = $('globe-fallback');
    if (!panel || !document.body) {
      reportError('GlobeModule.showFallback()', new Error('globe fallback region not found'));
      return false;
    }

    if (!this._fallbackOpener) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && !panel.contains(active)) {
        this._fallbackOpener = active;
      }
    }

    const stableReason = Object.prototype.hasOwnProperty.call(GLOBE_FALLBACK_REASONS, reasonCode)
      ? reasonCode
      : 'globe_construction_failed';
    this._fallbackReasonCode = stableReason;
    panel.dataset.reason = stableReason;
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('globe-fallback-active');
    this.pause();
    $text('globe-fallback-reason', GLOBE_FALLBACK_REASONS[stableReason]);
    const browseRequested = stableReason === 'evidence_browse_requested';
    $text('globe-fallback-title', browseRequested ? 'Browse all 249 country evidence records' : 'The 3D view is unavailable.');
    const primaryAction = panel.querySelector('[data-globe-fallback-action="retry"], [data-globe-fallback-action="close"]');
    if (primaryAction) {
      primaryAction.setAttribute('data-globe-fallback-action', browseRequested ? 'close' : 'retry');
      primaryAction.textContent = browseRequested ? 'Return to the 3D globe' : 'Retry the 3D view';
    }
    const actionGroup = primaryAction?.closest('.elu-fallback-actions');
    if (actionGroup) actionGroup.setAttribute('aria-label', browseRequested ? 'Evidence browser navigation' : '3D view recovery options');
    // The fallback is a complete evidence browser, not a frozen error screen.
    // Bind the shared lens rail even when WebGL failed before init reached its
    // normal control-binding phase.
    this._bindLensControls();
    this._bindFallbackControls();
    this._renderFallbackEvidence();

    if (hasModule('EventBus')) {
      EventBus.emit('globe:fallback-shown', { reason: stableReason, timestamp: Date.now() });
    }
    requestAnimationFrame(() => $('globe-fallback-title')?.focus({ preventScroll: true }));
    return true;
  },

  _bindFallbackControls() {
    if (this._fallbackBound) return;
    const panel = $('globe-fallback');
    const search = $('globe-fallback-search');
    if (!panel || !search) return;
    this._fallbackBound = true;

    this._onFallbackClick = event => {
      const action = event.target.closest('[data-globe-fallback-action]');
      if (action) {
        const name = action.getAttribute('data-globe-fallback-action');
        if (name === 'retry') safeCall('App', 'retryGlobe');
        if (name === 'close') {
          this.closeEvidenceBrowser();
        }
        if (name === 'exit') safeCall('App', 'exitGlobe');
        if (name === 'list') {
          const row = panel.querySelector('[data-fallback-country-iso="' + this._fallbackSelectedIso + '"]');
          if (row) row.focus({ preventScroll: true });
        }
        return;
      }
      const country = event.target.closest('[data-fallback-country-iso]');
      if (!country) return;
      this._renderFallbackCountry(country.getAttribute('data-fallback-country-iso'), true);
    };
    this._onFallbackInput = () => this._filterFallbackEntries(search.value);
    panel.addEventListener('click', this._onFallbackClick);
    search.addEventListener('input', this._onFallbackInput);
  },

  _renderFallbackEvidence() {
    const list = $('globe-fallback-country-list');
    const summary = $('globe-fallback-summary');
    const detail = $('globe-fallback-country-detail');
    if (!list || !summary || !detail) return false;
    const rows = safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getRailRows', this.currentLens);
    if (!rows) {
      this._fallbackEntries = [];
      list.replaceChildren();
      summary.textContent = 'Country climate intelligence is unavailable. No values are being inferred.';
      $text('globe-fallback-results', '0 entities available');
      detail.innerHTML = '<h3>Evidence unavailable</h3><p>The verified country snapshot could not be displayed. Return to the Foundation and try again later.</p>';
      return false;
    }

    this._fallbackEntries = rows.all.map(row => ({
      row,
      country: Data.getClimateIntelligenceCountry(row.country_id),
      view: safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getCountryView', row.country_id, this.currentLens),
    })).filter(entry => entry.country && entry.view);
    const lens = rows.lens;
    $text('globe-fallback-evidence-title', lens.heading);
    summary.textContent = this._fallbackEntries.length + ' registry entities · ' + rows.eligible_count +
      ' in the exact ' + lens.period + ' comparison set · ' + rows.unranked_count +
      ' explicit gaps. ' + lens.interpretation;

    list.innerHTML = this._fallbackEntries.map(entry => {
      const country = entry.country;
      const iso = _escapeHtml(country.iso_alpha3);
      const name = _escapeHtml(country.name);
      const flag = _escapeHtml(country.flag_emoji || '');
      const primary = entry.view.primary;
      if (entry.row.ranked) {
        const value = _escapeHtml(primary.display_value);
        const rank = entry.row.ordinal;
        return '<li data-fallback-search="' + _escapeHtml((country.name + ' ' + country.iso_alpha3).toLowerCase()) + '"><button type="button" class="elu-fallback-country-row" data-fallback-country-iso="' + iso + '" data-fallback-evidence-state="factual" aria-label="' + name + ', ' + _escapeHtml(primary.label) + ', ' + value + ' ' + _escapeHtml(primary.unit) + ', ' + _escapeHtml(primary.period) + ', ' + _escapeHtml(primary.evidence_label) + ', order ' + rank + '"><span class="elu-fallback-country-name">' + flag + ' ' + name + '<small>' + iso + ' · order ' + rank + '</small></span><span class="elu-fallback-country-state">' + value + '<small>' + _escapeHtml(primary.unit) + '</small></span></button></li>';
      }
      const reason = _escapeHtml(entry.row.reason?.detail || 'Exact comparison metric unavailable.');
      return '<li data-fallback-search="' + _escapeHtml((country.name + ' ' + country.iso_alpha3 + ' ' + reason).toLowerCase()) + '"><button type="button" class="elu-fallback-country-row" data-fallback-country-iso="' + iso + '" data-fallback-evidence-state="gap" aria-label="' + name + ', explicit data gap, unranked, ' + reason + '"><span class="elu-fallback-country-name">' + flag + ' ' + name + '<small>' + iso + ' · unranked</small></span><span class="elu-fallback-country-state is-gap">Data gap<small>' + reason + '</small></span></button></li>';
    }).join('');
    this._filterFallbackEntries($('globe-fallback-search')?.value || '');
    return true;
  },

  _filterFallbackEntries(value) {
    const list = $('globe-fallback-country-list');
    if (!list) return;
    const query = String(value || '').trim().toLowerCase();
    let shown = 0;
    list.querySelectorAll('li[data-fallback-search]').forEach(item => {
      const visible = !query || item.dataset.fallbackSearch.includes(query);
      item.hidden = !visible;
      if (visible) shown++;
    });
    $text('globe-fallback-results', shown + ' of ' + this._fallbackEntries.length + ' entities shown');
  },

  _renderFallbackCountry(iso, focusDetail) {
    const entry = this._fallbackEntries.find(item => item.country.iso_alpha3 === iso);
    const detail = $('globe-fallback-country-detail');
    const list = $('globe-fallback-country-list');
    if (!entry || !detail || !list) return false;
    this._fallbackSelectedIso = iso;
    list.querySelectorAll('[data-fallback-country-iso]').forEach(row => {
      if (row.getAttribute('data-fallback-country-iso') === iso) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });

    const view = safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getCountryView', iso, this.currentLens);
    if (!view) return false;
    const country = view.country;
    const name = _escapeHtml(country.name);
    const code = _escapeHtml(country.iso_alpha3);
    const flag = _escapeHtml(country.flag_emoji || '');
    detail.innerHTML = '<h3 id="globe-fallback-detail-title" tabindex="-1">' + flag + ' ' + name + '</h3>'
      + '<span class="elu-fallback-detail-badge">' + code + ' · ' + _escapeHtml(view.primary.evidence_label) + '</span>'
      + this._renderCountryMetrics(view, 'fallback')
      + '<button type="button" class="elu-fallback-back-to-list" data-globe-fallback-action="list">Back to ' + name + ' in the list</button>';
    if (focusDetail) detail.focus({ preventScroll: true });
    return true;
  },

  hideFallback(options = {}) {
    const panel = $('globe-fallback');
    const opener = this._fallbackOpener;
    const hiddenReason = this._fallbackReasonCode;
    const wasVisible = !!panel && !panel.hidden;
    const wasEvidenceBrowse = hiddenReason === 'evidence_browse_requested';
    document.body?.classList.remove('globe-fallback-active');
    if (panel) {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.removeAttribute('data-reason');
    }
    this._fallbackReasonCode = null;
    if (wasEvidenceBrowse && this._initialized === true && $('globeViz')?.querySelectorAll('canvas').length === 1) {
      const browseButton = $('globe-evidence-browse');
      if (browseButton) {
        browseButton.disabled = false;
        browseButton.setAttribute('aria-disabled', 'false');
      }
    }
    if (!options.preserveOpener) this._fallbackOpener = null;
    if (options.restoreFocus && opener && document.contains(opener) && typeof opener.focus === 'function') {
      requestAnimationFrame(() => opener.focus({ preventScroll: true }));
    }
    if (wasVisible && options.emitEvent !== false && hasModule('EventBus')) {
      EventBus.emit('globe:fallback-hidden', { reason: hiddenReason, timestamp: Date.now() });
    }
    return true;
  },

  closeEvidenceBrowser() {
    const hasLiveRenderer = this._initialized === true && $('globeViz')?.querySelectorAll('canvas').length === 1;
    if (hasLiveRenderer) {
      const hidden = this.hideFallback({ restoreFocus: true, preserveOpener: false });
      this._syncAnimationLifecycle();
      return hidden;
    }
    this._teardownFailedRenderer();
    return this.showFallback('globe_construction_failed');
  },

  setTheme(theme) {
    if (!this.world) return false;
    const themeConfig = _getGlobeThemeConfig(theme);
    safeChain(this.world, 'Globe.theme')
      .globeImageUrl(themeConfig.surface)
      .backgroundImageUrl(themeConfig.backgroundImage)
      .backgroundColor(themeConfig.backgroundColor)
      .atmosphereColor(themeConfig.atmosphere)
      .atmosphereAltitude(themeConfig.atmosphereAltitude);
    return true;
  },

  // Compatibility entry point retained for callers that restore point layers.
  // Until reviewed country evidence is released, it restores restoration-site
  // points only and never synthesizes country climate points.
  initSitePoints() {
    if (!this.world) return;
    const sitePoints = (Data.sites || []).map(s => ({ ...s, _type: 'site' }));
    safeChain(this.world, 'Globe.sitePoints')
      .pointsData(sitePoints)
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(() => 0.01)
      .pointRadius(() => 0.6)
      .pointColor(p => {
        const suggestedIds = hasModule('GAIA_NODES') ? GAIA_NODES.getSuggestedSiteIds('') : [];
        if (suggestedIds.includes(p.id)) return '#ffd700';
        return 'rgba(78,205,196,0.6)';
      })
      .pointResolution(12)
      .onGlobeClick(({ lat, lng }) => {
        if (GlobeModule.shouldIgnoreCanvasClick()) return;
        // Mode handler intercepts globe surface clicks
        if (_globeClickHandler) {
          _globeClickHandler(lat, lng);
          return;
        }
      })
      .onPointClick(p => {
        if (GlobeModule.shouldIgnoreCanvasClick()) return;
        // Mode handler intercepts ALL clicks when active
        if (_globeClickHandler && p) {
          _globeClickHandler(p.lat, p.lng);
          return;
        }
        if (hasModule('GAIA_NODES')) {
          GAIA_NODES.onNodeClick(p.id);
        } else if (hasModule('SITE_PANEL')) {
          SITE_PANEL.open(p);
        } else {
          Panel.open(p);
        }
      })
      .onPointHover(p => {
        if (!p) {
          window.dispatchEvent(new CustomEvent('pledgeHover', { detail: null }));
          return;
        }
        if (hasModule('GAIA_NODES')) {
          GAIA_NODES.onNodeHover(p.id);
        } else if (hasModule('GAIA_PRESENCE')) {
          GAIA_PRESENCE.speakTeaser(p.id);
          safeCall('GAIA_ENGAGEMENT', 'interact');
        } else {
          window.dispatchEvent(new CustomEvent('pledgeHover', { detail: null }));
        }
      });
  },

  // Scientific visual decisions come from COUNTRY_CLIMATE_INTELLIGENCE.
  _countryHexColorFn(feature) {
    const visual = _getCountryVisualData(feature);
    return visual?.color || 'rgba(145,160,172,0.34)';
  },

  _countryHexAltitudeFn(feature) {
    const visual = _getCountryVisualData(feature);
    return visual?.altitude || 0.007;
  },

  // Exact lens order first; explicit gaps follow alphabetically.
  _buildCountryDeck(lensId = this.currentLens, options = {}) {
    const cached = this._countryDeckByLens?.[lensId];
    if (!options.force && Array.isArray(cached)) {
      if (lensId === this.currentLens) this._countryDeck = cached;
      return cached;
    }
    const featureByIso = this._featureByIso || {};
    const rows = safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getRailRows', lensId);
    const ranks = new Map((rows?.ordered || []).map(entry => [entry.iso_alpha3, entry]));
    const entries = Object.keys(featureByIso)
      .filter(iso => iso && iso !== 'UNK' && iso !== '-99' && iso !== 'ATA')
      .map(iso => {
        const feature = featureByIso[iso];
        const data = _getCountryNavigationData(feature);
        const country = data?.country || iso;
        return {
          iso,
          feature,
          data,
          country,
          rank: ranks.get(iso) || null,
        };
      })
      .filter(entry => entry.feature && entry.data);
    const deck = entries.sort((a, b) => {
      if (a.rank && b.rank) return a.rank.ordinal - b.rank.ordinal || a.iso.localeCompare(b.iso);
      if (a.rank) return -1;
      if (b.rank) return 1;
      return String(a.country).localeCompare(String(b.country));
    });
    this._countryDeckByLens ||= {};
    this._countryDeckByLens[lensId] = deck;
    if (lensId === this.currentLens) this._countryDeck = deck;
    return deck;
  },

  _renderRankRail() {
    const previous = $('elu-country-rank-rail');
    if (previous) previous.remove();
    const rows = safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getRailRows', this.currentLens);
    if (!rows || !document.body) { this._rankRail = null; return; }
    const rail = document.createElement('aside');
    rail.id = 'elu-country-rank-rail';
    rail.setAttribute('aria-label', rows.lens.heading + ' ordered entities and data gaps');
    const mappedRankedCount = rows.ordered.filter(entry => this._featureByIso?.[entry.iso_alpha3]).length;
    const ranked = rows.ordered.map(entry => {
      const iso = entry.iso_alpha3;
      const mapped = Boolean(this._featureByIso?.[iso]);
      const mapNote = mapped ? '' : ', opens in evidence browser because globe geometry is unavailable';
      return '<button type="button" class="elu-rank-row' + (mapped ? '' : ' is-unmapped') + '" data-country-rail-iso="' + _escapeHtml(iso) + '" data-country-rail-search="' + _escapeHtml((entry.name + ' ' + iso).toLowerCase()) + '" aria-label="Order ' + entry.ordinal + ', ' + _escapeHtml(entry.name) + ', ' + _escapeHtml(entry.display_value) + ' ' + _escapeHtml(entry.unit) + ', ' + _escapeHtml(entry.period) + ', ' + _escapeHtml(entry.evidence_label) + mapNote + '">'
        + '<span class="elu-rank-number">' + entry.ordinal + '</span><span class="elu-rank-dot is-magnitude" aria-hidden="true"></span>'
        + '<span class="elu-rank-name">' + _escapeHtml(entry.name) + '</span><span class="elu-rank-code">' + _escapeHtml(iso) + '</span>'
        + '<span class="elu-rank-gap">' + _escapeHtml(entry.display_value) + '<small>' + _escapeHtml(entry.unit) + '</small></span></button>';
    }).join('');
    const gaps = rows.unranked.map(entry => {
      const iso = entry.iso_alpha3;
      const mapped = Boolean(this._featureByIso?.[iso]);
      const reason = entry.reason?.detail || 'Exact comparison metric unavailable.';
      return '<button type="button" class="elu-rank-row is-gap' + (mapped ? '' : ' is-unmapped') + '" data-country-rail-iso="' + _escapeHtml(iso) + '" data-country-rail-search="' + _escapeHtml((entry.name + ' ' + iso + ' ' + reason).toLowerCase()) + '" aria-label="Data gap, ' + _escapeHtml(entry.name) + ', unranked, ' + _escapeHtml(reason) + '">'
        + '<span class="elu-rank-number" aria-hidden="true">—</span><span class="elu-rank-dot is-gap" aria-hidden="true"></span>'
        + '<span class="elu-rank-name">' + _escapeHtml(entry.name) + '<small>' + _escapeHtml(reason) + '</small></span><span class="elu-rank-code">' + _escapeHtml(iso) + '</span><span class="elu-rank-gap">Data gap</span></button>';
    }).join('');
    const mappedDisclosure = mappedRankedCount + ' of ' + rows.eligible_count + ' ordered entities mapped · all 249 searchable';
    const reliefNote = rows.relief_note ? '<div class="elu-rank-relief-note">' + _escapeHtml(rows.relief_note) + '</div>' : '';
    rail.innerHTML = '<div class="elu-rank-head"><div><div class="elu-rank-title">' + _escapeHtml(rows.lens.heading) + '</div>' + reliefNote + '<div class="elu-rank-subtitle">' + _escapeHtml(rows.lens.interpretation) + '</div></div><button type="button" class="elu-rank-toggle" aria-label="Collapse country order" aria-expanded="true">−</button></div>'
      + '<div class="elu-rank-list"><label class="elu-rank-search"><span>Find country or ISO code</span><input type="search" data-country-rail-filter autocomplete="off" spellcheck="false"></label><div class="elu-rank-disclosure" aria-label="' + _escapeHtml(mappedDisclosure) + '"><span class="elu-rank-disclosure-full">' + _escapeHtml(mappedDisclosure) + '</span><span class="elu-rank-disclosure-compact" aria-hidden="true"><strong>' + mappedRankedCount + '/' + rows.eligible_count + '</strong><span>mapped</span><span>' + rows.unranked_count + ' gaps</span></span></div>'
      + '<p class="elu-rank-filter-results" data-country-rail-results aria-live="polite">249 entities shown</p>'
      + '<div role="list" aria-label="Entities ordered by the exact ' + _escapeHtml(rows.lens.heading) + ' metric">' + ranked + '</div>'
      + '<h2 class="elu-rank-gap-heading">Data gaps · searchable and unnumbered</h2><div role="list" aria-label="Entities unranked because the exact comparison metric is unavailable">' + gaps + '</div></div>';
    rail.addEventListener('click', event => {
      const toggle = event.target.closest('.elu-rank-toggle');
      if (toggle) {
        const collapsed = rail.classList.toggle('is-collapsed');
        toggle.textContent = collapsed ? '+' : '−';
        toggle.setAttribute('aria-expanded', String(!collapsed));
        toggle.setAttribute('aria-label', collapsed ? 'Expand country ranking' : 'Collapse country ranking');
        return;
      }
      const row = event.target.closest('[data-country-rail-iso]');
      if (!row) return;
      const iso = row.getAttribute('data-country-rail-iso');
      const feature = this._featureByIso?.[iso];
      if (feature) {
        this._selectCountryFeature(feature, { focus: true });
      } else {
        this.rememberFallbackOpener(row);
        this.showFallback('evidence_browse_requested');
        requestAnimationFrame(() => this._renderFallbackCountry(iso, true));
      }
    });
    rail.addEventListener('input', event => {
      if (!event.target.matches('[data-country-rail-filter]')) return;
      const query = event.target.value.trim().toLowerCase();
      let shown = 0;
      rail.querySelectorAll('[data-country-rail-search]').forEach(row => {
        const visible = !query || row.dataset.countryRailSearch.includes(query);
        row.hidden = !visible;
        if (visible) shown++;
      });
      const results = rail.querySelector('[data-country-rail-results]');
      if (results) results.textContent = shown + ' of 249 entities shown';
    });
    document.body.appendChild(rail);
    this._rankRail = rail;
  },

  _updateRankRail() {
    if (!this._rankRail) return;
    const activeIso = this._selectedCountryFeature ? _resolveCountryIso(this._selectedCountryFeature) : '';
    this._rankRail.querySelectorAll('[data-country-rail-iso]').forEach(row => {
      const active = row.getAttribute('data-country-rail-iso') === activeIso;
      row.classList.toggle('is-active', active);
      if (active) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
  },

  _ensureCountryCardWrap(tt) {
    if (!tt || !document.body) return null;
    let wrap = $('elu-country-card-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'elu-country-card-wrap';
      wrap.innerHTML = '<button type="button" class="tt-nav tt-nav-prev" data-country-nav="-1" aria-label="Previous country" title="Previous country">◀</button>'
        + '<button type="button" class="tt-nav tt-nav-next" data-country-nav="1" aria-label="Next country" title="Next country">▶</button>';
      wrap.addEventListener('click', (event) => {
        const nav = event.target.closest('[data-country-nav]');
        if (!nav) return;
        event.preventDefault();
        event.stopPropagation();
        this.navigateCountry(parseInt(nav.getAttribute('data-country-nav'), 10) || 1, { source: 'button' });
      });
      document.body.appendChild(wrap);
    }
    if (!wrap.contains(tt)) wrap.insertBefore(tt, wrap.querySelector('.tt-nav-next'));
    document.body.classList.add('country-card-open');
    this._countryCardWrap = wrap;
    return wrap;
  },

  _unmountCountryCard() {
    const tt = $('hex-country-tooltip');
    const wrap = this._countryCardWrap || $('elu-country-card-wrap');
    this._clearCountrySwipeCue(tt);
    if (tt && wrap && wrap.contains(tt) && document.body) document.body.appendChild(tt);
    if (wrap) wrap.remove();
    document.body?.classList.remove('country-card-open');
    this._countryCardWrap = null;
  },

  _selectCountryFeature(feature, opts = {}) {
    const d = _getCountryDisplayData(feature);
    if (!d) return;
    if (opts.focus && document.activeElement && !document.activeElement.closest('#hex-country-tooltip')) {
      this._countryOpener = document.activeElement;
    }
    this._selectedCountryFeature = feature;
    this._syncAutoRotation();
    this._countryHoverFeature = feature;
    this._renderCountryInfoCard(feature, true);
    if (opts.event) this._positionCountryInfoCard(opts.event);
    else this._dockCountryCard();
    this._refreshCountryBorders();
    this._showCountryProjects(_resolveCountryIso(feature));
    this._updateRankRail();

    const focus = _getCountryFocus(feature, d);
    if (this.world && focus) {
      const pov = this.world.pointOfView();
      const reducedMotion = this._reducedMotionMedia?.matches === true ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      this.world.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: pov?.altitude || 2.2 }, opts.focus && !reducedMotion ? 500 : 0);
    }
    const tt = $('hex-country-tooltip');
    this._queueCountrySwipeCue(tt);
    if (opts.focus && tt) {
      const heading = tt.querySelector('#country-card-heading');
      if (heading) heading.focus({ preventScroll: true });
    }
    if (hasModule('EventBus')) EventBus.emit('globe:country-selected', { iso: d.iso, country: d.country });
  },

  selectDefaultCountry() {
    if (this._selectedCountryFeature || this._defaultCountrySelected || !this._countryDeck.length) return;
    const entry = this._countryDeck[0];
    if (!entry?.feature) return;
    this._defaultCountrySelected = true;
    this._selectCountryFeature(entry.feature, { focus: false });
  },

  _clearCountrySwipeCue(tt = $('hex-country-tooltip')) {
    this._countrySwipeCueToken += 1;
    if (tt && this._countrySwipeCueFinish) {
      tt.removeEventListener('animationend', this._countrySwipeCueFinish);
      tt.removeEventListener('animationcancel', this._countrySwipeCueFinish);
    }
    this._countrySwipeCueFinish = null;
    tt?.classList.remove('tt-swipe-cue');
    return true;
  },

  clearCountrySwipeCue() {
    return this._clearCountrySwipeCue();
  },

  cueCountrySwipe() {
    return this._queueCountrySwipeCue($('hex-country-tooltip'), { force: true });
  },

  _queueCountrySwipeCue(tt, options = {}) {
    const force = options.force === true;
    if (!tt || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    if (!force && (this._countrySwipeCueShown || window.innerWidth > 720)) return false;
    if (!force) this._countrySwipeCueShown = true;
    this._clearCountrySwipeCue(tt);
    tt.classList.remove('tt-motion-ready');
    const cueToken = this._countrySwipeCueToken;

    // Wait until the selected card has been mounted and docked before showing
    // the one-time horizontal affordance. Two frames keep the cue separate
    // from the card's initial paint, so the movement reads as intentional.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (cueToken !== this._countrySwipeCueToken) return;
      if (!tt.classList.contains('selected') || !tt.classList.contains('visible')) return;
      tt.classList.add('tt-swipe-cue');
      const finishCue = event => {
        if (event.animationName !== 'elu-country-card-swipe-cue') return;
        tt.removeEventListener('animationend', finishCue);
        tt.removeEventListener('animationcancel', finishCue);
        if (this._countrySwipeCueFinish === finishCue) this._countrySwipeCueFinish = null;
        tt.classList.add('tt-motion-ready');
        tt.classList.remove('tt-swipe-cue');
      };
      this._countrySwipeCueFinish = finishCue;
      tt.addEventListener('animationend', finishCue);
      tt.addEventListener('animationcancel', finishCue);
    }));
    return true;
  },

  _renderCountryInfoCard(feature, selected) {
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
      if (typeof ResizeObserver === 'function') {
        this._countryTooltipResizeObserver = new ResizeObserver(entries => {
          const entry = entries[entries.length - 1];
          if (!entry || entry.target.classList.contains('selected')) return;
          const box = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
          const width = Number(box?.inlineSize) || Number(entry.contentRect?.width) + 26;
          const height = Number(box?.blockSize) || Number(entry.contentRect?.height) + 22;
          if (width > 0 && height > 0) this._hoverTooltipSize = { width, height };
        });
        this._countryTooltipResizeObserver.observe(tt);
      }
      tt.addEventListener('click', (event) => {
        // ✕ on the pinned card
        if (event.target.closest('[data-country-close]')) {
          event.preventDefault();
          event.stopPropagation();
          this.clearCountrySelection();
          return;
        }
        // ◀ ▶ edge buttons
        const nav = event.target.closest('[data-country-nav]');
        if (nav) {
          event.preventDefault();
          event.stopPropagation();
          this.navigateCountry(parseInt(nav.getAttribute('data-country-nav'), 10) || 1, { source: 'button' });
          return;
        }
      });

      // ── Swipe physics (ported from agent/designer/swipeable-hover-card) ──
      // Drag the pinned card like a deck: card follows the pointer with a
      // slight rotation; past the threshold it flies off and the next /
      // previous country card enters. Vertical drags stay native scroll
      // (touch-action: pan-y in CSS + horizontal-intent detection here).
      let _dragStartX = 0, _dragStartY = 0, _dragging = false, _dragEngaged = false, _dragPointerId = null;

      tt.addEventListener('pointerdown', (e) => {
        if (!tt.classList.contains('selected')) return;
        if (e.target.closest('.tt-close,.tt-nav,a')) return;
        if (tt.classList.contains('tt-swipe-cue')) {
          this._clearCountrySwipeCue(tt);
          tt.classList.add('tt-motion-ready');
        }
        _dragging = true; _dragEngaged = false;
        _dragStartX = e.clientX; _dragStartY = e.clientY;
        _dragPointerId = e.pointerId;
      });

      tt.addEventListener('pointermove', (e) => {
        if (!_dragging) return;
        const dx = e.clientX - _dragStartX;
        const dy = e.clientY - _dragStartY;
        if (!_dragEngaged) {
          if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { _dragging = false; return; } // vertical → native scroll
          if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
          _dragEngaged = true;
          tt.classList.remove('tt-snap');
          tt.classList.add('tt-dragging');
          try { tt.setPointerCapture(_dragPointerId); } catch { /* ignore */ }
        }
        tt.style.transform = 'translate(' + dx + 'px, ' + (dy * 0.15) + 'px) rotate(' + (dx * 0.04) + 'deg)';
      });

      const _dragRelease = (e) => {
        if (!_dragging) return;
        _dragging = false;
        if (!_dragEngaged) return;
        _dragEngaged = false;
        tt.classList.remove('tt-dragging');
        try { tt.releasePointerCapture(_dragPointerId); } catch { /* ignore */ }
        const dx = e.clientX - _dragStartX;
        if (dx > 110) {
          this.navigateCountry(1, { fromDrag: true, source: 'swipe' });   // swipe right → next (Bumble)
        } else if (dx < -110) {
          this.navigateCountry(-1, { fromDrag: true, source: 'swipe' });  // swipe left → previous
        } else {
          tt.classList.add('tt-snap');
          tt.style.transform = 'none';
          setTimeout(() => tt.classList.remove('tt-snap'), 450);
        }
      };
      tt.addEventListener('pointerup', _dragRelease);
      tt.addEventListener('pointercancel', _dragRelease);

      // Keep the docked card on-screen when the window resizes. Store the
      // callback so Standard Module Lifecycle teardown can remove it.
      this._onCountryCardResize = () => {
        if (tt.classList.contains('selected') && tt.classList.contains('visible')) {
          this._dockCountryCard();
        }
      };
      window.addEventListener('resize', this._onCountryCardResize, { passive: true });

      // Horizontal trackpad / shift-wheel browses the deck; vertical keeps scrolling the card
      let _wheelNavAt = 0;
      tt.addEventListener('wheel', (e) => {
        if (!tt.classList.contains('selected')) return;
        if (Math.abs(e.deltaX) < 28 || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.4) return;
        e.preventDefault();
        const now = Date.now();
        if (now - _wheelNavAt < 500) return;
        _wheelNavAt = now;
        // Natural scrolling: fingers swiping right = negative deltaX = next
        this.navigateCountry(e.deltaX < 0 ? 1 : -1, { source: 'trackpad' });
      }, { passive: false });
    }

    const view = d.view;
    if (!view) return;
    const statusText = view.primary.available ? view.primary.evidence_label : 'Data gap';
    const statusClass = _getCountryStatusClass(d);
    const statusAttr = _getCountryStatusAttr(d);
    const evidenceSummary = view.primary.available
      ? view.primary.label + ' · ' + view.primary.display_value + ' ' + view.primary.unit + ' · ' + view.primary.period + ' · ' + view.primary.evidence_label
      : view.primary.label + ' · data gap · required period ' + view.lens.period + ' · ' + view.tooltip.evidence_class;
    const approximatePointNote = feature?.properties?.__smallNation
      ? '<div class="tt-detail">Approximate navigation point; not a boundary or precise centroid.</div>'
      : '';
    const mapAreaNote = d.mapAreaDiffers
      ? '<div class="tt-detail">Map geometry label: ' + _escapeHtml(d.mapArea) + '. Evidence entity: ' + _escapeHtml(d.country) + '.</div>'
      : '';

    if (selected) {
      const wrap = this._ensureCountryCardWrap(tt);
      if (wrap) {
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'false');
        wrap.setAttribute('aria-labelledby', 'country-card-heading');
      }
    }
    else this._unmountCountryCard();
    tt.classList.toggle('selected', !!selected);
    tt.setAttribute('aria-hidden', 'false');
    tt.dataset.status = statusAttr;
    if (selected) tt.removeAttribute('role');
    else tt.setAttribute('role', 'tooltip');
    if (selected) tt.removeAttribute('aria-label');
    else tt.setAttribute('aria-label', view.accessible_summary +
      (feature?.properties?.__smallNation ? ', approximate navigation point, not a boundary or precise centroid' : ''));
    if (!selected) tt.removeAttribute('tabindex');

    let html = '<div class="tt-topline">'
      + (selected ? '<h2 class="tt-country" id="country-card-heading" tabindex="-1">' + _escapeHtml(d.country) + '</h2>' : '<div class="tt-country">' + _escapeHtml(d.country) + '</div>')
      + '<div class="tt-pill tt-status-' + statusClass + '">' + _escapeHtml(statusText) + '</div>'
      + (selected ? '<button type="button" class="tt-close" data-country-close aria-label="Close">✕</button>' : '')
      + '</div>'
      + '<div class="tt-detail">' + _escapeHtml(evidenceSummary) + '</div>'
      + approximatePointNote
      + mapAreaNote
      + (selected ? '<div class="tt-candidate">' + _escapeHtml(view.rank_text) + '</div>' : '');

    if (!selected) {
      html += '<div class="tt-comment">' + _escapeHtml(view.primary.available ? view.lens.interpretation : view.primary.gap.detail) + '</div>';
    } else {
      html += this._renderCountryMetrics(view);
    }

    tt.innerHTML = html;
    tt.classList.add('visible');
  },

  // ── Card deck navigation (Bumble-style) ──
  // Cycles the v0.7 deck order. Card stays where it was pinned; the globe
  // flies to each country underneath.
  navigateCountry(dir, opts = {}) {
    if (this._navBusy) return;
    const deck = Array.isArray(this._countryDeck) ? this._countryDeck : [];
    if (!deck.length || !this._featureByIso) return;
    const cur = this._selectedCountryFeature;
    if (!cur) return;

    const curIso = _resolveCountryIso(cur);
    const navigationSource = ['swipe', 'button', 'keyboard', 'trackpad', 'programmatic'].includes(opts.source)
      ? opts.source
      : (opts.fromDrag ? 'swipe' : 'programmatic');
    const len = deck.length;
    let idx = deck.findIndex(entry => entry.iso === curIso);
    if (idx < 0) idx = 0;

    // Find the next node that has a renderable feature
    let target = null;
    for (let step = 1; step <= len; step++) {
      const cand = deck[((idx + dir * step) % len + len) % len];
      if (cand?.feature) { target = cand; break; }
    }
    if (!target) return;

    this._navBusy = true;
    const tt = $('hex-country-tooltip');
    const mobileMotion = window.innerWidth <= 720;
    const exitDuration = mobileMotion ? 220 : (opts.fromDrag ? 300 : 260);
    const enterDuration = mobileMotion ? 300 : 460;
    const activeBeforeSwap = document.activeElement;
    const restoreHeadingFocus = !!(tt && activeBeforeSwap && tt.contains(activeBeforeSwap));
    // Bumble semantics: advancing throws the card out to the RIGHT and the
    // next one enters from the left; going back mirrors it.
    const outClass = dir > 0 ? 'tt-fly-right' : 'tt-fly-left';
    const inClass = dir > 0 ? 'tt-enter-left' : 'tt-enter-right';

    const swap = () => {
      this._selectedCountryFeature = target.feature;
      this._countryHoverFeature = target.feature;
      this._renderCountryInfoCard(target.feature, true);
      // Re-rendering replaces every node inside the card. Keep keyboard and
      // screen-reader users in the replaced evidence context by focusing the
      // new heading when their prior focus was in that content. The persistent
      // outer previous/next buttons retain focus naturally.
      if (restoreHeadingFocus && tt) {
        const heading = tt.querySelector('#country-card-heading');
        if (heading) heading.focus({ preventScroll: true });
      }
      this._dockCountryCard();
      this._refreshCountryBorders();
      this._showCountryProjects(target.iso);
      this._updateRankRail();
      if (hasModule('EventBus')) {
        EventBus.emit('globe:country-selected', { iso: target.iso, country: target.country });
        EventBus.emit('globe:country-navigated', {
          from_iso: curIso,
          to_iso: target.iso,
          country: target.country,
          direction: dir > 0 ? 1 : -1,
          source: navigationSource,
        });
      }

      // Fly the globe to the new country, keeping the current zoom
      if (this.world) {
        const pov = this.world.pointOfView();
        const focus = _getCountryFocus(target.feature, target.data);
        const reducedMotion = this._reducedMotionMedia?.matches === true ||
          window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
        if (focus) this.world.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: pov.altitude }, reducedMotion ? 0 : 650);
      }

      if (tt) {
        tt.classList.remove(outClass);
        tt.classList.add(inClass);
        // force reflow so the enter transform applies before transitioning back
        void tt.offsetWidth;
        tt.classList.add('tt-snap');
        tt.classList.remove(inClass);
        tt.style.transform = 'none';
        setTimeout(() => { tt.classList.remove('tt-snap'); this._navBusy = false; }, enterDuration);
      } else {
        this._navBusy = false;
      }
    };

    if (tt) {
      this._clearCountrySwipeCue(tt);
      tt.classList.add('tt-motion-ready');
      tt.classList.remove('tt-snap', 'tt-dragging');
      tt.classList.add(outClass);
      setTimeout(swap, exitDuration);
    } else {
      swap();
    }
  },

  _renderClimateFact(fact) {
    const value = fact.available
      ? '<strong>' + _escapeHtml(fact.display_value) + '</strong>' + (fact.unit ? ' <span>' + _escapeHtml(fact.unit) + '</span>' : '')
      : '<strong>Not available</strong>';
    const context = [];
    if (fact.non_comparable) context.push('<p class="tt-fact-warning"><strong>Separate scope:</strong> shown alongside fossil CO₂, never as a numerical disagreement or delta.</p>');
    if (fact.id === 'emissions.land_use_co2.net' && fact.available && fact.value < 0) context.push('<p class="tt-fact-note">Negative value: modeled net removal.</p>');
    if (fact.id === 'emissions.ghg.independent' && fact.context) {
      const gases = Object.entries(fact.context.gas_breakdown || {}).map(([gas, item]) => '<li><span>' + _escapeHtml(gas.toUpperCase()) + '</span><strong>' + _escapeHtml(String(item.value)) + ' ' + _escapeHtml(item.unit) + '</strong></li>').join('');
      const sectors = Object.entries(fact.context.sector_breakdown_mtco2e || {}).map(([sector, valueMt]) => '<li><span>' + _escapeHtml(sector.replace(/-/g, ' ')) + '</span><strong>' + _escapeHtml(String(valueMt)) + ' MtCO₂e/yr</strong></li>').join('');
      if (gases || sectors) context.push('<details class="tt-breakdown"><summary>Gas and sector breakdowns</summary>' + (gases ? '<h5>Gases</h5><ul>' + gases + '</ul>' : '') + (sectors ? '<h5>Sectors</h5><ul>' + sectors + '</ul>' : '') + '</details>');
    }
    return '<article class="tt-fact' + (fact.available ? '' : ' is-gap') + '"><h4>' + _escapeHtml(fact.label) + '</h4><div class="tt-fact-value">' + value + '</div>'
      + '<p class="tt-fact-meta">' + _escapeHtml(fact.period || 'Period unavailable') + ' · ' + _escapeHtml(fact.evidence_label) + '</p>'
      + '<p>' + _escapeHtml(fact.available ? fact.explanation : fact.gap.detail) + '</p>'
      + (fact.available ? '<p class="tt-fact-uncertainty">' + _escapeHtml(fact.uncertainty_text) + '</p>' : '') + context.join('') + '</article>';
  },

  _renderPowerField(view, idPrefix = 'country-card') {
    const field = view.power_story?.field;
    if (!field) return '';
    const chartId = (idPrefix + '-' + view.country.iso_alpha3 + '-power-mix').replace(/[^a-zA-Z0-9_-]/g, '-');
    const titleId = chartId + '-title';
    const descId = chartId + '-desc';
    if (!field.available) {
      return '<figure class="elu-power-field is-gap" aria-labelledby="' + titleId + ' ' + descId + '"><div class="elu-power-field-head"><span id="' + titleId + '">' + _escapeHtml(field.title) + ' · ' + _escapeHtml(field.period) + '</span><span>Fuel detail gap</span></div><p class="elu-power-mix-gap" id="' + descId + '">' + _escapeHtml(field.gap) + '</p><figcaption><strong>Gap preserved:</strong> ' + _escapeHtml(field.disclosure) + '</figcaption></figure>';
    }
    if (!Array.isArray(field.lanes) || field.lanes.length !== 2) return '';
    const allSegments = field.lanes.flatMap(lane => lane.segments);
    const summary = field.lanes.map(lane => lane.label + ' ' + lane.display_value + ' percent. '
      + lane.segments.map(segment => segment.available
        ? segment.label + ' ' + segment.display_value + ' percent'
        : segment.label + ' data gap').join(', ')).join('. ');
    const renderSegment = segment => {
      if (!segment.available || segment.value <= 0) return '';
      const value = Math.max(0, Math.min(100, Number(segment.value)));
      const segmentClass = 'is-' + segment.pattern;
      return '<span class="elu-power-segment ' + segmentClass + '" style="width:' + value.toFixed(2) + '%" title="' + _escapeHtml(segment.label) + ': ' + _escapeHtml(segment.display_value) + '%"><span class="sr-only">' + _escapeHtml(segment.label) + ' ' + _escapeHtml(segment.display_value) + ' percent</span></span>';
    };
    const renderLane = lane => {
      const value = Math.max(0, Math.min(100, Number(lane.value)));
      return '<div class="elu-power-lane is-' + _escapeHtml(lane.id) + '"><div class="elu-power-lane-head"><span>' + _escapeHtml(lane.label) + '</span><strong>' + _escapeHtml(lane.display_value) + '%</strong></div><div class="elu-power-lane-track" role="meter" aria-label="' + _escapeHtml(lane.label) + ' share with published fuel components" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + value.toFixed(2) + '" aria-valuetext="' + _escapeHtml(lane.display_value) + ' percent of electricity generation">' + lane.segments.map(renderSegment).join('') + '</div></div>';
    };
    const legend = allSegments.map(segment => '<li class="' + (segment.available ? (segment.value === 0 ? 'is-zero' : 'is-available') : 'is-gap') + '"><i class="elu-power-segment-key is-' + _escapeHtml(segment.pattern) + '" aria-hidden="true"></i><span>' + _escapeHtml(segment.label) + '</span><strong>' + _escapeHtml(segment.available ? segment.display_value + '%' : 'Data gap') + '</strong></li>').join('');
    const roundingClass = Math.abs(field.rounding_variance_pp) > 0.000001 ? ' has-rounding' : '';
    return '<figure class="elu-power-field" aria-labelledby="' + titleId + ' ' + descId + '"><div class="elu-power-field-head"><span id="' + titleId + '">' + _escapeHtml(field.title) + ' · ' + _escapeHtml(field.period) + '</span><span>' + _escapeHtml(field.evidence_label) + '</span></div><span class="sr-only" id="' + descId + '">' + _escapeHtml(summary) + '. ' + _escapeHtml(field.disclosure) + '</span>'
      + '<div class="elu-power-field-scale" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100%</span></div><div class="elu-power-lanes">' + field.lanes.map(renderLane).join('') + '</div>'
      + '<ul class="elu-power-mix-legend" aria-label="Published generation-fuel shares and explicit gaps">' + legend + '</ul>'
      + '<p class="elu-power-reconciliation' + roundingClass + '"><strong>Published total:</strong> ' + _escapeHtml(field.published_component_sum.toFixed(2)) + '%</p>'
      + (field.taxonomy_note ? '<p class="elu-power-taxonomy-note">' + _escapeHtml(field.taxonomy_note) + '</p>' : '')
      + '<figcaption><strong>One shared scale:</strong> ' + _escapeHtml(field.disclosure) + '</figcaption></figure>';
  },

  _renderClimateSeries(view, idPrefix = 'country-card', chart = view.detail_chart, chartIndex = 0) {
    const points = chart?.series;
    if (!Array.isArray(points) || points.length < 2) return '';
    const trendLine = Array.isArray(chart.trend_line) && chart.trend_line.length === 2 ? chart.trend_line : [];
    const values = points.map(point => point.value).concat(trendLine.map(point => point.value));
    const min = Math.min(...values), max = Math.max(...values);
    const span = Math.max(max - min, Math.abs(max) * 0.02, 0.001);
    const start = points[0].year;
    const end = points[points.length - 1].year;
    const xFor = year => 8 + ((year - start) / Math.max(end - start, 1)) * 304;
    const yFor = value => 51 - ((value - min) / span) * 39;
    const coordPoints = points.map(point => {
      const x = xFor(point.year);
      const y = yFor(point.value);
      return { x: x.toFixed(1), y: y.toFixed(1), point };
    });
    const coords = coordPoints.map(item => item.x + ',' + item.y).join(' ');
    const seriesUnit = chart.series_unit || chart.unit;
    const observed = chart.id === 'climate.temperature.observed_trend' || chart.id === 'climate.precipitation.observed_trend';
    const seriesClass = observed ? 'is-observed' : 'is-magnitude';
    const markerStep = points.length > 40 ? 5 : 1;
    const markers = coordPoints.filter((item, index) => index === 0 || index === coordPoints.length - 1 || (item.point.year - start) % markerStep === 0)
      .map(item => '<circle class="elu-trajectory-point ' + seriesClass + '" cx="' + item.x + '" cy="' + item.y + '" r="2.2"><title>' + item.point.year + ': ' + item.point.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + _escapeHtml(seriesUnit) + '</title></circle>').join('');
    const rows = points.map(point => '<tr><th scope="row">' + point.year + '</th><td>' + point.value.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '</td><td>' + _escapeHtml(seriesUnit) + '</td></tr>').join('');
    const trend = trendLine.length === 2
      ? '<line class="elu-trajectory-trend" x1="' + xFor(trendLine[0].year).toFixed(1) + '" y1="' + yFor(trendLine[0].value).toFixed(1) + '" x2="' + xFor(trendLine[1].year).toFixed(1) + '" y2="' + yFor(trendLine[1].value).toFixed(1) + '"></line>'
      : '';
    const chartLabel = chart.series_label || chart.label;
    const chartNote = chart.evidence_label + (trend ? ' · OLS ' + chart.display_value + ' ' + chart.unit : '');
    const annualStatisticLabel = chart.context?.annual_statistic_label
      || (chart.id === 'climate.temperature.observed_trend' ? 'Annual mean' : 'Annual series');
    const legend = trend ? '<div class="elu-trajectory-legend elu-observed-legend" aria-hidden="true"><span class="elu-observed-series-key">' + _escapeHtml(annualStatisticLabel) + '</span><span class="elu-observed-trend-key">OLS trend</span></div>' : '';
    const chartId = (idPrefix + '-' + view.country.iso_alpha3 + '-' + view.lens.id + '-' + chart.id + '-' + chartIndex).replace(/[^a-zA-Z0-9_-]/g, '-');
    const titleId = chartId + '-series-title';
    const descId = chartId + '-series-desc';
    return '<div class="elu-trajectory"><div class="elu-trajectory-head"><span class="elu-trajectory-title">' + _escapeHtml(chartLabel) + ' · ' + start + '–' + end + '</span><span class="elu-trajectory-note">' + _escapeHtml(chartNote) + '</span></div>'
      + '<svg viewBox="0 0 320 72" role="img" aria-labelledby="' + titleId + ' ' + descId + '"><title id="' + titleId + '">' + _escapeHtml(view.country.name) + ' ' + _escapeHtml(chartLabel) + ', ' + start + ' to ' + end + '</title><desc id="' + descId + '">Annual values in ' + _escapeHtml(seriesUnit) + '. The solid line shows the annual source series' + (trend ? ' and the dashed line shows the supplied ordinary least-squares trend' : '') + '. No score or target pathway is shown.</desc>'
      + '<line class="elu-trajectory-grid" x1="8" y1="51" x2="312" y2="51"></line><text class="elu-chart-axis" x="8" y="9">' + max.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + _escapeHtml(seriesUnit) + '</text><text class="elu-chart-axis" x="8" y="66">' + min.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + _escapeHtml(seriesUnit) + '</text><polyline class="elu-trajectory-current ' + seriesClass + '" points="' + coords + '"></polyline>' + trend + markers + '</svg>'
      + '<div class="elu-trajectory-years"><span>' + start + '</span><span>' + end + '</span></div>' + legend + '</div>'
      + '<details class="tt-chart-data"><summary>Show chart data</summary><table><caption>' + _escapeHtml(view.country.name) + ' ' + _escapeHtml(chartLabel) + '</caption><thead><tr><th>Year</th><th>Value</th><th>Unit</th></tr></thead><tbody>' + rows + '</tbody></table></details>';
  },

  _renderTemperatureProjectionRange(view, idPrefix = 'country-card', projection = null) {
    if (!projection || !Array.isArray(projection.markers) || projection.markers.length !== 3) return '';
    const span = projection.p90 - projection.p10;
    const xFor = value => span > 0 ? 24 + ((value - projection.p10) / span) * 272 : 160;
    const medianX = xFor(projection.median);
    const format = value => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    const rows = projection.markers.map(marker => '<tr><th scope="row">' + _escapeHtml(marker.label) + '</th><td>' + format(marker.value) + '</td><td>' + _escapeHtml(projection.unit) + '</td><td>' + _escapeHtml(marker.shape) + '</td></tr>').join('');
    const chartId = (idPrefix + '-' + view.country.iso_alpha3 + '-projection-range').replace(/[^a-zA-Z0-9_-]/g, '-');
    const titleId = chartId + '-title';
    const descId = chartId + '-desc';
    return '<div class="elu-projection-range"><div class="elu-trajectory-head"><span class="elu-trajectory-title">' + _escapeHtml(projection.title) + '</span><span class="elu-trajectory-note">' + _escapeHtml(projection.scenario) + ' · ' + _escapeHtml(projection.period) + ' mean</span></div>'
      + '<svg viewBox="0 0 320 72" role="img" aria-labelledby="' + titleId + ' ' + descId + '"><title id="' + titleId + '">' + _escapeHtml(view.country.name) + ' ' + _escapeHtml(projection.scenario) + ' published temperature-change range</title><desc id="' + descId + '">Published multi-model p10, median, and p90 changes for the 2040 to 2059 mean relative to 1995 to 2014. Square marks p10, diamond marks the median, and circle marks p90. No intervening years or probabilities are shown.</desc>'
      + '<rect class="elu-projection-range-band" x="24" y="31" width="272" height="10" rx="5"></rect>'
      + '<line class="elu-projection-range-line" x1="24" y1="36" x2="296" y2="36"></line>'
      + '<rect class="elu-projection-marker is-p10" x="19" y="31" width="10" height="10"><title>p10: ' + format(projection.p10) + ' ' + _escapeHtml(projection.unit) + '</title></rect>'
      + '<polygon class="elu-projection-marker is-median" points="' + medianX.toFixed(1) + ',28 ' + (medianX + 8).toFixed(1) + ',36 ' + medianX.toFixed(1) + ',44 ' + (medianX - 8).toFixed(1) + ',36"><title>Median: ' + format(projection.median) + ' ' + _escapeHtml(projection.unit) + '</title></polygon>'
      + '<circle class="elu-projection-marker is-p90" cx="296" cy="36" r="6"><title>p90: ' + format(projection.p90) + ' ' + _escapeHtml(projection.unit) + '</title></circle></svg>'
      + '<div class="elu-projection-values"><span><i class="is-p10" aria-hidden="true"></i><strong>p10</strong> ' + format(projection.p10) + ' ' + _escapeHtml(projection.unit) + '</span><span><i class="is-median" aria-hidden="true"></i><strong>Median</strong> ' + format(projection.median) + ' ' + _escapeHtml(projection.unit) + '</span><span><i class="is-p90" aria-hidden="true"></i><strong>p90</strong> ' + format(projection.p90) + ' ' + _escapeHtml(projection.unit) + '</span></div>'
      + '<p class="elu-projection-disclosure"><strong>Evidence boundary:</strong> ' + _escapeHtml(projection.disclosure) + '</p></div>'
      + '<details class="tt-chart-data"><summary>Show published projection values</summary><table><caption>' + _escapeHtml(view.country.name) + ' ' + _escapeHtml(projection.scenario) + ' published multi-model percentile summary</caption><thead><tr><th>Statistic</th><th>Change</th><th>Unit</th><th>Visual marker</th></tr></thead><tbody>' + rows + '</tbody></table></details>';
  },

  _renderPhysicalClimateMetrics(view, idPrefix = 'country-card') {
    const story = view.physical_story;
    const sectionId = (idPrefix + '-' + view.country.iso_alpha3 + '-physical-story').replace(/[^a-zA-Z0-9_-]/g, '-');
    const temperatureId = sectionId + '-temperature';
    const precipitationId = sectionId + '-precipitation';
    const temperatureObserved = story.temperature.observed;
    const precipitationObserved = story.precipitation.observed;
    const temperatureObservedHtml = Array.isArray(temperatureObserved?.series) && temperatureObserved.series.length > 1
      ? this._renderClimateSeries(view, idPrefix, temperatureObserved, 0)
      : (temperatureObserved ? this._renderClimateFact(temperatureObserved) : '');
    const precipitationObservedHtml = Array.isArray(precipitationObserved?.series) && precipitationObserved.series.length > 1
      ? this._renderClimateSeries(view, idPrefix, precipitationObserved, 1)
      : (precipitationObserved ? this._renderClimateFact(precipitationObserved) : '');
    const projectionHtml = this._renderTemperatureProjectionRange(view, idPrefix, story.temperature.projection_range);
    const futureProjectionBlock = projectionHtml
      ? '<div class="tt-climate-evidence"><h4>Future projection</h4>' + projectionHtml + '</div>'
      : '';
    const temperatureFact = story.temperature.projected_fact ? this._renderClimateFact(story.temperature.projected_fact) : '';
    const precipitationFact = story.precipitation.projected_fact ? this._renderClimateFact(story.precipitation.projected_fact) : '';
    return '<section class="tt-physical-story" aria-label="Physical climate evidence">'
      + '<section class="tt-climate-variable is-temperature" aria-labelledby="' + temperatureId + '"><h3 id="' + temperatureId + '">Temperature</h3>'
      + '<div class="tt-climate-evidence"><h4>Observed analysis</h4>' + temperatureObservedHtml + '</div>'
      + futureProjectionBlock
      + '<div class="tt-projected-fact">' + temperatureFact + '</div></section>'
      + '<section class="tt-climate-variable is-precipitation" aria-labelledby="' + precipitationId + '"><h3 id="' + precipitationId + '">Precipitation</h3>'
      + '<div class="tt-projected-fact">' + precipitationFact + '</div>'
      + '<div class="tt-climate-evidence"><h4>Observed data</h4>' + precipitationObservedHtml + '</div></section></section>'
      + this._renderClimateMethods(view)
      + '<div class="tt-hint">← → or swipe changes country · esc closes · lens buttons preserve selection</div>';
  },

  _renderClimateMethods(view) {
    const factMethods = view.methods.facts.map(fact => {
      const scope = fact.scope ? Object.entries(fact.scope).map(([key, value]) => '<li><strong>' + _escapeHtml(key.replace(/_/g, ' ')) + ':</strong> ' + _escapeHtml(Array.isArray(value) ? value.join(', ') : value) + '</li>').join('') : '';
      const sources = fact.sources.map(source => {
        const safeUrl = /^https:\/\//.test(source.url || '') ? source.url : '';
        return '<li>' + (safeUrl ? '<a href="' + _escapeHtml(safeUrl) + '" target="_blank" rel="noopener">' + _escapeHtml(source.title) + '</a>' : _escapeHtml(source.title)) + ' · ' + _escapeHtml(source.version) + '</li>';
      }).join('');
      const scenarios = fact.scenario_medians ? '<p><strong>Scenario medians:</strong> ' + Object.entries(fact.scenario_medians).map(([scenario, value]) => _escapeHtml(scenario) + ' ' + _escapeHtml(String(value)) + ' ' + _escapeHtml(fact.unit)).join(' · ') + '</p>' : '';
      return '<details class="tt-method-fact"><summary>' + _escapeHtml(fact.label) + (fact.available ? '' : ' · gap') + '</summary>'
        + (fact.available ? '<p><strong>Transformation:</strong> ' + _escapeHtml(fact.transformation || 'Source value selected without an additional derivation.') + '</p><p><strong>Uncertainty:</strong> ' + _escapeHtml(fact.uncertainty_text) + '</p>' : '<p><strong>Gap reason:</strong> ' + _escapeHtml(fact.gap.detail) + '</p>')
        + scenarios + (scope ? '<h5>Scope fingerprint</h5><code>' + _escapeHtml(fact.scope_fingerprint) + '</code><ul>' + scope + '</ul>' : '')
        + (sources ? '<h5>Citations</h5><ul>' + sources + '</ul>' : '')
        + (fact.fact_ids.length ? '<p><strong>Fact IDs:</strong> <code>' + _escapeHtml(fact.fact_ids.join(', ')) + '</code></p>' : '') + '</details>';
    }).join('');
    const projectionRange = view.physical_story?.temperature?.projection_range;
    const projectionMethod = projectionRange
      ? '<details class="tt-method-fact"><summary>Published temperature-change range · source summary</summary><p><strong>Basis:</strong> ' + _escapeHtml(projectionRange.method) + '</p><p><strong>Source uncertainty:</strong> ' + _escapeHtml(projectionRange.source_uncertainty_kind.replace(/_/g, ' ')) + '.</p><p><strong>Boundary:</strong> ' + _escapeHtml(projectionRange.disclosure) + '</p></details>'
      : '';
    const historical = view.methods.citation_only_sources.map(source => '<li><a href="' + _escapeHtml(source.url) + '" target="_blank" rel="noopener">' + _escapeHtml(source.title) + '</a> · ' + _escapeHtml(source.note) + '</li>').join('');
    const official = view.methods.official_context.map(item => {
      const safeUrl = /^https:\/\//.test(item.direct_url || '') ? item.direct_url : '';
      const title = _escapeHtml(item.document_title);
      const linkedTitle = safeUrl ? '<a href="' + _escapeHtml(safeUrl) + '" target="_blank" rel="noopener">' + title + '</a>' : title;
      return '<li>' + linkedTitle + ' · submitted ' + _escapeHtml(item.submission_date || 'date not reported') + '</li>';
    }).join('');
    return '<details class="tt-methods"><summary>Methods &amp; sources</summary><div class="tt-methods-body"><p><strong>Release:</strong> ' + _escapeHtml(view.methods.release_id) + ' · ' + _escapeHtml(view.methods.review_label) + ' · generated ' + _escapeHtml(view.methods.generated_on) + '</p>'
      + (view.methods.checksum ? '<p><strong>Verified SHA-256:</strong> <code>' + _escapeHtml(view.methods.checksum) + '</code></p>' : '')
      + '<p><strong>Comparison rule:</strong> ' + _escapeHtml(view.methods.comparison_rule) + '</p>' + projectionMethod + factMethods
      + (official ? '<h4>Official document context</h4><ul>' + official + '</ul>' : '')
      + (historical ? '<h4>Historical citation-only provenance</h4><ul>' + historical + '</ul>' : '')
      + '</div></details>';
  },

  _renderCountryMetrics(view, idPrefix = 'country-card') {
    if (view.lens.id === 'physical' && view.physical_story) return this._renderPhysicalClimateMetrics(view, idPrefix);
    const powerField = view.lens.id === 'power' ? view.power_story?.field : null;
    const visualizedPowerFacts = new Set(powerField?.visualized_fact_ids || []);
    const powerVisual = powerField ? this._renderPowerField(view, idPrefix) : '';
    const glance = view.at_a_glance.filter(fact => !visualizedPowerFacts.has(fact.id)).map(fact => this._renderClimateFact(fact)).join('');
    const facts = view.active_panel.facts.filter(fact => !visualizedPowerFacts.has(fact.id)).map(fact => this._renderClimateFact(fact)).join('');
    const chartFacts = Array.isArray(view.detail_charts) ? view.detail_charts : (view.detail_chart ? [view.detail_chart] : []);
    const chartHtml = chartFacts.map((chart, index) => this._renderClimateSeries(view, idPrefix, chart, index)).join('');
    const sectionId = (idPrefix + '-' + view.country.iso_alpha3 + '-' + view.lens.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    const glanceId = sectionId + '-glance-heading';
    const lensId = sectionId + '-lens-heading';
    const chartId = sectionId + '-observed-heading';
    const charts = chartHtml && view.detail_chart_heading
      ? '<section class="tt-observed-series" aria-labelledby="' + chartId + '"><h3 id="' + chartId + '">' + _escapeHtml(view.detail_chart_heading) + '</h3>' + chartHtml + '</section>'
      : chartHtml;
    const panel = facts
      ? '<section class="tt-lens-panel" aria-labelledby="' + lensId + '"><h3 id="' + lensId + '">' + _escapeHtml(view.active_panel.heading) + '</h3><p>' + _escapeHtml(view.active_panel.description) + '</p><div class="tt-fact-grid">' + facts + '</div></section>'
      : '';
    return '<section class="tt-glance" aria-labelledby="' + glanceId + '"><h3 id="' + glanceId + '">At a glance</h3>' + powerVisual + (glance ? '<div class="tt-fact-grid' + (powerVisual ? ' tt-power-support-grid' : '') + '">' + glance + '</div>' : '') + '</section>'
      + charts + panel
      + this._renderClimateMethods(view)
      + '<div class="tt-hint">← → or swipe changes country · esc closes · lens buttons preserve selection</div>';
  },

  // ── Project markers: the pinned country's top projects on the globe ──
  _showCountryProjects(iso) {
    this._clearCountryProjects();
  },

  _clearCountryProjects() {
    if (!this.world || typeof this.world.pointsData !== 'function') return;
    this.world.pointsData([]);
  },

  // Pinned cards dock to a stable screen position — the card stays still
  // while deck navigation flies the globe underneath. Hover cards follow
  // the cursor as before.
  _dockCountryCard() {
    const tt = $('hex-country-tooltip');
    const wrap = this._countryCardWrap || $('elu-country-card-wrap');
    if (!tt || !wrap) return;
    const compactCardTop = '142px';

    wrap.style.position = 'fixed';
    wrap.style.zIndex = '1000';
    wrap.style.right = '24px';
    wrap.style.left = 'auto';
    wrap.style.top = window.innerWidth <= 720 ? compactCardTop : (window.innerWidth <= 1000 ? '126px' : '64px');
    wrap.style.bottom = window.innerWidth <= 900
      ? 'calc(var(--globe-dock-inset) + var(--globe-dock-height) + 10px)'
      : 'calc(var(--globe-dock-inset) + var(--globe-dock-height) + var(--globe-dock-gap))';
    wrap.style.width = 'auto';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.pointerEvents = 'none';

    // The tooltip is a fixed hover card when unselected, but becomes a normal
    // flex child inside the dock wrapper when pinned.
    tt.style.position = 'relative';
    tt.style.zIndex = 'auto';
    tt.style.left = 'auto';
    tt.style.right = 'auto';
    tt.style.top = 'auto';
    tt.style.bottom = 'auto';
    tt.style.width = '';
    tt.style.maxHeight = '100%';
    tt.style.overflowY = 'auto';
    tt.style.transform = 'none';

    if (window.innerWidth <= 720) {
      // The mobile HUD reserves a top band for the topbar and a bottom band
      // for the return control, plus a left gutter for the ranked country rail.
      // JS mirrors the CSS breakpoints because docking uses inline positioning.
      const phoneRail = window.innerWidth <= 480;
      wrap.style.left = phoneRail ? '64px' : '90px';
      wrap.style.right = phoneRail ? '8px' : '10px';
      wrap.style.top = compactCardTop;
      wrap.style.bottom = '78px';
      wrap.style.alignItems = 'flex-end';
    }
  },

  _positionCountryInfoCard(event) {
    const tt = $('hex-country-tooltip');
    if (!tt) return;
    if (tt.classList.contains('selected')) { this._dockCountryCard(); return; }
    if (!event) return;

    // Width is fixed by the critical CSS and hover copy stays inside this
    // conservative height envelope. A ResizeObserver refines both values
    // after layout without forcing style/layout inside the pointer handler.
    const width = this._hoverTooltipSize?.width || Math.min(292, Math.max(0, window.innerWidth - 28));
    const height = this._hoverTooltipSize?.height || 160;
    const margin = 12;
    const topSafe = window.innerWidth <= 900 ? 112 : 92;
    const bottomSafe = window.innerWidth <= 900 ? 132 : 112;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(topSafe, window.innerHeight - bottomSafe - height);
    const preferAbove = event.clientY - height - 16 >= topSafe;
    const rawX = event.clientX + 16;
    const rawY = preferAbove ? event.clientY - height - 16 : event.clientY + 16;
    const x = Math.max(margin, Math.min(rawX, maxX));
    const y = Math.max(topSafe, Math.min(rawY, maxY));
    tt.style.left = x + 'px';
    tt.style.top = y + 'px';
    tt.style.transform = 'none';
  },

  _countryBorderColorFn(feature) {
    if (feature === this._countryHoverFeature) return 'rgba(221,238,247,0.96)';
    if (feature === this._selectedCountryFeature) return 'rgba(141,184,208,0.90)';

    const small = !!feature?.properties?.__smallNation;
    return small ? 'rgba(205,225,235,0.82)' : 'rgba(145,170,184,0.32)';
  },

  _countryPolygonPaintColorFn(feature) {
    const hovered = feature === this._countryHoverFeature;
    const selected = feature === this._selectedCountryFeature;
    const hoverBoost = hovered ? 0.12 : (selected ? 0.08 : 0);
    const visual = _getCountryVisualData(feature);

    // Small-nation dot markers: a few pixels wide, so the usual low-alpha
    // country wash would vanish. Paint them near-solid for contrast.
    if (feature?.properties?.__smallNation) {
      if (!visual?.available) return 'rgba(165,178,188,' + Math.min(0.82 + hoverBoost, 0.96).toFixed(2) + ')';
      return visual.solid_color;
    }

    if (!visual?.available) return 'rgba(145,160,172,' + (0.32 + hoverBoost).toFixed(2) + ')';
    const base = visual.color;
    if (!hoverBoost) return base;
    return visual.solid_color;
  },

  _countryPolygonSideColorFn(feature) {
    const visual = _getCountryVisualData(feature);
    return visual?.side_color || 'rgba(0,0,0,0)';
  },

  _supportsCountryBorders() {
    if (!this.world) return false;
    return [
      'polygonsData',
      'polygonCapColor',
      'polygonSideColor',
      'polygonStrokeColor',
      'polygonAltitude',
    ].every(name => typeof this.world[name] === 'function');
  },

  _refreshCountryBorders(options = {}) {
    if (!this.world || !this._countryBordersVisible || !this._supportsCountryBorders()) return;
    // Hover and selection only change the outline. Reapplying cap, side, and
    // altitude accessors forces globe.gl to rebuild all 201 extruded meshes,
    // producing 75–90 ms interaction stalls on a DPR-2 M3 display.
    this.world.polygonStrokeColor((f) => this._countryBorderColorFn(f));
    if (options.visuals === true) {
      this.world
        .polygonCapColor((f) => this._countryPolygonPaintColorFn(f))
        .polygonSideColor((f) => this._countryPolygonSideColorFn(f))
        .polygonAltitude((f) => this._countryHexAltitudeFn(f));
    }
  },

  // ── Mode API — used by GLOBE_MODES orchestrator ──
  setHexMode(colorFn, altFn) {
    if (!this.world) return;
    this.world.hexPolygonColor(colorFn);
    if (altFn) this.world.hexPolygonAltitude(altFn);
  },

  setCountryBordersVisible(visible) {
    if (!this.world) return;

    this._countryBordersVisible = !!visible;
    if (!this._supportsCountryBorders()) {
      if (!this._countryBorderWarned) {
        this._countryBorderWarned = true;
        reportWarn('GlobeModule', 'Country polygon border layer is not supported by this globe.gl build');
      }
      return;
    }

    if (!this._countryFeatures || !this._countryFeatures.length) {
      this.world.polygonsData([]);
      return;
    }

    if (!visible) {
      this.world
        .polygonsData([])
        .polygonStrokeColor(() => 'rgba(0,0,0,0)')
        .polygonCapColor(() => 'rgba(0,0,0,0)')
        .polygonSideColor(() => 'rgba(0,0,0,0)');
      return;
    }

    if (typeof this.world.polygonsTransitionDuration === 'function') {
      this.world.polygonsTransitionDuration(0);
    }

    this.world
      .polygonsData(this._countryFeatures)
      .polygonAltitude((f) => this._countryHexAltitudeFn(f))
      .polygonCapColor((f) => this._countryPolygonPaintColorFn(f))
      .polygonSideColor((f) => this._countryPolygonSideColorFn(f))
      .polygonStrokeColor((f) => this._countryBorderColorFn(f));

    if (typeof this.world.polygonCapCurvatureResolution === 'function') {
      // Natural Earth is already generalized at 1:110m. An 8° cap curve keeps
      // the subtle raised-tile silhouette while reducing vertex work during
      // lens relief changes; tighter subdivision adds no visible country data.
      this.world.polygonCapCurvatureResolution(8);
    }
  },

  // ── Apply uniform neutral country surface ──
  applyCountrySurface() {
    if (!this.world) return;
    if (this._supportsCountryBorders()) {
      if (typeof this.world.hexPolygonsTransitionDuration === 'function') {
        this.world.hexPolygonsTransitionDuration(0);
      }
      this.world
        .hexPolygonsData([])
        .hexPolygonColor(() => 'rgba(0,0,0,0)')
        .hexPolygonAltitude(() => 0);
      return;
    }

    this.world.hexPolygonColor((f) => this._countryHexColorFn(f));
    this.world.hexPolygonAltitude((f) => this._countryHexAltitudeFn(f));
    // Increase margin so borders between countries are more visible
    if (this.isMobile) {
      this.world.hexPolygonMargin(0.75);
    } else {
      this.world.hexPolygonMargin(0.68);
    }
  },

  // ── Small nations (island + micro states) ──
  // Natural Earth 110m has no polygons for ~28 UN members (Maldives,
  // Seychelles, Tuvalu, Singapore, ...). We inject each as a synthetic
  // dot-sized circular Feature so they flow through the SAME polygon
  // layers as real countries: status fill color, border, hover highlight,
  // country tooltip, and click-to-pin all work unchanged.
  _appendSmallNationFeatures() {
    const nations = SMALL_NATION_NAVIGATION_POINTS;
    if (!Array.isArray(nations) || !nations.length) return;
    if (!Array.isArray(this._countryFeatures)) return;

    const existing = new Set(this._countryFeatures.map(f => _resolveCountryIso(f)));
    const R = 0.16;        // visual radius in degrees (~1.5px dot at default zoom)
    const HIT_R = 1.0;     // hover/click hit radius (decoupled from the visual)
    const STEPS = 12;

    const added = [];
    nations.forEach(n => {
      if (!n || !n.iso || existing.has(n.iso)) return;
      const latR = R;
      // Correct longitude radius so circles stay round away from the equator
      const lngR = R / Math.max(0.2, Math.cos(n.lat * Math.PI / 180));
      // NOTE: ring must wind CLOCKWISE (Natural Earth / shapefile convention).
      // Counterclockwise winding is interpreted on the sphere as the polygon's
      // COMPLEMENT — each "dot" became a cap covering the whole planet, which
      // stacked 28 translucent full-sphere meshes (the milky wash + the lag).
      const ring = [];
      for (let i = STEPS; i >= 0; i--) {
        const a = (i / STEPS) * Math.PI * 2;
        ring.push([n.lng + Math.cos(a) * lngR, n.lat + Math.sin(a) * latR]);
      }
      added.push({
        type: 'Feature',
        properties: {
          ISO_A3: n.iso, ADMIN: n.country, NAME: n.country,
          __smallNation: true, __lat: n.lat, __lng: n.lng, __hitR: HIT_R,
        },
        geometry: { type: 'Polygon', coordinates: [ring] },
      });
    });

    if (added.length) {
      this._countryFeatures = this._countryFeatures.concat(added);
      console.log('[Globe] Small nations layer:', added.length, 'dot markers added');
    }

    // ISO → feature lookup for card navigation (arrow keys / swipe / buttons)
    this._featureByIso = {};
    this._countryFeatures.forEach(f => { this._featureByIso[_resolveCountryIso(f)] = f; });
  },

  applyCountryBorders() {
    this.setCountryBordersVisible(true);
  },

  clearCountryBorders() {
    this.setCountryBordersVisible(false);
  },

  clearCountrySelection() {
    this.clearCountrySwipeCue();
    this._selectedCountryFeature = null;
    this._countryHoverFeature = null;
    this._defaultCountrySelected = false;
    const tt = $('hex-country-tooltip');
    if (tt) {
      if (tt.contains(document.activeElement)) document.activeElement.blur();
      tt.classList.remove('visible', 'selected');
      tt.removeAttribute('tabindex');
      tt.removeAttribute('role');
      tt.removeAttribute('aria-modal');
      tt.removeAttribute('aria-labelledby');
      tt.removeAttribute('aria-label');
      tt.setAttribute('aria-hidden', 'true');
      delete tt.dataset.status;
    }
    this._unmountCountryCard();
    this._updateRankRail();
    this._clearCountryProjects();
    this._refreshCountryBorders();
    this._syncAutoRotation();
    if (this._countryOpener && document.contains(this._countryOpener) && typeof this._countryOpener.focus === 'function') this._countryOpener.focus();
    this._countryOpener = null;
    if (hasModule('EventBus')) EventBus.emit('globe:country-closed', { timestamp: Date.now() });
  },

  // Historical compatibility API: only restoration-site points can be shown.
  toggleSitePoints(show) {
    if (!this.world) return;
    if (show) {
      this.initSitePoints();
      this.updateNodeVisuals();
    } else {
      this.world.pointsData([]);
    }
  },

  /**
   * Swap the globe's surface texture.
   * @param {string} imageUrl — equirectangular image URL (or path)
   * @param {Function} [onLoad] — called when texture is loaded
   */
  setGlobeTexture(imageUrl, onLoad) {
    if (!this.world) return;

    // Access Three.js globe mesh via the scene
    const scene = this.world.scene();
    const globeMesh = scene.children.find(c =>
      c.type === 'Mesh' && c.geometry?.type === 'SphereGeometry'
    ) || scene.children.find(c =>
      c.__globeObjType === 'globe' || (c.children && c.children.find(cc => cc.type === 'Mesh'))
    );

    // globe.gl wraps the actual globe — use globeImageUrl for safe swap
    this.world.globeImageUrl(imageUrl);

    if (onLoad) {
      // Give the texture a moment to load
      setTimeout(onLoad, 500);
    }
  },

  /** Restore the default surface for the active theme. */
  restoreDefaultTexture() {
    if (!this.world) return;
    const themeConfig = _getGlobeThemeConfig(document.documentElement?.dataset?.theme);
    safeChain(this.world, 'Globe.restoreDefaultTexture').globeImageUrl(themeConfig.surface);
  },

  /**
   * Set globe texture from an offscreen canvas.
   * Uses toDataURL (data: scheme) — CSP allows data: but blocks blob:.
   * @param {HTMLCanvasElement} canvas
   */
  setGlobeTextureFromCanvas(canvas) {
    if (!this.world || !canvas) return;
    // data: URLs are allowed by CSP and work synchronously
    const dataUrl = canvas.toDataURL('image/png');
    this.world.globeImageUrl(dataUrl);
  },

  /**
   * Set a handler for globe surface clicks (lat/lng).
   * Only one handler at a time — modes swap it.
   */
  setOnGlobeClick(fn) {
    _globeClickHandler = fn;
    console.log('[Globe] Click handler', fn ? 'SET' : 'CLEARED');
  },

  /**
   * Clear the globe click handler.
   */
  clearOnGlobeClick() {
    _globeClickHandler = null;
    console.log('[Globe] Click handler CLEARED');
  },

  _bindCanvasDragGuard() {
    if (!this._canvasEl || this._canvasDragGuardBound) return;
    this._canvasDragGuardBound = true;

    this._onCanvasPointerDown = (e) => {
      if (this._selectedCountryFeature) this.clearCountrySelection();
      this._canvasPointer = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        dragged: false,
      };
    };

    this._onCanvasPointerMoveGuard = (e) => {
      const p = this._canvasPointer;
      if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if ((dx * dx + dy * dy) > (GLOBE_DRAG_CLICK_THRESHOLD_PX * GLOBE_DRAG_CLICK_THRESHOLD_PX)) {
        p.dragged = true;
      }
    };

    this._onCanvasPointerUp = (e) => {
      const p = this._canvasPointer;
      if (p && p.id === e.pointerId && p.dragged) {
        this._suppressGlobeClickUntil = Date.now() + GLOBE_DRAG_SUPPRESS_MS;
        this.clearCountrySelection();
      }
      this._canvasPointer = null;
    };

    this._onCanvasPointerCancel = () => {
      this._canvasPointer = null;
    };

    this._canvasEl.addEventListener('pointerdown', this._onCanvasPointerDown);
    this._canvasEl.addEventListener('pointermove', this._onCanvasPointerMoveGuard);
    this._canvasEl.addEventListener('pointerup', this._onCanvasPointerUp);
    this._canvasEl.addEventListener('pointercancel', this._onCanvasPointerCancel);

    this._onCanvasMouseDown = (e) => {
      if (this._selectedCountryFeature) this.clearCountrySelection();
      this._canvasPointer = {
        id: 'mouse',
        x: e.clientX,
        y: e.clientY,
        dragged: false,
      };
    };

    this._onCanvasMouseMoveGuard = (e) => {
      const p = this._canvasPointer;
      if (!p || p.id !== 'mouse') return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if ((dx * dx + dy * dy) > (GLOBE_DRAG_CLICK_THRESHOLD_PX * GLOBE_DRAG_CLICK_THRESHOLD_PX)) {
        p.dragged = true;
      }
    };

    this._onCanvasMouseUp = () => {
      const p = this._canvasPointer;
      if (p && p.id === 'mouse' && p.dragged) {
        this._suppressGlobeClickUntil = Date.now() + GLOBE_DRAG_SUPPRESS_MS;
        this.clearCountrySelection();
      }
      this._canvasPointer = null;
    };

    this._canvasEl.addEventListener('mousedown', this._onCanvasMouseDown);
    this._canvasEl.addEventListener('mousemove', this._onCanvasMouseMoveGuard);
    this._canvasEl.addEventListener('mouseup', this._onCanvasMouseUp);
  },

  shouldIgnoreCanvasClick() {
    return Date.now() < (this._suppressGlobeClickUntil || 0);
  },

  _handleCountryGeoJsonFailure(error) {
    this._countryDataState = 'unavailable';
    this._countryDataError = error?.message || 'Country GeoJSON unavailable';
    this._countryFeatures = [];
    this.clearCountrySelection();
    this.clearCountryBorders();
    if (this.world && typeof this.world.hexPolygonsData === 'function') {
      this.world.hexPolygonsData([]);
    }
    reportWarn('GlobeModule', 'Country polygons unavailable: ' + this._countryDataError);
  },

  getCountryFeatures() {
    return this._countryFeatures || [];
  },

  // ── Lens switching ──
  _bindLensControls() {
    if (this._lensControlsBound) return;
    const controls = $('climate-lens-controls');
    if (!controls) return;
    this._lensControlsBound = true;
    controls.addEventListener('click', event => {
      const button = event.target.closest('[data-climate-lens]');
      if (!button) return;
      this.setLens(button.getAttribute('data-climate-lens'));
    });
  },

  _syncLensControls() {
    document.body.dataset.climateLens = this.currentLens;
    const lens = (Data.getClimateLensCatalog?.() || []).find(item => item.id === this.currentLens);
    const legend = safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getLegend', this.currentLens);
    document.querySelectorAll('.climate-lens-controls [data-climate-lens]').forEach(button => {
      const active = button.getAttribute('data-climate-lens') === this.currentLens;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (lens) {
      const reliefStatus = legend?.relief_demo
        ? ' Inverse relief demo: lower territorial fossil CO₂ sits slightly higher; the raw descending rail is unchanged.'
        : '';
      $text('climate-lens-status', lens.heading + ' lens selected. Country selection is preserved.' + reliefStatus);
    }
  },

  _renderLegend() {
    const legend = $('hex-legend');
    const model = safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getLegend', this.currentLens);
    if (!legend || !model) return false;
    legend.setAttribute('aria-label', model.heading + ' legend');
    legend.innerHTML = '<div class="hex-legend-title">' + _escapeHtml(model.heading) + '</div>'
      + '<div class="hex-legend-row"><span class="hex-legend-swatch" style="background:' + _escapeHtml(model.low_color) + '" aria-hidden="true"></span>' + _escapeHtml(model.low_label) + '</div>'
      + '<div class="hex-legend-row"><span class="hex-legend-swatch" style="background:' + _escapeHtml(model.high_color) + '" aria-hidden="true"></span>' + _escapeHtml(model.high_label) + '</div>'
      + '<div class="hex-legend-row"><span class="hex-legend-swatch magnitude-gap" aria-hidden="true"></span>' + _escapeHtml(model.gap_label) + '</div>'
      + '<div class="hex-legend-note">' + _escapeHtml(model.evidence_label) + ' · ' + _escapeHtml(model.extrusion_note) + ' ' + _escapeHtml(model.interpretation) + '</div>';
    return true;
  },

  setLens(lensId) {
    const catalog = Data.getClimateLensCatalog?.() || [];
    const lens = catalog.find(item => item.id === lensId);
    if (!lens) {
      reportWarn('GlobeModule', 'Unknown climate lens: ' + lensId);
      return false;
    }
    const changed = this.currentLens !== lens.id;
    this.currentLens = lens.id;
    this._buildCountryDeck();
    this._renderRankRail();
    this._syncLensControls();
    this._renderLegend();
    this._updateRankRail();
    if (this._selectedCountryFeature) {
      this._renderCountryInfoCard(this._selectedCountryFeature, true);
      this._dockCountryCard();
    } else if (this._countryHoverFeature) {
      this._renderCountryInfoCard(this._countryHoverFeature, false);
    }
    if (this._countryBordersVisible) this._refreshCountryBorders({ visuals: true });
    if (this.world && typeof this.world.hexPolygonColor === 'function') {
      this.world.hexPolygonColor(feature => this._countryHexColorFn(feature));
      if (typeof this.world.hexPolygonAltitude === 'function') this.world.hexPolygonAltitude(feature => this._countryHexAltitudeFn(feature));
    }
    if (document.body.classList.contains('globe-fallback-active')) {
      const selectedIso = this._fallbackSelectedIso;
      this._renderFallbackEvidence();
      if (selectedIso) this._renderFallbackCountry(selectedIso, false);
    }
    if (changed && hasModule('EventBus')) {
      EventBus.emit('globe:lens-changed', {
        id: lens.id,
        heading: lens.heading,
        selectedCountryIso: this._selectedCountryFeature ? _resolveCountryIso(this._selectedCountryFeature) : null,
        timestamp: Date.now(),
      });
    }
    return true;
  },

  getLens() {
    return this.currentLens;
  },

  // ── Update node visual states based on engagement ──
  updateNodeVisuals() {
    const states = hasModule('GAIA_ENGAGEMENT')
      ? GAIA_ENGAGEMENT.getSiteStates()
      : {};
    const suggestedIds = hasModule('GAIA_NODES')
      ? GAIA_NODES.getSuggestedSiteIds('')
      : [];

    this.world.pointColor(p => {
      // Site nodes: use engagement state color
      if (suggestedIds.includes(p.id)) return '#ffd700';
      const s = states[p.id];
      if (!s || s.state === 'locked') return 'rgba(78,205,196,0.3)';
      if (s.state === 'available') return 'rgba(78,205,196,0.6)';
      if (s.state === 'explored') return 'rgba(123,232,208,0.9)';
      if (s.state === 'mastered') return '#4ecdc4';
      return 'rgba(78,205,196,0.6)';
    });

    this.world.pointRadius(p => {
      if (suggestedIds.includes(p.id)) return 0.9;
      const s = states[p.id];
      if (!s || s.state === 'locked') return 0.4;
      if (s.state === 'available') return 0.6;
      if (s.state === 'explored') return 0.7;
      if (s.state === 'mastered') return 0.8;
      return 0.6;
    });
  },

  clearNodeVisuals() {
    if (!this.world) return;
    this.world.pointsData([]).labelsData([]).ringsData([]);
  },

  restoreNodeVisuals() {
    if (!this.world) return;
    this.initSitePoints();
    this.world.labelsData(Data.sites).ringsData(Data.sites);
    this.updateNodeVisuals();
  },

  // Historical compatibility hook. Country climate point tooltips remain
  // disabled until a reviewed runtime evidence release is available.
  _initPledgeTooltip() {
    return false;
  },

  // ── Standard Module Lifecycle (SML) ──
  reset() {
    console.debug('[SML] GlobeModule.reset');
    return true;
  },

  destroy() {
    console.debug('[SML] GlobeModule.destroy');

    // Remove event listeners (named references)
    window.removeEventListener('pledgeHover', this._onPledgeHover);
    window.removeEventListener('resize', this._onCountryCardResize);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('keydown', this._onCountryKeydown);
    this._onCountryCardResize = null;
    this._countryKeydownBound = false;
    this._unbindReducedMotionPreference();
    this._unbindVisibilityLifecycle();

    // Remove canvas listeners
    if (this._canvasEl) {
      this._canvasEl.removeEventListener('pointerdown', this._onCanvasPointerDown);
      this._canvasEl.removeEventListener('pointermove', this._onCanvasPointerMoveGuard);
      this._canvasEl.removeEventListener('pointerup', this._onCanvasPointerUp);
      this._canvasEl.removeEventListener('pointercancel', this._onCanvasPointerCancel);
      this._canvasEl.removeEventListener('mousedown', this._onCanvasMouseDown);
      this._canvasEl.removeEventListener('mousemove', this._onCanvasMouseMoveGuard);
      this._canvasEl.removeEventListener('mouseup', this._onCanvasMouseUp);
      this._canvasEl.removeEventListener('pointermove', this._onCanvasPointerMove);
      this._canvasEl.removeEventListener('click', this._onCanvasClick);
      this._canvasEl.removeEventListener('webglcontextlost', this._onCanvasWebGLContextLost);
      this._canvasEl = null;
    }
    this._onCanvasWebGLContextLost = null;
    this._canvasDragGuardBound = false;
    this._canvasPointer = null;

    // Destroy WebGL globe instance
    if (this.world) {
      // globe.gl 2.46.1 exposes Kapsule's `_destructor`; retain the older
      // destroy fallback for compatibility with alternate local builds.
      const destroyRenderer = typeof this.world._destructor === 'function'
        ? this.world._destructor
        : this.world.destroy;
      if (typeof destroyRenderer === 'function') {
        try {
          destroyRenderer.call(this.world);
        } catch (error) {
          reportWarn('GlobeModule', 'Renderer cleanup was incomplete.');
        }
      }
      this.world = null;
    }
    this._animationPaused = false;

    // Nullify country features (large GeoJSON)
    this._countryFeatures = null;
    this._countryDeck = [];
    this._countryDeckByLens = {};
    this._defaultCountrySelected = false;
    this._prepared = false;
    this._preparationPromise = null;
    this._preparationFailure = null;

    if (this._rankRail) {
      this._rankRail.remove();
      this._rankRail = null;
    }

    this._unmountCountryCard();
    const countryTooltip = $('hex-country-tooltip');
    if (countryTooltip) countryTooltip.remove();
    this._countryTooltipResizeObserver?.disconnect();
    this._countryTooltipResizeObserver = null;
    this._hoverTooltipSize = null;
    this._countryTooltipBound = false;

    // Nullify DOM references
    if (this._tooltip) {
      this._tooltip.remove();
      this._tooltip = null;
    }

    // Nullify click handler
    _globeClickHandler = null;
    this.hideFallback({ restoreFocus: false, preserveOpener: false, emitEvent: false });
    const fallbackPanel = $('globe-fallback');
    const fallbackSearch = $('globe-fallback-search');
    fallbackPanel?.removeEventListener('click', this._onFallbackClick);
    fallbackSearch?.removeEventListener('input', this._onFallbackInput);
    this._onFallbackClick = null;
    this._onFallbackInput = null;
    this._fallbackBound = false;
    this._fallbackEntries = [];
    this._fallbackSelectedIso = null;

    return true;
  },

  getState() {
    return {
      countryDataState: this._countryDataState,
      countryDataError: this._countryDataError,
      countryFeatureCount: this._countryFeatures?.length || 0,
      countryDeckCount: this._countryDeck.length,
      climateLens: this.currentLens,
      selectedCountryIso: this._selectedCountryFeature ? _resolveCountryIso(this._selectedCountryFeature) : null,
      fallbackActive: document.body?.classList.contains('globe-fallback-active') || false,
      fallbackReasonCode: this._fallbackReasonCode,
      fallbackEntityCount: this._fallbackEntries.length,
      runtimeAssetsPrepared: this._prepared,
      preparationFailure: this._preparationFailure,
      rendererCanvasCount: $('globeViz')?.querySelectorAll('canvas').length || 0,
      animationPaused: this._animationPaused,
    };
  },

  getRuntimeTextureState() {
    const describe = texture => {
      const image = texture?.image;
      return image ? {
        src: image.currentSrc || image.src || '',
        width: image.naturalWidth || image.width || 0,
        height: image.naturalHeight || image.height || 0,
        flipY: texture.flipY === true,
      } : null;
    };
    let sky = null;
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
    }
    return {
      surface: describe(this.world?.globeMaterial?.()?.map),
      sky,
    };
  },

  getPerformanceState() {
    const renderer = typeof this.world?.renderer === 'function' ? this.world.renderer() : null;
    const renderInfo = renderer?.info?.render || {};
    const memoryInfo = renderer?.info?.memory || {};
    return {
      targetFps: GLOBE_TARGET_FPS,
      frameBudgetMs: Number(GLOBE_FRAME_BUDGET_MS.toFixed(3)),
      rendererPixelRatio: typeof renderer?.getPixelRatio === 'function' ? renderer.getPixelRatio() : null,
      drawCalls: Number.isFinite(renderInfo.calls) ? renderInfo.calls : null,
      triangles: Number.isFinite(renderInfo.triangles) ? renderInfo.triangles : null,
      geometries: Number.isFinite(memoryInfo.geometries) ? memoryInfo.geometries : null,
      textures: Number.isFinite(memoryInfo.textures) ? memoryInfo.textures : null,
      lensDeckCacheCount: Object.keys(this._countryDeckByLens || {}).length,
    };
  },
};

// ═══════════════════════════════════════════════
// PANEL — Side panel, sliders, sandbox
// ═══════════════════════════════════════════════

const Panel = {
  currentSite: null,
  selectedAction: null,
  selectedArea: 100,

  open(site) {
    const panelContent = $('panel-content');
    if (!panelContent || !site) return false;
    this.currentSite = site;
    this.selectedAction = null;
    PanelSlider.reset();

    GlobeModule.world.pointOfView({ lat: site.lat, lng: site.lng, altitude: 0.8 }, 600);
    GlobeModule.world.controls().autoRotate = false;

    const biome = Data.getBiome(site.currentBiome) || { density: 0, name: 'Unknown' };
    const siteArea = Number.isFinite(Number(site.area)) ? Math.max(10, Number(site.area)) : 100;
    const ndvi = Array.isArray(site.ndvi) ? site.ndvi : [];
    const sandbox = Array.isArray(site.sandbox) ? site.sandbox : [];
    const climate = Array.isArray(site.climate) ? site.climate : [];
    const normalizeClimatePoint = point => ({
      temp: Number.isFinite(Number(point?.temp)) ? Number(point.temp) : 0,
      precip: Number.isFinite(Number(point?.precip)) ? Number(point.precip) : 0,
      year: point?.year ?? '—',
    });
    const initialArea = Math.min(100, siteArea);
    this.selectedArea = initialArea;
    const stock = biome.density * siteArea * 3.67;
    const latest = ndvi.length ? ndvi[ndvi.length - 1] : { year: '—', value: 0, label: 'No data' };
    const cFirst = climate.length ? normalizeClimatePoint(climate[0]) : { temp: 0, precip: 1, year: '—' };
    const cLast = climate.length ? normalizeClimatePoint(climate[climate.length - 1]) : cFirst;
    const tD = (cLast.temp - cFirst.temp).toFixed(1);
    const pD = cFirst.precip ? ((cLast.precip - cFirst.precip) / cFirst.precip * 100).toFixed(0) : '0';

    panelContent.innerHTML = `
      <div class="site-title">${_escapeHtml(site.name)}</div>
      <div class="site-subtitle">${_escapeHtml(site.subtitle)}</div>
      <div class="site-narrative">${_escapeHtml(site.narrative)}</div>
      <div class="slider-section">
        <h3>Vegetation Health Over Time</h3>
        <div class="year-display" id="year-disp">${_escapeHtml(latest.year)}</div>
        <input type="range" class="time-slider" min="0" max="${Math.max(0, ndvi.length - 1)}" value="${Math.max(0, ndvi.length - 1)}" data-panel-control="ndvi">
        <div class="slider-labels">${ndvi.map(n => `<span>${_escapeHtml(n.year)}</span>`).join('')}</div>
        <div class="ndvi-bar" id="ndvi-bar" style="width:${Math.max(0, Math.min(100, Number(latest.value) * 100))}%;background:${PanelSlider.ndviCol(Number(latest.value))}"></div>
        <div class="ndvi-label" id="ndvi-lbl">${_escapeHtml(latest.label)} · NDVI ${_escapeHtml(Number(latest.value).toFixed(2))}</div>
      </div>
      <div class="carbon-card">
        <div class="big-number">${_escapeHtml(Data.fmt(stock))}<span class="big-unit">t CO₂</span></div>
        <div class="big-label">Current carbon stock · ${_escapeHtml(biome.name)} · ${_escapeHtml(Data.fmt(siteArea))} ha</div>
      </div>
      <div class="climate-row">
        <div class="climate-mini">
          <div class="cm-label">Temperature</div>
          <div class="cm-value">${_escapeHtml(cLast.temp.toFixed(1))}°C</div>
          <div class="cm-delta warming">+${_escapeHtml(tD)}°C since ${_escapeHtml(cFirst.year)}</div>
        </div>
        <div class="climate-mini">
          <div class="cm-label">Precipitation</div>
          <div class="cm-value">${_escapeHtml(cLast.precip)} mm</div>
          <div class="cm-delta drying">${_escapeHtml(pD)}% since ${_escapeHtml(cFirst.year)}</div>
        </div>
      </div>
      <div class="sandbox-section">
        <h3>🧪 Carbon Sandbox</h3>
        <p style="font-size:13px;color:var(--text3);margin-bottom:12px">Pick a restoration strategy and adjust the area.</p>
        <div class="sandbox-options">${sandbox.map((s, i) => `<button type="button" class="sandbox-btn" data-panel-action-index="${i}" id="sb-${i}"><span class="sb-icon">${_escapeHtml(s.icon)}</span>${_escapeHtml(s.label)}</button>`).join('')}</div>
        <div class="area-control">
          <label>Area to restore (hectares)</label>
          <input type="range" class="area-slider" min="10" max="${siteArea}" value="${initialArea}" data-panel-control="area">
          <div class="area-value" id="area-val">${_escapeHtml(initialArea)} hectares</div>
        </div>
        <div id="sandbox-result"></div>
      </div>
      <div class="elu-connection"><strong>ELU Connection:</strong> ${_escapeHtml(site.connection)}</div>
      <div style="margin-top:24px;text-align:center">
        <button type="button" data-panel-action="close" style="padding:12px 32px;border:1px solid rgba(255,255,255,.12);border-radius:6px;background:rgba(255,255,255,.04);color:var(--text2);font-family:var(--body);font-size:13px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:8px">
          <span style="font-size:16px">✕</span> Close
        </button>
      </div>
    `;

    panelContent.querySelector('[data-panel-control="ndvi"]')?.addEventListener('input', event => PanelSlider.update(event.currentTarget.value));
    panelContent.querySelector('[data-panel-control="area"]')?.addEventListener('input', event => PanelSlider.setArea(event.currentTarget.value));
    panelContent.querySelectorAll('[data-panel-action-index]').forEach(button => button.addEventListener('click', () => this.pickAction(Number(button.dataset.panelActionIndex))));
    panelContent.querySelector('[data-panel-action="close"]')?.addEventListener('click', () => this.close());

    $('site-panel').classList.add('open');
    $('panel-backdrop').classList.add('show');
    $('globeViz').style.transform = 'translateX(-100vw)';
    return true;
  },

  close() {
    $('site-panel').classList.remove('open');
    $('panel-backdrop').classList.remove('show');
    $('globeViz').style.transform = '';
    this.currentSite = null;
    GlobeModule._syncAutoRotation();
    GlobeModule.world.pointOfView({ lat: 20, lng: 40, altitude: 2.2 }, 400);
  },

  pickAction(i) {
    if (!this.currentSite) return;
    this.selectedAction = i;
    document.querySelectorAll('.sandbox-btn').forEach((b, j) => b.classList.toggle('active', j === i));
    this.calcResult();
  },

  calcResult() {
    if (!this.currentSite || this.selectedAction === null) return;
    const act = this.currentSite.sandbox[this.selectedAction];
    const r = Data.transitionCarbon(this.currentSite.currentBiome, act.to, this.selectedArea, 30);
    if (!r) return;
    const ctx = Data.scaleContext(r.cumulative_co2);
    const pos = r.cumulative_co2 > 0;
    GlobeModule.userTotal = Math.abs(r.cumulative_co2);
    $text('user-total', Data.fmt(GlobeModule.userTotal) + ' t CO₂');
    $('sandbox-result').innerHTML = `
      <div class="result-card">
        <div class="big-number" style="color:${pos ? 'var(--leaf)' : 'var(--warn)'}">${pos ? '+' : ''}${_escapeHtml(Data.fmt(Math.abs(r.cumulative_co2)))} t CO₂</div>
        <div class="big-label">${pos ? 'sequestered' : 'released'} over ${_escapeHtml(r.years)} years · ${_escapeHtml(this.selectedArea)} ha</div>
        <div class="context-line">${_escapeHtml(ctx.summary)}</div>
        <div class="fraction-line">${_escapeHtml((ctx.fraction * 100).toExponential(2))}% of global annual net emissions</div>
      </div>`;
  }
};

// ═══════════════════════════════════════════════
// PANEL SLIDER — NDVI time slider + area slider
// ═══════════════════════════════════════════════

const PanelSlider = {
  ndviCol(v) { return v > 0.6 ? '#2a8a3a' : v > 0.4 ? '#6a9a4a' : v > 0.25 ? '#9a8a3a' : '#8a3a2a'; },

  update(i) {
    if (!Panel.currentSite) return;
    const n = Panel.currentSite.ndvi[i];
    $text('year-disp', n.year);
    const bar = $('ndvi-bar');
    if (bar) { bar.style.width = n.value * 100 + '%'; bar.style.background = this.ndviCol(n.value); }
    $text('ndvi-lbl', `${n.label} · NDVI ${n.value.toFixed(2)}`);
  },

  setArea(v) {
    Panel.selectedArea = parseInt(v);
    $text('area-val', v + ' hectares');
    Panel.calcResult();
  },

  reset() { Panel.selectedArea = 100; Panel.selectedAction = null; },

  // (initPledgeTooltip moved to GlobeModule._initPledgeTooltip)
};

window.GlobeModule = GlobeModule;
window.Panel = Panel;
window.PanelSlider = PanelSlider;

if (hasModule('MODULE_CONTRACTS')) {
  MODULE_CONTRACTS.register('GlobeModule', {
    provides: ['prepare', 'init', 'pause', 'resume', 'hasWebGLSupport', 'teardownFailedRenderer', 'rememberFallbackOpener', 'showFallback', 'hideFallback', 'closeEvidenceBrowser', 'setTheme', 'initSitePoints', 'updateNodeVisuals', 'setLens', 'getLens', 'setHexMode', 'setCountryBordersVisible', 'applyCountrySurface', 'applyCountryBorders', 'clearCountryBorders', 'clearCountrySelection', 'cueCountrySwipe', 'clearCountrySwipeCue', 'selectDefaultCountry', 'toggleSitePoints', 'getCountryFeatures', 'setGlobeTexture', 'restoreDefaultTexture', 'setGlobeTextureFromCanvas', 'setOnGlobeClick', 'clearOnGlobeClick', 'clearNodeVisuals', 'restoreNodeVisuals', 'reset', 'destroy', 'getState', 'getRuntimeTextureState', 'getPerformanceState'],
    requires: ['Data', 'COUNTRY_CLIMATE_INTELLIGENCE'],
    emits: ['globe:render-ready', 'globe:country-data-ready', 'globe:data-error', 'globe:country-selected', 'globe:country-navigated', 'globe:country-closed', 'globe:fallback-shown', 'globe:fallback-hidden', 'globe:lens-changed'],
  });
}
