// ═══════════════════════════════════════════════
// APP — Init, hero → globe navigation (v1)
//
// v1 surface: hero + carbon clock + bare countries globe.
// Foundation sections, GAIA, pledge wall, delegation, quiz,
// biomes, scenario, NDVI and events modes live in _archive/.
// ═══════════════════════════════════════════════

const App = {
  _globeActivationAttempt: 0,

  async init() {
    syncHeroScrollState();
    _bindGlobeLoadingEvents();

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
      browseEvidence: () => this.browseEvidence(),
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

  async enterGlobe(options = {}) {
    const activationAttempt = ++this._globeActivationAttempt;
    const isCurrentActivation = () =>
      this._globeActivationAttempt === activationAttempt && document.body.classList.contains('globe-mode');
    _setEvidenceBrowseEnabled(false);
    if (!document.body.classList.contains('globe-mode')) {
      safeCall('GlobeModule', 'rememberFallbackOpener', document.activeElement);
    }
    _setGlobeLoading(true, 'Preparing the living globe');
    document.body.classList.add('globe-mode');
    document.body.classList.remove('hero-active');
    document.body.setAttribute('aria-busy', 'true');
    $('topbar')?.classList.add('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    _setGlobeLoading(true, 'Verifying country evidence and globe assets');
    let preparation = { ok: false, reason: 'globe_construction_failed' };
    try {
      if (hasModule('GlobeModule')) {
        preparation = await GlobeModule.prepare({
          force: options.forcePrepare === true,
          reloadCandidate: options.reloadCandidate === true,
        });
      }
    } catch (error) {
      reportError('GlobeModule.prepare()', error);
      preparation = { ok: false, reason: 'globe_construction_failed' };
    }
    if (!isCurrentActivation()) return false;
    if (!preparation?.ok) {
      const reason = preparation?.reason || 'globe_construction_failed';
      _setGlobeLoading(false);
      document.body.removeAttribute('aria-busy');
      safeCall('GlobeModule', 'showFallback', reason);
      if (hasModule('EventBus')) EventBus.emit('app:globe-entered', { fallback: true, reason, timestamp: Date.now() });
      document.addEventListener('keydown', _onGlobeKeyDown);
      return false;
    }
    // Load globe.gl if not already loaded, then init GlobeModule
    if (!_globeGLLoaded) {
      try {
        await loadGlobeGL();
      } catch (err) {
        if (!isCurrentActivation()) return false;
        reportWarn('App', 'globe.gl failed to load: ' + (err?.message || 'unknown error'));
        _setGlobeLoading(false);
        document.body.removeAttribute('aria-busy');
        safeCall('GlobeModule', 'showFallback', 'library_load_failed');
        if (hasModule('EventBus')) EventBus.emit('app:globe-entered', { fallback: true, reason: 'library_load_failed', timestamp: Date.now() });
        document.addEventListener('keydown', _onGlobeKeyDown);
        return false;
      }
    }
    if (!isCurrentActivation()) return false;
    if (hasModule('GlobeModule') && !GlobeModule._initialized) {
      try {
        GlobeModule._initialized = GlobeModule.init() === true;
      } catch (err) {
        GlobeModule._initialized = false;
        reportError('GlobeModule.init()', err);
        safeCall('GlobeModule', 'teardownFailedRenderer');
        safeCall('GlobeModule', 'showFallback', 'globe_construction_failed');
      }
    } else if (hasModule('GlobeModule')) {
      safeCall('GlobeModule', 'selectDefaultCountry');
    }
    if (!hasModule('GlobeModule') || !GlobeModule._initialized) {
      _setGlobeLoading(false);
      document.body.removeAttribute('aria-busy');
      if (!$('globe-fallback') || $('globe-fallback').hidden) {
        safeCall('GlobeModule', 'showFallback', 'globe_construction_failed');
      }
      if (hasModule('EventBus')) EventBus.emit('app:globe-entered', { fallback: true, reason: window.GlobeModule?._fallbackReasonCode || 'globe_construction_failed', timestamp: Date.now() });
      document.addEventListener('keydown', _onGlobeKeyDown);
      return false;
    }
    // GlobeModule emits readiness during init. If someone enters while the
    // application is still awaiting its bootstrap data, that event can precede
    // the subscription. The rendered canvas is now present, so always close
    // the HUD loader on the next paint as the final, race-safe handoff.
    if (hasModule('GlobeModule') && GlobeModule._initialized) {
      requestAnimationFrame(() => {
        if (!isCurrentActivation()) return;
        _setGlobeLoading(false);
        document.body.removeAttribute('aria-busy');
      });
    }
    if (!isCurrentActivation()) return false;
    _setEvidenceBrowseEnabled(true);
    if (hasModule('EventBus')) EventBus.emit('app:globe-entered', { fallback: false, timestamp: Date.now() });
    document.addEventListener('keydown', _onGlobeKeyDown);
    return true;
  },

  async retryGlobe() {
    safeCall('GlobeModule', 'hideFallback', { restoreFocus: false, preserveOpener: true });
    if (hasModule('GlobeModule')) {
      safeCall('GlobeModule', 'teardownFailedRenderer');
      GlobeModule._initialized = false;
    }
    if (typeof window.Globe !== 'function') _resetGlobeGLLoader();
    const started = await this.enterGlobe({ forcePrepare: true, reloadCandidate: true });
    if (started) $('globe-back-btn')?.focus({ preventScroll: true });
    return started;
  },

  browseEvidence() {
    if (!document.body.classList.contains('globe-mode') || document.body.classList.contains('globe-fallback-active')) return false;
    if (!hasModule('GlobeModule') || GlobeModule._initialized !== true || $('globeViz')?.querySelectorAll('canvas').length !== 1) return false;
    safeCall('GlobeModule', 'rememberFallbackOpener', document.activeElement);
    return safeCall('GlobeModule', 'showFallback', 'evidence_browse_requested') === true;
  },

  exitGlobe() {
    this._globeActivationAttempt += 1;
    _setEvidenceBrowseEnabled(false);
    _setGlobeLoading(false);
    document.body.classList.remove('globe-mode');
    document.body.removeAttribute('aria-busy');
    $('topbar')?.classList.remove('visible');
    safeCall('GlobeModule', 'clearCountrySelection');
    safeCall('GlobeModule', 'hideFallback', { restoreFocus: true, preserveOpener: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    syncHeroScrollState();
    if (hasModule('EventBus')) EventBus.emit('app:globe-exited', { timestamp: Date.now() });
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
    if (document.body.classList.contains('globe-fallback-active') && window.GlobeModule?._fallbackReasonCode === 'evidence_browse_requested') {
      e.preventDefault();
      safeCall('GlobeModule', 'closeEvidenceBrowser');
      return;
    }
    const countryTooltip = $('hex-country-tooltip');
    if (countryTooltip?.classList.contains('visible') && countryTooltip.classList.contains('selected')) {
      safeCall('GlobeModule', 'clearCountrySelection');
      return;
    }
    App.exitGlobe();
  }
}

function _setEvidenceBrowseEnabled(enabled) {
  const button = $('globe-evidence-browse');
  if (!button) return;
  button.disabled = !enabled;
  button.setAttribute('aria-disabled', String(!enabled));
}

function syncHeroScrollState() {
  const hero = $('hero');
  if (hero && !hero.classList.contains('hidden')) {
    document.body.classList.add('hero-active');
  } else {
    document.body.classList.remove('hero-active');
  }
}

function _setGlobeLoading(visible, message) {
  const loader = $('globe-loading');
  if (!loader) return;
  const label = loader.querySelector('[data-globe-loading-message]');
  if (label && message) label.textContent = message;
  loader.classList.toggle('is-visible', !!visible);
  loader.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

let _globeLoadingEventsBound = false;
function _bindGlobeLoadingEvents() {
  if (_globeLoadingEventsBound || !hasModule('EventBus')) return;
  _globeLoadingEventsBound = true;
  EventBus.on('globe:render-ready', () => _setGlobeLoading(false));
  EventBus.on('globe:country-data-ready', () => _setGlobeLoading(false));
  EventBus.on('globe:data-error', payload => {
    _setGlobeLoading(true, payload?.message || 'Country layer unavailable');
    setTimeout(() => _setGlobeLoading(false), 1800);
  });
  EventBus.on('globe:fallback-shown', () => {
    _setEvidenceBrowseEnabled(false);
    _setGlobeLoading(false);
    document.body.removeAttribute('aria-busy');
  });
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
    script.id = 'globe-gl-runtime';
    script.src = 'js/vendor/globe.gl.js';
    script.onload = () => {
      _globeGLLoading = false;
      if (typeof window.Globe !== 'function') {
        script.remove();
        _globeGLPromise = null;
        reject(new Error('globe.gl loaded without a Globe constructor'));
        return;
      }
      _globeGLLoaded = true;
      resolve();
    };
    script.onerror = () => {
      script.remove();
      _globeGLLoading = false;
      _globeGLPromise = null;
      reject(new Error('Failed to load globe.gl'));
    };
    document.head.appendChild(script);
  });
  return _globeGLPromise;
}

function _resetGlobeGLLoader() {
  $('globe-gl-runtime')?.remove();
  _globeGLLoading = false;
  _globeGLLoaded = typeof window.Globe === 'function';
  _globeGLPromise = _globeGLLoaded ? Promise.resolve() : null;
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
    provides: ['init', 'enterGlobe', 'retryGlobe', 'browseEvidence', 'exitGlobe', 'reset', 'destroy', 'getState'],
    requires: ['MODULE_CONTRACTS', 'CARBON_CLOCK'],
    emits: ['app:ready', 'app:globe-entered', 'app:globe-exited'],
    listens: ['globe:render-ready', 'globe:country-data-ready', 'globe:data-error', 'globe:fallback-shown'],
  });
}
