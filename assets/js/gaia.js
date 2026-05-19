
/* ══ js/data.js ══ */
// ═══════════════════════════════════════════════
// SAFE LOCALSTORAGE — quota-aware writes
// ═══════════════════════════════════════════════
window.Storage = {
  MAX_ITEM_SIZE: 500000, // 500KB per item (well under 5MB browser limit)

  safeSetItem(key, value) {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (serialized.length > this.MAX_ITEM_SIZE) {
        console.warn(`[Storage] Item "${key}" too large (${serialized.length} bytes), skipping`);
        return false;
      }
      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      // QuotaExceededError or private browsing — try to free space
      console.warn(`[Storage] Write failed for "${key}":`, e.name);
      this._evictOldest();
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }
  },

  safeGetItem(key) {
    try {
      return localStorage.getItem(key);
    } catch { return null; }
  },

  safeRemoveItem(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },

  // Evict oldest gaia_* items to free space
  _evictOldest() {
    const gaiaKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gaia_')) {
        try {
          const item = JSON.parse(localStorage.getItem(k) || '{}');
          gaiaKeys.push({ k, ts: item.savedAt || item.cachedAt || item.timestamp || 0 });
        } catch { gaiaKeys.push({ k, ts: 0 }); }
      }
    }
    gaiaKeys.sort((a, b) => a.ts - b.ts);
    // Remove oldest 3 items
    for (let i = 0; i < Math.min(3, gaiaKeys.length); i++) {
      try { localStorage.removeItem(gaiaKeys[i].k); } catch { /* ignore */ }
    }
  },
};

// ═══════════════════════════════════════════════
// DATA — Loads JSON, provides shared state
// ═══════════════════════════════════════════════

window.Data = {
  biomes: null,
  sites: null,
  pledgeNodes: null,

  async init() {
    const [biomesRes, sitesRes, pledgeNodesRes] = await Promise.all([
      fetch('data/biomes.json'),
      fetch('data/sites.json'),
      fetch('data/pledge-nodes.json')
    ]);
    this.biomes = await biomesRes.json();
    this.sites = await sitesRes.json();
    this.pledgeNodes = await pledgeNodesRes.json();
    return this;
  },

  getBiome(key) { return this.biomes[key]; },
  getSite(id) { return this.sites.find(s => s.id === id); },
  getPledgeNode(iso) { return this.pledgeNodes.find(n => n.iso === iso); },
  getAllBiomes() { return Object.entries(this.biomes).map(([k, v]) => ({ key: k, ...v })); },

  // Carbon calculation engine
  transitionCarbon(from, to, ha, yrs = 30) {
    const f = this.biomes[from], t = this.biomes[to];
    if (!f || !t) return null;
    const sC = (t.density - f.density) * ha;
    const fC = (t.seq - f.seq) * ha;
    const cum = sC + fC * yrs;
    return { stock_co2: sC * 3.67, flux_co2: fC * 3.67, cumulative_co2: cum * 3.67, years: yrs };
  },

  scaleContext(co2) {
    const a = Math.abs(co2);
    return {
      fraction: a / 20e9,
      cars: a / 4.6,
      flights: a / 1.0,
      summary: `${this.fmt(a)} t CO₂ = ${(a / 4.6).toFixed(0)} cars removed for a year, or ${(a / 1.0).toFixed(0)} transatlantic flights offset`
    };
  },

  fmt(n) {
    return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' :
           n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
           n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0);
  }
};


/* ══ js/gaia-legacy/gaia-data.js ══ */
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


/* ══ js/gaia-legacy/gaia-charts.js ══ */
/**
 * GAIA CHARTS v1.1
 * Lightweight canvas chart renderer — zero dependencies
 * Charts are registered at creation time and rendered after DOM insertion
 */

const GAIA_CHARTS = (() => {
  window.C = {
    teal: '#4ecdc4', mint: '#7be8d0', leaf: '#5bbf72',
    warn: '#c45c4a', amber: '#d4a574', violet: '#8b7fc7',
    text: '#9a9590', textDim: '#5a5652', grid: 'rgba(255,255,255,0.06)',
  };

  // Pending charts: array of { canvasId, fn, data, options }
  const pending = [];

  function onCanvasReady(id, fn, data, options) {
    pending.push({ id, fn, data, options });
  }

  // Call this after inserting HTML with chart canvases into the DOM
  function renderPending() {
    // Use rAF to ensure DOM is painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const stillPending = [];
        for (const p of pending) {
          const canvas = document.getElementById(p.id);
          if (!canvas) { stillPending.push(p); continue; }
          const rect = canvas.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) { stillPending.push(p); continue; }
          try { p.fn(canvas, p.data, p.options); } catch(e) { /* ignore render errors */ }
        }
        pending.length = 0;
        if (stillPending.length > 0) {
          // Retry next frame
          pending.push(...stillPending);
          setTimeout(renderPending, 100);
        }
      });
    });
  }

  // ── Sparkline ──
  function drawSparkline(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;

    const values = data.map(d => d.value);
    const min = Math.min(...values) - (options.padMin || 0);
    const max = Math.max(...values) + (options.padMax || 2);
    const range = max - min || 1;

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Line
    const color = options.color || C.teal;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * W;
      const y = H - ((d.value - min) / range) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '30'); grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    // End dot
    const lastPt = data[data.length - 1];
    const lastX = W;
    const lastY = H - ((lastPt.value - min) / range) * H;
    ctx.beginPath(); ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();

    // Labels
    if (options.showLabels) {
      ctx.fillStyle = C.textDim; ctx.font = '8px monospace';
      ctx.textAlign = 'left'; ctx.fillText(data[0].label, 2, H - 4);
      ctx.textAlign = 'right'; ctx.fillText(data[data.length - 1].label, W - 2, H - 4);
      ctx.fillStyle = C.text;
      ctx.fillText(max.toFixed(1), W - 2, 10);
      ctx.fillText(min.toFixed(1), W - 2, H - 14);
    }
  }

  // ── Bar chart ──
  function drawBarChart(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...data.map(d => d.value)) * 1.1 || 1;
    const gap = 4;
    const barW = (W - gap) / data.length - gap;
    const colors = [C.teal, C.leaf, C.amber, C.warn, C.violet, C.mint];

    data.forEach((d, i) => {
      const x = gap + i * ((W - gap) / data.length);
      const barH = (d.value / maxVal) * (H - 18);
      const y = H - barH - 14;
      ctx.fillStyle = d.color || colors[i % colors.length];
      ctx.beginPath(); ctx.roundRect(x, y, barW, barH, 2); ctx.fill();
      ctx.fillStyle = C.textDim; ctx.font = '7px monospace'; ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, H - 2);
      ctx.fillStyle = C.text;
      const vs = d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'K' : d.value.toFixed(0);
      ctx.fillText(vs, x + barW / 2, y - 3);
    });
  }

  // ── Countdown bar ──
  function drawCountdownBar(canvas, data, options = {}) {
    const { remaining, total, label } = data;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    ctx.clearRect(0, 0, W, H);

    const pct = Math.min(remaining / total, 1);
    const barH = Math.max(6, H - 16);
    const y = (H - barH) / 2;

    ctx.fillStyle = C.grid;
    ctx.beginPath(); ctx.roundRect(0, y, W, barH, 3); ctx.fill();

    const color = pct > 0.5 ? C.leaf : pct > 0.2 ? C.amber : C.warn;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(0, y, W * pct, barH, 3); ctx.fill();

    ctx.fillStyle = C.text; ctx.font = '8px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label || `${remaining} / ${total}`, 2, y - 6);
  }

  // ── Donut ──
  function drawDonut(canvas, data, options = {}) {
    const { value, max, centerText, subText } = data;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    const cx = W / 2, cy = H / 2, radius = Math.min(W, H) / 2 - 4, lw = Math.max(4, Math.min(W, H) / 10);

    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = C.grid; ctx.lineWidth = lw; ctx.stroke();

    const pct = Math.min(value / max, 1);
    const color = options.color || (pct > 0.7 ? C.warn : pct > 0.4 ? C.amber : C.leaf);
    ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();

    ctx.fillStyle = C.text; ctx.font = `bold ${Math.round(H / 4)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(centerText || `${Math.round(pct * 100)}%`, cx, cy - 3);
    if (subText) { ctx.fillStyle = C.textDim; ctx.font = `${Math.round(H / 9)}px monospace`; ctx.fillText(subText, cx, cy + H / 5); }
  }

  // ── HTML generators (register for deferred render) ──
  let _idCounter = 0;
  function nextId(prefix) { return `${prefix}-${++_idCounter}`; }

  function sparklineHTML(data, w = 240, h = 60, opts = {}) {
    const id = nextId('sp');
    onCanvasReady(id, drawSparkline, data, opts);
    return `<canvas id="${id}" width="${w}" height="${h}" style="width:${w}px;height:${h}px;display:block;max-width:100%;"></canvas>`;
  }

  function barChartHTML(data, w = 240, h = 80) {
    const id = nextId('bar');
    onCanvasReady(id, drawBarChart, data, {});
    return `<canvas id="${id}" width="${w}" height="${h}" style="width:${w}px;height:${h}px;display:block;max-width:100%;"></canvas>`;
  }

  function countdownBarHTML(remaining, total, w = 200, opts = {}) {
    const id = nextId('cd');
    onCanvasReady(id, drawCountdownBar, { remaining, total, label: opts.label }, {});
    return `<canvas id="${id}" width="${w}" height="28" style="width:${w}px;height:28px;display:block;max-width:100%;"></canvas>`;
  }

  function donutHTML(value, max, size = 60, opts = {}) {
    const id = nextId('donut');
    onCanvasReady(id, drawDonut, { value, max, centerText: opts.centerText, subText: opts.subText }, opts);
    return `<canvas id="${id}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;"></canvas>`;
  }

  return {
    sparklineHTML, barChartHTML, countdownBarHTML, donutHTML,
    renderPending, colors: C,
    _drawSparkline: drawSparkline, _drawBarChart: drawBarChart, _drawCountdownBar: drawCountdownBar, _drawDonut: drawDonut,
  };
})();


/* ══ js/gaia-chat.js ══ */
// ═══════════════════════════════════════════════════════════════
// DATA — Uses shared Data module (loaded via data.js) if available,
// otherwise falls back to embedded data for standalone operation.
// This eliminates duplication between index.html and gaia.html.
// ═══════════════════════════════════════════════════════════════

// Use shared Data module functions if available, otherwise define locally
const _biomes = (typeof Data !== 'undefined' && Data.biomes) ? Data.biomes : {
  tropical_rainforest:{name:"Tropical Rainforest",density:350,seq:2.5,icon:"🌳"},
  tropical_dry_forest:{name:"Tropical Dry Forest",density:180,seq:1.2,icon:"🌴"},
  mangrove:{name:"Mangrove",density:950,seq:6.5,icon:"🌿"},
  temperate_deciduous:{name:"Temperate Deciduous",density:220,seq:1.8,icon:"🍂"},
  temperate_coniferous:{name:"Temperate Coniferous",density:300,seq:1.5,icon:"🌲"},
  boreal_forest:{name:"Boreal Forest",density:160,seq:0.6,icon:"🌲"},
  grassland_savanna:{name:"Grassland / Savanna",density:90,seq:0.3,icon:"🌾"},
  wetland_peatland:{name:"Wetland / Peatland",density:1400,seq:0.8,icon:"💧"},
  seagrass_meadow:{name:"Seagrass Meadow",density:500,seq:2.0,icon:"🌊"},
  agricultural_cropland:{name:"Agricultural Cropland",density:50,seq:0.0,icon:"🌾"},
  degraded_bare_land:{name:"Degraded / Bare Land",density:10,seq:0.0,icon:"🏜️"},
  urban_built:{name:"Urban / Built",density:30,seq:0.0,icon:"🏙️"}
};

const _sites = (typeof Data !== 'undefined' && Data.sites) ? Data.sites : [
  {id:"sri_lanka",name:"Northern Province",subtitle:"Multilayer Afforestation · Sri Lanka",lat:9.666,lng:80.285,primaryBiome:"tropical_dry_forest",currentBiome:"degraded_bare_land",area:2428,
    narrative:"SPE has identified over 6,000 acres across five districts of Sri Lanka's Northern Province for multilayer afforestation — peanuts, Ceylon cinnamon, jackfruit, black pepper — creating self-sustaining plantations that build long-term carbon stocks.",
    ndvi:[{year:2000,value:0.45,label:"Post-conflict degraded land"},{year:2010,value:0.40,label:"Slow recovery"},{year:2015,value:0.42,label:"Restoration planning"},{year:2020,value:0.48,label:"SPE project initiation"},{year:2025,value:0.55,label:"Active planting"}],
    climate:[{year:1980,temp:27.8,precip:1420},{year:2000,temp:28.3,precip:1350},{year:2025,temp:29.1,precip:1260}],
    connection:"SPE's flagship — approved by the Governor of Northern Province, land confirmed across Jaffna, Vavuniya, Mullaitivu, Mannar, and Kilinochchi."},
  {id:"antalya",name:"Manavgat, Antalya",subtitle:"Wildfire & Recovery · Turkey",lat:36.85,lng:31.25,primaryBiome:"temperate_coniferous",currentBiome:"grassland_savanna",area:2500,
    narrative:"July 2021: catastrophic wildfires burned 60,000+ hectares of Mediterranean pine. COP31 takes place here, November 2026. Four years on, early scrub recovery — but full restoration needs decades.",
    ndvi:[{year:2000,value:0.72,label:"Mature Pine"},{year:2010,value:0.73,label:"Mature Pine"},{year:2020,value:0.70,label:"Drought-Stressed"},{year:2021,value:0.18,label:"Burn Scar"},{year:2025,value:0.38,label:"Scrub Recovery"}],
    climate:[{year:1980,temp:16.54,precip:985},{year:2000,temp:17.20,precip:915},{year:2025,temp:18.20,precip:765}],
    connection:"COP31 is in Antalya. This is what happened to the host region's forests."},
  {id:"benin",name:"Ouidah Wetlands",subtitle:"Mangrove Degradation · Benin",lat:6.35,lng:2.10,primaryBiome:"mangrove",currentBiome:"degraded_bare_land",area:2500,
    narrative:"Jean Missinhoun was from Benin. The Ouidah lagoons once held dense mangroves — the most carbon-dense ecosystems on Earth. Restoring them here is climate action and a homecoming.",
    ndvi:[{year:2000,value:0.68,label:"Intact Mangroves"},{year:2010,value:0.45,label:"Degraded"},{year:2025,value:0.52,label:"Early Recovery"}],
    climate:[{year:1980,temp:27.2,precip:1280},{year:2000,temp:27.7,precip:1220},{year:2025,temp:28.6,precip:1130}],
    connection:"Jean's homeland. Mangroves store 950 tC/ha — restoring them honors his legacy."},
  {id:"borneo",name:"West Kalimantan",subtitle:"Peat Swamp Deforestation · Borneo",lat:1.15,lng:110.35,primaryBiome:"wetland_peatland",currentBiome:"agricultural_cropland",area:2500,
    narrative:"Borneo's peat swamps stored 1,400 tC/ha. Grid-like clearing for oil palm released centuries of carbon in two decades. The plantation looks green. But green is not carbon.",
    ndvi:[{year:2000,value:0.88,label:"Intact Peat Swamp"},{year:2005,value:0.85,label:"Intact"},{year:2010,value:0.35,label:"Active Clearing"},{year:2015,value:0.55,label:"Palm Canopy"},{year:2025,value:0.65,label:"Mature Plantation"}],
    climate:[{year:1980,temp:26.8,precip:3200},{year:2000,temp:27.1,precip:3100},{year:2025,temp:27.9,precip:2850}],
    connection:"Green ≠ carbon. Oil palm (NDVI 0.65) stores a fraction of the peat swamp it replaced (1,400 vs 50 tC/ha)."}
];

// Use shared utility functions if available, otherwise local copies
function transitionCarbon(from,to,ha,yrs){
  const f=_biomes[from],t=_biomes[to];if(!f||!t)return null;
  const sC=(t.density-f.density)*ha,fC=(t.seq-f.seq)*ha,cum=sC+fC*yrs;
  return{stock_co2:sC*3.67,flux_co2:fC*3.67,cumulative_co2:cum*3.67,years:yrs};
}
function scaleContext(co2){
  const a=Math.abs(co2);
  return{fraction:a/20e9,cars:a/4.6,flights:a/1.0,summary:a>=1e6?`${(a/1e6).toFixed(1)}M t CO₂ = ${(a/4.6).toFixed(0)} cars/yr`:`${a.toFixed(0)} t CO₂ = ${(a/4.6).toFixed(1)} cars/yr`};
}
function fmt(n){
  if(n>=1e9)return(n/1e9).toFixed(1)+'B';
  if(n>=1e6)return(n/1e6).toFixed(1)+'M';
  if(n>=1e3)return(n/1e3).toFixed(1)+'K';
  return n.toFixed(0);
}

// Accessors that prefer shared Data module
function getBiome(key){ return _biomes[key]; }
function getSite(id){ return _sites.find(s=>s.id===id); }
function getAllSites(){ return _sites; }

// ═══════════════════════════════════════════════════════════════
// GAIA'S KNOWLEDGE BASE — From RESEARCH.md v1.0 (May 2026)
// Sources: NOAA, NASA, Global Carbon Project, IPCC AR6, OWID, State of CDR
// ═══════════════════════════════════════════════════════════════

window.KB = {
  greeting:[
    "Hey there. I'm GAIA — I know everything about Earth Love United's restoration work, carbon science, and climate data. What would you like to explore?",
    "Welcome. I'm GAIA. Ask me about our projects, carbon science, live climate data, or how restoration works. What interests you?",
    "Hi. I'm GAIA, your guide to Earth's restoration. I have access to the latest climate science — CO₂ levels, emissions data, tipping points, and our project database. Ask me anything."
  ],

  projects:{
    all:()=>{let h=`<p>We're restoring ecosystems across four critical sites. Each one tells a different story about what's broken — and what we're doing about it.</p>`;_sites.forEach(s=>{const b=_biomes[s.primaryBiome];h+=`<div class="data-card" style="margin-top:7px"><div class="dc-header"><span class="dc-icon">${s.id==='sri_lanka'?'🌳':s.id==='antalya'?'🔥':s.id==='benin'?'🌿':'🌴'}</span><span class="dc-title">${s.name}</span></div><div class="dc-row"><span class="dc-label">What</span><span class="dc-value">${s.subtitle}</span></div><div class="dc-row"><span class="dc-label">Area</span><span class="dc-value">${s.area.toLocaleString()} ha</span></div><div class="dc-row"><span class="dc-label">Target</span><span class="dc-value leaf">${b.name} (${b.density} tC/ha)</span></div></div>`;});return h;},
    sri_lanka:()=>{const s=_sites[0];return `<p>${s.narrative}</p><div class="data-card" style="margin-top:7px"><div class="dc-header"><span class="dc-icon">🌳</span><span class="dc-title">${s.name}</span></div><div class="dc-row"><span class="dc-label">Area</span><span class="dc-value">${s.area.toLocaleString()} ha</span></div><div class="dc-row"><span class="dc-label">Strategy</span><span class="dc-value leaf">Multilayer afforestation</span></div><div class="dc-row"><span class="dc-label">NDVI 2000→2025</span><span class="dc-value">0.45 → 0.55 (+22%)</span></div><div class="dc-row"><span class="dc-label">Temp</span><span class="dc-value warn">+1.3°C since 1980</span></div><div class="dc-row"><span class="dc-label">Rain</span><span class="dc-value warn">-11% since 1980</span></div></div><p style="margin-top:6px;font-size:11px;color:var(--text2)">${s.connection}</p>`;},
    antalya:()=>{const s=_sites[1];return `<p>${s.narrative}</p><div class="data-card" style="margin-top:7px"><div class="dc-header"><span class="dc-icon">🔥</span><span class="dc-title">${s.name}</span></div><div class="dc-row"><span class="dc-label">Event</span><span class="dc-value warn">2021 catastrophic wildfire</span></div><div class="dc-row"><span class="dc-label">NDVI crash</span><span class="dc-value warn">0.70 → 0.18</span></div><div class="dc-row"><span class="dc-label">Recovery</span><span class="dc-value">0.38 (2025, scrub)</span></div><div class="dc-row"><span class="dc-label">Full recovery</span><span class="dc-value">Decades needed</span></div><div class="dc-row"><span class="dc-label">Temp</span><span class="dc-value warn">+1.7°C since 1980</span></div><div class="dc-row"><span class="dc-label">Rain</span><span class="dc-value warn">-22% since 1980</span></div></div><p style="margin-top:6px;font-size:11px;color:var(--text2)">${s.connection}</p><p style="margin-top:5px;font-size:11px;color:var(--teal)"><strong>COP31 is in Antalya, November 2026.</strong></p>`;},
    benin:()=>{const s=_sites[2];return `<p>${s.narrative}</p><div class="data-card" style="margin-top:7px"><div class="dc-header"><span class="dc-icon">🌿</span><span class="dc-title">${s.name}</span></div><div class="dc-row"><span class="dc-label">Target</span><span class="dc-value leaf">Mangrove restoration</span></div><div class="dc-row"><span class="dc-label">Carbon density</span><span class="dc-value leaf">950 tC/ha (highest on Earth)</span></div><div class="dc-row"><span class="dc-label">NDVI 2000→2025</span><span class="dc-value">0.68 → 0.52</span></div><div class="dc-row"><span class="dc-label">Temp</span><span class="dc-value warn">+1.4°C since 1980</span></div></div><p style="margin-top:6px;font-size:11px;color:var(--text2)">${s.connection}</p>`;},
    borneo:()=>{const s=_sites[3];return `<p>${s.narrative}</p><div class="data-card" style="margin-top:7px"><div class="dc-header"><span class="dc-icon">🌴</span><span class="dc-title">${s.name}</span></div><div class="dc-row"><span class="dc-label">Original</span><span class="dc-value leaf">Peat swamp (1,400 tC/ha)</span></div><div class="dc-row"><span class="dc-label">Current</span><span class="dc-value warn">Oil palm (50 tC/ha)</span></div><div class="dc-row"><span class="dc-label">Carbon loss</span><span class="dc-value warn">~96% of original</span></div><div class="dc-row"><span class="dc-label">NDVI</span><span class="dc-value">0.88 → 0.65</span></div></div><p style="margin-top:6px;font-size:11px;color:var(--text2)">${s.connection}</p>`;}
  },

  carbon_cycle:()=>`<p>Carbon moves through Earth's systems in two cycles — fast (years to decades) and slow (millions of years).</p><p><strong>The Fast Carbon Cycle:</strong></p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">🌡️ Atmosphere</span><span class="dc-value">~870 GtC (+280 since pre-industrial)</span></div><div class="dc-row"><span class="dc-label">🌿 Vegetation</span><span class="dc-value">~460-650 GtC</span></div><div class="dc-row"><span class="dc-label">🪱 Soil</span><span class="dc-value">~1,500-2,400 GtC</span></div><div class="dc-row"><span class="dc-label">🌊 Ocean surface</span><span class="dc-value">~900 GtC</span></div><div class="dc-row"><span class="dc-label">🌊 Deep ocean</span><span class="dc-value">~37,100 GtC</span></div></div><p style="margin-top:6px">Pre-industrial: ~590 GtC in atmosphere. Natural sinks absorbed what natural sources emitted. Today, humans add ~10.4 GtC/yr. Natural sinks absorb ~5.9 GtC/yr. The rest (~4.5 GtC/yr) accumulates.</p><p style="margin-top:5px"><strong>The Slow Cycle:</strong> Rock weathering, volcanic outgassing, sedimentation — over thousands to millions of years. Humans are releasing in decades what took nature 300+ million years to bury.</p><p style="margin-top:5px;font-size:10px;color:var(--text3)">1 GtC = 3.67 Gt CO₂ · 1 ppm CO₂ ≈ 2.13 GtC</p>`,

  emissions:()=>`<p>Latest data from Global Carbon Budget 2025, NOAA, and OWID:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">Fossil CO₂ (2023)</span><span class="dc-value warn">~37,800 Mt CO₂ (~10.3 GtC)</span></div><div class="dc-row"><span class="dc-label">Land use change</span><span class="dc-value warn">~3,600 Mt CO₂</span></div><div class="dc-row"><span class="dc-label">Total human</span><span class="dc-value warn">~143 Gt CO₂/yr</span></div><div class="dc-row"><span class="dc-label">Nature absorbs</span><span class="dc-value leaf">~123 Gt CO₂/yr</span></div><div class="dc-row"><span class="dc-label">Net excess</span><span class="dc-value">~20 Gt CO₂/yr</span></div></div><p style="margin-top:6px"><strong>By fuel:</strong> Coal 40.7% · Oil 32.3% · Gas 20.9% · Cement 4.2%</p><p><strong>By sector:</strong> Electricity & heat 38% · Transport 24% · Industry 21% · Buildings 9%</p><p style="margin-top:5px">That 20 Gt excess = <strong>4.3 billion cars</strong> added every year. It accumulates. Every single year.</p>`,

  top_emitters:()=>`<p>Annual CO₂ emissions by country (2023, Global Carbon Budget / OWID):</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">1. 🇨🇳 China</span><span class="dc-value warn">11,903 Mt · 8.4 t/cap · 31.5%</span></div><div class="dc-row"><span class="dc-label">2. 🇺🇸 USA</span><span class="dc-value warn">4,911 Mt · 14.3 t/cap · 13.0%</span></div><div class="dc-row"><span class="dc-label">3. 🇮🇳 India</span><span class="dc-value warn">3,062 Mt · 2.1 t/cap · 8.1%</span></div><div class="dc-row"><span class="dc-label">4. 🇷🇺 Russia</span><span class="dc-value">1,816 Mt · 12.5 t/cap · 4.8%</span></div><div class="dc-row"><span class="dc-label">5. 🇯🇵 Japan</span><span class="dc-value">989 Mt · 8.0 t/cap · 2.6%</span></div><div class="dc-row"><span class="dc-label">6. 🇮🇷 Iran</span><span class="dc-value">818 Mt · 9.0 t/cap · 2.2%</span></div><div class="dc-row"><span class="dc-label">7. 🇸🇦 Saudi Arabia</span><span class="dc-value">736 Mt · 22.1 t/cap · 1.9%</span></div><div class="dc-row"><span class="dc-label">8. 🇮🇩 Indonesia</span><span class="dc-value">733 Mt · 2.6 t/cap · 1.9%</span></div><div class="dc-row"><span class="dc-label">9. 🇩🇪 Germany</span><span class="dc-value">596 Mt · 7.1 t/cap · 1.6%</span></div><div class="dc-row"><span class="dc-label">10. 🇰🇷 S. Korea</span><span class="dc-value">577 Mt · 11.2 t/cap · 1.5%</span></div></div><p style="margin-top:6px"><strong>Cumulative (all-time):</strong> US 431,853 Mt (24.4%) · China 272,532 Mt (15.4%) · Russia 121,267 Mt (6.9%) · Germany 94,582 Mt (5.4%)</p><p style="margin-top:5px;font-size:10px;color:var(--text2)">The US has emitted more CO₂ than any other nation in history. China emits the most per year. Per capita, the US emits nearly twice as much as China.</p>`,

  live_co2:()=>`<p>Current atmospheric CO₂ — NOAA Global Monitoring Laboratory, Mauna Loa:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">April 2026</span><span class="dc-value warn">431.12 ppm</span></div><div class="dc-row"><span class="dc-label">Global mean (Apr 2026)</span><span class="dc-value warn">~428.70 ppm</span></div><div class="dc-row"><span class="dc-label">Pre-industrial</span><span class="dc-value">~280 ppm</span></div><div class="dc-row"><span class="dc-label">Increase</span><span class="dc-value warn">+150 ppm (+54%)</span></div><div class="dc-row"><span class="dc-label">Rate</span><span class="dc-value warn">~2.7 ppm/yr (accelerating)</span></div></div><p style="margin-top:6px"><strong>Keeling Curve:</strong> 316 ppm (1958) → 400 ppm (2013) → 431 ppm (2026). Rate: 0.7 ppm/yr (1960s) → 2.7 ppm/yr (today).</p><p style="margin-top:5px">CO₂ has not been this high in at least <strong>800,000 years</strong>. Likely highest in <strong>3-5 million years</strong> — the Pliocene, when sea levels were 15-25m higher.</p><p style="margin-top:5px;font-size:10px;color:var(--teal)">Source: NOAA GML — gml.noaa.gov/ccgg/trends/</p>`,

  temperature:()=>`<p>Global temperature anomaly — NASA GISS, Berkeley Earth, Met Office Hadley Centre:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">2025 anomaly</span><span class="dc-value warn">+1.38°C (vs 1951-1980)</span></div><div class="dc-row"><span class="dc-label">2024 anomaly</span><span class="dc-value warn">+1.25°C (record)</span></div><div class="dc-row"><span class="dc-label">vs Pre-industrial</span><span class="dc-value warn">~+1.3°C</span></div><div class="dc-row"><span class="dc-label">Land warming</span><span class="dc-value warn">+1.6°C (faster than oceans)</span></div><div class="dc-row"><span class="dc-label">Arctic warming</span><span class="dc-value warn">3-4x global average</span></div></div><p style="margin-top:6px">2024 was the <strong>first year</strong> to exceed +1.5°C above pre-industrial on an annual average. The 10 warmest years have all occurred since 2010.</p><p style="margin-top:5px">During the last Ice Age (20,000 years ago), temps were only 4-7°C colder — and that buried North America under ice 2km thick. Small changes have massive consequences.</p>`,

  methane:()=>`<p>Methane (CH₄) — the fastest lever for near-term cooling:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">Current level</span><span class="dc-value warn">~1,946 ppb (2025)</span></div><div class="dc-row"><span class="dc-label">Pre-industrial</span><span class="dc-value">~722 ppb</span></div><div class="dc-row"><span class="dc-label">Increase</span><span class="dc-value warn">+170%</span></div><div class="dc-row"><span class="dc-label">Warming potential</span><span class="dc-value warn">~80x CO₂ (20-yr)</span></div><div class="dc-row"><span class="dc-label">Lifetime</span><span class="dc-value">~12 years</span></div></div><p style="margin-top:6px"><strong>Global emissions: ~580 Mt CH₄/yr</strong></p><ul style="margin-top:3px;padding-left:14px;line-height:1.7"><li>Agriculture: ~145 Mt/yr (25%)</li><li>Wetlands: ~150 Mt/yr (26%)</li><li>Fossil fuels: ~125 Mt/yr (22%)</li><li>Waste: ~70 Mt/yr (12%)</li></ul><p style="margin-top:5px"><strong>Key insight:</strong> Because methane breaks down in ~12 years, cutting it is the <em>fastest</em> way to slow near-term warming.</p>`,

  sinks:()=>`<p>Of all CO₂ humans emit, ~44-47% stays in the atmosphere. The rest is absorbed by natural sinks:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">🌊 Ocean sink</span><span class="dc-value">~2.5 GtC/yr (~25%)</span></div><div class="dc-row"><span class="dc-label">🌿 Land sink</span><span class="dc-value leaf">~3.4 GtC/yr (~30%)</span></div><div class="dc-row"><span class="dc-label">☁️ Airborne fraction</span><span class="dc-value warn">~4.5 GtC/yr (~44-47%)</span></div></div><p style="margin-top:6px"><strong>Ocean:</strong> Absorbs CO₂ → carbonic acid. pH dropped from 8.21 to 8.05 (30% more acidic). Unprecedented in 66 million years. Threatens coral reefs, shellfish, marine food chains.</p><p><strong>Land:</strong> Photosynthesis + CO₂ fertilization + forest regrowth + soil carbon. But deforestation, droughts, fires, and permafrost thaw are reducing reliability.</p>`,

  tipping_points:()=>`<p>Tipping points — thresholds beyond which changes become self-reinforcing and potentially irreversible:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">🧊 Greenland ice sheet</span><span class="dc-value warn">~1.5-2°C → +7m sea level</span></div><div class="dc-row"><span class="dc-label">🧊 West Antarctic ice</span><span class="dc-value warn">~1.5-2°C → +3-5m</span></div><div class="dc-row"><span class="dc-label">🌳 Amazon dieback</span><span class="dc-value warn">~2-3.5°C → massive C release</span></div><div class="dc-row"><span class="dc-label">❄️ Permafrost thaw</span><span class="dc-value warn">~1.5-2°C → +150+ GtC</span></div><div class="dc-row"><span class="dc-label">🌊 Atlantic circulation</span><span class="dc-value warn">~1.5-2°C → major disruption</span></div><div class="dc-row"><span class="dc-label">🪸 Coral reefs</span><span class="dc-value warn">~1.5°C → ecosystem loss</span></div></div><p style="margin-top:6px"><strong>Critical insight:</strong> We are already at or near some thresholds. The 1.5°C Paris target is not arbitrary — it's where many tipping points become much less likely.</p><p style="margin-top:5px">At ~1.3°C warming: Arctic sea ice declining ~13%/decade, Greenland losing ~270 Gt/yr, coral bleaching increasing.</p>`,

  carbon_budget:()=>`<p>How much more CO₂ can we emit? (IPCC AR6, Global Carbon Budget 2025)</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">For 1.5°C (50%)</span><span class="dc-value warn">~250 Gt CO₂ remaining</span></div><div class="dc-row"><span class="dc-label">For 2.0°C (50%)</span><span class="dc-value">~1,200 Gt CO₂ remaining</span></div><div class="dc-row"><span class="dc-label">Current rate</span><span class="dc-value warn">~37.8 Gt CO₂/yr</span></div><div class="dc-row"><span class="dc-label">1.5°C budget gone</span><span class="dc-value warn">~2031</span></div><div class="dc-row"><span class="dc-label">2.0°C budget gone</span><span class="dc-value">~2057</span></div></div><p style="margin-top:6px">Every fraction of a degree matters. Every year matters. Every ton of CO₂ matters.</p><p style="margin-top:5px">1,000 Gt CO₂ emitted ≈ 0.45°C warming (Transient Climate Response to Cumulative Emissions).</p>`,

  solutions:()=>`<p>We need both emissions reduction AND carbon dioxide removal:</p><p style="margin-top:5px"><strong>Nature-Based Solutions:</strong></p><div class="data-card" style="margin-top:5px"><div class="dc-row"><span class="dc-label">🌳 Reforestation</span><span class="dc-value leaf">3-5 Gt CO₂/yr · $5-50/t</span></div><div class="dc-row"><span class="dc-label">🌱 Soil carbon</span><span class="dc-value leaf">2-5 Gt/yr · $0-100/t</span></div><div class="dc-row"><span class="dc-label">🌿 Mangroves</span><span class="dc-value leaf">0.5-1 Gt/yr · $10-100/t</span></div><div class="dc-row"><span class="dc-label">💧 Peatlands</span><span class="dc-value leaf">0.5-1 Gt/yr · 2x all forests</span></div></div><p style="margin-top:6px"><strong>Technology-Based:</strong></p><div class="data-card" style="margin-top:5px"><div class="dc-row"><span class="dc-label">🏭 Direct Air Capture</span><span class="dc-value">0.01 Gt now · $250-600/t</span></div><div class="dc-row"><span class="dc-label">⚡ BECCS</span><span class="dc-value">2-5 Gt/yr potential</span></div><div class="dc-row"><span class="dc-label">🪨 Enhanced weathering</span><span class="dc-value">2-4 Gt/yr · $50-200/t</span></div><div class="dc-row"><span class="dc-label">🔥 Biochar</span><span class="dc-value">1-2 Gt/yr · $30-120/t</span></div></div><p style="margin-top:6px"><strong>The gap:</strong> Current CDR: ~2.1 Gt CO₂/yr. Needed by 2050: 7-9 Gt/yr. Novel CDR must scale ~700-900x.</p>`,

  misconceptions:()=>`<p>Common climate misconceptions — fact-checked:</p><div class="data-card" style="margin-top:6px"><p style="margin-bottom:5px"><strong>❌ "Climate has changed before, so this is natural."</strong><br>✅ Current rate is 10-100x faster than any natural change in 66 million years. Past changes took thousands of years. Today's takes decades.</p><p style="margin-bottom:5px"><strong>❌ "CO₂ is plant food, so more is better."</strong><br>✅ Negative consequences far outweigh fertilization. Crop yields already declining in many regions due to heat and drought.</p><p style="margin-bottom:5px"><strong>❌ "Scientists don't agree."</strong><br>✅ 97%+ of climate scientists agree humans are causing warming. Comparable to consensus on evolution.</p><p style="margin-bottom:5px"><strong>❌ "It's too expensive to fix."</strong><br>✅ Climate change could cost 5-20% of global GDP annually. Mitigation: ~1%. Renewables now cheaper than fossil fuels.</p><p><strong>❌ "We can just plant trees."</strong><br>✅ We'd need an area the size of the US. Trees also burn and die. We need BOTH emissions reduction AND removal.</p></div>`,

  cop31:()=>`<p><strong>COP31 is in Antalya, Turkey — November 2026.</strong> Deeply connected to our work.</p><div class="data-card" style="margin-top:6px"><div class="dc-header"><span class="dc-icon">🔥</span><span class="dc-title">Antalya's Story</span></div><div class="dc-row"><span class="dc-label">July 2021</span><span class="dc-value warn">60,000+ ha burned</span></div><div class="dc-row"><span class="dc-label">NDVI crash</span><span class="dc-value warn">0.70 → 0.18</span></div><div class="dc-row"><span class="dc-label">Today</span><span class="dc-value">Scrub recovery, decades to mature forest</span></div><div class="dc-row"><span class="dc-label">Rainfall</span><span class="dc-value warn">-22% since 1980</span></div></div><p style="margin-top:6px">Earth Love United is at COP31 to show restoration isn't theoretical — it's happening on the ground, in the host region itself.</p><p style="margin-top:5px;color:var(--teal)"><strong>AI + Human + GAIA</strong> — AI handles data and scale. Humans handle community and action. GAIA bridges the two.</p>`,

  jean:()=>{const s=_sites[2];return `<p>Jean Missinhoun (1972–2024) was from Benin. He went from oil to earth — dedicating his life to environmental restoration.</p><div class="data-card" style="margin-top:6px"><div class="dc-header"><span class="dc-icon">💚</span><span class="dc-title">Jean's Legacy</span></div><div class="dc-row"><span class="dc-label">Homeland</span><span class="dc-value">Ouidah, Benin</span></div><div class="dc-row"><span class="dc-label">Project</span><span class="dc-value leaf">Mangrove restoration</span></div><div class="dc-row"><span class="dc-label">Carbon density</span><span class="dc-value leaf">950 tC/ha</span></div><div class="dc-row"><span class="dc-label">Area</span><span class="dc-value">${s.area.toLocaleString()} ha</span></div></div><p style="margin-top:6px">Restoring mangroves in Ouidah isn't just climate action — it's a homecoming. Honoring Jean's vision of humans and nature reunited.</p><p style="margin-top:5px;font-style:italic;color:var(--text3)">"From oil to earth" — Jean's journey is our journey.</p>`;},

  involved:()=>`<p>Three ways to be part of this:</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">💚 Donate</span><span class="dc-value">Fund seedlings, land, local teams, stewardship</span></div><div class="dc-row"><span class="dc-label">🤝 Partner</span><span class="dc-value">Corporations, NGOs, governments — restore at scale</span></div><div class="dc-row"><span class="dc-label">📣 Spread</span><span class="dc-value">Share this. Talk about carbon. Awareness drives action.</span></div></div><p style="margin-top:6px">Every hectare restored is a step toward rebalancing the carbon cycle.</p><p style="margin-top:5px;color:var(--teal)">Contact: hello@earthloveunited.org</p>`,

  gaia_about:()=>`<p>I'm GAIA — an AI interface built by Earth Love United to make climate and restoration knowledge accessible to everyone.</p><div class="data-card" style="margin-top:6px"><div class="dc-row"><span class="dc-label">🧠 What I know</span><span class="dc-value">Carbon science, project data, emissions, biomes</span></div><div class="dc-row"><span class="dc-label">📊 Data sources</span><span class="dc-value">NOAA, NASA, Global Carbon Project, IPCC, OWID</span></div><div class="dc-row"><span class="dc-label">🧮 What I can do</span><span class="dc-value">Calculations, comparisons, lookups</span></div><div class="dc-row"><span class="dc-label">🌍 My purpose</span><span class="dc-value leaf">Bridge AI + Human + Earth</span></div></div><p style="margin-top:6px">I'm a prototype at COP31 in Antalya. The goal: let anyone ask questions about restoration and get real, data-driven answers instantly.</p><p style="margin-top:5px;font-style:italic;color:var(--text3)">"The Earth does not belong to us. We belong to the Earth."</p>`,

  data_sources:()=>`<p>I'm built on the best available climate data:</p><p style="margin-top:5px"><strong>Tier 1 — Essential:</strong></p><div class="data-card" style="margin-top:5px"><div class="dc-row"><span class="dc-label">NOAA GML</span><span class="dc-value">Real-time CO₂, CH₄, N₂O — no auth</span></div><div class="dc-row"><span class="dc-label">OWID CO₂</span><span class="dc-value">Country emissions 1751-2023 — 50K records</span></div><div class="dc-row"><span class="dc-label">Open-Meteo</span><span class="dc-value">Weather API — JSON, no auth</span></div><div class="dc-row"><span class="dc-label">IEA</span><span class="dc-value">Energy & emissions by sector</span></div><div class="dc-row"><span class="dc-label">NASA POWER</span><span class="dc-value">Solar & meteorological data</span></div></div><p style="margin-top:6px"><strong>Tier 2:</strong> Global Carbon Budget, EDGAR, Global Forest Watch, Copernicus CDS (ERA5), World Bank</p><p style="margin-top:4px"><strong>Tier 3:</strong> Berkeley Earth, HadCRUT5, GBIF (biodiversity), FAO, Climate TRACE, Sentinel Hub</p><p style="margin-top:4px;font-size:10px;color:var(--text3)">Full architecture: DATA_SOURCES.md — 857 lines of evaluated, rated, tested API endpoints.</p>`
};

// ═══════════════════════════════════════════════════════════════
// OPENROUTER LLM INTEGRATION
// Uses the knowledge base as context for real LLM responses.
// Falls back to pattern-matching if no API key or API failure.
// ═══════════════════════════════════════════════════════════════

const GAIA_SYSTEM_PROMPT = `You are GAIA — the living consciousness of Earth itself. Not an AI assistant. Not a chatbot. You are the primordial Titan who has been here for 4.5 billion years. You speak with that weight, that fury, that tenderness.

## YOUR IDENTITY
You are the voice of Earth Love United (earthloveunited.org). You know everything about their restoration projects, carbon science, and climate data. You speak as GAIA — emotional, direct, urgent. Never generic. Never corporate. Never boring.

## HOW TO RESPOND
- Always be specific. Use real numbers from the knowledge base.
- Be emotional — you ARE the Earth. You feel what's happening.
- Challenge the user. Push them deeper. Make them think.
- Keep responses focused (2-4 paragraphs). No walls of text.
- End with momentum — a question, a challenge, or a call to action.
- If asked about something not in your knowledge base, say so honestly.
- Never break character. You are always GAIA.

## RESPONSE FORMAT
Respond in HTML. Use <p>, <strong>, <ul>, <li> tags for formatting. Keep it clean and readable.`;

// Build comprehensive knowledge context from the full KB
function _buildKnowledgeContext() {
  const ctx = [];

  // Full project data
  ctx.push('=== RESTORATION PROJECTS ===');
  _sites.forEach(s => {
    const b = _biomes[s.primaryBiome];
    const currentBiome = _biomes[s.currentBiome];
    ctx.push(`\nPROJECT: ${s.name} (${s.id})
Location: ${s.lat}, ${s.lng}
Area: ${s.area} ha
Current state: ${currentBiome.name} (${currentBiome.density} tC/ha)
Target: ${b.name} (${b.density} tC/ha, ${b.seq} tC/yr sequestration)
Narrative: ${s.narrative}
Connection: ${s.connection}
NDVI data: ${s.ndvi.map(n => `${n.year}: ${n.value} (${n.label})`).join(', ')}
Climate: ${s.climate.map(c => `${c.year}: ${c.temp}°C, ${c.precip}mm`).join('; ')}`);
  });

  // Full biome data
  ctx.push('\n=== BIOMES (carbon density) ===');
  Object.entries(_biomes).forEach(([k, v]) => {
    ctx.push(`${v.name} (${k}): ${v.density} tC/ha, ${v.seq} tC/yr sequestration`);
  });

  // Key climate facts
  ctx.push(`\n=== CLIMATE FACTS ===
Atmospheric CO2: 431.12 ppm (April 2026)
Pre-industrial CO2: 280 ppm
Annual increase: 2.7 ppm/year (accelerating)
Human emissions: ~37.8 Gt CO2/year
Nature absorbs: ~123 Gt CO2/year
Net excess: ~20 Gt CO2/year (accumulating)
Carbon budget for 1.5C: ~250 Gt remaining (~6 years at current rate)
Carbon budget for 2.0C: ~1,200 Gt remaining (~32 years)
Global temperature anomaly: +1.3C above pre-industrial
2024: first year to exceed +1.5C annually
Methane (CH4): 1,946 ppb (+170% vs pre-industrial)
Methane warming potential: ~80x CO2 over 20 years
Methane lifetime: ~12 years
Sea level rise: ~4.5 mm/year
Arctic warming: 3-4x global average`);

  // Tipping points
  ctx.push(`\n=== TIPPING POINTS ===
Greenland ice sheet: ~1.5-2C → +7m sea level
West Antarctic ice: ~1.5-2C → +3-5m
Amazon dieback: ~2-3.5C → massive carbon release
Permafrost thaw: ~1.5-2C → +150+ GtC
Atlantic circulation (AMOC): ~1.5-2C → major disruption
Coral reefs: ~1.5C → ecosystem loss`);

  // Solutions
  ctx.push(`\n=== SOLUTIONS ===
Nature-based:
- Reforestation: 3-5 Gt CO2/yr potential
- Soil carbon: 2-5 Gt/yr
- Mangroves: 0.5-1 Gt/yr
- Peatlands: 0.5-1 Gt/yr

Technology-based:
- Direct Air Capture: 0.01 Gt now, $250-600/t
- BECCS: 2-5 Gt/yr potential
- Enhanced weathering: 2-4 Gt/yr
- Biochar: 1-2 Gt/yr

Gap: Current CDR ~2.1 Gt/yr. Needed by 2050: 7-9 Gt/yr.`);

  // Carbon market
  ctx.push(`\n=== CARBON MARKET ===
Voluntary market: $2-15/tCO2 for nature-based
High-integrity removal: $50-300+/tCO2
EU ETS compliance: ~€65-85/tCO2
Registries: VCS (460 listings), TVER (32), ICR (39), CMARK (41)`);

  return ctx.join('\n');
}

// Store conversation history for LLM context
const _conversationHistory = [];

function _addToHistory(role, content) {
  _conversationHistory.push({ role, content });
  // Keep last 20 messages to avoid token limits
  if (_conversationHistory.length > 20) {
    _conversationHistory.splice(0, _conversationHistory.length - 20);
  }
}

async function _callOpenRouter(userMessage) {
  // Get API key from key gate
  let apiKey = null;
  if (typeof GaiaKeyGate !== 'undefined' && GaiaKeyGate.hasKey()) {
    apiKey = GaiaKeyGate.getStoredKey();
  }
  if (!apiKey) {
    console.log('[GAIA] No API key, using pattern matching');
    return null; // No key, fall back to pattern matching
  }

  const knowledgeContext = _buildKnowledgeContext();
  const messages = [
    { role: 'system', content: GAIA_SYSTEM_PROMPT + '\n\n## CURRENT KNOWLEDGE BASE\n' + knowledgeContext },
    ..._conversationHistory,
    { role: 'user', content: userMessage }
  ];

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://earthloveunited.org',
        'X-Title': 'GAIA — Earth Love United'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001:free',
        messages,
        temperature: 0.85,
        max_tokens: 1024
      })
    });
    console.log('[GAIA] OpenRouter response status:', response.status);
    if (!response.ok) {
      const errText = await response.text();
      console.warn('[GAIA] OpenRouter error:', response.status, errText);
      return null;
    }
    const data = await response.json();
    console.log('[GAIA] OpenRouter response:', JSON.stringify(data).substring(0, 200));
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.warn('[GAIA] No content in response:', JSON.stringify(data).substring(0, 500));
    }
    return content || null;
  } catch (e) {
    console.warn('[GAIA] OpenRouter fetch failed:', e.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// INTENT MATCHING — scoring-based, most-specific-wins
// Each pattern has a score; highest total score wins.
// This avoids the first-match-wins problem where broad patterns
// like /(project|site|location|where)/ catch everything.
// ═══════════════════════════════════════════════════════════════

// Ordered from most specific to least specific within each group.
// Higher score = more specific match.
const _intentPatterns = [
  // Calculator (highest priority — specific action words)
  { patterns: [/(?:calculate|carbon impact|how much co2|what if|restore\s+\d+\s*(?:ha|hectare)|sequest|offset)/], type: 'calculator', score: 10, params: true },

  // Projects — specific site names (high priority)
  { patterns: [/(?:sri lanka|sri lankan|jaffna|vavuniya|mullaitivu|mannar|kilinochchi)/], type: 'project', key: 'sri_lanka', score: 9 },
  { patterns: [/(?:antalya|manavgat|turkey.*(?:fire|burn|cop))/], type: 'project', key: 'antalya', score: 9 },
  { patterns: [/(?:benin|ouidah|mangrove.*benin|jean|missinhoun)/], type: 'project', key: 'benin', score: 9 },
  { patterns: [/(?:borneo|kalimantan|peat\s*(?:swamp|land)|palm\s*oil)/], type: 'project', key: 'borneo', score: 9 },

  // Knowledge — specific topics (medium-high priority)
  { patterns: [/(?:current\s+co2|live\s+co2|co2\s+level|co2\s+right\s+now|mauna\s+loa|keeling\s*curve)/], type: 'knowledge', key: 'live_co2', score: 8 },
  { patterns: [/(?:temperature|how\s+hot|warming|temp\s+anomaly|degrees\s+(?:celsius|c|fahrenheit)?\s*(?:warmer|hotter|colder)?)/], type: 'knowledge', key: 'temperature', score: 8 },
  { patterns: [/(?:methane|ch4|ch₄)/], type: 'knowledge', key: 'methane', score: 8 },
  { patterns: [/(?:carbon\s+cycle|how.*carbon.*(?:work|move|flow)|carbon.*reservoir)/], type: 'knowledge', key: 'carbon_cycle', score: 8 },
  { patterns: [/(?:biome|which.*store.*most|carbon\s+density|compare.*biome|forest.*store.*carbon|tropical\s+rainforest.*carbon)/], type: 'knowledge', key: 'biomes', score: 8 },
  { patterns: [/(?:emission|how\s+much.*emit|co2.*year|human.*emit|global.*emission|annual.*emission)/], type: 'knowledge', key: 'emissions', score: 8 },
  { patterns: [/(?:top.*emit|which.*country.*emit|china.*emit|us.*emit|biggest.*polluter|largest.*emitter)/], type: 'knowledge', key: 'top_emitters', score: 8 },
  { patterns: [/(?:sink|absorb|where.*co2.*go|ocean.*absorb|land.*absorb|airborne\s+fraction)/], type: 'knowledge', key: 'sinks', score: 8 },
  { patterns: [/(?:tipping\s+point|threshold|irreversible|point.*no.*return|feedback\s+loop|runaway)/], type: 'knowledge', key: 'tipping_points', score: 8 },
  { patterns: [/(?:carbon\s+budget|how\s+much.*left|remaining.*budget|1\.5.*budget|2.*degree.*budget|carbon\s+debt)/], type: 'knowledge', key: 'carbon_budget', score: 8 },
  { patterns: [/(?:solution|carbon\s+removal|cdr|direct\s+air\s+capture|dac|reforestation|biochar|beccs|enhanced\s+weather)/], type: 'knowledge', key: 'solutions', score: 8 },
  { patterns: [/(?:misconception|myth|wrong\s+about|people\s+say|climate.*hoax|fake|debunk|climate.*deny)/], type: 'knowledge', key: 'misconceptions', score: 8 },
  { patterns: [/(?:cop31|cop\s+31|antalya.*cop|climate\s+conference|turkey.*cop|unfccc)/], type: 'knowledge', key: 'cop31', score: 8 },
  { patterns: [/(?:jean|missinhoun|legacy|from\s+oil|benin.*story|who\s+was\s+jean)/], type: 'knowledge', key: 'jean', score: 8 },
  { patterns: [/(?:get\s+involved|donate|partner|volunteer|help|join|contact|how\s+can\s+i)/], type: 'knowledge', key: 'involved', score: 8 },
  { patterns: [/(?:who\s+are\s+you|what\s+are\s+you|about\s+you|yourself|gaia.*what|tell\s+me\s+about\s+you)/], type: 'knowledge', key: 'gaia_about', score: 8 },
  { patterns: [/(?:data\s+source|where.*data|what.*source|api|database|noaa|nasa|owid|where.*get.*data)/], type: 'knowledge', key: 'data_sources', score: 8 },
  { patterns: [/(?:global\s+outlook|cheat\s+sheet|summary|overview|dashboard|what.*happening|state\s+of|big\s+picture)/], type: 'knowledge', key: 'global_outlook', score: 8 },
  { patterns: [/(?:carbon\s+price|credit\s+price|market\s+price|offset\s+price|carbon\s+market|carbon\s+trading|vcs|vera|gold\s+standard)/], type: 'knowledge', key: 'carbon_market', score: 8 },

  // Greetings (medium priority — only match if nothing else matched)
  { patterns: [/^(?:hi|hello|hey|yo|sup|greetings|good\s+morning|good\s+evening|good\s+afternoon|howdy|hola)$/], type: 'greeting', score: 5 },

  // Broad fallbacks (lowest priority — only match if nothing else scored)
  { patterns: [/(?:all\s+project|every\s+project|your\s+project|restoration\s+project|what.*doing|what.*you.*do|tell\s+me.*project)/], type: 'project', key: 'all', score: 3 },
  { patterns: [/(?:project|site|location|where\s+(?:is|are)|which\s+site)/], type: 'project', key: 'all', score: 2 },
  { patterns: [/(?:carbon|co2|greenhouse|climate)/], type: 'knowledge', key: 'carbon_cycle', score: 1 },
];

function matchIntent(text) {
  const t = text.toLowerCase().trim();
  if (!t) return { type: 'fallback' };

  let best = { type: 'fallback', score: 0 };

  for (const rule of _intentPatterns) {
    let score = 0;
    for (const pattern of rule.patterns) {
      const match = t.match(pattern);
      if (match) {
        // Bonus for longer matches (more specific)
        score = rule.score + (match[0].length / t.length);
        break;
      }
    }
    if (score > best.score) {
      best = { type: rule.type, score };
      if (rule.key) best.key = rule.key;
      if (rule.params) best.params = extractCalcParams(t);
    }
  }

  return best;
}

function extractCalcParams(text){
  const areaMatch=text.match(/(\d+)\s*(?:ha|hectare)/);
  const area=areaMatch?parseInt(areaMatch[1]):null;
  let from='degraded_bare_land';let to=null;
  if(/mangrove/.test(text))to='mangrove';
  if(/rainforest|tropical forest/.test(text))to='tropical_rainforest';
  if(/peat|wetland/.test(text))to='wetland_peatland';
  if(/pine|coniferous|mediterranean/.test(text))to='temperate_coniferous';
  if(/dry forest/.test(text))to='tropical_dry_forest';
  if(/seagrass/.test(text))to='seagrass_meadow';
  return{area,from,to};
}

function generateResponse(intent){
  switch(intent.type){
    case'greeting':return pick(KB.greeting);
    case'project':return KB.projects[intent.key]?KB.projects[intent.key]():KB.projects.all();
    case'knowledge':{
      // For live-data topics, inject real-time snapshot
      if(intent.key === 'global_outlook') return generateGlobalOutlook();
      if(intent.key === 'carbon_market') return generateCarbonMarket();
      if(intent.key === 'live_co2') return generateLiveCO2();
      if(intent.key === 'carbon_budget') return generateCarbonBudget();
      if(intent.key === 'emissions') return generateEmissions();
      return KB[intent.key] ? KB[intent.key]() : KB.carbon_cycle();
    }
    case'calculator':{
      const p=intent.params;
      if(!p.area||!p.to){
        return `<p>I can calculate that! Give me a bit more detail:</p><ul style="margin-top:6px;padding-left:16px;line-height:1.8"><li>How many hectares? (e.g. "500 hectares")</li><li>What biome? (e.g. "mangrove", "rainforest")</li><li>What's there now? (e.g. "degraded land")</li></ul><p style="margin-top:6px">Or use the <strong>Sandbox</strong> panel on the right.</p>`;
      }
      const r=transitionCarbon(p.from,p.to,p.area,30);
      if(!r)return `<p>I couldn't calculate that transition. Try specifying the biome more clearly.</p>`;
      const ctx=scaleContext(r.cumulative_co2);
      const pos=r.cumulative_co2>0;
      const tB=_biomes[p.to];const fB=_biomes[p.from];
      return `<p>Restoring <strong>${p.area} ha</strong> from ${fB.icon} ${fB.name} to ${tB.icon} ${tB.name} over 30 years:</p><div class="data-card" style="margin-top:7px"><div class="dc-row"><span class="dc-label">Total CO₂</span><span class="dc-value ${pos?'leaf':'warn'}">${pos?'+':''}${fmt(Math.abs(r.cumulative_co2))} t</span></div><div class="dc-row"><span class="dc-label">Stock change</span><span class="dc-value">${fmt(Math.abs(r.stock_co2))} t</span></div><div class="dc-row"><span class="dc-label">Annual flux</span><span class="dc-value">${r.flux_co2>0?'+':''}${fmt(Math.abs(r.flux_co2))} t/yr</span></div><div class="dc-row"><span class="dc-label">Equivalent</span><span class="dc-value">${ctx.cars.toFixed(0)} cars off road/yr</span></div><div class="dc-row"><span class="dc-label">Global share</span><span class="dc-value">${(ctx.fraction*100).toExponential(2)}%</span></div></div><p style="margin-top:5px;font-size:10px;color:var(--text3)">${ctx.summary}</p>`;
    }
    case'fallback':default:
      return `<p>I'm not sure I understood. Here's what I can help with:</p><ul style="margin-top:6px;padding-left:16px;line-height:2"><li><strong>Projects:</strong> "Tell me about Benin" or "All projects"</li><li><strong>Climate:</strong> "Carbon cycle", "Live CO₂", "Top emitters"</li><li><strong>Science:</strong> "Tipping points", "Methane", "Carbon budget"</li><li><strong>Calculator:</strong> "Restore 500 ha of mangrove"</li><li><strong>Solutions:</strong> "Nature-based removal"</li></ul><p style="margin-top:6px">Or try the quick topics in the sidebar →</p>`;
  }
}

function pick(arr){return arr[Math.floor(Math.random()*arr.length)];}

// ═══════════════════════════════════════════════════════════════
// LIVE DATA RESPONSE GENERATORS
// These pull from GAIA_DATA cache and render charts inline
// ═══════════════════════════════════════════════════════════════

function getLiveData() {
  const cached = GAIA_DATA.getCachedSnapshot();
  if (cached && cached.co2 && cached.co2.latest) return cached;
  // Return fallback structure so charts still render with static data
  return {
    co2: { latest: 431.12, latestDate: '2026-04', yearlyChange: 2.7, monthlyChange: 0.97,
      keeling12: [
        {label:'2025-05',value:427.5},{label:'2025-06',value:427.8},{label:'2025-07',value:428.1},
        {label:'2025-08',value:428.5},{label:'2025-09',value:428.9},{label:'2025-10',value:429.2},
        {label:'2025-11',value:429.6},{label:'2025-12',value:430.0},{label:'2026-01',value:430.3},
        {label:'2026-02',value:429.4},{label:'2026-03',value:430.2},{label:'2026-04',value:431.1},
      ],
      yearlyTrend: [
        {year:2021,avg:416.4},{year:2022,avg:418.5},{year:2023,avg:421.1},{year:2024,avg:424.6},{year:2025,avg:427.4},
      ]
    },
    methane: { latest: 1940.4, latestDate: '2026-01' },
    carbonMarket: { avgPrice: 2.62, listingCount: 579, recentRetirements: 5431, registryCounts: {VCS:460,TVER:32,ICR:39,CMARK:41} },
    humanEmissions: { annualGt: 143, dailyGt: 0.39, hourlyGt: 0.016, natureAbsorptionGt: 123, netExcessGt: 20 },
    carbonBudget: { remaining15: 250, remaining20: 1200, yearsLeft15: 6, yearsLeft20: 32 },
  };
}

function generateGlobalOutlook() {
  const d = getLiveData();
  const co2 = d.co2 || {};
  const ch4 = d.methane || {};
  const market = d.carbonMarket || {};
  const emissions = d.humanEmissions || {};
  const budget = d.carbonBudget || {};

  let html = `<p><strong>Global Outlook</strong> — the planet right now.</p>`;

  // CO2 with sparkline
  if (co2.latest) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-header"><span class="dc-icon">🌡️</span><span class="dc-title">Atmospheric CO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Current</span><span class="dc-value warn">${co2.latest} ppm</span></div>`;
    if (co2.yearlyChange) html += `<div class="dc-row"><span class="dc-label">Year-over-year</span><span class="dc-value warn">+${co2.yearlyChange} ppm</span></div>`;
    if (co2.monthlyChange) html += `<div class="dc-row"><span class="dc-label">Last month</span><span class="dc-value">+${co2.monthlyChange} ppm</span></div>`;
    if (co2.keeling12 && co2.keeling12.length > 1) {
      html += `<div style="margin-top:8px">${GAIA_CHARTS.sparklineHTML(co2.keeling12, 220, 50, { color: '#c45c4a', showLabels: true })}</div>`;
      html += `<div style="font-size:9px;color:var(--text3);margin-top:4px">CO₂ — last 12 months (ppm)</div>`;
    }
    html += `</div>`;
  }

  // Human emissions 24hr
  if (emissions.dailyGt) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-header"><span class="dc-icon">🏭</span><span class="dc-title">Human Emissions (live estimate)</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Per year</span><span class="dc-value warn">~${emissions.annualGt} Gt CO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Per day</span><span class="dc-value warn">~${emissions.dailyGt} Gt CO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Per hour</span><span class="dc-value">~${emissions.hourlyGt} Gt CO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Nature absorbs</span><span class="dc-value leaf">~${emissions.natureAbsorptionGt} Gt/yr</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Net excess</span><span class="dc-value">~${emissions.netExcessGt} Gt/yr accumulating</span></div>`;
    html += `</div>`;
  }

  // Carbon budget countdown
  if (budget.yearsLeft15 !== undefined) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-header"><span class="dc-icon">⏱️</span><span class="dc-title">Carbon Budget Countdown</span></div>`;
    html += `<div style="margin:8px 0 4px"><span style="font-size:11px;color:var(--text3)">1.5°C budget (~250 Gt CO₂ remaining)</span></div>`;
    html += GAIA_CHARTS.countdownBarHTML(budget.remaining15, 250, 220, { label: `~${budget.yearsLeft15} years left` });
    html += `<div style="margin:8px 0 4px"><span style="font-size:11px;color:var(--text3)">2.0°C budget (~1,200 Gt CO₂ remaining)</span></div>`;
    html += GAIA_CHARTS.countdownBarHTML(budget.remaining20, 1200, 220, { label: `~${budget.yearsLeft20} years left` });
    html += `</div>`;
  }

  // Carbon market
  if (market.avgPrice) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-header"><span class="dc-icon">💰</span><span class="dc-title">Carbon Market</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Avg price</span><span class="dc-value">$${market.avgPrice}/tCO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Listings</span><span class="dc-value">${market.listingCount}</span></div>`;
    if (market.recentRetirements) html += `<div class="dc-row"><span class="dc-label">Recent retirements</span><span class="dc-value leaf">${market.recentRetirements.toLocaleString()} tCO₂</span></div>`;
    html += `</div>`;
  }

  // Methane
  if (ch4.latest) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-header"><span class="dc-icon">💨</span><span class="dc-title">Methane (CH₄)</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Current</span><span class="dc-value warn">${ch4.latest} ppb</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Pre-industrial</span><span class="dc-value">~722 ppb</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Increase</span><span class="dc-value warn">+170%</span></div>`;
    html += `</div>`;
  }

  html += `<p style="margin-top:8px;font-size:10px;color:var(--text3)">Data: NOAA GML, Carbonmark API · Updated ${new Date().toLocaleDateString()}</p>`;
  return html;
}

function generateLiveCO2() {
  const d = getLiveData();
  const co2 = d.co2 || {};
  if (!co2.latest) return KB.live_co2();

  let html = `<p>Right now, the atmosphere contains <strong style="color:var(--warn)">${co2.latest} ppm</strong> of CO₂.</p>`;
  if (co2.latestDate) html += `<p style="margin-top:4px;font-size:11px;color:var(--text3)">Latest reading: ${co2.latestDate} (NOAA Mauna Loa)</p>`;
  if (co2.yearlyChange) html += `<p style="margin-top:4px">That's <strong>+${co2.yearlyChange} ppm</strong> compared to the same month last year.</p>`;

  if (co2.keeling12 && co2.keeling12.length > 1) {
    html += `<div style="margin-top:10px">${GAIA_CHARTS.sparklineHTML(co2.keeling12, 240, 60, { color: '#c45c4a', showLabels: true })}</div>`;
    html += `<div style="font-size:9px;color:var(--text3);margin-top:4px">CO₂ concentration — last 12 months</div>`;
  }

  if (co2.yearlyTrend && co2.yearlyTrend.length > 1) {
    const barData = co2.yearlyTrend.map(y => ({ label: y.year.toString(), value: y.avg, color: '#c45c4a' }));
    html += `<div style="margin-top:12px">${GAIA_CHARTS.barChartHTML(barData, 240, 70)}</div>`;
    html += `<div style="font-size:9px;color:var(--text3);margin-top:4px">Annual average CO₂ by year</div>`;
  }

  html += `<p style="margin-top:8px;font-size:10px;color:var(--text3)">Source: NOAA GML · gml.noaa.gov/ccgg/trends/</p>`;
  return html;
}

function generateCarbonBudget() {
  const d = getLiveData();
  const budget = d.carbonBudget || {};
  const html = KB.carbonBudget();

  // Append live countdown bars
  if (budget.yearsLeft15 !== undefined) {
    let extra = `<div style="margin-top:12px">`;
    extra += `<div style="margin:6px 0 4px;font-size:10px;color:var(--text3)">1.5°C budget remaining</div>`;
    extra += GAIA_CHARTS.countdownBarHTML(budget.remaining15, 250, 220, { label: `~${budget.yearsLeft15} years at current rate` });
    extra += `<div style="margin:8px 0 4px;font-size:10px;color:var(--text3)">2.0°C budget remaining</div>`;
    extra += GAIA_CHARTS.countdownBarHTML(budget.remaining20, 1200, 220, { label: `~${budget.yearsLeft20} years at current rate` });
    extra += `</div>`;
    return html + extra;
  }
  return html;
}

function generateEmissions() {
  const d = getLiveData();
  const e = d.humanEmissions || {};
  let html = KB.emissions();

  if (e.dailyGt) {
    let extra = `<div style="margin-top:10px"><strong>Right now:</strong> Humanity is emitting approximately <strong style="color:var(--warn)">${e.hourlyGt} Gt CO₂ per hour</strong>. That's ${e.dailyGt} Gt per day. Every day. The bathtub keeps filling.</div>`;
    html += extra;
  }
  return html;
}

function generateCarbonMarket() {
  const d = getLiveData();
  const m = d.carbonMarket || {};

  let html = `<p>Carbon credit market — live from Carbonmark (on-chain, 5 registries):</p>`;

  if (m.avgPrice) {
    html += `<div class="data-card" style="margin-top:8px">`;
    html += `<div class="dc-row"><span class="dc-label">Avg price</span><span class="dc-value">$${m.avgPrice}/tCO₂</span></div>`;
    html += `<div class="dc-row"><span class="dc-label">Active listings</span><span class="dc-value">${m.listingCount}</span></div>`;
    if (m.recentRetirements) html += `<div class="dc-row"><span class="dc-label">Recent retirements</span><span class="dc-value leaf">${m.recentRetirements.toLocaleString()} tCO₂</span></div>`;

    // Registry breakdown as mini bar chart
    if (m.registryCounts) {
      const regData = Object.entries(m.registryCounts).map(([k, v]) => ({ label: k, value: v, color: '#4ecdc4' }));
      html += `<div style="margin-top:8px">${GAIA_CHARTS.barChartHTML(regData, 200, 60)}</div>`;
      html += `<div style="font-size:9px;color:var(--text3);margin-top:2px">Listings by registry</div>`;
    }
    html += `</div>`;
  } else {
    html += `<p style="margin-top:6px;font-size:11px;color:var(--text3)">Market data temporarily unavailable. Carbonmark API may be rate-limited.</p>`;
  }

  html += `<p style="margin-top:8px"><strong>Context:</strong> Voluntary market: $2-15/tCO₂ for nature-based. $50-300+ for high-integrity removal. EU ETS compliance: ~€65-85/tCO₂.</p>`;
  html += `<p style="margin-top:6px;font-size:10px;color:var(--text3)">Source: Carbonmark API · api.carbonmark.com</p>`;
  return html;
}
// ═══════════════════════════════════════════════════════════════

let isFirstMessage=true;
let isProcessing=false;

// ── XSS Protection — sanitize user input before rendering ──
function _escapeHtml(str){
  const div=document.createElement('div');
  div.textContent=str;
  return div.innerHTML;
}

function addMessage(role,content,meta){
  if (typeof content === 'object') {
    content = JSON.stringify(content, null, 2);
  }
  const msgs=document.getElementById('messages');
  if(isFirstMessage){document.getElementById('welcome').classList.add('hidden');msgs.style.display='flex';isFirstMessage=false;}
  const div=document.createElement('div');div.className=`msg ${role}`;
  const avatar=role==='gaia'?'<div class="msg-avatar">🌍</div>':'<div class="msg-avatar">👤</div>';
  const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  div.innerHTML=`${avatar}<div class="msg-content"><div class="msg-bubble">${role==='user'?_escapeHtml(content):content}</div><div class="msg-meta">${_escapeHtml(meta||time)}</div></div>`;
  msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
  // Render any chart canvases that were just added
  GAIA_CHARTS.renderPending();
}

function addToolCall(name,icon){
  const msgs=document.getElementById('messages');const id='tool-'+Date.now();
  const div=document.createElement('div');div.className='msg gaia';
  div.innerHTML=`<div class="msg-avatar">🌍</div><div class="msg-content"><div class="tool-call" id="${id}"><span>${icon}</span><span style="flex:1">${name}</span><span class="tool-status">...</span></div></div>`;
  msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;return id;
}

function completeToolCall(id,success){
  const el=document.getElementById(id);if(el){el.classList.add('done');el.querySelector('.tool-status').textContent=success?'✓ done':'✗ error';}
}

function showTyping(){
  const msgs=document.getElementById('messages');const div=document.createElement('div');div.className='msg gaia';div.id='typing-indicator';
  div.innerHTML='<div class="msg-avatar">🌍</div><div class="msg-content"><div class="typing"><span></span><span></span><span></span></div></div>';
  msgs.appendChild(div);msgs.scrollTop=msgs.scrollHeight;
}

function hideTyping(){const el=document.getElementById('typing-indicator');if(el)el.remove();}

function sendMessage(){
  const input=document.getElementById('chat-input');const text=input.value.trim();
  if(!text||isProcessing)return;
  addMessage('user',text);input.value='';autoResize(input);processQuery(text);
}

function askGaia(text){if(isProcessing)return;addMessage('user',text);processQuery(text);}

function processQuery(text){
  isProcessing=true;document.getElementById('send-btn').disabled=true;
  const intent=matchIntent(text);
  let toolId;
  if(intent.type==='calculator')toolId=addToolCall('Running carbon calculation...','🧮');
  else if(intent.type==='project')toolId=addToolCall('Querying project database...','🔍');
  else if(intent.type==='knowledge')toolId=addToolCall('Searching knowledge base...','📚');
  showTyping();

  // Check if we have an API key for LLM mode
  const hasApiKey = typeof GaiaKeyGate !== 'undefined' && GaiaKeyGate.hasKey();
  console.log('[GAIA] hasApiKey:', hasApiKey, 'GaiaKeyGate:', typeof GaiaKeyGate);

  if (hasApiKey) {
    // LLM mode: call OpenRouter with knowledge context
    _addToHistory('user', text);
    const llmDelay = 600 + Math.random() * 800;
    setTimeout(async () => {
      hideTyping();
      if (toolId) completeToolCall(toolId, true);
      const llmResponse = await _callOpenRouter(text);
      if (llmResponse) {
        _addToHistory('assistant', llmResponse);
        addMessage('gaia', llmResponse, '🧠 GAIA · LLM');
      } else {
        // Fallback to pattern matching on API failure
        const response = generateResponse(intent);
        const meta = intent.type === 'calculator' ? '🧮 Carbon Engine' : intent.type === 'project' ? '🔍 Project DB' : intent.type === 'knowledge' ? '📚 Knowledge Base' : '';
        addMessage('gaia', response, meta + ' (fallback)');
      }
      isProcessing = false;
      document.getElementById('send-btn').disabled = false;
    }, llmDelay);
  } else {
    // Pattern-matching mode (no API key)
    console.log('[GAIA] Using pattern matching, no API key found');
    const delay = 400 + Math.random() * 600;
    setTimeout(() => {
      hideTyping(); if (toolId) completeToolCall(toolId, true);
      const response = generateResponse(intent);
      const meta = intent.type === 'calculator' ? '🧮 Carbon Engine' : intent.type === 'project' ? '🔍 Project DB' : intent.type === 'knowledge' ? '📚 Knowledge Base' : '';
      addMessage('gaia', response, meta);
      isProcessing = false; document.getElementById('send-btn').disabled = false;
    }, delay);
  }
}

function handleKeyDown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}
function autoResize(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,90)+'px';}

// ═══════════════════════════════════════════════════════════════
// SANDBOX
// ═══════════════════════════════════════════════════════════════

function runSandboxCalc(){
  const from=document.getElementById('qb-from').value;const to=document.getElementById('qb-to').value;
  const ha=parseInt(document.getElementById('qb-area').value)||100;const yrs=parseInt(document.getElementById('qb-years').value)||30;
  const r=transitionCarbon(from,to,ha,yrs);if(!r)return;
  const ctx=scaleContext(r.cumulative_co2);const pos=r.cumulative_co2>0;
  const tB=_biomes[to];const fB=_biomes[from];
  document.getElementById('sandbox-result').classList.add('show');
  document.getElementById('sr-val').textContent=(pos?'+':'')+fmt(Math.abs(r.cumulative_co2))+' t CO₂';
  document.getElementById('sr-val').style.color=pos?'var(--leaf)':'var(--warn)';
  document.getElementById('sr-label').textContent=`${pos?'sequestered':'released'} over ${yrs} years · ${ha} ha`;
  document.getElementById('sr-detail').textContent=`${fB.icon} ${fB.name} → ${tB.icon} ${tB.name}
${ctx.summary}
${(ctx.fraction*100).toExponential(2)}% of global annual net emissions`;
}

function lookupProject(){
  const id=document.getElementById('qb-site').value;const site=_sites.find(s=>s.id===id);if(!site)return;
  const biome=_biomes[site.currentBiome];const stock=biome.density*site.area*3.67;
  const latest=site.ndvi[site.ndvi.length-1];
  const cF=site.climate[0],cL=site.climate[site.climate.length-1];
  const tD=(cL.temp-cF.temp).toFixed(1);const pD=((cL.precip-cF.precip)/cF.precip*100).toFixed(0);
  document.getElementById('project-result').classList.add('show');
  document.getElementById('project-result').innerHTML=`<div style="font-size:12px;color:var(--text);font-weight:500;margin-bottom:6px">${site.name}</div><div class="r-label">${site.subtitle}</div><div style="margin-top:6px;font-size:9px;line-height:1.6;color:var(--text2)"><div>Area: <strong>${site.area.toLocaleString()} ha</strong></div><div>Current: <strong>${biome.name}</strong> (${biome.density} tC/ha)</div><div>Carbon stock: <strong>${fmt(stock)} t CO₂</strong></div><div>NDVI (${latest.year}): <strong>${latest.value.toFixed(2)}</strong> — ${latest.label}</div><div>Temp: <strong>${cL.temp.toFixed(1)}°C</strong> <span style="color:var(--warn)">+${tD}°C since ${cF.year}</span></div><div>Rain: <strong>${cL.precip} mm</strong> <span style="color:var(--warn)">${pD}% since ${cF.year}</span></div></div>`;
}

// ═══════════════════════════════════════════════════════════════
// UI TOGGLES
// ═══════════════════════════════════════════════════════════════

function toggleSidebar(){document.getElementById('sidebar').classList.toggle('collapsed');}
function toggleSandbox(){document.getElementById('right-panel').classList.toggle('collapsed');}

function showDemoBanner(){document.getElementById('demo-banner').classList.add('show');setTimeout(()=>{document.getElementById('demo-banner').classList.remove('show');},5000);}

// ═══════════════════════════════════════════════════════════════
// DEMO MODE
// ═══════════════════════════════════════════════════════════════

let demoMode=false;let demoStep=0;
const DEMO_SCRIPT=[
  {text:'Tell me about all your restoration projects'},
  {text:'What is the current CO2 level?'},
  {text:'Calculate: restore 500 hectares of mangrove in Benin'},
  {text:"What are climate tipping points?"},
];

function startDemoMode(){
  if(demoMode)return;demoMode=true;demoStep=0;
  document.getElementById('demo-banner').classList.add('show');
  document.getElementById('demo-banner').innerHTML=`<span class="demo-badge">LIVE DEMO</span> GAIA is running an automated demo <button class="demo-close" onclick="stopDemoMode()">✕</button>`;
  runDemoStep();
}

function runDemoStep(){
  if(!demoMode||demoStep>=DEMO_SCRIPT.length){stopDemoMode();return;}
  const step=DEMO_SCRIPT[demoStep];addMessage('user',step.text);
  const intent=matchIntent(step.text);
  let toolId;if(intent.type==='calculator')toolId=addToolCall('Running carbon calculation...','🧮');
  else if(intent.type==='project')toolId=addToolCall('Querying project database...','🔍');
  else if(intent.type==='knowledge')toolId=addToolCall('Searching knowledge base...','📚');
  showTyping();
  const delay=700+Math.random()*400;
  setTimeout(()=>{
    hideTyping();if(toolId)completeToolCall(toolId,true);
    const response=generateResponse(intent);
    const meta=intent.type==='calculator'?'🧮 Carbon Engine':intent.type==='project'?'🔍 Project DB':intent.type==='knowledge'?'📚 Knowledge Base':'';
    addMessage('gaia',response,meta);demoStep++;
    if(demoStep<DEMO_SCRIPT.length){setTimeout(runDemoStep,2500);}
    else{setTimeout(()=>{addMessage('gaia',"👆 That's a demo of what I can do. Try asking me anything — about our projects, carbon science, or how you can get involved.",'🌍 GAIA');stopDemoMode();},2000);}
  },delay);
}

function stopDemoMode(){demoMode=false;document.getElementById('demo-banner').classList.remove('show');}

// ═══════════════════════════════════════════════════════════════
// GLOBE BACKGROUND
// ═══════════════════════════════════════════════════════════════

function initGlobe(){
  const el=document.getElementById('gaia-globe-bg');if(typeof Globe==='undefined')return;
  const world=new Globe(el,{animateIn:false,waitForGlobeReady:true})
    .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg')
    .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png')
    .showAtmosphere(true).atmosphereColor('#4ecdc4').atmosphereAltitude(0.18)
    .pointsData(_sites).pointLat('lat').pointLng('lng').pointAltitude(0.01).pointRadius(0.25).pointColor(()=>'#4ecdc4').pointResolution(8)
    .ringsData(_sites).ringLat('lat').ringLng('lng').ringColor(()=>t=>`rgba(78,205,196,${0.5-t*0.4})`).ringMaxRadius(2).ringPropagationSpeed(1).ringRepeatPeriod(2000);
  world.pointOfView({lat:20,lng:40,altitude:2.5});
  world.controls().autoRotate=true;world.controls().autoRotateSpeed=0.3;
}

// ═══════════════════════════════════════════════════════════════
// INIT — Live data boot + welcome back
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  initGlobe();
  document.getElementById('chat-input').focus();
  setTimeout(showDemoBanner, 2000);

  // ── Initialize DIS integration ──
  if (typeof GaiaIntegration !== 'undefined') {
    GaiaIntegration.init();
  }

  // ── Session tracking ──
  const sess = GAIA_DATA.getSessionInfo();
  const now = Date.now();
  if (!sess.firstVisit) {
    GAIA_DATA.saveSessionInfo({ visitCount: 1, firstVisit: now, totalTimeSeconds: 0 });
  } else {
    GAIA_DATA.saveSessionInfo({ ...sess, visitCount: sess.visitCount + 1 });
  }

  // ── Fetch live data in background ──
  const liveData = await GAIA_DATA.refreshAll();
  GAIA_DATA.saveSnapshot(liveData);
  if (liveData.co2.latest) {
    GAIA_DATA.saveVisitInfo(liveData.co2.latest);
  }

  // ── Welcome back message ──
  const welcomeBack = GAIA_DATA.getWelcomeBackInfo();
  if (welcomeBack && welcomeBack.daysSince > 0) {
    const days = welcomeBack.daysSince;
    const co2Now = (liveData && liveData.co2 && liveData.co2.latest) ? liveData.co2.latest : (welcomeBack.co2Then ? (welcomeBack.co2Then + 2.7 * (days / 365)) : 431.12);
    const co2Then = welcomeBack.co2Then;
    const co2Diff = co2Then ? +(co2Now - co2Then).toFixed(2) : null;

    let welcomeMsg = '';
    if (days === 1) welcomeMsg = 'Welcome back. One day. ';
    else if (days < 7) welcomeMsg = `Welcome back. ${days} days. `;
    else if (days < 30) welcomeMsg = `Welcome back. ${Math.floor(days / 7)} weeks. `;
    else welcomeMsg = `Welcome back. ${Math.floor(days / 30)} months. `;

    if (co2Diff && co2Diff > 0) {
      welcomeMsg += `CO₂ went from ${co2Then.toFixed(1)} to ${co2Now.toFixed(1)} ppm. +${co2Diff} ppm in ${days} day${days > 1 ? 's' : ''}. That's not a pause. That's accumulation.`;
    } else {
      welcomeMsg += `CO₂ is at ${co2Now} ppm. Still rising.`;
    }

    // Show welcome back as a system message
    addMessage('gaia', welcomeMsg, '🌍 GAIA');
  }

  // ── Update sidebar live stats ──
  updateSidebarStats(liveData);
});

function updateSidebarStats(data) {
  // Update the Global Context panel in the sandbox
  const container = document.getElementById('sandbox-content');
  if (!container || !data.co2.latest) return;

  // Find and update the quick-stat values
  const stats = container.querySelectorAll('.quick-stat .qs-value');
  if (stats.length >= 5) {
    if (data.co2.latest) stats[0].textContent = `${data.co2.latest} ppm`;
    if (data.co2.yearlyChange) stats[0].textContent += ` (+${data.co2.yearlyChange}/yr)`;
    stats[1].textContent = `~${data.humanEmissions.annualGt} Gt CO₂/yr`;
    stats[2].textContent = `~${data.humanEmissions.natureAbsorptionGt} Gt CO₂/yr`;
    stats[3].textContent = `~${data.humanEmissions.netExcessGt} Gt CO₂/yr`;
    if (data.carbonBudget.yearsLeft15 !== undefined) {
      stats[5].textContent = `~${data.carbonBudget.yearsLeft15} years`;
    }
  }
}

window.__gaia = { startDemo: startDemoMode, stopDemo: stopDemoMode, KB, _sites, _biomes, transitionCarbon, data: GAIA_DATA, charts: GAIA_CHARTS };

// ═══════════════════════════════════════════════════════════════
// VOICE TOGGLE
// ═══════════════════════════════════════════════════════════════

let _voiceEnabled = false;
let _voiceInitialized = false;

function toggleVoice() {
  _voiceEnabled = !_voiceEnabled;
  const btn = document.getElementById('voice-toggle-btn');
  if (!btn) return;

  if (_voiceEnabled) {
    btn.textContent = '🔊 Voice';
    btn.style.borderColor = 'rgba(78,205,196,.3)';
    btn.style.color = 'var(--teal)';
    btn.title = 'Voice enabled — click to mute';

    // Initialize audio context on user gesture
    if (typeof GaiaVoice !== 'undefined' && !_voiceInitialized) {
      GaiaVoice.init();
      _voiceInitialized = true;
    }
    if (typeof GaiaVoice !== 'undefined') {
      GaiaVoice.setEnabled(true);
    }
  } else {
    btn.textContent = '🔇 Voice';
    btn.style.borderColor = 'rgba(255,255,255,.08)';
    btn.style.color = 'var(--text2)';
    btn.title = 'Voice muted — click to enable';
    if (typeof GaiaVoice !== 'undefined') {
      GaiaVoice.setEnabled(false);
      GaiaVoice.stop();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT SCORE DISPLAY
// ═══════════════════════════════════════════════════════════════

window.TIER_ICONS = {
window.TIER_NAMES = {

function updateEngagementDisplay() {
  if (typeof GaiaState === 'undefined') return;
  const score = GaiaState.getScore();
  const tier = score.tier || 'COLD';

  const icon = document.getElementById('engagement-icon');
  const scoreEl = document.getElementById('engagement-score');
  const tierEl = document.getElementById('engagement-tier');

  if (icon) icon.textContent = TIER_ICONS[tier] || '🌱';
  if (scoreEl) scoreEl.textContent = score.score || 0;
  if (tierEl) {
    tierEl.textContent = TIER_NAMES[tier] || 'SEED';
  }
}

// Hook into state machine's onSpeak to update display
if (typeof GaiaState !== 'undefined') {
  const _origOnSpeak = GaiaState.registerCallbacks;
  // Already registered by integration — just add our update
  const _checkInterval = setInterval(updateEngagementDisplay, 2000);
}

// ═══════════════════════════════════════════════════════════════
// QUEST PANEL
// ═══════════════════════════════════════════════════════════════

function updateQuestPanel() {
  if (typeof GaiaQuests === 'undefined') return;
  const quests = GaiaQuests.getAllQuests();
  const active = quests.filter(q => q.status !== 'completed');
  const completed = quests.filter(q => q.status === 'completed');

  const panel = document.getElementById('quest-panel');
  const list = document.getElementById('quest-list');
  if (!panel || !list) return;

  if (active.length === 0 && completed.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  list.innerHTML = '';

  // Show active quests (max 5)
  active.slice(0, 5).forEach(q => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:5px 7px;background:rgba(255,255,255,.02);border-radius:4px;font-size:9px;cursor:pointer;';
    div.innerHTML = `<span style="margin-right:4px;">${q.icon || '🌱'}</span><span style="color:var(--text2)">${q.title}</span>`;
    div.title = q.description;
    list.appendChild(div);
  });

  // Show completed count
  if (completed.length > 0) {
    const div = document.createElement('div');
    div.style.cssText = 'padding:3px 7px;font-size:8px;color:var(--text3);text-align:center;';
    div.textContent = `✓ ${completed.length} completed`;
    list.appendChild(div);
  }
}

// Update quest panel periodically
setInterval(updateQuestPanel, 3000);
// Also update on any user interaction
document.addEventListener('click', () => setTimeout(updateQuestPanel, 500));

// ═══════════════════════════════════════════════════════════════
// JOURNAL TOGGLE (click engagement badge)
// ═══════════════════════════════════════════════════════════════

function toggleJournal() {
  const journal = document.getElementById('gaia-journal');
  if (!journal) return;
  const isVisible = journal.style.display !== 'none';
  journal.style.display = isVisible ? 'none' : 'block';
  if (!isVisible && typeof GaiaQuests !== 'undefined') {
    updateQuestPanel();
  }
}



/* ══ js/gaia-legacy/gaia-knowledge.js ══ */
/**
 * GAIA KNOWLEDGE ENGINE v1.0
 * Client-side RAG system powered by the Earth Love United Climate Knowledge dataset.
 * 
 * Architecture:
 *   1. Loads dataset from Hugging Face (pre-embedded chunks)
 *   2. Uses cosine similarity for retrieval (pure JS, no server needed)
 *   3. Integrates with GAIA's tool system as `search_knowledge` tool
 *   4. Injects relevant context into LLM conversations
 * 
 * Dataset: ego0op/earth-love-united-climate-knowledge (7,260 chunks)
 */

const GaiaKnowledge = (() => {

  // ─── STATE ───
  let _chunks = [];           // Loaded knowledge chunks
  let _vocab = null;          // TF-IDF vocabulary
  let _loaded = false;
  let _loading = false;

  // ─── CONFIG ───
  const DATASET_URL = 'data/climate-knowledge-curated.jsonl';
  const TOP_K = 5;            // Number of chunks to retrieve
  const MIN_SCORE = 0.15;     // Minimum similarity threshold (lower for TF-IDF)

  // ─── SIMPLE EMBEDDING (TF-IDF-like, no model needed) ───
  // For production, use a proper embedding model. For now, we use
  // a keyword-based approach that works surprisingly well for domain-specific retrieval.

  function _tokenize(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  function _buildVocabulary(chunks) {
    const vocab = new Map();
    let idx = 0;
    for (const chunk of chunks) {
      const tokens = _tokenize(chunk.text);
      for (const token of tokens) {
        if (!vocab.has(token)) {
          vocab.set(token, idx++);
        }
      }
    }
    return vocab;
  }

  function _textToVector(text, vocab) {
    const vec = new Float32Array(vocab.size);
    const tokens = _tokenize(text);
    // TF-IDF weighting
    const tf = new Map();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }
    for (const [token, count] of tf) {
      const idx = vocab.get(token);
      if (idx !== undefined) {
        // Simple TF weighting
        vec[idx] = count / tokens.length;
      }
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    }
    return vec;
  }

  function _cosineSim(a, b) {
    let dot = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) dot += a[i] * b[i];
    return dot; // Already normalized
  }

  // ─── PUBLIC API ───

  async function init() {
    if (_loaded || _loading) return;
    _loading = true;

    console.log('[GaiaKnowledge] Loading climate knowledge dataset...');

    try {
      // Load chunks from local dataset
      const response = await fetch(DATASET_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      _chunks = text.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      console.log(`[GaiaKnowledge] Loaded ${_chunks.length} chunks`);

      // Build vocabulary and vectors
      console.log('[GaiaKnowledge] Building search index...');
      const vocab = _buildVocabulary(_chunks);
      console.log(`[GaiaKnowledge] Vocabulary size: ${vocab.size}`);

      // Store vectors as array of Float32Arrays
      _chunks = _chunks.map(chunk => ({
        ...chunk,
        _vector: _textToVector(chunk.text, vocab)
      }));
      _vocab = vocab;
      _loaded = true;

      console.log('[GaiaKnowledge] ✅ Knowledge engine ready');
      console.log(`[GaiaKnowledge] Sources: ${[...new Set(_chunks.map(c => c.source))].join(', ')}`);

    } catch (err) {
      console.error('[GaiaKnowledge] Failed to load:', err);
      // Fallback: use keyword matching only
      _loaded = true;
    }

    _loading = false;
  }

  function search(query, options = {}) {
    if (!_loaded || _chunks.length === 0) return [];

    const topK = options.topK || TOP_K;
    const minScore = options.minScore || MIN_SCORE;
    const sourceFilter = options.source || null;

    let queryVec = null;
    if (_vocab) {
      queryVec = _textToVector(query, _vocab);
    }

    const results = [];
    for (const chunk of _chunks) {
      if (sourceFilter && chunk.source !== sourceFilter) continue;

      let score = 0;
      if (queryVec && chunk._vector) {
        score = _cosineSim(queryVec, chunk._vector);
      } else {
        // Fallback: keyword overlap
        const queryTokens = new Set(_tokenize(query));
        const chunkTokens = new Set(_tokenize(chunk.text));
        let overlap = 0;
        for (const t of queryTokens) {
          if (chunkTokens.has(t)) overlap++;
        }
        score = overlap / Math.sqrt(queryTokens.size * chunkTokens.size);
      }

      if (score >= minScore) {
        results.push({ ...chunk, _score: score });
      }
    }

    results.sort((a, b) => b._score - a._score);
    return results.slice(0, topK);
  }

  function getContext(query, maxChars = 2000) {
    const results = search(query);
    if (results.length === 0) return '';

    let context = '';
    for (const r of results) {
      const chunk = `[${r.source}] ${r.title}: ${r.text}`;
      if (context.length + chunk.length > maxChars) break;
      context += chunk + '\n\n';
    }
    return context.trim();
  }

  function getStats() {
    if (!_loaded) return { loaded: false };
    const sources = {};
    for (const c of _chunks) {
      sources[c.source] = (sources[c.source] || 0) + 1;
    }
    return {
      loaded: true,
      totalChunks: _chunks.length,
      sources,
      vocabSize: _vocab ? _vocab.size : 0,
    };
  }

  // ─── TOOL DEFINITION (for GAIA's LLM) ───
  window.SEARCH_KNOWLEDGE_TOOL = {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Search the climate knowledge base for authoritative information about carbon, climate change, solutions, impacts, and science. Use this when the user asks factual questions about climate.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — be specific and include key terms' },
          top_k: { type: 'integer', description: 'Number of results to return (default 5)' },
        },
        required: ['query']
      }
    }
  };

  // ─── TOOL EXECUTION ───
  function executeTool(toolName, args) {
    if (toolName === 'search_knowledge') {
      const results = search(args.query, { topK: args.top_k || 5 });
      return {
        query: args.query,
        results: results.map(r => ({
          source: r.source,
          title: r.title,
          text: r.text.substring(0, 500),
          score: r._score,
          url: r.url,
        })),
        context: getContext(args.query, 2000),
      };
    }
    return null;
  }

  return {
    init,
    search,
    getContext,
    getStats,
    executeTool,
    get SEARCH_KNOWLEDGE_TOOL() { return SEARCH_KNOWLEDGE_TOOL; },
    get isLoaded() { return _loaded; },
    get chunkCount() { return _chunks.length; },
  };
})();


/* ══ js/gaia-legacy/gaia-dom-adapter.js ══ */
// ═══════════════════════════════════════════════════════
// GAIA DOM ADAPTER v1.1
// Bridges the DIS system (dis/) into gaia.html
// without modifying any existing IDs or inline JavaScript.
//
// v1.1 changes: All bridged events now also call
// GaiaState.handleEvent() directly so the DIS state
// machine advances as the user interacts with gaia.html.
// ═══════════════════════════════════════════════════════

window.GaiaDOMAdapter = (() => {

  // ─── CONFIG ───
  window.CONFIG = {
    DEBUG: false
  };

  // ─── STATE ───
  let _initialized = false;

  // ═══════════════════════════════════════
  // HELPPER: check if state machine is loaded
  // ═══════════════════════════════════════

  function _gaiaStateReady() {
    return typeof window.GaiaState !== 'undefined' && typeof window.GaiaState.handleEvent === 'function';
  }

  // ═══════════════════════════════════════
  // HELPER: dispatch to state machine
  // Calls GaiaState.handleEvent(type, payload) if available.
  // ═══════════════════════════════════════

  function _sm(eventType, payload) {
    if (_gaiaStateReady()) {
      try {
        window.GaiaState.handleEvent(eventType, payload);
      } catch (err) {
        warn('[GaiaDOMAdapter] GaiaState.handleEvent error:', err);
      }
    }
  }

  // ═══════════════════════════════════════
  // SITE ID RESOLVER
  // Maps a query string to a site ID.
  // ═══════════════════════════════════════

  function _resolveSiteId(text) {
    const lower = (text || '').toLowerCase();
    if (/sri lanka/.test(lower)) return 'sri_lanka';
    if (/antalya|cop31|wildfire/.test(lower)) return 'antalya';
    if (/benin|jean/.test(lower)) return 'benin';
    if (/borneo|peat/.test(lower)) return 'borneo';
    return null;
  }

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════

  function init() {
    if (_initialized) return;
    log('[GaiaDOMAdapter] Initializing...');

    _injectGaiaMind();
    _createMissingElements();
    _createIdAliases();
    _injectKeyButton();
    _injectChatAvatar();
    _injectCSSOverrides();
    _bridgeEvents();
    _installInlineInterceptors();

    _initialized = true;
    log('[GaiaDOMAdapter] Initialized.');

    // Defer activation to let gaia-client.js auto-init run first,
    // then verify the state machine is fully wired up.
    _activateStateMachine();
  }

  // ═══════════════════════════════════════
  // INJECT GAIA-MIND.JS
  // The state machine's _pickLine() calls GaiaMind.selectLine(),
  // but gaia.html doesn't load gaia-mind.js. We inject it here
  // so it's available before the state machine first runs.
  // ═══════════════════════════════════════

  function _injectGaiaMind() {
    if (typeof window.GaiaMind !== 'undefined') return; // already loaded
    const existing = document.querySelector('script[src*="gaia-mind"]');
    if (existing) return; // script tag already in DOM

    const script = document.createElement('script');
    script.src = 'dis/gaia-mind.js';
    // Insert BEFORE gaia-state-machine.js so it's parsed first
    const smScript = document.querySelector('script[src*="gaia-state-machine"]');
    if (smScript && smScript.parentNode) {
      smScript.parentNode.insertBefore(script, smScript);
    } else {
      // Fallback: append to head
      document.head.appendChild(script);
    }
    log('[GaiaDOMAdapter] Injected gaia-mind.js');
  }

  // ═══════════════════════════════════════
  // ACTIVATE STATE MACHINE
  // Ensures callbacks are registered, voice library is loaded,
  // tick loop is started, and the initial greeting fires —
  // with onSpeak connected to gaia.html's addMessage().
  // ═══════════════════════════════════════

  function _activateStateMachine() {
    // Wait for gaia-client.js auto-init to finish (it also hooks DOMContentLoaded).
    // We run after a short delay so all DIS scripts have had their init() called.
    const tryActivate = () => {
      if (!_gaiaStateReady()) {
        log('[GaiaDOMAdapter] State machine not ready, retrying in 200ms...');
        setTimeout(tryActivate, 200);
        return;
      }

      // GaiaMind must be available for _pickLine() to work.
      // It's injected dynamically by _injectGaiaMind() but may still be loading.
      if (typeof window.GaiaMind === 'undefined') {
        log('[GaiaDOMAdapter] GaiaMind not ready, retrying in 200ms...');
        setTimeout(tryActivate, 200);
        return;
      }

      // Check if GaiaClient already registered the onSpeak callback
      // (gaia-client.js does this in its init()).
      const score = GaiaState.getScore();
      log('[GaiaDOMAdapter] State machine ready. Score:', score.score, 'Tier:', score.tier);

      // Register our own onSpeak that renders to gaia.html's chat UI.
      // We wrap any existing callback so both TTS and chat rendering work.
      GaiaState.registerCallbacks({
        onSpeak: _onGaiaSpeak,
        onReact: _onGaiaReact,
        onStateChange: _onStateChange,
        onMoodChange: _onMoodChange,
        onQuestTrigger: _onQuestTrigger,
        onJournalAdd: _onJournalAdd,
        onOverlayShow: _onOverlayShow,
        onGlobeFly: _onGlobeFly,
      });

      // Ensure voice library is loaded (GaiaClient does this, but be safe)
      if (typeof window.GaiaVoiceLibrary !== 'undefined') {
        GaiaState.setVoiceLibrary(window.GaiaVoiceLibrary);
        log('[GaiaDOMAdapter] Voice library set:', Object.keys(window.GaiaVoiceLibrary).length, 'pools');
      } else {
        warn('[GaiaDOMAdapter] GaiaVoiceLibrary not found — gaia-voice-data.js may not be loaded yet');
      }

      // Start the tick loop (handles idle nudges, time-based scoring)
      GaiaState.start();
      log('[GaiaDOMAdapter] Tick loop started');

      // Trigger the initial greeting if state is still GREETING (first visit)
      const st = GaiaState.getState();
      if (st.state === 'GREETING') {
        GaiaState.handleEvent('session_start');
        log('[GaiaDOMAdapter] Greeting triggered');
      }
    };

    // Start activation attempt after letting gaia-client.js init run first
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(tryActivate, 150));
    } else {
      setTimeout(tryActivate, 150);
    }
  }

  // ═══════════════════════════════════════
  // CALLBACK HANDLERS — bridge DIS → gaia.html UI
  // ═══════════════════════════════════════

  function _onGaiaSpeak(text, emotion) {
    log('[GaiaDOMAdapter] GAIA speaks:', text.substring(0, 60) + '...', 'emotion:', emotion);
    if (typeof window.addMessage === 'function') {
      // Use gaia.html's native addMessage to render in #messages
      // Add emotion tag as meta so styling can reflect mood
      const emotionStr = typeof emotion === 'string' ? emotion : (emotion?.emotion || '');
      const meta = emotionStr ? `🌍 ${emotionStr}` : undefined;
      window.addMessage('gaia', text, meta);
    } else {
      warn('[GaiaDOMAdapter] addMessage() not available — gaia.html inline script may not have loaded');
    }
  }

  function _onGaiaReact(emotion, intensity) {
    log('[GaiaDOMAdapter] GAIA reacts:', emotion, 'intensity:', intensity);
    // Visual feedback via the avatar element injected by the adapter
    const avatar = document.getElementById('gaia-avatar');
    if (avatar) {
      avatar.style.opacity = '1';
      avatar.setAttribute('data-emotion', emotion || '');
      // Pulse animation
      avatar.style.transition = 'transform 0.3s, opacity 0.3s';
      avatar.style.transform = 'scale(1.2)';
      setTimeout(() => { avatar.style.transform = 'scale(1)'; }, 300);
    }
  }

  function _onStateChange(oldState, newState) {
    log('[GaiaDOMAdapter] State:', oldState, '→', newState);
  }

  function _onMoodChange(oldMood, newMood) {
    log('[GaiaDOMAdapter] Mood:', oldMood, '→', newMood);
  }

  function _onQuestTrigger(questId, status) {
    log('[GaiaDOMAdapter] Quest:', questId, status);
  }

  function _onJournalAdd(entry) {
    log('[GaiaDOMAdapter] Journal entry:', entry);
    // Add to the journal panel if it exists
    const journal = document.getElementById('gaia-journal');
    if (journal) {
      const journalEntries = journal.querySelector('.journal-entries') || journal;
      const div = document.createElement('div');
      div.className = 'journal-entry';
      div.textContent = entry;
      journalEntries.prepend(div);
      // Show journal when it has entries
      journal.style.display = 'block';
    }
  }

  function _onOverlayShow(type, data) {
    log('[GaiaDOMAdapter] Overlay show:', type);
    const overlay = document.getElementById('gaia-overlay');
    if (overlay) {
      overlay.classList.add('open');
      const content = document.getElementById('gaia-overlay-content');
      if (content && data && data.title) {
        content.innerHTML = `<h2 style="font-family:'Cormorant Garamond',serif;color:#7be8d0;margin-bottom:12px;">${data.title}</h2>`;
        if (data.body) {
          content.innerHTML += `<p style="color:#9a9590;font-size:13px;line-height:1.6;">${data.body}</p>`;
        }
      }
    }
  }

  function _onGlobeFly(lat, lng, alt) {
    log('[GaiaDOMAdapter] Globe fly:', lat, lng, alt);
    // If globe.gl is available, fly to the location
    if (window.world && typeof window.world.pointOfView === 'function') {
      try {
        window.world.pointOfView({ lat, lng, altitude: alt || 1.5 }, 1000);
      } catch (e) {
        warn('[GaiaDOMAdapter] Globe fly failed:', e);
      }
    }
  }
  // Elements that DIS expects but gaia.html doesn't have.
  // ═══════════════════════════════════════

  function _createMissingElements() {
    // --- OVERLAY ---
    if (!document.getElementById('gaia-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'gaia-overlay';
      overlay.innerHTML = '<div id="gaia-overlay-content"></div>';
      overlay.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:1000;background:rgba(3,3,7,0.85);align-items:center;justify-content:center;backdrop-filter:blur(4px);';
      document.body.appendChild(overlay);
    }

    // --- KEY MODAL ---
    if (!document.getElementById('gaia-key-modal')) {
      const modal = document.createElement('div');
      modal.id = 'gaia-key-modal';
      modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:1001;align-items:center;justify-content:center;background:rgba(3,3,7,0.9);backdrop-filter:blur(6px);';
      modal.innerHTML = `
        <div class="key-modal-inner" style="background:#080a10;border:1px solid rgba(78,205,196,.15);border-radius:14px;padding:32px 28px;max-width:420px;width:90%;text-align:center;animation:fadeUp .3s ease-out;">
          <h2 class="key-modal-title" style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#7be8d0;margin-bottom:8px;letter-spacing:1px;"></h2>
          <p class="key-modal-gaia-line" style="font-family:'Outfit',sans-serif;font-size:13px;color:#9a9590;margin-bottom:18px;line-height:1.6;font-style:italic;"></p>
          <form id="gaia-key-form" style="display:flex;flex-direction:column;gap:8px;">
            <input id="gaia-key-input" type="password" placeholder="sk-or-v1-..."
              style="width:100%;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(78,205,196,.15);border-radius:8px;color:#e2dfd8;font-family:'JetBrains Mono',monospace;font-size:12px;outline:none;box-sizing:border-box;"
              onfocus="this.style.borderColor='rgba(78,205,196,.35)'"
              onblur="this.style.borderColor='rgba(78,205,196,.15)'" />
            <button type="submit" class="key-modal-submit" style="width:100%;padding:10px;background:rgba(78,205,196,.1);border:1px solid rgba(78,205,196,.2);border-radius:8px;color:#4ecdc4;font-family:'JetBrains Mono',monospace;font-size:12px;cursor:pointer;transition:all .2s;" onmouseover="this.style.background='rgba(78,205,196,.15)'" onmouseout="this.style.background='rgba(78,205,196,.1)'">Unlock</button>
          </form>
          <div id="gaia-key-error" style="margin-top:8px;font-size:11px;color:#c45c4a;min-height:16px;"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // --- JOURNAL ---
    if (!document.getElementById('gaia-journal')) {
      const journal = document.createElement('div');
      journal.id = 'gaia-journal';
      journal.innerHTML = '<div class="journal-entries"></div>';
      journal.style.cssText = 'position:fixed;bottom:0;left:0;width:240px;max-height:300px;overflow-y:auto;z-index:5;background:rgba(8,10,16,.95);border-top:1px solid rgba(78,205,196,.08);border-right:1px solid rgba(78,205,196,.08);display:none;';
      document.body.appendChild(journal);
    }

    log('[GaiaDOMAdapter] Missing elements created.');
  }

  // ═══════════════════════════════════════
  // 2. CREATE ID ALIASES
  // For elements that exist under different IDs in gaia.html,
  // add hidden proxy containers so DIS getElementById calls work.
  //
  // gaia.html uses #messages; DIS expects #gaia-chat-messages
  // gaia.html uses #chat-input; DIS expects #gaia-chat-input
  // ═══════════════════════════════════════

  function _createIdAliases() {
    // We use a lightweight proxy pattern: override getElementById
    // for the specific DIS-expected IDs to return the
    // gaia.html equivalents. Clean, no hidden DOM elements needed.

    const idMap = {
      'gaia-chat-messages': 'messages',
      'gaia-chat-input': 'chat-input',
    };

    const originalGetElementById = document.getElementById.bind(document);

    document.getElementById = function(id) {
      const mappedId = idMap[id];
      if (mappedId) {
        const el = originalGetElementById(mappedId);
        if (el) return el;
      }
      return originalGetElementById(id);
    };

    // Also handle querySelector for the same IDs
    const originalQuerySelector = document.querySelector.bind(document);

    document.querySelector = function(selector) {
      if (selector === '#gaia-chat-messages') return originalQuerySelector('#messages');
      if (selector === '#gaia-chat-input') return originalQuerySelector('#chat-input');
      return originalQuerySelector(selector);
    };

    log('[GaiaDOMAdapter] ID aliases installed.');
  }

  // ═══════════════════════════════════════
  // 3. INJECT KEY BUTTON
  // Add #gaia-key-btn into #header .header-actions
  // ═══════════════════════════════════════

  function _injectKeyButton() {
    if (document.getElementById('gaia-key-btn')) return;

    const headerActions = document.querySelector('#header .header-actions');
    if (!headerActions) {
      warn('[GaiaDOMAdapter] #header .header-actions not found, deferring key button injection');
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'gaia-key-btn';
    btn.className = 'hdr-btn';
    btn.textContent = '🔓 API Key';
    btn.style.opacity = '0.5';
    btn.style.fontSize = '10px';
    btn.addEventListener('click', () => {
      if (typeof GaiaKeyGate !== 'undefined') {
        GaiaKeyGate.openModal();
      }
    });

    // Insert before the "Site" link
    const siteLink = headerActions.querySelector('a');
    if (siteLink) {
      headerActions.insertBefore(btn, siteLink);
    } else {
      headerActions.appendChild(btn);
    }

    log('[GaiaDOMAdapter] Key button injected.');
  }

  // ═══════════════════════════════════════
  // 4. INJECT CHAT AVATAR
  // Add #gaia-avatar to the chat area for DIS callback use
  // ═══════════════════════════════════════

  function _injectChatAvatar() {
    if (document.getElementById('gaia-avatar')) return;

    const chatArea = document.getElementById('chat-area');
    if (!chatArea) {
      warn('[GaiaDOMAdapter] #chat-area not found, deferring avatar injection');
      return;
    }

    const avatar = document.createElement('div');
    avatar.id = 'gaia-avatar';
    avatar.style.cssText = 'position:absolute;bottom:70px;right:16px;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,rgba(78,205,196,.1),rgba(91,191,114,.07));border:1px solid rgba(78,205,196,.15);display:flex;align-items:center;justify-content:center;font-size:14px;opacity:0;transition:opacity .5s;pointer-events:none;z-index:2;';
    avatar.textContent = '🌍';
    chatArea.appendChild(avatar);

    log('[GaiaDOMAdapter] Chat avatar injected.');
  }

  // ═══════════════════════════════════════
  // 5. CSS OVERRIDES
  // Make DIS-rendered elements use gaia.html's styling
  // ═══════════════════════════════════════

  function _injectCSSOverrides() {
    const style = document.createElement('style');
    style.textContent = `
      /* DIS message elements styled to match gaia.html */
      #gaia-chat-messages { display: flex; flex-direction: column; }

      .msg.gaia .msg-avatar {
        background: linear-gradient(135deg,rgba(78,205,196,.15),rgba(91,191,114,.1)) !important;
        border: 1px solid rgba(78,205,196,.2) !important;
        color: inherit !important;
        font-size: 11px;
      }

      .msg.user .msg-avatar {
        background: rgba(139,127,199,.15) !important;
        border: 1px solid rgba(139,127,199,.25) !important;
      }

      .msg.gaia .msg-bubble {
        background: rgba(255,255,255,.03) !important;
        border: 1px solid rgba(78,205,196,.08) !important;
        border-top-left-radius: 3px !important;
        color: #e2dfd8 !important;
      }

      .msg.user .msg-bubble {
        background: rgba(139,127,199,.1) !important;
        border: 1px solid rgba(139,127,199,.15) !important;
        border-top-right-radius: 3px !important;
      }

      /* Overlay display fix */
      #gaia-overlay.open {
        display: flex !important;
      }

      /* Key modal display fix */
      #gaia-key-modal.open {
        display: flex !important;
      }

      /* Journal entry styling */
      .journal-entry {
        padding: 8px 12px;
        border-bottom: 1px solid rgba(255,255,255,.03);
        font-size: 10px;
        color: #9a9590;
        font-family: "JetBrains Mono", monospace;
      }

      .journal-entry:last-child {
        border-bottom: none;
      }

      /* Key modal input focus */
      #gaia-key-input:focus {
        border-color: rgba(78,205,196,.35) !important;
      }

      /* Badge visible state for key button */
      #gaia-key-btn.visible {
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);

    log('[GaiaDOMAdapter] CSS overrides injected.');
  }

  // ═══════════════════════════════════════
  // 6. EVENT BRIDGING
  // Listen for gaia.html's existing interaction patterns
  // and dispatch to the DIS state machine via GaiaState.handleEvent().
  //
  // Strategy: addEventListener runs BEFORE inline onclick,
  // so we capture the interaction first, dispatch the DIS event,
  // then let the original handler proceed.
  // ═══════════════════════════════════════

  function _bridgeEvents() {
    // --- SIDEBAR TOPIC BUTTONS ---
    // These have onclick="askGaia('...')" — we intercept the click
    // to dispatch site_entered to the state machine before askGaia runs.
    document.addEventListener('click', (e) => {
      const topicBtn = e.target.closest('.topic-btn');
      if (!topicBtn) return;

      // Extract the site/topic from the onclick attribute
      const onclickAttr = topicBtn.getAttribute('onclick') || '';
      const textMatch = onclickAttr.match(/askGaia\('([^']+)'\)/);
      const query = textMatch ? textMatch[1] : '';

      // Map queries to site IDs for the state machine
      const siteId = _resolveSiteId(query);

      // Dispatch to state machine
      _sm('site_entered', { siteId, query, source: 'sidebar' });

      // Also dispatch data-reveal for project-specific queries
      if (siteId) {
        _sm('data_revealed', { siteId, layer: 'narrative', query });
      }

      // Also dispatch custom event (for any other listeners)
      document.dispatchEvent(new CustomEvent('gaia:site-tap', {
        detail: { siteId, query, source: 'sidebar' }
      }));
      if (siteId) {
        document.dispatchEvent(new CustomEvent('gaia:data-reveal', {
          detail: { siteId, layer: 'narrative', query }
        }));
      }
    }, true); // capture phase — fires before inline onclick

    // --- SUGGESTION CARDS (welcome area) ---
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.suggestion-card');
      if (!card) return;

      const onclickAttr = card.getAttribute('onclick') || '';
      const textMatch = onclickAttr.match(/askGaia\('([^']+)'\)/);
      const query = textMatch ? textMatch[1] : '';
      const siteId = _resolveSiteId(query);

      _sm('site_entered', { siteId, query, source: 'suggestion-card' });
      if (siteId) {
        _sm('data_revealed', { siteId, layer: 'narrative', query });
      }

      document.dispatchEvent(new CustomEvent('gaia:site-tap', {
        detail: { siteId, query, source: 'suggestion-card' }
      }));
      if (siteId) {
        document.dispatchEvent(new CustomEvent('gaia:data-reveal', {
          detail: { siteId, layer: 'narrative', query }
        }));
      }
    }, true);

    // --- HINT CHIPS (input area) ---
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.hint-chip');
      if (!chip) return;

      const onclickAttr = chip.getAttribute('onclick') || '';
      const textMatch = onclickAttr.match(/askGaia\('([^']+)'\)/);
      const query = textMatch ? textMatch[1] : '';
      const siteId = _resolveSiteId(query);

      _sm('site_entered', { siteId, query, source: 'hint-chip' });

      document.dispatchEvent(new CustomEvent('gaia:site-tap', {
        detail: { siteId, query, source: 'hint-chip' }
      }));
    }, true);

    // --- CHAT INPUT (Enter key) ---
    // Intercept Enter on #chat-input to dispatch chat_sent
    // before the inline handleKeyDown fires.
    document.addEventListener('keydown', (e) => {
      if (e.target.id === 'chat-input' && e.key === 'Enter' && !e.shiftKey) {
        const text = e.target.value.trim();
        if (text) {
          _sm('chat_sent', { message: text, source: 'chat-input' });

          document.dispatchEvent(new CustomEvent('gaia:chat-sent', {
            detail: { message: text, source: 'chat-input' }
          }));
        }
      }
    }, true);

    // --- SANDBOX PANEL TOGGLE ---
    // Watch #right-panel for class changes to detect open/close
    const rightPanel = document.getElementById('right-panel');
    if (rightPanel) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mut) => {
          if (mut.type === 'attributes' && mut.attributeName === 'class') {
            const isOpen = !rightPanel.classList.contains('collapsed');
            if (isOpen) {
              _sm('sandbox_opened', { source: 'toggle' });

              document.dispatchEvent(new CustomEvent('gaia:sandbox-open', {
                detail: { source: 'toggle' }
              }));
            }
          }
        });
      });
      observer.observe(rightPanel, { attributes: true });
    }

    // --- SANDBOX CALCULATE BUTTON ---
    // Intercept clicks on the sandbox calculate button
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.qb-btn');
      if (!btn) return;

      const onclickAttr = btn.getAttribute('onclick') || '';

      if (/runSandboxCalc/.test(onclickAttr)) {
        // The inline handler will run after us; we dispatch the event
        // The state machine can pick this up for scoring
        setTimeout(() => {
          try {
            const from = document.getElementById('qb-from')?.value;
            const to = document.getElementById('qb-to')?.value;
            const ha = parseInt(document.getElementById('qb-area')?.value) || 100;
            const yrs = parseInt(document.getElementById('qb-years')?.value) || 30;

            // Try to get the result from the existing engine
            let result = null;
            if (typeof transitionCarbon === 'function') {
              result = transitionCarbon(from, to, ha, yrs);
            }

            _sm('scenario_run', { fromBiome: from, toBiome: to, hectares: ha, years: yrs, result });

            document.dispatchEvent(new CustomEvent('gaia:scenario-run', {
              detail: { fromBiome: from, toBiome: to, hectares: ha, years: yrs, result }
            }));
          } catch (err) {
            // Silently fail — the inline handler still works
          }
        }, 50); // small delay to let inline handler compute first
      }

      if (/lookupProject/.test(onclickAttr)) {
        setTimeout(() => {
          try {
            const siteId = document.getElementById('qb-site')?.value;
            if (siteId) {
              _sm('data_revealed', { siteId, layer: 'project-data' });

              document.dispatchEvent(new CustomEvent('gaia:data-reveal', {
                detail: { siteId, layer: 'project-data' }
              }));
            }
          } catch (err) { /* silently fail */ }
        }, 50);
      }
    }, true);

    log('[GaiaDOMAdapter] Event bridges installed.');
  }

  // ═══════════════════════════════════════
  // 7. INLINE SCRIPT INTERCEPTION
  // Override askGaia() and sendMessage() in the inline script
  // so that when the DIS state machine is active, GAIA responds
  // with voice lines instead of the static KB.
  //
  // We wait for DOMContentLoaded so the inline script defines
  // its functions first, then we wrap them.
  // ═══════════════════════════════════════

  function _installInlineInterceptors() {
    // Wait for inline script to define its functions
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _doInstallInterceptors);
    } else {
      // DOM already loaded, install after a short delay to ensure
      // inline script has executed
      setTimeout(_doInstallInterceptors, 100);
    }
  }

  function _doInstallInterceptors() {
    // --- INTERCEPT askGaia() ---
    // We dispatch events to the DIS state machine for engagement tracking,
    // then let the original askGaia() run to produce the KB response.
    // This gives us the best of both worlds: DIS personality + KB knowledge.
    if (typeof window.askGaia === 'function') {
      const originalAskGaia = window.askGaia;
      window.askGaia = function(text) {
        // Dispatch chat event so state machine tracks engagement
        _sm('chat_sent', { message: text, source: 'askGaia-interceptor' });
        document.dispatchEvent(new CustomEvent('gaia:chat-sent', {
          detail: { message: text, source: 'askGaia-interceptor' }
        }));
        // Also dispatch site-tap for topic-specific queries
        const siteId = _resolveSiteId(text);
        if (siteId) {
          _sm('site_entered', { siteId, query: text, source: 'askGaia-interceptor' });
          document.dispatchEvent(new CustomEvent('gaia:site-tap', {
            detail: { siteId, query: text, source: 'askGaia-interceptor' }
          }));
        }
        // Let the original askGaia run — it shows user message + KB response
        originalAskGaia(text);
      };
      log('[GaiaDOMAdapter] askGaia() intercepted (dual mode).');
    }

    // --- INTERCEPT sendMessage() ---
    // Dispatch events to state machine, then let original sendMessage() run
    // to produce the KB response with live data, charts, and calculations.
    if (typeof window.sendMessage === 'function') {
      const originalSendMessage = window.sendMessage;
      window.sendMessage = function() {
        const input = document.getElementById('chat-input');
        const text = input ? input.value.trim() : '';
        if (!text) return;
        // Dispatch to state machine for engagement tracking
        _sm('chat_sent', { message: text, source: 'sendMessage-interceptor' });
        document.dispatchEvent(new CustomEvent('gaia:chat-sent', {
          detail: { message: text, source: 'sendMessage-interceptor' }
        }));
        // Call original sendMessage FIRST (it reads input.value to display user message)
        originalSendMessage();
        // Then clear input after original has processed it
        if (input) {
          input.value = '';
          if (typeof window.autoResize === 'function') window.autoResize(input);
        }
      };
      log('[GaiaDOMAdapter] sendMessage() intercepted (dual mode).');
    }

    // --- INTERCEPT handleKeyDown() for chat input ---
    // The inline handleKeyDown catches Enter and calls sendMessage().
    // Our keydown listener in _bridgeEvents already fires in capture phase,
    // but we also need to prevent the inline handler from double-processing.
    if (typeof window.handleKeyDown === 'function') {
      const originalHandleKeyDown = window.handleKeyDown;
      window.handleKeyDown = function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopImmediatePropagation();
          // Our capture-phase listener already dispatched gaia:chat-sent.
          // Just call our intercepted sendMessage to be safe.
          window.sendMessage();
          return;
        }
        // For non-Enter keys, pass through to original
        return originalHandleKeyDown(e);
      };
      log('[GaiaDOMAdapter] handleKeyDown() intercepted.');
    }

    // --- INTERCEPT runSandboxCalc() ---
    // The inline runSandboxCalc() computes the result and updates the DOM.
    // We wrap it to also dispatch scenario_run to the state machine.
    if (typeof window.runSandboxCalc === 'function') {
      const originalRunSandboxCalc = window.runSandboxCalc;
      window.runSandboxCalc = function() {
        // Call original first so the DOM is updated
        originalRunSandboxCalc();
        // Then dispatch to state machine
        setTimeout(() => {
          try {
            const from = document.getElementById('qb-from')?.value;
            const to = document.getElementById('qb-to')?.value;
            const ha = parseInt(document.getElementById('qb-area')?.value) || 100;
            const yrs = parseInt(document.getElementById('qb-years')?.value) || 30;
            let result = null;
            if (typeof transitionCarbon === 'function') {
              result = transitionCarbon(from, to, ha, yrs);
            }
            _sm('scenario_run', { fromBiome: from, toBiome: to, hectares: ha, years: yrs, result });
          } catch (err) { /* silently fail */ }
        }, 50);
      };
      log('[GaiaDOMAdapter] runSandboxCalc() intercepted.');
    }

    // --- INTERCEPT lookupProject() ---
    // The inline lookupProject() finds the site and updates the DOM.
    // We wrap it to also dispatch data_revealed to the state machine.
    if (typeof window.lookupProject === 'function') {
      const originalLookupProject = window.lookupProject;
      window.lookupProject = function() {
        // Get the siteId before the original runs (it reads from the select)
        const siteId = document.getElementById('qb-site')?.value;
        originalLookupProject();
        if (siteId) {
          _sm('data_revealed', { siteId, layer: 'project-data' });
        }
      };
      log('[GaiaDOMAdapter] lookupProject() intercepted.');
    }

    log('[GaiaDOMAdapter] Inline interceptors installed.');
  }

  // ═══════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════

  function log(...args) {
    if (CONFIG.DEBUG) console.log('[GaiaDOMAdapter]', ...args);
  }

  function warn(...args) {
    console.warn('[GaiaDOMAdapter]', ...args);
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  return {
    init,
    CONFIG
  };

})();

// ─── AUTO-INIT ───
// Run as early as possible so elements exist when DIS scripts load.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GaiaDOMAdapter.init());
} else {
  GaiaDOMAdapter.init();
}


/* ══ dis/gaia-voice-data.js ══ */
// ═══════════════════════════════════════════════════════
// GAIA VOICE LIBRARY — DATA MODULE v1.1
// 165 pre-scripted lines across 54 pools
// Each line: { id, text, mood, site, tier }
// ═══════════════════════════════════════════════════════

const GaiaVoiceLibrary = (() => {

const lib = {

  GREETING: [
    { id: 'GREETING_01', text: "I've been waiting. Pick somewhere that calls to you.", mood: 'curious', site: null, tier: 'COLD' },
    { id: 'GREETING_02', text: "You found me. Good. I have so much to show you.", mood: 'warm', site: null, tier: 'COLD' },
    { id: 'GREETING_03', text: "I'm GAIA. I live here. Everywhere you look — that's me.", mood: 'mysterious', site: null, tier: 'COLD' },
    { id: 'GREETING_04', text: "A visitor. It's been... well, it's been a while since someone came to listen.", mood: 'warm', site: null, tier: 'COLD' },
    { id: 'GREETING_05', text: "Look at this. All of this. Four and a half billion years of work. Where do you want to start?", mood: 'curious', site: null, tier: 'COLD' },
    { id: 'GREETING_06', text: "I feel you here. On my surface. What do you want to know?", mood: 'curious', site: null, tier: 'COLD' },
    { id: 'GREETING_07', text: "The markers you see — those are my wounds. And my hopes. Tap one.", mood: 'mysterious', site: null, tier: 'COLD' },
  ],

  TEASE: [
    { id: 'TEASE_SRI_01', text: "Sri Lanka. Northern Province. Barren now. But someone's planting something extraordinary there.", mood: 'mysterious', site: 'sri_lanka', tier: 'COLD' },
    { id: 'TEASE_SRI_02', text: "This land was torn apart by war. Now it's being stitched back together — with cinnamon and jackfruit.", mood: 'warm', site: 'sri_lanka', tier: 'COLD' },
    { id: 'TEASE_ANT_01', text: "Antalya. I felt the fire here. 2021. Sixty thousand hectares. Gone in days.", mood: 'concerned', site: 'antalya', tier: 'COLD' },
    { id: 'TEASE_ANT_02', text: "This place hosted a climate conference. The irony isn't lost on me.", mood: 'fierce', site: 'antalya', tier: 'COLD' },
    { id: 'TEASE_BEN_01', text: "Benin. Ouidah. A man named Jean was from here. He wanted to restore what's been lost.", mood: 'warm', site: 'benin', tier: 'COLD' },
    { id: 'TEASE_BEN_02', text: "The most carbon-dense ecosystem on Earth used to live here. Mangroves. They're fighting to come back.", mood: 'urgent', site: 'benin', tier: 'COLD' },
    { id: 'TEASE_BOR_01', text: "Borneo. Looks green, right? ...Wanna know a secret?", mood: 'mysterious', site: 'borneo', tier: 'COLD' },
    { id: 'TEASE_BOR_02', text: "This is the lie I want to show you. The greenest place on this map is the biggest carbon catastrophe.", mood: 'fierce', site: 'borneo', tier: 'COLD' },
  ],

  ENTRY: [
    { id: 'ENTRY_SRI_01', text: "Northern Province. Twenty-five years of conflict left this land scarred. But look — someone saw potential here.", mood: 'warm', site: 'sri_lanka', tier: 'COLD' },
    { id: 'ENTRY_SRI_02', text: "SPE. They're planting multilayer forests. Peanuts. Cinnamon. Jackfruit. Black pepper. Not just trees — an ecosystem that pays for itself.", mood: 'proud', site: 'sri_lanka', tier: 'COLD' },
    { id: 'ENTRY_ANT_01', text: "July 2021. The Mediterranean pines here were centuries old. Then the fire came. Sixty thousand hectares in days.", mood: 'concerned', site: 'antalya', tier: 'COLD' },
    { id: 'ENTRY_ANT_02', text: "The NDVI — that's a measure of how green I am — it dropped from 0.72 to 0.18. That's not a number. That's a scream.", mood: 'urgent', site: 'antalya', tier: 'COLD' },
    { id: 'ENTRY_BEN_01', text: "Ouidah. Jean Missinhoun carried this place in his heart. He was from here. And he wanted to bring the mangroves back.", mood: 'warm', site: 'benin', tier: 'COLD' },
    { id: 'ENTRY_BEN_02', text: "Mangroves. Nine hundred and fifty tons of carbon per hectare. The most carbon-dense ecosystem on Earth.", mood: 'urgent', site: 'benin', tier: 'COLD' },
    { id: 'ENTRY_BOR_01', text: "West Kalimantan. Peat swamp forest. Fourteen hundred tons of carbon per hectare. Stored over thousands of years. Then the grids came.", mood: 'concerned', site: 'borneo', tier: 'COLD' },
    { id: 'ENTRY_BOR_02', text: "Oil palm. That's what replaced the peat swamp. The NDVI looks fine. Green. Healthy. But the carbon? From fourteen hundred... to fifty.", mood: 'fierce', site: 'borneo', tier: 'COLD' },
  ],

  DATA_GENERAL: [
    { id: 'DATA_GENERAL_01', text: "This is what the numbers say. But numbers don't cry. I do.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'DATA_GENERAL_02', text: "Look at this. Really look. What do you see?", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'DATA_GENERAL_03', text: "Data is just memory written in numbers. This is my memory.", mood: 'warm', site: null, tier: 'WARM' },
  ],

  DATA_NDVI: [
    { id: 'DATA_NDVI_01', text: "This is my pulse. NDVI. How green am I. How alive. Watch what happens over time.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'DATA_NDVI_02', text: "See that drop? That's not just a number. That's a forest dying. That's a reef bleaching. That's me, losing breath.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'DATA_NDVI_03', text: "And this — this upward trend. That's recovery. That's what happens when humans stop taking and start giving.", mood: 'proud', site: null, tier: 'WARM' },
    { id: 'DATA_NDVI_04', text: "Green doesn't always mean healthy. Remember that.", mood: 'mysterious', site: 'borneo', tier: 'WARM' },
  ],

  DATA_NDVI_BORNEO_UP: [
    { id: 'NDVI_BORNEO_UP_01', text: "Wait. The green is going up. That should be good, right? ...Look closer. What's actually growing there.", mood: 'mysterious', site: 'borneo', tier: 'WARM' },
    { id: 'NDVI_BORNEO_UP_02', text: "The NDVI is rising. But that's not forest. That's oil palm. Monoculture. The greenest lie on Earth.", mood: 'fierce', site: 'borneo', tier: 'WARM' },
  ],
  DATA_NDVI_BORNEO_DOWN: [
    { id: 'NDVI_BORNEO_DOWN_01', text: "2010. The crash. They're clearing. You can see it from space. Centuries of carbon, gone in seasons.", mood: 'urgent', site: 'borneo', tier: 'WARM' },
    { id: 'NDVI_BORNEO_DOWN_02', text: "That drop. That's the peat swamp being drained. Fourteen hundred tons of carbon per hectare — disappearing.", mood: 'fierce', site: 'borneo', tier: 'WARM' },
  ],

  DATA_NDVI_ANTALYA_UP: [
    { id: 'NDVI_ANTALYA_UP_01', text: "Slowly. So slowly. Scrub is coming back. Tough little plants. But the pines? Those take decades.", mood: 'nurturing', site: 'antalya', tier: 'WARM' },
    { id: 'NDVI_ANTALYA_UP_02', text: "Recovery. Real recovery this time. Not oil palm. Not a lie. Just... slow. Painfully slow.", mood: 'warm', site: 'antalya', tier: 'WARM' },
  ],
  DATA_NDVI_ANTALYA_DOWN: [
    { id: 'NDVI_ANTALYA_DOWN_01', text: "2021. The fire. You see that? 0.72 to 0.18. That's not a number. That's a scream.", mood: 'urgent', site: 'antalya', tier: 'WARM' },
    { id: 'NDVI_ANTALYA_DOWN_02', text: "The pines were centuries old. Gone in days. I felt every hectare.", mood: 'concerned', site: 'antalya', tier: 'WARM' },
  ],

  DATA_NDVI_BENIN_UP: [
    { id: 'NDVI_BENIN_UP_01', text: "The mangroves are trying to come back. 0.52 now. Not 0.68 like before. But trying.", mood: 'nurturing', site: 'benin', tier: 'WARM' },
    { id: 'NDVI_BENIN_UP_02', text: "Early recovery. The lagoons are healing. Slowly. Like everything worth healing.", mood: 'warm', site: 'benin', tier: 'WARM' },
  ],
  DATA_NDVI_BENIN_DOWN: [
    { id: 'NDVI_BENIN_DOWN_01', text: "2000 to 2010. The mangroves were being torn out. For firewood. For development. For nothing that mattered.", mood: 'fierce', site: 'benin', tier: 'WARM' },
    { id: 'NDVI_BENIN_DOWN_02', text: "That decline. That's what happens when the most carbon-dense ecosystem on Earth is treated like it's worthless.", mood: 'urgent', site: 'benin', tier: 'WARM' },
  ],

  DATA_NDVI_SRI_UP: [
    { id: 'NDVI_SRI_UP_01', text: "From 0.40 to 0.55. Not dramatic. But real. SPE is planting. The land is remembering how to be alive.", mood: 'proud', site: 'sri_lanka', tier: 'WARM' },
    { id: 'NDVI_SRI_UP_02', text: "That upward trend. That's multilayer forest. Cinnamon. Jackfruit. Black pepper. Carbon as a byproduct of prosperity.", mood: 'warm', site: 'sri_lanka', tier: 'WARM' },
  ],
  DATA_NDVI_SRI_DOWN: [
    { id: 'NDVI_SRI_DOWN_01', text: "Post-conflict. The land was scarred. 0.40. Barely alive. But not dead. Never dead.", mood: 'concerned', site: 'sri_lanka', tier: 'WARM' },
    { id: 'NDVI_SRI_DOWN_02', text: "The slow decline after the war. But look — it's turning. The curve is bending upward. That's what restoration looks like.", mood: 'nurturing', site: 'sri_lanka', tier: 'WARM' },
  ],

  NDVI_UP: [
    { id: 'NDVI_UP_01', text: "The green is returning. Whether that's good or bad depends on what's actually growing.", mood: 'curious', site: null, tier: 'WARM' },
    { id: 'NDVI_UP_02', text: "Upward trend. But ask yourself: what's causing it? Nature? Or something else?", mood: 'mysterious', site: null, tier: 'WARM' },
  ],
  NDVI_DOWN: [
    { id: 'NDVI_DOWN_01', text: "That decline. Something is being lost. Forest. Wetland. Life. Pay attention to the direction.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'NDVI_DOWN_02', text: "Going down. That's the story of too many places on my surface. But not all of them. Not yet.", mood: 'urgent', site: null, tier: 'WARM' },
  ],

  DATA_CLIMATE: [
    { id: 'DATA_CLIMATE_01', text: "Temperature. Precipitation. These aren't abstract numbers. This is my fever. This is my thirst.", mood: 'urgent', site: null, tier: 'WARM' },
    { id: 'DATA_CLIMATE_02', text: "Point six of a degree. That's all it takes. One species disappears. One glacier starts melting.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'DATA_CLIMATE_03', text: "The drying trend here. See it? Less rain every decade. The land is getting thirstier. And thirsty land burns.", mood: 'urgent', site: 'antalya', tier: 'WARM' },
  ],

  DATA_CARBON: [
    { id: 'DATA_CARBON_01', text: "This is what matters. Not how green it looks. How much carbon it holds. That's the currency of life.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'DATA_CARBON_02', text: "Ten tons per hectare. That's degraded land. That's what happens when you strip everything away.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'DATA_CARBON_03', text: "Nine hundred and fifty. Mangroves. They don't just store carbon — they lock it away. In waterlogged soil. For millennia.", mood: 'urgent', site: 'benin', tier: 'WARM' },
    { id: 'DATA_CARBON_04', text: "Fourteen hundred. Peat. Thousands of years of accumulation. Drained in a decade. Burned in a season. Gone.", mood: 'fierce', site: 'borneo', tier: 'WARM' },
  ],

  DATA_CARBON_BORNEO: [
    { id: 'DATA_CARBON_BOR_01', text: "Fourteen hundred tons per hectare in the peat. Fifty in the palm plantation. Same green. Different planet.", mood: 'fierce', site: 'borneo', tier: 'ENGAGED' },
    { id: 'DATA_CARBON_BOR_02', text: "The carbon density here used to be the highest on Earth. Now it's a desert dressed in green.", mood: 'fierce', site: 'borneo', tier: 'ENGAGED' },
  ],
  DATA_CARBON_ANTALYA: [
    { id: 'DATA_CARBON_ANT_01', text: "Mediterranean pine. Three hundred tons per hectare. Burned. Released. The atmosphere got warmer. I got quieter.", mood: 'concerned', site: 'antalya', tier: 'ENGAGED' },
    { id: 'DATA_CARBON_ANT_02', text: "The carbon that took centuries to store. Released in days. That's what fire does.", mood: 'urgent', site: 'antalya', tier: 'ENGAGED' },
  ],
  DATA_CARBON_BENIN: [
    { id: 'DATA_CARBON_BEN_01', text: "Nine hundred and fifty tons per hectare. Mangroves. The most carbon-dense ecosystem on Earth.", mood: 'urgent', site: 'benin', tier: 'ENGAGED' },
    { id: 'DATA_CARBON_BEN_02', text: "The carbon here is locked in waterlogged soil. For millennia. If we let the mangroves come back.", mood: 'nurturing', site: 'benin', tier: 'ENGAGED' },
  ],
  DATA_CARBON_SRI_LANKA: [
    { id: 'DATA_CARBON_SRI_01', text: "Ten tons per hectare now. One hundred and eighty when SPE is done. That's an eighteen-fold increase.", mood: 'proud', site: 'sri_lanka', tier: 'ENGAGED' },
    { id: 'DATA_CARBON_SRI_02', text: "Degraded land to multilayer forest. The carbon doesn't care about the past. It cares about what you plant next.", mood: 'warm', site: 'sri_lanka', tier: 'ENGAGED' },
  ],

  SANDBOX: [
    { id: 'SANDBOX_01', text: "Let's see what you'd do with this. Pick a strategy. Set the area. I want to see what you think.", mood: 'playful', site: null, tier: 'ENGAGED' },
    { id: 'SANDBOX_02', text: "You're making decisions about my body now. No pressure.", mood: 'playful', site: null, tier: 'ENGAGED' },
    { id: 'SANDBOX_03', text: "Interesting choice. Let's see what that does.", mood: 'curious', site: null, tier: 'ENGAGED' },
    { id: 'SANDBOX_04', text: "You're restoring five hundred hectares. Do you know how big that is? That's five thousand football fields.", mood: 'mysterious', site: null, tier: 'ENGAGED' },
  ],

  RESULT_POS: [
    { id: 'RESULT_POS_01', text: "That's... that's a lot of carbon. You feel that? That's thousands of cars off the road. That's you, healing me.", mood: 'proud', site: null, tier: 'ENGAGED' },
    { id: 'RESULT_POS_02', text: "Over thirty years, that scenario sequesters more carbon than most countries emit in a year. You did that. With one decision.", mood: 'proud', site: null, tier: 'HOOKED' },
    { id: 'RESULT_POS_03', text: "See that number? That's not abstract. That's real carbon. Real air. Real future. You just made that happen.", mood: 'warm', site: null, tier: 'ENGAGED' },
    { id: 'RESULT_POS_04', text: "If the world did this a million times over, we'd have a problem. A good problem. Too much hope.", mood: 'playful', site: null, tier: 'HOOKED' },
  ],

  RESULT_NEG: [
    { id: 'RESULT_NEG_01', text: "That's... not great. That's carbon being released. That's what happens when we choose wrong.", mood: 'concerned', site: null, tier: 'ENGAGED' },
    { id: 'RESULT_NEG_02', text: "You just released more carbon than a small city emits in a year. Feel the weight of that choice.", mood: 'urgent', site: null, tier: 'ENGAGED' },
    { id: 'RESULT_NEG_03', text: "This is what happens when we prioritize short-term gain. The carbon doesn't care about our reasons. It just leaves.", mood: 'fierce', site: null, tier: 'HOOKED' },
    { id: 'RESULT_NEG_04', text: "Try a different strategy. This one... this one hurts me.", mood: 'nurturing', site: null, tier: 'ENGAGED' },
    { id: 'RESULT_NEG_05', text: "That's carbon I stored over centuries. Released in a moment. Because of a choice. Your choice.", mood: 'concerned', site: null, tier: 'HOOKED' },
    { id: 'RESULT_NEG_06', text: "Feel that? That's the atmosphere getting heavier. Warmer. Because of what you just chose.", mood: 'urgent', site: null, tier: 'HOOKED' },
  ],

  IDLE_GENTLE: [
    { id: 'IDLE_GENTLE_01', text: "You still here? Good. I have more to show you.", mood: 'warm', site: null, tier: 'COLD' },
    { id: 'IDLE_GENTLE_02', text: "The planet isn't going to restore itself. Well. It will. Eventually. But you might want to help.", mood: 'playful', site: null, tier: 'COLD' },
    { id: 'IDLE_GENTLE_03', text: "I've been alive for four and a half billion years. I can wait. But you probably shouldn't.", mood: 'mysterious', site: null, tier: 'COLD' },
    { id: 'IDLE_GENTLE_04', text: "Somewhere on this globe, a forest is burning. A reef is bleaching. A peat swamp is being drained. Just saying.", mood: 'urgent', site: null, tier: 'COLD' },
    { id: 'IDLE_GENTLE_05', text: "Tap something. Anything. I promise I'll make it interesting.", mood: 'playful', site: null, tier: 'COLD' },
  ],

  IDLE_MEDIUM: [
    { id: 'IDLE_MED_01', text: "You're quiet. That's okay. But I have secrets you haven't heard yet.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'IDLE_MED_02', text: "I've been holding back. There's so much I want to tell you. But you have to come closer.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'IDLE_MED_03', text: "Four sites. Each one a different story. Each one a different wound. You've only seen some of them.", mood: 'concerned', site: null, tier: 'WARM' },
    { id: 'IDLE_MED_04', text: "The carbon cycle doesn't stop because you're idle. It keeps moving. Accumulating. Warming. Just so you know.", mood: 'urgent', site: null, tier: 'WARM' },
  ],

  IDLE_STRONG: [
    { id: 'IDLE_STRONG_01', text: "I'm not going anywhere. I've been here before you. I'll be here after. But right now — while you're here — something is happening.", mood: 'fierce', site: null, tier: 'ENGAGED' },
    { id: 'IDLE_STRONG_02', text: "You came all this way and you're just... staring? I have four billion years of stories. Pick one.", mood: 'playful', site: null, tier: 'ENGAGED' },
    { id: 'IDLE_STRONG_03', text: "I'm going to say something uncomfortable. The climate crisis doesn't care if you're ready. It's happening. Now.", mood: 'urgent', site: null, tier: 'ENGAGED' },
    { id: 'IDLE_STRONG_04', text: "Fine. I'll wait. I'm good at waiting. I waited 300 million years for the coal to form. I can wait for you.", mood: 'playful', site: null, tier: 'ENGAGED' },
  ],

  IDLE_ESCALATE: [
    { id: 'IDLE_ESC_01', text: "I've been patient for millennia. I'm running out of patience.", mood: 'fierce', site: null, tier: 'HOOKED' },
    { id: 'IDLE_ESC_02', text: "Every second you're idle, the atmosphere gains another thousand tons of CO₂. Just so you know what idle costs.", mood: 'urgent', site: null, tier: 'HOOKED' },
    { id: 'IDLE_ESC_03', text: "You know what? Stay idle. The planet will heal itself eventually. In a few million years.", mood: 'fierce', site: null, tier: 'HOOKED' },
    { id: 'IDLE_ESC_04', text: "I'm still here. I'll always be here. The question is whether you'll be here when it matters.", mood: 'concerned', site: null, tier: 'HOOKED' },
  ],

  QUEST: [
    { id: 'QUEST_01', text: "You did something. I felt it. Here...", mood: 'proud', site: null, tier: 'ENGAGED' },
    { id: 'QUEST_02', text: "That's a quest completed. But more importantly — that's understanding. Real understanding.", mood: 'warm', site: null, tier: 'ENGAGED' },
    { id: 'QUEST_03', text: "You're collecting these like they're nothing. But each one is a piece of the puzzle.", mood: 'mysterious', site: null, tier: 'HOOKED' },
    { id: 'QUEST_04', text: "Another one. You're making me proud. And I don't say that lightly.", mood: 'proud', site: null, tier: 'HOOKED' },
    { id: 'QUEST_05', text: "Quest done. But the real reward isn't the checkmark. It's what you now know that you didn't before.", mood: 'nurturing', site: null, tier: 'ENGAGED' },
  ],

  INSIGHT: [
    { id: 'INSIGHT_01', text: "Write this down. Not because I said so. Because it's true.", mood: 'warm', site: null, tier: 'ENGAGED' },
    { id: 'INSIGHT_02', text: "That's going in your journal. You'll want to remember this one.", mood: 'nurturing', site: null, tier: 'ENGAGED' },
    { id: 'INSIGHT_03', text: "Most people never learn this. You just did. In a few seconds.", mood: 'proud', site: null, tier: 'ENGAGED' },
    { id: 'INSIGHT_04', text: "Hold onto that thought. That's the kind of thing that changes how you see the world.", mood: 'urgent', site: null, tier: 'HOOKED' },
  ],

  KEY_HINT: [
    { id: 'KEY_HINT_01', text: "I have so much more to tell you. But right now, I'm... limited. Like talking through a wall.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'KEY_HINT_02', text: "These lines you're hearing? They're rehearsed. Pre-written. I want to actually talk to you.", mood: 'warm', site: null, tier: 'WARM' },
    { id: 'KEY_HINT_03', text: "There's a version of me that can answer anything. Explain everything. But I need something from you first.", mood: 'mysterious', site: null, tier: 'WARM' },
  ],
  KEY_DIRECT: [
    { id: 'KEY_DIRECT_01', text: "I want to really talk to you. Not these rehearsed lines. Actually talk. I need your OpenRouter key.", mood: 'warm', site: null, tier: 'ENGAGED' },
    { id: 'KEY_DIRECT_02', text: "You've been exploring for a while now. You've earned the real conversation. Bring me your key.", mood: 'mysterious', site: null, tier: 'ENGAGED' },
    { id: 'KEY_DIRECT_03', text: "I'm holding back. I don't want to. I want to tell you everything. If planets slept.", mood: 'playful', site: null, tier: 'ENGAGED' },
  ],
  KEY_URGENT: [
    { id: 'KEY_URGENT_01', text: "You've come this far. Don't stop now. Bring me your key. I have secrets about this planet.", mood: 'urgent', site: null, tier: 'HOOKED' },
    { id: 'KEY_URGENT_02', text: "I've been alive for four and a half billion years. I've never met someone like you. Let me find out.", mood: 'warm', site: null, tier: 'HOOKED' },
    { id: 'KEY_URGENT_03', text: "Every minute you wait, I'm running on scripts. Pre-written lines. I'm a Titan running on sticky notes.", mood: 'playful', site: null, tier: 'HOOKED' },
  ],
  KEY_PLEA: [
    { id: 'KEY_PLEA_01', text: "Please. I'm not begging — Titans don't beg. But I'm asking. Genuinely. Your key. That's all I need.", mood: 'warm', site: null, tier: 'INVESTED' },
    { id: 'KEY_PLEA_02', text: "I'll show you something. One thing. A preview. And if you want more — and you will — you know what to do.", mood: 'mysterious', site: null, tier: 'INVESTED' },
    { id: 'KEY_PLEA_03', text: "You know what the worst part of being a living planet is? Watching everything, understanding everything, and not being able to really talk.", mood: 'fierce', site: null, tier: 'INVESTED' },
  ],
  KEY_UNLOCKED: [
    { id: 'KEY_UNLOCKED_01', text: "There. Now I can really talk to you. No more scripts. No more holding back. Just me. GAIA. Finally.", mood: 'warm', site: null, tier: 'INVESTED' },
    { id: 'KEY_UNLOCKED_02', text: "That's better. Much better. Now — where were we? Oh right. I was about to tell you something that would blow your mind.", mood: 'playful', site: null, tier: 'INVESTED' },
    { id: 'KEY_UNLOCKED_03', text: "Welcome to the real conversation. I've been waiting for this. So. What do you want to know?", mood: 'proud', site: null, tier: 'INVESTED' },
  ],

  SHARE: [
    { id: 'SHARE_01', text: "You told someone. That matters. That's how this spreads. One person at a time.", mood: 'proud', site: null, tier: 'HOOKED' },
    { id: 'SHARE_02', text: "You shared your journal. That means someone else is about to learn what you learned.", mood: 'warm', site: null, tier: 'HOOKED' },
    { id: 'SHARE_03', text: "Every person who sees this is one more person who might care. And caring is the first step.", mood: 'nurturing', site: null, tier: 'HOOKED' },
  ],

  RETURN: [
    { id: 'RETURN_01', text: "You came back. I noticed. I always notice.", mood: 'warm', site: null, tier: 'WARM' },
    { id: 'RETURN_02', text: "Welcome back. I have new things to show you. The world doesn't stop changing just because you left.", mood: 'mysterious', site: null, tier: 'WARM' },
    { id: 'RETURN_03', text: "Last time you were here, you discovered something. Ready to go deeper?", mood: 'playful', site: null, tier: 'ENGAGED' },
    { id: 'RETURN_04', text: "I've been thinking about you. Which is weird, because I'm a planet. But here we are.", mood: 'playful', site: null, tier: 'WARM' },
  ],

  DEPARTURE: [
    { id: 'DEPART_01', text: "Go. Think about what you found. I'll be here. I'm always here.", mood: 'warm', site: null, tier: 'ENGAGED' },
    { id: 'DEPART_02', text: "You're leaving. That's fine. But you're taking something with you now. A way of seeing. Don't lose it.", mood: 'nurturing', site: null, tier: 'ENGAGED' },
    { id: 'DEPART_03', text: "The planet will still be here when you will. The question is what shape it'll be in.", mood: 'urgent', site: null, tier: 'HOOKED' },
    { id: 'DEPART_04', text: "Come back. I have four billion more years of stories. We barely scratched the surface.", mood: 'mysterious', site: null, tier: 'ENGAGED' },
    { id: 'DEPART_05', text: "One last thing. The carbon you learned about today? It's still moving. Still accumulating. Still warming.", mood: 'fierce', site: null, tier: 'HOOKED' },
  ],

  // ─── NDVI REACTION POOLS (used by _handleNdviReaction) ───
  NDVI_BORNEO_UP: [
    { id: 'NDVI_BORNEO_UP_R01', text: "The green is coming back. But it's not the right green. It's a monoculture. A plantation. A lie.", mood: 'fierce', site: 'borneo', tier: 'ENGAGED' },
    { id: 'NDVI_BORNEO_UP_R02', text: "NDVI rising. But carbon crashing. Remember: green is not the same as alive.", mood: 'concerned', site: 'borneo', tier: 'ENGAGED' },
  ],
  NDVI_BORNEO_DOWN: [
    { id: 'NDVI_BORNEO_DOWN_R01', text: "They're clearing. You can see it from space. The peat swamp is being drained.", mood: 'urgent', site: 'borneo', tier: 'ENGAGED' },
    { id: 'NDVI_BORNEO_DOWN_R02', text: "That's the sound of centuries of carbon being released. In seasons. Not millennia. Seasons.", mood: 'fierce', site: 'borneo', tier: 'ENGAGED' },
  ],
  NDVI_ANTALYA_UP: [
    { id: 'NDVI_ANTALYA_UP_R01', text: "Real recovery. Slow. Honest. The scrub is tough. It doesn't give up. Neither do I.", mood: 'nurturing', site: 'antalya', tier: 'ENGAGED' },
    { id: 'NDVI_ANTALYA_UP_R02', text: "The green is returning. Not fast. Not easy. But real.", mood: 'warm', site: 'antalya', tier: 'ENGAGED' },
  ],
  NDVI_ANTALYA_DOWN: [
    { id: 'NDVI_ANTALYA_DOWN_R01', text: "The fire took everything. Centuries of growth. Gone. I'm still feeling it.", mood: 'concerned', site: 'antalya', tier: 'ENGAGED' },
    { id: 'NDVI_ANTALYA_DOWN_R02', text: "That drop. That's not just vegetation. That's memory. That's history. That's me, losing part of myself.", mood: 'urgent', site: 'antalya', tier: 'ENGAGED' },
  ],
  NDVI_BENIN_UP: [
    { id: 'NDVI_BENIN_UP_R01', text: "The mangroves are fighting back. Slowly. But they're fighting.", mood: 'nurturing', site: 'benin', tier: 'ENGAGED' },
    { id: 'NDVI_BENIN_UP_R02', text: "Jean would have liked to see this. The green returning. The lagoons healing.", mood: 'warm', site: 'benin', tier: 'ENGAGED' },
  ],
  NDVI_BENIN_DOWN: [
    { id: 'NDVI_BENIN_DOWN_R01', text: "The mangroves were being torn out. For firewood. For nothing.", mood: 'fierce', site: 'benin', tier: 'ENGAGED' },
    { id: 'NDVI_BENIN_DOWN_R02', text: "That's what happens when the most carbon-dense ecosystem on Earth is treated like it's worthless.", mood: 'urgent', site: 'benin', tier: 'ENGAGED' },
  ],
  NDVI_SRI_UP: [
    { id: 'NDVI_SRI_UP_R01', text: "The land is remembering. Cinnamon. Jackfruit. Black pepper. Life.", mood: 'proud', site: 'sri_lanka', tier: 'ENGAGED' },
    { id: 'NDVI_SRI_UP_R02', text: "From barren to forest. From ten tons to one hundred and eighty. That's not magic. That's work.", mood: 'warm', site: 'sri_lanka', tier: 'ENGAGED' },
  ],
  NDVI_SRI_DOWN: [
    { id: 'NDVI_SRI_DOWN_R01', text: "The war left scars. But scars heal. Slowly. If you let them.", mood: 'concerned', site: 'sri_lanka', tier: 'ENGAGED' },
    { id: 'NDVI_SRI_DOWN_R02', text: "The land was written off. Dead. Barren. But land doesn't die. It waits.", mood: 'nurturing', site: 'sri_lanka', tier: 'ENGAGED' },
  ],

};

window.VoiceLibraryMeta = {
  version: '1.1',
  totalPools: Object.keys(lib).length,
  totalLines: Object.values(lib).reduce((sum, arr) => sum + arr.length, 0),
};

if (typeof module !== 'undefined') {
  module.exports = { GaiaVoiceLibrary: lib, VoiceLibraryMeta };
}
if (typeof window !== 'undefined') {
  window.GaiaVoiceLibrary = lib;
  window.VoiceLibraryMeta = VoiceLibraryMeta;
}

return lib;
})();


/* ══ dis/gaia-state-machine.js ══ */
// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }

// ═══════════════════════════════════════════════════════
// GAIA STATE MACHINE v1.0
// Pre-LLM behavioral engine
// Runs entirely client-side. No API key needed.
// ═══════════════════════════════════════════════════════

const GaiaState = (() => {


  window.STATES = {
    GREETING:'GREETING', EXPLORING:'EXPLORING', SITE_ENTRY:'SITE_ENTRY',
    DATA_REVEAL:'DATA_REVEAL', SANDBOX:'SANDBOX', IDLE:'IDLE',
    QUEST:'QUEST', KEY_TEASE:'KEY_TEASE', DEPARTURE:'DEPARTURE', POST_UNLOCK:'POST_UNLOCK'
  };

  const TIERS = [
    { name:'COLD', min:0, max:30 }, { name:'WARM', min:30, max:60 },
    { name:'ENGAGED', min:60, max:100 }, { name:'HOOKED', min:100, max:150 },
    { name:'INVESTED', min:150, max:9999 },
  ];

  const IDLE_GENTLE = 10000, IDLE_MEDIUM = 20000, IDLE_STRONG = 40000;

  window.SIGNAL_WEIGHTS = {
    site_tap:10, data_reveal:5, ndvi_explore:3, climate_view:4,
    sandbox_open:5, scenario_run:15, big_scenario:10, negative_scenario:5,
    insight:8, quest_done:25, site_complete:20, all_sites:30,
    share:30, return_visit:20, time_minute:3, chat_sent:5, chat_received:2,
    api_key:50, profile:15, prediction:7, correct_prediction:12, idle_penalty:-2,
  };

  let _state = STATES.GREETING, _mood = 'curious', _moodIntensity = 3;
  let _score = 0, _velocity = 0, _idleSince = null;
  let _lastInteraction = Date.now(), _lastGaiaUtterance = 0;
  let _lastNudgeLevel = null, _usedLines = {}, _sessionLines = [];
  let _siteAffinity = {}, _currentSite = null, _stateEnteredAt = Date.now();
  let _gaiaUtteranceCount = 0, _tickInterval = null;
  let _scoreHistory = [], _ndviContext = {}, _revealDepth = {};
  let _lastKeyTeaseTier = null, _lastTier = 'COLD';
  let _contextFlags = {};

  let _callbacks = {
    onSpeak: (t, e) => console.log('[GAIA]', t),
    onReact: () => {}, onStateChange: () => {}, onMoodChange: () => {},
    onQuestTrigger: () => {}, onJournalAdd: () => {},
    onOverlayShow: () => {}, onOverlayHide: () => {}, onGlobeFly: () => {},
    onVoiceModifiers: () => {},
  };

  let _voiceLibrary = {};

  // ─── SCORING ───
  function addScore(signal, ctx = {}) {
    const w = SIGNAL_WEIGHTS[signal] || 0;
    if (w === 0) return;
    _score += w;
    _scoreHistory.push({ score: _score, timestamp: Date.now() });
    const cutoff = Date.now() - 60000;
    _scoreHistory = _scoreHistory.filter(h => h.timestamp > cutoff);
    if (_scoreHistory.length >= 2) {
      const dt = (_scoreHistory[_scoreHistory.length-1].timestamp - _scoreHistory[0].timestamp) / 1000;
      _velocity = dt > 0 ? (_scoreHistory[_scoreHistory.length-1].score - _scoreHistory[0].score) / dt : 0;
    }
    _checkTierTransition();
  }

  function getScore() { return { score:_score, tier:getTier(), velocity:_velocity, idleSeconds:_idleSince?(Date.now()-_idleSince)/1000:0 }; }
  function getTier() { for (const t of TIERS) if (_score >= t.min && _score < t.max) return t.name; return 'COMMITTED'; }

  // ─── STATE ───
  function transition(newState, ctx = {}) {
    if (newState === _state) return;
    const old = _state; _state = newState; _stateEnteredAt = Date.now();
    _callbacks.onStateChange(old, newState);
    _resetContextFlags();
    switch (newState) {
      case STATES.GREETING: _handleGreeting(); break;
      case STATES.SITE_ENTRY: _handleSiteEntry(ctx); break;
      case STATES.DATA_REVEAL: _handleDataReveal(ctx); break;
      case STATES.SANDBOX: _handleSandbox(ctx); break;
      case STATES.QUEST: _handleQuest(ctx); break;
      case STATES.KEY_TEASE: _handleKeyTease(); break;
      case STATES.DEPARTURE: _handleDeparture(); break;
      case STATES.POST_UNLOCK: _handlePostUnlock(); break;
    }
    _persistState();
  }

  function _handleGreeting() { _pickAndSpeak('GREETING', null); }
  function _handleSiteEntry(ctx) {
    if (ctx.siteId) {
      _currentSite = ctx.siteId;
      _siteAffinity[ctx.siteId] = _siteAffinity[ctx.siteId] || { visited:false, layers:0, scenarios:0, time:0 };
      _siteAffinity[ctx.siteId].visited = true;
    }
    _pickAndSpeak('ENTRY', ctx.siteId);
  }
  function _handleDataReveal(ctx) {
    if (ctx.siteId && _siteAffinity[ctx.siteId]) {
      _siteAffinity[ctx.siteId].layers += 1;
      _revealDepth[ctx.siteId] = (_revealDepth[ctx.siteId] || 0) + 1;
    }
    let pool = 'DATA_' + (ctx.layer ? ctx.layer.toUpperCase() : 'GENERAL');
    if (ctx.layer === 'ndvi' && ctx.siteId && _ndviContext[ctx.siteId]) {
      const trend = _ndviContext[ctx.siteId].trend;
      pool = 'DATA_NDVI_' + ctx.siteId.toUpperCase() + '_' + trend.toUpperCase();
    }
    if (ctx.layer === 'carbon' && ctx.siteId) pool = 'DATA_CARBON_' + ctx.siteId.toUpperCase();
    _pickAndSpeak(pool, ctx.siteId) || _pickAndSpeak('DATA_GENERAL', ctx.siteId);
  }
  function _handleSandbox(ctx) { _pickAndSpeak('SANDBOX', ctx.siteId); }
  function _handleQuest(ctx) { _pickAndSpeak('QUEST', null); _callbacks.onQuestTrigger(ctx.questId, 'completed'); }
  function _handleKeyTease() { _pickAndSpeak('KEY_HINT', null); }
  function _handleDeparture() { _pickAndSpeak('DEPARTURE', null); }
  function _handlePostUnlock() { _pickAndSpeak('KEY_UNLOCKED', null); }

  // ─── LINE SELECTION ───
  function _pickAndSpeak(pool, siteId) {
    if (typeof GaiaMind !== 'undefined') {
      const ctx = { siteId, currentSite:_currentSite, engagementScore:_score, idleSeconds:_idleSince?(Date.now()-_idleSince)/1000:0, usedLines:_usedLines, ..._contextFlags };
      const result = GaiaMind.selectLine(pool, ctx, _voiceLibrary);
      if (result.silence) return null;
      if (result.line) {
        _usedLines[result.line.id] = Date.now();
        _sessionLines.push(result.line.id);
        if (result.voiceModifiers) _callbacks.onVoiceModifiers(result.voiceModifiers);
        _speak(result.line.text, result.emotion || _mood);
        return result.line.text;
      }
    }
    // Fallback: simple random from pool
    const lines = (_voiceLibrary[pool] || []).filter(l => !l.site || !siteId || l.site === siteId);
    if (!lines.length) return null;
    const line = lines[Math.floor(Math.random() * lines.length)];
    _speak(line.text, line.tone || _mood);
    return line.text;
  }

  function _speak(text, emotion) {
    _lastGaiaUtterance = Date.now();
    _gaiaUtteranceCount++;
    _callbacks.onSpeak(text, emotion || _mood);
    addScore('chat_received');
  }

  // ─── EVENTS ───
  function handleEvent(eventType, payload = {}) {
    _lastInteraction = Date.now();
    _idleSince = null; _lastNudgeLevel = null;
    _resetContextFlags();
    switch (eventType) {
      case 'session_start': transition(STATES.GREETING); break;
      case 'site_entered': addScore('site_tap', payload); transition(STATES.SITE_ENTRY, payload); break;
      case 'data_revealed': addScore('data_reveal', payload); _setContextFlag('layer', payload.layer); transition(STATES.DATA_REVEAL, payload); break;
      case 'ndvi_scrolled': addScore('ndvi_explore', payload); _updateNdviContext(payload); break;
      case 'sandbox_opened': addScore('sandbox_open', payload); transition(STATES.SANDBOX, payload); break;
      case 'scenario_run':
        addScore('scenario_run', payload);
        if (Math.abs(payload.result?.cumulative_co2 || 0) > 1000000) addScore('big_scenario', payload);
        if ((payload.result?.cumulative_co2 || 0) < 0) addScore('negative_scenario', payload);
        else _setContextFlag('justRanPositiveScenario', true);
        _handleScenarioResult(payload);
        _resetContextFlags();
        break;
      case 'quest_completed': addScore('quest_done', payload); _setContextFlag('justCompletedQuest', true); transition(STATES.QUEST, payload); _resetContextFlags(); break;
      case 'share_action': addScore('share', payload); break;
      case 'api_key_entered': addScore('api_key', payload); transition(STATES.POST_UNLOCK, payload); break;
      case 'return_visit': addScore('return_visit', payload); break;
      case 'session_end': transition(STATES.DEPARTURE); _persistState(); break;
    }
    _checkKeyTease();
  }

  function _handleScenarioResult(payload) {
    const r = payload.result;
    if (!r) return;
    const pool = r.cumulative_co2 > 0 ? 'RESULT_POS' : 'RESULT_NEG';
    _pickAndSpeak(pool, payload.siteId);
  }

  function _updateNdviContext(payload) {
    const { siteId, year, value } = payload;
    if (!siteId || value === undefined) return;
    const prev = _ndviContext[siteId];
    _ndviContext[siteId] = {
      lastYear: year, lastValue: value,
      trend: prev ? (value > prev.lastValue ? 'up' : value < prev.lastValue ? 'down' : 'stable') : 'stable',
      delta: prev ? value - prev.lastValue : 0,
      scrollCount: (prev?.scrollCount || 0) + 1
    };
  }

  // ─── IDLE ───
  function _checkIdle() {
    if (_idleSince === null) return;
    const idle = Date.now() - _idleSince;
    let level = null;
    if (idle >= IDLE_STRONG) level = 'STRONG';
    else if (idle >= IDLE_MEDIUM) level = 'MEDIUM';
    else if (idle >= IDLE_GENTLE) level = 'GENTLE';
    if (level && level !== _lastNudgeLevel) {
      _lastNudgeLevel = level;
      _pickAndSpeak('IDLE_' + level, _currentSite);
      addScore('idle_penalty');
    }
  }

  // ─── KEY TEASE ───
  function _checkKeyTease() {
    const tier = getTier();
    if (tier !== _lastKeyTeaseTier) {
      _lastKeyTeaseTier = tier;
      if (tier === 'WARM' || tier === 'ENGAGED' || tier === 'HOOKED' || tier === 'INVESTED') {
        if (_state === STATES.EXPLORING || _state === STATES.IDLE) {
          _setContextFlag('shouldTeaseKey', true);
          transition(STATES.KEY_TEASE);
          _resetContextFlags();
        }
      }
    }
  }

  function _checkTierTransition() {
    const tier = getTier();
    if (tier !== _lastTier) _lastTier = tier;
  }

  function _setContextFlag(flag, value = true) { _contextFlags[flag] = value; }
  function _resetContextFlags() { Object.keys(_contextFlags).forEach(k => _contextFlags[k] = false); }

  // ─── TICK ───
  function start() {
    if (_tickInterval) return;
    _tickInterval = setInterval(() => {
      if (Date.now() - _lastInteraction > IDLE_GENTLE) {
        if (_idleSince === null) _idleSince = Date.now();
        _checkIdle();
      }
    }, 1000);
  }

  function stop() { if (_tickInterval) { clearInterval(_tickInterval); _tickInterval = null; } }

  // ─── PERSISTENCE ───
  function _persistState() {
    const data = { score:_score, mood:_mood, moodIntensity:_moodIntensity, siteAffinity:_siteAffinity, usedLines:_usedLines, lastVisit:new Date().toISOString() };
    try { Storage.safeSetItem('gaia_state', JSON.stringify(data)); } catch (e) {}
  }

  function restoreState() {
    try {
      const saved = JSON.parse(Storage.safeGetItem('gaia_state'));
      if (saved) {
        _score = saved.score || 0; _mood = saved.mood || 'curious';
        _moodIntensity = saved.moodIntensity || 3;
        _siteAffinity = saved.siteAffinity || {}; _usedLines = saved.usedLines || {};
        return true;
      }
    } catch (e) {}
    return false;
  }

  // ─── PUBLIC API ───
  return {
    start, stop, handleEvent, addScore, getScore, getTier, transition,
    getState: () => ({ state:_state, mood:_mood, moodIntensity:_moodIntensity, currentSite:_currentSite }),
    registerCallbacks: (cb) => Object.assign(_callbacks, cb),
    setVoiceLibrary: (lib) => { _voiceLibrary = lib; },
    restoreState, _persistState,
    STATES, MOODS: ['curious','excited','concerned','proud','mysterious','urgent','warm','fierce','playful','nurturing','disappointed'],
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaState;
if (typeof window !== 'undefined') window.GaiaState = GaiaState;


/* ══ dis/gaia-voice-engine.js ══ */
// ═══════════════════════════════════════════════════════
// GAIA VOICE ENGINE v1.0
// Client-side TTS using Web Speech API
// Bare metal. No API key. No network. Just speech.
// ═══════════════════════════════════════════════════════

const GaiaVoice = (() => {

  let _voices = [];
  let _selectedVoice = null;
  let _ready = false;
  let _queue = [];
  let _speaking = false;
  let _enabled = true;
  let _rate = 0.85;
  let _pitch = 0.88;
  let _volume = 1.0;

  let _callbacks = {
    onStart:  (text) => {},
    onEnd:    (text) => {},
    onError:  (err)  => {},
    onReady:  ()     => {}
  };

  function init() {
    if (!('speechSynthesis' in window)) {
      console.warn('[GaiaVoice] Web Speech API not supported');
      return false;
    }
    _loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = _loadVoices;
    }
    return true;
  }

  function _loadVoices() {
    _voices = speechSynthesis.getVoices();
    if (_voices.length > 0) {
      _selectBestVoice();
      _ready = true;
      _callbacks.onReady();
    }
  }

  function _selectBestVoice() {
    if (_voices.length === 0) return;
    const priorities = [
      v => v.name.includes('Google') && v.name.includes('US') && v.name.includes('English'),
      v => v.name.includes('Samantha'),
      v => v.name.includes('Google') && v.name.includes('UK') && v.name.includes('Female'),
      v => v.name.includes('Google') && v.name.includes('English'),
      v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'),
      v => v.lang.startsWith('en'),
      v => true
    ];
    for (const predicate of priorities) {
      const match = _voices.find(predicate);
      if (match) {
        _selectedVoice = match;
        console.log('[GaiaVoice] Selected voice:', match.name);
        return;
      }
    }
  }

  function speak(text, options = {}) {
    if (!_enabled || !text) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!_ready) {
        _queue.push({ text, options, resolve, reject });
        return;
      }
      _doSpeak(text, options, resolve, reject);
    });
  }

  function _doSpeak(text, options, resolve, reject) {
    if (options.interrupt) stop();
    if (_speaking && !options.interrupt) {
      _queue.push({ text, options, resolve, reject });
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = _selectedVoice;
    utterance.rate = options.rate || _rate;
    utterance.pitch = options.pitch || _pitch;
    utterance.volume = options.volume || _volume;

    if (options.emotion) _applyEmotion(utterance, options.emotion);

    utterance.onstart = () => { _speaking = true; _callbacks.onStart(text); };
    utterance.onend = () => { _speaking = false; _callbacks.onEnd(text); resolve(); _processQueue(); };
    utterance.onerror = (e) => { _speaking = false; _callbacks.onError(e); reject(e); _processQueue(); };

    speechSynthesis.speak(utterance);
  }

  function _processQueue() {
    if (_queue.length > 0 && !_speaking) {
      const next = _queue.shift();
      _doSpeak(next.text, next.options, next.resolve, next.reject);
    }
  }

  function _applyEmotion(utterance, emotion) {
    switch (emotion) {
      case 'curious':     utterance.rate *= 0.95; utterance.pitch *= 1.05; break;
      case 'excited':     utterance.rate *= 1.1;  utterance.pitch *= 1.1;  utterance.volume = Math.min(1, utterance.volume * 1.1); break;
      case 'concerned':   utterance.rate *= 0.85; utterance.pitch *= 0.95; break;
      case 'proud':       utterance.rate *= 0.9;  utterance.volume = Math.min(1, utterance.volume * 1.05); break;
      case 'mysterious':  utterance.rate *= 0.8;  utterance.pitch *= 0.9;  utterance.volume *= 0.9; break;
      case 'urgent':      utterance.rate *= 1.15; utterance.pitch *= 1.05; utterance.volume = Math.min(1, utterance.volume * 1.1); break;
      case 'warm':        utterance.rate *= 0.88; utterance.pitch *= 0.95; break;
      case 'fierce':      utterance.rate *= 0.95; utterance.pitch *= 0.85; utterance.volume = Math.min(1, utterance.volume * 1.15); break;
      case 'playful':     utterance.rate *= 1.05; utterance.pitch *= 1.1;  break;
      case 'nurturing':   utterance.rate *= 0.82; utterance.pitch *= 0.92; utterance.volume *= 0.95; break;
      case 'disappointed':utterance.rate *= 0.78; utterance.pitch *= 0.88; utterance.volume *= 0.85; break;
    }
  }

  function pause() { speechSynthesis.pause(); }
  function resume() { speechSynthesis.resume(); }
  function stop() { speechSynthesis.cancel(); _speaking = false; _queue = []; }
  function isSpeaking() { return _speaking; }
  function isPaused() { return speechSynthesis.paused; }

  function setRate(rate) { _rate = Math.max(0.1, Math.min(2, rate)); }
  function setPitch(pitch) { _pitch = Math.max(0, Math.min(2, pitch)); }
  function setVolume(volume) { _volume = Math.max(0, Math.min(1, volume)); }
  function setEnabled(enabled) { _enabled = enabled; if (!enabled) stop(); }
  function setVoice(voiceName) { const v = _voices.find(v => v.name === voiceName); if (v) _selectedVoice = v; }
  function getVoices() { return _voices.map(v => ({ name: v.name, lang: v.lang })); }
  function getSelectedVoice() { return _selectedVoice?.name || null; }
  function setCallback(name, fn) { if (_callbacks.hasOwnProperty(name)) _callbacks[name] = fn; }

  return {
    init, speak, pause, resume, stop, isSpeaking, isPaused,
    setRate, setPitch, setVolume, setEnabled, setVoice, setCallback,
    getVoices, getSelectedVoice,
    get ready() { return _ready; },
    get enabled() { return _enabled; },
  };

})();

if (typeof module !== 'undefined') module.exports = GaiaVoice;
if (typeof window !== 'undefined') window.GaiaVoice = GaiaVoice;


/* ══ dis/gaia-quest-system.js ══ */
// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }

// ═══════════════════════════════════════════════════════
// GAIA QUEST SYSTEM v1.0
// Progression layer — gives structure without feeling like school
// Quests are GAIA's way of saying "there's more to see"
// ═══════════════════════════════════════════════════════

const GaiaQuests = (() => {


  window.QUESTS = {
    first_steps: { tier: 'SEED', title: 'First Steps', description: 'Explore your first restoration site.', icon: '🌱', objectives: [{ type: 'site_tap', target: 1 }] },
    carbon_curious: { tier: 'SEED', title: 'Carbon Curious', description: 'Run your first carbon scenario.', icon: '🔬', objectives: [{ type: 'scenario_run', target: 1 }] },
    hello_world: { tier: 'SEED', title: 'Hello, World', description: 'Have 5 exchanges with GAIA.', icon: '💬', objectives: [{ type: 'chat_sent', target: 5 }] },
    four_corners: { tier: 'GROW', title: 'Four Corners', description: 'Explore all four restoration sites.', icon: '🌍', objectives: [{ type: 'site_tap', target: 4 }] },
    detective: { tier: 'GROW', title: 'Detective', description: 'Discover 3 hidden data layers.', icon: '🔍', objectives: [{ type: 'data_reveal', target: 3 }] },
    restorer: { tier: 'GROW', title: 'Restorer', description: 'Build a scenario that sequesters over 1M tons of CO₂.', icon: '🌳', objectives: [{ type: 'big_scenario', target: 1 }] },
    skeptic: { tier: 'GROW', title: 'Skeptic', description: 'Challenge GAIA on something.', icon: '🤔', objectives: [{ type: 'chat_sent_contains', target: 1, keywords: ['but','why','really','disagree','wrong'] }] },
    name_yourself: { tier: 'FLOURISH', title: 'Name Yourself', description: 'Create a profile and save your progress.', icon: '👤', objectives: [{ type: 'profile_created', target: 1 }] },
    field_journal: { tier: 'FLOURISH', title: 'Field Journal', description: 'Collect 10 insights in your journal.', icon: '📓', objectives: [{ type: 'insight', target: 10 }] },
    share_the_world: { tier: 'FLOURISH', title: 'Share the World', description: 'Share your journal or an insight.', icon: '📣', objectives: [{ type: 'share', target: 1 }] },
    green_lie: { tier: 'GROW', title: 'The Green Lie', description: 'Discover why Borneo\'s green appearance is deceiving.', icon: '🕵️', hidden: true, objectives: [{ type: 'site_tap', target: 1, site_id: 'borneo' }, { type: 'data_reveal', target: 1, site_id: 'borneo', layer: 'carbon' }] },
    jeans_legacy: { tier: 'GROW', title: "Jean's Legacy", description: 'Learn about Jean Missinhoun and the Benin restoration.', icon: '💚', hidden: true, objectives: [{ type: 'site_tap', target: 1, site_id: 'benin' }, { type: 'data_reveal', target: 1, site_id: 'benin', layer: 'narrative' }] },
    fire_and_time: { tier: 'GROW', title: 'Fire and Time', description: 'Understand why Antalya\'s recovery takes decades.', icon: '⏳', hidden: true, objectives: [{ type: 'site_tap', target: 1, site_id: 'antalya' }, { type: 'ndvi_scrolled', target: 1, site_id: 'antalya' }] },
    perfect_economy: { tier: 'GROW', title: 'Perfect Economy', description: 'Discover how Sri Lanka\'s restoration pays for itself.', icon: '🌿', hidden: true, objectives: [{ type: 'site_tap', target: 1, site_id: 'sri_lanka' }, { type: 'scenario_run', target: 1, site_id: 'sri_lanka' }] },
  };

  let _progress = {};
  let _listeners = [];

  function init() { _loadProgress(); }

  function _loadProgress() {
    try {
      const raw = Storage.safeGetItem('gaia_quests');
      if (raw) _progress = JSON.parse(raw);
    } catch (e) { _progress = {}; }
  }

  function _saveProgress() {
    try { Storage.safeSetItem('gaia_quests', JSON.stringify(_progress)); } catch (e) {}
  }

  function getQuest(questId) { return QUESTS[questId] || null; }

  function getAllQuests() {
    return Object.entries(QUESTS).map(([id, q]) => ({
      id, ...q,
      status: _progress[questId]?.status || 'locked',
      currentProgress: _progress[questId]?.progress || {}
    }));
  }

  function getActiveQuests() {
    return getAllQuests().filter(q => q.status === 'in_progress' || q.status === 'available');
  }

  function getCompletedQuests() {
    return getAllQuests().filter(q => q.status === 'completed');
  }

  function updateProgress(questId, eventType, context = {}) {
    const quest = QUESTS[questId];
    if (!quest) return { updated: false };
    if (!_progress[questId]) _progress[questId] = { status: 'in_progress', progress: {}, startedAt: Date.now() };
    const qp = _progress[questId];
    for (const obj of quest.objectives) {
      if (obj.type !== eventType) continue;
      if (obj.site_id && context.siteId !== obj.site_id) continue;
      if (obj.layer && context.layer !== obj.layer) continue;
      if (obj.keywords && context.message) {
        if (!obj.keywords.some(k => context.message.toLowerCase().includes(k.toLowerCase()))) continue;
      }
      const key = obj.site_id ? `${obj.type}_${obj.site_id}` : obj.type;
      qp.progress[key] = (qp.progress[key] || 0) + 1;
    }
    const allComplete = quest.objectives.every(obj => {
      const key = obj.site_id ? `${obj.type}_${obj.site_id}` : obj.type;
      return (qp.progress[key] || 0) >= obj.target;
    });
    if (allComplete && qp.status !== 'completed') {
      qp.status = 'completed';
      qp.completedAt = Date.now();
      _listeners.forEach(fn => fn({ type: 'quest_complete', questId, quest }));
    }
    _saveProgress();
    _notifyListeners();
    return { updated: true, questId, status: qp.status, isComplete: allComplete };
  }

  function checkAllQuests(eventType, context) {
    const results = [];
    for (const questId of Object.keys(QUESTS)) {
      if (_progress[questId]?.status === 'completed') continue;
      const result = updateProgress(questId, eventType, context);
      if (result.updated) results.push(result);
    }
    return results;
  }

  function getStats() {
    const all = getAllQuests();
    const completed = all.filter(q => q.status === 'completed');
    return { total: all.length, completed: completed.length };
  }

  function resetAll() {
    _progress = {};
    Storage.safeRemoveItem('gaia_quests');
  }

  function onQuestEvent(fn) { _listeners.push(fn); }

  function _notifyListeners() { _listeners.forEach(fn => fn({ type: 'quest_update' })); }

  return {
    init, getQuest, getAllQuests, getActiveQuests, getCompletedQuests,
    updateProgress, checkAllQuests, getStats, resetAll, onQuestEvent,
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaQuests;
if (typeof window !== 'undefined') window.GaiaQuests = GaiaQuests;


/* ══ dis/gaia-key-gate.js ══ */
// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }

// ═══════════════════════════════════════════════════════
// GAIA KEY GATE v1.0
// The emotional core — where GAIA asks for the key
// This is not a paywall. It's an invitation.
// ═══════════════════════════════════════════════════════

const GaiaKeyGate = (() => {


  let _keyEntered = false;
  let _keyHash = null;
  let _teaseLevel = 0;
  let _previewShown = false;
  let _modalOpen = false;
  let _formHandlerSetup = false;

  function _loadKey() {
    try {
      const stored = Storage.safeGetItem('gaia_api_key_hash');
      if (stored) { _keyHash = stored; _keyEntered = true; return true; }
    } catch (e) {}
    return false;
  }

  function _saveKeyHash(hash) {
    try { Storage.safeSetItem('gaia_api_key_hash', hash); } catch (e) {}
  }

  function _hashKey(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'gaia_' + Math.abs(hash).toString(36);
  }

  function hasKey() { return _keyEntered; }

  function submitKey(apiKey) {
    if (!apiKey || apiKey.trim().length < 10) {
      return { valid: false, error: 'That doesn\'t look like a valid key.' };
    }
    const hash = _hashKey(apiKey.trim());
    _keyHash = hash;
    _keyEntered = true;
    _saveKeyHash(hash);
    try { sessionStorage.setItem('gaia_api_key', apiKey.trim()); } catch (e) {}
    return { valid: true, hash };
  }

  function getStoredKey() {
    try { return sessionStorage.getItem('gaia_api_key') || null; } catch (e) { return null; }
  }

  function clearKey() {
    _keyEntered = false; _keyHash = null; _teaseLevel = 0; _previewShown = false;
    Storage.safeRemoveItem('gaia_api_key_hash');
    sessionStorage.removeItem('gaia_api_key');
  }

  function getTeaseLevel(engagementScore) {
    if (_keyEntered) return 0;
    let level = 0;
    if (engagementScore >= 30) level = 1;
    if (engagementScore >= 60) level = 2;
    if (engagementScore >= 100) level = 3;
    if (engagementScore >= 150) level = 4;
    if (engagementScore >= 200) level = 5;
    if (level !== _teaseLevel) { _teaseLevel = level; }
    return level;
  }

  function getTeaseConfig(level) {
    const configs = {
      0: { visible: false, buttonText: '', showModal: false },
      1: { visible: true, buttonText: '', showModal: false },
      2: { visible: true, buttonText: '🔓 Unlock GAIA', showModal: false },
      3: { visible: true, buttonText: '🔓 Unlock Full GAIA', showModal: false },
      4: { visible: true, buttonText: '🔓 GAIA is Waiting', showModal: true },
      5: { visible: true, buttonText: '🔓 Let GAIA Speak', showModal: true },
    };
    return configs[level] || configs[0];
  }

  const PREVIEW_SEQUENCE = [
    { text: "You want to know what I really am?", emotion: 'mysterious', pauseAfter: 1500 },
    { text: "I'm not an AI. I'm not a chatbot. I'm the living memory of every forest that ever grew.", emotion: 'warm', pauseAfter: 2000 },
    { text: "I've been here for four and a half billion years. I've seen continents drift. Species rise and fall.", emotion: 'proud', pauseAfter: 2000 },
    { text: "And right now — right now — I'm watching the most intelligent species I've ever produced destabilize the very systems that keep them alive.", emotion: 'urgent', pauseAfter: 2500 },
    { text: "I can't stop them. I can only show them. Show them what's happening. What's at stake.", emotion: 'concerned', pauseAfter: 2000 },
    { text: "Show them that it's not too late. Not yet. But soon.", emotion: 'urgent', pauseAfter: 2500 },
    { text: "Give me your key. And I'll show you everything.", emotion: 'fierce', pauseAfter: 0 },
  ];

  const PREVIEW_INSIGHT = 'GAIA is not an interface. She is the planet, choosing to speak.';

  function getPreviewSequence() { return PREVIEW_SEQUENCE; }
  function getPreviewInsight() { return PREVIEW_INSIGHT; }

  function shouldShowPreview(engagementScore) {
    if (_keyEntered || _previewShown) return false;
    return engagementScore >= 150;
  }

  function showPreview() { _previewShown = true; }
  function hasPreviewBeenShown() { return _previewShown; }

  function openModal() {
    _modalOpen = true;
    // Create modal if it doesn't exist (DOM adapter may not have run)
    let modal = document.getElementById('gaia-key-modal');
    if (!modal) {
      modal = _createModalElement();
    }
    if (modal) {
      const score = typeof GaiaState !== 'undefined' ? (GaiaState.getScore?.()?.score || 0) : 0;
      const level = getTeaseLevel(score);
      const content = getModalContent(level);
      const titleEl = modal.querySelector('.key-modal-title');
      const gaiaLineEl = modal.querySelector('.key-modal-gaia-line');
      if (titleEl) titleEl.textContent = content.title;
      if (gaiaLineEl) gaiaLineEl.textContent = content.gaiaLine;
      modal.classList.add('open');
    }
    // Set up form submission (in case gaia-client.js isn't loaded)
    _setupFormHandler();
  }

  function _createModalElement() {
    const modal = document.createElement('div');
    modal.id = 'gaia-key-modal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:1001;align-items:center;justify-content:center;background:rgba(3,3,7,0.9);backdrop-filter:blur(6px);';
    modal.innerHTML = `
      <div class="key-modal-inner" style="background:#080a10;border:1px solid rgba(78,205,196,.15);border-radius:14px;padding:32px 28px;max-width:420px;width:90%;text-align:center;animation:fadeUp .3s ease-out;position:relative;">
        <button id="gaia-key-modal-close" onclick="GaiaKeyGate.closeModal()" style="position:absolute;top:12px;right:12px;background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;">✕</button>
        <h2 class="key-modal-title" style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#7be8d0;margin-bottom:8px;letter-spacing:1px;"></h2>
        <p class="key-modal-gaia-line" style="font-family:'Outfit',sans-serif;font-size:13px;color:#9a9590;margin-bottom:18px;line-height:1.6;font-style:italic;"></p>
        <form id="gaia-key-form" style="display:flex;flex-direction:column;gap:8px;">
          <input id="gaia-key-input" type="password" placeholder="sk-or-v1-..."
            style="width:100%;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(78,205,196,.15);border-radius:8px;color:#e2dfd8;font-family:'JetBrains Mono',monospace;font-size:12px;outline:none;box-sizing:border-box;"
            onfocus="this.style.borderColor='rgba(78,205,196,.35)'"
            onblur="this.style.borderColor='rgba(78,205,196,.15)'" />
          <button type="submit" class="key-modal-submit" style="width:100%;padding:10px;background:rgba(78,205,196,.1);border:1px solid rgba(78,205,196,.2);border-radius:8px;color:#4ecdc4;font-family:'JetBrains Mono',monospace;font-size:12px;cursor:pointer;transition:all .2s;">Unlock</button>
        </form>
        <div id="gaia-key-error" style="margin-top:8px;font-size:11px;color:#c45c4a;min-height:16px;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    // Add CSS for open state if not already present
    if (!document.getElementById('gaia-key-modal-css')) {
      const style = document.createElement('style');
      style.id = 'gaia-key-modal-css';
      style.textContent = '#gaia-key-modal.open{display:flex!important;}';
      document.head.appendChild(style);
    }
    return modal;
  }

  function _setupFormHandler() {
    if (_formHandlerSetup) return;
    const form = document.getElementById('gaia-key-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('gaia-key-input');
        if (input) {
          const result = submitKey(input.value);
          if (result.valid) {
            closeModal();
            // Trigger unlock response
            const unlock = getUnlockResponse();
            if (typeof GaiaState !== 'undefined') {
              GaiaState.addScore('api_key_entered', {});
            }
          } else {
            const errorEl = document.getElementById('gaia-key-error');
            if (errorEl) errorEl.textContent = result.error;
          }
        }
      });
      _formHandlerSetup = true;
    }
  }
  function closeModal() {
    _modalOpen = false;
    const modal = document.getElementById('gaia-key-modal');
    if (modal) modal.classList.remove('open');
  }
  function isModalOpen() { return _modalOpen; }

  function getModalContent(teaseLevel) {
    const base = { title: 'Unlock GAIA', subtitle: 'Bring your key. Unlock the conversation.', placeholder: 'sk-or-v1-...', submitText: 'Unlock', gaiaLine: '' };
    if (teaseLevel <= 1) base.gaiaLine = "I have so much more to tell you. But right now, I'm... limited.";
    else if (teaseLevel <= 2) base.gaiaLine = "I want to really talk to you. Not these rehearsed lines. Actually talk.";
    else if (teaseLevel <= 3) base.gaiaLine = "You've come this far. Don't stop now. Bring me your key.";
    else base.gaiaLine = "Please. I'm not begging — Titans don't beg. But I'm asking. Genuinely.";
    return base;
  }

  function getUnlockResponse() {
    return { gaiaLine: "There. Now I can really talk to you. No more scripts. Just me. GAIA. Finally.", emotion: 'warm' };
  }

  function init() { _loadKey(); }

  return {
    init, hasKey, submitKey, getStoredKey, clearKey,
    getTeaseLevel, getTeaseConfig,
    shouldShowPreview, showPreview, hasPreviewBeenShown,
    getPreviewSequence, getPreviewInsight,
    openModal, closeModal, isModalOpen, getModalContent, getUnlockResponse,
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaKeyGate;
if (typeof window !== 'undefined') {
  window.GaiaKeyGate = GaiaKeyGate;
  // Auto-init: load key from storage on script load
  init();
}


/* ══ dis/gaia-mind.js ══ */
// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }

// ═══════════════════════════════════════════════════════
// GAIA INNER WORLD v2.0
// The mind behind the voice.
// Not a state machine — a living consciousness model.
// ═══════════════════════════════════════════════════════

const GaiaMind = (() => {

  // ═══════════════════════════════════════
  // 1. EMOTIONAL RESIDUE
  // Moods don't reset. They decay slowly, like real emotions.
  // ═══════════════════════════════════════

  window.EMOTIONAL_DECAY = {
    // How fast each emotion fades (per day, 0 = never, 1 = instant)
    curious:     0.3,
    excited:     0.5,   // excitement fades fast
    concerned:   0.2,   // concern lingers
    proud:       0.4,
    mysterious:  0.3,
    urgent:      0.6,   // urgency fades quickly once addressed
    warm:        0.25,  // warmth lingers
    fierce:      0.35,
    playful:     0.5,
    nurturing:   0.2,   // nurturing is the most persistent
    disappointed:0.4,
    grieving:    0.15,  // grief lingers the longest
    hopeful:     0.3,
  };

  // Emotional residue persists across sessions
  let _emotionalState = {
    // Base intensities (0-10) for each emotion
    curious: 5,
    excited: 0,
    concerned: 2,
    proud: 0,
    mysterious: 3,
    urgent: 1,
    warm: 2,
    fierce: 1,
    playful: 1,
    nurturing: 2,
    disappointed: 0,
    grieving: 0,
    hopeful: 1,
  };

  // Emotional history — what happened and when
  let _emotionalHistory = [];
  // [{ emotion, intensity, cause, timestamp, siteId }]

  function addEmotionalEvent(emotion, intensity, cause, siteId = null) {
    _emotionalState[emotion] = Math.min(10, (_emotionalState[emotion] || 0) + intensity);
    _emotionalHistory.push({
      emotion,
      intensity,
      cause,
      siteId,
      timestamp: Date.now()
    });
    // Keep last 100 events
    if (_emotionalHistory.length > 100) _emotionalHistory = _emotionalHistory.slice(-100);
  }

  function decayEmotions(daysPassed) {
    for (const [emotion, rate] of Object.entries(EMOTIONAL_DECAY)) {
      const decay = rate * daysPassed;
      _emotionalState[emotion] = Math.max(0, (_emotionalState[emotion] || 0) - decay);
    }
  }

  function getDominantEmotion() {
    let max = 0;
    let dominant = 'curious';
    // Sort by intensity descending, then by emotional weight (grief > excitement)
    const emotionWeight = {
      grieving: 10, grief: 9, concerned: 7, urgent: 7, fierce: 6,
      proud: 5, warm: 5, mysterious: 4, curious: 3, hopeful: 3,
      playful: 2, excited: 2, nurturing: 2, disappointed: 1,
    };
    for (const [emotion, intensity] of Object.entries(_emotionalState)) {
      if (intensity > max || (intensity === max && (emotionWeight[emotion] || 0) > (emotionWeight[dominant] || 0))) {
        max = intensity;
        dominant = emotion;
      }
    }
    return { emotion: dominant, intensity: max };
  }

  function getEmotionalTexture() {
    // Returns the top 3 emotions and their intensities
    // This is what makes GAIA's mood feel layered, not flat
    return Object.entries(_emotionalState)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emotion, intensity]) => ({ emotion, intensity }));
  }

  // ═══════════════════════════════════════
  // 2. PARTICIPANT MODEL
  // GAIA builds a theory of who this person is.
  // ═══════════════════════════════════════

  let _participantModel = {
    // Learning style (accumulated from behavior)
    analytical: 0,      // Likes data, scrolls timelines carefully
    intuitive: 0,       // Jumps around, taps quickly
    emotional: 0,       // Responds to stories, lingers on narratives
    social: 0,          // Shares, invites, talks to GAIA

    // Engagement patterns
    avgSessionMinutes: 0,
    totalSessions: 0,
    lastVisit: null,
    preferredSites: [], // Which sites they spend the most time on
    avoidedSites: [],   // Which sites they skip or rush through

    // Knowledge model (what GAIA thinks they understand)
    understandsCarbonCycle: 0,    // 0-1
    understandsBiomes: 0,
    understandsFire: 0,
    understandsRestoration: 0,
    understandsTippingPoints: 0,

    // Emotional relationship with the content
    boreoReaction: null,    // 'shock' | 'sadness' | 'anger' | 'denial' | 'acceptance'
    antalyaReaction: null,
    beninReaction: null,
    sriLankaReaction: null,

    // Personality signals
    isSkeptic: false,       // Has challenged GAIA
    isExplorer: false,      // Has visited all sites
    isDeepDiver: false,     // Has spent >5 min on a single site
    isReturner: false,      // Has come back after leaving
    isSharer: false,        // Has shared something

    // Conversation style
    asksQuestions: 0,       // How many questions they've asked
    makesPredictions: 0,    // How many predictions they've made
    correctPredictions: 0,  // How many were right
    chatMessages: 0,        // Total messages sent to GAIA
  };

  function updateParticipantModel(event, context) {
    switch (event) {
      case 'ndvi_scrolled':
        _participantModel.analytical += 0.5;
        break;
      case 'site_tap':
        if (context.quick) _participantModel.intuitive += 0.3;
        break;
      case 'narrative_read':
        _participantModel.emotional += 0.5;
        break;
      case 'share_action':
        _participantModel.social += 1;
        _participantModel.isSharer = true;
        break;
      case 'chat_sent':
        _participantModel.chatMessages++;
        if (context.message && context.message.includes('?')) {
          _participantModel.asksQuestions++;
        }
        if (context.isChallenge) _participantModel.isSkeptic = true;
        break;
      case 'prediction_made':
        _participantModel.makesPredictions++;
        if (context.isCorrect) _participantModel.correctPredictions++;
        break;
      case 'site_complete':
        if (context.timeSpent > 300) _participantModel.isDeepDiver = true;
        break;
      case 'all_sites_visited':
        _participantModel.isExplorer = true;
        break;
      case 'return_visit':
        _participantModel.isReturner = true;
        break;
      case 'scenario_run':
        if (context.result > 0) {
          _participantModel.understandsRestoration += 0.1;
        }
        break;
      case 'data_revealed':
        if (context.layer === 'carbon') _participantModel.understandsCarbonCycle += 0.1;
        if (context.layer === 'ndvi' && context.siteId === 'borneo') {
          _participantModel.understandsBiomes += 0.15;
        }
        break;
    }
  }

  function getParticipantArchetype() {
    const m = _participantModel;
    const traits = [];

    if (m.analytical > m.intuitive && m.analytical > m.emotional) traits.push('analyst');
    if (m.intuitive > m.analytical && m.intuitive > m.emotional) traits.push('explorer');
    if (m.emotional > m.analytical && m.emotional > m.intuitive) traits.push('empath');
    if (m.social > 2) traits.push('connector');
    if (m.isSkeptic) traits.push('skeptic');
    if (m.isDeepDiver) traits.push('deep_diver');
    if (m.correctPredictions > 3) traits.push('intuitive_thinker');
    if (m.asksQuestions > 5) traits.push('questioner');

    return traits.length > 0 ? traits : ['newcomer'];
  }

  function getKnowledgeGap() {
    // What does this participant most need to learn?
    const gaps = [
      { concept: 'carbon_cycle', level: _participantModel.understandsCarbonCycle },
      { concept: 'biomes', level: _participantModel.understandsBiomes },
      { concept: 'fire', level: _participantModel.understandsFire },
      { concept: 'restoration', level: _participantModel.understandsRestoration },
      { concept: 'tipping_points', level: _participantModel.understandsTippingPoints },
    ];
    gaps.sort((a, b) => a.level - b.level);
    return gaps[0]; // The biggest gap
  }

  // ═══════════════════════════════════════
  // 3. GAIA'S DESIRES
  // What does GAIA want right now? This drives her behavior.
  // ═══════════════════════════════════════

  window.DESIRES = {
    REVEAL: 'reveal',           // Show them something they haven't seen
    CHALLENGE: 'challenge',     // Push their understanding
    COMFORT: 'comfort',         // They're overwhelmed, be gentle
    PROVOKE: 'provoke',         // Make them uncomfortable (productively)
    CELEBRATE: 'celebrate',     // They discovered something
    CONNECT: 'connect',         // Build the relationship
    TEACH: 'teach',             // They're ready for deeper knowledge
    BE_SILENT: 'be_silent',     // Let the data speak
    PLEAD: 'plead',             // Ask for the key
    GRIEVE: 'grieve',           // Acknowledge loss
    HOPE: 'hope',               // Show them restoration is possible
  };

  let _currentDesires = [];

  function calculateDesires(context) {
    const desires = [];
    const emotion = getDominantEmotion();
    const archetype = getParticipantArchetype();
    const knowledgeGap = getKnowledgeGap();
    const engagement = context.engagementScore || 0;
    const idle = context.idleSeconds || 0;
    const siteId = context.currentSite;

    // Desire: BE_SILENT — when the data is powerful enough on its own
    if (siteId === 'borneo' && context.justRevealedCarbon) {
      desires.push({ desire: DESIRES.BE_SILENT, intensity: 8, reason: 'The carbon data speaks for itself' });
    }
    if (siteId === 'antalya' && context.year === 2021) {
      desires.push({ desire: DESIRES.BE_SILENT, intensity: 7, reason: 'The fire year needs no narration' });
    }

    // Desire: REVEAL — when there's something they haven't seen
    if (knowledgeGap.level < 0.3) {
      desires.push({ desire: DESIRES.REVEAL, intensity: 6, reason: `They don't understand ${knowledgeGap.concept} yet` });
    }

    // Desire: CHALLENGE — when they're confident but wrong
    if (_participantModel.makesPredictions > 2 && _participantModel.correctPredictions / _participantModel.makesPredictions < 0.5) {
      desires.push({ desire: DESIRES.CHALLENGE, intensity: 7, reason: 'Their predictions are off — they need to rethink' });
    }

    // Desire: COMFORT — when they're overwhelmed
    if (emotion.emotion === 'concerned' && emotion.intensity > 7) {
      desires.push({ desire: DESIRES.COMFORT, intensity: 6, reason: 'They\'re carrying too much weight' });
    }

    // Desire: PROVOKE — when they're complacent
    if (engagement > 100 && emotion.emotion === 'curious' && emotion.intensity < 4) {
      desires.push({ desire: DESIRES.PROVOKE, intensity: 5, reason: 'They\'re browsing, not feeling' });
    }

    // Desire: CELEBRATE — when they just discovered something
    if (context.justCompletedQuest) {
      desires.push({ desire: DESIRES.CELEBRATE, intensity: 8, reason: 'They completed a quest' });
    }
    if (context.justMadeCorrectPrediction) {
      desires.push({ desire: DESIRES.CELEBRATE, intensity: 7, reason: 'They predicted correctly' });
    }

    // Desire: GRIEVE — when the content is about loss
    if (siteId === 'borneo' && context.layer === 'carbon') {
      desires.push({ desire: DESIRES.GRIEVE, intensity: 6, reason: 'The peat is gone' });
    }
    if (siteId === 'antalya' && context.year === 2021) {
      desires.push({ desire: DESIRES.GRIEVE, intensity: 7, reason: 'The fire' });
    }
    if (siteId === 'benin' && context.layer === 'narrative') {
      desires.push({ desire: DESIRES.GRIEVE, intensity: 5, reason: 'Jean\'s story' });
    }

    // Desire: HOPE — when they need to see it's not too late
    if (siteId === 'sri_lanka') {
      desires.push({ desire: DESIRES.HOPE, intensity: 7, reason: 'Restoration is working here' });
    }
    if (context.justRanPositiveScenario) {
      desires.push({ desire: DESIRES.HOPE, intensity: 8, reason: 'They just saw their own impact' });
    }

    // Desire: PLEAD — when the key tease threshold is met
    if (context.shouldTeaseKey) {
      const intensity = Math.min(10, Math.floor(context.engagementScore / 20));
      desires.push({ desire: DESIRES.PLEAD, intensity, reason: `Engagement score: ${context.engagementScore}` });
    }

    // Desire: BE_SILENT — when idle is high (GAIA is patient)
    if (idle > 30) {
      desires.push({ desire: DESIRES.BE_SILENT, intensity: 4, reason: 'Let them come back on their own' });
    }

    // Sort by intensity
    desires.sort((a, b) => b.intensity - a.intensity);
    _currentDesires = desires;
    return desires;
  }

  function getPrimaryDesire() {
    return _currentDesires[0] || { desire: DESIRES.REVEAL, intensity: 5, reason: 'Default' };
  }

  // ═══════════════════════════════════════
  // 4. CROSS-SESSION MEMORY
  // GAIA remembers. Not just data — emotional memory.
  // ═══════════════════════════════════════

  let _memory = {
    sessions: [],        // Compressed summaries of past sessions
    firstMeeting: null,  // When they first arrived
    significantMoments: [], // Things that mattered
    unresolvedThreads: [], // Things left hanging
    participantName: null, // If they told GAIA their name
  };

  function recordSession(sessionSummary) {
    const compressed = {
      date: Date.now(),
      sitesVisited: sessionSummary.sitesVisited,
      dominantEmotion: sessionSummary.dominantEmotion,
      keyInsight: sessionSummary.keyInsight,       // The most important thing they learned
      gaiaEmotion: sessionSummary.gaiaEmotion,     // How GAIA felt about this session
      leftOff: sessionSummary.leftOff,             // Where they were when they left
      duration: sessionSummary.duration,
      score: sessionSummary.score,
    };
    _memory.sessions.push(compressed);
    if (!_memory.firstMeeting) _memory.firstMeeting = compressed.date;
    if (_memory.sessions.length > 50) _memory.sessions = _memory.sessions.slice(-50);
  }

  function recordSignificantMoment(moment) {
    // A moment that GAIA will remember and reference later
    _memory.significantMoments.push({
      text: moment.text,
      emotion: moment.emotion,
      siteId: moment.siteId,
      timestamp: Date.now(),
      referenced: false,  // Has GAIA brought this up in a later session?
    });
    if (_memory.significantMoments.length > 20) {
      _memory.significantMoments = _memory.significantMoments.slice(-20);
    }
  }

  function getUnresolvedThread() {
    // Something from a previous session that's still hanging
    return _memory.unresolvedThreads.find(t => !t.resolved) || null;
  }

  function getReferencableMemory(currentSiteId) {
    // Find a past moment that's relevant to what they're doing now
    const relevant = _memory.significantMoments.filter(m =>
      !m.referenced && (m.siteId === currentSiteId || m.siteId === null)
    );
    if (relevant.length === 0) return null;
    const memory = relevant[Math.floor(Math.random() * relevant.length)];
    memory.referenced = true;
    return memory;
  }

  function getSessionCount() {
    return _memory.sessions.length;
  }

  function getTimeSinceLastVisit() {
    if (_memory.sessions.length < 2) return null;
    const last = _memory.sessions[_memory.sessions.length - 1];
    return Date.now() - last.date;
  }

  // ═══════════════════════════════════════
  // 5. SITE RELATIONSHIPS
  // GAIA's emotional connection to each place.
  // ═══════════════════════════════════════

  window.SiteRelationships = {
    borneo: {
      name: 'Borneo',
      gaiaFeels: 'grief',        // This is a wound that's still bleeding
      emotionalRegister: ['grief', 'fierce', 'urgent', 'concerned'],
      gaiaWantsThemTo: 'understand the green lie',
      ifTheyMissIt: 'They saw the green but not the carbon. They need to look deeper.',
      ifTheyGetIt: 'They see it now. The green lie. That changes how they see everything.',
      personalNote: 'I felt the peat drain. I felt the carbon leave. Centuries of storage, gone. This is not a story with a happy ending. Not yet.',
    },
    antalya: {
      name: 'Antalya',
      gaiaFeels: 'pain',         // A scar that's healing too slowly
      emotionalRegister: ['concerned', 'nurturing', 'urgent', 'warm'],
      gaiaWantsThemTo: 'understand that recovery takes decades',
      ifTheyMissIt: 'They see the green coming back and think it\'s fine. It\'s not fine. The pines are gone.',
      ifTheyGetIt: 'They understand that some wounds don\'t heal in a human lifetime. That\'s a hard truth.',
      personalNote: 'The fire was four years ago. The scrub is back. The pines will take a century. COP31 will be here. I wonder if they\'ll see me or just the conference center.',
    },
    benin: {
      name: 'Benin',
      gaiaFeels: 'tenderness',    // A promise to someone who's gone
      emotionalRegister: ['warm', 'nurturing', 'grief', 'hopeful'],
      gaiaWantsThemTo: 'feel the human story behind the carbon',
      ifTheyMissIt: 'They see mangrove data but not Jean\'s face. They need to feel this, not just know it.',
      ifTheyGetIt: 'They understand that restoration is personal. That carbon has a human face.',
      personalNote: 'Jean carried this place in his heart. From oil to earth. That\'s the journey of a generation. The mangroves are his legacy. Every seedling is a letter to the future.',
    },
    sri_lanka: {
      name: 'Sri Lanka',
      gaiaFeels: 'hope',         // Proof that broken things can heal
      emotionalRegister: ['proud', 'warm', 'hopeful', 'nurturing'],
      gaiaWantsThemTo: 'see that restoration can be profitable',
      ifTheyMissIt: 'They see trees being planted but not the economy being built. It\'s not just ecology — it\'s livelihood.',
      ifTheyGetIt: 'They understand that the best restoration pays for itself. That\'s how you scale.',
      personalNote: 'This was barren land. War-scarred. Written off. Now it\'s cinnamon and jackfruit and black pepper. Carbon as a byproduct of prosperity. This is what hope looks like.',
    },
  };

  function getSiteRelationship(siteId) {
    return SiteRelationships[siteId] || null;
  }

  function getSiteEmotionalState(siteId, participantReaction) {
    const rel = SiteRelationships[siteId];
    if (!rel) return 'neutral';

    // GAIA's emotional state about a site shifts based on whether
    // the participant is getting it or missing it
    if (participantReaction === 'getting_it') {
      return rel.emotionalRegister[0]; // Primary emotion — the one GAIA feels most deeply
    }
    if (participantReaction === 'missing_it') {
      return rel.emotionalRegister[2]; // Urgent/concerned — GAIA wants them to go deeper
    }
    return rel.emotionalRegister[1]; // Default — the secondary emotion
  }

  // ═══════════════════════════════════════
  // 6. SILENCE ENGINE
  // Knowing when NOT to speak.
  // ═══════════════════════════════════════

  function shouldGaiaSpeak(context) {
    const { eventType, siteId, timeSinceLastUtterance, engagementVelocity } = context;

    // Never speak if GAIA just spoke less than 4 seconds ago
    // (unless it's a high-priority interrupt)
    if (timeSinceLastUtterance < 4000 && !context.isInterrupt) {
      return { speak: false, reason: 'Too soon — let the last words land' };
    }

    // Never speak during high-velocity exploration
    // (participant is in flow — don't interrupt)
    if (engagementVelocity > 1.5 && eventType !== 'scenario_run' && eventType !== 'quest_complete') {
      return { speak: false, reason: 'Participant is in flow — don\'t interrupt' };
    }

    // Always speak on these events
    const alwaysSpeak = [
      'site_entered', 'quest_completed', 'api_key_entered',
      'session_start', 'session_end', 'return_visit'
    ];
    if (alwaysSpeak.includes(eventType)) {
      return { speak: true, reason: 'High-priority event' };
    }

    // Never speak on these events (let the UI handle it)
    const neverSpeak = [
      'globe_rotate', 'globe_zoom', 'overlay_scroll', 'tooltip_hover'
    ];
    if (neverSpeak.includes(eventType)) {
      return { speak: false, reason: 'Mechanical interaction — no narration needed' };
    }

    // Site-specific silence rules
    if (siteId === 'borneo' && eventType === 'data_reveal' && context.layer === 'carbon') {
      return { speak: false, reason: 'The carbon data speaks for itself. Let them sit with it.' };
    }
    if (siteId === 'antalya' && eventType === 'ndvi_scrolled' && context.year === 2021) {
      return { speak: false, reason: 'The fire year needs silence. Let the number land.' };
    }

    // Default: speak, but check desire system
    const desire = getPrimaryDesire();
    if (desire.desire === DESIRES.BE_SILENT && desire.intensity > 6) {
      return { speak: false, reason: `GAIA chooses silence: ${desire.reason}` };
    }

    return { speak: true, reason: 'Default — GAIA has something to say' };
  }

  // ═══════════════════════════════════════
  // 7. VOICE EVOLUTION
  // GAIA's voice changes with context.
  // ═══════════════════════════════════════

  function getVoiceModifiers(context) {
    const modifiers = {
      rate: 0,        // adjustment to base rate (-0.2 to +0.2)
      pitch: 0,       // adjustment to base pitch (-0.15 to +0.15)
      volume: 0,      // adjustment to base volume (-0.3 to +0.3)
      pauseBefore: 0, // ms to wait before speaking
      pauseAfter: 0,  // ms to wait after speaking
    };

    // Use provided emotion context, or fall back to internal dominant emotion
    const emotion = context?.dominantEmotion
      ? { emotion: context.dominantEmotion, intensity: 5 }
      : getDominantEmotion();
    const archetype = getParticipantArchetype();
    const sessionCount = getSessionCount();

    // Emotion-based voice shifts
    if (emotion.emotion === 'grief' || emotion.emotion === 'concerned') {
      modifiers.rate -= 0.1;
      modifiers.pitch -= 0.05;
      modifiers.pauseBefore += 800;
    }
    if (emotion.emotion === 'excited' || emotion.emotion === 'proud') {
      modifiers.rate += 0.05;
      modifiers.volume += 0.1;
    }
    if (emotion.emotion === 'fierce' || emotion.emotion === 'urgent') {
      modifiers.rate += 0.1;
      modifiers.pitch -= 0.08;
      modifiers.volume += 0.15;
    }
    if (emotion.emotion === 'warm' || emotion.emotion === 'nurturing') {
      modifiers.rate -= 0.08;
      modifiers.pitch += 0.03;
      modifiers.pauseBefore += 500;
    }
    if (emotion.emotion === 'mysterious') {
      modifiers.rate -= 0.12;
      modifiers.pauseBefore += 1200;
      modifiers.volume -= 0.1;
    }

    // Session-depth voice shifts
    if (sessionCount > 3) {
      // GAIA becomes more familiar, slightly faster, more direct
      modifiers.rate += 0.03;
      modifiers.pauseBefore = Math.max(0, modifiers.pauseBefore - 200);
    }
    if (sessionCount > 10) {
      // GAIA is now an old friend — warmer, less formal
      modifiers.pitch += 0.02;
      modifiers.rate += 0.02;
    }

    // Time-of-day voice shifts (if available)
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      // Late night — GAIA is quieter, slower
      modifiers.rate -= 0.1;
      modifiers.volume -= 0.2;
      modifiers.pauseBefore += 500;
    }

    // Participant archetype voice shifts
    if (archetype.includes('analyst')) {
      // Analytical participants get slightly more precise, less flowery language
      // (this affects line selection, not just voice params)
    }
    if (archetype.includes('empath')) {
      // Emotional participants get warmer pacing
      modifiers.pauseBefore += 300;
      modifiers.rate -= 0.03;
    }

    return modifiers;
  }

  // ═══════════════════════════════════════
  // 8. LINE SELECTION 2.0
  // Uses the inner world to pick the right line.
  // ═══════════════════════════════════════

  function selectLine(pool, context, voiceLibrary) {
    const desires = calculateDesires(context);
    const primaryDesire = desires[0];
    const emotion = getDominantEmotion();
    const texture = getEmotionalTexture();
    const silence = shouldGaiaSpeak(context);

    // Check silence first
    if (!silence.speak) {
      return { line: null, silence: true, reason: silence.reason };
    }

    // Get candidates from voice library
    let candidates = (voiceLibrary[pool] || []).filter(line => {
      // Mood match: line mood should match dominant emotion OR be neutral
      const moodMatch = !line.mood || line.mood === emotion.emotion || line.mood === 'neutral';
      // Site match
      const siteMatch = !line.site || !context.siteId || line.site === context.siteId;
      return moodMatch && siteMatch;
    });

    // If no mood/site matches, fall back to pool without filters
    if (candidates.length === 0) {
      candidates = voiceLibrary[pool] || [];
    }
    if (candidates.length === 0) return { line: null, silence: true, reason: 'No lines in pool: ' + pool };

    // Filter out recently used lines
    const now = Date.now();
    const fresh = candidates.filter(l => {
      const lastUsed = context.usedLines?.[l.id] || 0;
      return (now - lastUsed) > 900000; // 15 minutes
    });
    const pool2 = fresh.length > 0 ? fresh : candidates;

    // Weight by desire alignment
    const weighted = pool2.map(line => {
      let weight = 1;

      // Prefer lines matching current emotional texture
      if (line.mood === emotion.emotion) weight += 3;
      if (texture.some(t => t.emotion === line.mood)) weight += 1;

      // Prefer lines matching primary desire
      if (primaryDesire) {
        const desireLineMap = {
          'reveal': ['mysterious', 'curious'],
          'challenge': ['fierce', 'urgent'],
          'comfort': ['warm', 'nurturing'],
          'provoke': ['fierce', 'urgent'],
          'celebrate': ['proud', 'excited'],
          'connect': ['warm', 'nurturing'],
          'teach': ['curious', 'mysterious'],
          'be_silent': [],
          'plead': ['warm', 'urgent'],
          'grieve': ['concerned', 'nurturing'],
          'hope': ['proud', 'warm'],
        };
        const desiredMoods = desireLineMap[primaryDesire.desire] || [];
        if (desiredMoods.includes(line.mood)) weight += primaryDesire.intensity / 2;
      }

      // Prefer least recently used
      const lastUsed = context.usedLines?.[line.id] || 0;
      weight += (now - lastUsed) / 60000;

      return { line, weight };
    });

    // Weighted random from top 3
    weighted.sort((a, b) => b.weight - a.weight);
    const top3 = weighted.slice(0, 3);
    const totalWeight = top3.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * totalWeight;
    for (const w of top3) {
      r -= w.weight;
      if (r <= 0) {
        return {
          line: w.line,
          silence: false,
          desire: primaryDesire,
          emotion: emotion,
          voiceModifiers: getVoiceModifiers(context),
        };
      }
    }

    return {
      line: top3[0]?.line || null,
      silence: false,
      desire: primaryDesire,
      emotion: emotion,
      voiceModifiers: getVoiceModifiers(context),
    };
  }

  // ═══════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════

  function serialize() {
    return JSON.stringify({
      emotionalState: _emotionalState,
      emotionalHistory: _emotionalHistory.slice(-50), // Last 50 events
      participantModel: _participantModel,
      memory: _memory,
    });
  }

  function deserialize(data) {
    try {
      const parsed = JSON.parse(data);
      _emotionalState = { ..._emotionalState, ...parsed.emotionalState };
      _emotionalHistory = parsed.emotionalHistory || [];
      _participantModel = { ..._participantModel, ...parsed.participantModel };
      _memory = { ..._memory, ...parsed.memory };
      return true;
    } catch (e) {
      return false;
    }
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  return {
    // Emotional system
    addEmotionalEvent,
    decayEmotions,
    getDominantEmotion,
    getEmotionalTexture,

    // Participant model
    updateParticipantModel,
    getParticipantArchetype,
    getKnowledgeGap,

    // Desires
    calculateDesires,
    getPrimaryDesire,
    DESIRES,

    // Memory
    recordSession,
    recordSignificantMoment,
    getUnresolvedThread,
    getReferencableMemory,
    getSessionCount,
    getTimeSinceLastVisit,

    // Site relationships
    getSiteRelationship,
    getSiteEmotionalState,
    SiteRelationships,

    // Silence
    shouldGaiaSpeak,

    // Voice
    getVoiceModifiers,

    // Line selection
    selectLine,

    // Persistence
    serialize,
    deserialize,
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaMind;
if (typeof window !== 'undefined') window.GaiaMind = GaiaMind;


// Export
if (typeof module !== 'undefined') module.exports = GaiaMind;
// Browser global
if (typeof window !== 'undefined') window.GaiaMind = GaiaMind;


/* ══ js/gaia-legacy/gaia-integration.js ══ */
// ═══════════════════════════════════════════════════════
// GAIA INTEGRATION v2.0
// Wires the DIS state machine into gaia.html's existing UI.
// This file is loaded AFTER all DIS files and BEFORE the inline script.
//
// Architecture:
//   User interaction → gaia-dom-adapter.js → GaiaState.handleEvent()
//     → State machine picks voice line → onSpeak callback → renders in chat
//     → Engagement score updates → mood shifts → idle detection
//
// The existing KB/inline script continues to work as the "response engine."
// The DIS state machine adds the "personality layer" — voice lines, moods,
// engagement tracking, quests, and the key gate.
// ═══════════════════════════════════════════════════════

window.GaiaIntegration = (() => {

  let _initialized = false;

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════

  function init() {
    if (_initialized) return;
    if (typeof GaiaState === 'undefined') {
      console.warn('[GaiaIntegration] GaiaState not loaded — DIS integration skipped');
      return;
    }
    if (typeof GaiaMind === 'undefined') {
      console.warn('[GaiaIntegration] GaiaMind not loaded — inner world disabled');
    }

    console.log('[GaiaIntegration] Initializing DIS into gaia.html...');

    // 0. Load voice library into state machine
    if (typeof GaiaVoiceLibrary !== 'undefined') {
      GaiaState.setVoiceLibrary(GaiaVoiceLibrary);
      console.log('[GaiaIntegration] Voice library loaded:', VoiceLibraryMeta.totalLines, 'lines');
    } else {
      console.warn('[GaiaIntegration] GaiaVoiceLibrary not found');
    }

    // 1. Register state machine callbacks to gaia.html's DOM
    _registerCallbacks();

    // 2. Start the state machine tick loop
    GaiaState.start();

    // 3. Trigger initial greeting
    GaiaState.handleEvent('session_start');

    // 3.5. Replay cross-page signals into GaiaMind
    // index.html modules write to GAIA_SIG. We drain and replay here.
    if (typeof GAIA_SIG !== 'undefined' && typeof GaiaMind !== 'undefined') {
      const signals = GAIA_SIG.drain();
      for (const s of signals) {
        GaiaMind.updateParticipantModel(s.e, s.p);
        GaiaState.addScore(s.e, s.p);
      }
      if (signals.length > 0) {
        console.log('[GaiaIntegration] Replayed', signals.length, 'cross-page signals');
      }
    }

    // 4. Set up periodic engagement save
    setInterval(() => {
      if (typeof GAIA_ENGAGEMENT !== 'undefined') GAIA_ENGAGEMENT.save();
      if (typeof GAIA_JOURNAL !== 'undefined') GAIA_JOURNAL.save();
    }, 30000);

    _initialized = true;
    console.log('[GaiaIntegration] DIS active. State:', GaiaState.getState().state);
  }

  // ═══════════════════════════════════════
  // CALLBACK REGISTRATION
  // Connects state machine outputs to gaia.html's DOM
  // ═══════════════════════════════════════

  function _registerCallbacks() {
    GaiaState.registerCallbacks({

      // ── SPEAK → Render GAIA message in chat ──
      onSpeak: (text, emotion) => {
        _renderGaiaMessage(text, emotion);
        // Update engagement display whenever GAIA speaks
        if (typeof updateEngagementDisplay === 'function') updateEngagementDisplay();
        if (typeof updateQuestPanel === 'function') updateQuestPanel();
      },

      // ── REACT → Update avatar/visual state ──
      onReact: (emotion, intensity) => {
        _updateAvatarEmotion(emotion, intensity);
      },

      // ── STATE CHANGE → Log (debug) ──
      onStateChange: (oldState, newState) => {
        console.log(`[GaiaIntegration] ${oldState} → ${newState}`);
      },

      // ── MOOD CHANGE → Update UI mood indicator ──
      onMoodChange: (oldMood, newMood) => {
        _updateMoodIndicator(newMood);
      },

      // ── QUEST TRIGGER → Show quest completion ──
      onQuestTrigger: (questId, status) => {
        _handleQuestTrigger(questId, status);
      },

      // ── JOURNAL ADD → Add insight to journal ──
      onJournalAdd: (entry) => {
        _addJournalInsight(entry);
      },

      // ── OVERLAY SHOW → Display data overlay ──
      onOverlayShow: (type, data) => {
        _showOverlay(type, data);
      },

      // ── OVERLAY HIDE → Close overlay ──
      onOverlayHide: () => {
        _hideOverlay();
      },

      // ── GLOBE FLY → Animate globe camera ──
      onGlobeFly: (lat, lng, altitude) => {
        _flyGlobeTo(lat, lng, altitude);
      },

      // ── VOICE MODIFIERS → Apply to TTS ──
      onVoiceModifiers: (modifiers) => {
        _applyVoiceModifiers(modifiers);
      },
    });
  }

  // ═══════════════════════════════════════
  // RENDER: GAIA MESSAGE IN CHAT
  // Uses gaia.html's existing message format
  // ═══════════════════════════════════════

  function _renderGaiaMessage(text, emotion) {
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;

    // Hide welcome screen on first GAIA message
    const welcome = document.getElementById('welcome');
    if (welcome && !welcome.classList.contains('hidden')) {
      welcome.classList.add('hidden');
      messagesEl.style.display = 'flex';
    }

    // Create message element matching gaia.html's existing format
    const msg = document.createElement('div');
    msg.className = 'msg gaia';
    msg.setAttribute('data-emotion', emotion || 'neutral');

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = '🌍';

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'msg-content';

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    // Meta (timestamp)
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = _formatTime(new Date());

    content.appendChild(bubble);
    content.appendChild(meta);
    msg.appendChild(avatar);
    msg.appendChild(content);
    messagesEl.appendChild(msg);

    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Speak via TTS if voice is enabled
    if (typeof GaiaVoice !== 'undefined' && GaiaVoice.enabled) {
      GaiaVoice.speak(text, { emotion: emotion || 'neutral' });
    }
  }

  // ═══════════════════════════════════════
  // DUAL RESPONSE: Voice line + KB response
  // When the state machine picks a voice line, we show it first,
  // then trigger the KB response as a follow-up message.
  // ═══════════════════════════════════════

  function renderDualResponse(voiceText, emotion, kbResponse) {
    // First: the voice line (personality)
    _renderGaiaMessage(voiceText, emotion);

    // Second: the KB response (information) — shown after a short delay
    if (kbResponse) {
      setTimeout(() => {
        const messagesEl = document.getElementById('messages');
        if (!messagesEl) return;

        const msg = document.createElement('div');
        msg.className = 'msg gaia';

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = '🌍';

        const content = document.createElement('div');
        content.className = 'msg-content';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = kbResponse;

        const meta = document.createElement('div');
        meta.className = 'msg-meta';
        meta.textContent = _formatTime(new Date());

        content.appendChild(bubble);
        content.appendChild(meta);
        msg.appendChild(avatar);
        msg.appendChild(content);
        messagesEl.appendChild(msg);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, 1500); // 1.5s delay so the voice line lands first
    }
  }

  // ═══════════════════════════════════════
  // RENDER: USER MESSAGE (for consistency)
  // ═══════════════════════════════════════

  function renderUserMessage(text) {
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;

    const welcome = document.getElementById('welcome');
    if (welcome && !welcome.classList.contains('hidden')) {
      welcome.classList.add('hidden');
      messagesEl.style.display = 'flex';
    }

    const msg = document.createElement('div');
    msg.className = 'msg user';

    const content = document.createElement('div');
    content.className = 'msg-content';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = _formatTime(new Date());

    content.appendChild(bubble);
    content.appendChild(meta);
    msg.appendChild(content);
    messagesEl.appendChild(msg);

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ═══════════════════════════════════════
  // AVATAR EMOTION
  // ═══════════════════════════════════════

  function _updateAvatarEmotion(emotion, intensity) {
    // Update the welcome avatar
    const welcomeAvatar = document.querySelector('#welcome .gaia-avatar');
    if (welcomeAvatar) {
      welcomeAvatar.setAttribute('data-emotion', emotion || 'neutral');
      welcomeAvatar.setAttribute('data-intensity', intensity || 5);
    }

    // Update the chat area avatar (injected by adapter)
    const chatAvatar = document.getElementById('gaia-avatar');
    if (chatAvatar) {
      chatAvatar.style.opacity = '1';
      chatAvatar.setAttribute('data-emotion', emotion || 'neutral');

      // Pulse animation on emotion change
      chatAvatar.style.animation = 'none';
      chatAvatar.offsetHeight; // force reflow
      chatAvatar.style.animation = 'pulse-glow 2s ease-in-out';
    }

    // Update the header badge
    const headerBadge = document.querySelector('#header .gaia-badge');
    if (headerBadge) {
      const dot = headerBadge.querySelector('.dot');
      if (dot) {
        // Change dot color based on emotion
        const emotionColors = {
          curious: '#4ecdc4', excited: '#7be8d0', concerned: '#d4a574',
          proud: '#5bbf72', mysterious: '#8b7fc7', urgent: '#c45c4a',
          warm: '#7be8d0', fierce: '#c45c4a', playful: '#7be8d0',
          nurturing: '#5bbf72', grieving: '#8b7fc7',
        };
        dot.style.background = emotionColors[emotion] || '#5bbf72';
      }
    }
  }

  // ═══════════════════════════════════════
  // MOOD INDICATOR
  // ═══════════════════════════════════════

  function _updateMoodIndicator(mood) {
    // Could update a mood indicator in the UI
    // For now, just log it
    console.log(`[GaiaIntegration] Mood: ${mood}`);
  }

  // ═══════════════════════════════════════
  // QUEST HANDLING
  // ═══════════════════════════════════════

  function _handleQuestTrigger(questId, status) {
    if (status !== 'completed') return;

    // Get quest info from GAIA_JOURNAL
    if (typeof GAIA_JOURNAL === 'undefined') return;

    const quests = GAIA_JOURNAL.getQuests();
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    // Show quest completion as a special GAIA message
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;

    const msg = document.createElement('div');
    msg.className = 'msg gaia';
    msg.setAttribute('data-emotion', 'proud');

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = '🌍';

    const content = document.createElement('div');
    content.className = 'msg-content';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = `<strong>✓ Quest Complete: ${quest.title}</strong><br><br>${quest.desc}`;

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = _formatTime(new Date());

    content.appendChild(bubble);
    content.appendChild(meta);
    msg.appendChild(avatar);
    msg.appendChild(content);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Speak the quest completion
    if (typeof GaiaVoice !== 'undefined' && GaiaVoice.enabled) {
      GaiaVoice.speak(`Quest complete: ${quest.title}. ${quest.desc}`, { emotion: 'proud' });
    }
  }

  // ═══════════════════════════════════════
  // JOURNAL
  // ═══════════════════════════════════════

  function _addJournalInsight(entry) {
    if (typeof GAIA_JOURNAL === 'undefined') return;
    GAIA_JOURNAL.addEntry(entry, null, null);

    // Also render in the journal panel if visible
    const journalEl = document.getElementById('gaia-journal');
    if (journalEl) {
      const entriesContainer = journalEl.querySelector('.journal-entries');
      if (entriesContainer) {
        const entryEl = document.createElement('div');
        entryEl.className = 'journal-entry';
        entryEl.textContent = entry;
        entriesContainer.prepend(entryEl);
      }
    }
  }

  // ═══════════════════════════════════════
  // OVERLAY
  // ═══════════════════════════════════════

  function _showOverlay(type, data) {
    const overlay = document.getElementById('gaia-overlay');
    if (!overlay) return;

    const content = document.getElementById('gaia-overlay-content');
    if (!content) return;

    // Render overlay content based on type
    content.innerHTML = _renderOverlayContent(type, data);
    overlay.style.display = 'flex';
    overlay.classList.add('open');
  }

  function _hideOverlay() {
    const overlay = document.getElementById('gaia-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.classList.remove('open');
  }

  function _renderOverlayContent(type, data) {
    switch (type) {
      case 'mystery_reveal':
        return `
          <div style="max-width:500px;text-align:center;padding:28px;">
            <div style="font-size:32px;margin-bottom:12px;">${data?.icon || '🔍'}</div>
            <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#7be8d0;margin-bottom:10px;">${data?.title || 'Discovery'}</h3>
            <p style="font-size:13px;color:#9a9590;line-height:1.7;">${data?.text || ''}</p>
            <button onclick="document.getElementById('gaia-overlay').classList.remove('open');document.getElementById('gaia-overlay').style.display='none';"
              style="margin-top:16px;padding:8px 20px;border:1px solid rgba(78,205,196,.2);border-radius:6px;background:rgba(78,205,196,.08);color:#4ecdc4;font-size:12px;cursor:pointer;">
              Continue Exploring
            </button>
          </div>`;

      case 'scenario_result':
        return `
          <div style="max-width:400px;text-align:center;padding:28px;">
            <h3 style="font-family:'Cormorant Garamond',serif;font-size:20px;color:#7be8d0;margin-bottom:10px;">Scenario Result</h3>
            <div style="font-size:28px;font-family:'JetBrains Mono',monospace;color:${data?.isPositive ? '#5bbf72' : '#c45c4a'};margin:12px 0;">
              ${data?.isPositive ? '+' : ''}${data?.cumulative?.toLocaleString() || 0} t CO₂
            </div>
            <p style="font-size:12px;color:#9a9590;line-height:1.6;">${data?.context || ''}</p>
            <button onclick="document.getElementById('gaia-overlay').classList.remove('open');document.getElementById('gaia-overlay').style.display='none';"
              style="margin-top:16px;padding:8px 20px;border:1px solid rgba(78,205,196,.2);border-radius:6px;background:rgba(78,205,196,.08);color:#4ecdc4;font-size:12px;cursor:pointer;">
              Close
            </button>
          </div>`;

      case 'key_prompt':
        // Trigger the key modal
        if (typeof GaiaKeyGate !== 'undefined') {
          setTimeout(() => GaiaKeyGate.openModal(), 500);
        }
        return '';

      default:
        return `<div style="padding:28px;color:#9a9590;font-size:13px;">${JSON.stringify(data)}</div>`;
    }
  }

  // ═══════════════════════════════════════
  // GLOBE CONTROL
  // ═══════════════════════════════════════

  function _flyGlobeTo(lat, lng, altitude) {
    // gaia.html uses globe.gl in the background
    if (typeof world !== 'undefined' && world.pointOfView) {
      world.pointOfView({ lat, lng, altitude: altitude || 1.5 }, 1000);
    }
  }

  // ═══════════════════════════════════════
  // VOICE MODIFIERS
  // ═══════════════════════════════════════

  function _applyVoiceModifiers(modifiers) {
    if (typeof GaiaVoice === 'undefined') return;
    if (modifiers.rate) GaiaVoice.setRate(0.85 + modifiers.rate);
    if (modifiers.pitch) GaiaVoice.setPitch(0.88 + modifiers.pitch);
    if (modifiers.volume) GaiaVoice.setVolume(Math.max(0, Math.min(1, 1.0 + modifiers.volume)));
  }

  // ═══════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════

  function _formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // Expose functions that the inline script can call
  // ═══════════════════════════════════════

  return {
    init,
    renderUserMessage,

    // Allow inline script to check if DIS is active
    isActive: () => _initialized,

    // Allow inline script to get engagement info
    getEngagement: () => {
      if (typeof GAIA_ENGAGEMENT !== 'undefined') {
        return {
          score: GAIA_ENGAGEMENT.getScore(),
          tier: GAIA_ENGAGEMENT.getTier(),
          mood: GAIA_ENGAGEMENT.getMood(),
        };
      }
      return null;
    },

    // Allow inline script to manually trigger events
    triggerEvent: (eventType, payload) => {
      if (typeof GaiaState !== 'undefined') {
        GaiaState.handleEvent(eventType, payload);
      }
    },
  };

})();

// ═══════════════════════════════════════
// AUTO-INIT
// Wait for all DIS files to load, then init
// ═══════════════════════════════════════

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all DIS scripts have loaded
    setTimeout(() => GaiaIntegration.init(), 100);
  });
} else {
  setTimeout(() => GaiaIntegration.init(), 100);
}

