/**
 * COUNTRY CLIMATE INTELLIGENCE — metric-first presentation policy.
 *
 * Data owns the verified snapshot. This module owns lens selection, ranking
 * eligibility, gap language, evidence labels, visual normalization, and the
 * country-card view model. GlobeModule only renders these decisions.
 */
const COUNTRY_CLIMATE_INTELLIGENCE = (() => {
  'use strict';

  const VERSION = '1.1.0';
  const PANEL_METRICS = Object.freeze({
    carbon: Object.freeze([
      'emissions.fossil_co2.territorial',
      'emissions.fossil_co2.territorial_per_capita',
      'emissions.fossil_co2.cumulative',
      'emissions.fossil_co2.consumption',
      'emissions.fossil_co2.net_transfer',
      'emissions.land_use_co2.net',
      'emissions.ghg.independent',
    ]),
    power: Object.freeze([
      'electricity.clean_share',
      'electricity.fossil_share',
      'electricity.wind_solar_share',
      'electricity.clean_share_change_5y',
      'electricity.carbon_intensity',
      'electricity.emissions',
    ]),
    physical: Object.freeze([
      'climate.temperature.observed_trend',
      'climate.precipitation.observed_trend',
      'climate.temperature.change',
      'climate.precipitation.change',
    ]),
  });
  const PANEL_COPY = Object.freeze({
    carbon: Object.freeze({
      heading: 'Carbon responsibility',
      description: 'Fossil CO₂, land-use CO₂, and independent greenhouse-gas context remain separate because their accounting scopes differ.',
    }),
    power: Object.freeze({
      heading: 'Power transition',
      description: 'Generation shares use one published electricity taxonomy and do not represent the whole economy.',
    }),
    physical: Object.freeze({
      heading: 'Physical climate',
      description: 'Observed reanalysis and modeled mid-century changes are different evidence classes. Projected warming is not vulnerability or damage.',
    }),
  });
  const FACT_COPY = Object.freeze({
    'emissions.fossil_co2.territorial': 'Fossil fuel combustion, industrial processes, and cement carbonation sink; land use excluded.',
    'emissions.fossil_co2.territorial_per_capita': 'Exact 2024 territorial fossil CO₂ divided by the year-matched WPP 2024 Medium population projection.',
    'emissions.fossil_co2.cumulative': 'Sum of available territorial fossil CO₂ from 1850 through 2024.',
    'emissions.fossil_co2.consumption': 'Territorial fossil CO₂ adjusted for embodied trade; latest source year shown.',
    'emissions.fossil_co2.net_transfer': 'Territorial minus consumption-based fossil CO₂; positive values indicate net exported emissions embodied in trade.',
    'emissions.land_use_co2.net': 'Mean of BLUE, OSCAR, and LUCE over 2015–2024; negative values are net removals.',
    'emissions.ghg.independent': 'Independent 2024 GHG estimate excluding forestry/LULUCF, using AR6 GWP100. Not directly comparable with fossil CO₂.',
    'electricity.clean_share': 'Share of electricity generation in the published clean aggregate.',
    'electricity.fossil_share': 'Share of electricity generation in the published fossil aggregate.',
    'electricity.wind_solar_share': 'Combined wind and solar share of electricity generation.',
    'electricity.clean_share_change_5y': '2024 clean share minus 2019 clean share, in percentage points.',
    'electricity.carbon_intensity': 'Carbon dioxide emitted per unit of electricity generated.',
    'electricity.emissions': 'Annual power-sector carbon dioxide emissions.',
    'climate.temperature.observed_trend': 'OLS slope over annual ERA5 country aggregates, reported per decade when the reviewed snapshot is available.',
    'climate.precipitation.observed_trend': 'OLS slope over annual ERA5 country aggregates, reported per decade when the reviewed snapshot is available.',
    'climate.temperature.change': 'CMIP6 annual-mean change for 2040–2059 relative to 1995–2014; SSP2-4.5 median leads.',
    'climate.precipitation.change': 'CMIP6 annual-mean change for 2040–2059 relative to 1995–2014; SSP2-4.5 median leads.',
  });
  const PALETTES = Object.freeze({
    carbon: Object.freeze({ start: [77, 82, 156], end: [244, 127, 59], gap: [145, 160, 172] }),
    power: Object.freeze({ start: [77, 83, 130], end: [48, 196, 151], gap: [145, 160, 172] }),
    physical: Object.freeze({ start: [63, 111, 174], end: [232, 91, 69], gap: [145, 160, 172] }),
  });
  const EVIDENCE_LABELS = Object.freeze({
    actual: 'Annual actual',
    estimated: 'Source estimate',
    modeled: 'Climate model ensemble',
  });

  let _initialized = false;
  let _release = null;
  let _lensById = new Map();
  let _sourceById = new Map();
  let _orderByLens = new Map();
  let _domainByLens = new Map();
  let _countryById = new Map();

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function formatNumber(value, unit) {
    if (!finite(value)) return 'Not available';
    let digits = 2;
    if (unit === '%' || unit === 'percentage points' || unit === 'gCO2/kWh' || unit === 'mm/year' || unit === 'mm/decade') digits = 1;
    if (unit === 'persons') digits = 0;
    if (Math.abs(value) >= 1000) digits = 0;
    else if (Math.abs(value) >= 100) digits = Math.min(digits, 1);
    const sign = value > 0 && ['percentage points', '°C/decade', 'mm/decade', '°C', 'mm/year'].includes(unit) ? '+' : '';
    return sign + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  }

  function evidenceLabel(status, metricId) {
    if (status === 'modeled' && ['population.estimate', 'emissions.fossil_co2.territorial_per_capita'].includes(metricId)) {
      return 'Uses WPP Medium projection';
    }
    return EVIDENCE_LABELS[status] || 'Data gap';
  }

  function gapCopy(metric) {
    if (metric?.gap_reason?.detail) return metric.gap_reason.detail;
    return 'The exact metric, period, and evidence class required for this view are unavailable.';
  }

  function uncertaintyCopy(metric) {
    const uncertainty = metric?.uncertainty;
    if (!uncertainty) return 'No uncertainty statement is available because this metric is a documented gap.';
    if (finite(uncertainty.p10) && finite(uncertainty.p90)) {
      return 'p10–p90: ' + formatNumber(uncertainty.p10, metric.unit) + ' to ' + formatNumber(uncertainty.p90, metric.unit) + ' ' + metric.unit;
    }
    if (finite(uncertainty.sigma)) {
      return 'Model spread: ±' + formatNumber(uncertainty.sigma, metric.unit) + ' ' + metric.unit + ' (population standard deviation).';
    }
    if (finite(uncertainty.lower) && finite(uncertainty.upper)) {
      return formatNumber(uncertainty.lower, metric.unit) + ' to ' + formatNumber(uncertainty.upper, metric.unit) + ' ' + metric.unit;
    }
    return String(uncertainty.kind || 'Uncertainty not supplied in the source release').replace(/_/g, ' ') + '.';
  }

  function sourceRecords(metric) {
    return (metric?.source_ids || []).map(id => _sourceById.get(id)).filter(Boolean).map(source => ({
      id: source.id,
      title: source.title,
      version: source.version,
      url: source.source_url,
      attribution: source.attribution,
      review_state: source.review_state,
    }));
  }

  function factView(metricId, country) {
    const definition = _release.metric_definitions[metricId];
    const metric = country.metrics[metricId];
    const available = finite(metric?.value);
    const scenarioMedians = metric?.context?.scenario_medians || null;
    return {
      id: metricId,
      label: definition?.label || metricId,
      available,
      value: available ? metric.value : null,
      display_value: available ? formatNumber(metric.value, metric.unit) : 'Not available',
      unit: metric?.unit || null,
      period: metric?.period?.label || null,
      status: metric?.status || null,
      evidence_label: evidenceLabel(metric?.status, metricId),
      explanation: FACT_COPY[metricId] || '',
      gap: available ? null : {
        code: metric?.gap_reason?.code || 'metric_unavailable',
        detail: gapCopy(metric),
      },
      uncertainty: metric?.uncertainty || null,
      uncertainty_text: uncertaintyCopy(metric),
      scope: metric?.scope || null,
      scope_fingerprint: metric?.scope_fingerprint || null,
      transformation: metric?.transformation || null,
      fact_ids: Array.isArray(metric?.fact_ids) ? metric.fact_ids.slice() : [],
      sources: sourceRecords(metric),
      series: Array.isArray(metric?.series) ? metric.series.slice() : [],
      context: metric?.context || null,
      scenario_medians: scenarioMedians,
      non_comparable: metricId === 'emissions.ghg.independent',
    };
  }

  function normalize(lensId, value) {
    if (!finite(value)) return null;
    const domain = _domainByLens.get(lensId);
    if (!domain) return null;
    if (lensId === 'power') return Math.max(0, Math.min(1, value / 100));
    if (lensId === 'carbon') {
      const min = Math.log10(domain.min + domain.offset);
      const max = Math.log10(domain.max + domain.offset);
      if (max === min) return 0.5;
      return Math.max(0, Math.min(1, (Math.log10(Math.max(0, value) + domain.offset) - min) / (max - min)));
    }
    if (domain.max === domain.min) return 0.5;
    return Math.max(0, Math.min(1, (value - domain.min) / (domain.max - domain.min)));
  }

  function color(lensId, position, alpha) {
    const palette = PALETTES[lensId] || PALETTES.carbon;
    if (position === null) return 'rgba(' + palette.gap.join(',') + ',' + alpha + ')';
    const rgb = palette.start.map((channel, index) => Math.round(channel + (palette.end[index] - channel) * position));
    return 'rgba(' + rgb.join(',') + ',' + alpha + ')';
  }

  function tileSideColor(lensId, position) {
    const palette = PALETTES[lensId] || PALETTES.carbon;
    const rgb = position === null
      ? palette.gap
      : palette.start.map((channel, index) => Math.round(channel + (palette.end[index] - channel) * position));
    const shaded = rgb.map(channel => Math.max(8, Math.round(channel * 0.3)));
    return 'rgba(' + shaded.join(',') + ',0.86)';
  }

  function rankFor(lensId, countryId) {
    const order = _orderByLens.get(lensId);
    if (!order) return null;
    const ranked = order.ordered.find(entry => entry.country_id === countryId);
    if (ranked) {
      return {
        eligible: true,
        ordinal: ranked.ordinal,
        total: order.eligible_count,
        term: _lensById.get(lensId).rail_term,
        reason: null,
      };
    }
    const unranked = order.unranked.find(entry => entry.country_id === countryId);
    return {
      eligible: false,
      ordinal: null,
      total: order.eligible_count,
      term: _lensById.get(lensId).rail_term,
      reason: unranked?.reason || { code: 'not_in_comparison_set', detail: 'This entity is not in the exact comparison set.' },
    };
  }

  function atAGlanceMetrics(lensId) {
    if (lensId === 'power') return ['electricity.clean_share', 'electricity.clean_share_change_5y', 'electricity.carbon_intensity'];
    if (lensId === 'physical') return ['climate.temperature.change', 'climate.precipitation.change', 'climate.temperature.observed_trend'];
    return ['emissions.fossil_co2.territorial', 'emissions.fossil_co2.territorial_per_capita', 'emissions.fossil_co2.cumulative'];
  }

  function getCountryView(id, lensId = 'carbon') {
    if (!_initialized && !init()) return null;
    const lens = _lensById.get(lensId) || _lensById.get('carbon');
    const rawId = String(id || '').trim();
    const normalizedId = rawId.includes(':')
      ? rawId.slice(0, rawId.lastIndexOf(':') + 1).toLowerCase() + rawId.slice(rawId.lastIndexOf(':') + 1).toUpperCase()
      : rawId.toUpperCase();
    const country = _countryById.get(normalizedId) || _countryById.get(rawId);
    if (!country || !lens) return null;
    const primary = factView(lens.comparison_metric_id, country);
    const rank = rankFor(lens.id, country.country_id);
    const position = primary.available ? normalize(lens.id, primary.value) : null;
    const panel = PANEL_COPY[lens.id];
    const activeFacts = PANEL_METRICS[lens.id].map(metricId => factView(metricId, country));
    const citationOnlySources = _release.source_catalog
      .filter(source => source.public_role === 'citation_only')
      .map(source => ({ id: source.id, title: source.title, version: source.version, url: source.source_url, note: 'Citation retained for historical provenance; no values from this source appear in this release.' }));
    const rankText = rank.eligible
      ? lens.id === 'physical'
        ? 'Exploration order ' + rank.ordinal + ' of ' + rank.total + ' for the same modeled warming metric.'
        : 'Order ' + rank.ordinal + ' of ' + rank.total + ' for the same metric and period.'
      : 'Unranked: ' + rank.reason.detail;
    const metricRelief = position !== null && lens.visual.extrusion !== 'none';
    const reliefKind = lens.visual.extrusion === 'transparent_log' ? 'metric_log' : 'metric_linear';
    return {
      version: VERSION,
      lens,
      country: {
        country_id: country.country_id,
        iso_alpha2: country.iso_alpha2,
        iso_alpha3: country.iso_alpha3,
        name: country.name,
        flag_emoji: country.flag_emoji || '',
      },
      primary,
      rank,
      rank_text: rankText,
      tooltip: {
        heading: lens.heading,
        value: primary.display_value,
        unit: primary.unit,
        period: primary.period || lens.period,
        evidence_class: primary.available ? primary.evidence_label : 'Data gap; requires ' + evidenceLabel(lens.evidence_status, lens.comparison_metric_id),
        gap: primary.gap,
      },
      at_a_glance: atAGlanceMetrics(lens.id).map(metricId => factView(metricId, country)),
      active_panel: {
        id: lens.id,
        heading: panel.heading,
        description: panel.description,
        facts: activeFacts,
      },
      visual: {
        eligible: primary.available && rank.eligible,
        normalized: position,
        color: color(lens.id, position, 0.7),
        solid_color: color(lens.id, position, 0.92),
        altitude: metricRelief ? round(0.007 + position * 0.022, 6) : 0.007,
        extrusion: lens.visual.extrusion,
        relief: metricRelief ? reliefKind : 'base_tile',
        relief_encodes_metric: metricRelief,
        side_color: lens.id === 'carbon' ? 'rgba(0,0,0,0)' : tileSideColor(lens.id, position),
      },
      methods: {
        release_id: _release.release.id,
        release_status: _release.release.status,
        review_label: 'Normalized candidate · source revalidation pending',
        review_state: _release.release.review_state,
        generated_on: _release.release.generated_on,
        checksum: _release.release.verified_sha256 || null,
        facts: activeFacts,
        citation_only_sources: citationOnlySources,
        official_context: Array.isArray(country.official_context) ? country.official_context.slice() : [],
        comparison_rule: _release.boundaries.source_comparison_rule,
      },
      accessible_summary: country.name + '. ' + lens.heading + '. ' + (primary.available
        ? primary.display_value + ' ' + primary.unit + ', ' + primary.evidence_label + '. ' + rankText
        : primary.gap.detail + ' Unranked.'),
    };
  }

  function getRailRows(lensId = 'carbon') {
    if (!_initialized && !init()) return null;
    const lens = _lensById.get(lensId) || _lensById.get('carbon');
    const order = _orderByLens.get(lens.id);
    if (!order) return null;
    const ordered = order.ordered.map(entry => ({
      ...entry,
      ranked: true,
      display_value: formatNumber(entry.value, entry.unit),
      evidence_label: evidenceLabel(entry.evidence_status, lens.comparison_metric_id),
    }));
    const unranked = order.unranked.map(entry => ({
      ...entry,
      ranked: false,
      display_value: 'Data gap',
      evidence_label: 'Data gap',
    }));
    return {
      lens,
      ordered,
      unranked,
      all: ordered.concat(unranked),
      eligible_count: order.eligible_count,
      unranked_count: order.unranked_count,
      disclosure: order.rule,
    };
  }

  function getLegend(lensId = 'carbon') {
    if (!_initialized && !init()) return null;
    const lens = _lensById.get(lensId) || _lensById.get('carbon');
    const rows = getRailRows(lens.id);
    const palette = PALETTES[lens.id];
    const labels = lens.id === 'power'
      ? ['0% clean', '100% clean']
      : lens.id === 'physical'
        ? ['Lower projected warming', 'Higher projected warming']
        : ['Lower territorial fossil CO₂', 'Higher territorial fossil CO₂'];
    return {
      lens_id: lens.id,
      heading: lens.heading,
      interpretation: lens.interpretation,
      low_label: labels[0],
      high_label: labels[1],
      gap_label: rows.unranked_count + ' explicit data gaps',
      low_color: 'rgb(' + palette.start.join(',') + ')',
      high_color: 'rgb(' + palette.end.join(',') + ')',
      gap_color: 'rgb(' + palette.gap.join(',') + ')',
      extrusion_note: lens.id === 'carbon'
        ? 'Transparent log-scaled tile height and color show magnitude.'
        : lens.id === 'power'
          ? 'Bounded linear tile height and color show clean electricity share.'
          : 'Linear tile height and color show projected warming—not vulnerability or damage.',
      evidence_label: evidenceLabel(lens.evidence_status, lens.comparison_metric_id),
    };
  }

  function init() {
    const release = safeGet('Data', 'getClimateIntelligenceRelease', null);
    if (!release || !safeGet('Data', 'isClimateIntelligenceReady', false)) {
      _initialized = false;
      return false;
    }
    _release = release;
    _lensById = new Map(release.lens_catalog.map(lens => [lens.id, lens]));
    _sourceById = new Map(release.source_catalog.map(source => [source.id, source]));
    _orderByLens = new Map(Object.entries(release.lens_orders));
    _countryById = new Map();
    release.countries.forEach(country => {
      _countryById.set(country.country_id, country);
      _countryById.set(country.iso_alpha3, country);
      if (country.iso_alpha2) _countryById.set(country.iso_alpha2, country);
    });
    _domainByLens = new Map(release.lens_catalog.map(lens => {
      const values = release.lens_orders[lens.id].ordered.map(entry => entry.value).filter(finite);
      const min = values.length ? Math.min(...values) : 0;
      const max = values.length ? Math.max(...values) : 1;
      const positive = values.filter(value => value > 0);
      const offset = lens.id === 'carbon' ? Math.max((positive.length ? Math.min(...positive) : 0.01) / 10, 0.000001) : 0;
      return [lens.id, { min, max, offset }];
    }));
    _initialized = true;
    if (hasModule('EventBus')) EventBus.emit('climate-intelligence:ready', { releaseId: release.release.id, entityCount: release.countries.length });
    return true;
  }

  function reset() {
    return init();
  }

  function destroy() {
    _initialized = false;
    _release = null;
    _lensById = new Map();
    _sourceById = new Map();
    _orderByLens = new Map();
    _domainByLens = new Map();
    _countryById = new Map();
    return true;
  }

  function getState() {
    return {
      initialized: _initialized,
      version: VERSION,
      releaseId: _release?.release?.id || null,
      entityCount: _release?.countries?.length || 0,
      lenses: Array.from(_lensById.keys()),
    };
  }

  return { init, getCountryView, getRailRows, getLegend, getState, reset, destroy };
})();

window.COUNTRY_CLIMATE_INTELLIGENCE = COUNTRY_CLIMATE_INTELLIGENCE;

if (hasModule('MODULE_CONTRACTS')) {
  MODULE_CONTRACTS.register('COUNTRY_CLIMATE_INTELLIGENCE', {
    provides: ['init', 'getCountryView', 'getRailRows', 'getLegend', 'getState', 'reset', 'destroy'],
    requires: ['Data', 'EventBus'],
    emits: ['climate-intelligence:ready'],
  });
}
