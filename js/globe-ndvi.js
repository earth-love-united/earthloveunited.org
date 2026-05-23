// ═══════════════════════════════════════════════
// GLOBE NDVI — "Earth in Time" vegetation mode
// Swaps globe texture to NASA MODIS NDVI satellite imagery
// Data: NASA Earth Observations (NEO) — public domain
//
// When active:
//   - Globe texture → MODIS NDVI composite (green=vegetation)
//   - Hex polygons → hidden (texture IS the data)
//   - Timeline slider → select year (July composites, peak vegetation)
//   - Play button → animate through years
//
// Mobile optimizations:
//   - 1024px textures instead of 3600px (300KB vs 1.1MB)
//   - Lazy preloading: only current ± 2 years
//   - Slower play interval to reduce GPU texture swaps
//
// Attribution: NASA LP DAAC MODIS via NASA NEO
// ═══════════════════════════════════════════════

const GLOBE_NDVI = (() => {
  // All available years — every year from 2000 to 2024 (July composites)
  // NASA MODIS Terra launched Dec 1999, data available from Feb 2000
  const YEARS = [];
  for (let y = 2000; y <= 2024; y++) YEARS.push(y);

  // ── Device detection ──
  const _isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || (window.innerWidth < 768);

  // Mobile: 1024px textures (~300KB). Desktop: 3600px originals (~1.1MB)
  const TEXTURE_DIR = _isMobile ? 'textures/ndvi/mobile/' : 'textures/ndvi/';
  const TEXTURE_PREFIX = 'ndvi_';

  let _currentYear = 2020;
  let _playInterval = null;
  let _active = false;
  let _initialized = false;
  let _preloadedSet = new Set();  // track which years are cached
  
  let _lastClickTime = 0;
  let _lastClickLat = null;
  let _lastClickLng = null;

  function init() {
    if (_initialized) return;
    _initialized = true;

    // Set slider bounds
    const slider = $('ndvi-slider');
    if (slider) {
      slider.min = YEARS[0];
      slider.max = YEARS[YEARS.length - 1];
      slider.step = 1;
      slider.value = _currentYear;
    }
    $text('ndvi-year', String(_currentYear));

    // Wire slider input
    $on('ndvi-slider', 'input', (e) => {
      setYear(parseInt(e.target.value));
    });

    // Wire play button
    $on('ndvi-play', 'click', togglePlay);

    console.log(`[GLOBE_NDVI] init — ${YEARS.length} years, ${_isMobile ? 'mobile' : 'desktop'} mode`);
  }

  /**
   * Lazy preload: only load textures near the current year.
   * Desktop: ±3 years. Mobile: ±2 years.
   * Uses Image objects to warm the browser cache.
   */
  function _preloadNear(year) {
    const radius = _isMobile ? 2 : 3;
    for (let y = year - radius; y <= year + radius; y++) {
      if (y >= YEARS[0] && y <= YEARS[YEARS.length - 1] && !_preloadedSet.has(y)) {
        const img = new Image();
        img.src = _getTexturePath(y);
        _preloadedSet.add(y);
      }
    }
  }

  /**
   * Get texture path for a year (device-appropriate resolution).
   * July composites = peak northern hemisphere vegetation.
   */
  function _getTexturePath(year) {
    return `${TEXTURE_DIR}${TEXTURE_PREFIX}${year}-07.png`;
  }

  function activate() {
    _active = true;
    $show('ndvi-timeline');

    // Show prompt
    const prompt = $('ndvi-prompt');
    if (prompt) prompt.classList.add('visible');

    // Preload textures near current year
    _preloadNear(_currentYear);

    // Swap globe texture to NDVI
    _applyTexture(_currentYear);

    // Hide hex polygons — the texture IS the visualization
    if (hasModule('GlobeModule') && GlobeModule.world) {
      GlobeModule.setHexMode(
        () => 'rgba(0,0,0,0)',  // fully transparent
        () => 0
      );
    }

    // Wire globe click → restoration
    safeCall('GlobeModule', 'setOnGlobeClick', _onGlobeClick);

    // Activate restoration engine
    safeCall('GLOBE_RESTORE', 'activate');
  }

  function deactivate() {
    _active = false;
    $hide('ndvi-timeline');
    stopPlay();

    const prompt = $('ndvi-prompt');
    if (prompt) prompt.classList.remove('visible');

    // Clear click handler
    safeCall('GlobeModule', 'clearOnGlobeClick');

    // Deactivate restoration
    safeCall('GLOBE_RESTORE', 'deactivate');

    // Restore night earth texture
    safeCall('GlobeModule', 'restoreDefaultTexture');
  }

  let _textureLoadedForYear = null;  // track which year's texture is loaded in restore canvas

  function _onGlobeClick(lat, lng) {
    if (!_active) return;
    if (!hasModule('GLOBE_RESTORE')) return;

    // Dismiss prompt on first click
    const prompt = $('ndvi-prompt');
    if (prompt) prompt.classList.remove('visible');

    const now = Date.now();
    // 600ms threshold for double click, relaxed distance (15 deg) because the globe rotates on first click
    const isDoubleClick = (now - _lastClickTime < 600 && 
                           _lastClickLat !== null && Math.abs(lat - _lastClickLat) < 15 && 
                           _lastClickLng !== null && Math.abs(lng - _lastClickLng) < 15);
                           
    if (isDoubleClick) {
      const eraseLat = _lastClickLat;
      const eraseLng = _lastClickLng;
      
      _lastClickTime = 0; // reset to prevent triple click bugs
      _lastClickLat = null;
      _lastClickLng = null;

      // Erase using the original click coordinates, because the camera flight might have moved the globe!
      GLOBE_RESTORE.erase(eraseLat, eraseLng);
      // Also erase current just in case it painted something new
      GLOBE_RESTORE.erase(lat, lng);
      
      // Refresh the sidebar to update impact stats if they erased something
      safeCall('GLOBE_OVERLAY', 'refreshTab');
      return;
    }

    _lastClickTime = now;
    _lastClickLat = lat;
    _lastClickLng = lng;

    try {
      // Fly camera to the clicked location
      if (hasModule('GlobeModule') && GlobeModule.world) {
        const ctrl = GlobeModule.world.controls();
        if (ctrl) ctrl.autoRotate = false;
        GlobeModule.world.pointOfView({ lat, lng, altitude: 1.2 }, 800);
      }
    } catch (e) {
      reportError('GLOBE_NDVI.camera', e);
    }

    const doRestore = () => {
      try {
        const result = GLOBE_RESTORE.restore(lat, lng);
        if (result) {
          _showRestorationSidebar(lat, lng, result);
        }
      } catch (e) {
        reportError('GLOBE_NDVI.doRestore', e);
      }
    };

    // Only load texture into restore canvas if year changed
    if (_textureLoadedForYear !== _currentYear) {
      const path = _getTexturePath(_currentYear);
      GLOBE_RESTORE.loadTexture(path).then(() => {
        _textureLoadedForYear = _currentYear;
        doRestore();
      }).catch(e => reportError('GLOBE_NDVI.loadTexture', e));
    } else {
      doRestore();
    }
  }

  function _showRestorationSidebar(lat, lng, result) {
    // Use GLOBE_OVERLAY to show restoration results
    if (!hasModule('GLOBE_OVERLAY')) return;

    const biome = safeGet('GLOBE_RESTORE', 'detectBiomeAt', { name: 'Unknown' }, lat, lng);
    const stats = safeGet('GLOBE_RESTORE', 'getStats', {});
    const actions = safeGet('GLOBE_RESTORE', 'getActions', {});

    const latStr = Math.abs(lat).toFixed(1) + '°' + (lat >= 0 ? 'N' : 'S');
    const lngStr = Math.abs(lng).toFixed(1) + '°' + (lng >= 0 ? 'E' : 'W');

    GLOBE_OVERLAY.registerSite({
      siteId: 'ndvi-restore',
      icon: '🌱',
      title: 'Restoration Simulator',
      subtitle: `${result.biome} · ${latStr}, ${lngStr} · ${_currentYear}`,
      tabs: [
        {
          id: 'restore',
          label: '🌱 Restore',
          render: (panelEl) => {
            const acts = safeGet('GLOBE_RESTORE', 'getActions', {});
            panelEl.innerHTML = _renderRestoreTab(acts, result);
          },
        },
        {
          id: 'impact',
          label: '📈 Impact',
          render: (panelEl) => {
            const st = safeGet('GLOBE_RESTORE', 'getStats', {});
            panelEl.innerHTML = _renderImpactTab(st);
          },
        },
        {
          id: 'learn',
          label: '📚 Learn',
          render: (panelEl) => {
            panelEl.innerHTML = _renderLearnTab(result);
          },
        },
      ],
    });

    GLOBE_OVERLAY.open('ndvi-restore');
    // Force re-render of whichever tab is active (Impact may be stale)
    setTimeout(() => safeCall('GLOBE_OVERLAY', 'refreshTab'), 50);
  }

  function _renderRestoreTab(actions, lastResult) {
    const currentAction = safeGet('GLOBE_RESTORE', 'getAction', 'reforest');
    const currentBrush = safeGet('GLOBE_RESTORE', 'getBrushSize', 'medium');
    const brushSizes = safeGet('GLOBE_RESTORE', 'getBrushSizes', {});
    let html = '<h3>Choose Restoration Action</h3>';
    html += '<p style="font-size:11px;color:var(--text3);margin-bottom:16px;">Click anywhere on the globe to restore that area. Choose an action below:</p>';

    html += '<div class="restore-actions">';
    for (const [id, action] of Object.entries(actions)) {
      const isActive = id === currentAction;
      html += `
        <button class="restore-action-btn ${isActive ? 'active' : ''}"
                onclick="GLOBE_RESTORE.setAction('${id}'); GLOBE_OVERLAY.refreshTab();"
                style="display:flex;align-items:center;gap:10px;width:100%;padding:12px;
                       margin-bottom:6px;border-radius:8px;cursor:pointer;text-align:left;
                       border:1px solid ${isActive ? 'var(--teal)' : 'rgba(255,255,255,0.06)'};
                       background:${isActive ? 'rgba(78,205,196,0.08)' : 'rgba(255,255,255,0.02)'};
                       color:var(--text);font-family:var(--body);transition:all 0.2s;">
          <span style="font-size:24px">${action.icon}</span>
          <div>
            <div style="font-size:13px;font-weight:600;color:${isActive ? 'var(--teal)' : 'var(--text)'}">${action.name}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${action.desc}</div>
            <div style="font-size:10px;color:var(--leaf);margin-top:3px;font-family:var(--mono)">~${action.co2_per_ha_yr} tCO₂/ha/year</div>
          </div>
        </button>`;
    }
    html += '</div>';

    // ── Brush size picker ──
    html += '<div class="overlay-divider"></div>';
    html += '<h3 style="margin-bottom:8px">🖌️ Brush Size</h3>';
    html += '<div style="display:flex;gap:4px;margin-bottom:8px;">';
    const dotSizes = { fine: 6, small: 10, medium: 14, large: 20, mega: 26 };
    for (const [id, brush] of Object.entries(brushSizes)) {
      const isActive = id === currentBrush;
      const dotSize = dotSizes[id] || 14;
      html += `
        <button onclick="GLOBE_RESTORE.setBrushSize('${id}'); GLOBE_OVERLAY.refreshTab();"
                title="${brush.name}: ${brush.desc}"
                style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;
                       padding:8px 4px;border-radius:8px;cursor:pointer;
                       border:1px solid ${isActive ? 'var(--teal)' : 'rgba(255,255,255,0.06)'};
                       background:${isActive ? 'rgba(78,205,196,0.08)' : 'rgba(255,255,255,0.02)'};
                       color:${isActive ? 'var(--teal)' : 'var(--text3)'};
                       font-family:var(--body);font-size:9px;transition:all 0.2s;">
          <span style="display:inline-block;width:${dotSize}px;height:${dotSize}px;
                       border-radius:50%;background:${isActive ? 'var(--leaf)' : 'rgba(255,255,255,0.15)'};
                       box-shadow:${isActive ? '0 0 8px rgba(91,191,114,0.5)' : 'none'};
                       transition:all 0.3s;"></span>
          <span>${brush.name}</span>
        </button>`;
    }
    html += '</div>';
    // Show current brush description
    const activeBrush = brushSizes[currentBrush];
    if (activeBrush) {
      html += `<div style="font-size:10px;color:var(--text3);margin-bottom:12px;font-style:italic;">${activeBrush.desc}</div>`;
    }

    if (lastResult) {
      html += '<div class="overlay-divider"></div>';
      html += '<h3>Last Restoration</h3>';

      const latStr = Math.abs(lastResult.lat).toFixed(1) + '°' + (lastResult.lat >= 0 ? 'N' : 'S');
      const lngStr = Math.abs(lastResult.lng).toFixed(1) + '°' + (lastResult.lng >= 0 ? 'E' : 'W');
      html += `<div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:12px">
        ${latStr}, ${lngStr} · ${lastResult.biome} · NDVI≈${(lastResult.biomeNdvi || 0).toFixed(2)}
      </div>`;

      html += `<div class="overlay-stat-row">
        <div class="overlay-stat"><div class="overlay-stat-value">${lastResult.actionName}</div><div class="overlay-stat-label">Action</div></div>
        <div class="overlay-stat"><div class="overlay-stat-value">${lastResult.biome}</div><div class="overlay-stat-label">Original Biome</div></div>
      </div>`;
      html += `<div class="overlay-stat-row">
        <div class="overlay-stat"><div class="overlay-stat-value">${Data.fmt(lastResult.areaKm2)} km²</div><div class="overlay-stat-label">Area Restored</div></div>
        <div class="overlay-stat"><div class="overlay-stat-value">${Data.fmt(lastResult.co2PerYear)} t</div><div class="overlay-stat-label">CO₂/year</div></div>
      </div>`;
    }

    html += `<div style="margin-top:16px">
      <button onclick="GLOBE_RESTORE.reset(); GLOBE_OVERLAY.refreshTab();"
              style="padding:8px 16px;border:1px solid rgba(255,120,120,0.2);background:rgba(255,120,120,0.05);
                     color:#ff7878;border-radius:6px;cursor:pointer;font-family:var(--body);font-size:11px;transition:all 0.2s;">
        ↺ Reset All Restorations
      </button>
    </div>`;

    return html;
  }

  function _renderImpactTab(stats) {
    let html = '<h3>Cumulative Impact</h3>';
    html += '<p style="font-size:11px;color:var(--text3);">Every click restores land. See the total impact of your session.</p>';

    const totalArea = stats.restorations?.reduce((sum, r) => sum + r.areaKm2, 0) || 0;

    html += `<div class="overlay-stat-row">
      <div class="overlay-stat"><div class="overlay-stat-value" style="font-size:22px">${Data.fmt(stats.totalCO2 || 0)}</div><div class="overlay-stat-label">tonnes CO₂/year sequestered</div></div>
    </div>`;
    html += `<div class="overlay-stat-row">
      <div class="overlay-stat"><div class="overlay-stat-value">${stats.count || 0}</div><div class="overlay-stat-label">Restorations</div></div>
      <div class="overlay-stat"><div class="overlay-stat-value">${Data.fmt(totalArea)} km²</div><div class="overlay-stat-label">Total Area</div></div>
    </div>`;



    // Equivalencies for intuition
    if (stats.totalCO2 > 0) {
      const cars = Math.round(stats.totalCO2 / 4.6);  // avg car = 4.6 tCO2/yr
      const flights = Math.round(stats.totalCO2 / 0.9); // round-trip NYC-LON ≈ 0.9t
      html += '<div class="overlay-divider"></div>';
      html += '<h3>That\'s equivalent to…</h3>';
      html += `<div style="font-size:13px;color:var(--text2);line-height:1.8;">
        🚗 Taking <strong style="color:var(--teal)">${Data.fmt(cars)}</strong> cars off the road per year<br>
        ✈️ Offsetting <strong style="color:var(--teal)">${Data.fmt(flights)}</strong> transatlantic flights per year
      </div>`;
    }

    html += `<div style="margin-top:20px;padding:10px;border:1px solid rgba(212,165,116,0.15);border-radius:8px;background:rgba(212,165,116,0.03);">
      <div style="font-size:10px;color:var(--amber);margin-bottom:4px;font-weight:600;">⚠ Educational Estimates</div>
      <div style="font-size:10px;color:var(--text3);line-height:1.5;">These figures are simplified estimates based on IPCC AR6 data. Real-world outcomes depend on soil, climate, species selection, and long-term management.</div>
    </div>`;

    return html;
  }

  function _renderLearnTab(result) {
    let html = '<h3>Why Restoration Matters</h3>';

    html += `<p>Earth has lost <strong style="color:var(--warn)">~420 million hectares</strong> of forest since 1990 — an area larger than the European Union.</p>`;
    html += `<p>But restoration works. The UN Decade on Ecosystem Restoration (2021-2030) aims to restore <strong style="color:var(--leaf)">350 million hectares</strong> — enough to sequester up to 26 gigatonnes of CO₂.</p>`;

    html += '<div class="overlay-divider"></div>';
    html += '<h3>Biome Facts</h3>';

    const facts = {
      'Tropical Forest': 'Tropical forests hold 50% of Earth\'s biodiversity and store ~228 billion tonnes of carbon.',
      'Forest': 'Temperate forests recover faster than tropical ones — some can reach full canopy in 30 years.',
      'Grassland': 'Grasslands store most carbon underground. Their root systems can extend 6 feet deep.',
      'Desert/Barren': 'The Great Green Wall project aims to restore 100 million hectares across the Sahel by 2030.',
      'Dry/Sparse': 'Drylands cover 41% of Earth\'s surface and are home to 2 billion people.',
      'Mangrove': 'Mangroves sequester 4x more carbon per hectare than terrestrial forests.',
    };

    const biomeName = result?.biome || 'Forest';
    const fact = facts[biomeName] || facts['Forest'];
    html += `<p><strong style="color:var(--teal)">${biomeName}:</strong> ${fact}</p>`;

    html += '<div class="overlay-divider"></div>';
    html += '<h3>Take Real Action</h3>';
    html += `<p>This simulator shows what's possible. To make it real:</p>`;
    html += `<div style="font-size:12px;color:var(--text2);line-height:1.8;">
      🌱 <strong>Volunteer</strong> with Earth Love United restoration events<br>
      💚 <strong>Pledge</strong> to protect your local ecosystem<br>
      📢 <strong>Share</strong> this visualization to spread awareness
    </div>`;

    return html;
  }

  function _applyTexture(year) {
    const path = _getTexturePath(year);
    safeCall('GlobeModule', 'setGlobeTexture', path);

    // Also load into restoration canvas
    if (hasModule('GLOBE_RESTORE')) {
      GLOBE_RESTORE.loadTexture(path).catch(e => {
        reportWarn('GLOBE_NDVI', 'Could not load texture into restore canvas: ' + e.message);
      });
    }
  }

  function setYear(year) {
    // Clamp to available range
    _currentYear = Math.max(YEARS[0], Math.min(YEARS[YEARS.length - 1], Math.round(year)));
    $text('ndvi-year', String(_currentYear));

    const slider = $('ndvi-slider');
    if (slider) slider.value = _currentYear;

    // Reset restore canvas tracking — new year needs fresh texture load
    _textureLoadedForYear = null;

    // Preload neighbors for smooth scrubbing
    _preloadNear(_currentYear);

    if (_active) _applyTexture(_currentYear);
  }

  // ── Playback ──
  function togglePlay() {
    if (_playInterval) {
      stopPlay();
    } else {
      startPlay();
    }
  }

  function startPlay() {
    if (!YEARS.length) return;

    const playBtn = $('ndvi-play');
    if (playBtn) playBtn.textContent = '⏸';

    if (_currentYear >= YEARS[YEARS.length - 1]) {
      setYear(YEARS[0]);
    }

    // Preload all years when playing (they'll stream in)
    if (!_isMobile) {
      for (const y of YEARS) {
        if (!_preloadedSet.has(y)) {
          const img = new Image();
          img.src = _getTexturePath(y);
          _preloadedSet.add(y);
        }
      }
    }

    // Mobile: 1.8s per frame (gentler on GPU). Desktop: 1.2s
    const interval = _isMobile ? 1800 : 1200;

    _playInterval = setInterval(() => {
      if (_currentYear >= YEARS[YEARS.length - 1]) {
        stopPlay();
        return;
      }
      setYear(_currentYear + 1);
    }, interval);
  }

  function stopPlay() {
    if (_playInterval) {
      clearInterval(_playInterval);
      _playInterval = null;
    }
    const playBtn = $('ndvi-play');
    if (playBtn) playBtn.textContent = '▶';
  }

  return {
    init,
    activate,
    deactivate,
    setYear,
    getYear: () => _currentYear,
    getYears: () => [...YEARS],
    isActive: () => _active,
    isMobile: () => _isMobile,
  };
})();
window.GLOBE_NDVI = GLOBE_NDVI;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GLOBE_NDVI', {
    provides: ['init', 'activate', 'deactivate', 'setYear', 'getYear'],
    requires: ['GlobeModule'],
  });
}
