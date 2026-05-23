/**
 * ModuleRegistry — Loads and validates module definitions
 * All module JSON lives in data/modules/
 */

class ModuleRegistry {
  static modules = new Map();
  static schema = {
    required: ['id', 'title', 'stages'],
    validStageTypes: ['text', 'quiz', 'slider', 'branch', 'gauge', 'timeline', 'cardstack', 'comparison', 'globe', 'calculator']
  };

  static async load(id) {
    if (this.modules.has(id)) return this.modules.get(id);

    const resp = await fetch(`${window.__ELU_BASE_PATH || 'data/modules'}/${id}.json`);
    if (!resp.ok) throw new Error(`Module not found: ${id}`);
    const def = await resp.json();
    await this.validate(def);
    this.modules.set(id, def);
    return def;
  }

  static async validate(def) {
    for (const field of this.schema.required) {
      if (!def[field]) throw new Error(`Module missing required field: ${field}`);
    }
    if (!Array.isArray(def.stages) || def.stages.length === 0) {
      throw new Error(`Module ${def.id} must have at least one stage`);
    }
    for (const stage of def.stages) {
      if (!stage.type) throw new Error(`Stage in ${def.id} missing type`);
      if (!this.schema.validStageTypes.includes(stage.type)) {
        throw new Error(`Unknown stage type "${stage.type}" in module ${def.id}`);
      }
    }
    return true;
  }

  static async loadAll(manifest) {
    // manifest = array of module IDs e.g. ["01-carbon-atom","02-keeling-curve",...]
    const results = {};
    for (const id of manifest) {
      results[id] = await this.load(id);
    }
    return results;
  }

  static clearCache(id) {
    if (id) this.modules.delete(id);
    else this.modules.clear();
  }

  static list() {
    return [...this.modules.keys()];
  }
}

window.ModuleRegistry = ModuleRegistry;