/**
 * GAIA Integration Bridge — Connects ModuleEngine to DIS/Gaia state machine
 * Dispatches events to gaia.html's event system for quest/mood/state tracking
 */

(function() {
  'use strict';

  // GAIA Event Bridge
  var GaiaBridge = {

    /**
     * Dispatch a learning event to the GAIA state machine
     * @param {string} event - Event type
     * @param {object} data - Event payload
     */
    dispatch: function(event, data) {
      var detail = Object.assign({
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
          dispatchEvent(new CustomEvent('ELU:' + event, { detail: detail }));
        }
      } catch (e) {
        console.warn('[GaiaBridge] dispatch failed:', e.message);
      }
    },

    /**
     * Called when a module starts
     */
    onModuleStart: function(moduleId, moduleTitle) {
      this.dispatch('module-start', {
        moduleId: moduleId,
        moduleTitle: moduleTitle,
        questProgress: this._getQuestProgress()
      });
    },

    /**
     * Called when a module completes
     */
    onModuleComplete: function(moduleId, state) {
      this.dispatch('module-complete', {
        moduleId: moduleId,
        score: state.score || 0,
        answers: state.answers || [],
        interactions: state.interactions || [],
        durationMs: Date.now() - new Date(state.startedAt).getTime(),
        nextModule: state.nextModule || null
      });
    },

    /**
     * Called when stage transitions
     */
    onStageChange: function(stageIndex, stageType, stageTitle) {
      this.dispatch('stage-change', {
        stageIndex: stageIndex,
        stageType: stageType,
        stageTitle: stageTitle
      });
    },

    /**
     * Update DIS quest state
     */
    updateQuestState: function(moduleId, progress) {
      this.dispatch('quest-update', {
        moduleId: moduleId,
        progress: progress || 0,
        moduleComplete: progress >= 1.0
      });
    },

    /**
     * Derive quest progress from module state
     */
    _getQuestProgress: function() {
      // Map of module completion
      var completed = 0;
      var total = 7;
      for (var i = 1; i <= total; i++) {
        var key = 'elu_module_0' + i + '-carbon-atom';
        if (i > 1) key = 'elu_module_0' + i;
        try {
          var saved = localStorage.getItem('elu_module_0' + i + '-carbon-atom');
          if (!saved && i > 1) saved = localStorage.getItem('elu_module_0' + i);
          if (saved) {
            var parsed = JSON.parse(saved);
            if (parsed && parsed.completedAt) completed++;
          }
        } catch (e) { /* skip */ }
      }
      return { completed: completed, total: total, pct: Math.round((completed / total) * 100) };
    }
  };

  // Expose globally
  window.GaiaBridge = GaiaBridge;

  // Auto-listen for module events if ModuleEngine is available
  if (typeof ModuleEngine !== 'undefined') {
    var _origInit = ModuleEngine.prototype.init;
    ModuleEngine.prototype.init = function(moduleId) {
      GaiaBridge.onModuleStart(moduleId, this.definition ? this.definition.title : moduleId);
      return _origInit.call(this, moduleId);
    };

    var _origComplete = ModuleEngine.prototype.complete;
    ModuleEngine.prototype.complete = function() {
      _origComplete.call(this);
      GaiaBridge.onModuleComplete(this.moduleId, this.state);
    };

    var _origGoTo = ModuleEngine.prototype.goToStage;
    ModuleEngine.prototype.goToStage = function(index) {
      _origGoTo.call(this, index);
      if (this.definition && this.definition.stages[index]) {
        GaiaBridge.onStageChange(index, this.definition.stages[index].type, this.definition.stages[index].title);
      }
    };
  }

  console.log('[GaiaBridge] Initialized — ready for DIS integration');
})();