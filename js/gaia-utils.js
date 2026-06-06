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
