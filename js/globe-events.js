// ═══════════════════════════════════════════════
// GLOBE EVENTS — Climate events & education mode
// Shows wildfires, floods, droughts, COPs, ELU sites
// Data: data/climate-events.json
// ═══════════════════════════════════════════════

const GLOBE_EVENTS = (() => {
  let _events = null;
  let _eonetEvents = [];
  let _gdacsEvents = [];
  let _active = false;
  let _initialized = false;
  let _previousPointsData = null;
  let _previousLabelsData = null;
  let _previousRingsData = null;

  // ── Event type → visual config ──
  const TYPE_COLORS = {
    fire:       { point: '#ff6b35', ring: 'rgba(255,107,53,', label: '#ff8c5a' },
    flood:      { point: '#3d9be9', ring: 'rgba(61,155,233,', label: '#6bb3f0' },
    drought:    { point: '#e6a817', ring: 'rgba(230,168,23,', label: '#f0c040' },
    storm:      { point: '#b088f9', ring: 'rgba(176,136,249,', label: '#cbb3fc' },
    volcano:    { point: '#e63946', ring: 'rgba(230,57,70,',   label: '#f07178' },
    earthquake: { point: '#f4a261', ring: 'rgba(244,162,97,', label: '#f8c49c' },
    cop:        { point: '#ffd700', ring: 'rgba(255,215,0,',  label: '#ffe44d' },
    elu_site:   { point: '#4ecdc4', ring: 'rgba(78,205,196,', label: '#7be8d0' },
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

      // UN GDACS
      try {
        const gdacsRes = await fetch('https://www.gdacs.org/xml/rss.xml');
        if (gdacsRes.ok) {
          const gdacsText = await gdacsRes.text();
          _gdacsEvents = _parseGdacsData(gdacsText);
          console.log(`[GLOBE_EVENTS] loaded live UN GDACS data — ${_gdacsEvents.length} active events`);
          if (_active) activate();
        }
      } catch (e) {
        reportWarn('GLOBE_EVENTS', 'Failed to fetch UN GDACS data: ' + e.message);
      }

    } catch (err) {
      reportError('GLOBE_EVENTS.init()', err);
    }
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

      // Limit wildfires to reduce bloat
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
        severity: (type === 'volcano' || type === 'storm') ? 'severe' : 'moderate', // Leaner rings
        year: date.getFullYear(),
        impact: 'LIVE EVENT — Data from NASA EONET',
        desc: e.description || \`Active \${type} event tracked by NASA. Data updated in real-time.\`,
        link: e.sources && e.sources.length > 0 ? e.sources[0].url : e.link,
        _isLive: true,
        _isGdacs: false
      });
    }
    return parsed;
  }

  function _parseGdacsData(xmlString) {
    const parsed = [];
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, "text/xml");
      const items = doc.querySelectorAll('item');
      
      items.forEach(item => {
        const title = item.querySelector('title')?.textContent || 'Global Event';
        const desc = item.querySelector('description')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const latNode = item.getElementsByTagName('geo:lat')[0] || item.getElementsByTagNameNS('*', 'lat')[0];
        const lngNode = item.getElementsByTagName('geo:long')[0] || item.getElementsByTagNameNS('*', 'long')[0] || item.getElementsByTagName('geo:lon')[0];
        const iconNode = item.getElementsByTagName('gdacs:icon')[0] || item.getElementsByTagNameNS('*', 'icon')[0];
        
        const latStr = latNode ? latNode.textContent : null;
        const lngStr = lngNode ? lngNode.textContent : null;
        const iconUrl = iconNode ? iconNode.textContent : '';

        if (!latStr || !lngStr) return;

        let type = 'storm';
        if (iconUrl.includes('/EQ.')) type = 'earthquake';
        else if (iconUrl.includes('/VO.')) type = 'volcano';
        else if (iconUrl.includes('/TC.')) type = 'storm';
        else if (iconUrl.includes('/FL.')) type = 'flood';
        else if (iconUrl.includes('/DR.')) type = 'drought';

        let severity = 'severe';
        if (iconUrl.includes('/Red/')) severity = 'extreme';
        else if (iconUrl.includes('/Orange/')) severity = 'severe';
        else if (iconUrl.includes('/Green/')) severity = 'moderate';

        const dateNode = item.querySelector('pubDate')?.textContent;
        const year = dateNode ? new Date(dateNode).getFullYear() : new Date().getFullYear();

        parsed.push({
          lat: parseFloat(latStr),
          lng: parseFloat(lngStr),
          name: title.split(' (')[0] || title,
          type: type,
          severity: severity,
          year: year,
          impact: 'LIVE EVENT — Data from UN GDACS',
          desc: desc,
          link: link,
          _isLive: true,
          _isGdacs: true
        });
      });
    } catch (e) {
      console.warn('Error parsing GDACS XML', e);
    }
    return parsed;
  }

  function activate() {
    if (!_events || !hasModule('GlobeModule') || !GlobeModule.world) return;
    _active = true;

    _previousPointsData = GlobeModule.world.pointsData();
    _previousLabelsData = GlobeModule.world.labelsData();
    _previousRingsData = GlobeModule.world.ringsData();

    // Merge all events
    const allEvents = [...(_events || []), ..._eonetEvents, ..._gdacsEvents];
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
      _isGdacs: e._isGdacs,
      id: e.name.toLowerCase().replace(/\\s+/g, '_'),
    }));

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

    GlobeModule.world
      .labelsData(eventPoints.filter(p => !p._isLive))
      .labelLat('lat').labelLng('lng')
      .labelText(p => {
        const year = p._year ? \` '\${String(p._year).slice(-2)}\` : '';
        return \`\${p.name}\${year}\`;
      })
      .labelSize(p => p._eventType === 'cop' ? 1.6 : 1.2)
      .labelDotRadius(0.3)
      .labelDotOrientation(() => 'bottom')
      .labelColor(p => TYPE_COLORS[p._eventType]?.label || 'rgba(255,255,255,0.8)')
      .labelResolution(3)
      .labelAltitude(p => p._eventType === 'cop' ? 0.05 : 0.03);

    GlobeModule.world
      .ringsData(eventPoints.filter(p => p._severity === 'extreme' || p._eventType === 'cop' || p._isLive))
      .ringLat('lat').ringLng('lng')
      .ringColor(p => {
        const base = TYPE_COLORS[p._eventType]?.ring || 'rgba(255,255,255,';
        const opacity = p._isLive ? 0.4 : 1.0; // Lower base opacity for live events
        return t => \`\${base}\${opacity * (1 - t)})\`;
      })
      .ringMaxRadius(p => SEVERITY_RADIUS[p._severity] || 4)
      .ringPropagationSpeed(p => p._eventType === 'cop' ? 2 : 1.5)
      .ringRepeatPeriod(p => p._eventType === 'cop' ? 1500 : (p._isLive ? 2000 : 1000));

    GlobeModule.world.onPointClick(p => {
      if (typeof _globeClickHandler !== 'undefined' && _globeClickHandler && p) {
        _globeClickHandler(p.lat, p.lng);
        return;
      }
      if (p._type === 'event') {
        _showEventInfo(p);
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

    if (_previousPointsData) GlobeModule.world.pointsData(_previousPointsData);
    if (_previousLabelsData) GlobeModule.world.labelsData(_previousLabelsData);
    if (_previousRingsData) GlobeModule.world.ringsData(_previousRingsData);

    _hideEventInfo();

    GlobeModule.world.onPointClick(site => {
      if (typeof _globeClickHandler !== 'undefined' && _globeClickHandler && site) {
        _globeClickHandler(site.lat, site.lng);
        return;
      }
      if (hasModule('GAIA_NODES')) GAIA_NODES.onNodeClick(site.id);
      else if (hasModule('SITE_PANEL')) SITE_PANEL.open(site);
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
      storm: '🌩️ Severe Storm', volcano: '🌋 Volcano', earthquake: '💥 Earthquake',
      cop: '🌍 COP Summit', elu_site: '🌿 ELU Project',
    };

    let liveBadge = '';
    if (p._isLive) {
      if (p._isGdacs) liveBadge = '<div style="background:rgba(78,205,196,0.15);color:#4ecdc4;font-size:10px;font-weight:700;padding:4px 8px;border-radius:4px;display:inline-block;margin-bottom:8px;letter-spacing:1px;border:1px solid rgba(78,205,196,0.3);">🌍 LIVE UN DATA (GDACS)</div>';
      else liveBadge = '<div style="background:rgba(230,57,70,0.15);color:#ff6b6b;font-size:10px;font-weight:700;padding:4px 8px;border-radius:4px;display:inline-block;margin-bottom:8px;letter-spacing:1px;border:1px solid rgba(230,57,70,0.3);">🔴 LIVE NASA DATA (EONET)</div>';
    }

    panel.innerHTML = \`
      <button class="eip-close" onclick="this.parentElement.classList.remove('open')" aria-label="Close">×</button>
      <div class="eip-type" style="color:\${TYPE_COLORS[p._eventType]?.point || '#fff'}">\${typeLabel[p._eventType] || 'Event'}</div>
      \${liveBadge}
      <h3 class="eip-title">\${p.name}</h3>
      <div class="eip-year">\${p._year}</div>
      <div class="eip-impact">\${p._impact}</div>
      <p class="eip-desc">\${p._desc}</p>
      \${p._link ? \`<a class="eip-link" href="\${p._link}" target="_blank" rel="noopener">Learn more →</a>\` : ''}
      \${p._eluSite ? \`<button class="eip-explore" onclick="if(hasModule('GAIA_NODES'))GAIA_NODES.onNodeClick('\${p._eluSite}')">Explore this site →</button>\` : ''}
    \`;
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
      const arr = [];
      if (_events) arr.push(..._events);
      if (_eonetEvents) arr.push(..._eonetEvents);
      if (_gdacsEvents) arr.push(..._gdacsEvents);
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
