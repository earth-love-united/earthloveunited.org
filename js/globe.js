// GLOBE v2.0 — Elevation + diverging colors + hover fix
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
const COUNTRY_GEOJSON_URL = 'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson';
const COUNTRY_GEOJSON_TIMEOUT_MS = 8000;

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
  Kosovo: 'XKX',
  'N. Cyprus': 'CYP',
  'Northern Cyprus': 'CYP',
  Somaliland: 'SOM',
};

const COUNTRY_STATUS = {
  MISSING: 'missing',
  NO_TARGET: 'no-target',
  OVERSHOOTING: 'overshooting',
  ON_TRACK: 'on-track',
};

const COUNTRY_STATUS_LABELS = {
  [COUNTRY_STATUS.MISSING]: 'No pledge data',
  [COUNTRY_STATUS.NO_TARGET]: 'No target',
  [COUNTRY_STATUS.OVERSHOOTING]: 'Overshooting',
  [COUNTRY_STATUS.ON_TRACK]: 'On track',
};

const COUNTRY_STATUS_BADGE_CLASSES = {
  [COUNTRY_STATUS.MISSING]: 'neutral',
  [COUNTRY_STATUS.NO_TARGET]: 'neutral',
  [COUNTRY_STATUS.OVERSHOOTING]: 'red',
  [COUNTRY_STATUS.ON_TRACK]: 'green',
};

function _resolveCountryIso(feature) {
  const props = feature?.properties || {};
  if (props.ISO_A3 && props.ISO_A3 !== '-99') return props.ISO_A3;

  const names = [props.ADMIN, props.NAME, props.name].filter(Boolean);
  for (const name of names) {
    if (COUNTRY_ISO_FALLBACKS[name]) return COUNTRY_ISO_FALLBACKS[name];
  }

  return props.ISO_A3 || props.ISO_A2 || 'UNK';
}

function _getCountryDisplayData(feature) {
  if (!feature) return null;
  const props = feature.properties || {};
  const iso = _resolveCountryIso(feature);
  const data = Data.countryHexColors?.[iso];
  const country = data?.country || props.ADMIN || props.NAME || props.name || iso;

  if (data) {
    return Object.assign({}, data, {
      iso,
      country,
      hasData: true,
    });
  }

  return {
    iso,
    country,
    emissions: null,
    perCapita: null,
    reductionPct: null,
    targetYear: null,
    gap: null,
    onTrack: null,
    catRating: 'No pledge dataset record',
    catScore: null,
    lat: _isFiniteNumber(Number(props.__lat)) ? Number(props.__lat) : null,
    lng: _isFiniteNumber(Number(props.__lng)) ? Number(props.__lng) : null,
    hasData: false,
  };
}

// Pledge records contain a deliberate country focus point. Countries without
// a record still need to be navigable from the full atlas, so use the small
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
  if (!d?.hasData) return COUNTRY_STATUS.MISSING;
  if (!_isFiniteNumber(d.gap)) return COUNTRY_STATUS.NO_TARGET;
  return d.gap > 0 ? COUNTRY_STATUS.OVERSHOOTING : COUNTRY_STATUS.ON_TRACK;
}

function _getCountryStatusText(d) {
  return COUNTRY_STATUS_LABELS[_getCountryStatusKey(d)];
}

function _getCountryStatusClass(d) {
  return COUNTRY_STATUS_BADGE_CLASSES[_getCountryStatusKey(d)];
}

function _getCountryStatusAttr(d) {
  const key = _getCountryStatusKey(d);
  if (key === COUNTRY_STATUS.OVERSHOOTING) return 'over';
  if (key === COUNTRY_STATUS.ON_TRACK) return 'on';
  if (key === COUNTRY_STATUS.NO_TARGET) return 'notarget';
  return 'nodata';
}

function _getCatClass(node) {
  const rating = String(node?.cat_rating || '').toLowerCase();
  if (rating.includes('critically')) return 'cat-crit';
  if (rating.includes('highly')) return 'cat-high';
  if (rating.includes('insufficient')) return 'cat-insuf';
  if (rating.includes('almost')) return 'cat-almost';
  if (rating.includes('compatible')) return 'cat-compat';
  return 'cat-unknown';
}

const GLOBE_THEME_CONFIG = Object.freeze({
  dark: Object.freeze({
    surface: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg',
    backgroundImage: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png',
    backgroundColor: '#050509',
    atmosphere: '#4ecdc4',
  }),
  light: Object.freeze({
    surface: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
    backgroundImage: null,
    backgroundColor: '#dfe9e3',
    atmosphere: '#1f5e46',
  }),
});

function _getGlobeThemeConfig(theme) {
  return theme === 'light' ? GLOBE_THEME_CONFIG.light : GLOBE_THEME_CONFIG.dark;
}

function _getCountryEmissionsClass(d) {
  if (!d?.hasData || !_isFiniteNumber(d.perCapita)) return 'No emissions class';
  if (d.perCapita < 2) return 'Low emissions';
  if (d.perCapita < 6) return 'Moderate emissions';
  if (d.perCapita < 12) return 'High emissions';
  return 'Very high emissions';
}

function _getCountryProjectCount(feature) {
  if (!feature) return null;
  const countryIso = _resolveCountryIso(feature);
  if (hasModule('Data') && typeof Data.getCarbonProjects === 'function') {
    const projects = Data.getCarbonProjects(countryIso);
    if (projects && Number.isFinite(projects.c)) return projects.c;
  }
  if (!hasModule('Data') || !Array.isArray(Data.sites)) return null;
  return Data.sites.filter(site => (
    site?.countryIso === countryIso || (
    !site?.countryIso &&
    Number.isFinite(site?.lat) &&
    Number.isFinite(site?.lng) &&
    _pointInFeature(site.lng, site.lat, feature))
  )).length;
}

function _countryStatusToken(d) {
  const key = _getCountryStatusKey(d);
  if (key === COUNTRY_STATUS.OVERSHOOTING) return 'red';
  if (key === COUNTRY_STATUS.ON_TRACK) return 'green';
  if (key === COUNTRY_STATUS.NO_TARGET) return 'amber';
  return 'neutral';
}

function _formatCountryGap(node) {
  if (!node || !Number.isFinite(node.reality_gap_mt)) return '—';
  const sign = node.reality_gap_mt > 0 ? '+' : '';
  const magnitude = Math.abs(node.reality_gap_mt);
  return sign + (hasModule('Data') ? Data.fmt(magnitude) : magnitude.toFixed(0));
}

function _countryShortCode(feature, country, iso) {
  const props = feature?.properties || {};
  const alpha2 = [props.ISO_A2, props.ISO_A2_EH]
    .find(code => code && code !== '-99');
  if (alpha2) return String(alpha2).toUpperCase();

  const words = String(country || '')
    .trim()
    .split(/\s+/)
    .filter(word => word && !/^(and|of|the)$/i.test(word));
  if (words.length > 1) return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  if (words[0]) return words[0].slice(0, 2).toUpperCase();
  return String(iso || '').slice(0, 2).toUpperCase();
}

function _trajectoryPath(values, min, max) {
  const left = 0, width = 300, top = 4, height = 32;
  const span = Math.max(1, max - min);
  return values.map((value, index) => {
    const x = left + (index / Math.max(1, values.length - 1)) * width;
    const y = top + height - ((value - min) / span) * height;
    return (index ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }).join(' ');
}

function _trajectoryPoint(values, index, min, max) {
  const span = Math.max(1, max - min);
  return {
    x: ((index / Math.max(1, values.length - 1)) * 300).toFixed(1),
    y: (4 + 32 - ((values[index] - min) / span) * 32).toFixed(1),
  };
}

function _renderCountryTrajectory(node) {
  const startYear = 2015;
  const targetYear = Number(node?.target_year);
  const momentum = Number(node?.momentum_cagr);
  const total = Number(node?.total_co2_mt);
  const target = Number(node?.implied_target_mt);
  const targetRatio = Number.isFinite(target) && target > 0 && Number.isFinite(total) && total > 0
    ? target / total
    : (Number.isFinite(Number(node.reduction_pct)) && Number(node.reduction_pct) > 0
      ? 1 - (Number(node.reduction_pct) / 100)
      : null);
  if (!Number.isFinite(targetYear) || targetYear <= startYear || !Number.isFinite(momentum)
    || !Number.isFinite(targetRatio) || targetRatio <= 0) {
    return '<div class="elu-trajectory"><div class="elu-trajectory-head"><span class="elu-trajectory-title">Trajectory</span><span class="elu-trajectory-note">No target path</span></div><div class="elu-trajectory-empty">A comparable target trajectory is not available for this country yet.</div></div>';
  }

  const years = Math.max(1, Math.round(targetYear - startYear));
  const points = 11;
  const current = [];
  const pledge = [];
  const targetEnd = targetRatio * 100;
  for (let i = 0; i < points; i++) {
    const progress = i / Math.max(1, points - 1);
    const elapsed = years * progress;
    const modeled = 100 * Math.pow(Math.max(.05, 1 + momentum / 100), elapsed);
    current.push(modeled);
    pledge.push(100 + (targetEnd - 100) * progress);
  }

  const allValues = current.concat(pledge);
  const min = Math.min.apply(null, allValues) - 5;
  const max = Math.max.apply(null, allValues) + 5;
  const statusToken = Number.isFinite(Number(node.reality_gap_mt))
    ? (Number(node.reality_gap_mt) > 0 ? 'red' : 'green')
    : 'amber';
  const statusClass = 'is-' + statusToken;
  const lastCurrent = current[current.length - 1];
  const lastTarget = pledge[pledge.length - 1];
  const markerIndex = Math.max(0, Math.min(points - 1, Math.round(((2025 - startYear) / years) * (points - 1))));
  const marker = _trajectoryPoint(current, markerIndex, min, max);
  const divergence = Number(node.divergence);
  const since2015 = Number(node.change_since_2015);
  const targetLabel = Number.isFinite(Number(node.reduction_pct)) && Number(node.reduction_pct) > 0
    ? 'Target: −' + Number(node.reduction_pct).toFixed(0) + '% by ' + Math.round(targetYear)
    : 'Target path';
  const chips = [];
  if (Number.isFinite(divergence)) chips.push('<span class="elu-trajectory-chip ' + (divergence > 0 ? 'is-red' : 'is-green') + '">Divergence ' + (divergence > 0 ? '+' : '') + divergence.toFixed(2) + '%/yr</span>');
  if (Number.isFinite(since2015)) chips.push('<span class="elu-trajectory-chip ' + (since2015 > 0 ? 'is-red' : 'is-green') + '">Since 2015 ' + (since2015 > 0 ? '+' : '') + since2015.toFixed(1) + '%</span>');
  chips.push('<span class="elu-trajectory-chip">' + targetLabel + '</span>');
  chips.push('<span class="elu-trajectory-chip ' + (Number(node.on_track) === 1 || node.on_track === true ? 'is-green' : 'is-red') + '">' + (Number(node.on_track) === 1 || node.on_track === true ? '✓ On track' : '✗ Off track') + '</span>');

  return '<div class="elu-trajectory">'
    + '<div class="elu-trajectory-head"><span class="elu-trajectory-title">Emissions trajectory</span><span class="elu-trajectory-note">2015 → ' + Math.round(targetYear) + '</span></div>'
    + '<svg viewBox="0 0 300 42" preserveAspectRatio="none" role="img" aria-label="Modeled current trend compared with the pledge trajectory">'
    + '<line class="elu-trajectory-grid" x1="0" y1="4" x2="300" y2="4"></line>'
    + '<line class="elu-trajectory-grid" x1="0" y1="20" x2="300" y2="20"></line>'
    + '<line class="elu-trajectory-grid" x1="0" y1="36" x2="300" y2="36"></line>'
    + '<line class="elu-trajectory-today" x1="' + marker.x + '" y1="4" x2="' + marker.x + '" y2="36"></line>'
    + '<path class="elu-trajectory-target" vector-effect="non-scaling-stroke" d="' + _trajectoryPath(pledge, min, max) + '"></path>'
    + '<path class="elu-trajectory-current ' + statusClass + '" vector-effect="non-scaling-stroke" d="' + _trajectoryPath(current, min, max) + '"></path>'
    + '<circle class="elu-trajectory-marker ' + statusClass + '" vector-effect="non-scaling-stroke" cx="' + marker.x + '" cy="' + marker.y + '" r="2.4"></circle>'
    + '</svg>'
    + '<div class="elu-trajectory-years" aria-hidden="true"><span>2015</span><span>' + Math.round(targetYear) + '</span></div>'
    + '<div class="elu-trajectory-legend"><span class="is-' + statusToken + '">Current trend ' + (lastCurrent >= lastTarget ? 'above' : 'below') + ' pledge path</span><span>Pledge path</span><span class="elu-trajectory-today-key">Today · 2025</span></div>'
    + '<div class="elu-trajectory-chips">' + chips.join('') + '</div>'
    + '</div>';
}

function _getCountryGaiaComment(d, projectCount) {
  const statusKey = _getCountryStatusKey(d);
  if (statusKey === COUNTRY_STATUS.MISSING) return 'GAIA is missing pledge data here; the border still keeps its place on the map.';
  if (projectCount > 0) return 'Restoration signal detected inside this country.';
  if (statusKey === COUNTRY_STATUS.NO_TARGET) return 'The promise is visible, but the target line is still incomplete.';
  if (statusKey === COUNTRY_STATUS.OVERSHOOTING) return 'This pathway is running hot against the current pledge.';
  return 'This country is closer to the green lane in the current dataset.';
}

function _isCountryModeActive() {
  return safeGet('GLOBE_MODES', 'getMode', document.body?.dataset?.globeMode || 'countries') === 'countries';
}

function _fetchJsonWithTimeout(url, timeoutMs) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  return fetch(url, controller ? { signal: controller.signal } : undefined)
    .then(resp => {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

const GlobeModule = {
  world: null,
  userTotal: 0,
  currentLens: 'gap', // 'gap' | 'forest' | 'cat'
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
  _rankRail: null,
  _countryCardWrap: null,
  _rankRailCollapsed: false,
  _defaultCountrySelected: false,

  init() {
    // Guard: Globe constructor may not be loaded yet (lazy-loaded globe.gl.js)
    if (typeof Globe === 'undefined') {
      this._globeLoadRetries++;
      if (this._globeLoadRetries > 60) {
        reportError('GlobeModule', 'Globe.gl failed to load after 60 retries (~30s). Check CDN/network.');
        return;
      }
      setTimeout(() => GlobeModule.init(), 500);
      return;
    }
    const el = $('globeViz');
    if (!el) { reportError('GlobeModule', 'globeViz element not found'); return; }
    const themeConfig = _getGlobeThemeConfig(document.documentElement?.dataset?.theme);

    // safeChain: if any method doesn't exist, it's skipped with a dev
    // warning instead of crashing the entire init.
    this.world = safeChain(new Globe(el, { animateIn: true, waitForGlobeReady: true }), 'Globe')
      .globeImageUrl(themeConfig.surface)
      .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl(themeConfig.backgroundImage)
      .backgroundColor(themeConfig.backgroundColor)
      .showAtmosphere(!this.isMobile).atmosphereColor(themeConfig.atmosphere).atmosphereAltitude(0.25)
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
    if (hasModule('EventBus')) EventBus.emit('globe:render-ready', { timestamp: Date.now() });

    // ── Pledge vs Reality country nodes ──
    // v1: point layer disabled — the bare countries globe carries pledge data
    // via colored hex polygons + the country tooltip instead of dot markers.
    // Re-enable by uncommenting when the nodes toggle returns.
    // this.initPledgeNodes();

    // ── Country hex polygons — shared between modes ──
    // Default: empty wireframe grid (visible edges, transparent fill)
    this._countryFeatures = null;
    this._countryDataState = 'loading';
    this._countryDataError = null;
    _fetchJsonWithTimeout(COUNTRY_GEOJSON_URL, COUNTRY_GEOJSON_TIMEOUT_MS)
      .then(countries => {
        if (!countries || !Array.isArray(countries.features)) {
          throw new Error('Malformed country GeoJSON');
        }
        this._countryFeatures = countries.features.filter(d => d.properties?.ISO_A2 !== 'AQ');
        // Island + micro nations missing from the 110m GeoJSON get synthetic
        // dot-sized circle features — same layers, colors, tooltip, and click
        // behavior as every other country. Appended LAST so they win the
        // point-in-polygon scan (it iterates back-to-front).
        this._appendSmallNationFeatures();
        this._countryDataState = 'ready';
        this._buildCountryDeck();
        this._renderRankRail();
        // Only build the H3 hex layer when the solid polygon-border layer is
        // NOT available (old globe.gl builds). Building world-wide hexes just
        // to clear them two calls later (applyCountryHexColors) blocked the
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
          this.applyCountryHexColors();
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
        if (this._canvasEl) {
          this._bindCanvasDragGuard();
          this._canvasEl.addEventListener('pointermove', this._onCanvasPointerMove);
          this._canvasEl.addEventListener('click', this._onCanvasClick);
        }

        this.selectDefaultCountry();

        // Notify mode modules that country data are ready
        safeCall('GLOBE_MODES', 'onCountryDataReady');
        if (hasModule('EventBus')) {
          EventBus.emit('globe:country-data-ready', {
            featureCount: this._countryFeatures.length,
            deckCount: this._countryDeck.length,
          });
        }
      })
      .catch(e => {
        this._handleCountryGeoJsonFailure(e);
        if (hasModule('EventBus')) EventBus.emit('globe:data-error', { message: 'Country layer unavailable' });
      });

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
          this.navigateCountry(event.key === 'ArrowRight' ? 1 : -1);
        }
      };
      document.addEventListener('keydown', this._onCountryKeydown);
    }

    this.world.pointOfView({ lat: 20, lng: 40, altitude: 2.2 });
    this.world.controls().autoRotate = true;
    this.world.controls().autoRotateSpeed = 0.4;
    this.world.controls().enableDamping = true;
    this.world.controls().dampingFactor = 0.1;

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

    // v1: pledge point tooltip disabled along with initPledgeNodes() — the
    // country tooltip (#hex-country-tooltip) covers pledge data instead.
    // this._initPledgeTooltip();
  },

  setTheme(theme) {
    if (!this.world) return false;
    const themeConfig = _getGlobeThemeConfig(theme);
    safeChain(this.world, 'Globe.theme')
      .globeImageUrl(themeConfig.surface)
      .backgroundImageUrl(themeConfig.backgroundImage)
      .backgroundColor(themeConfig.backgroundColor)
      .atmosphereColor(themeConfig.atmosphere);
    return true;
  },

  // ── Pledge nodes layer ──
  initPledgeNodes() {
    if (!Data.pledgeNodes || !Data.pledgeNodes.length) return;
    const pledgeNodes = Data.pledgeNodes;

    // Combine site points + pledge nodes into a single pointsData call
    // Sites get type='site', pledge nodes get type='pledge'
    const allPoints = [
      ...(Data.sites || []).map(s => ({ ...s, _type: 'site' })),
      ...pledgeNodes.map(n => ({ ...n, _type: 'pledge' })),
    ];

    this.world
      .pointsData(allPoints)
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(p => p._type === 'pledge' ? this.pledgePointAltitude(p) : 0.01)
      .pointRadius(p => p._type === 'pledge' ? this.pledgePointRadius(p) : 0.6)
      .pointColor(p => {
        if (p._type === 'pledge') return this.pledgePointColor(p);
        // Site color logic
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
        if (p._type === 'pledge') {
          if (hasModule('PLEDGE_PANEL')) {
            PLEDGE_PANEL.open(p);
          } else {
            console.warn('[Globe] PLEDGE_PANEL not available — falling back to Panel.open');
            Panel.open({ ...p, name: p.country, subtitle: 'Pledge vs Reality', narrative: p.country + ' — ' + (p.fossil_co2_mt || 0) + ' MtCO₂' });
          }
        } else {
          // Site click
          if (hasModule('GAIA_NODES')) {
            GAIA_NODES.onNodeClick(p.id);
          } else if (hasModule('SITE_PANEL')) {
            SITE_PANEL.open(p);
          } else {
            Panel.open(p);
          }
        }
      })
      .onPointHover(p => {
        if (!p) {
          window.dispatchEvent(new CustomEvent('pledgeHover', { detail: null }));
          return;
        }
        if (p._type === 'pledge') {
          const gap = p.reality_gap_mt;
          const status = gap === null ? 'No data' : (gap > 0 ? 'OVERSHOOTING' : 'On Track');
          window.dispatchEvent(new CustomEvent('pledgeHover', {
            detail: { node: p, tooltip: p.country + ' | ' + (p.fossil_co2_mt != null ? p.fossil_co2_mt : '—') + ' MtCO2 | ' + status }
          }));
        } else {
          // Site hover
          if (hasModule('GAIA_NODES')) {
            GAIA_NODES.onNodeHover(p.id);
          } else if (hasModule('GAIA_PRESENCE')) {
            GAIA_PRESENCE.speakTeaser(p.id);
            safeCall('GAIA_ENGAGEMENT', 'interact');
          }
          window.dispatchEvent(new CustomEvent('pledgeHover', { detail: null }));
        }
      });
  },

  pledgePointColor(n) {
    const gap = n.reality_gap_mt;
    if (gap === null || gap === undefined) return '#95a5a6';
    if (gap > 0) return '#e74c3c';
    return '#2ecc71';
  },

  pledgePointAltitude(n) {
    const co2 = n.fossil_co2_mt || 0;
    return 0.01 + Math.min(co2 / 50000, 0.15);
  },

  pledgePointRadius(n) {
    const co2 = n.fossil_co2_mt || 0;
    return 0.3 + Math.min(co2 / 20000, 0.8);
  },

  // ── Country hex color function — per-feature coloring ──
  // Each country gets a unique, perceptually distinct color
  // Uses HSL with deterministic hue from ISO hash + gap-based saturation
  // ── Diverging color scale for carbon sustainability ──
  // Green = on track, Red = overshooting, intensity = magnitude
  // Per-capita emissions modulate saturation (higher = more vivid)
  _countryHexColorFn(feature) {
    const d = _getCountryDisplayData(feature);
    if (!d) return 'rgba(149,165,166,0.22)';

    const perCapita = d.perCapita || 0;
    const statusKey = _getCountryStatusKey(d);
    if (statusKey === COUNTRY_STATUS.MISSING) return 'rgba(149,165,166,0.28)';

    // Fallback hexes use the same status hue categories as polygons:
    // slate = missing pledge data, amber = no target, red = overshooting,
    // green = on track. Per-capita emissions affects saturation only.
    const pc = Math.min(perCapita / 20, 1);
    const te = Math.min(Math.log(Math.max(d.emissions || 0, 1)) / Math.log(12000), 1);

    let hue = 130;
    if (statusKey === COUNTRY_STATUS.NO_TARGET) {
      hue = 35;
    } else if (statusKey === COUNTRY_STATUS.OVERSHOOTING) {
      const i = Math.min(d.gap / 500, 1);
      hue = 18 - i * 18;
    }

    const sat = 40 + pc * 45;
    const lum = 42 - te * 8;
    const alpha = 0.35 + te * 0.40;

    return 'hsla(' + Math.round(hue) + ',' + Math.round(sat) + '%,' + Math.round(lum) + '%,' + alpha.toFixed(2) + ')';
  },

  // ── Elevation function: total emissions → hex altitude ──
  // High emitters rise up (mountains), low emitters sink (valleys)
  _countryHexAltitudeFn(feature) {
    const d = _getCountryDisplayData(feature);
    if (!d?.hasData) return 0.003;

    const emissions = d.emissions || 0;
    // Log scale: 1 Mt → 0.003, 10000 Mt → 0.025
    const logEm = Math.log(Math.max(emissions, 1));
    const minLog = Math.log(1);
    const maxLog = Math.log(12000);
    const t = Math.min(Math.max((logEm - minLog) / (maxLog - minLog), 0), 1);
    return 0.003 + t * 0.022;
  },

  // ── ELU 0.7 country deck + ranked rail ──
  // The production data order is intentionally left untouched. The HUD gets
  // its own view of the complete mapped atlas: measurable gaps first, then
  // pledge records without a target, then countries awaiting pledge data.
  _buildCountryDeck() {
    const featureByIso = this._featureByIso || {};
    const entries = Object.keys(featureByIso)
      .filter(iso => iso && iso !== 'UNK' && iso !== '-99' && iso !== 'ATA')
      .map(iso => {
        const feature = featureByIso[iso];
        const data = _getCountryDisplayData(feature);
        const node = hasModule('Data') && typeof Data.getPledgeNode === 'function'
          ? Data.getPledgeNode(iso)
          : null;
        const country = data?.country || iso;
        return {
          iso,
          feature,
          data,
          node,
          country,
          shortCode: _countryShortCode(feature, country, iso),
        };
      })
      .filter(entry => entry.feature && entry.data);
    const ranked = entries
      .filter(entry => Number.isFinite(entry.node?.reality_gap_mt))
      .sort((a, b) => b.node.reality_gap_mt - a.node.reality_gap_mt);
    const noTarget = entries
      .filter(entry => entry.data.hasData && !Number.isFinite(entry.node?.reality_gap_mt))
      .sort((a, b) => String(a.country).localeCompare(String(b.country)));
    const missing = entries
      .filter(entry => !entry.data.hasData)
      .sort((a, b) => String(a.country).localeCompare(String(b.country)));
    this._countryDeck = ranked.concat(noTarget, missing);
  },

  _renderRankRail() {
    if (!document.body || !this._countryDeck.length) return;
    const previous = $('elu-country-rank-rail');
    if (previous) previous.remove();

    const rail = document.createElement('aside');
    rail.id = 'elu-country-rank-rail';
    rail.setAttribute('aria-label', 'Country reality gap ranking');
    rail.innerHTML = '<div class="elu-rank-head">'
      + '<div><div class="elu-rank-title">Reality gap</div><div class="elu-rank-subtitle">Gap first · ' + this._countryDeck.length + ' mapped countries</div></div>'
      + '<button type="button" class="elu-rank-toggle" data-rank-toggle aria-label="Collapse country ranking">−</button>'
      + '</div><div class="elu-rank-list">'
      + this._countryDeck.map((entry, index) => {
        const node = entry.node;
        const token = _countryStatusToken(entry.data);
        const gap = _formatCountryGap(node);
        const summary = entry.data.hasData ? 'gap ' + gap : 'no pledge data';
        return '<button type="button" class="elu-rank-row" data-country-rail-iso="' + _escapeHtml(entry.iso) + '" aria-label="Open ' + _escapeHtml(entry.country) + ', ' + _escapeHtml(summary) + '">'
          + '<span class="elu-rank-number">' + String(index + 1).padStart(2, '0') + '</span>'
          + '<span class="elu-rank-dot is-' + token + '" aria-hidden="true"></span>'
          + '<span class="elu-rank-name">' + _escapeHtml(entry.country) + '</span>'
          + '<span class="elu-rank-code" aria-hidden="true">' + _escapeHtml(entry.shortCode) + '</span>'
          + '<span class="elu-rank-gap">' + _escapeHtml(gap) + '</span>'
          + '</button>';
      }).join('')
      + '</div>';

    rail.addEventListener('click', event => {
      const toggle = event.target.closest('[data-rank-toggle]');
      if (toggle) {
        this._rankRailCollapsed = !this._rankRailCollapsed;
        rail.classList.toggle('is-collapsed', this._rankRailCollapsed);
        toggle.textContent = this._rankRailCollapsed ? '+' : '−';
        toggle.setAttribute('aria-label', this._rankRailCollapsed ? 'Expand country ranking' : 'Collapse country ranking');
        return;
      }
      const row = event.target.closest('[data-country-rail-iso]');
      if (!row) return;
      const feature = this._featureByIso?.[row.getAttribute('data-country-rail-iso')];
      if (feature) this._selectCountryFeature(feature, { focus: true });
    });

    document.body.appendChild(rail);
    this._rankRail = rail;
    this._updateRankRail();
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
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'Country dashboard navigation');
      wrap.innerHTML = '<button type="button" class="tt-nav tt-nav-prev" data-country-nav="-1" aria-label="Previous country" title="Previous country">◀</button>'
        + '<button type="button" class="tt-nav tt-nav-next" data-country-nav="1" aria-label="Next country" title="Next country">▶</button>';
      wrap.addEventListener('click', (event) => {
        const nav = event.target.closest('[data-country-nav]');
        if (!nav) return;
        event.preventDefault();
        event.stopPropagation();
        this.navigateCountry(parseInt(nav.getAttribute('data-country-nav'), 10) || 1);
      });
      document.body.appendChild(wrap);
    }
    if (!wrap.contains(tt)) wrap.insertBefore(tt, wrap.querySelector('.tt-nav-next'));
    this._countryCardWrap = wrap;
    return wrap;
  },

  _unmountCountryCard() {
    const tt = $('hex-country-tooltip');
    const wrap = this._countryCardWrap || $('elu-country-card-wrap');
    if (tt && wrap && wrap.contains(tt) && document.body) document.body.appendChild(tt);
    if (wrap) wrap.remove();
    this._countryCardWrap = null;
  },

  _selectCountryFeature(feature, opts = {}) {
    const d = _getCountryDisplayData(feature);
    if (!d) return;
    this._selectedCountryFeature = feature;
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
      this.world.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: pov?.altitude || 2.2 }, opts.focus ? 500 : 0);
    }
    const tt = $('hex-country-tooltip');
    if (opts.focus && tt) {
      tt.setAttribute('tabindex', '-1');
      tt.focus({ preventScroll: true });
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
          this.navigateCountry(parseInt(nav.getAttribute('data-country-nav'), 10) || 1);
          return;
        }
        // ☆ watch toggle
        const watch = event.target.closest('[data-country-watch]');
        if (watch) {
          event.preventDefault();
          event.stopPropagation();
          this._toggleWatch(watch.getAttribute('data-country-watch'));
          if (this._selectedCountryFeature) {
            this._renderCountryInfoCard(this._selectedCountryFeature, true);
            this._dockCountryCard();
          }
          return;
        }
        const stat = event.target.closest('[data-country-stat]');
        if (!stat) return;
        event.preventDefault();
        event.stopPropagation();
        stat.focus({ preventScroll: true });

        const activeFeature = this._selectedCountryFeature || this._countryHoverFeature;
        const activeData = _getCountryDisplayData(activeFeature);
        if (!activeData) return;

        const type = stat.getAttribute('data-country-stat');
        const projectCount = _getCountryProjectCount(activeFeature);
        const message = type === 'projects'
          ? activeData.country + ' has ' + (projectCount ?? 'an unknown number of') + ' restoration site' + (projectCount === 1 ? '' : 's') + ' in the current atlas layer.'
          : activeData.country + ' is classed as ' + _getCountryEmissionsClass(activeData).toLowerCase() + ' from per-person CO₂. Its pledge status is separate: ' + _getCountryStatusText(activeData).toLowerCase() + '.';
        safeCall('GAIA_BUBBLE', 'speak', message, 'curious', 4200);
      });

      // ── Swipe physics (ported from agent/designer/swipeable-hover-card) ──
      // Drag the pinned card like a deck: card follows the pointer with a
      // slight rotation; past the threshold it flies off and the next /
      // previous country card enters. Vertical drags stay native scroll
      // (touch-action: pan-y in CSS + horizontal-intent detection here).
      let _dragStartX = 0, _dragStartY = 0, _dragging = false, _dragEngaged = false, _dragPointerId = null;

      tt.addEventListener('pointerdown', (e) => {
        if (!tt.classList.contains('selected')) return;
        if (e.target.closest('.tt-close,.tt-nav,[data-country-stat],a')) return;
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
          this.navigateCountry(1, { fromDrag: true });   // swipe right → next (Bumble)
        } else if (dx < -110) {
          this.navigateCountry(-1, { fromDrag: true });  // swipe left → previous
        } else {
          tt.classList.add('tt-snap');
          tt.style.transform = 'none';
          setTimeout(() => tt.classList.remove('tt-snap'), 450);
        }
      };
      tt.addEventListener('pointerup', _dragRelease);
      tt.addEventListener('pointercancel', _dragRelease);

      // Keep the docked card on-screen when the window resizes
      window.addEventListener('resize', () => {
        if (tt.classList.contains('selected') && tt.classList.contains('visible')) {
          this._dockCountryCard();
        }
      });

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
        this.navigateCountry(e.deltaX < 0 ? 1 : -1);
      }, { passive: false });
    }

    const projectCount = _getCountryProjectCount(feature);
    const projects = projectCount === null
      ? 'Unknown'
      : projectCount + ' site' + (projectCount === 1 ? '' : 's');
    const statusText = _getCountryStatusText(d);
    const statusClass = _getCountryStatusClass(d);
    const statusAttr = _getCountryStatusAttr(d);
    const emissions = d.emissions ? d.emissions.toLocaleString() + ' MtCO₂/yr' : 'No emissions data';
    const perCapita = d.perCapita ? d.perCapita + ' t/person' : 'No per-person data';
    const comment = _getCountryGaiaComment(d, projectCount);

    if (selected) this._ensureCountryCardWrap(tt);
    else this._unmountCountryCard();
    tt.classList.toggle('selected', !!selected);
    tt.dataset.status = statusAttr;
    tt.setAttribute('role', selected ? 'region' : 'tooltip');
    tt.setAttribute('aria-label', selected ? d.country + ' climate dashboard' : d.country + ' country summary');
    if (!selected) tt.removeAttribute('tabindex');

    const watched = selected && this._getWatchlist().includes(d.iso);
    let html = '<div class="tt-topline">'
      + '<div class="tt-country">' + _escapeHtml(d.country) + '</div>'
      + '<div class="tt-pill tt-status-' + statusClass + '">' + _escapeHtml(statusText) + '</div>'
      + (selected ? '<button type="button" class="tt-watch' + (watched ? ' watched' : '') + '" data-country-watch="' + _escapeHtml(d.iso) + '" aria-label="Watch this country" title="Watch — build a list, get updates">' + (watched ? '★' : '☆') + '</button>' : '')
      + (selected ? '<button type="button" class="tt-close" data-country-close aria-label="Close">✕</button>' : '')
      + '</div>'
      + '<div class="tt-detail">' + _escapeHtml(emissions) + ' · ' + _escapeHtml(perCapita) + '</div>';

    if (!selected) {
      // ── Compact hover card ──
      html += '<div class="tt-stat-grid">'
        + '<button type="button" class="tt-stat" data-country-stat="emissions"><span>Class</span><strong>' + _escapeHtml(_getCountryEmissionsClass(d)) + '</strong></button>'
        + '<button type="button" class="tt-stat" data-country-stat="projects"><span>Restoration</span><strong>' + _escapeHtml(projects) + '</strong></button>'
        + '</div>'
        + '<div class="tt-comment">' + _escapeHtml(comment) + '</div>';
    } else {
      // ── Pinned card: full pledge-vs-reality metrics ──
      html += this._renderCountryMetrics(d);
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
    // Bumble semantics: advancing throws the card out to the RIGHT and the
    // next one enters from the left; going back mirrors it.
    const outClass = dir > 0 ? 'tt-fly-right' : 'tt-fly-left';
    const inClass = dir > 0 ? 'tt-enter-left' : 'tt-enter-right';

    const swap = () => {
      this._selectedCountryFeature = target.feature;
      this._countryHoverFeature = target.feature;
      this._renderCountryInfoCard(target.feature, true);
      this._dockCountryCard();
      this._refreshCountryBorders();
      this._showCountryProjects(target.iso);
      this._updateRankRail();
      if (hasModule('EventBus')) EventBus.emit('globe:country-selected', { iso: target.iso, country: target.country });

      // Fly the globe to the new country, keeping the current zoom
      if (this.world) {
        const pov = this.world.pointOfView();
        const focus = _getCountryFocus(target.feature, target.data);
        if (focus) this.world.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: pov.altitude }, 650);
      }

      if (tt) {
        tt.classList.remove(outClass);
        tt.classList.add(inClass);
        // force reflow so the enter transform applies before transitioning back
        void tt.offsetWidth;
        tt.classList.add('tt-snap');
        tt.classList.remove(inClass);
        tt.style.transform = 'none';
        setTimeout(() => { tt.classList.remove('tt-snap'); this._navBusy = false; }, 460);
      } else {
        this._navBusy = false;
      }
    };

    if (tt) {
      tt.classList.remove('tt-snap', 'tt-dragging');
      tt.classList.add(outClass);
      setTimeout(swap, opts.fromDrag ? 300 : 260);
    } else {
      swap();
    }
  },

  // Full metrics block for the pinned country card. Reads the raw pledge
  // node (Data.pledgeNodes has all 27 fields); degrades to a short note
  // for countries without pledge data.
  _renderCountryMetrics(d) {
    const node = (hasModule('Data') && typeof Data.getPledgeNode === 'function') ? Data.getPledgeNode(d.iso) : null;
    const fmt = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—'
      : (hasModule('Data') ? Data.fmt(n) : String(n));

    if (!node) {
      return '<div class="tt-comment" style="margin-top:8px">No pledge dataset entry for this country yet. Its emissions and NDC data are not in the current atlas layer.</div>'
        + '<div class="tt-hint">esc or ✕ to close</div>';
    }

    let html = '';

    // CAT rating badge
    if (node.cat_rating) {
      const catClass = _getCatClass(node);
      html += '<div class="tt-cat ' + catClass + '" data-cat-rating="' + _escapeHtml(node.cat_rating) + '">'
        + '<span class="tt-cat-dot" aria-hidden="true"></span>'
        + _escapeHtml(node.cat_rating) + ' <span class="tt-cat-src">· Climate Action Tracker</span></div>';
    }

    // Reality gap
    const gap = node.reality_gap_mt;
    html += '<div class="tt-gap">'
      + '<div class="tt-gap-big">' + fmt(node.fossil_co2_mt) + ' <span>MtCO₂/yr fossil</span></div>'
      + (gap === null || gap === undefined
          ? '<div class="tt-gap-line">No target data available</div>'
          : '<div class="tt-gap-line ' + (gap > 0 ? 'tt-red' : 'tt-green') + '">Gap to pledge target: ' + (gap > 0 ? '+' : '') + fmt(gap) + ' MtCO₂</div>')
      + '</div>';

    // Emissions grid
    const pc = (typeof node.co2_per_capita === 'number' && node.co2_per_capita > 0) ? node.co2_per_capita.toFixed(1) : '—';
    html += '<div class="tt-grid4">'
      + '<div><span>Fossil</span><strong>' + fmt(node.fossil_co2_mt) + '</strong></div>'
      + '<div><span>LULUCF</span><strong>' + fmt(node.lulucf_co2_mt) + '</strong></div>'
      + '<div><span>Total Mt</span><strong>' + fmt(node.total_co2_mt) + '</strong></div>'
      + '<div><span>t/person</span><strong>' + pc + '</strong></div>'
      + '</div>';

    // Designer handoff: keep the pledge path legible without replacing the
    // production metrics. The chart is explicitly modeled, not presented as
    // a new data source.
    html += _renderCountryTrajectory(node);

    // Momentum: actual vs required velocity
    const mom = node.momentum_cagr, req = node.required_cagr;
    if (typeof mom === 'number') {
      html += '<div class="tt-momentum">'
        + '<div class="' + (mom > 0 ? 'tt-red' : 'tt-green') + '"><span>Actual</span><strong>' + (mom > 0 ? '+' : '') + mom.toFixed(2) + '%/yr</strong></div>'
        + (typeof req === 'number' && req > 0
            ? '<em>vs</em><div class="tt-teal"><span>Required</span><strong>−' + req.toFixed(2) + '%/yr</strong></div>'
            : '')
        + '</div>';
    }

    // Climate finance
    if (typeof node.finance_total_bn === 'number' && node.finance_total_bn > 0) {
      html += '<div class="tt-finance">$' + fmt(node.finance_total_bn) + 'B <span>target conditional on international finance</span></div>';
    }

    // NDC summary
    if (node.ndc_summary) {
      html += '<div class="tt-ndc"><span>NDC pledge</span>' + _escapeHtml(node.ndc_summary) + '</div>';
    }

    // ── Close the Gap: the credit market bridge ──
    html += this._renderCloseTheGap(node);

    html += '<div class="tt-hint">← → or swipe to browse countries · esc closes</div>';
    return html;
  },

  // ── Carbon price (voluntary market) ──
  // Live median listing price from Carbonmark, cached for the session;
  // falls back to a baked estimate so the card never blocks on the network.
  CARBON_PRICE_FALLBACK: 6.5, // USD/tCO₂ — Ecosystem Marketplace VCM avg (est.)
  _carbonPrice: null,          // { value, live }
  _fetchCarbonPrice() {
    if (this._carbonPrice || this._carbonPriceFetching) return;
    try {
      const cached = sessionStorage.getItem('elu_carbon_price');
      if (cached) {
        const c = JSON.parse(cached);
        if (Date.now() - c.at < 3600000) { this._carbonPrice = { value: c.value, live: true }; return; }
      }
    } catch { /* ignore */ }
    this._carbonPriceFetching = true;
    fetch('https://api.carbonmark.com/prices')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(list => {
        const prices = (Array.isArray(list) ? list : [])
          .map(l => Number(l.purchasePrice))
          .filter(p => p > 0.5 && p < 500)
          .sort((a, b) => a - b);
        if (!prices.length) throw new Error('no prices');
        const median = prices[Math.floor(prices.length / 2)];
        this._carbonPrice = { value: median, live: true };
        try { sessionStorage.setItem('elu_carbon_price', JSON.stringify({ value: median, at: Date.now() })); } catch { /* ignore */ }
        // Refresh the pinned card so the estimate becomes the live figure
        if (this._selectedCountryFeature) {
          this._renderCountryInfoCard(this._selectedCountryFeature, true);
          this._dockCountryCard();
        }
      })
      .catch(() => { /* fallback stays in effect */ })
      .finally(() => { this._carbonPriceFetching = false; });
  },

  _renderCloseTheGap(node) {
    this._fetchCarbonPrice();
    const cp = (hasModule('Data') && typeof Data.getCarbonProjects === 'function') ? Data.getCarbonProjects(node.iso) : null;
    const price = this._carbonPrice ? this._carbonPrice.value : this.CARBON_PRICE_FALLBACK;
    const live = !!this._carbonPrice;
    const fmt = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—'
      : (hasModule('Data') ? Data.fmt(n) : String(n));

    const gapIsFinite = typeof node.reality_gap_mt === 'number' && Number.isFinite(node.reality_gap_mt);
    const gapHeading = gapIsFinite && node.reality_gap_mt <= 0 ? 'Extend the lead' : 'Close the gap';
    let html = '<div class="tt-ctg"><span class="tt-ctg-label">' + gapHeading + '</span>';

    // Demand side: the pledge gap priced in credits
    const gap = node.reality_gap_mt;
    if (typeof gap === 'number' && gap > 0) {
      const credits = gap * 1e6; // 1 credit = 1 tCO₂
      const usd = credits * price;
      html += '<div class="tt-ctg-line">Overshoot ≈ <strong>' + fmt(credits) + ' credits/yr</strong>'
        + ' ≈ <strong>$' + fmt(usd) + '/yr</strong>'
        + ' <em>at ~$' + price.toFixed(2) + '/t voluntary ' + (live ? 'median (Carbonmark, live)' : 'avg (est.)') + '</em></div>';
    } else if (typeof gap === 'number') {
      html += '<div class="tt-ctg-line tt-green">Tracking at or under its pledge — credits here go beyond the target.</div>';
    }

    // Supply side: real projects on the ground
    if (cp && cp.c > 0) {
      html += '<div class="tt-ctg-supply">' + cp.c.toLocaleString() + ' carbon project' + (cp.c === 1 ? '' : 's')
        + ' on the ground · <strong>' + fmt(cp.ar) + ' tCO₂/yr</strong> claimed'
        + (cp.ci > 0 ? ' · ' + fmt(cp.ci) + ' credits issued' : '') + '</div>';
      const top = (cp.top || []).slice(0, 3);
      if (top.length) {
        html += '<div class="tt-projects">';
        top.forEach(p => {
          const reg = p.r === 'gold_standard' ? 'GS' : p.r === 'verra' ? 'VCS' : (p.r || '?').toUpperCase().slice(0, 4);
          const type = (p.t || 'other').replace(/_/g, ' ');
          html += '<a class="tt-proj" href="' + _escapeHtml(p.u) + '" target="_blank" rel="noopener">'
            + '<span class="tt-proj-reg">' + _escapeHtml(reg) + '</span>'
            + '<span class="tt-proj-name">' + _escapeHtml(p.n) + '</span>'
            + '<span class="tt-proj-meta">' + _escapeHtml(type) + ' · ' + fmt(p.ar) + ' t/yr</span>'
            + '</a>';
        });
        html += '</div>';
        const shown = Math.min((cp.top || []).length, 6);
        html += '<div class="tt-ctg-note">' + shown + ' largest shown as ◆ on the globe — registry links open the public record</div>';
      }
    } else {
      html += '<div class="tt-ctg-supply tt-ctg-none">No registered carbon projects in the unified dataset for this country yet.</div>';
    }

    // ── The hook: free sourcing brief, ELU as the verification layer ──
    html += '<a class="tt-brief-btn" href="' + _escapeHtml(this._briefMailto(node, cp, price)) + '">Request a sourcing brief for ' + _escapeHtml(node.country) + '</a>'
      + '<div class="tt-brief-sub">Free · registry records pulled + satellite ground-truth where possible · no obligation</div>';

    html += '</div>';

    // Watchlist line (retention): appears once anything is watched
    const wl = this._getWatchlist();
    if (wl.length) {
      const listNames = wl.join(', ');
      const wlMail = 'mailto:info@earthloveunited.org'
        + '?subject=' + encodeURIComponent('Watchlist updates — ' + listNames)
        + '&body=' + encodeURIComponent('Hello Earth Love United,\n\nPlease send me updates on these countries from the living globe (new registered projects, verification results, market moves):\n\n' + listNames + '\n\nMy email: \nOrganization (optional): \n');
      html += '<div class="tt-watchline">★ ' + wl.length + ' watched · <a href="' + _escapeHtml(wlMail) + '">email me updates</a></div>';
    }
    return html;
  },

  // ── Watchlist (localStorage, ISO codes) ──
  _getWatchlist() {
    try { return JSON.parse(localStorage.getItem('elu_watchlist') || '[]'); } catch { return []; }
  },
  _toggleWatch(iso) {
    const wl = this._getWatchlist();
    const i = wl.indexOf(iso);
    if (i >= 0) wl.splice(i, 1); else wl.push(iso);
    try { localStorage.setItem('elu_watchlist', JSON.stringify(wl)); } catch { /* ignore */ }
    return wl.includes(iso);
  },

  // Prefilled sourcing-brief email — the lead arrives with full context
  _briefMailto(node, cp, price) {
    const gap = node.reality_gap_mt;
    const fmt = (n) => (hasModule('Data') ? Data.fmt(n) : String(n));
    const lines = [
      'Hello Earth Love United,',
      '',
      'I was exploring the living globe and would like a sourcing brief for ' + node.country + '.',
      '',
      'Context from the atlas:',
      '- Pledge status: ' + (node.cat_rating || 'n/a') + (typeof gap === 'number' ? ' · gap to target ' + (gap > 0 ? '+' : '') + fmt(gap) + ' MtCO2/yr' : ''),
    ];
    if (cp && cp.c > 0) {
      lines.push('- Projects in the unified dataset: ' + cp.c + ' (' + fmt(cp.ar) + ' tCO2/yr claimed)');
      (cp.top || []).slice(0, 3).forEach(p => {
        const reg = (p.r === 'gold_standard' ? 'GS' : p.r === 'verra' ? 'VCS' : p.r);
        lines.push('  · ' + p.n + ' [' + reg + ']');
      });
    }
    lines.push(
      '- Reference price at time of visit: ~$' + price.toFixed(2) + '/t',
      '',
      'About me:',
      '- Organization: ',
      '- Volume I am exploring (tCO2): ',
      '- Timeline: ',
      '',
      'Thanks,'
    );
    return 'mailto:info@earthloveunited.org'
      + '?subject=' + encodeURIComponent('Sourcing brief request — ' + node.country + ' (' + node.iso + ')')
      + '&body=' + encodeURIComponent(lines.join('\n'));
  },

  // ── Project markers: the pinned country's top projects on the globe ──
  _showCountryProjects(iso) {
    if (!this.world || typeof this.world.pointsData !== 'function') return;
    const cp = (hasModule('Data') && typeof Data.getCarbonProjects === 'function') ? Data.getCarbonProjects(iso) : null;
    const pts = (cp && cp.top ? cp.top : []).filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');
    const typeColor = (t) => t === 'forestry' || t === 'agriculture' ? 'rgba(91,191,114,0.95)'
      : t === 'renewable_energy' ? 'rgba(78,205,196,0.95)'
      : t === 'energy_efficiency' ? 'rgba(123,232,208,0.9)'
      : 'rgba(212,165,116,0.95)';
    this.world
      .pointsData(pts)
      .pointLat('lat').pointLng('lng')
      .pointAltitude(0.015).pointRadius(0.22)
      .pointColor(p => typeColor(p.t))
      .pointResolution(10);
    if (typeof this.world.pointLabel === 'function') {
      this.world.pointLabel(p =>
        '<div style="max-width:220px"><strong>' + _escapeHtml(p.n) + '</strong><br>'
        + _escapeHtml((p.t || 'other').replace(/_/g, ' ')) + ' · '
        + (hasModule('Data') ? Data.fmt(p.ar) : p.ar) + ' tCO₂/yr</div>');
    }
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

    wrap.style.position = 'fixed';
    wrap.style.zIndex = '50';
    wrap.style.right = '24px';
    wrap.style.left = 'auto';
    wrap.style.top = '64px';
    wrap.style.bottom = '96px';
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
      wrap.style.top = '60px';
      wrap.style.bottom = '78px';
      wrap.style.alignItems = 'flex-end';
    }
  },

  _positionCountryInfoCard(event) {
    const tt = $('hex-country-tooltip');
    if (!tt) return;
    if (tt.classList.contains('selected')) { this._dockCountryCard(); return; }
    if (!event) return;

    const width = tt.offsetWidth || 280;
    const height = tt.offsetHeight || 140;
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
    if (feature === this._countryHoverFeature) return 'rgba(246,255,250,0.96)';
    if (feature === this._selectedCountryFeature) return 'rgba(123,232,208,0.86)';

    const d = _getCountryDisplayData(feature);
    const small = !!feature?.properties?.__smallNation;
    if (!d) return small ? 'rgba(200,230,235,0.7)' : 'rgba(180,215,218,0.34)';
    const statusKey = _getCountryStatusKey(d);
    // Small-nation dots get a bright rim so they read at a few pixels wide
    if (statusKey === COUNTRY_STATUS.MISSING) return small ? 'rgba(225,245,248,0.9)' : 'rgba(170,205,214,0.34)';
    if (statusKey === COUNTRY_STATUS.NO_TARGET) return small ? 'rgba(245,210,160,0.92)' : 'rgba(214,184,138,0.38)';
    if (statusKey === COUNTRY_STATUS.OVERSHOOTING) return small ? 'rgba(255,150,128,0.95)' : 'rgba(255,132,112,0.42)';
    return small ? 'rgba(136,245,188,0.95)' : 'rgba(116,232,172,0.42)';
  },

  _countryPolygonPaintColorFn(feature) {
    const hovered = feature === this._countryHoverFeature;
    const selected = feature === this._selectedCountryFeature;
    const d = _getCountryDisplayData(feature);
    const hoverBoost = hovered ? 0.12 : (selected ? 0.08 : 0);

    // Small-nation dot markers: a few pixels wide, so the usual low-alpha
    // country wash would vanish. Paint them near-solid for contrast.
    if (feature?.properties?.__smallNation) {
      const boost = hovered ? 0.10 : (selected ? 0.08 : 0);
      const statusKey = d ? _getCountryStatusKey(d) : COUNTRY_STATUS.MISSING;
      if (statusKey === COUNTRY_STATUS.NO_TARGET) return 'rgba(224,172,110,' + (0.88 + boost).toFixed(2) + ')';
      if (statusKey === COUNTRY_STATUS.OVERSHOOTING) return 'rgba(255,84,58,' + (0.90 + boost).toFixed(2) + ')';
      if (statusKey === COUNTRY_STATUS.ON_TRACK) return 'rgba(46,214,118,' + (0.88 + boost).toFixed(2) + ')';
      return 'rgba(150,182,196,' + (0.85 + boost).toFixed(2) + ')';
    }

    if (!d) return 'rgba(120,150,165,' + (0.14 + hoverBoost).toFixed(2) + ')';
    const statusKey = _getCountryStatusKey(d);
    if (statusKey === COUNTRY_STATUS.MISSING) return 'rgba(120,150,165,' + (0.14 + hoverBoost).toFixed(2) + ')';

    const emissions = d.emissions || 0;
    const te = Math.min(Math.log(Math.max(emissions, 1)) / Math.log(12000), 1);
    const alpha = Math.min(0.28, 0.16 + te * 0.12) + hoverBoost;
    const cappedAlpha = Math.min(alpha, 0.42).toFixed(2);

    // Status drives hue; emissions only modulates opacity. A low-emissions
    // country can still be overshooting its pledge target.
    if (statusKey === COUNTRY_STATUS.NO_TARGET) return 'rgba(212,165,116,' + (0.16 + hoverBoost).toFixed(2) + ')';
    if (statusKey === COUNTRY_STATUS.OVERSHOOTING) {
      const intensity = Math.min(d.gap / 500, 1);
      const red = Math.round(220 + intensity * 35);
      const green = Math.round(108 - intensity * 40);
      return 'rgba(' + red + ',' + green + ',58,' + cappedAlpha + ')';
    }
    return 'rgba(46,204,113,' + cappedAlpha + ')';
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

  _refreshCountryBorders() {
    if (!this.world || !this._countryBordersVisible || !this._supportsCountryBorders()) return;
    this.world
      .polygonStrokeColor((f) => this._countryBorderColorFn(f))
      .polygonCapColor((f) => this._countryPolygonPaintColorFn(f));
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
      .polygonAltitude(() => 0.007)
      .polygonCapColor((f) => this._countryPolygonPaintColorFn(f))
      .polygonSideColor(() => 'rgba(0,0,0,0)')
      .polygonStrokeColor((f) => this._countryBorderColorFn(f));

    if (typeof this.world.polygonCapCurvatureResolution === 'function') {
      // 1° tessellation on 204 country caps generated millions of triangles
      // and froze low/mid GPUs. 5° is visually identical at cap altitude
      // 0.007 and ~25x lighter.
      this.world.polygonCapCurvatureResolution(5);
    }
  },

  // ── Apply country-colored hex map ──
  applyCountryHexColors() {
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
    const nations = Data.smallNations;
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
    this._selectedCountryFeature = null;
    this._countryHoverFeature = null;
    this._defaultCountrySelected = false;
    const tt = $('hex-country-tooltip');
    if (tt) {
      if (tt.contains(document.activeElement)) document.activeElement.blur();
      tt.classList.remove('visible', 'selected');
      tt.removeAttribute('tabindex');
      delete tt.dataset.status;
    }
    this._unmountCountryCard();
    this._updateRankRail();
    this._clearCountryProjects();
    this._refreshCountryBorders();
    if (hasModule('EventBus')) EventBus.emit('globe:country-closed', { timestamp: Date.now() });
  },

  // ── Toggle pledge node cylinders on/off ──
  togglePledgeNodes(show) {
    if (!this.world) return;
    if (show) {
      this.initPledgeNodes();
      this.updateNodeVisuals();
    } else {
      // Remove only pledge-type points, keep site points
      const currentPoints = this.world.pointsData() || [];
      const sitePoints = currentPoints.filter(p => p._type !== 'pledge');
      this.world.pointsData(sitePoints);
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
  setLens(lens) {
    this.currentLens = lens;
    this.updatePledgeVisuals();
  },

  updatePledgeVisuals() {
    if (!Data.pledgeNodes) return;
    const nodes = Data.pledgeNodes;

    switch (this.currentLens) {
      case 'gap':
        // Reality Gap: color by gap, height by emissions
        this.world.pointColor(n => {
          const gap = n.reality_gap_mt;
          if (gap === null || gap === undefined) return '#95a5a6';
          if (gap > 0) return '#e74c3c';
          return '#2ecc71';
        });
        this.world.pointAltitude(n => 0.01 + Math.min((n.fossil_co2_mt || 0) / 50000, 0.15));
        break;

      case 'forest':
        // Forestry Loophole: height includes LULUCF
        this.world.pointColor(n => {
          const lulucf = n.lulucf_co2_mt || 0;
          const fossil = n.fossil_co2_mt || 1;
          const ratio = Math.abs(lulucf) / fossil;
          if (ratio > 0.5) return '#e67e22'; // High LULUCF = orange
          if (ratio > 0.2) return '#f39c12';
          return '#27ae60';
        });
        this.world.pointAltitude(n => {
          const total = (n.fossil_co2_mt || 0) + Math.abs(n.lulucf_co2_mt || 0);
          return 0.01 + Math.min(total / 50000, 0.2);
        });
        break;

      case 'cat':
        // CAT Rating: use globe_color hex
        this.world.pointColor(n => n.globe_color || '#95a5a6');
        this.world.pointAltitude(n => 0.01 + Math.min((n.fossil_co2_mt || 0) / 50000, 0.15));
        break;
    }
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
      // Pledge nodes: use gap color
      if (p._type === 'pledge') {
        const gap = p.reality_gap_mt;
        if (gap === null || gap === undefined) return '#95a5a6';
        if (gap > 0) return '#e74c3c';
        return '#2ecc71';
      }
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
      if (p._type === 'pledge') {
        const co2 = p.fossil_co2_mt || 0;
        return 0.3 + Math.min(co2 / 20000, 0.8);
      }
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
    this.initPledgeNodes();
    this.world.labelsData(Data.sites).ringsData(Data.sites);
    this.updateNodeVisuals();
  },

  // ── Pledge tooltip (was incorrectly on PanelSlider) ──
  _initPledgeTooltip() {
    let tooltip = $('pledge-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'pledge-tooltip';
      document.body.appendChild(tooltip);
    }
    this._tooltip = tooltip;

    this._onPledgeHover = (e) => {
      const detail = e.detail;
      if (!detail || !detail.node) {
        tooltip.classList.remove('visible');
        return;
      }
      const n = detail.node;
      const gap = n.reality_gap_mt;
      const statusClass = gap === null ? '' : (gap > 0 ? 'tt-status-red' : 'tt-status-green');
      const statusText = gap === null ? 'No target data' : (gap > 0 ? 'OVERSHOOTING' : 'ON TRACK');
      const target = n.reduction_pct > 0 ? n.reduction_pct + '% by ' + Math.round(n.target_year) : 'No target';
      const cat = n.cat_rating ? ' · ' + n.cat_rating : '';
      tooltip.innerHTML = '<div class="tt-country">' + n.country + cat + '</div>'
        + '<div class="tt-detail">' + (n.fossil_co2_mt ? n.fossil_co2_mt.toFixed(1) : '—') + ' MtCO₂ · ' + target + '</div>'
        + '<div class="' + statusClass + '">' + statusText + '</div>';
      tooltip.classList.add('visible');
    };
    window.addEventListener('pledgeHover', this._onPledgeHover);

    this._onMouseMove = (e) => {
      if (tooltip.classList.contains('visible')) {
        const x = Math.min(e.clientX + 16, window.innerWidth - 320);
        const y = Math.min(e.clientY - 12, window.innerHeight - 80);
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
      }
    };
    document.addEventListener('mousemove', this._onMouseMove);
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
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('keydown', this._onCountryKeydown);
    this._countryKeydownBound = false;

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
      this._canvasEl = null;
    }
    this._canvasDragGuardBound = false;
    this._canvasPointer = null;

    // Destroy WebGL globe instance
    if (this.world) {
      // Globe.gl wraps Three.js — call its destroy method if available
      if (typeof this.world.destroy === 'function') {
        this.world.destroy();
      }
      this.world = null;
    }

    // Nullify country features (large GeoJSON)
    this._countryFeatures = null;
    this._countryDeck = [];
    this._defaultCountrySelected = false;

    if (this._rankRail) {
      this._rankRail.remove();
      this._rankRail = null;
    }

    this._unmountCountryCard();
    const countryTooltip = $('hex-country-tooltip');
    if (countryTooltip) countryTooltip.remove();
    this._countryTooltipBound = false;

    // Nullify DOM references
    if (this._tooltip) {
      this._tooltip.remove();
      this._tooltip = null;
    }

    // Nullify click handler
    _globeClickHandler = null;

    return true;
  },

  getState() {
    return {
      countryDataState: this._countryDataState,
      countryDataError: this._countryDataError,
      countryFeatureCount: this._countryFeatures?.length || 0,
      countryDeckCount: this._countryDeck.length,
      selectedCountryIso: this._selectedCountryFeature ? _resolveCountryIso(this._selectedCountryFeature) : null,
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
    this.currentSite = site;
    this.selectedAction = null;
    PanelSlider.reset();

    GlobeModule.world.pointOfView({ lat: site.lat, lng: site.lng, altitude: 0.8 }, 600);
    GlobeModule.world.controls().autoRotate = false;

    const biome = Data.getBiome(site.currentBiome) || { density: 0, name: 'Unknown' };
    const stock = biome.density * (site.area || 0) * 3.67;
    const latest = (site.ndvi && site.ndvi.length) ? site.ndvi[site.ndvi.length - 1] : { year: '—', value: 0, label: 'No data' };
    const cFirst = (site.climate && site.climate.length) ? site.climate[0] : { temp: 0, precip: 1, year: '—' };
    const cLast = (site.climate && site.climate.length) ? site.climate[site.climate.length - 1] : cFirst;
    const tD = (cLast.temp - cFirst.temp).toFixed(1);
    const pD = cFirst.precip ? ((cLast.precip - cFirst.precip) / cFirst.precip * 100).toFixed(0) : '0';

    $('panel-content').innerHTML = `
      <div class="site-title">${site.name}</div>
      <div class="site-subtitle">${site.subtitle}</div>
      <div class="site-narrative">${site.narrative}</div>
      <div class="slider-section">
        <h3>Vegetation Health Over Time</h3>
        <div class="year-display" id="year-disp">${latest.year}</div>
        <input type="range" class="time-slider" min="0" max="${site.ndvi.length - 1}" value="${site.ndvi.length - 1}" oninput="PanelSlider.update(this.value)">
        <div class="slider-labels">${site.ndvi.map(n => `<span>${n.year}</span>`).join('')}</div>
        <div class="ndvi-bar" id="ndvi-bar" style="width:${latest.value * 100}%;background:${PanelSlider.ndviCol(latest.value)}"></div>
        <div class="ndvi-label" id="ndvi-lbl">${latest.label} · NDVI ${latest.value.toFixed(2)}</div>
      </div>
      <div class="carbon-card">
        <div class="big-number">${Data.fmt(stock)}<span class="big-unit">t CO₂</span></div>
        <div class="big-label">Current carbon stock · ${biome.name} · ${Data.fmt(site.area)} ha</div>
      </div>
      <div class="climate-row">
        <div class="climate-mini">
          <div class="cm-label">Temperature</div>
          <div class="cm-value">${cLast.temp.toFixed(1)}°C</div>
          <div class="cm-delta warming">+${tD}°C since ${cFirst.year}</div>
        </div>
        <div class="climate-mini">
          <div class="cm-label">Precipitation</div>
          <div class="cm-value">${cLast.precip} mm</div>
          <div class="cm-delta drying">${pD}% since ${cFirst.year}</div>
        </div>
      </div>
      <div class="sandbox-section">
        <h3>🧪 Carbon Sandbox</h3>
        <p style="font-size:13px;color:var(--text3);margin-bottom:12px">Pick a restoration strategy and adjust the area.</p>
        <div class="sandbox-options">${site.sandbox.map((s, i) => `<button class="sandbox-btn" onclick="Panel.pickAction(${i})" id="sb-${i}"><span class="sb-icon">${s.icon}</span>${s.label}</button>`).join('')}</div>
        <div class="area-control">
          <label>Area to restore (hectares)</label>
          <input type="range" class="area-slider" min="10" max="${site.area}" value="100" oninput="PanelSlider.setArea(this.value)">
          <div class="area-value" id="area-val">100 hectares</div>
        </div>
        <div id="sandbox-result"></div>
      </div>
      <div class="elu-connection"><strong>ELU Connection:</strong> ${site.connection}</div>
      <div style="margin-top:24px;text-align:center">
        <button onclick="Panel.close()" style="padding:12px 32px;border:1px solid rgba(255,255,255,.12);border-radius:6px;background:rgba(255,255,255,.04);color:var(--text2);font-family:var(--body);font-size:13px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:8px">
          <span style="font-size:16px">✕</span> Close
        </button>
      </div>
    `;

    $('site-panel').classList.add('open');
    $('panel-backdrop').classList.add('show');
    $('globeViz').style.transform = 'translateX(-100vw)';
  },

  close() {
    $('site-panel').classList.remove('open');
    $('panel-backdrop').classList.remove('show');
    $('globeViz').style.transform = '';
    this.currentSite = null;
    GlobeModule.world.controls().autoRotate = true;
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
        <div class="big-number" style="color:${pos ? 'var(--leaf)' : 'var(--warn)'}">${pos ? '+' : ''}${Data.fmt(Math.abs(r.cumulative_co2))} t CO₂</div>
        <div class="big-label">${pos ? 'sequestered' : 'released'} over ${r.years} years · ${this.selectedArea} ha</div>
        <div class="context-line">${ctx.summary}</div>
        <div class="fraction-line">${(ctx.fraction * 100).toExponential(2)}% of global annual net emissions</div>
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
    provides: ['init', 'setTheme', 'initPledgeNodes', 'updateNodeVisuals', 'setLens', 'setHexMode', 'setCountryBordersVisible', 'applyCountryHexColors', 'applyCountryBorders', 'clearCountryBorders', 'clearCountrySelection', 'selectDefaultCountry', 'togglePledgeNodes', 'getCountryFeatures', 'setGlobeTexture', 'restoreDefaultTexture', 'setGlobeTextureFromCanvas', 'setOnGlobeClick', 'clearOnGlobeClick', 'clearNodeVisuals', 'restoreNodeVisuals', 'reset', 'destroy', 'getState'],
    requires: ['Data'],
    emits: ['globe:render-ready', 'globe:country-data-ready', 'globe:data-error', 'globe:country-selected', 'globe:country-closed'],
  });
}
