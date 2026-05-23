/**
 * GAIA NODES v1.1
 * Manages interactive nodes on the globe and their content.
 *
 * Each site on the globe is a "node" — a clickable point that opens
 * the GLOBE_OVERLAY with site-specific tabs and content.
 *
 * Data sources:
 * - site data from Data.sites (sites.json) — NDVI, climate, narratives
 * - climate facts from dis/climate-facts.json — sourced global data
 * - charts via GAIA_CHARTS — canvas sparklines
 * - GAIA voice lines woven into narrative
 */

const GAIA_NODES = (() => {
  // Counter for unique chart IDs (avoids Date.now() collisions)
  let _chartIdCounter = 0;
  // ── Per-site engagement state ──
  const nodeState = {
    sri_lanka:  { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
    antalya:    { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
    benin:      { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
    borneo:     { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
  };

  // ── Climate facts (from dis/climate-facts.json) ──
  const FACTS = {
    co2_current: 431.12,
    co2_preindustrial: 280,
    co2_annual_increase: 2.7,
    methane_current: 1940,
    methane_preindustrial: 722,
    temp_anomaly: 1.5,
    temp_anomaly_2021: 1.2,
    warming_rate: 0.2,
    carbon_budget_15: 250,
    carbon_budget_20: 1200,
    annual_emissions_2023: 37.8,
    annual_emissions_2025: 38.2,
    land_use_emissions: 3.6,
    ocean_sink: 2.5,
    land_sink: 3.4,
    airborne_fraction: 0.44,
    sea_level_rate: 4.5,
    sea_level_total: 20,
    atmosphere_pool: 870,
    ocean_pool: 37100,
    vegetation_pool: 550,
    soil_pool: 1500,
    permafrost_pool: 1700,
    peatland_stock: 600,
    peatland_area: 400,
    peatland_drained: 15,
    peatland_emissions: 1.9,
    mangrove_seq_rate: 6.3,
    mangrove_area: 15,
    mangrove_stock: 6.5,
    mangrove_loss: 35,
    seagrass_burial: 83,
    seagrass_area: 300000,
    seagrass_loss_rate: 7,
    solar_lcoe: 49,
    wind_lcoe: 42,
    coal_lcoe: 117,
    solar_reduction: 89,
    wind_reduction: 70,
    turkey_emissions: 534,
    turkey_per_capita: 6.2,
    turkey_rank: 13,
    turkey_share: 1.4,
  };

  // ── Content type definitions for modular globe markers ──
  const CONTENT_TYPES = {
    site:   { marker: { color: '#4ecdc4', size: 0.4, pulse: true },  hasGAIA: true,  panelType: 'site' },
    city:   { marker: { color: '#ffd700', size: 0.3, pulse: false }, hasGAIA: true,  panelType: 'city' },
    event:  { marker: { color: '#ff6b6b', size: 0.5, pulse: true },  hasGAIA: true,  panelType: 'event' },
    biome:  { marker: { color: '#2a8a3a', size: 0.6, pulse: false }, hasGAIA: false, panelType: 'biome' },
    data:   { marker: { color: '#9b59b6', size: 0.2, pulse: false }, hasGAIA: false, panelType: 'data' },
  };

  // ── Generic content registration ──
  function registerContent(config) {
    if (typeof GLOBE_OVERLAY === 'undefined') return;
    const type = CONTENT_TYPES[config.type] || CONTENT_TYPES.site;
    GLOBE_OVERLAY.registerSite({
      ...config,
      markerStyle: type.marker,
      hasGAIA: type.hasGAIA,
      panelType: type.panelType,
    });
  }

  // ── Batch register from JSON URL ──
  function registerFromJSON(url) {
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          data.forEach(config => registerContent(config));
        }
      })
      .catch(err => console.warn('[GAIA_NODES] Failed to load content from', url, err));
  }

  // ── Register all site content ──
  function registerAllSites() {
    if (typeof GLOBE_OVERLAY === 'undefined') {
      console.warn('[GAIA_NODES] GLOBE_OVERLAY not available, skipping site registration');
      return;
    }
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
        { id: 'global',    label: '🌐 Global',     render: renderAntalyaGlobal },
        { id: 'synthesis', label: '🧠 GAIA Synthesis', render: renderAntalyaSynthesis },
      ],
    });

    GLOBE_OVERLAY.registerSite({
      siteId: 'sri_lanka',
      icon: '🌳',
      title: 'Sri Lanka',
      subtitle: 'Northern Province',
      siteData: null,
      tabs: [
        { id: 'story',  label: 'Story',  render: renderSriLankaStory },
        { id: 'data',   label: 'Data',   render: renderSriLankaData },
        { id: 'impact', label: 'Impact', render: renderSriLankaImpact },
        { id: 'global', label: '🌐 Global', render: renderSriLankaGlobal },
        { id: 'synthesis', label: '🧠 GAIA Synthesis', render: renderSriLankaSynthesis },
      ],
    });

    GLOBE_OVERLAY.registerSite({
      siteId: 'benin',
      icon: '🌿',
      title: 'Benin',
      subtitle: "Jean's Homeland",
      siteData: null,
      tabs: [
        { id: 'story',    label: 'Story',    render: renderBeninStory },
        { id: 'mangrove', label: 'Mangroves', render: renderBeninMangrove },
        { id: 'data',     label: 'Data',     render: renderBeninData },
        { id: 'global',   label: '🌐 Global', render: renderBeninGlobal },
        { id: 'synthesis', label: '🧠 GAIA Synthesis', render: renderBeninSynthesis },
      ],
    });

    GLOBE_OVERLAY.registerSite({
      siteId: 'borneo',
      icon: '🌴',
      title: 'Borneo',
      subtitle: 'West Kalimantan',
      siteData: null,
      tabs: [
        { id: 'story',  label: 'The Lie',   render: renderBorneoStory },
        { id: 'peat',   label: 'Peatlands',  render: renderBorneoPeat },
        { id: 'data',   label: 'Data',       render: renderBorneoData },
        { id: 'global', label: '🌐 Global',   render: renderBorneoGlobal },
        { id: 'synthesis', label: '🧠 GAIA Synthesis', render: renderBorneoSynthesis },
      ],
    });
  }

  function populateSiteData() {
    if (typeof Data === 'undefined' || !Data.sites) return;
    if (typeof GLOBE_OVERLAY === 'undefined') return;
    Data.sites.forEach(site => {
      const registered = GLOBE_OVERLAY.getSite(site.id);
      if (registered) registered.siteData = site;
    });
  }

  function onNodeClick(siteId) {
    safeCall('GLOBE_OVERLAY', 'open', siteId);
    addXP(siteId, 10);
    if (nodeState[siteId]) nodeState[siteId].visited = true;
    // Set site context in GAIA bubble
    safeCall('GAIA_BUBBLE', 'setCurrentSite', siteId);
    const line = safeCall('GAIA_VOICE', 'speak', 'SITE_ENTRY', siteId);
    if (line) safeCall('GAIA_BUBBLE', 'speak', line.text, line.tone, 8000);
    safeCall('GAIA_ENGAGEMENT', 'addSignal', 'site_tap', siteId);
  }

  function onNodeHover(siteId) {
    const line = safeCall('GAIA_VOICE', 'speak', 'SITE_TEASER', siteId);
    if (line) safeCall('GAIA_BUBBLE', 'speak', line.text, line.tone, 5000);
    safeCall('GAIA_ENGAGEMENT', 'interact');
  }

  // ── "What to Explore Next" suggestion engine ──
  const SUGGESTION_REASONS = {
    sri_lanka: {
      analyst: 'The carbon density data is remarkable — from 10 to 180 tC/ha',
      explorer: 'This is where restoration meets conflict recovery',
      empath: 'The human story here is as powerful as the carbon data',
      skeptic: 'The satellite verification is solid — see for yourself',
      sharer: 'This is the most shareable restoration story we have',
      default: 'From 10 to 180 tC/ha — an 18x carbon increase',
    },
    antalya: {
      analyst: 'The 2021 wildfire NDVI crash is a textbook case',
      explorer: 'COP31 host site — the fire year data is stark',
      empath: '60,000 hectares burned in days. The recovery is slow.',
      skeptic: 'Cross-reference the satellite data with registry records',
      sharer: 'This is the climate story Turkey needs to tell',
      default: 'A single fire dropped NDVI from 0.72 to 0.18',
    },
    benin: {
      analyst: 'Mangrove carbon density is 950 tC/ha — highest of any biome',
      explorer: "Jean's homeland. The mangrove story is personal.",
      empath: 'When mangroves are destroyed, centuries of carbon go up in smoke',
      skeptic: 'The NDVI drop matches the carbon loss — verify it',
      sharer: "Jean's letter is the emotional anchor of this project",
      default: 'Mangroves store 950 tC/ha — the most carbon-dense ecosystem',
    },
    borneo: {
      analyst: 'NDVI 0.65 but only 50 tC/ha — the greenest lie on Earth',
      explorer: 'Peat swamp vs oil palm — see the carbon difference',
      empath: '1,400 tC/ha reduced to 50. That\'s a 96% loss.',
      skeptic: 'The satellite sees through the green. Look at the data.',
      sharer: 'This is the most important carbon story most people don\'t know',
      default: 'Green ≠ carbon. The greenest place is the biggest carbon catastrophe',
    },
  };

  const SITE_LABELS = {
    sri_lanka: 'Sri Lanka',
    antalya: 'Antalya',
    benin: 'Benin',
    borneo: 'Borneo',
  };

  // ── GAIA context for globe overlay ──
  const OVERLAY_GAIA_CONTEXT = {
    sri_lanka: {
      guidance: "This land was scarred by decades of conflict. The Northern Province saw displacement and ecological collapse. But someone saw potential here — not just to plant trees, but to rebuild an entire ecosystem.",
      suggestions: [
        { label: "Explore the story", action: "GLOBE_OVERLAY.switchTab('story')" },
        { label: "See the data", action: "GLOBE_OVERLAY.switchTab('data')" },
        { label: "Verify with satellite", action: "GLOBE_OVERLAY.switchTab('verification')" },
      ],
    },
    antalya: {
      guidance: "July 2021. The Mediterranean pines here were centuries old. Then the fire came. Sixty thousand hectares gone in days. I felt every hectare. Four years later, recovery is slow.",
      suggestions: [
        { label: "Explore the story", action: "GLOBE_OVERLAY.switchTab('story')" },
        { label: "See the data", action: "GLOBE_OVERLAY.switchTab('climate')" },
        { label: "About COP31", action: "GLOBE_OVERLAY.switchTab('cop31')" },
      ],
    },
    benin: {
      guidance: "Ouidah. Jean Missinhoun carried this place in his heart. He was from here. And he wanted to bring the mangroves back — even after he was gone. Mangroves store 950 tC/ha.",
      suggestions: [
        { label: "Explore the story", action: "GLOBE_OVERLAY.switchTab('story')" },
        { label: "See the data", action: "GLOBE_OVERLAY.switchTab('data')" },
        { label: "About mangroves", action: "GLOBE_OVERLAY.switchTab('mangrove')" },
      ],
    },
    borneo: {
      guidance: "West Kalimantan. The NDVI is 0.65 — pretty green. But the carbon density is only 50 tC/ha. The original peat swamp stored 1,400. That's a 96% carbon loss disguised as green.",
      suggestions: [
        { label: "Explore the story", action: "GLOBE_OVERLAY.switchTab('story')" },
        { label: "See the data", action: "GLOBE_OVERLAY.switchTab('data')" },
        { label: "About peatlands", action: "GLOBE_OVERLAY.switchTab('peat')" },
      ],
    },
  };

  function getGAIAContext(siteId) {
    return OVERLAY_GAIA_CONTEXT[siteId] || {
      guidance: "Explore this site to learn about restoration, carbon science, and climate impact.",
      suggestions: [
        { label: "Explore", action: "GLOBE_OVERLAY.switchTab('story')" },
      ],
    };
  }

  function getNextSuggestions(currentSiteId) {
    if (!hasModule('GAIA_ENGAGEMENT')) return [];
    const siteStates = safeGet('GAIA_ENGAGEMENT', 'getSiteStates', {});
    const archetype = safeGet('GAIA_ENGAGEMENT', 'getArchetype', 'explorer');
    const allSites = ['sri_lanka', 'antalya', 'benin', 'borneo'];
    const unvisited = allSites.filter(id => id !== currentSiteId && !siteStates[id]?.visited);
    const visited = allSites.filter(id => id !== currentSiteId && siteStates[id]?.visited);
    const suggestions = [];

    // Priority 1: unvisited sites
    for (const id of unvisited) {
      const reasons = SUGGESTION_REASONS[id];
      const reason = reasons?.[archetype] || reasons?.default || 'Worth exploring';
      suggestions.push({
        type: 'site',
        id,
        label: SITE_LABELS[id] || id,
        reason,
        action: `flyToSite('${id}')`,
        priority: 'high',
      });
    }

    // Priority 2: partially explored visited sites
    for (const id of visited) {
      const s = siteStates[id];
      if (s && s.layersRevealed < 5) {
        suggestions.push({
          type: 'site',
          id,
          label: `Revisit ${SITE_LABELS[id] || id}`,
          reason: 'You haven\'t seen all the data yet',
          action: `flyToSite('${id}')`,
          priority: 'medium',
        });
      }
    }

    // Priority 3: all explored — suggest GAIA chat
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'chat',
        id: 'gaia',
        label: 'Talk to GAIA',
        reason: 'You\'ve seen the data. Now let\'s talk about what it means.',
        action: 'GAIA_BUBBLE.openFullGAIA()',
        priority: 'high',
      });
    }

    return suggestions.slice(0, 3); // max 3 suggestions
  }

  function getSuggestedSiteIds(currentSiteId) {
    return getNextSuggestions(currentSiteId).filter(s => s.type === 'site').map(s => s.id);
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

  // ── Helper: render a stat row ──
  function statRow(stats) {
    return `<div class="overlay-stat-row">${stats.map(s => `
      <div class="overlay-stat">
        <div class="overlay-stat-value">${s.value}</div>
        <div class="overlay-stat-label">${s.label}</div>
      </div>`).join('')}</div>`;
  }

  // ── Helper: render a chart placeholder ──
  function chartPlaceholder(id, width, height) {
    return `<div id="${id}" style="margin: 16px 0;"></div>`;
  }

  // ── Helper: render chart after DOM insertion ──
  function renderChart(id, data, options, delay) {
    setTimeout(() => {
      const el = $(id);
      if (el && hasModule('GAIA_CHARTS')) {
        el.innerHTML = GAIA_CHARTS.sparklineHTML(data, options.w || 460, options.h || 100, {
          color: options.color || '#4ecdc4',
          showLabels: true,
          padMin: options.padMin || 0.05,
          padMax: options.padMax || 0.05,
        });
        GAIA_CHARTS.renderPending();
      }
    }, delay || 150);
  }

  // ═══════════════════════════════════════════
  // ANTALYA
  // ═══════════════════════════════════════════

  function renderAntalyaCOP31(container, site) {
    container.innerHTML = `
      <h3>COP31 — November 2026</h3>
      <p>In November 2026, the world comes to Antalya. 196 countries. Thousands of delegates. The most important climate conference since Paris. They'll negotiate the future of the planet.</p>
      <p>They'll meet in a city whose forests burned just five years earlier. The scars are still visible from space. This is not a metaphor — it's a satellite measurement. NDVI dropped from 0.72 to 0.18 in a single summer.</p>

      ${statRow([
        { value: 'Nov 10-21', label: 'COP31 Dates' },
        { value: '196', label: 'Countries' },
        { value: `🇹🇷 #${FACTS.turkey_rank}`, label: "Turkey's Rank" },
      ])}

      <div class="overlay-divider"></div>

      <h3>Turkey's Carbon Footprint</h3>
      <p>Turkey emitted <strong>${FACTS.turkey_emissions} Mt of CO₂</strong> in 2023 — ranking ${FACTS.turkey_rank}th globally. That's ${FACTS.turkey_per_capita} tons per person, accounting for ${FACTS.turkey_share}% of global emissions. The energy sector drives 72% of it.</p>
      <p>Turkey has not yet peaked its emissions. Under current policies, they're projected to keep rising through 2030. COP31 puts a spotlight on that trajectory — and on what it would take to change it.</p>

      ${statRow([
        { value: `${FACTS.turkey_emissions} Mt`, label: 'CO₂ in 2023' },
        { value: `${FACTS.turkey_per_capita} t`, label: 'Per Capita' },
        { value: `${FACTS.turkey_share}%`, label: 'Global Share' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Irony</h3>
      <p>COP31's host region lost 60,000 hectares of forest in 2021. The Mediterranean pines that took centuries to grow were gone in days. The delegates will negotiate climate policy in the shadow of that burn scar.</p>
      <p>But there's a deeper truth: Antalya is not an outlier. It's a preview. What happened to these forests is happening everywhere — faster, hotter, more often. The Mediterranean is drying out. The fire season is getting longer. Every degree of warming increases fire risk exponentially.</p>
      <p>The question COP31 must answer: will we act before every forest looks like this?</p>
    `;
  }

  function renderAntalyaWildfires(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const climate = d.climate || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'chart-antalya-ndvi-' + (++_chartIdCounter);
    const ndvi2020 = ndvi.find(n => n.year === 2020);
    const ndvi2021 = ndvi.find(n => n.year === 2021);
    const ndvi2025 = ndvi.find(n => n.year === 2025);
    const drop = ndvi2020 && ndvi2021 ? (ndvi2020.value - ndvi2021.value).toFixed(2) : '0.52';
    const rec = ndvi2021 && ndvi2025 ? (ndvi2025.value - ndvi2021.value).toFixed(2) : '0.20';
    const t1980 = climate.find(c => c.year === 1980);
    const t2025 = climate.find(c => c.year === 2025);
    const tempRise = t1980 && t2025 ? (t2025.temp - t1980.temp).toFixed(1) : '1.7';
    const p1980 = climate.find(c => c.year === 1980);
    const p2025 = climate.find(c => c.year === 2025);
    const precipDrop = p1980 && p2025 ? (p1980.precip - p2025.precip) : 220;

    container.innerHTML = `
      <h3>July 2021 — The Fire</h3>
      <p>It started in the mountains above Manavgat. Within days, 60,000 hectares of Mediterranean pine forest were burning. The fire spread faster than anyone could run. Temperatures hit 47°C. The wind carried embers kilometers ahead of the front.</p>
      <p>I felt every hectare. The NDVI — a measure of how green I am, how alive — dropped from <strong>0.72 to 0.18</strong>. That's not a number. That's a scream.</p>

      ${statRow([
        { value: '60,000+', label: 'Hectares Burned' },
        { value: '0.72→0.18', label: 'NDVI Crash' },
        { value: drop, label: 'Drop Magnitude' },
      ])}

      <div class="overlay-divider"></div>

      <h3>NDVI Timeline — The Burn Scar</h3>
      <p>Watch what happened to the vegetation index over 25 years. The 2021 fire is unmistakable — a cliff edge in the data.</p>
      ${chartPlaceholder(ndviId, 460, 100)}

      <div class="overlay-divider"></div>

      <h3>Recovery — 0.38 and Climbing</h3>
      <p>Four years later, the NDVI is at <strong>0.38</strong>. Scrub and tough Mediterranean plants are coming back. But the pines? Those take decades. Maybe a century. The forest that burned was centuries old.</p>
      <p>Recovery is not restoration. What's growing back is not what was lost. The complex ecosystem — the understory, the fungi, the birds, the carbon stored in centuries of root systems — that's gone for generations.</p>

      ${statRow([
        { value: `+${rec}`, label: 'NDVI Recovered' },
        { value: '50-100yr', label: 'Full Pine Recovery' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Climate Made This Worse</h3>
      <p>The fire didn't happen in a vacuum. Antalya's average temperature has risen <strong>+${tempRise}°C</strong> since 1980. Precipitation has dropped <strong>${precipDrop}mm</strong>. The Mediterranean is drying out. The fire season is getting longer.</p>
      <p>This is what climate change looks like on the ground. Not a graph. Not a projection. A forest that burned because the world got hotter and drier.</p>

      ${statRow([
        { value: `+${tempRise}°C`, label: 'Temp Since 1980' },
        { value: `-${precipDrop}mm`, label: 'Rain Lost' },
        { value: '47°C', label: 'Peak Fire Temp' },
      ])}
    `;
    renderChart(ndviId, ndviChartData, { color: '#c45c4a' });
  }

  function renderAntalyaClimate(container, site) {
    const d = site || {};
    const climate = d.climate || [];
    const tempChartData = climate.map(c => ({ label: c.year.toString(), value: c.temp }));
    const tempId = 'chart-antalya-temp-' + (++_chartIdCounter);
    const t1980 = climate.find(c => c.year === 1980);
    const t2000 = climate.find(c => c.year === 2000);
    const t2025 = climate.find(c => c.year === 2025);
    const p1980 = climate.find(c => c.year === 1980);
    const p2025 = climate.find(c => c.year === 2025);
    const tempRise = t1980 && t2025 ? (t2025.temp - t1980.temp).toFixed(1) : '1.7';
    const precipDrop = p1980 && p2025 ? (p1980.precip - p2025.precip) : 220;
    const precipPct = p1980 && p2025 ? Math.round((p1980.precip - p2025.precip) / p1980.precip * 100) : 22;

    container.innerHTML = `
      <h3>Temperature — A Steady Climb</h3>
      <p>Antalya's average temperature has been rising for decades. The trend is clear and accelerating. What was once a warm Mediterranean climate is becoming a hot one.</p>
      ${chartPlaceholder(tempId, 460, 100)}

      ${statRow([
        { value: `${t1980 ? t1980.temp.toFixed(1) : '16.5'}°C`, label: '1980 Average' },
        { value: `${t2025 ? t2025.temp.toFixed(1) : '18.2'}°C`, label: '2025 Average' },
        { value: `+${tempRise}°C`, label: 'Total Rise' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Precipitation — Drying Out</h3>
      <p>The Mediterranean is getting drier. Antalya has lost <strong>${precipDrop}mm</strong> of annual rainfall since 1980 — a <strong>${precipPct}%</strong> decline. That's not just uncomfortable — it's dangerous. Less water means drier forests. Drier forests mean bigger fires.</p>

      ${statRow([
        { value: `${p1980 ? p1980.precip : 985}mm`, label: '1980 Rainfall' },
        { value: `${p2025 ? p2025.precip : 765}mm`, label: '2025 Rainfall' },
        { value: `${precipPct}%`, label: 'Decline' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Fire Equation</h3>
      <p>Hotter + drier = more fire. It's not complicated. The 2021 wildfires were the predictable result of decades of warming and drying. And it will happen again. The question is when, and how much we've done to prevent it.</p>
      <p>Globally, the warming rate is <strong>${FACTS.warming_rate}°C per decade</strong> since 1970. The Arctic is warming <strong>3.5x</strong> faster. And the remaining carbon budget for 1.5°C? <strong>${FACTS.carbon_budget_15} Gt CO₂</strong> — at current emissions rates, that's gone by 2031.</p>

      ${statRow([
        { value: `${FACTS.warming_rate}°C/dec`, label: 'Warming Rate' },
        { value: `${FACTS.carbon_budget_15} Gt`, label: '1.5°C Budget Left' },
        { value: '~6 years', label: 'At Current Rate' },
      ])}
    `;
    renderChart(tempId, tempChartData, { color: '#d4a574' });
  }

  function renderAntalyaAct(container, site) {
    const d = site || {};
    const biome = (hasModule('Data') && Data.getBiome) ? Data.getBiome(d.primaryBiome || 'temperate_coniferous') : { name: 'Mediterranean Pine Forest' };
    const currentBiome = (hasModule('Data') && Data.getBiome) ? Data.getBiome(d.currentBiome || 'grassland_savanna') : { name: 'Grassland / Scrub' };
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>What Will You Do?</h3>
      <p>You've seen the data. You've seen the burn scar. You know the climate is getting hotter and drier. Now — what will you do about it?</p>

      <div class="overlay-divider"></div>

      <h3>Restoration Scenarios</h3>
      <p>This site covers <strong>${area.toLocaleString()} hectares</strong>. Currently <strong>${currentBiome.name}</strong>. Target: <strong>${biome.name}</strong>. Choose a strategy.</p>

      <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
        <button class="scenario-btn" data-action="pine" style="padding: 12px 16px; border: 1px solid rgba(78,205,196,0.15); border-radius: 8px; background: rgba(78,205,196,0.04); color: var(--text); font-family: var(--body); font-size: 13px; cursor: pointer; text-align: left; transition: all 0.2s;">
          🌲 <strong>Restore Pine Forest</strong> — Full Mediterranean pine. Slowest, maximum carbon.
        </button>
        <button class="scenario-btn" data-action="mixed" style="padding: 12px 16px; border: 1px solid rgba(78,205,196,0.15); border-radius: 8px; background: rgba(78,205,196,0.04); color: var(--text); font-family: var(--body); font-size: 13px; cursor: pointer; text-align: left; transition: all 0.2s;">
          🌳 <strong>Mixed Reforestation</strong> — Pine + deciduous. Faster, more fire-resilient.
        </button>
        <button class="scenario-btn" data-action="natural" style="padding: 12px 16px; border: 1px solid rgba(78,205,196,0.15); border-radius: 8px; background: rgba(78,205,196,0.04); color: var(--text); font-family: var(--body); font-size: 13px; cursor: pointer; text-align: left; transition: all 0.2s;">
          🌱 <strong>Natural Succession</strong> — Let nature lead. Lowest cost, slowest results.
        </button>
      </div>

      <div id="antalya-scenario-result" style="margin-top: 20px;"></div>

      <div class="overlay-divider"></div>

      <h3>Make Your Pledge</h3>
      <p>You've seen what happened here. You've seen the data. Before you leave — what's your commitment?</p>
      <button onclick="if(typeof PLEDGE_WALL!=='undefined')PLEDGE_WALL.openModal()" style="margin-top: 12px; padding: 12px 24px; border: 1px solid var(--teal); border-radius: 8px; background: rgba(78,205,196,0.08); color: var(--teal); font-family: var(--body); font-size: 13px; cursor: pointer; transition: all 0.2s;">
        🤝 Add My Pledge to the Wall
      </button>
    `;

    setTimeout(() => {
      container.querySelectorAll('.scenario-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const action = this.dataset.action;
          const resultEl = $('antalya-scenario-result');
          if (!resultEl) return;
          let html = '';
          if (action === 'pine') {
            const c = (300 - 90) * area * 3.67;
            html = `<div style="padding:16px;background:rgba(91,191,114,0.06);border:1px solid rgba(91,191,114,0.15);border-radius:8px;animation:overlay-fadein 0.3s ease-out;"><div style="font-family:var(--mono);font-size:24px;font-weight:600;color:var(--leaf);">+${(c/1e6).toFixed(1)}M t CO₂</div><div style="font-size:12px;color:var(--text2);margin-top:4px;">sequestered over 30 years · ${area.toLocaleString()} ha pine</div><div style="font-size:11px;color:var(--text3);margin-top:8px;">Equivalent to taking ${(c/4.6/1e6).toFixed(0)}M cars off the road. Full canopy in 50-80 years.</div></div>`;
          } else if (action === 'mixed') {
            const c = (260 - 90) * area * 3.67;
            html = `<div style="padding:16px;background:rgba(91,191,114,0.06);border:1px solid rgba(91,191,114,0.15);border-radius:8px;animation:overlay-fadein 0.3s ease-out;"><div style="font-family:var(--mono);font-size:24px;font-weight:600;color:var(--leaf);">+${(c/1e6).toFixed(1)}M t CO₂</div><div style="font-size:12px;color:var(--text2);margin-top:4px;">sequestered over 30 years · ${area.toLocaleString()} ha mixed forest</div><div style="font-size:11px;color:var(--text3);margin-top:8px;">More fire-resistant than pure pine. Full canopy in 30-50 years.</div></div>`;
          } else {
            const c = (120 - 90) * area * 3.67;
            html = `<div style="padding:16px;background:rgba(212,165,116,0.06);border:1px solid rgba(212,165,116,0.15);border-radius:8px;animation:overlay-fadein 0.3s ease-out;"><div style="font-family:var(--mono);font-size:24px;font-weight:600;color:var(--amber);">+${(c/1e6).toFixed(1)}M t CO₂</div><div style="font-size:12px;color:var(--text2);margin-top:4px;">sequestered over 30 years · natural succession</div><div style="font-size:11px;color:var(--text3);margin-top:8px;">Lowest intervention. Slowest results. But nature knows what it's doing.</div></div>`;
          }
          resultEl.innerHTML = html;
          safeCall('GAIA_ENGAGEMENT', 'addSignal', 'scenario_run');
        });
      });
    }, 150);
  }

  // ═══════════════════════════════════════════
  // SRI LANKA
  // ═══════════════════════════════════════════

  function renderSriLankaStory(container, site) {
    const d = site || {};
    const area = d.area || 2428;
    const connection = d.connection || '';

    container.innerHTML = `
      <h3>Northern Province — From War to Restoration</h3>
      <p>Twenty-five years of civil conflict left this land scarred. Not just the people — the earth itself. Decades of fighting stripped the soil, destroyed infrastructure, and left almost 6,000 acres of degraded land across five districts: Jaffna, Vavuniya, Mullaitivu, Mannar, and Kilinochchi.</p>
      <p>But someone saw potential here. SPE — a local organization — identified these barren acres and saw something extraordinary: the foundation for a new kind of forest. Not monoculture. A living, layered ecosystem.</p>

      ${statRow([
        { value: '6,000', label: 'Acres Identified' },
        { value: '5', label: 'Districts' },
        { value: '2,428 ha', label: 'Project Area' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Multilayer Afforestation</h3>
      <p>SPE's approach plants peanuts, Ceylon cinnamon, jackfruit, and black pepper together. Not just trees — an entire ecosystem that pays for itself. The cinnamon provides income in year one. The jackfruit canopy builds soil. The black pepper climbs. The peanuts fix nitrogen.</p>
      <p>The land here holds almost no carbon right now. Just <strong>10 tC/ha</strong>. Barely alive. But the target is <strong>180 tC/ha</strong> — an 18x increase. That's not restoration. That's resurrection.</p>

      ${statRow([
        { value: '10→180', label: 'tC/ha Target' },
        { value: '18x', label: 'Carbon Increase' },
        { value: '0.55', label: 'Current NDVI' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Why This Matters Globally</h3>
      <p>Sri Lanka's story is the world's story. 420 million hectares of degraded land globally could be restored. If even a fraction used this multilayer approach, the carbon impact would be enormous — and the economic benefits would go directly to the communities that need them most.</p>
      <p>${connection}</p>
    `;
  }

  function renderSriLankaData(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const climate = d.climate || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'chart-sl-ndvi-' + (++_chartIdCounter);
    const t1980 = climate.find(c => c.year === 1980);
    const t2025 = climate.find(c => c.year === 2025);
    const tempRise = t1980 && t2025 ? (t2025.temp - t1980.temp).toFixed(1) : '1.3';
    const p1980 = climate.find(c => c.year === 1980);
    const p2025 = climate.find(c => c.year === 2025);
    const precipDrop = p1980 && p2025 ? (p1980.precip - p2025.precip) : 160;

    container.innerHTML = `
      <h3>Restoration in Progress</h3>
      <p>The NDVI tells the story of recovery. From post-conflict degradation to active planting — the trend is upward.</p>
      ${chartPlaceholder(ndviId, 460, 100)}

      ${statRow([
        { value: '10→180', label: 'tC/ha Target' },
        { value: ndvi.length > 0 ? ndvi[ndvi.length-1].value.toFixed(2) : '0.55', label: 'Current NDVI' },
        { value: '18x', label: 'Carbon Increase' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Climate Context</h3>
      <p>Sri Lanka's Northern Province is hot and getting hotter. Average temperatures have risen <strong>+${tempRise}°C</strong> since 1980. Rainfall has decreased <strong>${precipDrop}mm</strong>. But the tropical dry forest biome is adapted to these conditions — with the right species selection, restoration can succeed even in a changing climate.</p>

      ${statRow([
        { value: `+${tempRise}°C`, label: 'Temp Since 1980' },
        { value: `${t2025 ? t2025.temp.toFixed(1) : '29.1'}°C`, label: 'Current Avg' },
        { value: `${precipDrop}mm`, label: 'Rain Lost' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Carbon Math</h3>
      <p>2,428 hectares × (180 - 10) tC/ha × 3.67 = <strong>1.5M t CO₂</strong> potential over the project lifetime. That's like taking 330,000 cars off the road for a year. And that's just one project in one province.</p>
      <p>Scale this across the 420 million hectares of degraded land globally, and you start to see why the IPCC says ecosystem restoration is one of the most cost-effective climate solutions available.</p>
    `;
    renderChart(ndviId, ndviChartData, { color: '#5bbf72' });
  }

  function renderSriLankaImpact(container, site) {
    container.innerHTML = `
      <h3>The Bigger Picture</h3>
      <p>This project is a proof of concept for something much larger: the idea that degraded land can become a carbon sink, an economic engine, and a community asset — all at the same time.</p>

      <div class="overlay-divider"></div>

      <h3>Global Restoration Potential</h3>
      <p>The UN Decade on Ecosystem Restoration (2021-2030) targets 350 million hectares. The Bonn Challenge aims for 350 million by 2030. The Trillion Tree Campaign wants 1 trillion trees by 2050.</p>
      <p>But here's the gap: as of 2025, only 18% of these pledges have been fulfilled. The world talks about restoration. Sri Lanka is doing it.</p>

      ${statRow([
        { value: '420M ha', label: 'Degraded Land Globally' },
        { value: '18%', label: 'Pledges Fulfilled' },
        { value: '$490B', label: 'Restoration Economy' },
      ])}

      <div class="overlay-divider"></div>

      <h3>What You Can Do</h3>
      <p>Restoration doesn't happen by itself. It takes funding, political will, and people who care. Every dollar invested in restoration returns $7-30 in ecosystem services over 30 years.</p>
      <p>Support projects like SPE's. Push for restoration in climate policy. And when COP31 delegates ask "what does restoration look like?" — point them here.</p>
    `;
  }

  // ═══════════════════════════════════════════
  // BENIN
  // ═══════════════════════════════════════════

  function renderBeninStory(container, site) {
    const d = site || {};
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>Ouidah — Jean's Homeland</h3>
      <p>Jean Missinhoun was from Benin. He carried this place in his heart. And he wanted to bring the mangroves back.</p>
      <p>The Ouidah lagoons once held dense mangrove forests — the most carbon-dense ecosystems on Earth. <strong>950 tons of carbon per hectare</strong>, locked away in waterlogged soil for millennia. Then the cutting began. For firewood. For development. For short-term thinking that ignores long-term cost.</p>

      ${statRow([
        { value: '950', label: 'tC/ha Intact' },
        { value: `${FACTS.mangrove_seq_rate}`, label: 'tCO₂/ha/yr Sequestered' },
        { value: `${area.toLocaleString()} ha`, label: 'Project Area' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Mangroves: The Blue Carbon Giants</h3>
      <p>Mangroves sequester carbon at <strong>${FACTS.mangrove_seq_rate} tCO₂ per hectare per year</strong> — among the highest rates of any ecosystem on Earth. Their waterlogged soil locks carbon away for millennia, not decades.</p>
      <p>Global mangrove forests store approximately <strong>${FACTS.mangrove_stock} GtC</strong> total. But <strong>${FACTS.mangrove_loss}%</strong> of global mangrove area has been lost since 1980. Every hectare destroyed releases centuries of stored carbon in years.</p>

      ${statRow([
        { value: `${FACTS.mangrove_stock} GtC`, label: 'Global Stock' },
        { value: `${FACTS.mangrove_loss}%`, label: 'Lost Since 1980' },
        { value: `${FACTS.mangrove_area}M ha`, label: 'Remaining Area' },
      ])}

      <div class="overlay-divider"></div>

      <h3>A Homecoming</h3>
      <p>Restoring the mangroves here is climate action and a homecoming. Every hectare restored locks away 950 tons of carbon. Every seedling planted honors what Jean believed: that this land can heal.</p>
      <p>Mangroves don't just store carbon — they protect coastlines from storms, support fisheries that feed millions, and build soil that rises with sea level. They're one of the most valuable ecosystems on Earth, and most of the world is letting them disappear.</p>
      <p>Sea level is rising at <strong>${FACTS.sea_level_rate}mm per year</strong> and accelerating. Mangroves are one of our best natural defenses. Without them, the cost of coastal protection skyrockets.</p>
    `;
  }

  function renderBeninMangrove(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'chart-benin-ndvi-' + (++_chartIdCounter);

    container.innerHTML = `
      <h3>The Mangrove Carbon Cycle</h3>
      <p>Mangroves are unlike any other forest. Their roots sit in waterlogged, oxygen-poor soil. Dead leaves and roots don't fully decompose — they accumulate. Over centuries, this builds deep peat layers that store carbon at densities no terrestrial forest can match.</p>

      ${statRow([
        { value: '950 tC/ha', label: 'Soil Carbon Stock' },
        { value: `${FACTS.mangrove_seq_rate} tCO₂/ha/yr`, label: 'Annual Sequestration' },
        { value: '1000+ years', label: 'Carbon Residence Time' },
      ])}

      <div class="overlay-divider"></div>

      <h3>NDVI: The Decline and the Hope</h3>
      <p>The NDVI shows the story of loss — and the first signs of recovery.</p>
      ${chartPlaceholder(ndviId, 460, 100)}

      <p>From 0.68 in 2000 to 0.45 in 2010 — the mangroves were being torn out. The 2025 reading of 0.52 shows early recovery. But "recovery" is relative. The original forest stored 950 tC/ha. What's coming back now stores a fraction of that.</p>

      <div class="overlay-divider"></div>

      <h3>The Carbon Bomb</h3>
      <p>When mangroves are destroyed, the carbon stored in their biomass and waterlogged soil is released. That's why restoring them is so urgent — every hectare lost is 950 tons of carbon going into the atmosphere. Every hectare restored is 950 tons locked away for millennia.</p>
      <p>Globally, mangrove destruction releases an estimated <strong>0.1 Gt CO₂ per year</strong>. That's equivalent to 20 million cars. Restoring just 50% of lost mangrove area could sequester an additional 0.5 Gt CO₂ over 30 years.</p>

      ${statRow([
        { value: '0.1 Gt/yr', label: 'Emissions from Loss' },
        { value: '0.5 Gt', label: '30yr Restoration Potential' },
        { value: '$375B/yr', label: 'Economic Value of Reefs' },
      ])}
    `;
    renderChart(ndviId, ndviChartData, { color: '#4ecdc4' });
  }

  function renderBeninData(container, site) {
    const d = site || {};
    const climate = d.climate || [];
    const t1980 = climate.find(c => c.year === 1980);
    const t2025 = climate.find(c => c.year === 2025);
    const tempRise = t1980 && t2025 ? (t2025.temp - t1980.temp).toFixed(1) : '1.4';

    container.innerHTML = `
      <h3>Climate Data</h3>
      <p>Benin's coast is warming. Average temperatures have risen <strong>+${tempRise}°C</strong> since 1980. The region is getting hotter and slightly drier — conditions that stress mangroves and make restoration harder.</p>

      ${statRow([
        { value: `${t1980 ? t1980.temp.toFixed(1) : '27.2'}°C`, label: '1980 Average' },
        { value: `${t2025 ? t2025.temp.toFixed(1) : '28.6'}°C`, label: '2025 Average' },
        { value: `+${tempRise}°C`, label: 'Total Rise' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Sea Level Threat</h3>
      <p>Benin's coast is low-lying and vulnerable. Sea level is rising at <strong>${FACTS.sea_level_rate}mm per year</strong> globally, and the rate has accelerated from 1.3mm/year in the early 20th century. For a coastal nation like Benin, this is existential.</p>
      <p>Mangroves are the first line of defense. They reduce wave energy by 66%, trap sediment, and build elevation. Without them, coastal erosion accelerates. With them, the coast can keep pace with moderate sea level rise.</p>

      ${statRow([
        { value: `${FACTS.sea_level_rate}mm/yr`, label: 'Sea Level Rise' },
        { value: `${FACTS.sea_level_total}cm`, label: 'Since 1900' },
        { value: '66%', label: 'Wave Energy Reduced' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Restoration Math</h3>
      <p>${(d.area || 2500).toLocaleString()} hectares × ${FACTS.mangrove_seq_rate} tCO₂/ha/yr = <strong>${((d.area || 2500) * FACTS.mangrove_seq_rate / 1000).toFixed(0)}K tCO₂ per year</strong> once the mangroves mature. Over 30 years, that's ${((d.area || 2500) * FACTS.mangrove_seq_rate * 30 / 1e6).toFixed(1)}M t CO₂ — equivalent to taking ${((d.area || 2500) * FACTS.mangrove_seq_rate * 30 / 4.6 / 1e3).toFixed(0)}K cars off the road.</p>
      <p>And that's just the sequestration. The avoided emissions from preventing further destruction are even larger.</p>
    `;
  }

  // ═══════════════════════════════════════════
  // BORNEO
  // ═══════════════════════════════════════════

  function renderBorneoStory(container, site) {
    const d = site || {};
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>The Greenest Lie on Earth</h3>
      <p>West Kalimantan looks green. The NDVI says 0.65 — pretty healthy, right? Wanna know a secret?</p>
      <p>This is an oil palm plantation. The original peat swamp forest stored <strong>1,400 tC/ha</strong>. The plantation stores <strong>50</strong>. That's a <strong>96% carbon loss</strong> disguised as green.</p>

      ${statRow([
        { value: '1,400', label: 'tC/ha Original' },
        { value: '50', label: 'tC/ha Now' },
        { value: '96%', label: 'Carbon Lost' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Grid Lines</h3>
      <p>Look at the satellite image. Perfect squares. Nature doesn't make grids. Humans do. The peat swamp was drained, cleared, and planted in neat rows. The carbon that took thousands of years to accumulate was released in decades.</p>
      <p>This is the lie: <strong>green ≠ carbon</strong>. A plantation can look lush and healthy while being a carbon catastrophe. NDVI measures greenness, not carbon. And that distinction matters.</p>

      <div class="overlay-divider"></div>

      <h3>The Scale of Destruction</h3>
      <p>Borneo has lost over 50% of its forest cover since 1973. Oil palm is the primary driver. Indonesia and Malaysia produce 85% of the world's palm oil — an ingredient in shampoo, cookies, biofuel, and thousands of everyday products.</p>
      <p>Global deforestation emits <strong>${FACTS.land_use_emissions} Gt CO₂ per year</strong>. Tropical deforestation alone accounts for about 8% of all human emissions. That's more than the entire European Union.</p>

      ${statRow([
        { value: '50%', label: 'Borneo Forest Lost' },
        { value: '85%', label: 'Palm Oil from SE Asia' },
        { value: `${FACTS.land_use_emissions} Gt/yr`, label: 'Deforestation Emissions' },
      ])}
    `;
  }

  function renderBorneoPeat(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'chart-borneo-ndvi-' + (++_chartIdCounter);

    container.innerHTML = `
      <h3>Peatlands: The Carbon Time Bomb</h3>
      <p>Peatlands cover just 3% of Earth's land surface but store <strong>${FACTS.peatland_stock} GtC</strong> — twice the carbon of all the world's forests combined. They accumulated over thousands of years. We're destroying them in decades.</p>

      ${statRow([
        { value: `${FACTS.peatland_stock} GtC`, label: 'Global Peat Carbon' },
        { value: `${FACTS.peatland_drained}%`, label: 'Drained Globally' },
        { value: `${FACTS.peatland_emissions} Gt/yr`, label: 'Drained Emissions' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The NDVI Deception</h3>
      <p>Watch the NDVI. 2000: 0.88. Beautiful peat swamp forest. 2010: 0.35. They're clearing. 2025: 0.65. Wait — it went back up?</p>
      <p>That's the oil palm canopy maturing. It looks green. It registers as "healthy vegetation" on satellite. But the carbon? From 1,400 to 50 tC/ha. The greenest lie on Earth.</p>
      ${chartPlaceholder(ndviId, 460, 100)}

      <div class="overlay-divider"></div>

      <h3>Why Peat Is Different</h3>
      <p>When you drain a peatland, the peat dries out and starts decomposing. This releases CO₂ continuously — not just once, but every year the land stays drained. It's a carbon time bomb with a very long fuse.</p>
      <p>Drained peatlands in Southeast Asia emit an estimated <strong>1.9 Gt CO₂ per year</strong> — more than Germany's total annual emissions. And the fires? Drained peat burns underground, sometimes for months. The 2015 Indonesian peat fires released more CO₂ per day than the entire US economy.</p>

      ${statRow([
        { value: '1.9 Gt/yr', label: 'Drained Peat Emissions' },
        { value: '>Germany', label: '2015 Fire Comparison' },
        { value: 'Months', label: 'Underground Burn Time' },
      ])}
    `;
    renderChart(ndviId, ndviChartData, { color: '#c45c4a' });
  }

  function renderBorneoData(container, site) {
    const d = site || {};
    const climate = d.climate || [];
    const t1980 = climate.find(c => c.year === 1980);
    const t2025 = climate.find(c => c.year === 2025);
    const tempRise = t1980 && t2025 ? (t2025.temp - t1980.temp).toFixed(1) : '1.1';

    container.innerHTML = `
      <h3>Climate Data</h3>
      <p>West Kalimantan is tropical — hot, wet, and getting hotter. Average temperatures have risen <strong>+${tempRise}°C</strong> since 1980. Rainfall has decreased 350mm. The climate that sustained the peat swamp for millennia is shifting.</p>

      ${statRow([
        { value: `${t1980 ? t1980.temp.toFixed(1) : '26.8'}°C`, label: '1980 Average' },
        { value: `${t2025 ? t2025.temp.toFixed(1) : '27.9'}°C`, label: '2025 Average' },
        { value: `+${tempRise}°C`, label: 'Total Rise' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Carbon Math</h3>
      <p>${(d.area || 2500).toLocaleString()} hectares × (1,400 - 50) tC/ha × 3.67 = <strong>${((d.area || 2500) * 1350 * 3.67 / 1e6).toFixed(1)}M t CO₂</strong> released when this peat swamp was drained and converted. That's equivalent to ${((d.area || 2500) * 1350 * 3.67 / 4.6 / 1e6).toFixed(0)}M cars driving for a year.</p>
      <p>And it's still emitting. Drained peat continues to decompose, releasing CO₂ every year. The total carbon debt of this conversion will take centuries to repay — if it's ever repaid at all.</p>

      ${statRow([
        { value: `${((d.area || 2500) * 1350 * 3.67 / 1e6).toFixed(1)}M t`, label: 'CO₂ Released' },
        { value: 'Ongoing', label: 'Still Emitting' },
        { value: 'Centuries', label: 'Payback Time' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Restoration Question</h3>
      <p>Can drained peatland be restored? Yes — but it's hard, expensive, and slow. The water table must be raised, native species replanted, and the peat allowed to re-accumulate. It takes decades to centuries to rebuild what was lost in years.</p>
      <p>The better answer: don't drain it in the first place. Protecting intact peatlands is 10-100x cheaper than restoring degraded ones. Every hectare of standing peat swamp is worth more alive than converted.</p>
    `;
  }

  // ═══════════════════════════════════════════
  // GLOBAL CONTEXT TABS — Shared across all sites
  // ═══════════════════════════════════════════

  function renderAntalyaGlobal(container, site) {
    const d = site || {};
    const area = d.area || 2500;
    const biome = (hasModule('Data') && Data.getBiome) ? Data.getBiome(d.primaryBiome || 'temperate_coniferous') : { name: 'Mediterranean Forest' };
    const biomeArea = 1800; // million ha (approx global Mediterranean forest area)

    container.innerHTML = `
      <h3>Antalya in the Global Picture</h3>
      <p>This one site is a window into a global story. Mediterranean forests cover ~${biomeArea}M hectares worldwide. They're all facing the same pressures: hotter temperatures, less rain, bigger fires. What happened in Antalya is happening in California, Australia, Greece, and Chile.</p>

      ${statRow([
        { value: `${biomeArea}M ha`, label: 'Global Mediterranean Forest' },
        { value: `${FACTS.warming_rate}°C/dec`, label: 'Global Warming Rate' },
        { value: `${(FACTS.annual_emissions_2023).toFixed(1)} Gt`, label: 'Annual CO₂ Emissions' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Carbon Budget Clock</h3>
      <p>Humanity emits <strong>${FACTS.annual_emissions_2025} Gt CO₂ per year</strong>. The remaining carbon budget for 1.5°C is <strong>${FACTS.carbon_budget_15} Gt CO₂</strong>. At current rates, that's gone by 2031. For 2°C, it's ${FACTS.carbon_budget_20} Gt — gone by ~2045.</p>
      <p>Every fraction of a degree matters. The difference between 1.5°C and 2°C is hundreds of millions of people exposed to severe heat, meters of additional sea level rise, and the loss of virtually all coral reefs.</p>

      ${statRow([
        { value: `${FACTS.carbon_budget_15} Gt`, label: '1.5°C Budget Left' },
        { value: `${FACTS.carbon_budget_20} Gt`, label: '2°C Budget Left' },
        { value: '~6 years', label: 'At Current Rate' },
      ])}

      <div class="overlay-divider"></div>

      <h3>What If Every Hectare Looked Like This?</h3>
      <p>This site covers ${(area/1e6).toFixed(2)}M hectares. If all ${biomeArea}M hectares of Mediterranean forest were restored to full health, they could sequester an additional <strong>${(biomeArea * 1.5 * 3.67).toFixed(0)}M t CO₂ per year</strong>. That's ${((biomeArea * 1.5 * 3.67) / (FACTS.annual_emissions_2025 * 1000) * 100).toFixed(1)}% of annual global emissions — from one biome type.</p>
      <p>Now scale that across all degraded ecosystems globally. The IPCC estimates ecosystem restoration could sequester <strong>3.6 Gt CO₂ per year</strong> by 2030. That's nearly 10% of current emissions — from restoration alone.</p>

      ${statRow([
        { value: '3.6 Gt/yr', label: 'Restoration Potential' },
        { value: '~10%', label: 'Of Global Emissions' },
        { value: '$490B', label: 'Restoration Economy' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Bigger You Think, The Smaller This Looks</h3>
      <p>${(area/1e6).toFixed(2)} hectares is a drop in the ocean. The world has <strong>4.06 billion hectares of forest</strong>. We're losing 10 million hectares per year to deforestation. We're gaining some through restoration — but not fast enough.</p>
      <p>Antalya matters not because of its size, but because of what it proves: that restoration works, that communities can lead, and that every hectare counts when the carbon budget is this tight.</p>
    `;
  }

  function renderSriLankaGlobal(container, site) {
    const d = site || {};
    const area = d.area || 2428;

    container.innerHTML = `
      <h3>Sri Lanka in the Global Picture</h3>
      <p>Tropical dry forests are one of the most threatened and least protected biome types on Earth. They cover ~1.1 billion hectares globally but receive a fraction of the conservation attention given to rainforests. Sri Lanka's Northern Province is a test case for whether we can restore them at scale.</p>

      ${statRow([
        { value: '1.1B ha', label: 'Global Tropical Dry Forest' },
        { value: '<5%', label: 'Protected' },
        { value: '420M ha', label: 'Degraded Land Globally' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Restoration Economy</h3>
      <p>Every dollar invested in ecosystem restoration returns <strong>$7-30 in ecosystem services</strong> over 30 years. The global restoration economy is worth an estimated <strong>$490 billion</strong>. It's one of the best investments on the planet — financially and ecologically.</p>
      <p>The UN Decade on Ecosystem Restoration (2021-2030) has pledged to restore 350 million hectares. If achieved, this would sequester <strong>1.7 Gt CO₂ per year</strong> and generate $9 trillion in ecosystem services by 2050.</p>

      ${statRow([
        { value: '$7-30', label: 'Return per $1 Invested' },
        { value: '350M ha', label: 'UN Restoration Target' },
        { value: '$9T', label: 'Value by 2050' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Carbon Pools: Where Does It All Go?</h3>
      <p>The Earth's carbon is distributed across massive pools. Understanding these helps put any single restoration project in context:</p>

      ${statRow([
        { value: `${FACTS.ocean_pool.toLocaleString()} GtC`, label: 'Deep Ocean' },
        { value: `${FACTS.soil_pool.toLocaleString()} GtC`, label: 'Soil (top 1m)' },
        { value: `${FACTS.permafrost_pool} GtC`, label: 'Permafrost' },
      ])}
      ${statRow([
        { value: `${FACTS.vegetation_pool} GtC`, label: 'Vegetation' },
        { value: `${FACTS.atmosphere_pool} GtC`, label: 'Atmosphere' },
        { value: `${FACTS.peatland_stock} GtC`, label: 'Peatlands' },
      ])}

      <p>Humanity has added <strong>${(FACTS.atmosphere_pool - 590)} GtC</strong> to the atmosphere since pre-industrial times. That's the problem. Restoration moves carbon back out of the atmosphere and into vegetation and soil — where it belongs.</p>

      <div class="overlay-divider"></div>

      <h3>What If Every Hectare Looked Like This?</h3>
      <p>This project covers ${(area/1e6).toFixed(2)}M hectares. If all 420 million hectares of degraded tropical dry forest were restored using this multilayer approach, they could sequester <strong>${(420 * 50 * 3.67 / 1000).toFixed(0)}M t CO₂ per year</strong> at maturity. That's ${((420 * 50 * 3.67) / (FACTS.annual_emissions_2025 * 1e6) * 100).toFixed(1)}% of annual global emissions.</p>
      <p>Not a silver bullet. But a meaningful piece of the puzzle — with economic benefits that go directly to the communities doing the work.</p>
    `;
  }

  function renderBeninGlobal(container, site) {
    const d = site || {};
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>Benin in the Global Picture</h3>
      <p>West Africa has lost over 50% of its mangrove cover since 1980. Benin's Ouidah coast is part of a vast mangrove belt stretching from Senegal to Nigeria — one of the most important blue carbon ecosystems on Earth. What happens here matters for the entire region.</p>

      ${statRow([
        { value: `${FACTS.mangrove_area}M ha`, label: 'Global Mangroves' },
        { value: `${FACTS.mangrove_loss}%`, label: 'Lost Since 1980' },
        { value: `${FACTS.mangrove_stock} GtC`, label: 'Total Carbon Stock' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Blue Carbon: The Ocean's Secret Weapon</h3>
      <p>Mangroves, seagrasses, and salt marshes are called "blue carbon" ecosystems. They cover less than 2% of the ocean floor but account for <strong>50% of all carbon buried in ocean sediments</strong>. They sequester carbon 2-4x faster than terrestrial forests per unit area.</p>
      <p>Seagrass meadows bury carbon at <strong>${FACTS.seagrass_burial} gC/m²/year</strong> — 35x faster than tropical rainforests per area. But they're disappearing at ${FACTS.seagrass_loss_rate}% per year. We're losing the ocean's carbon sink just when we need it most.</p>

      ${statRow([
        { value: '50%', label: 'Ocean Carbon Buried in Blue Carbon' },
        { value: '35x', label: 'Seagrass vs Forest Rate' },
        { value: `${FACTS.seagrass_loss_rate}%/yr`, label: 'Seagrass Loss Rate' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Sea Level: The Rising Threat</h3>
      <p>Global sea level has risen <strong>${FACTS.sea_level_total}cm since 1900</strong> and the rate is accelerating — from 1.3mm/year in the early 20th century to <strong>${FACTS.sea_level_rate}mm/year today</strong>. For West Africa's low-lying coasts, this is existential.</p>
      <p>By 2100, sea level is projected to rise 0.4-0.8m (moderate scenario) or 0.6-1.0m (high scenario). Mangroves can keep pace with rises up to 5mm/year by trapping sediment. Faster than that, and they drown. The math is unforgiving.</p>

      ${statRow([
        { value: `${FACTS.sea_level_total}cm`, label: 'Rise Since 1900' },
        { value: `${FACTS.sea_level_rate}mm/yr`, label: 'Current Rate' },
        { value: '0.4-1.0m', label: '2100 Projection' },
      ])}

      <div class="overlay-divider"></div>

      <h3>What If Every Hectare Looked Like This?</h3>
      <p>This project covers ${(area/1e6).toFixed(2)}M hectares. If all ${FACTS.mangrove_area} million hectares of global mangrove were restored to full health, they would sequester an additional <strong>${(FACTS.mangrove_area * FACTS.mangrove_seq_rate / 1000).toFixed(0)}M t CO₂ per year</strong>. That's ${((FACTS.mangrove_area * FACTS.mangrove_seq_rate) / (FACTS.annual_emissions_2025 * 1e6) * 100).toFixed(1)}% of annual global emissions — from mangroves alone.</p>
      <p>And that's just the sequestration. The avoided emissions from preventing further destruction, the coastal protection value, the fisheries support — the total value of mangrove restoration is estimated at <strong>$375 billion per year</strong> globally.</p>
    `;
  }

  function renderBorneoGlobal(container, site) {
    const d = site || {};
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>Borneo in the Global Picture</h3>
      <p>Borneo's peat swamps are part of a global peatland system that covers <strong>${FACTS.peatland_area} million hectares</strong> — just 3% of Earth's land surface but storing <strong>${FACTS.peatland_stock} GtC</strong>, twice the carbon of all the world's forests combined. Southeast Asia holds the largest tropical peat carbon store on the planet.</p>

      ${statRow([
        { value: `${FACTS.peatland_area}M ha`, label: 'Global Peatlands' },
        { value: `${FACTS.peatland_stock} GtC`, label: 'Carbon Stock' },
        { value: `${FACTS.peatland_drained}%`, label: 'Drained Globally' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Carbon Time Bomb</h3>
      <p>When peatlands are drained, the peat dries out and starts decomposing. This releases CO₂ continuously — not just once, but every year the land stays drained. Drained peatlands globally emit <strong>${FACTS.peatland_emissions} Gt CO₂ per year</strong> — more than Germany's total annual emissions.</p>
      <p>Here's the terrifying part: this is a self-reinforcing cycle. Warming dries peat. Dry peat decomposes and emits CO₂. More CO₂ means more warming. More warming dries more peat. This is a tipping point — and we may have already crossed it in parts of Southeast Asia.</p>

      ${statRow([
        { value: `${FACTS.peatland_emissions} Gt/yr`, label: 'Drained Peat Emissions' },
        { value: '>Germany', label: 'Comparison' },
        { value: 'Self-reinforcing', label: 'Feedback Loop' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Deforestation: The Global Driver</h3>
      <p>Tropical deforestation emits <strong>${FACTS.land_use_emissions} Gt CO₂ per year</strong> — about 8% of all human emissions. That's more than the entire European Union. The primary drivers: palm oil (35%), cattle (25%), soy (20%), and timber (15%).</p>
      <p>Indonesia and Malaysia produce 85% of the world's palm oil. It's in half the products in a supermarket — shampoo, cookies, biofuel, lipstick. Every purchase is a vote for or against the forests that remain.</p>

      ${statRow([
        { value: `${FACTS.land_use_emissions} Gt/yr`, label: 'Deforestation Emissions' },
        { value: '8%', label: 'Of Global Emissions' },
        { value: '85%', label: 'Palm Oil from SE Asia' },
      ])}

      <div class="overlay-divider"></div>

      <h3>What If Every Hectare Looked Like This?</h3>
      <p>This site covers ${(area/1e6).toFixed(2)}M hectares. If all ${FACTS.peatland_area} million hectares of global peatland were protected and restored, we'd avoid <strong>${FACTS.peatland_emissions} Gt CO₂ per year</strong> in emissions from drained peat — and begin re-accumulating carbon in intact peat at ~0.5 Gt CO₂ per year.</p>
      <p>The total carbon benefit: <strong>${(FACTS.peatland_emissions + 0.5).toFixed(1)} Gt CO₂ per year</strong>. That's ${(((FACTS.peatland_emissions + 0.5) / (FACTS.annual_emissions_2025)) * 100).toFixed(1)}% of annual global emissions — from protecting and restoring peatlands alone. It's one of the highest-impact, lowest-cost climate solutions available.</p>

      ${statRow([
        { value: `${(FACTS.peatland_emissions + 0.5).toFixed(1)} Gt/yr`, label: 'Total CO₂ Benefit' },
        { value: `${(((FACTS.peatland_emissions + 0.5) / FACTS.annual_emissions_2025) * 100).toFixed(1)}%`, label: 'Of Global Emissions' },
        { value: '10-100x', label: 'Cheaper Than Restoration' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Bottom Line</h3>
      <p>Protecting what we have is always cheaper than restoring what we've lost. Every hectare of intact peat swamp, every standing mangrove, every living forest is worth more alive than converted. The carbon math is clear. The economic math is clear. The only thing missing is the will.</p>
    `;
  }

  // ═══════════════════════════════════════════
  // GAIA SYNTHESIS TABS — AI-powered overviews
  // ═══════════════════════════════════════════

  function renderAntalyaSynthesis(container, site) {
    if (typeof GAIA_KNOWLEDGE === 'undefined') { container.innerHTML = '<p style="color:var(--text3);font-style:italic">Knowledge synthesis loading...</p>'; return; }
    container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis('antalya', site);
    _setupSynthesisRefresh(container, 'antalya', site);
  }

  function renderSriLankaSynthesis(container, site) {
    if (typeof GAIA_KNOWLEDGE === 'undefined') { container.innerHTML = '<p style="color:var(--text3);font-style:italic">Knowledge synthesis loading...</p>'; return; }
    container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis('sri_lanka', site);
    _setupSynthesisRefresh(container, 'sri_lanka', site);
  }

  function renderBeninSynthesis(container, site) {
    if (typeof GAIA_KNOWLEDGE === 'undefined') { container.innerHTML = '<p style="color:var(--text3);font-style:italic">Knowledge synthesis loading...</p>'; return; }
    container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis('benin', site);
    _setupSynthesisRefresh(container, 'benin', site);
  }

  function renderBorneoSynthesis(container, site) {
    if (typeof GAIA_KNOWLEDGE === 'undefined') { container.innerHTML = '<p style="color:var(--text3);font-style:italic">Knowledge synthesis loading...</p>'; return; }
    container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis('borneo', site);
    _setupSynthesisRefresh(container, 'borneo', site);
  }

  function _setupSynthesisRefresh(container, siteId, site) {
    if (typeof GAIA_KNOWLEDGE === 'undefined') return;
    // If already loaded, render immediately
    if (GAIA_KNOWLEDGE.isReady()) {
      container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis(siteId, site);
      return;
    }
    // Otherwise, listen for the knowledge-ready event
    const handler = () => {
      if (hasModule('GAIA_KNOWLEDGE')) {
        container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis(siteId, site);
      }
      document.removeEventListener('gaia:knowledge-ready', handler);
    };
    document.addEventListener('gaia:knowledge-ready', handler);
  }

  // ── Init ──
  function init() { registerAllSites(); }

  return {
    init, populateSiteData, onNodeClick, onNodeHover,
    addXP, getNodeState, getAllNodeState,
    getNextSuggestions, getSuggestedSiteIds, getGAIAContext,
    registerContent, registerFromJSON, CONTENT_TYPES,
  };
})();
window.GAIA_NODES = GAIA_NODES;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GAIA_NODES', {
    provides: ['init', 'onNodeClick', 'onNodeHover', 'getSuggestedSiteIds', 'populateSiteData'],
    requires: ['Data', 'GlobeModule', 'GLOBE_OVERLAY'],
  });
}
