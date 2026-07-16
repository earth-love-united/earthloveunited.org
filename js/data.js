// ═══════════════════════════════════════════════
// DATA — Loads JSON, provides shared state
//
// Must load AFTER storage.js (depends on window.Storage).
// ═══════════════════════════════════════════════

const CLIMATE_CANDIDATE_SHA256 = '7f002bc18396d827179cef0a3dda5bb83c3a1538dd6beffd6e4b80c2f7583664';
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
  carbonProjects: null,
  climateCandidate: null,
  climateCountries: null,
  climateRanking: null,
  climateCandidateState: 'idle',
  version: 'ct42candidate1',

  async init() {
    // CT-42 loads a denied, explicitly not-reviewed runtime candidate whose
    // only climate values are CT-10C/R-reviewed factual emissions estimates.
    // It cannot authorize targets, performance, scores, or production release.
    const v = '?v=' + this.version;
    this.climateCandidateState = 'loading';
    const [carbonProjectsRes, climateCandidateRes] = await Promise.allSettled([
      _fetchTextWithTimeout('data/carbon-projects.json' + v),
      _fetchTextWithTimeout('data/climate/runtime/country-factual-candidate.json' + v)
    ]);

    // Per-country carbon project slice (top registered projects + totals)
    // baked from the carbon-projects-unified dataset — drives the
    // "Close the Gap" section of the country cards.
    this.carbonProjects = await this._parseResponse(carbonProjectsRes, 'carbon-projects');
    this.climateCandidate = await this._parseCriticalCandidateResponse(climateCandidateRes);
    this._indexClimateCandidate();

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

  async _parseCriticalCandidateResponse(settledResult) {
    if (settledResult.status === 'rejected') {
      reportWarn('Data', `Fetch failed for climate-factual-candidate: ${settledResult.reason?.message || 'network error'}`);
      return null;
    }
    const response = settledResult.value;
    if (!response.ok) {
      reportWarn('Data', `HTTP ${response.status} for climate-factual-candidate`);
      return null;
    }
    if (!globalThis.crypto?.subtle || typeof TextEncoder !== 'function') {
      reportError('Data._parseCriticalCandidateResponse()', new Error('WebCrypto SHA-256 is unavailable'));
      return null;
    }
    try {
      const text = response.text;
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (actual !== CLIMATE_CANDIDATE_SHA256) {
        reportError('Data._parseCriticalCandidateResponse()', new Error('Critical candidate SHA-256 mismatch'));
        return null;
      }
      return JSON.parse(text);
    } catch (error) {
      reportError('Data._parseCriticalCandidateResponse()', error);
      return null;
    }
  },

  async reloadClimateCandidate() {
    this.climateCandidateState = 'loading';
    const v = `?v=${this.version}`;
    const [result] = await Promise.allSettled([
      _fetchTextWithTimeout('data/climate/runtime/country-factual-candidate.json' + v, { cache: 'reload' }),
    ]);
    this.climateCandidate = await this._parseCriticalCandidateResponse(result);
    return this._indexClimateCandidate();
  },

  getBiome(key) { return this.biomes ? this.biomes[key] : null; },
  getSite(id) { return this.sites ? this.sites.find(s => s.id === id) : null; },
  getCarbonProjects(iso) { return this.carbonProjects ? this.carbonProjects[iso] || null : null; },
  getClimateCountry(iso) { return this.climateCountries ? this.climateCountries[iso] || null : null; },
  getClimateRanking() { return this.climateRanking; },
  getClimateMagnitudeDomain() { return this.climateCandidate?.interpretation?.magnitude_domain || null; },
  isClimateCandidateReady() { return this.climateCandidateState === 'ready'; },
  _indexClimateCandidate() {
    const candidate = this.climateCandidate;
    const countries = Array.isArray(candidate?.countries) ? candidate.countries : [];
    const factualCount = countries.filter(country => country?.emissions?.status === 'reviewed_factual').length;
    const gapCount = countries.filter(country => country?.emissions?.status === 'source_gap').length;
    const isoCodes = countries.map(country => country?.iso_alpha3);
    const shapeValid = countries.length === 249 && factualCount === 206 && gapCount === 43 &&
      isoCodes.every(iso => typeof iso === 'string' && /^[A-Z0-9]{3}$/.test(iso)) &&
      new Set(isoCodes).size === countries.length;
    if (!candidate || candidate.review_status !== 'not_reviewed' || candidate.production_runtime_release !== false || !shapeValid) {
      this.climateCandidate = null; this.climateCountries = null; this.climateRanking = null;
      this.climateCandidateState = 'unavailable';
      reportError('Data._indexClimateCandidate()', new Error('CT-42 candidate boundary or shape invalid'));
      return false;
    }
    this.climateCountries = Object.fromEntries(countries.map(country => [country.iso_alpha3, country]));
    this.climateRanking = candidate.ranking;
    if (!this.climateRanking || this.climateRanking.disclosure?.eligible_count !== 206 || this.climateRanking.disclosure?.unranked_count !== 43) {
      this.climateCandidate = null; this.climateCountries = null; this.climateRanking = null;
      this.climateCandidateState = 'unavailable';
      reportError('Data._indexClimateCandidate()', new Error('CT-31 ranking boundary rejected CT-42 candidate'));
      return false;
    }
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
    return { climateCandidateState: this.climateCandidateState };
  }
};

window.Data = Data;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('Data', {
    provides: ['init', 'reloadClimateCandidate', 'isClimateCandidateReady', 'fmt', 'getClimateCountry', 'getClimateRanking', 'getClimateMagnitudeDomain', 'reset', 'destroy', 'getState'],
    requires: ['STORAGE_ADAPTER'],
  });
}
