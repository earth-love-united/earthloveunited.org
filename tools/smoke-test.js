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
        name: 'CT-42 factual candidate is loaded inside its denied boundary',
        critical: true,
        test: () => {
          const candidate = window.Data?.climateCandidate;
          const ranking = window.Data?.getClimateRanking?.();
          const factualCount = candidate?.countries?.filter(country => country.emissions?.status === 'reviewed_factual').length || 0;
          const gapCount = candidate?.countries?.filter(country => country.emissions?.status !== 'reviewed_factual').length || 0;
          const ok = candidate?.review_status === 'not_reviewed'
            && candidate?.production_runtime_release === false
            && candidate?.countries?.length === 249
            && factualCount === 206
            && gapCount === 43
            && ranking?.disclosure?.eligible_count === 206
            && ranking?.disclosure?.unranked_count === 43;
          return {
            pass: ok,
            detail: ok
              ? 'candidate not_reviewed/production false; registry 249 = 206 factual + 43 gaps; ranking 206 + 43; CT-04 separately guards legacy absence'
              : `boundary/count mismatch (registry ${candidate?.countries?.length || 0}, factual ${factualCount}, gaps ${gapCount}, ranking ${ranking?.disclosure?.eligible_count || 0} + ${ranking?.disclosure?.unranked_count || 0})`,
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
          const required = ['globeViz', 'hero', 'topbar', 'hex-legend', 'globe-back-btn', 'globe-fallback', 'globe-evidence-browse', 'hero-carbon-clock'];
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
          const fallback = document.body.classList.contains('globe-fallback-active');
          if (fallback) {
            const rows = document.querySelectorAll('#globe-fallback [data-fallback-country-iso]').length;
            const browsing = window.GlobeModule?._fallbackReasonCode === 'evidence_browse_requested';
            return {
              pass: rows === 249 && (browsing ? Boolean(canvas && GlobeModule._initialized) : !canvas),
              detail: browsing
                ? `User-invoked evidence browser active with ${rows} entities over one live renderer`
                : `Failure evidence view active with ${rows} entities and no unusable canvas`,
            };
          }
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
          if (document.body.classList.contains('globe-fallback-active')) {
            return { pass: true, detail: 'Country polygons intentionally replaced by the accessible evidence view' };
          }
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
          return {
            pass: count === 201,
            detail: count === 201 ? 'Exact 201-entity candidate overlay is active' : `${count} country features (expected 201)`,
          };
        },
      },
    ],

    // ═══════════════════════════════════════════
    // INTERACTION TESTS
    // ═══════════════════════════════════════════
    interactions: [
      {
        name: 'Non-WebGL fallback is body-level, accessible, and fail-closed',
        critical: true,
        test: () => {
          const panel = document.getElementById('globe-fallback');
          if (!panel) return { pass: false, detail: '#globe-fallback is missing' };
          if (panel.parentElement !== document.body) return { pass: false, detail: '#globe-fallback is not a direct child of body' };
          if (!document.body.classList.contains('globe-fallback-active')) {
            const closed = panel.hidden && panel.getAttribute('aria-hidden') === 'true';
            return { pass: closed, detail: closed ? 'Fallback is inert and hidden until a renderer failure' : 'Closed fallback remains exposed' };
          }
          const factual = panel.querySelectorAll('[data-fallback-evidence-state="factual"]').length;
          const gaps = panel.querySelectorAll('[data-fallback-evidence-state="gap"]').length;
          const controls = [...panel.querySelectorAll('button,input,a[href]')];
          const undersized = controls.filter(control => control.getBoundingClientRect().height < 44);
          const reason = panel.dataset.reason;
          const allowed = ['candidate_data_unavailable', 'country_geometry_unavailable', 'visual_assets_unavailable', 'library_load_failed', 'library_unavailable', 'webgl_unavailable', 'globe_construction_failed', 'globe_container_missing'];
          const browsing = reason === 'evidence_browse_requested';
          const canvasCount = document.querySelectorAll('#globeViz canvas').length;
          const rendererStateOk = browsing
            ? window.GlobeModule?._initialized === true && canvasCount === 1
            : window.GlobeModule?._initialized !== true && canvasCount === 0;
          const ok = factual === 206 && gaps === 43 && undersized.length === 0 &&
            (browsing || allowed.includes(reason)) && rendererStateOk;
          return {
            pass: ok,
            detail: ok
              ? `${factual} factual candidate series + ${gaps} explicit gaps; reason ${reason}; all ${controls.length} controls >=44px; renderer state is safe`
              : `factual ${factual}, gaps ${gaps}, undersized ${undersized.length}, reason ${reason}, initialized ${window.GlobeModule?._initialized}, canvases ${canvasCount}`,
          };
        },
      },
      {
        name: 'Country card is not open by default',
        critical: true,
        test: () => {
          const dialogs = document.querySelectorAll('#elu-country-card-wrap[role="dialog"][aria-modal="true"]');
          return {
            pass: dialogs.length === 0,
            detail: dialogs.length === 0 ? 'No default country dialog' : `${dialogs.length} country dialog(s) open before user selection`,
          };
        },
      },
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
        name: 'CSP keeps globe resources same-origin',
        critical: true,
        test: () => {
          const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
          if (!meta) return { pass: false, detail: 'CSP meta tag is missing' };
          const content = meta.getAttribute('content') || '';
          const selfOnly = content.includes("connect-src 'self';") && content.includes("img-src 'self' data:;");
          const obsolete = ['cdn.jsdelivr.net', 'raw.githubusercontent.com', 'api.carbonmark.com'].filter(origin => content.includes(origin));
          return {
            pass: selfOnly && obsolete.length === 0,
            detail: selfOnly && !obsolete.length ? 'connect/img globe resources are same-origin; obsolete origins absent' : `obsolete origins: ${obsolete.join(', ') || 'none'}; self-only ${selfOnly}`,
          };
        },
      },
      {
        name: 'Active critical candidate loaded successfully',
        critical: true,
        test: () => {
          if (typeof Data === 'undefined') return { pass: false, detail: 'Data module not loaded' };
          const ready = Data.isClimateCandidateReady?.() === true;
          return {
            pass: ready && Data.climateCandidateState === 'ready',
            detail: ready ? 'Exact-SHA candidate is ready; carbon projects remain noncritical' : `candidate state ${Data.climateCandidateState}`,
          };
        },
      },
      {
        name: 'runtime assets are prepared before renderer init',
        critical: true,
        test: () => {
          const state = window.GlobeModule?.getState?.();
          if (!state) return { pass: false, detail: 'GlobeModule state is unavailable' };
          if (!window.GlobeModule._initialized) {
            const safeLazyOrFallback = state.rendererCanvasCount === 0;
            return { pass: safeLazyOrFallback, detail: safeLazyOrFallback ? `No renderer before successful preparation; failure ${state.preparationFailure || 'none'}` : 'Renderer canvas exists before initialization' };
          }
          const ok = state.runtimeAssetsPrepared === true && state.countryDataState === 'ready' &&
            state.countryFeatureCount === 201 && state.countryDeckCount === 201 && state.rendererCanvasCount === 1;
          return { pass: ok, detail: ok ? 'Candidate, 201-entity geometry deck, and four images prepared before the single renderer' : JSON.stringify(state) };
        },
      },
      {
        name: 'All 249 evidence records remain first-class and searchable',
        critical: true,
        test: () => {
          const panel = document.getElementById('globe-fallback');
          const button = document.getElementById('globe-evidence-browse');
          const fullLabel = button?.querySelector('.browse-label-full')?.textContent?.trim();
          const shortLabel = button?.querySelector('.browse-label-short')?.textContent?.trim();
          if (!panel || !button || button.getAttribute('aria-label') !== 'Browse all 249 evidence records' ||
              fullLabel !== 'Browse all 249 evidence records' || shortLabel !== '249 records') {
            return { pass: false, detail: 'Evidence browser entry control is missing or mislabeled' };
          }
          if (window.GlobeModule?._fallbackReasonCode !== 'evidence_browse_requested') {
            const expectedDisabled = window.GlobeModule?._initialized !== true;
            return { pass: button.disabled === expectedDisabled, detail: `Evidence browser trigger ${button.disabled ? 'disabled before readiness' : 'enabled for the live renderer'}` };
          }
          const factual = panel.querySelectorAll('[data-fallback-evidence-state="factual"]').length;
          const gaps = panel.querySelectorAll('[data-fallback-evidence-state="gap"]').length;
          const title = document.getElementById('globe-fallback-title')?.textContent || '';
          const ok = factual === 206 && gaps === 43 && title.includes('Browse all 249') &&
            document.getElementById('globe-fallback-search') && panel.querySelector('[data-globe-fallback-action="close"]');
          return { pass: ok, detail: ok ? '249 = 206 factual + 43 gaps; search/detail/guarded return controls present' : `factual ${factual}, gaps ${gaps}, title ${title}` };
        },
      },
      {
        name: 'Disputed subfeatures and non-registry areas cannot inherit evidence',
        critical: true,
        test: () => {
          if (!window.GlobeModule?.getState?.().runtimeAssetsPrepared) return { pass: true, detail: 'Overlay not prepared yet; CT-45 executable policy covers preparation' };
          const prohibited = new Set(['N. Cyprus', 'Northern Cyprus', 'Somaliland', 'Kosovo']);
          const leaked = GlobeModule.getCountryFeatures().filter(feature =>
            [feature?.properties?.ADMIN, feature?.properties?.NAME].some(name => prohibited.has(name)));
          const unknownDeck = (GlobeModule._countryDeck || []).filter(entry => !Data.getClimateCountry(entry.iso));
          return { pass: leaked.length === 0 && unknownDeck.length === 0, detail: leaked.length || unknownDeck.length ? `leaked areas ${leaked.length}, non-registry cards ${unknownDeck.length}` : 'Sensitive subfeatures excluded; every interactive ISO resolves to the candidate registry' };
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
