/**
 * ModuleRegistry — Loads and validates module definitions
 * All module JSON lives in data/modules/
 *
 * Wrapped in IIFE with SML lifecycle.
 */

const ModuleRegistry = (() => {
  'use strict';

  // ── Private State ──
  const _modules = new Map();
  const _schema = {
    required: ['id', 'title', 'stages'],
    validStageTypes: ['text', 'quiz', 'slider', 'branch', 'gauge', 'timeline', 'cardstack', 'comparison', 'globe', 'calculator']
  };

  // ── Core Methods ──

  async function load(id) {
    if (_modules.has(id)) return _modules.get(id);

    const resp = await fetch(`${window.__ELU_BASE_PATH || 'data/modules'}/${id}.json`);
    if (!resp.ok) throw new Error(`Module not found: ${id}`);
    const def = await resp.json();
    await validate(def);
    _modules.set(id, def);
    return def;
  }

  async function validate(def) {
    for (const field of _schema.required) {
      if (!def[field]) throw new Error(`Module missing required field: ${field}`);
    }
    if (def.stages) {
      for (const stage of def.stages) {
        if (stage.type && !_schema.validStageTypes.includes(stage.type)) {
          console.warn(`[ModuleRegistry] Unknown stage type: ${stage.type}`);
        }
      }
    }
    return true;
  }

  function has(id) {
    return _modules.has(id);
  }

  function get(id) {
    return _modules.get(id) || null;
  }

  function list() {
    return Array.from(_modules.keys());
  }

  function count() {
    return _modules.size;
  }

  // ── SML Lifecycle ──

  function init() {
    console.debug('[ModuleRegistry] init');
    return true;
  }

  function reset() {
    console.debug('[ModuleRegistry] reset');
    _modules.clear();
    return true;
  }

  function destroy() {
    console.debug('[ModuleRegistry] destroy');
    _modules.clear();
    return true;
  }

  function getState() {
    return {
      count: _modules.size,
      modules: Array.from(_modules.keys()),
    };
  }

  // ── Public API ──
  return {
    init,
    reset,
    destroy,
    getState,
    load,
    validate,
    has,
    get,
    list,
    count,
  };
})();
window.ModuleRegistry = ModuleRegistry;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('ModuleRegistry', {
    provides: ['init', 'reset', 'destroy', 'getState', 'load', 'validate', 'has', 'get', 'list', 'count'],
    requires: [],
    emits: [],
    listens: [],
  });
}
