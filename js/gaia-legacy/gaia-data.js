/**
 * GAIA DATA ENGINE v1.0
 * Live data fetcher with localStorage caching
 * All sources confirmed CORS-accessible from browser
 * 
 * Data sources:
 *   NOAA GML    — CO2, CH4, N2O (monthly, no auth)
 *   Carbonmark  — Credit prices, retirements (real-time, no auth)
 *   Open-Meteo  — Weather context (no auth)
 * 
 * Cache strategy:
 *   NOAA CO2/CH4: 24 hours (updates monthly, no need to hammer)
 *   Carbonmark:   5 minutes (prices change)
 *   Computed stats: derived from cached raw data
 */

const GAIA_DATA = (() => {
  const CACHE_PREFIX = 'gaia_data_';
  const CACHE_DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // ── Cache helpers ──
  function cacheGet(key, ttl) {
    try {
      const raw = Storage.safeGetItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > (ttl || CACHE_DEFAULT_TTL)) return null;
      return data;
    } catch { return null; }
  }

  function cacheSet(key, data) {
    try {
      Storage.safeSetItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
    } catch { /* quota exceeded, ignore */ }
  }

  // ── NOAA CO2 Parser ──
  function parseNOAAText(text) {
    const records = [];
    for (const line of text.split('\n')) {
      if (line.startsWith('#') || !line.trim()) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        const year = parseInt(parts[0]), month = parseInt(parts[1]);
        const co2 = parseFloat(parts[3]);
        if (!isNaN(year) && !isNaN(month) && !isNaN(co2) && co2 > 0) {
          records.push({ year, month, co2 });
        }
      }
    }
    return records;
  }

  // ── Fetch with timeout ──
  async function fetchText(url, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  async function fetchJSON(url, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // ── Public API ──
  return {
    // Fetch all live data (called on boot)
    async refreshAll() {
      const promises = [
        this.fetchCO2(),
        this.fetchMethane(),
        this.fetchCarbonPrices(),
        this.fetchRetirements(),
      ];
      await Promise.allSettled(promises);
      return this.getSnapshot();
    },

    async fetchCO2() {
      const cached = cacheGet('co2', 24 * 60 * 60 * 1000);
      if (cached) return cached;
      try {
        const text = await fetchText('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt');
        const records = parseNOAAText(text);
        cacheSet('co2', records);
        return records;
      } catch { return cacheGet('co2', Infinity); }
    },

    async fetchMethane() {
      const cached = cacheGet('ch4', 24 * 60 * 60 * 1000);
      if (cached) return cached;
      try {
        const text = await fetchText('https://gml.noaa.gov/webdata/ccgg/trends/ch4/ch4_mm_gl.txt');
        const records = parseNOAAText(text).map(r => ({ ...r, ch4: r.co2 }));
        cacheSet('ch4', records);
        return records;
      } catch { return cacheGet('ch4', Infinity); }
    },

    async fetchCarbonPrices() {
      const cached = cacheGet('prices', 5 * 60 * 1000);
      if (cached) return cached;
      try {
        const data = await fetchJSON('https://api.carbonmark.com/prices');
        const listings = Array.isArray(data) ? data : (data.data || []);
        cacheSet('prices', listings);
        return listings;
      } catch { return cacheGet('prices', Infinity) || []; }
    },

    async fetchRetirements() {
      const cached = cacheGet('retirements', 5 * 60 * 1000);
      if (cached) return cached;
      try {
        const data = await fetchJSON('https://api.carbonmark.com/retirements');
        const retirements = Array.isArray(data) ? data : (data.data || []);
        cacheSet('retirements', retirements);
        return retirements;
      } catch { return cacheGet('retirements', Infinity) || []; }
    },

    // ── Computed snapshots ──
    async getSnapshot() {
      const [co2, ch4, prices, retirements] = await Promise.all([
        this.fetchCO2(), this.fetchMethane(), this.fetchCarbonPrices(), this.fetchRetirements()
      ]);

      // CO2 stats
      const co2Latest = co2 && co2.length ? co2[co2.length - 1] : null;
      const co2Prev = co2 && co2.length > 1 ? co2[co2.length - 2] : null;
      const co2YearAgo = co2Latest ? co2.find(r => r.year === co2Latest.year - 1 && r.month === co2Latest.month) : null;
      const co2MonthlyChange = co2Latest && co2Prev ? +(co2Latest.co2 - co2Prev.co2).toFixed(2) : null;
      const co2YearlyChange = co2Latest && co2YearAgo ? +(co2Latest.co2 - co2YearAgo.co2).toFixed(2) : null;

      // 24-hour human emissions estimate (143 Gt/yr = ~392,000 t/day = ~16,300 t/hr)
      const dailyEmissionsGt = 143 / 365;
      const hourlyEmissionsGt = dailyEmissionsGt / 24;

      // Methane
      const ch4Latest = ch4 && ch4.length ? ch4[ch4.length - 1] : null;

      // Carbon prices
      const validPrices = (prices || []).filter(p => p.purchasePrice && p.purchasePrice > 0 && p.purchasePrice < 1000);
      const avgPrice = validPrices.length ? validPrices.reduce((s, p) => s + p.purchasePrice, 0) / validPrices.length : null;
      const registryCounts = {};
      for (const p of (prices || [])) {
        const pid = p?.listing?.creditId?.projectId || '';
        const reg = pid.split('-')[0] || 'Other';
        registryCounts[reg] = (registryCounts[reg] || 0) + 1;
      }

      // Retirements (last 30 visible)
      const totalRetired = (retirements || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

      // Keeling Curve: last 12 months for sparkline
      const keeling12 = (co2 || []).slice(-12).map(r => ({ label: `${r.year}-${String(r.month).padStart(2, '0')}`, value: r.co2 }));

      // Year-over-year comparison for last 5 years
      const yearlyTrend = [];
      if (co2) {
        const byYear = {};
        for (const r of co2) {
          if (!byYear[r.year]) byYear[r.year] = [];
          byYear[r.year].push(r.co2);
        }
        for (const year of Object.keys(byYear).sort().slice(-5)) {
          const vals = byYear[year];
          yearlyTrend.push({ year: +year, avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) });
        }
      }

      return {
        fetchedAt: Date.now(),
        co2: {
          latest: co2Latest ? co2Latest.co2 : null,
          latestDate: co2Latest ? `${co2Latest.year}-${String(co2Latest.month).padStart(2, '0')}` : null,
          monthlyChange: co2MonthlyChange,
          yearlyChange: co2YearlyChange,
          keeling12,
          yearlyTrend,
        },
        methane: {
          latest: ch4Latest ? ch4Latest.ch4 : null,
          latestDate: ch4Latest ? `${ch4Latest.year}-${String(ch4Latest.month).padStart(2, '0')}` : null,
        },
        carbonMarket: {
          avgPrice: avgPrice ? +avgPrice.toFixed(2) : null,
          listingCount: validPrices.length,
          registryCounts,
          recentRetirements: totalRetired,
        },
        humanEmissions: {
          dailyGt: +dailyEmissionsGt.toFixed(2),
          hourlyGt: +hourlyEmissionsGt.toFixed(2),
          annualGt: 143,
          natureAbsorptionGt: 123,
          netExcessGt: 20,
        },
        carbonBudget: {
          remaining15: 250,
          remaining20: 1200,
          yearsLeft15: Math.max(0, Math.round(250 / 37.8)),
          yearsLeft20: Math.max(0, Math.round(1200 / 37.8)),
        }
      };
    },

    // Get cached snapshot without fetching (instant)
    getCachedSnapshot() {
      const raw = cacheGet('snapshot', 5 * 60 * 1000);
      return raw;
    },

    // Save snapshot after refresh
    saveSnapshot(snapshot) {
      cacheSet('snapshot', snapshot);
    },

    // ── Welcome back: what changed since last visit ──
    getWelcomeBackInfo() {
      try {
        const lastVisit = Storage.safeGetItem('gaia_last_visit');
        const lastCO2 = Storage.safeGetItem('gaia_last_co2');
        if (!lastVisit) return null;
        const daysSince = Math.floor((Date.now() - parseInt(lastVisit)) / (1000 * 60 * 60 * 24));
        const co2Then = lastCO2 ? parseFloat(lastCO2) : null;
        return { daysSince, co2Then };
      } catch { return null; }
    },

    saveVisitInfo(co2Value) {
      try {
        Storage.safeSetItem('gaia_last_visit', Date.now().toString());
        if (co2Value) Storage.safeSetItem('gaia_last_co2', co2Value.toString());
      } catch { /* ignore */ }
    },

    // ── Session tracking ──
    getSessionInfo() {
      try {
        const info = JSON.parse(Storage.safeGetItem('gaia_session') || '{}');
        return {
          visitCount: info.visitCount || 0,
          firstVisit: info.firstVisit || null,
          totalTimeSeconds: info.totalTimeSeconds || 0,
        };
      } catch { return { visitCount: 0, firstVisit: null, totalTimeSeconds: 0 }; }
    },

    saveSessionInfo(info) {
      Storage.safeSetItem('gaia_session', JSON.stringify(info));
    },
  };
})();
window.GAIA_DATA = GAIA_DATA;

  MODULE_CONTRACTS.register('GAIA_DATA', {
    provides: ['init', 'getVisitCount', 'getFirstVisit', 'getTotalTime'],
    requires: [],
  });
