// ═══════════════════════════════════════════════
// DATA — Loads JSON, provides shared state
//
// Must load AFTER storage.js (depends on window.Storage).
// ═══════════════════════════════════════════════

const Data = {
  biomes: null,
  sites: null,
  smallNations: null,
  carbonProjects: null,
  climateCandidate: null,
  climateCountries: null,
  climateRanking: null,
  version: 'ct42candidate1',

  async init() {
    // CT-42 loads a denied, explicitly not-reviewed runtime candidate whose
    // only climate values are CT-10C/R-reviewed factual emissions estimates.
    // It cannot authorize targets, performance, scores, or production release.
    const v = '?v=' + this.version;
    const [smallNationsRes, carbonProjectsRes, climateCandidateRes] = await Promise.allSettled([
      fetch('data/small-nations.json' + v),
      fetch('data/carbon-projects.json' + v),
      fetch('data/climate/runtime/country-factual-candidate.json' + v)
    ]);

    // UN members absent from the 110m country GeoJSON (island + micro
    // nations) — GlobeModule renders these as small circular markers.
    this.smallNations = await this._parseResponse(smallNationsRes, 'small-nations');
    // Per-country carbon project slice (top registered projects + totals)
    // baked from the carbon-projects-unified dataset — drives the
    // "Close the Gap" section of the country cards.
    this.carbonProjects = await this._parseResponse(carbonProjectsRes, 'carbon-projects');
    this.climateCandidate = await this._parseResponse(climateCandidateRes, 'climate-factual-candidate');
    this._indexClimateCandidate();

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
  getCarbonProjects(iso) { return this.carbonProjects ? this.carbonProjects[iso] || null : null; },
  getClimateCountry(iso) { return this.climateCountries ? this.climateCountries[iso] || null : null; },
  getClimateRanking() { return this.climateRanking; },
  getClimateMagnitudeDomain() { return this.climateCandidate?.interpretation?.magnitude_domain || null; },
  _indexClimateCandidate() {
    const candidate = this.climateCandidate;
    if (!candidate || candidate.review_status !== 'not_reviewed' || candidate.production_runtime_release !== false || !Array.isArray(candidate.countries)) {
      this.climateCandidate = null; this.climateCountries = null; this.climateRanking = null;
      reportError('Data._indexClimateCandidate()', new Error('CT-42 candidate boundary or shape invalid'));
      return;
    }
    this.climateCountries = Object.fromEntries(candidate.countries.map(country => [country.iso_alpha3, country]));
    this.climateRanking = candidate.ranking;
    if (!this.climateRanking || this.climateRanking.disclosure.eligible_count !== 206 || this.climateRanking.disclosure.unranked_count !== 43) {
      this.climateCandidate = null; this.climateCountries = null; this.climateRanking = null;
      reportError('Data._indexClimateCandidate()', new Error('CT-31 ranking boundary rejected CT-42 candidate'));
    }
  },
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
    provides: ['init', 'fmt', 'getClimateCountry', 'getClimateRanking', 'getClimateMagnitudeDomain', 'reset', 'destroy', 'getState'],
    requires: ['STORAGE_ADAPTER'],
  });
}
