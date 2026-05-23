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

  // ── Register site content ──
  function registerSite(siteConfig) {
    registry[siteConfig.siteId] = siteConfig;
  }

  // ── Get registered site ──
  function getSite(siteId) {
    return registry[siteId] || null;
  }

  // ── Create overlay DOM ──
  function createOverlay() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'globe-overlay';
    overlayEl.innerHTML = `
      <div class="globe-overlay-connector"></div>
      <div class="globe-overlay-bg"></div>
      <div class="globe-overlay-header">
        <div class="globe-overlay-header-left">
          <span class="globe-overlay-icon" id="globe-overlay-icon"></span>
          <div>
            <div class="globe-overlay-title" id="globe-overlay-title"></div>
            <div class="globe-overlay-subtitle" id="globe-overlay-subtitle"></div>
          </div>
        </div>
        <button class="globe-overlay-close" id="globe-overlay-close" aria-label="Close">✕</button>
      </div>
      <div class="globe-overlay-gaia" id="globe-overlay-gaia"></div>
      <div class="globe-overlay-tabs" id="globe-overlay-tabs"></div>
      <div class="globe-overlay-content" id="globe-overlay-content"></div>
      <button class="globe-overlay-toggle" id="globe-overlay-toggle" aria-label="Toggle Panel">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    `;

    // Insert into body — NOT into globeViz, which has z-index:1 and would
    // trap the overlay inside that stacking context (below .sections z-index:10)
    document.body.appendChild(overlayEl);

    // Close button
    overlayEl.querySelector('#globe-overlay-close').addEventListener('click', close);
    
    // Toggle Slider
    overlayEl.querySelector('#globe-overlay-toggle').addEventListener('click', () => {
      if (isOpen) {
        close();
      } else {
        if (!currentSiteId) {
          // If no site is loaded yet, just grab the first one from registry
          const keys = Object.keys(registry);
          if (keys.length > 0) open(keys[0]);
        } else {
          // Re-open current site
          overlayEl.classList.add('open');
          isOpen = true;
        }
      }
    });
  }

  // ── Open overlay for a site ──
  function open(siteId) {
    const site = registry[siteId];
    if (!site) {
      console.warn('[GLOBE_OVERLAY] No content registered for site:', siteId);
      return;
    }

    if (!overlayEl) createOverlay();

    // If same site is already open, just switch tab
    if (currentSiteId === siteId && isOpen) {
      return;
    }

    currentSiteId = siteId;

    // Update header
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

    // Build tabs
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

    // Render first tab content
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

    // Open — use rAF to ensure the initial state is rendered first
    // so the CSS transition animates from -105% to 0
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlayEl.classList.add('open');
        isOpen = true;
      });
    });

    // Emit event
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

  // ── Close overlay ──
  function close() {
    if (!overlayEl) return;
    overlayEl.classList.remove('open');
    isOpen = false;

    // Clear rendered flags so content re-renders on next open
    overlayEl.querySelectorAll('.globe-overlay-tab-panel').forEach(el => {
      delete el.dataset.rendered;
    });

    currentSiteId = null;
    currentTabId = null;

    // Clean up any stale globe transform from legacy Panel.open()
    const globeEl = document.getElementById('globeViz');
    if (globeEl) globeEl.style.transform = '';

    // Resume globe auto-rotation (paused in site-panel.js open())
    if (hasModule('GlobeModule') && GlobeModule.world && GlobeModule.world.controls()) {
      GlobeModule.world.controls().autoRotate = true;
    }

    dispatchEvent('overlay:close', {});
  }

  // ── Simple event dispatcher ──
  function dispatchEvent(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /**
   * Re-render the currently active tab (clears cached render and re-runs).
   * Used by interactive content that needs to update in-place.
   */
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
  };
})();
window.GLOBE_OVERLAY = GLOBE_OVERLAY;

  MODULE_CONTRACTS.register('GLOBE_OVERLAY', {
    provides: ['isOpen', 'getCurrentSite'],
    requires: [],
  });
