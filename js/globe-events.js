// ═══════════════════════════════════════════════
// GLOBE EVENTS — Climate events & education mode
// Shows wildfires, floods, droughts, COPs, ELU sites
// Data: data/climate-events.json
// ═══════════════════════════════════════════════

const GLOBE_EVENTS = (() => {
  let _events = null;
  let _eonetEvents = [];
  let _usgsEvents = [];
  let _active = false;
  let _initialized = false;
  let _previousPointsData = null;
  let _previousLabelsData = null;
  let _previousRingsData = null;

  let _mouseX = 0;
  let _mouseY = 0;

  // State for the events filter panel
  let _activeFilters = {
    live: true,
    historic: true,
    fire: true,
    earthquake: false, // OFF by default to reduce visual bloat
    volcano: true,
    storm: true,
    flood: true,
    drought: true,
    elu: true
  };

  // ── Event type → visual config ──
  const TYPE_COLORS = {
    fire:       { point: '#ff6b35', ring: 'rgba(255,107,53,', label: '#ff8c5a', text: '🔥 Wildfire' },
    flood:      { point: '#3d9be9', ring: 'rgba(61,155,233,', label: '#6bb3f0', text: '🌊 Flood' },
    drought:    { point: '#e6a817', ring: 'rgba(230,168,23,', label: '#f0c040', text: '☀️ Drought' },
    storm:      { point: '#b088f9', ring: 'rgba(176,136,249,', label: '#cbb3fc', text: '🌩️ Severe Storm' },
    volcano:    { point: '#e63946', ring: 'rgba(230,57,70,',   label: '#f07178', text: '🌋 Volcano' },
    earthquake: { point: '#f4a261', ring: 'rgba(244,162,97,', label: '#f8c49c', text: '💥 Earthquake' },
    cop:        { point: '#ffd700', ring: 'rgba(255,215,0,',  label: '#ffe44d', text: '🌍 COP Summit' },
    elu_site:   { point: '#4ecdc4', ring: 'rgba(78,205,196,', label: '#7be8d0', text: '🌿 ELU Project' },
  };

  const SEVERITY_RADIUS = {
    severe:   3,   // Small, subtle rings
    extreme:  14,  // MASSIVE rings for catastrophic events
  };

  async function init() {
    if (_initialized) return;
    _initialized = true;

    _initFilterUI();
    
    window.addEventListener('mousemove', e => {
      _mouseX = e.clientX;
      _mouseY = e.clientY;
      _updateHoverTooltipPos();
    });

    try {
      const res = await fetch('data/climate-events.json');
      if (!res.ok) {
        reportWarn('GLOBE_EVENTS', `Events data not found (${res.status})`);
      } else {
        _events = await res.json();
        console.log(`[GLOBE_EVENTS] loaded static data — ${_events.length} events`);
      }

      // NASA EONET
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

      // USGS Earthquakes
      try {
        const usgsRes = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson');
        if (usgsRes.ok) {
          const usgsData = await usgsRes.json();
          _usgsEvents = _parseUsgsData(usgsData.features || []);
          console.log(`[GLOBE_EVENTS] loaded live USGS data — ${_usgsEvents.length} active events`);
          if (_active) activate();
        }
      } catch (e) {
        reportWarn('GLOBE_EVENTS', 'Failed to fetch USGS data: ' + e.message);
      }

    } catch (err) {
      reportError('GLOBE_EVENTS.init()', err);
    }
  }

  function _initFilterUI() {
    const btns = document.querySelectorAll('.ef-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filterStr = e.target.getAttribute('data-filter');
        if (filterStr) {
          _activeFilters[filterStr] = !_activeFilters[filterStr];
          if (_activeFilters[filterStr]) {
            e.target.classList.add('active');
          } else {
            e.target.classList.remove('active');
          }
          if (_active) activate();
        }
      });
    });
  }

  function _parseEonetData(rawEvents) {
    const parsed = [];
    let wildfireCount = 0;
    
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

      // Limit minor wildfires to reduce bloat
      if (type === 'fire') {
        if (wildfireCount >= 30) continue;
        wildfireCount++;
      }

      const date = new Date(e.geometry[0].date);
      parsed.push({
        lat: coords[1],
        lng: coords[0],
        name: e.title,
        type: type,
        severity: (type === 'volcano') ? 'extreme' : ((type === 'storm') ? 'severe' : 'moderate'),
        year: date.getFullYear(),
        impact: 'LIVE EVENT — Data from NASA EONET',
        desc: e.description || `Active ${type} event tracked by NASA. Data updated in real-time.`,
        link: e.sources && e.sources.length > 0 ? e.sources[0].url : e.link,
        _isLive: true,
        _source: 'NASA'
      });
    }
    return parsed;
  }

  function _parseUsgsData(features) {
    const parsed = [];
    
    for (const f of features) {
      const coords = f.geometry.coordinates;
      const mag = f.properties.mag;
      const title = f.properties.title;
      
      if (!coords || coords.length < 2) continue;

      let severity = 'moderate';
      if (mag >= 7.0) severity = 'extreme';
      else if (mag >= 5.5) severity = 'severe';

      const date = new Date(f.properties.time);
      
      parsed.push({
        lat: coords[1],
        lng: coords[0],
        name: title,
        type: 'earthquake',
        severity: severity,
        year: date.getFullYear(),
        impact: 'LIVE EVENT — Data from USGS',
        desc: `Magnitude ${mag} earthquake recorded by the United States Geological Survey.`,
        link: f.properties.url,
        _isLive: true,
        _source: 'USGS'
      });
    }
    return parsed;
  }

  function activate() {
    if (!_events || !hasModule('GlobeModule') || !GlobeModule.world) return;
    _active = true;

    const filterPanel = $('events-filter');
    if (filterPanel) filterPanel.style.display = 'flex';

    _previousPointsData = GlobeModule.world.pointsData();
    _previousLabelsData = GlobeModule.world.labelsData();
    _previousRingsData = GlobeModule.world.ringsData();

    // Merge all events
    let allEvents = [...(_events || []), ..._eonetEvents, ..._usgsEvents];
    
    // Apply Filters
    allEvents = allEvents.filter(e => {
      // 1. Time Filter (Live)
      if (e._isLive && !_activeFilters['live']) return false;

      // 2. Separate ELU/COP from historic
      const t = e.type;
      if (t === 'elu_site' || t === 'cop') return _activeFilters['elu'];

      // 3. Historic Filter (only applies to non-live, non-COP natural events)
      if (!e._isLive && !_activeFilters['historic']) return false;

      return _activeFilters[t];
    });

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
      _source: e._source,
      id: e.name.toLowerCase().replace(/\s+/g, '_'),
    }));

    GlobeModule.world
      .pointsData(eventPoints)
      .pointLat('lat').pointLng('lng')
      .pointAltitude(0.002) // Flattened cylinders
      .pointRadius(p => {
        if (p._severity === 'extreme') return 1.2;
        if (p._eventType === 'cop') return 0.8;
        if (p._eventType === 'elu_site') return 0.7;
        return 0.4;
      })
      .pointColor(p => {
        const color = TYPE_COLORS[p._eventType]?.point || '#ffffff';
        return p._severity === 'extreme' ? color : color + 'E6'; 
      })
      .pointResolution(32);

    GlobeModule.world.labelsData([]);

    // RINGS OVERHAUL
    GlobeModule.world
      .ringsData(eventPoints.filter(p => p._severity === 'extreme' || p._severity === 'severe' || p._eventType === 'cop'))
      .ringLat('lat').ringLng('lng')
      .ringColor(p => {
        const base = TYPE_COLORS[p._eventType]?.ring || 'rgba(255,255,255,';
        const opacity = p._severity === 'extreme' ? 1.0 : 0.5;
        return t => `${base}${opacity * (1 - t)})`;
      })
      .ringMaxRadius(p => p._eventType === 'cop' ? 4 : (SEVERITY_RADIUS[p._severity] || 3))
      .ringPropagationSpeed(p => p._severity === 'extreme' ? 3 : 1)
      .ringRepeatPeriod(p => p._severity === 'extreme' ? 800 : 2500);

    // Click handler
    GlobeModule.world.onPointClick(p => {
      if (typeof _globeClickHandler !== 'undefined' && _globeClickHandler && p) {
        _globeClickHandler(p.lat, p.lng);
        return;
      }
      if (p._type === 'event') {
        _showEventInfo(p);
      }
    });

    // Hover handler
    GlobeModule.world.onPointHover(p => {
      if (p && p._type === 'event') {
        _showEventHover(p);
      } else {
        _hideEventHover();
      }
    });

    GlobeModule.setHexMode(
      () => 'rgba(40,40,50,0.08)',
      () => 0.001
    );

    console.log('[GLOBE_EVENTS] activated — showing', eventPoints.length, 'events');
  }

  function deactivate() {
    if (!hasModule('GlobeModule') || !GlobeModule.world) return;
    _active = false;

    const filterPanel = $('events-filter');
    if (filterPanel) filterPanel.style.display = 'none';

    if (_previousPointsData) GlobeModule.world.pointsData(_previousPointsData);
    if (_previousLabelsData) GlobeModule.world.labelsData(_previousLabelsData);
    if (_previousRingsData) GlobeModule.world.ringsData(_previousRingsData);

    _hideEventInfo();
    _hideEventHover();

    GlobeModule.world.onPointClick(site => {
      if (typeof _globeClickHandler !== 'undefined' && _globeClickHandler && site) {
        _globeClickHandler(site.lat, site.lng);
        return;
      }
      if (hasModule('GAIA_NODES')) GAIA_NODES.onNodeClick(site.id);
      else if (hasModule('SITE_PANEL')) SITE_PANEL.open(site);
    });

    GlobeModule.world.onPointHover(null);
  }

  function _showEventHover(p) {
    let tooltip = $('event-hover-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'event-hover-tooltip';
      document.body.appendChild(tooltip);
    }
    
    const typeLabel = TYPE_COLORS[p._eventType]?.text || 'Event';
    const yearStr = p._year ? ` (${p._year})` : '';

    tooltip.innerHTML = `
      <div class="tt-type" style="color:${TYPE_COLORS[p._eventType]?.point || '#fff'}">${typeLabel}</div>
      <div class="tt-name">${p.name}${yearStr}</div>
    `;
    tooltip.classList.add('visible');
    _updateHoverTooltipPos();
  }

  function _hideEventHover() {
    const tooltip = $('event-hover-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
  }

  function _updateHoverTooltipPos() {
    const tooltip = $('event-hover-tooltip');
    if (tooltip && tooltip.classList.contains('visible')) {
      tooltip.style.left = _mouseX + 'px';
      tooltip.style.top = _mouseY + 'px';
    }
  }

  function _showEventInfo(p) {
    let panel = $('event-info-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'event-info-panel';
      panel.className = 'event-info-panel';
      document.body.appendChild(panel);
    }

    const typeLabel = TYPE_COLORS[p._eventType]?.text || 'Event';

    let liveBadge = '';
    if (p._isLive) {
      if (p._source === 'USGS') {
        liveBadge = '<div style="background:rgba(244,162,97,0.15);color:#f4a261;font-size:10px;font-weight:700;padding:4px 8px;border-radius:4px;display:inline-block;margin-bottom:8px;letter-spacing:1px;border:1px solid rgba(244,162,97,0.3);">🌍 LIVE USGS DATA</div>';
      } else {
        liveBadge = '<div style="background:rgba(230,57,70,0.15);color:#ff6b6b;font-size:10px;font-weight:700;padding:4px 8px;border-radius:4px;display:inline-block;margin-bottom:8px;letter-spacing:1px;border:1px solid rgba(230,57,70,0.3);">🔴 LIVE NASA DATA</div>';
      }
    }

    panel.innerHTML = `
      <button class="eip-close" onclick="this.parentElement.classList.remove('open')" aria-label="Close">×</button>
      <div class="eip-type" style="color:${TYPE_COLORS[p._eventType]?.point || '#fff'}">${typeLabel}</div>
      ${liveBadge}
      <h3 class="eip-title">${p.name}</h3>
      <div class="eip-year">${p._year}</div>
      <div class="eip-impact">${p._impact}</div>
      <p class="eip-desc">${p._desc}</p>
      ${p._link ? `<a class="eip-link" href="${p._link}" target="_blank" rel="noopener">Learn more →</a>` : ''}
      ${p._eluSite ? `<button class="eip-explore" onclick="if(hasModule('GAIA_NODES'))GAIA_NODES.onNodeClick('${p._eluSite}')">Explore this site →</button>` : ''}
    `;
    panel.classList.add('open');

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
      let arr = [...(_events || []), ..._eonetEvents, ..._usgsEvents];
      return arr.filter(e => {
        if (e._isLive && !_activeFilters['live']) return false;
        
        const t = e.type;
        if (t === 'elu_site' || t === 'cop') return _activeFilters['elu'];
        
        if (!e._isLive && !_activeFilters['historic']) return false;
        return _activeFilters[t];
      });
    },
    isActive: () => _active,
  };
})();
window.GLOBE_EVENTS = GLOBE_EVENTS;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GLOBE_EVENTS', {
    provides: ['init', 'activate', 'deactivate', 'getEvents', 'isActive'],
    requires: ['GlobeModule'],
  });
}
