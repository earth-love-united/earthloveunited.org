// ═══════════════════════════════════════════════
// GLOBE EVENTS — Climate events & education mode
// Shows wildfires, floods, droughts, COPs, ELU sites
// Data: data/climate-events.json
// ═══════════════════════════════════════════════

const GLOBE_EVENTS = (() => {
  let _events = null;
  let _loader = null;
  let _active = false;
  let _initialized = false;
  let _previousPointsData = null;
  let _previousLabelsData = null;
  let _previousRingsData = null;

  let _timelineYear = 1996;
  let _timelineDay = 1;
  let _timelineInterval = null;
  const _historicObjects = new Map();

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
        _events.forEach(e => {
          e._type = 'event';
          e._eventType = e.type;
          e.id = e.name.toLowerCase().replace(/\s+/g, '_');
        });
        console.log(`[GLOBE_EVENTS] loaded static data — ${_events.length} events`);
      }

      // Initialize ClimateDataLoader
      if (typeof ClimateDataLoader !== 'undefined') {
        _loader = new ClimateDataLoader();
        try {
          await _loader.init('data/events-core.csv', 'data/events-meta.json');
          
          // Populate Year Selector
          const ys = $('events-year-select');
          if (ys) {
            const stats = _loader.getStats();
            const minYear = stats.yearRange ? stats.yearRange[0] : 1996;
            const maxYear = stats.yearRange ? stats.yearRange[1] : 2026;
            _timelineYear = maxYear; // Default to most recent year
            
            for (let y = minYear; y <= maxYear; y++) {
              const opt = document.createElement('option');
              opt.value = y;
              opt.textContent = y;
              ys.appendChild(opt);
            }
            ys.value = _timelineYear;
          }
          
          if (_active) activate();
        } catch (e) {
          reportWarn('GLOBE_EVENTS', 'Failed to load historical climate dataset: ' + e.message);
        }
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
          if (_active) _renderEvents();
        }
      });
    });

    const slider = $('events-slider');
    const dateLabel = $('events-date');
    const playBtn = $('events-play');
    const yearSelect = $('events-year-select');

    function updateDateLabel() {
      if (!dateLabel) return;
      const date = new Date(Date.UTC(_timelineYear, 0, _timelineDay));
      dateLabel.textContent = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    if (yearSelect) {
      yearSelect.addEventListener('change', (e) => {
        _timelineYear = parseInt(e.target.value);
        // Adjust slider max for leap years
        const isLeap = (_timelineYear % 4 === 0 && _timelineYear % 100 !== 0) || (_timelineYear % 400 === 0);
        if (slider) slider.max = isLeap ? 366 : 365;
        if (_timelineDay > slider.max) _timelineDay = slider.max;
        updateDateLabel();
        _renderEvents();
      });
    }

    if (slider) {
      slider.addEventListener('input', (e) => {
        _timelineDay = parseInt(e.target.value);
        updateDateLabel();
        _renderEvents();
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (_timelineInterval) {
          clearInterval(_timelineInterval);
          _timelineInterval = null;
          playBtn.textContent = '▶';
        } else {
          playBtn.textContent = '⏸';
          _timelineInterval = setInterval(() => {
            _timelineDay++;
            const maxDays = parseInt(slider.max || 365);
            if (_timelineDay > maxDays) {
              _timelineDay = 1;
              _timelineYear++;
              if (yearSelect && yearSelect.lastChild) {
                if (_timelineYear > parseInt(yearSelect.lastChild.value)) {
                  // End of dataset reached
                  clearInterval(_timelineInterval);
                  _timelineInterval = null;
                  playBtn.textContent = '▶';
                  _timelineYear--;
                  _timelineDay = maxDays;
                  return;
                }
                yearSelect.value = _timelineYear;
                const isLeap = (_timelineYear % 4 === 0 && _timelineYear % 100 !== 0) || (_timelineYear % 400 === 0);
                slider.max = isLeap ? 366 : 365;
              }
            }
            if (slider) slider.value = _timelineDay;
            updateDateLabel();
            _renderEvents();
          }, 150); // 150ms per day
        }
      });
    }
  }

  function _getLoaderType(typeInt) {
    const types = { 1: 'fire', 2: 'flood', 3: 'storm', 4: 'earthquake', 5: 'volcano', 6: 'drought' };
    return types[typeInt] || 'event';
  }

  function _getHistoricObj(idx) {
    if (!_historicObjects.has(idx)) {
      const typeStr = _getLoaderType(_loader.types[idx]);
      const sevInt = _loader.sevs[idx];
      let severity = 'moderate';
      if (sevInt === 3) severity = 'extreme';
      else if (sevInt === 2) severity = 'severe';

      const fallbackName = severity.charAt(0).toUpperCase() + severity.slice(1) + ' ' + 
                           typeStr.charAt(0).toUpperCase() + typeStr.slice(1) + ' Event';

      _historicObjects.set(idx, {
        _idx: idx,
        id: _loader.ids[idx],
        lat: _loader.lats[idx],
        lng: _loader.lngs[idx],
        name: fallbackName,
        type: typeStr,
        _type: 'event',
        _eventType: typeStr,
        severity: severity,
        year: new Date(_loader.starts[idx] * 1000).getUTCFullYear(),
        _isHistoric: true,
        _isLive: false // It's from the historical dataset
      });
    }
    return _historicObjects.get(idx);
  }

  function activate() {
    if (!_events || !hasModule('GlobeModule') || !GlobeModule.world) return;
    _active = true;

    const filterPanel = $('events-filter');
    if (filterPanel) filterPanel.style.display = 'flex';

    _previousPointsData = GlobeModule.world.pointsData();
    _previousLabelsData = GlobeModule.world.labelsData();
    _previousRingsData = GlobeModule.world.ringsData();

    // Disable transitions to prevent massive lag during rapid timeline playback
    GlobeModule.world.pointsTransitionDuration(0);
    if (typeof GlobeModule.world.ringsTransitionDuration === 'function') {
      GlobeModule.world.ringsTransitionDuration(0);
    }

    _renderEvents();

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

    const tl = $('events-timeline');
    if (tl) tl.style.display = 'flex';

    console.log('[GLOBE_EVENTS] activated');
  }



  function _renderEvents() {
    if (!_active || !GlobeModule.world) return;

    let allEvents = [...(_events || [])];
    
    // Get visible historical events from loader
    if (_loader) {
      const windowStart = Math.floor(Date.UTC(_timelineYear, 0, _timelineDay) / 1000);
      // We'll show events active exactly on this day
      const visible = _loader.getVisible(windowStart, windowStart + 86400);
      
      for (let i = 0; i < visible.count; i++) {
        const idx = visible.indices[i];
        allEvents.push(_getHistoricObj(idx));
      }
    }

    // Apply Filters
    const eventPoints = allEvents.filter(e => {
      const t = e.type;
      if (t === 'elu_site' || t === 'cop') return _activeFilters['elu'];
      return _activeFilters[t];
    });

    GlobeModule.world
      .pointsData(eventPoints)
      .pointLat('lat').pointLng('lng')
      .pointAltitude(0.002) // Flattened cylinders
      .pointRadius(p => {
        if (p.severity === 'extreme') return 1.2;
        if (p._eventType === 'cop') return 0.8;
        if (p._eventType === 'elu_site') return 0.7;
        return 0.4;
      })
      .pointColor(p => {
        const color = TYPE_COLORS[p._eventType]?.point || '#ffffff';
        return p.severity === 'extreme' ? color : color + 'E6'; 
      })
      .pointLabel(() => '')
      .pointResolution(32);

    GlobeModule.world.labelsData([]);

    // RINGS OVERHAUL
    GlobeModule.world
      .ringsData(eventPoints.filter(p => p.severity === 'extreme' || p.severity === 'severe' || p._eventType === 'cop'))
      .ringLat('lat').ringLng('lng')
      .ringColor(p => {
        const base = TYPE_COLORS[p._eventType]?.ring || 'rgba(255,255,255,';
        const opacity = p.severity === 'extreme' ? 1.0 : 0.5;
        return t => `${base}${opacity * (1 - t)})`;
      })
      .ringMaxRadius(p => p._eventType === 'cop' ? 4 : (SEVERITY_RADIUS[p.severity] || 3))
      .ringPropagationSpeed(p => p.severity === 'extreme' ? 3 : 1)
      .ringRepeatPeriod(p => p.severity === 'extreme' ? 800 : 2500)
      .ringLabel(() => '');
  }

  function deactivate() {
    if (!hasModule('GlobeModule') || !GlobeModule.world) return;
    _active = false;

    const filterPanel = $('events-filter');
    if (filterPanel) filterPanel.style.display = 'none';
    
    const tl = $('events-timeline');
    if (tl) tl.style.display = 'none';
    
    if (_timelineInterval) {
      clearInterval(_timelineInterval);
      _timelineInterval = null;
      const playBtn = $('events-play');
      if (playBtn) playBtn.textContent = '▶';
    }

    if (_previousPointsData) GlobeModule.world.pointsData(_previousPointsData);
    if (_previousLabelsData) GlobeModule.world.labelsData(_previousLabelsData);
    if (_previousRingsData) GlobeModule.world.ringsData(_previousRingsData);

    // Restore standard transitions
    GlobeModule.world.pointsTransitionDuration(1000);
    if (typeof GlobeModule.world.ringsTransitionDuration === 'function') {
      GlobeModule.world.ringsTransitionDuration(1000);
    }

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
    const yearStr = p.year ? ` (${p.year})` : '';

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

  async function _showEventInfo(p) {
    let panel = $('event-info-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'event-info-panel';
      panel.className = 'event-info-panel';
      document.body.appendChild(panel);
    }

    const typeLabel = TYPE_COLORS[p._eventType]?.text || 'Event';
    
    // Default metadata for static/live
    let name = p.name || 'Unknown Event';
    let impact = p.impact || '';
    let desc = p.desc || '';
    let link = p.link || '';

    // If it's a historical dataset event, fetch metadata
    if (p._isHistoric && _loader) {
      const meta = await _loader.getMetaAsync(p.id);
      if (meta) {
        name = meta.title || name;
        impact = meta.impact || impact;
        desc = meta.desc || desc;
        link = meta.link || link;
      }
    }

    panel.innerHTML = `
      <button class="eip-close" onclick="this.parentElement.classList.remove('open')" aria-label="Close">×</button>
      <div class="eip-type" style="color:${TYPE_COLORS[p._eventType]?.point || '#fff'}">${typeLabel}</div>
      <h3 class="eip-title">${name}</h3>
      <div class="eip-year">${p.year}</div>
      <div class="eip-impact">${impact}</div>
      <p class="eip-desc">${desc}</p>
      ${link ? `<a class="eip-link" href="${link}" target="_blank" rel="noopener">Learn more →</a>` : ''}
      ${p.elu_site ? `<button class="eip-explore" onclick="if(hasModule('GAIA_NODES'))GAIA_NODES.onNodeClick('${p.elu_site}')">Explore this site →</button>` : ''}
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
      let arr = [...(_events || [])];
      if (_loader) {
        const windowStart = Math.floor(Date.UTC(_timelineYear, 0, _timelineDay) / 1000);
        const visible = _loader.getVisible(windowStart, windowStart + 86400);
        for (let i = 0; i < visible.count; i++) {
          arr.push(_getHistoricObj(visible.indices[i]));
        }
      }
      return arr.filter(e => {
        const t = e.type;
        if (t === 'elu_site' || t === 'cop') return _activeFilters['elu'];
        return _activeFilters[t];
      });
    },
    isActive: () => _active,
    reset() {
      console.debug(`[SML] GLOBE_EVENTS.reset`);
      return true;
    },
    destroy() {
      console.debug(`[SML] GLOBE_EVENTS.destroy`);
      if (_timelineInterval) clearInterval(_timelineInterval);
      return true;
    },
    getState() {
      return { active: _active, timelineDay: _timelineDay };
    }
  };
})();
window.GLOBE_EVENTS = GLOBE_EVENTS;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GLOBE_EVENTS', {
    provides: ['init', 'activate', 'deactivate', 'getEvents', 'isActive', 'reset', 'destroy', 'getState'],
    requires: ['GlobeModule'],
  });
}
