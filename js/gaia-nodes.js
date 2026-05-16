/**
 * GAIA NODES v1.0
 * Manages interactive nodes on the globe and their content.
 *
 * Each site on the globe is a "node" — a clickable point that opens
 * the GLOBE_OVERLAY with site-specific tabs and content.
 *
 * This module:
 * 1. Registers site content with GLOBE_OVERLAY (content registry)
 * 2. Handles node click/hover events from the globe
 * 3. Manages per-site engagement state (XP, layers revealed, etc.)
 * 4. Tracks node visual states (locked → available → explored → mastered)
 *
 * Content for each site is defined here as tab render functions.
 * Each tab gets a container element and site data — it fills the container
 * with whatever HTML it needs. The overlay handles scrolling, tabs, etc.
 */

const GAIA_NODES = (() => {
  // ── Per-site engagement state ──
  const nodeState = {
    sri_lanka:  { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked' },
    antalya:    { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked' },
    benin:      { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked' },
    borneo:     { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked' },
  };

  // ── Register all site content with the overlay ──
  function registerAllSites() {
    // ── ANTALYA ──
    GLOBE_OVERLAY.registerSite({
      siteId: 'antalya',
      icon: '🔥',
      title: 'Antalya',
      subtitle: 'COP31 Host · Turkey',
      siteData: null, // populated from Data.sites at init
      tabs: [
        {
          id: 'cop31',
          label: 'COP31',
          render: renderAntalyaCOP31,
        },
        {
          id: 'wildfires',
          label: 'Wildfires',
          render: renderAntalyaWildfires,
        },
        {
          id: 'climate',
          label: 'Climate Data',
          render: renderAntalyaClimate,
        },
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
        {
          id: 'story',
          label: 'Story',
          render: renderSriLankaStory,
        },
        {
          id: 'data',
          label: 'Data',
          render: renderSriLankaData,
        },
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
        {
          id: 'story',
          label: 'Story',
          render: renderBeninStory,
        },
        {
          id: 'data',
          label: 'Data',
          render: renderBeninData,
        },
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
        {
          id: 'story',
          label: 'Story',
          render: renderBorneoStory,
        },
        {
          id: 'data',
          label: 'Data',
          render: renderBorneoData,
        },
      ],
    });
  }

  // ── Populate site data from Data module ──
  function populateSiteData() {
    if (typeof Data === 'undefined' || !Data.sites) return;
    Data.sites.forEach(site => {
      const registered = GLOBE_OVERLAY.getSite(site.id);
      if (registered) {
        registered.siteData = site;
      }
    });
  }

  // ── Handle node click (called from globe.js) ──
  function onNodeClick(siteId) {
    // Open the overlay for this site
    GLOBE_OVERLAY.open(siteId);

    // Track engagement
    addXP(siteId, 10);
    nodeState[siteId].visited = true;

    // GAIA speaks
    if (typeof GAIA_VOICE !== 'undefined') {
      const line = GAIA_VOICE.speak('SITE_ENTRY', siteId);
      if (line && typeof GAIA_BUBBLE !== 'undefined') {
        GAIA_BUBBLE.speak(line.text, line.tone, 8000);
      }
    }

    // Engagement signal
    if (typeof GAIA_ENGAGEMENT !== 'undefined') {
      GAIA_ENGAGEMENT.addSignal('site_tap');
    }
  }

  // ── Handle node hover (called from globe.js) ──
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

  // ── Add XP to a node ──
  function addXP(siteId, amount) {
    if (!nodeState[siteId]) return;
    nodeState[siteId].xp += amount;
    updateNodeVisual(siteId);
  }

  // ── Update node visual state based on XP ──
  function updateNodeVisual(siteId) {
    const state = nodeState[siteId];
    if (!state) return;

    if (state.xp >= 100) state.state = 'mastered';
    else if (state.xp >= 50) state.state = 'explored';
    else if (state.xp >= 10) state.state = 'available';
    else state.state = 'locked';
  }

  // ── Get node state ──
  function getNodeState(siteId) {
    return nodeState[siteId] ? { ...nodeState[siteId] } : null;
  }

  function getAllNodeState() {
    return JSON.parse(JSON.stringify(nodeState));
  }

  // ═══════════════════════════════════════════
  // TAB RENDER FUNCTIONS — ANTALYA
  // ═══════════════════════════════════════════

  function renderAntalyaCOP31(container, siteData) {
    container.innerHTML = `
      <h3>COP31 — November 2026</h3>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>
      <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">Nov 2026</div>
          <div class="overlay-stat-label">COP31 Dates</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">196</div>
          <div class="overlay-stat-label">Countries</div>
        </div>
      </div>
      <div class="overlay-divider"></div>
      <h3>Why Antalya Matters</h3>
      <p>Sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
      <p>Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
    `;
  }

  function renderAntalyaWildfires(container, siteData) {
    container.innerHTML = `
      <h3>The 2021 Wildfires</h3>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">60K+</div>
          <div class="overlay-stat-label">Hectares Burned</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.72→0.18</div>
          <div class="overlay-stat-label">NDVI Crash</div>
        </div>
      </div>
      <div class="overlay-divider"></div>
      <h3>Recovery Timeline</h3>
      <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.</p>
      <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.38</div>
          <div class="overlay-stat-label">Current NDVI (2025)</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">50-100yr</div>
          <div class="overlay-stat-label">Full Recovery</div>
        </div>
      </div>
    `;
  }

  function renderAntalyaClimate(container, siteData) {
    container.innerHTML = `
      <h3>Climate Data</h3>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">+1.7°C</div>
          <div class="overlay-stat-label">Temp Since 1980</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">-220mm</div>
          <div class="overlay-stat-label">Precipitation</div>
        </div>
      </div>
      <div class="overlay-divider"></div>
      <h3>Temperature Trend</h3>
      <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">18.2°C</div>
          <div class="overlay-stat-label">Current Avg</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">765mm</div>
          <div class="overlay-stat-label">Annual Rain</div>
        </div>
      </div>
      <div class="overlay-divider"></div>
      <h3>Carbon Impact</h3>
      <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore.</p>
    `;
  }

  // ═══════════════════════════════════════════
  // TAB RENDER FUNCTIONS — SRI LANKA
  // ═══════════════════════════════════════════

  function renderSriLankaStory(container, siteData) {
    container.innerHTML = `
      <h3>Northern Province</h3>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.</p>
      <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">6,000</div>
          <div class="overlay-stat-label">Acres</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">5</div>
          <div class="overlay-stat-label">Districts</div>
        </div>
      </div>
    `;
  }

  function renderSriLankaData(container, siteData) {
    container.innerHTML = `
      <h3>Restoration Data</h3>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">10→180</div>
          <div class="overlay-stat-label">tC/ha Target</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.55</div>
          <div class="overlay-stat-label">Current NDVI</div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════
  // TAB RENDER FUNCTIONS — BENIN
  // ═══════════════════════════════════════════

  function renderBeninStory(container, siteData) {
    container.innerHTML = `
      <h3>Ouidah Wetlands</h3>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.</p>
      <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">950</div>
          <div class="overlay-stat-label">tC/ha Mangrove</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.68→0.45</div>
          <div class="overlay-stat-label">NDVI Loss</div>
        </div>
      </div>
    `;
  }

  function renderBeninData(container, siteData) {
    container.innerHTML = `
      <h3>Mangrove Data</h3>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.52</div>
          <div class="overlay-stat-label">Current NDVI</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">2,500</div>
          <div class="overlay-stat-label">Hectares</div>
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════
  // TAB RENDER FUNCTIONS — BORNEO
  // ═══════════════════════════════════════════

  function renderBorneoStory(container, siteData) {
    container.innerHTML = `
      <h3>West Kalimantan</h3>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.</p>
      <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">1,400</div>
          <div class="overlay-stat-label">tC/ha Original</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">50</div>
          <div class="overlay-stat-label">tC/ha Now</div>
        </div>
      </div>
    `;
  }

  function renderBorneoData(container, siteData) {
    container.innerHTML = `
      <h3>Peat Swamp Data</h3>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
      <div class="overlay-stat-row">
        <div class="overlay-stat">
          <div class="overlay-stat-value">0.88→0.35</div>
          <div class="overlay-stat-label">NDVI Crash</div>
        </div>
        <div class="overlay-stat">
          <div class="overlay-stat-value">96%</div>
          <div class="overlay-stat-label">Carbon Lost</div>
        </div>
      </div>
    `;
  }

  // ── Init ──
  function init() {
    registerAllSites();
    // Site data will be populated after Data.init() completes
    // We'll call populateSiteData from app.js after Data.init()
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
