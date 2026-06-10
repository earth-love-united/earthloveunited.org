/**
 * SMOKE TEST SUITE
 * Comprehensive runtime validation for Earth Love United.
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
          const required = ['GLOBE_OVERLAY', 'GAIA_NODES', 'SITE_PANEL', 'PLEDGE_PANEL'];
          const missing = required.filter(m => typeof window[m] === 'undefined');
          return {
            pass: missing.length === 0,
            detail: missing.length ? `Missing: ${missing.join(', ')}` : `All ${required.length} core modules present`,
          };
        },
      },
      {
        name: 'GAIA modules on window',
        critical: false,
        test: () => {
          const modules = ['GAIA_BUBBLE', 'GAIA_VOICE', 'GAIA_ENGAGEMENT', 'GAIA_PRESENCE',
                           'GAIA_JOURNAL', 'GAIA_KNOWLEDGE', 'GAIA_CHARTS', 'GAIA_DATA'];
          const missing = modules.filter(m => typeof window[m] === 'undefined');
          return {
            pass: missing.length === 0,
            detail: missing.length
              ? `Missing: ${missing.join(', ')} (${modules.length - missing.length}/${modules.length} loaded)`
              : `All ${modules.length} GAIA modules present`,
          };
        },
      },
      {
        name: 'Utility modules on window',
        critical: false,
        test: () => {
          const modules = ['CARBON_CLOCK', 'PLEDGE_WALL', 'NDVIVerifier', 'RegistryCheck',
                           'COUNTRY_DATA', 'DELEGATION'];
          const missing = modules.filter(m => typeof window[m] === 'undefined');
          return {
            pass: missing.length === 0,
            detail: missing.length
              ? `Missing: ${missing.join(', ')}`
              : `All ${modules.length} utility modules present`,
          };
        },
      },
      {
        name: 'safeCall routes to GLOBE_OVERLAY.open',
        critical: true,
        test: () => {
          const obj = window['GLOBE_OVERLAY'];
          const hasOpen = obj && typeof obj.open === 'function';
          return {
            pass: hasOpen,
            detail: hasOpen ? 'GLOBE_OVERLAY.open() is callable via safeCall' : 'GLOBE_OVERLAY.open NOT accessible — sidebar will never open!',
          };
        },
      },
      {
        name: 'safeCall routes to GAIA_BUBBLE.speak',
        critical: false,
        test: () => {
          const obj = window['GAIA_BUBBLE'];
          const has = obj && typeof obj.speak === 'function';
          return {
            pass: has,
            detail: has ? 'GAIA_BUBBLE.speak() is callable' : 'GAIA_BUBBLE.speak NOT accessible — GAIA will be silent',
          };
        },
      },
      {
        name: 'Data module loaded with sites',
        critical: true,
        test: () => {
          const hasData = typeof Data !== 'undefined' && Data.sites && Data.sites.length > 0;
          return {
            pass: hasData,
            detail: hasData ? `${Data.sites.length} sites, ${Data.biomes ? Object.keys(Data.biomes).length : 0} biomes loaded` : 'Data.sites is empty or Data not loaded',
          };
        },
      },
      {
        name: 'GLOBE_OVERLAY registry has sites',
        critical: true,
        test: () => {
          if (!window.GLOBE_OVERLAY) return { pass: false, detail: 'GLOBE_OVERLAY not on window' };
          // Try to check if antalya is registered
          const site = GLOBE_OVERLAY.getSite('antalya');
          return {
            pass: !!site,
            detail: site ? 'antalya registered in GLOBE_OVERLAY' : 'antalya NOT registered — GAIA_NODES.init() may not have run',
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
        name: '#site-panel has pointer-events:none when closed',
        critical: true,
        test: () => {
          const el = document.getElementById('site-panel');
          if (!el) return { pass: true, detail: '#site-panel not in DOM (OK if not rendered yet)' };
          if (el.classList.contains('open')) return { pass: true, detail: '#site-panel is .open — skip check' };
          const pe = getComputedStyle(el).pointerEvents;
          return {
            pass: pe === 'none',
            detail: pe === 'none' ? 'Correctly pe:none when closed' : `pe:${pe} — INVISIBLE CLICK BLOCKER!`,
          };
        },
      },
      {
        name: '#globe-overlay is NOT inside #globeViz',
        critical: true,
        test: () => {
          const overlay = document.getElementById('globe-overlay');
          if (!overlay) return { pass: true, detail: 'Not created yet (OK — created on first open)' };
          const insideGlobe = overlay.closest('#globeViz') !== null;
          return {
            pass: !insideGlobe,
            detail: insideGlobe
              ? 'INSIDE #globeViz — z-index trapped below .sections!'
              : `Parent: ${overlay.parentElement.tagName} (correct)`,
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
            { id: 'globe-overlay', minZ: 40, maxZ: 60 },
            { id: 'site-panel', minZ: 80, maxZ: 100 },
            { id: 'topbar', minZ: 95, maxZ: 110 },
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
          const required = ['globeViz', 'hero', 'topbar', 'site-panel', 'panel-content', 'panel-backdrop'];
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
        name: 'Globe has interactive points',
        critical: false,
        test: () => {
          if (!window.GlobeModule || !GlobeModule.world) {
            // Lazy init — world only exists after entering globe mode.
            if (!window.GlobeModule?._initialized) return { pass: true, detail: 'Globe not yet entered (lazy init) — OK' };
            return { pass: false, detail: 'GlobeModule.world not available' };
          }
          const pointsData = GlobeModule.world.pointsData();
          return {
            pass: pointsData && pointsData.length > 0,
            detail: pointsData ? `${pointsData.length} points on globe (${pointsData.filter(p => p._type === 'site').length} sites, ${pointsData.filter(p => p._type === 'pledge').length} pledges)` : 'No points data',
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
          // The hero button uses delegated data-action binding (no inline onclick).
          const btn = document.querySelector('.enter-btn[data-action="enterGlobe"]');
          const bound = btn && btn.dataset.appActionBound === 'true';
          const handler = typeof window.App?.enterGlobe === 'function';
          return {
            pass: !!(btn && handler),
            detail: !btn ? '.enter-btn[data-action=enterGlobe] not found — hero button missing!'
              : !handler ? 'App.enterGlobe() not found — hero button will not work!'
              : bound ? 'Hero button bound via data-action → App.enterGlobe()'
              : 'Button + App.enterGlobe() exist (binding flag not yet set)',
          };
        },
      },
      {
        name: 'flyToSite() is callable',
        critical: false,
        test: () => {
          const exists = typeof window.flyToSite === 'function';
          return {
            pass: exists,
            detail: exists ? 'flyToSite() global function exists' : 'flyToSite() not found — site cards will not work',
          };
        },
      },
      {
        name: 'Globe onPointClick handler is set',
        critical: true,
        test: () => {
          if (!window.GlobeModule || !GlobeModule.world) {
            // Lazy init — world only exists after entering globe mode.
            if (!window.GlobeModule?._initialized) return { pass: true, detail: 'Globe not yet entered (lazy init) — OK' };
            return { pass: false, detail: 'GlobeModule.world not available' };
          }
          // Globe.gl stores callbacks internally — we test by checking if the accessor returns a function
          const clickFn = GlobeModule.world.onPointClick();
          return {
            pass: typeof clickFn === 'function',
            detail: typeof clickFn === 'function' ? 'onPointClick handler is set' : 'onPointClick handler is NOT set — globe clicks will do nothing!',
          };
        },
      },
    ],

    // ═══════════════════════════════════════════
    // CSP & RESOURCE TESTS
    // ═══════════════════════════════════════════
    resources: [
      {
        name: 'CSP allows CDN connect-src',
        critical: false,
        test: () => {
          const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
          if (!meta) return { pass: true, detail: 'No CSP meta tag (all connections allowed)' };
          const content = meta.getAttribute('content') || '';
          const hasCDN = content.includes('cdn.jsdelivr.net');
          const hasGH = content.includes('raw.githubusercontent.com');
          return {
            pass: hasCDN && hasGH,
            detail: `cdn.jsdelivr.net: ${hasCDN ? '✅' : '❌'}, raw.githubusercontent.com: ${hasGH ? '✅' : '❌'}`,
          };
        },
      },
      {
        name: 'Data files loaded successfully',
        critical: true,
        test: () => {
          if (typeof Data === 'undefined') return { pass: false, detail: 'Data module not loaded' };
          const biomes = Data.biomes ? Object.keys(Data.biomes).length : 0;
          const sites = Data.sites ? Data.sites.length : 0;
          const pledges = Data.pledgeNodes ? Data.pledgeNodes.length : 0;
          return {
            pass: biomes > 0 && sites > 0,
            detail: `${biomes} biomes, ${sites} sites, ${pledges} pledge nodes`,
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
    return _results;
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
