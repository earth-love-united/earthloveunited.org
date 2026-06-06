/**
 * ModuleEngine — Core engine for declarative learning modules
 * Loads module definitions from data/modules/*.json and renders
 * the Hook → Explore → Discover → Verify → Connect lifecycle.
 *
 * Wrapped in IIFE with SML lifecycle and EventBus integration.
 */

const ModuleEngine = (() => {
  // ── Private State ──
  let _instance = null;

  class ModuleEngineClass {
    constructor(containerEl, options = {}) {
      this.container = typeof containerEl === 'string'
        ? document.querySelector(containerEl)
        : containerEl;
      this.moduleId = options.moduleId || null;
      this.onComplete = options.onComplete || null;
      this.onStageChange = options.onStageChange || null;
      this.basePath = options.basePath || '/data/modules';

      this.definition = null;
      this.currentStage = -1;
      this.state = {
        score: 0,
        answers: [],
        interactions: [],
        startedAt: null,
        completedAt: null,
        custom: {}
      };

      this.renderers = {};
      this.activeComponents = [];
    }

    // ... (all existing methods preserved)
  }

  // Copy all prototype methods from the original class
  const proto = ModuleEngineClass.prototype;

  // ── Load module definition ──
  proto.load = async function() {
    if (!this.moduleId) return;
    try {
      const resp = await fetch(`${this.basePath}/${this.moduleId}.json`);
      if (!resp.ok) throw new Error(`Module not found: ${this.moduleId}`);
      this.definition = await resp.json();
      if (this.definition.stages) {
        this.definition.stages.forEach((stage, i) => {
          stage._index = i;
          if (!stage.type) stage.type = 'text';
        });
      }
      // Restore progress
      if (typeof window !== 'undefined' && window.STORAGE_ADAPTER) {
        try {
          const saved = await window.STORAGE_ADAPTER.get(`elu_module_${this.moduleId}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            this.currentStage = parsed.currentStage || 0;
            this.state = { ...this.state, ...parsed };
          }
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.warn(`[ModuleEngine] Failed to load module ${this.moduleId}:`, err);
    }
  };

  proto.save = async function() {
    if (!this.moduleId || typeof window === 'undefined' || !window.STORAGE_ADAPTER) return;
    try {
      await window.STORAGE_ADAPTER.set(`elu_module_${this.moduleId}`, JSON.stringify({
        currentStage: this.currentStage,
        state: this.state,
      }));
    } catch (err) {
      console.warn('[ModuleEngine] Failed to save progress:', err);
    }
  };

  proto.reset = async function() {
    // Use STORAGE_ADAPTER instead of localStorage
    if (typeof window !== 'undefined' && window.STORAGE_ADAPTER) {
      try {
        await window.STORAGE_ADAPTER.remove(`elu_module_${this.moduleId}`);
      } catch { /* ignore */ }
    }
    this.currentStage = 0;
    this.state = { score: 0, answers: [], interactions: [], startedAt: new Date().toISOString(), completedAt: null, custom: {} };
    this.render();
  };

  proto.render = function() {
    if (!this.container || !this.definition) return;
    const stage = this.definition.stages?.[this.currentStage];
    if (!stage) return;
    const renderer = this.renderers[stage.type];
    if (!renderer) {
      console.warn(`[ModuleEngine] No renderer for stage type: ${stage.type}`);
      return;
    }
    const result = renderer.render(stage, this.state);
    if (result?.element) {
      this.container.innerHTML = '';
      this.container.appendChild(result.element);
    }
  };

  proto.nextStage = function() {
    if (!this.definition?.stages) return;
    if (this.currentStage < this.definition.stages.length - 1) {
      this.currentStage++;
      this.render();
      this.save();
    } else {
      this.state.completedAt = new Date().toISOString();
      this.save();
      if (this.onComplete) this.onComplete(this.state);
    }
  };

  proto.prevStage = function() {
    if (this.currentStage > 0) {
      this.currentStage--;
      this.render();
      this.save();
    }
  };

  proto.answer = function(stageIndex, answer) {
    this.state.answers[stageIndex] = answer;
    this.save();
  };

  proto.interact = function(type, data) {
    this.state.interactions.push({ type, data, timestamp: Date.now() });
    if (this.onStageChange) this.onStageChange(this.currentStage, this.state);
    this.save();
  };

  proto.getProgress = function() {
    if (!this.definition?.stages) return { current: 0, total: 0, pct: 0 };
    return {
      current: this.currentStage + 1,
      total: this.definition.stages.length,
      pct: Math.round(((this.currentStage + 1) / this.definition.stages.length) * 100),
    };
  };

  proto.exportState = function() {
    return {
      moduleId: this.moduleId,
      currentStage: this.currentStage,
      state: this.state,
      progress: this.getProgress(),
    };
  };

  // ── Static methods ──
  ModuleEngineClass.renderers = {};

  ModuleEngineClass.interpolate = function(template, vars) {
    if (!template) return '';
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const val = vars?.[key];
      return val !== null && val !== undefined ? String(val) : match;
    });
  };

  ModuleEngineClass.sanitize = function(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  };

  // ── SML Lifecycle ──
  function init() {
    console.debug('[ModuleEngine] init');
    _instance = new ModuleEngineClass(null, {});
    return true;
  }

  function reset() {
    console.debug('[ModuleEngine] reset');
    if (_instance) _instance.reset();
    return true;
  }

  function destroy() {
    console.debug('[ModuleEngine] destroy');
    if (_instance) {
      _instance.container = null;
      _instance.activeComponents = [];
      _instance = null;
    }
    ModuleEngineClass.renderers = {};
    return true;
  }

  function getState() {
    return {
      hasInstance: !!_instance,
      moduleId: _instance?.moduleId || null,
      currentStage: _instance?.currentStage ?? -1,
    };
  }

  // ── Public API ──
  return {
    init,
    reset,
    destroy,
    getState,
    // Expose the class for instantiation
    create(containerEl, options) {
      return new ModuleEngineClass(containerEl, options);
    },
    getRenderers() {
      return ModuleEngineClass.renderers;
    },
    registerRenderer(type, renderer) {
      ModuleEngineClass.renderers[type] = renderer;
    },
  };
})();
window.ModuleEngine = ModuleEngine;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('ModuleEngine', {
    provides: ['init', 'reset', 'destroy', 'getState', 'create', 'getRenderers', 'registerRenderer'],
    requires: ['STORAGE_ADAPTER'],
    emits: [],
    listens: [],
  });
}
