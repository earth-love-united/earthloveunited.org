// ═══════════════════════════════════════════════════════
// NDVI VERIFIER — Satellite ground-truth comparison
// Fetches Sentinel-2 NDVI data and cross-references
// against locally baked project data
// ═══════════════════════════════════════════════════════

const NDVIVerifier = (() => {

  // Sentinel Hub API endpoint (free tier — no key for basic NDVI)
  // Uses the Statistical API for time-series NDVI at project coordinates
  const SENTINEL_CONFIG = {
    baseUrl: 'https://services.sentinel-hub.com/api/v1',
    // Alternative: use GFW (Global Forest Watch) tile API if SH is down
    gfwUrl: 'https://production-api.globalforestwatch.org/v1',
    cacheTtlMs: 3600000, // 1 hour cache
  };

  // Verification status constants
  const STATUS = {
    VERIFIED: 'verified',
    DISCREPANCY: 'discrepancy',
    PENDING: 'pending',
    UNAVAILABLE: 'unavailable',
    FETCHING: 'fetching',
  };

  // ── Cache ──
  let _cache = {};

  function _getCacheKey(siteId) {
    return `ndvi_verify_${siteId}`;
  }

  function _loadFromCache(siteId) {
    try {
      const raw = Storage.safeGetItem(_getCacheKey(siteId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.cachedAt > SENTINEL_CONFIG.cacheTtlMs) {
        Storage.safeRemoveItem(_getCacheKey(siteId));
        return null;
      }
      return parsed;
    } catch { return null; }
  }

  function _saveToCache(siteId, data) {
    Storage.safeSetItem(_getCacheKey(siteId), JSON.stringify({
      ...data,
      cachedAt: Date.now(),
    }));
  }

  // ── NDVI Calculation from Sentinel-2 bands ──
  // NDVI = (NIR - RED) / (NIR + RED)
  // Band 8 (NIR) and Band 4 (RED) from Sentinel-2 L2A
  function _calcNdvi(nir, red) {
    if (nir + red === 0) return 0;
    return (nir - red) / (nir + red);
  }

  // ── Fetch NDVI from Sentinel Hub Statistical API ──
  // NOTE: Requires a valid OAuth token in production. Without auth this
  // falls through to the MODIS fallback, and if that also fails (CORS,
  // network) we return UNAVAILABLE so the UI can show a demo-mode badge.
  async function _fetchSentinelNdvi(site) {
    const { lat, lng } = site;
    const bboxSize = 0.01;

    const payload = {
      input: {
        bounds: {
          bbox: [lng - bboxSize, lat - bboxSize, lng + bboxSize, lat + bboxSize],
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/4326' }
        },
        data: [{
          type: 'S2L2A',
          dataFilter: {
            timeRange: {
              from: new Date(Date.now() - 730 * 86400000).toISOString(),
              to: new Date().toISOString()
            },
            mosaickingOrder: 'leastCC',
            maxCloudCoverage: 30,
          },
          processing: { upsampling: 'BICUBIC', downsampling: 'BICUBIC' }
        }]
      },
      aggregation: {
        evalscript: `
          //VERSION=3
          function setup() { return { input: ["B04", "B08"], output: { bands: 1 } }; }
          function evaluatePixel(sample) {
            return [(sample.B08 - sample.B04) / (sample.B08 + sample.B04)];
          }
        `,
        aggregationInterval: { of: 'P1M' },
        resolution: { width: 10, height: 10 },
      },
      output: { responses: [{ identifier: 'ndvi', format: { type: 'application/json' } }] }
    };

    try {
      const resp = await fetch(SENTINEL_CONFIG.baseUrl + '/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        console.warn(`[NDVIVerifier] Sentinel API error: ${resp.status}`);
        return _fetchFallbackNdvi(site);
      }

      const data = await resp.json();
      if (!data.ndvi || !data.ndvi.data || !data.ndvi.data.length) {
        return _fetchFallbackNdvi(site);
      }

      const monthlyNdvi = data.ndvi.data.map(d => ({
        date: d.date,
        ndvi: Math.round(d.basicStatNumbers.mean * 1000) / 1000,
        sampleCount: d.basicStatNumbers.sampleCount || 0,
      }));

      return {
        source: 'sentinel_hub',
        status: STATUS.VERIFIED,
        data: monthlyNdvi,
        latest: monthlyNdvi[monthlyNdvi.length - 1],
      };
    } catch (err) {
      console.warn('[NDVIVerifier] Sentinel fetch failed:', err.message);
      return _fetchFallbackNdvi(site);
    }
  }

  // ── Fallback: Global Forest Watch NDVI ──
  async function _fetchFallbackNdvi(site) {
    // GFW doesn't have direct NDVI API, but we can use MODIS NDVI
    // This is a secondary approach using a public MODIS endpoint
    const { lat, lng } = site;
    const url = `https://modis.ornl.gov/rst/api/v1/MOD13Q1/ndvi?lat=${lat}&lon=${lng}&startDate=2024-01-01&endDate=2026-04-01&kmAboveBelow=1&kmLeftRight=1`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (data && data.dates && data.dates.length) {
        const monthlyNdvi = data.dates.map((d, i) => ({
          date: d,
          ndvi: Math.round(data.ndvi[i] * 1000) / 10000, // MODIS scale factor
          source: 'modis',
        })).filter(d => d.ndvi >= -0.1 && d.ndvi <= 1.0);

        return {
          source: 'modis',
          status: STATUS.VERIFIED,
          data: monthlyNdvi,
          latest: monthlyNdvi[monthlyNdvi.length - 1],
        };
      }
    } catch (err) {
      console.warn('[NDVIVerifier] MODIS fallback failed:', err.message);
    }

    // No external source available — mark as pending
    return {
      source: 'none',
      status: STATUS.UNAVAILABLE,
      data: [],
      latest: null,
    };
  }

  // ── Compare satellite NDVI with local data ──
  function _compareWithLocal(siteNdvi, satelliteData) {
    if (!satelliteData || !satelliteData.data || !satelliteData.data.length) {
      return { match: false, reason: 'no_satellite_data', local: siteNdvi, satellite: null };
    }

    // Group satellite data by year and get annual averages
    const byYear = {};
    satelliteData.data.forEach(d => {
      const year = d.date.substring(0, 4);
      if (!byYear[year]) byYear[year] = { sum: 0, count: 0 };
      byYear[year].sum += d.ndvi;
      byYear[year].count++;
    });

    // Compare the most recent common year
    const localYears = siteNdvi.map(n => n.year);
    const satelliteYears = Object.keys(byYear).map(Number);
    const commonYears = localYears.filter(y => satelliteYears.includes(y));

    if (!commonYears.length) {
      return {
        match: 'pending',
        reason: 'no_overlapping_years',
        local: siteNdvi,
        satellite: byYear,
      };
    }

    // Compare latest common year
    const latestCommon = Math.max(...commonYears);
    const localEntry = siteNdvi.find(n => n.year === latestCommon);
    const satEntry = byYear[latestCommon];
    const satAvg = satEntry.sum / satEntry.count;

    const diff = Math.abs(localEntry.value - satAvg);

    return {
      match: diff < 0.05 ? 'good' : diff < 0.10 ? 'acceptable' : 'mismatch',
      diff: Math.round(diff * 1000) / 1000,
      localValue: localEntry.value,
      satelliteValue: Math.round(satAvg * 1000) / 1000,
      year: latestCommon,
      local: siteNdvi,
      satellite: byYear,
    };
  }

  // ── Public: Verify a single site ──
  // Wraps the entire fetch chain in a timeout so the UI never hangs.
  // If both Sentinel and MODIS fail (auth, CORS, network), returns
  // UNAVAILABLE with a demo-mode flag so the UI can show sample data.
  async function verifySite(siteId) {
    if (!Data) {
      console.warn('[NDVIVerifier] Data module not loaded yet');
      return { status: STATUS.UNAVAILABLE, demo: true };
    }

    const site = Data.getSite(siteId);
    if (!site) {
      console.warn(`[NDVIVerifier] Unknown site: ${siteId}`);
      return { status: STATUS.UNAVAILABLE, demo: true };
    }

    // Check cache first
    const cached = _loadFromCache(siteId);
    if (cached) {
      const comparison = _compareWithLocal(site.ndvi, cached);
      return { ...cached, comparison };
    }

    // Race the satellite fetch against a timeout (8 seconds)
    const SATELLITE_TIMEOUT_MS = 8000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), SATELLITE_TIMEOUT_MS)
    );

    let satelliteData;
    try {
      satelliteData = await Promise.race([
        _fetchSentinelNdvi(site),
        timeoutPromise
      ]);
    } catch {
      // Timeout or unhandled error — use fallback
      try {
        satelliteData = await _fetchFallbackNdvi(site);
      } catch {
        satelliteData = { source: 'none', status: STATUS.UNAVAILABLE, data: [], latest: null };
      }
    }

    // If both APIs failed, return demo data so the UI still renders
    if (satelliteData.status === STATUS.UNAVAILABLE) {
      return {
        source: 'demo',
        status: STATUS.UNAVAILABLE,
        data: [],
        latest: null,
        demo: true,
        comparison: { match: 'demo', reason: 'Satellite APIs unavailable (auth/CORS/network). Showing demo data.' },
      };
    }

    _saveToCache(siteId, satelliteData);
    const comparison = _compareWithLocal(site.ndvi, satelliteData);
    return { ...satelliteData, comparison };
  }

  // ── Public: Verify all sites ──
  async function verifyAllSites() {
    if (!Data) {
      console.warn('[NDVIVerifier] Data module not loaded yet');
      return {};
    }

    const results = {};
    for (const site of Data.sites) {
      results[site.id] = await verifySite(site.id);
    }
    return results;
  }

  // ── Public: Get verification badge data for UI ──
  function getBadgeData(comparison) {
    if (!comparison || !comparison.match) {
      return {
        icon: '🔍',
        label: 'Verifying...',
        color: 'var(--text3)',
        tooltip: 'Satellite data pending',
      };
    }

    switch (comparison.match) {
      case 'good':
        return {
          icon: '✅',
          label: 'Satellite Verified',
          color: 'var(--leaf)',
          tooltip: `Local data matches Sentinel-2 within ${comparison.diff} NDVI (${comparison.year})`,
        };
      case 'acceptable':
        return {
          icon: '⚠️',
          label: 'Close Match',
          color: 'var(--amber)',
          tooltip: `Small discrepancy (${comparison.diff}) — may be due to measurement timing or methodology`,
        };
      case 'mismatch':
        return {
          icon: '🔶',
          label: 'Discrepancy',
          color: 'var(--warn)',
          tooltip: `Local: ${comparison.localValue} vs Satellite: ${comparison.satelliteValue} (${comparison.year}). Investigation needed.`,
        };
      case 'pending':
        return {
          icon: '⏳',
          label: 'Awaiting Satellite',
          color: 'var(--text3)',
          tooltip: 'No overlapping data years yet — check back after next satellite pass',
        };
      default:
        return {
          icon: '❓',
          label: 'No Data',
          color: 'var(--text3)',
          tooltip: 'Satellite verification not available',
        };
    }
  }

  // ── Public: Generate a verification summary card HTML ──
  function renderVerificationCard(siteId, comparison) {
    const site = Data ? Data.getSite(siteId) : null;
    const badge = getBadgeData(comparison);
    const isDemo = comparison?.demo || comparison?.source === 'demo';

    return `
      <div class="verification-card" id="verify-${siteId}">
        <div class="verify-header">
          <span class="verify-icon">${badge.icon}</span>
          <span class="verify-label" style="color:${badge.color}">${badge.label}</span>
          <span class="verify-year">${comparison?.year || '—'}</span>
          ${isDemo ? '<span class="verify-demo-badge" style="font-size:8px;background:rgba(139,159,199,0.15);color:#8b9fc7;padding:1px 5px;border-radius:3px;margin-left:4px;">DEMO</span>' : ''}
        </div>
        <div class="verify-detail">
          ${comparison?.satelliteValue != null
            ? `<div class="verify-row">
                <span>Local NDVI</span>
                <span class="verify-val">${comparison.localValue?.toFixed(2) || '—'}</span>
              </div>
              <div class="verify-row">
                <span>Satellite NDVI</span>
                <span class="verify-val sat">${comparison.satelliteValue?.toFixed(2) || '—'}</span>
              </div>
              <div class="verify-row">
                <span>Difference</span>
                <span class="verify-val ${comparison.diff < 0.05 ? 'good' : comparison.diff < 0.10 ? 'ok' : 'bad'}">${comparison.diff?.toFixed(3) || '—'}</span>
              </div>`
            : `<div class="verify-row"><span>${isDemo ? '🛰 Demo mode — satellite verification requires API access. ' + (comparison?.reason || '') : badge.tooltip}</span></div>`
          }
        </div>
        <div class="verify-footer">
          <span class="verify-source">Source: ${comparison?.source === 'sentinel_hub' ? 'Sentinel-2 (ESA)' : comparison?.source === 'modis' ? 'MODIS (NASA)' : comparison?.source === 'demo' ? 'Demo data' : 'Pending satellite data'}</span>
          ${site ? `<span class="verify-coords">${site.lat.toFixed(3)}°, ${site.lng.toFixed(3)}°</span>` : ''}
        </div>
      </div>
    `;
  }

  // ── Init: attach to globe hover events ──
  function init() {
    console.log('[NDVIVerifier] Module loaded — ready for satellite verification');
  }

  return {
    STATUS,
    verifySite,
    verifyAllSites,
    getBadgeData,
    renderVerificationCard,
    init,
  };
})();

// Auto-init when Data is ready
function _ndviInit() {
  if (hasModule('Data')) {
    NDVIVerifier.init();
  } else {
    // Data not loaded yet — wait once for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => NDVIVerifier.init(), { once: true });
  }
}
_ndviInit();
window.NDVIVerifier = NDVIVerifier;

  MODULE_CONTRACTS.register('NDVIVerifier', {
    provides: ['init', 'activate', 'deactivate', 'verify', 'getStatus'],
    requires: [],
  });
