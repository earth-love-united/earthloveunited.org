// ═══════════════════════════════════════════════
// CARBON CYCLE — Interactive cycle nodes
// ═══════════════════════════════════════════════

const Cycle = {
  data: {
    atmosphere: { title: "🌡️ The Atmosphere", body: "Currently holds ~875 Gt of carbon as CO₂. This number rises by ~10 GtC/yr due to human activity. CO₂ traps heat — more CO₂ means a warmer planet.", stat: "~875 GtC stored · +10 GtC/yr from humans" },
    vegetation: { title: "🌿 Vegetation", body: "Forests, grasslands, and plants absorb ~123 Gt CO₂/yr through photosynthesis. But deforestation releases ~1.5 GtC/yr. Net: vegetation absorbs ~4 GtC/yr.", stat: "~460 GtC stored · absorbs ~123 Gt CO₂/yr" },
    ocean: { title: "🌊 The Ocean", body: "The ocean absorbs ~25% of human CO₂ emissions — about 10.5 Gt CO₂/yr. This causes ocean acidification, threatening coral reefs and marine life.", stat: "~38,000 GtC stored · absorbs ~10.5 Gt CO₂/yr" },
    soil: { title: "🪱 Soil", body: "Soil holds ~2,500 GtC — more than the atmosphere and vegetation combined. Degraded soils release carbon. Restored soils sequester it.", stat: "~2,500 GtC stored · largest terrestrial pool" },
    human: { title: "🏭 Human Activity", body: "We emit ~143 Gt CO₂/yr: 90% from fossil fuels, 10% from land use change. This is the only part of the cycle we can directly control.", stat: "~143 Gt CO₂/yr emitted · 90% fossil fuels" }
  },

  show(key) {
    const d = this.data[key];
    if (!d) return;
    const el = $('cycle-detail');
    if (!el) return;
    el.className = 'cycle-detail show';
    el.innerHTML = `<h4>${d.title}</h4><p>${d.body}</p><div class="cd-stat">${d.stat}</div>`;
  }
};

window.Cycle = Cycle;

  MODULE_CONTRACTS.register('Cycle', {
    provides: ['init', 'update', 'getCurrentPhase', 'setPhase'],
    requires: [],
  });
