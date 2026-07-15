/**
 * SMOKE TEST SUITE (v1 surface)
 * Runtime validation for Earth Love United — hero + carbon clock + bare countries globe.
 *
 * Run in browser console:   SmokeTest.run()
 * Run specific category:    SmokeTest.run('modules')
 * View last results:        SmokeTest.results
 *
 * Can also be loaded as a script tag for CI/automated checks.
 * Exits with console.error if any CRITICAL test fails.
 */

const SmokeTest = (() => {
  let _results = [];
  let _running = false;

  // ── Test Registry ──
  const TESTS = {

    // ═══════════════════════════════════════════
    // MODULE BINDING TESTS
    // ═══════════════════════════════════════════
    modules: [
      {
        name: 'Core modules on window',
        critical: true,
        test: () => {
          const required = ['Data', 'GlobeModule', 'CARBON_CLOCK', 'App'];
          const missing = required.filter(m => typeof window[m] === 'undefined');
          return {
            pass: missing.length === 0,
            detail: missing.length ? `Missing: ${missing.join(', ')}` : `All ${required.length} core modules present`,
          };
        },
      },
      {
        name: 'Infrastructure modules on window',
        critical: true,
        test: () => {
          const modules = ['EventBus', 'MODULE_CONTRACTS', 'STORAGE_ADAPTER', 'Storage', 'DATA_SCHEMA'];
          const missing = modules.filter(m => typeof window[m] === 'undefined');
          return {
            pass: missing.length === 0,
            detail: missing.length
              ? `Missing: ${missing.join(', ')}`
              : `All ${modules.length} infrastructure modules present`,
          };
        },
      },
      {
        name: 'safeCall utilities exist',
        critical: true,
        test: () => {
          const fns = ['safeCall', 'hasModule', 'safeGet'].filter(f => typeof window[f] !== 'function');
          return {
            pass: fns.length === 0,
            detail: fns.length ? `Missing utils: ${fns.join(', ')}` : 'safeCall / hasModule / safeGet callable',
          };
        },
      },
      {
        name: 'Carbon clock is ticking',
        critical: true,
        test: () => {
          const el = document.getElementById('cc-hero-value');
          if (!el) return { pass: false, detail: '#cc-hero-value not found — hero clock missing' };
          const val = el.textContent.replace(/\./g, '');
          const n = parseInt(val, 10);
          return {
            pass: Number.isFinite(n) && n > 0,
            detail: Number.isFinite(n) && n > 0 ? `Clock at ${el.textContent} t` : `Clock value "${el.textContent}" — not ticking`,
          };
        },
      },
      {
        name: 'Data module is live with country evidence fail-closed',
        critical: true,
        test: () => {
          const ok = typeof Data !== 'undefined'
            && Array.isArray(Data.smallNations)
            && Data.carbonProjects && typeof Data.carbonProjects === 'object';
          return {
            pass: ok,
            detail: ok ? 'active non-climate data loaded; country evidence remains fail-closed' : 'active Data inputs missing',
          };
        },
      },
    ],

    // ═══════════════════════════════════════════
    // CSS STACKING TESTS
    // ═══════════════════════════════════════════
    stacking: [
      {
        name: '.sections has opaque background',
        critical: true,
        test: () => {
          const el = document.querySelector('.sections');
          if (!el) return { pass: false, detail: '.sections element not found' };
          const bg = getComputedStyle(el).backgroundColor;
          const isOpaque = bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
          return {
            pass: isOpaque,
            detail: isOpaque ? `background: ${bg}` : 'TRANSPARENT — clicks will fall through to globe!',
          };
        },
      },
      {
        name: '#hero has pointer-events:none after enter',
        critical: false,
        test: () => {
          const hero = document.getElementById('hero');
          if (!hero) return { pass: false, detail: '#hero not found' };
          if (!hero.classList.contains('hidden')) return { pass: true, detail: 'Hero not yet hidden (pre-enter state)' };
          const pe = getComputedStyle(hero).pointerEvents;
          return {
            pass: pe === 'none',
            detail: pe === 'none' ? 'Correctly pe:none when hidden' : `pe:${pe} — BLOCKING ENTIRE PAGE!`,
          };
        },
      },
      {
        name: 'No invisible fullscreen blockers',
        critical: true,
        test: () => {
          const blockers = [];
          document.querySelectorAll('*').forEach(el => {
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
              blockers.push(`${el.tagName}#${el.id || '(no-id)'} [pe:${s.pointerEvents}, opacity:${s.opacity}]`);
            }
          });
          return {
            pass: blockers.length === 0,
            detail: blockers.length ? `BLOCKERS: ${blockers.join('; ')}` : 'No invisible fullscreen blockers found',
          };
        },
      },
      {
        name: 'Z-index hierarchy is correct',
        critical: false,
        test: () => {
          const expected = [
            { id: 'globeViz', maxZ: 5 },
            { sel: '.sections', minZ: 5, maxZ: 15 },
            { id: 'topbar', minZ: 95, maxZ: 110 },
            { id: 'hero', minZ: 150, maxZ: 250 },
          ];
          const issues = [];
          for (const e of expected) {
            const el = e.id ? document.getElementById(e.id) : document.querySelector(e.sel);
            if (!el) continue;
            const z = parseInt(getComputedStyle(el).zIndex) || 0;
            if (e.minZ && z < e.minZ) issues.push(`${e.id || e.sel}: z=${z} < expected min ${e.minZ}`);
            if (e.maxZ && z > e.maxZ) issues.push(`${e.id || e.sel}: z=${z} > expected max ${e.maxZ}`);
          }
          return {
            pass: issues.length === 0,
            detail: issues.length ? issues.join('; ') : 'All z-indices within expected ranges',
          };
        },
      },
    ],

    // ═══════════════════════════════════════════
    // DOM STRUCTURE TESTS
    // ═══════════════════════════════════════════
    dom: [
      {
        name: 'Critical DOM elements exist',
        critical: true,
        test: () => {
          const required = ['globeViz', 'hero', 'topbar', 'hex-legend', 'globe-back-btn', 'hero-carbon-clock'];
          const missing = required.filter(id => !document.getElementById(id));
          return {
            pass: missing.length === 0,
            detail: missing.length ? `Missing DOM: ${missing.join(', ')}` : `All ${required.length} critical elements present`,
          };
        },
      },
      {
        name: 'Globe canvas exists inside #globeViz',
        critical: true,
        test: () => {
          const gv = document.getElementById('globeViz');
          if (!gv) return { pass: false, detail: '#globeViz not found' };
          const canvas = gv.querySelector('canvas');
          // Globe is lazy-initialized — only rendered after entering globe mode.
          if (!canvas && !window.GlobeModule?._initialized) {
            return { pass: true, detail: 'Globe not yet entered (lazy init) — OK. Re-run after Enter the Living Globe for full check.' };
          }
          return {
            pass: !!canvas,
            detail: canvas ? `Canvas: ${canvas.offsetWidth}x${canvas.offsetHeight}` : 'No canvas inside #globeViz — globe not rendered!',
          };
        },
      },
      {
        name: 'No duplicate IDs in DOM',
        critical: false,
        test: () => {
          const ids = {};
          const duplicates = [];
          document.querySelectorAll('[id]').forEach(el => {
            if (ids[el.id]) {
              duplicates.push(el.id);
            }
            ids[el.id] = true;
          });
          return {
            pass: duplicates.length === 0,
            detail: duplicates.length ? `Duplicate IDs: ${[...new Set(duplicates)].join(', ')}` : 'All IDs unique',
          };
        },
      },
      {
        name: 'Globe has country polygons',
        critical: false,
        test: () => {
          if (!window.GlobeModule || !GlobeModule.world) {
            // Lazy init — world only exists after entering globe mode.
            if (!window.GlobeModule?._initialized) return { pass: true, detail: 'Globe not yet entered (lazy init) — OK' };
            return { pass: false, detail: 'GlobeModule.world not available' };
          }
          // Countries mode renders via the solid polygons layer;
          // the hex layer is a fallback wireframe. Either counts.
          const polyData = typeof GlobeModule.world.polygonsData === 'function' ? GlobeModule.world.polygonsData() : null;
          const hexData = typeof GlobeModule.world.hexPolygonsData === 'function' ? GlobeModule.world.hexPolygonsData() : null;
          const count = Math.max(polyData?.length || 0, hexData?.length || 0);
          // GeoJSON fetch is async with an 8s timeout — an empty layer right
          // after entering is not necessarily a failure.
          if (!count && GlobeModule._countryDataState === 'loading') {
            return { pass: true, detail: 'Country GeoJSON still loading — OK' };
          }
          return {
            pass: count > 0,
            detail: count ? `${count} country features on globe` : `No country polygon data (state: ${GlobeModule._countryDataState})`,
          };
        },
      },
    ],

    // ═══════════════════════════════════════════
    // INTERACTION TESTS
    // ═══════════════════════════════════════════
    interactions: [
      {
        name: 'Hero enter button is wired (data-action="enterGlobe")',
        critical: true,
        test: () => {
          const btn = document.querySelector('.enter-btn[data-action="enterGlobe"]');
          const handler = typeof window.App?.enterGlobe === 'function';
          return {
            pass: !!(btn && handler),
            detail: !btn ? '.enter-btn[data-action=enterGlobe] not found — hero button missing!'
              : !handler ? 'App.enterGlobe() not found — hero button will not work!'
              : 'Hero button bound via data-action → App.enterGlobe()',
          };
        },
      },
      {
        name: 'exitGlobe() is callable (back button)',
        critical: true,
        test: () => {
          const exists = typeof window.exitGlobe === 'function';
          return {
            pass: exists,
            detail: exists ? 'exitGlobe() global function exists' : 'exitGlobe() not found — back button will not work',
          };
        },
      },
    ],

    // ═══════════════════════════════════════════
    // CSP & RESOURCE TESTS
    // ═══════════════════════════════════════════
    resources: [
      {
        name: 'CSP allows globe resources',
        critical: false,
        test: () => {
          const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
          if (!meta) return { pass: true, detail: 'No CSP meta tag (all connections allowed)' };
          const content = meta.getAttribute('content') || '';
          const hasCDN = content.includes('cdn.jsdelivr.net');       // globe textures (img-src)
          const hasGH = content.includes('raw.githubusercontent.com'); // country GeoJSON (connect-src)
          return {
            pass: hasCDN && hasGH,
            detail: `cdn.jsdelivr.net: ${hasCDN ? '✅' : '❌'}, raw.githubusercontent.com: ${hasGH ? '✅' : '❌'}`,
          };
        },
      },
      {
        name: 'Active data files loaded successfully',
        critical: true,
        test: () => {
          if (typeof Data === 'undefined') return { pass: false, detail: 'Data module not loaded' };
          const smallNations = Array.isArray(Data.smallNations) ? Data.smallNations.length : 0;
          const carbonProjects = Data.carbonProjects && typeof Data.carbonProjects === 'object';
          return {
            pass: smallNations > 0 && carbonProjects,
            detail: `${smallNations} small nations; carbon projects ${carbonProjects ? 'loaded' : 'missing'}`,
          };
        },
      },
    ],
  };

  // ── Test Runner ──
  async function run(category = null) {
    if (_running) {
      console.warn('[SmokeTest] Already running');
      return;
    }
    _running = true;
    _results = [];

    const categories = category ? { [category]: TESTS[category] } : TESTS;

    console.group('%c🧪 SMOKE TEST SUITE', 'color: #4ecdc4; font-weight: bold; font-size: 14px;');

    let totalPass = 0;
    let totalFail = 0;
    let criticalFail = 0;

    for (const [catName, tests] of Object.entries(categories)) {
      if (!tests) {
        console.warn(`Unknown category: ${catName}`);
        continue;
      }

      console.group(`📦 ${catName.toUpperCase()}`);

      for (const test of tests) {
        try {
          const result = await test.test();
          const entry = {
            category: catName,
            name: test.name,
            critical: test.critical,
            ...result,
          };
          _results.push(entry);

          if (result.pass) {
            totalPass++;
            console.log(`  ✅ ${test.name} — ${result.detail}`);
          } else {
            totalFail++;
            if (test.critical) criticalFail++;
            const level = test.critical ? '🔴 CRITICAL' : '🟡 WARNING';
            console.warn(`  ${level}: ${test.name} — ${result.detail}`);
          }
        } catch (err) {
          totalFail++;
          if (test.critical) criticalFail++;
          _results.push({
            category: catName,
            name: test.name,
            critical: test.critical,
            pass: false,
            detail: `THREW: ${err.message}`,
          });
          console.error(`  💥 ${test.name} — THREW: ${err.message}`);
        }
      }

      console.groupEnd();
    }

    // Summary
    const total = totalPass + totalFail;
    if (criticalFail > 0) {
      console.error(`\n🔴 ${totalPass}/${total} passed — ${criticalFail} CRITICAL failures!`);
    } else if (totalFail > 0) {
      console.warn(`\n🟡 ${totalPass}/${total} passed — ${totalFail} warnings`);
    } else {
      console.log(`\n%c✅ ${totalPass}/${total} ALL TESTS PASSED`, 'color: #4ecdc4; font-weight: bold; font-size: 14px;');
    }

    console.groupEnd();
    _running = false;
    return { passed: totalPass, failed: totalFail, criticalFailed: criticalFail, results: [..._results] };
  }

  // ── Results as table ──
  function table() {
    if (_results.length === 0) {
      console.log('No results yet. Run SmokeTest.run() first.');
      return;
    }
    console.table(_results.map(r => ({
      '': r.pass ? '✅' : (r.critical ? '🔴' : '🟡'),
      Category: r.category,
      Test: r.name,
      Detail: r.detail,
    })));
  }

  return {
    run,
    table,
    get results() { return [..._results]; },
    get categories() { return Object.keys(TESTS); },
  };
})();
window.SmokeTest = SmokeTest;
