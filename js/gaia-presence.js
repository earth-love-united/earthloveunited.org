// ═══════════════════════════════════════════
// GAIA PRESENCE — Ambient awareness layer
// Teaser speech on globe hover, tooltip display
// Works on both index.html (main site) and gaia.html
// ═══════════════════════════════════════════

const GAIA_PRESENCE = (() => {
  let tooltipEl = null;

  // Teaser lines per site — designed to make delegates lean in
  const TEASERS = {
    sri_lanka: [
      "Six thousand acres across five districts — and every seedling is a promise.",
      "Jaffna, Vavuniya, Mullaitivu... five districts, one mission. Multilayer afforestation.",
      "Sri Lanka's Northern Province was scarred by conflict. Now it's being healed — one tree at a time."
    ],
    antalya: [
      "This is where COP31 happens. And this is what the fire left behind.",
      "Sixty thousand hectares of Mediterranean pine — gone in days, July 2021. Recovery has just begun.",
      "The host city of COP31 carries a wound. The Antalya fire scar is still visible from space."
    ],
    benin: [
      "Mangroves store 950 tonnes of carbon per hectare. More than any ecosystem on Earth.",
      "Jean Missinhoun dreamed of restoring the Ouidah lagoons. His dream is still growing.",
      "From oil to earth — that's the story of Benin's coast, and the mission behind this foundation."
    ],
    borneo: [
      "This looks green from space. But it's an oil palm plantation — 50 tC/ha where there was 1,400.",
      "The greenest lie on Earth: same NDVI, 96% less carbon. That's what monoculture does.",
      "West Kalimantan's peat swamps once held centuries of carbon. Twenty years of clearing released it all."
    ]
  };

  function pickLine(siteId) {
    const pool = TEASERS[siteId];
    if (!pool || !pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function showTooltip(site, clientX, clientY) {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'gaia-presence-tooltip';
      document.body.appendChild(tooltipEl);
    }
    const line = pickLine(site.id);
    tooltipEl.innerHTML = `
      <div class="pt-name">${site.name}</div>
      <div class="pt-subtitle">${site.subtitle}</div>
      ${line ? `<div class="pt-xp">🌍 "${line}"</div>` : ''}
    `;
    const x = Math.min(clientX, window.innerWidth - 260);
    const y = clientY - tooltipEl.offsetHeight - 12;
    tooltipEl.style.left = Math.max(8, x) + 'px';
    tooltipEl.style.top = Math.max(8, y) + 'px';
    tooltipEl.classList.add('visible');
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
  }

  function speakTeaser(siteId) {
    const line = pickLine(siteId);
    if (!line) return;
    // EventBus path (preferred)
    if (hasModule('EventBus')) {
      window.EventBus.emit('presence:tease', { siteId, line });
    }
    // Direct fallback
    if (hasModule('GAIA_BUBBLE')) {
      GAIA_BUBBLE.speak(line, 'mysterious', 5000);
    }
  }

  return {
    showTooltip,
    hideTooltip,
    speakTeaser,
    pickLine,

    init() {
      console.debug('[SML] GAIA_PRESENCE.init');

      // Listen for engagement signals via EventBus
      if (hasModule('EventBus')) {
        this._unsubEngagement = window.EventBus.on('engagement:signal', (data) => {
          // React to site taps — show tooltip teaser
          if (data.signal === 'site_tap' && data.siteId) {
            const site = hasModule('Data') ? Data.getSite?.(data.siteId) : null;
            if (site) {
              speakTeaser(data.siteId);
            }
          }
        });
      }

      return true;
    },

    show() {
      console.debug('[SML] GAIA_PRESENCE.show');
      return true;
    },

    hide() {
      console.debug('[SML] GAIA_PRESENCE.hide');
      return true;
    },

    tease() {
      console.debug('[SML] GAIA_PRESENCE.tease');
      return true;
    },

    // ── Standard Module Lifecycle (SML) ──
    reset() {
      console.debug('[SML] GAIA_PRESENCE.reset');
      hideTooltip();
      return true;
    },

    destroy() {
      console.debug('[SML] GAIA_PRESENCE.destroy');

      // Unsubscribe from EventBus
      if (this._unsubEngagement) {
        this._unsubEngagement();
        this._unsubEngagement = null;
      }

      // Remove tooltip DOM element
      if (tooltipEl) {
        tooltipEl.remove();
        tooltipEl = null;
      }

      return true;
    },

    getState() {
      return {};
    },
  };
})();
window.GAIA_PRESENCE = GAIA_PRESENCE;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GAIA_PRESENCE', {
    provides: ['init', 'show', 'hide', 'tease', 'speakTeaser', 'showTooltip', 'hideTooltip', 'pickLine', 'destroy', 'reset', 'getState'],
    requires: ['GAIA_BUBBLE'],
    emits: ['presence:tease'],
    listens: ['engagement:signal'],
  });
}