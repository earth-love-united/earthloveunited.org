/**
 * ModuleEngine — Core engine for declarative learning modules
 * Loads module definitions from data/modules/*.json and renders
 * the Hook → Explore → Discover → Verify → Connect lifecycle.
 */

class ModuleEngine {
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

  // ── Lifecycle ──────────────────────────────────────────────

  async init(moduleId) {
    this.moduleId = moduleId || this.moduleId;
    this.definition = await ModuleRegistry.load(this.moduleId);
    this.state.startedAt = new Date().toISOString();
    this._loadProgress();
    this._applyTheme();
    this.render();
    return this;
  }

  render() {
    this.container.innerHTML = '';
    this.activeComponents = [];
    this._buildModuleShell();
    this._renderStage(this.currentStage >= 0 ? this.currentStage : 0);
  }

  async goToStage(index) {
    if (index < 0 || index >= this.definition.stages.length) return;
    this.currentStage = index;
    this._renderStage(index);
    this._saveProgress();
    if (this.onStageChange) this.onStageChange(this.definition.stages[index], index);

    // Auto-advance if stage has autoAdvance config
    const stage = this.definition.stages[index];
    if (stage.autoAdvance && stage.autoAdvance.delay) {
      setTimeout(() => this.goToStage(index + 1), stage.autoAdvance.delay);
    }
  }

  next() {
    this.goToStage(this.currentStage + 1);
  }

  prev() {
    this.goToStage(this.currentStage - 1);
  }

  complete() {
    this.state.completedAt = new Date().toISOString();
    this._saveProgress();
    this._showCompletion();
    if (this.onComplete) this.onComplete(this.state);
    this._dispatchGAIAEvent('module:complete', {
      moduleId: this.moduleId,
      score: this.state.score,
      duration: this._getDuration()
    });
  }

  // ── Internal Rendering ─────────────────────────────────────

  _buildModuleShell() {
    this.container.innerHTML = `
      <section class="elu-module" data-module="${this.moduleId}">
        <div class="elu-module-header">
          <button class="elu-btn elu-btn-back" onclick="engine.goToStage(engine.currentStage - 1)" style="display:${this.currentStage <= 0 ? 'none' : 'inline-flex'}">
            ← Back
          </button>
          <h2 class="elu-module-title">${this.definition.title}</h2>
          <div class="elu-progress-bar">
            <div class="elu-progress-fill" style="width: ${((this.currentStage + 1) / this.definition.stages.length) * 100}%"></div>
          </div>
          <span class="elu-stage-indicator">${this.currentStage + 1} / ${this.definition.stages.length}</span>
        </div>
        <div class="elu-module-body"></div>
        <div class="elu-module-footer"></div>
      </section>
    `;
    this._body = this.container.querySelector('.elu-module-body');
    this._footer = this.container.querySelector('.elu-module-footer');
  }

  async _renderStage(index) {
    const stage = this.definition.stages[index];
    if (!stage) return;

    this._body.innerHTML = '';
    this._footer.innerHTML = '';

    // Update header
    const title = this.container.querySelector('.elu-module-title');
    if (title) title.textContent = stage.title || this.definition.title;
    const indicator = this.container.querySelector('.elu-stage-indicator');
    if (indicator) indicator.textContent = `${index + 1} / ${this.definition.stages.length}`;
    const backBtn = this.container.querySelector('.elu-btn-back');
    if (backBtn) backBtn.style.display = index <= 0 ? 'none' : 'inline-flex';
    const progressFill = this.container.querySelector('.elu-progress-fill');
    if (progressFill) progressFill.style.width = `${((index + 1) / this.definition.stages.length) * 100}%`;

    // Get renderer for this stage type
    const renderer = this._getRenderer(stage.type);
    if (!renderer) {
      console.error(`No renderer for stage type: ${stage.type}`);
      this._body.innerHTML = `<div class="elu-error">Unknown stage type: ${stage.type}</div>`;
      return;
    }

    // Render component
    try {
      const component = renderer.render(stage, this.state);
      this._body.appendChild(component.element);
      this.activeComponents.push(component);

      // Wire actions
      if (stage.actions) {
        this._renderActions(stage.actions, component);
      }

      // Wire transitions
      if (stage.onAction) {
        component.onAction = (action, data) => this._handleAction(stage, action, data);
      }
    } catch (e) {
      console.error('Error rendering stage:', e);
      this._body.innerHTML = `<div class="elu-error">Error loading this stage. Please try again.</div>`;
    }

    // Scroll to top of module
    this.container.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Dispatch event
    this._dispatchGAIAEvent('module:stage', {
      moduleId: this.moduleId,
      stageIndex: index,
      stageType: stage.type
    });
  }

  _getRenderer(type) {
    return this.renderers[type] || ModuleEngine.renderers[type];
  }

  _renderActions(actions, component) {
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `elu-btn elu-btn-${action.style || 'primary'}`;
      btn.textContent = action.label;
      if (action.icon) btn.insertAdjacentHTML('afterbegin', `<span class="elu-btn-icon">${action.icon}</span>`);
      btn.onclick = () => this._handleAction(action);
      this._footer.appendChild(btn);
    });
  }

  _handleAction(action, data) {
    // Record interaction
    this.state.interactions.push({
      action: action.id || action.label,
      data: data || {},
      timestamp: Date.now()
    });

    // Handle different action types
    switch (action.type) {
      case 'next':
        this.goToStage(this.currentStage + 1);
        break;
      case 'prev':
        this.goToStage(this.currentStage - 1);
        break;
      case 'complete':
        this.complete();
        break;
      case 'jump':
        this.goToStage(action.targetStage || 0);
        break;
      case 'custom':
        if (action.handler && typeof this[action.handler] === 'function') {
          this[action.handler](action, data);
        }
        break;
    }
  }

  _applyTheme() {
    const el = this.container;
    el.style.setProperty('--elu-accent', this.definition.theme?.accent || '#4ecdc4');
    el.style.setProperty('--elu-bg', this.definition.theme?.bg || '#030305');
    el.style.setProperty('--elu-module-accent', this.definition.theme?.accent || '#7be8d0');
  }

  // ── Scoring ────────────────────────────────────────────────

  addScore(points, reason) {
    this.state.score += points;
    this.state.answers.push({ reason, points, timestamp: Date.now() });
    this._saveProgress();
    return this.state.score;
  }

  getScore() { return this.state.score; }

  // ── Persistence ────────────────────────────────────────────

  _saveProgress() {
    try {
      localStorage.setItem(`elu_module_${this.moduleId}`, JSON.stringify(this.state));
    } catch (e) { /* storage full or unavailable */ }
  }

  _loadProgress() {
    try {
      const saved = localStorage.getItem(`elu_module_${this.moduleId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.completedAt) {
          // Already completed — skip to end
          this.currentStage = this.definition.stages.length;
          this.state = parsed;
          return;
        }
        this.currentStage = parsed.currentStage || 0;
        this.state = { ...this.state, ...parsed };
      }
    } catch (e) { /* start fresh */ }
  }

  reset() {
    localStorage.removeItem(`elu_module_${this.moduleId}`);
    this.currentStage = 0;
    this.state = { score: 0, answers: [], interactions: [], startedAt: new Date().toISOString(), completedAt: null, custom: {} };
    this.render();
  }

  // ── Utility ────────────────────────────────────────────────

  _getDuration() {
    if (!this.state.startedAt) return 0;
    return Date.now() - new Date(this.state.startedAt).getTime();
  }

  _showCompletion() {
    this._body.innerHTML = `
      <div class="elu-completion">
        <div class="elu-completion-badge">✓</div>
        <h3>Module Complete!</h3>
        <p>Score: ${this.state.score}</p>
        <p>Time: ${Math.round(this._getDuration() / 1000)}s</p>
        ${this.definition.next_module ? `
          <button class="elu-btn elu-btn-primary" onclick="engine.init('${this.definition.next_module}')">
            Continue → ${this.definition.next_module.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ` : ''}
      </div>
    `;
    this._footer.innerHTML = '';
  }

  _dispatchGAIAEvent(type, detail) {
    if (typeof dispatchEvent === 'function') {
      dispatchEvent(new CustomEvent(type, { detail }));
    }
  }

  // ── Template helpers ────────────────────────────────────────

  static interpolate(template, data) {
    return template.replace(/\{\{(\w+(\.\w+)*)\}\}/g, (match, key) => {
      const parts = key.split('.');
      let val = data;
      for (const part of parts) {
        val = val?.[part];
        if (val === undefined) return match;
      }
      return val !== null ? val : match;
    });
  }

  static sanitize(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
}

// Static renderers registry
ModuleEngine.renderers = {};

// Singleton instance (global, like other ELU modules)
window.ModuleEngine = ModuleEngine;