/**
 * SITE PANEL v1.0
 * Layered reveal system for site investigation
 * Story → Data → Mystery (prediction) → Reveal → Insight → Journal
 */

const SITE_PANEL = (() => {
  let currentSite = null;
  let currentLayer = 0;
  let panelEl = null;
  let overlayEl = null;
  let _lastVerification = null;
  let _lastTab = 'sat';
  let _lastRegCheck = null;
  let _gaiaCollapsed = false;

  // ── Layer definitions ──
  const LAYERS = ['story', 'data', 'mystery', 'reveal', 'insight'];

  // ── GAIA Context: per-site, per-layer guidance + suggestions ──
  const GAIA_CONTEXT = {
    sri_lanka: {
      story: {
        guidance: "This land was scarred by decades of conflict. The Northern Province saw displacement, loss, and ecological collapse. But someone saw potential here — not just to plant trees, but to rebuild an entire ecosystem.",
        suggestions: [
          { label: "Read the full story", action: "SITE_PANEL.scrollToLayer('story')" },
          { label: "Why Sri Lanka?", action: "SITE_PANEL.speakGAIA('ENTRY_SRI_02')" },
        ],
      },
      data: {
        guidance: "Look at the NDVI sparkline. That flat line on the left? Decades of bare soil. Now look at the right edge — that's the restoration kicking in. From 10 tC/ha to 180. That's not just recovery. That's resurrection.",
        suggestions: [
          { label: "Show me the data", action: "SITE_PANEL.scrollToLayer('data')" },
          { label: "Verify with satellite", action: "SITE_PANEL.verifyCurrentSite()" },
        ],
      },
      mystery: {
        guidance: "Before you see the answer — what do you think? This land was almost bare. Ten tons of carbon per hectare. What could it become?",
        suggestions: [
          { label: "I have a theory", action: "SITE_PANEL.scrollToLayer('mystery')" },
        ],
      },
      reveal: {
        guidance: "From 10 to 180 tC/ha. An 18x increase. This is what restoration looks like when you do it right — not just trees, but a multilayer forest that pays for itself.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.scrollToLayer('insight')" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
      insight: {
        guidance: "Degraded land isn't dead. It's waiting. From 10 tC/ha to 180 — that's not just restoration. That's resurrection.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.addInsightFromGAIA()" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
    },
    antalya: {
      story: {
        guidance: "Antalya. Mediterranean coast. Ancient pines, centuries old. Then July 2021 — the fire came. Sixty thousand hectares gone in days. I felt every hectare.",
        suggestions: [
          { label: "Read the full story", action: "SITE_PANEL.scrollToLayer('story')" },
          { label: "What caused it?", action: "SITE_PANEL.speakGAIA('ENTRY_ANT_01')" },
        ],
      },
      data: {
        guidance: "The NDVI dropped from 0.72 to 0.18. That's not a number. That's a scream. Four years later, it's at 0.38 — scrub recovery. The pines need decades. Maybe a century.",
        suggestions: [
          { label: "Show me the data", action: "SITE_PANEL.scrollToLayer('data')" },
          { label: "Verify with satellite", action: "SITE_PANEL.verifyCurrentSite()" },
        ],
      },
      mystery: {
        guidance: "The NDVI crashed from 0.72 to 0.18 in 2021. What could cause that kind of collapse in a Mediterranean forest?",
        suggestions: [
          { label: "I have a theory", action: "SITE_PANEL.scrollToLayer('mystery')" },
        ],
      },
      reveal: {
        guidance: "Wildfire. Sixty thousand hectares burned in days. The recovery to 0.38 took four years. Full forest recovery? Decades. Maybe a century. This is what climate change looks like on the ground.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.scrollToLayer('insight')" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
      insight: {
        guidance: "A single fire dropped NDVI from 0.72 to 0.18. Recovery to 0.38 took four years. Full forest recovery? Decades. Maybe a century.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.addInsightFromGAIA()" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
    },
    benin: {
      story: {
        guidance: "Ouidah, Benin. A man named Jean Missinhoun was from here. He carried this place in his heart. He wanted to bring the mangroves back — even after he was gone.",
        suggestions: [
          { label: "Read the full story", action: "SITE_PANEL.scrollToLayer('story')" },
          { label: "Who was Jean?", action: "SITE_PANEL.speakGAIA('ENTRY_BEN_01')" },
        ],
      },
      data: {
        guidance: "Mangroves store 950 tC/ha — the most carbon-dense ecosystem on Earth. The NDVI here dropped from 0.68 to 0.45. The mangroves were being torn out. For firewood. For development. For short-term thinking.",
        suggestions: [
          { label: "Show me the data", action: "SITE_PANEL.scrollToLayer('data')" },
          { label: "Verify with satellite", action: "SITE_PANEL.verifyCurrentSite()" },
        ],
      },
      mystery: {
        guidance: "Mangroves store 950 tC/ha when intact. The NDVI dropped from 0.68 to 0.45. What happened to all that carbon?",
        suggestions: [
          { label: "I have a theory", action: "SITE_PANEL.scrollToLayer('mystery')" },
        ],
      },
      reveal: {
        guidance: "When mangroves are destroyed, the carbon stored in their biomass and waterlogged soil is released. Every hectare lost is 950 tons of carbon going into the atmosphere. That's why restoring them is so urgent.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.scrollToLayer('insight')" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
      insight: {
        guidance: "Mangroves don't just store carbon — they lock it away for millennia. Destroy them, and centuries of storage go up in smoke.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.addInsightFromGAIA()" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
    },
    borneo: {
      story: {
        guidance: "West Kalimantan. Peat swamp forest. Fourteen hundred tons of carbon per hectare — stored over thousands of years. Then the grids came. Perfect squares. Nature doesn't make grids. Humans do.",
        suggestions: [
          { label: "Read the full story", action: "SITE_PANEL.scrollToLayer('story')" },
          { label: "What's the lie?", action: "SITE_PANEL.speakGAIA('ENTRY_BOR_03')" },
        ],
      },
      data: {
        guidance: "The NDVI is 0.65. Pretty green, right? But the carbon density is only 50 tC/ha. The original peat swamp stored 1,400. That's a 96% carbon loss disguised as green. This is the greenest lie on Earth.",
        suggestions: [
          { label: "Show me the data", action: "SITE_PANEL.scrollToLayer('data')" },
          { label: "Verify with satellite", action: "SITE_PANEL.verifyCurrentSite()" },
        ],
      },
      mystery: {
        guidance: "The NDVI here is 0.65 — pretty green. What do you think the carbon density is? This is a tropical region. It should be massive, right?",
        suggestions: [
          { label: "I have a theory", action: "SITE_PANEL.scrollToLayer('mystery')" },
        ],
      },
      reveal: {
        guidance: "Just 50 tC/ha. This is an oil palm plantation. The original peat swamp stored 1,400 tC/ha. The NDVI looks green and healthy, but 96% of the carbon is gone. Green does not mean healthy.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.scrollToLayer('insight')" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
      insight: {
        guidance: "Green ≠ carbon. Oil palm (NDVI 0.65) stores 50 tC/ha. The peat swamp it replaced stored 1,400. That's a 96% carbon loss disguised as green.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.addInsightFromGAIA()" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
    },
  };

  // ── Get GAIA context for current state ──
  function getGAIAContext(site, layer) {
    const siteContext = GAIA_CONTEXT[site.id];
    if (!siteContext) {
      return {
        guidance: `Exploring ${site.name}. ${site.narrative.substring(0, 120)}...`,
        suggestions: [
          { label: "What happened here?", action: "SITE_PANEL.nextLayer()" },
        ],
      };
    }
    const layerContext = siteContext[layer] || siteContext.story;
    return layerContext;
  }

  // ── Render GAIA section ──
  function renderGAIAsection(site, layer) {
    const ctx = getGAIAContext(site, layer);
    return `
      <div class="site-panel-gaia" id="site-panel-gaia">
        <div class="gaia-section-header" onclick="SITE_PANEL.toggleGAIA()">
          <span class="gaia-section-icon">🌍</span>
          <span class="gaia-section-title">GAIA</span>
          <span class="gaia-section-toggle" id="gaia-toggle-icon">${_gaiaCollapsed ? '▶' : '▼'}</span>
        </div>
        <div class="gaia-section-body${_gaiaCollapsed ? ' collapsed' : ''}" id="gaia-section-body">
          <div class="gaia-guidance">${ctx.guidance}</div>
          <div class="gaia-suggestions">
            ${ctx.suggestions.map(s => `
              <button class="gaia-suggestion-chip" onclick="${s.action}">${s.label}</button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ── Toggle GAIA section collapse ──
  function toggleGAIA() {
    _gaiaCollapsed = !_gaiaCollapsed;
    const body = document.getElementById('gaia-section-body');
    const icon = document.getElementById('gaia-toggle-icon');
    if (body) body.classList.toggle('collapsed', _gaiaCollapsed);
    if (icon) icon.textContent = _gaiaCollapsed ? '▶' : '▼';
  }

  // ── Speak a specific GAIA line ──
  function speakGAIA(lineId) {
    if (typeof GAIA_VOICE === 'undefined') return;
    const line = GAIA_VOICE.getLine(lineId);
    if (line && typeof GAIA_BUBBLE !== 'undefined') {
      GAIA_BUBBLE.show(line.text, line.tone, 8000);
    }
  }

  // ── Add insight from GAIA section ──
  function addInsightFromGAIA() {
    if (!currentSite) return;
    const layer = LAYERS[currentLayer];
    const ctx = getGAIAContext(currentSite, layer);
    // Find the insight text from the current layer
    const pred = PREDICTIONS[currentSite.id];
    if (pred) {
      addInsight(pred.insight, currentSite.id);
    }
  }

  // ── Scroll to a specific layer ──
  function scrollToLayer(layer) {
    const idx = LAYERS.indexOf(layer);
    if (idx >= 0 && idx >= currentLayer) {
      // Advance to that layer
      while (currentLayer < idx) {
        nextLayer();
      }
      // Scroll the panel to show the layer
      if (panelEl) {
        const layers = panelEl.querySelectorAll('.reveal-layer');
        if (layers[idx]) {
          layers[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  }

  // ── Prediction questions per site ──
  const PREDICTIONS = {
    sri_lanka: {
      question: "This land was degraded for decades. What do you think its carbon density is right now?",
      options: [
        { id: 'a', text: "~150 tC/ha — some recovery has happened", correct: false },
        { id: 'b', text: "~10 tC/ha — barely alive, almost nothing stored", correct: true },
        { id: 'c', text: "~350 tC/ha — it's a tropical forest, must be high", correct: false },
      ],
      explanation: "Just 10 tC/ha. This land is almost bare. Decades of conflict stripped it. But that's what makes the restoration so powerful — going from 10 to 180 tC/ha is an 18x increase.",
      insight: "Degraded land isn't dead. It's waiting. From 10 tC/ha to 180 — that's not restoration, that's resurrection.",
    },
    antalya: {
      question: "The NDVI dropped from 0.72 to 0.18 in 2021. What caused it?",
      options: [
        { id: 'a', text: "Drought — the Mediterranean is getting drier", correct: false },
        { id: 'b', text: "Wildfire — 60,000+ hectares burned in days", correct: true },
        { id: 'c', text: "Deforestation — logging cleared the pines", correct: false },
      ],
      explanation: "Wildfire. July 2021. Sixty thousand hectares gone in days. The NDVI crash from 0.72 to 0.18 is a burn scar. Four years later, it's at 0.38 — scrub recovery. The pines need decades.",
      insight: "A single fire dropped NDVI from 0.72 to 0.18. Recovery to 0.38 took four years. Full forest recovery? Decades. Maybe a century.",
    },
    benin: {
      question: "Mangroves store 950 tC/ha when intact. The NDVI here dropped from 0.68 to 0.45. What happened to the carbon?",
      options: [
        { id: 'a', text: "It's still there — the soil holds it even when trees are cut", correct: false },
        { id: 'b', text: "It was released — when mangroves are destroyed, the carbon goes into the atmosphere", correct: true },
        { id: 'c', text: "It moved — the carbon transferred to the ocean", correct: false },
      ],
      explanation: "When mangroves are destroyed, the carbon stored in their biomass and waterlogged soil is released. That's why restoring them is so urgent — every hectare lost is 950 tons of carbon going into the atmosphere.",
      insight: "Mangroves don't just store carbon — they lock it away for millennia. Destroy them, and centuries of storage go up in smoke.",
    },
    borneo: {
      question: "The NDVI here is 0.65 — pretty green. What do you think the carbon density is?",
      options: [
        { id: 'a', text: "~1,400 tC/ha — it's a tropical peat swamp, must be massive", correct: false },
        { id: 'b', text: "~50 tC/ha — it's an oil palm plantation", correct: true },
        { id: 'c', text: "~350 tC/ha — it's green, so it must be a healthy forest", correct: false },
      ],
      explanation: "Just 50 tC/ha. This is an oil palm plantation. The original peat swamp stored 1,400 tC/ha. The NDVI looks green and healthy, but 96% of the carbon is gone. This is the greenest lie on Earth.",
      insight: "Green ≠ carbon. Oil palm (NDVI 0.65) stores 50 tC/ha. The peat swamp it replaced stored 1,400. That's a 96% carbon loss disguised as green.",
    },
  };

  // ── Create panel DOM ──
  function createElements() {
    if (panelEl) return;

    overlayEl = document.createElement('div');
    overlayEl.className = 'site-panel-overlay';
    overlayEl.addEventListener('click', close);
    document.body.appendChild(overlayEl);

    panelEl = document.createElement('div');
    panelEl.className = 'site-panel';
    document.body.appendChild(panelEl);
  }

  // ── Open panel for a site ──
  function open(site) {
    createElements();
    currentSite = site;
    currentLayer = 0;

    // Speak entry line
    GAIA_BUBBLE.speak('SITE_ENTRY', site.id);
    GAIA_ENGAGEMENT.addSignal('site_tap');
    GAIA_ENGAGEMENT.addMoodSignal('curiosity');
    if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('site_entered', { siteId: site.id });

    // Build panel content
    renderLayer('story');

    // Show panel
    overlayEl.classList.add('visible');
    panelEl.classList.add('open');

    // Track visit
    try {
      const visited = JSON.parse(localStorage.getItem('gaia_visited_sites') || '[]');
      if (!visited.includes(site.id)) visited.push(site.id);
      localStorage.setItem('gaia_visited_sites', JSON.stringify(visited));
    } catch { /* ignore */ }
  }

  // ── Render a specific layer ──
  function renderLayer(layer) {
    if (!panelEl || !currentSite) return;
    const site = currentSite;
    const biome = Data.getBiome(site.primaryBiome);
    let html = '';

    // Close button
    html += `<button class="site-panel-close" onclick="SITE_PANEL.close()">✕</button>`;

    // Always show site header
    html += `<div class="reveal-layer visible" style="transition-delay:0ms">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:3px;color:var(--teal);margin-bottom:8px">${site.name}</div>
      <h2 style="font-family:var(--display);font-size:24px;font-weight:300;color:var(--mint);margin-bottom:4px">${site.subtitle}</h2>
      <div style="font-size:11px;color:var(--text3);margin-bottom:16px">${site.area.toLocaleString()} ha · Target: ${biome.name}</div>
    </div>`;

    // GAIA section — context-aware guidance
    html += renderGAIAsection(site, layer);

    // Story layer
    if (LAYERS.indexOf(layer) >= 0) {
      html += `<div class="reveal-layer visible" style="transition-delay:100ms">
        <p style="font-size:13px;line-height:1.7;color:var(--text2)">${site.narrative}</p>
        <div style="margin-top:12px;padding:12px;background:rgba(78,205,196,0.04);border-left:2px solid rgba(78,205,196,0.15);border-radius:0 6px 6px 0;">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px">ELU Connection</div>
          <p style="font-size:12px;line-height:1.6;color:var(--text2)">${site.connection}</p>
        </div>
      </div>`;
    }

    // Data layer
    if (LAYERS.indexOf(layer) >= 1) {
      html += `<div class="reveal-layer visible" style="transition-delay:200ms">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--text3);margin-bottom:10px">Vegetation Health Over Time</div>
        <div style="margin-bottom:12px">
          ${renderNDVISparkline(site)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
          ${renderClimateMini(site)}
        </div>
        <div style="margin-top:12px;text-align:center;">
          <button onclick="SITE_PANEL.nextLayer()" style="padding:8px 20px;border:1px solid rgba(78,205,196,0.2);border-radius:6px;background:rgba(78,205,196,0.06);color:var(--teal);font-size:11px;cursor:pointer;transition:all .2s">
            What do you think happened here? →
          </button>
        </div>
      </div>`;
    }

    // Mystery layer (prediction prompt)
    if (LAYERS.indexOf(layer) >= 2) {
      const pred = PREDICTIONS[site.id];
      if (pred) {
        html += `<div class="reveal-layer visible" style="transition-delay:300ms">
          <div class="prediction-prompt">
            <div class="pp-question">${pred.question}</div>
            <div class="pp-options">
              ${pred.options.map(o => `<div class="pp-option" onclick="SITE_PANEL.selectPrediction('${o.id}', ${o.correct}, this)">${o.text}</div>`).join('')}
            </div>
            <div class="pp-feedback"></div>
          </div>
        </div>`;
      }
    }

    // Reveal layer
    if (LAYERS.indexOf(layer) >= 3) {
      const pred = PREDICTIONS[site.id];
      if (pred) {
        html += `<div class="reveal-layer visible" style="transition-delay:400ms">
          <div style="font-size:12px;line-height:1.7;color:var(--text2);margin-bottom:12px">${pred.explanation}</div>
        </div>`;
      }
    }

    // Insight layer
    if (LAYERS.indexOf(layer) >= 4) {
      const pred = PREDICTIONS[site.id];
      if (pred) {
        html += `<div class="reveal-layer visible" style="transition-delay:500ms">
          <div class="insight-card">
            <div class="insight-text">"${pred.insight}"</div>
            <button class="insight-journal-btn" onclick="SITE_PANEL.addInsight('${pred.insight.replace(/'/g, "\\'")}', '${site.id}')">
              + Add to Journal
            </button>
          </div>
          <div style="margin-top:16px;text-align:center;">
            <button onclick="SITE_PANEL.close()" style="padding:8px 20px;border:1px solid rgba(255,255,255,0.08);border-radius:6px;background:none;color:var(--text2);font-size:11px;cursor:pointer;">
              Explore another site →
            </button>
          </div>
</div>`;
      }
    }

    // Verification section (Impact Verification Engine)
    if (typeof NDVIVerifier !== 'undefined' || typeof RegistryCheck !== 'undefined') {
      html += `<div class="site-verify-section">
        <h4>🛰 Impact Verification</h4>
        <div class="verify-tabs">
          <button class="verify-tab ${(_lastTab ?? 'sat') === 'sat' ? 'active' : ''}" onclick="SITE_PANEL.switchVerifyTab(this,'sat')">Satellite NDVI</button>
          <button class="verify-tab ${(_lastTab ?? 'sat') === 'reg' ? 'active' : ''}" onclick="SITE_PANEL.switchVerifyTab(this,'reg')">Registry Check</button>
        </div>
        <button class="verify-refresh" onclick="SITE_PANEL.verifyCurrentSite()">↻ Refresh Verification</button>
        <div id="site-verify-content">${_lastVerification ? (_lastTab === 'reg' ? RegistryCheck.renderRegistryCard(_lastRegCheck) : NDVIVerifier.renderVerificationCard(site.id, _lastVerification)) : '<p style="font-size:10px;color:var(--text3)">Click refresh to fetch satellite &amp; registry data...</p>'}</div>
      </div>`;
    }

    panelEl.innerHTML = html;

    // Trigger live verification
    if (typeof NDVIVerifier !== 'undefined') {
      NDVIVerifier.verifySite(site.id).then(result => {
        _lastVerification = result.comparison || result;
        const content = document.getElementById('site-verify-content');
        if (content) content.innerHTML = NDVIVerifier.renderVerificationCard(site.id, _lastVerification);
      });
    }

    // Trigger quest check on data reveal
    if (typeof GAIA_JOURNAL !== 'undefined') {
      GAIA_JOURNAL.checkQuestProgress('data_reveal', site.id);
    }

    // Animate layers in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panelEl.querySelectorAll('.reveal-layer').forEach(el => el.classList.add('visible'));
      });
    });
  }

  // ── Render NDVI sparkline ──
  function renderNDVISparkline(site) {
    const points = site.ndvi;
    if (!points || points.length === 0) return '';
    const chartData = points.map(p => ({ label: p.year.toString(), value: p.value }));
    const id = 'ndvi-spark-' + site.id;
    setTimeout(() => {
      const canvas = document.getElementById(id);
      if (canvas) GAIA_CHARTS._drawSparkline(canvas, chartData, { color: '#4ecdc4', showLabels: true, padMin: 0.05, padMax: 0.05 });
    }, 100);
    return `<canvas id="${id}" width="400" height="80" style="width:100%;height:80px;display:block;"></canvas>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:9px;color:var(--text3)">
        <span>${points[0].year}: ${points[0].label}</span>
        <span>${points[points.length-1].year}: ${points[points.length-1].label}</span>
      </div>`;
  }

  // ── Render climate mini cards ──
  function renderClimateMini(site) {
    const climate = site.climate;
    if (!climate || climate.length < 2) return '';
    const first = climate[0], last = climate[climate.length - 1];
    const tempDelta = (last.temp - first.temp).toFixed(1);
    const precipDelta = ((last.precip - first.precip) / first.precip * 100).toFixed(0);
    return `
      <div style="padding:10px;background:rgba(255,255,255,0.02);border-radius:6px;">
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Temperature</div>
        <div style="font-family:var(--mono);font-size:16px;color:var(--warn)">${last.temp.toFixed(1)}°C</div>
        <div style="font-size:9px;color:var(--warn);margin-top:2px">+${tempDelta}°C since ${first.year}</div>
      </div>
      <div style="padding:10px;background:rgba(255,255,255,0.02);border-radius:6px;">
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Precipitation</div>
        <div style="font-family:var(--mono);font-size:16px;color:var(--teal)">${last.precip} mm</div>
        <div style="font-size:9px;color:var(--warn);margin-top:2px">${precipDelta}% since ${first.year}</div>
      </div>
    `;
  }

  // ── Next layer ──
  function nextLayer() {
    currentLayer++;
    if (currentLayer < LAYERS.length) {
      renderLayer(LAYERS[currentLayer]);
      if (LAYERS[currentLayer] === 'data') {
        GAIA_ENGAGEMENT.addSignal('data_reveal');
        if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('data_revealed', { siteId: currentSite?.id, layer: 'data' });
      }
      if (LAYERS[currentLayer] === 'mystery') GAIA_ENGAGEMENT.addMoodSignal('mystery');
    }
  }

  // ── Prediction selection ──
  function selectPrediction(optionId, isCorrect, el) {
    const pred = PREDICTIONS[currentSite.id];
    if (!pred) return;

    // Disable all options
    el.closest('.pp-options').querySelectorAll('.pp-option').forEach(o => {
      o.style.pointerEvents = 'none';
      o.style.opacity = '0.5';
    });
    el.style.opacity = '1';
    el.style.borderColor = isCorrect ? 'var(--leaf)' : 'var(--warn)';

    // Show feedback
    const feedback = el.closest('.prediction-prompt').querySelector('.pp-feedback');
    feedback.classList.add('show');
    feedback.classList.add(isCorrect ? 'correct' : 'wrong');
    feedback.innerHTML = (isCorrect ? '✅ ' : '❌ ') + pred.explanation;

    // Signals
    GAIA_ENGAGEMENT.addSignal('prediction');
    if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('prediction_made', { siteId: currentSite?.id, isCorrect });
    if (isCorrect) {
      GAIA_ENGAGEMENT.addSignal('correct_prediction');
      GAIA_ENGAGEMENT.addMoodSignal('pride');
      GAIA_BUBBLE.speak('RESULT', currentSite.id, 'proud');
    } else {
      GAIA_ENGAGEMENT.addMoodSignal('concern');
      GAIA_BUBBLE.speak('RESULT', currentSite.id, 'nurturing');
    }

    // Auto-advance to reveal after 2s
    setTimeout(() => nextLayer(), 2500);
  }

  // ── Add insight to journal ──
  function addInsight(text, siteId) {
    GAIA_JOURNAL.addEntry(text, siteId);
    GAIA_ENGAGEMENT.addSignal('insight');
    GAIA_ENGAGEMENT.addMoodSignal('pride');
    if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('narrative_read', { siteId });

    // Update button
    const btn = panelEl.querySelector('.insight-journal-btn');
    if (btn) {
      btn.textContent = '✓ In your journal';
      btn.classList.add('added');
      btn.style.pointerEvents = 'none';
    }

    // Speak
    const line = GAIA_VOICE.speak('INSIGHT', siteId);
    if (line) GAIA_BUBBLE.show(line.text, line.tone, 5000);

    // Check quests
    const completed = GAIA_JOURNAL.checkQuestProgress('insight', siteId);
    for (const q of completed) {
      showQuestNotification(q);
    }

    // Trigger pledge prompt after completing a site investigation
    if (typeof PLEDGE_WALL !== 'undefined') {
      PLEDGE_WALL.onSiteComplete(siteId);
    }
  }

  // ── Quest notification ──
  function showQuestNotification(quest) {
    const notif = document.createElement('div');
    notif.className = 'quest-notification';
    notif.innerHTML = `<div class="qn-title">✓ Quest Complete</div><div class="qn-text">${quest.title}</div>`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
  }

  // ── Refresh verification for current site ──
  function verifyCurrentSite() {
    if (!currentSite || typeof NDVIVerifier === 'undefined') return;
    const btn = panelEl?.querySelector('.verify-refresh');
    if (btn) { btn.textContent = '↻ Loading...'; btn.disabled = true; }
    NDVIVerifier.verifySite(currentSite.id).then(result => {
      _lastVerification = result.comparison || result;
      const content = document.getElementById('site-verify-content');
      if (content) content.innerHTML = NDVIVerifier.renderVerificationCard(currentSite.id, _lastVerification);
      if (btn) { btn.textContent = '↻ Refresh from Satellite'; btn.disabled = false; }
    }).catch(err => {
      console.warn('[SITE_PANEL] Verification failed:', err);
      if (btn) { btn.textContent = '↻ Retry'; btn.disabled = false; }
    });
  }

  // ── Switch verification tab ──
  function switchVerifyTab(btn, tab) {
    _lastTab = tab;
    const tabs = panelEl?.querySelectorAll('.verify-tab');
    if (tabs) tabs.forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    // Re-render content
    const content = document.getElementById('site-verify-content');
    if (!content) return;
    if (tab === 'sat') {
      if (_lastVerification) content.innerHTML = NDVIVerifier.renderVerificationCard(currentSite.id, _lastVerification);
      else content.innerHTML = '<p style="font-size:10px;color:var(--text3)">Click refresh to fetch satellite data...</p>';
    } else {
      if (_lastRegCheck) content.innerHTML = RegistryCheck.renderRegistryCard(_lastRegCheck);
      else content.innerHTML = '<p style="font-size:10px;color:var(--text3)">Click refresh to fetch registry data...</p>';
    }
  }

  // ── Close ──
  function close() {
    if (overlayEl) overlayEl.classList.remove('visible');
    if (panelEl) panelEl.classList.remove('open');
    currentSite = null;

    // Speak departure
    const line = GAIA_VOICE.speak('DEPARTURE', null, null);
    if (line) GAIA_BUBBLE.show(line.text, line.tone, 5000);

    GAIA_ENGAGEMENT.save();
  }

  return { open, close, nextLayer, selectPrediction, addInsight, verifyCurrentSite, switchVerifyTab, toggleGAIA, speakGAIA, addInsightFromGAIA, scrollToLayer, getCurrentLayer: () => currentLayer, getCurrentSite: () => currentSite };
})();
