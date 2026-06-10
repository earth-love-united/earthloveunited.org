// ═══════════════════════════════════════════════
// CARBON SHADOW — Where do you stand?
//
// First principles: carbon comes from what you consume,
// what you enable, and what you control.
//
// No forms. No "advanced mode." No typing numbers.
// Just brackets that feel like identity.
//
// Left:  Lifestyle brackets (food, home, transport, stuff)
// Right: The live global curve + organizational layer
//
// The curve updates on every tap. The engagement loop:
// "I'm average... but what if I add my company? ...whoa."
// ═══════════════════════════════════════════════

const CARBON_SHADOW = (() => {
  // ── Emission factors ──
  const EF = {
    elec: 0.45,         // kg CO2/kWh global avg
    car: 0.21,          // kg CO2/km
    flight_km: 0.255,   // kg CO2/km incl. radiative forcing
    flight_dist: 2000,  // avg round-trip km
  };

  const ELEC = {
    CHN:.58, USA:.39, IND:.71, RUS:.41, JPN:.47, DEU:.34, IRN:.49, SAU:.51,
    KOR:.43, IDN:.65, BRA:.13, CAN:.13, MEX:.41, ZAF:.90, AUS:.65, GBR:.23,
    TUR:.44, ITA:.33, FRA:.06, POL:.66, THA:.50, EGY:.47, ESP:.20, ARG:.31,
    NGA:.52, VNM:.47, PAK:.48, BGD:.63, PHL:.58, ETH:.02, KEN:.13, COL:.16,
    UKR:.32,
  };

  // ── Lifestyle brackets ──
  // Each: label, annual tCO2, icon, description
  const FOOD_BRACKETS = [
    { t: 1.2,  icon: '🌱', label: 'Simple & local',     desc: 'Mostly home-cooked, local produce, minimal waste' },
    { t: 2.0,  icon: '🍽️', label: 'Mixed diet',          desc: 'Regular meals out, some delivery, balanced diet' },
    { t: 2.8,  icon: '🥩', label: 'Heavy meat & delivery', desc: 'Frequent meat, food delivery, imported items' },
    { t: 3.8,  icon: '🚀', label: 'High-carbon eater',   desc: 'Daily delivery, lots of beef, high food waste' },
  ];

  const HOME_BRACKETS = [
    { t: 0.8,  icon: '🏢', label: 'Shared / small',      desc: 'Apartment, shared housing, efficient' },
    { t: 1.5,  icon: '🏠', label: 'Average household',   desc: 'House or large apartment, moderate energy' },
    { t: 2.5,  icon: '🏡', label: 'Large home',           desc: 'Large house, high heating/cooling' },
    { t: 4.0,  icon: '🏰', label: 'Very large / estate',  desc: 'Multiple homes, high energy use' },
  ];

  const TRANSPORT_BRACKETS = [
    { t: 0.3,  icon: '🚲', label: 'No car / minimal',    desc: 'Walk, bike, public transit only' },
    { t: 1.5,  icon: '🚗', label: 'Moderate driver',      desc: 'Daily commute, some road trips' },
    { t: 3.0,  icon: '🚙', label: 'Heavy driver',         desc: 'Long commute, frequent driving' },
    { t: 5.0,  icon: '✈️', label: 'Driver + flyer',       desc: 'Heavy driving plus regular flights' },
    { t: 8.0,  icon: '🛫', label: 'Frequent flyer',       desc: 'Multiple long-haul flights per year' },
  ];

  const STUFF_BRACKETS = [
    { t: 0.5,  icon: '📦', label: 'Minimal consumer',    desc: 'Buy little, repair, secondhand' },
    { t: 1.5,  icon: '🛒', label: 'Average shopper',     desc: 'Normal consumption, some new items' },
    { t: 3.0,  icon: '🛍️', label: 'Frequent buyer',      desc: 'Regular shopping, fashion, electronics' },
    { t: 5.0,  icon: '💎', label: 'High consumption',    desc: 'Always upgrading, luxury goods, fast fashion' },
  ];

  // ── Organization brackets ──
  const ORG_BRACKETS = [
    { t: 0,     icon: '👤', label: 'I work for someone',      desc: 'Employee, no ownership stake' },
    { t: 50,    icon: '🔧', label: 'Solo / micro business',    desc: 'Freelancer, 1-10 employees' },
    { t: 500,   icon: '🏪', label: 'Small operation',          desc: '11-50 employees, local business' },
    { t: 5000,  icon: '🏭', label: 'Medium enterprise',       desc: '50-500 employees, significant output' },
    { t: 50000, icon: '🏢', label: 'Large enterprise',         desc: '500+ employees, major operation' },
    { t: 200000,icon: '🌐', label: 'Major corporation',        desc: '5000+ employees, global reach' },
  ];

  const BOARD_BRACKETS = [
    { t: 0,     icon: '○', label: 'None',        desc: 'No board seats' },
    { t: 25000, icon: '🪑', label: '1 seat',      desc: 'Board member at one organization' },
    { t: 75000, icon: '🪑🪑', label: '2-3 seats',  desc: 'Multiple board positions' },
    { t: 200000,icon: '🪑🪑🪑', label: '4+ seats',   desc: 'Serial board member, significant governance' },
  ];

  const INVEST_BRACKETS = [
    { t: 0,       icon: '○',   label: 'None',         desc: 'No significant fossil investments' },
    { t: 50,      icon: '💵',   label: 'Minor',         desc: '< $100K in fossil fuels' },
    { t: 500,     icon: '💰',   label: 'Moderate',      desc: '$100K - $1M' },
    { t: 5000,    icon: '💎',   label: 'HNWI',          desc: '$1M - $10M' },
    { t: 25000,   icon: '🏦',   label: 'Significant',   desc: '$10M - $50M' },
    { t: 100000,  icon: '👑',   label: 'UHNWI',         desc: '$50M+ in fossil capital' },
  ];

  // ── Bell curve ──
  const BUCKETS = [
    { max: 2,       label: 'Minimal',       color: 'var(--leaf)' },
    { max: 5,       label: 'Below Average', color: 'var(--teal)' },
    { max: 10,      label: 'Average',       color: 'var(--text2)' },
    { max: 25,      label: 'Above Average', color: 'var(--amber)' },
    { max: 100,     label: 'High',          color: 'var(--warn)' },
    { max: 1000,    label: 'Very High',     color: '#ff6b6b' },
    { max: 10000,   label: 'Extreme',       color: '#ff4444' },
    { max: Infinity,label: 'Rarefied',       color: '#ff2222' },
  ];

  const GLOBAL_AVG = 4.8;

  // ── State ──
  let _init = false, _c = null;
  let _country = 'USA';
  let _foodIdx = 1, _homeIdx = 1, _transIdx = 1, _stuffIdx = 1;
  let _orgIdx = 0, _boardIdx = 0, _invIdx = 0;

  // ── Helpers ──
  function _topEmitters() {
    if (!hasModule('Data') || !Data.pledgeNodes) return [];
    return [...Data.pledgeNodes].sort((a,b)=>(b.fossil_co2_mt||0)-(a.fossil_co2_mt||0)).slice(0,30);
  }
  function _ef(iso) { return ELEC[iso] || EF.elec; }
  function _fmt(n) {
    if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
    if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
    if (n >= 1e3) return (n/1e3).toFixed(0)+'K';
    return n.toFixed(n < 10 ? 1 : 0);
  }

  function _consumerCO2() {
    const food = FOOD_BRACKETS[_foodIdx]?.t || 2;
    const home = HOME_BRACKETS[_homeIdx]?.t || 1.5;
    const trans = TRANSPORT_BRACKETS[_transIdx]?.t || 1.5;
    const stuff = STUFF_BRACKETS[_stuffIdx]?.t || 1.5;
    return { total: food + home + trans + stuff, food, home, trans, stuff };
  }

  function _structuralCO2() {
    const parts = [];
    let total = 0;

    const orgT = ORG_BRACKETS[_orgIdx]?.t || 0;
    if (orgT > 0) {
      total += orgT;
      parts.push({ icon: ORG_BRACKETS[_orgIdx].icon, label: ORG_BRACKETS[_orgIdx].label, desc: ORG_BRACKETS[_orgIdx].desc, value: orgT });
    }

    const boardT = BOARD_BRACKETS[_boardIdx]?.t || 0;
    if (boardT > 0) {
      total += boardT;
      parts.push({ icon: BOARD_BRACKETS[_boardIdx].icon, label: BOARD_BRACKETS[_boardIdx].label, desc: BOARD_BRACKETS[_boardIdx].desc, value: boardT });
    }

    const invT = INVEST_BRACKETS[_invIdx]?.t || 0;
    if (invT > 0) {
      total += invT;
      parts.push({ icon: INVEST_BRACKETS[_invIdx].icon, label: INVEST_BRACKETS[_invIdx].label, desc: INVEST_BRACKETS[_invIdx].desc, value: invT });
    }

    return { total, parts };
  }

  function _percentile(tons) {
    if (tons <= 0) return 50;
    return Math.min(99.99, Math.max(0.01, 50 + 50 * Math.tanh((Math.log10(Math.max(tons,0.1)) - Math.log10(5)) / 1.5 * 0.7)));
  }

  function _bucketIdx(tons) {
    for (let i = 0; i < BUCKETS.length; i++) if (tons <= BUCKETS[i].max) return i;
    return BUCKETS.length - 1;
  }

  function _restoration(annual) {
    if (!hasModule('Data') || !Data.biomes) return null;
    const targets = ['mangrove','tropical_rainforest','wetland_peatland','temperate_deciduous'];
    let biome = null;
    for (const k of targets) { const b = Data.getBiome(k); if (b?.seq > 0) { biome = { key: k, ...b }; break; } }
    if (!biome) { const f = Data.getAllBiomes().find(b => b.seq > 0); if (f) biome = f; }
    if (!biome || !Data.getBiome('degraded_bare_land')) return null;
    const target = annual * 30; let lo = 1, hi = 2e6;
    for (let i = 0; i < 50; i++) { const m = Math.floor((lo+hi)/2); const r = Data.transitionCarbon('degraded_bare_land',biome.key,m,30); if (!r) break; if (r.cumulative_co2 >= target) hi = m; else lo = m+1; }
    return { biome, hectares: Math.max(1, hi) };
  }

  // ── Render a bracket selector ──
  function _bracketHTML(brackets, selectedIdx, dataAttr) {
    return `<div class="cs-bracket" data-bracket="${dataAttr}">` +
      brackets.map((b, i) => `<button class="cs-br-btn${i===selectedIdx?' active':''}" data-idx="${i}" type="button"><span class="cs-br-icon">${b.icon}</span><span class="cs-br-lbl">${b.label}</span></button>`).join('') +
      '</div>';
  }

  function _bellCurveHTML(percentile, color) {
    const w = 320;
    const h = 128;
    const base = 106;
    const peak = 78;
    const pts = [];
    for (let i = 0; i <= 72; i++) {
      const x = (i / 72) * w;
      const t = (i / 72) * 6 - 3;
      const y = base - Math.exp(-0.5 * t * t) * peak;
      pts.push(x.toFixed(1) + ',' + y.toFixed(1));
    }
    const markerX = Math.min(w - 10, Math.max(10, (percentile / 100) * w));
    const markerT = (markerX / w) * 6 - 3;
    const markerY = base - Math.exp(-0.5 * markerT * markerT) * peak;

    return `
      <svg class="cs-bell-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Carbon shadow percentile distribution">
        <path class="cs-bell-area" d="M 0 ${base} L ${pts.join(' L ')} L ${w} ${base} Z"></path>
        <polyline class="cs-bell-line" points="${pts.join(' ')}"></polyline>
        <line class="cs-bell-marker" x1="${markerX.toFixed(1)}" y1="${(markerY - 7).toFixed(1)}" x2="${markerX.toFixed(1)}" y2="${base + 8}" style="stroke:${color}"></line>
        <circle class="cs-bell-dot" cx="${markerX.toFixed(1)}" cy="${markerY.toFixed(1)}" r="5" style="fill:${color}"></circle>
        <line class="cs-bell-base" x1="0" y1="${base}" x2="${w}" y2="${base}"></line>
      </svg>`;
  }

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  function _render() {
    const countries = _topEmitters();
    const cOpts = countries.map(n => `<option value="${n.iso}">${n.country}</option>`).join('');

    _c.innerHTML = `
    <div class="cs-wrap">
      <div class="cs-panels">
        <!-- LEFT -->
        <div class="cs-left">
          <div class="cs-sec">
            <div class="cs-sec-title">🌍 Country</div>
            <select id="cs-country" class="cs-sel">${cOpts}</select>
          </div>

          <div class="cs-sec">
            <div class="cs-sec-title">🍽️ Food & Diet</div>
            ${_bracketHTML(FOOD_BRACKETS, _foodIdx, 'food')}
            <div class="cs-br-desc" id="cs-food-desc">${FOOD_BRACKETS[_foodIdx]?.desc || ''}</div>
          </div>

          <div class="cs-sec">
            <div class="cs-sec-title">🏠 Home & Energy</div>
            ${_bracketHTML(HOME_BRACKETS, _homeIdx, 'home')}
            <div class="cs-br-desc" id="cs-home-desc">${HOME_BRACKETS[_homeIdx]?.desc || ''}</div>
          </div>

          <div class="cs-sec">
            <div class="cs-sec-title">🚗 Transport</div>
            ${_bracketHTML(TRANSPORT_BRACKETS, _transIdx, 'trans')}
            <div class="cs-br-desc" id="cs-trans-desc">${TRANSPORT_BRACKETS[_transIdx]?.desc || ''}</div>
          </div>

          <div class="cs-sec">
            <div class="cs-sec-title">🛒 Stuff & Consumption</div>
            ${_bracketHTML(STUFF_BRACKETS, _stuffIdx, 'stuff')}
            <div class="cs-br-desc" id="cs-stuff-desc">${STUFF_BRACKETS[_stuffIdx]?.desc || ''}</div>
          </div>

          <div class="cs-sec">
            <div class="cs-sec-title">🏢 Organization</div>
            ${_bracketHTML(ORG_BRACKETS, _orgIdx, 'org')}
            <div class="cs-br-desc" id="cs-org-desc">${ORG_BRACKETS[_orgIdx]?.desc || ''}</div>
          </div>

          <div class="cs-sec">
            <div class="cs-sec-title">🪑 Board Seats</div>
            ${_bracketHTML(BOARD_BRACKETS, _boardIdx, 'board')}
            <div class="cs-br-desc" id="cs-board-desc">${BOARD_BRACKETS[_boardIdx]?.desc || ''}</div>
          </div>

          <div class="cs-sec">
            <div class="cs-sec-title">💰 Fossil Investments</div>
            ${_bracketHTML(INVEST_BRACKETS, _invIdx, 'inv')}
            <div class="cs-br-desc" id="cs-inv-desc">${INVEST_BRACKETS[_invIdx]?.desc || ''}</div>
          </div>
        </div>

        <!-- RIGHT: Live dashboard -->
        <div class="cs-right">
          <div class="cs-live-header">
            <div class="cs-live-title">Your Carbon Shadow</div>
            <div class="cs-live-number" id="cs-live-num">—</div>
            <div class="cs-live-ratio" id="cs-live-ratio"></div>
          </div>

          <div class="cs-curve">
            <div class="cs-curve-title">Global Distribution</div>
            <div class="cs-curve-pct" id="cs-curve-pct">Tap brackets to begin →</div>
            <div class="cs-bell" id="cs-bell-curve"></div>
            <div class="cs-bell-axis"><span>Lower</span><span>Median</span><span>Higher</span></div>
            <div class="cs-curve-bucket" id="cs-curve-bucket"></div>
          </div>

          <div class="cs-struct" id="cs-struct"></div>
          <div class="cs-rest" id="cs-rest"></div>

          <div class="cs-gaia">
            <a href="gaia.html" class="cs-gaia-link">🤖 Ask GAIA about your shadow</a>
          </div>
        </div>
      </div>
    </div>`;

    _wire();
    _update();
  }

  // ═══════════════════════════════════════════
  // WIRE
  // ═══════════════════════════════════════════
  function _wire() {
    if (!_c) return;

    // Country
    const _countryEl = $('cs-country');
    if (_countryEl) _countryEl.addEventListener('change', () => { _country = _countryEl.value; _update(); });

    // All bracket buttons
    const bracketMap = {
      food: (i) => { _foodIdx = i; $('cs-food-desc').textContent = FOOD_BRACKETS[i]?.desc || ''; },
      home: (i) => { _homeIdx = i; $('cs-home-desc').textContent = HOME_BRACKETS[i]?.desc || ''; },
      trans: (i) => { _transIdx = i; $('cs-trans-desc').textContent = TRANSPORT_BRACKETS[i]?.desc || ''; },
      stuff: (i) => { _stuffIdx = i; $('cs-stuff-desc').textContent = STUFF_BRACKETS[i]?.desc || ''; },
      org: (i) => { _orgIdx = i; $('cs-org-desc').textContent = ORG_BRACKETS[i]?.desc || ''; },
      board: (i) => { _boardIdx = i; $('cs-board-desc').textContent = BOARD_BRACKETS[i]?.desc || ''; },
      inv: (i) => { _invIdx = i; $('cs-inv-desc').textContent = INVEST_BRACKETS[i]?.desc || ''; },
    };

    _c.querySelectorAll('[data-bracket]').forEach(container => {
      const name = container.dataset.bracket;
      const handler = bracketMap[name];
      container.querySelectorAll('.cs-br-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.cs-br-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (handler) handler(parseInt(btn.dataset.idx));
          _update();
        });
      });
    });
  }

  // ═══════════════════════════════════════════
  // UPDATE
  // ═══════════════════════════════════════════
  function _update() {
    const con = _consumerCO2();
    const struct = _structuralCO2();
    const grand = con.total + struct.total;
    const pct = _percentile(grand);
    const bi = _bucketIdx(grand);
    const bucket = BUCKETS[bi];

    // Number
    const numEl = $('cs-live-num');
    if (numEl) { numEl.textContent = _fmt(grand) + ' t CO₂/yr'; numEl.style.color = bucket.color; }

    // Ratio
    const ratioEl = $('cs-live-ratio');
    if (ratioEl) {
      const parts = [];
      if (con.total > 0) parts.push(`<span><span class="cs-dot" style="background:var(--teal)"></span>Lifestyle: ${con.total.toFixed(1)}t</span>`);
      if (struct.total > 0) parts.push(`<span><span class="cs-dot" style="background:var(--warn)"></span>Structural: ${_fmt(struct.total)}t</span>`);
      ratioEl.innerHTML = parts.join('');
    }

    // Curve percentile
    const pctEl = $('cs-curve-pct');
    if (pctEl) {
      const rarity = pct >= 99 ? `Top ${(100-pct).toFixed(2)}% — exceptionally rare` :
                     pct >= 95 ? `Top ${(100-pct).toFixed(1)}% — very rare` :
                     pct >= 90 ? `Top ${(100-pct).toFixed(0)}% — rare` :
                     pct >= 70 ? `Top ${(100-pct).toFixed(0)}% — uncommon` :
                     pct >= 50 ? 'Above median' : 'Below median';
      pctEl.innerHTML = `<span style="color:${bucket.color}">${pct.toFixed(1)}%</span> &nbsp; ${rarity}`;
    }

    // Bell curve
    const bellEl = $('cs-bell-curve');
    if (bellEl) bellEl.innerHTML = _bellCurveHTML(pct, bucket.color);

    const bucketEl = $('cs-curve-bucket');
    if (bucketEl) bucketEl.innerHTML = `<span style="color:${bucket.color}">●</span> ${bucket.label}`;

    // Structural breakdown
    const structEl = $('cs-struct');
    if (structEl) {
      if (struct.parts.length > 0) {
        structEl.innerHTML = `<div class="cs-struct-title">Structural Carbon</div>` +
          struct.parts.map(p =>
            `<div class="cs-struct-row"><span class="cs-struct-icon">${p.icon}</span><div class="cs-struct-info"><div class="cs-struct-lbl">${p.label}</div><div class="cs-struct-desc">${p.desc}</div></div><div class="cs-struct-val">${_fmt(p.value)} t</div></div>`
          ).join('');
      } else {
        structEl.innerHTML = `<div class="cs-struct-empty">No structural carbon. If you own companies, serve on boards, or invest in fossil fuels, select those brackets above.</div>`;
      }
    }

    // Restoration
    const restEl = $('cs-rest');
    if (restEl) {
      const rest = _restoration(grand);
      if (rest) restEl.innerHTML = `<div class="cs-rest-title">Restoration Bridge</div><div class="cs-rest-body">Balance 30 years at <strong>${_fmt(grand)} t/yr</strong> by restoring <strong style="color:var(--leaf)">${_fmt(rest.hectares)} ha</strong> of ${rest.biome.icon||'🌿'} ${rest.biome.name}.</div>`;
    }

    safeCall('GAIA_ENGAGEMENT', 'addSignal', 'carbon_shadow_update');
  }

  // ── Public API ──
  function init() {
    if (_init) return; _init = true;
    _c = $('carbon-shadow-widget');
    if (!_c) { reportWarn('CARBON_SHADOW', 'Widget not found'); return; }
    if (!hasModule('Data') || !Data.pledgeNodes) { setTimeout(() => { if (hasModule('Data') && Data.pledgeNodes) safeCall('CARBON_SHADOW','init'); }, 1500); return; }
    try { _render(); console.log('[CARBON_SHADOW] Initialized'); } catch(e) { reportError('CARBON_SHADOW.init()', e); }
  }

  function switchMode() {} // no-op — single mode

  return { init, switchMode };
})();

window.CARBON_SHADOW = CARBON_SHADOW;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('CARBON_SHADOW', {
    provides: ['init', 'switchMode'],
    requires: ['Data'],
    emits: ['carbon-shadow:calculated'],
  });
}
