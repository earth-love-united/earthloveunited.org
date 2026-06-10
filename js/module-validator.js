/**
 * MODULE BOOT VALIDATOR
 * Loaded LAST (before app.js) — validates all modules are properly
 * attached to window so safeCall/hasModule/safeGet can find them.
 *
 * Any module referenced by safeCall('X', ...) MUST be in this manifest.
 * If a required module is missing, it logs a 🔴 error.
 * If an optional module is missing, it logs a 🟡 warning.
 *
 * Also validates critical CSS stacking invariants.
 */

const MODULE_MANIFEST = {
  // ── Core Layer ──
  MODULE_CONTRACTS: { file: 'js/module-contracts.js', required: true,  note: 'Dependency validation' },
  Data:             { file: 'js/data.js',              required: true,  note: 'JSON loader, carbon math' },
  GlobeModule:      { file: 'js/globe.js',             required: true,  note: 'Globe.gl renderer' },
  Quiz:             { file: 'js/quiz.js',              required: true,  note: 'Carbon quiz' },

  // ── Globe Interaction Layer ──
  GLOBE_MODES:      { file: 'js/globe-modes.js',       required: true,  note: 'Mode orchestrator (countries/ndvi/events)' },
  GLOBE_NDVI:       { file: 'js/globe-ndvi.js',        required: false, note: 'NDVI vegetation heatmap mode' },
  GLOBE_EVENTS:     { file: 'js/globe-events.js',      required: false, note: 'Climate events & education mode' },
  GLOBE_RESTORE:    { file: 'js/globe-restore.js',     required: false, note: 'Interactive restoration simulator' },
  GLOBE_OVERLAY:    { file: 'js/globe-overlay.js',     required: true,  note: 'Left sidebar over globe' },
  GAIA_NODES:       { file: 'js/gaia-nodes.js',        required: true,  note: 'Globe click handlers' },
  SITE_PANEL:       { file: 'js/site-panel.js',        required: true,  note: 'Right side panel' },
  PLEDGE_PANEL:     { file: 'js/site-panel.js',        required: true,  note: 'Pledge dashboard' },
  COUNTRY_DATA:     { file: 'js/country-data.js',      required: false, note: 'Country metadata' },
  DELEGATION:       { file: 'js/delegation.js',        required: false, note: 'COP31 delegation data' },

  // ── GAIA Intelligence Layer ──
  GAIA_BUBBLE:      { file: 'js/gaia-bubble.js',       required: false, note: 'Floating speech bubble' },
  GAIA_VOICE:       { file: 'js/gaia-voice.js',        required: false, note: 'Voice line engine' },
  GAIA_ENGAGEMENT:  { file: 'js/gaia-engagement.js',   required: false, note: 'Behavior tracking' },
  GAIA_PRESENCE:    { file: 'js/gaia-presence.js',     required: false, note: 'Ambient teasers' },
  GAIA_JOURNAL:     { file: 'js/gaia-journal.js',      required: false, note: 'Session journal' },
  GAIA_KNOWLEDGE:   { file: 'js/gaia-overlay-knowledge.js', required: false, note: 'TF-IDF knowledge' },
  GAIA_CHARTS:      { file: 'js/gaia-legacy/gaia-charts.js', required: false, note: 'Canvas sparklines' },
  GAIA_DATA:        { file: 'js/gaia-legacy/gaia-data.js',   required: false, note: 'Live CO₂ data' },

  // ── Utility Layer ──
  CARBON_CLOCK:     { file: 'js/carbon-clock.js',      required: false, note: 'CO₂ clock in topbar' },
  PLEDGE_WALL:      { file: 'js/pledge-wall.js',       required: false, note: 'Pledge modal + wall' },
  NDVIVerifier:     { file: 'js/ndvi-verifier.js',     required: false, note: 'Satellite verification' },
  RegistryCheck:     { file: 'js/registry-check.js',    required: false, note: 'Carbon registry check' },
  CARBON_SHADOW:     { file: 'js/carbon-shadow.js',    required: false, note: 'Personal carbon calculator' },
  PULSE_DASHBOARD:   { file: 'js/pulse-dashboard.js',  required: false, note: 'Live planetary vital signs dashboard' },
};

(function validateModules() {
  const results = { ok: [], missing: [], optional: [] };

  for (const [name, meta] of Object.entries(MODULE_MANIFEST)) {
    if (typeof window[name] !== 'undefined' && window[name] !== null) {
      results.ok.push(name);
    } else if (meta.required) {
      results.missing.push(name);
      console.error(`🔴 [BOOT] REQUIRED module missing from window: ${name} (${meta.file}) — ${meta.note}`);
    } else {
      results.optional.push(name);
    }
  }

  // Summary
  const total = Object.keys(MODULE_MANIFEST).length;
  if (results.missing.length > 0) {
    console.error(
      `🔴 [BOOT] ${results.missing.length}/${total} REQUIRED modules failed!\n` +
      `   Missing: ${results.missing.join(', ')}\n` +
      `   Fix: Add "window.MODULE = MODULE;" after each IIFE`
    );
  } else {
    console.log(
      `%c✅ [BOOT] ${results.ok.length}/${total} modules loaded` +
      (results.optional.length > 0 ? ` (${results.optional.length} optional not present)` : ''),
      'color: #4ecdc4; font-weight: bold'
    );
  }

  // ── CSS Stacking Invariants ──
  const stackChecks = [
    {
      name: '#site-panel pointer-events when closed',
      test: () => {
        const el = document.getElementById('site-panel');
        if (!el || el.classList.contains('open')) return null; // skip if open
        return getComputedStyle(el).pointerEvents === 'none';
      },
      fix: 'Add pointer-events:none to #site-panel default CSS'
    },
    {
      name: '.sections has opaque background',
      test: () => {
        const el = document.querySelector('.sections');
        if (!el) return null;
        const bg = getComputedStyle(el).backgroundColor;
        return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      },
      fix: 'Add background:var(--bg) to .sections in layout.css'
    },
    {
      name: '#globe-overlay is NOT inside #globeViz',
      test: () => {
        const overlay = document.getElementById('globe-overlay');
        if (!overlay) return null; // not created yet, OK
        return overlay.parentElement !== document.getElementById('globeViz');
      },
      fix: 'Append #globe-overlay to document.body, not #globeViz'
    },
    {
      name: 'No invisible fullscreen click blockers',
      test: () => {
        const all = document.querySelectorAll('*');
        for (const el of all) {
          const s = getComputedStyle(el);
          if (
            s.position === 'fixed' &&
            s.pointerEvents !== 'none' &&
            s.display !== 'none' &&
            s.visibility !== 'hidden' &&
            parseFloat(s.opacity) < 0.1 &&
            el.offsetWidth > window.innerWidth * 0.8 &&
            el.offsetHeight > window.innerHeight * 0.8
          ) {
            console.warn(`⚠️ [BOOT] Invisible fullscreen blocker: ${el.tagName}#${el.id || '(no id)'}, opacity:${s.opacity}, pe:${s.pointerEvents}`);
            return false;
          }
        }
        return true;
      },
      fix: 'Set pointer-events:none on invisible fullscreen fixed elements'
    },
  ];

  setTimeout(() => {
    let stackOk = 0;
    let stackFail = 0;
    for (const check of stackChecks) {
      const result = check.test();
      if (result === null) continue; // skip
      if (result) {
        stackOk++;
      } else {
        stackFail++;
        console.warn(`⚠️ [BOOT] CSS check failed: ${check.name}\n   Fix: ${check.fix}`);
      }
    }
    if (stackFail === 0 && stackOk > 0) {
      console.log(`%c✅ [BOOT] ${stackOk} CSS stacking checks passed`, 'color: #4ecdc4');
    }
  }, 3000); // Wait for dynamic DOM
})();
