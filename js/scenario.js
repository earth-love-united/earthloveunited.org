// ═══════════════════════════════════════════════
// SCENARIO BUILDER — Step-by-step restoration wizard
// ═══════════════════════════════════════════════

const Scenario = {
  site: null,
  from: null,
  to: null,

  init() {
    if (!Data || !Data.sites || !Data.biomes) {
      console.warn('[Scenario] Data not loaded yet, deferring init');
      return;
    }
    const sites = Data.sites;
    $html('sb-sites', sites.map(s =>
      `<div class="sb-option" onclick="Scenario.pickSite('${s.id}',this)">${s.name}</div>`
    ).join(''));

    const fromOpts = ['degraded_bare_land', 'agricultural_cropland', 'grassland_savanna', 'urban_built'];
    $html('sb-from', fromOpts.map(k =>
      `<div class="sb-option" onclick="Scenario.pickFrom('${k}',this)">${Data.getBiome(k).icon} ${Data.getBiome(k).name}</div>`
    ).join(''));

    const toOpts = ['tropical_rainforest', 'mangrove', 'wetland_peatland', 'temperate_coniferous', 'temperate_deciduous', 'tropical_dry_forest', 'seagrass_meadow'];
    $html('sb-to', toOpts.map(k =>
      `<div class="sb-option" onclick="Scenario.pickTo('${k}',this)">${Data.getBiome(k).icon} ${Data.getBiome(k).name}</div>`
    ).join(''));

    $on('sb-area', 'input', function() {
      $text('sb-area-val', this.value);
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
    const ha = parseInt($('sb-area')?.value) || 100;
    const r = Data.transitionCarbon(this.from, this.to, ha, 30);
    if (!r) return;
    const ctx = Data.scaleContext(r.cumulative_co2);
    const pos = r.cumulative_co2 > 0;
    const el = $class('sb-result', 'sb-result show');
    if (!el) return;
    $text('sb-result-num', (pos ? '+' : '') + Data.fmt(Math.abs(r.cumulative_co2)) + ' t CO₂');
    $class('sb-result-num', 'sr-big ' + (pos ? '' : 'negative'));
    $text('sb-result-label', `${pos ? 'sequestered' : 'released'} over 30 years · ${ha} ha`);
    $text('sb-result-context', ctx.summary + ' — ' + (ctx.fraction * 100).toExponential(2) + '% of global annual net emissions');

    // Track engagement
    safeCall('GAIA_ENGAGEMENT', 'addSignal', 'scenario_run');
    if (Math.abs(r.cumulative_co2) >= 1e6) {
      safeCall('GAIA_ENGAGEMENT', 'addSignal', 'big_scenario');
    }
    if (r.cumulative_co2 < 0) {
      safeCall('GAIA_ENGAGEMENT', 'addSignal', 'negative_scenario');
    }
    safeCall('GAIA_SIG', 'emit', 'scenario_run', { siteId: this.site?.id, result: r.cumulative_co2 });

    // Trigger pledge prompt after running a scenario
    safeCall('PLEDGE_WALL', 'onScenarioRun', r);
  }
};

window.Scenario = Scenario;
