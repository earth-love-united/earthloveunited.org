// ═══════════════════════════════════════════════
// GLOBE MODES — Mode orchestrator for globe views
// Modes: countries | ndvi | events
// ═══════════════════════════════════════════════

const GLOBE_MODES = (() => {
  let _currentMode = 'countries';
  let _initialized = false;
  let _countryDataReady = false;

  function init() {
    if (_initialized) return;
    _initialized = true;

    // Wire mode button clicks
    const buttons = document.querySelectorAll('.gm-btn');
    if (!buttons.length) {
      reportWarn('GLOBE_MODES', 'No .gm-btn elements found — mode switcher UI missing');
      return;
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        if (mode) setMode(mode);
      });
    });

    console.log('[GLOBE_MODES] init — 3 modes ready');
  }

  /**
   * Called by GlobeModule when country GeoJSON is loaded.
   * This is the signal that hex polygon data is available for NDVI coloring.
   */
  function onCountryDataReady() {
    _countryDataReady = true;
    // If we're already in NDVI mode, apply colors now
    if (_currentMode === 'ndvi') {
      safeCall('GLOBE_NDVI', 'activate');
    }
  }

  function setMode(mode) {
    if (mode === _currentMode) return;

    const validModes = ['countries', 'ndvi', 'events'];
    if (!validModes.includes(mode)) {
      reportWarn('GLOBE_MODES', `Unknown mode: ${mode}`);
      return;
    }

    // Deactivate current mode
    _deactivateCurrent();

    _currentMode = mode;

    // Update button active states
    document.querySelectorAll('.gm-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Activate new mode
    switch (mode) {
      case 'countries':
        _activateCountries();
        break;
      case 'ndvi':
        _activateNDVI();
        break;
      case 'events':
        _activateEvents();
        break;
    }

    console.log(`[GLOBE_MODES] switched to: ${mode}`);
  }

  function _deactivateCurrent() {
    safeCall('GLOBE_NDVI', 'deactivate');
    safeCall('GLOBE_EVENTS', 'deactivate');
  }

  function _activateCountries() {
    // Restore night earth texture (in case NDVI swapped it)
    safeCall('GlobeModule', 'restoreDefaultTexture');

    // Restore node visuals (points, labels, rings)
    safeCall('GlobeModule', 'restoreNodeVisuals');

    // Reset hex to empty wireframe grid
    if (hasModule('GlobeModule') && GlobeModule.world) {
      GlobeModule.setHexMode(
        () => 'rgba(78,205,196,0.08)',
        () => 0.003
      );
    }
  }

  function _activateNDVI() {
    safeCall('GlobeModule', 'clearNodeVisuals');
    safeCall('GLOBE_NDVI', 'activate');
  }

  function _activateEvents() {
    safeCall('GLOBE_EVENTS', 'activate');
  }

  // ── Standard Module Lifecycle (SML) ──
  const _reset = () => { console.debug('[SML] GLOBE_MODES.reset'); _currentMode = 'countries'; return true; };
  const _destroy = () => { console.debug('[SML] GLOBE_MODES.destroy'); return true; };
  const _getState = () => ({ mode: _currentMode, countryDataReady: _countryDataReady });

  return {
    init,
    setMode,
    getMode: () => _currentMode,
    onCountryDataReady,
    isCountryDataReady: () => _countryDataReady,
    reset: _reset,
    destroy: _destroy,
    getState: _getState,
  };
})();
window.GLOBE_MODES = GLOBE_MODES;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GLOBE_MODES', {
    provides: ['init', 'setMode', 'getMode', 'onCountryDataReady', 'reset', 'destroy', 'getState'],
    requires: ['GlobeModule'],
  });
}
