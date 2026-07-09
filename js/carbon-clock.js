/**
 * CARBON CLOCK v2.0
 * Live counter showing real-time atmospheric CO₂ accumulation
 * Net annual growth ~20 Gt/yr (Friedlingstein et al 2026, GCB 2025)
 * 20 Gt/year = ~635 tons/second = ~0.635 tons every millisecond
 * 
 * Displays on hero, then mini version in topbar after entering
 */

const CARBON_CLOCK = (() => {
  // ── Constants ──
  const ANNUAL_EXCESS_GT = 20;           // 20 Gt CO₂/year
  const ANNUAL_EXCESS_TONS = ANNUAL_EXCESS_GT * 1e9;
  const TONS_PER_SECOND = ANNUAL_EXCESS_TONS / (365.25 * 24 * 60 * 60);
  const TONS_PER_MS = TONS_PER_SECOND / 1000;

  // ── State ️
  let startTime = null;
  let totalTons = 0;
  let timer = null;
  let heroEl = null;
  let topbarEl = null;
  let visible = false;
  let _heroText = '';
  let _heroUnitText = '';
  let _topbarText = '';

  // ── Format numbers ──
  function formatTons(tons) {
    if (tons >= 1e9) return (tons / 1e9).toFixed(2) + ' Gt';
    if (tons >= 1e6) return (tons / 1e6).toFixed(1) + ' Mt';
    if (tons >= 1e3) return (tons / 1e3).toFixed(1) + 'K t';
    return Math.floor(tons).toLocaleString() + ' t';
  }

  function formatRate(tps) {
    if (tps >= 1e6) return (tps / 1e6).toFixed(1) + ' Mt/s';
    if (tps >= 1e3) return (tps / 1e3).toFixed(1) + 'K t/s';
    return tps.toFixed(1) + ' t/s';
  }

  function formatHeroTons(tons) {
    const digits = Math.floor(tons).toString();
    const firstGroup = digits.length % 3 || 3;
    let formatted = digits.slice(0, firstGroup);

    for (let i = firstGroup; i < digits.length; i += 3) {
      formatted += '.' + digits.slice(i, i + 3);
    }

    return formatted;
  }

  // ── Create hero clock ──
  function createHeroClock() {
    if (heroEl) return;

    // Adopt the instant boot clock if index.html already rendered it
    // (inline script in the hero — ticks from first paint, before modules load).
    const existing = document.getElementById('carbon-clock-hero');
    if (existing) {
      heroEl = existing;
      return;
    }

    heroEl = document.createElement('div');
    heroEl.id = 'carbon-clock-hero';
    heroEl.innerHTML = `
      <div class="cc-hero-inner">
        <div class="cc-label">Net Human Emissions Since You Arrived</div>
        <div class="cc-value-row" aria-live="off" aria-atomic="true">
          <span class="cc-value" id="cc-hero-value">0</span>
          <span class="cc-unit" id="cc-hero-unit">t</span>
        </div>
        <div class="cc-explainer">
          <span>Nature absorbs <strong>~22 GtCO₂/yr</strong>. Humanity emits <strong>~42 GtCO₂/yr</strong>.</span>
          <span>This is the gap. It grows every second.</span>
        </div>
      </div>
    `;

    // Inject into the hero container
    const container = $('hero-carbon-clock');
    if (container) {
      container.appendChild(heroEl);
    } else {
      // Fallback: insert into hero directly
      const hero = $('hero');
      if (hero) {
        const inner = hero.querySelector('.hero-inner');
        if (inner) {
          inner.insertBefore(heroEl, inner.firstChild);
        } else {
          hero.appendChild(heroEl);
        }
      }
    }
  }

  // ── Create topbar mini clock ──
  function createTopbarClock() {
    if (topbarEl) return;

    topbarEl = document.createElement('div');
    topbarEl.id = 'carbon-clock-topbar';
    topbarEl.className = 'cc-topbar';
    topbarEl.innerHTML = `
      <span class="cc-topbar-icon">🌡️</span>
      <span class="cc-topbar-value" id="cc-topbar-value">0 t</span>
      <span class="cc-topbar-rate">+${formatRate(TONS_PER_SECOND)}</span>
    `;

    // Insert into topbar stats
    const topbar = $('topbar');
    if (topbar) {
      const stats = topbar.querySelector('.stats');
      if (stats) {
        stats.insertBefore(topbarEl, stats.firstChild);
      }
    }
  }

  // ── Update display ──
  function render(now) {
    if (!startTime) return;

    const elapsed = now - startTime;
    totalTons = elapsed * TONS_PER_MS;

    // Update hero (cache DOM refs)
    const heroTons = formatHeroTons(totalTons);
    if (_heroValue && heroTons !== _heroText) {
      _heroValue.textContent = heroTons;
      _heroText = heroTons;
    }
    if (_heroUnit && _heroUnitText !== 't') {
      _heroUnit.textContent = 't';
      _heroUnitText = 't';
    }
    if (_heroBar) {
      const pct = Math.min((elapsed / 60000) * 100, 100);
      _heroBar.style.width = pct + '%';
    }
    const topbarTons = formatTons(totalTons);
    if (_topbarValue && topbarTons !== _topbarText) {
      _topbarValue.textContent = topbarTons;
      _topbarText = topbarTons;
    }
  }

  function tick() {
    render(Date.now());
    timer = requestAnimationFrame(tick);
  }

  // ── Update display ──
  function update() {
    render(Date.now());
  }

  // ── Cache DOM refs ──
  let _heroValue = null, _heroUnit = null, _heroBar = null, _topbarValue = null;
  function _cacheRefs() {
    _heroValue = $('cc-hero-value');
    _heroUnit = $('cc-hero-unit');
    _heroBar = $('cc-hero-bar');
    _topbarValue = $('cc-topbar-value');
  }

  // ── Start ──
  function start() {
    if (timer) return;
    // Take over from the inline boot ticker: reuse its epoch so the
    // number never resets or jumps backwards, then stop its interval.
    if (window.__CC_TICK) {
      clearInterval(window.__CC_TICK);
      window.__CC_TICK = null;
    }
    startTime = window.__CC_T0 || Date.now();
    _cacheRefs();
    update();
    timer = requestAnimationFrame(tick);
    visible = true;
  }

  // ── Stop ──
  function stop() {
    if (timer) {
      cancelAnimationFrame(timer);
      timer = null;
    }
    visible = false;
  }

  // ── Reset ──
  function reset() {
    startTime = Date.now();
    totalTons = 0;
    update();
  }

  // ── Get current value ──
  function getValue() {
    return {
      tons: totalTons,
      formatted: formatTons(totalTons),
      rate: TONS_PER_SECOND,
      rateFormatted: formatRate(TONS_PER_SECOND),
      elapsed: startTime ? Date.now() - startTime : 0,
    };
  }

  // ── Init ──
  function init() {
    createHeroClock();
    createTopbarClock();
    // Start immediately — the clock begins ticking as soon as the page loads
    start();
  }

  return {
    init, start, stop, getValue,
    TONS_PER_SECOND, ANNUAL_EXCESS_GT,

    // ── Standard Module Lifecycle (SML) ──
    reset() {
      console.debug('[SML] CARBON_CLOCK.reset');
      startTime = Date.now();
      totalTons = 0;
      return true;
    },

    destroy() {
      console.debug('[SML] CARBON_CLOCK.destroy');

      // Clear the animation frame loop
      if (timer) {
        cancelAnimationFrame(timer);
        timer = null;
      }

      // Nullify DOM references
      heroEl = null;
      topbarEl = null;
      _heroValue = null;
      _heroUnit = null;
      _heroBar = null;
      _topbarValue = null;
      _heroText = '';
      _heroUnitText = '';
      _topbarText = '';

      // Reset state
      startTime = null;
      totalTons = 0;
      visible = false;

      return true;
    },

    getState() {
      return {};
    },
  };
})();
window.CARBON_CLOCK = CARBON_CLOCK;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('CARBON_CLOCK', {
    provides: ['init', 'start', 'stop', 'reset', 'destroy', 'getState'],
    requires: [],
  });
}
