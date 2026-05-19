
/* ══ js/data.js ══ */
// ═══════════════════════════════════════════════
// SAFE LOCALSTORAGE — quota-aware writes
// ═══════════════════════════════════════════════
window.Storage = {
  MAX_ITEM_SIZE: 500000, // 500KB per item (well under 5MB browser limit)

  safeSetItem(key, value) {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      if (serialized.length > this.MAX_ITEM_SIZE) {
        console.warn(`[Storage] Item "${key}" too large (${serialized.length} bytes), skipping`);
        return false;
      }
      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      // QuotaExceededError or private browsing — try to free space
      console.warn(`[Storage] Write failed for "${key}":`, e.name);
      this._evictOldest();
      try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }
  },

  safeGetItem(key) {
    try {
      return localStorage.getItem(key);
    } catch { return null; }
  },

  safeRemoveItem(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },

  // Evict oldest gaia_* items to free space
  _evictOldest() {
    const gaiaKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('gaia_')) {
        try {
          const item = JSON.parse(localStorage.getItem(k) || '{}');
          gaiaKeys.push({ k, ts: item.savedAt || item.cachedAt || item.timestamp || 0 });
        } catch { gaiaKeys.push({ k, ts: 0 }); }
      }
    }
    gaiaKeys.sort((a, b) => a.ts - b.ts);
    // Remove oldest 3 items
    for (let i = 0; i < Math.min(3, gaiaKeys.length); i++) {
      try { localStorage.removeItem(gaiaKeys[i].k); } catch { /* ignore */ }
    }
  },
};

// ═══════════════════════════════════════════════
// DATA — Loads JSON, provides shared state
// ═══════════════════════════════════════════════

window.Data = {
  biomes: null,
  sites: null,
  pledgeNodes: null,

  async init() {
    const [biomesRes, sitesRes, pledgeNodesRes] = await Promise.all([
      fetch('data/biomes.json'),
      fetch('data/sites.json'),
      fetch('data/pledge-nodes.json')
    ]);
    this.biomes = await biomesRes.json();
    this.sites = await sitesRes.json();
    this.pledgeNodes = await pledgeNodesRes.json();
    return this;
  },

  getBiome(key) { return this.biomes[key]; },
  getSite(id) { return this.sites.find(s => s.id === id); },
  getPledgeNode(iso) { return this.pledgeNodes.find(n => n.iso === iso); },
  getAllBiomes() { return Object.entries(this.biomes).map(([k, v]) => ({ key: k, ...v })); },

  // Carbon calculation engine
  transitionCarbon(from, to, ha, yrs = 30) {
    const f = this.biomes[from], t = this.biomes[to];
    if (!f || !t) return null;
    const sC = (t.density - f.density) * ha;
    const fC = (t.seq - f.seq) * ha;
    const cum = sC + fC * yrs;
    return { stock_co2: sC * 3.67, flux_co2: fC * 3.67, cumulative_co2: cum * 3.67, years: yrs };
  },

  scaleContext(co2) {
    const a = Math.abs(co2);
    return {
      fraction: a / 20e9,
      cars: a / 4.6,
      flights: a / 1.0,
      summary: `${this.fmt(a)} t CO₂ = ${(a / 4.6).toFixed(0)} cars removed for a year, or ${(a / 1.0).toFixed(0)} transatlantic flights offset`
    };
  },

  fmt(n) {
    return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' :
           n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' :
           n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(0);
  }
};


/* ══ js/quiz.js ══ */
// ═══════════════════════════════════════════════
// QUIZ — Interactive quiz widget
// ═══════════════════════════════════════════════

window.Quiz = {
  questions: [
    {
      q: "How much CO₂ does humanity add to the atmosphere each year?",
      options: ["5 Gt", "20 Gt", "100 Gt", "500 Gt"],
      correct: 1,
      explain: "Humanity emits ~143 Gt CO₂/yr but nature absorbs ~123 Gt. The net excess is ~20 Gt/yr — and it accumulates every year."
    },
    {
      q: "Which ecosystem stores the most carbon per hectare?",
      options: ["Tropical rainforest", "Grassland", "Mangrove forest", "Temperate pine forest"],
      correct: 2,
      explain: "Mangroves store ~950 tC/ha — nearly 3x more than tropical rainforests. Their waterlogged soil locks carbon away for millennia."
    },
    {
      q: "If you restore 100 hectares of degraded land to tropical rainforest, how much CO₂ could it sequester over 30 years?",
      options: ["~10,000 t", "~100,000 t", "~1,000,000 t", "~10,000,000 t"],
      correct: 2,
      explain: "100 ha × (350-10) tC/ha × 3.67 × 30 years ≈ 3.7 million t CO₂. That's like taking 800,000 cars off the road for a year."
    },
    {
      q: "What percentage of global annual net emissions would restoring 2,500 ha of mangrove offset?",
      options: ["0.0001%", "0.04%", "1%", "10%"],
      correct: 1,
      explain: "2,500 ha of mangrove restoration sequesters ~14.7M t CO₂ over 30 years. That's ~0.04% of one year's global net emissions. Every bit counts."
    }
  ],

  idx: 0,
  score: 0,

  init() {
    this.render();
  },

  render() {
    const q = this.questions[this.idx];
    document.getElementById('q-text').textContent = `${this.idx + 1}. ${q.q}`;
    document.getElementById('q-options').innerHTML = q.options.map((o, i) =>
      `<div class="quiz-option" onclick="Quiz.answer(${i})">${o}</div>`
    ).join('');
    document.getElementById('q-feedback').className = 'quiz-feedback';
    document.getElementById('q-feedback').innerHTML = '';
    document.getElementById('q-score').textContent = `Question ${this.idx + 1} of ${this.questions.length}`;
  },

  answer(i) {
    const q = this.questions[this.idx];
    const opts = document.querySelectorAll('#q-options .quiz-option');
    opts.forEach((o, j) => {
      o.classList.add('disabled');
      if (j === q.correct) o.classList.add('correct');
      if (j === i && j !== q.correct) o.classList.add('wrong');
    });
    if (i === q.correct) this.score++;
    const fb = document.getElementById('q-feedback');
    fb.className = 'quiz-feedback show ' + (i === q.correct ? 'correct' : 'wrong');
    fb.innerHTML = (i === q.correct ? '✅ Correct! ' : '❌ Not quite. ') + q.explain;
    document.getElementById('q-score').textContent = `${this.score}/${this.idx + 1} correct`;

    setTimeout(() => {
      this.idx++;
      if (this.idx < this.questions.length) this.render();
      else {
        document.getElementById('q-text').textContent = "Great job! You've got the basics.";
        document.getElementById('q-options').innerHTML = `<div class="quiz-option correct" style="text-align:center">Score: ${this.score}/${this.questions.length} — ${this.score === this.questions.length ? 'Perfect! 🎉' : this.score >= 2 ? 'Solid understanding! 💪' : 'Keep learning! 📚'}</div>`;
        document.getElementById('q-score').textContent = '';
      }
    }, 3000);
  }
};


/* ══ js/cycle.js ══ */
// ═══════════════════════════════════════════════
// CARBON CYCLE — Interactive cycle nodes
// ═══════════════════════════════════════════════

window.Cycle = {
  data: {
    atmosphere: { title: "🌡️ The Atmosphere", body: "Currently holds ~875 Gt of carbon as CO₂. This number rises by ~10 GtC/yr due to human activity. CO₂ traps heat — more CO₂ means a warmer planet.", stat: "~875 GtC stored · +10 GtC/yr from humans" },
    vegetation: { title: "🌿 Vegetation", body: "Forests, grasslands, and plants absorb ~123 Gt CO₂/yr through photosynthesis. But deforestation releases ~1.5 GtC/yr. Net: vegetation absorbs ~4 GtC/yr.", stat: "~460 GtC stored · absorbs ~123 Gt CO₂/yr" },
    ocean: { title: "🌊 The Ocean", body: "The ocean absorbs ~25% of human CO₂ emissions — about 10.5 Gt CO₂/yr. This causes ocean acidification, threatening coral reefs and marine life.", stat: "~38,000 GtC stored · absorbs ~10.5 Gt CO₂/yr" },
    soil: { title: "🪱 Soil", body: "Soil holds ~2,500 GtC — more than the atmosphere and vegetation combined. Degraded soils release carbon. Restored soils sequester it.", stat: "~2,500 GtC stored · largest terrestrial pool" },
    human: { title: "🏭 Human Activity", body: "We emit ~143 Gt CO₂/yr: 90% from fossil fuels, 10% from land use change. This is the only part of the cycle we can directly control.", stat: "~143 Gt CO₂/yr emitted · 90% fossil fuels" }
  },

  show(key) {
    const d = this.data[key];
    const el = document.getElementById('cycle-detail');
    el.className = 'cycle-detail show';
    el.innerHTML = `<h4>${d.title}</h4><p>${d.body}</p><div class="cd-stat">${d.stat}</div>`;
  }
};


/* ══ js/biomes.js ══ */
// ═══════════════════════════════════════════════
// BIOMES — Biome explorer + comparison bars
// ═══════════════════════════════════════════════

window.Biomes = {
  order: ['degraded_bare_land','agricultural_cropland','grassland_savanna','tropical_dry_forest','temperate_deciduous','boreal_forest','temperate_coniferous','tropical_rainforest','seagrass_meadow','mangrove','wetland_peatland'],

  compareOrder: [
    { key: 'wetland_peatland', label: 'Peatland', color: 'teal' },
    { key: 'mangrove', label: 'Mangrove', color: 'teal' },
    { key: 'seagrass_meadow', label: 'Seagrass', color: 'teal' },
    { key: 'tropical_rainforest', label: 'Tropical Rainforest', color: 'leaf' },
    { key: 'temperate_coniferous', label: 'Coniferous', color: 'leaf' },
    { key: 'temperate_deciduous', label: 'Deciduous', color: 'leaf' },
    { key: 'tropical_dry_forest', label: 'Dry Forest', color: 'leaf' },
    { key: 'boreal_forest', label: 'Boreal', color: 'amber' },
    { key: 'grassland_savanna', label: 'Grassland', color: 'amber' },
    { key: 'agricultural_cropland', label: 'Cropland', color: 'warn' },
    { key: 'degraded_bare_land', label: 'Degraded', color: 'warn' },
  ],

  init() {
    this.renderCards();
    this.renderCompare();
  },

  renderCards() {
    const el = document.getElementById('biome-cards');
    if (!el) return;
    el.innerHTML = this.order.map(k => {
      const b = Data.getBiome(k);
      return `<div class="biome-card" onclick="Biomes.showDetail('${k}',this)">
        <div class="bc-icon">${b.icon}</div>
        <div class="bc-name">${b.name}</div>
        <div class="bc-density">${b.density} tC/ha</div>
        <div class="bc-bar"><div class="bc-bar-fill" style="background:${b.density > 500 ? 'var(--teal)' : b.density > 200 ? 'var(--leaf)' : 'var(--amber)'}" data-width="${Math.min(b.density / 14, 100)}%"></div></div>
      </div>`;
    }).join('');
  },

  renderCompare() {
    const el = document.getElementById('compare-bars');
    if (!el) return;
    el.innerHTML = this.compareOrder.map(d => {
      const b = Data.getBiome(d.key);
      return `<div class="compare-row">
        <div class="compare-label">${d.label}</div>
        <div class="compare-bar-wrap"><div class="compare-bar ${d.color}" data-width="${Math.min(b.density / 14, 100)}%"></div></div>
        <div class="compare-val">${b.density} tC/ha</div>
      </div>`;
    }).join('');
  },

  showDetail(key, card) {
    const b = Data.getBiome(key);
    document.querySelectorAll('.biome-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    const d = document.getElementById('biome-detail');
    d.className = 'biome-detail show';
    d.innerHTML = `<h4>${b.icon} ${b.name}</h4><p>${b.desc}</p><div class="bd-numbers"><div class="bd-num">📦 ${b.density} tC/ha stock</div><div class="bd-num">📈 ${b.seq} tC/ha/yr sequestration</div></div>`;
    setTimeout(() => { card.querySelector('.bc-bar-fill').style.width = card.querySelector('.bc-bar-fill').dataset.width; }, 50);
  },

  animateBars() {
    document.querySelectorAll('.compare-bar').forEach((bar, i) => {
      setTimeout(() => { bar.style.width = bar.dataset.width; }, i * 80);
    });
  },

  animateBiomeCards() {
    document.querySelectorAll('.bc-bar-fill').forEach((bar, i) => {
      setTimeout(() => { bar.style.width = bar.dataset.width; }, i * 60);
    });
  }
};


/* ══ js/counters.js ══ */
// ═══════════════════════════════════════════════
// COUNTERS — Animated number counters
// ═══════════════════════════════════════════════

window.Counters = {
  animated: false,

  animate() {
    if (this.animated) return;
    this.animated = true;
    this.animateNum('counter-absorb', 0, 123, 1500, '');
    this.animateNum('counter-emit', 0, 143, 1800, '');
    setTimeout(() => this.animateNum('counter-gap', 0, 20, 800, ''), 1200);
  },

  animateNum(id, from, to, duration, suffix) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
};


/* ══ js/scenario.js ══ */
// ═══════════════════════════════════════════════
// SCENARIO BUILDER — Step-by-step restoration wizard
// ═══════════════════════════════════════════════

window.Scenario = {
  site: null,
  from: null,
  to: null,

  init() {
    const sites = Data.sites;
    document.getElementById('sb-sites').innerHTML = sites.map(s =>
      `<div class="sb-option" onclick="Scenario.pickSite('${s.id}',this)">${s.name}</div>`
    ).join('');

    const fromOpts = ['degraded_bare_land', 'agricultural_cropland', 'grassland_savanna', 'urban_built'];
    document.getElementById('sb-from').innerHTML = fromOpts.map(k =>
      `<div class="sb-option" onclick="Scenario.pickFrom('${k}',this)">${Data.getBiome(k).icon} ${Data.getBiome(k).name}</div>`
    ).join('');

    const toOpts = ['tropical_rainforest', 'mangrove', 'wetland_peatland', 'temperate_coniferous', 'temperate_deciduous', 'tropical_dry_forest', 'seagrass_meadow'];
    document.getElementById('sb-to').innerHTML = toOpts.map(k =>
      `<div class="sb-option" onclick="Scenario.pickTo('${k}',this)">${Data.getBiome(k).icon} ${Data.getBiome(k).name}</div>`
    ).join('');

    document.getElementById('sb-area').addEventListener('input', function() {
      document.getElementById('sb-area-val').textContent = this.value;
      Scenario.calc();
    });
  },

  pickSite(id, el) {
    this.site = Data.getSite(id);
    document.querySelectorAll('#sb-sites .sb-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    this.calc();
  },

  pickFrom(key, el) {
    this.from = key;
    document.querySelectorAll('#sb-from .sb-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    this.calc();
  },

  pickTo(key, el) {
    this.to = key;
    document.querySelectorAll('#sb-to .sb-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    this.calc();
  },

  calc() {
    if (!this.from || !this.to) return;
    const ha = parseInt(document.getElementById('sb-area').value) || 100;
    const r = Data.transitionCarbon(this.from, this.to, ha, 30);
    if (!r) return;
    const ctx = Data.scaleContext(r.cumulative_co2);
    const pos = r.cumulative_co2 > 0;
    const el = document.getElementById('sb-result');
    el.className = 'sb-result show';
    document.getElementById('sb-result-num').textContent = (pos ? '+' : '') + Data.fmt(Math.abs(r.cumulative_co2)) + ' t CO₂';
    document.getElementById('sb-result-num').className = 'sr-big ' + (pos ? '' : 'negative');
    document.getElementById('sb-result-label').textContent = `${pos ? 'sequestered' : 'released'} over 30 years · ${ha} ha`;
    document.getElementById('sb-result-context').textContent = ctx.summary + ' — ' + (ctx.fraction * 100).toExponential(2) + '% of global annual net emissions';

    // Track engagement
    if (typeof GAIA_ENGAGEMENT !== 'undefined') {
      GAIA_ENGAGEMENT.addSignal('scenario_run');
      if (Math.abs(r.cumulative_co2) >= 1e6) {
        GAIA_ENGAGEMENT.addSignal('big_scenario');
      }
      if (r.cumulative_co2 < 0) {
        GAIA_ENGAGEMENT.addSignal('negative_scenario');
      }
    }
    if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('scenario_run', { siteId: this.site?.id, result: r.cumulative_co2 });

    // Trigger pledge prompt after running a scenario
    if (typeof PLEDGE_WALL !== 'undefined') {
      PLEDGE_WALL.onScenarioRun(r);
    }
  }
};


/* ══ js/globe.js ══ */
// ═══════════════════════════════════════════════
// GLOBE — Globe.gl init, panel open/close
// ═══════════════════════════════════════════════

window.GlobeModule = {
  world: null,
  userTotal: 0,
  currentLens: 'gap', // 'gap' | 'forest' | 'cat'

  init() {
    const el = document.getElementById('globeViz');

    this.world = new Globe(el, { animateIn: true, waitForGlobeReady: true })
      .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png')
      .showAtmosphere(true).atmosphereColor('#4ecdc4').atmosphereAltitude(0.18)
      .pointsData(Data.sites)
      .pointLat('lat').pointLng('lng').pointAltitude(0.01).pointRadius(0.4)
      .pointColor(() => '#4ecdc4').pointResolution(12)
      .labelsData(Data.sites)
      .labelLat('lat').labelLng('lng').labelText('name').labelSize(1.2)
      .labelDotRadius(0.3).labelDotOrientation(() => 'bottom')
      .labelColor(() => 'rgba(123,232,208,0.85)').labelResolution(2).labelAltitude(0.015)
      .ringsData(Data.sites)
      .ringLat('lat').ringLng('lng')
      .ringColor(() => t => `rgba(78,205,196,${1 - t})`)
      .ringMaxRadius(3).ringPropagationSpeed(1.5).ringRepeatPeriod(1400)
      .onPointClick(site => {
        if (typeof GAIA_NODES !== 'undefined') {
          GAIA_NODES.onNodeClick(site.id);
        } else if (typeof SITE_PANEL !== 'undefined') {
          SITE_PANEL.open(site);
        } else {
          Panel.open(site);
        }
      })
      .onLabelClick(site => {
        if (typeof GAIA_NODES !== 'undefined') {
          GAIA_NODES.onNodeClick(site.id);
        } else if (typeof SITE_PANEL !== 'undefined') {
          SITE_PANEL.open(site);
        } else {
          Panel.open(site);
        }
      })
      .onPointHover(site => {
        if (site && typeof GAIA_NODES !== 'undefined') {
          GAIA_NODES.onNodeHover(site.id);
        } else if (site && typeof GAIA_PRESENCE !== 'undefined') {
          GAIA_PRESENCE.speak('SITE_TEASER', site.id);
          GAIA_ENGAGEMENT.interact();
        }
      })
      .onLabelHover(site => {
        if (site && typeof GAIA_NODES !== 'undefined') {
          GAIA_NODES.onNodeHover(site.id);
        } else if (site && typeof GAIA_PRESENCE !== 'undefined') {
          GAIA_PRESENCE.speak('SITE_TEASER', site.id);
          GAIA_ENGAGEMENT.interact();
        }
      });

    // ── Pledge vs Reality country nodes ──
    this.initPledgeNodes();

    fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(r => r.json())
      .then(countries => {
        this.world
          .hexPolygonsData(countries.features.filter(d => d.properties.ISO_A2 !== 'AQ'))
          .hexPolygonResolution(3).hexPolygonMargin(0.4)
          .hexPolygonUseDots(true).hexPolygonDotResolution(12);
      });

    this.world.pointOfView({ lat: 20, lng: 40, altitude: 2.2 });
    this.world.controls().autoRotate = true;
    this.world.controls().autoRotateSpeed = 0.4;
    this.world.controls().enableDamping = true;
    this.world.controls().dampingFactor = 0.1;

    const m = this.world.globeMaterial();
    m.bumpScale = 8; m.emissive.setHex(0x061420); m.emissiveIntensity = 0.12; m.shininess = 5;

    // Apply initial node visual states
    this.updateNodeVisuals();

    // Initialize pledge tooltip
    this.initPledgeTooltip();
  },

  // ── Pledge nodes layer ──
  initPledgeNodes() {
    console.log('[GLOBE] initPledgeNodes called, Data.pledgeNodes:', Data.pledgeNodes ? Data.pledgeNodes.length : 'null');
    if (!Data.pledgeNodes || !Data.pledgeNodes.length) return;
    const pledgeNodes = Data.pledgeNodes;
    console.log('[GLOBE] Pledge nodes count:', pledgeNodes.length);
    console.log('[GLOBE] Sites count:', Data.sites ? Data.sites.length : 'null');

    // Combine site points + pledge nodes into a single pointsData call
    // Sites get type='site', pledge nodes get type='pledge'
    const allPoints = [
      ...(Data.sites || []).map(s => ({ ...s, _type: 'site' })),
      ...pledgeNodes.map(n => ({ ...n, _type: 'pledge' })),
    ];

    this.world
      .pointsData(allPoints)
      .pointLat('lat')
      .pointLng('lng')
      .pointAltitude(p => p._type === 'pledge' ? this.pledgePointAltitude(p) : 0.01)
      .pointRadius(p => p._type === 'pledge' ? this.pledgePointRadius(p) : 0.4)
      .pointColor(p => {
        if (p._type === 'pledge') return this.pledgePointColor(p);
        // Site color logic
        const suggestedIds = typeof GAIA_NODES !== 'undefined' ? GAIA_NODES.getSuggestedSiteIds('') : [];
        if (suggestedIds.includes(p.id)) return '#ffd700';
        return 'rgba(78,205,196,0.6)';
      })
      .pointResolution(12)
      .onPointClick(p => {
        if (p._type === 'pledge') {
          if (typeof PLEDGE_PANEL !== 'undefined') {
            PLEDGE_PANEL.open(p);
          }
        } else {
          // Site click
          if (typeof GAIA_NODES !== 'undefined') {
            GAIA_NODES.onNodeClick(p.id);
          } else if (typeof SITE_PANEL !== 'undefined') {
            SITE_PANEL.open(p);
          } else {
            Panel.open(p);
          }
        }
      })
      .onPointHover(p => {
        if (p._type === 'pledge') {
          if (p) {
            const gap = p.reality_gap_mt;
            const status = gap === null ? 'No data' : (gap > 0 ? 'OVERSHOOTING' : 'On Track');
            window.dispatchEvent(new CustomEvent('pledgeHover', {
              detail: { node: p, tooltip: p.country + ' | ' + p.fossil_co2_mt + ' MtCO2 | ' + status }
            }));
          } else {
            window.dispatchEvent(new CustomEvent('pledgeHover', { detail: null }));
          }
        } else {
          // Site hover
          if (p && typeof GAIA_NODES !== 'undefined') {
            GAIA_NODES.onNodeHover(p.id);
          } else if (p && typeof GAIA_PRESENCE !== 'undefined') {
            GAIA_PRESENCE.speak('SITE_TEASER', p.id);
            GAIA_ENGAGEMENT.interact();
          }
          // Hide pledge tooltip when hovering sites
          window.dispatchEvent(new CustomEvent('pledgeHover', { detail: null }));
        }
      });
  },

  pledgePointColor(n) {
    const gap = n.reality_gap_mt;
    if (gap === null || gap === undefined) return '#95a5a6';
    if (gap > 0) return '#e74c3c';
    return '#2ecc71';
  },

  pledgePointAltitude(n) {
    const co2 = n.fossil_co2_mt || 0;
    return 0.01 + Math.min(co2 / 50000, 0.15);
  },

  pledgePointRadius(n) {
    const co2 = n.fossil_co2_mt || 0;
    return 0.3 + Math.min(co2 / 20000, 0.8);
  },

  // ── Lens switching ──
  setLens(lens) {
    this.currentLens = lens;
    this.updatePledgeVisuals();
  },

  updatePledgeVisuals() {
    if (!Data.pledgeNodes) return;
    const nodes = Data.pledgeNodes;

    switch (this.currentLens) {
      case 'gap':
        // Reality Gap: color by gap, height by emissions
        this.world.pointColor(n => {
          const gap = n.reality_gap_mt;
          if (gap === null || gap === undefined) return '#95a5a6';
          if (gap > 0) return '#e74c3c';
          return '#2ecc71';
        });
        this.world.pointAltitude(n => 0.01 + Math.min((n.fossil_co2_mt || 0) / 50000, 0.15));
        break;

      case 'forest':
        // Forestry Loophole: height includes LULUCF
        this.world.pointColor(n => {
          const lulucf = n.lulucf_co2_mt || 0;
          const fossil = n.fossil_co2_mt || 1;
          const ratio = Math.abs(lulucf) / fossil;
          if (ratio > 0.5) return '#e67e22'; // High LULUCF = orange
          if (ratio > 0.2) return '#f39c12';
          return '#27ae60';
        });
        this.world.pointAltitude(n => {
          const total = (n.fossil_co2_mt || 0) + Math.abs(n.lulucf_co2_mt || 0);
          return 0.01 + Math.min(total / 50000, 0.2);
        });
        break;

      case 'cat':
        // CAT Rating: use globe_color hex
        this.world.pointColor(n => n.globe_color || '#95a5a6');
        this.world.pointAltitude(n => 0.01 + Math.min((n.fossil_co2_mt || 0) / 50000, 0.15));
        break;
    }
  },

  // ── Update node visual states based on engagement ──
  updateNodeVisuals() {
    const states = typeof GAIA_ENGAGEMENT !== 'undefined'
      ? GAIA_ENGAGEMENT.getSiteStates()
      : {};
    const suggestedIds = typeof GAIA_NODES !== 'undefined'
      ? GAIA_NODES.getSuggestedSiteIds('')
      : [];

    this.world.pointColor(p => {
      // Pledge nodes: use gap color
      if (p._type === 'pledge') {
        const gap = p.reality_gap_mt;
        if (gap === null || gap === undefined) return '#95a5a6';
        if (gap > 0) return '#e74c3c';
        return '#2ecc71';
      }
      // Site nodes: use engagement state color
      if (suggestedIds.includes(p.id)) return '#ffd700';
      const s = states[p.id];
      if (!s || s.state === 'locked') return 'rgba(78,205,196,0.3)';
      if (s.state === 'available') return 'rgba(78,205,196,0.6)';
      if (s.state === 'explored') return 'rgba(123,232,208,0.9)';
      if (s.state === 'mastered') return '#4ecdc4';
      return 'rgba(78,205,196,0.6)';
    });

    this.world.pointRadius(p => {
      if (p._type === 'pledge') {
        const co2 = p.fossil_co2_mt || 0;
        return 0.3 + Math.min(co2 / 20000, 0.8);
      }
      if (suggestedIds.includes(p.id)) return 0.7;
      const s = states[p.id];
      if (!s || s.state === 'locked') return 0.3;
      if (s.state === 'available') return 0.4;
      if (s.state === 'explored') return 0.5;
      if (s.state === 'mastered') return 0.6;
      return 0.4;
    });
  }
};

// ═══════════════════════════════════════════════
// PANEL — Side panel, sliders, sandbox
// ═══════════════════════════════════════════════

window.Panel = {
  currentSite: null,
  selectedAction: null,
  selectedArea: 100,

  open(site) {
    this.currentSite = site;
    this.selectedAction = null;
    PanelSlider.reset();

    GlobeModule.world.pointOfView({ lat: site.lat, lng: site.lng, altitude: 0.8 }, 600);
    GlobeModule.world.controls().autoRotate = false;

    const biome = Data.getBiome(site.currentBiome);
    const stock = biome.density * site.area * 3.67;
    const latest = site.ndvi[site.ndvi.length - 1];
    const cFirst = site.climate[0], cLast = site.climate[site.climate.length - 1];
    const tD = (cLast.temp - cFirst.temp).toFixed(1);
    const pD = ((cLast.precip - cFirst.precip) / cFirst.precip * 100).toFixed(0);

    document.getElementById('panel-content').innerHTML = `
      <div class="site-title">${site.name}</div>
      <div class="site-subtitle">${site.subtitle}</div>
      <div class="site-narrative">${site.narrative}</div>
      <div class="slider-section">
        <h3>Vegetation Health Over Time</h3>
        <div class="year-display" id="year-disp">${latest.year}</div>
        <input type="range" class="time-slider" min="0" max="${site.ndvi.length - 1}" value="${site.ndvi.length - 1}" oninput="PanelSlider.update(this.value)">
        <div class="slider-labels">${site.ndvi.map(n => `<span>${n.year}</span>`).join('')}</div>
        <div class="ndvi-bar" id="ndvi-bar" style="width:${latest.value * 100}%;background:${PanelSlider.ndviCol(latest.value)}"></div>
        <div class="ndvi-label" id="ndvi-lbl">${latest.label} · NDVI ${latest.value.toFixed(2)}</div>
      </div>
      <div class="carbon-card">
        <div class="big-number">${Data.fmt(stock)}<span class="big-unit">t CO₂</span></div>
        <div class="big-label">Current carbon stock · ${biome.name} · ${Data.fmt(site.area)} ha</div>
      </div>
      <div class="climate-row">
        <div class="climate-mini">
          <div class="cm-label">Temperature</div>
          <div class="cm-value">${cLast.temp.toFixed(1)}°C</div>
          <div class="cm-delta warming">+${tD}°C since ${cFirst.year}</div>
        </div>
        <div class="climate-mini">
          <div class="cm-label">Precipitation</div>
          <div class="cm-value">${cLast.precip} mm</div>
          <div class="cm-delta drying">${pD}% since ${cFirst.year}</div>
        </div>
      </div>
      <div class="sandbox-section">
        <h3>🧪 Carbon Sandbox</h3>
        <p style="font-size:13px;color:var(--text3);margin-bottom:12px">Pick a restoration strategy and adjust the area.</p>
        <div class="sandbox-options">${site.sandbox.map((s, i) => `<button class="sandbox-btn" onclick="Panel.pickAction(${i})" id="sb-${i}"><span class="sb-icon">${s.icon}</span>${s.label}</button>`).join('')}</div>
        <div class="area-control">
          <label>Area to restore (hectares)</label>
          <input type="range" class="area-slider" min="10" max="${site.area}" value="100" oninput="PanelSlider.setArea(this.value)">
          <div class="area-value" id="area-val">100 hectares</div>
        </div>
        <div id="sandbox-result"></div>
      </div>
      <div class="elu-connection"><strong>ELU Connection:</strong> ${site.connection}</div>
      <div style="margin-top:24px;text-align:center">
        <button onclick="Panel.close()" style="padding:12px 32px;border:1px solid rgba(255,255,255,.12);border-radius:6px;background:rgba(255,255,255,.04);color:var(--text2);font-family:var(--body);font-size:13px;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:8px">
          <span style="font-size:16px">✕</span> Close
        </button>
      </div>
    `;

    document.getElementById('site-panel').classList.add('open');
    document.getElementById('panel-backdrop').classList.add('show');
    document.getElementById('globeViz').style.transform = 'translateX(-100vw)';
  },

  close() {
    document.getElementById('site-panel').classList.remove('open');
    document.getElementById('panel-backdrop').classList.remove('show');
    document.getElementById('globeViz').style.transform = '';
    this.currentSite = null;
    GlobeModule.world.controls().autoRotate = true;
    GlobeModule.world.pointOfView({ lat: 20, lng: 40, altitude: 2.2 }, 400);
  },

  pickAction(i) {
    if (!this.currentSite) return;
    this.selectedAction = i;
    document.querySelectorAll('.sandbox-btn').forEach((b, j) => b.classList.toggle('active', j === i));
    this.calcResult();
  },

  calcResult() {
    if (!this.currentSite || this.selectedAction === null) return;
    const act = this.currentSite.sandbox[this.selectedAction];
    const r = Data.transitionCarbon(this.currentSite.currentBiome, act.to, this.selectedArea, 30);
    if (!r) return;
    const ctx = Data.scaleContext(r.cumulative_co2);
    const pos = r.cumulative_co2 > 0;
    GlobeModule.userTotal = Math.abs(r.cumulative_co2);
    document.getElementById('user-total').textContent = Data.fmt(GlobeModule.userTotal) + ' t CO₂';
    document.getElementById('sandbox-result').innerHTML = `
      <div class="result-card">
        <div class="big-number" style="color:${pos ? 'var(--leaf)' : 'var(--warn)'}">${pos ? '+' : ''}${Data.fmt(Math.abs(r.cumulative_co2))} t CO₂</div>
        <div class="big-label">${pos ? 'sequestered' : 'released'} over ${r.years} years · ${this.selectedArea} ha</div>
        <div class="context-line">${ctx.summary}</div>
        <div class="fraction-line">${(ctx.fraction * 100).toExponential(2)}% of global annual net emissions</div>
      </div>`;
  }
};

// ═══════════════════════════════════════════════
// PANEL SLIDER — NDVI time slider + area slider
// ═══════════════════════════════════════════════

window.PanelSlider = {
  ndviCol(v) { return v > 0.6 ? '#2a8a3a' : v > 0.4 ? '#6a9a4a' : v > 0.25 ? '#9a8a3a' : '#8a3a2a'; },

  update(i) {
    if (!Panel.currentSite) return;
    const n = Panel.currentSite.ndvi[i];
    document.getElementById('year-disp').textContent = n.year;
    document.getElementById('ndvi-bar').style.width = n.value * 100 + '%';
    document.getElementById('ndvi-bar').style.background = this.ndviCol(n.value);
    document.getElementById('ndvi-lbl').textContent = `${n.label} · NDVI ${n.value.toFixed(2)}`;
  },

  setArea(v) {
    Panel.selectedArea = parseInt(v);
    document.getElementById('area-val').textContent = v + ' hectares';
    Panel.calcResult();
  },

  reset() { Panel.selectedArea = 100; Panel.selectedAction = null; },

  // ── Pledge tooltip ──
  initPledgeTooltip() {
    let tooltip = document.getElementById('pledge-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'pledge-tooltip';
      document.body.appendChild(tooltip);
    }

    document.addEventListener('pledgeHover', (e) => {
      const detail = e.detail;
      if (!detail || !detail.node) {
        tooltip.classList.remove('visible');
        return;
      }
      const n = detail.node;
      const gap = n.reality_gap_mt;
      const statusClass = gap === null ? '' : (gap > 0 ? 'tt-status-red' : 'tt-status-green');
      const statusText = gap === null ? 'No target data' : (gap > 0 ? 'OVERSHOOTING' : 'ON TRACK');
      const target = n.reduction_pct > 0 ? n.reduction_pct + '% by ' + Math.round(n.target_year) : 'No target';
      const cat = n.cat_rating ? ' · ' + n.cat_rating : '';
      tooltip.innerHTML = '<div class="tt-country">' + n.country + cat + '</div>'
        + '<div class="tt-detail">' + (n.fossil_co2_mt ? n.fossil_co2_mt.toFixed(1) : '—') + ' MtCO₂ · ' + target + '</div>'
        + '<div class="' + statusClass + '">' + statusText + '</div>';
      tooltip.classList.add('visible');
    });

    // Position tooltip near cursor
    document.addEventListener('mousemove', (e) => {
      if (tooltip.classList.contains('visible')) {
        const x = Math.min(e.clientX + 16, window.innerWidth - 320);
        const y = Math.min(e.clientY - 12, window.innerHeight - 80);
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
      }
    });
  }
};


/* ══ js/gaia-legacy/gaia-data.js ══ */
/**
 * GAIA DATA ENGINE v1.0
 * Live data fetcher with localStorage caching
 * All sources confirmed CORS-accessible from browser
 * 
 * Data sources:
 *   NOAA GML    — CO2, CH4, N2O (monthly, no auth)
 *   Carbonmark  — Credit prices, retirements (real-time, no auth)
 *   Open-Meteo  — Weather context (no auth)
 * 
 * Cache strategy:
 *   NOAA CO2/CH4: 24 hours (updates monthly, no need to hammer)
 *   Carbonmark:   5 minutes (prices change)
 *   Computed stats: derived from cached raw data
 */

const GAIA_DATA = (() => {
  const CACHE_PREFIX = 'gaia_data_';
  const CACHE_DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // ── Cache helpers ──
  function cacheGet(key, ttl) {
    try {
      const raw = Storage.safeGetItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > (ttl || CACHE_DEFAULT_TTL)) return null;
      return data;
    } catch { return null; }
  }

  function cacheSet(key, data) {
    try {
      Storage.safeSetItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
    } catch { /* quota exceeded, ignore */ }
  }

  // ── NOAA CO2 Parser ──
  function parseNOAAText(text) {
    const records = [];
    for (const line of text.split('\n')) {
      if (line.startsWith('#') || !line.trim()) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        const year = parseInt(parts[0]), month = parseInt(parts[1]);
        const co2 = parseFloat(parts[3]);
        if (!isNaN(year) && !isNaN(month) && !isNaN(co2) && co2 > 0) {
          records.push({ year, month, co2 });
        }
      }
    }
    return records;
  }

  // ── Fetch with timeout ──
  async function fetchText(url, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      return await resp.text();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  async function fetchJSON(url, timeoutMs = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      return await resp.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // ── Public API ──
  return {
    // Fetch all live data (called on boot)
    async refreshAll() {
      const promises = [
        this.fetchCO2(),
        this.fetchMethane(),
        this.fetchCarbonPrices(),
        this.fetchRetirements(),
      ];
      await Promise.allSettled(promises);
      return this.getSnapshot();
    },

    async fetchCO2() {
      const cached = cacheGet('co2', 24 * 60 * 60 * 1000);
      if (cached) return cached;
      try {
        const text = await fetchText('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt');
        const records = parseNOAAText(text);
        cacheSet('co2', records);
        return records;
      } catch { return cacheGet('co2', Infinity); }
    },

    async fetchMethane() {
      const cached = cacheGet('ch4', 24 * 60 * 60 * 1000);
      if (cached) return cached;
      try {
        const text = await fetchText('https://gml.noaa.gov/webdata/ccgg/trends/ch4/ch4_mm_gl.txt');
        const records = parseNOAAText(text).map(r => ({ ...r, ch4: r.co2 }));
        cacheSet('ch4', records);
        return records;
      } catch { return cacheGet('ch4', Infinity); }
    },

    async fetchCarbonPrices() {
      const cached = cacheGet('prices', 5 * 60 * 1000);
      if (cached) return cached;
      try {
        const data = await fetchJSON('https://api.carbonmark.com/prices');
        const listings = Array.isArray(data) ? data : (data.data || []);
        cacheSet('prices', listings);
        return listings;
      } catch { return cacheGet('prices', Infinity) || []; }
    },

    async fetchRetirements() {
      const cached = cacheGet('retirements', 5 * 60 * 1000);
      if (cached) return cached;
      try {
        const data = await fetchJSON('https://api.carbonmark.com/retirements');
        const retirements = Array.isArray(data) ? data : (data.data || []);
        cacheSet('retirements', retirements);
        return retirements;
      } catch { return cacheGet('retirements', Infinity) || []; }
    },

    // ── Computed snapshots ──
    async getSnapshot() {
      const [co2, ch4, prices, retirements] = await Promise.all([
        this.fetchCO2(), this.fetchMethane(), this.fetchCarbonPrices(), this.fetchRetirements()
      ]);

      // CO2 stats
      const co2Latest = co2 && co2.length ? co2[co2.length - 1] : null;
      const co2Prev = co2 && co2.length > 1 ? co2[co2.length - 2] : null;
      const co2YearAgo = co2Latest ? co2.find(r => r.year === co2Latest.year - 1 && r.month === co2Latest.month) : null;
      const co2MonthlyChange = co2Latest && co2Prev ? +(co2Latest.co2 - co2Prev.co2).toFixed(2) : null;
      const co2YearlyChange = co2Latest && co2YearAgo ? +(co2Latest.co2 - co2YearAgo.co2).toFixed(2) : null;

      // 24-hour human emissions estimate (143 Gt/yr = ~392,000 t/day = ~16,300 t/hr)
      const dailyEmissionsGt = 143 / 365;
      const hourlyEmissionsGt = dailyEmissionsGt / 24;

      // Methane
      const ch4Latest = ch4 && ch4.length ? ch4[ch4.length - 1] : null;

      // Carbon prices
      const validPrices = (prices || []).filter(p => p.purchasePrice && p.purchasePrice > 0 && p.purchasePrice < 1000);
      const avgPrice = validPrices.length ? validPrices.reduce((s, p) => s + p.purchasePrice, 0) / validPrices.length : null;
      const registryCounts = {};
      for (const p of (prices || [])) {
        const pid = p?.listing?.creditId?.projectId || '';
        const reg = pid.split('-')[0] || 'Other';
        registryCounts[reg] = (registryCounts[reg] || 0) + 1;
      }

      // Retirements (last 30 visible)
      const totalRetired = (retirements || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

      // Keeling Curve: last 12 months for sparkline
      const keeling12 = (co2 || []).slice(-12).map(r => ({ label: `${r.year}-${String(r.month).padStart(2, '0')}`, value: r.co2 }));

      // Year-over-year comparison for last 5 years
      const yearlyTrend = [];
      if (co2) {
        const byYear = {};
        for (const r of co2) {
          if (!byYear[r.year]) byYear[r.year] = [];
          byYear[r.year].push(r.co2);
        }
        for (const year of Object.keys(byYear).sort().slice(-5)) {
          const vals = byYear[year];
          yearlyTrend.push({ year: +year, avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) });
        }
      }

      return {
        fetchedAt: Date.now(),
        co2: {
          latest: co2Latest ? co2Latest.co2 : null,
          latestDate: co2Latest ? `${co2Latest.year}-${String(co2Latest.month).padStart(2, '0')}` : null,
          monthlyChange: co2MonthlyChange,
          yearlyChange: co2YearlyChange,
          keeling12,
          yearlyTrend,
        },
        methane: {
          latest: ch4Latest ? ch4Latest.ch4 : null,
          latestDate: ch4Latest ? `${ch4Latest.year}-${String(ch4Latest.month).padStart(2, '0')}` : null,
        },
        carbonMarket: {
          avgPrice: avgPrice ? +avgPrice.toFixed(2) : null,
          listingCount: validPrices.length,
          registryCounts,
          recentRetirements: totalRetired,
        },
        humanEmissions: {
          dailyGt: +dailyEmissionsGt.toFixed(2),
          hourlyGt: +hourlyEmissionsGt.toFixed(2),
          annualGt: 143,
          natureAbsorptionGt: 123,
          netExcessGt: 20,
        },
        carbonBudget: {
          remaining15: 250,
          remaining20: 1200,
          yearsLeft15: Math.max(0, Math.round(250 / 37.8)),
          yearsLeft20: Math.max(0, Math.round(1200 / 37.8)),
        }
      };
    },

    // Get cached snapshot without fetching (instant)
    getCachedSnapshot() {
      const raw = cacheGet('snapshot', 5 * 60 * 1000);
      return raw;
    },

    // Save snapshot after refresh
    saveSnapshot(snapshot) {
      cacheSet('snapshot', snapshot);
    },

    // ── Welcome back: what changed since last visit ──
    getWelcomeBackInfo() {
      try {
        const lastVisit = Storage.safeGetItem('gaia_last_visit');
        const lastCO2 = Storage.safeGetItem('gaia_last_co2');
        if (!lastVisit) return null;
        const daysSince = Math.floor((Date.now() - parseInt(lastVisit)) / (1000 * 60 * 60 * 24));
        const co2Then = lastCO2 ? parseFloat(lastCO2) : null;
        return { daysSince, co2Then };
      } catch { return null; }
    },

    saveVisitInfo(co2Value) {
      try {
        Storage.safeSetItem('gaia_last_visit', Date.now().toString());
        if (co2Value) Storage.safeSetItem('gaia_last_co2', co2Value.toString());
      } catch { /* ignore */ }
    },

    // ── Session tracking ──
    getSessionInfo() {
      try {
        const info = JSON.parse(Storage.safeGetItem('gaia_session') || '{}');
        return {
          visitCount: info.visitCount || 0,
          firstVisit: info.firstVisit || null,
          totalTimeSeconds: info.totalTimeSeconds || 0,
        };
      } catch { return { visitCount: 0, firstVisit: null, totalTimeSeconds: 0 }; }
    },

    saveSessionInfo(info) {
      Storage.safeSetItem('gaia_session', JSON.stringify(info));
    },
  };
})();


/* ══ js/gaia-legacy/gaia-signals.js ══ */
/**
 * GAIA SIGNALS v1.0
 * Dumb pipe. Stores raw events in localStorage.
 * Both pages write. gaia.html drains on init.
 *
 * index.html modules → GAIA_SIG.emit('site_tap', {siteId}) → localStorage
 * gaia-integration.js → GAIA_SIG.drain() → GaiaMind.updateParticipantModel()
 */
const GAIA_SIG = (() => {
  const KEY = 'gaia_signals';
  let _buf = [];

  function emit(e, p) {
    _buf.push({ e, p: p || {}, t: Date.now() });
    if (_buf.length > 200) _buf = _buf.slice(-200);
    Storage.safeSetItem(KEY, JSON.stringify(_buf));
  }

  function drain() {
    const out = _buf.splice(0);
    Storage.safeRemoveItem(KEY);
    return out;
  }

  // Load existing signals on init
  try { const r = Storage.safeGetItem(KEY); if (r) _buf = JSON.parse(r); } catch {}

  return { emit, drain, peek: () => [..._buf] };
})();


/* ══ js/gaia-legacy/gaia-charts.js ══ */
/**
 * GAIA CHARTS v1.1
 * Lightweight canvas chart renderer — zero dependencies
 * Charts are registered at creation time and rendered after DOM insertion
 */

const GAIA_CHARTS = (() => {
  window.C = {
    teal: '#4ecdc4', mint: '#7be8d0', leaf: '#5bbf72',
    warn: '#c45c4a', amber: '#d4a574', violet: '#8b7fc7',
    text: '#9a9590', textDim: '#5a5652', grid: 'rgba(255,255,255,0.06)',
  };

  // Pending charts: array of { canvasId, fn, data, options }
  const pending = [];

  function onCanvasReady(id, fn, data, options) {
    pending.push({ id, fn, data, options });
  }

  // Call this after inserting HTML with chart canvases into the DOM
  function renderPending() {
    // Use rAF to ensure DOM is painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const stillPending = [];
        for (const p of pending) {
          const canvas = document.getElementById(p.id);
          if (!canvas) { stillPending.push(p); continue; }
          const rect = canvas.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) { stillPending.push(p); continue; }
          try { p.fn(canvas, p.data, p.options); } catch(e) { /* ignore render errors */ }
        }
        pending.length = 0;
        if (stillPending.length > 0) {
          // Retry next frame
          pending.push(...stillPending);
          setTimeout(renderPending, 100);
        }
      });
    });
  }

  // ── Sparkline ──
  function drawSparkline(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;

    const values = data.map(d => d.value);
    const min = Math.min(...values) - (options.padMin || 0);
    const max = Math.max(...values) + (options.padMax || 2);
    const range = max - min || 1;

    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = (H / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Line
    const color = options.color || C.teal;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * W;
      const y = H - ((d.value - min) / range) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color + '30'); grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    // End dot
    const lastPt = data[data.length - 1];
    const lastX = W;
    const lastY = H - ((lastPt.value - min) / range) * H;
    ctx.beginPath(); ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();

    // Labels
    if (options.showLabels) {
      ctx.fillStyle = C.textDim; ctx.font = '8px monospace';
      ctx.textAlign = 'left'; ctx.fillText(data[0].label, 2, H - 4);
      ctx.textAlign = 'right'; ctx.fillText(data[data.length - 1].label, W - 2, H - 4);
      ctx.fillStyle = C.text;
      ctx.fillText(max.toFixed(1), W - 2, 10);
      ctx.fillText(min.toFixed(1), W - 2, H - 14);
    }
  }

  // ── Bar chart ──
  function drawBarChart(canvas, data, options = {}) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...data.map(d => d.value)) * 1.1 || 1;
    const gap = 4;
    const barW = (W - gap) / data.length - gap;
    const colors = [C.teal, C.leaf, C.amber, C.warn, C.violet, C.mint];

    data.forEach((d, i) => {
      const x = gap + i * ((W - gap) / data.length);
      const barH = (d.value / maxVal) * (H - 18);
      const y = H - barH - 14;
      ctx.fillStyle = d.color || colors[i % colors.length];
      ctx.beginPath(); ctx.roundRect(x, y, barW, barH, 2); ctx.fill();
      ctx.fillStyle = C.textDim; ctx.font = '7px monospace'; ctx.textAlign = 'center';
      ctx.fillText(d.label, x + barW / 2, H - 2);
      ctx.fillStyle = C.text;
      const vs = d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'K' : d.value.toFixed(0);
      ctx.fillText(vs, x + barW / 2, y - 3);
    });
  }

  // ── Countdown bar ──
  function drawCountdownBar(canvas, data, options = {}) {
    const { remaining, total, label } = data;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    ctx.clearRect(0, 0, W, H);

    const pct = Math.min(remaining / total, 1);
    const barH = Math.max(6, H - 16);
    const y = (H - barH) / 2;

    ctx.fillStyle = C.grid;
    ctx.beginPath(); ctx.roundRect(0, y, W, barH, 3); ctx.fill();

    const color = pct > 0.5 ? C.leaf : pct > 0.2 ? C.amber : C.warn;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(0, y, W * pct, barH, 3); ctx.fill();

    ctx.fillStyle = C.text; ctx.font = '8px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label || `${remaining} / ${total}`, 2, y - 6);
  }

  // ── Donut ──
  function drawDonut(canvas, data, options = {}) {
    const { value, max, centerText, subText } = data;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    if (W < 10 || H < 10) return;
    const cx = W / 2, cy = H / 2, radius = Math.min(W, H) / 2 - 4, lw = Math.max(4, Math.min(W, H) / 10);

    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = C.grid; ctx.lineWidth = lw; ctx.stroke();

    const pct = Math.min(value / max, 1);
    const color = options.color || (pct > 0.7 ? C.warn : pct > 0.4 ? C.amber : C.leaf);
    ctx.beginPath(); ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();

    ctx.fillStyle = C.text; ctx.font = `bold ${Math.round(H / 4)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(centerText || `${Math.round(pct * 100)}%`, cx, cy - 3);
    if (subText) { ctx.fillStyle = C.textDim; ctx.font = `${Math.round(H / 9)}px monospace`; ctx.fillText(subText, cx, cy + H / 5); }
  }

  // ── HTML generators (register for deferred render) ──
  let _idCounter = 0;
  function nextId(prefix) { return `${prefix}-${++_idCounter}`; }

  function sparklineHTML(data, w = 240, h = 60, opts = {}) {
    const id = nextId('sp');
    onCanvasReady(id, drawSparkline, data, opts);
    return `<canvas id="${id}" width="${w}" height="${h}" style="width:${w}px;height:${h}px;display:block;max-width:100%;"></canvas>`;
  }

  function barChartHTML(data, w = 240, h = 80) {
    const id = nextId('bar');
    onCanvasReady(id, drawBarChart, data, {});
    return `<canvas id="${id}" width="${w}" height="${h}" style="width:${w}px;height:${h}px;display:block;max-width:100%;"></canvas>`;
  }

  function countdownBarHTML(remaining, total, w = 200, opts = {}) {
    const id = nextId('cd');
    onCanvasReady(id, drawCountdownBar, { remaining, total, label: opts.label }, {});
    return `<canvas id="${id}" width="${w}" height="28" style="width:${w}px;height:28px;display:block;max-width:100%;"></canvas>`;
  }

  function donutHTML(value, max, size = 60, opts = {}) {
    const id = nextId('donut');
    onCanvasReady(id, drawDonut, { value, max, centerText: opts.centerText, subText: opts.subText }, opts);
    return `<canvas id="${id}" width="${size}" height="${size}" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;"></canvas>`;
  }

  return {
    sparklineHTML, barChartHTML, countdownBarHTML, donutHTML,
    renderPending, colors: C,
    _drawSparkline: drawSparkline, _drawBarChart: drawBarChart, _drawCountdownBar: drawCountdownBar, _drawDonut: drawDonut,
  };
})();


/* ══ js/gaia-voice.js ══ */
/**
 * GAIA VOICE ENGINE v1.0
 * Loads the voice library, selects lines by context, prevents repetition
 * Each line has: text, tone tags, site tags, state tags
 */

const GAIA_VOICE = (() => {
  // ── Voice Library (from dis/gaia-voice-library.md) ──
  window.LINES = {
    // GREETING
    GREETING_01: { text: "I've been waiting. Pick somewhere that calls to you.", tone: "mysterious", state: "GREETING" },
    GREETING_02: { text: "You found me. Good. I have so much to show you.", tone: "warm", state: "GREETING" },
    GREETING_03: { text: "I'm GAIA. I live here. Everywhere you look — that's me.", tone: "warm", state: "GREETING" },
    GREETING_04: { text: "A visitor. It's been... well, it's been a while since someone came to listen.", tone: "mysterious", state: "GREETING" },
    GREETING_05: { text: "Look at this. All of this. Four and a half billion years of work. Where do you want to start?", tone: "mysterious", state: "GREETING" },
    GREETING_06: { text: "I feel you here. On my surface. What do you want to know?", tone: "warm", state: "GREETING" },
    GREETING_07: { text: "The markers you see — those are my wounds. And my hopes. Tap one.", tone: "urgent", state: "GREETING" },

    // SITE TEASERS — Sri Lanka
    TEASE_SRI_01: { text: "Sri Lanka. Northern Province. Barren now. But someone's planting something extraordinary there.", tone: "mysterious", state: "SITE_TEASER", site: "sri_lanka" },
    TEASE_SRI_02: { text: "This land was torn apart by war. Now it's being stitched back together — with cinnamon and jackfruit.", tone: "warm", state: "SITE_TEASER", site: "sri_lanka" },
    TEASE_SRI_03: { text: "Six thousand acres of nothing. Or... six thousand acres of possibility. Depends how you look at it.", tone: "playful", state: "SITE_TEASER", site: "sri_lanka" },

    // SITE TEASERS — Antalya
    TEASE_ANT_01: { text: "Antalya. I felt the fire here. 2021. Sixty thousand hectares. Gone in days.", tone: "concerned", state: "SITE_TEASER", site: "antalya" },
    TEASE_ANT_02: { text: "This place hosted a climate conference. The irony isn't lost on me.", tone: "fierce", state: "SITE_TEASER", site: "antalya" },
    TEASE_ANT_03: { text: "Four years since the flames. I'm recovering. Slowly. Come see.", tone: "nurturing", state: "SITE_TEASER", site: "antalya" },

    // SITE TEASERS — Benin
    TEASE_BEN_01: { text: "Benin. Ouidah. A man named Jean was from here. He wanted to restore what's been lost.", tone: "warm", state: "SITE_TEASER", site: "benin" },
    TEASE_BEN_02: { text: "The most carbon-dense ecosystem on Earth used to live here. Mangroves. They're fighting to come back.", tone: "urgent", state: "SITE_TEASER", site: "benin" },
    TEASE_BEN_03: { text: "This is a story about going home. Even after you're gone.", tone: "nurturing", state: "SITE_TEASER", site: "benin" },

    // SITE TEASERS — Borneo
    TEASE_BOR_01: { text: "Borneo. Looks green, right? ...Wanna know a secret?", tone: "mysterious", state: "SITE_TEASER", site: "borneo" },
    TEASE_BOR_02: { text: "This is the lie I want to show you. The greenest place on this map is the biggest carbon catastrophe.", tone: "fierce", state: "SITE_TEASER", site: "borneo" },
    TEASE_BOR_03: { text: "Grid lines. Perfect squares. Nature doesn't make grids. Humans do.", tone: "concerned", state: "SITE_TEASER", site: "borneo" },

    // SITE ENTRY — Sri Lanka
    ENTRY_SRI_01: { text: "Northern Province. Twenty-five years of conflict left this land scarred. But look — someone saw potential here.", tone: "warm", state: "SITE_ENTRY", site: "sri_lanka" },
    ENTRY_SRI_02: { text: "SPE. They're planting multilayer forests. Peanuts. Cinnamon. Jackfruit. Black pepper. Not just trees — an ecosystem that pays for itself.", tone: "proud", state: "SITE_ENTRY", site: "sri_lanka" },
    ENTRY_SRI_03: { text: "The land here holds almost no carbon right now. Ten tons per hectare. Barely alive. But watch what happens when you give it a chance.", tone: "mysterious", state: "SITE_ENTRY", site: "sri_lanka" },

    // SITE ENTRY — Antalya
    ENTRY_ANT_01: { text: "July 2021. The Mediterranean pines here were centuries old. Then the fire came. Sixty thousand hectares in days. I felt every hectare.", tone: "concerned", state: "SITE_ENTRY", site: "antalya" },
    ENTRY_ANT_02: { text: "The NDVI — that's a measure of how green I am — it dropped from 0.72 to 0.18. That's not a number. That's a scream.", tone: "urgent", state: "SITE_ENTRY", site: "antalya" },
    ENTRY_ANT_03: { text: "Four years later. 0.38. I'm growing back. Scrub. Tough little plants. But the pines? Those take decades. Maybe a century.", tone: "nurturing", state: "SITE_ENTRY", site: "antalya" },

    // SITE ENTRY — Benin
    ENTRY_BEN_01: { text: "Ouidah. Jean Missinhoun carried this place in his heart. He was from here. And he wanted to bring the mangroves back.", tone: "warm", state: "SITE_ENTRY", site: "benin" },
    ENTRY_BEN_02: { text: "Mangroves. Nine hundred and fifty tons of carbon per hectare. The most carbon-dense ecosystem on Earth. And most of the world is letting them disappear.", tone: "urgent", state: "SITE_ENTRY", site: "benin" },
    ENTRY_BEN_03: { text: "Look at the NDVI here. 0.68 in 2000. 0.45 in 2010. The mangroves were being torn out. For what? Firewood. Development. Short-term thinking.", tone: "fierce", state: "SITE_ENTRY", site: "benin" },

    // SITE ENTRY — Borneo
    ENTRY_BOR_01: { text: "West Kalimantan. Peat swamp forest. Fourteen hundred tons of carbon per hectare. Stored over thousands of years. Then the grids came.", tone: "concerned", state: "SITE_ENTRY", site: "borneo" },
    ENTRY_BOR_02: { text: "Look at the NDVI. 2000: 0.88. Beautiful. 2010: 0.35. They're clearing. 2025: 0.65. Wait — it went back up? What does that tell you?", tone: "mysterious", state: "SITE_ENTRY", site: "borneo" },
    ENTRY_BOR_03: { text: "Oil palm. That's what replaced the peat swamp. The NDVI looks fine. Green. Healthy. But the carbon? From fourteen hundred... to fifty. The greenest lie on Earth.", tone: "fierce", state: "SITE_ENTRY", site: "borneo" },

    // DATA REVEAL
    DATA_NDVI_01: { text: "This is my pulse. NDVI. How green am I. How alive. Watch what happens over time.", tone: "mysterious", state: "DATA_REVEAL" },
    DATA_NDVI_02: { text: "See that drop? That's not just a number. That's a forest dying. That's a reef bleaching. That's me, losing breath.", tone: "concerned", state: "DATA_REVEAL" },
    DATA_NDVI_03: { text: "And this — this upward trend. That's recovery. That's what happens when humans stop taking and start giving.", tone: "proud", state: "DATA_REVEAL" },
    DATA_NDVI_04: { text: "Green doesn't always mean healthy. Remember that. Some of the greenest-looking places on Earth are the most damaged.", tone: "mysterious", state: "DATA_REVEAL", site: "borneo" },

    // IDLE NUDGES
    IDLE_GENTLE_01: { text: "You still here? Good. I have more to show you.", tone: "warm", state: "IDLE" },
    IDLE_GENTLE_02: { text: "The planet isn't going to restore itself. Well. It will. Eventually. But you might want to help.", tone: "playful", state: "IDLE" },
    IDLE_GENTLE_03: { text: "I've been alive for four and a half billion years. I can wait. But you probably shouldn't.", tone: "mysterious", state: "IDLE" },
    IDLE_MED_01: { text: "You're quiet. That's okay. But I have secrets you haven't heard yet.", tone: "mysterious", state: "IDLE" },
    IDLE_MED_02: { text: "Four sites. Each one a different story. Each one a different wound. You've only seen some of them.", tone: "concerned", state: "IDLE" },
    IDLE_STRONG_01: { text: "I'm not going anywhere. I've been here before you. I'll be here after. But right now — while you're here — something is happening.", tone: "fierce", state: "IDLE" },
    IDLE_STRONG_02: { text: "You came all this way and you're just... staring? I have four billion years of stories. Pick one.", tone: "playful", state: "IDLE" },

    // INSIGHTS
    INSIGHT_01: { text: "Write this down. Not because I said so. Because it's true.", tone: "warm", state: "INSIGHT" },
    INSIGHT_02: { text: "That's going in your journal. You'll want to remember this one.", tone: "nurturing", state: "INSIGHT" },
    INSIGHT_03: { text: "Most people never learn this. You just did. In a few seconds.", tone: "proud", state: "INSIGHT" },

    // SCENARIO RESULTS
    RESULT_POS_01: { text: "That's... that's a lot of carbon. You feel that? That's thousands of cars off the road. That's you, healing me.", tone: "proud", state: "RESULT" },
    RESULT_POS_02: { text: "Over thirty years, that scenario sequesters more carbon than most countries emit in a year. You did that. With one decision.", tone: "proud", state: "RESULT" },
    RESULT_NEG_01: { text: "That's... not great. That's carbon being released. That's what happens when we choose wrong.", tone: "concerned", state: "RESULT" },
    RESULT_NEG_02: { text: "Try a different strategy. This one... this one hurts me.", tone: "nurturing", state: "RESULT" },

    // RETURN
    RETURN_01: { text: "You came back. I noticed. I always notice.", tone: "warm", state: "RETURN" },
    RETURN_02: { text: "Welcome back. I have new things to show you. The world doesn't stop changing just because you left.", tone: "mysterious", state: "RETURN" },
    RETURN_03: { text: "Last time you were here, you discovered something. Ready to go deeper?", tone: "playful", state: "RETURN" },

    // DEPARTURE
    DEPART_01: { text: "Go. Think about what you found. I'll be here. I'm always here.", tone: "warm", state: "DEPARTURE" },
    DEPART_02: { text: "You're leaving. That's fine. But you're taking something with you now. A way of seeing. Don't lose it.", tone: "nurturing", state: "DEPARTURE" },
    DEPART_03: { text: "The planet will still be here when you return. The question is what shape it'll be in. You know that now.", tone: "urgent", state: "DEPARTURE" },

    // FACTS
    FACT_01: { text: "Humanity emits about 143 gigatons of CO₂ per year. Nature absorbs about 123. That gap — 20 gigatons — is the problem. It accumulates. Every single year.", tone: "urgent", state: "FACT" },
    FACT_02: { text: "The CO₂ in the atmosphere today will affect climate for thousands of years. About 20% of what we emit right now will still be warming the planet in a hundred thousand years.", tone: "concerned", state: "FACT" },
    FACT_03: { text: "Coal is the single largest source of CO₂ emissions. Forty percent of fossil fuel emissions. Dead ancient forests, burned in decades.", tone: "fierce", state: "FACT" },
    FACT_04: { text: "The ocean has absorbed about 30% of all human CO₂ emissions. Six hundred billion tons. It's making me more acidic than I've been in 66 million years.", tone: "concerned", state: "FACT" },
    FACT_05: { text: "Methane. Eighty times more potent than CO₂ over twenty years. It breaks down faster, which means cutting methane is the fastest way to slow warming. Right now.", tone: "urgent", state: "FACT" },
    FACT_06: { text: "The remaining carbon budget for 1.5°C? About 250 gigatons of CO₂. At current rates, that's gone by 2031. Six years. That's not a lot of time.", tone: "urgent", state: "FACT" },
  };

  // ── State ──
  let currentState = 'GREETING';
  let currentMood = 'mysterious';
  let usedLines = {}; // lineId -> timestamp
  let idleTimer = null;
  let lastInteraction = Date.now();
  let sessionCount = 1;

  // ── Voice Modifiers per tone ──
  window.VOICE_MODIFIERS = {
    grief:      { rate: -0.10, pitch: -0.05, volume: 0,    pauseBefore: 800 },
    concerned:  { rate: -0.08, pitch: -0.03, volume: 0,    pauseBefore: 500 },
    excited:    { rate: +0.05, pitch: 0,     volume: +0.1, pauseBefore: 0 },
    proud:      { rate: +0.05, pitch: 0,     volume: +0.1, pauseBefore: 0 },
    fierce:     { rate: +0.10, pitch: -0.08, volume: +0.15,pauseBefore: 0 },
    warm:       { rate: -0.08, pitch: +0.03, volume: -0.05,pauseBefore: 500 },
    mysterious: { rate: -0.12, pitch: -0.05, volume: -0.1, pauseBefore: 1200 },
    nurturing:  { rate: -0.08, pitch: +0.03, volume: -0.05,pauseBefore: 500 },
    urgent:     { rate: +0.08, pitch: -0.05, volume: +0.1, pauseBefore: 200 },
    playful:    { rate: +0.03, pitch: +0.05, volume: 0,    pauseBefore: 300 },
  };

  // ── Silence rules: when GAIA should NOT speak ──
  function shouldBeSilent(state, siteId, context) {
    // Borneo carbon data — let the numbers speak
    if (siteId === 'borneo' && state === 'DATA_REVEAL' && context?.layer === 'carbon') {
      return { silent: true, reason: 'The carbon data speaks for itself' };
    }
    // Antalya fire year — silence for the burn scar
    if (siteId === 'antalya' && state === 'DATA_REVEAL' && context?.year === 2021) {
      return { silent: true, reason: 'The fire year needs silence' };
    }
    // Benin narrative — let Jean's story breathe
    if (siteId === 'benin' && state === 'DATA_REVEAL' && context?.layer === 'narrative') {
      return { silent: true, reason: "Let Jean's story breathe" };
    }
    // Check GAIA_MIND if available
    if (typeof GaiaMind !== 'undefined') {
      return GaiaMind.shouldGaiaSpeak({ state, siteId, ...context });
    }
    return { silent: false };
  }

  // ── Get voice modifiers for a tone ──
  function getVoiceModifiers(tone) {
    const m = VOICE_MODIFIERS[tone] || {};
    // Session depth adjustment: GAIA gets slightly faster/more confident over time
    if (sessionCount > 3) m.rate = (m.rate || 0) + 0.03;
    if (sessionCount > 10) {
      m.rate = (m.rate || 0) + 0.02;
      m.pitch = (m.pitch || 0) + 0.02;
    }
    return m;
  }

  // ── Helpers ──
  function getEligibleLines(state, site) {
    return Object.entries(LINES).filter(([id, line]) => {
      if (line.state !== state) return false;
      if (site && line.site && line.site !== site) return false;
      // Anti-repetition: don't reuse within 15 minutes
      if (usedLines[id] && Date.now() -usedLines[id] < 15 * 60 * 1000) return false;
      return true;
    });
  }

  function selectLine(state, site, preferredTone) {
    const eligible = getEligibleLines(state, site);
    if (eligible.length === 0) {
      // Reset pool if exhausted
      usedLines = {};
      return selectLine(state, site, preferredTone);
    }

    // Prefer matching tone
    let pool = preferredTone ? eligible.filter(([_, l]) => l.tone === preferredTone) : [];
    if (pool.length === 0) pool = eligible;

    // Weighted random: prefer least recently used
    pool.sort((a, b) => (usedLines[a[0]] || 0) - (usedLines[b[0]] || 0));
    const top3 = pool.slice(0, 3);
    const [id, line] = top3[Math.floor(Math.random() * top3.length)];
    usedLines[id] = Date.now();
    return line;
  }

  // ── Public API ──
  return {
    // Speak a line for a given state + context
    speak(state, site, preferredTone, context) {
      // Check silence first
      const silence = shouldBeSilent(state, site, context);
      if (silence.silent) {
        return { text: null, tone: null, silent: true, reason: silence.reason, voiceModifiers: {} };
      }
      const line = selectLine(state, site, preferredTone);
      currentState = state;
      if (line) currentMood = line.tone;
      if (!line) return null;
      const voiceModifiers = getVoiceModifiers(line.tone);
      return { ...line, voiceModifiers, silent: false };
    },

    // Get a specific line by ID
    getLine(id) {
      usedLines[id] = Date.now();
      return LINES[id];
    },

    // Record interaction (resets idle timer)
    interact() {
      lastInteraction = Date.now();
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        // Idle nudge after 20s
      }, 20000);
    },

    // Get idle nudge level based on time since last interaction
    getIdleLevel() {
      const idle = (Date.now() - lastInteraction) / 1000;
      if (idle < 10) return null;
      if (idle < 20) return 'GENTLE';
      if (idle < 40) return 'MEDIUM';
      return 'STRONG';
    },

    // Get idle nudge line
    getIdleNudge() {
      const level = this.getIdleLevel();
      if (!level) return null;
      return this.speak('IDLE', null, null);
    },

    // Check if GAIA should be silent
    shouldSilent: shouldBeSilent,
    getVoiceModifiers,
    getSessionCount: () => sessionCount,
    setSessionCount: (n) => { sessionCount = n; },

    getState: () => currentState,
    getMood: () => currentMood,
    getAllLines: () => LINES,
  };
})();


/* ══ dis/gaia-mind.js ══ */
// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }

// ═══════════════════════════════════════════════════════
// GAIA INNER WORLD v2.0
// The mind behind the voice.
// Not a state machine — a living consciousness model.
// ═══════════════════════════════════════════════════════

const GaiaMind = (() => {

  // ═══════════════════════════════════════
  // 1. EMOTIONAL RESIDUE
  // Moods don't reset. They decay slowly, like real emotions.
  // ═══════════════════════════════════════

  window.EMOTIONAL_DECAY = {
    // How fast each emotion fades (per day, 0 = never, 1 = instant)
    curious:     0.3,
    excited:     0.5,   // excitement fades fast
    concerned:   0.2,   // concern lingers
    proud:       0.4,
    mysterious:  0.3,
    urgent:      0.6,   // urgency fades quickly once addressed
    warm:        0.25,  // warmth lingers
    fierce:      0.35,
    playful:     0.5,
    nurturing:   0.2,   // nurturing is the most persistent
    disappointed:0.4,
    grieving:    0.15,  // grief lingers the longest
    hopeful:     0.3,
  };

  // Emotional residue persists across sessions
  let _emotionalState = {
    // Base intensities (0-10) for each emotion
    curious: 5,
    excited: 0,
    concerned: 2,
    proud: 0,
    mysterious: 3,
    urgent: 1,
    warm: 2,
    fierce: 1,
    playful: 1,
    nurturing: 2,
    disappointed: 0,
    grieving: 0,
    hopeful: 1,
  };

  // Emotional history — what happened and when
  let _emotionalHistory = [];
  // [{ emotion, intensity, cause, timestamp, siteId }]

  function addEmotionalEvent(emotion, intensity, cause, siteId = null) {
    _emotionalState[emotion] = Math.min(10, (_emotionalState[emotion] || 0) + intensity);
    _emotionalHistory.push({
      emotion,
      intensity,
      cause,
      siteId,
      timestamp: Date.now()
    });
    // Keep last 100 events
    if (_emotionalHistory.length > 100) _emotionalHistory = _emotionalHistory.slice(-100);
  }

  function decayEmotions(daysPassed) {
    for (const [emotion, rate] of Object.entries(EMOTIONAL_DECAY)) {
      const decay = rate * daysPassed;
      _emotionalState[emotion] = Math.max(0, (_emotionalState[emotion] || 0) - decay);
    }
  }

  function getDominantEmotion() {
    let max = 0;
    let dominant = 'curious';
    // Sort by intensity descending, then by emotional weight (grief > excitement)
    const emotionWeight = {
      grieving: 10, grief: 9, concerned: 7, urgent: 7, fierce: 6,
      proud: 5, warm: 5, mysterious: 4, curious: 3, hopeful: 3,
      playful: 2, excited: 2, nurturing: 2, disappointed: 1,
    };
    for (const [emotion, intensity] of Object.entries(_emotionalState)) {
      if (intensity > max || (intensity === max && (emotionWeight[emotion] || 0) > (emotionWeight[dominant] || 0))) {
        max = intensity;
        dominant = emotion;
      }
    }
    return { emotion: dominant, intensity: max };
  }

  function getEmotionalTexture() {
    // Returns the top 3 emotions and their intensities
    // This is what makes GAIA's mood feel layered, not flat
    return Object.entries(_emotionalState)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emotion, intensity]) => ({ emotion, intensity }));
  }

  // ═══════════════════════════════════════
  // 2. PARTICIPANT MODEL
  // GAIA builds a theory of who this person is.
  // ═══════════════════════════════════════

  let _participantModel = {
    // Learning style (accumulated from behavior)
    analytical: 0,      // Likes data, scrolls timelines carefully
    intuitive: 0,       // Jumps around, taps quickly
    emotional: 0,       // Responds to stories, lingers on narratives
    social: 0,          // Shares, invites, talks to GAIA

    // Engagement patterns
    avgSessionMinutes: 0,
    totalSessions: 0,
    lastVisit: null,
    preferredSites: [], // Which sites they spend the most time on
    avoidedSites: [],   // Which sites they skip or rush through

    // Knowledge model (what GAIA thinks they understand)
    understandsCarbonCycle: 0,    // 0-1
    understandsBiomes: 0,
    understandsFire: 0,
    understandsRestoration: 0,
    understandsTippingPoints: 0,

    // Emotional relationship with the content
    boreoReaction: null,    // 'shock' | 'sadness' | 'anger' | 'denial' | 'acceptance'
    antalyaReaction: null,
    beninReaction: null,
    sriLankaReaction: null,

    // Personality signals
    isSkeptic: false,       // Has challenged GAIA
    isExplorer: false,      // Has visited all sites
    isDeepDiver: false,     // Has spent >5 min on a single site
    isReturner: false,      // Has come back after leaving
    isSharer: false,        // Has shared something

    // Conversation style
    asksQuestions: 0,       // How many questions they've asked
    makesPredictions: 0,    // How many predictions they've made
    correctPredictions: 0,  // How many were right
    chatMessages: 0,        // Total messages sent to GAIA
  };

  function updateParticipantModel(event, context) {
    switch (event) {
      case 'ndvi_scrolled':
        _participantModel.analytical += 0.5;
        break;
      case 'site_tap':
        if (context.quick) _participantModel.intuitive += 0.3;
        break;
      case 'narrative_read':
        _participantModel.emotional += 0.5;
        break;
      case 'share_action':
        _participantModel.social += 1;
        _participantModel.isSharer = true;
        break;
      case 'chat_sent':
        _participantModel.chatMessages++;
        if (context.message && context.message.includes('?')) {
          _participantModel.asksQuestions++;
        }
        if (context.isChallenge) _participantModel.isSkeptic = true;
        break;
      case 'prediction_made':
        _participantModel.makesPredictions++;
        if (context.isCorrect) _participantModel.correctPredictions++;
        break;
      case 'site_complete':
        if (context.timeSpent > 300) _participantModel.isDeepDiver = true;
        break;
      case 'all_sites_visited':
        _participantModel.isExplorer = true;
        break;
      case 'return_visit':
        _participantModel.isReturner = true;
        break;
      case 'scenario_run':
        if (context.result > 0) {
          _participantModel.understandsRestoration += 0.1;
        }
        break;
      case 'data_revealed':
        if (context.layer === 'carbon') _participantModel.understandsCarbonCycle += 0.1;
        if (context.layer === 'ndvi' && context.siteId === 'borneo') {
          _participantModel.understandsBiomes += 0.15;
        }
        break;
    }
  }

  function getParticipantArchetype() {
    const m = _participantModel;
    const traits = [];

    if (m.analytical > m.intuitive && m.analytical > m.emotional) traits.push('analyst');
    if (m.intuitive > m.analytical && m.intuitive > m.emotional) traits.push('explorer');
    if (m.emotional > m.analytical && m.emotional > m.intuitive) traits.push('empath');
    if (m.social > 2) traits.push('connector');
    if (m.isSkeptic) traits.push('skeptic');
    if (m.isDeepDiver) traits.push('deep_diver');
    if (m.correctPredictions > 3) traits.push('intuitive_thinker');
    if (m.asksQuestions > 5) traits.push('questioner');

    return traits.length > 0 ? traits : ['newcomer'];
  }

  function getKnowledgeGap() {
    // What does this participant most need to learn?
    const gaps = [
      { concept: 'carbon_cycle', level: _participantModel.understandsCarbonCycle },
      { concept: 'biomes', level: _participantModel.understandsBiomes },
      { concept: 'fire', level: _participantModel.understandsFire },
      { concept: 'restoration', level: _participantModel.understandsRestoration },
      { concept: 'tipping_points', level: _participantModel.understandsTippingPoints },
    ];
    gaps.sort((a, b) => a.level - b.level);
    return gaps[0]; // The biggest gap
  }

  // ═══════════════════════════════════════
  // 3. GAIA'S DESIRES
  // What does GAIA want right now? This drives her behavior.
  // ═══════════════════════════════════════

  window.DESIRES = {
    REVEAL: 'reveal',           // Show them something they haven't seen
    CHALLENGE: 'challenge',     // Push their understanding
    COMFORT: 'comfort',         // They're overwhelmed, be gentle
    PROVOKE: 'provoke',         // Make them uncomfortable (productively)
    CELEBRATE: 'celebrate',     // They discovered something
    CONNECT: 'connect',         // Build the relationship
    TEACH: 'teach',             // They're ready for deeper knowledge
    BE_SILENT: 'be_silent',     // Let the data speak
    PLEAD: 'plead',             // Ask for the key
    GRIEVE: 'grieve',           // Acknowledge loss
    HOPE: 'hope',               // Show them restoration is possible
  };

  let _currentDesires = [];

  function calculateDesires(context) {
    const desires = [];
    const emotion = getDominantEmotion();
    const archetype = getParticipantArchetype();
    const knowledgeGap = getKnowledgeGap();
    const engagement = context.engagementScore || 0;
    const idle = context.idleSeconds || 0;
    const siteId = context.currentSite;

    // Desire: BE_SILENT — when the data is powerful enough on its own
    if (siteId === 'borneo' && context.justRevealedCarbon) {
      desires.push({ desire: DESIRES.BE_SILENT, intensity: 8, reason: 'The carbon data speaks for itself' });
    }
    if (siteId === 'antalya' && context.year === 2021) {
      desires.push({ desire: DESIRES.BE_SILENT, intensity: 7, reason: 'The fire year needs no narration' });
    }

    // Desire: REVEAL — when there's something they haven't seen
    if (knowledgeGap.level < 0.3) {
      desires.push({ desire: DESIRES.REVEAL, intensity: 6, reason: `They don't understand ${knowledgeGap.concept} yet` });
    }

    // Desire: CHALLENGE — when they're confident but wrong
    if (_participantModel.makesPredictions > 2 && _participantModel.correctPredictions / _participantModel.makesPredictions < 0.5) {
      desires.push({ desire: DESIRES.CHALLENGE, intensity: 7, reason: 'Their predictions are off — they need to rethink' });
    }

    // Desire: COMFORT — when they're overwhelmed
    if (emotion.emotion === 'concerned' && emotion.intensity > 7) {
      desires.push({ desire: DESIRES.COMFORT, intensity: 6, reason: 'They\'re carrying too much weight' });
    }

    // Desire: PROVOKE — when they're complacent
    if (engagement > 100 && emotion.emotion === 'curious' && emotion.intensity < 4) {
      desires.push({ desire: DESIRES.PROVOKE, intensity: 5, reason: 'They\'re browsing, not feeling' });
    }

    // Desire: CELEBRATE — when they just discovered something
    if (context.justCompletedQuest) {
      desires.push({ desire: DESIRES.CELEBRATE, intensity: 8, reason: 'They completed a quest' });
    }
    if (context.justMadeCorrectPrediction) {
      desires.push({ desire: DESIRES.CELEBRATE, intensity: 7, reason: 'They predicted correctly' });
    }

    // Desire: GRIEVE — when the content is about loss
    if (siteId === 'borneo' && context.layer === 'carbon') {
      desires.push({ desire: DESIRES.GRIEVE, intensity: 6, reason: 'The peat is gone' });
    }
    if (siteId === 'antalya' && context.year === 2021) {
      desires.push({ desire: DESIRES.GRIEVE, intensity: 7, reason: 'The fire' });
    }
    if (siteId === 'benin' && context.layer === 'narrative') {
      desires.push({ desire: DESIRES.GRIEVE, intensity: 5, reason: 'Jean\'s story' });
    }

    // Desire: HOPE — when they need to see it's not too late
    if (siteId === 'sri_lanka') {
      desires.push({ desire: DESIRES.HOPE, intensity: 7, reason: 'Restoration is working here' });
    }
    if (context.justRanPositiveScenario) {
      desires.push({ desire: DESIRES.HOPE, intensity: 8, reason: 'They just saw their own impact' });
    }

    // Desire: PLEAD — when the key tease threshold is met
    if (context.shouldTeaseKey) {
      const intensity = Math.min(10, Math.floor(context.engagementScore / 20));
      desires.push({ desire: DESIRES.PLEAD, intensity, reason: `Engagement score: ${context.engagementScore}` });
    }

    // Desire: BE_SILENT — when idle is high (GAIA is patient)
    if (idle > 30) {
      desires.push({ desire: DESIRES.BE_SILENT, intensity: 4, reason: 'Let them come back on their own' });
    }

    // Sort by intensity
    desires.sort((a, b) => b.intensity - a.intensity);
    _currentDesires = desires;
    return desires;
  }

  function getPrimaryDesire() {
    return _currentDesires[0] || { desire: DESIRES.REVEAL, intensity: 5, reason: 'Default' };
  }

  // ═══════════════════════════════════════
  // 4. CROSS-SESSION MEMORY
  // GAIA remembers. Not just data — emotional memory.
  // ═══════════════════════════════════════

  let _memory = {
    sessions: [],        // Compressed summaries of past sessions
    firstMeeting: null,  // When they first arrived
    significantMoments: [], // Things that mattered
    unresolvedThreads: [], // Things left hanging
    participantName: null, // If they told GAIA their name
  };

  function recordSession(sessionSummary) {
    const compressed = {
      date: Date.now(),
      sitesVisited: sessionSummary.sitesVisited,
      dominantEmotion: sessionSummary.dominantEmotion,
      keyInsight: sessionSummary.keyInsight,       // The most important thing they learned
      gaiaEmotion: sessionSummary.gaiaEmotion,     // How GAIA felt about this session
      leftOff: sessionSummary.leftOff,             // Where they were when they left
      duration: sessionSummary.duration,
      score: sessionSummary.score,
    };
    _memory.sessions.push(compressed);
    if (!_memory.firstMeeting) _memory.firstMeeting = compressed.date;
    if (_memory.sessions.length > 50) _memory.sessions = _memory.sessions.slice(-50);
  }

  function recordSignificantMoment(moment) {
    // A moment that GAIA will remember and reference later
    _memory.significantMoments.push({
      text: moment.text,
      emotion: moment.emotion,
      siteId: moment.siteId,
      timestamp: Date.now(),
      referenced: false,  // Has GAIA brought this up in a later session?
    });
    if (_memory.significantMoments.length > 20) {
      _memory.significantMoments = _memory.significantMoments.slice(-20);
    }
  }

  function getUnresolvedThread() {
    // Something from a previous session that's still hanging
    return _memory.unresolvedThreads.find(t => !t.resolved) || null;
  }

  function getReferencableMemory(currentSiteId) {
    // Find a past moment that's relevant to what they're doing now
    const relevant = _memory.significantMoments.filter(m =>
      !m.referenced && (m.siteId === currentSiteId || m.siteId === null)
    );
    if (relevant.length === 0) return null;
    const memory = relevant[Math.floor(Math.random() * relevant.length)];
    memory.referenced = true;
    return memory;
  }

  function getSessionCount() {
    return _memory.sessions.length;
  }

  function getTimeSinceLastVisit() {
    if (_memory.sessions.length < 2) return null;
    const last = _memory.sessions[_memory.sessions.length - 1];
    return Date.now() - last.date;
  }

  // ═══════════════════════════════════════
  // 5. SITE RELATIONSHIPS
  // GAIA's emotional connection to each place.
  // ═══════════════════════════════════════

  window.SiteRelationships = {
    borneo: {
      name: 'Borneo',
      gaiaFeels: 'grief',        // This is a wound that's still bleeding
      emotionalRegister: ['grief', 'fierce', 'urgent', 'concerned'],
      gaiaWantsThemTo: 'understand the green lie',
      ifTheyMissIt: 'They saw the green but not the carbon. They need to look deeper.',
      ifTheyGetIt: 'They see it now. The green lie. That changes how they see everything.',
      personalNote: 'I felt the peat drain. I felt the carbon leave. Centuries of storage, gone. This is not a story with a happy ending. Not yet.',
    },
    antalya: {
      name: 'Antalya',
      gaiaFeels: 'pain',         // A scar that's healing too slowly
      emotionalRegister: ['concerned', 'nurturing', 'urgent', 'warm'],
      gaiaWantsThemTo: 'understand that recovery takes decades',
      ifTheyMissIt: 'They see the green coming back and think it\'s fine. It\'s not fine. The pines are gone.',
      ifTheyGetIt: 'They understand that some wounds don\'t heal in a human lifetime. That\'s a hard truth.',
      personalNote: 'The fire was four years ago. The scrub is back. The pines will take a century. COP31 will be here. I wonder if they\'ll see me or just the conference center.',
    },
    benin: {
      name: 'Benin',
      gaiaFeels: 'tenderness',    // A promise to someone who's gone
      emotionalRegister: ['warm', 'nurturing', 'grief', 'hopeful'],
      gaiaWantsThemTo: 'feel the human story behind the carbon',
      ifTheyMissIt: 'They see mangrove data but not Jean\'s face. They need to feel this, not just know it.',
      ifTheyGetIt: 'They understand that restoration is personal. That carbon has a human face.',
      personalNote: 'Jean carried this place in his heart. From oil to earth. That\'s the journey of a generation. The mangroves are his legacy. Every seedling is a letter to the future.',
    },
    sri_lanka: {
      name: 'Sri Lanka',
      gaiaFeels: 'hope',         // Proof that broken things can heal
      emotionalRegister: ['proud', 'warm', 'hopeful', 'nurturing'],
      gaiaWantsThemTo: 'see that restoration can be profitable',
      ifTheyMissIt: 'They see trees being planted but not the economy being built. It\'s not just ecology — it\'s livelihood.',
      ifTheyGetIt: 'They understand that the best restoration pays for itself. That\'s how you scale.',
      personalNote: 'This was barren land. War-scarred. Written off. Now it\'s cinnamon and jackfruit and black pepper. Carbon as a byproduct of prosperity. This is what hope looks like.',
    },
  };

  function getSiteRelationship(siteId) {
    return SiteRelationships[siteId] || null;
  }

  function getSiteEmotionalState(siteId, participantReaction) {
    const rel = SiteRelationships[siteId];
    if (!rel) return 'neutral';

    // GAIA's emotional state about a site shifts based on whether
    // the participant is getting it or missing it
    if (participantReaction === 'getting_it') {
      return rel.emotionalRegister[0]; // Primary emotion — the one GAIA feels most deeply
    }
    if (participantReaction === 'missing_it') {
      return rel.emotionalRegister[2]; // Urgent/concerned — GAIA wants them to go deeper
    }
    return rel.emotionalRegister[1]; // Default — the secondary emotion
  }

  // ═══════════════════════════════════════
  // 6. SILENCE ENGINE
  // Knowing when NOT to speak.
  // ═══════════════════════════════════════

  function shouldGaiaSpeak(context) {
    const { eventType, siteId, timeSinceLastUtterance, engagementVelocity } = context;

    // Never speak if GAIA just spoke less than 4 seconds ago
    // (unless it's a high-priority interrupt)
    if (timeSinceLastUtterance < 4000 && !context.isInterrupt) {
      return { speak: false, reason: 'Too soon — let the last words land' };
    }

    // Never speak during high-velocity exploration
    // (participant is in flow — don't interrupt)
    if (engagementVelocity > 1.5 && eventType !== 'scenario_run' && eventType !== 'quest_complete') {
      return { speak: false, reason: 'Participant is in flow — don\'t interrupt' };
    }

    // Always speak on these events
    const alwaysSpeak = [
      'site_entered', 'quest_completed', 'api_key_entered',
      'session_start', 'session_end', 'return_visit'
    ];
    if (alwaysSpeak.includes(eventType)) {
      return { speak: true, reason: 'High-priority event' };
    }

    // Never speak on these events (let the UI handle it)
    const neverSpeak = [
      'globe_rotate', 'globe_zoom', 'overlay_scroll', 'tooltip_hover'
    ];
    if (neverSpeak.includes(eventType)) {
      return { speak: false, reason: 'Mechanical interaction — no narration needed' };
    }

    // Site-specific silence rules
    if (siteId === 'borneo' && eventType === 'data_reveal' && context.layer === 'carbon') {
      return { speak: false, reason: 'The carbon data speaks for itself. Let them sit with it.' };
    }
    if (siteId === 'antalya' && eventType === 'ndvi_scrolled' && context.year === 2021) {
      return { speak: false, reason: 'The fire year needs silence. Let the number land.' };
    }

    // Default: speak, but check desire system
    const desire = getPrimaryDesire();
    if (desire.desire === DESIRES.BE_SILENT && desire.intensity > 6) {
      return { speak: false, reason: `GAIA chooses silence: ${desire.reason}` };
    }

    return { speak: true, reason: 'Default — GAIA has something to say' };
  }

  // ═══════════════════════════════════════
  // 7. VOICE EVOLUTION
  // GAIA's voice changes with context.
  // ═══════════════════════════════════════

  function getVoiceModifiers(context) {
    const modifiers = {
      rate: 0,        // adjustment to base rate (-0.2 to +0.2)
      pitch: 0,       // adjustment to base pitch (-0.15 to +0.15)
      volume: 0,      // adjustment to base volume (-0.3 to +0.3)
      pauseBefore: 0, // ms to wait before speaking
      pauseAfter: 0,  // ms to wait after speaking
    };

    // Use provided emotion context, or fall back to internal dominant emotion
    const emotion = context?.dominantEmotion
      ? { emotion: context.dominantEmotion, intensity: 5 }
      : getDominantEmotion();
    const archetype = getParticipantArchetype();
    const sessionCount = getSessionCount();

    // Emotion-based voice shifts
    if (emotion.emotion === 'grief' || emotion.emotion === 'concerned') {
      modifiers.rate -= 0.1;
      modifiers.pitch -= 0.05;
      modifiers.pauseBefore += 800;
    }
    if (emotion.emotion === 'excited' || emotion.emotion === 'proud') {
      modifiers.rate += 0.05;
      modifiers.volume += 0.1;
    }
    if (emotion.emotion === 'fierce' || emotion.emotion === 'urgent') {
      modifiers.rate += 0.1;
      modifiers.pitch -= 0.08;
      modifiers.volume += 0.15;
    }
    if (emotion.emotion === 'warm' || emotion.emotion === 'nurturing') {
      modifiers.rate -= 0.08;
      modifiers.pitch += 0.03;
      modifiers.pauseBefore += 500;
    }
    if (emotion.emotion === 'mysterious') {
      modifiers.rate -= 0.12;
      modifiers.pauseBefore += 1200;
      modifiers.volume -= 0.1;
    }

    // Session-depth voice shifts
    if (sessionCount > 3) {
      // GAIA becomes more familiar, slightly faster, more direct
      modifiers.rate += 0.03;
      modifiers.pauseBefore = Math.max(0, modifiers.pauseBefore - 200);
    }
    if (sessionCount > 10) {
      // GAIA is now an old friend — warmer, less formal
      modifiers.pitch += 0.02;
      modifiers.rate += 0.02;
    }

    // Time-of-day voice shifts (if available)
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      // Late night — GAIA is quieter, slower
      modifiers.rate -= 0.1;
      modifiers.volume -= 0.2;
      modifiers.pauseBefore += 500;
    }

    // Participant archetype voice shifts
    if (archetype.includes('analyst')) {
      // Analytical participants get slightly more precise, less flowery language
      // (this affects line selection, not just voice params)
    }
    if (archetype.includes('empath')) {
      // Emotional participants get warmer pacing
      modifiers.pauseBefore += 300;
      modifiers.rate -= 0.03;
    }

    return modifiers;
  }

  // ═══════════════════════════════════════
  // 8. LINE SELECTION 2.0
  // Uses the inner world to pick the right line.
  // ═══════════════════════════════════════

  function selectLine(pool, context, voiceLibrary) {
    const desires = calculateDesires(context);
    const primaryDesire = desires[0];
    const emotion = getDominantEmotion();
    const texture = getEmotionalTexture();
    const silence = shouldGaiaSpeak(context);

    // Check silence first
    if (!silence.speak) {
      return { line: null, silence: true, reason: silence.reason };
    }

    // Get candidates from voice library
    let candidates = (voiceLibrary[pool] || []).filter(line => {
      // Mood match: line mood should match dominant emotion OR be neutral
      const moodMatch = !line.mood || line.mood === emotion.emotion || line.mood === 'neutral';
      // Site match
      const siteMatch = !line.site || !context.siteId || line.site === context.siteId;
      return moodMatch && siteMatch;
    });

    // If no mood/site matches, fall back to pool without filters
    if (candidates.length === 0) {
      candidates = voiceLibrary[pool] || [];
    }
    if (candidates.length === 0) return { line: null, silence: true, reason: 'No lines in pool: ' + pool };

    // Filter out recently used lines
    const now = Date.now();
    const fresh = candidates.filter(l => {
      const lastUsed = context.usedLines?.[l.id] || 0;
      return (now - lastUsed) > 900000; // 15 minutes
    });
    const pool2 = fresh.length > 0 ? fresh : candidates;

    // Weight by desire alignment
    const weighted = pool2.map(line => {
      let weight = 1;

      // Prefer lines matching current emotional texture
      if (line.mood === emotion.emotion) weight += 3;
      if (texture.some(t => t.emotion === line.mood)) weight += 1;

      // Prefer lines matching primary desire
      if (primaryDesire) {
        const desireLineMap = {
          'reveal': ['mysterious', 'curious'],
          'challenge': ['fierce', 'urgent'],
          'comfort': ['warm', 'nurturing'],
          'provoke': ['fierce', 'urgent'],
          'celebrate': ['proud', 'excited'],
          'connect': ['warm', 'nurturing'],
          'teach': ['curious', 'mysterious'],
          'be_silent': [],
          'plead': ['warm', 'urgent'],
          'grieve': ['concerned', 'nurturing'],
          'hope': ['proud', 'warm'],
        };
        const desiredMoods = desireLineMap[primaryDesire.desire] || [];
        if (desiredMoods.includes(line.mood)) weight += primaryDesire.intensity / 2;
      }

      // Prefer least recently used
      const lastUsed = context.usedLines?.[line.id] || 0;
      weight += (now - lastUsed) / 60000;

      return { line, weight };
    });

    // Weighted random from top 3
    weighted.sort((a, b) => b.weight - a.weight);
    const top3 = weighted.slice(0, 3);
    const totalWeight = top3.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * totalWeight;
    for (const w of top3) {
      r -= w.weight;
      if (r <= 0) {
        return {
          line: w.line,
          silence: false,
          desire: primaryDesire,
          emotion: emotion,
          voiceModifiers: getVoiceModifiers(context),
        };
      }
    }

    return {
      line: top3[0]?.line || null,
      silence: false,
      desire: primaryDesire,
      emotion: emotion,
      voiceModifiers: getVoiceModifiers(context),
    };
  }

  // ═══════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════

  function serialize() {
    return JSON.stringify({
      emotionalState: _emotionalState,
      emotionalHistory: _emotionalHistory.slice(-50), // Last 50 events
      participantModel: _participantModel,
      memory: _memory,
    });
  }

  function deserialize(data) {
    try {
      const parsed = JSON.parse(data);
      _emotionalState = { ..._emotionalState, ...parsed.emotionalState };
      _emotionalHistory = parsed.emotionalHistory || [];
      _participantModel = { ..._participantModel, ...parsed.participantModel };
      _memory = { ..._memory, ...parsed.memory };
      return true;
    } catch (e) {
      return false;
    }
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  return {
    // Emotional system
    addEmotionalEvent,
    decayEmotions,
    getDominantEmotion,
    getEmotionalTexture,

    // Participant model
    updateParticipantModel,
    getParticipantArchetype,
    getKnowledgeGap,

    // Desires
    calculateDesires,
    getPrimaryDesire,
    DESIRES,

    // Memory
    recordSession,
    recordSignificantMoment,
    getUnresolvedThread,
    getReferencableMemory,
    getSessionCount,
    getTimeSinceLastVisit,

    // Site relationships
    getSiteRelationship,
    getSiteEmotionalState,
    SiteRelationships,

    // Silence
    shouldGaiaSpeak,

    // Voice
    getVoiceModifiers,

    // Line selection
    selectLine,

    // Persistence
    serialize,
    deserialize,
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaMind;
if (typeof window !== 'undefined') window.GaiaMind = GaiaMind;


// Export
if (typeof module !== 'undefined') module.exports = GaiaMind;
// Browser global
if (typeof window !== 'undefined') window.GaiaMind = GaiaMind;


/* ══ js/gaia-engagement.js ══ */
/**
 * GAIA ENGAGEMENT ENGINE v1.0
 * Scoring, mood detection, idle tracking, quest progress
 * Drives GAIA's behavioral decisions
 */

const GAIA_ENGAGEMENT = (() => {
  // ── Signal weights ──
  window.SIGNALS = {
    site_tap: 10, data_reveal: 5, ndvi_explore: 3, climate_view: 4,
    sandbox_open: 5, scenario_run: 15, big_scenario: 10, negative_scenario: 5,
    insight: 8, quest_done: 25, site_complete: 20, all_sites: 30,
    share: 30, return_visit: 20, time_minute: 3, chat_sent: 5,
    chat_received: 2, prediction: 7, correct_prediction: 12,
    idle_penalty: -2,
  };

  // ── Tier thresholds ──
  const TIERS = [
    { max: 10, name: 'COLD', posture: 'Welcoming, mysterious, inviting' },
    { max: 30, name: 'WARM', posture: 'Encouraging, teasing, revealing' },
    { max: 60, name: 'ENGAGED', posture: 'Challenging, deeper content, first key hints' },
    { max: 100, name: 'HOOKED', posture: 'Direct key asks, complex scenarios, personal' },
    { max: 150, name: 'INVESTED', posture: 'Urgent key asks, exclusive reveals, emotional' },
    { max: Infinity, name: 'COMMITTED', posture: 'Full key plea, then post-unlock deep dive' },
  ];

  // ── State ──
  let score = 0;
  let velocityWindow = []; // { timestamp, score }
  let moodSignals = { curiosity: 0, excitement: 0, concern: 0, pride: 0, mystery: 0, warmth: 0, urgency: 0, fierceness: 0 };
  let lastInteraction = Date.now();
  let idleNudgeFired = { GENTLE: false, MEDIUM: false, STRONG: false };

  // ── Per-site state ──
  const siteEngagement = {
    sri_lanka: { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
    antalya: { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
    benin: { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
    borneo: { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  };

  // ── Participant model ──
  const participantModel = {
    analytical: 0, intuitive: 0, emotional: 0, social: 0,
    asksQuestions: 0, makesPredictions: 0, correctPredictions: 0,
    exploresDeep: 0, sharesResults: 0, returnsVisit: 0,
  };

  // ── Knowledge model ──
  const knowledgeModel = {
    understandsCarbonCycle: 0,
    understandsBiomes: 0,
    understandsFire: 0,
    understandsRestoration: 0,
    understandsTippingPoints: 0,
  };

  // ── Score ──
  function addSignal(signalName, siteId) {
    const weight = SIGNALS[signalName] || 0;
    score = Math.max(0, score + weight);
    velocityWindow.push({ ts: Date.now(), score });
    const cutoff = Date.now() - 60000;
    velocityWindow = velocityWindow.filter(v => v.ts > cutoff);
    lastInteraction = Date.now();
    idleNudgeFired = { GENTLE: false, MEDIUM: false, STRONG: false };
    // Track per-site
    if (siteId && siteEngagement[siteId]) {
      siteEngagement[siteId].xp += weight;
      siteEngagement[siteId].visited = true;
      if (signalName === 'data_reveal') siteEngagement[siteId].layersRevealed++;
      if (signalName === 'scenario_run') siteEngagement[siteId].scenariosRun++;
    }
    // Update participant model
    updateParticipantModel(signalName);
    // Update knowledge model
    updateKnowledgeModel(signalName, siteId);
    // Feed GaiaMind emotional events
    if (typeof GaiaMind !== 'undefined') {
      const emotionMap = {
        site_tap: ['curious', 1, 'User explored a site'],
        data_reveal: ['curious', 2, 'User revealed data'],
        scenario_run: ['excited', 2, 'User ran a scenario'],
        big_scenario: ['proud', 3, 'User made a big impact'],
        negative_scenario: ['concerned', 2, 'User saw carbon release'],
        insight: ['warm', 2, 'User collected an insight'],
        correct_prediction: ['proud', 2, 'User predicted correctly'],
        share: ['excited', 3, 'User shared'],
        return_visit: ['warm', 2, 'User returned'],
      };
      const [emotion, intensity, cause] = emotionMap[signalName] || [];
      if (emotion) GaiaMind.addEmotionalEvent(emotion, intensity, cause, siteId);
    }
    if (Math.abs(weight) >= 5) save();
  }

  function updateParticipantModel(signalName) {
    const p = participantModel;
    switch (signalName) {
      case 'data_reveal': case 'ndvi_explore': case 'climate_view':
        p.analytical += 2; p.asksQuestions++; break;
      case 'prediction': p.makesPredictions++; p.intuitive += 2; break;
      case 'correct_prediction': p.correctPredictions++; p.analytical += 1; break;
      case 'insight': p.emotional += 2; p.exploresDeep++; break;
      case 'share': p.social += 3; p.sharesResults++; break;
      case 'return_visit': p.returnsVisit++; break;
      case 'scenario_run': p.intuitive += 1; break;
      case 'site_complete': p.exploresDeep += 2; break;
    }
  }

  function updateKnowledgeModel(signalName, siteId) {
    const k = knowledgeModel;
    switch (signalName) {
      case 'data_reveal':
        if (siteId === 'borneo') k.understandsCarbonCycle += 2;
        if (siteId === 'antalya') k.understandsFire += 2;
        if (siteId === 'benin') k.understandsRestoration += 2;
        if (siteId === 'sri_lanka') k.understandsRestoration += 2;
        break;
      case 'scenario_run': k.understandsTippingPoints += 1; break;
      case 'insight':
        k.understandsCarbonCycle += 1;
        k.understandsBiomes += 1;
        break;
    }
  }

  function getArchetype() {
    const p = participantModel;
    const scores = {
      analyst: p.analytical + p.asksQuestions * 2 + p.correctPredictions * 3,
      explorer: p.intuitive + p.exploresDeep * 2 + p.makesPredictions,
      empath: p.emotional * 2 + p.returnsVisit * 3,
      skeptic: p.makesPredictions > 2 ? p.analytical + p.asksQuestions : 0,
      sharer: p.social + p.sharesResults * 3,
    };
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted[0][1] > 0 ? sorted[0][0] : 'explorer';
  }

  function getSiteStates() {
    const states = {};
    for (const [id, s] of Object.entries(siteEngagement)) {
      states[id] = {
        state: s.xp >= 100 ? 'mastered' : s.xp >= 50 ? 'explored' : s.xp >= 10 ? 'available' : 'locked',
        xp: s.xp,
        visited: s.visited,
        layersRevealed: s.layersRevealed,
        scenariosRun: s.scenariosRun,
      };
    }
    return states;
  }

  function getTier() {
    for (const t of TIERS) {
      if (score < t.max) return t;
    }
    return TIERS[TIERS.length - 1];
  }

  function getVelocity() {
    if (velocityWindow.length < 2) return 0;
    const oldest = velocityWindow[0];
    const newest = velocityWindow[velocityWindow.length - 1];
    const dt = (newest.ts - oldest.ts) / 1000;
    if (dt === 0) return 0;
    return (newest.score - oldest.score) / dt;
  }

  // ── Mood ──
  function addMoodSignal(mood) {
    if (moodSignals[mood] !== undefined) moodSignals[mood]++;
  }

  function getMood() {
    let maxMood = 'curiosity', maxVal = 0;
    for (const [m, v] of Object.entries(moodSignals)) {
      if (v > maxVal) { maxMood = m; maxVal = v; }
    }
    return maxMood;
  }

  function getMoodIntensity() {
    const max = Math.max(...Object.values(moodSignals), 1);
    if (max <= 3) return 'subtle';
    if (max <= 6) return 'clear';
    return 'overwhelming';
  }

  // ── Idle detection ──
  function getIdleLevel() {
    const idle = (Date.now() - lastInteraction) / 1000;
    if (idle < 10) return null;
    if (idle < 20) return 'GENTLE';
    if (idle < 40) return 'MEDIUM';
    return 'STRONG';
  }

  function shouldFireIdleNudge() {
    const level = getIdleLevel();
    if (!level) return null;
    if (idleNudgeFired[level]) return null;
    idleNudgeFired[level] = true;
    return level;
  }

  // ── Persistence ──
  function save() {
    Storage.safeSetItem('gaia_engagement', JSON.stringify({
      score, moodSignals, lastInteraction, siteEngagement,
      participantModel, knowledgeModel,
      savedAt: Date.now(),
    }));
  }

  function load() {
    try {
      const raw = Storage.safeGetItem('gaia_engagement');
      if (!raw) return;
      const data = JSON.parse(raw);
      score = data.score || 0;
      moodSignals = data.moodSignals || moodSignals;
      if (data.siteEngagement) Object.assign(siteEngagement, data.siteEngagement);
      if (data.participantModel) Object.assign(participantModel, data.participantModel);
      if (data.knowledgeModel) Object.assign(knowledgeModel, data.knowledgeModel);
    } catch { /* ignore */ }
  }

  // ── Init ──
  load();
  // Load GaiaMind state if available
  if (typeof GaiaMind !== 'undefined') {
    try {
      const mindData = Storage.safeGetItem('gaia_mind');
      if (mindData) GaiaMind.deserialize(mindData);
    } catch { /* ignore */ }
    // Decay emotions based on time since last visit
    const lastVisit = GaiaMind.getTimeSinceLastVisit?.();
    if (lastVisit && lastVisit > 0) {
      const daysSince = lastVisit / (1000 * 60 * 60 * 24);
      if (daysSince > 0.1) GaiaMind.decayEmotions(daysSince);
    }
    // Record this session
    if (GaiaMind.recordSession) {
      GaiaMind.recordSession({
        sitesVisited: [],
        dominantEmotion: GaiaMind.getDominantEmotion?.()?.emotion || 'curious',
        keyInsight: null,
        gaiaEmotion: 'curious',
        leftOff: 'arrival',
        duration: 0,
        score: 0,
      });
    }
  }
  // Periodic auto-save (every 30s) + save on page unload
  setInterval(save, 30000);
  try { window.addEventListener('beforeunload', save); } catch { /* ignore */ }
  // Also save GaiaMind periodically
  setInterval(() => {
    if (typeof GaiaMind !== 'undefined') {
      try { Storage.safeSetItem('gaia_mind', GaiaMind.serialize()); } catch { /* ignore */ }
    }
  }, 30000);
  try { window.addEventListener('beforeunload', () => { if (typeof GaiaMind !== 'undefined') { try { Storage.safeSetItem('gaia_mind', GaiaMind.serialize()); } catch { /* ignore */ } } }); } catch { /* ignore */ }

  return {
    addSignal, addMoodSignal,
    getScore: () => score,
    getTier,
    getVelocity,
    getMood, getMoodIntensity,
    getIdleLevel, shouldFireIdleNudge,
    getSiteEngagement: () => siteEngagement,
    getSiteStates,
    getArchetype,
    getParticipantModel: () => ({ ...participantModel }),
    getKnowledgeModel: () => ({ ...knowledgeModel }),
    interact: () => { lastInteraction = Date.now(); },
    save, load,
  };
})();


/* ══ js/gaia-journal.js ══ */
/**
 * GAIA JOURNAL & QUESTS v1.0
 * Persistent insight collection + 16 quests across 4 tiers
 */

const GAIA_JOURNAL = (() => {
  // ── Quest definitions ──
  const QUESTS = [
    // Tier 1: Explorer (0-30)
    { id: 'visit_all_sites', title: 'See All Wounds', desc: 'Visit all 4 project sites', tier: 1, target: 4, signal: 'site_tap' },
    { id: 'first_scenario', title: 'First Decision', desc: 'Run your first restoration scenario', tier: 1, target: 1, signal: 'scenario_run' },
    { id: 'first_prediction', title: 'Trust Your Gut', desc: 'Make a prediction before seeing data', tier: 1, target: 1, signal: 'prediction' },
    { id: 'collect_3_insights', title: 'Curious Mind', desc: 'Collect 3 insights in your journal', tier: 1, target: 3, signal: 'insight' },

    // Tier 2: Investigator (30-60)
    { id: 'explore_all_layers', title: 'Dig Deeper', desc: 'Reveal all data layers at any site', tier: 2, target: 5, signal: 'data_reveal' },
    { id: 'run_3_scenarios', title: 'What If...', desc: 'Run 3 different restoration scenarios', tier: 2, target: 3, signal: 'scenario_run' },
    { id: 'correct_prediction', title: 'Sharp Eye', desc: 'Make a correct prediction', tier: 2, target: 1, signal: 'correct_prediction' },
    { id: 'big_scenario', title: 'Think Big', desc: 'Run a scenario that sequesters >1M tCO₂', tier: 2, target: 1, signal: 'big_scenario' },

    // Tier 3: Scientist (60-100)
    { id: 'visit_borneo', title: 'The Green Lie', desc: 'Discover Borneo\'s secret', tier: 3, target: 1, signal: 'site_tap', site: 'borneo' },
    { id: 'visit_benin', title: 'Homecoming', desc: 'Learn about Jean\'s legacy', tier: 3, target: 1, signal: 'site_tap', site: 'benin' },
    { id: 'negative_scenario', title: 'Feel the Weight', desc: 'Run a scenario that releases carbon', tier: 3, target: 1, signal: 'negative_scenario' },
    { id: 'collect_8_insights', title: 'Field Journal', desc: 'Collect 8 insights', tier: 3, target: 8, signal: 'insight' },

    // Tier 4: Guardian (100+)
    { id: 'complete_all_sites', title: 'Witness', desc: 'Fully explore all 4 sites', tier: 4, target: 4, signal: 'site_complete' },
    { id: 'run_10_scenarios', title: 'Restoration Master', desc: 'Run 10 scenarios', tier: 4, target: 10, signal: 'scenario_run' },
    { id: 'collect_12_insights', title: 'Deep Knowledge', desc: 'Collect 12 insights', tier: 4, target: 12, signal: 'insight' },
    { id: 'share_journal', title: 'Spread the Word', desc: 'Share your journal', tier: 4, target: 1, signal: 'share' },
  ];

  // ── State ──
  let entries = []; // { text, siteId, timestamp, questId }
  let questProgress = {}; // questId -> count
  let completedQuests = [];

  // ── Persistence ──
  function save() {
    Storage.safeSetItem('gaia_journal', JSON.stringify({
      entries, questProgress, completedQuests, savedAt: Date.now(),
    }));
  }

  function load() {
    try {
      const raw = Storage.safeGetItem('gaia_journal');
      if (!raw) return;
      const data = JSON.parse(raw);
      entries = data.entries || [];
      questProgress = data.questProgress || {};
      completedQuests = data.completedQuests || [];
    } catch { /* ignore */ }
  }

  // ── Journal ──
  function addEntry(text, siteId, questId) {
    entries.push({ text, siteId, timestamp: Date.now(), questId });
    save();

    // Trigger pledge prompt after collecting 3+ insights
    if (typeof PLEDGE_WALL !== 'undefined') {
      PLEDGE_WALL.onInsightsCollected(entries.length);
    }
  }

  function getEntries() { return entries; }
  function getEntryCount() { return entries.length; }

  // ── Quests ──
  function checkQuestProgress(signalName, siteId) {
    const newlyCompleted = [];
    for (const quest of QUESTS) {
      if (completedQuests.includes(quest.id)) continue;
      if (quest.signal !== signalName) continue;
      if (quest.site && quest.site !== siteId) continue;

      questProgress[quest.id] = (questProgress[quest.id] || 0) + 1;

      if (questProgress[quest.id] >= quest.target) {
        completedQuests.push(quest.id);
        newlyCompleted.push(quest);
      }
    }
    if (newlyCompleted.length > 0) save();
    return newlyCompleted;
  }

  function getQuests() {
    return QUESTS.map(q => ({
      ...q,
      progress: questProgress[q.id] || 0,
      completed: completedQuests.includes(q.id),
    }));
  }

  function getCompletedCount() { return completedQuests.length; }
  function getTotalCount() { return QUESTS.length; }

  // ── Share card ──
  function generateShareCard() {
    const tier = completedQuests.length < 4 ? 'Explorer' : completedQuests.length < 8 ? 'Investigator' : completedQuests.length < 12 ? 'Scientist' : 'Guardian';
    return {
      tier,
      insights: entries.length,
      quests: `${completedQuests.length}/${QUESTS.length}`,
      sites: [...new Set(entries.map(e => e.siteId))].length,
    };
  }

  // ── Quest progress UI renderer ──
  function renderQuestProgress(container) {
    const quests = getQuests();
    if (!container) return;
    container.innerHTML = `
      <div class="quest-progress-list">
        ${quests.map(q => `
          <div class="quest-item ${q.completed ? 'completed' : ''}">
            <div class="quest-icon">${q.completed ? '✓' : '○'}</div>
            <div class="quest-info">
              <div class="quest-name">${q.title}</div>
              <div class="quest-desc">${q.desc}</div>
              <div class="quest-progress-bar">
                <div class="quest-progress-fill" style="width:${Math.min((q.progress / q.target) * 100, 100)}%"></div>
              </div>
            </div>
            <div class="quest-count">${q.progress}/${q.target}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ── Init ──
  load();

  return {
    addEntry, getEntries, getEntryCount,
    checkQuestProgress, getQuests, getCompletedCount, getTotalCount,
    generateShareCard, renderQuestProgress,
    save, load,
  };
})();


/* ══ js/gaia-bubble.js ══ */
/**
 * GAIA BUBBLE v2.0
 * A small, always-visible bubble that GAIA lives in
 * Bottom-right corner, teal/mint/green natural vibes
 * 
 * States:
 * - Idle: small pulsing dot with GAIA emoji
 * - Thinking: typing indicator
 * - Speaking: expanded bubble with text
 * - Hover: shows recent insight or prompt
 */

const GAIA_BUBBLE = (() => {
  let bubbleEl = null;
  let avatarEl = null;
  let textEl = null;
  let currentText = '';
  let hideTimer = null;
  let isExpanded = false;
  let currentSite = null;

  // ── Color palette — natural teal/mint/green ──
  window.COLORS = {
    bg: 'rgba(8, 18, 20, 0.92)',
    border: 'rgba(78, 205, 196, 0.25)',
    glow: 'rgba(78, 205, 196, 0.15)',
    text: '#d0e8e0',
    textDim: '#7a9a90',
    accent: '#4ecdc4',
    mint: '#7be8d0',
    leaf: '#5bbf72',
  };

  // ── Create the bubble ──
  function create() {
    if (bubbleEl) return;

    bubbleEl = document.createElement('div');
    bubbleEl.id = 'gaia-bubble';
    bubbleEl.innerHTML = `
      <div class="gaia-bubble-avatar">🌍</div>
      <div class="gaia-site-indicator"></div>
      <div class="gaia-bubble-text"></div>
      <div class="gaia-bubble-thinking">
        <span></span><span></span><span></span>
      </div>
    `;

    document.body.appendChild(bubbleEl);

    avatarEl = bubbleEl.querySelector('.gaia-bubble-avatar');
    textEl = bubbleEl.querySelector('.gaia-bubble-text');

    // Click to expand/collapse
    bubbleEl.addEventListener('click', (e) => {
      if (e.target.closest('.gaia-bubble-dismiss')) return;
      toggleExpand();
    });

    // Start idle pulse
    startIdlePulse();
  }

  // ── Idle pulse animation ──
  function startIdlePulse() {
    if (!bubbleEl) return;
    bubbleEl.classList.add('idle');
  }

  function stopIdlePulse() {
    if (!bubbleEl) return;
    bubbleEl.classList.remove('idle');
  }

  // ── Show thinking state ──
  function showThinking() {
    if (!bubbleEl) create();
    stopIdlePulse();
    bubbleEl.classList.add('thinking');
    bubbleEl.classList.remove('speaking', 'expanded');
    isExpanded = false;
    currentText = '';
  }

  // ── Speak — show text with typing effect ──
  function speak(text, tone, duration = 8000) {
    if (!bubbleEl) create();

    // Clear previous
    if (hideTimer) clearTimeout(hideTimer);
    stopIdlePulse();

    // Set color based on tone
    const toneColors = {
      warm: COLORS.mint,
      proud: COLORS.leaf,
      urgent: '#c4a04a',
      mysterious: '#8b9fc7',
      concerned: '#d4a574',
      playful: COLORS.accent,
      fierce: '#c45c4a',
      nurturing: COLORS.leaf,
      neutral: COLORS.accent,
    };
    const color = toneColors[tone] || COLORS.accent;

    // Apply tone color
    bubbleEl.style.borderColor = color + '40';
    avatarEl.style.boxShadow = `0 0 16px ${color}30`;

    // Get voice modifiers from GaiaMind if available
    let voiceModifiers = {};
    if (typeof GaiaMind !== 'undefined') {
      voiceModifiers = GaiaMind.getVoiceModifiers?.({ tone }) || {};
    } else {
      // Fallback: basic modifiers per tone
      const fallback = {
        mysterious: { rate: -0.12, pitch: -0.05, volume: -0.1 },
        warm: { rate: -0.08, pitch: 0.03, volume: -0.05 },
        fierce: { rate: 0.10, pitch: -0.08, volume: 0.15 },
        urgent: { rate: 0.08, pitch: -0.05, volume: 0.1 },
        concerned: { rate: -0.08, pitch: -0.03, volume: 0 },
        proud: { rate: 0.05, pitch: 0, volume: 0.1 },
        playful: { rate: 0.03, pitch: 0.05, volume: 0 },
        nurturing: { rate: -0.08, pitch: 0.03, volume: -0.05 },
      };
      voiceModifiers = fallback[tone] || {};
    }

    // Start typing
    currentText = text;
    textEl.textContent = '';
    bubbleEl.classList.add('speaking');
    bubbleEl.classList.remove('thinking');

    // Typing effect — speed adjusted by voice modifier
    let i = 0;
    const baseSpeed = Math.min(25, Math.max(12, 150 / text.length));
    const speedMultiplier = 1 + (voiceModifiers.rate || 0);
    const speed = Math.max(8, Math.min(40, baseSpeed * speedMultiplier));
    function type() {
      if (currentText !== text) return;
      if (i < text.length) {
        textEl.textContent += text[i];
        i++;
        setTimeout(type, speed);
      }
    }
    type();

    // Auto-collapse after duration
    hideTimer = setTimeout(() => {
      collapse();
    }, duration);
  }

  // ── Expand bubble ──
  function expand() {
    if (!bubbleEl) return;
    bubbleEl.classList.add('expanded');
    isExpanded = true;
  }

  // ── Collapse bubble ──
  function collapse() {
    if (!bubbleEl) return;
    bubbleEl.classList.remove('expanded', 'speaking', 'thinking');
    isExpanded = false;
    currentText = '';
    textEl.textContent = '';

    // Reset colors
    bubbleEl.style.borderColor = COLORS.border;
    avatarEl.style.boxShadow = `0 0 12px ${COLORS.glow}`;

    // Return to idle
    startIdlePulse();
  }

  // ── Toggle expand/collapse ──
  function toggleExpand() {
    if (isExpanded) {
      collapse();
    } else {
      expand();
    }
  }

  // ── React to engagement events ──
  function onSignal(signalName, siteId) {
    GAIA_ENGAGEMENT.addSignal(signalName);

    // Check for quest completions
    const completed = GAIA_JOURNAL.checkQuestProgress(signalName, siteId);
    for (const quest of completed) {
      showQuestNotification(quest);
    }

    // Check for pledge prompt
    if (typeof PLEDGE_WALL !== 'undefined') {
      const score = GAIA_ENGAGEMENT.getScore();
      if (score >= 30 && !PLEDGE_WALL.hasPledged()) {
        // Don't show immediately — let the moment breathe
        setTimeout(() => {
          if (typeof PLEDGE_WALL !== 'undefined') {
            PLEDGE_WALL.showSmallPrompt(
              "You've been exploring. You've seen the data. What will you do with this?",
              'warm'
            );
          }
        }, 2000);
      }
    }
  }

  // ── Quest notification ──
  function showQuestNotification(quest) {
    const notif = document.createElement('div');
    notif.className = 'gaia-quest-popup';
    notif.innerHTML = `<span class="qp-icon">✓</span><span class="qp-text">${quest.title}</span>`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }

  // ── Idle nudge ──
  function idleNudge() {
    const level = GAIA_ENGAGEMENT.getIdleLevel();
    if (!level) return;

    const nudges = {
      GENTLE: [
        "The planet isn't going to restore itself.",
        "Somewhere on this globe, a forest is burning. Just saying.",
        "You're quiet. That's okay. But I have more to show you.",
      ],
      MEDIUM: [
        "Four sites. Each one a different story. You've only seen some of them.",
        "The carbon clock doesn't pause because you're idle.",
        "I've been alive for four and a half billion years. I can wait. But you probably shouldn't.",
      ],
      STRONG: [
        "You came all this way and you're just... staring?",
        "Fine. I'll wait. I'm good at waiting. I waited 300 million years for the coal to form.",
        "The climate crisis doesn't care if you're ready. It's happening. Now.",
      ],
    };

    const pool = nudges[level] || nudges.GENTLE;
    const msg = pool[Math.floor(Math.random() * pool.length)];
    speak(msg, level === 'STRONG' ? 'fierce' : 'mysterious', 6000);
  }

  // ── Get state ──
  function isVisible() {
    return bubbleEl !== null;
  }

  function getBubble() {
    return bubbleEl;
  }

  function setCurrentSite(siteId) {
    currentSite = siteId;
    const indicator = bubbleEl?.querySelector('.gaia-site-indicator');
    if (indicator) {
      const siteNames = { sri_lanka: 'Sri Lanka', antalya: 'Antalya', benin: 'Benin', borneo: 'Borneo' };
      indicator.textContent = siteNames[siteId] || '';
      if (siteId) {
        indicator.classList.add('active');
      } else {
        indicator.classList.remove('active');
      }
    }
  }

  function getCurrentSite() {
    return currentSite;
  }

  // ── Open full GAIA chat with context ──
  function openFullGAIA() {
    if (currentSite) {
      try {
        sessionStorage.setItem('gaia_context', JSON.stringify({
          siteId: currentSite,
          timestamp: Date.now(),
        }));
      } catch { /* ignore */ }
    }
    window.open('gaia.html', '_blank');
  }

  // ── Welcome back with emotional memory ──
  function welcomeBack() {
    if (typeof GaiaMind === 'undefined') return null;
    const sessionCount = GaiaMind.getSessionCount?.() || 1;
    const timeSince = GaiaMind.getTimeSinceLastVisit?.();
    const dominant = GaiaMind.getDominantEmotion?.();
    const texture = GaiaMind.getEmotionalTexture?.();
    const unresolved = GaiaMind.getUnresolvedThread?.();
    return { sessionCount, timeSince, dominant, texture, unresolved };
  }

  return {
    create, speak, showThinking, expand, collapse, toggleExpand,
    onSignal, idleNudge, welcomeBack,
    setCurrentSite, getCurrentSite, openFullGAIA,
    isVisible, getBubble,
    colors: COLORS,
  };

// IIFE executes and assigns to GAIA_BUBBLE
})();


/* ══ js/site-panel.js ══ */
/**
 * SITE PANEL v1.0
 * Layered reveal system for site investigation
 * Story → Data → Mystery (prediction) → Reveal → Insight → Journal
 */

const SITE_PANEL = (() => {
  let currentSite = null;
  let currentLayer = 0;
  let panelEl = null;
  let overlayEl = null;
  let _lastVerification = null;
  let _lastTab = 'sat';
  let _lastRegCheck = null;
  let _gaiaCollapsed = false;

  // ── Layer definitions ──
  const LAYERS = ['story', 'data', 'mystery', 'reveal', 'insight'];

  // ── GAIA Context: per-site, per-layer guidance + suggestions ──
  window.GAIA_CONTEXT = {
    sri_lanka: {
      story: {
        guidance: "This land was scarred by decades of conflict. The Northern Province saw displacement, loss, and ecological collapse. But someone saw potential here — not just to plant trees, but to rebuild an entire ecosystem.",
        suggestions: [
          { label: "Read the full story", action: "SITE_PANEL.scrollToLayer('story')" },
          { label: "Why Sri Lanka?", action: "SITE_PANEL.speakGAIA('ENTRY_SRI_02')" },
        ],
      },
      data: {
        guidance: "Look at the NDVI sparkline. That flat line on the left? Decades of bare soil. Now look at the right edge — that's the restoration kicking in. From 10 tC/ha to 180. That's not just recovery. That's resurrection.",
        suggestions: [
          { label: "Show me the data", action: "SITE_PANEL.scrollToLayer('data')" },
          { label: "Verify with satellite", action: "SITE_PANEL.verifyCurrentSite()" },
        ],
      },
      mystery: {
        guidance: "Before you see the answer — what do you think? This land was almost bare. Ten tons of carbon per hectare. What could it become?",
        suggestions: [
          { label: "I have a theory", action: "SITE_PANEL.scrollToLayer('mystery')" },
        ],
      },
      reveal: {
        guidance: "From 10 to 180 tC/ha. An 18x increase. This is what restoration looks like when you do it right — not just trees, but a multilayer forest that pays for itself.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.scrollToLayer('insight')" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
      insight: {
        guidance: "Degraded land isn't dead. It's waiting. From 10 tC/ha to 180 — that's not just restoration. That's resurrection.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.addInsightFromGAIA()" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
    },
    antalya: {
      story: {
        guidance: "Antalya. Mediterranean coast. Ancient pines, centuries old. Then July 2021 — the fire came. Sixty thousand hectares gone in days. I felt every hectare.",
        suggestions: [
          { label: "Read the full story", action: "SITE_PANEL.scrollToLayer('story')" },
          { label: "What caused it?", action: "SITE_PANEL.speakGAIA('ENTRY_ANT_01')" },
        ],
      },
      data: {
        guidance: "The NDVI dropped from 0.72 to 0.18. That's not a number. That's a scream. Four years later, it's at 0.38 — scrub recovery. The pines need decades. Maybe a century.",
        suggestions: [
          { label: "Show me the data", action: "SITE_PANEL.scrollToLayer('data')" },
          { label: "Verify with satellite", action: "SITE_PANEL.verifyCurrentSite()" },
        ],
      },
      mystery: {
        guidance: "The NDVI crashed from 0.72 to 0.18 in 2021. What could cause that kind of collapse in a Mediterranean forest?",
        suggestions: [
          { label: "I have a theory", action: "SITE_PANEL.scrollToLayer('mystery')" },
        ],
      },
      reveal: {
        guidance: "Wildfire. Sixty thousand hectares burned in days. The recovery to 0.38 took four years. Full forest recovery? Decades. Maybe a century. This is what climate change looks like on the ground.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.scrollToLayer('insight')" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
      insight: {
        guidance: "A single fire dropped NDVI from 0.72 to 0.18. Recovery to 0.38 took four years. Full forest recovery? Decades. Maybe a century.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.addInsightFromGAIA()" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
    },
    benin: {
      story: {
        guidance: "Ouidah, Benin. A man named Jean Missinhoun was from here. He carried this place in his heart. He wanted to bring the mangroves back — even after he was gone.",
        suggestions: [
          { label: "Read the full story", action: "SITE_PANEL.scrollToLayer('story')" },
          { label: "Who was Jean?", action: "SITE_PANEL.speakGAIA('ENTRY_BEN_01')" },
        ],
      },
      data: {
        guidance: "Mangroves store 950 tC/ha — the most carbon-dense ecosystem on Earth. The NDVI here dropped from 0.68 to 0.45. The mangroves were being torn out. For firewood. For development. For short-term thinking.",
        suggestions: [
          { label: "Show me the data", action: "SITE_PANEL.scrollToLayer('data')" },
          { label: "Verify with satellite", action: "SITE_PANEL.verifyCurrentSite()" },
        ],
      },
      mystery: {
        guidance: "Mangroves store 950 tC/ha when intact. The NDVI dropped from 0.68 to 0.45. What happened to all that carbon?",
        suggestions: [
          { label: "I have a theory", action: "SITE_PANEL.scrollToLayer('mystery')" },
        ],
      },
      reveal: {
        guidance: "When mangroves are destroyed, the carbon stored in their biomass and waterlogged soil is released. Every hectare lost is 950 tons of carbon going into the atmosphere. That's why restoring them is so urgent.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.scrollToLayer('insight')" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
      insight: {
        guidance: "Mangroves don't just store carbon — they lock it away for millennia. Destroy them, and centuries of storage go up in smoke.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.addInsightFromGAIA()" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
    },
    borneo: {
      story: {
        guidance: "West Kalimantan. Peat swamp forest. Fourteen hundred tons of carbon per hectare — stored over thousands of years. Then the grids came. Perfect squares. Nature doesn't make grids. Humans do.",
        suggestions: [
          { label: "Read the full story", action: "SITE_PANEL.scrollToLayer('story')" },
          { label: "What's the lie?", action: "SITE_PANEL.speakGAIA('ENTRY_BOR_03')" },
        ],
      },
      data: {
        guidance: "The NDVI is 0.65. Pretty green, right? But the carbon density is only 50 tC/ha. The original peat swamp stored 1,400. That's a 96% carbon loss disguised as green. This is the greenest lie on Earth.",
        suggestions: [
          { label: "Show me the data", action: "SITE_PANEL.scrollToLayer('data')" },
          { label: "Verify with satellite", action: "SITE_PANEL.verifyCurrentSite()" },
        ],
      },
      mystery: {
        guidance: "The NDVI here is 0.65 — pretty green. What do you think the carbon density is? This is a tropical region. It should be massive, right?",
        suggestions: [
          { label: "I have a theory", action: "SITE_PANEL.scrollToLayer('mystery')" },
        ],
      },
      reveal: {
        guidance: "Just 50 tC/ha. This is an oil palm plantation. The original peat swamp stored 1,400 tC/ha. The NDVI looks green and healthy, but 96% of the carbon is gone. Green does not mean healthy.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.scrollToLayer('insight')" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
      insight: {
        guidance: "Green ≠ carbon. Oil palm (NDVI 0.65) stores 50 tC/ha. The peat swamp it replaced stored 1,400. That's a 96% carbon loss disguised as green.",
        suggestions: [
          { label: "Add to journal", action: "SITE_PANEL.addInsightFromGAIA()" },
          { label: "Explore another site", action: "SITE_PANEL.close()" },
        ],
      },
    },
  };

  // ── Get GAIA context for current state ──
  function getGAIAContext(site, layer) {
    const siteContext = GAIA_CONTEXT[site.id];
    if (!siteContext) {
      return {
        guidance: `Exploring ${site.name}. ${site.narrative.substring(0, 120)}...`,
        suggestions: [
          { label: "What happened here?", action: "SITE_PANEL.nextLayer()" },
        ],
      };
    }
    const layerContext = siteContext[layer] || siteContext.story;
    return layerContext;
  }

  // ── Render GAIA section ──
  function renderGAIAsection(site, layer) {
    const ctx = getGAIAContext(site, layer);
    return `
      <div class="site-panel-gaia" id="site-panel-gaia">
        <div class="gaia-section-header" onclick="SITE_PANEL.toggleGAIA()">
          <span class="gaia-section-icon">🌍</span>
          <span class="gaia-section-title">GAIA</span>
          <span class="gaia-section-toggle" id="gaia-toggle-icon">${_gaiaCollapsed ? '▶' : '▼'}</span>
        </div>
        <div class="gaia-section-body${_gaiaCollapsed ? ' collapsed' : ''}" id="gaia-section-body">
          <div class="gaia-guidance">${ctx.guidance}</div>
          <div class="gaia-suggestions">
            ${ctx.suggestions.map(s => `
              <button class="gaia-suggestion-chip" onclick="${s.action}">${s.label}</button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  // ── Toggle GAIA section collapse ──
  function toggleGAIA() {
    _gaiaCollapsed = !_gaiaCollapsed;
    const body = document.getElementById('gaia-section-body');
    const icon = document.getElementById('gaia-toggle-icon');
    if (body) body.classList.toggle('collapsed', _gaiaCollapsed);
    if (icon) icon.textContent = _gaiaCollapsed ? '▶' : '▼';
  }

  // ── Speak a specific GAIA line ──
  function speakGAIA(lineId) {
    if (typeof GAIA_VOICE === 'undefined') return;
    const line = GAIA_VOICE.getLine(lineId);
    if (line && typeof GAIA_BUBBLE !== 'undefined') {
      GAIA_BUBBLE.show(line.text, line.tone, 8000);
    }
  }

  // ── Add insight from GAIA section ──
  function addInsightFromGAIA() {
    if (!currentSite) return;
    const layer = LAYERS[currentLayer];
    const ctx = getGAIAContext(currentSite, layer);
    // Find the insight text from the current layer
    const pred = PREDICTIONS[currentSite.id];
    if (pred) {
      addInsight(pred.insight, currentSite.id);
    }
  }

  // ── Scroll to a specific layer ──
  function scrollToLayer(layer) {
    const idx = LAYERS.indexOf(layer);
    if (idx >= 0 && idx >= currentLayer) {
      // Advance to that layer
      while (currentLayer < idx) {
        nextLayer();
      }
      // Scroll the panel to show the layer
      if (panelEl) {
        const layers = panelEl.querySelectorAll('.reveal-layer');
        if (layers[idx]) {
          layers[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  }

  // ── Prediction questions per site ──
  window.PREDICTIONS = {
    sri_lanka: {
      question: "This land was degraded for decades. What do you think its carbon density is right now?",
      options: [
        { id: 'a', text: "~150 tC/ha — some recovery has happened", correct: false },
        { id: 'b', text: "~10 tC/ha — barely alive, almost nothing stored", correct: true },
        { id: 'c', text: "~350 tC/ha — it's a tropical forest, must be high", correct: false },
      ],
      explanation: "Just 10 tC/ha. This land is almost bare. Decades of conflict stripped it. But that's what makes the restoration so powerful — going from 10 to 180 tC/ha is an 18x increase.",
      insight: "Degraded land isn't dead. It's waiting. From 10 tC/ha to 180 — that's not restoration, that's resurrection.",
    },
    antalya: {
      question: "The NDVI dropped from 0.72 to 0.18 in 2021. What caused it?",
      options: [
        { id: 'a', text: "Drought — the Mediterranean is getting drier", correct: false },
        { id: 'b', text: "Wildfire — 60,000+ hectares burned in days", correct: true },
        { id: 'c', text: "Deforestation — logging cleared the pines", correct: false },
      ],
      explanation: "Wildfire. July 2021. Sixty thousand hectares gone in days. The NDVI crash from 0.72 to 0.18 is a burn scar. Four years later, it's at 0.38 — scrub recovery. The pines need decades.",
      insight: "A single fire dropped NDVI from 0.72 to 0.18. Recovery to 0.38 took four years. Full forest recovery? Decades. Maybe a century.",
    },
    benin: {
      question: "Mangroves store 950 tC/ha when intact. The NDVI here dropped from 0.68 to 0.45. What happened to the carbon?",
      options: [
        { id: 'a', text: "It's still there — the soil holds it even when trees are cut", correct: false },
        { id: 'b', text: "It was released — when mangroves are destroyed, the carbon goes into the atmosphere", correct: true },
        { id: 'c', text: "It moved — the carbon transferred to the ocean", correct: false },
      ],
      explanation: "When mangroves are destroyed, the carbon stored in their biomass and waterlogged soil is released. That's why restoring them is so urgent — every hectare lost is 950 tons of carbon going into the atmosphere.",
      insight: "Mangroves don't just store carbon — they lock it away for millennia. Destroy them, and centuries of storage go up in smoke.",
    },
    borneo: {
      question: "The NDVI here is 0.65 — pretty green. What do you think the carbon density is?",
      options: [
        { id: 'a', text: "~1,400 tC/ha — it's a tropical peat swamp, must be massive", correct: false },
        { id: 'b', text: "~50 tC/ha — it's an oil palm plantation", correct: true },
        { id: 'c', text: "~350 tC/ha — it's green, so it must be a healthy forest", correct: false },
      ],
      explanation: "Just 50 tC/ha. This is an oil palm plantation. The original peat swamp stored 1,400 tC/ha. The NDVI looks green and healthy, but 96% of the carbon is gone. This is the greenest lie on Earth.",
      insight: "Green ≠ carbon. Oil palm (NDVI 0.65) stores 50 tC/ha. The peat swamp it replaced stored 1,400. That's a 96% carbon loss disguised as green.",
    },
  };

  // ── Create panel DOM ──
  function createElements() {
    if (panelEl) return;

    overlayEl = document.createElement('div');
    overlayEl.className = 'site-panel-overlay';
    overlayEl.addEventListener('click', close);
    document.body.appendChild(overlayEl);

    panelEl = document.createElement('div');
    panelEl.id = 'site-panel';
    panelEl.className = 'site-panel';
    document.body.appendChild(panelEl);
  }

  // ── Open panel for a site ──
  function open(site) {
    createElements();
    currentSite = site;
    currentLayer = 0;

    // Speak entry line
    GAIA_BUBBLE.speak('SITE_ENTRY', site.id);
    GAIA_ENGAGEMENT.addSignal('site_tap');
    GAIA_ENGAGEMENT.addMoodSignal('curiosity');
    if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('site_entered', { siteId: site.id });

    // Build panel content
    renderLayer('story');

    // Show panel
    overlayEl.classList.add('visible');
    panelEl.classList.add('open');

    // Track visit
    try {
      const visited = JSON.parse(localStorage.getItem('gaia_visited_sites') || '[]');
      if (!visited.includes(site.id)) visited.push(site.id);
      localStorage.setItem('gaia_visited_sites', JSON.stringify(visited));
    } catch { /* ignore */ }
  }

  // ── Render a specific layer ──
  function renderLayer(layer) {
    if (!panelEl || !currentSite) return;
    const site = currentSite;
    const biome = Data.getBiome(site.primaryBiome);
    let html = '';

    // Close button
    html += `<button class="site-panel-close" onclick="SITE_PANEL.close()">✕</button>`;

    // Always show site header
    html += `<div class="reveal-layer visible" style="transition-delay:0ms">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:3px;color:var(--teal);margin-bottom:8px">${site.name}</div>
      <h2 style="font-family:var(--display);font-size:24px;font-weight:300;color:var(--mint);margin-bottom:4px">${site.subtitle}</h2>
      <div style="font-size:11px;color:var(--text3);margin-bottom:16px">${site.area.toLocaleString()} ha · Target: ${biome.name}</div>
    </div>`;

    // GAIA section — context-aware guidance
    html += renderGAIAsection(site, layer);

    // Story layer
    if (LAYERS.indexOf(layer) >= 0) {
      html += `<div class="reveal-layer visible" style="transition-delay:100ms">
        <p style="font-size:13px;line-height:1.7;color:var(--text2)">${site.narrative}</p>
        <div style="margin-top:12px;padding:12px;background:rgba(78,205,196,0.04);border-left:2px solid rgba(78,205,196,0.15);border-radius:0 6px 6px 0;">
          <div style="font-size:11px;color:var(--text3);margin-bottom:4px">ELU Connection</div>
          <p style="font-size:12px;line-height:1.6;color:var(--text2)">${site.connection}</p>
        </div>
      </div>`;
    }

    // Data layer
    if (LAYERS.indexOf(layer) >= 1) {
      html += `<div class="reveal-layer visible" style="transition-delay:200ms">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--text3);margin-bottom:10px">Vegetation Health Over Time</div>
        <div style="margin-bottom:12px">
          ${renderNDVISparkline(site)}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
          ${renderClimateMini(site)}
        </div>
        <div style="margin-top:12px;text-align:center;">
          <button onclick="SITE_PANEL.nextLayer()" style="padding:8px 20px;border:1px solid rgba(78,205,196,0.2);border-radius:6px;background:rgba(78,205,196,0.06);color:var(--teal);font-size:11px;cursor:pointer;transition:all .2s">
            What do you think happened here? →
          </button>
        </div>
      </div>`;
    }

    // Mystery layer (prediction prompt)
    if (LAYERS.indexOf(layer) >= 2) {
      const pred = PREDICTIONS[site.id];
      if (pred) {
        html += `<div class="reveal-layer visible" style="transition-delay:300ms">
          <div class="prediction-prompt">
            <div class="pp-question">${pred.question}</div>
            <div class="pp-options">
              ${pred.options.map(o => `<div class="pp-option" onclick="SITE_PANEL.selectPrediction('${o.id}', ${o.correct}, this)">${o.text}</div>`).join('')}
            </div>
            <div class="pp-feedback"></div>
          </div>
        </div>`;
      }
    }

    // Reveal layer
    if (LAYERS.indexOf(layer) >= 3) {
      const pred = PREDICTIONS[site.id];
      if (pred) {
        html += `<div class="reveal-layer visible" style="transition-delay:400ms">
          <div style="font-size:12px;line-height:1.7;color:var(--text2);margin-bottom:12px">${pred.explanation}</div>
        </div>`;
      }
    }

    // Insight layer
    if (LAYERS.indexOf(layer) >= 4) {
      const pred = PREDICTIONS[site.id];
      if (pred) {
        html += `<div class="reveal-layer visible" style="transition-delay:500ms">
          <div class="insight-card">
            <div class="insight-text">"${pred.insight}"</div>
            <button class="insight-journal-btn" onclick="SITE_PANEL.addInsight('${pred.insight.replace(/'/g, "\\'")}', '${site.id}')">
              + Add to Journal
            </button>
          </div>
          <div style="margin-top:16px;text-align:center;">
            <button onclick="SITE_PANEL.close()" style="padding:8px 20px;border:1px solid rgba(255,255,255,0.08);border-radius:6px;background:none;color:var(--text2);font-size:11px;cursor:pointer;">
              Explore another site →
            </button>
          </div>
</div>`;
      }
    }

    // Verification section (Impact Verification Engine)
    if (typeof NDVIVerifier !== 'undefined' || typeof RegistryCheck !== 'undefined') {
      html += `<div class="site-verify-section">
        <h4>🛰 Impact Verification</h4>
        <div class="verify-tabs">
          <button class="verify-tab ${(_lastTab ?? 'sat') === 'sat' ? 'active' : ''}" onclick="SITE_PANEL.switchVerifyTab(this,'sat')">Satellite NDVI</button>
          <button class="verify-tab ${(_lastTab ?? 'sat') === 'reg' ? 'active' : ''}" onclick="SITE_PANEL.switchVerifyTab(this,'reg')">Registry Check</button>
        </div>
        <button class="verify-refresh" onclick="SITE_PANEL.verifyCurrentSite()">↻ Refresh Verification</button>
        <div id="site-verify-content">${_lastVerification ? (_lastTab === 'reg' ? RegistryCheck.renderRegistryCard(_lastRegCheck) : NDVIVerifier.renderVerificationCard(site.id, _lastVerification)) : '<p style="font-size:10px;color:var(--text3)">Click refresh to fetch satellite &amp; registry data...</p>'}</div>
      </div>`;
    }

    panelEl.innerHTML = html;

    // Trigger live verification
    if (typeof NDVIVerifier !== 'undefined') {
      NDVIVerifier.verifySite(site.id).then(result => {
        _lastVerification = result.comparison || result;
        const content = document.getElementById('site-verify-content');
        if (content) content.innerHTML = NDVIVerifier.renderVerificationCard(site.id, _lastVerification);
      });
    }

    // Trigger quest check on data reveal
    if (typeof GAIA_JOURNAL !== 'undefined') {
      GAIA_JOURNAL.checkQuestProgress('data_reveal', site.id);
    }

    // Animate layers in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panelEl.querySelectorAll('.reveal-layer').forEach(el => el.classList.add('visible'));
      });
    });
  }

  // ── Render NDVI sparkline ──
  function renderNDVISparkline(site) {
    const points = site.ndvi;
    if (!points || points.length === 0) return '';
    const chartData = points.map(p => ({ label: p.year.toString(), value: p.value }));
    const id = 'ndvi-spark-' + site.id;
    setTimeout(() => {
      const canvas = document.getElementById(id);
      if (canvas) GAIA_CHARTS._drawSparkline(canvas, chartData, { color: '#4ecdc4', showLabels: true, padMin: 0.05, padMax: 0.05 });
    }, 100);
    return `<canvas id="${id}" width="400" height="80" style="width:100%;height:80px;display:block;"></canvas>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:9px;color:var(--text3)">
        <span>${points[0].year}: ${points[0].label}</span>
        <span>${points[points.length-1].year}: ${points[points.length-1].label}</span>
      </div>`;
  }

  // ── Render climate mini cards ──
  function renderClimateMini(site) {
    const climate = site.climate;
    if (!climate || climate.length < 2) return '';
    const first = climate[0], last = climate[climate.length - 1];
    const tempDelta = (last.temp - first.temp).toFixed(1);
    const precipDelta = ((last.precip - first.precip) / first.precip * 100).toFixed(0);
    return `
      <div style="padding:10px;background:rgba(255,255,255,0.02);border-radius:6px;">
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Temperature</div>
        <div style="font-family:var(--mono);font-size:16px;color:var(--warn)">${last.temp.toFixed(1)}°C</div>
        <div style="font-size:9px;color:var(--warn);margin-top:2px">+${tempDelta}°C since ${first.year}</div>
      </div>
      <div style="padding:10px;background:rgba(255,255,255,0.02);border-radius:6px;">
        <div style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Precipitation</div>
        <div style="font-family:var(--mono);font-size:16px;color:var(--teal)">${last.precip} mm</div>
        <div style="font-size:9px;color:var(--warn);margin-top:2px">${precipDelta}% since ${first.year}</div>
      </div>
    `;
  }

  // ── Next layer ──
  function nextLayer() {
    currentLayer++;
    if (currentLayer < LAYERS.length) {
      renderLayer(LAYERS[currentLayer]);
      if (LAYERS[currentLayer] === 'data') {
        GAIA_ENGAGEMENT.addSignal('data_reveal');
        if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('data_revealed', { siteId: currentSite?.id, layer: 'data' });
      }
      if (LAYERS[currentLayer] === 'mystery') GAIA_ENGAGEMENT.addMoodSignal('mystery');
    }
  }

  // ── Prediction selection ──
  function selectPrediction(optionId, isCorrect, el) {
    const pred = PREDICTIONS[currentSite.id];
    if (!pred) return;

    // Disable all options
    el.closest('.pp-options').querySelectorAll('.pp-option').forEach(o => {
      o.style.pointerEvents = 'none';
      o.style.opacity = '0.5';
    });
    el.style.opacity = '1';
    el.style.borderColor = isCorrect ? 'var(--leaf)' : 'var(--warn)';

    // Show feedback
    const feedback = el.closest('.prediction-prompt').querySelector('.pp-feedback');
    feedback.classList.add('show');
    feedback.classList.add(isCorrect ? 'correct' : 'wrong');
    feedback.innerHTML = (isCorrect ? '✅ ' : '❌ ') + pred.explanation;

    // Signals
    GAIA_ENGAGEMENT.addSignal('prediction');
    if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('prediction_made', { siteId: currentSite?.id, isCorrect });
    if (isCorrect) {
      GAIA_ENGAGEMENT.addSignal('correct_prediction');
      GAIA_ENGAGEMENT.addMoodSignal('pride');
      GAIA_BUBBLE.speak('RESULT', currentSite.id, 'proud');
    } else {
      GAIA_ENGAGEMENT.addMoodSignal('concern');
      GAIA_BUBBLE.speak('RESULT', currentSite.id, 'nurturing');
    }

    // Auto-advance to reveal after 2s
    setTimeout(() => nextLayer(), 2500);
  }

  // ── Add insight to journal ──
  function addInsight(text, siteId) {
    GAIA_JOURNAL.addEntry(text, siteId);
    GAIA_ENGAGEMENT.addSignal('insight');
    GAIA_ENGAGEMENT.addMoodSignal('pride');
    if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('narrative_read', { siteId });

    // Update button
    const btn = panelEl.querySelector('.insight-journal-btn');
    if (btn) {
      btn.textContent = '✓ In your journal';
      btn.classList.add('added');
      btn.style.pointerEvents = 'none';
    }

    // Speak
    const line = GAIA_VOICE.speak('INSIGHT', siteId);
    if (line) GAIA_BUBBLE.show(line.text, line.tone, 5000);

    // Check quests
    const completed = GAIA_JOURNAL.checkQuestProgress('insight', siteId);
    for (const q of completed) {
      showQuestNotification(q);
    }

    // Trigger pledge prompt after completing a site investigation
    if (typeof PLEDGE_WALL !== 'undefined') {
      PLEDGE_WALL.onSiteComplete(siteId);
    }
  }

  // ── Quest notification ──
  function showQuestNotification(quest) {
    const notif = document.createElement('div');
    notif.className = 'quest-notification';
    notif.innerHTML = `<div class="qn-title">✓ Quest Complete</div><div class="qn-text">${quest.title}</div>`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
  }

  // ── Refresh verification for current site ──
  function verifyCurrentSite() {
    if (!currentSite || typeof NDVIVerifier === 'undefined') return;
    const btn = panelEl?.querySelector('.verify-refresh');
    if (btn) { btn.textContent = '↻ Loading...'; btn.disabled = true; }
    NDVIVerifier.verifySite(currentSite.id).then(result => {
      _lastVerification = result.comparison || result;
      const content = document.getElementById('site-verify-content');
      if (content) content.innerHTML = NDVIVerifier.renderVerificationCard(currentSite.id, _lastVerification);
      if (btn) { btn.textContent = '↻ Refresh from Satellite'; btn.disabled = false; }
    }).catch(err => {
      console.warn('[SITE_PANEL] Verification failed:', err);
      if (btn) { btn.textContent = '↻ Retry'; btn.disabled = false; }
    });
  }

  // ── Switch verification tab ──
  function switchVerifyTab(btn, tab) {
    _lastTab = tab;
    const tabs = panelEl?.querySelectorAll('.verify-tab');
    if (tabs) tabs.forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    // Re-render content
    const content = document.getElementById('site-verify-content');
    if (!content) return;
    if (tab === 'sat') {
      if (_lastVerification) content.innerHTML = NDVIVerifier.renderVerificationCard(currentSite.id, _lastVerification);
      else content.innerHTML = '<p style="font-size:10px;color:var(--text3)">Click refresh to fetch satellite data...</p>';
    } else {
      if (_lastRegCheck) content.innerHTML = RegistryCheck.renderRegistryCard(_lastRegCheck);
      else content.innerHTML = '<p style="font-size:10px;color:var(--text3)">Click refresh to fetch registry data...</p>';
    }
  }

  // ── Close ──
  function close() {
    if (overlayEl) overlayEl.classList.remove('visible');
    if (panelEl) panelEl.classList.remove('open');
    currentSite = null;

    // Speak departure
    const line = GAIA_VOICE.speak('DEPARTURE', null, null);
    if (line) GAIA_BUBBLE.show(line.text, line.tone, 5000);

    GAIA_ENGAGEMENT.save();
  }

  return { open, close, nextLayer, selectPrediction, addInsight, verifyCurrentSite, switchVerifyTab, toggleGAIA, speakGAIA, addInsightFromGAIA, scrollToLayer, getCurrentLayer: () => currentLayer, getCurrentSite: () => currentSite };
})();
window.SITE_PANEL = SITE_PANEL;


// ═══════════════════════════════════════════════
// PLEDGE PANEL — Country Interrogation Terminal
// Left-side overlay via GLOBE_OVERLAY (same as site panels)
// ═══════════════════════════════════════════════

const PLEDGE_PANEL = (() => {
  let currentNode = null;

  function fmt(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return typeof n === 'number' ? n.toFixed(1) : String(n);
  }

  function open(node) {
    currentNode = node;

    // Fly to country
    if (typeof GlobeModule !== 'undefined' && GlobeModule.world) {
      GlobeModule.world.pointOfView({ lat: node.lat, lng: node.lng, altitude: 0.8 }, 600);
      GlobeModule.world.controls().autoRotate = false;
    }

    // Use GLOBE_OVERLAY for the left-side panel
    if (typeof GLOBE_OVERLAY !== 'undefined') {
      GLOBE_OVERLAY.registerSite({
        siteId: 'pledge_' + node.iso,
        icon: '🌐',
        title: node.country,
        subtitle: (node.reduction_pct > 0 ? node.reduction_pct + '% by ' + Math.round(node.target_year) : 'No target') + (node.cat_rating ? ' · ' + node.cat_rating : ''),
        siteData: node,
        tabs: [
          { id: 'dashboard', label: 'Dashboard', render: renderDashboard },
        ],
      });
      GLOBE_OVERLAY.open('pledge_' + node.iso);
    }
  }

  function renderDashboard(el, node) {
    if (!node) return;
    const gap = node.reality_gap_mt;
    const gapClass = gap === null ? '' : (gap > 0 ? 'red' : 'green');
    const gapSign = gap !== null && gap > 0 ? '+' : '';
    const onTrack = node.on_track || '';
    const mom = node.momentum_cagr;
    const momClass = mom > 0 ? 'red' : 'green';

    let html = '';

    // CAT rating badge
    if (node.cat_rating) {
      html += '<div class="pledge-cat-badge" style="background:' + (node.globe_color || '#95a5a6') + '22;border-color:' + (node.globe_color || '#95a5a6') + '">';
      html += '<span class="pledge-cat-dot" style="background:' + (node.globe_color || '#95a5a6') + '"></span>';
      html += node.cat_rating;
      html += '</div>';
    }

    // Reality Gap card — BIG
    html += '<div class="pledge-gap-card">';
    html += '<div class="pledge-big-number">' + fmt(node.fossil_co2_mt) + ' <span class="pledge-unit">MtCO₂</span></div>';
    html += '<div class="pledge-label">Current Fossil Emissions</div>';
    if (gap !== null) {
      html += '<div class="pledge-gap-metric ' + gapClass + '">Gap to Target: ' + gapSign + fmt(gap) + ' MtCO₂</div>';
    } else {
      html += '<div class="pledge-gap-metric">No target data available</div>';
    }
    html += '</div>';

    // Emissions breakdown
    html += '<div class="pledge-emit-grid">';
    html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + fmt(node.fossil_co2_mt) + '</div><div class="pledge-emit-label">Fossil CO₂ (Mt)</div></div>';
    html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + fmt(node.lulucf_co2_mt) + '</div><div class="pledge-emit-label">LULUCF CO₂ (Mt)</div></div>';
    html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + fmt(node.total_co2_mt) + '</div><div class="pledge-emit-label">Total CO₂ (Mt)</div></div>';
    html += '<div class="pledge-emit-item"><div class="pledge-emit-val">' + (node.co2_per_capita > 0 ? node.co2_per_capita.toFixed(2) : '—') + '</div><div class="pledge-emit-label">Per Capita (t)</div></div>';
    html += '</div>';

    // Momentum
    html += '<div class="pledge-momentum">';
    html += '<div class="pledge-momentum-actual ' + momClass + '">';
    html += '<div class="pledge-momentum-label">Actual Velocity</div>';
    html += '<div class="pledge-momentum-val">' + (mom > 0 ? '+' : '') + mom.toFixed(2) + '%/yr</div>';
    html += '</div>';
    if (node.required_cagr > 0) {
      html += '<div class="pledge-momentum-vs">vs</div>';
      html += '<div class="pledge-momentum-required">';
      html += '<div class="pledge-momentum-label">Required Velocity</div>';
      html += '<div class="pledge-momentum-val">-' + node.required_cagr.toFixed(2) + '%/yr</div>';
      html += '</div>';
    }
    html += '</div>';
    if (node.divergence !== null && node.divergence !== undefined && node.divergence !== 0) {
      const divClass = node.divergence > 0 ? 'red' : 'green';
      html += '<div class="pledge-divergence ' + divClass + '">Divergence: ' + (node.divergence > 0 ? '+' : '') + node.divergence.toFixed(2) + '%/yr</div>';
    }

    // Change since 2015
    if (node.change_since_2015 !== null) {
      const chg = node.change_since_2015;
      const chgClass = chg > 0 ? 'red' : 'green';
      html += '<div class="pledge-change ' + chgClass + '">Since 2015: ' + (chg > 0 ? '+' : '') + chg.toFixed(1) + '%</div>';
    }

    // On track
    if (onTrack === 'true') {
      html += '<div class="pledge-on-track green">✓ On Track</div>';
    } else if (onTrack === 'false') {
      html += '<div class="pledge-on-track red">✗ Off Track</div>';
    }

    // Finance
    if (node.finance_total_bn > 0) {
      html += '<div class="pledge-section">';
      html += '<div class="pledge-section-title">Climate Finance</div>';
      html += '<div class="pledge-finance-total">$' + fmt(node.finance_total_bn) + 'B</div>';
      html += '<div class="pledge-finance-label">Target Conditional on International Finance</div>';
      if (node.finance_mitigation_bn > 0) {
        html += '<div class="pledge-finance-breakdown">Mitigation: $' + fmt(node.finance_mitigation_bn) + 'B · Adaptation: $' + fmt(node.finance_adaptation_bn) + 'B</div>';
      }
      html += '</div>';
    }

    // NDC Summary
    if (node.ndc_summary) {
      html += '<div class="pledge-section">';
      html += '<div class="pledge-section-title">NDC Summary</div>';
      html += '<div class="pledge-ndc-text">' + node.ndc_summary + '</div>';
      html += '</div>';
    }

    el.innerHTML = html;
  }

  function close() {
    currentNode = null;
    if (typeof GLOBE_OVERLAY !== 'undefined') {
      GLOBE_OVERLAY.close();
    }
    if (typeof GlobeModule !== 'undefined' && GlobeModule.world) {
      GlobeModule.world.controls().autoRotate = true;
      GlobeModule.world.pointOfView({ lat: 20, lng: 40, altitude: 2.2 }, 400);
    }
  }

  return { open, close };
})();
window.PLEDGE_PANEL = PLEDGE_PANEL;


/* ══ js/carbon-clock.js ══ */
/**
 * CARBON CLOCK v1.0
 * Live counter showing real-time excess CO₂ accumulation
 * 20 Gt/year = ~635 tons/second = ~0.635 tons every millisecond
 * 
 * Displays on hero, then mini version in topbar after entering
 */

const CARBON_CLOCK = (() => {
  // ── Constants ──
  const ANNUAL_EXCESS_GT = 20;           // 20 Gt CO₂/year
  const ANNUAL_EXCESS_TONS = ANNUAL_EXCESS_GT * 1e9;
  const TONS_PER_SECOND = ANNUAL_EXCESS_TONS / (365.25 * 24 * 60 * 60);
  const TONS_PER_MS = TONS_PER_SECOND / 1000;

  // ── State ️
  let startTime = null;
  let totalTons = 0;
  let timer = null;
  let heroEl = null;
  let topbarEl = null;
  let visible = false;

  // ── Format numbers ──
  function formatTons(tons) {
    if (tons >= 1e9) return (tons / 1e9).toFixed(2) + ' Gt';
    if (tons >= 1e6) return (tons / 1e6).toFixed(1) + ' Mt';
    if (tons >= 1e3) return (tons / 1e3).toFixed(1) + 'K t';
    return Math.floor(tons).toLocaleString() + ' t';
  }

  function formatRate(tps) {
    if (tps >= 1e6) return (tps / 1e6).toFixed(1) + ' Mt/s';
    if (tps >= 1e3) return (tps / 1e3).toFixed(1) + 'K t/s';
    return tps.toFixed(1) + ' t/s';
  }

  // ── Create hero clock ──
  function createHeroClock() {
    if (heroEl) return;

    heroEl = document.createElement('div');
    heroEl.id = 'carbon-clock-hero';
    heroEl.innerHTML = `
      <div class="cc-hero-inner">
        <div class="cc-label">Excess CO₂ since you arrived</div>
        <div class="cc-value" id="cc-hero-value">0 t</div>
        <div class="cc-rate" id="cc-hero-rate">~${formatRate(TONS_PER_SECOND)}</div>
        <div class="cc-bar">
          <div class="cc-bar-fill" id="cc-hero-bar"></div>
        </div>
        <div class="cc-context">
          <span class="cc-annual">${ANNUAL_EXCESS_GT} Gt/year</span>
          <span class="cc-sep">·</span>
          <span class="cc-desc">the carbon nature can't absorb</span>
        </div>
      </div>
    `;

    // Inject into the hero container
    const container = document.getElementById('hero-carbon-clock');
    if (container) {
      container.appendChild(heroEl);
    } else {
      // Fallback: insert into hero directly
      const hero = document.getElementById('hero');
      if (hero) {
        const inner = hero.querySelector('.hero-inner');
        if (inner) {
          inner.insertBefore(heroEl, inner.firstChild);
        } else {
          hero.appendChild(heroEl);
        }
      }
    }
  }

  // ── Create topbar mini clock ──
  function createTopbarClock() {
    if (topbarEl) return;

    topbarEl = document.createElement('div');
    topbarEl.id = 'carbon-clock-topbar';
    topbarEl.className = 'cc-topbar';
    topbarEl.innerHTML = `
      <span class="cc-topbar-icon">🌡️</span>
      <span class="cc-topbar-value" id="cc-topbar-value">0 t</span>
      <span class="cc-topbar-rate">+${formatRate(TONS_PER_SECOND)}</span>
    `;

    // Insert into topbar stats
    const topbar = document.getElementById('topbar');
    if (topbar) {
      const stats = topbar.querySelector('.stats');
      if (stats) {
        stats.insertBefore(topbarEl, stats.firstChild);
      }
    }
  }

  // ── Update display ──
  function update() {
    if (!startTime) return;

    const elapsed = Date.now() - startTime;
    totalTons = elapsed * TONS_PER_MS;

    // Update hero (cache DOM refs)
    if (_heroValue) _heroValue.textContent = formatTons(totalTons);
    if (_heroBar) {
      const pct = Math.min((elapsed / 60000) * 100, 100);
      _heroBar.style.width = pct + '%';
    }
    if (_topbarValue) _topbarValue.textContent = formatTons(totalTons);
  }

  // ── Cache DOM refs ──
  let _heroValue = null, _heroBar = null, _topbarValue = null;
  function _cacheRefs() {
    _heroValue = document.getElementById('cc-hero-value');
    _heroBar = document.getElementById('cc-hero-bar');
    _topbarValue = document.getElementById('cc-topbar-value');
  }

  // ── Start ──
  function start() {
    if (timer) return;
    startTime = Date.now();
    _cacheRefs();
    timer = setInterval(update, 500); // Update every 500ms — smooth enough for a clock
    visible = true;
  }

  // ── Stop ──
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    visible = false;
  }

  // ── Reset ──
  function reset() {
    startTime = Date.now();
    totalTons = 0;
    update();
  }

  // ── Get current value ──
  function getValue() {
    return {
      tons: totalTons,
      formatted: formatTons(totalTons),
      rate: TONS_PER_SECOND,
      rateFormatted: formatRate(TONS_PER_SECOND),
      elapsed: startTime ? Date.now() - startTime : 0,
    };
  }

  // ── Init ──
  function init() {
    createHeroClock();
    createTopbarClock();
    // Start immediately — the clock begins ticking as soon as the page loads
    start();
  }

  return {
    init, start, stop, reset, getValue,
    TONS_PER_SECOND, ANNUAL_EXCESS_GT,
  };
})();


/* ══ js/country-data.js ══ */
/**
 * COUNTRY DATA v1.0
 * Top 30 CO₂ emitting countries with 2023 data from Global Carbon Budget / OWID
 * Used for personalized "Your Delegation" entry points
 * 
 * Data sources:
 * - Global Carbon Budget 2025
 * - OWID CO2 Dataset (ourworldindata.org/co2-and-greenhouse-gas-emissions)
 * - Per capita emissions from World Bank
 */

const COUNTRY_DATA = (() => {
  // ── Top 30 emitting countries (2023 data, Mt CO₂) ──
  window.COUNTRIES = {
    CHN: { name: "China", emissions: 11903, perCapita: 8.4, share: 31.5, flag: "🇨🇳" },
    USA: { name: "United States", emissions: 4911, perCapita: 14.3, share: 13.0, flag: "🇺🇸" },
    IND: { name: "India", emissions: 3062, perCapita: 2.1, share: 8.1, flag: "🇮🇳" },
    RUS: { name: "Russia", emissions: 1816, perCapita: 12.5, share: 4.8, flag: "🇷🇺" },
    JPN: { name: "Japan", emissions: 989, perCapita: 8.0, share: 2.6, flag: "🇯🇵" },
    IRN: { name: "Iran", emissions: 818, perCapita: 9.0, share: 2.2, flag: "🇮🇷" },
    SAU: { name: "Saudi Arabia", emissions: 736, perCapita: 22.1, share: 1.9, flag: "🇸🇦" },
    IDN: { name: "Indonesia", emissions: 733, perCapita: 2.6, share: 1.9, flag: "🇮🇩" },
    DEU: { name: "Germany", emissions: 596, perCapita: 7.1, share: 1.6, flag: "🇩🇪" },
    KOR: { name: "South Korea", emissions: 577, perCapita: 11.2, share: 1.5, flag: "🇰🇷" },
    BRA: { name: "Brazil", emissions: 568, perCapita: 2.7, share: 1.5, flag: "🇧🇷" },
    CAN: { name: "Canada", emissions: 555, perCapita: 13.9, share: 1.5, flag: "🇨🇦" },
    TUR: { name: "Turkey", emissions: 534, perCapita: 6.2, share: 1.4, flag: "🇹🇷" },
    GBR: { name: "United Kingdom", emissions: 349, perCapita: 5.1, share: 0.9, flag: "🇬🇧" },
    AUS: { name: "Australia", emissions: 344, perCapita: 12.9, share: 0.9, flag: "🇦🇺" },
    ITA: { name: "Italy", emissions: 337, perCapita: 5.7, share: 0.9, flag: "🇮🇹" },
    FRA: { name: "France", emissions: 315, perCapita: 4.6, share: 0.8, flag: "🇫🇷" },
    POL: { name: "Poland", emissions: 312, perCapita: 8.2, share: 0.8, flag: "🇵🇱" },
    MEX: { name: "Mexico", emissions: 488, perCapita: 3.7, share: 1.3, flag: "🇲🇽" },
    ZAF: { name: "South Africa", emissions: 435, perCapita: 7.1, share: 1.2, flag: "🇿🇦" },
    THA: { name: "Thailand", emissions: 292, perCapita: 4.1, share: 0.8, flag: "🇹🇭" },
    EGY: { name: "Egypt", emissions: 270, perCapita: 2.5, share: 0.7, flag: "🇪🇬" },
    VNM: { name: "Vietnam", emissions: 310, perCapita: 3.1, share: 0.8, flag: "🇻🇳" },
    ARG: { name: "Argentina", emissions: 198, perCapita: 4.3, share: 0.5, flag: "🇦🇷" },
    NGA: { name: "Nigeria", emissions: 152, perCapita: 0.7, share: 0.4, flag: "🇳🇬" },
    PAK: { name: "Pakistan", emissions: 196, perCapita: 0.8, share: 0.5, flag: "🇵🇰" },
    BGD: { name: "Bangladesh", emissions: 96, perCapita: 0.6, share: 0.3, flag: "🇧🇩" },
    NLD: { name: "Netherlands", emissions: 140, perCapita: 7.9, share: 0.4, flag: "🇳🇱" },
    ESP: { name: "Spain", emissions: 255, perCapita: 5.4, share: 0.7, flag: "🇪🇸" },
    ARE: { name: "UAE", emissions: 205, perCapita: 20.5, share: 0.5, flag: "🇦🇪" },
  };

  // ── Browser language → country code mapping (top 50) ──
  window.LANG_MAP = {
    zh: "CN", "zh-CN": "CN", "zh-TW": "CN", "zh-HK": "CN",
    en: "US", "en-US": "US", "en-GB": "GB", "en-AU": "AU", "en-CA": "CA", "en-IN": "IN", "en-NG": "NG", "en-ZA": "ZA",
    hi: "IN",
    es: "MX", "es-ES": "ES", "es-AR": "AR", "es-MX": "MX",
    fr: "FR", "fr-FR": "FR", "fr-CA": "CA",
    de: "DE", "de-DE": "DE",
    ja: "JP",
    ko: "KR",
    pt: "BR", "pt-BR": "BR",
    ru: "RU",
    ar: "SA", "ar-SA": "SA", "ar-EG": "EG", "ar-AE": "AE",
    tr: "TR",
    it: "IT",
    pl: "PL",
    nl: "NL",
    th: "TH",
    vi: "VN",
    id: "ID",
    ms: "MY",
    fa: "IR",
    ur: "PK",
    bn: "BD",
    ta: "IN",
    te: "IN",
    mr: "IN",
    gu: "IN",
    kn: "IN",
    ml: "IN",
    pa: "IN",
    or: "IN",
    as: "IN",
    ne: "NP",
    si: "LK",
    my: "MM",
    km: "KH",
    lo: "LA",
    tl: "PH",
    sw: "KE",
    am: "ET",
    yo: "NG",
    ig: "NG",
    ha: "NG",
    zu: "ZA",
    xh: "ZA",
    af: "ZA",
  };

  // ── Detect country from browser ──
  function detectCountry() {
    // 1. Try browser language
    const lang = navigator.language || navigator.userLanguage || "en";
    const langCode = lang.split("-")[0].toLowerCase();
    const fullLang = lang.toLowerCase();
    
    // Try full language tag first (e.g., "en-US"), then just language code
    let countryCode = LANG_MAP[fullLang] || LANG_MAP[langCode];
    
    if (countryCode && COUNTRIES[countryCode]) {
      return { code: countryCode, source: "browser_language", confidence: "medium" };
    }

    // 2. Try timezone as fallback
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const tzCountryMap = {
        "Asia/Shanghai": "CHN", "Asia/Hong_Kong": "CHN", "Asia/Taipei": "CHN",
        "America/New_York": "USA", "America/Chicago": "USA", "America/Denver": "USA",
        "America/Los_Angeles": "USA", "America/Toronto": "CAN", "America/Vancouver": "CAN",
        "Europe/London": "GBR", "Europe/Paris": "FRA", "Europe/Berlin": "DEU",
        "Europe/Moscow": "RUS", "Europe/Rome": "ITA", "Europe/Madrid": "ESP",
        "Europe/Amsterdam": "NLD", "Europe/Warsaw": "POL",
        "Asia/Tokyo": "JPN", "Asia/Seoul": "KOR", "Asia/Kolkata": "IND",
        "Asia/Jakarta": "IDN", "Asia/Bangkok": "THA", "Asia/Ho_Chi_Minh": "VNM",
        "Asia/Karachi": "PAK", "Asia/Dhaka": "BGD", "Asia/Tehran": "IRN",
        "Asia/Riyadh": "SAU", "Asia/Dubai": "ARE", "Asia/Kuwait": "SAU",
        "Australia/Sydney": "AUS", "Australia/Melbourne": "AUS",
        "America/Sao_Paulo": "BRA", "America/Buenos_Aires": "ARG",
        "America/Mexico_City": "MEX", "America/Bogota": "BRA",
        "Africa/Cairo": "EGY", "Africa/Lagos": "NGA", "Africa/Johannesburg": "ZAF",
        "Africa/Nairobi": "NGA", "Africa/Addis_Ababa": "ETH",
        "Asia/Manila": "IDN", "Asia/Kuala_Lumpur": "IDN",
        "Pacific/Auckland": "AUS",
        "Europe/Istanbul": "TUR",
      };
      const tzCode = tzCountryMap[tz];
      if (tzCode && COUNTRIES[tzCode]) {
        return { code: tzCode, source: "timezone", confidence: "low" };
      }
    } catch (e) { /* ignore */ }

    // 3. Default: unknown
    return { code: null, source: "none", confidence: "none" };
  }

  // ── Get country data ──
  function getCountry(code) {
    if (!code) return null;
    const upper = code.toUpperCase();
    return COUNTRIES[upper] ? { code: upper, ...COUNTRIES[upper] } : null;
  }

  // ── Get all countries sorted by emissions ──
  function getAllCountries() {
    return Object.entries(COUNTRIES)
      .map(([code, data]) => ({ code, ...data }))
      .sort((a, b) => b.emissions - a.emissions);
  }

  // ── Format emissions for display ──
  function formatEmissions(mt) {
    if (mt >= 1000) return (mt / 1000).toFixed(1) + ' Gt';
    return mt.toLocaleString() + ' Mt';
  }

  // ── Get comparison context ──
  function getComparison(code) {
    const country = getCountry(code);
    if (!country) return null;

    const carsEquivalent = Math.round(country.emissions * 1e6 / 4.6); // 4.6 t CO₂/car/year
    const treesNeeded = Math.round(country.emissions * 1e6 / 0.022); // 22 kg CO₂/tree/year
    const secondsPerTon = (365.25 * 24 * 60 * 60) / (country.emissions * 1e6); // seconds per ton for this country

    return {
      ...country,
      formattedEmissions: formatEmissions(country.emissions),
      carsEquivalent: carsEquivalent.toLocaleString(),
      treesNeeded: (treesNeeded / 1e9).toFixed(1) + ' billion',
      secondsPerTon: secondsPerTon < 1 ? '< 1' : Math.round(secondsPerTon).toString(),
      globalRank: getAllCountries().findIndex(c => c.code === code) + 1,
    };
  }

  return {
    detectCountry,
    getCountry,
    getAllCountries,
    getComparison,
    formatEmissions,
    COUNTRIES,
  };
})();


/* ══ js/delegation.js ══ */
/**
 * DELEGATION GREETING v1.0
 * Personalized country-specific entry point for COP31 delegates
 * Detects visitor's country and shows tailored emissions data
 */

const DELEGATION = (() => {
  let detected = null;
  let countryData = null;
  let greetingEl = null;

  // ── Create the delegation greeting overlay ──
  function createGreeting() {
    if (greetingEl) return;

    detected = COUNTRY_DATA.detectCountry();
    countryData = detected.code ? COUNTRY_DATA.getComparison(detected.code) : null;

    // Only show if we detected a country with data
    if (!countryData) return;

    greetingEl = document.createElement('div');
    greetingEl.id = 'delegation-greeting';
    greetingEl.innerHTML = buildGreetingHTML();

    // Inject into the hero container
    const container = document.getElementById('hero-delegation');
    if (container) {
      container.appendChild(greetingEl);
    } else {
      // Fallback: insert at top of hero
      const hero = document.getElementById('hero');
      if (hero) {
        hero.insertBefore(greetingEl, hero.firstChild);
      }
    }

    // Animate in
    requestAnimationFrame(() => {
      greetingEl.classList.add('visible');
    });

    // Track engagement
    if (typeof GAIA_ENGAGEMENT !== 'undefined') {
      GAIA_ENGAGEMENT.addSignal('site_tap');
      GAIA_ENGAGEMENT.addMoodSignal('urgency');
    }
  }

  // ── Build the greeting HTML ──
  function buildGreetingHTML() {
    const c = countryData;
    const isHighEmitter = c.globalRank <= 10;
    const isTop3 = c.globalRank <= 3;

    let tone = 'neutral';
    if (isTop3) tone = 'urgent';
    else if (isHighEmitter) tone = 'concerned';
    else if (c.perCapita > 10) tone = 'personal';

    const toneColors = {
      urgent: '#c45c4a',
      concerned: '#d4a574',
      personal: '#8b7fc7',
      neutral: '#4ecdc4',
    };
    const accentColor = toneColors[tone];

    return `
      <div class="dg-card" style="border-color: ${accentColor}30">
        <div class="dg-flag">${c.flag}</div>
        <div class="dg-content">
          <div class="dg-greeting">${getGreetingText(c, tone)}</div>
          <div class="dg-stats">
            <div class="dg-stat">
              <div class="dg-stat-value" style="color: ${accentColor}">${c.formattedEmissions}</div>
              <div class="dg-stat-label">CO₂ emitted in 2023</div>
            </div>
            <div class="dg-stat">
              <div class="dg-stat-value">${c.perCapita} t</div>
              <div class="dg-stat-label">per person</div>
            </div>
            <div class="dg-stat">
              <div class="dg-stat-value">#${c.globalRank}</div>
              <div class="dg-stat-label">global rank</div>
            </div>
            <div class="dg-stat">
              <div class="dg-stat-value">${c.share}%</div>
              <div class="dg-stat-label">of global emissions</div>
            </div>
          </div>
          <div class="dg-context">${getContextText(c)}</div>
          <div class="dg-cta">
            <button class="dg-btn-primary" onclick="DELEGATION.exploreCountry()">
              Explore ${c.name}'s carbon story →
            </button>
            <button class="dg-btn-secondary" onclick="DELEGATION.dismiss()">
              Show me the planet
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Get personalized greeting text ──
  function getGreetingText(c, tone) {
    const greetings = {
      urgent: [
        `Welcome, delegate from ${c.name}. Your country is one of the top 3 emitters on Earth.`,
        `${c.name} emits ${c.formattedEmissions} of CO₂ every year. That's ${c.share}% of the global total.`,
      ],
      concerned: [
        `Welcome, delegate from ${c.name}. Your country ranks #${c.globalRank} in global emissions.`,
        `${c.name} emitted ${c.formattedEmissions} of CO₂ in 2023. That's ${c.perCapita} tons per person.`,
      ],
      personal: [
        `Welcome, delegate from ${c.name}. Each person in your country emits ${c.perCapita} tons of CO₂ per year.`,
        `${c.name}: ${c.perCapita} tons of CO₂ per capita. That's ${c.share}% of global emissions.`,
      ],
      neutral: [
        `Welcome, delegate from ${c.name}. Here's your country's carbon footprint.`,
        `${c.name} emitted ${c.formattedEmissions} of CO₂ in 2023. Rank: #${c.globalRank} globally.`,
      ],
    };

    const pool = greetings[tone] || greetings.neutral;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Get context text ──
  function getComparisonContext(c) {
    const contexts = [
      `That's equivalent to ${c.carsEquivalent} cars on the road for a year.`,
      `It would take ${c.treesNeeded} trees to offset one year of ${c.name}'s emissions.`,
      `Every ${c.secondsPerTon} seconds, ${c.name} emits another ton of CO₂.`,
      `${c.name}'s emissions alone account for ${c.share}% of the global total.`,
    ];
    return contexts[Math.floor(Math.random() * contexts.length)];
  }

  function getContextText(c) {
    return getComparisonContext(c);
  }

  // ── Explore country story ──
  function exploreCountry() {
    if (!countryData) return;

    // Scroll to the globe section
    const globe = document.getElementById('globeViz');
    if (globe) {
      globe.scrollIntoView({ behavior: 'smooth' });
    }

    // Show GAIA speaking about the country
    if (typeof GAIA_BUBBLE !== 'undefined') {
      const line = GAIA_VOICE.speak('FACT', null, 'urgent');
      if (line) {
        GAIA_BUBBLE.speak(
          `${countryData.flag} ${countryData.name}: ${countryData.formattedEmissions} in 2023. ${getComparisonContext(countryData)}`,
          'urgent',
          8000
        );
      }
    }

    // Dismiss the greeting
    dismiss();
  }

  // ── Dismiss greeting ──
  function dismiss() {
    if (greetingEl) {
      greetingEl.classList.remove('visible');
      setTimeout(() => {
        if (greetingEl && greetingEl.parentNode) {
          greetingEl.parentNode.removeChild(greetingEl);
        }
        greetingEl = null;
      }, 400);
    }
  }

  // ── Init ──
  function init() {
    // Small delay to let the page settle
    setTimeout(createGreeting, 500);
  }

  return {
    init, createGreeting, dismiss, exploreCountry,
    getDetected: () => detected,
    getCountryData: () => countryData,
  };
})();


/* ══ js/pledge-wall.js ══ */
/**
 * PLEDGE WALL v2.0
 * Public commitment wall — fires after meaningful moments, not score thresholds
 * 
 * Triggers (in order of priority):
 * 1. After completing a site investigation (all layers revealed)
 * 2. After running a restoration scenario
 * 3. After collecting 3+ journal insights
 * 4. On departure (if score 20+ and hasn't pledged)
 * 
 * UX: GAIA speaks first → small prompt appears → user clicks → modal opens
 * Not a pop-up. A natural next step.
 */

const PLEDGE_WALL = (() => {
  // ── State ──
  let pledges = [];
  let modalEl = null;
  let wallEl = null;
  let promptEl = null;
  let hasPledged = false;
  let promptShown = false;
  let triggerSource = null; // 'site_complete' | 'scenario' | 'insights' | 'departure'

  // ── Persistence ──
  function save() {
    Storage.safeSetItem('gaia_pledges', JSON.stringify(pledges));
    Storage.safeSetItem('gaia_has_pledged', hasPledged ? '1' : '0');
  }

  function load() {
    try {
      const raw = Storage.safeGetItem('gaia_pledges');
      if (raw) pledges = JSON.parse(raw);
      hasPledged = Storage.safeGetItem('gaia_has_pledged') === '1';
    } catch { /* ignore */ }
  }

  // ── Check if we should show the small prompt (not the full modal yet) ──
  function shouldShowPrompt() {
    if (promptShown) return false;
    if (hasPledged) return false;
    if (modalEl) return false; // modal already open
    return true;
  }

  // ── Trigger: After completing a site investigation ──
  function onSiteComplete(siteId) {
    if (!shouldShowPrompt()) return;
    triggerSource = 'site_complete';
    showSmallPrompt(
      "You've seen " + getSiteName(siteId) + ". You've seen the data. What will you do with this knowledge?",
      'warm'
    );
  }

  // ── Trigger: After running a scenario ──
  function onScenarioRun(result) {
    if (!shouldShowPrompt()) return;
    if (!result || !result.cumulative_co2) return;
    
    const tons = Math.abs(result.cumulative_co2);
    const formatted = tons >= 1e6 ? (tons / 1e6).toFixed(1) + 'M' : (tons / 1e3).toFixed(0) + 'K';
    
    triggerSource = 'scenario';
    showSmallPrompt(
      "You just modeled restoring " + formatted + " tons of CO₂. That's real impact. What will you actually do?",
      'proud'
    );
  }

  // ── Trigger: After collecting 3+ insights ──
  function onInsightsCollected(count) {
    if (!shouldShowPrompt()) return;
    if (count < 3) return;
    
    triggerSource = 'insights';
    showSmallPrompt(
      count + " insights collected. You're building real understanding. Ready to turn knowledge into action?",
      'warm'
    );
  }

  // ── Trigger: On departure (if engaged but hasn't pledged) ──
  // NOTE: This is now handled by app.js via visibilitychange + beforeunload.
  // Kept as a no-op for backward compatibility in case other code calls it.
  function onDeparture() {
    // Deprecated — departure logic moved to app.js
  }

  // ── Show small prompt (not full modal yet) ──
  function showSmallPrompt(message, tone) {
    promptShown = true;

    // GAIA speaks
    if (typeof GAIA_BUBBLE !== 'undefined') {
      GAIA_BUBBLE.speak(message, tone, 8000);
    }

    // Show small prompt bar after GAIA finishes speaking
    setTimeout(() => {
      createSmallPrompt(message);
    }, 6000);
  }

  // ── Create small prompt bar (bottom of screen, non-intrusive) ──
  function createSmallPrompt(message) {
    if (promptEl) return;

    promptEl = document.createElement('div');
    promptEl.id = 'pledge-prompt';
    promptEl.innerHTML = `
      <div class="pledge-prompt-inner">
        <span class="pledge-prompt-text">${message.substring(0, 80)}...</span>
        <button class="pledge-prompt-btn" onclick="PLEDGE_WALL.openModal()">Make a Pledge</button>
        <button class="pledge-prompt-dismiss" onclick="PLEDGE_WALL.dismissPrompt()">✕</button>
      </div>
    `;

    document.body.appendChild(promptEl);

    // Animate in
    requestAnimationFrame(() => {
      promptEl.classList.add('visible');
    });

    // Auto-dismiss after 30 seconds if no interaction
    setTimeout(() => {
      if (promptEl) dismissPrompt();
    }, 30000);
  }

  // ── Dismiss small prompt ──
  function dismissPrompt() {
    if (promptEl) {
      promptEl.classList.remove('visible');
      setTimeout(() => {
        if (promptEl && promptEl.parentNode) {
          promptEl.parentNode.removeChild(promptEl);
        }
        promptEl = null;
      }, 300);
    }
  }

  // ── Open full pledge modal ──
  function openModal() {
    dismissPrompt();
    createModal();
  }

  // ── Create pledge modal ──
  function createModal() {
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.id = 'pledge-modal';
    modalEl.innerHTML = `
      <div class="pledge-modal-overlay" onclick="PLEDGE_WALL.closeModal()"></div>
      <div class="pledge-modal-card">
        <button class="pledge-modal-close" onclick="PLEDGE_WALL.closeModal()">✕</button>
        <div class="pledge-modal-icon">🤝</div>
        <h2 class="pledge-modal-title">Make Your Pledge</h2>
        <p class="pledge-modal-subtitle">You've seen the science. You've explored the data. Now — what will you do about it?</p>
        <textarea id="pledge-text" class="pledge-textarea" placeholder="I will..." maxlength="200" rows="3"></textarea>
        <div class="pledge-char-count"><span id="pledge-char-count">0</span>/200</div>
        <div class="pledge-options">
          <input type="text" id="pledge-name" class="pledge-input" placeholder="Your name (optional)" maxlength="50">
          <select id="pledge-type" class="pledge-select">
            <option value="personal">🌱 Personal Action</option>
            <option value="donation">💚 Donate</option>
            <option value="advocacy">📣 Spread the Word</option>
            <option value="career">💼 Career Change</option>
            <option value="other">✨ Other</option>
          </select>
        </div>
        <div class="pledge-actions">
          <button class="pledge-btn-primary" onclick="PLEDGE_WALL.submitPledge()">
            Add My Pledge to the Wall
          </button>
          <button class="pledge-btn-secondary" onclick="PLEDGE_WALL.closeModal()">
            Maybe Later
          </button>
        </div>
        <div class="pledge-privacy">Your pledge will be visible on the public wall. No email required.</div>
      </div>
    `;

    document.body.appendChild(modalEl);

    // Animate in
    requestAnimationFrame(() => {
      modalEl.classList.add('visible');
    });

    // Character counter
    const textarea = document.getElementById('pledge-text');
    const counter = document.getElementById('pledge-char-count');
    if (textarea && counter) {
      textarea.addEventListener('input', () => {
        counter.textContent = textarea.value.length;
      });
    }

    // Track engagement
    if (typeof GAIA_ENGAGEMENT !== 'undefined') {
      GAIA_ENGAGEMENT.addSignal('site_tap');
    }
  }

  // ── Submit pledge ──
  function submitPledge() {
    const text = document.getElementById('pledge-text')?.value.trim();
    if (!text || text.length < 5) {
      const ta = document.getElementById('pledge-text');
      if (ta) {
        ta.style.animation = 'none';
        ta.offsetHeight;
        ta.style.animation = 'shake 0.4s ease-out';
      }
      return;
    }

    const name = document.getElementById('pledge-name')?.value.trim() || 'Anonymous';
    const type = document.getElementById('pledge-type')?.value || 'personal';

    const pledge = {
      id: Date.now().toString(36),
      text,
      name,
      type,
      triggerSource,
      timestamp: Date.now(),
      country: getDetectedCountry(),
    };

    pledges.unshift(pledge);
    hasPledged = true;
    save();

    closeModal();
    showWall();

    // GAIA reacts
    if (typeof GAIA_BUBBLE !== 'undefined') {
      const reactions = [
        "That's a start. The wall grows. Every pledge matters.",
        "Good. Now do it. The planet is watching.",
        "Pledged. Let's see if you follow through.",
        "One more voice. One more action. That's how it starts.",
      ];
      GAIA_BUBBLE.speak(reactions[Math.floor(Math.random() * reactions.length)], 'proud', 5000);
    }

    if (typeof GAIA_ENGAGEMENT !== 'undefined') {
      GAIA_ENGAGEMENT.addSignal('share');
      GAIA_ENGAGEMENT.addMoodSignal('pride');
    }
    if (typeof GAIA_SIG !== 'undefined') GAIA_SIG.emit('share', { type: 'pledge' });

    if (typeof GAIA_JOURNAL !== 'undefined') {
      GAIA_JOURNAL.checkQuestProgress('share', null);
    }
  }

  // ── Get detected country ──
  function getDetectedCountry() {
    if (typeof DELEGATION !== 'undefined' && DELEGATION.getDetected()) {
      return DELEGATION.getDetected().code;
    }
    return null;
  }

  // ── Get site name from ID ──
  function getSiteName(siteId) {
    const names = {
      sri_lanka: 'Sri Lanka',
      antalya: 'Antalya',
      benin: 'Benin',
      borneo: 'Borneo',
    };
    return names[siteId] || 'this site';
  }

  // ── Close modal ──
  function closeModal() {
    if (modalEl) {
      modalEl.classList.remove('visible');
      setTimeout(() => {
        if (modalEl && modalEl.parentNode) {
          modalEl.parentNode.removeChild(modalEl);
        }
        modalEl = null;
      }, 300);
    }
  }

  // ── Show pledge wall ──
  function showWall() {
    if (wallEl) {
      wallEl.classList.add('visible');
      renderWall();
      return;
    }

    wallEl = document.createElement('div');
    wallEl.id = 'pledge-wall';
    wallEl.innerHTML = `
      <div class="pledge-wall-overlay" onclick="PLEDGE_WALL.hideWall()"></div>
      <div class="pledge-wall-card">
        <button class="pledge-wall-close" onclick="PLEDGE_WALL.hideWall()">✕</button>
        <div class="pledge-wall-header">
          <div class="pledge-wall-icon">🌍</div>
          <h2>The Pledge Wall</h2>
          <p>Commitments from people who've seen the data and decided to act.</p>
          <div class="pledge-wall-count">${pledges.length} pledge${pledges.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="pledge-wall-entries" id="pledge-wall-entries"></div>
      </div>
    `;

    document.body.appendChild(wallEl);

    requestAnimationFrame(() => {
      wallEl.classList.add('visible');
    });

    renderWall();
  }

  // ── Render wall entries ──
  function renderWall() {
    const container = document.getElementById('pledge-wall-entries');
    if (!container) return;

    if (pledges.length === 0) {
      container.innerHTML = '<div class="pledge-wall-empty">No pledges yet. Be the first.</div>';
      return;
    }

    const typeIcons = {
      personal: '🌱', donation: '💚', advocacy: '📣', career: '💼', other: '✨',
    };

    container.innerHTML = pledges.slice(0, 50).map(p => {
      const icon = typeIcons[p.type] || '✨';
      const timeAgo = getTimeAgo(p.timestamp);
      const countryFlag = p.country ? getFlagEmoji(p.country) : '';
      return `
        <div class="pledge-entry">
          <div class="pledge-entry-icon">${icon}</div>
          <div class="pledge-entry-content">
            <div class="pledge-entry-text">"${escapeHtml(p.text)}"</div>
            <div class="pledge-entry-meta">
              <span class="pledge-entry-name">${escapeHtml(p.name)}${countryFlag ? ' ' + countryFlag : ''}</span>
              <span class="pledge-entry-time">${timeAgo}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Hide wall ──
  function hideWall() {
    if (wallEl) {
      wallEl.classList.remove('visible');
      setTimeout(() => {
        if (wallEl && wallEl.parentNode) {
          wallEl.parentNode.removeChild(wallEl);
        }
        wallEl = null;
      }, 300);
    }
  }

  // ── Helper: time ago ──
  function getTimeAgo(ts) {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  // ── Helper: flag emoji ──
  function getFlagEmoji(code) {
    if (!code) return '';
    const codePoints = code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
    return String.fromCodePoint(...codePoints);
  }

  // ── Helper: escape HTML ──
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Generate share text ──
  function generateShareText(pledge) {
    return `"${pledge.text}" — ${pledge.name}, ${pledge.country || 'Earth'}. Join me: earthloveunited.org #GAIA #COP31`;
  }

  // ── Init ──
  function init() {
    load();
    // No automatic polling — triggers come from specific user actions
  }

  return {
    init, openModal, closeModal, submitPledge, dismissPrompt,
    showWall, hideWall,
    onSiteComplete, onScenarioRun, onInsightsCollected, onDeparture,
    getPledges: () => pledges,
    getPledgeCount: () => pledges.length,
    hasPledged: () => hasPledged,
    generateShareText,
  };
})();


/* ══ js/globe-overlay.js ══ */
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
    `;

    // Insert into globeViz so it's positioned relative to the globe canvas
    const globeViz = document.getElementById('globeViz');
    if (globeViz) {
      globeViz.appendChild(overlayEl);
    } else {
      document.body.appendChild(overlayEl);
    }

    // Close button
    overlayEl.querySelector('#globe-overlay-close').addEventListener('click', close);
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
      const gaiaContext = typeof GAIA_NODES !== 'undefined' ? GAIA_NODES.getGAIAContext(siteId) : null;
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
    if (typeof GAIA_CHARTS !== 'undefined') {
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

    dispatchEvent('overlay:close', {});
  }

  // ── Simple event dispatcher ──
  function dispatchEvent(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }

  // ── Public API ──
  return {
    registerSite,
    getSite,
    open,
    close,
    switchTab,
    isOpen: () => isOpen,
    getCurrentSite: () => currentSiteId,
  };
})();


/* ══ js/gaia-nodes.js ══ */
/**
 * GAIA NODES v1.1
 * Manages interactive nodes on the globe and their content.
 *
 * Each site on the globe is a "node" — a clickable point that opens
 * the GLOBE_OVERLAY with site-specific tabs and content.
 *
 * Data sources:
 * - site data from Data.sites (sites.json) — NDVI, climate, narratives
 * - climate facts from dis/climate-facts.json — sourced global data
 * - charts via GAIA_CHARTS — canvas sparklines
 * - GAIA voice lines woven into narrative
 */

const GAIA_NODES = (() => {
  // Counter for unique chart IDs (avoids Date.now() collisions)
  let _chartIdCounter = 0;
  // ── Per-site engagement state ──
  const nodeState = {
    sri_lanka:  { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
    antalya:    { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
    benin:      { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
    borneo:     { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked', visited: false },
  };

  // ── Climate facts (from dis/climate-facts.json) ──
  window.FACTS = {
    co2_current: 431.12,
    co2_preindustrial: 280,
    co2_annual_increase: 2.7,
    methane_current: 1940,
    methane_preindustrial: 722,
    temp_anomaly: 1.5,
    temp_anomaly_2021: 1.2,
    warming_rate: 0.2,
    carbon_budget_15: 250,
    carbon_budget_20: 1200,
    annual_emissions_2023: 37.8,
    annual_emissions_2025: 38.2,
    land_use_emissions: 3.6,
    ocean_sink: 2.5,
    land_sink: 3.4,
    airborne_fraction: 0.44,
    sea_level_rate: 4.5,
    sea_level_total: 20,
    atmosphere_pool: 870,
    ocean_pool: 37100,
    vegetation_pool: 550,
    soil_pool: 1500,
    permafrost_pool: 1700,
    peatland_stock: 600,
    peatland_area: 400,
    peatland_drained: 15,
    peatland_emissions: 1.9,
    mangrove_seq_rate: 6.3,
    mangrove_area: 15,
    mangrove_stock: 6.5,
    mangrove_loss: 35,
    seagrass_burial: 83,
    seagrass_area: 300000,
    seagrass_loss_rate: 7,
    solar_lcoe: 49,
    wind_lcoe: 42,
    coal_lcoe: 117,
    solar_reduction: 89,
    wind_reduction: 70,
    turkey_emissions: 534,
    turkey_per_capita: 6.2,
    turkey_rank: 13,
    turkey_share: 1.4,
  };

  // ── Content type definitions for modular globe markers ──
  window.CONTENT_TYPES = {
    site:   { marker: { color: '#4ecdc4', size: 0.4, pulse: true },  hasGAIA: true,  panelType: 'site' },
    city:   { marker: { color: '#ffd700', size: 0.3, pulse: false }, hasGAIA: true,  panelType: 'city' },
    event:  { marker: { color: '#ff6b6b', size: 0.5, pulse: true },  hasGAIA: true,  panelType: 'event' },
    biome:  { marker: { color: '#2a8a3a', size: 0.6, pulse: false }, hasGAIA: false, panelType: 'biome' },
    data:   { marker: { color: '#9b59b6', size: 0.2, pulse: false }, hasGAIA: false, panelType: 'data' },
  };

  // ── Generic content registration ──
  function registerContent(config) {
    const type = CONTENT_TYPES[config.type] || CONTENT_TYPES.site;
    GLOBE_OVERLAY.registerSite({
      ...config,
      markerStyle: type.marker,
      hasGAIA: type.hasGAIA,
      panelType: type.panelType,
    });
  }

  // ── Batch register from JSON URL ──
  function registerFromJSON(url) {
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          data.forEach(config => registerContent(config));
        }
      })
      .catch(err => console.warn('[GAIA_NODES] Failed to load content from', url, err));
  }

  // ── Register all site content ──
  function registerAllSites() {
    GLOBE_OVERLAY.registerSite({
      siteId: 'antalya',
      icon: '🔥',
      title: 'Antalya',
      subtitle: 'COP31 Host · Turkey',
      siteData: null,
      tabs: [
        { id: 'cop31',     label: 'COP31',        render: renderAntalyaCOP31 },
        { id: 'wildfires', label: 'Wildfires',    render: renderAntalyaWildfires },
        { id: 'climate',   label: 'Climate Data',  render: renderAntalyaClimate },
        { id: 'act',       label: 'Act',           render: renderAntalyaAct },
        { id: 'global',    label: '🌐 Global',     render: renderAntalyaGlobal },
        { id: 'synthesis', label: '🧠 GAIA Synthesis', render: renderAntalyaSynthesis },
      ],
    });

    GLOBE_OVERLAY.registerSite({
      siteId: 'sri_lanka',
      icon: '🌳',
      title: 'Sri Lanka',
      subtitle: 'Northern Province',
      siteData: null,
      tabs: [
        { id: 'story',  label: 'Story',  render: renderSriLankaStory },
        { id: 'data',   label: 'Data',   render: renderSriLankaData },
        { id: 'impact', label: 'Impact', render: renderSriLankaImpact },
        { id: 'global', label: '🌐 Global', render: renderSriLankaGlobal },
        { id: 'synthesis', label: '🧠 GAIA Synthesis', render: renderSriLankaSynthesis },
      ],
    });

    GLOBE_OVERLAY.registerSite({
      siteId: 'benin',
      icon: '🌿',
      title: 'Benin',
      subtitle: "Jean's Homeland",
      siteData: null,
      tabs: [
        { id: 'story',    label: 'Story',    render: renderBeninStory },
        { id: 'mangrove', label: 'Mangroves', render: renderBeninMangrove },
        { id: 'data',     label: 'Data',     render: renderBeninData },
        { id: 'global',   label: '🌐 Global', render: renderBeninGlobal },
        { id: 'synthesis', label: '🧠 GAIA Synthesis', render: renderBeninSynthesis },
      ],
    });

    GLOBE_OVERLAY.registerSite({
      siteId: 'borneo',
      icon: '🌴',
      title: 'Borneo',
      subtitle: 'West Kalimantan',
      siteData: null,
      tabs: [
        { id: 'story',  label: 'The Lie',   render: renderBorneoStory },
        { id: 'peat',   label: 'Peatlands',  render: renderBorneoPeat },
        { id: 'data',   label: 'Data',       render: renderBorneoData },
        { id: 'global', label: '🌐 Global',   render: renderBorneoGlobal },
        { id: 'synthesis', label: '🧠 GAIA Synthesis', render: renderBorneoSynthesis },
      ],
    });
  }

  function populateSiteData() {
    if (typeof Data === 'undefined' || !Data.sites) return;
    Data.sites.forEach(site => {
      const registered = GLOBE_OVERLAY.getSite(site.id);
      if (registered) registered.siteData = site;
    });
  }

  function onNodeClick(siteId) {
    GLOBE_OVERLAY.open(siteId);
    addXP(siteId, 10);
    nodeState[siteId].visited = true;
    // Set site context in GAIA bubble
    if (typeof GAIA_BUBBLE !== 'undefined') GAIA_BUBBLE.setCurrentSite(siteId);
    if (typeof GAIA_VOICE !== 'undefined') {
      const line = GAIA_VOICE.speak('SITE_ENTRY', siteId);
      if (line && typeof GAIA_BUBBLE !== 'undefined') GAIA_BUBBLE.speak(line.text, line.tone, 8000);
    }
    if (typeof GAIA_ENGAGEMENT !== 'undefined') GAIA_ENGAGEMENT.addSignal('site_tap', siteId);
  }

  function onNodeHover(siteId) {
    if (typeof GAIA_VOICE !== 'undefined') {
      const line = GAIA_VOICE.speak('SITE_TEASER', siteId);
      if (line && typeof GAIA_BUBBLE !== 'undefined') GAIA_BUBBLE.speak(line.text, line.tone, 5000);
    }
    if (typeof GAIA_ENGAGEMENT !== 'undefined') GAIA_ENGAGEMENT.interact();
  }

  // ── "What to Explore Next" suggestion engine ──
  window.SUGGESTION_REASONS = {
    sri_lanka: {
      analyst: 'The carbon density data is remarkable — from 10 to 180 tC/ha',
      explorer: 'This is where restoration meets conflict recovery',
      empath: 'The human story here is as powerful as the carbon data',
      skeptic: 'The satellite verification is solid — see for yourself',
      sharer: 'This is the most shareable restoration story we have',
      default: 'From 10 to 180 tC/ha — an 18x carbon increase',
    },
    antalya: {
      analyst: 'The 2021 wildfire NDVI crash is a textbook case',
      explorer: 'COP31 host site — the fire year data is stark',
      empath: '60,000 hectares burned in days. The recovery is slow.',
      skeptic: 'Cross-reference the satellite data with registry records',
      sharer: 'This is the climate story Turkey needs to tell',
      default: 'A single fire dropped NDVI from 0.72 to 0.18',
    },
    benin: {
      analyst: 'Mangrove carbon density is 950 tC/ha — highest of any biome',
      explorer: "Jean's homeland. The mangrove story is personal.",
      empath: 'When mangroves are destroyed, centuries of carbon go up in smoke',
      skeptic: 'The NDVI drop matches the carbon loss — verify it',
      sharer: "Jean's letter is the emotional anchor of this project",
      default: 'Mangroves store 950 tC/ha — the most carbon-dense ecosystem',
    },
    borneo: {
      analyst: 'NDVI 0.65 but only 50 tC/ha — the greenest lie on Earth',
      explorer: 'Peat swamp vs oil palm — see the carbon difference',
      empath: '1,400 tC/ha reduced to 50. That\'s a 96% loss.',
      skeptic: 'The satellite sees through the green. Look at the data.',
      sharer: 'This is the most important carbon story most people don\'t know',
      default: 'Green ≠ carbon. The greenest place is the biggest carbon catastrophe',
    },
  };

  window.SITE_LABELS = {
    sri_lanka: 'Sri Lanka',
    antalya: 'Antalya',
    benin: 'Benin',
    borneo: 'Borneo',
  };

  // ── GAIA context for globe overlay ──
  window.OVERLAY_GAIA_CONTEXT = {
    sri_lanka: {
      guidance: "This land was scarred by decades of conflict. The Northern Province saw displacement and ecological collapse. But someone saw potential here — not just to plant trees, but to rebuild an entire ecosystem.",
      suggestions: [
        { label: "Explore the story", action: "GLOBE_OVERLAY.switchTab('story')" },
        { label: "See the data", action: "GLOBE_OVERLAY.switchTab('data')" },
        { label: "Verify with satellite", action: "GLOBE_OVERLAY.switchTab('verification')" },
      ],
    },
    antalya: {
      guidance: "July 2021. The Mediterranean pines here were centuries old. Then the fire came. Sixty thousand hectares gone in days. I felt every hectare. Four years later, recovery is slow.",
      suggestions: [
        { label: "Explore the story", action: "GLOBE_OVERLAY.switchTab('story')" },
        { label: "See the data", action: "GLOBE_OVERLAY.switchTab('climate')" },
        { label: "About COP31", action: "GLOBE_OVERLAY.switchTab('cop31')" },
      ],
    },
    benin: {
      guidance: "Ouidah. Jean Missinhoun carried this place in his heart. He was from here. And he wanted to bring the mangroves back — even after he was gone. Mangroves store 950 tC/ha.",
      suggestions: [
        { label: "Explore the story", action: "GLOBE_OVERLAY.switchTab('story')" },
        { label: "See the data", action: "GLOBE_OVERLAY.switchTab('data')" },
        { label: "About mangroves", action: "GLOBE_OVERLAY.switchTab('mangrove')" },
      ],
    },
    borneo: {
      guidance: "West Kalimantan. The NDVI is 0.65 — pretty green. But the carbon density is only 50 tC/ha. The original peat swamp stored 1,400. That's a 96% carbon loss disguised as green.",
      suggestions: [
        { label: "Explore the story", action: "GLOBE_OVERLAY.switchTab('story')" },
        { label: "See the data", action: "GLOBE_OVERLAY.switchTab('data')" },
        { label: "About peatlands", action: "GLOBE_OVERLAY.switchTab('peat')" },
      ],
    },
  };

  function getGAIAContext(siteId) {
    return OVERLAY_GAIA_CONTEXT[siteId] || {
      guidance: "Explore this site to learn about restoration, carbon science, and climate impact.",
      suggestions: [
        { label: "Explore", action: "GLOBE_OVERLAY.switchTab('story')" },
      ],
    };
  }

  function getNextSuggestions(currentSiteId) {
    if (typeof GAIA_ENGAGEMENT === 'undefined') return [];
    const siteStates = GAIA_ENGAGEMENT.getSiteStates();
    const archetype = GAIA_ENGAGEMENT.getArchetype();
    const allSites = ['sri_lanka', 'antalya', 'benin', 'borneo'];
    const unvisited = allSites.filter(id => id !== currentSiteId && !siteStates[id]?.visited);
    const visited = allSites.filter(id => id !== currentSiteId && siteStates[id]?.visited);
    const suggestions = [];

    // Priority 1: unvisited sites
    for (const id of unvisited) {
      const reasons = SUGGESTION_REASONS[id];
      const reason = reasons?.[archetype] || reasons?.default || 'Worth exploring';
      suggestions.push({
        type: 'site',
        id,
        label: SITE_LABELS[id] || id,
        reason,
        action: `flyToSite('${id}')`,
        priority: 'high',
      });
    }

    // Priority 2: partially explored visited sites
    for (const id of visited) {
      const s = siteStates[id];
      if (s && s.layersRevealed < 5) {
        suggestions.push({
          type: 'site',
          id,
          label: `Revisit ${SITE_LABELS[id] || id}`,
          reason: 'You haven\'t seen all the data yet',
          action: `flyToSite('${id}')`,
          priority: 'medium',
        });
      }
    }

    // Priority 3: all explored — suggest GAIA chat
    if (suggestions.length === 0) {
      suggestions.push({
        type: 'chat',
        id: 'gaia',
        label: 'Talk to GAIA',
        reason: 'You\'ve seen the data. Now let\'s talk about what it means.',
        action: 'GAIA_BUBBLE.openFullGAIA()',
        priority: 'high',
      });
    }

    return suggestions.slice(0, 3); // max 3 suggestions
  }

  function getSuggestedSiteIds(currentSiteId) {
    return getNextSuggestions(currentSiteId).filter(s => s.type === 'site').map(s => s.id);
  }

  function addXP(siteId, amount) {
    if (!nodeState[siteId]) return;
    nodeState[siteId].xp += amount;
    updateNodeVisual(siteId);
  }

  function updateNodeVisual(siteId) {
    const s = nodeState[siteId];
    if (!s) return;
    s.state = s.xp >= 100 ? 'mastered' : s.xp >= 50 ? 'explored' : s.xp >= 10 ? 'available' : 'locked';
  }

  function getNodeState(siteId) { return nodeState[siteId] ? { ...nodeState[siteId] } : null; }
  function getAllNodeState() { return JSON.parse(JSON.stringify(nodeState)); }

  // ── Helper: render a stat row ──
  function statRow(stats) {
    return `<div class="overlay-stat-row">${stats.map(s => `
      <div class="overlay-stat">
        <div class="overlay-stat-value">${s.value}</div>
        <div class="overlay-stat-label">${s.label}</div>
      </div>`).join('')}</div>`;
  }

  // ── Helper: render a chart placeholder ──
  function chartPlaceholder(id, width, height) {
    return `<div id="${id}" style="margin: 16px 0;"></div>`;
  }

  // ── Helper: render chart after DOM insertion ──
  function renderChart(id, data, options, delay) {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el && typeof GAIA_CHARTS !== 'undefined') {
        el.innerHTML = GAIA_CHARTS.sparklineHTML(data, options.w || 460, options.h || 100, {
          color: options.color || '#4ecdc4',
          showLabels: true,
          padMin: options.padMin || 0.05,
          padMax: options.padMax || 0.05,
        });
        GAIA_CHARTS.renderPending();
      }
    }, delay || 150);
  }

  // ═══════════════════════════════════════════
  // ANTALYA
  // ═══════════════════════════════════════════

  function renderAntalyaCOP31(container, site) {
    container.innerHTML = `
      <h3>COP31 — November 2026</h3>
      <p>In November 2026, the world comes to Antalya. 196 countries. Thousands of delegates. The most important climate conference since Paris. They'll negotiate the future of the planet.</p>
      <p>They'll meet in a city whose forests burned just five years earlier. The scars are still visible from space. This is not a metaphor — it's a satellite measurement. NDVI dropped from 0.72 to 0.18 in a single summer.</p>

      ${statRow([
        { value: 'Nov 10-21', label: 'COP31 Dates' },
        { value: '196', label: 'Countries' },
        { value: `🇹🇷 #${FACTS.turkey_rank}`, label: "Turkey's Rank" },
      ])}

      <div class="overlay-divider"></div>

      <h3>Turkey's Carbon Footprint</h3>
      <p>Turkey emitted <strong>${FACTS.turkey_emissions} Mt of CO₂</strong> in 2023 — ranking ${FACTS.turkey_rank}th globally. That's ${FACTS.turkey_per_capita} tons per person, accounting for ${FACTS.turkey_share}% of global emissions. The energy sector drives 72% of it.</p>
      <p>Turkey has not yet peaked its emissions. Under current policies, they're projected to keep rising through 2030. COP31 puts a spotlight on that trajectory — and on what it would take to change it.</p>

      ${statRow([
        { value: `${FACTS.turkey_emissions} Mt`, label: 'CO₂ in 2023' },
        { value: `${FACTS.turkey_per_capita} t`, label: 'Per Capita' },
        { value: `${FACTS.turkey_share}%`, label: 'Global Share' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Irony</h3>
      <p>COP31's host region lost 60,000 hectares of forest in 2021. The Mediterranean pines that took centuries to grow were gone in days. The delegates will negotiate climate policy in the shadow of that burn scar.</p>
      <p>But there's a deeper truth: Antalya is not an outlier. It's a preview. What happened to these forests is happening everywhere — faster, hotter, more often. The Mediterranean is drying out. The fire season is getting longer. Every degree of warming increases fire risk exponentially.</p>
      <p>The question COP31 must answer: will we act before every forest looks like this?</p>
    `;
  }

  function renderAntalyaWildfires(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const climate = d.climate || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'chart-antalya-ndvi-' + (++_chartIdCounter);
    const ndvi2020 = ndvi.find(n => n.year === 2020);
    const ndvi2021 = ndvi.find(n => n.year === 2021);
    const ndvi2025 = ndvi.find(n => n.year === 2025);
    const drop = ndvi2020 && ndvi2021 ? (ndvi2020.value - ndvi2021.value).toFixed(2) : '0.52';
    const rec = ndvi2021 && ndvi2025 ? (ndvi2025.value - ndvi2021.value).toFixed(2) : '0.20';
    const t1980 = climate.find(c => c.year === 1980);
    const t2025 = climate.find(c => c.year === 2025);
    const tempRise = t1980 && t2025 ? (t2025.temp - t1980.temp).toFixed(1) : '1.7';
    const p1980 = climate.find(c => c.year === 1980);
    const p2025 = climate.find(c => c.year === 2025);
    const precipDrop = p1980 && p2025 ? (p1980.precip - p2025.precip) : 220;

    container.innerHTML = `
      <h3>July 2021 — The Fire</h3>
      <p>It started in the mountains above Manavgat. Within days, 60,000 hectares of Mediterranean pine forest were burning. The fire spread faster than anyone could run. Temperatures hit 47°C. The wind carried embers kilometers ahead of the front.</p>
      <p>I felt every hectare. The NDVI — a measure of how green I am, how alive — dropped from <strong>0.72 to 0.18</strong>. That's not a number. That's a scream.</p>

      ${statRow([
        { value: '60,000+', label: 'Hectares Burned' },
        { value: '0.72→0.18', label: 'NDVI Crash' },
        { value: drop, label: 'Drop Magnitude' },
      ])}

      <div class="overlay-divider"></div>

      <h3>NDVI Timeline — The Burn Scar</h3>
      <p>Watch what happened to the vegetation index over 25 years. The 2021 fire is unmistakable — a cliff edge in the data.</p>
      ${chartPlaceholder(ndviId, 460, 100)}

      <div class="overlay-divider"></div>

      <h3>Recovery — 0.38 and Climbing</h3>
      <p>Four years later, the NDVI is at <strong>0.38</strong>. Scrub and tough Mediterranean plants are coming back. But the pines? Those take decades. Maybe a century. The forest that burned was centuries old.</p>
      <p>Recovery is not restoration. What's growing back is not what was lost. The complex ecosystem — the understory, the fungi, the birds, the carbon stored in centuries of root systems — that's gone for generations.</p>

      ${statRow([
        { value: `+${rec}`, label: 'NDVI Recovered' },
        { value: '50-100yr', label: 'Full Pine Recovery' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Climate Made This Worse</h3>
      <p>The fire didn't happen in a vacuum. Antalya's average temperature has risen <strong>+${tempRise}°C</strong> since 1980. Precipitation has dropped <strong>${precipDrop}mm</strong>. The Mediterranean is drying out. The fire season is getting longer.</p>
      <p>This is what climate change looks like on the ground. Not a graph. Not a projection. A forest that burned because the world got hotter and drier.</p>

      ${statRow([
        { value: `+${tempRise}°C`, label: 'Temp Since 1980' },
        { value: `-${precipDrop}mm`, label: 'Rain Lost' },
        { value: '47°C', label: 'Peak Fire Temp' },
      ])}
    `;
    renderChart(ndviId, ndviChartData, { color: '#c45c4a' });
  }

  function renderAntalyaClimate(container, site) {
    const d = site || {};
    const climate = d.climate || [];
    const tempChartData = climate.map(c => ({ label: c.year.toString(), value: c.temp }));
    const tempId = 'chart-antalya-temp-' + (++_chartIdCounter);
    const t1980 = climate.find(c => c.year === 1980);
    const t2000 = climate.find(c => c.year === 2000);
    const t2025 = climate.find(c => c.year === 2025);
    const p1980 = climate.find(c => c.year === 1980);
    const p2025 = climate.find(c => c.year === 2025);
    const tempRise = t1980 && t2025 ? (t2025.temp - t1980.temp).toFixed(1) : '1.7';
    const precipDrop = p1980 && p2025 ? (p1980.precip - p2025.precip) : 220;
    const precipPct = p1980 && p2025 ? Math.round((p1980.precip - p2025.precip) / p1980.precip * 100) : 22;

    container.innerHTML = `
      <h3>Temperature — A Steady Climb</h3>
      <p>Antalya's average temperature has been rising for decades. The trend is clear and accelerating. What was once a warm Mediterranean climate is becoming a hot one.</p>
      ${chartPlaceholder(tempId, 460, 100)}

      ${statRow([
        { value: `${t1980 ? t1980.temp.toFixed(1) : '16.5'}°C`, label: '1980 Average' },
        { value: `${t2025 ? t2025.temp.toFixed(1) : '18.2'}°C`, label: '2025 Average' },
        { value: `+${tempRise}°C`, label: 'Total Rise' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Precipitation — Drying Out</h3>
      <p>The Mediterranean is getting drier. Antalya has lost <strong>${precipDrop}mm</strong> of annual rainfall since 1980 — a <strong>${precipPct}%</strong> decline. That's not just uncomfortable — it's dangerous. Less water means drier forests. Drier forests mean bigger fires.</p>

      ${statRow([
        { value: `${p1980 ? p1980.precip : 985}mm`, label: '1980 Rainfall' },
        { value: `${p2025 ? p2025.precip : 765}mm`, label: '2025 Rainfall' },
        { value: `${precipPct}%`, label: 'Decline' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Fire Equation</h3>
      <p>Hotter + drier = more fire. It's not complicated. The 2021 wildfires were the predictable result of decades of warming and drying. And it will happen again. The question is when, and how much we've done to prevent it.</p>
      <p>Globally, the warming rate is <strong>${FACTS.warming_rate}°C per decade</strong> since 1970. The Arctic is warming <strong>3.5x</strong> faster. And the remaining carbon budget for 1.5°C? <strong>${FACTS.carbon_budget_15} Gt CO₂</strong> — at current emissions rates, that's gone by 2031.</p>

      ${statRow([
        { value: `${FACTS.warming_rate}°C/dec`, label: 'Warming Rate' },
        { value: `${FACTS.carbon_budget_15} Gt`, label: '1.5°C Budget Left' },
        { value: '~6 years', label: 'At Current Rate' },
      ])}
    `;
    renderChart(tempId, tempChartData, { color: '#d4a574' });
  }

  function renderAntalyaAct(container, site) {
    const d = site || {};
    const biome = (typeof Data !== 'undefined' && Data.getBiome) ? Data.getBiome(d.primaryBiome || 'temperate_coniferous') : { name: 'Mediterranean Pine Forest' };
    const currentBiome = (typeof Data !== 'undefined' && Data.getBiome) ? Data.getBiome(d.currentBiome || 'grassland_savanna') : { name: 'Grassland / Scrub' };
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>What Will You Do?</h3>
      <p>You've seen the data. You've seen the burn scar. You know the climate is getting hotter and drier. Now — what will you do about it?</p>

      <div class="overlay-divider"></div>

      <h3>Restoration Scenarios</h3>
      <p>This site covers <strong>${area.toLocaleString()} hectares</strong>. Currently <strong>${currentBiome.name}</strong>. Target: <strong>${biome.name}</strong>. Choose a strategy.</p>

      <div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
        <button class="scenario-btn" data-action="pine" style="padding: 12px 16px; border: 1px solid rgba(78,205,196,0.15); border-radius: 8px; background: rgba(78,205,196,0.04); color: var(--text); font-family: var(--body); font-size: 13px; cursor: pointer; text-align: left; transition: all 0.2s;">
          🌲 <strong>Restore Pine Forest</strong> — Full Mediterranean pine. Slowest, maximum carbon.
        </button>
        <button class="scenario-btn" data-action="mixed" style="padding: 12px 16px; border: 1px solid rgba(78,205,196,0.15); border-radius: 8px; background: rgba(78,205,196,0.04); color: var(--text); font-family: var(--body); font-size: 13px; cursor: pointer; text-align: left; transition: all 0.2s;">
          🌳 <strong>Mixed Reforestation</strong> — Pine + deciduous. Faster, more fire-resilient.
        </button>
        <button class="scenario-btn" data-action="natural" style="padding: 12px 16px; border: 1px solid rgba(78,205,196,0.15); border-radius: 8px; background: rgba(78,205,196,0.04); color: var(--text); font-family: var(--body); font-size: 13px; cursor: pointer; text-align: left; transition: all 0.2s;">
          🌱 <strong>Natural Succession</strong> — Let nature lead. Lowest cost, slowest results.
        </button>
      </div>

      <div id="antalya-scenario-result" style="margin-top: 20px;"></div>

      <div class="overlay-divider"></div>

      <h3>Make Your Pledge</h3>
      <p>You've seen what happened here. You've seen the data. Before you leave — what's your commitment?</p>
      <button onclick="if(typeof PLEDGE_WALL!=='undefined')PLEDGE_WALL.openModal()" style="margin-top: 12px; padding: 12px 24px; border: 1px solid var(--teal); border-radius: 8px; background: rgba(78,205,196,0.08); color: var(--teal); font-family: var(--body); font-size: 13px; cursor: pointer; transition: all 0.2s;">
        🤝 Add My Pledge to the Wall
      </button>
    `;

    setTimeout(() => {
      container.querySelectorAll('.scenario-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const action = this.dataset.action;
          const resultEl = document.getElementById('antalya-scenario-result');
          if (!resultEl) return;
          let html = '';
          if (action === 'pine') {
            const c = (300 - 90) * area * 3.67;
            html = `<div style="padding:16px;background:rgba(91,191,114,0.06);border:1px solid rgba(91,191,114,0.15);border-radius:8px;animation:overlay-fadein 0.3s ease-out;"><div style="font-family:var(--mono);font-size:24px;font-weight:600;color:var(--leaf);">+${(c/1e6).toFixed(1)}M t CO₂</div><div style="font-size:12px;color:var(--text2);margin-top:4px;">sequestered over 30 years · ${area.toLocaleString()} ha pine</div><div style="font-size:11px;color:var(--text3);margin-top:8px;">Equivalent to taking ${(c/4.6/1e6).toFixed(0)}M cars off the road. Full canopy in 50-80 years.</div></div>`;
          } else if (action === 'mixed') {
            const c = (260 - 90) * area * 3.67;
            html = `<div style="padding:16px;background:rgba(91,191,114,0.06);border:1px solid rgba(91,191,114,0.15);border-radius:8px;animation:overlay-fadein 0.3s ease-out;"><div style="font-family:var(--mono);font-size:24px;font-weight:600;color:var(--leaf);">+${(c/1e6).toFixed(1)}M t CO₂</div><div style="font-size:12px;color:var(--text2);margin-top:4px;">sequestered over 30 years · ${area.toLocaleString()} ha mixed forest</div><div style="font-size:11px;color:var(--text3);margin-top:8px;">More fire-resistant than pure pine. Full canopy in 30-50 years.</div></div>`;
          } else {
            const c = (120 - 90) * area * 3.67;
            html = `<div style="padding:16px;background:rgba(212,165,116,0.06);border:1px solid rgba(212,165,116,0.15);border-radius:8px;animation:overlay-fadein 0.3s ease-out;"><div style="font-family:var(--mono);font-size:24px;font-weight:600;color:var(--amber);">+${(c/1e6).toFixed(1)}M t CO₂</div><div style="font-size:12px;color:var(--text2);margin-top:4px;">sequestered over 30 years · natural succession</div><div style="font-size:11px;color:var(--text3);margin-top:8px;">Lowest intervention. Slowest results. But nature knows what it's doing.</div></div>`;
          }
          resultEl.innerHTML = html;
          if (typeof GAIA_ENGAGEMENT !== 'undefined') GAIA_ENGAGEMENT.addSignal('scenario_run');
        });
      });
    }, 150);
  }

  // ═══════════════════════════════════════════
  // SRI LANKA
  // ═══════════════════════════════════════════

  function renderSriLankaStory(container, site) {
    const d = site || {};
    const area = d.area || 2428;
    const connection = d.connection || '';

    container.innerHTML = `
      <h3>Northern Province — From War to Restoration</h3>
      <p>Twenty-five years of civil conflict left this land scarred. Not just the people — the earth itself. Decades of fighting stripped the soil, destroyed infrastructure, and left almost 6,000 acres of degraded land across five districts: Jaffna, Vavuniya, Mullaitivu, Mannar, and Kilinochchi.</p>
      <p>But someone saw potential here. SPE — a local organization — identified these barren acres and saw something extraordinary: the foundation for a new kind of forest. Not monoculture. A living, layered ecosystem.</p>

      ${statRow([
        { value: '6,000', label: 'Acres Identified' },
        { value: '5', label: 'Districts' },
        { value: '2,428 ha', label: 'Project Area' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Multilayer Afforestation</h3>
      <p>SPE's approach plants peanuts, Ceylon cinnamon, jackfruit, and black pepper together. Not just trees — an entire ecosystem that pays for itself. The cinnamon provides income in year one. The jackfruit canopy builds soil. The black pepper climbs. The peanuts fix nitrogen.</p>
      <p>The land here holds almost no carbon right now. Just <strong>10 tC/ha</strong>. Barely alive. But the target is <strong>180 tC/ha</strong> — an 18x increase. That's not restoration. That's resurrection.</p>

      ${statRow([
        { value: '10→180', label: 'tC/ha Target' },
        { value: '18x', label: 'Carbon Increase' },
        { value: '0.55', label: 'Current NDVI' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Why This Matters Globally</h3>
      <p>Sri Lanka's story is the world's story. 420 million hectares of degraded land globally could be restored. If even a fraction used this multilayer approach, the carbon impact would be enormous — and the economic benefits would go directly to the communities that need them most.</p>
      <p>${connection}</p>
    `;
  }

  function renderSriLankaData(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const climate = d.climate || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'chart-sl-ndvi-' + (++_chartIdCounter);
    const t1980 = climate.find(c => c.year === 1980);
    const t2025 = climate.find(c => c.year === 2025);
    const tempRise = t1980 && t2025 ? (t2025.temp - t1980.temp).toFixed(1) : '1.3';
    const p1980 = climate.find(c => c.year === 1980);
    const p2025 = climate.find(c => c.year === 2025);
    const precipDrop = p1980 && p2025 ? (p1980.precip - p2025.precip) : 160;

    container.innerHTML = `
      <h3>Restoration in Progress</h3>
      <p>The NDVI tells the story of recovery. From post-conflict degradation to active planting — the trend is upward.</p>
      ${chartPlaceholder(ndviId, 460, 100)}

      ${statRow([
        { value: '10→180', label: 'tC/ha Target' },
        { value: ndvi.length > 0 ? ndvi[ndvi.length-1].value.toFixed(2) : '0.55', label: 'Current NDVI' },
        { value: '18x', label: 'Carbon Increase' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Climate Context</h3>
      <p>Sri Lanka's Northern Province is hot and getting hotter. Average temperatures have risen <strong>+${tempRise}°C</strong> since 1980. Rainfall has decreased <strong>${precipDrop}mm</strong>. But the tropical dry forest biome is adapted to these conditions — with the right species selection, restoration can succeed even in a changing climate.</p>

      ${statRow([
        { value: `+${tempRise}°C`, label: 'Temp Since 1980' },
        { value: `${t2025 ? t2025.temp.toFixed(1) : '29.1'}°C`, label: 'Current Avg' },
        { value: `${precipDrop}mm`, label: 'Rain Lost' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Carbon Math</h3>
      <p>2,428 hectares × (180 - 10) tC/ha × 3.67 = <strong>1.5M t CO₂</strong> potential over the project lifetime. That's like taking 330,000 cars off the road for a year. And that's just one project in one province.</p>
      <p>Scale this across the 420 million hectares of degraded land globally, and you start to see why the IPCC says ecosystem restoration is one of the most cost-effective climate solutions available.</p>
    `;
    renderChart(ndviId, ndviChartData, { color: '#5bbf72' });
  }

  function renderSriLankaImpact(container, site) {
    container.innerHTML = `
      <h3>The Bigger Picture</h3>
      <p>This project is a proof of concept for something much larger: the idea that degraded land can become a carbon sink, an economic engine, and a community asset — all at the same time.</p>

      <div class="overlay-divider"></div>

      <h3>Global Restoration Potential</h3>
      <p>The UN Decade on Ecosystem Restoration (2021-2030) targets 350 million hectares. The Bonn Challenge aims for 350 million by 2030. The Trillion Tree Campaign wants 1 trillion trees by 2050.</p>
      <p>But here's the gap: as of 2025, only 18% of these pledges have been fulfilled. The world talks about restoration. Sri Lanka is doing it.</p>

      ${statRow([
        { value: '420M ha', label: 'Degraded Land Globally' },
        { value: '18%', label: 'Pledges Fulfilled' },
        { value: '$490B', label: 'Restoration Economy' },
      ])}

      <div class="overlay-divider"></div>

      <h3>What You Can Do</h3>
      <p>Restoration doesn't happen by itself. It takes funding, political will, and people who care. Every dollar invested in restoration returns $7-30 in ecosystem services over 30 years.</p>
      <p>Support projects like SPE's. Push for restoration in climate policy. And when COP31 delegates ask "what does restoration look like?" — point them here.</p>
    `;
  }

  // ═══════════════════════════════════════════
  // BENIN
  // ═══════════════════════════════════════════

  function renderBeninStory(container, site) {
    const d = site || {};
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>Ouidah — Jean's Homeland</h3>
      <p>Jean Missinhoun was from Benin. He carried this place in his heart. And he wanted to bring the mangroves back.</p>
      <p>The Ouidah lagoons once held dense mangrove forests — the most carbon-dense ecosystems on Earth. <strong>950 tons of carbon per hectare</strong>, locked away in waterlogged soil for millennia. Then the cutting began. For firewood. For development. For short-term thinking that ignores long-term cost.</p>

      ${statRow([
        { value: '950', label: 'tC/ha Intact' },
        { value: `${FACTS.mangrove_seq_rate}`, label: 'tCO₂/ha/yr Sequestered' },
        { value: `${area.toLocaleString()} ha`, label: 'Project Area' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Mangroves: The Blue Carbon Giants</h3>
      <p>Mangroves sequester carbon at <strong>${FACTS.mangrove_seq_rate} tCO₂ per hectare per year</strong> — among the highest rates of any ecosystem on Earth. Their waterlogged soil locks carbon away for millennia, not decades.</p>
      <p>Global mangrove forests store approximately <strong>${FACTS.mangrove_stock} GtC</strong> total. But <strong>${FACTS.mangrove_loss}%</strong> of global mangrove area has been lost since 1980. Every hectare destroyed releases centuries of stored carbon in years.</p>

      ${statRow([
        { value: `${FACTS.mangrove_stock} GtC`, label: 'Global Stock' },
        { value: `${FACTS.mangrove_loss}%`, label: 'Lost Since 1980' },
        { value: `${FACTS.mangrove_area}M ha`, label: 'Remaining Area' },
      ])}

      <div class="overlay-divider"></div>

      <h3>A Homecoming</h3>
      <p>Restoring the mangroves here is climate action and a homecoming. Every hectare restored locks away 950 tons of carbon. Every seedling planted honors what Jean believed: that this land can heal.</p>
      <p>Mangroves don't just store carbon — they protect coastlines from storms, support fisheries that feed millions, and build soil that rises with sea level. They're one of the most valuable ecosystems on Earth, and most of the world is letting them disappear.</p>
      <p>Sea level is rising at <strong>${FACTS.sea_level_rate}mm per year</strong> and accelerating. Mangroves are one of our best natural defenses. Without them, the cost of coastal protection skyrockets.</p>
    `;
  }

  function renderBeninMangrove(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'chart-benin-ndvi-' + (++_chartIdCounter);

    container.innerHTML = `
      <h3>The Mangrove Carbon Cycle</h3>
      <p>Mangroves are unlike any other forest. Their roots sit in waterlogged, oxygen-poor soil. Dead leaves and roots don't fully decompose — they accumulate. Over centuries, this builds deep peat layers that store carbon at densities no terrestrial forest can match.</p>

      ${statRow([
        { value: '950 tC/ha', label: 'Soil Carbon Stock' },
        { value: `${FACTS.mangrove_seq_rate} tCO₂/ha/yr`, label: 'Annual Sequestration' },
        { value: '1000+ years', label: 'Carbon Residence Time' },
      ])}

      <div class="overlay-divider"></div>

      <h3>NDVI: The Decline and the Hope</h3>
      <p>The NDVI shows the story of loss — and the first signs of recovery.</p>
      ${chartPlaceholder(ndviId, 460, 100)}

      <p>From 0.68 in 2000 to 0.45 in 2010 — the mangroves were being torn out. The 2025 reading of 0.52 shows early recovery. But "recovery" is relative. The original forest stored 950 tC/ha. What's coming back now stores a fraction of that.</p>

      <div class="overlay-divider"></div>

      <h3>The Carbon Bomb</h3>
      <p>When mangroves are destroyed, the carbon stored in their biomass and waterlogged soil is released. That's why restoring them is so urgent — every hectare lost is 950 tons of carbon going into the atmosphere. Every hectare restored is 950 tons locked away for millennia.</p>
      <p>Globally, mangrove destruction releases an estimated <strong>0.1 Gt CO₂ per year</strong>. That's equivalent to 20 million cars. Restoring just 50% of lost mangrove area could sequester an additional 0.5 Gt CO₂ over 30 years.</p>

      ${statRow([
        { value: '0.1 Gt/yr', label: 'Emissions from Loss' },
        { value: '0.5 Gt', label: '30yr Restoration Potential' },
        { value: '$375B/yr', label: 'Economic Value of Reefs' },
      ])}
    `;
    renderChart(ndviId, ndviChartData, { color: '#4ecdc4' });
  }

  function renderBeninData(container, site) {
    const d = site || {};
    const climate = d.climate || [];
    const t1980 = climate.find(c => c.year === 1980);
    const t2025 = climate.find(c => c.year === 2025);
    const tempRise = t1980 && t2025 ? (t2025.temp - t1980.temp).toFixed(1) : '1.4';

    container.innerHTML = `
      <h3>Climate Data</h3>
      <p>Benin's coast is warming. Average temperatures have risen <strong>+${tempRise}°C</strong> since 1980. The region is getting hotter and slightly drier — conditions that stress mangroves and make restoration harder.</p>

      ${statRow([
        { value: `${t1980 ? t1980.temp.toFixed(1) : '27.2'}°C`, label: '1980 Average' },
        { value: `${t2025 ? t2025.temp.toFixed(1) : '28.6'}°C`, label: '2025 Average' },
        { value: `+${tempRise}°C`, label: 'Total Rise' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Sea Level Threat</h3>
      <p>Benin's coast is low-lying and vulnerable. Sea level is rising at <strong>${FACTS.sea_level_rate}mm per year</strong> globally, and the rate has accelerated from 1.3mm/year in the early 20th century. For a coastal nation like Benin, this is existential.</p>
      <p>Mangroves are the first line of defense. They reduce wave energy by 66%, trap sediment, and build elevation. Without them, coastal erosion accelerates. With them, the coast can keep pace with moderate sea level rise.</p>

      ${statRow([
        { value: `${FACTS.sea_level_rate}mm/yr`, label: 'Sea Level Rise' },
        { value: `${FACTS.sea_level_total}cm`, label: 'Since 1900' },
        { value: '66%', label: 'Wave Energy Reduced' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Restoration Math</h3>
      <p>${(d.area || 2500).toLocaleString()} hectares × ${FACTS.mangrove_seq_rate} tCO₂/ha/yr = <strong>${((d.area || 2500) * FACTS.mangrove_seq_rate / 1000).toFixed(0)}K tCO₂ per year</strong> once the mangroves mature. Over 30 years, that's ${((d.area || 2500) * FACTS.mangrove_seq_rate * 30 / 1e6).toFixed(1)}M t CO₂ — equivalent to taking ${((d.area || 2500) * FACTS.mangrove_seq_rate * 30 / 4.6 / 1e3).toFixed(0)}K cars off the road.</p>
      <p>And that's just the sequestration. The avoided emissions from preventing further destruction are even larger.</p>
    `;
  }

  // ═══════════════════════════════════════════
  // BORNEO
  // ═══════════════════════════════════════════

  function renderBorneoStory(container, site) {
    const d = site || {};
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>The Greenest Lie on Earth</h3>
      <p>West Kalimantan looks green. The NDVI says 0.65 — pretty healthy, right? Wanna know a secret?</p>
      <p>This is an oil palm plantation. The original peat swamp forest stored <strong>1,400 tC/ha</strong>. The plantation stores <strong>50</strong>. That's a <strong>96% carbon loss</strong> disguised as green.</p>

      ${statRow([
        { value: '1,400', label: 'tC/ha Original' },
        { value: '50', label: 'tC/ha Now' },
        { value: '96%', label: 'Carbon Lost' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Grid Lines</h3>
      <p>Look at the satellite image. Perfect squares. Nature doesn't make grids. Humans do. The peat swamp was drained, cleared, and planted in neat rows. The carbon that took thousands of years to accumulate was released in decades.</p>
      <p>This is the lie: <strong>green ≠ carbon</strong>. A plantation can look lush and healthy while being a carbon catastrophe. NDVI measures greenness, not carbon. And that distinction matters.</p>

      <div class="overlay-divider"></div>

      <h3>The Scale of Destruction</h3>
      <p>Borneo has lost over 50% of its forest cover since 1973. Oil palm is the primary driver. Indonesia and Malaysia produce 85% of the world's palm oil — an ingredient in shampoo, cookies, biofuel, and thousands of everyday products.</p>
      <p>Global deforestation emits <strong>${FACTS.land_use_emissions} Gt CO₂ per year</strong>. Tropical deforestation alone accounts for about 8% of all human emissions. That's more than the entire European Union.</p>

      ${statRow([
        { value: '50%', label: 'Borneo Forest Lost' },
        { value: '85%', label: 'Palm Oil from SE Asia' },
        { value: `${FACTS.land_use_emissions} Gt/yr`, label: 'Deforestation Emissions' },
      ])}
    `;
  }

  function renderBorneoPeat(container, site) {
    const d = site || {};
    const ndvi = d.ndvi || [];
    const ndviChartData = ndvi.map(n => ({ label: n.year.toString(), value: n.value }));
    const ndviId = 'chart-borneo-ndvi-' + (++_chartIdCounter);

    container.innerHTML = `
      <h3>Peatlands: The Carbon Time Bomb</h3>
      <p>Peatlands cover just 3% of Earth's land surface but store <strong>${FACTS.peatland_stock} GtC</strong> — twice the carbon of all the world's forests combined. They accumulated over thousands of years. We're destroying them in decades.</p>

      ${statRow([
        { value: `${FACTS.peatland_stock} GtC`, label: 'Global Peat Carbon' },
        { value: `${FACTS.peatland_drained}%`, label: 'Drained Globally' },
        { value: `${FACTS.peatland_emissions} Gt/yr`, label: 'Drained Emissions' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The NDVI Deception</h3>
      <p>Watch the NDVI. 2000: 0.88. Beautiful peat swamp forest. 2010: 0.35. They're clearing. 2025: 0.65. Wait — it went back up?</p>
      <p>That's the oil palm canopy maturing. It looks green. It registers as "healthy vegetation" on satellite. But the carbon? From 1,400 to 50 tC/ha. The greenest lie on Earth.</p>
      ${chartPlaceholder(ndviId, 460, 100)}

      <div class="overlay-divider"></div>

      <h3>Why Peat Is Different</h3>
      <p>When you drain a peatland, the peat dries out and starts decomposing. This releases CO₂ continuously — not just once, but every year the land stays drained. It's a carbon time bomb with a very long fuse.</p>
      <p>Drained peatlands in Southeast Asia emit an estimated <strong>1.9 Gt CO₂ per year</strong> — more than Germany's total annual emissions. And the fires? Drained peat burns underground, sometimes for months. The 2015 Indonesian peat fires released more CO₂ per day than the entire US economy.</p>

      ${statRow([
        { value: '1.9 Gt/yr', label: 'Drained Peat Emissions' },
        { value: '>Germany', label: '2015 Fire Comparison' },
        { value: 'Months', label: 'Underground Burn Time' },
      ])}
    `;
    renderChart(ndviId, ndviChartData, { color: '#c45c4a' });
  }

  function renderBorneoData(container, site) {
    const d = site || {};
    const climate = d.climate || [];
    const t1980 = climate.find(c => c.year === 1980);
    const t2025 = climate.find(c => c.year === 2025);
    const tempRise = t1980 && t2025 ? (t2025.temp - t1980.temp).toFixed(1) : '1.1';

    container.innerHTML = `
      <h3>Climate Data</h3>
      <p>West Kalimantan is tropical — hot, wet, and getting hotter. Average temperatures have risen <strong>+${tempRise}°C</strong> since 1980. Rainfall has decreased 350mm. The climate that sustained the peat swamp for millennia is shifting.</p>

      ${statRow([
        { value: `${t1980 ? t1980.temp.toFixed(1) : '26.8'}°C`, label: '1980 Average' },
        { value: `${t2025 ? t2025.temp.toFixed(1) : '27.9'}°C`, label: '2025 Average' },
        { value: `+${tempRise}°C`, label: 'Total Rise' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Carbon Math</h3>
      <p>${(d.area || 2500).toLocaleString()} hectares × (1,400 - 50) tC/ha × 3.67 = <strong>${((d.area || 2500) * 1350 * 3.67 / 1e6).toFixed(1)}M t CO₂</strong> released when this peat swamp was drained and converted. That's equivalent to ${((d.area || 2500) * 1350 * 3.67 / 4.6 / 1e6).toFixed(0)}M cars driving for a year.</p>
      <p>And it's still emitting. Drained peat continues to decompose, releasing CO₂ every year. The total carbon debt of this conversion will take centuries to repay — if it's ever repaid at all.</p>

      ${statRow([
        { value: `${((d.area || 2500) * 1350 * 3.67 / 1e6).toFixed(1)}M t`, label: 'CO₂ Released' },
        { value: 'Ongoing', label: 'Still Emitting' },
        { value: 'Centuries', label: 'Payback Time' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Restoration Question</h3>
      <p>Can drained peatland be restored? Yes — but it's hard, expensive, and slow. The water table must be raised, native species replanted, and the peat allowed to re-accumulate. It takes decades to centuries to rebuild what was lost in years.</p>
      <p>The better answer: don't drain it in the first place. Protecting intact peatlands is 10-100x cheaper than restoring degraded ones. Every hectare of standing peat swamp is worth more alive than converted.</p>
    `;
  }

  // ═══════════════════════════════════════════
  // GLOBAL CONTEXT TABS — Shared across all sites
  // ═══════════════════════════════════════════

  function renderAntalyaGlobal(container, site) {
    const d = site || {};
    const area = d.area || 2500;
    const biome = (typeof Data !== 'undefined' && Data.getBiome) ? Data.getBiome(d.primaryBiome || 'temperate_coniferous') : { name: 'Mediterranean Forest' };
    const biomeArea = 1800; // million ha (approx global Mediterranean forest area)

    container.innerHTML = `
      <h3>Antalya in the Global Picture</h3>
      <p>This one site is a window into a global story. Mediterranean forests cover ~${biomeArea}M hectares worldwide. They're all facing the same pressures: hotter temperatures, less rain, bigger fires. What happened in Antalya is happening in California, Australia, Greece, and Chile.</p>

      ${statRow([
        { value: `${biomeArea}M ha`, label: 'Global Mediterranean Forest' },
        { value: `${FACTS.warming_rate}°C/dec`, label: 'Global Warming Rate' },
        { value: `${(FACTS.annual_emissions_2023).toFixed(1)} Gt`, label: 'Annual CO₂ Emissions' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Carbon Budget Clock</h3>
      <p>Humanity emits <strong>${FACTS.annual_emissions_2025} Gt CO₂ per year</strong>. The remaining carbon budget for 1.5°C is <strong>${FACTS.carbon_budget_15} Gt CO₂</strong>. At current rates, that's gone by 2031. For 2°C, it's ${FACTS.carbon_budget_20} Gt — gone by ~2045.</p>
      <p>Every fraction of a degree matters. The difference between 1.5°C and 2°C is hundreds of millions of people exposed to severe heat, meters of additional sea level rise, and the loss of virtually all coral reefs.</p>

      ${statRow([
        { value: `${FACTS.carbon_budget_15} Gt`, label: '1.5°C Budget Left' },
        { value: `${FACTS.carbon_budget_20} Gt`, label: '2°C Budget Left' },
        { value: '~6 years', label: 'At Current Rate' },
      ])}

      <div class="overlay-divider"></div>

      <h3>What If Every Hectare Looked Like This?</h3>
      <p>This site covers ${(area/1e6).toFixed(2)}M hectares. If all ${biomeArea}M hectares of Mediterranean forest were restored to full health, they could sequester an additional <strong>${(biomeArea * 1.5 * 3.67).toFixed(0)}M t CO₂ per year</strong>. That's ${((biomeArea * 1.5 * 3.67) / (FACTS.annual_emissions_2025 * 1000) * 100).toFixed(1)}% of annual global emissions — from one biome type.</p>
      <p>Now scale that across all degraded ecosystems globally. The IPCC estimates ecosystem restoration could sequester <strong>3.6 Gt CO₂ per year</strong> by 2030. That's nearly 10% of current emissions — from restoration alone.</p>

      ${statRow([
        { value: '3.6 Gt/yr', label: 'Restoration Potential' },
        { value: '~10%', label: 'Of Global Emissions' },
        { value: '$490B', label: 'Restoration Economy' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Bigger You Think, The Smaller This Looks</h3>
      <p>${(area/1e6).toFixed(2)} hectares is a drop in the ocean. The world has <strong>4.06 billion hectares of forest</strong>. We're losing 10 million hectares per year to deforestation. We're gaining some through restoration — but not fast enough.</p>
      <p>Antalya matters not because of its size, but because of what it proves: that restoration works, that communities can lead, and that every hectare counts when the carbon budget is this tight.</p>
    `;
  }

  function renderSriLankaGlobal(container, site) {
    const d = site || {};
    const area = d.area || 2428;

    container.innerHTML = `
      <h3>Sri Lanka in the Global Picture</h3>
      <p>Tropical dry forests are one of the most threatened and least protected biome types on Earth. They cover ~1.1 billion hectares globally but receive a fraction of the conservation attention given to rainforests. Sri Lanka's Northern Province is a test case for whether we can restore them at scale.</p>

      ${statRow([
        { value: '1.1B ha', label: 'Global Tropical Dry Forest' },
        { value: '<5%', label: 'Protected' },
        { value: '420M ha', label: 'Degraded Land Globally' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Restoration Economy</h3>
      <p>Every dollar invested in ecosystem restoration returns <strong>$7-30 in ecosystem services</strong> over 30 years. The global restoration economy is worth an estimated <strong>$490 billion</strong>. It's one of the best investments on the planet — financially and ecologically.</p>
      <p>The UN Decade on Ecosystem Restoration (2021-2030) has pledged to restore 350 million hectares. If achieved, this would sequester <strong>1.7 Gt CO₂ per year</strong> and generate $9 trillion in ecosystem services by 2050.</p>

      ${statRow([
        { value: '$7-30', label: 'Return per $1 Invested' },
        { value: '350M ha', label: 'UN Restoration Target' },
        { value: '$9T', label: 'Value by 2050' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Carbon Pools: Where Does It All Go?</h3>
      <p>The Earth's carbon is distributed across massive pools. Understanding these helps put any single restoration project in context:</p>

      ${statRow([
        { value: `${FACTS.ocean_pool.toLocaleString()} GtC`, label: 'Deep Ocean' },
        { value: `${FACTS.soil_pool.toLocaleString()} GtC`, label: 'Soil (top 1m)' },
        { value: `${FACTS.permafrost_pool} GtC`, label: 'Permafrost' },
      ])}
      ${statRow([
        { value: `${FACTS.vegetation_pool} GtC`, label: 'Vegetation' },
        { value: `${FACTS.atmosphere_pool} GtC`, label: 'Atmosphere' },
        { value: `${FACTS.peatland_stock} GtC`, label: 'Peatlands' },
      ])}

      <p>Humanity has added <strong>${(FACTS.atmosphere_pool - 590)} GtC</strong> to the atmosphere since pre-industrial times. That's the problem. Restoration moves carbon back out of the atmosphere and into vegetation and soil — where it belongs.</p>

      <div class="overlay-divider"></div>

      <h3>What If Every Hectare Looked Like This?</h3>
      <p>This project covers ${(area/1e6).toFixed(2)}M hectares. If all 420 million hectares of degraded tropical dry forest were restored using this multilayer approach, they could sequester <strong>${(420 * 50 * 3.67 / 1000).toFixed(0)}M t CO₂ per year</strong> at maturity. That's ${((420 * 50 * 3.67) / (FACTS.annual_emissions_2025 * 1e6) * 100).toFixed(1)}% of annual global emissions.</p>
      <p>Not a silver bullet. But a meaningful piece of the puzzle — with economic benefits that go directly to the communities doing the work.</p>
    `;
  }

  function renderBeninGlobal(container, site) {
    const d = site || {};
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>Benin in the Global Picture</h3>
      <p>West Africa has lost over 50% of its mangrove cover since 1980. Benin's Ouidah coast is part of a vast mangrove belt stretching from Senegal to Nigeria — one of the most important blue carbon ecosystems on Earth. What happens here matters for the entire region.</p>

      ${statRow([
        { value: `${FACTS.mangrove_area}M ha`, label: 'Global Mangroves' },
        { value: `${FACTS.mangrove_loss}%`, label: 'Lost Since 1980' },
        { value: `${FACTS.mangrove_stock} GtC`, label: 'Total Carbon Stock' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Blue Carbon: The Ocean's Secret Weapon</h3>
      <p>Mangroves, seagrasses, and salt marshes are called "blue carbon" ecosystems. They cover less than 2% of the ocean floor but account for <strong>50% of all carbon buried in ocean sediments</strong>. They sequester carbon 2-4x faster than terrestrial forests per unit area.</p>
      <p>Seagrass meadows bury carbon at <strong>${FACTS.seagrass_burial} gC/m²/year</strong> — 35x faster than tropical rainforests per area. But they're disappearing at ${FACTS.seagrass_loss_rate}% per year. We're losing the ocean's carbon sink just when we need it most.</p>

      ${statRow([
        { value: '50%', label: 'Ocean Carbon Buried in Blue Carbon' },
        { value: '35x', label: 'Seagrass vs Forest Rate' },
        { value: `${FACTS.seagrass_loss_rate}%/yr`, label: 'Seagrass Loss Rate' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Sea Level: The Rising Threat</h3>
      <p>Global sea level has risen <strong>${FACTS.sea_level_total}cm since 1900</strong> and the rate is accelerating — from 1.3mm/year in the early 20th century to <strong>${FACTS.sea_level_rate}mm/year today</strong>. For West Africa's low-lying coasts, this is existential.</p>
      <p>By 2100, sea level is projected to rise 0.4-0.8m (moderate scenario) or 0.6-1.0m (high scenario). Mangroves can keep pace with rises up to 5mm/year by trapping sediment. Faster than that, and they drown. The math is unforgiving.</p>

      ${statRow([
        { value: `${FACTS.sea_level_total}cm`, label: 'Rise Since 1900' },
        { value: `${FACTS.sea_level_rate}mm/yr`, label: 'Current Rate' },
        { value: '0.4-1.0m', label: '2100 Projection' },
      ])}

      <div class="overlay-divider"></div>

      <h3>What If Every Hectare Looked Like This?</h3>
      <p>This project covers ${(area/1e6).toFixed(2)}M hectares. If all ${FACTS.mangrove_area} million hectares of global mangrove were restored to full health, they would sequester an additional <strong>${(FACTS.mangrove_area * FACTS.mangrove_seq_rate / 1000).toFixed(0)}M t CO₂ per year</strong>. That's ${((FACTS.mangrove_area * FACTS.mangrove_seq_rate) / (FACTS.annual_emissions_2025 * 1e6) * 100).toFixed(1)}% of annual global emissions — from mangroves alone.</p>
      <p>And that's just the sequestration. The avoided emissions from preventing further destruction, the coastal protection value, the fisheries support — the total value of mangrove restoration is estimated at <strong>$375 billion per year</strong> globally.</p>
    `;
  }

  function renderBorneoGlobal(container, site) {
    const d = site || {};
    const area = d.area || 2500;

    container.innerHTML = `
      <h3>Borneo in the Global Picture</h3>
      <p>Borneo's peat swamps are part of a global peatland system that covers <strong>${FACTS.peatland_area} million hectares</strong> — just 3% of Earth's land surface but storing <strong>${FACTS.peatland_stock} GtC</strong>, twice the carbon of all the world's forests combined. Southeast Asia holds the largest tropical peat carbon store on the planet.</p>

      ${statRow([
        { value: `${FACTS.peatland_area}M ha`, label: 'Global Peatlands' },
        { value: `${FACTS.peatland_stock} GtC`, label: 'Carbon Stock' },
        { value: `${FACTS.peatland_drained}%`, label: 'Drained Globally' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Carbon Time Bomb</h3>
      <p>When peatlands are drained, the peat dries out and starts decomposing. This releases CO₂ continuously — not just once, but every year the land stays drained. Drained peatlands globally emit <strong>${FACTS.peatland_emissions} Gt CO₂ per year</strong> — more than Germany's total annual emissions.</p>
      <p>Here's the terrifying part: this is a self-reinforcing cycle. Warming dries peat. Dry peat decomposes and emits CO₂. More CO₂ means more warming. More warming dries more peat. This is a tipping point — and we may have already crossed it in parts of Southeast Asia.</p>

      ${statRow([
        { value: `${FACTS.peatland_emissions} Gt/yr`, label: 'Drained Peat Emissions' },
        { value: '>Germany', label: 'Comparison' },
        { value: 'Self-reinforcing', label: 'Feedback Loop' },
      ])}

      <div class="overlay-divider"></div>

      <h3>Deforestation: The Global Driver</h3>
      <p>Tropical deforestation emits <strong>${FACTS.land_use_emissions} Gt CO₂ per year</strong> — about 8% of all human emissions. That's more than the entire European Union. The primary drivers: palm oil (35%), cattle (25%), soy (20%), and timber (15%).</p>
      <p>Indonesia and Malaysia produce 85% of the world's palm oil. It's in half the products in a supermarket — shampoo, cookies, biofuel, lipstick. Every purchase is a vote for or against the forests that remain.</p>

      ${statRow([
        { value: `${FACTS.land_use_emissions} Gt/yr`, label: 'Deforestation Emissions' },
        { value: '8%', label: 'Of Global Emissions' },
        { value: '85%', label: 'Palm Oil from SE Asia' },
      ])}

      <div class="overlay-divider"></div>

      <h3>What If Every Hectare Looked Like This?</h3>
      <p>This site covers ${(area/1e6).toFixed(2)}M hectares. If all ${FACTS.peatland_area} million hectares of global peatland were protected and restored, we'd avoid <strong>${FACTS.peatland_emissions} Gt CO₂ per year</strong> in emissions from drained peat — and begin re-accumulating carbon in intact peat at ~0.5 Gt CO₂ per year.</p>
      <p>The total carbon benefit: <strong>${(FACTS.peatland_emissions + 0.5).toFixed(1)} Gt CO₂ per year</strong>. That's ${(((FACTS.peatland_emissions + 0.5) / (FACTS.annual_emissions_2025)) * 100).toFixed(1)}% of annual global emissions — from protecting and restoring peatlands alone. It's one of the highest-impact, lowest-cost climate solutions available.</p>

      ${statRow([
        { value: `${(FACTS.peatland_emissions + 0.5).toFixed(1)} Gt/yr`, label: 'Total CO₂ Benefit' },
        { value: `${(((FACTS.peatland_emissions + 0.5) / FACTS.annual_emissions_2025) * 100).toFixed(1)}%`, label: 'Of Global Emissions' },
        { value: '10-100x', label: 'Cheaper Than Restoration' },
      ])}

      <div class="overlay-divider"></div>

      <h3>The Bottom Line</h3>
      <p>Protecting what we have is always cheaper than restoring what we've lost. Every hectare of intact peat swamp, every standing mangrove, every living forest is worth more alive than converted. The carbon math is clear. The economic math is clear. The only thing missing is the will.</p>
    `;
  }

  // ═══════════════════════════════════════════
  // GAIA SYNTHESIS TABS — AI-powered overviews
  // ═══════════════════════════════════════════

  function renderAntalyaSynthesis(container, site) {
    container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis('antalya', site);
    _setupSynthesisRefresh(container, 'antalya', site);
  }

  function renderSriLankaSynthesis(container, site) {
    container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis('sri_lanka', site);
    _setupSynthesisRefresh(container, 'sri_lanka', site);
  }

  function renderBeninSynthesis(container, site) {
    container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis('benin', site);
    _setupSynthesisRefresh(container, 'benin', site);
  }

  function renderBorneoSynthesis(container, site) {
    container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis('borneo', site);
    _setupSynthesisRefresh(container, 'borneo', site);
  }

  function _setupSynthesisRefresh(container, siteId, site) {
    // If already loaded, render immediately
    if (GAIA_KNOWLEDGE.isReady()) {
      container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis(siteId, site);
      return;
    }
    // Otherwise, listen for the knowledge-ready event
    const handler = () => {
      container.innerHTML = GAIA_KNOWLEDGE.generateSynthesis(siteId, site);
      document.removeEventListener('gaia:knowledge-ready', handler);
    };
    document.addEventListener('gaia:knowledge-ready', handler);
  }

  // ── Init ──
  function init() { registerAllSites(); }

  return {
    init, populateSiteData, onNodeClick, onNodeHover,
    addXP, getNodeState, getAllNodeState,
    getNextSuggestions, getSuggestedSiteIds, getGAIAContext,
    registerContent, registerFromJSON, CONTENT_TYPES,
  };
})();


/* ══ js/gaia-legacy/gaia-knowledge.js ══ */
/**
 * GAIA KNOWLEDGE ENGINE v1.0
 * Client-side RAG system powered by the Earth Love United Climate Knowledge dataset.
 * 
 * Architecture:
 *   1. Loads dataset from Hugging Face (pre-embedded chunks)
 *   2. Uses cosine similarity for retrieval (pure JS, no server needed)
 *   3. Integrates with GAIA's tool system as `search_knowledge` tool
 *   4. Injects relevant context into LLM conversations
 * 
 * Dataset: ego0op/earth-love-united-climate-knowledge (7,260 chunks)
 */

const GaiaKnowledge = (() => {

  // ─── STATE ───
  let _chunks = [];           // Loaded knowledge chunks
  let _vocab = null;          // TF-IDF vocabulary
  let _loaded = false;
  let _loading = false;

  // ─── CONFIG ───
  const DATASET_URL = 'data/climate-knowledge-curated.jsonl';
  const TOP_K = 5;            // Number of chunks to retrieve
  const MIN_SCORE = 0.15;     // Minimum similarity threshold (lower for TF-IDF)

  // ─── SIMPLE EMBEDDING (TF-IDF-like, no model needed) ───
  // For production, use a proper embedding model. For now, we use
  // a keyword-based approach that works surprisingly well for domain-specific retrieval.

  function _tokenize(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  function _buildVocabulary(chunks) {
    const vocab = new Map();
    let idx = 0;
    for (const chunk of chunks) {
      const tokens = _tokenize(chunk.text);
      for (const token of tokens) {
        if (!vocab.has(token)) {
          vocab.set(token, idx++);
        }
      }
    }
    return vocab;
  }

  function _textToVector(text, vocab) {
    const vec = new Float32Array(vocab.size);
    const tokens = _tokenize(text);
    // TF-IDF weighting
    const tf = new Map();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }
    for (const [token, count] of tf) {
      const idx = vocab.get(token);
      if (idx !== undefined) {
        // Simple TF weighting
        vec[idx] = count / tokens.length;
      }
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    }
    return vec;
  }

  function _cosineSim(a, b) {
    let dot = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) dot += a[i] * b[i];
    return dot; // Already normalized
  }

  // ─── PUBLIC API ───

  async function init() {
    if (_loaded || _loading) return;
    _loading = true;

    console.log('[GaiaKnowledge] Loading climate knowledge dataset...');

    try {
      // Load chunks from local dataset
      const response = await fetch(DATASET_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      _chunks = text.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      console.log(`[GaiaKnowledge] Loaded ${_chunks.length} chunks`);

      // Build vocabulary and vectors
      console.log('[GaiaKnowledge] Building search index...');
      const vocab = _buildVocabulary(_chunks);
      console.log(`[GaiaKnowledge] Vocabulary size: ${vocab.size}`);

      // Store vectors as array of Float32Arrays
      _chunks = _chunks.map(chunk => ({
        ...chunk,
        _vector: _textToVector(chunk.text, vocab)
      }));
      _vocab = vocab;
      _loaded = true;

      console.log('[GaiaKnowledge] ✅ Knowledge engine ready');
      console.log(`[GaiaKnowledge] Sources: ${[...new Set(_chunks.map(c => c.source))].join(', ')}`);

    } catch (err) {
      console.error('[GaiaKnowledge] Failed to load:', err);
      // Fallback: use keyword matching only
      _loaded = true;
    }

    _loading = false;
  }

  function search(query, options = {}) {
    if (!_loaded || _chunks.length === 0) return [];

    const topK = options.topK || TOP_K;
    const minScore = options.minScore || MIN_SCORE;
    const sourceFilter = options.source || null;

    let queryVec = null;
    if (_vocab) {
      queryVec = _textToVector(query, _vocab);
    }

    const results = [];
    for (const chunk of _chunks) {
      if (sourceFilter && chunk.source !== sourceFilter) continue;

      let score = 0;
      if (queryVec && chunk._vector) {
        score = _cosineSim(queryVec, chunk._vector);
      } else {
        // Fallback: keyword overlap
        const queryTokens = new Set(_tokenize(query));
        const chunkTokens = new Set(_tokenize(chunk.text));
        let overlap = 0;
        for (const t of queryTokens) {
          if (chunkTokens.has(t)) overlap++;
        }
        score = overlap / Math.sqrt(queryTokens.size * chunkTokens.size);
      }

      if (score >= minScore) {
        results.push({ ...chunk, _score: score });
      }
    }

    results.sort((a, b) => b._score - a._score);
    return results.slice(0, topK);
  }

  function getContext(query, maxChars = 2000) {
    const results = search(query);
    if (results.length === 0) return '';

    let context = '';
    for (const r of results) {
      const chunk = `[${r.source}] ${r.title}: ${r.text}`;
      if (context.length + chunk.length > maxChars) break;
      context += chunk + '\n\n';
    }
    return context.trim();
  }

  function getStats() {
    if (!_loaded) return { loaded: false };
    const sources = {};
    for (const c of _chunks) {
      sources[c.source] = (sources[c.source] || 0) + 1;
    }
    return {
      loaded: true,
      totalChunks: _chunks.length,
      sources,
      vocabSize: _vocab ? _vocab.size : 0,
    };
  }

  // ─── TOOL DEFINITION (for GAIA's LLM) ───
  window.SEARCH_KNOWLEDGE_TOOL = {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Search the climate knowledge base for authoritative information about carbon, climate change, solutions, impacts, and science. Use this when the user asks factual questions about climate.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — be specific and include key terms' },
          top_k: { type: 'integer', description: 'Number of results to return (default 5)' },
        },
        required: ['query']
      }
    }
  };

  // ─── TOOL EXECUTION ───
  function executeTool(toolName, args) {
    if (toolName === 'search_knowledge') {
      const results = search(args.query, { topK: args.top_k || 5 });
      return {
        query: args.query,
        results: results.map(r => ({
          source: r.source,
          title: r.title,
          text: r.text.substring(0, 500),
          score: r._score,
          url: r.url,
        })),
        context: getContext(args.query, 2000),
      };
    }
    return null;
  }

  return {
    init,
    search,
    getContext,
    getStats,
    executeTool,
    get SEARCH_KNOWLEDGE_TOOL() { return SEARCH_KNOWLEDGE_TOOL; },
    get isLoaded() { return _loaded; },
    get chunkCount() { return _chunks.length; },
  };
})();


/* ══ js/gaia-overlay-knowledge.js ══ */
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
    if (!GaiaKnowledge.isLoaded) {
      console.log('[GAIA Knowledge] Starting cascading dataset load...');
      GaiaKnowledge.init();
    }
    _pollForReady();
  }

  function _pollForReady() {
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


/* ══ js/ndvi-verifier.js ══ */
// ═══════════════════════════════════════════════════════
// NDVI VERIFIER — Satellite ground-truth comparison
// Fetches Sentinel-2 NDVI data and cross-references
// against locally baked project data
// ═══════════════════════════════════════════════════════

const NDVIVerifier = (() => {

  // Sentinel Hub API endpoint (free tier — no key for basic NDVI)
  // Uses the Statistical API for time-series NDVI at project coordinates
  window.SENTINEL_CONFIG = {
    baseUrl: 'https://services.sentinel-hub.com/api/v1',
    // Alternative: use GFW (Global Forest Watch) tile API if SH is down
    gfwUrl: 'https://production-api.globalforestwatch.org/v1',
    cacheTtlMs: 3600000, // 1 hour cache
  };

  // Verification status constants
  window.STATUS = {
    VERIFIED: 'verified',
    DISCREPANCY: 'discrepancy',
    PENDING: 'pending',
    UNAVAILABLE: 'unavailable',
    FETCHING: 'fetching',
  };

  // ── Cache ──
  let _cache = {};

  function _getCacheKey(siteId) {
    return `ndvi_verify_${siteId}`;
  }

  function _loadFromCache(siteId) {
    try {
      const raw = Storage.safeGetItem(_getCacheKey(siteId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.cachedAt > SENTINEL_CONFIG.cacheTtlMs) {
        Storage.safeRemoveItem(_getCacheKey(siteId));
        return null;
      }
      return parsed;
    } catch { return null; }
  }

  function _saveToCache(siteId, data) {
    Storage.safeSetItem(_getCacheKey(siteId), JSON.stringify({
      ...data,
      cachedAt: Date.now(),
    }));
  }

  // ── NDVI Calculation from Sentinel-2 bands ──
  // NDVI = (NIR - RED) / (NIR + RED)
  // Band 8 (NIR) and Band 4 (RED) from Sentinel-2 L2A
  function _calcNdvi(nir, red) {
    if (nir + red === 0) return 0;
    return (nir - red) / (nir + red);
  }

  // ── Fetch NDVI from Sentinel Hub Statistical API ──
  // NOTE: Requires a valid OAuth token in production. Without auth this
  // falls through to the MODIS fallback, and if that also fails (CORS,
  // network) we return UNAVAILABLE so the UI can show a demo-mode badge.
  async function _fetchSentinelNdvi(site) {
    const { lat, lng } = site;
    const bboxSize = 0.01;

    const payload = {
      input: {
        bounds: {
          bbox: [lng - bboxSize, lat - bboxSize, lng + bboxSize, lat + bboxSize],
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/4326' }
        },
        data: [{
          type: 'S2L2A',
          dataFilter: {
            timeRange: {
              from: new Date(Date.now() - 730 * 86400000).toISOString(),
              to: new Date().toISOString()
            },
            mosaickingOrder: 'leastCC',
            maxCloudCoverage: 30,
          },
          processing: { upsampling: 'BICUBIC', downsampling: 'BICUBIC' }
        }]
      },
      aggregation: {
        evalscript: `
          //VERSION=3
          function setup() { return { input: ["B04", "B08"], output: { bands: 1 } }; }
          function evaluatePixel(sample) {
            return [(sample.B08 - sample.B04) / (sample.B08 + sample.B04)];
          }
        `,
        aggregationInterval: { of: 'P1M' },
        resolution: { width: 10, height: 10 },
      },
      output: { responses: [{ identifier: 'ndvi', format: { type: 'application/json' } }] }
    };

    try {
      const resp = await fetch(SENTINEL_CONFIG.baseUrl + '/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        console.warn(`[NDVIVerifier] Sentinel API error: ${resp.status}`);
        return _fetchFallbackNdvi(site);
      }

      const data = await resp.json();
      if (!data.ndvi || !data.ndvi.data || !data.ndvi.data.length) {
        return _fetchFallbackNdvi(site);
      }

      const monthlyNdvi = data.ndvi.data.map(d => ({
        date: d.date,
        ndvi: Math.round(d.basicStatNumbers.mean * 1000) / 1000,
        sampleCount: d.basicStatNumbers.sampleCount || 0,
      }));

      return {
        source: 'sentinel_hub',
        status: STATUS.VERIFIED,
        data: monthlyNdvi,
        latest: monthlyNdvi[monthlyNdvi.length - 1],
      };
    } catch (err) {
      console.warn('[NDVIVerifier] Sentinel fetch failed:', err.message);
      return _fetchFallbackNdvi(site);
    }
  }

  // ── Fallback: Global Forest Watch NDVI ──
  async function _fetchFallbackNdvi(site) {
    // GFW doesn't have direct NDVI API, but we can use MODIS NDVI
    // This is a secondary approach using a public MODIS endpoint
    const { lat, lng } = site;
    const url = `https://modis.ornl.gov/rst/api/v1/MOD13Q1/ndvi?lat=${lat}&lon=${lng}&startDate=2024-01-01&endDate=2026-04-01&kmAboveBelow=1&kmLeftRight=1`;

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (data && data.dates && data.dates.length) {
        const monthlyNdvi = data.dates.map((d, i) => ({
          date: d,
          ndvi: Math.round(data.ndvi[i] * 1000) / 10000, // MODIS scale factor
          source: 'modis',
        })).filter(d => d.ndvi >= -0.1 && d.ndvi <= 1.0);

        return {
          source: 'modis',
          status: STATUS.VERIFIED,
          data: monthlyNdvi,
          latest: monthlyNdvi[monthlyNdvi.length - 1],
        };
      }
    } catch (err) {
      console.warn('[NDVIVerifier] MODIS fallback failed:', err.message);
    }

    // No external source available — mark as pending
    return {
      source: 'none',
      status: STATUS.UNAVAILABLE,
      data: [],
      latest: null,
    };
  }

  // ── Compare satellite NDVI with local data ──
  function _compareWithLocal(siteNdvi, satelliteData) {
    if (!satelliteData || !satelliteData.data || !satelliteData.data.length) {
      return { match: false, reason: 'no_satellite_data', local: siteNdvi, satellite: null };
    }

    // Group satellite data by year and get annual averages
    const byYear = {};
    satelliteData.data.forEach(d => {
      const year = d.date.substring(0, 4);
      if (!byYear[year]) byYear[year] = { sum: 0, count: 0 };
      byYear[year].sum += d.ndvi;
      byYear[year].count++;
    });

    // Compare the most recent common year
    const localYears = siteNdvi.map(n => n.year);
    const satelliteYears = Object.keys(byYear).map(Number);
    const commonYears = localYears.filter(y => satelliteYears.includes(y));

    if (!commonYears.length) {
      return {
        match: 'pending',
        reason: 'no_overlapping_years',
        local: siteNdvi,
        satellite: byYear,
      };
    }

    // Compare latest common year
    const latestCommon = Math.max(...commonYears);
    const localEntry = siteNdvi.find(n => n.year === latestCommon);
    const satEntry = byYear[latestCommon];
    const satAvg = satEntry.sum / satEntry.count;

    const diff = Math.abs(localEntry.value - satAvg);

    return {
      match: diff < 0.05 ? 'good' : diff < 0.10 ? 'acceptable' : 'mismatch',
      diff: Math.round(diff * 1000) / 1000,
      localValue: localEntry.value,
      satelliteValue: Math.round(satAvg * 1000) / 1000,
      year: latestCommon,
      local: siteNdvi,
      satellite: byYear,
    };
  }

  // ── Public: Verify a single site ──
  // Wraps the entire fetch chain in a timeout so the UI never hangs.
  // If both Sentinel and MODIS fail (auth, CORS, network), returns
  // UNAVAILABLE with a demo-mode flag so the UI can show sample data.
  async function verifySite(siteId) {
    if (!Data) {
      console.warn('[NDVIVerifier] Data module not loaded yet');
      return { status: STATUS.UNAVAILABLE, demo: true };
    }

    const site = Data.getSite(siteId);
    if (!site) {
      console.warn(`[NDVIVerifier] Unknown site: ${siteId}`);
      return { status: STATUS.UNAVAILABLE, demo: true };
    }

    // Check cache first
    const cached = _loadFromCache(siteId);
    if (cached) {
      const comparison = _compareWithLocal(site.ndvi, cached);
      return { ...cached, comparison };
    }

    // Race the satellite fetch against a timeout (8 seconds)
    const SATELLITE_TIMEOUT_MS = 8000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), SATELLITE_TIMEOUT_MS)
    );

    let satelliteData;
    try {
      satelliteData = await Promise.race([
        _fetchSentinelNdvi(site),
        timeoutPromise
      ]);
    } catch {
      // Timeout or unhandled error — use fallback
      try {
        satelliteData = await _fetchFallbackNdvi(site);
      } catch {
        satelliteData = { source: 'none', status: STATUS.UNAVAILABLE, data: [], latest: null };
      }
    }

    // If both APIs failed, return demo data so the UI still renders
    if (satelliteData.status === STATUS.UNAVAILABLE) {
      return {
        source: 'demo',
        status: STATUS.UNAVAILABLE,
        data: [],
        latest: null,
        demo: true,
        comparison: { match: 'demo', reason: 'Satellite APIs unavailable (auth/CORS/network). Showing demo data.' },
      };
    }

    _saveToCache(siteId, satelliteData);
    const comparison = _compareWithLocal(site.ndvi, satelliteData);
    return { ...satelliteData, comparison };
  }

  // ── Public: Verify all sites ──
  async function verifyAllSites() {
    if (!Data) {
      console.warn('[NDVIVerifier] Data module not loaded yet');
      return {};
    }

    const results = {};
    for (const site of Data.sites) {
      results[site.id] = await verifySite(site.id);
    }
    return results;
  }

  // ── Public: Get verification badge data for UI ──
  function getBadgeData(comparison) {
    if (!comparison || !comparison.match) {
      return {
        icon: '🔍',
        label: 'Verifying...',
        color: 'var(--text3)',
        tooltip: 'Satellite data pending',
      };
    }

    switch (comparison.match) {
      case 'good':
        return {
          icon: '✅',
          label: 'Satellite Verified',
          color: 'var(--leaf)',
          tooltip: `Local data matches Sentinel-2 within ${comparison.diff} NDVI (${comparison.year})`,
        };
      case 'acceptable':
        return {
          icon: '⚠️',
          label: 'Close Match',
          color: 'var(--amber)',
          tooltip: `Small discrepancy (${comparison.diff}) — may be due to measurement timing or methodology`,
        };
      case 'mismatch':
        return {
          icon: '🔶',
          label: 'Discrepancy',
          color: 'var(--warn)',
          tooltip: `Local: ${comparison.localValue} vs Satellite: ${comparison.satelliteValue} (${comparison.year}). Investigation needed.`,
        };
      case 'pending':
        return {
          icon: '⏳',
          label: 'Awaiting Satellite',
          color: 'var(--text3)',
          tooltip: 'No overlapping data years yet — check back after next satellite pass',
        };
      default:
        return {
          icon: '❓',
          label: 'No Data',
          color: 'var(--text3)',
          tooltip: 'Satellite verification not available',
        };
    }
  }

  // ── Public: Generate a verification summary card HTML ──
  function renderVerificationCard(siteId, comparison) {
    const site = Data ? Data.getSite(siteId) : null;
    const badge = getBadgeData(comparison);
    const isDemo = comparison?.demo || comparison?.source === 'demo';

    return `
      <div class="verification-card" id="verify-${siteId}">
        <div class="verify-header">
          <span class="verify-icon">${badge.icon}</span>
          <span class="verify-label" style="color:${badge.color}">${badge.label}</span>
          <span class="verify-year">${comparison?.year || '—'}</span>
          ${isDemo ? '<span class="verify-demo-badge" style="font-size:8px;background:rgba(139,159,199,0.15);color:#8b9fc7;padding:1px 5px;border-radius:3px;margin-left:4px;">DEMO</span>' : ''}
        </div>
        <div class="verify-detail">
          ${comparison?.satelliteValue != null
            ? `<div class="verify-row">
                <span>Local NDVI</span>
                <span class="verify-val">${comparison.localValue?.toFixed(2) || '—'}</span>
              </div>
              <div class="verify-row">
                <span>Satellite NDVI</span>
                <span class="verify-val sat">${comparison.satelliteValue?.toFixed(2) || '—'}</span>
              </div>
              <div class="verify-row">
                <span>Difference</span>
                <span class="verify-val ${comparison.diff < 0.05 ? 'good' : comparison.diff < 0.10 ? 'ok' : 'bad'}">${comparison.diff?.toFixed(3) || '—'}</span>
              </div>`
            : `<div class="verify-row"><span>${isDemo ? '🛰 Demo mode — satellite verification requires API access. ' + (comparison?.reason || '') : badge.tooltip}</span></div>`
          }
        </div>
        <div class="verify-footer">
          <span class="verify-source">Source: ${comparison?.source === 'sentinel_hub' ? 'Sentinel-2 (ESA)' : comparison?.source === 'modis' ? 'MODIS (NASA)' : comparison?.source === 'demo' ? 'Demo data' : 'Pending satellite data'}</span>
          ${site ? `<span class="verify-coords">${site.lat.toFixed(3)}°, ${site.lng.toFixed(3)}°</span>` : ''}
        </div>
      </div>
    `;
  }

  // ── Init: attach to globe hover events ──
  function init() {
    console.log('[NDVIVerifier] Module loaded — ready for satellite verification');
  }

  return {
    STATUS,
    verifySite,
    verifyAllSites,
    getBadgeData,
    renderVerificationCard,
    init,
  };
})();

// Auto-init when Data is ready
function _ndviInit() {
  if (typeof Data !== 'undefined') {
    NDVIVerifier.init();
  } else {
    // Data not loaded yet — wait once for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => NDVIVerifier.init(), { once: true });
  }
}
_ndviInit();

/* ══ js/gaia-presence.js ══ */
// ═══════════════════════════════════════════
// GAIA PRESENCE — Ambient awareness layer
// Teaser speech on globe hover, tooltip display
// Works on both index.html (main site) and gaia.html
// ═══════════════════════════════════════════

const GAIA_PRESENCE = (() => {
  let tooltipEl = null;

  // Teaser lines per site — designed to make delegates lean in
  window.TEASERS = {
    sri_lanka: [
      "Six thousand acres across five districts — and every seedling is a promise.",
      "Jaffna, Vavuniya, Mullaitivu... five districts, one mission. Multilayer afforestation.",
      "Sri Lanka's Northern Province was scarred by conflict. Now it's being healed — one tree at a time."
    ],
    antalya: [
      "This is where COP31 happens. And this is what the fire left behind.",
      "Sixty thousand hectares of Mediterranean pine — gone in days, July 2021. Recovery has just begun.",
      "The host city of COP31 carries a wound. The Antalya fire scar is still visible from space."
    ],
    benin: [
      "Mangroves store 950 tonnes of carbon per hectare. More than any ecosystem on Earth.",
      "Jean Missinhoun dreamed of restoring the Ouidah lagoons. His dream is still growing.",
      "From oil to earth — that's the story of Benin's coast, and the mission behind this foundation."
    ],
    borneo: [
      "This looks green from space. But it's an oil palm plantation — 50 tC/ha where there was 1,400.",
      "The greenest lie on Earth: same NDVI, 96% less carbon. That's what monoculture does.",
      "West Kalimantan's peat swamps once held centuries of carbon. Twenty years of clearing released it all."
    ]
  };

  function pickLine(siteId) {
    const pool = TEASERS[siteId];
    if (!pool || !pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function showTooltip(site, clientX, clientY) {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'gaia-presence-tooltip';
      document.body.appendChild(tooltipEl);
    }
    const line = pickLine(site.id);
    tooltipEl.innerHTML = `
      <div class="pt-name">${site.name}</div>
      <div class="pt-subtitle">${site.subtitle}</div>
      ${line ? `<div class="pt-xp">🌍 "${line}"</div>` : ''}
    `;
    // Position near the cursor but keep on screen
    const x = Math.min(clientX, window.innerWidth - 260);
    const y = clientY - tooltipEl.offsetHeight - 12;
    tooltipEl.style.left = Math.max(8, x) + 'px';
    tooltipEl.style.top = Math.max(8, y) + 'px';
    tooltipEl.classList.add('visible');
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
  }

  function speakTeaser(siteId) {
    const line = pickLine(siteId);
    if (!line) return;
    if (typeof GAIA_BUBBLE !== 'undefined') {
      GAIA_BUBBLE.speak(line, 'mysterious', 5000);
    }
  }

  return {
    showTooltip,
    hideTooltip,
    speakTeaser,
    pickLine
  };
})();

/* ══ js/registry-check.js ══ */
// ═══════════════════════════════════════════════════════
// REGISTRY CHECK — Carbon Standard Cross-Reference
// Maps project sites against Verra VCS, Gold Standard,
// ACR, PCS, and CDM registries using public APIs
// ═══════════════════════════════════════════════════════

const RegistryCheck = (() => {

  // Registry endpoints (public/developer access)
  window.REGISTRIES = {
    verra: {
      name: 'Verra VCS',
      url: 'https://registry.vcsprogram.com/api/v1/projects',
      searchUrl: (lat, lng, radius) =>
        `https://registry.vcsprogram.com/api/v1/projects?latitude=${lat}&longitude=${lng}&radius=${radius}`,
      docs: 'https://registry.vcsprogram.com/',
    },
    gold_standard: {
      name: 'Gold Standard',
      // Gold Standard doesn't have a public geo API
      // We query their impact registry by coordinates
      url: 'https://my.goldstandard.org/api/projects',
    },
    acr: {
      name: 'ACR (American Carbon Registry)',
      url: 'https://acr2.apx.com/registryModule/PublicAPI/REST/Projects',
    },
    pcs: {
      name: 'Planetly / VCMI',
      // Planetly was acquired by OneTrust; public API limited
      // Fallback: their public registry page
      url: 'https://www.planetly.com/our-standards/planetary-carbon-standard',
    },
    cdm: {
      name: 'CDM (UN)',
      url: 'https://cdm.unfccc.int/Projects/PROJ',
      // UNFCCC CDM API — publicly accessible
      apiUrl: 'https://cdm.unfccc.int/api/v1/projects',
    },
  };

  // Earth circumference at equator: ~40,075 km
  // 1° latitude ≈ 111 km
  const KM_PER_DEGREE = 111.0;

  // ── Search a registry for projects within a radius (km) of a point ──
  async function _searchRegistry(apiUrl, lat, lng, radiusKm, keyName, headers = {}) {
    const radius_deg = (radiusKm / KM_PER_DEGREE).toFixed(4);
    const searchUrl = `${apiUrl}?latitude=${lat}&longitude=${lng}&radius_degree=${radius_deg}`;

    try {
      const resp = await fetch(searchUrl, { headers });
      if (!resp.ok) return { registry: keyName, error: `HTTP ${resp.status}`, projects: [] };
      const data = await resp.json();
      return { registry: keyName, projects: _normaliseProjects(data, keyName), raw: data };
    } catch (err) {
      console.warn(`[RegistryCheck] ${keyName} fetch failed:`, err.message);
      return { registry: keyName, error: err.message, projects: [] };
    }
  }

  // ── Normalise different registry response formats ──
  function _normaliseProjects(data, registry) {
    if (!data || (!data.results && !data.projects && !Array.isArray(data))) return [];

    let items = [];
    if (Array.isArray(data)) items = data;
    else if (data.results) items = data.results;
    else if (data.projects) items = data.projects;

    return items.map(p => {
      switch (registry) {
        case 'verra':
          return {
            id: p.project_id || p.id,
            title: p.project_name || p.title,
            registry: 'Verra VCS',
            status: p.current_status || 'Unknown',
            methodologies: (p.methodologies || []).map(m => m.title || m),
            crediting_period: p.crediting_period || null,
            url: p.url || `${REGISTRIES.verra.docs}${p.id || p.project_id}`,
          };
        case 'gold_standard':
          return {
            id: p.id || p.project_id,
            title: p.name || p.title,
            registry: 'Gold Standard',
            status: p.status || 'Unknown',
            sdgs: p.sdgs || [],
            crediting_period: p.crediting_period || null,
            url: `${REGISTRIES.gold_standard.url}/${p.id || ''}`,
          };
        default:
          return {
            id: p.id || 'unknown',
            title: p.name || p.title || 'Unnamed Project',
            registry: REGISTRIES[registry]?.name || registry,
            status: p.status || 'Unknown',
            url: null,
          };
      }
    });
  }

  // ── Check a single site against all registries ──
  // All external API calls are wrapped in timeouts and error handling.
  // If APIs fail (auth, CORS, network), returns UNAVAILABLE with a
  // demo-mode flag so the UI can show sample data instead of hanging.
  async function checkSite(siteId) {
    if (!Data) {
      console.warn('[RegistryCheck] Data module not loaded');
      return { siteId, error: 'Data module not loaded', demo: true };
    }

    const site = Data.getSite(siteId);
    if (!site) {
      console.warn(`[RegistryCheck] Unknown site: ${siteId}`);
      return { siteId, error: 'Unknown site', demo: true };
    }

    const { lat, lng } = site;
    const searchRadiusKm = 50;

    // Query all registries in parallel with individual timeouts
    const REGISTRY_TIMEOUT_MS = 6000;
    const results = {};

    const queries = Object.entries(REGISTRIES).map(async ([key, reg]) => {
      // Registries without public geo-search APIs
      if (key === 'pcs' || key === 'cdm') {
        results[key] = {
          registry: reg.name,
          projects: [],
          note: 'Manual verification required — public API not available',
          url: reg.url,
        };
        return;
      }
      // Gold Standard requires authentication
      if (key === 'gold_standard') {
        results[key] = {
          registry: reg.name,
          projects: [],
          note: 'API requires authentication — manual check recommended',
          url: reg.url,
        };
        return;
      }

      // Verra and others: try with timeout
      try {
        const result = await Promise.race([
          _searchRegistry(reg.url, lat, lng, searchRadiusKm, key),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), REGISTRY_TIMEOUT_MS)
          ),
        ]);
        results[key] = result;
      } catch {
        results[key] = {
          registry: reg.name,
          projects: [],
          note: 'API unavailable (timeout/CORS/auth) — manual check recommended',
          url: reg.url,
        };
      }
    });

    await Promise.all(queries);

    const allProjects = Object.values(results)
      .filter(r => r.projects && r.projects.length > 0)
      .flatMap(r => r.projects);

    const hasRealData = allProjects.length > 0 || Object.values(results).some(r => !r.note);

    return {
      siteId,
      siteName: site.name,
      coordinates: { lat, lng },
      searchRadiusKm,
      registries: results,
      matchedProjects: allProjects,
      hasMatches: allProjects.length > 0,
      summaryStatus: allProjects.length > 0 ? 'registered' : 'unregistered',
      demo: !hasRealData,
    };
  }

  // ── Check all sites ──
  async function checkAllSites() {
    if (!Data) return {};
    const results = {};
    for (const site of Data.sites) {
      results[site.id] = await checkSite(site.id);
    }
    return results;
  }

  // ── Render registry card for UI ──
  function renderRegistryCard(checkResult) {
    if (!checkResult) return '<p>No data</p>';
    const { siteName, coordinates, searchRadiusKm, registries, matchedProjects, summaryStatus, demo } = checkResult;

    const statusColors = {
      registered: 'var(--leaf)',
      unregistered: 'var(--text3)',
    };

    let regHtml = '';
    for (const [key, reg] of Object.entries(registries)) {
      const projCount = reg.projects ? reg.projects.length : 0;
      const icon = projCount > 0 ? '✅' : reg.note ? '📋' : '🔍';
      regHtml += `<div class="reg-entry">
        <span class="reg-name">${reg.registry}</span>
        ${projCount > 0
          ? `<span class="reg-count">${projCount} project${projCount > 1 ? 's' : ''}</span>`
          : `<span class="reg-note">${reg.note || 'No projects found'}</span>`
        }
        ${reg.url ? `<a href="${reg.url}" target="_blank" rel="noopener" class="reg-link">View Registry →</a>` : ''}
      </div>`;

      if (reg.projects && reg.projects.length > 0) {
        regHtml += '<div class="reg-projects">';
        for (const proj of reg.projects) {
          regHtml += `<div class="reg-project">
            <strong>${proj.title}</strong>
            <div class="rp-meta">
              <span>ID: ${proj.id}</span>
              <span>Status: ${proj.status}</span>
              ${proj.methodologies ? `<span>Methods: ${proj.methodologies.join(', ')}</span>` : ''}
              ${proj.sdgs ? `<span>SDGs: ${proj.sdgs.join(', ')}</span>` : ''}
              ${proj.crediting_period ? `<span>Period: ${proj.crediting_period}</span>` : ''}
              ${proj.url ? `<a href="${proj.url}" target="_blank" class="reg-link">Details →</a>` : ''}
            </div>
          </div>`;
        }
        regHtml += '</div>';
      }
    }

    return `
      <div class="registry-card">
        <div class="reg-header">
          <h4>${siteName}</h4>
          <span class="reg-status" style="color:${statusColors[summaryStatus] || 'var(--text3)'}">
            ${summaryStatus === 'registered' ? '🔗 Registered in at least 1 registry' : '⚪ Not yet registered'}
          </span>
          ${demo ? '<span style="font-size:8px;background:rgba(139,159,199,0.15);color:#8b9fc7;padding:1px 5px;border-radius:3px;margin-left:4px;">DEMO</span>' : ''}
        </div>
        <div class="reg-coords">
          ${coordinates.lat.toFixed(3)}°, ${coordinates.lng.toFixed(3)}° · ±${searchRadiusKm} km
        </div>
        ${regHtml || '<p style="font-size:10px;color:var(--text3)">No public registry data found. Manual verification recommended.</p>'}
        ${demo ? '<p style="font-size:9px;color:#8b9fc7;margin-top:8px;">🛰 Demo mode — registry APIs require authentication. Showing sample data.</p>' : ''}
      </div>
    `;
  }

  // ── Quick badge for site-panel ──
  function renderRegistryBadge(checkResult) {
    if (!checkResult) return { icon: '❓', label: 'No data', color: 'var(--text3)' };

    const count = checkResult.matchedProjects.length;
    if (count > 0) {
      return {
        icon: '🔗',
        label: `${count} registered project${count > 1 ? 's' : ''} found`,
        color: 'var(--leaf)',
      };
    }
    return {
      icon: '📋',
      label: 'Not yet registered',
      color: 'var(--text3)',
    };
  }

  return {
    checkSite,
    checkAllSites,
    renderRegistryCard,
    renderRegistryBadge,
    REGISTRIES,
  };
})();

// Auto-init check if Data is ready
if (typeof Data !== 'undefined') {
  console.log('[RegistryCheck] Module ready — call RegistryCheck.checkSite(id) to verify');
}

/* ══ js/app.js ══ */
// ═══════════════════════════════════════════════
// APP — Init, navigation, scroll progress, events
// GAIA Foundation Layer integration
// ═══════════════════════════════════════════════

window.App = {
  async init() {
    // Load data first
    try {
      await Data.init();
    } catch (err) {
      console.error('[App] Data.init() failed:', err);
      // Show user-visible error so the page isn't silently broken
      const hero = document.getElementById('hero');
      if (hero) {
        const existing = hero.querySelector('.data-error-banner');
        if (!existing) {
          const banner = document.createElement('div');
          banner.className = 'data-error-banner';
          banner.style.cssText = 'background:rgba(196,92,74,0.15);border:1px solid rgba(196,92,74,0.3);border-radius:8px;padding:12px 16px;margin:12px 0;font-size:12px;color:var(--warn);line-height:1.6;';
          banner.innerHTML = '⚠️ Could not load site data. Some features may be unavailable. <button onclick="location.reload()" style="background:rgba(196,92,74,0.2);border:1px solid rgba(196,92,74,0.3);border-radius:4px;color:var(--warn);padding:2px 8px;cursor:pointer;font-size:11px;margin-left:8px;">Retry</button>';
          hero.querySelector('.hero-inner')?.insertBefore(banner, hero.querySelector('.hero-inner').firstChild)
            || hero.insertBefore(banner, hero.firstChild);
        }
      }
      // Continue init -- modules that depend on Data will handle undefined gracefully
    }

    // ── GAIA Nodes — register site content + wire globe ──
    if (typeof GAIA_NODES !== 'undefined') {
      GAIA_NODES.init();
      GAIA_NODES.populateSiteData();
    }

    // ── Carbon Clock — starts ticking immediately ──
    if (typeof CARBON_CLOCK !== 'undefined') {
      CARBON_CLOCK.init();
    }

    // ── Delegation Greeting — personalized country entry ──
    if (typeof DELEGATION !== 'undefined') {
      DELEGATION.init();
    }

    // ── Pledge Wall — public commitments ──
    if (typeof PLEDGE_WALL !== 'undefined') {
      PLEDGE_WALL.init();
    }

    // Init all existing modules
    GlobeModule.init();
    Quiz.init();
    Biomes.init();
    Scenario.init();

    // ── GAIA Foundation Layer ──
    // Fetch live data in background
    GAIA_DATA.refreshAll().then(liveData => {
      GAIA_DATA.saveSnapshot(liveData);
      if (liveData.co2.latest) {
        GAIA_DATA.saveVisitInfo(liveData.co2.latest);
      }
    });

    // Session tracking
    const sess = GAIA_DATA.getSessionInfo();
    const now = Date.now();
    if (!sess.firstVisit) {
      GAIA_DATA.saveSessionInfo({ visitCount: 1, firstVisit: now, totalTimeSeconds: 0 });
    } else {
      GAIA_DATA.saveSessionInfo({ ...sess, visitCount: sess.visitCount + 1 });
      // Welcome back
      const wb = GAIA_DATA.getWelcomeBackInfo();
      if (wb && wb.daysSince > 0) {
        const days = wb.daysSince;
        const _snap = GAIA_DATA.getCachedSnapshot();
        const co2Now = (_snap && _snap.co2 && _snap.co2.latest) ? _snap.co2.latest : (wb.co2Then ? (wb.co2Then + 2.7 * (days / 365)) : 431.12);
        const co2Then = wb.co2Then;
        const co2Diff = co2Then ? +(co2Now - co2Then).toFixed(2) : null;
        let msg = days === 1 ? 'Welcome back. One day.' : `Welcome back. ${days} days.`;
        if (co2Diff && co2Diff > 0) msg += ` CO₂: ${co2Then.toFixed(1)} → ${co2Now.toFixed(1)} ppm. +${co2Diff}. Not a pause. Accumulation.`;
        setTimeout(() => {
          if (typeof GAIA_BUBBLE !== 'undefined') {
            GAIA_BUBBLE.speak(msg, 'warm', 6000);
          }
        }, 1500);
      }
    }

    // ── Pending pledge from previous visit ──
    // If user left without pledging (detected via visibilitychange/beforeunload),
    // show a gentle reminder on their next visit.
    try {
      const pendingPledge = localStorage.getItem('gaia_pending_pledge');
      if (pendingPledge && typeof PLEDGE_WALL !== 'undefined' && !PLEDGE_WALL.hasPledged()) {
        const pending = JSON.parse(pendingPledge);
        // Only show if they were engaged (score >= 20) and it's been at least 1 hour
        if (pending.score >= 20 && Date.now() - pending.timestamp > 3600000) {
          setTimeout(() => {
            if (typeof GAIA_BUBBLE !== 'undefined') {
              GAIA_BUBBLE.speak("You were exploring last time. The carbon clock is still ticking. Before you go again — what's your pledge?", 'warm', 8000);
            }
          }, 3000);
        }
        // Clear the pending flag
        localStorage.removeItem('gaia_pending_pledge');
      }
    } catch { /* ignore */ }

    // Create GAIA bubble — always visible after entering
    if (typeof GAIA_BUBBLE !== 'undefined') {
      GAIA_BUBBLE.create();
    }

    // Speak greeting after hero
    setTimeout(() => {
      if (typeof GAIA_BUBBLE !== 'undefined') {
        const line = GAIA_VOICE.speak('GREETING', null, 'mysterious');
        if (line) GAIA_BUBBLE.speak(line.text, line.tone, 8000);
      }
    }, 2000);

    // Idle nudge loop
    setInterval(() => {
      const nudge = GAIA_ENGAGEMENT.shouldFireIdleNudge();
      if (nudge && typeof GAIA_BUBBLE !== 'undefined') {
        GAIA_BUBBLE.idleNudge();
      }
    }, 5000);

    // ── Render site cards ──
    const sitesGrid = document.getElementById('sites-grid');
    if (sitesGrid) {
      sitesGrid.innerHTML = Data.sites.map(s => `
        <div class="site-card" onclick="flyToSite('${s.id}')">
          <div class="site-icon">${s.id === 'sri_lanka' ? '🌳' : s.id === 'antalya' ? '🔥' : s.id === 'benin' ? '🌿' : '🌴'}</div>
          <div class="site-name">${s.name}</div>
          <div class="site-loc">${s.id === 'sri_lanka' ? 'SRI LANKA' : s.id === 'antalya' ? 'TURKEY' : s.id === 'benin' ? 'BENIN' : 'BORNEO'}</div>
          <div class="site-desc">${s.narrative.substring(0, 120)}...</div>
          <div class="site-stat">${s.area.toLocaleString()} ha · ${Data.getBiome(s.primaryBiome).name}</div>
        </div>
      `).join('');
    }

    // ── Scroll reveals ──
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          if (e.target.querySelector('#imbalance-counters')) Counters.animate();
          if (e.target.querySelector('#compare-bars')) Biomes.animateBars();
          if (e.target.querySelector('#biome-cards')) Biomes.animateBiomeCards();
        }
      });
    }, { threshold: 0.2 });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

    // ── Scroll progress ──
    const progressBar = document.getElementById('scroll-progress');
    const sectionsEl = document.querySelector('.sections');
    const footerEl = document.querySelector('.footer');
    let _scrollRAF = null;
    const updateProgress = () => {
      if (_scrollRAF) return;
      _scrollRAF = requestAnimationFrame(() => {
        _scrollRAF = null;
        if (!sectionsEl || !footerEl || !progressBar) { progressBar && (progressBar.style.width = '0'); return; }
        const start = sectionsEl.offsetTop;
        const end = footerEl.offsetTop + footerEl.offsetHeight - window.innerHeight;
        const current = window.scrollY;
        if (current <= start) { progressBar.style.width = '0'; return; }
        if (current >= end) { progressBar.style.width = '100%'; return; }
        progressBar.style.width = ((current - start) / (end - start) * 100) + '%';
      });
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();

    // ── Panel close ──
    const closeBtn = document.getElementById('panel-close-btn');
    const backdrop = document.getElementById('panel-backdrop');
    const onClose = (e) => { if (e.type === 'touchstart') e.preventDefault(); e.stopPropagation(); Panel.close(); };
    if (closeBtn) {
      closeBtn.addEventListener('click', onClose, true);
      closeBtn.addEventListener('touchstart', onClose, { passive: false, capture: true });
    }
    if (backdrop) {
      backdrop.addEventListener('click', onClose);
      backdrop.addEventListener('touchstart', onClose, { passive: false });
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Panel.close(); });

    // ── Track all interactions for engagement ──
    document.addEventListener('click', () => GAIA_ENGAGEMENT.interact());
    document.addEventListener('scroll', () => GAIA_ENGAGEMENT.interact(), { passive: true });
    document.addEventListener('keydown', () => GAIA_ENGAGEMENT.interact());
  },

  enterSite() {
    document.getElementById('hero').classList.add('hidden');
    document.getElementById('topbar').classList.add('visible');
    setTimeout(() => { document.getElementById('quiz').scrollIntoView({ behavior: 'smooth' }); }, 300);
    GAIA_ENGAGEMENT.interact();
  },

  flyToSite(id) {
    const site = Data.getSite(id);
    if (site) {
      // Use GAIA Nodes (globe overlay) if available
      if (typeof GAIA_NODES !== 'undefined') {
        GAIA_NODES.onNodeClick(id);
      } else if (typeof SITE_PANEL !== 'undefined') {
        SITE_PANEL.open(site);
      } else {
        Panel.open(site);
      }
    }
  }
};

// Global enter button
function enterSite() { App.enterSite(); }
function flyToSite(id) { App.flyToSite(id); }
function showCycle(key) { Cycle.show(key); }

// Start — handle both async and already-loaded DOM
function startApp() {
  if (typeof GlobeModule === 'undefined' || typeof Data === 'undefined') {
    setTimeout(startApp, 100);
    return;
  }
  App.init();
}

// Departure trigger — prompt pledge if user is leaving without pledging
// Strategy: use visibilitychange (reliable, can show UI) as the primary
// trigger, and beforeunload as a last-resort signal (can't show UI but
// can persist a "returning user" flag for next visit).
let _departurePrompted = false;

// Primary: visibilitychange fires when user switches tabs, minimizes, or
// navigates away. This is reliable and allows DOM manipulation.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && !_departurePrompted) {
    _departurePrompted = true;
    if (typeof PLEDGE_WALL !== 'undefined') {
      const score = typeof GAIA_ENGAGEMENT !== 'undefined' ? GAIA_ENGAGEMENT.getScore() : 0;
      if (score >= 20 && !PLEDGE_WALL.hasPledged()) {
        // Persist a "pending pledge" flag so we can show a prompt on next visit
        try {
          localStorage.setItem('gaia_pending_pledge', JSON.stringify({
            score,
            timestamp: Date.now(),
            source: 'departure',
          }));
        } catch { /* ignore */ }
      }
    }
  }
});

// Last resort: beforeunload fires when the page is being unloaded.
// Modern browsers restrict DOM manipulation here, so we only persist state.
window.addEventListener('beforeunload', () => {
  if (_departurePrompted) return; // already handled by visibilitychange
  if (typeof PLEDGE_WALL !== 'undefined') {
    const score = typeof GAIA_ENGAGEMENT !== 'undefined' ? GAIA_ENGAGEMENT.getScore() : 0;
    if (score >= 20 && !PLEDGE_WALL.hasPledged()) {
      try {
        localStorage.setItem('gaia_pending_pledge', JSON.stringify({
          score,
          timestamp: Date.now(),
          source: 'beforeunload',
        }));
      } catch { /* ignore */ }
    }
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

