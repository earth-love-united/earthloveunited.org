// ═══════════════════════════════════════════════
// GLOBE RESTORE — Interactive vegetation restoration simulator
//
// "What if you planted here?"
// Click the globe in NDVI mode → paint vegetation → see carbon impact
//
// Technical pipeline:
//   1. NDVI texture loaded into offscreen canvas
//   2. User clicks globe → lat/lng → pixel coords on canvas
//   3. Pixels painted green in a radius (restoration action)
//   4. Modified canvas → blob URL → globe texture swap
//   5. Carbon impact calculated from pixel count × biome rate
//
// Carbon data: IPCC AR6 estimates (educational, not predictive)
// ═══════════════════════════════════════════════

const GLOBE_RESTORE = (() => {
  // ── Constants ──
  const TEX_W = 3600;  // full-res texture width
  const TEX_H = 1800;  // full-res texture height
  const TEX_W_MOBILE = 1024;
  const TEX_H_MOBILE = 512;

  // Restoration action definitions
  const ACTIONS = {
    reforest: {
      id: 'reforest',
      icon: '🌳',
      name: 'Reforestation',
      desc: 'Plant native tree species to rebuild forest canopy',
      radiusPx: 8,        // ~88km radius at equator
      targetColor: [34, 139, 34],  // forest green
      co2_per_ha_yr: 15,  // tCO₂/ha/year (IPCC AR6 tropical forest)
    },
    mangrove: {
      id: 'mangrove',
      icon: '🌊',
      name: 'Mangrove Restoration',
      desc: 'Restore coastal mangrove ecosystems — nature\'s carbon powerhouse',
      radiusPx: 5,        // ~55km radius — mangrove zones are narrow
      targetColor: [0, 100, 50],   // deep coastal green
      co2_per_ha_yr: 10,
    },
    grassland: {
      id: 'grassland',
      icon: '🌾',
      name: 'Grassland Recovery',
      desc: 'Restore degraded grasslands and savannas',
      radiusPx: 12,       // ~130km radius — grasslands cover wide areas
      targetColor: [124, 180, 50],  // yellow-green
      co2_per_ha_yr: 3,
    },
    desert_green: {
      id: 'desert_green',
      icon: '🏜️',
      name: 'Desert Greening',
      desc: 'Pioneering arid land restoration with drought-resistant species',
      radiusPx: 7,        // ~77km radius
      targetColor: [80, 130, 40],   // sparse green
      co2_per_ha_yr: 1,
    },
  };

  // ── Brush sizes ──
  const BRUSH_SIZES = {
    fine:   { id: 'fine',   label: '·',  name: 'Fine',   multiplier: 0.3, desc: 'Precise — small restoration project' },
    small:  { id: 'small',  label: '●',  name: 'Small',  multiplier: 0.6, desc: 'Local — community-scale effort' },
    medium: { id: 'medium', label: '⬤',  name: 'Medium', multiplier: 1.0, desc: 'Regional — government initiative' },
    large:  { id: 'large',  label: '🟢', name: 'Large',  multiplier: 2.0, desc: 'National — Great Green Wall scale' },
    mega:   { id: 'mega',   label: '🌍', name: 'Mega',   multiplier: 3.5, desc: 'Dream big — paint the Sahara green' },
  };

  // ── State ──
  let _canvas = null;      // offscreen canvas with current texture
  let _ctx = null;          // 2D context
  let _originalData = null; // ImageData of unmodified texture (for undo)
  let _currentAction = 'reforest';
  let _currentBrush = 'medium';
  let _totalPixelsRestored = 0;
  let _totalCO2 = 0;
  let _restorations = [];   // [{lat, lng, action, pixelCount, co2}]
  let _initialized = false;
  let _active = false;
  let _texW = TEX_W;
  let _texH = TEX_H;

  function init() {
    if (_initialized) return;
    _initialized = true;

    // Mobile resolution
    const isMobile = hasModule('GLOBE_NDVI') && GLOBE_NDVI.isMobile();
    if (isMobile) {
      _texW = TEX_W_MOBILE;
      _texH = TEX_H_MOBILE;
    }

    // Create offscreen canvas
    _canvas = document.createElement('canvas');
    _canvas.width = _texW;
    _canvas.height = _texH;
    _ctx = _canvas.getContext('2d', { willReadFrequently: true });

    console.log(`[GLOBE_RESTORE] init — ${_texW}×${_texH} canvas, ${Object.keys(ACTIONS).length} actions`);
  }

  // ── Texture loading ──

  /**
   * Load the current NDVI texture into the offscreen canvas.
   * Called when NDVI mode activates or year changes.
   */
  function loadTexture(imagePath) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        _ctx.drawImage(img, 0, 0, _texW, _texH);
        _originalData = _ctx.getImageData(0, 0, _texW, _texH);
        _totalPixelsRestored = 0;
        _totalCO2 = 0;
        _restorations = [];
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load texture: ${imagePath}`));
      img.src = imagePath;
    });
  }

  // ── Coordinate mapping ──

  /**
   * Convert lat/lng to pixel coordinates on the equirectangular texture.
   * lat: -90 to +90, lng: -180 to +180
   */
  function latLngToPixel(lat, lng) {
    const x = Math.round(((lng + 180) / 360) * _texW) % _texW;
    const y = Math.round(((90 - lat) / 180) * _texH);
    return { x: Math.max(0, Math.min(_texW - 1, x)), y: Math.max(0, Math.min(_texH - 1, y)) };
  }

  /**
   * Get the area in hectares that one pixel represents at a given latitude.
   * Accounts for latitude-based distortion in equirectangular projection.
   */
  function pixelAreaHa(lat) {
    const degPerPixelLng = 360 / _texW;
    const degPerPixelLat = 180 / _texH;
    // 1 degree ≈ 111.32 km at equator, shrinks by cos(lat) for longitude
    const kmPerDegLat = 111.32;
    const kmPerDegLng = 111.32 * Math.cos(lat * Math.PI / 180);
    const pixelAreaKm2 = (degPerPixelLng * kmPerDegLng) * (degPerPixelLat * kmPerDegLat);
    return pixelAreaKm2 * 100; // km² → hectares
  }

  // ── Biome detection ──

  /**
   * Read the current biome at a pixel location from the texture color.
   * Uses NASA NEO MODIS NDVI color palette interpretation:
   *   - Deep blue/black → Ocean
   *   - Brown/tan (high R, low G) → Desert/Barren
   *   - Yellow-brown (R≈G, both medium) → Dry savanna
   *   - Yellow-green (G>R, medium) → Grassland/Savanna
   *   - Green (G dominant, bright) → Temperate Forest
   *   - Dark green (G dominant, dim) → Tropical Forest
   *   - White/bright (all high) → Ice/Snow (polar only)
   */
  function detectBiome(x, y) {
    if (!_originalData) return { name: 'Unknown', ndvi: 0 };
    const idx = (y * _texW + x) * 4;
    const r = _originalData.data[idx];
    const g = _originalData.data[idx + 1];
    const b = _originalData.data[idx + 2];
    const color = [r, g, b];

    // Derive approximate latitude from pixel y
    const lat = 90 - (y / _texH) * 180;
    const brightness = (r + g + b) / 3;

    // ── Ocean: blue-dominant or very dark ──
    if (b > r + 20 && b > g + 20 && brightness < 80) return { name: 'Ocean', ndvi: -1, color };
    if (r < 25 && g < 25 && b < 25) return { name: 'Ocean', ndvi: -1, color };
    // Deep ocean (very dark blue/black)
    if (brightness < 15) return { name: 'Ocean', ndvi: -1, color };

    // ── Ice/Snow: only near poles, very bright ──
    if (Math.abs(lat) > 55 && brightness > 180 && r > 170 && g > 170) {
      return { name: 'Ice/Snow', ndvi: 0.02, color };
    }

    // ── Vegetation analysis via green-to-red ratio (pseudo-NDVI) ──
    const pseudoNDVI = (g - r) / Math.max(g + r, 1);  // -1 to +1

    // Strong green dominance → forest
    if (pseudoNDVI > 0.25 && g > 80) return { name: 'Tropical Forest', ndvi: 0.75, color };
    if (pseudoNDVI > 0.15 && g > 70) return { name: 'Temperate Forest', ndvi: 0.60, color };

    // Moderate green → grassland/savanna
    if (pseudoNDVI > 0.05 && g > 60) return { name: 'Grassland/Savanna', ndvi: 0.35, color };

    // Neutral or slightly red-dominant with medium brightness → dry/sparse
    if (brightness > 80 && r > g) return { name: 'Dry/Sparse Vegetation', ndvi: 0.15, color };

    // Red-dominant, bright → desert/arid
    if (r > g + 20 && brightness > 60) return { name: 'Desert/Arid', ndvi: 0.05, color };

    // Tundra at high latitudes
    if (Math.abs(lat) > 50 && brightness < 100) return { name: 'Tundra', ndvi: 0.10, color };

    // Low brightness dark areas (dark land, not ocean)
    if (brightness < 50 && g >= r) return { name: 'Dense Forest', ndvi: 0.65, color };
    if (brightness < 50) return { name: 'Barren/Rock', ndvi: 0.03, color };

    return { name: 'Mixed Vegetation', ndvi: 0.30, color };
  }

  // ── Country detection ──

  /**
   * Detect which country a lat/lng falls in using GeoJSON point-in-polygon.
   * Uses the country features already loaded in GlobeModule.
   */
  function detectCountry(lat, lng) {
    if (!hasModule('GlobeModule')) return null;
    const features = GlobeModule.getCountryFeatures();
    if (!features || !features.length) return null;

    for (const feature of features) {
      if (_pointInFeature(lat, lng, feature)) {
        const props = feature.properties || {};
        return {
          name: props.NAME || props.ADMIN || 'Unknown',
          iso: props.ISO_A2 || props.ISO_A3 || '',
          continent: props.CONTINENT || '',
          region: props.SUBREGION || props.REGION_UN || '',
        };
      }
    }
    return null;  // ocean or unmatched
  }

  /**
   * Point-in-polygon test for GeoJSON features (supports Polygon + MultiPolygon).
   */
  function _pointInFeature(lat, lng, feature) {
    const geom = feature.geometry;
    if (!geom) return false;

    const rings = geom.type === 'Polygon' ? [geom.coordinates]
                : geom.type === 'MultiPolygon' ? geom.coordinates
                : [];

    for (const polygon of rings) {
      // Check outer ring only (index 0)
      if (polygon[0] && _pointInRing(lng, lat, polygon[0])) return true;
    }
    return false;
  }

  /**
   * Ray-casting point-in-polygon for a single ring.
   * Ring coords are [lng, lat] pairs (GeoJSON convention).
   */
  function _pointInRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  // ── Restoration painting ──

  /**
   * Paint a restoration circle on the texture at the given lat/lng.
   * Returns the restoration result with carbon impact.
   */
  function restore(lat, lng) {
    if (!_ctx || !_originalData) {
      reportWarn('GLOBE_RESTORE', 'No texture loaded — cannot restore');
      return null;
    }

    const action = ACTIONS[_currentAction];
    if (!action) return null;

    const { x: cx, y: cy } = latLngToPixel(lat, lng);
    const biome = detectBiome(cx, cy);



    // Can't restore ocean
    if (biome.ndvi < 0) {
      reportWarn('GLOBE_RESTORE', `Cannot restore ocean (biome=${biome.name}, rgb=${biome.color})`);
      return null;
    }

    const rad = Math.max(1, Math.round(action.radiusPx * (BRUSH_SIZES[_currentBrush]?.multiplier || 1)));
    const [tr, tg, tb] = action.targetColor;
    let pixelCount = 0;

    // Read the full canvas pixel data once (fast batch read)
    const imgData = _ctx.getImageData(0, 0, _texW, _texH);
    const data = imgData.data;

    // Paint a soft-edged circle by manipulating pixel array directly
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > rad) continue;

        const px = (cx + dx + _texW) % _texW;  // wrap longitude
        const py = Math.max(0, Math.min(_texH - 1, cy + dy));
        const idx = (py * _texW + px) * 4;

        // Soft edge: blend factor fades near edge
        const blend = 1 - (dist / rad) * 0.4;  // 1.0 at center, 0.6 at edge

        // Read current pixel from array (fast!)
        const cr = data[idx];
        const cg = data[idx + 1];
        const cb = data[idx + 2];

        // Skip ocean pixels (very dark with no red/green)
        const brightness = (cr + cg + cb) / 3;
        if (brightness < 10) continue;

        // Use vegetation ratio to decide if this pixel needs restoration
        // Desert brown (high R, medium G) has NEGATIVE ratio → needs greening
        // Already green (high G vs R) has POSITIVE ratio → skip if already lush
        const currentRatio = (cg - cr) / Math.max(cg + cr, 1);
        const targetRatio = (tg - tr) / Math.max(tg + tr, 1);
        if (currentRatio > targetRatio * 0.9) continue;  // already greener than target

        data[idx]     = Math.round(cr + (tr - cr) * blend);
        data[idx + 1] = Math.round(cg + (tg - cg) * blend);
        data[idx + 2] = Math.round(cb + (tb - cb) * blend);
        pixelCount++;
      }
    }

    // Write back the modified pixel data in one batch
    _ctx.putImageData(imgData, 0, 0);

    if (pixelCount === 0) return null;

    // Calculate carbon impact
    const areaHa = pixelCount * pixelAreaHa(lat);
    const co2 = areaHa * action.co2_per_ha_yr;

    _totalPixelsRestored += pixelCount;
    _totalCO2 += co2;

    const result = {
      lat, lng,
      action: action.id,
      actionName: action.name,
      biome: biome.name,
      biomeNdvi: biome.ndvi,
      pixelCount,
      areaHa: Math.round(areaHa),
      areaKm2: Math.round(areaHa / 100),
      co2PerYear: Math.round(co2),
      totalCO2: Math.round(_totalCO2),
      totalRestorations: _restorations.length + 1,
    };
    _restorations.push(result);

    // Push modified canvas to globe
    safeCall('GlobeModule', 'setGlobeTextureFromCanvas', _canvas);

    // Add a green pulsing ring at the restoration point
    _updateRestorationMarkers();

    return result;
  }

  /**
   * Update globe rings to show all restoration points as green pulses.
   */
  function _updateRestorationMarkers() {
    if (!hasModule('GlobeModule') || !GlobeModule.world) return;

    // Get existing rings (from sites, events, etc.) and add restoration markers
    const markers = _restorations.map(r => ({
      lat: r.lat,
      lng: r.lng,
      _type: 'restoration',
    }));

    // Append to any existing ring data
    const existing = GlobeModule.world.ringsData() || [];
    const nonRestore = existing.filter(d => d._type !== 'restoration');
    GlobeModule.world
      .ringsData([...nonRestore, ...markers])
      .ringColor(d => {
        if (d._type === 'restoration') {
          return t => `rgba(91,191,114,${(1 - t) * 0.8})`;  // green pulse
        }
        // Default: original ring color function (may be a function itself)
        return typeof d._ringColorFn === 'function' ? d._ringColorFn : (t => `rgba(78,205,196,${1 - t})`);
      })
      .ringMaxRadius(d => d._type === 'restoration' ? 3 : (d.ringMaxRadius || 4))
      .ringPropagationSpeed(d => d._type === 'restoration' ? 2 : 1.5)
      .ringRepeatPeriod(d => d._type === 'restoration' ? 800 : 1200);
  }

  // ── Reset ──

  /**
   * Undo all restorations — restore original texture.
   */
  function reset() {
    if (_originalData && _ctx) {
      _ctx.putImageData(_originalData, 0, 0);
      safeCall('GlobeModule', 'setGlobeTextureFromCanvas', _canvas);
    }
    _totalPixelsRestored = 0;
    _totalCO2 = 0;
    _restorations = [];

    // Clear restoration ring markers
    _updateRestorationMarkers();
  }

  /**
   * Erase restorations at a location, returning pixels to original texture.
   */
  function erase(lat, lng) {
    if (!_ctx || !_originalData) return null;

    const action = ACTIONS[_currentAction] || ACTIONS.reforest;
    const { x: cx, y: cy } = latLngToPixel(lat, lng);
    
    // Use a slightly larger radius for erasing to ensure clean removal
    const rad = Math.max(1, Math.round(action.radiusPx * (BRUSH_SIZES[_currentBrush]?.multiplier || 1) * 1.5));
    
    const imgData = _ctx.getImageData(0, 0, _texW, _texH);
    const data = imgData.data;
    const origData = _originalData.data;
    
    let pixelsErased = 0;

    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > rad) continue;

        const px = (cx + dx + _texW) % _texW; 
        const py = Math.max(0, Math.min(_texH - 1, cy + dy));
        const idx = (py * _texW + px) * 4;
        
        if (data[idx] !== origData[idx] || data[idx+1] !== origData[idx+1] || data[idx+2] !== origData[idx+2]) {
           data[idx] = origData[idx];
           data[idx+1] = origData[idx+1];
           data[idx+2] = origData[idx+2];
           pixelsErased++;
        }
      }
    }
    
    if (pixelsErased > 0) {
      _ctx.putImageData(imgData, 0, 0);
      safeCall('GlobeModule', 'setGlobeTextureFromCanvas', _canvas);
    }
    
    // Remove any nearby restoration records and rings
    _removeRestorationMarkerNearby(lat, lng, 3.0); 
    
    return { erased: pixelsErased };
  }

  function _removeRestorationMarkerNearby(lat, lng, degThreshold) {
    // Find closest marker
    let closestIdx = -1;
    let minD = Infinity;

    for (let i = 0; i < _restorations.length; i++) {
      const r = _restorations[i];
      const d = Math.sqrt((r.lat - lat)**2 + (r.lng - lng)**2);
      if (d < degThreshold && d < minD) {
        minD = d;
        closestIdx = i;
      }
    }

    if (closestIdx !== -1) {
       const removed = _restorations.splice(closestIdx, 1)[0];
       // Note: total pixels/CO2 might not perfectly sync if multiple strokes overlapped,
       // but it's close enough for the educational simulation.
       _totalPixelsRestored = Math.max(0, _totalPixelsRestored - removed.pixelCount);
       _totalCO2 = Math.max(0, _totalCO2 - removed.co2PerYear);
       _updateRestorationMarkers();
    }
  }

  // ── Activation ──

  function activate() {
    _active = true;
  }

  function deactivate() {
    _active = false;
  }

  // ── Public API ──

  return {
    init,
    activate,
    deactivate,
    loadTexture,
    restore,
    erase,
    reset,
    setAction: (id) => { if (ACTIONS[id]) _currentAction = id; },
    getAction: () => _currentAction,
    getActions: () => ({ ...ACTIONS }),
    setBrushSize: (id) => { if (BRUSH_SIZES[id]) _currentBrush = id; },
    getBrushSize: () => _currentBrush,
    getBrushSizes: () => ({ ...BRUSH_SIZES }),
    getStats: () => ({
      totalPixels: _totalPixelsRestored,
      totalCO2: Math.round(_totalCO2),
      count: _restorations.length,
      restorations: [..._restorations],
    }),
    detectBiomeAt: (lat, lng) => {
      const { x, y } = latLngToPixel(lat, lng);
      return detectBiome(x, y);
    },
    detectCountryAt: (lat, lng) => detectCountry(lat, lng),
    isActive: () => _active,

    // ── Standard Module Lifecycle (SML) ──
    reset() {
      console.debug('[SML] GLOBE_RESTORE.reset');
      return true;
    },

    destroy() {
      console.debug('[SML] GLOBE_RESTORE.destroy');

      // Destroy offscreen canvas (large GPU-backed ImageData)
      if (_canvas) {
        _canvas.width = 0;
        _canvas.height = 0;
        _canvas = null;
      }
      _ctx = null;

      // Nullify large data buffers
      _originalData = null;
      _restorations = [];

      // Reset state
      _active = false;
      _initialized = false;
      _totalPixelsRestored = 0;
      _totalCO2 = 0;

      return true;
    },

    getState() {
      return {};
    },
  };
})();
window.GLOBE_RESTORE = GLOBE_RESTORE;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GLOBE_RESTORE', {
    provides: ['init', 'activate', 'deactivate', 'restore', 'erase', 'reset', 'loadTexture', 'setAction', 'getAction', 'getActions', 'getStats', 'setBrushSize', 'getBrushSize', 'getBrushSizes', 'detectBiomeAt', 'detectCountryAt', 'destroy', 'getState'],
    requires: ['GlobeModule'],
  });
}
