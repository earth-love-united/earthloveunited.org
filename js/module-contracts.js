// ═══════════════════════════════════════════════════════════
// MODULE CONTRACTS — dependency and interface validation
//
// Each module registers what it provides and requires.
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
   * @param {string[]} [contract.requires] - Module names this module depends on
   */
  function register(name, contract) {
    _registry[name] = {
      provides: contract.provides || [],
      requires: contract.requires || [],
    };
  }

  /**
   * Validate all registered contracts.
   * Checks:
   * 1. Every required module exists on window
   * 2. Every required module actually provides its declared methods
   * 3. Every registered module exists on window
   *
   * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
   */
  function validate() {
    const errors = [];
    const warnings = [];

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
