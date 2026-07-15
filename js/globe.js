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
  FACTUAL: 'factual',
  MISSING: 'missing',
};

const COUNTRY_STATUS_LABELS = {
  [COUNTRY_STATUS.FACTUAL]: 'Reviewed facts · candidate preview',
  [COUNTRY_STATUS.MISSING]: 'Emissions source gap',
};

const COUNTRY_STATUS_BADGE_CLASSES = {
  [COUNTRY_STATUS.FACTUAL]: 'magnitude',
  [COUNTRY_STATUS.MISSING]: 'neutral',
};

const GLOBE_FALLBACK_REASONS = Object.freeze({
  library_load_failed: 'The 3D globe library could not be loaded. The country evidence remains available below.',
  library_unavailable: 'The 3D globe library is unavailable. The country evidence remains available below.',
  webgl_unavailable: 'This browser or device could not start WebGL. The country evidence remains available below.',
  globe_construction_failed: 'The 3D globe could not start safely. The country evidence remains available below.',
  globe_container_missing: 'The 3D globe container is unavailable. The country evidence remains available below.',
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

function _getCountryDisplayData(feature) {
  if (!feature) return null;
  const props = feature.properties || {};
  const iso = _resolveCountryIso(feature);
  const country = props.ADMIN || props.NAME || props.name || iso;

  const climate = Data.getClimateCountry ? Data.getClimateCountry(iso) : null;
  return {
    iso,
    country,
    emissions: climate?.emissions || null,
    lat: _isFiniteNumber(Number(props.__lat)) ? Number(props.__lat) : null,
    lng: _isFiniteNumber(Number(props.__lng)) ? Number(props.__lng) : null,
    hasData: climate?.emissions?.status === 'reviewed_factual',
    climate,
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
    surface: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg',
    backgroundImage: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png',
    backgroundColor: '#050509',
    atmosphere: '#4ecdc4',
    atmosphereAltitude: 0.25,
  }),
  light: Object.freeze({
    surface: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
    backgroundImage: '/assets/globe/light-atmosphere.png?v=v2',
    backgroundColor: '#dfe9e3',
    atmosphere: '#2fa77f',
    atmosphereAltitude: 0.33,
  }),
});

function _getGlobeThemeConfig(theme) {
  return theme === 'light' ? GLOBE_THEME_CONFIG.light : GLOBE_THEME_CONFIG.dark;
}

function _renderCountryTrajectory() {
  return '<div class="elu-trajectory"><div class="elu-trajectory-head"><span class="elu-trajectory-title">Assessment boundary</span><span class="elu-trajectory-note">Not reviewed</span></div><div class="elu-trajectory-empty">Commitment and target: not reviewed. Delivery, performance, impact band, and climate score: not assessed.</div></div>';
}

function _getCountryGaiaComment(d, projectCount) {
  return d?.hasData
    ? 'Reviewed harmonized emissions facts are available; no performance judgment is made.'
    : 'This country remains equally navigable while its emissions source gap is resolved.';
}

function _magnitudePosition(value) {
  if (!_isFiniteNumber(value) || value < 0) return null;
  const domain = Data.getClimateMagnitudeDomain ? Data.getClimateMagnitudeDomain() : null;
  if (!domain || !_isFiniteNumber(domain.min_mtco2e_per_year) || !_isFiniteNumber(domain.max_mtco2e_per_year) || !_isFiniteNumber(domain.offset_mtco2e_per_year)) return null;
  const min = Math.log10(domain.min_mtco2e_per_year + domain.offset_mtco2e_per_year);
  const max = Math.log10(domain.max_mtco2e_per_year + domain.offset_mtco2e_per_year);
  return Math.max(0, Math.min(1, (Math.log10(value + domain.offset_mtco2e_per_year) - min) / (max - min)));
}

function _magnitudeColor(value, alpha) {
  const t = _magnitudePosition(value);
  if (t === null) return 'rgba(145,160,172,' + alpha + ')';
  const start = [91, 74, 151];
  const end = [246, 145, 58];
  const rgb = start.map((channel, index) => Math.round(channel + (end[index] - channel) * t));
  return 'rgba(' + rgb.join(',') + ',' + alpha + ')';
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
  _countrySwipeCueShown: false,
  _fallbackReasonCode: null,
  _fallbackOpener: null,
  _fallbackEntries: [],
  _fallbackBound: false,
  _fallbackSelectedIso: null,

  init() {
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
      renderer = new window.Globe(el, { animateIn: true, waitForGlobeReady: true });
    } catch (error) {
      reportError('GlobeModule.init()', error);
      this._teardownFailedRenderer();
      this.showFallback('globe_construction_failed');
      return false;
    }
    this.world = safeChain(renderer, 'Globe')
      .globeImageUrl(themeConfig.surface)
      .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
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

    // Country climate point layers remain disabled until reviewed evidence is
    // explicitly released. Country polygons stay navigable without values.

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
        if (this._canvasEl) {
          this._bindCanvasDragGuard();
          this._canvasEl.addEventListener('pointermove', this._onCanvasPointerMove);
          this._canvasEl.addEventListener('click', this._onCanvasClick);
        }

        // Do not auto-open a modal card. A country card is a user-triggered
        // dialog so it always has a real opener for focus restoration.

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

  _teardownFailedRenderer() {
    if (this.world && typeof this.world.destroy === 'function') {
      try { this.world.destroy(); } catch (error) {
        reportWarn('GlobeModule', 'Failed renderer cleanup was incomplete.');
      }
    }
    this.world = null;
    this._initialized = false;
    const el = $('globeViz');
    if (el) el.replaceChildren();
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
    $text('globe-fallback-reason', GLOBE_FALLBACK_REASONS[stableReason]);
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

    panel.addEventListener('click', event => {
      const action = event.target.closest('[data-globe-fallback-action]');
      if (action) {
        const name = action.getAttribute('data-globe-fallback-action');
        if (name === 'retry') safeCall('App', 'retryGlobe');
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
    });

    search.addEventListener('input', () => this._filterFallbackEntries(search.value));
  },

  _renderFallbackEvidence() {
    const list = $('globe-fallback-country-list');
    const summary = $('globe-fallback-summary');
    const detail = $('globe-fallback-country-detail');
    const candidate = Data.climateCandidate;
    const ranking = Data.getClimateRanking ? Data.getClimateRanking() : null;
    if (!list || !summary || !detail) return false;

    const candidateReady = candidate && candidate.review_status === 'not_reviewed' &&
      candidate.production_runtime_release === false && Array.isArray(candidate.countries) && ranking;
    if (!candidateReady) {
      this._fallbackEntries = [];
      list.replaceChildren();
      summary.textContent = 'Country evidence is unavailable. No climate values or assessments are being inferred.';
      $text('globe-fallback-results', '0 entities available');
      detail.innerHTML = '<h3>Evidence unavailable</h3><p>The country evidence candidate did not pass its runtime boundary checks. Return to the Foundation and try again later.</p>';
      return false;
    }

    const rankById = new Map((ranking.ranked || []).map(entry => [entry.country_id, entry]));
    this._fallbackEntries = candidate.countries.map(country => ({
      country,
      rank: rankById.get(country.country_id) || null,
      factual: country.emissions?.status === 'reviewed_factual',
    })).sort((a, b) => {
      if (a.rank && b.rank) return a.rank.ordinal - b.rank.ordinal || a.country.iso_alpha3.localeCompare(b.country.iso_alpha3);
      if (a.rank) return -1;
      if (b.rank) return 1;
      return String(a.country.name).localeCompare(String(b.country.name));
    });

    const factualCount = this._fallbackEntries.filter(entry => entry.factual).length;
    const gapCount = this._fallbackEntries.length - factualCount;
    summary.textContent = this._fallbackEntries.length + ' registry entities · ' + factualCount +
      ' factual series in this candidate dataset · ' + gapCount +
      ' explicit source gaps. The 2023 order uses one harmonized magnitude metric and is not a performance score.';

    list.innerHTML = this._fallbackEntries.map(entry => {
      const country = entry.country;
      const iso = _escapeHtml(country.iso_alpha3);
      const name = _escapeHtml(country.name);
      const flag = _escapeHtml(country.flag_emoji || '');
      if (entry.factual) {
        const latest = country.emissions.latest;
        const value = Number(latest.value).toLocaleString('en-US', { maximumFractionDigits: 4 });
        const rank = entry.rank ? entry.rank.ordinal : '—';
        return '<li data-fallback-search="' + _escapeHtml((country.name + ' ' + country.iso_alpha3).toLowerCase()) + '"><button type="button" class="elu-fallback-country-row" data-fallback-country-iso="' + iso + '" data-fallback-evidence-state="factual" aria-label="' + name + ', factual series in the candidate dataset, 2023 ' + value + ' ' + _escapeHtml(country.emissions.unit) + ', magnitude rank ' + rank + ', not a performance score"><span class="elu-fallback-country-name">' + flag + ' ' + name + '<small>' + iso + ' · magnitude rank ' + rank + '</small></span><span class="elu-fallback-country-state">' + value + '<small>' + _escapeHtml(country.emissions.unit) + '</small></span></button></li>';
      }
      return '<li data-fallback-search="' + _escapeHtml((country.name + ' ' + country.iso_alpha3).toLowerCase()) + '"><button type="button" class="elu-fallback-country-row" data-fallback-country-iso="' + iso + '" data-fallback-evidence-state="gap" aria-label="' + name + ', explicit source gap, unranked"><span class="elu-fallback-country-name">' + flag + ' ' + name + '<small>' + iso + ' · unranked</small></span><span class="elu-fallback-country-state is-gap">Source gap</span></button></li>';
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

    const country = entry.country;
    const name = _escapeHtml(country.name);
    const code = _escapeHtml(country.iso_alpha3);
    const flag = _escapeHtml(country.flag_emoji || '');
    const boundary = '<h4>Assessment boundary</h4><p>Commitments, targets, delivery, performance, impact bands, and climate scores are not assessed in this view.</p>';
    if (!entry.factual) {
      detail.innerHTML = '<h3 id="globe-fallback-detail-title">' + flag + ' ' + name + '</h3><span class="elu-fallback-detail-badge">' + code + ' · explicit source gap</span><p class="elu-fallback-detail-value"><strong>No emissions value shown</strong></p><p>This registry entity is unranked because the candidate dataset has no factual series for it. Missing data does not indicate better or worse climate performance.</p>' + boundary + '<button type="button" class="elu-fallback-back-to-list" data-globe-fallback-action="list">Back to ' + name + ' in the list</button>';
    } else {
      const emissions = country.emissions;
      const latestValue = Number(emissions.latest.value).toLocaleString('en-US', { maximumFractionDigits: 4 });
      const rankText = entry.rank ? 'Magnitude rank ' + entry.rank.ordinal + ' of 206 for the same 2023 metric; not a performance score.' : 'Not present in the candidate magnitude order.';
      const rows = emissions.series.map(point => '<tr><th scope="row">' + point.year + '</th><td>' + Number(point.value).toLocaleString('en-US', { maximumFractionDigits: 4 }) + '</td><td>' + _escapeHtml(emissions.unit) + '</td></tr>').join('');
      const limitations = (emissions.limitations || []).map(item => '<li>' + _escapeHtml(item) + '</li>').join('');
      const safeSource = /^https:\/\//.test(emissions.source_url || '') ? emissions.source_url : '';
      const source = safeSource
        ? '<a href="' + _escapeHtml(safeSource) + '" target="_blank" rel="noopener">' + _escapeHtml(emissions.source_id) + '</a>'
        : _escapeHtml(emissions.source_id || 'Source unavailable');
      detail.innerHTML = '<h3 id="globe-fallback-detail-title">' + flag + ' ' + name + '</h3><span class="elu-fallback-detail-badge">' + code + ' · factual candidate series</span><p class="elu-fallback-detail-value"><strong>' + latestValue + '</strong> ' + _escapeHtml(emissions.unit) + ' · ' + emissions.latest.year + '</p><p>' + _escapeHtml(emissions.label) + '. ' + _escapeHtml(rankText) + '</p><div class="elu-fallback-table-wrap"><table><caption>' + name + ' annual factual series in the candidate dataset</caption><thead><tr><th scope="col">Year</th><th scope="col">Value</th><th scope="col">Unit</th></tr></thead><tbody>' + rows + '</tbody></table></div><h4>Source and limits</h4><p class="elu-fallback-source">Source: ' + source + '</p><ul>' + limitations + '</ul>' + boundary + '<button type="button" class="elu-fallback-back-to-list" data-globe-fallback-action="list">Back to ' + name + ' in the list</button>';
    }
    if (focusDetail) detail.focus({ preventScroll: true });
    return true;
  },

  hideFallback(options = {}) {
    const panel = $('globe-fallback');
    const opener = this._fallbackOpener;
    document.body?.classList.remove('globe-fallback-active');
    if (panel) {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.removeAttribute('data-reason');
    }
    this._fallbackReasonCode = null;
    if (!options.preserveOpener) this._fallbackOpener = null;
    if (options.restoreFocus && opener && document.contains(opener) && typeof opener.focus === 'function') {
      requestAnimationFrame(() => opener.focus({ preventScroll: true }));
    }
    return true;
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

  // CT-42 candidate: factual magnitude only. This is deliberately not a
  // performance, target, delivery, impact-band, or score color channel.
  _countryHexColorFn(feature) {
    const d = _getCountryDisplayData(feature);
    return d?.hasData ? _magnitudeColor(d.emissions.latest.value, 0.72) : 'rgba(145,160,172,0.34)';
  },

  _countryHexAltitudeFn(feature) {
    const d = _getCountryDisplayData(feature);
    const position = d?.hasData ? _magnitudePosition(d.emissions.latest.value) : null;
    return position === null ? 0.004 : 0.004 + position * 0.022;
  },

  // Same-metric 2023 magnitude order from CT-31; gaps follow alphabetically.
  _buildCountryDeck() {
    const featureByIso = this._featureByIso || {};
    const ranking = Data.getClimateRanking ? Data.getClimateRanking() : null;
    const ranks = new Map((ranking?.ranked || []).map(entry => [entry.country_id.split(':')[1], entry]));
    const entries = Object.keys(featureByIso)
      .filter(iso => iso && iso !== 'UNK' && iso !== '-99' && iso !== 'ATA')
      .map(iso => {
        const feature = featureByIso[iso];
        const data = _getCountryDisplayData(feature);
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
    this._countryDeck = entries.sort((a, b) => {
      if (a.rank && b.rank) return a.rank.ordinal - b.rank.ordinal || a.iso.localeCompare(b.iso);
      if (a.rank) return -1;
      if (b.rank) return 1;
      return String(a.country).localeCompare(String(b.country));
    });
  },

  _renderRankRail() {
    const previous = $('elu-country-rank-rail');
    if (previous) previous.remove();
    const ranking = Data.getClimateRanking ? Data.getClimateRanking() : null;
    if (!ranking || !document.body) { this._rankRail = null; return; }
    const rail = document.createElement('aside');
    rail.id = 'elu-country-rank-rail';
    rail.setAttribute('aria-label', 'Candidate preview: 2023 harmonized emissions magnitude ranking and data gaps');
    const mappedRanked = ranking.ranked.filter(entry => this._featureByIso?.[entry.country_id.split(':')[1]]);
    const unmappedRanked = ranking.ranked.filter(entry => !this._featureByIso?.[entry.country_id.split(':')[1]]);
    const mappedGaps = ranking.unranked.entries.filter(entry => this._featureByIso?.[entry.country_id.split(':')[1]]);
    const unmappedGaps = ranking.unranked.entries.filter(entry => !this._featureByIso?.[entry.country_id.split(':')[1]]);
    const ranked = mappedRanked.map(entry => {
      const iso = entry.country_id.split(':')[1];
      return '<button type="button" class="elu-rank-row" data-country-rail-iso="' + _escapeHtml(iso) + '" aria-label="Rank ' + entry.ordinal + ', ' + _escapeHtml(entry.label) + ', ' + entry.value.toLocaleString() + ' ' + _escapeHtml(entry.unit) + '">'
        + '<span class="elu-rank-number">' + entry.ordinal + '</span><span class="elu-rank-dot is-magnitude" aria-hidden="true"></span>'
        + '<span class="elu-rank-name">' + _escapeHtml(entry.label) + '</span><span class="elu-rank-code">' + _escapeHtml(iso) + '</span>'
        + '<span class="elu-rank-gap">' + entry.value.toLocaleString() + '</span></button>';
    }).join('');
    const gaps = mappedGaps.map(entry => {
      const iso = entry.country_id.split(':')[1];
      return '<button type="button" class="elu-rank-row is-gap" data-country-rail-iso="' + _escapeHtml(iso) + '" aria-label="Data gap, ' + _escapeHtml(entry.label) + ', not ranked">'
        + '<span class="elu-rank-number" aria-hidden="true">—</span><span class="elu-rank-dot is-gap" aria-hidden="true"></span>'
        + '<span class="elu-rank-name">' + _escapeHtml(entry.label) + '</span><span class="elu-rank-code">' + _escapeHtml(iso) + '</span><span class="elu-rank-gap">Data gap</span></button>';
    }).join('');
    const unmapped = unmappedRanked.concat(unmappedGaps).map(entry => '<div class="elu-rank-unmapped"><span aria-hidden="true">◇</span> ' + _escapeHtml(entry.label) + ' (' + _escapeHtml(entry.country_id.split(':')[1]) + ') · not mapped on this globe</div>').join('');
    rail.innerHTML = '<div class="elu-rank-head"><div><div class="elu-rank-title">Candidate preview · 2023 magnitude</div><div class="elu-rank-subtitle">Same metric · MtCO₂e/yr · harmonized · not a performance score</div></div><button type="button" class="elu-rank-toggle" aria-label="Collapse candidate ranking" aria-expanded="true">−</button></div>'
      + '<div class="elu-rank-list"><div class="elu-rank-disclosure">' + mappedRanked.length + ' of 206 reviewed registry entities mapped · competition ties preserved</div>'
      + '<div role="list" aria-label="Mapped registry entities ranked by the same 2023 metric">' + ranked + '</div>'
      + '<h2 class="elu-rank-gap-heading">Source gaps · unnumbered</h2><div role="list" aria-label="Mapped registry entities not ranked because source data are unavailable">' + gaps + '</div>'
      + (unmapped ? '<h2 class="elu-rank-gap-heading">Not mapped · noninteractive</h2><div aria-label="Registry entities without interactive globe geometry">' + unmapped + '</div>' : '') + '</div>';
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
      const feature = this._featureByIso?.[row.getAttribute('data-country-rail-iso')];
      if (feature) this._selectCountryFeature(feature, { focus: true });
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
        this.navigateCountry(parseInt(nav.getAttribute('data-country-nav'), 10) || 1);
      });
      wrap.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const heading = wrap.querySelector('#country-card-heading');
        const tabbable = Array.from(wrap.querySelectorAll('button,a[href],summary,[tabindex="0"]')).filter(node => {
          if (node.disabled || node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
          const style = window.getComputedStyle(node);
          return node.getClientRects().length > 0 && style.visibility !== 'hidden';
        });
        if (!heading || !tabbable.length) return;
        const last = tabbable[tabbable.length - 1];
        if (event.shiftKey && document.activeElement === heading) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); heading.focus(); }
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
    if (opts.focus && document.activeElement && !document.activeElement.closest('#hex-country-tooltip')) {
      this._countryOpener = document.activeElement;
    }
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

  _queueCountrySwipeCue(tt) {
    if (this._countrySwipeCueShown || !tt || window.innerWidth > 720) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this._countrySwipeCueShown = true;

    // Wait until the selected card has been mounted and docked before showing
    // the one-time horizontal affordance. Two frames keep the cue separate
    // from the card's initial paint, so the movement reads as intentional.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!tt.classList.contains('selected') || !tt.classList.contains('visible')) return;
      tt.classList.add('tt-swipe-cue');
      const finishCue = event => {
        if (event.animationName !== 'elu-country-card-swipe-cue') return;
        tt.removeEventListener('animationend', finishCue);
        tt.removeEventListener('animationcancel', finishCue);
        tt.classList.add('tt-motion-ready');
        tt.classList.remove('tt-swipe-cue');
      };
      tt.addEventListener('animationend', finishCue);
      tt.addEventListener('animationcancel', finishCue);
    }));
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
          tt.classList.add('tt-motion-ready');
          tt.classList.remove('tt-swipe-cue');
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

    const statusText = _getCountryStatusText(d);
    const statusClass = _getCountryStatusClass(d);
    const statusAttr = _getCountryStatusAttr(d);
    const evidenceSummary = d.hasData
      ? d.emissions.label + ' · 2014–2023 · ' + d.emissions.unit
      : 'No reviewed factual emissions series in this candidate';
    const comment = _getCountryGaiaComment(d);

    if (selected) {
      const wrap = this._ensureCountryCardWrap(tt);
      if (wrap) {
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
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
    else tt.setAttribute('aria-label', d.country + (d.hasData ? ' emissions facts' : ' emissions data gap'));
    if (!selected) tt.removeAttribute('tabindex');

    let html = '<div class="tt-topline">'
      + (selected ? '<h2 class="tt-country" id="country-card-heading" tabindex="-1">' + _escapeHtml(d.country) + '</h2>' : '<div class="tt-country">' + _escapeHtml(d.country) + '</div>')
      + '<div class="tt-pill tt-status-' + statusClass + '">' + _escapeHtml(statusText) + '</div>'
      + (selected ? '<button type="button" class="tt-close" data-country-close aria-label="Close">✕</button>' : '')
      + '</div>'
      + '<div class="tt-detail">' + _escapeHtml(evidenceSummary) + '</div>'
      + (selected ? '<div class="tt-candidate"><span aria-hidden="true">◇</span> CT-42 candidate preview · runtime and release not reviewed</div>' : '');

    if (!selected) {
      html += '<div class="tt-comment">' + _escapeHtml(comment) + '</div>';
    } else {
      // Pinned card: explicit fail-closed disclosure only.
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
      // screen-reader users inside the modal by focusing the new heading when
      // their prior focus was in the replaced content. The persistent outer
      // previous/next buttons retain focus naturally.
      if (restoreHeadingFocus && tt) {
        const heading = tt.querySelector('#country-card-heading');
        if (heading) heading.focus({ preventScroll: true });
      }
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
        setTimeout(() => { tt.classList.remove('tt-snap'); this._navBusy = false; }, enterDuration);
      } else {
        this._navBusy = false;
      }
    };

    if (tt) {
      tt.classList.add('tt-motion-ready');
      tt.classList.remove('tt-snap', 'tt-dragging', 'tt-swipe-cue');
      tt.classList.add(outClass);
      setTimeout(swap, exitDuration);
    } else {
      swap();
    }
  },

  _renderCountryMetrics(d) {
    if (!d.hasData) {
      return '<div class="tt-comment" style="margin-top:8px"><strong>Data gap.</strong> No reviewed PRIMAP series is available for this registry entity. It is visible but excluded from ranking.</div>'
        + _renderCountryTrajectory()
        + '<div class="tt-hint">Unnumbered data gap · ← → or swipe · esc closes</div>';
    }
    const points = d.emissions.series;
    const values = points.map(point => point.value);
    const min = Math.min(...values), max = Math.max(...values);
    const span = Math.max(max - min, Math.abs(max) * 0.02, 0.001);
    const coordPoints = points.map((point, index) => {
      const x = 8 + index * (304 / Math.max(points.length - 1, 1));
      const y = 51 - ((point.value - min) / span) * 39;
      return { x: x.toFixed(1), y: y.toFixed(1), point };
    });
    const coords = coordPoints.map(item => item.x + ',' + item.y).join(' ');
    const markers = coordPoints.map(item => '<circle class="elu-trajectory-point" cx="' + item.x + '" cy="' + item.y + '" r="2.5"><title>' + item.point.year + ': ' + item.point.value.toLocaleString() + ' ' + _escapeHtml(d.emissions.unit) + '</title></circle>').join('');
    const rows = points.map(point => '<tr><th scope="row">' + point.year + '</th><td>' + point.value.toLocaleString() + '</td><td>' + _escapeHtml(d.emissions.unit) + '</td></tr>').join('');
    const latest = d.emissions.latest;
    const sourceLabel = 'PRIMAP-hist v2.6.1 final';
    return '<section class="tt-factual" aria-labelledby="country-emissions-heading"><h3 id="country-emissions-heading">Annual harmonized emissions estimates</h3>'
      + '<div class="tt-factual-value"><strong>' + latest.value.toLocaleString() + '</strong> ' + _escapeHtml(d.emissions.unit) + ' <span>in ' + latest.year + '</span></div>'
      + '<div class="elu-trajectory"><div class="elu-trajectory-head"><span class="elu-trajectory-title">2014–2023 series</span><span class="elu-trajectory-note">Harmonized estimate</span></div>'
      + '<svg viewBox="0 0 320 72" role="img" aria-labelledby="emissions-chart-title emissions-chart-desc"><title id="emissions-chart-title">' + _escapeHtml(d.country) + ' annual harmonized emissions estimates, 2014 to 2023</title><desc id="emissions-chart-desc">Ten annual harmonized estimates in ' + _escapeHtml(d.emissions.unit) + '. Points and line show emissions magnitude, not a performance pathway.</desc>'
      + '<line class="elu-trajectory-grid" x1="8" y1="51" x2="312" y2="51"></line><text class="elu-chart-axis" x="8" y="9">' + max.toLocaleString() + ' ' + _escapeHtml(d.emissions.unit) + '</text><text class="elu-chart-axis" x="8" y="66">' + min.toLocaleString() + ' ' + _escapeHtml(d.emissions.unit) + '</text><polyline class="elu-trajectory-current is-magnitude" points="' + coords + '"></polyline>' + markers + '</svg>'
      + '<div class="elu-trajectory-years"><span>2014</span><span>2023</span></div></div>'
      + '<details class="tt-chart-data"><summary>Show chart data</summary><table><caption>' + _escapeHtml(d.country) + ' annual harmonized emissions</caption><thead><tr><th>Year</th><th>Value</th><th>Unit</th></tr></thead><tbody>' + rows + '</tbody></table></details>'
      + '<p class="tt-source"><strong>Source:</strong> <a href="' + _escapeHtml(d.emissions.source_url) + '" target="_blank" rel="noopener">' + sourceLabel + '</a> · facts reviewed through CT-10C / CT-10C-R; this CT-42 runtime candidate is not reviewed.</p>'
      + '<p class="tt-limit"><strong>Limits:</strong> ' + _escapeHtml(d.emissions.limitations.join(' ')) + '</p></section>'
      + _renderCountryTrajectory()
      + '<div class="tt-hint">2023 magnitude rank only · ← → or swipe · esc closes</div>';
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
    if (feature === this._countryHoverFeature) return 'rgba(221,238,247,0.96)';
    if (feature === this._selectedCountryFeature) return 'rgba(141,184,208,0.90)';

    const small = !!feature?.properties?.__smallNation;
    return small ? 'rgba(205,225,235,0.82)' : 'rgba(145,170,184,0.32)';
  },

  _countryPolygonPaintColorFn(feature) {
    const hovered = feature === this._countryHoverFeature;
    const selected = feature === this._selectedCountryFeature;
    const hoverBoost = hovered ? 0.12 : (selected ? 0.08 : 0);
    const d = _getCountryDisplayData(feature);

    // Small-nation dot markers: a few pixels wide, so the usual low-alpha
    // country wash would vanish. Paint them near-solid for contrast.
    if (feature?.properties?.__smallNation) {
      return d?.hasData
        ? _magnitudeColor(d.emissions.latest.value, Math.min(0.84 + hoverBoost, 0.98).toFixed(2))
        : 'rgba(165,178,188,' + Math.min(0.82 + hoverBoost, 0.96).toFixed(2) + ')';
    }

    return d?.hasData
      ? _magnitudeColor(d.emissions.latest.value, (0.54 + hoverBoost).toFixed(2))
      : 'rgba(145,160,172,' + (0.32 + hoverBoost).toFixed(2) + ')';
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
  setLens(lens) {
    this.currentLens = lens;
    this.updateNodeVisuals();
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
    this.hideFallback({ restoreFocus: false, preserveOpener: false });
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
      selectedCountryIso: this._selectedCountryFeature ? _resolveCountryIso(this._selectedCountryFeature) : null,
      fallbackActive: document.body?.classList.contains('globe-fallback-active') || false,
      fallbackReasonCode: this._fallbackReasonCode,
      fallbackEntityCount: this._fallbackEntries.length,
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
    provides: ['init', 'hasWebGLSupport', 'rememberFallbackOpener', 'showFallback', 'hideFallback', 'setTheme', 'initSitePoints', 'updateNodeVisuals', 'setLens', 'setHexMode', 'setCountryBordersVisible', 'applyCountrySurface', 'applyCountryBorders', 'clearCountryBorders', 'clearCountrySelection', 'selectDefaultCountry', 'toggleSitePoints', 'getCountryFeatures', 'setGlobeTexture', 'restoreDefaultTexture', 'setGlobeTextureFromCanvas', 'setOnGlobeClick', 'clearOnGlobeClick', 'clearNodeVisuals', 'restoreNodeVisuals', 'reset', 'destroy', 'getState'],
    requires: ['Data'],
    emits: ['globe:render-ready', 'globe:country-data-ready', 'globe:data-error', 'globe:country-selected', 'globe:country-closed', 'globe:fallback-shown'],
  });
}
