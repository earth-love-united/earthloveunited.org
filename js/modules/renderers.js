/**
 * Stage Renderers — One renderer per stage type
 * Each renderer has: render(config, state) => { element, onAction?, destroy? }
 *
 * Wrapped in IIFE with SML lifecycle.
 */

const StageRenderers = (() => {
  'use strict';

  // ── TextRenderer ────────────────────────────────────────────

  class TextRenderer {
    render(stage, state) {
      var body = stage.body || '';
      var interpolated = ModuleEngine.interpolate(body, state.custom);
      var el = document.createElement('div');
      el.className = 'elu-stage-text';

      var header = '';
      if (stage.title) {
        header += '<h3 class="elu-stage-heading">' + ModuleEngine.sanitize(stage.title) + '</h3>';
      }
      var mediaHtml = '';
      if (stage.media) {
        if (stage.media.type === 'image') {
          mediaHtml = '<img class="elu-stage-media" src="' + stage.media.src + '" alt="' + (stage.media.alt || '') + '" loading="lazy">';
        } else if (stage.media.type === 'video') {
          mediaHtml = '<video class="elu-stage-media" src="' + stage.media.src + '" controls muted playsinline></video>';
        }
      }

      el.innerHTML = header + mediaHtml + '<div class="elu-stage-body">' + interpolated + '</div>';
      return { element: el };
    }
  }

  // ── QuizRenderer ────────────────────────────────────────────

  class QuizRenderer {
    render(stage, state) {
      var el = document.createElement('div');
      el.className = 'elu-stage-quiz';

      if (stage.question) {
        el.innerHTML = '<p class="elu-stage-question">' + stage.question + '</p>';
      }

      var options = stage.options || [];
      var optionsEl = document.createElement('div');
      optionsEl.className = 'elu-stage-options';
      options.forEach((opt, i) => {
        var optEl = document.createElement('button');
        optEl.className = 'elu-stage-option';
        optEl.textContent = opt.text || opt;
        optEl.addEventListener('click', () => {
          if (opt.correct) optEl.classList.add('correct');
          else optEl.classList.add('incorrect');
          if (state.onAnswer) state.onAnswer(i, opt.correct);
        });
        optionsEl.appendChild(optEl);
      });
      el.appendChild(optionsEl);
      return { element: el, destroy() { el.remove(); } };
    }
  }

  // ── SliderRenderer ───────────────────────────────────────────

  class SliderRenderer {
    render(stage, state) {
      var el = document.createElement('div');
      el.className = 'elu-stage-slider';

      if (stage.label) {
        el.innerHTML = '<label class="elu-stage-label">' + stage.label + '</label>';
      }

      var slider = document.createElement('input');
      slider.type = 'range';
      slider.min = stage.min || 0;
      slider.max = stage.max || 100;
      slider.value = state.custom?.[stage.id] || stage.default || 50;
      slider.className = 'elu-stage-slider-input';

      var valueDisplay = document.createElement('span');
      valueDisplay.className = 'elu-stage-slider-value';
      valueDisplay.textContent = slider.value + (stage.unit || '');

      slider.addEventListener('input', () => {
        valueDisplay.textContent = slider.value + (stage.unit || '');
        if (state.onSliderChange) state.onSliderChange(stage.id, parseInt(slider.value));
      });

      var wrapper = document.createElement('div');
      wrapper.appendChild(slider);
      wrapper.appendChild(valueDisplay);
      el.appendChild(wrapper);
      return { element: el, destroy() { el.remove(); } };
    }
  }

  // ── BranchRenderer ───────────────────────────────────────────

  class BranchRenderer {
    render(stage, state) {
      var el = document.createElement('div');
      el.className = 'elu-stage-branch';

      if (stage.prompt) {
        el.innerHTML = '<p class="elu-stage-prompt">' + stage.prompt + '</p>';
      }

      var branches = stage.branches || [];
      var branchesEl = document.createElement('div');
      branchesEl.className = 'elu-stage-branches';
      branches.forEach((branch, i) => {
        var btn = document.createElement('button');
        btn.className = 'elu-stage-branch-btn';
        btn.textContent = branch.text || 'Option ' + (i + 1);
        btn.addEventListener('click', () => {
          if (state.onBranch) state.onBranch(i, branch);
        });
        branchesEl.appendChild(btn);
      });
      el.appendChild(branchesEl);
      return { element: el, destroy() { el.remove(); } };
    }
  }

  // ── GaugeRenderer ────────────────────────────────────────────

  class GaugeRenderer {
    render(stage, state) {
      var el = document.createElement('div');
      el.className = 'elu-stage-gauge';

      if (stage.title) {
        el.innerHTML = '<h4 class="elu-stage-gauge-title">' + stage.title + '</h4>';
      }

      var gaugeEl = document.createElement('div');
      gaugeEl.className = 'elu-stage-gauge-bar';
      var fill = document.createElement('div');
      fill.className = 'elu-stage-gauge-fill';
      var pct = Math.min(100, Math.max(0, state.custom?.[stage.id] || 0));
      fill.style.width = pct + '%';
      gaugeEl.appendChild(fill);
      el.appendChild(gaugeEl);

      if (stage.labels) {
        var labelsEl = document.createElement('div');
        labelsEl.className = 'elu-stage-gauge-labels';
        stage.labels.forEach(l => {
          var span = document.createElement('span');
          span.textContent = l;
          labelsEl.appendChild(span);
        });
        el.appendChild(labelsEl);
      }

      return { element: el };
    }
  }

  // ── CardStackRenderer ────────────────────────────────────────

  class CardStackRenderer {
    render(stage, state) {
      var el = document.createElement('div');
      el.className = 'elu-stage-cardstack';

      var cards = stage.cards || [];
      cards.forEach((card, i) => {
        var cardEl = document.createElement('div');
        cardEl.className = 'elu-stage-card';
        cardEl.innerHTML = (card.title ? '<h4>' + card.title + '</h4>' : '') + (card.body ? '<p>' + card.body + '</p>' : '');
        cardEl.addEventListener('click', () => {
          cardEl.classList.toggle('flipped');
          if (state.onCardFlip) state.onCardFlip(i);
        });
        el.appendChild(cardEl);
      });

      return { element: el, destroy() { el.remove(); } };
    }
  }

  // ── TimelineRenderer ─────────────────────────────────────────

  class TimelineRenderer {
    render(stage, state) {
      var el = document.createElement('div');
      el.className = 'elu-stage-timeline';

      if (stage.title) {
        el.innerHTML = '<h4 class="elu-stage-timeline-title">' + stage.title + '</h4>';
      }

      var items = stage.items || [];
      items.forEach(item => {
        var itemEl = document.createElement('div');
        itemEl.className = 'elu-stage-timeline-item';
        itemEl.innerHTML = '<span class="elu-stage-timeline-year">' + (item.year || '') + '</span>' + '<span class="elu-stage-timeline-text">' + (item.text || '') + '</span>';
        el.appendChild(itemEl);
      });

      return { element: el };
    }
  }

  // ── ComparisonRenderer ───────────────────────────────────────

  class ComparisonRenderer {
    render(stage, state) {
      var el = document.createElement('div');
      el.className = 'elu-stage-comparison';

      if (stage.title) {
        el.innerHTML = '<h4 class="elu-stage-comparison-title">' + stage.title + '</h4>';
      }

      var items = stage.items || [];
      items.forEach(item => {
        var itemEl = document.createElement('div');
        itemEl.className = 'elu-stage-comparison-item';
        var pct = Math.min(100, Math.max(0, item.pct || 0));
        itemEl.innerHTML = '<span class="elu-stage-comparison-label">' + (item.label || '') + '</span>' + '<div class="elu-stage-comparison-bar"><div class="elu-stage-comparison-fill" style="width:' + pct + '%"></div></div>';
        el.appendChild(itemEl);
      });

      return { element: el };
    }
  }

  // ── CalculatorRenderer ───────────────────────────────────────

  class CalculatorRenderer {
    render(stage, state) {
      var el = document.createElement('div');
      el.className = 'elu-stage-calculator';

      if (stage.title) {
        el.innerHTML = '<h4 class="elu-stage-calculator-title">' + stage.title + '</h4>';
      }

      var inputs = stage.inputs || [];
      inputs.forEach(input => {
        var inputEl = document.createElement('div');
        inputEl.className = 'elu-stage-calculator-input';
        inputEl.innerHTML = '<label>' + (input.label || '') + '</label><input type="number" value="' + (state.custom?.[input.id] || input.default || 0) + '" min="' + (input.min || 0) + '" max="' + (input.max || 999999) + '">';
        var inputField = inputEl.querySelector('input');
        inputField.addEventListener('input', () => {
          if (state.onCalcInput) state.onCalcInput(input.id, parseInt(inputField.value) || 0);
        });
        el.appendChild(inputEl);
      });

      if (stage.output) {
        var outputEl = document.createElement('div');
        outputEl.className = 'elu-stage-calculator-output';
        outputEl.innerHTML = '<span class="elu-stage-calculator-result">' + stage.output.formula + '</span>';
        el.appendChild(outputEl);
      }

      return { element: el, destroy() { el.remove(); } };
    }
  }

  // ── GlobeRenderer ────────────────────────────────────────────

  class GlobeRenderer {
    render(stage, state) {
      var el = document.createElement('div');
      el.className = 'elu-stage-globe';
      el.innerHTML = '<div class="elu-stage-globe-loading">Loading globe...</div>';
      return { element: el };
    }
  }

  // ── Renderer Registry ──

  const _registry = {
    text:       new TextRenderer(),
    quiz:       new QuizRenderer(),
    slider:     new SliderRenderer(),
    branch:     new BranchRenderer(),
    gauge:      new GaugeRenderer(),
    cardstack:  new CardStackRenderer(),
    timeline:   new TimelineRenderer(),
    comparison: new ComparisonRenderer(),
    calculator: new CalculatorRenderer(),
    globe:      new GlobeRenderer(),
  };

  // ── SML Lifecycle ──

  function init() {
    console.debug('[StageRenderers] init');
    // Register all renderers in the engine
    if (typeof ModuleEngine !== 'undefined' && ModuleEngine.renderers) {
      Object.assign(ModuleEngine.renderers, _registry);
    }
    console.log('[StageRenderers] All renderers registered: ' + Object.keys(_registry).join(', '));
    return true;
  }

  function reset() {
    console.debug('[StageRenderers] reset');
    // Re-instantiate all renderers
    _registry.text       = new TextRenderer();
    _registry.quiz       = new QuizRenderer();
    _registry.slider     = new SliderRenderer();
    _registry.branch     = new BranchRenderer();
    _registry.gauge      = new GaugeRenderer();
    _registry.cardstack  = new CardStackRenderer();
    _registry.timeline   = new TimelineRenderer();
    _registry.comparison = new ComparisonRenderer();
    _registry.calculator = new CalculatorRenderer();
    _registry.globe      = new GlobeRenderer();
    return true;
  }

  function destroy() {
    console.debug('[StageRenderers] destroy');
    for (const key of Object.keys(_registry)) {
      if (_registry[key]?.destroy) _registry[key].destroy();
      delete _registry[key];
    }
    return true;
  }

  function getState() {
    return {
      rendererCount: Object.keys(_registry).length,
      renderers: Object.keys(_registry),
    };
  }

  // ── Public API ──
  return {
    init,
    reset,
    destroy,
    getState,
    getRenderers() { return { ..._registry }; },
    getRenderer(type) { return _registry[type] || null; },
    registerRenderer(type, renderer) { _registry[type] = renderer; },
  };
})();
window.StageRenderers = StageRenderers;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('StageRenderers', {
    provides: ['init', 'reset', 'destroy', 'getState', 'getRenderers', 'getRenderer', 'registerRenderer'],
    requires: [],
    emits: [],
    listens: [],
  });
}
