/**
 * GAIA NODES v1.0
 * Manages interactive nodes on the globe and their content.
 *
 * Each site on the globe is a "node" — a clickable point that opens
 * the GLOBE_OVERLAY with site-specific tabs and content.
 *
 * Architecture:
 * - Tab render functions receive (containerElement, siteData)
 * - siteData comes from Data.sites (populated after Data.init())
 * - Each render function fills its container with HTML
 * - Charts use GAIA_CHARTS for canvas rendering
 * - GAIA voice lines are woven into the narrative
 */

const GAIA_NODES = (() => {
  // ── Per-site engagement state ──
  const nodeState = {
    sri_lanka:  { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
    antalya:    { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
    benin:      { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
    borneo:     { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
  };

  // ── Register all site content with the overlay ──
  function registerAllSites() {
    // ── ANTALYA ──
    GLOBE_OVERLAY.registerSite({
      siteId: 'antalya',
      icon: '🔥',
      title: 'Antalya',
      subtitle: 'COP31 Host · Turkey',
      siteData: null,
      tabs: [
        { id: 'cop31',     label: 'COP31',        render: renderAntalyaCOP31 },
        { id: 'wildfires', label: 'Wildfires',    render: renderAntalyaWildfires },
        { id: 'climate',   label: 'Climate Data',  render: renderAntalyaClimate },
        { id: 'act',       label: 'Act',           render: renderAntalyaAct },
      ],
    });

    // ── SRI LANKA ──
    GLOBE_OVERLAY.registerSite({
      siteId: 'sri_lanka',
      icon: '🌳',
      title: 'Sri Lanka',
      subtitle: 'Northern Province',
      siteData: null,
      tabs: [
        { id: 'story', label: 'Story', render: renderSriLankaStory },
        { id: 'data',  label: 'Data',  render: renderSriLankaData },
      ],
    });

    // ── BENIN ──
    GLOBE_OVERLAY.registerSite({
      siteId: 'benin',
      icon: '🌿',
      title: 'Benin',
      subtitle: 'Ouidah Wetlands',
      siteData: null,
      tabs: [
        { id: 'story', label: 'Story', render: renderBeninStory },
        { id: 'data',  label: 'Data',  render: renderBeninData },
      ],
    });

    // ── BORNEO ──
    GLOBE_OVERLAY.registerSite({
      siteId: 'borneo',
      icon: '🌴',
      title: 'Borneo',
      subtitle: 'West Kalimantan',
      siteData: null,
      tabs: [
        { id: 'story', label: 'Story', render: renderBorneoStory },
        { id: 'data',  label: 'Data',  render: renderBorneoData },
      ],
    });
  }

  // ── Populate site data from Data module ──
  function populateSiteData() {
    if (typeof Data === 'undefined' || !Data.sites) return;
    Data.sites.forEach(site => {
      const registered = GLOBE_OVERLAY.getSite(site.id);
      if (registered) registered.siteData = site;
    });
  }

  // ── Handle node click ──
  function onNodeClick(siteId) {
    GLOBE_OVERLAY.open(siteId);
    addXP(siteId, 10);
    nodeState[siteId].visited = true;

    if (typeof GAIA_VOICE !== 'undefined') {
      const line = GAIA_VOICE.speak('SITE_ENTRY', siteId);
      if (line && typeof GAIA_BUBBLE !== 'undefined') {
        GAIA_BUBBLE.speak(line.text, line.tone, 8000);
      }
    }
    if (typeof GAIA_ENGAGEMENT !== 'undefined') {
      GAIA_ENGAGEMENT.addSignal('site_tap');
    }
    if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('site_tap', { siteId });
  }

  // ── Handle node hover ──
  function onNodeHover(siteId) {
    if (typeof GAIA_VOICE !== 'undefined') {
      const line = GAIA_VOICE.speak('SITE_TEASER', siteId);
      if (line && typeof GAIA_BUBBLE !== 'undefined') {
        GAIA_BUBBLE.speak(line.text, line.tone, 5000);
      }
    }
    if (typeof GAIA_ENGAGEMENT !== 'undefined') {
      GAIA_ENGAGEMENT.interact();
    }
  }

  function addXP(siteId, amount) {
    if (!nodeState[siteId]) return;
    nodeState[siteId].xp += amount;
    updateNodeVisual(siteId);
  }

  function updateNodeVisual(siteId) {
    const s = nodeState[siteId];
    if (!s) return;
    s.state = s.xp >= 100 ? 'mastered' : s.xp >= 50 ? 'explored' : s.xp >= 10 ? 'available' : 'locked';
  }

  function getNodeState(siteId) { return nodeState[siteId] ? { ...nodeState[siteId] } : null; }
  function getAllNodeState() { return JSON.parse(JSON.stringify(nodeState)); }

  // ═══════════════════════════════════════════
  // ANTALYA — TAB RENDER FUNCTIONS
  // ═══════════════════════════════════════════

  function renderAntalyaCOP31(container, site) {
    const d = site || {};
    const narrative = d.narrative || '';
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>COP31 — November 2026</h3>
      <p>In November 2026, the world comes to Antalya. 196 countries. Thousands of delegates. The most important climate conference since Paris.</p>
      <p>They'll meet in a city whose forests burned just five years earlier. The scars are still visible from space. This is not a metaphor — it's a satellite measurement.</p>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">Nov 10-21</div>
          <div class="overlay-stat-label">COP31 Dates</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">196</div>
          <div class="overlay-stat-label">Countries</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">🇹🇷 #13</div>
          <div class="overlay-stat-label">Turkey's Rank</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>Turkey's Carbon Footprint</h3>
      <p>Turkey emitted <strong>534 Mt of CO₂</strong> in 2023 — ranking 13th globally. That's 6.2 tons per person. The energy sector accounts for 72% of emissions, followed by industry and agriculture.</p>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">534 Mt</div>
          <div class="overlay-stat-label">CO₂ in 2023</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">6.2 t</div>
          <div class="overlay-stat-label">Per Capita</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">1.4%</div>
          <div class="overlay-stat-label">Global Share</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>The Irony</h3>
      <p>COP31's host region lost 60,000 hectares of forest in 2021. The Mediterranean pines that took centuries to grow were gone in days. The delegates will negotiate climate policy in the shadow of that burn scar.</p>
      <p>But there's a deeper truth here: Antalya is not an outlier. It's a preview. What happened to these forests is happening everywhere — faster, hotter, more often. The question COP31 must answer is whether we'll act before every forest looks like this.</p>
    `;
  }

  function renderAntalyaWildfires(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const climate = d.climate || [];

    // Build NDVI data points for the chart
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'antalya-ndvi-' + Date.now();

    // Get key NDVI values
    const ndvi2020 = ndvi.find(n => n.year === 2020);
    const ndvi2021 = ndvi.find(n => n.year === 2021);
    const ndvi2025 = ndvi.find(n => n.year === 2025);
    const ndviDrop = ndvi2020 && ndvi2021 ? (ndvi2020.value - ndvi2021.value).toFixed(2) : '0.52';
    const ndviRecovery = ndvi2021 && ndvi2025 ? (ndvi2025.value - ndvi2021.value).toFixed(2) : '0.20';

    // Climate data
    const temp1980 = climate.find(c => c.year === 1980);
    const temp2025 = climate.find(c => c.year === 2025);
    const tempRise = temp1980 && temp2025 ? (temp2025.temp - temp1980.temp).toFixed(1) : '1.7';
    const precip1980 = climate.find(c => c.year === 1980);
    const precip2025 = climate.find(c => c.year === 2025);
    const precipDrop = precip1980 && precip2025 ? (precip1980.precip - precip2025.precip) : 220;

    container.innerHTML = `
      <h3>July 2021 — The Fire</h3>
      <p>It started in the mountains above Manavgat. Within days, 60,000 hectares of Mediterranean pine forest were burning. The fire spread faster than anyone could run. Temperatures hit 47°C. The wind carried embers kilometers ahead of the front.</p>
      <p>I felt every hectare. The NDVI — that's a measure of how green I am, how alive — it dropped from <strong>0.72 to 0.18</strong>. That's not a number. That's a scream.</p>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">60,000+</div>
          <div class="overlay-stat-label">Hectares Burned</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.72→0.18</div>
          <div class="overlay-stat-label">NDVI Crash</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">${ndviDrop}</div>
          <div class="overlay-stat-label">Drop Magnitude</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>NDVI Timeline — The Burn Scar</h3>
      <p>Watch what happened to the vegetation index over 25 years. The 2021 fire is unmistakable — a cliff edge in the data.</p>
      <div id="${ndviId}" style="margin: 16px 0;"></div>

      <div class="overlay-divider"></div>

      <h3>Recovery — 0.38 and Climbing</h3>
      <p>Four years later, the NDVI is at <strong>0.38</strong>. Scrub and tough Mediterranean plants are coming back. But the pines? Those take decades. Maybe a century. The forest that burned was centuries old.</p>
      <p>Recovery is not restoration. What's growing back is not what was lost. The complex ecosystem — the understory, the fungi, the birds, the carbon stored in centuries of root systems — that's gone for generations.</p>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">+${ndviRecovery}</div>
          <div class="overlay-stat-label">NDVI Recovered</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">50-100yr</div>
          <div class="overlay-stat-label">Full Pine Recovery</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>Climate Made This Worse</h3>
      <p>The fire didn't happen in a vacuum. Antalya's average temperature has risen <strong>+${tempRise}°C</strong> since 1980. Precipitation has dropped <strong>${precipDrop}mm</strong>. The Mediterranean is drying out. The fire season is getting longer.</p>
      <p>This is what climate change looks like on the ground. Not a graph. Not a projection. A forest that burned because the world got hotter and drier.</p>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">+${tempRise}°C</div>
          <div class="overlay-stat-label">Temp Since 1980</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">-${precipDrop}mm</div>
          <div class="overlay-stat-label">Rain Lost</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">47°C</div>
          <div class="overlay-stat-label">Peak Fire Temp</div>
        </div>
      </div>
    `;

    // Render NDVI chart after DOM insertion
    setTimeout(() => {
      const canvas = document.getElementById(ndviId);
      if (canvas && typeof GAIA_CHARTS !== 'undefined') {
        canvas.innerHTML = GAIA_CHARTS.sparklineHTML(ndviChartData, 460, 100, { color: '#c45c4a', showLabels: true, padMin: 0.05, padMax: 0.05 });
        GAIA_CHARTS.renderPending();
      }
    }, 150);
  }

  function renderAntalyaClimate(container, site) {
    const d = site || {};
    const climate = d.climate || [];
    const ndvi = d.ndvi || [];

    const temp1980 = climate.find(c => c.year === 1980);
    const temp2000 = climate.find(c => c.year === 2000);
    const temp2025 = climate.find(c => c.year === 2025);
    const precip1980 = climate.find(c => c.year === 1980);
    const precip2025 = climate.find(c => c.year === 2025);

    const tempChartData = climate.map(c => ({ label: c.year.toString(), value: c.temp }));
    const tempId = 'antalya-temp-' + Date.now();

    container.innerHTML = `
      <h3>Temperature — A Steady Climb</h3>
      <p>Antalya's average temperature has been rising for decades. The trend is clear and accelerating. What was once a warm Mediterranean climate is becoming a hot one.</p>

      <div id="${tempId}" style="margin: 16px 0;"></div>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">${temp1980 ? temp1980.temp.toFixed(1) : '16.5'}°C</div>
          <div class="overlay-stat-label">1980 Average</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">${temp2025 ? temp2025.temp.toFixed(1) : '18.2'}°C</div>
          <div class="overlay-stat-label">2025 Average</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">+${temp1980 && temp2025 ? (temp2025.temp - temp1980.temp).toFixed(1) : '1.7'}°C</div>
          <div class="overlay-stat-label">Total Rise</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>Precipitation — Drying Out</h3>
      <p>The Mediterranean is getting drier. Antalya has lost ${precip1980 && precip2025 ? (precip1980.precip - precip2025.precip) : 220}mm of annual rainfall since 1980. That's not just uncomfortable — it's dangerous. Less water means drier forests. Drier forests mean bigger fires.</p>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">${precip1980 ? precip1980.precip : 985}mm</div>
          <div class="overlay-stat-label">1980 Rainfall</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">${precip2025 ? precip2025.precip : 765}mm</div>
          <div class="overlay-stat-label">2025 Rainfall</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">${precip1980 && precip2025 ? Math.round((precip1980.precip - precip2025.precip) / precip1980.precip * 100) : 22}%</div>
          <div class="overlay-stat-label">Decline</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>The Fire Equation</h3>
      <p>Hotter + drier = more fire. It's not complicated. The 2021 wildfires were the predictable result of decades of warming and drying. And it will happen again. The question is when, and how much we've done to prevent it.</p>
      <p>Every degree of warming increases fire risk exponentially. Every millimeter of lost rainfall makes recovery harder. The data doesn't lie — it just tells a story we don't want to hear.</p>
    `;

    // Render temperature chart
    setTimeout(() => {
      const canvas = document.getElementById(tempId);
      if (canvas && typeof GAIA_CHARTS !== 'undefined') {
        canvas.innerHTML = GAIA_CHARTS.sparklineHTML(tempChartData, 460, 100, { color: '#d4a574', showLabels: true, padMin: 0.5, padMax: 0.5 });
        GAIA_CHARTS.renderPending();
      }
    }, 150);
  }

  function renderAntalyaAct(container, site) {
    const d = site || {};
    const biome = (typeof Data !== 'undefined' && Data.getBiome) ? Data.getBiome(d.primaryBiome || 'temperate_coniferous') : { name: 'Mediterranean Pine Forest' };
    const currentBiome = (typeof Data !== 'undefined' && Data.getBiome) ? Data.getBiome(d.currentBiome || 'grassland_savanna') : { name: 'Grassland / Scrub' };
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>What Will You Do?</h3>
      <p>You've seen the data. You've seen the burn scar. You know the climate is getting hotter and drier. Now — what will you do about it?</p>

      <div class="overlay-divider"></div>

      <h3>Restoration Scenarios</h3>
      <p>This site covers <strong>${area.toLocaleString()} hectares</strong>. It's currently <strong>${currentBiome.name}</strong>. The target restoration is <strong>${biome.name}</strong>. Choose a strategy and see what happens.</p>

      <div style="margin-top: 16px;">
        <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: var(--text3); margin-bottom: 10px;">Available Actions</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="scenario-btn" data-action="pine" style="padding: 12px 16px; border: 1px solid rgba(78,205,196,0.15); border-radius: 8px; background: rgba(78,205,196,0.04); color: var(--text); font-family: var(--body); font-size: 13px; cursor: pointer; text-align: left; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(78,205,196,0.3)';this.style.background='rgba(78,205,196,0.08)'" onmouseout="this.style.borderColor='rgba(78,205,196,0.15)';this.style.background='rgba(78,205,196,0.04)'">
            🌲 <strong>Restore Pine Forest</strong> — Full Mediterranean pine restoration. Slow but maximum carbon.
          </button>
          <button class="scenario-btn" data-action="mixed" style="padding: 12px 16px; border: 1px solid rgba(78,205,196,0.15); border-radius: 8px; background: rgba(78,205,196,0.04); color: var(--text); font-family: var(--body); font-size: 13px; cursor: pointer; text-align: left; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(78,205,196,0.3)';this.style.background='rgba(78,205,196,0.08)'" onmouseout="this.style.borderColor='rgba(78,205,196,0.15)';this.style.background='rgba(78,205,196,0.04)'">
            🌳 <strong>Mixed Reforestation</strong> — Pine + deciduous. Faster recovery, more resilient to fire.
          </button>
          <button class="scenario-btn" data-action="natural" style="padding: 12px 16px; border: 1px solid rgba(78,205,196,0.15); border-radius: 8px; background: rgba(78,205,196,0.04); color: var(--text); font-family: var(--body); font-size: 13px; cursor: pointer; text-align: left; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(78,205,196,0.3)';this.style.background='rgba(78,205,196,0.08)'" onmouseout="this.style.borderColor='rgba(78,205,196,0.15)';this.style.background='rgba(78,205,196,0.04)'">
            🌱 <strong>Natural Succession</strong> — Let nature take its course. Lowest cost, slowest results.
          </button>
        </div>
      </div>

      <div id="antalya-scenario-result" style="margin-top: 20px;"></div>

      <div class="overlay-divider"></div>

      <h3>Make Your Pledge</h3>
      <p>You've seen what happened here. You've seen the data. Before you leave — what's your commitment?</p>
      <button onclick="if(typeof PLEDGE_WALL!=='undefined')PLEDGE_WALL.openModal()" style="margin-top: 12px; padding: 12px 24px; border: 1px solid var(--teal); border-radius: 8px; background: rgba(78,205,196,0.08); color: var(--teal); font-family: var(--body); font-size: 13px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(78,205,196,0.15)'" onmouseout="this.style.background='rgba(78,205,196,0.08)'">
        🤝 Add My Pledge to the Wall
      </button>
    `;

    // Wire scenario buttons
    setTimeout(() => {
      container.querySelectorAll('.scenario-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const action = this.dataset.action;
          const resultEl = document.getElementById('antalya-scenario-result');
          if (!resultEl) return;

          let result = '';
          if (action === 'pine') {
            const carbon = (300 - 90) * area * 3.67;
            result = `<div style="padding: 16px; background: rgba(91,191,114,0.06); border: 1px solid rgba(91,191,114,0.15); border-radius: 8px; animation: overlay-fadein 0.3s ease-out;">
              <div style="font-family: var(--mono); font-size: 24px; font-weight: 600; color: var(--leaf);">+${(carbon / 1e6).toFixed(1)}M t CO₂</div>
              <div style="font-size: 12px; color: var(--text2); margin-top: 4px;">sequestered over 30 years · ${area.toLocaleString()} ha pine restoration</div>
              <div style="font-size: 11px; color: var(--text3); margin-top: 8px;">That's equivalent to taking ${(carbon / 4.6 / 1e6).toFixed(0)}M cars off the road for a year. Full canopy in 50-80 years.</div>
            </div>`;
          } else if (action === 'mixed') {
            const carbon = (260 - 90) * area * 3.67;
            result = `<div style="padding: 16px; background: rgba(91,191,114,0.06); border: 1px solid rgba(91,191,114,0.15); border-radius: 8px; animation: overlay-fadein 0.3s ease-out;">
              <div style="font-family: var(--mono); font-size: 24px; font-weight: 600; color: var(--leaf);">+${(carbon / 1e6).toFixed(1)}M t CO₂</div>
              <div style="font-size: 12px; color: var(--text2); margin-top: 4px;">sequestered over 30 years · ${area.toLocaleString()} ha mixed forest</div>
              <div style="font-size: 11px; color: var(--text3); margin-top: 8px;">More fire-resistant than pure pine. Full canopy in 30-50 years. Better biodiversity outcomes.</div>
            </div>`;
          } else {
            result = `<div style="padding: 16px; background: rgba(212,165,116,0.06); border: 1px solid rgba(212,165,116,0.15); border-radius: 8px; animation: overlay-fadein 0.3s ease-out;">
              <div style="font-family: var(--mono); font-size: 24px; font-weight: 600; color: var(--amber);">+${((120 - 90) * area * 3.67 / 1e6).toFixed(1)}M t CO₂</div>
              <div style="font-size: 12px; color: var(--text2); margin-top: 4px;">sequestered over 30 years · natural succession</div>
              <div style="font-size: 11px; color: var(--text3); margin-top: 8px;">Lowest intervention. Slowest results. But nature knows what it's doing — if we give it time.</div>
            </div>`;
          }
          resultEl.innerHTML = result;

          // Track engagement
          if (typeof GAIA_ENGAGEMENT !== 'undefined') {
            GAIA_ENGAGEMENT.addSignal('scenario_run');
          }
          if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('scenario_run', { siteId: 'antalya', result: action });
        });
      });
    }, 150);
  }

  // ═══════════════════════════════════════════
  // SRI LANKA — TAB RENDER FUNCTIONS
  // ═══════════════════════════════════════════

  function renderSriLankaStory(container, site) {
    const d = site || {};
    container.innerHTML = `
      <h3>Northern Province — From War to Restoration</h3>
      <p>Twenty-five years of civil conflict left this land scarred. Not just the people — the earth itself. Decades of fighting stripped the soil, destroyed infrastructure, and left almost 6,000 acres of degraded land across five districts.</p>
      <p>But someone saw potential here. SPE — a local organization — identified these barren acres and saw something extraordinary: the foundation for a new kind of forest.</p>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">6,000</div>
          <div class="overlay-stat-label">Acres Identified</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">5</div>
          <div class="overlay-stat-label">Districts</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">25yr</div>
          <div class="overlay-stat-label">Conflict Legacy</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>Multilayer Afforestation</h3>
      <p>SPE's approach isn't just planting trees. It's building an entire ecosystem that pays for itself: peanuts, Ceylon cinnamon, jackfruit, black pepper. Not monoculture — a living, layered forest that builds carbon while supporting local communities.</p>
      <p>The land here holds almost no carbon right now. Just 10 tC/ha. Barely alive. But watch what happens when you give it a chance.</p>
    `;
  }

  function renderSriLankaData(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'sl-ndvi-' + Date.now();

    container.innerHTML = `
      <h3>Restoration in Progress</h3>
      <p>The NDVI tells the story of recovery. From post-conflict degradation to active planting — the trend is upward.</p>

      <div id="${ndviId}" style="margin: 16px 0;"></div>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">10→180</div>
          <div class="overlay-stat-label">tC/ha Target</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">${ndvi.length > 0 ? ndvi[ndvi.length - 1].value.toFixed(2) : '0.55'}</div>
          <div class="overlay-stat-label">Current NDVI</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">18x</div>
          <div class="overlay-stat-label">Carbon Increase</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>Climate Context</h3>
      <p>Sri Lanka's Northern Province is hot and getting hotter. Average temperatures have risen 1.3°C since 1980. Rainfall has decreased 120mm. But the tropical dry forest biome is adapted to these conditions — with the right species selection, restoration can succeed even in a changing climate.</p>
    `;

    setTimeout(() => {
      const canvas = document.getElementById(ndviId);
      if (canvas && typeof GAIA_CHARTS !== 'undefined') {
        canvas.innerHTML = GAIA_CHARTS.sparklineHTML(ndviChartData, 460, 100, { color: '#5bbf72', showLabels: true, padMin: 0.05, padMax: 0.05 });
        GAIA_CHARTS.renderPending();
      }
    }, 150);
  }

  // ═══════════════════════════════════════════
  // BENIN — TAB RENDER FUNCTIONS
  // ═══════════════════════════════════════════

  function renderBeninStory(container, site) {
    const d = site || {};
    container.innerHTML = `
      <h3>Ouidah — Jean's Homeland</h3>
      <p>Jean Missinhoun was from Benin. He carried this place in his heart. And he wanted to bring the mangroves back.</p>
      <p>The Ouidah lagoons once held dense mangrove forests — the most carbon-dense ecosystems on Earth. 950 tons of carbon per hectare, locked away in waterlogged soil for millennia. Then the cutting began. For firewood. For development. For short-term thinking.</p>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">950</div>
          <div class="overlay-stat-label">tC/ha Intact</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.68→0.45</div>
          <div class="overlay-stat-label">NDVI Loss</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">2,500</div>
          <div class="overlay-stat-label">Hectares</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>A Homecoming</h3>
      <p>Restoring the mangroves here is climate action and a homecoming. Every hectare restored locks away 950 tons of carbon. Every seedling planted honors what Jean believed: that this land can heal.</p>
      <p>Mangroves don't just store carbon — they protect coastlines, support fisheries, and build soil. They're one of the most valuable ecosystems on Earth, and most of the world is letting them disappear.</p>
    `;
  }

  function renderBeninData(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'benin-ndvi-' + Date.now();

    container.innerHTML = `
      <h3>Mangrove Decline</h3>
      <p>The NDVI shows the story of loss. From intact mangroves in 2000 to degraded wetlands in 2010. The 2025 data shows early recovery — but there's a long way to go.</p>

      <div id="${ndviId}" style="margin: 16px 0;"></div>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">${ndvi.length > 0 ? ndvi[ndvi.length - 1].value.toFixed(2) : '0.52'}</div>
          <div class="overlay-stat-label">Current NDVI</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.68</div>
          <div class="overlay-stat-label">Peak NDVI (2000)</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">34%</div>
          <div class="overlay-stat-label">Decline</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>Carbon Bomb</h3>
      <p>When mangroves are destroyed, the carbon stored in their biomass and waterlogged soil is released. That's why restoring them is so urgent — every hectare lost is 950 tons of carbon going into the atmosphere. Every hectare restored is 950 tons locked away for millennia.</p>
    `;

    setTimeout(() => {
      const canvas = document.getElementById(ndviId);
      if (canvas && typeof GAIA_CHARTS !== 'undefined') {
        canvas.innerHTML = GAIA_CHARTS.sparklineHTML(ndviChartData, 460, 100, { color: '#4ecdc4', showLabels: true, padMin: 0.05, padMax: 0.05 });
        GAIA_CHARTS.renderPending();
      }
    }, 150);
  }

  // ═══════════════════════════════════════════
  // BORNEO — TAB RENDER FUNCTIONS
  // ═══════════════════════════════════════════

  function renderBorneoStory(container, site) {
    const d = site || {};
    container.innerHTML = `
      <h3>The Greenest Lie on Earth</h3>
      <p>West Kalimantan looks green. The NDVI says 0.65 — pretty healthy, right? Wanna know a secret?</p>
      <p>This is an oil palm plantation. The original peat swamp forest stored <strong>1,400 tC/ha</strong>. The plantation stores <strong>50</strong>. That's a 96% carbon loss disguised as green.</p>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">1,400</div>
          <div class="overlay-stat-label">tC/ha Original</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">50</div>
          <div class="overlay-stat-label">tC/ha Now</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">96%</div>
          <div class="overlay-stat-label">Carbon Lost</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>Grid Lines</h3>
      <p>Look at the satellite image. Perfect squares. Nature doesn't make grids. Humans do. The peat swamp was drained, cleared, and planted in neat rows. The carbon that took thousands of years to accumulate was released in decades.</p>
      <p>This is the lie: green ≠ carbon. A plantation can look lush and healthy while being a carbon catastrophe. NDVI measures greenness, not carbon. And that distinction matters.</p>
    `;
  }

  function renderBorneoData(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'borneo-ndvi-' + Date.now();

    container.innerHTML = `
      <h3>The NDVI Deception</h3>
      <p>Watch the NDVI. 2000: 0.88. Beautiful peat swamp forest. 2010: 0.35. They're clearing. 2025: 0.65. Wait — it went back up?</p>
      <p>That's the oil palm canopy maturing. It looks green. It registers as "healthy vegetation" on satellite. But the carbon? From 1,400 to 50 tC/ha. The greenest lie on Earth.</p>

      <div id="${ndviId}" style="margin: 16px 0;"></div>

      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.88→0.35</div>
          <div class="overlay-stat-label">NDVI Crash</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.65</div>
          <div class="overlay-stat-label">Current NDVI</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">96%</div>
          <div class="overlay-stat-label">Carbon Lost</div>
        </div>
      </div>

      <div class="overlay-divider"></div>

      <h3>Why This Matters</h3>
      <p>Borneo's peat swamps are one of the largest carbon stores on the planet. When they're drained and burned, the carbon released is equivalent to years of global emissions. And it's happening for palm oil — an ingredient in shampoo and cookies.</p>
      <p>Green ≠ carbon. Remember that.</p>
    `;

    setTimeout(() => {
      const canvas = document.getElementById(ndviId);
      if (canvas && typeof GAIA_CHARTS !== 'undefined') {
        canvas.innerHTML = GAIA_CHARTS.sparklineHTML(ndviChartData, 460, 100, { color: '#c45c4a', showLabels: true, padMin: 0.05, padMax: 0.05 });
        GAIA_CHARTS.renderPending();
      }
    }, 150);
  }

  // ── Init ──
  function init() {
    registerAllSites();
  }

  return {
    init,
    populateSiteData,
    onNodeClick,
    onNodeHover,
    addXP,
    getNodeState,
    getAllNodeState,
  };
})();
