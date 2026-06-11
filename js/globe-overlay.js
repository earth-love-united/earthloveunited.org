/**
 * GLOBE OVERLAY v1.0
 * Scrollable left-anchored content box that opens over the globe.
 * Everything the user interacts with on the globe comes through here.
 *
 * Architecture:
 * - Single overlay instance. Opening a new site replaces the current one.
 * - Tabbed content. Each site defines its own tabs.
 * - Content is rendered by registered render functions (content registry pattern).
 * - Globe stays fully interactive behind the overlay.
 * - Overlay is independently scrollable, dynamic height based on content.
 *
 * Content registry is populated by gaia-nodes.js (or any module).
 * Each entry: { siteId, icon, title, subtitle, tabs: [{ id, label, render }] }
 */

const GLOBE_OVERLAY = (() => {
  let overlayEl = null;
  let currentSiteId = null;
  let currentTabId = null;
  let isOpen = false;

  // ── Content registry ──
  // Populated externally by gaia-nodes.js
  const registry = {};

  // Helper to map biome key to pretty name with icon
  function getBiomeName(biomeKey) {
    if (typeof Data !== 'undefined' && Data.biomes && Data.biomes[biomeKey]) {
      return (Data.biomes[biomeKey].icon || '') + ' ' + (Data.biomes[biomeKey].name || biomeKey);
    }
    const fallbacks = {
      "tropical_rainforest": "🌳 Tropical Rainforest",
      "tropical_dry_forest": "🌴 Tropical Dry Forest",
      "mangrove": "🌿 Mangrove",
      "temperate_deciduous": "🍂 Temperate Deciduous",
      "temperate_coniferous": "🌲 Temperate Coniferous",
      "boreal_forest": "🌲 Boreal Forest",
      "grassland_savanna": "🌾 Grassland / Savanna",
      "wetland_peatland": "💧 Wetland / Peatland",
      "seagrass_meadow": "🌊 Seagrass Meadow",
      "agricultural_cropland": "🌾 Agricultural Cropland",
      "degraded_bare_land": "🏜️ Degraded / Bare Land",
      "urban_built": "🏙️ Urban / Built"
    };
    return fallbacks[biomeKey] || biomeKey;
  }

  // Helper to format population figures
  function formatPopulation(num) {
    if (num === undefined || num === null || isNaN(num)) return 'N/A';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + ' B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + ' M';
    if (num >= 1e3) return (num / 1e3).toFixed(0) + ' K';
    return num.toString();
  }

  // Helper to format percentage emissions change since 2015
  function formatChange(val) {
    if (val === undefined || val === null || isNaN(val)) return 'N/A';
    const sign = val >= 0 ? '+' : '';
    const arrow = val > 0 ? '▲' : (val < 0 ? '▼' : '');
    const color = val > 0 ? 'var(--warn)' : (val < 0 ? 'var(--leaf)' : 'var(--text2)');
    return `<span style="color: ${color}; font-weight: 600;">${arrow} ${sign}${val}%</span>`;
  }

  // ── Register site content ──
  function registerSite(siteConfig) {
    registry[siteConfig.siteId] = siteConfig;
  }

  // ── Get registered site ──
  function getSite(siteId) {
    return registry[siteId] || null;
  }

  // ── Story Progress Bar ──
  function updateProgressBar() {
    const progressContainer = overlayEl?.querySelector('#hover-card-progress');
    if (!progressContainer || !currentSiteId) return;

    const site = registry[currentSiteId];
    if (!site || !site.tabs) return;

    const total = site.tabs.length;
    const activeIndex = site.tabs.findIndex(t => t.id === currentTabId);

    progressContainer.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const segment = document.createElement('div');
      segment.className = 'progress-segment';
      if (i < activeIndex) {
        segment.classList.add('active');
      } else if (i === activeIndex) {
        segment.classList.add('current');
      }
      const fill = document.createElement('div');
      fill.className = 'progress-segment-fill';
      if (i < activeIndex) {
        fill.style.width = '100%';
      } else if (i === activeIndex) {
        fill.style.width = '100%';
        fill.style.transition = 'width 0.3s ease';
      } else {
        fill.style.width = '0%';
      }
      segment.appendChild(fill);
      progressContainer.appendChild(segment);
    }
  }

  // ── Create overlay DOM ──
  function createOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'globe-overlay';
    overlayEl.innerHTML = `
      <div class="hover-card" id="hover-card">
        <button class="hover-card-edge-btn left" id="hover-card-btn-left" aria-label="Swipe Left to Close">◀</button>
        <button class="hover-card-edge-btn right" id="hover-card-btn-right" aria-label="Swipe Right for Next">▶</button>
        <div class="hover-card-inner">
          <!-- Story-style progress bars at the top of the card -->
          <div class="hover-card-progress" id="hover-card-progress"></div>
          
          <!-- Intro/Small Card View -->
          <div class="hover-card-intro" id="hover-card-intro">
            <div class="hover-card-intro-content">
              <div class="hover-card-intro-title" id="hover-card-intro-title"></div>
              <div class="hover-card-badge" id="hover-card-badge"></div>
              <div class="hover-card-intro-desc" id="hover-card-intro-desc"></div>
            </div>
            <button class="hover-card-more-btn" id="hover-card-more-btn">Explore Details</button>
            <div class="hover-card-swipe-prompt">← Swipe left to close / Swipe right for next →</div>
          </div>

          <!-- Expanded Detailed View -->
          <div class="globe-overlay-header">
            <div class="globe-overlay-header-left">
              <span class="globe-overlay-icon" id="globe-overlay-icon"></span>
              <div>
                <div class="globe-overlay-title" id="globe-overlay-title"></div>
                <div class="globe-overlay-subtitle" id="globe-overlay-subtitle"></div>
              </div>
            </div>
            <div class="hover-card-header-nav">
              <button class="hover-card-header-btn" id="hover-card-header-prev" aria-label="Previous tab">◀</button>
              <button class="hover-card-header-btn" id="hover-card-header-next" aria-label="Next tab">▶</button>
            </div>
            <button class="globe-overlay-close" id="globe-overlay-close" aria-label="Close">✕</button>
          </div>
          <div class="globe-overlay-gaia" id="globe-overlay-gaia"></div>
          <div class="globe-overlay-tabs" id="globe-overlay-tabs"></div>
          <div class="globe-overlay-content" id="globe-overlay-content"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlayEl);

    // Close button
    overlayEl.querySelector('#globe-overlay-close').addEventListener('click', close);
    
    // More button
    const cardEl = overlayEl.querySelector('#hover-card');
    overlayEl.querySelector('#hover-card-more-btn').addEventListener('click', () => {
      cardEl.classList.add('expanded');
      // Render charts if needed
      if (hasModule('GAIA_CHARTS')) {
        setTimeout(() => GAIA_CHARTS.renderPending(), 50);
      }
    });

    // Header Prev/Next buttons
    overlayEl.querySelector('#hover-card-header-prev').addEventListener('click', prevTab);
    overlayEl.querySelector('#hover-card-header-next').addEventListener('click', nextTab);

    // Edge Swipe Buttons
    overlayEl.querySelector('#hover-card-btn-left').addEventListener('click', (e) => {
      e.stopPropagation();
      swipeClose();
    });
    overlayEl.querySelector('#hover-card-btn-right').addEventListener('click', (e) => {
      e.stopPropagation();
      nextSite();
    });

    // ── Pointer Drag / Swipe Physics ──
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    cardEl.addEventListener('pointerdown', (e) => {
      // Don't drag if clicking the edge buttons
      if (e.target.closest('.hover-card-edge-btn')) return;

      // Don't drag if clicking interactive elements inside expanded content!
      if (cardEl.classList.contains('expanded')) {
        if (e.target.closest('#globe-overlay-content') || e.target.closest('.hover-card-header-nav') || e.target.closest('#globe-overlay-close')) {
          return;
        }
      }

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      cardEl.classList.remove('snap-back', 'swipe-left', 'swipe-right');
      cardEl.classList.add('is-dragging');
      cardEl.setPointerCapture(e.pointerId);
    });

    cardEl.addEventListener('pointermove', (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      // Apply drag transform with rotation and dampened vertical movement
      cardEl.style.transform = `translate(${deltaX}px, ${deltaY * 0.2}px) rotate(${deltaX * 0.05}deg)`;
    });

    const handleRelease = (e) => {
      if (!isDragging) return;
      isDragging = false;
      cardEl.classList.remove('is-dragging');
      cardEl.releasePointerCapture(e.pointerId);

      const deltaX = e.clientX - startX;
      const swipeThreshold = 120; // px

      if (deltaX > swipeThreshold) {
        // Swipe Right -> Next Country
        cardEl.classList.add('swipe-right');
        nextSite();
      } else if (deltaX < -swipeThreshold) {
        // Swipe Left -> Dismiss
        cardEl.classList.add('swipe-left');
        swipeClose();
      } else {
        // Snap back to center
        cardEl.classList.add('snap-back');
        cardEl.style.transform = '';
        setTimeout(() => {
          cardEl.classList.remove('snap-back');
        }, 400);
      }
    };

    cardEl.addEventListener('pointerup', handleRelease);
    cardEl.addEventListener('pointercancel', handleRelease);
  }

  // ── Swipe outcomes ──
  function swipeClose() {
    const cardEl = overlayEl?.querySelector('#hover-card');
    if (cardEl) {
      cardEl.classList.add('swipe-left');
      setTimeout(() => {
        cardEl.classList.remove('swipe-left');
        cardEl.style.transform = '';
        close();
      }, 350);
    } else {
      close();
    }
  }

  function nextSite() {
    const cardEl = overlayEl?.querySelector('#hover-card');

    // If it's a pledge site, navigate through the global Data.pledgeNodes array
    if (currentSiteId && currentSiteId.startsWith('pledge_') && typeof Data !== 'undefined' && Data.pledgeNodes) {
      const iso = currentSiteId.replace('pledge_', '');
      const idx = Data.pledgeNodes.findIndex(p => p.iso === iso);
      if (idx !== -1) {
        const nextNode = Data.pledgeNodes[(idx + 1) % Data.pledgeNodes.length];
        if (nextNode && typeof PLEDGE_PANEL !== 'undefined') {
          if (cardEl) {
            cardEl.classList.add('swipe-right');
            setTimeout(() => {
              cardEl.classList.remove('swipe-right');
              cardEl.style.transform = '';
              PLEDGE_PANEL.open(nextNode);
            }, 350);
          } else {
            PLEDGE_PANEL.open(nextNode);
          }
          return;
        }
      }
    }

    // Fallback for non-pledge sites (local registry)
    const keys = Object.keys(registry);
    if (keys.length === 0) return;

    let nextIndex = 0;
    if (currentSiteId) {
      const currentIndex = keys.indexOf(currentSiteId);
      nextIndex = (currentIndex + 1) % keys.length;
    }

    const nextSiteId = keys[nextIndex];
    if (cardEl) {
      setTimeout(() => {
        cardEl.classList.remove('swipe-right');
        cardEl.style.transform = '';
        open(nextSiteId);
      }, 350);
    } else {
      open(nextSiteId);
    }
  }

  // ── Open overlay for a site ──
  function open(siteId) {
    const site = registry[siteId];
    if (!site) {
      console.warn('[GLOBE_OVERLAY] No content registered for site:', siteId);
      return;
    }

    if (!overlayEl) createOverlay();

    // Reset card state to intro view (not expanded)
    const cardEl = overlayEl.querySelector('#hover-card');
    cardEl.classList.remove('expanded');
    cardEl.style.transform = '';
    cardEl.className = 'hover-card';

    currentSiteId = siteId;

    // Emit EventBus event
    if (hasModule('EventBus')) {
      window.EventBus.emit('overlay:open', { siteId, site });
    }

    // Hide the hex country tooltip while the overlay is open to avoid competition
    const tt = document.getElementById('hex-country-tooltip');
    if (tt) {
      tt.classList.remove('visible');
      tt.style.display = 'none';
    }

    // Populate Intro View
    overlayEl.querySelector('#hover-card-intro-title').textContent = site.title || siteId;
    
    // Parse siteData to extract dynamic stats or generate fallback content
    const data = site.siteData;
    let badgeHtml = '';
    let descHtml = '';

    if (data && (data.cat_rating || data.co2_per_capita !== undefined)) {
      // Country / Pledge Node
      const rating = data.cat_rating || 'No Rating';
      let ratingClass = 'neutral';
      const ratingLower = rating.toLowerCase();
      if (ratingLower.includes('critically') || ratingLower.includes('highly insufficient')) {
        ratingClass = 'danger';
      } else if (ratingLower.includes('insufficient')) {
        ratingClass = 'warning';
      } else if (ratingLower.includes('sufficient') || ratingLower.includes('1.5') || ratingLower.includes('compatible')) {
        ratingClass = 'success';
      }

      badgeHtml = `<span class="badge ${ratingClass}">${rating}</span>`;

      const fmt = (val, suffix = '') => (val !== undefined && val !== null) ? val + suffix : 'N/A';
      
      descHtml = `
        <div class="hover-card-stats-grid">
          <div class="stat-box">
            <span class="stat-label">Total Fossil CO₂</span>
            <span class="stat-value">${fmt(data.fossil_co2_mt, ' Mt')}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Per Capita</span>
            <span class="stat-value">${fmt(data.co2_per_capita, ' t')}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Reality Gap</span>
            <span class="stat-value">${fmt(data.reality_gap_mt, ' Mt')}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">2030 Target</span>
            <span class="stat-value">${data.target_year ? `${data.reduction_pct}% by ${data.target_year}` : 'None'}</span>
          </div>
        </div>

        <div class="hover-card-extended-info">
          <div class="mini-stat-row">
            <div class="mini-stat-box">
              <span class="mini-stat-label">Population</span>
              <span class="mini-stat-value">${formatPopulation(data.population)}</span>
            </div>
            <div class="mini-stat-box">
              <span class="mini-stat-label">Emissions Since 2015</span>
              <span class="mini-stat-value">${formatChange(data.change_since_2015)}</span>
            </div>
          </div>
          ${data.conditionality ? `
            <div class="hover-card-section">
              <div class="hover-card-section-title">Conditionality</div>
              <div style="font-size: 11px; color: var(--text2);">${data.conditionality}</div>
            </div>
          ` : ''}
          ${data.ndc_summary ? `
            <div class="hover-card-section">
              <div class="hover-card-section-title">The Pledge</div>
              <blockquote class="hover-card-blockquote">${data.ndc_summary}</blockquote>
            </div>
          ` : ''}
        </div>
      `;
    } else if (data && (data.area !== undefined || data.trees !== undefined)) {
      // Restoration Site
      const status = data.status || 'Active';
      badgeHtml = `<span class="badge success">${status}</span>`;

      const formatNum = (val) => {
        if (val === undefined || val === null) return 'N/A';
        if (typeof val === 'number') {
          if (val >= 1e6) return (val / 1e6).toFixed(1) + 'M';
          if (val >= 1e3) return (val / 1e3).toFixed(1) + 'K';
          return val.toString();
        }
        return val;
      };

      // Helper to compute dynamic carbon / trees / partner fallback estimates
      const area = data.area || 0;
      const currentBiome = data.currentBiome || '';
      const primaryBiome = data.primaryBiome || '';

      const getBiomeDensity = (biomeKey) => {
        if (typeof Data !== 'undefined' && Data.biomes && Data.biomes[biomeKey]) {
          return Data.biomes[biomeKey].density || 0;
        }
        const densities = {
          "tropical_rainforest": 350,
          "tropical_dry_forest": 180,
          "mangrove": 950,
          "temperate_deciduous": 220,
          "temperate_coniferous": 300,
          "boreal_forest": 160,
          "grassland_savanna": 90,
          "wetland_peatland": 1400,
          "seagrass_meadow": 500,
          "agricultural_cropland": 50,
          "degraded_bare_land": 10,
          "urban_built": 30
        };
        return densities[biomeKey] || 0;
      };

      const currentDensity = getBiomeDensity(currentBiome);
      const targetDensity = getBiomeDensity(primaryBiome);
      const deltaDensity = Math.max(0, targetDensity - currentDensity);

      const treesPlanted = data.trees !== undefined ? data.trees : (area * 1000);
      const carbonSequestered = data.carbon !== undefined ? data.carbon : (area * deltaDensity);
      const partner = data.partner || (data.id === 'sri_lanka' ? 'SPE' : (data.id === 'antalya' ? 'COP31 Taskforce' : 'Local Wetlands Initiative'));

      const currentBiomePretty = getBiomeName(currentBiome);
      const primaryBiomePretty = getBiomeName(primaryBiome);

      descHtml = `
        <div class="hover-card-stats-grid">
          <div class="stat-box">
            <span class="stat-label">Restoration Area</span>
            <span class="stat-value">${formatNum(area)} ha</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Trees Planted</span>
            <span class="stat-value">${formatNum(treesPlanted)}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Carbon Sequestered</span>
            <span class="stat-value">${formatNum(carbonSequestered)} t</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Local Partner</span>
            <span class="stat-value" style="font-size: 11px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${partner}</span>
          </div>
        </div>

        <div class="hover-card-extended-info">
          <div class="hover-card-section">
            <div class="hover-card-section-title">Restoration Goal</div>
            <div class="biome-transition-flow">
              <div class="biome-node">
                <span class="biome-node-label">Current Biome</span>
                <span class="biome-node-value" title="${currentBiome}">${currentBiomePretty}</span>
              </div>
              <span class="biome-arrow">➔</span>
              <div class="biome-node">
                <span class="biome-node-label">Target Biome</span>
                <span class="biome-node-value" title="${primaryBiome}">${primaryBiomePretty}</span>
              </div>
            </div>
          </div>
          ${data.narrative ? `
            <div class="hover-card-section">
              <div class="hover-card-section-title">Project Narrative</div>
              <blockquote class="hover-card-blockquote">${data.narrative}</blockquote>
            </div>
          ` : ''}
        </div>
      `;
    } else {
      // Fallback description
      badgeHtml = `<span class="badge neutral">Info</span>`;
      let desc = '';
      if (site.description) {
        desc = site.description;
      } else if (site.tabs && site.tabs.length > 0) {
        try {
          const temp = document.createElement('div');
          site.tabs[0].render(temp, site.siteData || {});
          const p = temp.querySelector('p');
          desc = p ? p.textContent : '';
        } catch (e) {
          desc = '';
        }
      }
      if (!desc || desc.length < 5) {
        desc = site.subtitle || 'Discover environmental impact, restore initiatives, and local biomes.';
      }
      if (desc.length > 120) {
        desc = desc.substring(0, 117) + '...';
      }
      descHtml = `<p class="fallback-desc">${desc}</p>`;
    }

    const badgeEl = overlayEl.querySelector('#hover-card-badge');
    if (badgeEl) {
      badgeEl.innerHTML = badgeHtml;
    }
    overlayEl.querySelector('#hover-card-intro-desc').innerHTML = descHtml;

    // Update Header (Detailed View)
    overlayEl.querySelector('#globe-overlay-icon').textContent = site.icon || '🌍';
    overlayEl.querySelector('#globe-overlay-title').textContent = site.title || siteId;
    overlayEl.querySelector('#globe-overlay-subtitle').textContent = site.subtitle || '';

    // Update GAIA guidance section
    const gaiaSection = overlayEl.querySelector('#globe-overlay-gaia');
    if (gaiaSection) {
      const gaiaContext = hasModule('GAIA_NODES') ? GAIA_NODES.getGAIAContext(siteId) : null;
      if (gaiaContext) {
        gaiaSection.innerHTML = `
          <div class="globe-gaia-guidance">${gaiaContext.guidance}</div>
          <div class="globe-gaia-suggestions">
            ${gaiaContext.suggestions.map(s => `
              <button class="globe-gaia-chip" onclick="${s.action}">${s.label}</button>
            `).join('')}
          </div>
        `;
        gaiaSection.style.display = '';
      } else {
        gaiaSection.style.display = 'none';
      }
    }

    // Pre-build tabs in container
    const tabsEl = overlayEl.querySelector('#globe-overlay-tabs');
    tabsEl.innerHTML = '';
    site.tabs.forEach((tab, i) => {
      const tabEl = document.createElement('div');
      tabEl.className = 'globe-overlay-tab' + (i === 0 ? ' active' : '');
      tabEl.textContent = tab.label;
      tabEl.dataset.tabId = tab.id;
      tabEl.addEventListener('click', () => switchTab(tab.id));
      tabsEl.appendChild(tabEl);
    });

    // Render tab content panels
    const contentEl = overlayEl.querySelector('#globe-overlay-content');
    contentEl.innerHTML = '';
    site.tabs.forEach((tab, i) => {
      const panelEl = document.createElement('div');
      panelEl.className = 'globe-overlay-tab-panel' + (i === 0 ? ' active' : '');
      panelEl.dataset.tabId = tab.id;
      contentEl.appendChild(panelEl);
    });

    // Render first tab
    currentTabId = site.tabs[0].id;
    renderTabContent(currentTabId, site);
    
    // Update progress bar
    updateProgressBar();

    // Open container
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlayEl.classList.add('open');
        isOpen = true;
      });
    });

    dispatchEvent('overlay:open', { siteId });
  }

  // ── Switch tab ──
  function switchTab(tabId) {
    if (!currentSiteId) return;
    const site = registry[currentSiteId];
    if (!site) return;

    // Update tab styling
    overlayEl.querySelectorAll('.globe-overlay-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.tabId === tabId);
    });

    // Update panel visibility
    overlayEl.querySelectorAll('.globe-overlay-tab-panel').forEach(el => {
      el.classList.toggle('active', el.dataset.tabId === tabId);
    });

    currentTabId = tabId;

    // Render content if not already rendered
    renderTabContent(tabId, site);

    // Update progress bar
    updateProgressBar();

    // Render any pending charts for this tab
    if (hasModule('GAIA_CHARTS')) {
      setTimeout(() => GAIA_CHARTS.renderPending(), 50);
    }

    // Scroll content to top on tab switch
    overlayEl.querySelector('#globe-overlay-content').scrollTop = 0;
  }

  // ── Render tab content ──
  function renderTabContent(tabId, site) {
    const panelEl = overlayEl.querySelector(`.globe-overlay-tab-panel[data-tab-id="${tabId}"]`);
    if (!panelEl) return;
    if (panelEl.dataset.rendered) return; // already rendered

    const tab = site.tabs.find(t => t.id === tabId);
    if (!tab) return;

    try {
      tab.render(panelEl, site.siteData || {});
      panelEl.dataset.rendered = 'true';
    } catch (e) {
      console.error('[GLOBE_OVERLAY] Render error for tab', tabId, e);
      panelEl.innerHTML = '<p style="color:var(--text3);font-size:12px">Error loading content.</p>';
    }
  }

  // ── Tab navigation ──
  function prevTab() {
    if (!currentSiteId || !currentTabId) return;
    const site = registry[currentSiteId];
    if (!site || !site.tabs) return;

    const currentIndex = site.tabs.findIndex(t => t.id === currentTabId);
    if (currentIndex > 0) {
      switchTab(site.tabs[currentIndex - 1].id);
    }
  }

  // ── Next tab navigation ──
  function nextTab() {
    if (!currentSiteId || !currentTabId) return;
    const site = registry[currentSiteId];
    if (!site || !site.tabs) return;

    const currentIndex = site.tabs.findIndex(t => t.id === currentTabId);
    if (currentIndex < site.tabs.length - 1) {
      switchTab(site.tabs[currentIndex + 1].id);
    }
  }

  // ── Close overlay ──
  function close() {
    if (!overlayEl) return;
    const wasOpen = isOpen;
    const prevSiteId = currentSiteId;
    overlayEl.classList.remove('open');
    isOpen = false;

    // Emit EventBus event
    if (hasModule('EventBus') && wasOpen) {
      window.EventBus.emit('overlay:close', { siteId: prevSiteId });
    }

    // Restore the hex country tooltip display
    const tt = document.getElementById('hex-country-tooltip');
    if (tt) {
      tt.style.display = '';
    }

    // Clear rendered flags
    overlayEl.querySelectorAll('.globe-overlay-tab-panel').forEach(el => {
      delete el.dataset.rendered;
    });

    currentSiteId = null;
    currentTabId = null;

    const globeEl = document.getElementById('globeViz');
    if (globeEl) globeEl.style.transform = '';

    if (hasModule('GlobeModule') && GlobeModule.world && GlobeModule.world.controls()) {
      GlobeModule.world.controls().autoRotate = true;
    }

    dispatchEvent('overlay:close', {});
  }

  // ── Simple event dispatcher ──
  function dispatchEvent(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function refreshTab() {
    if (!currentSiteId || !currentTabId) return;
    const site = registry[currentSiteId];
    if (!site) return;

    const panelEl = overlayEl?.querySelector(`.globe-overlay-tab-panel[data-tab-id="${currentTabId}"]`);
    if (panelEl) {
      delete panelEl.dataset.rendered;
      renderTabContent(currentTabId, site);
    }
  }

  // ── Public API ──
  return {
    registerSite,
    getSite,
    open,
    close,
    switchTab,
    refreshTab,
    isOpen: () => isOpen,
    getCurrentSite: () => currentSiteId,
    // ── Standard Module Lifecycle (SML) ──
    init() {
      console.debug('[SML] GLOBE_OVERLAY.init');
      return true;
    },

    reset() {
      console.debug('[SML] GLOBE_OVERLAY.reset');
      currentSiteId = null;
      currentTabId = null;
      isOpen = false;
      return true;
    },

    destroy() {
      console.debug('[SML] GLOBE_OVERLAY.destroy');

      // Remove overlay DOM element
      if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
      }

      // Reset state
      currentSiteId = null;
      currentTabId = null;
      isOpen = false;

      return true;
    },

    getState() {
      return {};
    },
  };
})();
window.GLOBE_OVERLAY = GLOBE_OVERLAY;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GLOBE_OVERLAY', {
    provides: ['isOpen', 'getCurrentSite', 'init', 'reset', 'destroy', 'getState'],
    requires: [],
    emits: ['overlay:open', 'overlay:close'],
    listens: [],
  });
}
