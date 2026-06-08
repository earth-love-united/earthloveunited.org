/**
 * CHANGE IMPACT ANALYZER
 * Static analysis of cross-module dependencies.
 * Answers: "If I edit this file, what could break?"
 *
 * Console commands:
 *   Impact.check('globe-overlay.js')    — full impact analysis for a file
 *   Impact.deps('GLOBE_OVERLAY')        — who calls this module?
 *   Impact.calls('gaia-nodes.js')       — what does this file call?
 *   Impact.hotspots()                   — most-depended-on modules
 *   Impact.orphans()                    — modules with no callers
 */

const Impact = (() => {

  // ── Static dependency map ──
  // Built from grep analysis of safeCall/hasModule/safeGet usage
  // This MUST be updated when adding new cross-module calls
  const DEPENDENCY_MAP = {
    'js/gaia-nodes.js': {
      calls: ['GLOBE_OVERLAY', 'GAIA_BUBBLE', 'GAIA_VOICE', 'GAIA_ENGAGEMENT', 'GAIA_CHARTS', 'GAIA_KNOWLEDGE', 'Data'],
      calledBy: ['js/globe.js'],
      css: ['css/globe-overlay.css'],
      data: [],
      exports: ['GAIA_NODES'],
      risk: 'HIGH',
      note: 'Core click handler — routes all globe interactions to overlay',
    },
    'js/globe-overlay.js': {
      calls: ['GAIA_NODES'],
      calledBy: ['js/gaia-nodes.js', 'js/site-panel.js'],
      css: ['css/globe-overlay.css'],
      data: [],
      exports: ['GLOBE_OVERLAY'],
      risk: 'HIGH',
      note: 'Left sidebar — breaks site/pledge info display if edited incorrectly',
    },
    'js/globe.js': {
      calls: ['GAIA_NODES', 'SITE_PANEL', 'PLEDGE_PANEL', 'GAIA_PRESENCE', 'GAIA_ENGAGEMENT', 'Data'],
      calledBy: ['js/app.js'],
      css: ['css/layout.css'],
      data: ['data/pledge-nodes.json'],
      exports: ['GlobeModule', 'Panel', 'PanelSlider'],
      risk: 'CRITICAL',
      note: 'Globe renderer — breaks entire 3D experience',
    },
    'js/app.js': {
      calls: ['GlobeModule', 'Data', 'Quiz', 'Cycle', 'Biomes', 'Counters', 'Scenario', 'GAIA_NODES', 'GLOBE_OVERLAY', 'GAIA_BUBBLE', 'GAIA_ENGAGEMENT', 'GAIA_JOURNAL', 'GAIA_PRESENCE', 'CARBON_CLOCK', 'DELEGATION'],
      calledBy: [],
      css: ['css/layout.css'],
      data: [],
      exports: ['App'],
      risk: 'CRITICAL',
      note: 'Init entry point — scroll handler, enterSite(), orchestration',
    },
    'js/site-panel.js': {
      calls: ['GLOBE_OVERLAY', 'GlobeModule', 'Data', 'COUNTRY_DATA'],
      calledBy: ['js/globe.js'],
      css: ['css/components.css', 'css/globe-overlay.css'],
      data: ['data/pledge-nodes.json'],
      exports: ['SITE_PANEL', 'PLEDGE_PANEL'],
      risk: 'HIGH',
      note: 'Pledge dashboard — breaks country climate data display',
    },
    'js/data.js': {
      calls: [],
      calledBy: ['js/app.js', 'js/globe.js', 'js/gaia-nodes.js', 'js/site-panel.js', 'js/ndvi-verifier.js', 'js/registry-check.js'],
      css: [],
      data: ['data/biomes.json', 'data/sites.json', 'data/pledge-nodes.json'],
      exports: ['Data', 'Storage'],
      risk: 'CRITICAL',
      note: 'Data loader — breaks everything if JSON structure changes',
    },
    'js/gaia-bubble.js': {
      calls: ['GAIA_VOICE', 'GAIA_ENGAGEMENT'],
      calledBy: ['js/gaia-nodes.js', 'js/app.js'],
      css: ['css/gaia-bubble.css'],
      data: [],
      exports: ['GAIA_BUBBLE'],
      risk: 'MEDIUM',
      note: 'GAIA speech bubble — cosmetic but core to UX',
    },
    'js/gaia-voice.js': {
      calls: [],
      calledBy: ['js/gaia-nodes.js', 'js/gaia-bubble.js', 'js/gaia-presence.js'],
      css: [],
      data: [],
      exports: ['GAIA_VOICE'],
      risk: 'LOW',
      note: 'Voice line selection — no side effects if broken',
    },
    'js/gaia-engagement.js': {
      calls: [],
      calledBy: ['js/gaia-nodes.js', 'js/gaia-bubble.js', 'js/globe.js', 'js/app.js'],
      css: [],
      data: [],
      exports: ['GAIA_ENGAGEMENT'],
      risk: 'LOW',
      note: 'Behavior tracking — analytics only, no visual impact if broken',
    },
    'js/gaia-presence.js': {
      calls: ['GAIA_VOICE', 'GAIA_ENGAGEMENT'],
      calledBy: ['js/globe.js', 'js/app.js'],
      css: ['css/gaia-presence.css'],
      data: [],
      exports: ['GAIA_PRESENCE'],
      risk: 'LOW',
      note: 'Ambient site teasers on hover',
    },
    'js/gaia-journal.js': {
      calls: ['GAIA_ENGAGEMENT'],
      calledBy: ['js/app.js'],
      css: [],
      data: [],
      exports: ['GAIA_JOURNAL'],
      risk: 'LOW',
      note: 'Session journal — isolated feature',
    },
    'js/gaia-overlay-knowledge.js': {
      calls: [],
      calledBy: ['js/gaia-nodes.js'],
      css: [],
      data: ['dist/knowledge/index.json.gz'],
      exports: ['GAIA_KNOWLEDGE'],
      risk: 'MEDIUM',
      note: 'TF-IDF knowledge engine — powers Synthesis tab in overlay',
    },
    'js/carbon-clock.js': {
      calls: [],
      calledBy: ['js/app.js'],
      css: [],
      data: [],
      exports: ['CARBON_CLOCK'],
      risk: 'LOW',
      note: 'CO₂ counter in topbar — isolated',
    },
    'js/pledge-wall.js': {
      calls: [],
      calledBy: ['js/gaia-nodes.js'],
      css: ['css/pledge-wall.css'],
      data: [],
      exports: ['PLEDGE_WALL'],
      risk: 'MEDIUM',
      note: 'User pledge modal + wall display',
    },
    'js/ndvi-verifier.js': {
      calls: ['Data'],
      calledBy: [],
      css: ['css/ndvi-verifier.css'],
      data: [],
      exports: ['NDVIVerifier'],
      risk: 'LOW',
      note: 'Satellite NDVI verification — external API dependent',
    },
    'js/quiz.js': {
      calls: [],
      calledBy: ['js/app.js'],
      css: ['css/components.css'],
      data: [],
      exports: ['Quiz'],
      risk: 'LOW',
      note: 'Carbon quiz widget — isolated section',
    },
    'js/country-data.js': {
      calls: [],
      calledBy: ['js/site-panel.js'],
      css: [],
      data: [],
      exports: ['COUNTRY_DATA'],
      risk: 'LOW',
      note: 'Country metadata for pledge tooltips',
    },
    'js/delegation.js': {
      calls: [],
      calledBy: ['js/app.js'],
      css: [],
      data: [],
      exports: ['DELEGATION'],
      risk: 'LOW',
      note: 'COP31 delegation data',
    },
    'js/registry-check.js': {
      calls: ['Data'],
      calledBy: [],
      css: [],
      data: [],
      exports: ['RegistryCheck'],
      risk: 'LOW',
      note: 'Carbon registry cross-check — external API dependent',
    },
    // CSS files
    'css/layout.css': {
      calls: [],
      calledBy: [],
      css: [],
      data: [],
      exports: [],
      risk: 'CRITICAL',
      note: 'Hero, topbar, sections, globe, footer — z-index stack lives here',
    },
    'css/components.css': {
      calls: [],
      calledBy: [],
      css: [],
      data: [],
      exports: [],
      risk: 'HIGH',
      note: 'Cards, panels, quiz — #site-panel pointer-events rule is here',
    },
    'css/globe-overlay.css': {
      calls: [],
      calledBy: [],
      css: [],
      data: [],
      exports: [],
      risk: 'HIGH',
      note: 'Left sidebar overlay — z-index:50 and transform animation here',
    },
  };

  // ── Analyze impact of editing a file ──
  function check(filename) {
    // Normalize filename
    const key = _normalize(filename);
    const entry = DEPENDENCY_MAP[key];

    if (!entry) {
      console.warn(`[Impact] Unknown file: ${filename}. Known files:`, Object.keys(DEPENDENCY_MAP));
      return null;
    }

    console.group(`%c🎯 IMPACT ANALYSIS: ${key}`, 'color: #ff6b6b; font-weight: bold; font-size: 14px;');
    
    // Risk level
    const riskColors = { CRITICAL: '#ff4444', HIGH: '#ff8c00', MEDIUM: '#ffd700', LOW: '#4ecdc4' };
    console.log(`%c⚡ Risk: ${entry.risk}`, `color: ${riskColors[entry.risk]}; font-weight: bold; font-size: 12px;`);
    console.log(`📝 ${entry.note}`);

    // What this file exports
    if (entry.exports.length > 0) {
      console.log(`📦 Exports: ${entry.exports.join(', ')}`);
    }

    // What this file calls into
    if (entry.calls.length > 0) {
      console.group(`📞 Calls INTO (${entry.calls.length} modules):`);
      entry.calls.forEach(m => {
        const onWindow = typeof window[m] !== 'undefined';
        console.log(`  ${onWindow ? '✅' : '❌'} ${m}`);
      });
      console.groupEnd();
    }

    // What calls THIS file
    if (entry.calledBy.length > 0) {
      console.group(`📥 Called BY (${entry.calledBy.length} files):`);
      entry.calledBy.forEach(f => console.log(`  ← ${f}`));
      console.groupEnd();
    } else {
      console.log('📥 Called BY: nobody (leaf node or entry point)');
    }

    // Downstream blast radius
    const downstream = _getDownstream(key);
    if (downstream.length > 0) {
      console.group(`💥 BLAST RADIUS (${downstream.length} files could be affected):`);
      downstream.forEach(f => {
        const d = DEPENDENCY_MAP[f];
        console.log(`  ${f} — ${d?.note || ''}`);
      });
      console.groupEnd();
    }

    // CSS files involved
    if (entry.css.length > 0) {
      console.log(`🎨 CSS: ${entry.css.join(', ')}`);
    }

    // Data files
    if (entry.data.length > 0) {
      console.log(`📊 Data: ${entry.data.join(', ')}`);
    }

    console.groupEnd();
    return { file: key, ...entry, downstream };
  }

  // ── Who calls this module? ──
  function deps(moduleName) {
    const callers = [];
    for (const [file, entry] of Object.entries(DEPENDENCY_MAP)) {
      if (entry.calls.includes(moduleName)) {
        callers.push(file);
      }
    }

    console.group(`%c📥 WHO CALLS ${moduleName}?`, 'color: #4ecdc4; font-weight: bold;');
    if (callers.length === 0) {
      console.log('Nobody calls this module via safeCall/hasModule');
    } else {
      callers.forEach(f => console.log(`  ← ${f}`));
    }
    console.groupEnd();
    return callers;
  }

  // ── What does this file call? ──
  function calls(filename) {
    const key = _normalize(filename);
    const entry = DEPENDENCY_MAP[key];
    if (!entry) {
      console.warn(`[Impact] Unknown file: ${filename}`);
      return [];
    }
    console.group(`%c📞 WHAT DOES ${key} CALL?`, 'color: #4ecdc4; font-weight: bold;');
    entry.calls.forEach(m => {
      const onWindow = typeof window[m] !== 'undefined';
      console.log(`  → ${m} ${onWindow ? '✅' : '❌ NOT ON WINDOW'}`);
    });
    console.groupEnd();
    return entry.calls;
  }

  // ── Most-depended-on modules ──
  function hotspots() {
    const depCount = {};
    for (const [, entry] of Object.entries(DEPENDENCY_MAP)) {
      entry.calls.forEach(m => {
        depCount[m] = (depCount[m] || 0) + 1;
      });
    }

    const sorted = Object.entries(depCount).sort((a, b) => b[1] - a[1]);
    
    console.group('%c🔥 HOTSPOTS (most depended-on modules)', 'color: #ff6b6b; font-weight: bold;');
    console.table(sorted.map(([module, count]) => ({
      Module: module,
      Dependents: count,
      'On Window': typeof window[module] !== 'undefined' ? '✅' : '❌',
      Risk: count >= 4 ? '🔴 HIGH' : count >= 2 ? '🟡 MEDIUM' : '🟢 LOW',
    })));
    console.groupEnd();
    return sorted;
  }

  // ── Modules with no callers ──
  function orphans() {
    const called = new Set();
    for (const [, entry] of Object.entries(DEPENDENCY_MAP)) {
      entry.calls.forEach(m => called.add(m));
    }

    const allExports = new Set();
    for (const [, entry] of Object.entries(DEPENDENCY_MAP)) {
      entry.exports.forEach(e => allExports.add(e));
    }

    const orphanList = [...allExports].filter(e => !called.has(e));
    
    console.group('%c👻 ORPHAN MODULES (exported but never called)', 'color: #9b59b6; font-weight: bold;');
    if (orphanList.length === 0) {
      console.log('No orphans — all exports are used');
    } else {
      orphanList.forEach(m => console.log(`  ❓ ${m}`));
    }
    console.groupEnd();
    return orphanList;
  }

  // ── Get downstream files that could be affected ──
  function _getDownstream(file, visited = new Set()) {
    if (visited.has(file)) return [];
    visited.add(file);

    const entry = DEPENDENCY_MAP[file];
    if (!entry) return [];

    const downstream = [];
    // Files that call this file's exports
    for (const exp of entry.exports) {
      for (const [f, e] of Object.entries(DEPENDENCY_MAP)) {
        if (e.calls.includes(exp) && !visited.has(f)) {
          downstream.push(f);
          downstream.push(..._getDownstream(f, visited));
        }
      }
    }

    return [...new Set(downstream)];
  }

  function _normalize(filename) {
    // Accept both 'globe.js' and 'js/globe.js'
    if (DEPENDENCY_MAP[filename]) return filename;
    if (DEPENDENCY_MAP['js/' + filename]) return 'js/' + filename;
    if (DEPENDENCY_MAP['css/' + filename]) return 'css/' + filename;
    // Try exact match on basename
    for (const key of Object.keys(DEPENDENCY_MAP)) {
      if (key.endsWith('/' + filename) || key === filename) return key;
    }
    return filename;
  }

  return { check, deps, calls, hotspots, orphans };
})();
window.Impact = Impact;
