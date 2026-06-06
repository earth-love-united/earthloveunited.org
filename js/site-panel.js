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
  let _focusTrap = null;

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
    const body = $('gaia-section-body');
    const icon = $('gaia-toggle-icon');
    if (body) body.classList.toggle('collapsed', _gaiaCollapsed);
    if (icon) icon.textContent = _gaiaCollapsed ? '▶' : '▼';
  }

  // ── Speak a specific GAIA line ──
  function speakGAIA(lineId) {
    if (!hasModule('GAIA_VOICE')) return;
    const line = GAIA_VOICE.getLine(lineId);
    if (line) safeCall('GAIA_BUBBLE', 'speak', line.text, line.tone, 8000);
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

    // Create overlay (separate from #panel-backdrop which uses different class)
    overlayEl = document.createElement('div');
    overlayEl.className = 'site-panel-overlay';
    overlayEl.addEventListener('click', close);
    document.body.appendChild(overlayEl);

    // Reuse existing HTML #site-panel if present to prevent duplicates
    const existing = document.getElementById('site-panel');
    if (existing) {
      panelEl = existing;
    } else {
      panelEl = document.createElement('div');
      panelEl.id = 'site-panel';
      document.body.appendChild(panelEl);
    }
    panelEl.className = 'site-panel';
  }

  // ── Open panel for a site ──
  function open(site) {
    createElements();
    currentSite = site;
    currentLayer = 0;

    // Emit EventBus event
    if (hasModule('EventBus')) {
      window.EventBus.emit('site:open', { siteId: site.id, site });
    }

    // Speak entry line
    if (hasModule('GAIA_VOICE') && hasModule('GAIA_BUBBLE')) {
      const line = GAIA_VOICE.speak('SITE_ENTRY', site.id);
      if (line && line.text) GAIA_BUBBLE.speak(line.text, line.tone, 8000);
    }
    if (hasModule('GAIA_ENGAGEMENT')) {
      GAIA_ENGAGEMENT.addSignal('site_tap');
      GAIA_ENGAGEMENT.addMoodSignal('curiosity');
    }
    safeCall('GAIA_SIG', 'emit', 'site_entered', { siteId: site.id });

    // Build panel content
    renderLayer('story');

    // Show panel
    overlayEl.classList.add('visible');
    panelEl.classList.add('open');

    // Focus trap
    _focusTrap = createFocusTrap(panelEl, close);
    _focusTrap.activate();

    // Track visit (fire-and-forget async)
    window.STORAGE_ADAPTER.get('gaia_visited_sites').then(visited => {
      const list = Array.isArray(visited) ? visited : [];
      if (!list.includes(site.id)) list.push(site.id);
      window.STORAGE_ADAPTER.set('gaia_visited_sites', list);
    }).catch(() => {});
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
    if (hasModule('NDVIVerifier') || hasModule('RegistryCheck')) {
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
    if (hasModule('NDVIVerifier')) {
      NDVIVerifier.verifySite(site.id).then(result => {
        _lastVerification = result.comparison || result;
        const content = $('site-verify-content');
        if (content) content.innerHTML = NDVIVerifier.renderVerificationCard(site.id, _lastVerification);
      });
    }

    // Trigger quest check on data reveal
    safeCall('GAIA_JOURNAL', 'checkQuestProgress', 'data_reveal', site.id);

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
      const canvas = $(id);
      if (canvas) safeCall('GAIA_CHARTS', '_drawSparkline', canvas, chartData, { color: '#4ecdc4', showLabels: true, padMin: 0.05, padMax: 0.05 });
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
    const precipDelta = first.precip ? ((last.precip - first.precip) / first.precip * 100).toFixed(0) : '0';
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
        safeCall('GAIA_ENGAGEMENT', 'addMoodSignal', 'data_deep');
        safeCall('GAIA_SIG', 'emit', 'data_revealed', { siteId: currentSite?.id, layer: 'data' });
      }
      if (LAYERS[currentLayer] === 'mystery') safeCall('GAIA_ENGAGEMENT', 'addMoodSignal', 'mystery');
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
    if (hasModule('GAIA_ENGAGEMENT')) {
      GAIA_ENGAGEMENT.addSignal('prediction');
      if (isCorrect) {
        GAIA_ENGAGEMENT.addSignal('correct_prediction');
        GAIA_ENGAGEMENT.addMoodSignal('pride');
      } else {
        GAIA_ENGAGEMENT.addMoodSignal('concern');
      }
    }
    safeCall('GAIA_SIG', 'emit', 'prediction_made', { siteId: currentSite?.id, isCorrect });
    if (hasModule('GAIA_VOICE') && hasModule('GAIA_BUBBLE')) {
      const tone = isCorrect ? 'proud' : 'nurturing';
      const line = GAIA_VOICE.speak('RESULT', currentSite?.id, tone);
      if (line && line.text) GAIA_BUBBLE.speak(line.text, line.tone, 5000);
    }

    // Auto-advance to reveal after 2s
    setTimeout(() => nextLayer(), 2500);
  }

  // ── Add insight to journal ──
  function addInsight(text, siteId) {
    safeCall('GAIA_JOURNAL', 'addEntry', text, siteId);
    safeCall('GAIA_ENGAGEMENT', 'addSignal', 'insight');
    safeCall('GAIA_ENGAGEMENT', 'addMoodSignal', 'pride');
    safeCall('GAIA_SIG', 'emit', 'narrative_read', { siteId });

    // Update button
    const btn = panelEl.querySelector('.insight-journal-btn');
    if (btn) {
      btn.textContent = '✓ In your journal';
      btn.classList.add('added');
      btn.style.pointerEvents = 'none';
    }

    // Speak
    const line = safeCall('GAIA_VOICE', 'speak', 'INSIGHT', siteId);
    if (line && line.text) safeCall('GAIA_BUBBLE', 'speak', line.text, line.tone, 5000);

    // Check quests
    const completed = safeCall('GAIA_JOURNAL', 'checkQuestProgress', 'insight', siteId);
    if (completed) {
      for (const q of completed) {
        showQuestNotification(q);
      }
    }

    // Trigger pledge prompt after completing a site investigation
    safeCall('PLEDGE_WALL', 'onSiteComplete', siteId);
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
      const content = $('site-verify-content');
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
    const content = $('site-verify-content');
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
    if (_focusTrap) { _focusTrap.deactivate(); _focusTrap = null; }
    if (overlayEl) overlayEl.classList.remove('visible');
    if (panelEl) panelEl.classList.remove('open');
    currentSite = null;

    // Clean up any stale globe transform from legacy Panel.open()
    const globeEl = document.getElementById('globeViz');
    if (globeEl) globeEl.style.transform = '';

    // Speak departure
    if (hasModule('GAIA_VOICE') && hasModule('GAIA_BUBBLE')) {
      const line = GAIA_VOICE.speak('DEPARTURE', null, null);
      if (line && line.text) GAIA_BUBBLE.speak(line.text, line.tone, 5000);
    }

    safeCall('GAIA_ENGAGEMENT', 'save');

    // Emit EventBus event
    if (hasModule('EventBus')) {
      window.EventBus.emit('site:close', {});
    }
  }

  return {
    open, close, nextLayer, selectPrediction, addInsight, verifyCurrentSite,
    switchVerifyTab, toggleGAIA, speakGAIA, addInsightFromGAIA, scrollToLayer,
    getCurrentLayer: () => currentLayer, getCurrentSite: () => currentSite,

    // ── Standard Module Lifecycle (SML) ──
    init(config = {}) {
      console.debug('[SML] SITE_PANEL.init');

      // Listen for presence tease events via EventBus
      if (hasModule('EventBus')) {
        this._unsubPresence = window.EventBus.on('presence:tease', (data) => {
          // Could trigger a subtle visual cue in the panel
          // For now, just log — the bubble handles the speech
          console.debug('[SITE_PANEL] Presence tease:', data.siteId, data.line);
        });
      }

      return true;
    },

    reset() {
      console.debug('[SML] SITE_PANEL.reset');
      currentSite = null;
      currentLayer = 0;
      _gaiaCollapsed = false;
      return true;
    },

    destroy() {
      console.debug('[SML] SITE_PANEL.destroy');

      // Unsubscribe from EventBus
      if (this._unsubPresence) {
        this._unsubPresence();
        this._unsubPresence = null;
      }

      // Remove overlay click listener
      if (overlayEl) {
        overlayEl.removeEventListener('click', close);
        overlayEl = null;
      }

      // Nullify DOM references
      panelEl = null;

      // Reset state
      currentSite = null;
      currentLayer = 0;
      _gaiaCollapsed = false;

      return true;
    },

    getState() {
      return {};
    },
  };
})();
window.SITE_PANEL = SITE_PANEL;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('SITE_PANEL', {
    provides: ['open', 'close', 'nextLayer', 'selectPrediction', 'addInsight', 'verifyCurrentSite', 'switchVerifyTab', 'toggleGAIA', 'speakGAIA', 'addInsightFromGAIA', 'scrollToLayer', 'init', 'reset', 'destroy', 'getState'],
    requires: ['GLOBE_OVERLAY'],
    emits: ['site:open', 'site:close'],
    listens: ['presence:tease'],
  });
}


// ═══════════════════════════════════════════════
// PLEDGE PANEL — Country Interrogation Terminal
// Left-side overlay via GLOBE_OVERLAY (same as site panels)
// ═══════════════════════════════════════════════

const PLEDGE_PANEL = (() => {
  let currentNode = null;

  function fmt(n) {
    if (n === null || n === undefined) return '—';
    if (hasModule('Data')) return Data.fmt(n);
    return n >= 1e9 ? (n/1e9).toFixed(1)+'B' : n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : typeof n === 'number' ? n.toFixed(1) : String(n);
  }

  function open(node) {
    currentNode = node;

    // Fly to country
    if (hasModule('GlobeModule') && GlobeModule.world) {
      GlobeModule.world.pointOfView({ lat: node.lat, lng: node.lng, altitude: 0.8 }, 600);
      GlobeModule.world.controls().autoRotate = false;
    }

    // Use GLOBE_OVERLAY for the left-side panel
    if (hasModule('GLOBE_OVERLAY')) {
      GLOBE_OVERLAY.registerSite({
        siteId: 'pledge_' + node.iso,
        icon: '🌐',
        title: node.country,
        subtitle: (node.reduction_pct > 0 ? node.reduction_pct + '% by ' + Math.round(node.target_year) : 'No target') + (node.cat_rating ? ' · ' + node.cat_rating : ''),
        siteData: node,
        tabs: [
          { id: 'dashboard', label: 'Dashboard', render: renderDashboard },
        ],
      });
      GLOBE_OVERLAY.open('pledge_' + node.iso);
    }
  }

  function renderDashboard(el, node) {
    if (!node) return;
    const gap = node.reality_gap_mt;
    const gapClass = gap === null ? '' : (gap > 0 ? 'red' : 'green');
    const gapSign = gap !== null && gap > 0 ? '+' : '';
    const onTrack = node.on_track;
 const mom = node.momentum_cagr;
 const req = node.required_cagr;
 const div = node.divergence;

 let html = '';

 // CAT rating badge
 if (node.cat_rating) {
 html += '<div class="pledge-cat-badge" style="background:' + (node.globe_color || '#95a5a6') + '22;border-color:' + (node.globe_color || '#95a5a6') + '">';
 html += '<span class="pledge-cat-dot" style="background:' + (node.globe_color || '#95a5a6') + '"></span>';
 html += node.cat_rating;
 html += '</div>';
 }

 // Reality Gap card — BIG
 html += '<div class="pledge-gap-card">';
 html += '<div class="pledge-big-number">' + fmt(node.fossil_co2_mt) + ' <span class="pledge-unit">MtCO₂</span></div>';
 html += '<div class="pledge-label">Current Fossil Emissions</div>';
 if (gap !== null) {
 html += '<div class="pledge-gap-metric ' + gapClass + '">Gap to Target: ' + gapSign + fmt(gap) + ' MtCO₂</div>';
 } else {
 html += '<div class="pledge-gap-metric">No target data available</div>';
 }
 html += '</div>';

 // Emissions breakdown
 html += '<div class="pledge-emit-grid">';
 html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + fmt(node.fossil_co2_mt) + '</div><div class="pledge-emit-label">Fossil CO₂ (Mt)</div></div>';
 html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + fmt(node.lulucf_co2_mt) + '</div><div class="pledge-emit-label">LULUCF CO₂ (Mt)</div></div>';
 html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + fmt(node.total_co2_mt) + '</div><div class="pledge-emit-label">Total CO₂ (Mt)</div></div>';
 html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + (typeof node.co2_per_capita === 'number' && node.co2_per_capita > 0 ? node.co2_per_capita.toFixed(2) : '—') + '</div><div class="pledge-emit-label">Per Capita (t)</div></div>';
 html += '</div>';

 // Momentum — only render if actual velocity data exists
 if (mom !== null && mom !== undefined) {
 const momClass = mom > 0 ? 'red' : 'green';
 html += '<div class="pledge-momentum">';
 html += '<div class="pledge-momentum-actual ' + momClass + '">';
 html += '<div class="pledge-momentum-label">Actual Velocity</div>';
 html += '<div class="pledge-momentum-val">' + (mom > 0 ? '+' : '') + mom.toFixed(2) + '%/yr</div>';
 html += '</div>';
 if (req !== null && req !== undefined && req > 0) {
 html += '<div class="pledge-momentum-vs">vs</div>';
 html += '<div class="pledge-momentum-required">';
 html += '<div class="pledge-momentum-label">Required Velocity</div>';
 html += '<div class="pledge-momentum-val">-' + req.toFixed(2) + '%/yr</div>';
 html += '</div>';
 }
 html += '</div>';
 }
 if (div !== null && div !== undefined && div !== 0) {
 const divClass = div > 0 ? 'red' : 'green';
 html += '<div class="pledge-divergence ' + divClass + '">Divergence: ' + (div > 0 ? '+' : '') + div.toFixed(2) + '%/yr</div>';
 }

 // Change since 2015
 if (typeof node.change_since_2015 === 'number') {
 const chg = node.change_since_2015;
 const chgClass = chg > 0 ? 'red' : 'green';
 html += '<div class="pledge-change ' + chgClass + '">Since 2015: ' + (chg > 0 ? '+' : '') + chg.toFixed(1) + '%</div>';
 }

    // On track
  if (onTrack === true) {
    html += '<div class="pledge-on-track green">✓ On Track</div>';
  } else if (onTrack === false) {
    html += '<div class="pledge-on-track red">✗ Off Track</div>';
  }

 // Finance
 if (typeof node.finance_total_bn === 'number' && node.finance_total_bn > 0) {
      html += '<div class="pledge-section">';
      html += '<div class="pledge-section-title">Climate Finance</div>';
      html += '<div class="pledge-finance-total">$' + fmt(node.finance_total_bn) + 'B</div>';
      html += '<div class="pledge-finance-label">Target Conditional on International Finance</div>';
      if (node.finance_mitigation_bn > 0) {
        html += '<div class="pledge-finance-breakdown">Mitigation: $' + fmt(node.finance_mitigation_bn) + 'B · Adaptation: $' + fmt(node.finance_adaptation_bn) + 'B</div>';
      }
      html += '</div>';
    }

    // NDC Summary
    if (node.ndc_summary) {
      html += '<div class="pledge-section">';
      html += '<div class="pledge-section-title">NDC Summary</div>';
      html += '<div class="pledge-ndc-text">' + node.ndc_summary + '</div>';
      html += '</div>';
    }

    el.innerHTML = html;
  }

  function close() {
    currentNode = null;
    safeCall('GLOBE_OVERLAY', 'close');
    if (hasModule('GlobeModule') && GlobeModule.world) {
      GlobeModule.world.controls().autoRotate = true;
      GlobeModule.world.pointOfView({ lat: 20, lng: 40, altitude: 2.2 }, 400);
    }
  }

  return {
    open, close,

    // ── Standard Module Lifecycle (SML) ──
    init(config = {}) {
      console.debug('[SML] PLEDGE_PANEL.init');
      return true;
    },

    reset() {
      console.debug('[SML] PLEDGE_PANEL.reset');
      currentNode = null;
      return true;
    },

    destroy() {
      console.debug('[SML] PLEDGE_PANEL.destroy');

      // Unsubscribe from EventBus
      if (this._unsubScenario) {
        this._unsubScenario();
        this._unsubScenario = null;
      }

      currentNode = null;
      return true;
    },

    getState() {
      return {};
    },
  };
})();
window.PLEDGE_PANEL = PLEDGE_PANEL;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('PLEDGE_PANEL', {
    provides: ['open', 'close', 'init', 'reset', 'destroy', 'getState'],
    requires: [],
    emits: ['pledge:submit'],
    listens: ['scenario:run'],
  });
}
