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
