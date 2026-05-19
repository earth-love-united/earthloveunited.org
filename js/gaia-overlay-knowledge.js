/**
 * GAIA OVERLAY KNOWLEDGE ENGINE v1.0
 * Integrates the Earth Love United Climate Knowledge dataset into the globe overlay.
 *
 * Features:
 * 1. Cascading load — dataset loads after first overlay open, not on page load
 * 2. Auto-populate — stats are sourced from dataset searches, not hardcoded
 * 3. ⓘ Source popovers — every stat has a clickable source citation
 * 4. GAIA Synthesis tab — per-site synthesized overview from the dataset
 *
 * Architecture:
 * - Listens for overlay:open events to trigger dataset loading
 * - Provides helper functions for render functions to use
 * - Manages a source cache: { statKey → { value, source, title, text, url } }
 * - Renders ⓘ buttons next to every stat
 */

const GAIA_KNOWLEDGE = (() => {
  let _loadStarted = false;
  let _loadComplete = false;
  let _pollAttempts = 0;
  let _sourceCache = {}; // { key: { value, source, title, text, url, confidence } }
  let _searchQueue = [];
  let _activePopover = null;

  // ── Cascading Load ──
  function init() {
    if (_loadStarted) return;
    _loadStarted = true;
    _pollAttempts = 0;

    // Listen for overlay open to start loading
    document.addEventListener('overlay:open', onOverlayOpen);
  }

  function onOverlayOpen() {
    // Always try to init the core engine if not loaded
    if (typeof GaiaKnowledge === 'undefined') return;
    if (!GaiaKnowledge.isLoaded) {
      console.log('[GAIA Knowledge] Starting cascading dataset load...');
      GaiaKnowledge.init();
    }
    _pollForReady();
  }

  function _pollForReady() {
    if (typeof GaiaKnowledge === 'undefined') return;
    if (GaiaKnowledge.isLoaded) {
      _loadComplete = true;
      console.log('[GAIA Knowledge] Dataset ready:', GaiaKnowledge.getStats());
      _processQueue();
      // Dispatch event so synthesis tabs can refresh
      document.dispatchEvent(new CustomEvent('gaia:knowledge-ready'));
      return;
    }
    // Max 50 retries × 200ms = 10 seconds. After that, mark as failed
    // so queued searches return null instead of polling forever.
    if (_pollAttempts >= 50) {
      console.warn('[GAIA Knowledge] Dataset load timed out after 10s. Synthesis tabs will show unavailable.');
      _loadComplete = false;
      _processQueue(); // will return null for all queued items
      document.dispatchEvent(new CustomEvent('gaia:knowledge-timeout'));
      return;
    }
    _pollAttempts++;
    setTimeout(_pollForReady, 200);
  }

  // ── Source Cache ──
  function searchAndCache(key, query, options = {}) {
    if (!_loadComplete) {
      // Queue for later
      _searchQueue.push({ key, query, options });
      return null;
    }
    if (typeof GaiaKnowledge === 'undefined') return null;
    const results = GaiaKnowledge.search(query, { topK: 3, ...options });
    if (results.length > 0) {
      const best = results[0];
      _sourceCache[key] = {
        value: _extractValue(best.text, options.extractPattern),
        source: best.source,
        title: best.title,
        text: best.text,
        url: best.url || '',
        confidence: best.confidence || 'high',
        score: best._score,
        allResults: results,
      };
      return _sourceCache[key];
    }
    return null;
  }

  function _processQueue() {
    for (const item of _searchQueue) {
      searchAndCache(item.key, item.query, item.options);
    }
    _searchQueue = [];
  }

  function getSource(key) {
    return _sourceCache[key] || null;
  }

  function isReady() {
    // Check core engine directly — it may have been loaded proactively
    if (typeof GaiaKnowledge !== 'undefined' && GaiaKnowledge.isLoaded) {
      _loadComplete = true;
    }
    return _loadComplete;
  }

  // ── Value Extraction ──
  // Try to extract a numeric value from text using common patterns
  function _extractValue(text, pattern) {
    if (pattern) {
      const match = text.match(pattern);
      if (match) return match[1] || match[0];
    }
    // Default: look for patterns like "X.Y Z" where X.Y is a number and Z is a unit
    const patterns = [
      /(\d+\.?\d*)\s*(°C|ppm|ppb|Gt|GtC|mm|cm|m|kg|t|tonnes?|ha|million|billion|%)/i,
      /(\d+\.?\d*)\s*(percent|per cent)/i,
      /(\d{4})\s*(projection|estimate|scenario)/i,
    ];
    for (const p of patterns) {
      const match = text.match(p);
      if (match) return match[0];
    }
    return null;
  }

  // ── ⓘ Source Popover ──
  function showSource(e, key) {
    e.stopPropagation();
    const source = getSource(key);
    if (!source) return;

    // Remove existing popover
    hideSource();

    const popover = document.createElement('div');
    popover.className = 'gaia-source-popover';
    popover.innerHTML = `
      <div class="gaia-source-popover-header">
        <span class="gaia-source-confidence gaia-source-confidence--${source.confidence}">${source.confidence}</span>
        <span class="gaia-source-source">${source.source}</span>
      </div>
      <div class="gaia-source-popover-title">${source.title}</div>
      <div class="gaia-source-popover-text">${source.text.substring(0, 300)}${source.text.length > 300 ? '...' : ''}</div>
      ${source.url ? `<a href="${source.url}" target="_blank" class="gaia-source-popover-link">View source →</a>` : ''}
    `;

    document.body.appendChild(popover);
    _activePopover = popover;

    // Position near the clicked element
    const rect = e.target.getBoundingClientRect();
    popover.style.position = 'fixed';
    popover.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
    popover.style.top = (rect.bottom + 8) + 'px';
    popover.style.zIndex = '1000';

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', _closePopoverHandler);
    }, 10);
  }

  function hideSource() {
    if (_activePopover) {
      _activePopover.remove();
      _activePopover = null;
    }
    document.removeEventListener('click', _closePopoverHandler);
  }

  function _closePopoverHandler(e) {
    if (_activePopover && !_activePopover.contains(e.target)) {
      hideSource();
    }
  }

  // ── Stat with Source Button ──
  function statWithSource(key, value, label, query, options = {}) {
    // Trigger search (or queue it)
    searchAndCache(key, query, options);
    return `
      <div class="overlay-stat">
        <div class="overlay-stat-value">
          ${value}
          <button class="gaia-source-btn" data-source-key="${key}" title="View source" onclick="GAIA_KNOWLEDGE.showSource(event, '${key}')">ⓘ</button>
        </div>
        <div class="overlay-stat-label">${label}</div>
      </div>`;
  }

  // ── Inline Citation ──
  function cite(key) {
    const source = getSource(key);
    if (!source) return '';
    return `<span class="gaia-inline-cite" title="${source.source}: ${source.title}">[<a href="${source.url || '#'}" target="_blank">${source.source}</a>]</span>`;
  }

  // ── GAIA Synthesis Generator ──
  function generateSynthesis(siteId, siteData) {
    // Check core engine directly
    const ready = (typeof GaiaKnowledge !== 'undefined' && GaiaKnowledge.isLoaded) || _loadComplete;
    if (!ready) {
      return '<p style="color:var(--text3);font-style:italic">Loading knowledge synthesis...</p>';
    }

    const queries = _getSynthesisQueries(siteId, siteData);
    const sections = [];

    for (const section of queries) {
      const results = GaiaKnowledge.search(section.query, { topK: 3 });
      if (results.length > 0) {
        sections.push({
          heading: section.heading,
          content: _synthesizeContent(results, section.focus),
          sources: results.map(r => ({ source: r.source, title: r.title, url: r.url, confidence: r.confidence })),
        });
      }
    }

    if (sections.length === 0) {
      return '<p style="color:var(--text3)">No synthesis available yet. The knowledge engine is still loading.</p>';
    }

    return sections.map(s => `
      <h3>${s.heading}</h3>
      <p>${s.content}</p>
      <div class="gaia-synthesis-sources">
        ${s.sources.map(src => `
          <span class="gaia-synthesis-source">
            <span class="gaia-source-confidence gaia-source-confidence--${src.confidence}">${src.confidence}</span>
            <a href="${src.url || '#'}" target="_blank">${src.source}: ${src.title.substring(0, 60)}${src.title.length > 60 ? '...' : ''}</a>
          </span>`).join('')}
      </div>
      <div class="overlay-divider"></div>
    `).join('');
  }

  function _getSynthesisQueries(siteId, siteData) {
    const queries = {
      antalya: [
        { heading: 'The Mediterranean Fire Crisis', query: 'Mediterranean wildfire climate change carbon emissions', focus: 'fire' },
        { heading: 'COP31 and Global Climate Policy', query: 'COP31 climate conference Turkey carbon policy', focus: 'policy' },
        { heading: 'Restoration Science', query: 'Mediterranean forest restoration carbon sequestration', focus: 'restoration' },
      ],
      sri_lanka: [
        { heading: 'Tropical Dry Forest Restoration', query: 'tropical dry forest restoration carbon sequestration', focus: 'restoration' },
        { heading: 'Multilayer Afforestation', query: 'multilayer afforestation agroforestry carbon', focus: 'agroforestry' },
        { heading: 'Post-Conflict Land Recovery', query: 'post-conflict land restoration degraded land', focus: 'recovery' },
      ],
      benin: [
        { heading: 'Blue Carbon and Mangroves', query: 'mangrove blue carbon sequestration coastal ecosystem', focus: 'blue carbon' },
        { heading: 'West African Coastal Threats', query: 'West Africa coastal erosion sea level rise climate', focus: 'coastal' },
        { heading: 'Mangrove Restoration Potential', query: 'mangrove restoration carbon sequestration rate', focus: 'restoration' },
      ],
      borneo: [
        { heading: 'Peatland Carbon Dynamics', query: 'peatland carbon stock drainage emissions Southeast Asia', focus: 'peatland' },
        { heading: 'Oil Palm and Deforestation', query: 'oil palm deforestation Borneo carbon emissions', focus: 'deforestation' },
        { heading: 'Peatland Restoration', query: 'peatland restoration rewetting carbon sequestration', focus: 'restoration' },
      ],
    };
    return queries[siteId] || [];
  }

  function _synthesizeContent(results, focus) {
    // Take the top result and extract a synthesized paragraph
    const top = results[0];
    // Get first 2-3 sentences
    const sentences = top.text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const summary = sentences.slice(0, 3).join('. ').trim();
    return summary + (summary.endsWith('.') ? '' : '.');
  }

  return {
    init,
    searchAndCache,
    getSource,
    isReady,
    showSource,
    hideSource,
    statWithSource,
    cite,
    generateSynthesis,
  };
})();

// Auto-init the knowledge integration (starts loading dataset in background)
GAIA_KNOWLEDGE.init();

// Also init the core knowledge engine proactively so it's ready when needed
// The dataset is large (~17MB) — start loading early so synthesis is ready on first overlay open
setTimeout(() => {
  if (typeof GaiaKnowledge !== 'undefined' && !GaiaKnowledge.isLoaded) {
    GaiaKnowledge.init();
  }
}, 2000); // Start 2s after page load, after critical UI is ready
