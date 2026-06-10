// ═══════════════════════════════════════════════
// PULSE DASHBOARD — Live Planetary Vital Signs
// ═══════════════════════════════════════════════
// Registers a "Pulse" site in the GLOBE_OVERLAY with four tabs:
//   Atmosphere · Oceans · Carbon Budget · Sources
//
// Data sources:
//   GAIA_DATA.getSnapshot() — NOAA CO₂/CH₄, Carbonmark prices (live, cached)
//   GAIA_NODES.FACTS         — static climate reference values
//   CARBON_CLOCK             — real-time excess accumulation
//
// All rendering is read-only. No mutations to existing modules.
// ═══════════════════════════════════════════════

const PULSE_DASHBOARD = (() =>
{
  // ── State ──
  let _refreshTimer = null;
  let _lastSnapshot = null;

  // ── Helpers ──
  function _fmt(n, decimals = 2)
  {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toFixed(decimals);
  }

  function _sign(n)
  {
    if (n === null || n === undefined) return '';
    return n > 0 ? '+' : '';
  }

  function _trendColor(n)
  {
    if (n === null || n === undefined) return 'var(--text3)';
    return n > 0 ? 'var(--warn)' : n < 0 ? 'var(--leaf)' : 'var(--text3)';
  }

  function _facts()
  {
    return hasModule('GAIA_NODES') && GAIA_NODES.FACTS ? GAIA_NODES.FACTS : {};
  }

  function _ago(ms)
  {
    if (!ms) return 'unknown';
    const s = Math.floor((Date.now() - ms) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  // ── Build the vital signs card HTML ──
  function _card(label, value, unit, change, changeLabel, color)
  {
    const changeColor = change !== null && change !== undefined ? _trendColor(change) : 'var(--text3)';
    const changeText = change !== null && change !== undefined
      ? `${_sign(change)}${_fmt(change)} ${unit}`
      : 'no data';
    return `
      <div class="pulse-stat">
        <div class="pulse-stat-label">${label}</div>
        <div class="pulse-stat-value" style="color:${color || 'var(--teal)'}">${value}<span class="pulse-stat-unit">${unit}</span></div>
        <div class="pulse-stat-change" style="color:${changeColor}">${changeText}${changeLabel ? ' · ' + changeLabel : ''}</div>
      </div>`;
  }

  // ── Tab 1: Atmosphere ──
  function _renderAtmosphere(panelEl)
  {
    const snap = _lastSnapshot;
    const co2 = snap?.co2 || {};
    const ch4 = snap?.methane || {};
    const facts = _facts();

    const co2Latest = co2.latest !== null ? _fmt(co2.latest, 2) : _fmt(facts.co2_current, 2);
    const co2Change = co2.yearlyChange !== null ? co2.yearlyChange : facts.co2_annual_increase;
    const co2Monthly = co2.monthlyChange;

    const ch4Latest = ch4.latest !== null ? _fmt(ch4.latest, 1) : _fmt(facts.methane_current, 1);
    const ch4Pre = _fmt(facts.methane_preindustrial, 1);

    const tempAnomaly = _fmt(facts.temp_anomaly, 2);
    const warmingRate = _fmt(facts.warming_rate, 2);

    // Keeling sparkline (last 12 months)
    let sparklineHtml = '';
    if (co2.keeling12 && co2.keeling12.length > 1)
    {
      const vals = co2.keeling12.map(d => d.value);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min || 1;
      const w = 40, h = 14, pad = 2;
      const pts = vals.map((v, i) => {
        const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return `${x},${y}`;
      }).join(' ');
      sparklineHtml = `
        <div class="pulse-sparkline-label">CO₂ 12-month trend</div>
        <svg class="pulse-sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
          <polyline points="${pts}" fill="none" stroke="var(--teal)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div class="pulse-sparkline-range"><span>${_fmt(min, 1)}</span><span>${_fmt(max, 1)} ppm</span></div>`;
    }

    panelEl.innerHTML = `
      <div class="pulse-header">
        <span class="pulse-icon">🌡️</span>
        <span class="pulse-title">Atmosphere</span>
        <span class="pulse-live-dot" title="Live data"></span>
      </div>
      <div class="pulse-grid">
        ${_card('CO₂', co2Latest, 'ppm', co2Change, 'vs last year')}
        ${_card('CH₄', ch4Latest, 'ppb', null, `pre-industrial: ${ch4Pre}`, 'var(--amber)')}
        ${_card('Temp Anomaly', tempAnomaly, '°C', warmingRate, 'per decade', 'var(--warn)')}
        ${_card('Airborne Fraction', _fmt(facts.airborne_fraction, 2), '', null, 'of emissions stay in air', 'var(--text2)')}
      </div>
      ${sparklineHtml ? `<div class="pulse-sparkline-wrap">${sparklineHtml}</div>` : ''}
      <div class="pulse-sources">Source: NOAA GML · Updated ${snap?.fetchedAt ? _ago(snap.fetchedAt) : 'on load'}</div>
    `;
  }

  // ── Tab 2: Oceans ──
  function _renderOceans(panelEl)
  {
    const facts = _facts();

    panelEl.innerHTML = `
      <div class="pulse-header">
        <span class="pulse-icon">🌊</span>
        <span class="pulse-title">Oceans</span>
        <span class="pulse-live-dot" title="Live data"></span>
      </div>
      <div class="pulse-grid">
        ${_card('Sea Level Rise', _fmt(facts.sea_level_rate, 1), 'mm/yr', null, `+${_fmt(facts.sea_level_total, 0)}cm since 1900`, 'var(--ocean)')}
        ${_card('Ocean CO₂ Sink', _fmt(facts.ocean_sink, 1), 'Gt/yr', null, 'absorbs ~25% of emissions', 'var(--teal)')}
        ${_card('Ocean Carbon Pool', _fmt(facts.ocean_pool, 0), 'GtC', null, 'largest active reservoir', 'var(--deep)')}
        ${_card('Seagrass Burial', _fmt(facts.seagrass_burial, 0), 'MtC/yr', null, `area: ${_fmt(facts.seagrass_area, 0)} km²`, 'var(--leaf)')}
      </div>
      <div class="pulse-narrative">
        The ocean is the planet's largest carbon sink — absorbing roughly a quarter of human CO₂ emissions. This comes at a cost: ocean acidification, warming, and sea level rise. Seagrass meadows, though small in area, bury carbon 35× faster than tropical rainforests per hectare.
      </div>
      <div class="pulse-sources">Source: IPCC AR6 · NASA · NOAA</div>
    `;
  }

  // ── Tab 3: Carbon Budget ──
  function _renderBudget(panelEl)
  {
    const snap = _lastSnapshot;
    const budget = snap?.carbonBudget || {};
    const emissions = snap?.humanEmissions || {};
    const facts = _facts();

    const years15 = budget.yearsLeft15 !== undefined ? budget.yearsLeft15 : Math.max(0, Math.round((budget.remaining15 || 250) / (facts.annual_emissions_2025 || 38)));
    const years20 = budget.yearsLeft20 !== undefined ? budget.yearsLeft20 : Math.max(0, Math.round((budget.remaining20 || 1200) / (facts.annual_emissions_2025 || 38)));

    // Carbon clock integration
    let clockAccumulated = '';
    if (hasModule('CARBON_CLOCK'))
    {
      const cv = safeCall('CARBON_CLOCK', 'getValue');
      clockAccumulated = cv ? cv.formatted : '';
    }

    panelEl.innerHTML = `
      <div class="pulse-header">
        <span class="pulse-icon">🧮</span>
        <span class="pulse-title">Carbon Budget</span>
        <span class="pulse-live-dot" title="Live data"></span>
      </div>
      <div class="pulse-grid">
        ${_card('1.5°C Budget Left', _fmt(budget.remaining15 || 250, 0), 'GtCO2', null, '~' + years15 + ' years at current rate', 'var(--warn)')}
        ${_card('2.0°C Budget Left', _fmt(budget.remaining20 || 1200, 0), 'GtCO2', null, '~' + years20 + ' years at current rate', 'var(--amber)')}
        ${_card('Human Emissions', _fmt(emissions.annualGt || facts.annual_emissions_2025, 1), 'GtCO₂/yr', null, 'fossil + land use', 'var(--warn)')}
        ${_card('Nature Absorption', _fmt(emissions.natureAbsorptionGt || 123, 1), 'GtCO₂/yr', null, 'ocean + land sinks', 'var(--leaf)')}
      </div>
      <div class="pulse-budget-bar">
        <div class="pulse-budget-label">1.5°C budget consumed</div>
        <div class="pulse-budget-track">
          <div class="pulse-budget-fill" style="width:${Math.min(100, ((facts.carbon_budget_15 - (budget.remaining15 || 250)) / facts.carbon_budget_15 * 100))}%"></div>
        </div>
        <div class="pulse-budget-numbers"><span>${_fmt(facts.carbon_budget_15 - (budget.remaining15 || 250), 0)} Gt used</span><span>${_fmt(budget.remaining15 || 250, 0)} Gt left</span></div>
      </div>
      ${clockAccumulated ? '<div class="pulse-clock-row"><span class="pulse-clock-label">Excess accumulated since you arrived:</span><span class="pulse-clock-value">' + clockAccumulated + '</span></div>' : ''}
      <div class="pulse-sources">Source: Global Carbon Project · IPCC AR6 · Carbon clock: real-time</div>
    `;
  }

  // ── Tab 4: Sources & Data Status ──
  function _renderSources(panelEl)
  {
    const snap = _lastSnapshot;
    const co2 = snap?.co2 || {};
    const market = snap?.carbonMarket || {};

    // Build source status list
    const sources = [
      { name: 'NOAA GML CO₂', url: 'https://gml.noaa.gov', status: co2.latest ? 'live' : 'cached', detail: co2.latestDate || 'monthly update' },
      { name: 'NOAA GML CH₄', url: 'https://gml.noaa.gov', status: snap?.methane?.latest ? 'live' : 'cached', detail: snap?.methane?.latestDate || 'monthly update' },
      { name: 'Carbonmark API', url: 'https://api.carbonmark.com', status: market.avgPrice ? 'live' : 'unavailable', detail: market.avgPrice ? `avg $${_fmt(market.avgPrice, 2)}/t` : 'no response' },
      { name: 'Global Carbon Project', url: 'https://globalcarbonproject.org', status: 'reference', detail: 'annual report data' },
      { name: 'IPCC AR6', url: 'https://ipcc.ch', status: 'reference', detail: 'physical science basis' },
      { name: 'NASA Sea Level', url: 'https://sealevel.nasa.gov', status: 'reference', detail: 'satellite altimetry' },
    ];

    const statusColor = { live: 'var(--leaf)', cached: 'var(--amber)', reference: 'var(--text2)', unavailable: 'var(--warn)' };
    const statusIcon = { live: '●', cached: '◐', reference: '○', unavailable: '✕' };

    const sourceRows = sources.map(s => `
      <div class="pulse-source-row">
        <span class="pulse-source-status" style="color:${statusColor[s.status] || 'var(--text3)'}" title="${s.status}">${statusIcon[s.status] || '?'}</span>
        <a class="pulse-source-name" href="${s.url}" target="_blank" rel="noopener">${s.name}</a>
        <span class="pulse-source-detail">${s.detail}</span>
      </div>
    `).join('');

    // Yearly CO₂ trend table
    let trendHtml = '';
    if (co2.yearlyTrend && co2.yearlyTrend.length)
    {
      trendHtml = `
        <div class="pulse-trend-title">CO₂ Yearly Averages (ppm)</div>
        <div class="pulse-trend-table">
          ${co2.yearlyTrend.map(y => `
            <div class="pulse-trend-row">
              <span>${y.year}</span>
              <span style="color:var(--teal)">${_fmt(y.avg, 2)}</span>
            </div>
          `).join('')}
        </div>`;
    }

    panelEl.innerHTML = `
      <div class="pulse-header">
        <span class="pulse-icon">📡</span>
        <span class="pulse-title">Data Sources</span>
        <span class="pulse-live-dot" title="Live data"></span>
      </div>
      <div class="pulse-sources-list">
        ${sourceRows}
      </div>
      ${trendHtml}
      <div class="pulse-refresh-row">
        <button class="pulse-refresh-btn" id="pulse-refresh-btn" data-action="PULSE_DASHBOARD.refresh">↻ Refresh Now</button>
        <span class="pulse-last-fetch">Last fetch: ${snap?.fetchedAt ? _ago(snap.fetchedAt) : 'never'}</span>
      </div>
    `;
  }

  // ── Register the Pulse site in GLOBE_OVERLAY ──
  function _registerSite()
  {
    if (!hasModule('GLOBE_OVERLAY') || typeof GLOBE_OVERLAY.registerSite !== 'function')
    {
      reportWarn('PULSE_DASHBOARD', 'GLOBE_OVERLAY not available — retrying in 1s');
      setTimeout(_registerSite, 1000);
      return;
    }

    safeCall('GLOBE_OVERLAY', 'registerSite', {
      siteId: 'pulse',
      icon: '💓',
      title: 'Planetary Pulse',
      subtitle: 'Live vital signs',
      tabs: [
        { id: 'atmosphere', label: '🌡️ Atmosphere', render: (panelEl) => _renderAtmosphere(panelEl) },
        { id: 'oceans',     label: '🌊 Oceans',     render: (panelEl) => _renderOceans(panelEl) },
        { id: 'budget',     label: '🧮 Budget',      render: (panelEl) => _renderBudget(panelEl) },
        { id: 'sources',    label: '📡 Sources',     render: (panelEl) => _renderSources(panelEl) },
      ],
    });

    console.log('[PULSE] Registered in GLOBE_OVERLAY');
  }

  // ── Fetch latest data ──
  async function _refresh()
  {
    if (hasModule('GAIA_DATA') && typeof GAIA_DATA.getSnapshot === 'function')
    {
      try
      {
        _lastSnapshot = await safeCall('GAIA_DATA', 'getSnapshot');
      }
      catch (e)
      {
        reportWarn('PULSE_DASHBOARD', `GAIA_DATA.getSnapshot() failed: ${e.message}`);
        // Use cached snapshot as fallback
        if (typeof GAIA_DATA.getCachedSnapshot === 'function')
          _lastSnapshot = safeCall('GAIA_DATA', 'getCachedSnapshot');
      }
    }
    else
    {
      // No GAIA_DATA — use static facts only
      const facts = _facts();
      _lastSnapshot = {
        fetchedAt: Date.now(),
        co2: { latest: facts.co2_current, yearlyChange: facts.co2_annual_increase, keeling12: [], yearlyTrend: [] },
        methane: { latest: facts.methane_current },
        carbonMarket: {},
        humanEmissions: { annualGt: 143, natureAbsorptionGt: 123, netExcessGt: 20 },
        carbonBudget: { remaining15: facts.carbon_budget_15, remaining20: facts.carbon_budget_20, yearsLeft15: Math.max(0, Math.round(facts.carbon_budget_15 / (facts.annual_emissions_2025 || 38))), yearsLeft20: Math.max(0, Math.round(facts.carbon_budget_20 / (facts.annual_emissions_2025 || 38))) },
      };
    }
  }

  // ── Auto-refresh every 60s when overlay is open ──
  function _startAutoRefresh()
  {
    if (_refreshTimer) return;
    _refreshTimer = setInterval(async () =>
    {
      if (safeGet('GLOBE_OVERLAY', 'isOpen', false) &&
          safeGet('GLOBE_OVERLAY', 'getCurrentSite', null) === 'pulse')
      {
        await _refresh();
        // Re-render active tab
        safeCall('GLOBE_OVERLAY', 'refreshTab');
      }
    }, 60000);
  }

  function _stopAutoRefresh()
  {
    if (_refreshTimer)
    {
      clearInterval(_refreshTimer);
      _refreshTimer = null;
    }
  }

  // ── Public API ──
  return {
    async init()
    {
      // Fetch initial data
      await _refresh();

      // Register in overlay (may retry if GLOBE_OVERLAY loads after us)
      _registerSite();

      // Start background refresh
      _startAutoRefresh();

      // Listen for overlay open to refresh data
      if (hasModule('EventBus'))
      {
        // No direct EventBus subscription needed — auto-refresh handles it
      }

      console.log('[PULSE] Initialized');
    },

    // Called by the refresh button in Sources tab
    async refresh()
    {
      await _refresh();
      safeCall('GLOBE_OVERLAY', 'refreshTab');
    },

    // ── Standard Module Lifecycle (SML) ──()
    reset()
    {
      console.debug('[SML] PULSE_DASHBOARD.reset');
      _lastSnapshot = null;
      return true;
    },

    destroy()
    {
      console.debug('[SML] PULSE_DASHBOARD.destroy');
      _stopAutoRefresh();
      _lastSnapshot = null;
      return true;
    },

    getState()
    {
      return { hasSnapshot: !!_lastSnapshot };
    },
  };
})();

window.PULSE_DASHBOARD = PULSE_DASHBOARD;

if (typeof MODULE_CONTRACTS !== 'undefined')
{
  MODULE_CONTRACTS.register('PULSE_DASHBOARD', {
    provides: ['init', 'refresh', 'reset', 'destroy', 'getState'],
    requires: ['GLOBE_OVERLAY'],
  });
}
