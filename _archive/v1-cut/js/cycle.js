// ═══════════════════════════════════════════════
// CARBON CYCLE — Interactive cycle nodes
// ═══════════════════════════════════════════════

const Cycle = {
  data: {
    atmosphere: { title: "🌡️ The Atmosphere", body: "Currently holds ~875 Gt of carbon as CO₂. This number rises by ~10 GtC/yr due to human activity. CO₂ traps heat — more CO₂ means a warmer planet.", stat: "~875 GtC stored · +10 GtC/yr from humans" },
    vegetation: { title: "🌿 Vegetation", body: "Forests, grasslands, and plants absorb ~123 Gt CO₂/yr through photosynthesis (gross flux). They respire most of it back. Net: vegetation absorbs ~4 GtC/yr (~15 Gt CO₂/yr).", stat: "~460 GtC stored · net sink ~15 Gt CO₂/yr" },
    ocean: { title: "🌊 The Ocean", body: "The ocean absorbs ~25% of human CO₂ emissions — about 10.5 Gt CO₂/yr (~2.9 GtC/yr). This causes ocean acidification, threatening coral reefs and marine life.", stat: "~38,000 GtC stored · sink ~2.9 GtC/yr" },
    soil: { title: "🪱 Soil", body: "Soil holds ~2,500 GtC — more than the atmosphere and vegetation combined. Degraded soils release carbon. Restored soils sequester it.", stat: "~2,500 GtC stored · largest terrestrial pool" },
    human: { title: "🏭 Human Activity", body: "We emit ~42 Gt CO₂/yr: ~37 Gt from fossil fuels, ~5 Gt from land use change. About half stays in the atmosphere; the rest is absorbed by land and ocean sinks.", stat: "~42 Gt CO₂/yr emitted · 90% fossil fuels" }
  },

  show(key) {
    const d = this.data[key];
    if (!d) return;
    const el = $('cycle-detail');
    if (!el) return;
    el.className = 'cycle-detail show';
    el.innerHTML = `<h4>${d.title}</h4><p>${d.body}</p><div class="cd-stat">${d.stat}</div>`;
  },

  init() {
    console.debug('[Stub] Cycle.init');
    return true;
  },

  update() {
    console.debug('[Stub] Cycle.update');
    return true;
  },

  getCurrentPhase() {
    console.debug('[Stub] Cycle.getCurrentPhase');
    return true;
  },

  setPhase() {
    console.debug('[Stub] Cycle.setPhase');
    return true;
  },

  // ── Standard Module Lifecycle (SML) ──
  reset() {
    console.debug('[SML] Cycle.reset');
    return true;
  },

  destroy() {
    console.debug('[SML] Cycle.destroy');
    return true;
  },

  getState() {
    return {};
  },
};

window.Cycle = Cycle;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('Cycle', {
    provides: ['init', 'update', 'getCurrentPhase', 'setPhase', 'reset', 'destroy', 'getState'],
    requires: [],
  });
}
