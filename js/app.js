// ═══════════════════════════════════════════════
// APP — Init, hero → globe navigation (v1)
//
// v1 surface: hero + carbon clock + bare countries globe.
// Foundation sections, GAIA, pledge wall, delegation, quiz,
// biomes, scenario, NDVI and events modes live in _archive/.
// ═══════════════════════════════════════════════

const App = {
  async init() {
    syncHeroScrollState();

    // ── Carbon Clock — zero data dependencies; must start BEFORE any network
    //    waits. On slow connections Data.init() can take seconds, and the hero
    //    counter should never sit blank while that happens.
    if (hasModule('CARBON_CLOCK')) {
      CARBON_CLOCK.init();
    }

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

    // NOTE: GlobeModule is NOT initialized here — it initializes on demand
    // when entering globe mode. This prevents WebGL rendering in hero mode.

    // Emit app:ready event via EventBus
    if (hasModule('EventBus')) {
      window.EventBus.emit('app:ready', {
        modules: ['Data', 'GlobeModule', 'CARBON_CLOCK'],
        timestamp: Date.now(),
      });
    }

    this._bindStaticActions();
  },

  _bindStaticActions() {
    if (this._staticActionsBound) return;
    this._staticActionsBound = true;

    const handlers = {
      enterGlobe: () => this.enterGlobe(),
    };

    const runAction = (el, e) => {
      const action = el.getAttribute('data-action');
      if (!handlers[action]) return false;

      e.preventDefault();
      e.stopPropagation();
      handlers[action]();
      return true;
    };

    document.addEventListener('click', (e) => {
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest('[data-action]');
      if (!el) return;
      runAction(el, e);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (!(e.target instanceof Element)) return;
      const el = e.target.closest('[data-action]');
      if (!el || !el.matches('[role="button"],button,a')) return;
      runAction(el, e);
    });
  },

  async enterGlobe() {
    document.body.classList.add('globe-mode');
    document.body.classList.remove('hero-active');
    $('topbar')?.classList.add('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Load globe.gl if not already loaded, then init GlobeModule
    if (!_globeGLLoaded && !_globeGLLoading) {
      await loadGlobeGL().catch(() => reportWarn('App', 'globe.gl failed to load'));
    }
    if (hasModule('GlobeModule') && !GlobeModule._initialized) {
      try { GlobeModule.init(); GlobeModule._initialized = true; } catch (err) { reportError('GlobeModule.init()', err); }
    }
    document.addEventListener('keydown', _onGlobeKeyDown);
  },

  exitGlobe() {
    document.body.classList.remove('globe-mode');
    $('topbar')?.classList.remove('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    syncHeroScrollState();
    document.removeEventListener('keydown', _onGlobeKeyDown);
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
  },
};

// Global enter/exit (globe-back-btn uses onclick="exitGlobe()")
function enterGlobe() { App.enterGlobe(); }
function exitGlobe() { App.exitGlobe(); }

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

// Start — modules load synchronously, but Data may register a tick late
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

window.App = App;
window.enterGlobe = enterGlobe;
window.exitGlobe = exitGlobe;

syncHeroScrollState();

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('App', {
    provides: ['init', 'enterGlobe', 'exitGlobe', 'reset', 'destroy', 'getState'],
    requires: ['MODULE_CONTRACTS', 'CARBON_CLOCK'],
    emits: ['app:ready'],
    listens: [],
  });
}
