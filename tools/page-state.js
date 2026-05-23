/**
 * DOM STATE SERIALIZER (PageState)
 * Gives agents "eyes" — dumps the current visual state as structured text.
 * 
 * Console commands:
 *   PageState.dump()        — full visual state summary
 *   PageState.elements()    — detailed element inventory
 *   PageState.overlaps()    — what's overlapping what at every viewport quadrant
 *   PageState.scroll()      — scroll position context
 *   PageState.json()        — machine-readable JSON for agent consumption
 */

const PageState = (() => {

  // ── Full visual state dump ──
  function dump() {
    const state = _buildState();
    
    console.group('%c📸 PAGE STATE', 'color: #4ecdc4; font-weight: bold; font-size: 14px;');
    
    // App phase
    const hero = document.getElementById('hero');
    const heroHidden = hero && hero.classList.contains('hidden');
    const phase = heroHidden ? 'EXPLORING' : 'HERO';
    console.log(`%c🎯 Phase: ${phase}`, 'font-weight: bold; font-size: 12px;');

    // Scroll position
    const scrollY = window.scrollY;
    const scrollMax = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPct = scrollMax > 0 ? Math.round(scrollY / scrollMax * 100) : 0;
    console.log(`📜 Scroll: ${scrollY}px / ${scrollMax}px (${scrollPct}%)`);

    // Active section
    const sections = document.querySelectorAll('.section');
    let activeSection = 'none';
    sections.forEach(s => {
      const rect = s.getBoundingClientRect();
      if (rect.top < window.innerHeight / 2 && rect.bottom > window.innerHeight / 2) {
        activeSection = s.id || s.className;
      }
    });
    console.log(`📍 Active Section: ${activeSection}`);

    // Key element states
    console.group('🧩 Element States');
    const elements = [
      { id: 'hero', label: 'Hero' },
      { id: 'topbar', label: 'Topbar' },
      { id: 'globeViz', label: 'Globe' },
      { id: 'globe-overlay', label: 'Globe Overlay (sidebar)' },
      { id: 'site-panel', label: 'Site Panel (right)' },
      { id: 'panel-backdrop', label: 'Panel Backdrop' },
      { id: 'gaia-bubble', label: 'GAIA Bubble' },
      { id: 'pledge-modal', label: 'Pledge Modal' },
    ];

    elements.forEach(e => {
      const el = document.getElementById(e.id);
      if (!el) {
        console.log(`  ⬜ ${e.label}: not in DOM`);
        return;
      }
      const s = getComputedStyle(el);
      const visible = s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.1;
      const interactive = s.pointerEvents !== 'none';
      const hasOpen = el.classList.contains('open');
      const hasHidden = el.classList.contains('hidden');
      const hasVisible = el.classList.contains('visible');
      
      const status = [];
      if (visible) status.push('visible');
      else status.push('hidden');
      if (interactive) status.push('interactive');
      else status.push('pe:none');
      if (hasOpen) status.push('.open');
      if (hasHidden) status.push('.hidden');
      if (hasVisible) status.push('.visible');
      
      const icon = visible && interactive ? '🟢' : visible ? '🟡' : '⚫';
      console.log(`  ${icon} ${e.label}: ${status.join(' | ')} [z:${s.zIndex}, ${el.offsetWidth}×${el.offsetHeight}]`);
    });
    console.groupEnd();

    // Globe state
    if (window.GlobeModule && GlobeModule.world) {
      console.group('🌍 Globe State');
      const pov = GlobeModule.world.pointOfView();
      console.log(`  POV: lat=${pov.lat?.toFixed(1)}, lng=${pov.lng?.toFixed(1)}, alt=${pov.altitude?.toFixed(2)}`);
      const points = GlobeModule.world.pointsData();
      console.log(`  Points: ${points?.length || 0} (${points?.filter(p => p._type === 'site').length || 0} sites, ${points?.filter(p => p._type === 'pledge').length || 0} pledges)`);
      const autoRotate = GlobeModule.world.controls()?.autoRotate;
      console.log(`  Auto-rotate: ${autoRotate}`);
      console.groupEnd();
    }

    // Overlay state
    if (window.GLOBE_OVERLAY) {
      console.group('📋 Overlay State');
      console.log(`  Open: ${GLOBE_OVERLAY.isOpen()}`);
      console.log(`  Current Site: ${GLOBE_OVERLAY.getCurrentSite() || 'none'}`);
      console.groupEnd();
    }

    // GAIA state
    if (window.GAIA_ENGAGEMENT) {
      console.group('🧠 GAIA State');
      const arch = safeGet('GAIA_ENGAGEMENT', 'getArchetype', 'unknown');
      const score = safeGet('GAIA_ENGAGEMENT', 'getScore', 0);
      console.log(`  Archetype: ${arch}`);
      console.log(`  Engagement Score: ${score}`);
      console.groupEnd();
    }

    console.groupEnd();
    return state;
  }

  // ── What element receives clicks at each viewport quadrant ──
  function overlaps() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    
    const points = [
      { name: 'Top-Left',      x: Math.floor(w * 0.1),  y: Math.floor(h * 0.1) },
      { name: 'Top-Center',    x: Math.floor(w * 0.5),  y: Math.floor(h * 0.1) },
      { name: 'Top-Right',     x: Math.floor(w * 0.9),  y: Math.floor(h * 0.1) },
      { name: 'Center-Left',   x: Math.floor(w * 0.1),  y: Math.floor(h * 0.5) },
      { name: 'Center',        x: Math.floor(w * 0.5),  y: Math.floor(h * 0.5) },
      { name: 'Center-Right',  x: Math.floor(w * 0.9),  y: Math.floor(h * 0.5) },
      { name: 'Bottom-Left',   x: Math.floor(w * 0.1),  y: Math.floor(h * 0.9) },
      { name: 'Bottom-Center', x: Math.floor(w * 0.5),  y: Math.floor(h * 0.9) },
      { name: 'Bottom-Right',  x: Math.floor(w * 0.9),  y: Math.floor(h * 0.9) },
    ];

    console.group('%c🎯 CLICK COVERAGE MAP', 'color: #ffd700; font-weight: bold;');
    
    const results = points.map(p => {
      const stack = document.elementsFromPoint(p.x, p.y);
      const top = stack[0];
      const topLabel = top ? _label(top) : 'null';
      const pe = top ? getComputedStyle(top).pointerEvents : 'n/a';
      const fixed = stack.filter(el => getComputedStyle(el).position === 'fixed').map(_label);
      
      return {
        Position: p.name,
        'Click Target': topLabel,
        PE: pe,
        'Fixed Stack': fixed.join(' > ') || 'none',
      };
    });

    console.table(results);
    console.groupEnd();
    return results;
  }

  // ── Scroll context ──
  function scroll() {
    const scrollY = window.scrollY;
    const vh = window.innerHeight;
    const scrollMax = document.documentElement.scrollHeight - vh;
    const pct = scrollMax > 0 ? Math.round(scrollY / scrollMax * 100) : 0;

    const sections = [];
    document.querySelectorAll('.section').forEach(s => {
      const rect = s.getBoundingClientRect();
      const vis = rect.top < vh && rect.bottom > 0;
      if (vis) {
        const visiblePct = Math.round(
          Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0)) / vh * 100
        );
        sections.push({
          id: s.id || s.className.split(' ')[0],
          top: Math.round(rect.top),
          visible: `${visiblePct}%`,
        });
      }
    });

    console.group('%c📜 SCROLL STATE', 'color: #4ecdc4; font-weight: bold;');
    console.log(`Position: ${scrollY}px / ${scrollMax}px (${pct}%)`);
    console.log(`Viewport: ${window.innerWidth}×${vh}`);
    console.log(`Globe interaction: ${scrollY < vh * 0.3 ? '🟢 ACTIVE' : '⚫ DISABLED'}`);
    if (sections.length > 0) {
      console.table(sections);
    } else {
      console.log('No sections visible (hero phase or scrolled past all)');
    }
    console.groupEnd();
  }

  // ── Machine-readable JSON for agent consumption ──
  function json() {
    return JSON.stringify(_buildState(), null, 2);
  }

  // ── Build structured state ──
  function _buildState() {
    const hero = document.getElementById('hero');
    const heroHidden = hero && hero.classList.contains('hidden');
    const scrollY = window.scrollY;
    const vh = window.innerHeight;

    return {
      phase: heroHidden ? 'exploring' : 'hero',
      viewport: { width: window.innerWidth, height: vh },
      scroll: {
        y: scrollY,
        max: document.documentElement.scrollHeight - vh,
        pct: Math.round(scrollY / Math.max(1, document.documentElement.scrollHeight - vh) * 100),
        globeInteractive: scrollY < vh * 0.3,
      },
      elements: {
        hero: _elState('hero'),
        topbar: _elState('topbar'),
        globeViz: _elState('globeViz'),
        globeOverlay: _elState('globe-overlay'),
        sitePanel: _elState('site-panel'),
        panelBackdrop: _elState('panel-backdrop'),
        gaiaBubble: _elState('gaia-bubble'),
        pledgeModal: _elState('pledge-modal'),
      },
      globe: window.GlobeModule && GlobeModule.world ? {
        pov: GlobeModule.world.pointOfView(),
        pointCount: GlobeModule.world.pointsData()?.length || 0,
        autoRotate: GlobeModule.world.controls()?.autoRotate || false,
      } : null,
      overlay: window.GLOBE_OVERLAY ? {
        open: GLOBE_OVERLAY.isOpen(),
        currentSite: GLOBE_OVERLAY.getCurrentSite(),
      } : null,
      gaia: {
        archetype: safeGet('GAIA_ENGAGEMENT', 'getArchetype', null),
        score: safeGet('GAIA_ENGAGEMENT', 'getScore', 0),
      },
    };
  }

  function _elState(id) {
    const el = document.getElementById(id);
    if (!el) return { exists: false };
    const s = getComputedStyle(el);
    return {
      exists: true,
      visible: s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.1,
      interactive: s.pointerEvents !== 'none',
      classes: [...el.classList].join(' '),
      zIndex: s.zIndex,
      size: `${el.offsetWidth}×${el.offsetHeight}`,
      display: s.display,
      opacity: parseFloat(s.opacity),
      pointerEvents: s.pointerEvents,
    };
  }

  function _label(el) {
    if (!el) return '(null)';
    let l = el.tagName;
    if (el.id) l += '#' + el.id;
    else if (el.className && typeof el.className === 'string') l += '.' + el.className.split(' ')[0];
    return l;
  }

  return { dump, overlaps, scroll, json, elements: () => _buildState().elements };
})();
window.PageState = PageState;
