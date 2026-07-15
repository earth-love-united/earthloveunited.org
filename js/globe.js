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
  LEGACY: 'legacy-unverified',
};

const COUNTRY_STATUS_LABELS = {
  [COUNTRY_STATUS.MISSING]: 'Country data being re-sourced',
  [COUNTRY_STATUS.LEGACY]: 'Legacy evidence — not yet verified',
};

const COUNTRY_STATUS_BADGE_CLASSES = {
  [COUNTRY_STATUS.MISSING]: 'neutral',
  [COUNTRY_STATUS.LEGACY]: 'neutral',
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
  return COUNTRY_STATUS.LEGACY;
}

function _getCountryStatusText(d) {
  return COUNTRY_STATUS_LABELS[_getCountryStatusKey(d)];
}

function _getCountryStatusClass(d) {
  return COUNTRY_STATUS_BADGE_CLASSES[_getCountryStatusKey(d)];
}

function _getCountryStatusAttr(d) {
  return _getCountryStatusKey(d) === COUNTRY_STATUS.MISSING ? 'nodata' : 'legacy';
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
  return '<div class="elu-trajectory"><div class="elu-trajectory-head"><span class="elu-trajectory-title">Performance withheld</span><span class="elu-trajectory-note">Evidence review in progress</span></div><div class="elu-trajectory-empty">Target, ambition, and delivery claims are being rebuilt from reviewed sources.</div></div>';
}

function _getCountryGaiaComment(d, projectCount) {
  const statusKey = _getCountryStatusKey(d);
  if (statusKey === COUNTRY_STATUS.MISSING) return 'Country evidence is being re-sourced; the border remains navigable.';
  return 'Legacy evidence is visible only as provisional context while country facts are re-sourced.';
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
      .atmosphereColor(themeConfig.atmosphere)
      .atmosphereAltitude(themeConfig.atmosphereAltitude);
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
          window.dispatchEvent(new CustomEvent('pledgeHover', {
            detail: { node: p, tooltip: p.country + ' | Provisional fossil CO2 magnitude | Performance withheld' }
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

  pledgePointColor() {
    return '#6f91a8';
  },

  pledgePointAltitude(n) {
    const co2 = n.fossil_co2_mt || 0;
    return 0.01 + Math.min(co2 / 50000, 0.15);
  },

  pledgePointRadius(n) {
    const co2 = n.fossil_co2_mt || 0;
    return 0.3 + Math.min(co2 / 20000, 0.8);
  },

  // Provisional magnitude channel: neutral blue-grey only. Legacy emissions
  // affect prominence, never favorable/adverse performance semantics.
  _countryHexColorFn(feature) {
    const d = _getCountryDisplayData(feature);
    if (!d) return 'rgba(149,165,166,0.22)';

    const statusKey = _getCountryStatusKey(d);
    if (statusKey === COUNTRY_STATUS.MISSING) return 'rgba(149,165,166,0.28)';

    const te = Math.min(Math.log(Math.max(d.emissions || 0, 1)) / Math.log(12000), 1);
    const sat = 22 + te * 16;
    const lum = 52 - te * 15;
    const alpha = 0.35 + te * 0.40;

    return 'hsla(205,' + Math.round(sat) + '%,' + Math.round(lum) + '%,' + alpha.toFixed(2) + ')';
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

  // Navigation order keeps large provisional fossil values prominent without
  // presenting a numbered or performance-based ranking.
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
        };
      })
      .filter(entry => entry.feature && entry.data);
    const provisional = entries
      .filter(entry => entry.data.hasData)
      .sort((a, b) => (b.data.emissions || 0) - (a.data.emissions || 0));
    const missing = entries
      .filter(entry => !entry.data.hasData)
      .sort((a, b) => String(a.country).localeCompare(String(b.country)));
    this._countryDeck = provisional.concat(missing);
  },

  _renderRankRail() {
    const previous = $('elu-country-rank-rail');
    if (previous) previous.remove();
    this._rankRail = null;
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
    this._queueCountrySwipeCue(tt);
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
    const emissions = d.emissions
      ? 'Provisional fossil CO₂ magnitude: ' + d.emissions.toLocaleString() + ' MtCO₂/yr · legacy, unverified'
      : 'Country facts are being re-sourced';
    const comment = _getCountryGaiaComment(d);

    if (selected) this._ensureCountryCardWrap(tt);
    else this._unmountCountryCard();
    tt.classList.toggle('selected', !!selected);
    tt.dataset.status = statusAttr;
    tt.setAttribute('role', selected ? 'region' : 'tooltip');
    tt.setAttribute('aria-label', selected ? d.country + ' evidence review' : d.country + ' provisional evidence summary');
    if (!selected) tt.removeAttribute('tabindex');

    let html = '<div class="tt-topline">'
      + '<div class="tt-country">' + _escapeHtml(d.country) + '</div>'
      + '<div class="tt-pill tt-status-' + statusClass + '">' + _escapeHtml(statusText) + '</div>'
      + (selected ? '<button type="button" class="tt-close" data-country-close aria-label="Close">✕</button>' : '')
      + '</div>'
      + '<div class="tt-detail">' + _escapeHtml(emissions) + '</div>';

    if (!selected) {
      html += '<div class="tt-comment">' + _escapeHtml(comment) + '</div>';
    } else {
      // Pinned card: quarantine disclosure + provisional magnitude only.
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

  // Interim quarantine: legacy rows may support neutral, provisional fossil
  // prominence only. Performance, target, finance, CAT, and market claims are
  // withheld until reviewed evidence replaces this payload.
  _renderCountryMetrics(d) {
    const node = (hasModule('Data') && typeof Data.getPledgeNode === 'function') ? Data.getPledgeNode(d.iso) : null;
    const fmt = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—'
      : (hasModule('Data') ? Data.fmt(n) : String(n));

    if (!node) {
      return '<div class="tt-comment" style="margin-top:8px">Country facts are being re-sourced. Performance is withheld until reviewed evidence is available.</div>'
        + '<div class="tt-hint">esc or ✕ to close</div>';
    }

    return '<div class="tt-gap">'
      + '<div class="tt-gap-big">' + fmt(node.fossil_co2_mt) + ' <span>MtCO₂/yr fossil · provisional legacy value</span></div>'
      + '<div class="tt-gap-line">Unverified magnitude context only. Performance, targets, ratings, finance, and market inferences are withheld while sources are reviewed.</div>'
      + '</div>'
      + _renderCountryTrajectory()
      + '<div class="tt-hint">← → or swipe to browse countries · esc closes</div>';
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

    const d = _getCountryDisplayData(feature);
    const small = !!feature?.properties?.__smallNation;
    if (!d) return small ? 'rgba(200,230,235,0.7)' : 'rgba(180,215,218,0.34)';
    const statusKey = _getCountryStatusKey(d);
    if (statusKey === COUNTRY_STATUS.MISSING) {
      return small ? 'rgba(205,225,235,0.82)' : 'rgba(145,170,184,0.32)';
    }

    const emissions = d.emissions || 0;
    const magnitude = Math.min(Math.log(Math.max(emissions, 1)) / Math.log(12000), 1);
    const alpha = small ? 0.82 + magnitude * 0.12 : 0.30 + magnitude * 0.18;
    return small
      ? 'rgba(151,188,210,' + Math.min(alpha, 0.96).toFixed(2) + ')'
      : 'rgba(111,145,168,' + Math.min(alpha, 0.48).toFixed(2) + ')';
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
      if (statusKey === COUNTRY_STATUS.MISSING) {
        return 'rgba(150,182,196,' + Math.min(0.85 + boost, 0.98).toFixed(2) + ')';
      }
      const emissions = d?.emissions || 0;
      const magnitude = Math.min(Math.log(Math.max(emissions, 1)) / Math.log(12000), 1);
      const alpha = Math.min(0.84 + magnitude * 0.08 + boost, 0.98).toFixed(2);
      return 'rgba(111,145,168,' + alpha + ')';
    }

    if (!d) return 'rgba(120,150,165,' + (0.14 + hoverBoost).toFixed(2) + ')';
    const statusKey = _getCountryStatusKey(d);
    if (statusKey === COUNTRY_STATUS.MISSING) return 'rgba(120,150,165,' + (0.14 + hoverBoost).toFixed(2) + ')';

    const emissions = d.emissions || 0;
    const te = Math.min(Math.log(Math.max(emissions, 1)) / Math.log(12000), 1);
    const alpha = Math.min(0.28, 0.16 + te * 0.12) + hoverBoost;
    const cappedAlpha = Math.min(alpha, 0.42).toFixed(2);

    // Legacy evidence always uses one neutral hue; magnitude affects opacity.
    return 'rgba(111,145,168,' + cappedAlpha + ')';
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
    // Every former lens is temporarily the same neutral provisional magnitude
    // view. No legacy field can switch the globe into a performance judgment.
    this.world.pointColor(() => '#6f91a8');
    this.world.pointAltitude(n => 0.01 + Math.min((n.fossil_co2_mt || 0) / 50000, 0.15));
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
      if (p._type === 'pledge') {
        return '#6f91a8';
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
      const magnitude = n.fossil_co2_mt ? n.fossil_co2_mt.toFixed(1) + ' MtCO₂/yr' : 'Magnitude unavailable';
      tooltip.innerHTML = '<div class="tt-country">' + _escapeHtml(n.country) + '</div>'
        + '<div class="tt-detail">Provisional fossil CO₂ magnitude: ' + magnitude + ' · legacy, unverified</div>'
        + '<div>Performance withheld</div>';
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
