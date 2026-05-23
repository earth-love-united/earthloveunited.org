// ═══════════════════════════════════════════════
// SAFE LOCALSTORAGE — quota-aware writes
// ═══════════════════════════════════════════════
const Storage = {
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

const Data = {
  biomes: null,
  sites: null,
  pledgeNodes: null,

  async init() {
    // Fetch all data files in parallel — each individually guarded
    const [biomesRes, sitesRes, pledgeNodesRes] = await Promise.allSettled([
      fetch('data/biomes.json'),
      fetch('data/sites.json'),
      fetch('data/pledge-nodes.json')
    ]);

    // Parse each response individually — a 404 on one shouldn't kill the others
    this.biomes = await this._parseResponse(biomesRes, 'biomes');
    this.sites = await this._parseResponse(sitesRes, 'sites');
    this.pledgeNodes = await this._parseResponse(pledgeNodesRes, 'pledge-nodes');

    if (this.biomes && this.sites) {
      console.log('[Data] Loaded:', Object.keys(this.biomes).length, 'biomes,', this.sites.length, 'sites,', this.pledgeNodes?.length || 0, 'pledge nodes');
    } else {
      console.error('[Data] CRITICAL: Some data files failed to load. biomes:', !!this.biomes, 'sites:', !!this.sites);
    }
    return this;
  },

  /** Parse a settled fetch promise — guards against HTTP errors and bad JSON */
  async _parseResponse(settledResult, name) {
    try {
      if (settledResult.status === 'rejected') {
        console.error(`[Data] Fetch failed for ${name}:`, settledResult.reason?.message || 'network error');
        return null;
      }
      const resp = settledResult.value;
      if (!resp.ok) {
        console.error(`[Data] HTTP ${resp.status} for ${name}.json`);
        return null;
      }
      return await resp.json();
    } catch (e) {
      console.error(`[Data] Parse error for ${name}:`, e.message);
      return null;
    }
  },

  getBiome(key) { return this.biomes ? this.biomes[key] : null; },
  getSite(id) { return this.sites ? this.sites.find(s => s.id === id) : null; },
  getPledgeNode(iso) { return this.pledgeNodes ? this.pledgeNodes.find(n => n.iso === iso) : null; },
  getAllBiomes() { return this.biomes ? Object.entries(this.biomes).map(([k, v]) => ({ key: k, ...v })) : []; },

  // Carbon calculation engine
  transitionCarbon(from, to, ha, yrs = 30) {
    if (!this.biomes) return null;
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

window.Data = Data;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('Data', {
    provides: ['init', 'fmt'],
    requires: [],
  });
}
