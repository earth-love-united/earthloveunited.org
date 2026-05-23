/* ═══════════════════════════════════════════════════════════════
   MODULE PLAYER ENGINE v1.0
   Standalone interactive learning experience
   Pattern: Brilliant.org micro-loop adapted for climate science
   ═══════════════════════════════════════════════════════════════ */

const ModulePlayer = (() => {
  'use strict';

  // ── STATE ──────────────────────────────────────────────────
  const state = {
    currentModule: null,
    currentStageIndex: 0,
    modules: {},
    progress: {},       // moduleId -> { stageIndex, completed, score, answers }
    totalXP: 0,
    startTime: null,
  };

  // ── DOM REFS ──────────────────────────────────────────────
  let appEl = null;
  let topbarEl = null;
  let progressEl = null;
  let contentEl = null;
  let navEl = null;
  let dotsEl = null;

  // ── UTILITIES ──────────────────────────────────────────────
  function $(sel, parent) { return (parent || document).querySelector(sel); }
  function $$(sel, parent) { return [...(parent || document).querySelectorAll(sel)]; }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function fmt(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return Number(n).toFixed(Number(n) % 1 === 0 ? 0 : 1);
  }

  function getModuleTheme(moduleId) {
    const themes = {
      '01-carbon-atom': { accent: '#7be8d0', icon: '⚛️' },
      '02-keeling-curve': { accent: '#42a5f5', icon: '📈' },
      '03-carbon-budget': { accent: '#f5876a', icon: '🧮' },
      '04-restoration-projects': { accent: '#66bb6a', icon: '🌱' },
      '05-carbon-market': { accent: '#ab47bc', icon: '💹' },
      '06-drawdown-solutions': { accent: '#ffa726', icon: '🔧' },
      '07-carbon-footprint': { accent: '#26c6da', icon: '👣' },
      '08-climate-justice': { accent: '#ef5350', icon: '⚖️' },
    };
    return themes[moduleId] || { accent: '#4ecdc4', icon: '🌍' };
  }

  // ── STORAGE ────────────────────────────────────────────────
  function loadProgress() {
    try {
      const raw = localStorage.getItem('mp_progress');
      if (raw) state.progress = JSON.parse(raw);
      const xp = localStorage.getItem('mp_total_xp');
      if (xp) state.totalXP = parseInt(xp, 10) || 0;
    } catch (e) { /* ignore */ }
  }

  function saveProgress() {
    try {
      localStorage.setItem('mp_progress', JSON.stringify(state.progress));
      localStorage.setItem('mp_total_xp', String(state.totalXP));
    } catch (e) { /* ignore */ }
  }

  function getModuleProgress(moduleId) {
    if (!state.progress[moduleId]) {
      state.progress[moduleId] = { stageIndex: 0, completed: false, score: 0, answers: {} };
    }
    return state.progress[moduleId];
  }

  // ── XP SYSTEM ──────────────────────────────────────────────
  function awardXP(amount, reason) {
    state.totalXP += amount;
    if (state.currentModule) {
      const p = getModuleProgress(state.currentModule.id);
      p.score += amount;
    }
    saveProgress();
    renderTopbar();
    // Show XP badge
    const badge = el('div', 'mp-xp', `<span class="mp-xp-icon">✦</span> +${amount} XP`);
    badge.style.cssText = 'position:fixed;top:60px;right:24px;z-index:200;animation:scaleIn .3s ease-out,fadeUp .3s ease-out';
    document.body.appendChild(badge);
    setTimeout(() => { badge.style.opacity = '0'; badge.style.transition = 'opacity .5s'; }, 1500);
    setTimeout(() => badge.remove(), 2000);
  }

  // ── APP SHELL ──────────────────────────────────────────────
  function buildShell() {
    appEl = el('div', 'mp-app');

    // Topbar
    topbarEl = el('div', 'mp-topbar');
    topbarEl.innerHTML = `
      <div class="mp-logo">
        <span class="mp-logo-icon">🌍</span>
        <span>Earth Love United</span>
      </div>
      <div class="mp-stats">
        <div class="mp-stat">
          <div class="mp-stat-label">Total XP</div>
          <div class="mp-stat-value teal" id="mp-xp-display">${state.totalXP}</div>
        </div>
        <div class="mp-stat">
          <div class="mp-stat-label">Module Score</div>
          <div class="mp-stat-value leaf" id="mp-score-display">0</div>
        </div>
      </div>
    `;

    // Progress bar
    progressEl = el('div', 'mp-progress-bar');
    progressEl.innerHTML = '<div class="mp-progress-fill" id="mp-progress-fill" style="width:0%"></div>';

    // Content
    contentEl = el('div', 'mp-content');

    // Navigation
    navEl = el('div', 'mp-nav');
    navEl.innerHTML = `
      <button class="mp-nav-btn" id="mp-nav-prev" disabled>
        <span class="mp-nav-arrow">←</span> Back
      </button>
      <div class="mp-stage-dots" id="mp-stage-dots"></div>
      <button class="mp-nav-btn" id="mp-nav-next">
        Next <span class="mp-nav-arrow">→</span>
      </button>
    `;

    appEl.appendChild(topbarEl);
    appEl.appendChild(progressEl);
    appEl.appendChild(contentEl);
    appEl.appendChild(navEl);
    document.body.appendChild(appEl);

    // Event listeners
    $('#mp-nav-prev').addEventListener('click', prevStage);
    $('#mp-nav-next').addEventListener('click', nextStage);
  }

  function renderTopbar() {
    const xpEl = $('#mp-xp-display');
    if (xpEl) xpEl.textContent = state.totalXP;
    const scoreEl = $('#mp-score-display');
    if (scoreEl && state.currentModule) {
      const p = getModuleProgress(state.currentModule.id);
      scoreEl.textContent = p.score;
    }
  }

  function updateProgress() {
    if (!state.currentModule) return;
    const total = state.currentModule.stages.length;
    const pct = ((state.currentStageIndex + 1) / total) * 100;
    const fill = $('#mp-progress-fill');
    if (fill) fill.style.width = pct + '%';

    // Update dots
    const dotsContainer = $('#mp-stage-dots');
    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = el('div', 'mp-stage-dot' + (i === state.currentStageIndex ? ' active' : '') + (i < state.currentStageIndex ? ' done' : ''));
        dot.addEventListener('click', () => goToStage(i));
        dotsContainer.appendChild(dot);
      }
    }

    // Update nav buttons
    const prevBtn = $('#mp-nav-prev');
    const nextBtn = $('#mp-nav-next');
    if (prevBtn) prevBtn.disabled = state.currentStageIndex === 0;
    if (nextBtn) {
      const isLast = state.currentStageIndex >= total - 1;
      nextBtn.innerHTML = isLast ? 'Finish <span class="mp-nav-arrow">✓</span>' : 'Next <span class="mp-nav-arrow">→</span>';
    }
  }

  // ── STAGE RENDERING ────────────────────────────────────────
  function renderStage(stage, index) {
    contentEl.innerHTML = '';
    const module = state.currentModule;
    const theme = getModuleTheme(module.id);

    // Stage header
    const header = el('div', 'mp-stage-header');
    const iconMap = { text: '📖', timeline: '📊', slider: '🎚️', gauge: '⏱️', quiz: '❓', cardstack: '🃏', branch: '🔀', comparison: '⚖️', discover: '💡' };
    header.innerHTML = `
      <div class="mp-stage-icon" style="background:${theme.accent}15;border-color:${theme.accent}25">${iconMap[stage.type] || '📖'}</div>
      <div class="mp-stage-info">
        <div class="mp-stage-label" style="color:${theme.accent}">Stage ${index + 1} of ${module.stages.length} · ${stage.type.toUpperCase()}</div>
        <div class="mp-stage-title">${stage.title || ''}</div>
      </div>
    `;
    contentEl.appendChild(header);

    // Render based on type
    const stageEl = el('div', 'mp-stage');
    switch (stage.type) {
      case 'text': renderTextStage(stage, stageEl, theme); break;
      case 'timeline': renderTimelineStage(stage, stageEl, theme); break;
      case 'slider': renderSliderStage(stage, stageEl, theme); break;
      case 'gauge': renderGaugeStage(stage, stageEl, theme); break;
      case 'quiz': renderQuizStage(stage, stageEl, theme); break;
      case 'cardstack': renderCardstackStage(stage, stageEl, theme); break;
      case 'branch': renderBranchStage(stage, stageEl, theme); break;
      case 'comparison': renderComparisonStage(stage, stageEl, theme); break;
      case 'discover': renderDiscoverStage(stage, stageEl, theme); break;
      default: stageEl.innerHTML = `<div class="mp-body">${stage.body || ''}</div>`;
    }
    contentEl.appendChild(stageEl);
    updateProgress();
  }

  // ── TEXT STAGE ─────────────────────────────────────────────
  function renderTextStage(stage, container, theme) {
    if (stage.body) {
      const body = el('div', 'mp-body');
      body.innerHTML = stage.body;
      container.appendChild(body);
    }
    if (stage.callouts && stage.callouts.length) {
      const callouts = el('div', 'mp-callouts');
      stage.callouts.forEach(c => {
        const co = el('div', 'mp-callout');
        co.innerHTML = `<div class="mp-callout-label">${c.label}</div><div class="mp-callout-value">${c.value}</div>`;
        callouts.appendChild(co);
      });
      container.appendChild(callouts);
    }
    if (stage.gaia) {
      const gaia = el('div', 'mp-gaia');
      gaia.innerHTML = `<div class="mp-gaia-avatar">🌍</div><div class="mp-gaia-text">${stage.gaia}</div>`;
      container.appendChild(gaia);
    }
    if (stage.actions && stage.actions.length) {
      const actions = el('div', 'mp-actions');
      stage.actions.forEach(a => {
        const btn = el('button', 'mp-btn ' + (a.style === 'primary' ? 'primary' : 'secondary'));
        btn.innerHTML = `${a.label}`;
        btn.addEventListener('click', () => {
          if (a.type === 'next' || !a.type) nextStage();
          else if (a.type === 'complete') completeModule();
        });
        actions.appendChild(btn);
      });
      container.appendChild(actions);
    }
  }

  // ── TIMELINE STAGE ─────────────────────────────────────────
  function renderTimelineStage(stage, container, theme) {
    const data = stage.data || [];
    if (!data.length) return;

    const wrap = el('div', 'mp-timeline');
    let currentIdx = 0;

    const yearDisplay = el('div', 'mp-timeline-year');
    yearDisplay.textContent = data[0].label;

    const valueDisplay = el('div', 'mp-timeline-value');
    valueDisplay.textContent = data[0].display || data[0].value;

    const contextDisplay = el('div', 'mp-timeline-context');
    contextDisplay.textContent = data[0].context || '';

    const barWrap = el('div', 'mp-timeline-bar-wrap');
    const bar = el('div', 'mp-timeline-bar');
    barWrap.appendChild(bar);

    const slider = el('input', 'mp-timeline-slider');
    slider.type = 'range';
    slider.min = 0;
    slider.max = data.length - 1;
    slider.value = 0;

    const labels = el('div', 'mp-timeline-labels');
    // Show first, middle, last labels
    const firstLabel = el('span'); firstLabel.textContent = data[0].label;
    const midLabel = el('span'); midLabel.textContent = data[Math.floor(data.length / 2)].label;
    const lastLabel = el('span'); lastLabel.textContent = data[data.length - 1].label;
    labels.appendChild(firstLabel);
    labels.appendChild(midLabel);
    labels.appendChild(lastLabel);

    function updateDisplay(idx) {
      const d = data[idx];
      yearDisplay.textContent = d.label;
      valueDisplay.textContent = d.display || String(d.value);
      contextDisplay.textContent = d.context || '';
      // Color the bar based on value relative to range
      const minVal = Math.min(...data.map(x => x.value));
      const maxVal = Math.max(...data.map(x => x.value));
      const pct = maxVal === minVal ? 50 : ((d.value - minVal) / (maxVal - minVal)) * 100;
      bar.style.width = pct + '%';
      // Color: green for low (good), red for high (bad) for most climate metrics
      if (d.value > (maxVal + minVal) / 2) {
        bar.style.background = 'linear-gradient(90deg, var(--warn), var(--red))';
        valueDisplay.style.color = 'var(--warn)';
      } else {
        bar.style.background = 'linear-gradient(90deg, var(--leaf), var(--teal))';
        valueDisplay.style.color = 'var(--teal)';
      }
    }

    slider.addEventListener('input', (e) => {
      currentIdx = parseInt(e.target.value, 10);
      updateDisplay(currentIdx);
    });

    updateDisplay(0);

    const displayWrap = el('div', 'mp-timeline-display');
    displayWrap.appendChild(yearDisplay);
    displayWrap.appendChild(valueDisplay);
    displayWrap.appendChild(contextDisplay);
    displayWrap.appendChild(barWrap);

    wrap.appendChild(displayWrap);
    wrap.appendChild(slider);
    wrap.appendChild(labels);

    if (stage.description) {
      const desc = el('div', 'mp-body');
      desc.style.marginTop = '16px';
      desc.innerHTML = stage.description;
      wrap.appendChild(desc);
    }

    if (stage.gaia) {
      const gaia = el('div', 'mp-gaia');
      gaia.style.marginTop = '12px';
      gaia.innerHTML = `<div class="mp-gaia-avatar">🌍</div><div class="mp-gaia-text">${stage.gaia}</div>`;
      wrap.appendChild(gaia);
    }

    if (stage.actions) {
      const actions = el('div', 'mp-actions');
      stage.actions.forEach(a => {
        const btn = el('button', 'mp-btn primary');
        btn.textContent = a.label;
        btn.addEventListener('click', () => nextStage());
        actions.appendChild(btn);
      });
      wrap.appendChild(actions);
    }

    container.appendChild(wrap);
  }

  // ── SLIDER STAGE ───────────────────────────────────────────
  function renderSliderStage(stage, container, theme) {
    const sliders = stage.sliders || [];
    if (!sliders.length) return;

    const group = el('div', 'mp-slider-group');
    const values = {};

    sliders.forEach((s, i) => {
      const item = el('div', 'mp-slider-item');
      values[s.label] = s.default || s.min;

      const header = el('div', 'mp-slider-header');
      header.innerHTML = `<span class="mp-slider-label">${s.label}</span><span class="mp-slider-value" id="mp-slv-${i}">${s.default || s.min} ${s.unit || ''}</span>`;
      item.appendChild(header);

      const input = el('input', 'mp-slider');
      input.type = 'range';
      input.min = s.min;
      input.max = s.max;
      input.step = s.step || 1;
      input.value = s.default || s.min;

      const labels = el('div', 'mp-slider-labels');
      labels.innerHTML = `<span>${s.min} ${s.unit || ''}</span><span>${s.max} ${s.unit || ''}</span>`;

      input.addEventListener('input', (e) => {
        values[s.label] = parseFloat(e.target.value);
        const disp = $(`#mp-slv-${i}`);
        if (disp) disp.textContent = `${values[s.label]} ${s.unit || ''}`;
        updateResult();
      });

      item.appendChild(input);
      item.appendChild(labels);
      group.appendChild(item);
    });

    // Result display
    const resultEl = el('div', 'mp-result', '');
    resultEl.id = 'mp-slider-result';
    group.appendChild(resultEl);

    function updateResult() {
      // Simple sum-based calculation (can be customized per module)
      const vals = sliders.map(s => values[s.label] || 0);
      const total = vals.reduce((a, b) => a + b, 0);
      const maxTotal = sliders.reduce((a, s) => a + s.max, 0);
      const pct = (total / maxTotal) * 100;

      let color = 'var(--teal)';
      let context = '';
      if (stage.resultTemplate) {
        context = stage.resultTemplate.replace(/\{\{result\}\}/g, fmt(total));
      }

      // Color coding
      if (pct > 75) { color = 'var(--warn)'; }
      else if (pct > 50) { color = 'var(--amber)'; }
      else { color = 'var(--leaf)'; }

      resultEl.innerHTML = `
        <div class="mp-result-number" style="color:${color}">${fmt(total)}</div>
        <div class="mp-result-unit">${sliders[0]?.unit || ''}</div>
        <div class="mp-result-label">${context || 'Total'}</div>
      `;
    }

    updateResult();

    if (stage.description) {
      const desc = el('div', 'mp-body');
      desc.style.marginTop = '8px';
      desc.innerHTML = stage.description;
      group.appendChild(desc);
    }

    if (stage.gaia) {
      const gaia = el('div', 'mp-gaia');
      gaia.innerHTML = `<div class="mp-gaia-avatar">🌍</div><div class="mp-gaia-text">${stage.gaia}</div>`;
      group.appendChild(gaia);
    }

    if (stage.actions) {
      const actions = el('div', 'mp-actions');
      stage.actions.forEach(a => {
        const btn = el('button', 'mp-btn primary');
        btn.textContent = a.label;
        btn.addEventListener('click', () => nextStage());
        actions.appendChild(btn);
      });
      group.appendChild(actions);
    }

    container.appendChild(group);
  }

  // ── GAUGE STAGE ────────────────────────────────────────────
  function renderGaugeStage(stage, container, theme) {
    const wrap = el('div', 'mp-gauge');
    const canvas = el('canvas', 'mp-gauge-canvas');
    canvas.width = 200;
    canvas.height = 120;
    wrap.appendChild(canvas);

    const valueEl = el('div', 'mp-gauge-value');
    valueEl.innerHTML = `-- <span class="mp-gauge-unit">${stage.unit || ''}</span>`;
    wrap.appendChild(valueEl);

    const labelEl = el('div', 'mp-gauge-label');
    labelEl.textContent = stage.title;
    wrap.appendChild(labelEl);

    if (stage.gaugeContext) {
      const ctx = el('div', 'mp-gauge-context');
      ctx.innerHTML = stage.gaugeContext;
      wrap.appendChild(ctx);
    }

    container.appendChild(wrap);

    // Animate gauge
    const targetValue = stage.value || 0;
    const min = stage.min || 0;
    const max = stage.max || 100;
    const thresholds = stage.thresholds || [[25, '#5bbf72'], [50, '#ffa726'], [75, '#c45c4a'], [100, '#e53935']];

    function getColor(pct) {
      for (const [t, c] of thresholds) {
        if (pct <= t) return c;
      }
      return thresholds[thresholds.length - 1][1];
    }

    function drawGauge(value) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      const cx = w / 2, cy = h - 10;
      const r = 70;
      const startAngle = Math.PI;
      const endAngle = 2 * Math.PI;
      const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
      const valueAngle = startAngle + pct * (endAngle - startAngle);

      ctx.clearRect(0, 0, w, h);

      // Background arc
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Value arc
      if (pct > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, startAngle, valueAngle);
        ctx.strokeStyle = getColor(pct * 100);
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Needle
      const needleLen = r - 18;
      const nx = cx + needleLen * Math.cos(valueAngle);
      const ny = cy + needleLen * Math.sin(valueAngle);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = 'var(--text)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'var(--teal)';
      ctx.fill();
    }

    // Animate
    let current = min;
    const step = (targetValue - min) / 40;
    function animate() {
      if (current < targetValue) {
        current += step;
        if (current > targetValue) current = targetValue;
        drawGauge(current);
        valueEl.innerHTML = `${fmt(current)} <span class="mp-gauge-unit">${stage.unit || ''}</span>`;
        requestAnimationFrame(animate);
      }
    }
    setTimeout(animate, 300);

    if (stage.actions) {
      const actions = el('div', 'mp-actions');
      stage.actions.forEach(a => {
        const btn = el('button', 'mp-btn primary');
        btn.textContent = a.label;
        btn.addEventListener('click', () => nextStage());
        actions.appendChild(btn);
      });
      container.appendChild(actions);
    }
  }

  // ── QUIZ STAGE ─────────────────────────────────────────────
  function renderQuizStage(stage, container, theme) {
    const questions = stage.questions || [];
    if (!questions.length) return;

    let currentQ = 0;
    let answered = false;
    let correctCount = 0;

    const quizWrap = el('div', 'mp-quiz');

    const questionEl = el('div', 'mp-quiz-question');
    const optionsEl = el('div', 'mp-quiz-options');
    const feedbackEl = el('div', 'mp-quiz-feedback');

    function showQuestion(idx) {
      answered = false;
      const q = questions[idx];
      questionEl.textContent = q.question;
      optionsEl.innerHTML = '';
      feedbackEl.className = 'mp-quiz-feedback';
      feedbackEl.innerHTML = '';

      if (q.inputType === 'number') {
        // Numeric input
        const inputWrap = el('div', 'mp-numeric-input');
        const input = el('input');
        input.type = 'number';
        input.placeholder = q.hint || 'Enter your answer...';
        const unit = el('span', 'mp-input-unit');
        unit.textContent = q.unit || '';
        const submit = el('button', 'mp-btn primary mp-input-submit');
        submit.textContent = 'Check';

        submit.addEventListener('click', () => {
          if (answered) { nextQuestion(); return; }
          answered = true;
          const val = parseFloat(input.value);
          const correct = parseFloat(q.correct);
          const isCorrect = Math.abs(val - correct) <= (q.tolerance || 0.05 * correct);

          if (isCorrect) {
            correctCount++;
            feedbackEl.className = 'mp-quiz-feedback show correct';
            feedbackEl.innerHTML = `<div class="mp-feedback-title">✓ Correct!</div>${q.explanation || ''}`;
            awardXP(15, 'Correct answer');
          } else {
            feedbackEl.className = 'mp-quiz-feedback show wrong';
            feedbackEl.innerHTML = `<div class="mp-feedback-title">✗ Not quite</div>The answer is <strong>${correct}</strong>. ${q.explanation || ''}`;
          }
          submit.textContent = idx < questions.length - 1 ? 'Next →' : 'Continue →';
        });

        inputWrap.appendChild(input);
        inputWrap.appendChild(unit);
        inputWrap.appendChild(submit);
        optionsEl.appendChild(inputWrap);
      } else {
        // Multiple choice
        q.options.forEach((opt, i) => {
          const optEl = el('button', 'mp-quiz-option');
          const letter = String.fromCharCode(65 + i);
          optEl.innerHTML = `<span class="mp-option-letter">${letter}</span><span>${opt}</span>`;
          optEl.addEventListener('click', () => {
            if (answered) return;
            answered = true;
            const isCorrect = i === q.correct;

            if (isCorrect) {
              optEl.classList.add('correct');
              correctCount++;
              feedbackEl.className = 'mp-quiz-feedback show correct';
              feedbackEl.innerHTML = `<div class="mp-feedback-title">✓ Correct!</div>${q.explanation || ''}`;
              awardXP(15, 'Correct answer');
            } else {
              optEl.classList.add('wrong');
              // Highlight correct
              const opts = $$('.mp-quiz-option', optionsEl);
              if (opts[q.correct]) opts[q.correct].classList.add('correct');
              feedbackEl.className = 'mp-quiz-feedback show wrong';
              feedbackEl.innerHTML = `<div class="mp-feedback-title">✗ Not quite</div>${q.explanation || ''}`;
            }

            $$('.mp-quiz-option', optionsEl).forEach(o => o.classList.add('disabled'));
          });
          optionsEl.appendChild(optEl);
        });
      }
    }

    function nextQuestion() {
      currentQ++;
      if (currentQ < questions.length) {
        showQuestion(currentQ);
      } else {
        // Quiz complete
        quizWrap.innerHTML = '';
        const result = el('div', 'mp-result');
        const allCorrect = correctCount === questions.length;
        result.innerHTML = `
          <div class="mp-result-number" style="color:${allCorrect ? 'var(--leaf)' : 'var(--amber)'}">${correctCount}/${questions.length}</div>
          <div class="mp-result-label">${allCorrect ? 'Perfect score!' : 'Good effort!'}</div>
          <div class="mp-result-context">${stage.completionText || `You answered ${correctCount} out of ${questions.length} correctly.`}</div>
        `;
        quizWrap.appendChild(result);
        awardXP(correctCount * 10, 'Quiz complete');

        const actions = el('div', 'mp-actions');
        const btn = el('button', 'mp-btn primary');
        btn.textContent = 'Continue →';
        btn.addEventListener('click', () => nextStage());
        actions.appendChild(btn);
        quizWrap.appendChild(actions);
      }
    }

    showQuestion(0);
    quizWrap.appendChild(questionEl);
    quizWrap.appendChild(optionsEl);
    quizWrap.appendChild(feedbackEl);

    // Continue button for multiple choice
    const mcContinue = el('button', 'mp-btn primary');
    mcContinue.id = 'mp-mc-continue';
    mcContinue.textContent = 'Continue →';
    mcContinue.style.display = 'none';
    mcContinue.addEventListener('click', nextQuestion);
    quizWrap.appendChild(mcContinue);

    // Hook into option clicks to show continue
    const origShowQuestion = showQuestion;
    showQuestion = function(idx) {
      origShowQuestion(idx);
      const btn = $('#mp-mc-continue');
      if (btn) btn.style.display = 'none';
    };

    // Override the mc option click to show continue
    const observer = new MutationObserver(() => {
      const feedback = $('.mp-quiz-feedback.show', quizWrap);
      if (feedback) {
        const btn = $('#mp-mc-continue');
        if (btn) btn.style.display = 'inline-flex';
      }
    });
    observer.observe(quizWrap, { childList: true, subtree: true });

    container.appendChild(quizWrap);
  }

  // ── CARDSTACK STAGE ────────────────────────────────────────
  function renderCardstackStage(stage, container, theme) {
    const cards = stage.cards || [];
    if (!cards.length) return;

    const wrap = el('div', 'mp-cardstack');

    // Filters
    if (stage.filters && stage.filters.length) {
      const filters = el('div', 'mp-cardstack-filters');
      stage.filters.forEach((f, i) => {
        const btn = el('button', 'mp-filter-btn' + (i === 0 ? ' active' : ''));
        btn.textContent = f;
        btn.addEventListener('click', () => {
          $$('.mp-filter-btn', filters).forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          filterCards(f);
        });
        filters.appendChild(btn);
      });
      wrap.appendChild(filters);
    }

    const grid = el('div', 'mp-cardstack-grid');
    grid.id = 'mp-cardstack-grid';

    function filterCards(category) {
      const allCards = $$('.mp-card', grid);
      allCards.forEach((card, i) => {
        const c = cards[i];
        if (category === 'All' || c.category === category) {
          card.style.display = '';
          card.style.animation = `fadeUp .3s ease-out ${i * 0.05}s both`;
        } else {
          card.style.display = 'none';
        }
      });
    }

    cards.forEach((c, i) => {
      const card = el('div', 'mp-card');
      card.style.animation = `fadeUp .4s ease-out ${i * 0.08}s both`;
      card.innerHTML = `
        <div class="mp-card-icon">${c.icon || '🌍'}</div>
        <div class="mp-card-badge">${c.badge || ''}</div>
        <div class="mp-card-title">${c.title}</div>
        <div class="mp-card-subtitle">${c.subtitle || ''}</div>
        <div class="mp-card-stats">${(c.stats || []).map(s => `<div class="mp-card-stat">${s}</div>`).join('')}</div>
        <div class="mp-card-detail">${c.detail || ''}</div>
      `;
      card.addEventListener('click', () => {
        card.classList.toggle('expanded');
      });
      grid.appendChild(card);
    });

    wrap.appendChild(grid);

    if (stage.description) {
      const desc = el('div', 'mp-body');
      desc.style.marginTop = '16px';
      desc.innerHTML = stage.description;
      wrap.appendChild(desc);
    }

    if (stage.gaia) {
      const gaia = el('div', 'mp-gaia');
      gaia.innerHTML = `<div class="mp-gaia-avatar">🌍</div><div class="mp-gaia-text">${stage.gaia}</div>`;
      wrap.appendChild(gaia);
    }

    if (stage.actions) {
      const actions = el('div', 'mp-actions');
      stage.actions.forEach(a => {
        const btn = el('button', 'mp-btn primary');
        btn.textContent = a.label;
        btn.addEventListener('click', () => nextStage());
        actions.appendChild(btn);
      });
      wrap.appendChild(actions);
    }

    container.appendChild(wrap);
  }

  // ── BRANCH STAGE ───────────────────────────────────────────
  function renderBranchStage(stage, container, theme) {
    const paths = stage.paths || [];
    if (!paths.length) return;

    const wrap = el('div', 'mp-branch');

    if (stage.description) {
      const desc = el('div', 'mp-body');
      desc.innerHTML = stage.description;
      wrap.appendChild(desc);
    }

    paths.forEach((p, i) => {
      const opt = el('button', 'mp-branch-option');
      opt.style.animation = `slideIn .4s ease-out ${i * 0.1}s both`;
      opt.innerHTML = `
        <div class="mp-branch-icon">${p.icon || '→'}</div>
        <div class="mp-branch-info">
          <div class="mp-branch-label">${p.label}</div>
          <div class="mp-branch-desc">${p.description || ''}</div>
        </div>
        <div class="mp-branch-arrow">→</div>
      `;
      opt.addEventListener('click', () => {
        // Record choice
        if (state.currentModule) {
          const prog = getModuleProgress(state.currentModule.id);
          prog.answers['branch_' + state.currentStageIndex] = i;
        }
        awardXP(10, 'Made a choice');
        // Show brief consequence then advance
        wrap.innerHTML = '';
        const result = el('div', 'mp-result');
        result.innerHTML = `
          <div class="mp-result-label">${p.label}</div>
          <div class="mp-result-context">${p.consequence || p.description || 'You made your choice. Let\'s see what this means.'}</div>
        `;
        wrap.appendChild(result);
        const actions = el('div', 'mp-actions');
        const btn = el('button', 'mp-btn primary');
        btn.textContent = 'Continue →';
        btn.addEventListener('click', () => nextStage());
        actions.appendChild(btn);
        wrap.appendChild(actions);
      });
      wrap.appendChild(opt);
    });

    container.appendChild(wrap);
  }

  // ── COMPARISON STAGE ───────────────────────────────────────
  function renderComparisonStage(stage, container, theme) {
    const data = stage.comparisonData || [];
    if (!data.length) return;

    const table = el('table', 'mp-comparison');
    const thead = el('thead');
    thead.innerHTML = `<tr><th>Category</th><th>${stage.col1Header || 'Option A'}</th><th>${stage.col2Header || 'Option B'}</th></tr>`;
    table.appendChild(thead);

    const tbody = el('tbody');
    data.forEach(row => {
      const tr = el('tr');
      tr.innerHTML = `
        <td class="mp-comp-category">${row.category}</td>
        <td>${row.compliance || row.col1 || ''}</td>
        <td>${row.voluntary || row.col2 || ''}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    const wrap = el('div');
    wrap.style.overflowX = 'auto';
    wrap.appendChild(table);
    container.appendChild(wrap);

    if (stage.gaia) {
      const gaia = el('div', 'mp-gaia');
      gaia.style.marginTop = '12px';
      gaia.innerHTML = `<div class="mp-gaia-avatar">🌍</div><div class="mp-gaia-text">${stage.gaia}</div>`;
      container.appendChild(gaia);
    }

    if (stage.actions) {
      const actions = el('div', 'mp-actions');
      stage.actions.forEach(a => {
        const btn = el('button', 'mp-btn primary');
        btn.textContent = a.label;
        btn.addEventListener('click', () => nextStage());
        actions.appendChild(btn);
      });
      container.appendChild(actions);
    }
  }

  // ── DISCOVER STAGE ─────────────────────────────────────────
  function renderDiscoverStage(stage, container, theme) {
    // Like text stage but with a "reveal" interaction
    const wrap = el('div');

    if (stage.body) {
      const body = el('div', 'mp-body');
      body.innerHTML = stage.body;
      wrap.appendChild(body);
    }

    if (stage.callouts && stage.callouts.length) {
      const callouts = el('div', 'mp-callouts');
      stage.callouts.forEach((c, i) => {
        const co = el('div', 'mp-callout');
        co.style.animation = `fadeUp .4s ease-out ${0.3 + i * 0.15}s both`;
        co.style.opacity = '0';
        co.innerHTML = `<div class="mp-callout-label">${c.label}</div><div class="mp-callout-value">${c.value}</div>`;
        callouts.appendChild(co);
        // Trigger animation
        setTimeout(() => { co.style.opacity = ''; }, 50);
      });
      wrap.appendChild(callouts);
    }

    if (stage.gaia) {
      const gaia = el('div', 'mp-gaia');
      gaia.style.animation = 'fadeUp .5s ease-out .6s both';
      gaia.style.opacity = '0';
      gaia.innerHTML = `<div class="mp-gaia-avatar">🌍</div><div class="mp-gaia-text">${stage.gaia}</div>`;
      wrap.appendChild(gaia);
      setTimeout(() => { gaia.style.opacity = ''; }, 50);
    }

    if (stage.actions) {
      const actions = el('div', 'mp-actions');
      actions.style.animation = 'fadeUp .4s ease-out .8s both';
      actions.style.opacity = '0';
      stage.actions.forEach(a => {
        const btn = el('button', 'mp-btn ' + (a.style === 'primary' ? 'primary' : 'secondary'));
        btn.innerHTML = a.label;
        btn.addEventListener('click', () => {
          if (a.type === 'next' || !a.type) nextStage();
          else if (a.type === 'complete') completeModule();
        });
        actions.appendChild(btn);
      });
      wrap.appendChild(actions);
      setTimeout(() => { actions.style.opacity = ''; }, 50);
    }

    container.appendChild(wrap);
  }

  // ── NAVIGATION ─────────────────────────────────────────────
  function nextStage() {
    if (!state.currentModule) return;
    const stages = state.currentModule.stages;
    if (state.currentStageIndex < stages.length - 1) {
      state.currentStageIndex++;
      const p = getModuleProgress(state.currentModule.id);
      if (p.stageIndex < state.currentStageIndex) p.stageIndex = state.currentStageIndex;
      saveProgress();
      renderStage(stages[state.currentStageIndex], state.currentStageIndex);
      contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      completeModule();
    }
  }

  function prevStage() {
    if (!state.currentModule || state.currentStageIndex <= 0) return;
    state.currentStageIndex--;
    renderStage(state.currentModule.stages[state.currentStageIndex], state.currentStageIndex);
    contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goToStage(index) {
    if (!state.currentModule) return;
    const stages = state.currentModule.stages;
    if (index >= 0 && index < stages.length) {
      state.currentStageIndex = index;
      renderStage(stages[index], index);
      contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ── MODULE COMPLETION ──────────────────────────────────────
  function completeModule() {
    if (!state.currentModule) return;
    const p = getModuleProgress(state.currentModule.id);
    p.completed = true;
    awardXP(50, 'Module complete');
    saveProgress();

    contentEl.innerHTML = '';
    const theme = getModuleTheme(state.currentModule.id);

    const comp = el('div', 'mp-completion');
    comp.innerHTML = `
      <div class="mp-completion-icon">${theme.icon}</div>
      <div class="mp-completion-title">Module Complete!</div>
      <div class="mp-completion-body">
        You've finished <strong>${state.currentModule.title}</strong>.
        ${state.currentModule.description || ''}
      </div>
      <div class="mp-completion-stats">
        <div class="mp-comp-stat">
          <div class="mp-comp-stat-value">${p.score}</div>
          <div class="mp-comp-stat-label">Total XP</div>
        </div>
        <div class="mp-comp-stat">
          <div class="mp-comp-stat-value">${state.currentModule.stages.length}</div>
          <div class="mp-comp-stat-label">Stages</div>
        </div>
        <div class="mp-comp-stat">
          <div class="mp-comp-stat-value">${Object.keys(p.answers).length}</div>
          <div class="mp-comp-stat-label">Decisions</div>
        </div>
      </div>
    `;
    contentEl.appendChild(comp);

    const actions = el('div', 'mp-actions');
    actions.style.justifyContent = 'center';

    // Next module button
    if (state.currentModule.next_module && state.modules[state.currentModule.next_module]) {
      const nextBtn = el('button', 'mp-btn primary');
      nextBtn.innerHTML = `Next: ${state.modules[state.currentModule.next_module].title} →`;
      nextBtn.addEventListener('click', () => loadModule(state.currentModule.next_module));
      actions.appendChild(nextBtn);
    }

    // Back to hub
    const hubBtn = el('button', 'mp-btn secondary');
    hubBtn.textContent = '← All Modules';
    hubBtn.addEventListener('click', showHub);
    actions.appendChild(hubBtn);

    contentEl.appendChild(actions);
    updateProgress();
  }

  // ── MODULE HUB ─────────────────────────────────────────────
  function showHub() {
    // Auto-register from embedded data if available
    if (window.__EMBEDDED_MODULES__) {
      Object.values(window.__EMBEDDED_MODULES__).forEach(mod => {
        if (!state.modules[mod.id]) state.modules[mod.id] = mod;
      });
    }

    state.currentModule = null;
    contentEl.innerHTML = '';
    progressEl.style.display = 'none';
    navEl.style.display = 'none';

    const hub = el('div', 'mp-hub');
    hub.innerHTML = `
      <div class="mp-hub-title">🌍 Climate Learning Modules</div>
      <div class="mp-hub-subtitle">Interactive explorations of Earth's climate system. Each module takes 5-10 minutes.</div>
    `;

    const grid = el('div', 'mp-hub-grid');

    Object.values(state.modules).forEach((mod, i) => {
      const p = getModuleProgress(mod.id);
      const theme = getModuleTheme(mod.id);
      const isLocked = mod.prerequisites && mod.prerequisites.length > 0 && !mod.prerequisites.every(pr => state.progress[pr] && state.progress[pr].completed);

      const card = el('div', 'mp-hub-card' + (isLocked ? ' mp-hub-card-locked' : ''));
      card.style.animation = `fadeUp .4s ease-out ${i * 0.08}s both`;
      card.style.opacity = '0';
      setTimeout(() => { card.style.opacity = ''; }, 50);

      const progressPct = p.completed ? 100 : Math.round((p.stageIndex / mod.stages.length) * 100);

      card.innerHTML = `
        <div class="mp-hub-card-icon">${isLocked ? '🔒' : theme.icon}</div>
        <div class="mp-hub-card-title">${mod.title}</div>
        <div class="mp-hub-card-desc">${mod.description || ''}</div>
        <div class="mp-hub-card-meta">
          <span class="mp-hub-card-badge ${mod.difficulty}">${mod.difficulty}</span>
          <span class="mp-hub-card-time">⏱ ${mod.estimated_minutes || 5} min</span>
          ${p.completed ? '<span class="mp-hub-card-badge" style="background:rgba(91,191,114,.1);color:var(--leaf)">✓ Complete</span>' : ''}
        </div>
        ${!isLocked ? `<div class="mp-hub-card-progress"><div class="mp-hub-card-progress-fill" style="width:${progressPct}%"></div></div>` : ''}
      `;

      if (!isLocked) {
        card.addEventListener('click', () => loadModule(mod.id));
      }

      grid.appendChild(card);
    });

    hub.appendChild(grid);
    contentEl.appendChild(hub);
    renderTopbar();
  }

  // ── MODULE LOADING ─────────────────────────────────────────
  async function loadModule(moduleId) {
    // Try to load from embedded data first, then fetch
    let mod = state.modules[moduleId];

    if (!mod && window.__EMBEDDED_MODULES__ && window.__EMBEDDED_MODULES__[moduleId]) {
      mod = window.__EMBEDDED_MODULES__[moduleId];
      state.modules[moduleId] = mod;
    }

    if (!mod) {
      try {
        const resp = await fetch(`data/modules/${moduleId}.json`);
        if (!resp.ok) throw new Error('Not found');
        mod = await resp.json();
        state.modules[moduleId] = mod;
      } catch (e) {
        // Try alternate paths
        try {
          const resp = await fetch(`../data/modules/${moduleId}.json`);
          if (!resp.ok) throw new Error('Not found');
          mod = await resp.json();
          state.modules[moduleId] = mod;
        } catch (e2) {
          contentEl.innerHTML = `<div class="mp-body" style="text-align:center;padding:48px 0"><p>Module not found: ${moduleId}</p><button class="mp-btn secondary" onclick="ModulePlayer.showHub()">← Back to Modules</button></div>`;
          return;
        }
      }
    }

    state.currentModule = mod;
    state.startTime = Date.now();
    const p = getModuleProgress(moduleId);
    state.currentStageIndex = p.stageIndex || 0;

    progressEl.style.display = '';
    navEl.style.display = '';

    renderTopbar();
    renderStage(mod.stages[state.currentStageIndex], state.currentStageIndex);
    contentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── INITIALIZATION ─────────────────────────────────────────
  function init() {
    loadProgress();
    buildShell();

    // Check for module parameter in URL
    const params = new URLSearchParams(window.location.search);
    const moduleId = params.get('module');
    if (moduleId) {
      loadModule(moduleId);
    } else {
      showHub();
    }
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── DATA REGISTRATION ───────────────────────────────────────
  function registerModule(mod) {
    state.modules[mod.id] = mod;
  }

  function registerModules(mods) {
    mods.forEach(m => registerModule(m));
  }

  // ── PUBLIC API ─────────────────────────────────────────────
  return {
    init,
    loadModule,
    showHub,
    nextStage,
    prevStage,
    goToStage,
    registerModule,
    registerModules,
    getState: () => ({ ...state }),
    resetProgress: () => {
      state.progress = {};
      state.totalXP = 0;
      saveProgress();
      showHub();
    },
  };
})();

window.ModulePlayer = ModulePlayer;
