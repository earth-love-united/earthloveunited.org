// ═══════════════════════════════════════════════
// DATA — Loads JSON, provides shared state
//
// Must load AFTER storage.js (depends on window.Storage).
// ═══════════════════════════════════════════════

const CLIMATE_INTELLIGENCE_SHA256 = '9af7122f02e09b10af7add4ed75a61453d0bd4573ed6bad090561723608d0d7a';
const DATA_FETCH_TIMEOUT_MS = 8000;

function _fetchTextWithTimeout(url, options = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Timed out after ${DATA_FETCH_TIMEOUT_MS}ms: ${url}`));
    }, DATA_FETCH_TIMEOUT_MS);
  });
  const request = fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) })
    .then(async response => ({
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    }));
  return Promise.race([request, timeout]).finally(() => clearTimeout(timer));
}

const Data = {
  biomes: null,
  sites: null,
  // Retained as a null compatibility field for archived callers. Country
  // Climate Intelligence never loads projects, credits, or offsets.
  carbonProjects: null,
  climateIntelligence: null,
  climateIntelligenceCountries: null,
  climateIntelligenceState: 'idle',
  // Compatibility aliases for code outside the v1 country dashboard. These
  // point to the new release and never reconstruct the retired PRIMAP shape.
  climateCandidate: null,
  climateCountries: null,
  climateRanking: null,
  climateCandidateState: 'idle',
  version: 'cci1candidate2',

  async init() {
    // Country Climate Intelligence v1 is a hashed, static factual candidate.
    // Browser code never calls source APIs and never upgrades candidate facts
    // into scores, target assessments, or finance judgments.
    const v = '?v=' + this.version;
    this.climateIntelligenceState = 'loading';
    this.climateCandidateState = 'loading';
    const [climateIntelligenceRes] = await Promise.allSettled([
      _fetchTextWithTimeout('data/climate/runtime/country-climate-intelligence.json' + v)
    ]);
    this.climateIntelligence = await this._parseCriticalClimateIntelligenceResponse(climateIntelligenceRes);
    this._indexClimateIntelligence();

    return this;
  },

  /** Parse a settled fetch promise — guards against HTTP errors and bad JSON. */
  async _parseResponse(settledResult, name) {
    try {
      if (settledResult.status === 'rejected') {
        reportWarn('Data', `Fetch failed for ${name}: ${settledResult.reason?.message || 'network error'}`);
        return null;
      }
      const resp = settledResult.value;
      if (!resp.ok) {
        reportWarn('Data', `HTTP ${resp.status} for ${name}`);
        return null;
      }
      const raw = JSON.parse(resp.text);
      // Unwrap envelope if present (_meta + data structure)
      if (raw && typeof raw === 'object' && '_meta' in raw && 'data' in raw) {
        this._meta = this._meta || {};
        this._meta[name] = raw._meta;
        return raw.data;
      }
      return raw;
    } catch (error) {
      reportWarn('Data', `Parse error for ${name}: ${error?.message || 'invalid JSON'}`);
      return null;
    }
  },

  async _parseCriticalClimateIntelligenceResponse(settledResult) {
    if (settledResult.status === 'rejected') {
      reportWarn('Data', `Fetch failed for country-climate-intelligence: ${settledResult.reason?.message || 'network error'}`);
      return null;
    }
    const response = settledResult.value;
    if (!response.ok) {
      reportWarn('Data', `HTTP ${response.status} for country-climate-intelligence`);
      return null;
    }
    if (!globalThis.crypto?.subtle || typeof TextEncoder !== 'function') {
      reportError('Data._parseCriticalClimateIntelligenceResponse()', new Error('WebCrypto SHA-256 is unavailable'));
      return null;
    }
    try {
      const text = response.text;
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (actual !== CLIMATE_INTELLIGENCE_SHA256) {
        reportError('Data._parseCriticalClimateIntelligenceResponse()', new Error('Country Climate Intelligence SHA-256 mismatch'));
        return null;
      }
      const parsed = JSON.parse(text);
      if (parsed?.release) parsed.release.verified_sha256 = actual;
      return parsed;
    } catch (error) {
      reportError('Data._parseCriticalClimateIntelligenceResponse()', error);
      return null;
    }
  },

  async reloadClimateIntelligence() {
    this.climateIntelligenceState = 'loading';
    this.climateCandidateState = 'loading';
    const v = `?v=${this.version}`;
    const [result] = await Promise.allSettled([
      _fetchTextWithTimeout('data/climate/runtime/country-climate-intelligence.json' + v, { cache: 'reload' }),
    ]);
    this.climateIntelligence = await this._parseCriticalClimateIntelligenceResponse(result);
    return this._indexClimateIntelligence();
  },

  reloadClimateCandidate() { return this.reloadClimateIntelligence(); },

  getBiome(key) { return this.biomes ? this.biomes[key] : null; },
  getSite(id) { return this.sites ? this.sites.find(s => s.id === id) : null; },
  getCarbonProjects() { return null; },
  getClimateIntelligenceRelease() { return this.climateIntelligence; },
  getClimateIntelligenceCountry(id) {
    if (!this.climateIntelligenceCountries || typeof id !== 'string') return null;
    const trimmed = id.trim();
    const normalized = trimmed.includes(':')
      ? trimmed.slice(0, trimmed.lastIndexOf(':') + 1).toLowerCase() + trimmed.slice(trimmed.lastIndexOf(':') + 1).toUpperCase()
      : trimmed.toUpperCase();
    return this.climateIntelligenceCountries[normalized] || this.climateIntelligenceCountries[trimmed] || null;
  },
  getClimateLensCatalog() { return this.climateIntelligence?.lens_catalog || []; },
  isClimateIntelligenceReady() { return this.climateIntelligenceState === 'ready'; },
  getClimateCountry(id) { return this.getClimateIntelligenceCountry(id); },
  getClimateRanking(lensId = 'carbon') { return this.climateIntelligence?.lens_orders?.[lensId] || null; },
  isClimateCandidateReady() { return this.isClimateIntelligenceReady(); },
  _indexClimateIntelligence() {
    const release = this.climateIntelligence;
    const validation = hasModule('DATA_SCHEMA')
      ? safeCall('DATA_SCHEMA', 'validateClimateIntelligence', release)
      : { ok: false, errors: ['DATA_SCHEMA unavailable'] };
    const boundaryValid = release?.release?.status === 'candidate' &&
      release?.release?.review_state === 'normalized_factual_candidate_pending_source_revalidation' &&
      release?.release?.production_runtime_release === false;
    if (!validation?.ok || !boundaryValid) {
      const details = validation?.errors?.slice(0, 3).join('; ') || 'candidate release boundary invalid';
      this.climateIntelligence = null;
      this.climateIntelligenceCountries = null;
      this.climateCandidate = null;
      this.climateCountries = null;
      this.climateRanking = null;
      this.climateIntelligenceState = 'unavailable';
      this.climateCandidateState = 'unavailable';
      reportError('Data._indexClimateIntelligence()', new Error(`Country Climate Intelligence schema rejected: ${details}`));
      return false;
    }
    const byIdentity = {};
    release.countries.forEach(country => {
      byIdentity[country.country_id] = country;
      byIdentity[country.iso_alpha3] = country;
      if (country.iso_alpha2) byIdentity[country.iso_alpha2] = country;
    });
    this.climateIntelligenceCountries = byIdentity;
    this.climateCandidate = release;
    this.climateCountries = byIdentity;
    this.climateRanking = release.lens_orders.carbon;
    this.climateIntelligenceState = 'ready';
    this.climateCandidateState = 'ready';
    return true;
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
    return {
      climateIntelligenceState: this.climateIntelligenceState,
      climateReleaseId: this.climateIntelligence?.release?.id || null,
      entityCount: this.climateIntelligence?.countries?.length || 0,
    };
  }
};

window.Data = Data;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('Data', {
    provides: ['init', 'reloadClimateIntelligence', 'getClimateIntelligenceRelease', 'getClimateIntelligenceCountry', 'getClimateLensCatalog', 'isClimateIntelligenceReady', 'fmt', 'getClimateCountry', 'getClimateRanking', 'reset', 'destroy', 'getState'],
    requires: ['STORAGE_ADAPTER'],
  });
}
