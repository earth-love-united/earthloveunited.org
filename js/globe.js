// ═══════════════════════════════════════════════
// GLOBE — Globe.gl init, panel open/close
// ═══════════════════════════════════════════════

// Module-level closure: mode click handler lives OUTSIDE GlobeModule
// because safeChain wraps `this` in a Proxy — `this._handler` won't work
// inside chained arrow functions. This variable is shared between
// the onPointClick/onLabelClick/onGlobeClick callbacks and setOnGlobeClick.
let _globeClickHandler = null;

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
    if (_pointInFeature(lng, lat, features[i])) return features[i];
  }
  return null;
}

const GlobeModule = {
  world: null,
  userTotal: 0,
  currentLens: 'gap', // 'gap' | 'forest' | 'cat'
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || (window.innerWidth < 768),
  _globeLoadRetries: 0,

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

    // safeChain: if any method doesn't exist (e.g. specularImageUrl), it's
    // skipped with a dev warning instead of crashing the entire init.
    this.world = safeChain(new Globe(el, { animateIn: true, waitForGlobeReady: true }), 'Globe')
      .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
      .specularImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png')
      .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png')
      .showAtmosphere(!this.isMobile).atmosphereColor('#4ecdc4').atmosphereAltitude(0.25)
      .pointsData(Data.sites)
      .pointLat('lat').pointLng('lng').pointAltitude(0.01).pointRadius(0.6)
      .pointColor(() => '#4ecdc4').pointResolution(this.isMobile ? 8 : 16)
      .labelsData(Data.sites)
      .labelLat('lat').labelLng('lng').labelText('name').labelSize(1.4)
      .labelDotRadius(0.4).labelDotOrientation(() => 'bottom')
      .labelColor(() => 'rgba(123,232,208,0.9)').labelResolution(3).labelAltitude(0.02)
      .ringsData(Data.sites)
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
        if (_globeClickHandler) {
          _globeClickHandler(lat, lng);
        }
      });
    }

    // safeChain returns a Proxy — unwrap to get the real Globe instance
    // (the Proxy target IS the Globe, so direct property access still works)
    console.log('[Globe] init — ' + (this.world.pointsData()?.length || 0) + ' points loaded');

    // ── Pledge vs Reality country nodes ──
    this.initPledgeNodes();

    // ── Country hex polygons — shared between modes ──
    // Default: empty wireframe grid (visible edges, transparent fill)
    this._countryFeatures = null;
    fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(r => r.json())
      .then(countries => {
        this._countryFeatures = countries.features.filter(d => d.properties.ISO_A2 !== 'AQ');
        const hexRes = this.isMobile ? 2 : 3;
        const hexMargin = this.isMobile ? 0.7 : 0.62;
        this.world
          .hexPolygonsData(this._countryFeatures)
          .hexPolygonResolution(hexRes).hexPolygonMargin(hexMargin)
          .hexPolygonUseDots(false)
          .hexPolygonColor(() => 'rgba(78,205,196,0.08)')
          .hexPolygonAltitude(() => 0.003)
          .hexPolygonCurvatureResolution(0);

        // Apply country colors immediately after polygon creation so they
        // aren't overwritten by the default wireframe above
        this.applyCountryHexColors();

        // ── Country hover/click via globe surface raycasting ──
        // Instead of per-hex hit testing (which misses gaps between hexes),
        // we raycast against the globe sphere and do point-in-polygon against
        // the GeoJSON country features. This means ANY point over a country
        // triggers hover/click, regardless of hex tile boundaries.
        this._countryHoverFeature = null;
        this._countryHoverThrottle = 0;

        // Globe surface raycasting for country detection
        this._globeRadius = this.world.getGlobeRadius();

        this._onCanvasPointerMove = (e) => {
          if (!this._countryFeatures || !this._countryFeatures.length) return;
          const now = Date.now();
          if (now - this._countryHoverThrottle < 30) return;
          this._countryHoverThrottle = now;

          const canvas = this._canvasEl;
          if (!canvas) return;
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
          if (disc < 0) { this._clearCountryHover(); return; }
          const t = (-b - Math.sqrt(disc)) / (2*a);
          if (t < 0) { this._clearCountryHover(); return; }
          const hitX = ox + t*wx, hitY = oy + t*wy, hitZ = oz + t*wz;
          // Convert 3D hit point to lat/lng using globe.gl's own method
          const geo = this.world.toGeoCoords({x: hitX, y: hitY, z: hitZ});
          if (!geo || isNaN(geo.lat) || isNaN(geo.lng)) { this._clearCountryHover(); return; }
          const lat = geo.lat;
          const lng = geo.lng;

          // Find country at this lat/lng
          const feature = _findCountryAtPoint(lng, lat, this._countryFeatures);
          if (!feature) { this._clearCountryHover(); return; }

          const iso = feature.properties?.ISO_A3;
          const d = iso ? Data.countryHexColors?.[iso] : null;
          if (!d) { this._clearCountryHover(); return; }

          // Only update DOM if country changed
          if (this._countryHoverFeature !== feature) {
            this._countryHoverFeature = feature;
            let tt = $('hex-country-tooltip');
            if (!tt) {
              tt = document.createElement('div');
              tt.id = 'hex-country-tooltip';
              document.body.appendChild(tt);
            }
            const gap = d.gap;
            const status = gap === null ? 'No target' : (gap > 0 ? 'OVERSHOOTING' : 'ON TRACK');
            const emissions = d.emissions ? d.emissions.toLocaleString() + ' MtCO₂' : 'No data';
            tt.innerHTML = '<div class="tt-country">' + d.country + '</div>'
              + '<div class="tt-detail">' + emissions + (d.perCapita ? ' · ' + d.perCapita + ' t/person' : '') + '</div>'
              + '<div class="' + (gap === null ? '' : (gap > 0 ? 'tt-status-red' : 'tt-status-green')) + '">' + status + '</div>';
            tt.classList.add('visible');
          }

          // Position tooltip
          const tt2 = $('hex-country-tooltip');
          if (tt2) {
            const tx = Math.min(e.clientX + 16, window.innerWidth - 260);
            const ty = Math.min(e.clientY - 12, window.innerHeight - 80);
            tt2.style.left = tx + 'px';
            tt2.style.top = ty + 'px';
          }
        };

        this._onCanvasClick = (e) => {
          if (!this._countryHoverFeature) return;
          const iso = this._countryHoverFeature.properties?.ISO_A3;
          if (!iso || !Data.countryHexColors) return;
          const d = Data.countryHexColors[iso];
          if (!d) return;

          // Fly to country centroid
          if (typeof this.world.pointOfView === 'function' && d.lat && d.lng) {
            this.world.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.5 }, 600);
          }
          // Open country card in GLOBE_OVERLAY
          if (hasModule('GLOBE_OVERLAY')) {
            GLOBE_OVERLAY.registerSite({
              siteId: 'country-' + iso,
              icon: '🌍',
              title: d.country,
              subtitle: (d.emissions ? d.emissions + ' MtCO₂' : 'No data') + ' · ' + (d.catRating || 'No CAT rating'),
              tabs: [
                {
                  id: 'pledge',
                  label: '📊 Pledge',
                  render: (panelEl) => {
                    const gap = d.gap;
                    const statusColor = gap === null ? 'var(--text3)' : (gap > 0 ? '#e74c3c' : '#2ecc71');
                    const statusText = gap === null ? 'No target data' : (gap > 0 ? 'OVERSHOOTING' : 'ON TRACK');
                    const target = d.reductionPct ? d.reductionPct + '% by ' + Math.round(d.targetYear) : 'No target set';
                    panelEl.innerHTML = '<h3>Emissions</h3>'
                      + '<div class="overlay-stat-row"><div class="overlay-stat"><div class="overlay-stat-value">' + (d.emissions ? d.emissions.toLocaleString() : '—') + '</div><div class="overlay-stat-label">MtCO₂/year</div></div>'
                      + '<div class="overlay-stat"><div class="overlay-stat-value">' + (d.perCapita ? d.perCapita : '—') + '</div><div class="overlay-stat-label">t/person</div></div></div>'
                      + '<div class="overlay-divider"></div>'
                      + '<h3>Target</h3>'
                      + '<p style="font-size:12px;color:var(--text2);line-height:1.6;">' + target + '</p>'
                      + '<div class="overlay-divider"></div>'
                      + '<h3>Status</h3>'
                      + '<p style="font-size:13px;color:' + statusColor + ';font-weight:600;">' + statusText + '</p>'
                      + (d.gap !== null ? '<p style="font-size:11px;color:var(--text3);margin-top:4px;">Gap: ' + (d.gap > 0 ? '+' : '') + d.gap.toLocaleString() + ' MtCO₂</p>' : '')
                      + '<div class="overlay-divider"></div>'
                      + '<h3>CAT Rating</h3>'
                      + '<p style="font-size:12px;color:var(--text2);">' + (d.catRating || 'Not rated') + ' <span style="color:var(--text3)">(score: ' + (d.catScore || 0) + '/5)</span></p>';
                  },
                },
              ],
            });
            GLOBE_OVERLAY.open('country-' + iso);
          }
        };

        // Attach to the globe canvas
        this._canvasEl = this.world.renderer?.()?.domElement;
        if (this._canvasEl) {
          this._canvasEl.addEventListener('pointermove', this._onCanvasPointerMove);
          this._canvasEl.addEventListener('click', this._onCanvasClick);
        }

        // Notify mode modules that country data are ready
        safeCall('GLOBE_MODES', 'onCountryDataReady');
      })
      .catch(e => {
        console.warn('[Globe] Country borders fetch failed:', e.message);
      });

    // ── Hex country tooltip mouse tracking ──
    // (removed — tooltip positioning now handled in _onCanvasPointerMove)

    // ── Country hover helper ──
    this._clearCountryHover = () => {
      const tt = $('hex-country-tooltip');
      if (tt) tt.classList.remove('visible');
      this._countryHoverFeature = null;
    };

    this.world.pointOfView({ lat: 20, lng: 40, altitude: 2.2 });
    this.world.controls().autoRotate = true;
    this.world.controls().autoRotateSpeed = 0.4;
    this.world.controls().enableDamping = true;
    this.world.controls().dampingFactor = 0.1;

    const m = this.world.globeMaterial();
    m.bumpScale = 12; m.emissive.setHex(0x040810); m.emissiveIntensity = 0.05; m.shininess = 30;

    // Apply initial node visual states
    this.updateNodeVisuals();

    // Initialize pledge tooltip
    this._initPledgeTooltip();
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
        // Mode handler intercepts globe surface clicks
        if (_globeClickHandler) {
          _globeClickHandler(lat, lng);
          return;
        }
      })
      .onPointClick(p => {
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
    const iso = feature?.properties?.ISO_A3;
    if (!iso || !Data.countryHexColors) return 'rgba(255,255,255,0.03)';
    const d = Data.countryHexColors[iso];
    if (!d) return 'rgba(255,255,255,0.03)';

    const gap = d.gap;
    const perCapita = d.perCapita || 0;
    const onTrack = d.onTrack;

    // Base hue: green (140°) → yellow (60°) → red (0°)
    // Based on gap magnitude and direction
    let hue, sat, lum, alpha;

    if (onTrack === true || (gap !== null && gap !== undefined && gap <= 0)) {
      // On track: green family
      const intensity = gap !== null && gap !== undefined ? Math.min(Math.abs(gap) / 300, 1) : 0.3;
      hue = 140 - intensity * 20; // 140 (green) → 120 (yellow-green)
      sat = 50 + intensity * 30;
      lum = 35 + intensity * 10;
      alpha = 0.50 + intensity * 0.20;
    } else if (gap !== null && gap !== undefined && gap > 0) {
      // Overshooting: red family
      const intensity = Math.min(gap / 500, 1);
      hue = 60 - intensity * 60; // 60 (yellow) → 0 (red)
      sat = 55 + intensity * 35;
      lum = 42 - intensity * 8;
      alpha = 0.50 + intensity * 0.20;
    } else {
      // No target data: neutral grey-blue based on per-capita
      const pc = Math.min(perCapita / 20, 1);
      hue = 210; // blue-grey
      sat = 20 + pc * 30;
      lum = 40 + pc * 15;
      alpha = 0.35 + pc * 0.25;
    }

    // Boost saturation for high per-capita countries
    if (perCapita > 10) sat = Math.min(sat + 15, 95);

    return 'hsla(' + Math.round(hue) + ',' + Math.round(sat) + '%,' + Math.round(lum) + '%,' + alpha.toFixed(2) + ')';
  }

  // ── Elevation function: total emissions → hex altitude ──
  // High emitters rise up (mountains), low emitters sink (valleys)
  _countryHexAltitudeFn(feature) {
    const iso = feature?.properties?.ISO_A3;
    if (!iso || !Data.countryHexColors) return 0.003;
    const d = Data.countryHexColors[iso];
    if (!d) return 0.003;

    const emissions = d.emissions || 0;
    // Log scale: 1 Mt → 0.003, 10000 Mt → 0.025
    const logEm = Math.log(Math.max(emissions, 1));
    const minLog = Math.log(1);
    const maxLog = Math.log(12000);
    const t = Math.min(Math.max((logEm - minLog) / (maxLog - minLog), 0), 1);
    return 0.003 + t * 0.022;
  },

  // ── Mode API — used by GLOBE_MODES orchestrator ──
  setHexMode(colorFn, altFn) {
    if (!this.world) return;
    this.world.hexPolygonColor(colorFn);
    if (altFn) this.world.hexPolygonAltitude(altFn);
  },

  // ── Apply country-colored hex map ──
  applyCountryHexColors() {
    if (!this.world) return;
    this.world.hexPolygonColor((f) => this._countryHexColorFn(f));
    this.world.hexPolygonAltitude((f) => this._countryHexAltitudeFn(f));
    // Increase margin so borders between countries are more visible
    if (this.isMobile) {
      this.world.hexPolygonMargin(0.75);
    } else {
      this.world.hexPolygonMargin(0.68);
    }
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

  /**
   * Restore the default night earth texture.
   */
  restoreDefaultTexture() {
    if (!this.world) return;
    this.world.globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg');
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

    // Remove canvas listeners
    if (this._canvasEl) {
      this._canvasEl.removeEventListener('pointermove', this._onCanvasPointerMove);
      this._canvasEl.removeEventListener('click', this._onCanvasClick);
      this._canvasEl = null;
    }

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
    return {};
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
    provides: ['init', 'initPledgeNodes', 'updateNodeVisuals', 'setLens', 'setHexMode', 'applyCountryHexColors', 'togglePledgeNodes', 'getCountryFeatures', 'setGlobeTexture', 'restoreDefaultTexture', 'setGlobeTextureFromCanvas', 'setOnGlobeClick', 'clearOnGlobeClick', 'clearNodeVisuals', 'restoreNodeVisuals', 'reset', 'destroy', 'getState'],
    requires: ['Data'],
  });
}
