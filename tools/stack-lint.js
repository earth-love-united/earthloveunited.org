/**
 * CSS STACKING LINTER
 * Deep audit of position:fixed/absolute elements, pointer-events cascading,
 * z-index conflicts, and stacking context traps.
 *
 * Run in browser console:   StackLint.audit()
 * Quick check:              StackLint.quick()
 * Watch mode:               StackLint.watch()   (re-audits every 3s)
 * Stop watch:               StackLint.unwatch()
 */

const StackLint = (() => {
  let _watchInterval = null;

  // ── Known z-index assignments (from ARCHITECTURE.md) ──
  const Z_INDEX_MAP = {
    '#globeViz': 1,
    '.sections': 10,
    '#globe-overlay': 50,
    '#panel-backdrop': 85,
    '.site-panel-overlay': 85,
    '#site-panel': 90,
    '#topbar': 100,
    '#hero': 200,
    '#gaia-bubble': 200,
    '#pledge-modal': 300,
    '#pledge-wall': 300,
    '#scroll-progress': 1000,
    '#pledge-tooltip': 1000,
  };

  // ── Full audit ──
  function audit() {
    console.group('%c🔍 CSS STACKING AUDIT', 'color: #ffd700; font-weight: bold; font-size: 14px;');

    const issues = [];

    // 1. Fixed element inventory
    console.group('📋 Fixed/Absolute Element Inventory');
    const positioned = [];
    document.querySelectorAll('*').forEach(el => {
      const s = getComputedStyle(el);
      if (s.position === 'fixed' || s.position === 'absolute') {
        const entry = {
          element: _label(el),
          node: el,
          position: s.position,
          zIndex: s.zIndex === 'auto' ? 'auto' : parseInt(s.zIndex),
          pointerEvents: s.pointerEvents,
          display: s.display,
          opacity: parseFloat(s.opacity),
          width: el.offsetWidth,
          height: el.offsetHeight,
          parent: _label(el.parentElement),
          visible: s.display !== 'none' && s.visibility !== 'hidden',
        };
        positioned.push(entry);
      }
    });

    // Sort by z-index descending
    positioned.sort((a, b) => {
      const zA = typeof a.zIndex === 'number' ? a.zIndex : -1;
      const zB = typeof b.zIndex === 'number' ? b.zIndex : -1;
      return zB - zA;
    });

    console.table(positioned.map(p => ({
      Element: p.element,
      Pos: p.position,
      'Z': p.zIndex,
      PE: p.pointerEvents,
      Display: p.display,
      Opacity: p.opacity,
      Size: `${p.width}×${p.height}`,
      Parent: p.parent,
    })));
    console.groupEnd();

    // 2. Invisible blocker detection
    console.group('🚫 Invisible Blocker Scan');
    let blockerCount = 0;
    positioned.forEach(p => {
      if (
        p.visible &&
        p.pointerEvents !== 'none' &&
        p.opacity < 0.1 &&
        p.width > window.innerWidth * 0.5 &&
        p.height > window.innerHeight * 0.5
      ) {
        blockerCount++;
        console.error(`🔴 INVISIBLE BLOCKER: ${p.element}`,
          `z:${p.zIndex} pe:${p.pointerEvents} opacity:${p.opacity} ${p.width}×${p.height}`);
        issues.push({ type: 'blocker', element: p.element, severity: 'critical' });
      }
    });
    if (blockerCount === 0) console.log('✅ No invisible blockers found');
    console.groupEnd();

    // 3. Stacking context traps
    console.group('🪤 Stacking Context Trap Detection');
    const traps = [];
    positioned.filter(p => p.position === 'fixed').forEach(p => {
      const el = p.node;
      if (!el) return;

      // Check if this fixed element is inside another fixed element
      let parent = el.parentElement;
      while (parent && parent !== document.documentElement) {
        const ps = getComputedStyle(parent);
        if (ps.position === 'fixed' && parent !== el) {
          const parentZ = parseInt(ps.zIndex) || 0;
          const childZ = typeof p.zIndex === 'number' ? p.zIndex : 0;
          if (childZ > parentZ) {
            traps.push({
              child: p.element,
              parent: _label(parent),
              childZ,
              parentZ,
              issue: `Child z:${childZ} > parent z:${parentZ} but child is TRAPPED inside parent's stacking context`,
            });
          }
        }
        parent = parent.parentElement;
      }
    });

    if (traps.length > 0) {
      traps.forEach(t => {
        console.warn(`⚠️ TRAP: ${t.child} (z:${t.childZ}) inside ${t.parent} (z:${t.parentZ})`);
        console.warn(`   → ${t.issue}`);
        issues.push({ type: 'trap', ...t, severity: 'warning' });
      });
    } else {
      console.log('✅ No stacking context traps detected');
    }
    console.groupEnd();

    // 4. Pointer-events cascade check
    console.group('👆 Pointer-Events Cascade');
    const peIssues = [];
    positioned.filter(p => p.visible && p.position === 'fixed').forEach(p => {
      // Check if parent has pe:none but child has pe:auto
      // This is VALID CSS but worth flagging for awareness
      const el = document.getElementById(p.element.replace('#', ''));
      if (!el) return;

      if (p.pointerEvents === 'auto') {
        let parent = el.parentElement;
        while (parent && parent !== document.documentElement) {
          const ps = getComputedStyle(parent);
          if (ps.pointerEvents === 'none') {
            peIssues.push({
              element: p.element,
              parent: _label(parent),
              note: 'Child has pe:auto but parent has pe:none — child OVERRIDES parent (intentional?)',
            });
            break;
          }
          parent = parent.parentElement;
        }
      }
    });

    if (peIssues.length > 0) {
      peIssues.forEach(i => console.log(`ℹ️ ${i.element} overrides parent ${i.parent} pointer-events`));
    } else {
      console.log('✅ No pointer-events cascade conflicts');
    }
    console.groupEnd();

    // 5. Z-index drift check (compare actual vs ARCHITECTURE.md expected)
    console.group('📐 Z-Index Drift (vs ARCHITECTURE.md)');
    let driftCount = 0;
    for (const [selector, expectedZ] of Object.entries(Z_INDEX_MAP)) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const actualZ = parseInt(getComputedStyle(el).zIndex) || 0;
      if (actualZ !== expectedZ) {
        driftCount++;
        console.warn(`⚠️ ${selector}: expected z:${expectedZ}, actual z:${actualZ}`);
        issues.push({ type: 'drift', element: selector, expected: expectedZ, actual: actualZ, severity: 'warning' });
      }
    }
    if (driftCount === 0) console.log('✅ All z-indices match ARCHITECTURE.md');
    console.groupEnd();

    // 6. Click coverage map (what element receives clicks at key viewport positions)
    console.group('🎯 Click Coverage Map');
    const testPoints = [
      { name: 'Top-Left', x: 50, y: 50 },
      { name: 'Top-Center', x: Math.floor(window.innerWidth / 2), y: 50 },
      { name: 'Center', x: Math.floor(window.innerWidth / 2), y: Math.floor(window.innerHeight / 2) },
      { name: 'Bottom-Center', x: Math.floor(window.innerWidth / 2), y: window.innerHeight - 50 },
      { name: 'Right-Center', x: window.innerWidth - 50, y: Math.floor(window.innerHeight / 2) },
    ];
    const coverage = testPoints.map(p => {
      const el = document.elementFromPoint(p.x, p.y);
      const s = el ? getComputedStyle(el) : {};
      return {
        Position: p.name,
        '(x,y)': `(${p.x},${p.y})`,
        Target: el ? _label(el) : 'null',
        PE: s.pointerEvents || 'n/a',
        Z: s.zIndex || 'n/a',
      };
    });
    console.table(coverage);
    console.groupEnd();

    // Summary
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    if (criticalCount > 0) {
      console.error(`\n🔴 ${criticalCount} CRITICAL issues, ${warningCount} warnings`);
    } else if (warningCount > 0) {
      console.warn(`\n🟡 ${warningCount} warnings, no critical issues`);
    } else {
      console.log(`\n%c✅ STACKING AUDIT CLEAN`, 'color: #4ecdc4; font-weight: bold; font-size: 14px;');
    }

    console.groupEnd();
    return issues;
  }

  // ── Quick check (silent unless issues found) ──
  function quick() {
    let issues = 0;

    // Invisible blockers
    document.querySelectorAll('*').forEach(el => {
      const s = getComputedStyle(el);
      if (
        s.position === 'fixed' &&
        s.pointerEvents !== 'none' &&
        s.display !== 'none' &&
        parseFloat(s.opacity) < 0.1 &&
        el.offsetWidth > window.innerWidth * 0.8 &&
        el.offsetHeight > window.innerHeight * 0.8
      ) {
        console.error(`🔴 [StackLint] Invisible blocker: ${_label(el)}`);
        issues++;
      }
    });

    // Globe-overlay inside globeViz
    const overlay = document.getElementById('globe-overlay');
    if (overlay && overlay.closest('#globeViz')) {
      console.error('🔴 [StackLint] #globe-overlay inside #globeViz — stacking trap!');
      issues++;
    }

    // Site panel pointer-events
    const panel = document.getElementById('site-panel');
    if (panel && !panel.classList.contains('open') && getComputedStyle(panel).pointerEvents !== 'none') {
      console.error('🔴 [StackLint] #site-panel has pointer-events when closed!');
      issues++;
    }

    if (issues === 0) {
      console.log('%c✅ [StackLint] Quick check passed', 'color: #4ecdc4');
    }
    return issues;
  }

  // ── Watch mode — re-run quick check every 3s ──
  function watch() {
    if (_watchInterval) {
      console.log('[StackLint] Already watching');
      return;
    }
    console.log('%c👁️ [StackLint] Watch mode ON — checking every 3s', 'color: #ffd700');
    _watchInterval = setInterval(quick, 3000);
  }

  function unwatch() {
    if (_watchInterval) {
      clearInterval(_watchInterval);
      _watchInterval = null;
      console.log('[StackLint] Watch mode OFF');
    }
  }

  // ── Helpers ──
  function _label(el) {
    if (!el) return '(null)';
    return el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
  }

  return { audit, quick, watch, unwatch };
})();
window.StackLint = StackLint;
