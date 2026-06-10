// ═══════════════════════════════════════════════
// APP — Init, navigation, scroll progress, events
// GAIA Foundation Layer integration
// ═══════════════════════════════════════════════

const App = {
  async init() {
    syncHeroScrollState();

    // Load data first
    try {
      await Data.init();
    } catch (err) {
      reportError('App.Data.init()', err);
      // Show user-visible error so the page isn't silently broken
      const hero = $('hero');
      if (hero) {
        const existing = hero.querySelector('.data-error-banner');
        if (!existing) {
          const banner = document.createElement('div');
          banner.className = 'data-error-banner';
          banner.style.cssText = 'background:rgba(196,92,74,0.15);border:1px solid rgba(196,92,74,0.3);border-radius:8px;padding:12px 16px;margin:12px 0;font-size:12px;color:var(--warn);line-height:1.6;';
          banner.innerHTML = '⚠️ Could not load site data. Some features may be unavailable. <button type="button" class="data-error-retry" style="background:rgba(196,92,74,0.2);border:1px solid rgba(196,92,74,0.3);border-radius:4px;color:var(--warn);padding:2px 8px;cursor:pointer;font-size:11px;margin-left:8px;">Retry</button>';
          hero.querySelector('.hero-inner')?.insertBefore(banner, hero.querySelector('.hero-inner').firstChild)
            || hero.insertBefore(banner, hero.firstChild);
          banner.querySelector('.data-error-retry')?.addEventListener('click', () => location.reload());
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
    // NOTE: GlobeModule is NOT initialized here — it initializes on demand
    // when entering globe mode. This prevents WebGL rendering in foundation mode.
    const modules = [
      ['Quiz',          () => Quiz.init()],
      ['Biomes',        () => Biomes.init()],
      ['Scenario',      () => Scenario.init()],
      ['GLOBE_MODES',   () => { if (hasModule('GLOBE_MODES')) GLOBE_MODES.init(); }],
    ];
    for (const [name, initFn] of modules) {
      try { initFn(); } catch (err) { reportError(`${name}.init()`, err); }
    }

    // Async module inits (data fetching — fire and forget, they handle errors internally)
    if (hasModule('GLOBE_NDVI'))       GLOBE_NDVI.init();
    if (hasModule('GLOBE_EVENTS'))     GLOBE_EVENTS.init();
    if (hasModule('GLOBE_RESTORE'))    GLOBE_RESTORE.init();
    if (hasModule('PULSE_DASHBOARD'))  PULSE_DASHBOARD.init();
    if (hasModule('CARBON_SHADOW'))    CARBON_SHADOW.init();

    // Emit app:ready event via EventBus
    if (hasModule('EventBus')) {
      window.EventBus.emit('app:ready', {
        modules: ['Data', 'GlobeModule', 'GAIA_NODES', 'CARBON_CLOCK', 'DELEGATION', 'PLEDGE_WALL', 'Quiz', 'Biomes', 'Scenario', 'GLOBE_MODES', 'GLOBE_NDVI', 'GLOBE_EVENTS', 'GLOBE_RESTORE'],
        timestamp: Date.now(),
      });
    }

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
            // EventBus path + safeCall fallback
            if (hasModule('EventBus')) {
              window.EventBus.emit('bubble:speak', { text: msg, tone: 'warm', duration: 6000 });
            }
            safeCall('GAIA_BUBBLE', 'speak', msg, 'warm', 6000);
          }, 1500);
        }
      }
    }

    // ── Pending pledge from previous visit ──
    // If user left without pledging (detected via visibilitychange/beforeunload),
    // show a gentle reminder on their next visit.
    // Checks both IndexedDB (visibilitychange path) and sessionStorage (beforeunload path).
    try {
      let pendingPledge = await window.STORAGE_ADAPTER.get('gaia_pending_pledge');
      // sessionStorage fallback: beforeunload handler writes here synchronously
      if (!pendingPledge) {
        try {
          const ss = sessionStorage.getItem('gaia_pending_pledge');
          if (ss) { pendingPledge = JSON.parse(ss); sessionStorage.removeItem('gaia_pending_pledge'); }
        } catch { /* ignore */ }
      }
      if (pendingPledge && hasModule('PLEDGE_WALL') && !PLEDGE_WALL.hasPledged()) {
        const pending = typeof pendingPledge === 'string' ? JSON.parse(pendingPledge) : pendingPledge;
        if (pending.score >= 20 && Date.now() - pending.timestamp > 3600000) {
          setTimeout(() => {
            const pledgeMsg = "You were exploring last time. The carbon clock is still ticking. Before you go again — what's your pledge?";
            if (hasModule('EventBus')) {
              window.EventBus.emit('bubble:speak', { text: pledgeMsg, tone: 'warm', duration: 8000 });
            }
            safeCall('GAIA_BUBBLE', 'speak', pledgeMsg, 'warm', 8000);
          }, 3000);
        }
        await window.STORAGE_ADAPTER.remove('gaia_pending_pledge');
      }
    } catch { /* ignore */ }

    // Create GAIA bubble — always visible after entering
    if (hasModule('EventBus')) {
      window.EventBus.emit('bubble:create', {});
    }
    safeCall('GAIA_BUBBLE', 'create');

    // Speak greeting after hero
    setTimeout(() => {
      const line = safeCall('GAIA_VOICE', 'speak', 'GREETING', null, 'mysterious');
      if (line) {
        if (hasModule('EventBus')) {
          window.EventBus.emit('bubble:speak', { text: line.text, tone: line.tone, duration: 8000 });
        }
        safeCall('GAIA_BUBBLE', 'speak', line.text, line.tone, 8000);
      }
    }, 2000);

    // Idle nudge loop
    setInterval(() => {
      const nudge = safeGet('GAIA_ENGAGEMENT', 'shouldFireIdleNudge', false);
      if (nudge) {
        if (hasModule('EventBus')) {
          window.EventBus.emit('bubble:idle-nudge', {});
        }
        safeCall('GAIA_BUBBLE', 'idleNudge');
      }
    }, 5000);

    // ── Render site cards ──
    const sitesGrid = $('sites-grid');
    if (sitesGrid) {
      sitesGrid.innerHTML = Data.sites.map(s => `
        <div class="site-card" data-action="flyToSite" data-action-args='["${s.id}"]'>
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
    const _interact = () => {
      if (hasModule('EventBus')) {
        window.EventBus.emit('engagement:interact', {});
      }
      safeCall('GAIA_ENGAGEMENT', 'interact');
    };
    document.addEventListener('click', _interact);
    document.addEventListener('scroll', _interact, { passive: true });
    document.addEventListener('keydown', _interact);

    this._bindStaticActions();
  },

  _bindStaticActions() {
    const handlers = {
      enterGlobe: () => this.enterGlobe(),
      viewDatasets: () => this.viewDatasets(),
      toggleGlobeOverlay: () => toggleGlobeOverlay(),
      showCycle: (key) => safeCall('Cycle', 'show', key),
    };

    document.querySelectorAll('[data-action]').forEach((el) => {
      const action = el.getAttribute('data-action');
      if (!handlers[action] || el.dataset.appActionBound === 'true') return;
      el.dataset.appActionBound = 'true';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        let args = [];
        const argsAttr = el.getAttribute('data-action-args');
        if (argsAttr) {
          try { args = JSON.parse(argsAttr); } catch (_) { args = [argsAttr]; }
        }
        handlers[action](...args);
      });
    });
  },

  _enterBase() {
    $('hero')?.classList.add('hidden');
    document.body.classList.remove('hero-active');
    $('topbar')?.classList.add('visible');
    if (hasModule('EventBus')) {
      window.EventBus.emit('engagement:interact', {});
    }
    safeCall('GAIA_ENGAGEMENT', 'interact');
    // Eagerly load globe.gl on first interaction
    if (!_globeGLLoaded && !_globeGLLoading) {
      loadGlobeGL();
    }
  },

  enterAndScroll(targetSelector, options = {}) {
    this._enterBase();
    const delay = options.delay == null ? 300 : options.delay;
    setTimeout(() => {
      if (options.scrollTop != null) {
        window.scrollTo({ top: options.scrollTop, behavior: 'smooth' });
      } else {
        const target = document.querySelector(targetSelector);
        if (target) {
          const topbar = $('topbar');
          const offset = (topbar ? topbar.offsetHeight : 0) + 20;
          const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }

      const focusTarget = document.querySelector(options.focusSelector || targetSelector);
      if (focusTarget) {
        if (!focusTarget.hasAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1');
        focusTarget.focus({ preventScroll: true });
      }
    }, delay);
  },

  async enterGlobe() {
    document.body.classList.add('globe-mode');
    $('topbar')?.classList.add('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Load globe.gl if not already loaded, then init GlobeModule
    if (!_globeGLLoaded && !_globeGLLoading) {
      await loadGlobeGL().catch(() => reportWarn('App', 'globe.gl failed to load'));
    }
    if (hasModule('GlobeModule') && !GlobeModule._initialized) {
      try { GlobeModule.init(); GlobeModule._initialized = true; } catch (err) { reportError('GlobeModule.init()', err); }
    }
    if (hasModule('EventBus')) {
      window.EventBus.emit('engagement:interact', {});
    }
    safeCall('GAIA_ENGAGEMENT', 'interact');
    document.addEventListener('keydown', _onGlobeKeyDown);
  },

  exitGlobe() {
    document.body.classList.remove('globe-mode');
    $('topbar')?.classList.remove('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.removeEventListener('keydown', _onGlobeKeyDown);
  },

  viewDatasets() {
    this.enterAndScroll('#datasets');
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
  },
  // ── Standard Module Lifecycle (SML) ──
  reset() {
    console.debug(`[SML] App.reset`);
    return true;
  },
  destroy() {
    console.debug(`[SML] App.destroy`);
    return true;
  },
  getState() {
    return {};
  },};

// Global enter button
function enterGlobe() { App.enterGlobe(); }
function exitGlobe() { App.exitGlobe(); }
function viewDatasets() { App.viewDatasets(); }
function flyToSite(id) { App.flyToSite(id); }
function showCycle(key) { Cycle.show(key); }

function _onGlobeKeyDown(e) {
  if (e.key === 'Escape' && document.body.classList.contains('globe-mode')) {
    const countryTooltip = $('hex-country-tooltip');
    if (countryTooltip?.classList.contains('visible') && countryTooltip.classList.contains('selected')) {
      return;
    }
    App.exitGlobe();
  }
}

function syncHeroScrollState() {
  const hero = $('hero');
  if (hero && !hero.classList.contains('hidden')) {
    document.body.classList.add('hero-active');
  } else {
    document.body.classList.remove('hero-active');
  }
}

// Lazy-load globe.gl — returns Promise that resolves when loaded
let _globeGLLoading = false;
let _globeGLLoaded = false;
let _globeGLPromise = null;
function loadGlobeGL() {
  if (_globeGLLoaded) return Promise.resolve();
  if (_globeGLPromise) return _globeGLPromise;
  _globeGLLoading = true;
  _globeGLPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'js/vendor/globe.gl.js';
    script.onload = () => { _globeGLLoaded = true; _globeGLLoading = false; resolve(); };
    script.onerror = () => { _globeGLLoading = false; _globeGLPromise = null; reject(new Error('Failed to load globe.gl')); };
    document.head.appendChild(script);
  });
  return _globeGLPromise;
}

// Start — lazy-load globe.gl, then init
let _startRetries = 0;
async function startApp() {
  if (!hasModule('Data')) {
    if (++_startRetries > 50) {
      reportError('App.startApp()', new Error('Data not available after 5s'));
      return;
    }
    setTimeout(startApp, 100);
    return;
  }
  // NOTE: globe.gl and GlobeModule are NOT loaded/initialized at boot.
  // They initialize lazily when the user enters globe mode.
  _startRetries = 0;
  App.init();
}

// Departure trigger — prompt pledge if user is leaving without pledging
// Strategy: use visibilitychange (has time for async IndexedDB) as the primary
// trigger, and beforeunload (sync-only, <1ms budget) with sessionStorage fallback.
let _departurePrompted = false;

function _buildPledgeData() {
  if (!hasModule('PLEDGE_WALL')) return null;
  const score = safeGet('GAIA_ENGAGEMENT', 'getScore', 0);
  if (score >= 20 && !PLEDGE_WALL.hasPledged()) {
    return { score, timestamp: Date.now() };
  }
  return null;
}

// Primary: visibilitychange fires when user switches tabs, minimizes, or
// navigates away. This is reliable and allows async IndexedDB writes.
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden' && !_departurePrompted) {
    _departurePrompted = true;
    const pledge = _buildPledgeData();
    if (pledge) {
      pledge.source = 'departure';
      try {
        await window.STORAGE_ADAPTER.set('gaia_pending_pledge', pledge);
      } catch { /* ignore */ }
    }
    if (hasModule('EventBus')) {
      window.EventBus.emit('app:departure', {
        score: pledge ? pledge.score : 0,
        hasPledged: hasModule('PLEDGE_WALL') ? PLEDGE_WALL.hasPledged() : false,
        source: 'visibilitychange',
      });
    }
  }
});

// Last resort: beforeunload fires when the page is being unloaded.
// Browsers give ~0ms here — IndexedDB Promise will be GC'd before it resolves.
// Use sessionStorage as a synchronous fallback (survives page reload, read on next init).
window.addEventListener('beforeunload', () => {
  if (_departurePrompted) return;
  const pledge = _buildPledgeData();
  if (pledge) {
    pledge.source = 'beforeunload';
    // Synchronous write — survives page teardown
    try { sessionStorage.setItem('gaia_pending_pledge', JSON.stringify(pledge)); } catch { /* ignore */ }
  }
  if (hasModule('EventBus')) {
    window.EventBus.emit('app:departure', {
      score: pledge ? pledge.score : 0,
      hasPledged: hasModule('PLEDGE_WALL') ? PLEDGE_WALL.hasPledged() : false,
      source: 'beforeunload',
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GLOBAL ACTIONS — data-action dispatcher helpers
// ═══════════════════════════════════════════════════════════

/**
 * toggleGlobeOverlay — data-action="toggleGlobeOverlay"
 * Toggles the GLOBE_OVERLAY sidebar open/closed.
 * Also animates the hamburger button active state.
 */
function toggleGlobeOverlay() {
  if (!hasModule('GLOBE_OVERLAY')) return;
  var btn = $('hamburger-btn');
  if (GLOBE_OVERLAY.isOpen()) {
    GLOBE_OVERLAY.close();
    if (btn) btn.classList.remove('active');
  } else {
    GLOBE_OVERLAY.open();
    if (btn) btn.classList.add('active');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

window.App = App;
window.enterGlobe = enterGlobe;
window.exitGlobe = exitGlobe;
window.viewDatasets = viewDatasets;
window.toggleGlobeOverlay = toggleGlobeOverlay;

syncHeroScrollState();

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('App', {
    provides: ['init', 'enterAndScroll', 'enterGlobe', 'exitGlobe', 'viewDatasets', 'reset', 'destroy', 'getState'],
    requires: ['MODULE_CONTRACTS', 'SITE_PANEL', 'PLEDGE_WALL', 'GAIA_BUBBLE', 'CARBON_CLOCK', 'DELEGATION', 'GAIA_VOICE', 'GAIA_DATA'],
    emits: ['app:ready', 'app:departure', 'bubble:speak', 'bubble:create', 'bubble:idle-nudge', 'engagement:interact'],
    listens: [],
  });
}
