// ═══ BUNDLED foundation.bundle.js — generated 2026-06-07T13:16:12Z ═══
// ── gaia-utils.js ──
// ═══════════════════════════════════════════════════════════
// GAIA UTILITIES — Foundation layer for safe cross-module ops
// Must load BEFORE all other scripts.
//
// Two systems:
// 1. Safe DOM:    $(), $html(), $text(), $class(), $on(), $show(), $hide()
// 2. Safe Call:   safeCall(), safeGet()
// ═══════════════════════════════════════════════════════════

/**
 * Safe getElementById — never crashes on missing elements.
 * @param {string} id - DOM element ID
 * @returns {HTMLElement|null}
 */
function $(id) {
  return document.getElementById(id);
}

/**
 * Safe innerHTML setter — no-ops if element doesn't exist.
 * @param {string} id - DOM element ID
 * @param {string} html - HTML content to set
 * @returns {HTMLElement|null} The element (for chaining) or null
 */
function $html(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
  return el;
}

/**
 * Safe textContent setter — no-ops if element doesn't exist.
 * @param {string} id - DOM element ID
 * @param {string} text - Text content to set
 * @returns {HTMLElement|null} The element (for chaining) or null
 */
function $text(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
  return el;
}

/**
 * Safe className setter — no-ops if element doesn't exist.
 * @param {string} id - DOM element ID
 * @param {string} className - Class string to set
 * @returns {HTMLElement|null}
 */
function $class(id, className) {
  const el = document.getElementById(id);
  if (el) el.className = className;
  return el;
}

/**
 * Safe event listener — no-ops if element doesn't exist.
 * @param {string} id - DOM element ID
 * @param {string} event - Event name
 * @param {Function} handler - Event handler
 * @returns {HTMLElement|null}
 */
function $on(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
  return el;
}

/**
 * Safe show — sets display to '' (default flow).
 * @param {string} id - DOM element ID
 * @returns {HTMLElement|null}
 */
function $show(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = '';
  return el;
}

/**
 * Safe hide — sets display to 'none'.
 * @param {string} id - DOM element ID
 * @returns {HTMLElement|null}
 */
function $hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
  return el;
}

// ═══════════════════════════════════════════════════════════
// ERROR BOUNDARY — visible error reporting for dev mode
// Shows a non-blocking banner at the bottom of the page
// when running on localhost. Production is unaffected.
// ═══════════════════════════════════════════════════════════

const _DEV = typeof location !== 'undefined' &&
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
const _devErrors = [];

/**
 * Report an error visibly (dev) or silently (prod).
 * @param {string} source - Where the error came from (e.g. 'GlobeModule.init()')
 * @param {Error|string} err - The error object or message
 */
function reportError(source, err) {
  const msg = `[${source}] ${err.message || err}`;
  console.error(msg, err);
  if (_DEV) {
    _devErrors.push(msg);
    _renderErrorBanner();
  }
}

function _renderErrorBanner() {
  let banner = document.getElementById('dev-error-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'dev-error-banner';
    banner.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;z-index:99999;' +
      'background:#1a0000;border-top:2px solid #e74c3c;padding:8px 16px;' +
      'font:12px/1.6 monospace;color:#ff6b6b;max-height:200px;overflow-y:auto;' +
      'pointer-events:auto';
    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText =
      'position:absolute;top:4px;right:8px;background:none;border:none;' +
      'color:#ff6b6b;font-size:16px;cursor:pointer';
    close.onclick = () => banner.remove();
    banner.appendChild(close);
    document.body.appendChild(banner);
  }
  const lines = _devErrors.map(e => `<div>🔴 ${e}</div>`).join('');
  banner.innerHTML = lines + banner.querySelector('button')?.outerHTML || lines;
  // Re-attach close button
  const closeBtn = banner.querySelector('button');
  if (!closeBtn) {
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.style.cssText =
      'position:absolute;top:4px;right:8px;background:none;border:none;' +
      'color:#ff6b6b;font-size:16px;cursor:pointer';
    btn.onclick = () => banner.remove();
    banner.appendChild(btn);
  }
}

/**
 * Report a dev-mode warning (not an error — just a heads-up).
 * Shows in console only, not in the error banner.
 * @param {string} source
 * @param {string} msg
 */
function reportWarn(source, msg) {
  if (_DEV) console.warn(`[${source}] ${msg}`);
}

// ═══════════════════════════════════════════════════════════
// SAFE CROSS-MODULE CALLS
// ═══════════════════════════════════════════════════════════

/**
 * Safe cross-module method call.
 * Replaces the pattern:
 *   if (typeof GAIA_ENGAGEMENT !== 'undefined') GAIA_ENGAGEMENT.addSignal('x');
 * With:
 *   safeCall('GAIA_ENGAGEMENT', 'addSignal', 'x');
 *
 * @param {string} globalName - Name of the global object (e.g. 'GAIA_ENGAGEMENT')
 * @param {string} methodName - Method to call on the object
 * @param {...*} args - Arguments to pass
 * @returns {*} Return value of the method, or undefined if unavailable
 */
function safeCall(globalName, methodName, ...args) {
  const obj = window[globalName];
  if (obj != null && typeof obj[methodName] === 'function') {
    try {
      return obj[methodName](...args);
    } catch (err) {
      reportError(`${globalName}.${methodName}()`, err);
      return undefined;
    }
  }
  return undefined;
}

/**
 * Safe cross-module property getter.
 * Replaces the pattern:
 *   if (typeof GAIA_ENGAGEMENT !== 'undefined') score = GAIA_ENGAGEMENT.getScore();
 * With:
 *   score = safeGet('GAIA_ENGAGEMENT', 'getScore');
 *
 * Works with both methods (called with no args) and properties.
 *
 * @param {string} globalName - Name of the global object
 * @param {string} propOrMethod - Property name or zero-arg method name
 * @param {*} fallback - Value to return if unavailable (default: undefined)
 * @returns {*}
 */
function safeGet(globalName, propOrMethod, fallback) {
  const obj = window[globalName];
  if (obj == null) return fallback;
  const val = obj[propOrMethod];
  if (typeof val === 'function') {
    try { return val.call(obj); } catch (err) {
      reportError(`${globalName}.${propOrMethod}()`, err);
      return fallback;
    }
  }
  return val !== undefined ? val : fallback;
}

/**
 * Check if a global module exists and is usable.
 * @param {string} globalName
 * @returns {boolean}
 */
function hasModule(globalName) {
  return typeof window[globalName] !== 'undefined' && window[globalName] != null;
}

// ═══════════════════════════════════════════════════════════
// SAFE CHAIN — crash-proof fluent API wrapper
// Wraps any object so that missing methods are skipped
// instead of breaking the entire chain.
//
// Usage:
//   safeChain(globe).specularImageUrl('...').unknownMethod().pointsData(data);
//   // If .specularImageUrl doesn't exist → skipped, chain continues
// ═══════════════════════════════════════════════════════════

/**
 * Wrap an object to make fluent method chains crash-safe.
 * If a method doesn't exist, it's skipped and the chain continues.
 * If a method throws, the error is reported and the chain continues.
 *
 * @param {Object} obj - The object to wrap (e.g. a Globe instance)
 * @param {string} [label] - Optional label for error reporting
 * @returns {Proxy} - A proxy that safely delegates method calls
 */
function safeChain(obj, label) {
  const _label = label || obj?.constructor?.name || 'Object';
  return new Proxy(obj, {
    get(target, prop) {
      // Pass through non-function properties directly
      if (typeof prop === 'symbol') return target[prop];

      const val = target[prop];

      // Property exists and is a function — wrap it
      if (typeof val === 'function') {
        return (...args) => {
          try {
            const result = val.apply(target, args);
            // If method returns the object itself (fluent pattern), keep wrapping
            return result === target ? safeChain(target, _label) : result;
          } catch (e) {
            reportError(`safeChain(${_label}).${prop}()`, e);
            return safeChain(target, _label); // continue chain on error
          }
        };
      }

      // Property exists but isn't a function — return it
      if (val !== undefined) return val;

      // Property doesn't exist — return a no-op function that continues the chain
      reportWarn('safeChain', `${_label}.${prop}() does not exist — skipping`);
      return (..._args) => safeChain(target, _label);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// GAIA VOICE CONFIG — Single source of truth for voice modifiers
// All voice-related modules read from here instead of maintaining
// their own copies.
// ═══════════════════════════════════════════════════════════

const GAIA_VOICE_CONFIG = {
  /** Base modifiers per emotion tone (additive adjustments) */
  _modifiers: {
    grief:        { rate: -0.10, pitch: -0.05, volume: 0,     pauseBefore: 800 },
    concerned:    { rate: -0.08, pitch: -0.03, volume: 0,     pauseBefore: 500 },
    excited:      { rate: +0.05, pitch: 0,     volume: +0.1,  pauseBefore: 0 },
    proud:        { rate: +0.05, pitch: 0,     volume: +0.1,  pauseBefore: 0 },
    fierce:       { rate: +0.10, pitch: -0.08, volume: +0.15, pauseBefore: 0 },
    warm:         { rate: -0.08, pitch: +0.03, volume: -0.05, pauseBefore: 500 },
    mysterious:   { rate: -0.12, pitch: -0.05, volume: -0.1,  pauseBefore: 1200 },
    nurturing:    { rate: -0.08, pitch: +0.03, volume: -0.05, pauseBefore: 500 },
    urgent:       { rate: +0.08, pitch: -0.05, volume: +0.1,  pauseBefore: 200 },
    playful:      { rate: +0.03, pitch: +0.05, volume: 0,     pauseBefore: 300 },
    disappointed: { rate: -0.15, pitch: -0.10, volume: -0.15, pauseBefore: 600 },
    curious:      { rate: -0.03, pitch: +0.05, volume: 0,     pauseBefore: 200 },
  },

  /**
   * Get base modifier for a tone. Always returns a FRESH copy (safe to mutate).
   * @param {string} tone - Emotion name
   * @returns {{ rate: number, pitch: number, volume: number, pauseBefore: number }}
   */
  get(tone) {
    const base = this._modifiers[tone];
    return base
      ? { ...base }
      : { rate: 0, pitch: 0, volume: 0, pauseBefore: 0 };
  },

  /**
   * Convert additive modifier to Web Speech API multipliers.
   * Web Speech API uses: utterance.rate *= X (multiplicative)
   * Our config uses: rate: -0.12 (additive from 1.0 base)
   * @param {{ rate: number, pitch: number, volume: number }} mod
   * @returns {{ rate: number, pitch: number, volume: number }}
   */
  toMultiplier(mod) {
    return {
      rate:   1 + (mod.rate   || 0),
      pitch:  1 + (mod.pitch  || 0),
      volume: Math.min(1, Math.max(0, 1 + (mod.volume || 0))),
    };
  },

  /** List all available tone names */
  tones() {
    return Object.keys(this._modifiers);
  },
};

// ═══════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER — catches uncaught errors and rejections
// ═══════════════════════════════════════════════════════════
window.onerror = function(message, source, lineno, colno, error) {
  try {
    reportError('window.onerror', error || new Error(message + ' at ' + source + ':' + lineno));
  } catch (_) {}
  return false;
};

window.onunhandledrejection = function(event) {
  try {
    const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    reportError('unhandledrejection', err);
  } catch (_) {}
};

// ═══════════════════════════════════════════════════════════
// EVENT DELEGATION — replaces inline onclick/onkeydown/oninput
// Usage: data-action="functionName" data-action-args='["arg1","arg2"]'
// ═══════════════════════════════════════════════════════════
document.addEventListener('click', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.getAttribute('data-action');
  if (!action) return;
  var args = [];
  var argsAttr = el.getAttribute('data-action-args');
  if (argsAttr) {
    try { args = JSON.parse(argsAttr); } catch (_) { args = [argsAttr]; }
  }
  // Resolve function: window[action] or dotted path like "GaiaKeyGate.openModal"
  var fn = window;
  var parts = action.split('.');
  for (var i = 0; i < parts.length; i++) {
    fn = fn[parts[i]];
    if (!fn) return; // function not found, silently skip
  }
  if (typeof fn === 'function') {
    fn.apply(null, args);
  }
});

document.addEventListener('keydown', function(e) {
  var el = e.target.closest('[data-action-keydown]');
  if (!el) return;
  var action = el.getAttribute('data-action-keydown');
  if (!action) return;
  var fn = window;
  var parts = action.split('.');
  for (var i = 0; i < parts.length; i++) {
    fn = fn[parts[i]];
    if (!fn) return;
  }
  if (typeof fn === 'function') {
    fn(e);
  }
});

document.addEventListener('input', function(e) {
  var el = e.target.closest('[data-action-input]');
  if (!el) return;
  var action = el.getAttribute('data-action-input');
  if (!action) return;
  var fn = window;
  var parts = action.split('.');
  for (var i = 0; i < parts.length; i++) {
    fn = fn[parts[i]];
    if (!fn) return;
  }
  if (typeof fn === 'function') {
    fn(el);
  }
});

// ═══════════════════════════════════════════════════════════
// FOCUS TRAP — traps Tab focus within a container element
// Usage: var trap = createFocusTrap(modalEl, onClose); trap.activate(); trap.deactivate();
// ═══════════════════════════════════════════════════════════
function createFocusTrap(container, onClose) {
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var handler = function(e) {
    if (e.key !== 'Tab') return;
    var focusable = container.querySelectorAll(FOCUSABLE);
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  var escHandler = function(e) {
    if (e.key === 'Escape' && onClose) onClose();
  };
  return {
    activate: function() {
      document.addEventListener('keydown', handler);
      document.addEventListener('keydown', escHandler);
      // Focus first focusable element
      var focusable = container.querySelectorAll(FOCUSABLE);
      if (focusable.length > 0) focusable[0].focus();
    },
    deactivate: function() {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('keydown', escHandler);
    }
  };
}

// ═══════════════════════════════════════════════════════════
// REDUCED MOTION — respects prefers-reduced-motion
// Usage: if (!prefersReducedMotion()) { startAnimation(); }
// ═══════════════════════════════════════════════════════════
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── module-contracts.js ──
// ═══════════════════════════════════════════════════════════
// MODULE CONTRACTS — dependency and interface validation
//
// Each module registers what it provides, requires, emits, and listens.
// At boot, validate() checks that all dependencies are met
// BEFORE App.init() runs, catching wiring issues immediately.
//
// Load AFTER gaia-utils.js, BEFORE all other modules.
// ═══════════════════════════════════════════════════════════

const MODULE_CONTRACTS = (() => {
  const _registry = {};

  /**
   * Register a module's contract.
   * Call this immediately after window.X = X.
   *
   * @param {string} name - Module name (must match window[name])
   * @param {Object} contract
   * @param {string[]} [contract.provides] - Public method names this module exposes
   * @param {string[]} [contract.requires] - Module names this module depends on (load order)
   * @param {string[]} [contract.emits]   - Event names this module fires via EventBus
   * @param {string[]} [contract.listens] - Event names this module subscribes to via EventBus
   */
  function register(name, contract) {
    _registry[name] = {
      provides: contract.provides || [],
      requires: contract.requires || [],
      emits:   contract.emits   || [],
      listens: contract.listens || [],
    };
  }

  /**
   * Validate all registered contracts.
   * Checks:
   * 1. Every required module exists on window
   * 2. Every required module actually provides its declared methods
   * 3. Every registered module exists on window
   * 4. Every listened-to event has at least one emitter
   *
   * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
   */
  function validate() {
    const errors = [];
    const warnings = [];

    // Build a set of all emitted events
    const allEmitted = new Set();
    for (const contract of Object.values(_registry)) {
      for (const event of (contract.emits || [])) {
        allEmitted.add(event);
      }
    }

    for (const [name, contract] of Object.entries(_registry)) {
      // Check: does this module exist on window?
      if (!window[name]) {
        errors.push(`${name} is registered but NOT on window — missing window.${name} = ${name}`);
        continue;
      }

      // Check: does this module expose its declared methods?
      for (const method of contract.provides) {
        if (typeof window[name][method] !== 'function') {
          errors.push(`${name} declares .${method}() but it's missing or not a function`);
        }
      }

      // Check: are all required modules present?
      for (const dep of contract.requires) {
        if (!window[dep]) {
          // Check if it's an optional module (use MODULE_MANIFEST if available)
          const manifest = window.MODULE_MANIFEST;
          const isOptional = manifest && manifest[dep] && !manifest[dep].required;
          if (isOptional) {
            warnings.push(`${name} requires ${dep} (optional, not loaded)`);
          } else {
            errors.push(`${name} requires ${dep} but it's not on window`);
          }
        }
      }

      // Check: are all listened-to events emitted by someone?
      for (const event of (contract.listens || [])) {
        if (event === '*') continue; // wildcard = listen to all, skip check
        if (!allEmitted.has(event)) {
          warnings.push(`${name} listens to "${event}" but no module emits it`);
        }
      }
    }

    return { ok: errors.length === 0, errors, warnings };
  }

  /**
   * Get the full registry (for dev tools / debugging).
   * @returns {Object}
   */
  function getRegistry() {
    return { ..._registry };
  }

  return { register, validate, getRegistry };
})();
window.MODULE_CONTRACTS = MODULE_CONTRACTS;

// ── event-bus.js ──
/**
 * EventBus — decoupled module communication for Earth Love United.
 *
 * Modules emit events. Other modules listen. Neither side needs to know
 * about the other — the bus mediates.
 *
 * Contract schema extensions:
 *   MODULE_CONTRACTS.register('Name', {
 *     provides: ['init', 'reset', 'destroy', 'getState', 'customMethod'],
 *     requires: ['DepA'],      // hard deps — must load first
 *     emits:   ['eventName'],  // events this module fires
 *     listens: ['eventName'],  // events this module subscribes to
 *   });
 *
 * Runtime:
 *   window.EventBus.emit('eventName', payload)
 *   window.EventBus.on('eventName', callback)    → returns unsubscribe fn
 *   window.EventBus.off('eventName', callback)
 *   window.EventBus.once('eventName', callback)  → auto-unsubscribes after first fire
 */
const EventBus = (() => {
  const _listeners = {};  // eventName → Set of callbacks
  const _wildcards = [];  // callbacks subscribed to '*'

  return {
    /**
     * Emit an event. All listeners for that event name are called synchronously.
     * @param {string} eventName
     * @param {*} payload
     * @returns {number} — how many listeners were notified
     */
    emit(eventName, payload) {
      let count = 0;
      const listeners = _listeners[eventName];
      if (listeners) {
        listeners.forEach(cb => {
          try { cb(payload); } catch (e) { reportError('EventBus', `Listener for "${eventName}" threw: ${e.message}`); }
          count++;
        });
      }
      // Wildcard listeners get everything
      _wildcards.forEach(cb => {
        try { cb(eventName, payload); } catch (e) { reportError('EventBus', `Wildcard listener threw: ${e.message}`); }
        count++;
      });
      return count;
    },

    /**
     * Subscribe to an event. Returns an unsubscribe function.
     * @param {string} eventName — or '*' for all events
     * @param {Function} callback
     * @returns {Function} — call to unsubscribe
     */
    on(eventName, callback) {
      if (eventName === '*') {
        _wildcards.push(callback);
        return () => { const i = _wildcards.indexOf(callback); if (i >= 0) _wildcards.splice(i, 1); };
      }
      if (!_listeners[eventName]) _listeners[eventName] = new Set();
      _listeners[eventName].add(callback);
      return () => { _listeners[eventName]?.delete(callback); };
    },

    /**
     * Subscribe to an event for one emission only.
     * @param {string} eventName
     * @param {Function} callback
     * @returns {Function} — call to unsubscribe (before it fires)
     */
    once(eventName, callback) {
      const unsub = this.on(eventName, (payload) => {
        unsub();
        callback(payload);
      });
      return unsub;
    },

    /**
     * Remove a specific listener. Prefer the unsubscribe function from .on().
     * @param {string} eventName
     * @param {Function} callback
     */
    off(eventName, callback) {
      if (eventName === '*') {
        const i = _wildcards.indexOf(callback);
        if (i >= 0) _wildcards.splice(i, 1);
        return;
      }
      _listeners[eventName]?.delete(callback);
    },

    /**
     * Remove ALL listeners for an event name. Used by destroy() routines.
     * @param {string} eventName — or '*' for wildcards
     */
    clear(eventName) {
      if (eventName === '*') { _wildcards.length = 0; return; }
      delete _listeners[eventName];
    },

    /**
     * Return current state for debugging.
     */
    getState() {
      const events = {};
      for (const [name, cbs] of Object.entries(_listeners)) {
        events[name] = cbs.size;
      }
      return { events, wildcardCount: _wildcards.length };
    },

    /**
     * Remove all listeners. Used on full teardown.
     */
    reset() {
      for (const key of Object.keys(_listeners)) delete _listeners[key];
      _wildcards.length = 0;
    },
  };
})();

// Export: UMD for environments that need it, window for bare-metal
if (typeof module !== 'undefined') module.exports = EventBus;
if (typeof window !== 'undefined') window.EventBus = EventBus;

// ── storage-adapter.js ──
/**
 * STORAGE_ADAPTER — IndexedDB Asynchronous Storage Layer
 *
 * Zero-dependency IndexedDB wrapper for frontier datasets.
 * Replaces localStorage for payloads exceeding the ~5MB limit.
 *
 * Promise-based API: get, set, remove, clear.
 * Exposes SML lifecycle: init, reset, destroy, getState.
 *
 * Contract: STORAGE_ADAPTER
 * Requires: gaia-utils (for reportError)
 *
 * @version 1.0.0
 * @date May 27 2026
 */
const STORAGE_ADAPTER = (() => {
  'use strict';

  // ── Configuration ──────────────────────────────────────────────
  const DB_NAME = 'ELU_Storage';
  const DB_VERSION = 1;
  const STORE_NAME = 'keyvalue';
  const DB_KEY_PATH = 'key';
  const SCHEMA_VERSION_KEY = '__schema_version__';
  const CURRENT_SCHEMA_VERSION = 1;

  // ── Migrations ─────────────────────────────────────────────────
  // Each migration is a function(oldData) -> newData
  // Keyed by target schema version
  const _migrations = {
    // 1: initial version (no migration needed)
    // Future: 2: function(data) { ... return transformedData; }
  };

  async function _runMigrations() {
    try {
      const storedVersion = await get(SCHEMA_VERSION_KEY);
      const currentVersion = storedVersion ? parseInt(storedVersion, 10) : 0;
      if (currentVersion >= CURRENT_SCHEMA_VERSION) return;
      // Run each migration sequentially
      for (let v = currentVersion + 1; v <= CURRENT_SCHEMA_VERSION; v++) {
        if (_migrations[v]) {
          console.log(`[STORAGE_ADAPTER] Running migration to schema v${v}`);
          // Migration would transform data here
        }
      }
      await set(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
    } catch (e) {
      console.warn('[STORAGE_ADAPTER] Migration check failed:', e);
    }
  }

  // ── State ──────────────────────────────────────────────────────
  let _db = null;
  let _ready = false;
  let _readyPromise = null;
  let _readyResolve = null;
  let _readyReject = null;
  let _dbName = DB_NAME;
  let _dbVersion = DB_VERSION;
  let _storeName = STORE_NAME;

  // ── Internal: Open / Upgrade ───────────────────────────────────
  function _openDB() {
    if (_readyPromise) return _readyPromise;

    _readyPromise = new Promise((resolve, reject) => {
      _readyResolve = resolve;
      _readyReject = reject;

      if (!window.indexedDB) {
        const err = new Error('IndexedDB not supported in this browser');
        reportError('STORAGE_ADAPTER._openDB', err);
        _ready = false;
        _readyReject(err);
        return;
      }

      const request = window.indexedDB.open(_dbName, _dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Create or recreate the object store on version change
        if (oldVersion < 1) {
          if (db.objectStoreNames.contains(_storeName)) {
            db.deleteObjectStore(_storeName);
          }
          const store = db.createObjectStore(_storeName, { keyPath: DB_KEY_PATH });
          // Index for fast key lookups (redundant with keyPath but explicit)
          store.createIndex('key_idx', DB_KEY_PATH, { unique: true });
        }

        // Future version upgrades go here:
        // if (oldVersion < 2) { ... }
        // if (oldVersion < 3) { ... }
      };

      request.onsuccess = (event) => {
        _db = event.target.result;
        _ready = true;

        // Handle unexpected DB closure (e.g. user clears data in devtools)
        _db.onclose = () => {
          _ready = false;
          _db = null;
          _readyPromise = null;
          reportWarn('STORAGE_ADAPTER', 'Database connection closed unexpectedly');
        };

        // Handle version change from another tab
        _db.onversionchange = () => {
          _db.close();
          _ready = false;
          _db = null;
          _readyPromise = null;
          reportWarn('STORAGE_ADAPTER', 'Database version changed in another tab — connection closed');
        };

        _readyResolve(_db);
      };

      request.onerror = (event) => {
        const err = event.target.error || new Error('Unknown IndexedDB open error');
        reportError('STORAGE_ADAPTER._openDB', err);
        _ready = false;
        _readyReject(err);
      };

      request.onblocked = () => {
        const err = new Error('IndexedDB open blocked — other connections must close first');
        reportWarn('STORAGE_ADAPTER', err.message);
        // Don't reject — the onupgradeneeded in other tabs may resolve
      };
    });

    return _readyPromise;
  }

  // ── Internal: Get a transaction + store ────────────────────────
  function _getStore(mode = 'readonly') {
    if (!_db) {
      return Promise.reject(new Error('STORAGE_ADAPTER: Database not initialized. Call init() first.'));
    }
    return new Promise((resolve, reject) => {
      try {
        const tx = _db.transaction([_storeName], mode);
        const store = tx.objectStore(_storeName);
        resolve({ tx, store });
      } catch (err) {
        reportError('STORAGE_ADAPTER._getStore', err);
        reject(err);
      }
    });
  }

  // ── Internal: Wrap IDBRequest in Promise ───────────────────────
  function _requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IDBRequest failed'));
    });
  }

  // ── Public API ──────────────────────────────────────────────────

  /**
   * get(key) → Promise<value|null>
   * Retrieves a value by key. Returns null if not found.
   */
  function get(key) {
    return _openDB().then(() =>
      _getStore('readonly').then(({ store }) =>
        _requestToPromise(store.get(key))
      )
    ).then((result) => {
      if (result === undefined || result === null) return null;
      // result is { key, value } — unwrap
      return result.value !== undefined ? result.value : null;
    }).catch((err) => {
      reportError('STORAGE_ADAPTER.get', err);
      return null;
    });
  }

  /**
   * set(key, value) → Promise<boolean>
   * Stores a key-value pair. Overwrites if key exists.
   * Returns true on success, false on failure.
   */
  function set(key, value) {
    return _openDB().then(() =>
      _getStore('readwrite').then(({ store }) =>
        _requestToPromise(store.put({ key, value }))
      )
    ).then(() => true).catch((err) => {
      reportError('STORAGE_ADAPTER.set', err);
      return false;
    });
  }

  /**
   * remove(key) → Promise<boolean>
   * Deletes a key-value pair. Returns true on success.
   */
  function remove(key) {
    return _openDB().then(() =>
      _getStore('readwrite').then(({ store }) =>
        _requestToPromise(store.delete(key))
      )
    ).then(() => true).catch((err) => {
      reportError('STORAGE_ADAPTER.remove', err);
      return false;
    });
  }

  /**
   * clear() → Promise<boolean>
   * Removes ALL entries from the store.
   */
  function clear() {
    return _openDB().then(() =>
      _getStore('readwrite').then(({ store }) =>
        _requestToPromise(store.clear())
      )
    ).then(() => true).catch((err) => {
      reportError('STORAGE_ADAPTER.clear', err);
      return false;
    });
  }

  /**
   * keys() → Promise<string[]>
   * Returns all keys in the store. Utility for debugging / migration.
   */
  function keys() {
    return _openDB().then(() =>
      _getStore('readonly').then(({ store }) =>
        _requestToPromise(store.getAllKeys())
      )
    ).catch((err) => {
      reportError('STORAGE_ADAPTER.keys', err);
      return [];
    });
  }

  // ── SML Lifecycle ───────────────────────────────────────────────

  /**
   * init(config = {})
   * Opens the DB connection. Must be called before any get/set/remove/clear.
   * Config options:
   *   dbName    — override DB name
   *   dbVersion — override DB version
   *   storeName — override object store name
   */
  function init(config = {}) {
    if (config.dbName) _dbName = config.dbName;
    if (config.dbVersion) _dbVersion = config.dbVersion;
    if (config.storeName) _storeName = config.storeName;

    return _openDB().then((db) => {
      reportWarn('STORAGE_ADAPTER', `Initialized — DB: ${_dbName} v${_dbVersion}, store: ${_storeName}`);
      _runMigrations();
      return db;
    });
  }

  /**
   * reset()
   * Closes the DB, deletes it entirely, then reopens fresh.
   * Destructive — all data is lost.
   */
  function reset() {
    return new Promise((resolve, reject) => {
      // Close existing connection
      if (_db) {
        _db.close();
        _db = null;
      }
      _ready = false;
      _readyPromise = null;

      const delReq = window.indexedDB.deleteDatabase(_dbName);
      delReq.onsuccess = () => {
        reportWarn('STORAGE_ADAPTER', `Database ${_dbName} deleted`);
        // Reopen fresh
        _openDB().then(resolve).catch(reject);
      };
      delReq.onerror = () => {
        const err = delReq.error || new Error('Failed to delete database');
        reportError('STORAGE_ADAPTER.reset', err);
        reject(err);
      };
      delReq.onblocked = () => {
        reportWarn('STORAGE_ADAPTER', 'Delete blocked — close other tabs using this DB');
      };
    });
  }

  /**
   * destroy()
   * Closes the DB connection and resets internal state.
   * Does NOT delete the database — use reset() for that.
   */
  function destroy() {
    if (_db) {
      _db.close();
      _db = null;
    }
    _ready = false;
    _readyPromise = null;
    _readyResolve = null;
    _readyReject = null;
    reportWarn('STORAGE_ADAPTER', 'Destroyed — connection closed');
  }

  /**
   * getState() → { ready, dbName, dbVersion, storeName }
   * Returns current adapter state for debugging.
   */
  function getState() {
    return {
      ready: _ready,
      dbName: _dbName,
      dbVersion: _dbVersion,
      storeName: _storeName,
      dbInstance: _db !== null,
    };
  }

  // ── Exports ─────────────────────────────────────────────────────
  return {
    // Promise API
    get,
    set,
    remove,
    clear,
    keys,

    // SML lifecycle
    init,
    reset,
    destroy,
    getState,

    // Migration
    migrateStorage: _runMigrations,
    getSchemaVersion: () => CURRENT_SCHEMA_VERSION,
  };
})();

// ── Register on window (required by safeCall / hasModule) ──────────
window.STORAGE_ADAPTER = STORAGE_ADAPTER;

// ── Module Contract ────────────────────────────────────────────────
if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('STORAGE_ADAPTER', {
    provides: ['init', 'reset', 'destroy', 'getState', 'get', 'set', 'remove', 'clear', 'keys', 'migrateStorage', 'getSchemaVersion'],
    requires: [],
  });
}

// ── storage.js ──
// ═══════════════════════════════════════════════
// STORAGE — delegates to STORAGE_ADAPTER (IndexedDB)
//
// Thin async wrapper so callers can optionally await.
// Must load AFTER storage-adapter.js (depends on window.STORAGE_ADAPTER).
//
// Usage:
//   await Storage.safeSetItem(key, value)  → Promise<boolean>
//   await Storage.safeGetItem(key)         → Promise<value|null>
//   await Storage.safeRemoveItem(key)      → Promise<boolean>
// ═══════════════════════════════════════════════
const Storage = {
  async safeSetItem(key, value) {
    try {
      return await window.STORAGE_ADAPTER.set(key, value);
    } catch (e) {
      console.warn(`[Storage] set failed for "${key}":`, e?.message || e);
      return false;
    }
  },

  async safeGetItem(key) {
    try {
      return await window.STORAGE_ADAPTER.get(key);
    } catch (e) {
      console.warn(`[Storage] get failed for "${key}":`, e?.message || e);
      return null;
    }
  },

  async safeRemoveItem(key) {
    try {
      return await window.STORAGE_ADAPTER.remove(key);
    } catch (e) {
      console.warn(`[Storage] remove failed for "${key}":`, e?.message || e);
      return false;
    }
  },

  async safeClear() {
    try {
      return await window.STORAGE_ADAPTER.clear();
    } catch (e) {
      console.warn(`[Storage] clear failed:`, e?.message || e);
      return false;
    }
  },

  getState() {
    try {
      return window.STORAGE_ADAPTER.getState();
    } catch {
      return { ready: false, error: 'STORAGE_ADAPTER unavailable' };
    }
  }
};

// Expose to window for cross-module access (bare-metal, no modules)
window.Storage = Storage;

// ── Module Contract ────────────────────────────────────────────────
if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('Storage', {
    provides: ['safeSetItem', 'safeGetItem', 'safeRemoveItem', 'safeClear', 'getState'],
    requires: ['STORAGE_ADAPTER'],
  });
}

// ── data-schema.js ──
/**
 * DATA SCHEMA — JSON validation for Earth Love United data files
 *
 * Validates data/*.json files against expected schemas at load time.
 * Reports errors via reportError() so they appear in dev-mode error banner.
 * Zero dependencies, bare-metal IIFE pattern.
 */
const DATA_SCHEMA = (() => {
  'use strict';

  // ── Schema definitions ──
  const SCHEMAS = {
    biomes: {
      type: 'object',
      required: true,
      validate(value) {
        // value is the parsed JSON object (keyed by biome ID)
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return 'biomes.json must be an object keyed by biome ID';
        }
        const errors = [];
 for (const [id, biome] of Object.entries(value)) {
 if (id === '_meta') continue; // schema metadata, not a biome
 if (!biome.name) errors.push(`biome "${id}": missing "name"`);
 if (typeof biome.density !== 'number') errors.push(`biome "${id}": "density" must be a number`);
 if (typeof biome.seq !== 'number') errors.push(`biome "${id}": "seq" must be a number`);
 }
        return errors.length ? errors : null;
      },
    },
    sites: {
      type: 'array',
      required: true,
      validate(value) {
        if (!Array.isArray(value)) return 'sites.json must be an array';
        const errors = [];
        for (let i = 0; i < value.length; i++) {
          const site = value[i];
          if (!site.id) errors.push(`site[${i}]: missing "id"`);
          if (!site.name) errors.push(`site[${i}]: missing "name"`);
          if (typeof site.lat !== 'number') errors.push(`site "${site.id || i}": "lat" must be a number`);
          if (typeof site.lng !== 'number') errors.push(`site "${site.id || i}": "lng" must be a number`);
          if (!site.primaryBiome) errors.push(`site "${site.id || i}": missing "primaryBiome"`);
        }
        return errors.length ? errors : null;
      },
    },
    'pledge-nodes': {
      type: 'array',
      required: true,
      validate(value) {
        if (!Array.isArray(value)) return 'pledge-nodes.json must be an array';
        const errors = [];
        for (let i = 0; i < value.length; i++) {
          const node = value[i];
          if (!node.iso) errors.push(`pledge-node[${i}]: missing "iso"`);
          if (!node.country) errors.push(`pledge-node[${i}]: missing "country"`);
        }
        return errors.length ? errors : null;
      },
    },
  };

  // ── Validate a parsed JSON value against its schema ──
  function validate(fileName, data) {
    // Map filename to schema key
    const key = fileName.replace('.json', '').replace('data/', '');
    const schema = SCHEMAS[key];
    if (!schema) return; // no schema for this file, skip

    const errors = schema.validate(data);
    if (errors) {
      const msg = Array.isArray(errors) ? errors.join('; ') : errors;
      if (typeof reportError === 'function') {
        reportError('DATA_SCHEMA', new Error(`${fileName}: ${msg}`));
      }
      console.error(`[DATA_SCHEMA] ${fileName}: ${msg}`);
    } else {
      console.log(`[DATA_SCHEMA] ${fileName}: valid`);
    }
  }

  return { validate };
})();

window.DATA_SCHEMA = DATA_SCHEMA;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('DATA_SCHEMA', {
    provides: ['validate'],
    requires: [],
  });
}

// ── data.js ──
// ═══════════════════════════════════════════════
// DATA — Loads JSON, provides shared state
//
// Must load AFTER storage.js (depends on window.Storage).
// ═══════════════════════════════════════════════

const Data = {
  biomes: null,
  sites: null,
  pledgeNodes: null,

  async init() {
    // Fetch all data files in parallel — each individually guarded
    const [biomesRes, sitesRes, pledgeNodesRes] = await Promise.allSettled([
      fetch('data/biomes.json'),
      fetch('data/sites.json'),
      fetch('data/pledge-nodes.json')
    ]);

    // Parse each response individually — a 404 on one shouldn't kill the others
    this.biomes = await this._parseResponse(biomesRes, 'biomes');
    this.sites = await this._parseResponse(sitesRes, 'sites');
    this.pledgeNodes = await this._parseResponse(pledgeNodesRes, 'pledge-nodes');

    // Validate loaded data against schemas
    if (typeof DATA_SCHEMA !== 'undefined') {
      if (this.biomes) DATA_SCHEMA.validate('biomes.json', this.biomes);
      if (this.sites) DATA_SCHEMA.validate('sites.json', this.sites);
      if (this.pledgeNodes) DATA_SCHEMA.validate('pledge-nodes.json', this.pledgeNodes);
    }

    if (this.biomes && this.sites) {
      console.log('[Data] Loaded:', Object.keys(this.biomes).filter(k => k !== '_meta').length, 'biomes,', this.sites.length, 'sites,', this.pledgeNodes?.length || 0, 'pledge nodes');
    } else {
      console.error('[Data] CRITICAL: Some data files failed to load. biomes:', !!this.biomes, 'sites:', !!this.sites);
    }

    // ── Country Hex Color Lookup ──
    // Built once from pledgeNodes, keyed by ISO_A3
    // Used by GlobeModule to color hex polygons per-country
    this.countryHexColors = {};
    if (this.pledgeNodes) {
      this.pledgeNodes.forEach(n => {
        this.countryHexColors[n.iso] = {
          country: n.country,
          iso: n.iso,
          lat: n.lat,
          lng: n.lng,
          emissions: n.fossil_co2_mt,
          perCapita: n.co2_per_capita,
          gap: n.reality_gap_mt,
          onTrack: n.on_track,
          catRating: n.cat_rating,
          catScore: n.cat_score,
          globeColor: n.globe_color,
          targetYear: n.target_year,
          reductionPct: n.reduction_pct,
          lulucf: n.lulucf_co2_mt,
          totalCo2: n.total_co2_mt,
        };
      });
      console.log('[Data] Country hex colors:', Object.keys(this.countryHexColors).length, 'countries');
    }
    return this;
  },

  /** Parse a settled fetch promise — guards against HTTP errors and bad JSON */
 async _parseResponse(settledResult, name) {
 try {
 if (settledResult.status === 'rejected') {
 console.error(`[Data] Fetch failed for ${name}:`, settledResult.reason?.message || 'network error');
 return null;
 }
 const resp = settledResult.value;
 if (!resp.ok) {
 console.error(`[Data] HTTP ${resp.status} for ${name}.json`);
 return null;
 }
 const raw = await resp.json();
 // Unwrap envelope if present (_meta + data structure)
 if (raw && typeof raw === 'object' && '_meta' in raw && 'data' in raw) {
 this._meta = this._meta || {};
 this._meta[name] = raw._meta;
 return raw.data;
 }
 return raw;
 } catch (e) {
 console.error(`[Data] Parse error for ${name}:`, e.message);
 return null;
 }
 },

  getBiome(key) { return this.biomes ? this.biomes[key] : null; },
  getSite(id) { return this.sites ? this.sites.find(s => s.id === id) : null; },
  getPledgeNode(iso) { return this.pledgeNodes ? this.pledgeNodes.find(n => n.iso === iso) : null; },
  getCountryHexData(iso) { return this.countryHexColors ? this.countryHexColors[iso] || null : null; },
  getAllBiomes() { return this.biomes ? Object.entries(this.biomes).filter(([k]) => k !== '_meta').map(([k, v]) => ({ key: k, ...v })) : []; },

  // Carbon calculation engine
  transitionCarbon(from, to, ha, yrs = 30) {
    if (!this.biomes) return null;
    const f = this.biomes[from], t = this.biomes[to];
    if (!f || !t) return null;
    const sC = (t.density - f.density) * ha;
    const fC = (t.seq - f.seq) * ha;
    const cum = sC + fC * yrs;
    return { stock_co2: sC * 3.67, flux_co2: fC * 3.67, cumulative_co2: cum * 3.67, years: yrs };
  },

  scaleContext(co2) {
    const a = Math.abs(co2);
    return {
      fraction: a / 20e9,
      cars: a / 4.6,
      flights: a / 1.0,
      summary: `${this.fmt(a)} t CO₂ = ${(a / 4.6).toFixed(0)} cars removed for a year, or ${(a / 1.0).toFixed(0)} transatlantic flights offset`
    };
  },

  fmt(n) {
    return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' :
           n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
           n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0);
  },

  // ── Standard Module Lifecycle (SML) ──
  reset() {
    console.debug('[SML] Data.reset');
    return true;
  },
  destroy() {
    console.debug('[SML] Data.destroy');
    return true;
  },
  getState() {
    return {};
  }
};

window.Data = Data;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('Data', {
    provides: ['init', 'fmt', 'reset', 'destroy', 'getState'],
    requires: ['STORAGE_ADAPTER'],
  });
}

