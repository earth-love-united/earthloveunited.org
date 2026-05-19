// ═══════════════════════════════════════════════════════════
// GAIA UTILITIES — Foundation layer for safe cross-module ops
// Must load BEFORE all other scripts.
//
// Two systems:
// 1. Safe DOM:    $(), $html(), $text(), $on()
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
      console.warn(`[safeCall] ${globalName}.${methodName}() threw:`, err.message);
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
    try { return val.call(obj); } catch { return fallback; }
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
