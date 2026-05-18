/**
 * CARBON CLOCK v1.0
 * Live counter showing real-time excess CO₂ accumulation
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

  // ── Create hero clock ──
  function createHeroClock() {
    if (heroEl) return;

    heroEl = document.createElement('div');
    heroEl.id = 'carbon-clock-hero';
    heroEl.innerHTML = `
      <div class="cc-hero-inner">
        <div class="cc-label">Excess CO₂ since you arrived</div>
        <div class="cc-value" id="cc-hero-value">0 t</div>
        <div class="cc-rate" id="cc-hero-rate">~${formatRate(TONS_PER_SECOND)}</div>
        <div class="cc-bar">
          <div class="cc-bar-fill" id="cc-hero-bar"></div>
        </div>
        <div class="cc-context">
          <span class="cc-annual">${ANNUAL_EXCESS_GT} Gt/year</span>
          <span class="cc-sep">·</span>
          <span class="cc-desc">the carbon nature can't absorb</span>
        </div>
      </div>
    `;

    // Inject into the hero container
    const container = document.getElementById('hero-carbon-clock');
    if (container) {
      container.appendChild(heroEl);
    } else {
      // Fallback: insert into hero directly
      const hero = document.getElementById('hero');
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
    const topbar = document.getElementById('topbar');
    if (topbar) {
      const stats = topbar.querySelector('.stats');
      if (stats) {
        stats.insertBefore(topbarEl, stats.firstChild);
      }
    }
  }

  // ── Update display ──
  function update() {
    if (!startTime) return;

    const elapsed = Date.now() - startTime;
    totalTons = elapsed * TONS_PER_MS;

    // Update hero (cache DOM refs)
    if (_heroValue) _heroValue.textContent = formatTons(totalTons);
    if (_heroBar) {
      const pct = Math.min((elapsed / 60000) * 100, 100);
      _heroBar.style.width = pct + '%';
    }
    if (_topbarValue) _topbarValue.textContent = formatTons(totalTons);
  }

  // ── Cache DOM refs ──
  let _heroValue = null, _heroBar = null, _topbarValue = null;
  function _cacheRefs() {
    _heroValue = document.getElementById('cc-hero-value');
    _heroBar = document.getElementById('cc-hero-bar');
    _topbarValue = document.getElementById('cc-topbar-value');
  }

  // ── Start ──
  function start() {
    if (timer) return;
    startTime = Date.now();
    _cacheRefs();
    timer = setInterval(update, 500); // Update every 500ms — smooth enough for a clock
    visible = true;
  }

  // ── Stop ──
  function stop() {
    if (timer) {
      clearInterval(timer);
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
    init, start, stop, reset, getValue,
    TONS_PER_SECOND, ANNUAL_EXCESS_GT,
  };
})();
