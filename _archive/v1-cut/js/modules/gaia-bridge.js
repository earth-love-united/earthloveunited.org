/**
 * GAIA Integration Bridge — Connects ModuleEngine to DIS/Gaia state machine
 * Dispatches events to gaia.html's event system for quest/mood/state tracking
 *
 * Wrapped in IIFE with SML lifecycle and EventBus integration.
 */

const GaiaBridge = (() => {
  'use strict';

  // ── Private State ──
  let _listenerCleanupFns = [];

  // ── Core Methods ──

  function dispatch(event, data) {
    const detail = Object.assign({
      source: 'module-engine',
      timestamp: new Date().toISOString()
    }, data || {});

    try {
      if (typeof parent !== 'undefined' && parent !== window) {
        // If embedded in gaia.html iframe
        parent.postMessage({ type: 'ELU_EVENT', event: event, detail: detail }, '*');
      }
      // Also dispatch locally
      window.dispatchEvent(new CustomEvent('elu:' + event, { detail: detail }));
      if (typeof dispatchEvent === 'function') {
        dispatchEvent(new CustomEvent('elu:' + event, { detail: detail }));
      }
    } catch (e) {
      console.warn('[GaiaBridge] dispatch error:', e.message);
    }
  }

  function on(event, callback) {
    const handler = (e) => callback(e.detail);
    window.addEventListener('elu:' + event, handler);
    // Return unsubscribe function
    return () => window.removeEventListener('elu:' + event, handler);
  }

  // ── Quest Progress ──

  async function getQuestProgress() {
    // Use STORAGE_ADAPTER instead of localStorage
    let completed = 0;
    const total = 7;
    for (let i = 1; i <= total; i++) {
      try {
        let saved = null;
        if (typeof window !== 'undefined' && window.STORAGE_ADAPTER) {
          saved = await window.STORAGE_ADAPTER.get(`elu_module_0${i}-carbon-atom`);
          if (!saved && i > 1) {
            saved = await window.STORAGE_ADAPTER.get(`elu_module_0${i}`);
          }
        }
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.completedAt) completed++;
        }
      } catch (e) { /* skip */ }
    }
    return { completed, total, pct: Math.round((completed / total) * 100) };
  }

  // ── SML Lifecycle ──

  function init() {
    console.debug('[GaiaBridge] init');

    // Listen for module engine init events
    const unsubInit = on('module_init', (data) => {
      dispatch('gaia:module_init', data);
    });
    const unsubComplete = on('module_complete', (data) => {
      dispatch('gaia:module_complete', data);
    });
    const unsubStage = on('stage_change', (data) => {
      dispatch('gaia:stage_change', data);
    });

    _listenerCleanupFns = [unsubInit, unsubComplete, unsubStage];

    // Auto-listen for module events if ModuleEngine is available
    if (typeof ModuleEngine !== 'undefined' && ModuleEngine.prototype) {
      const _origInit = ModuleEngine.prototype.init;
      if (_origInit) {
        ModuleEngine.prototype.init = function(moduleId) {
          dispatch('gaia:module_init', { moduleId });
          return _origInit.call(this, moduleId);
        };
      }
    }

    return true;
  }

  function reset() {
    console.debug('[GaiaBridge] reset');
    // Clean up listeners
    _listenerCleanupFns.forEach(fn => { try { fn(); } catch(e) {} });
    _listenerCleanupFns = [];
    return true;
  }

  function destroy() {
    console.debug('[GaiaBridge] destroy');
    // Clean up all listeners
    _listenerCleanupFns.forEach(fn => { try { fn(); } catch(e) {} });
    _listenerCleanupFns = [];
    return true;
  }

  function getState() {
    return {
      listenerCount: _listenerCleanupFns.length,
    };
  }

  // ── Public API ──
  return {
    init,
    reset,
    destroy,
    getState,
    dispatch,
    on,
    getQuestProgress,
  };
})();
window.GaiaBridge = GaiaBridge;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GaiaBridge', {
    provides: ['init', 'reset', 'destroy', 'getState', 'dispatch', 'on', 'getQuestProgress'],
    requires: ['STORAGE_ADAPTER'],
    emits: [],
    listens: [],
  });
}
