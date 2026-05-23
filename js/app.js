// ═══════════════════════════════════════════════
// APP — Init, navigation, scroll progress, events
// GAIA Foundation Layer integration
// ═══════════════════════════════════════════════

const App = {
  async init() {
    // Load data first
    try {
      await Data.init();
    } catch (err) {
      console.error('[App] Data.init() failed:', err);
      // Show user-visible error so the page isn't silently broken
      const hero = $('hero');
      if (hero) {
        const existing = hero.querySelector('.data-error-banner');
        if (!existing) {
          const banner = document.createElement('div');
          banner.className = 'data-error-banner';
          banner.style.cssText = 'background:rgba(196,92,74,0.15);border:1px solid rgba(196,92,74,0.3);border-radius:8px;padding:12px 16px;margin:12px 0;font-size:12px;color:var(--warn);line-height:1.6;';
          banner.innerHTML = '⚠️ Could not load site data. Some features may be unavailable. <button onclick="location.reload()" style="background:rgba(196,92,74,0.2);border:1px solid rgba(196,92,74,0.3);border-radius:4px;color:var(--warn);padding:2px 8px;cursor:pointer;font-size:11px;margin-left:8px;">Retry</button>';
          hero.querySelector('.hero-inner')?.insertBefore(banner, hero.querySelector('.hero-inner').firstChild)
            || hero.insertBefore(banner, hero.firstChild);
        }
      }
      // Continue init -- modules that depend on Data will handle undefined gracefully
    }

    // ── GAIA Nodes — register site content + wire globe ──
    if (hasModule('GAIA_NODES')) {
      GAIA_NODES.init();
      GAIA_NODES.populateSiteData();
    }

    // ── Carbon Clock — starts ticking immediately ──
    if (hasModule('CARBON_CLOCK')) {
      CARBON_CLOCK.init();
    }

    // ── Delegation Greeting — personalized country entry ──
    if (hasModule('DELEGATION')) {
      DELEGATION.init();
    }

    // ── Pledge Wall — public commitments ──
    if (hasModule('PLEDGE_WALL')) {
      PLEDGE_WALL.init();
    }

    // ── Pre-flight: validate module contracts ──
    if (hasModule('MODULE_CONTRACTS')) {
      const result = MODULE_CONTRACTS.validate();
      if (!result.ok) {
        result.errors.forEach(e => reportError('PRE-FLIGHT', e));
      }
      result.warnings.forEach(w => reportWarn('PRE-FLIGHT', w));
      if (result.ok) {
        console.log('%c✅ [PRE-FLIGHT] All module contracts valid', 'color: #4ecdc4; font-weight: bold');
      }
    }

    // Init all existing modules — errors are now VISIBLE via reportError
    const modules = [
      ['GlobeModule', () => GlobeModule.init()],
      ['Quiz',        () => Quiz.init()],
      ['Biomes',      () => Biomes.init()],
      ['Scenario',    () => Scenario.init()],
      ['GLOBE_MODES', () => { if (hasModule('GLOBE_MODES')) GLOBE_MODES.init(); }],
    ];
    for (const [name, initFn] of modules) {
      try { initFn(); } catch (err) { reportError(`${name}.init()`, err); }
    }

    // Async module inits (data fetching — fire and forget, they handle errors internally)
    if (hasModule('GLOBE_NDVI'))    GLOBE_NDVI.init();
    if (hasModule('GLOBE_EVENTS'))  GLOBE_EVENTS.init();
    if (hasModule('GLOBE_RESTORE')) GLOBE_RESTORE.init();

    // ── GAIA Foundation Layer ──
    // Fetch live data in background
    if (hasModule('GAIA_DATA')) {
      GAIA_DATA.refreshAll().then(liveData => {
        GAIA_DATA.saveSnapshot(liveData);
        if (liveData.co2.latest) {
          GAIA_DATA.saveVisitInfo(liveData.co2.latest);
        }
      });

      // Session tracking
      const sess = GAIA_DATA.getSessionInfo();
      const now = Date.now();
      if (!sess.firstVisit) {
        GAIA_DATA.saveSessionInfo({ visitCount: 1, firstVisit: now, totalTimeSeconds: 0 });
      } else {
        GAIA_DATA.saveSessionInfo({ ...sess, visitCount: sess.visitCount + 1 });
        // Welcome back
        const wb = GAIA_DATA.getWelcomeBackInfo();
        if (wb && wb.daysSince > 0) {
          const days = wb.daysSince;
          const _snap = GAIA_DATA.getCachedSnapshot();
          const co2Now = (_snap && _snap.co2 && _snap.co2.latest) ? _snap.co2.latest : (wb.co2Then ? (wb.co2Then + 2.7 * (days / 365)) : 431.12);
          const co2Then = wb.co2Then;
          const co2Diff = co2Then ? +(co2Now - co2Then).toFixed(2) : null;
          let msg = days === 1 ? 'Welcome back. One day.' : `Welcome back. ${days} days.`;
          if (co2Diff && co2Diff > 0) msg += ` CO₂: ${co2Then.toFixed(1)} → ${co2Now.toFixed(1)} ppm. +${co2Diff}. Not a pause. Accumulation.`;
          setTimeout(() => {
            safeCall('GAIA_BUBBLE', 'speak', msg, 'warm', 6000);
          }, 1500);
        }
      }
    }

    // ── Pending pledge from previous visit ──
    // If user left without pledging (detected via visibilitychange/beforeunload),
    // show a gentle reminder on their next visit.
    try {
      const pendingPledge = localStorage.getItem('gaia_pending_pledge');
      if (pendingPledge && hasModule('PLEDGE_WALL') && !PLEDGE_WALL.hasPledged()) {
        const pending = JSON.parse(pendingPledge);
        if (pending.score >= 20 && Date.now() - pending.timestamp > 3600000) {
          setTimeout(() => {
            safeCall('GAIA_BUBBLE', 'speak', "You were exploring last time. The carbon clock is still ticking. Before you go again — what's your pledge?", 'warm', 8000);
          }, 3000);
        }
        localStorage.removeItem('gaia_pending_pledge');
      }
    } catch { /* ignore */ }

    // Create GAIA bubble — always visible after entering
    safeCall('GAIA_BUBBLE', 'create');

    // Speak greeting after hero
    setTimeout(() => {
      const line = safeCall('GAIA_VOICE', 'speak', 'GREETING', null, 'mysterious');
      if (line) safeCall('GAIA_BUBBLE', 'speak', line.text, line.tone, 8000);
    }, 2000);

    // Idle nudge loop
    setInterval(() => {
      const nudge = safeGet('GAIA_ENGAGEMENT', 'shouldFireIdleNudge', false);
      if (nudge) safeCall('GAIA_BUBBLE', 'idleNudge');
    }, 5000);

    // ── Render site cards ──
    const sitesGrid = $('sites-grid');
    if (sitesGrid) {
      sitesGrid.innerHTML = Data.sites.map(s => `
        <div class="site-card" onclick="flyToSite('${s.id}')">
          <div class="site-icon">${s.id === 'sri_lanka' ? '🌳' : s.id === 'antalya' ? '🔥' : s.id === 'benin' ? '🌿' : '🌴'}</div>
          <div class="site-name">${s.name}</div>
          <div class="site-loc">${s.id === 'sri_lanka' ? 'SRI LANKA' : s.id === 'antalya' ? 'TURKEY' : s.id === 'benin' ? 'BENIN' : 'BORNEO'}</div>
          <div class="site-desc">${s.narrative.substring(0, 120)}...</div>
          <div class="site-stat">${s.area.toLocaleString()} ha · ${Data.getBiome(s.primaryBiome).name}</div>
        </div>
      `).join('');
    }

    // ── Scroll reveals ──
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          if (e.target.querySelector('#imbalance-counters')) Counters.animate();
          if (e.target.querySelector('#compare-bars')) Biomes.animateBars();
          if (e.target.querySelector('#biome-cards')) Biomes.animateBiomeCards();
        }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // ── Scroll progress ──
    const progressBar = $('scroll-progress');
    const sectionsEl = document.querySelector('.sections');
    const footerEl = document.querySelector('.footer');
    let _scrollRAF = null;
    const updateProgress = () => {
      if (_scrollRAF) return;
      _scrollRAF = requestAnimationFrame(() => {
        _scrollRAF = null;

        if (!sectionsEl || !footerEl || !progressBar) { progressBar && (progressBar.style.width = '0'); return; }
        const start = sectionsEl.offsetTop;
        const end = footerEl.offsetTop + footerEl.offsetHeight - window.innerHeight;
        const current = window.scrollY;
        if (current <= start) { progressBar.style.width = '0'; return; }
        if (current >= end) { progressBar.style.width = '100%'; return; }
        progressBar.style.width = ((current - start) / (end - start) * 100) + '%';
      });
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    // ── Panel close ──
    const closeBtn = $('panel-close-btn');
    const backdrop = $('panel-backdrop');
    const onClose = (e) => { if (e.type === 'touchstart') e.preventDefault(); e.stopPropagation(); Panel.close(); };
    if (closeBtn) {
      closeBtn.addEventListener('click', onClose, true);
      closeBtn.addEventListener('touchstart', onClose, { passive: false, capture: true });
    }
    if (backdrop) {
      backdrop.addEventListener('click', onClose);
      backdrop.addEventListener('touchstart', onClose, { passive: false });
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Panel.close(); });

    // ── Track all interactions for engagement ──
    const _interact = () => safeCall('GAIA_ENGAGEMENT', 'interact');
    document.addEventListener('click', _interact);
    document.addEventListener('scroll', _interact, { passive: true });
    document.addEventListener('keydown', _interact);
  },

  enterSite() {
    $('hero')?.classList.add('hidden');
    $('topbar')?.classList.add('visible');
    setTimeout(() => { $('quiz')?.scrollIntoView({ behavior: 'smooth' }); }, 300);
    safeCall('GAIA_ENGAGEMENT', 'interact');
  },

  flyToSite(id) {
    const site = Data.getSite(id);
    if (site) {
      // Use GAIA Nodes (globe overlay) if available
      if (hasModule('GAIA_NODES')) {
        GAIA_NODES.onNodeClick(id);
      } else if (hasModule('SITE_PANEL')) {
        SITE_PANEL.open(site);
      } else {
        Panel.open(site);
      }
    }
  }
};

// Global enter button
function enterSite() { App.enterSite(); }
function flyToSite(id) { App.flyToSite(id); }
function showCycle(key) { Cycle.show(key); }

// Start — handle both async and already-loaded DOM
let _startRetries = 0;
function startApp() {
  if (typeof GlobeModule === 'undefined' || typeof Data === 'undefined') {
    if (++_startRetries > 30) {
      console.error('[App] GlobeModule or Data not available after 3s — starting without globe');
      // Start without globe — Data.init() will still work, globe just won't render
      if (hasModule('Data')) App.init();
      return;
    }
    setTimeout(startApp, 100);
    return;
  }
  App.init();
}

// Departure trigger — prompt pledge if user is leaving without pledging
// Strategy: use visibilitychange (reliable, can show UI) as the primary
// trigger, and beforeunload as a last-resort signal (can't show UI but
// can persist a "returning user" flag for next visit).
let _departurePrompted = false;

// Primary: visibilitychange fires when user switches tabs, minimizes, or
// navigates away. This is reliable and allows DOM manipulation.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && !_departurePrompted) {
    _departurePrompted = true;
    if (hasModule('PLEDGE_WALL')) {
      const score = safeGet('GAIA_ENGAGEMENT', 'getScore', 0);
      if (score >= 20 && !PLEDGE_WALL.hasPledged()) {
        try {
          localStorage.setItem('gaia_pending_pledge', JSON.stringify({
            score,
            timestamp: Date.now(),
            source: 'departure',
          }));
        } catch { /* ignore */ }
      }
    }
  }
});

// Last resort: beforeunload fires when the page is being unloaded.
// Modern browsers restrict DOM manipulation here, so we only persist state.
window.addEventListener('beforeunload', () => {
  if (_departurePrompted) return;
  if (hasModule('PLEDGE_WALL')) {
    const score = safeGet('GAIA_ENGAGEMENT', 'getScore', 0);
    if (score >= 20 && !PLEDGE_WALL.hasPledged()) {
      try {
        localStorage.setItem('gaia_pending_pledge', JSON.stringify({
          score,
          timestamp: Date.now(),
          source: 'beforeunload',
        }));
      } catch { /* ignore */ }
    }
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

window.App = App;

  MODULE_CONTRACTS.register('App', {
    provides: ['init'],
    requires: ['MODULE_CONTRACTS', 'SITE_PANEL', 'PLEDGE_WALL', 'GAIA_BUBBLE', 'CARBON_CLOCK', 'DELEGATION', 'GAIA_VOICE', 'GAIA_DATA'],
  });
