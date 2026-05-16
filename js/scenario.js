// ═══════════════════════════════════════════════
// SCENARIO BUILDER — Step-by-step restoration wizard
// ═══════════════════════════════════════════════

const Scenario = {
  site: null,
  from: null,
  to: null,

  init() {
    const sites = Data.sites;
    document.getElementById('sb-sites').innerHTML = sites.map(s =>
      `<div class="sb-option" onclick="Scenario.pickSite('${s.id}',this)">${s.name}</div>`
    ).join('');

    const fromOpts = ['degraded_bare_land', 'agricultural_cropland', 'grassland_savanna', 'urban_built'];
    document.getElementById('sb-from').innerHTML = fromOpts.map(k =>
      `<div class="sb-option" onclick="Scenario.pickFrom('${k}',this)">${Data.getBiome(k).icon} ${Data.getBiome(k).name}</div>`
    ).join('');

    const toOpts = ['tropical_rainforest', 'mangrove', 'wetland_peatland', 'temperate_coniferous', 'temperate_deciduous', 'tropical_dry_forest', 'seagrass_meadow'];
    document.getElementById('sb-to').innerHTML = toOpts.map(k =>
      `<div class="sb-option" onclick="Scenario.pickTo('${k}',this)">${Data.getBiome(k).icon} ${Data.getBiome(k).name}</div>`
    ).join('');

    document.getElementById('sb-area').addEventListener('input', function() {
      document.getElementById('sb-area-val').textContent = this.value;
      Scenario.calc();
    });
  },

  pickSite(id, el) {
    this.site = Data.getSite(id);
    document.querySelectorAll('#sb-sites .sb-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    this.calc();
  },

  pickFrom(key, el) {
    this.from = key;
    document.querySelectorAll('#sb-from .sb-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    this.calc();
  },

  pickTo(key, el) {
    this.to = key;
    document.querySelectorAll('#sb-to .sb-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    this.calc();
  },

  calc() {
    if (!this.from || !this.to) return;
    const ha = parseInt(document.getElementById('sb-area').value) || 100;
    const r = Data.transitionCarbon(this.from, this.to, ha, 30);
    if (!r) return;
    const ctx = Data.scaleContext(r.cumulative_co2);
    const pos = r.cumulative_co2 > 0;
    const el = document.getElementById('sb-result');
    el.className = 'sb-result show';
    document.getElementById('sb-result-num').textContent = (pos ? '+' : '') + Data.fmt(Math.abs(r.cumulative_co2)) + ' t CO₂';
    document.getElementById('sb-result-num').className = 'sr-big ' + (pos ? '' : 'negative');
    document.getElementById('sb-result-label').textContent = `${pos ? 'sequestered' : 'released'} over 30 years · ${ha} ha`;
    document.getElementById('sb-result-context').textContent = ctx.summary + ' — ' + (ctx.fraction * 100).toExponential(2) + '% of global annual net emissions';

    // Track engagement
    if (typeof GAIA_ENGAGEMENT !== 'undefined') {
      GAIA_ENGAGEMENT.addSignal('scenario_run');
      if (Math.abs(r.cumulative_co2) >= 1e6) {
        GAIA_ENGAGEMENT.addSignal('big_scenario');
      }
      if (r.cumulative_co2 < 0) {
        GAIA_ENGAGEMENT.addSignal('negative_scenario');
      }
    }

    // Trigger pledge prompt after running a scenario
    if (typeof PLEDGE_WALL !== 'undefined') {
      PLEDGE_WALL.onScenarioRun(r);
    }
  }
};
