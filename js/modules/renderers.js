/**
 * Stage Renderers — One renderer per stage type
 * Each renderer has: render(config, state) => { element, onAction?, destroy? }
 */

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
      if (/\.(gif|png|jpg|jpeg|webp|svg)$/i.test(stage.media)) {
        mediaHtml = '<div class="elu-stage-media"><img src="' + stage.media + '" alt="' + (stage.title || 'illustration') + '" loading="lazy"></div>';
      } else if (/\.(mp4|webm)$/i.test(stage.media)) {
        mediaHtml = '<div class="elu-stage-media"><video src="' + stage.media + '" autoplay muted loop playsinline></video></div>';
      }
    }

    var calloutsHtml = '';
    if (stage.callouts && stage.callouts.length) {
      calloutsHtml = '<div class="elu-callouts">';
      stage.callouts.forEach(function(c) {
        calloutsHtml += '<div class="elu-callout"><strong>' + ModuleEngine.sanitize(c.label) + '</strong>: ' + ModuleEngine.interpolate(c.value, state.custom) + '</div>';
      });
      calloutsHtml += '</div>';
    }

    el.innerHTML = header + mediaHtml + '<div class="elu-stage-content">' + interpolated + '</div>' + calloutsHtml;

    return { element: el };
  }
}

// ── QuizRenderer ─────────────────────────────────────────────

class QuizRenderer {
  render(stage, state) {
    var el = document.createElement('div');
    el.className = 'elu-stage-quiz';

    var header = '';
    if (stage.title) {
      header = '<h3 class="elu-stage-heading">' + ModuleEngine.sanitize(stage.title) + '</h3>';
    }

    var questionsHtml = '';
    stage.questions.forEach(function(q, qi) {
      questionsHtml += '<div class="elu-question" data-qi="' + qi + '">';
      questionsHtml += '<p class="elu-question-text">' + ModuleEngine.sanitize(q.question) + '</p>';

      if (q.options && q.options.length) {
        q.options.forEach(function(opt, oi) {
          questionsHtml += '<button class="elu-quiz-option" data-qi="' + qi + '" data-oi="' + oi + '">' +
            '<span class="elu-option-letter">' + String.fromCharCode(65 + oi) + '</span>' +
            '<span>' + ModuleEngine.sanitize(opt) + '</span>' +
            '</button>';
        });
      } else if (q.inputType === 'number' || q.inputType === 'text') {
        questionsHtml += '<input type="' + (q.inputType || 'text') + '" class="elu-quiz-input" data-qi="' + qi + '" placeholder="Your answer...">';
      }

      questionsHtml += '<div class="elu-question-feedback" data-feedback-qi="' + qi + '"></div>';
      questionsHtml += '</div>';
    });

    el.innerHTML = header + questionsHtml + '<button class="elu-btn elu-btn-primary elu-quiz-submit">Check Answers</button>';

    // Wire events
    var submitBtn = el.querySelector('.elu-quiz-submit');
    submitBtn.onclick = function() {
      var correct = 0;
      var total = stage.questions.length;

      stage.questions.forEach(function(q, qi) {
        var fb = el.querySelector('[data-feedback-qi="' + qi + '"]');
        if (q.options && q.options.length) {
          var selected = el.querySelector('.elu-quiz-option[data-qi="' + qi + '"].elu-selected');
          if (!selected) {
            fb.textContent = 'Select an answer';
            fb.className = 'elu-question-feedback elu-feedback-warn';
            return;
          }
          var oi = parseInt(selected.dataset.oi);
          if (oi === q.correct) {
            fb.textContent = String.fromCharCode(10003) + ' ' + (q.explanation || 'Correct!');
            fb.className = 'elu-question-feedback elu-feedback-correct';
            correct++;
          } else {
            fb.textContent = String.fromCharCode(10007) + ' ' + (q.explanation || 'Wrong. Correct: ' + String.fromCharCode(65 + q.correct));
            fb.className = 'elu-question-feedback elu-feedback-wrong';
          }
          el.querySelectorAll('.elu-quiz-option[data-qi="' + qi + '"]').forEach(function(opt) {
            opt.disabled = true;
            if (parseInt(opt.dataset.oi) === q.correct) opt.classList.add('elu-correct-answer');
          });
        } else if (q.inputType) {
          var input = el.querySelector('.elu-quiz-input[data-qi="' + qi + '"]');
          var userVal = (input && input.value ? input.value.trim().toLowerCase() : '');
          var expected = (q.correct != null ? q.correct.toString().toLowerCase() : '');
          if (userVal === expected) {
            fb.textContent = String.fromCharCode(10003) + ' Correct!';
            fb.className = 'elu-question-feedback elu-feedback-correct';
            correct++;
          } else {
            fb.textContent = String.fromCharCode(10007) + ' ' + (q.hint || 'Try again');
            fb.className = 'elu-question-feedback elu-feedback-wrong';
          }
        }
      });

      var pct = Math.round((correct / total) * 100);
      state.score += pct;
      state.answers.push({ quiz: stage.title || 'quiz', score: pct, total: total, timestamp: Date.now() });
      submitBtn.textContent = correct + '/' + total + ' correct (' + pct + '%)';
      submitBtn.className = 'elu-btn elu-btn-secondary';
    };

    // Option click handlers
    el.querySelectorAll('.elu-quiz-option').forEach(function(opt) {
      opt.onclick = function() {
        var qi = opt.dataset.qi;
        el.querySelectorAll('.elu-quiz-option[data-qi="' + qi + '"]').forEach(function(o) { o.classList.remove('elu-selected'); });
        opt.classList.add('elu-selected');
      };
    });

    return { element: el };
  }
}

// ── SliderRenderer ───────────────────────────────────────────

class SliderRenderer {
  render(stage, state) {
    var el = document.createElement('div');
    el.className = 'elu-stage-slider';

    if (stage.title) {
      el.innerHTML = '<h3 class="elu-stage-heading">' + ModuleEngine.sanitize(stage.title) + '</h3>';
    }
    if (stage.description) {
      el.innerHTML += '<p class="elu-stage-desc">' + ModuleEngine.sanitize(stage.description) + '</p>';
    }

    var sliders = stage.sliders || [];
    sliders.forEach(function(slider, si) {
      var wrapper = document.createElement('div');
      wrapper.className = 'elu-slider-group';
      wrapper.innerHTML =
        '<div class="elu-slider-header">' +
          '<label class="elu-slider-label">' + ModuleEngine.sanitize(slider.label) + '</label>' +
          '<span class="elu-slider-value" data-slider-val="' + si + '">' + (slider.default || slider.min) + '</span>' +
          '<span class="elu-slider-unit">' + (slider.unit || '') + '</span>' +
        '</div>' +
        '<input type="range" class="elu-slider" data-slider-idx="' + si + '" min="' + slider.min + '" max="' + slider.max + '" step="' + (slider.step || 1) + '" value="' + (slider.default || slider.min) + '">' +
        '<div class="elu-slider-ticks"><span>' + slider.min + (slider.unit || '') + '</span><span>' + slider.max + (slider.unit || '') + '</span></div>';
      el.appendChild(wrapper);
    });

    var resultEl = document.createElement('div');
    resultEl.className = 'elu-slider-result';

    if (stage.resultTemplate) {
      resultEl.innerHTML = ModuleEngine.interpolate(stage.resultTemplate, state.custom);
    }
    el.appendChild(resultEl);

    // Wire slider events
    var updateSliders = function() {
      el.querySelectorAll('.elu-slider').forEach(function(input) {
        var valEl = el.querySelector('[data-slider-val="' + input.dataset.sliderIdx + '"]');
        if (valEl) valEl.textContent = input.value;
        state.custom['slider_' + input.dataset.sliderIdx] = parseFloat(input.value);
      });
      if (stage.calculate) {
        var result = stage.calculate(state.custom);
        if (typeof result === 'object') {
          Object.assign(state.custom, result);
        } else {
          state.custom.result = result;
        }
        resultEl.innerHTML = ModuleEngine.interpolate(stage.resultTemplate, state.custom);
      }
    };

    el.querySelectorAll('.elu-slider').forEach(function(input) {
      input.addEventListener('input', updateSliders);
    });
    updateSliders(); // initial

    return { element: el, updateCustom: updateSliders };
  }
}

// ── BranchRenderer ───────────────────────────────────────────

class BranchRenderer {
  render(stage, state) {
    var el = document.createElement('div');
    el.className = 'elu-stage-branch';

    if (stage.title) {
      el.innerHTML = '<h3 class="elu-stage-heading">' + ModuleEngine.sanitize(stage.title) + '</h3>';
    }
    if (stage.description) {
      el.innerHTML += '<p class="elu-stage-desc">' + ModuleEngine.sanitize(stage.description) + '</p>';
    }

    var grid = document.createElement('div');
    grid.className = 'elu-branch-grid';

    (stage.paths || []).forEach(function(path, pi) {
      var card = document.createElement('div');
      card.className = 'elu-branch-card';
      card.dataset.pathIndex = pi;
      card.innerHTML =
        '<div class="elu-branch-card-icon">' + (path.icon || '&#x27A1;') + '</div>' +
        '<div class="elu-branch-card-label">' + ModuleEngine.sanitize(path.label) + '</div>' +
        '<div class="elu-branch-card-desc">' + ModuleEngine.sanitize(path.description || '') + '</div>' +
        (path.timescale ? '<div class="elu-branch-card-timescale">' + ModuleEngine.sanitize(path.timescale) + '</div>' : '');
      card.onclick = function() {
        state.custom.selectedPath = pi;
        state.custom.selectedPathData = path;
        grid.querySelectorAll('.elu-branch-card').forEach(function(c) { c.classList.remove('elu-branch-selected'); });
        card.classList.add('elu-branch-selected');
        if (typeof stage.onSelect === 'function') {
          var result = stage.onSelect(path, state.custom);
          if (result) Object.assign(state.custom, result);
        }
        // Enable next
        var nextBtn = el.closest('.elu-module') && el.closest('.elu-module').querySelector('.elu-btn-next');
        if (nextBtn) nextBtn.style.display = 'inline-flex';
      };
      grid.appendChild(card);
    });

    el.appendChild(grid);
    return { element: el };
  }
}

// ── GaugeRenderer ────────────────────────────────────────────

class GaugeRenderer {
  render(stage, state) {
    var el = document.createElement('div');
    el.className = 'elu-stage-gauge';

    if (stage.title) {
      el.innerHTML = '<h3 class="elu-stage-heading">' + ModuleEngine.sanitize(stage.title) + '</h3>';
    }

    var value = (typeof stage.getValue === 'function') ? stage.getValue(state.custom) : (state.custom.result || 0);
    var min = stage.min || 0;
    var max = stage.max || 100;
    var pct = Math.max(0, Math.min(100, ((value - min) / (max - min + 0.001)) * 100));
    var color = this._getColor(pct, stage.thresholds);

    el.innerHTML =
      '<div class="elu-gauge-container">' +
        '<div class="elu-gauge-ring">' +
          '<div class="elu-gauge-fill" style="width:' + pct + '%;background:' + color + ';"></div>' +
        '</div>' +
        '<div class="elu-gauge-value" style="color:' + color + '">' + value.toLocaleString() + (stage.unit || '') + '</div>' +
      '</div>' +
      (stage.label ? '<p class="elu-gauge-label">' + ModuleEngine.sanitize(stage.label) + '</p>' : '');

    return { element: el };
  }

  _getColor(pct, thresholds) {
    if (!thresholds || !thresholds.length) return '#4ecdc4';
    for (var i = 0; i < thresholds.length; i++) {
      if (pct <= thresholds[i][0]) return thresholds[i][1];
    }
    return thresholds[thresholds.length - 1][1];
  }
}

// ── CardStackRenderer ────────────────────────────────────────

class CardStackRenderer {
  render(stage, state) {
    var el = document.createElement('div');
    el.className = 'elu-stage-cards';

    if (stage.title) {
      el.innerHTML = '<h3 class="elu-stage-heading">' + ModuleEngine.sanitize(stage.title) + '</h3>';
    }

    // Filter bar
    if (stage.filters && stage.filters.length) {
      var filterBar = document.createElement('div');
      filterBar.className = 'elu-card-filters';
      stage.filters.forEach(function(f, fi) {
        var btn = document.createElement('button');
        btn.className = 'elu-filter-chip' + (fi === 0 ? ' active' : '');
        btn.textContent = f;
        btn.dataset.filter = f;
        btn.onclick = function() {
          filterBar.querySelectorAll('.elu-filter-chip').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          el.querySelectorAll('.elu-card-item').forEach(function(card) {
            card.style.display = (card.dataset.category === f || f === stage.filters[0]) ? '' : 'none';
          });
        };
        filterBar.appendChild(btn);
      });
      el.appendChild(filterBar);
    }

    var grid = document.createElement('div');
    grid.className = 'elu-card-grid';

    (stage.cards || []).forEach(function(card, ci) {
      var item = document.createElement('div');
      item.className = 'elu-card-item';
      item.dataset.category = card.category || '';
      item.dataset.index = ci;
      item.innerHTML =
        '<div class="elu-card-front">' +
          (card.icon ? '<div class="elu-card-icon">' + card.icon + '</div>' : '') +
          '<h4>' + ModuleEngine.sanitize(card.title) + '</h4>' +
          (card.subtitle ? '<p class="elu-card-subtitle">' + ModuleEngine.sanitize(card.subtitle) + '</p>' : '') +
          (card.badge ? '<span class="elu-card-badge">' + ModuleEngine.sanitize(card.badge) + '</span>' : '') +
        '</div>' +
        '<div class="elu-card-back">' +
          (card.detail || '') +
          (card.stats && card.stats.length ? '<div class="elu-card-stats">' + card.stats.map(function(s) { return '<span>' + s + '</span>'; }).join('') + '</div>' : '') +
        '</div>';
      item.onclick = function() { item.classList.toggle('flipped'); };
      grid.appendChild(item);
    });

    el.appendChild(grid);
    return { element: el };
  }
}

// ── TimelineRenderer ─────────────────────────────────────────

class TimelineRenderer {
  render(stage, state) {
    var el = document.createElement('div');
    el.className = 'elu-stage-timeline';

    if (stage.title) {
      el.innerHTML = '<h3 class="elu-stage-heading">' + ModuleEngine.sanitize(stage.title) + '</h3>';
    }

    var canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 200;
    canvas.className = 'elu-timeline-canvas';
    el.appendChild(canvas);

    var data = stage.data || [];
    var currentIdx = 0;

    // Scrubber
    var scrubberWrapper = document.createElement('div');
    scrubberWrapper.className = 'elu-timeline-scrubber';

    var range = document.createElement('input');
    range.type = 'range';
    range.min = 0;
    range.max = Math.max(0, data.length - 1);
    range.value = 0;
    range.className = 'elu-timeline-range';
    scrubberWrapper.appendChild(range);

    var label = document.createElement('span');
    label.className = 'elu-timeline-label';
    label.textContent = data[0] ? data[0].label : '';
    scrubberWrapper.appendChild(label);

    if (stage.showValue) {
      var valSpan = document.createElement('span');
      valSpan.className = 'elu-timeline-value';
      valSpan.textContent = data[0] ? (data[0].display || data[0].value) : '';
      scrubberWrapper.appendChild(valSpan);
    }

    el.appendChild(scrubberWrapper);

    // Draw function
    var ctx = canvas.getContext('2d');

    function draw(idx) {
      currentIdx = idx;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (data.length === 0) return;

      // Grid lines
      ctx.strokeStyle = 'rgba(78,205,196,0.1)';
      ctx.lineWidth = 1;
      for (var y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Compute bounds
      var minVal = Infinity, maxVal = -Infinity;
      data.forEach(function(d) {
        if (d.value < minVal) minVal = d.value;
        if (d.value > maxVal) maxVal = d.value;
      });
      if (maxVal === minVal) { maxVal = minVal + 1; }

      // Fill area
      ctx.beginPath();
      data.forEach(function(d, i) {
        var x = (i / (data.length - 1)) * canvas.width;
        var y = canvas.height - 30 - ((d.value - minVal) / (maxVal - minVal)) * (canvas.height - 60);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(canvas.width, canvas.height - 10);
      ctx.lineTo(0, canvas.height - 10);
      ctx.closePath();
      ctx.fillStyle = 'rgba(78,205,196,0.1)';
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.strokeStyle = '#4ecdc4';
      ctx.lineWidth = 2.5;
      data.forEach(function(d, i) {
        var x = (i / (data.length - 1)) * canvas.width;
        var y = canvas.height - 30 - ((d.value - minVal) / (maxVal - minVal)) * (canvas.height - 60);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Current point
      if (idx >= 0 && idx < data.length) {
        var px = (idx / (data.length - 1)) * canvas.width;
        var py = canvas.height - 30 - ((data[idx].value - minVal) / (maxVal - minVal)) * (canvas.height - 60);

        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#4ecdc4';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Vertical guide
        ctx.beginPath();
        ctx.moveTo(px, 0); ctx.lineTo(px, canvas.height);
        ctx.strokeStyle = 'rgba(78,205,196,0.3)';
        ctx.stroke();
      }

      // X-axis labels
      ctx.fillStyle = 'rgba(226,223,216,0.5)';
      ctx.font = '10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      var labelCount = Math.min(data.length, 10);
      for (var li = 0; li < labelCount; li++) {
        var lix = Math.round((li / (labelCount - 1)) * (data.length - 1));
        var lx = (lix / (data.length - 1)) * canvas.width;
        ctx.fillText(data[lix].label, lx, canvas.height - 3);
      }
    }

    draw(0);

    range.oninput = function() {
      var idx = parseInt(range.value);
      label.textContent = data[idx] ? data[idx].label : '';
      if (stage.showValue && el.querySelector('.elu-timeline-value')) {
        el.querySelector('.elu-timeline-value').textContent = data[idx] ? (data[idx].display || data[idx].value) : '';
      }
      draw(idx);
    };

    return {
      element: el,
      update: function(newData) {
        data = newData;
        range.max = Math.max(0, data.length - 1);
        range.value = 0;
        draw(0);
      }
    };
  }
}

// Register all renderers in the engine
ModuleEngine.renderers = {
  text:       new TextRenderer(),
  quiz:       new QuizRenderer(),
  slider:     new SliderRenderer(),
  branch:     new BranchRenderer(),
  gauge:      new GaugeRenderer(),
  cardstack:  new CardStackRenderer(),
  timeline:   new TimelineRenderer(),
  comparison: new ComparisonRenderer(),
  calculator: new CalculatorRenderer(),
  globe:      new GlobeRenderer()
};

console.log('[ModuleEngine] All renderers registered: ' + Object.keys(ModuleEngine.renderers).join(', '));