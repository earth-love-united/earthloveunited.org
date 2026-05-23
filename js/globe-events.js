// ═══════════════════════════════════════════════
// GLOBE EVENTS — Climate events & education mode
// Shows wildfires, floods, droughts, COPs, ELU sites
// Data: data/climate-events.json
// ═══════════════════════════════════════════════

const GLOBE_EVENTS = (() => {
  let _events = null;
  let _eonetEvents = [];
  let _active = false;
  let _initialized = false;
  let _previousPointsData = null;
  let _previousLabelsData = null;
  let _previousRingsData = null;

  // ── Event type → visual config ──
  const TYPE_COLORS = {
    fire:     { point: '#ff6b35', ring: 'rgba(255,107,53,', label: '#ff8c5a' },
    flood:    { point: '#3d9be9', ring: 'rgba(61,155,233,', label: '#6bb3f0' },
    drought:  { point: '#e6a817', ring: 'rgba(230,168,23,', label: '#f0c040' },
    storm:    { point: '#b088f9', ring: 'rgba(176,136,249,', label: '#cbb3fc' },
    volcano:  { point: '#e63946', ring: 'rgba(230,57,70,',   label: '#f07178' },
    cop:      { point: '#ffd700', ring: 'rgba(255,215,0,',  label: '#ffe44d' },
    elu_site: { point: '#4ecdc4', ring: 'rgba(78,205,196,', label: '#7be8d0' },
  };

  const SEVERITY_RADIUS = {
    moderate: 3,
    severe:   5,
    extreme:  7,
  };

  async function init() {
    if (_initialized) return;
    _initialized = true;

    try {
      const res = await fetch('data/climate-events.json');
      if (!res.ok) {
        reportWarn('GLOBE_EVENTS', `Events data not found (${res.status})`);
      } else {
        _events = await res.json();
        console.log(`[GLOBE_EVENTS] loaded static data — ${_events.length} events`);
      }

      try {
        const eonetRes = await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?days=30&status=open');
        if (eonetRes.ok) {
          const eonetData = await eonetRes.json();
          _eonetEvents = _parseEonetData(eonetData.events || []);
          console.log(`[GLOBE_EVENTS] loaded live NASA data — ${_eonetEvents.length} active events`);
          if (_active) activate();
        }
      } catch (e) {
        reportWarn('GLOBE_EVENTS', 'Failed to fetch NASA EONET data: ' + e.message);
      }
    } catch (err) {
      reportError('GLOBE_EVENTS.init()', err);
    }
  }

  function _parseEonetData(rawEvents) {
    const parsed = [];
    for (const e of rawEvents) {
      if (!e.geometry || !e.geometry.length) continue;
      const coords = e.geometry[0].coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      
      let type = 'fire';
      if (e.categories && e.categories.length > 0) {
         const catId = e.categories[0].id;
         if (catId === 'wildfires') type = 'fire';
         else if (catId === 'severeStorms') type = 'storm';
         else if (catId === 'floods' || catId === 'waterColor' || catId === 'seaIce') type = 'flood';
         else if (catId === 'volcanoes') type = 'volcano';
      }

      const date = new Date(e.geometry[0].date);
      parsed.push({
        lat: coords[1],
        lng: coords[0],
        name: e.title,
        type: type,
        severity: 'extreme', // Force rings
        year: date.getFullYear(),
        impact: 'LIVE EVENT — Data from NASA EONET',
        desc: e.description || `Active ${type} event tracked by NASA. Data updated in real-time.`,
        link: e.sources && e.sources.length > 0 ? e.sources[0].url : e.link,
        _isLive: true
      });
    }
    return parsed;
  }

  function activate() {
    if (!_events || !hasModule('GlobeModule') || !GlobeModule.world) return;
    _active = true;

    // Save current globe state so we can restore it on deactivate
    _previousPointsData = GlobeModule.world.pointsData();
    _previousLabelsData = GlobeModule.world.labelsData();
    _previousRingsData = GlobeModule.world.ringsData();

    // Build event points
    const allEvents = [...(_events || []), ..._eonetEvents];
    const eventPoints = allEvents.map(e => ({
      lat: e.lat,
      lng: e.lng,
      name: e.name,
      _type: 'event',
      _eventType: e.type,
      _severity: e.severity,
      _year: e.year,
      _impact: e.impact,
      _desc: e.desc,
      _link: e.link,
      _eluSite: e.elu_site,
      _isLive: e._isLive,
      id: e.name.toLowerCase().replace(/\s+/g, '_'),
    }));

    // Apply to globe
    GlobeModule.world
      .pointsData(eventPoints)
      .pointLat('lat').pointLng('lng')
      .pointAltitude(p => p._eventType === 'cop' ? 0.04 : 0.02)
      .pointRadius(p => {
        if (p._eventType === 'cop') return 0.8;
        if (p._eventType === 'elu_site') return 0.7;
        return 0.5;
      })
      .pointColor(p => TYPE_COLORS[p._eventType]?.point || '#ffffff')
      .pointResolution(16);

    // Labels
    GlobeModule.world
      .labelsData(eventPoints.filter(p => !p._isLive))
      .labelLat('lat').labelLng('lng')
      .labelText(p => {
        const year = p._year ? ` '${String(p._year).slice(-2)}` : '';
        return `${p.name}${year}`;
      })
      .labelSize(p => p._eventType === 'cop' ? 1.6 : 1.2)
      .labelDotRadius(0.3)
      .labelDotOrientation(() => 'bottom')
      .labelColor(p => TYPE_COLORS[p._eventType]?.label || 'rgba(255,255,255,0.8)')
      .labelResolution(3)
      .labelAltitude(p => p._eventType === 'cop' ? 0.05 : 0.03);

    // Rings — pulsing effect with type-based colors
    GlobeModule.world
      .ringsData(eventPoints.filter(p => p._severity === 'extreme' || p._eventType === 'cop' || p._isLive))
      .ringLat('lat').ringLng('lng')
      .ringColor(p => {
        const base = TYPE_COLORS[p._eventType]?.ring || 'rgba(255,255,255,';
        return t => `${base}${1 - t})`;
      })
      .ringMaxRadius(p => SEVERITY_RADIUS[p._severity] || 4)
      .ringPropagationSpeed(p => p._eventType === 'cop' ? 2 : 1.5)
      .ringRepeatPeriod(p => p._eventType === 'cop' ? 1500 : 1000);

    // Click handler for events
    GlobeModule.world.onPointClick(p => {
      // Mode handler intercepts when active (e.g. restoration)
      if (typeof _globeClickHandler !== 'undefined' && _globeClickHandler && p) {
        _globeClickHandler(p.lat, p.lng);
        return;
      }
      if (p._type === 'event') {
        _showEventInfo(p);
      }
    });

    // Color hexes subtly by event proximity (dim everything, highlight disaster areas)
    GlobeModule.setHexMode(
      () => 'rgba(40,40,50,0.08)',
      () => 0.001
    );

    console.log('[GLOBE_EVENTS] activated — showing', eventPoints.length, 'events');
  }

  function deactivate() {
    if (!hasModule('GlobeModule') || !GlobeModule.world) return;
    _active = false;

    // Restore previous globe state
    if (_previousPointsData) {
      GlobeModule.world.pointsData(_previousPointsData);
    }
    if (_previousLabelsData) {
      GlobeModule.world.labelsData(_previousLabelsData);
    }
    if (_previousRingsData) {
      GlobeModule.world.ringsData(_previousRingsData);
    }

    // Remove event info panel
    _hideEventInfo();

    // Restore original click handlers
    GlobeModule.world.onPointClick(site => {
      // Mode handler intercepts when active
      if (typeof _globeClickHandler !== 'undefined' && _globeClickHandler && site) {
        _globeClickHandler(site.lat, site.lng);
        return;
      }
      if (hasModule('GAIA_NODES')) {
        GAIA_NODES.onNodeClick(site.id);
      } else if (hasModule('SITE_PANEL')) {
        SITE_PANEL.open(site);
      }
    });
  }

  function _showEventInfo(p) {
    let panel = $('event-info-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'event-info-panel';
      panel.className = 'event-info-panel';
      document.body.appendChild(panel);
    }

    const typeLabel = {
      fire: '🔥 Wildfire', flood: '🌊 Flood', drought: '☀️ Drought',
      storm: '🌩️ Severe Storm', volcano: '🌋 Volcano',
      cop: '🌍 COP Summit', elu_site: '🌿 ELU Project',
    };

    const liveBadge = p._isLive ? '<div style="background:rgba(230,57,70,0.2);color:#ff6b6b;font-size:10px;font-weight:700;padding:4px 8px;border-radius:4px;display:inline-block;margin-bottom:8px;letter-spacing:1px;">🔴 LIVE NASA DATA</div>' : '';

    panel.innerHTML = `
      <button class="eip-close" onclick="this.parentElement.classList.remove('open')" aria-label="Close">×</button>
      <div class="eip-type" style="color:${TYPE_COLORS[p._eventType]?.point || '#fff'}">${typeLabel[p._eventType] || 'Event'}</div>
      ${liveBadge}
      <h3 class="eip-title">${p.name}</h3>
      <div class="eip-year">${p._year}</div>
      <div class="eip-impact">${p._impact}</div>
      <p class="eip-desc">${p._desc}</p>
      ${p._link ? `<a class="eip-link" href="${p._link}" target="_blank" rel="noopener">Learn more →</a>` : ''}
      ${p._eluSite ? `<button class="eip-explore" onclick="if(hasModule('GAIA_NODES'))GAIA_NODES.onNodeClick('${p._eluSite}')">Explore this site →</button>` : ''}
    `;
    panel.classList.add('open');

    // Track engagement
    safeCall('GAIA_ENGAGEMENT', 'addSignal', 'climate_view');
  }

  function _hideEventInfo() {
    const panel = $('event-info-panel');
    if (panel) panel.classList.remove('open');
  }

  return {
    init,
    activate,
    deactivate,
    getEvents: () => {
      const arr = [];
      if (_events) arr.push(..._events);
      if (_eonetEvents) arr.push(..._eonetEvents);
      return arr;
    },
    isActive: () => _active,
  };
})();
window.GLOBE_EVENTS = GLOBE_EVENTS;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GLOBE_EVENTS', {
    provides: ['init', 'activate', 'deactivate'],
    requires: ['GlobeModule'],
  });
}
