// ═══════════════════════════════════════════════
// DATA — Loads JSON, provides shared state
//
// Must load AFTER storage.js (depends on window.Storage).
// ═══════════════════════════════════════════════

const Data = {
  biomes: null,
  sites: null,
  pledgeNodes: null,
  countryMarkers: null,
  version: 'prod002',

  async init() {
    // Fetch all data files in parallel — each individually guarded
    const v = '?v=' + this.version;
    const [biomesRes, sitesRes, pledgeNodesRes, countryMarkersRes] = await Promise.allSettled([
      fetch('data/biomes.json' + v),
      fetch('data/sites.json' + v),
      fetch('data/pledge-nodes.json' + v),
      fetch('data/country-markers.json' + v)
    ]);

    // Parse each response individually — a 404 on one shouldn't kill the others
    this.biomes = await this._parseResponse(biomesRes, 'biomes');
    this.sites = await this._parseResponse(sitesRes, 'sites');
    this.pledgeNodes = await this._parseResponse(pledgeNodesRes, 'pledge-nodes');
    this.countryMarkers = await this._parseResponse(countryMarkersRes, 'country-markers');

    // Validate loaded data against schemas
    if (typeof DATA_SCHEMA !== 'undefined') {
      if (this.biomes) DATA_SCHEMA.validate('biomes.json', this.biomes);
      if (this.sites) DATA_SCHEMA.validate('sites.json', this.sites);
      if (this.pledgeNodes) DATA_SCHEMA.validate('pledge-nodes.json', this.pledgeNodes);
    }

    if (this.biomes && this.sites) {
      console.log('[Data] Loaded:', Object.keys(this.biomes).filter(k => k !== '_meta').length, 'biomes,', this.sites.length, 'sites,', this.pledgeNodes?.length || 0, 'pledge nodes,', this.countryMarkers?.length || 0, 'country markers');
    } else {
      console.error('[Data] CRITICAL: Some data files failed to load. biomes:', !!this.biomes, 'sites:', !!this.sites);
    }

    // ── Country Hex Color Lookup ──
    // Built once from pledgeNodes, keyed by ISO_A3
    // Used by GlobeModule to color hex polygons per-country
    this.countryHexColors = {};
    if (this.pledgeNodes) {
      this.pledgeNodes.forEach(n => {
        this.countryHexColors[n.iso] = {
          country: n.country,
          iso: n.iso,
          lat: n.lat,
          lng: n.lng,
          emissions: n.fossil_co2_mt,
          perCapita: n.co2_per_capita,
          gap: n.reality_gap_mt,
          onTrack: n.on_track,
          catRating: n.cat_rating,
          catScore: n.cat_score,
          globeColor: n.globe_color,
          targetYear: n.target_year,
          reductionPct: n.reduction_pct,
          lulucf: n.lulucf_co2_mt,
          totalCo2: n.total_co2_mt,
        };
      });
      console.log('[Data] Country hex colors:', Object.keys(this.countryHexColors).length, 'countries');
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
 const raw = await resp.json();
 // Unwrap envelope if present (_meta + data structure)
 if (raw && typeof raw === 'object' && '_meta' in raw && 'data' in raw) {
 this._meta = this._meta || {};
 this._meta[name] = raw._meta;
 return raw.data;
 }
 return raw;
 } catch (e) {
 console.error(`[Data] Parse error for ${name}:`, e.message);
 return null;
 }
 },

  getBiome(key) { return this.biomes ? this.biomes[key] : null; },
  getSite(id) { return this.sites ? this.sites.find(s => s.id === id) : null; },
  getPledgeNode(iso) { return this.pledgeNodes ? this.pledgeNodes.find(n => n.iso === iso) : null; },
  getCountryHexData(iso) { return this.countryHexColors ? this.countryHexColors[iso] || null : null; },
  getAllBiomes() { return this.biomes ? Object.entries(this.biomes).filter(([k]) => k !== '_meta').map(([k, v]) => ({ key: k, ...v })) : []; },

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
  },

  // ── Standard Module Lifecycle (SML) ──
  reset() {
    console.debug('[SML] Data.reset');
    return true;
  },
  destroy() {
    console.debug('[SML] Data.destroy');
    return true;
  },
  getState() {
    return {};
  }
};

window.Data = Data;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('Data', {
    provides: ['init', 'fmt', 'reset', 'destroy', 'getState'],
    requires: ['STORAGE_ADAPTER'],
  });
}
