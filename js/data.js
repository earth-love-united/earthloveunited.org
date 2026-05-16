// ═══════════════════════════════════════════════
// DATA — Loads JSON, provides shared state
// ═══════════════════════════════════════════════

const Data = {
  biomes: null,
  sites: null,

  async init() {
    const [biomesRes, sitesRes] = await Promise.all([
      fetch('data/biomes.json'),
      fetch('data/sites.json')
    ]);
    this.biomes = await biomesRes.json();
    this.sites = await sitesRes.json();
    return this;
  },

  getBiome(key) { return this.biomes[key]; },
  getSite(id) { return this.sites.find(s => s.id === id); },
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
