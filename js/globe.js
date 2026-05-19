// ═══════════════════════════════════════════════
// GLOBE — Globe.gl init, panel open/close
// ═══════════════════════════════════════════════

const GlobeModule = {
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
        if (window.GAIA_NODES) {
          window.GAIA_NODES.onNodeClick(site.id);
        } else if (window.SITE_PANEL) {
          window.SITE_PANEL.open(site);
        }
      })
      .onLabelClick(site => {
        if (window.GAIA_NODES) {
          window.GAIA_NODES.onNodeClick(site.id);
        } else if (window.SITE_PANEL) {
          window.SITE_PANEL.open(site);
        }
      })
      .onPointHover(site => {
        if (site && window.GAIA_NODES) {
          window.GAIA_NODES.onNodeHover(site.id);
        } else if (site && window.GAIA_PRESENCE) {
          window.GAIA_PRESENCE.speakTeaser(site.id);
          if (window.GAIA_ENGAGEMENT) window.GAIA_ENGAGEMENT.interact();
        }
      })
      .onLabelHover(site => {
        if (site && window.GAIA_NODES) {
          window.GAIA_NODES.onNodeHover(site.id);
        } else if (site && window.GAIA_PRESENCE) {
          window.GAIA_PRESENCE.speakTeaser(site.id);
          if (window.GAIA_ENGAGEMENT) window.GAIA_ENGAGEMENT.interact();
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
    this._initPledgeTooltip();
  },

  // ── Pledge nodes layer ──
  initPledgeNodes() {
    if (!Data.pledgeNodes || !Data.pledgeNodes.length) return;
    const pledgeNodes = Data.pledgeNodes;

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
        if (!p) {
          // Not hovering anything — hide tooltip
          window.dispatchEvent(new CustomEvent('pledgeHover', { detail: null }));
          return;
        }
        if (p._type === 'pledge') {
          const gap = p.reality_gap_mt;
          const status = gap === null ? 'No data' : (gap > 0 ? 'OVERSHOOTING' : 'On Track');
          window.dispatchEvent(new CustomEvent('pledgeHover', {
            detail: { node: p, tooltip: p.country + ' | ' + p.fossil_co2_mt + ' MtCO2 | ' + status }
          }));
        } else {
          // Site hover
          if (typeof GAIA_NODES !== 'undefined') {
            GAIA_NODES.onNodeHover(p.id);
          } else if (typeof GAIA_PRESENCE !== 'undefined') {
            GAIA_PRESENCE.speakTeaser(p.id);
            if (typeof GAIA_ENGAGEMENT !== 'undefined') GAIA_ENGAGEMENT.interact();
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
  },

  // ── Pledge tooltip (was incorrectly on PanelSlider) ──
  _initPledgeTooltip() {
    let tooltip = document.getElementById('pledge-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'pledge-tooltip';
      document.body.appendChild(tooltip);
    }

    window.addEventListener('pledgeHover', (e) => {
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

// ═══════════════════════════════════════════════
// PANEL — Side panel, sliders, sandbox
// ═══════════════════════════════════════════════

const Panel = {
  currentSite: null,
  selectedAction: null,
  selectedArea: 100,

  open(site) {
    this.currentSite = site;
    this.selectedAction = null;
    PanelSlider.reset();

    GlobeModule.world.pointOfView({ lat: site.lat, lng: site.lng, altitude: 0.8 }, 600);
    GlobeModule.world.controls().autoRotate = false;

    const biome = Data.getBiome(site.currentBiome) || { density: 0, name: 'Unknown' };
    const stock = biome.density * (site.area || 0) * 3.67;
    const latest = (site.ndvi && site.ndvi.length) ? site.ndvi[site.ndvi.length - 1] : { year: '—', value: 0, label: 'No data' };
    const cFirst = (site.climate && site.climate.length) ? site.climate[0] : { temp: 0, precip: 1, year: '—' };
    const cLast = (site.climate && site.climate.length) ? site.climate[site.climate.length - 1] : cFirst;
    const tD = (cLast.temp - cFirst.temp).toFixed(1);
    const pD = cFirst.precip ? ((cLast.precip - cFirst.precip) / cFirst.precip * 100).toFixed(0) : '0';

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

const PanelSlider = {
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

  // (initPledgeTooltip moved to GlobeModule._initPledgeTooltip)
};
