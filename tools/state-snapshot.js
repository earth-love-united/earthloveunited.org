/**
 * RUNTIME STATE SNAPSHOT
 * Save and restore full application state for bug reproduction.
 *
 * Console commands:
 *   StateSnap.save('before-fix')    — snapshot current state with a label
 *   StateSnap.restore('before-fix') — restore a saved snapshot
 *   StateSnap.list()                — list all saved snapshots
 *   StateSnap.compare('a', 'b')     — diff two snapshots
 *   StateSnap.export()              — export all snapshots as JSON string
 *   StateSnap.import(json)          — import snapshots from JSON string
 */

const StateSnap = (() => {
  const STORAGE_KEY = 'elu_state_snapshots';

  function _getSnapshots() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function _setSnapshots(snaps) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snaps));
  }

  // ── Capture current state ──
  function _captureState() {
    const state = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scroll: { x: window.scrollX, y: window.scrollY },

      // DOM class states
      classes: {},
      // CSS computed states
      styles: {},
    };

    // Capture key element classes
    const watchElements = [
      'hero', 'topbar', 'globeViz', 'globe-overlay', 'site-panel',
      'panel-backdrop', 'gaia-bubble', 'pledge-modal', 'pledge-wall',
    ];
    watchElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        state.classes[id] = [...el.classList];
        const s = getComputedStyle(el);
        state.styles[id] = {
          display: s.display,
          visibility: s.visibility,
          opacity: s.opacity,
          pointerEvents: s.pointerEvents,
          transform: s.transform,
          zIndex: s.zIndex,
        };
      }
    });

    // Globe state
    if (window.GlobeModule && GlobeModule.world) {
      state.globe = {
        pov: GlobeModule.world.pointOfView(),
        pointCount: GlobeModule.world.pointsData()?.length || 0,
        autoRotate: GlobeModule.world.controls()?.autoRotate || false,
      };
    }

    // Overlay state
    if (window.GLOBE_OVERLAY) {
      state.overlay = {
        open: GLOBE_OVERLAY.isOpen(),
        currentSite: GLOBE_OVERLAY.getCurrentSite(),
      };
    }

    // Engagement state
    if (window.GAIA_ENGAGEMENT) {
      state.engagement = {
        archetype: safeGet('GAIA_ENGAGEMENT', 'getArchetype', null),
        score: safeGet('GAIA_ENGAGEMENT', 'getScore', 0),
      };
    }

    // GAIA_NODES state
    if (window.GAIA_NODES) {
      state.nodeState = safeGet('GAIA_NODES', 'getAllNodeState', {});
    }

    // Active section
    const sections = document.querySelectorAll('.section');
    state.activeSection = 'none';
    sections.forEach(s => {
      const rect = s.getBoundingClientRect();
      if (rect.top < window.innerHeight / 2 && rect.bottom > window.innerHeight / 2) {
        state.activeSection = s.id || 'unnamed';
      }
    });

    return state;
  }

  // ── Save snapshot ──
  function save(label = 'snap_' + Date.now()) {
    const snaps = _getSnapshots();
    snaps[label] = _captureState();
    _setSnapshots(snaps);
    console.log(`%c📸 [StateSnap] Saved: "${label}"`, 'color: #4ecdc4; font-weight: bold;');
    console.log(`   Scroll: ${snaps[label].scroll.y}px | Overlay: ${snaps[label].overlay?.open ? 'OPEN' : 'closed'} | Section: ${snaps[label].activeSection}`);
    return snaps[label];
  }

  // ── Restore snapshot ──
  function restore(label) {
    const snaps = _getSnapshots();
    const snap = snaps[label];
    if (!snap) {
      console.warn(`[StateSnap] No snapshot named "${label}". Available:`, Object.keys(snaps));
      return false;
    }

    console.group(`%c⏪ [StateSnap] Restoring: "${label}"`, 'color: #ffd700; font-weight: bold;');

    // Restore scroll
    window.scrollTo(snap.scroll.x, snap.scroll.y);
    console.log(`📜 Scroll: ${snap.scroll.y}px`);

    // Restore element classes
    for (const [id, classList] of Object.entries(snap.classes)) {
      const el = document.getElementById(id);
      if (el) {
        // Remove all current classes, add snapshot classes
        el.className = classList.join(' ');
        console.log(`🧩 ${id}: ${classList.join(' ') || '(no classes)'}`);
      }
    }

    // Restore globe POV
    if (snap.globe && window.GlobeModule && GlobeModule.world) {
      GlobeModule.world.pointOfView(snap.globe.pov, 600);
      GlobeModule.world.controls().autoRotate = snap.globe.autoRotate;
      console.log(`🌍 Globe POV restored`);
    }

    // Restore overlay
    if (snap.overlay && window.GLOBE_OVERLAY) {
      if (snap.overlay.open && snap.overlay.currentSite) {
        GLOBE_OVERLAY.open(snap.overlay.currentSite);
        console.log(`📋 Overlay opened: ${snap.overlay.currentSite}`);
      } else if (!snap.overlay.open && GLOBE_OVERLAY.isOpen()) {
        GLOBE_OVERLAY.close();
        console.log(`📋 Overlay closed`);
      }
    }

    console.groupEnd();
    return true;
  }

  // ── List snapshots ──
  function list() {
    const snaps = _getSnapshots();
    const keys = Object.keys(snaps);
    if (keys.length === 0) {
      console.log('[StateSnap] No snapshots saved. Use StateSnap.save("label") to create one.');
      return [];
    }
    console.group('%c📸 SAVED SNAPSHOTS', 'color: #4ecdc4; font-weight: bold;');
    console.table(keys.map(k => ({
      Label: k,
      Time: snaps[k].timestamp,
      Scroll: snaps[k].scroll.y + 'px',
      Section: snaps[k].activeSection,
      Overlay: snaps[k].overlay?.open ? `OPEN (${snaps[k].overlay.currentSite})` : 'closed',
    })));
    console.groupEnd();
    return keys;
  }

  // ── Compare two snapshots ──
  function compare(labelA, labelB) {
    const snaps = _getSnapshots();
    const a = snaps[labelA];
    const b = snaps[labelB];
    if (!a || !b) {
      console.warn(`[StateSnap] Missing snapshot. Available:`, Object.keys(snaps));
      return;
    }

    console.group(`%c🔄 COMPARING: "${labelA}" vs "${labelB}"`, 'color: #ffd700; font-weight: bold;');

    // Diff scroll
    if (a.scroll.y !== b.scroll.y) {
      console.log(`📜 Scroll: ${a.scroll.y}px → ${b.scroll.y}px`);
    }

    // Diff element classes
    const allIds = new Set([...Object.keys(a.classes || {}), ...Object.keys(b.classes || {})]);
    for (const id of allIds) {
      const classA = (a.classes?.[id] || []).sort().join(' ');
      const classB = (b.classes?.[id] || []).sort().join(' ');
      if (classA !== classB) {
        console.log(`🧩 ${id}: "${classA}" → "${classB}"`);
      }
    }

    // Diff styles
    for (const id of allIds) {
      const sA = a.styles?.[id] || {};
      const sB = b.styles?.[id] || {};
      for (const prop of ['display', 'visibility', 'opacity', 'pointerEvents', 'zIndex']) {
        if (sA[prop] !== sB[prop]) {
          console.log(`  🎨 ${id}.${prop}: ${sA[prop]} → ${sB[prop]}`);
        }
      }
    }

    // Diff overlay
    if (a.overlay?.open !== b.overlay?.open) {
      console.log(`📋 Overlay: ${a.overlay?.open ? 'open' : 'closed'} → ${b.overlay?.open ? 'open' : 'closed'}`);
    }
    if (a.overlay?.currentSite !== b.overlay?.currentSite) {
      console.log(`📋 Overlay site: ${a.overlay?.currentSite} → ${b.overlay?.currentSite}`);
    }

    // Diff active section
    if (a.activeSection !== b.activeSection) {
      console.log(`📍 Section: ${a.activeSection} → ${b.activeSection}`);
    }

    console.groupEnd();
  }

  // ── Export/Import ──
  function exportSnaps() {
    const json = JSON.stringify(_getSnapshots(), null, 2);
    console.log(`[StateSnap] Export (${json.length} chars). Copy the returned string.`);
    return json;
  }

  function importSnaps(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      const current = _getSnapshots();
      const merged = { ...current, ...data };
      _setSnapshots(merged);
      console.log(`[StateSnap] Imported ${Object.keys(data).length} snapshots. Total: ${Object.keys(merged).length}`);
    } catch (err) {
      console.error('[StateSnap] Import failed:', err.message);
    }
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[StateSnap] All snapshots cleared');
  }

  return { save, restore, list, compare, export: exportSnaps, import: importSnaps, clear };
})();
window.StateSnap = StateSnap;
