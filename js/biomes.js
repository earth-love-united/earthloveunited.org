// ═══════════════════════════════════════════════
// BIOMES — Biome explorer + comparison bars
// ═══════════════════════════════════════════════

const Biomes = {
  order: ['degraded_bare_land','agricultural_cropland','grassland_savanna','tropical_dry_forest','temperate_deciduous','boreal_forest','temperate_coniferous','tropical_rainforest','seagrass_meadow','mangrove','wetland_peatland'],

  compareOrder: [
    { key: 'wetland_peatland', label: 'Peatland', color: 'teal' },
    { key: 'mangrove', label: 'Mangrove', color: 'teal' },
    { key: 'seagrass_meadow', label: 'Seagrass', color: 'teal' },
    { key: 'tropical_rainforest', label: 'Tropical Rainforest', color: 'leaf' },
    { key: 'temperate_coniferous', label: 'Coniferous', color: 'leaf' },
    { key: 'temperate_deciduous', label: 'Deciduous', color: 'leaf' },
    { key: 'tropical_dry_forest', label: 'Dry Forest', color: 'leaf' },
    { key: 'boreal_forest', label: 'Boreal', color: 'amber' },
    { key: 'grassland_savanna', label: 'Grassland', color: 'amber' },
    { key: 'agricultural_cropland', label: 'Cropland', color: 'warn' },
    { key: 'degraded_bare_land', label: 'Degraded', color: 'warn' },
  ],

  init() {
    if (!Data || !Data.biomes) {
      console.warn('[Biomes] Data not loaded yet, deferring init');
      return;
    }
    this.renderCards();
    this.renderCompare();
  },

  renderCards() {
    const el = $('biome-cards');
    if (!el) return;
    el.innerHTML = this.order.map(k => {
      const b = Data.getBiome(k);
      return `<div class="biome-card" onclick="Biomes.showDetail('${k}',this)">
        <div class="bc-icon">${b.icon}</div>
        <div class="bc-name">${b.name}</div>
        <div class="bc-density">${b.density} tC/ha</div>
        <div class="bc-bar"><div class="bc-bar-fill" style="background:${b.density > 500 ? 'var(--teal)' : b.density > 200 ? 'var(--leaf)' : 'var(--amber)'}" data-width="${Math.min(b.density / 14, 100)}%"></div></div>
      </div>`;
    }).join('');
  },

  renderCompare() {
    const el = $('compare-bars');
    if (!el) return;
    el.innerHTML = this.compareOrder.map(d => {
      const b = Data.getBiome(d.key);
      return `<div class="compare-row">
        <div class="compare-label">${d.label}</div>
        <div class="compare-bar-wrap"><div class="compare-bar ${d.color}" data-width="${Math.min(b.density / 14, 100)}%"></div></div>
        <div class="compare-val">${b.density} tC/ha</div>
      </div>`;
    }).join('');
  },

  showDetail(key, card) {
    const b = Data.getBiome(key);
    if (!b) return;
    document.querySelectorAll('.biome-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    const d = $('biome-detail');
    if (!d) return;
    d.className = 'biome-detail show';
    d.innerHTML = `<h4>${b.icon} ${b.name}</h4><p>${b.desc}</p><div class="bd-numbers"><div class="bd-num">📦 ${b.density} tC/ha stock</div><div class="bd-num">📈 ${b.seq} tC/ha/yr sequestration</div></div>`;
    const barFill = card.querySelector('.bc-bar-fill');
    if (barFill) setTimeout(() => { barFill.style.width = barFill.dataset.width; }, 50);
  },

  animateBars() {
    document.querySelectorAll('.compare-bar').forEach((bar, i) => {
      setTimeout(() => { bar.style.width = bar.dataset.width; }, i * 80);
    });
  },

  animateBiomeCards() {
    document.querySelectorAll('.bc-bar-fill').forEach((bar, i) => {
      setTimeout(() => { bar.style.width = bar.dataset.width; }, i * 60);
    });
  }
};

window.Biomes = Biomes;

  MODULE_CONTRACTS.register('Biomes', {
    provides: ['init', 'getBiome', 'getAllBiomes', 'classify'],
    requires: [],
  });
