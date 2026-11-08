/**
 * COUNTRY CLIMATE INTELLIGENCE — metric-first presentation policy.
 *
 * Data owns the verified snapshot. This module owns lens selection, ranking
 * eligibility, gap language, evidence labels, visual normalization, and the
 * country-card view model. GlobeModule only renders these decisions.
 */
const COUNTRY_CLIMATE_INTELLIGENCE = (() => {
  'use strict';

  const VERSION = '1.10.0';
  const RELIEF_BASE_ALTITUDE = 0.007;
  const RELIEF_RANGE = 0.005;
  const CARBON_RELIEF_DEMO_VALUE = 'low-is-high';
  const PANEL_METRICS = Object.freeze({
    carbon: Object.freeze([
      'emissions.fossil_co2.territorial',
      'emissions.fossil_co2.territorial_per_capita',
      'emissions.fossil_co2.cumulative',
      'emissions.fossil_co2.consumption',
      'emissions.fossil_co2.net_transfer',
      'emissions.land_use_co2.net',
    ]),
    power: Object.freeze([
      'electricity.clean_share',
      'electricity.fossil_share',
      'electricity.wind_solar_share',
      'electricity.generation_share.bioenergy',
      'electricity.generation_share.coal',
      'electricity.generation_share.gas',
      'electricity.generation_share.hydro',
      'electricity.generation_share.nuclear',
      'electricity.generation_share.other_fossil',
      'electricity.generation_share.other_renewables',
      'electricity.generation_share.solar',
      'electricity.generation_share.wind',
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
      description: 'Fossil CO₂ and land-use CO₂ remain separate because their accounting scopes differ.',
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
    'emissions.fossil_co2.cumulative': 'Sum of available annual territorial fossil CO₂ values within 1850–2024.',
    'emissions.fossil_co2.consumption': 'Territorial fossil CO₂ adjusted for embodied trade; latest source year shown.',
    'emissions.fossil_co2.net_transfer': 'Territorial minus consumption-based fossil CO₂; positive values indicate net exported emissions embodied in trade.',
    'emissions.land_use_co2.net': 'Mean of BLUE, OSCAR, and LUCE over 2015–2024; negative values are net removals.',
    'electricity.clean_share': 'Share of electricity generation in the published clean aggregate.',
    'electricity.fossil_share': 'Share of electricity generation in the published fossil aggregate.',
    'electricity.wind_solar_share': 'Combined wind and solar share of electricity generation.',
    'electricity.generation_share.bioenergy': 'Bioenergy share of total electricity generation in Ember’s standardized fuel taxonomy.',
    'electricity.generation_share.coal': 'Coal share of total electricity generation in Ember’s standardized fuel taxonomy.',
    'electricity.generation_share.gas': 'Gas share of total electricity generation in Ember’s standardized fuel taxonomy.',
    'electricity.generation_share.hydro': 'Hydro share of total electricity generation in Ember’s standardized fuel taxonomy.',
    'electricity.generation_share.nuclear': 'Nuclear share of total electricity generation in Ember’s standardized fuel taxonomy.',
    'electricity.generation_share.other_fossil': 'Other fossil share of total electricity generation in Ember’s standardized fuel taxonomy.',
    'electricity.generation_share.other_renewables': 'Other Renewables combines geothermal, tidal, and wave generation; Ember does not separate those technologies here.',
    'electricity.generation_share.solar': 'Solar share of total electricity generation in Ember’s standardized fuel taxonomy.',
    'electricity.generation_share.wind': 'Wind share of total electricity generation in Ember’s standardized fuel taxonomy.',
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
  let _rankByLens = new Map();
  let _domainByLens = new Map();
  let _countryById = new Map();
  let _visualByLens = new Map();
  let _railRowsByLens = new Map();
  let _legendByLens = new Map();
  let _carbonReliefMode = 'higher_value_higher';

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
    if (unit === '%' || unit === 'percentage points' || unit === 'gCO2/kWh' || unit === 'mm/year' || unit === 'mm/year/decade') digits = 1;
    if (unit === 'persons') digits = 0;
    if (Math.abs(value) >= 1000) digits = 0;
    else if (Math.abs(value) >= 100) digits = Math.min(digits, 1);
    const sign = value > 0 && ['percentage points', '°C/decade', 'mm/year/decade', '°C', 'mm/year'].includes(unit) ? '+' : '';
    return sign + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  }

  function evidenceLabel(status, metricId, evidenceKind = null) {
    if (evidenceKind === 'reanalysis') return 'ERA5 reanalysis';
    if (status === 'modeled' && ['population.wpp_medium_projection', 'emissions.fossil_co2.territorial_per_capita'].includes(metricId)) {
      return 'Uses WPP Medium projection';
    }
    if (status === 'modeled' && ['climate.temperature.observed_trend', 'climate.precipitation.observed_trend'].includes(metricId)) {
      return 'ERA5 reanalysis';
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
    const availableYears = metricId === 'emissions.fossil_co2.cumulative'
      && Number.isInteger(metric?.context?.available_years)
      && metric.context.available_years > 0
      ? metric.context.available_years
      : null;
    const explanation = availableYears === null
      ? (FACT_COPY[metricId] || '')
      : `Sum of ${availableYears} available annual territorial fossil CO₂ values within 1850–2024.`;
    return {
      id: metricId,
      label: definition?.label || metricId,
      available,
      value: available ? metric.value : null,
      display_value: available ? formatNumber(metric.value, metric.unit) : 'Not available',
      unit: metric?.unit || null,
      period: metric?.period?.label || null,
      status: metric?.status || null,
      evidence_kind: metric?.evidence_kind || null,
      evidence_label: evidenceLabel(metric?.status, metricId, metric?.evidence_kind),
      explanation,
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
      series_label: metric?.context?.series_label || null,
      series_unit: metric?.context?.series_unit || metric?.unit || null,
      trend_line: Array.isArray(metric?.context?.trend_line) ? metric.context.trend_line.slice() : [],
      context: metric?.context || null,
      scenario_medians: scenarioMedians,
    };
  }

  function releaseReviewLabel() {
    const release = _release?.release || {};
    if (release.status === 'production'
      && release.production_runtime_release === true
      && release.review_state === 'independently_reviewed') {
      return 'Independently reviewed release · raw sources revalidated';
    }
    return 'Normalized candidate · raw sources revalidated · independent review pending';
  }

  function buildTemperatureProjectionRange(fact) {
    const p10 = fact?.uncertainty?.p10;
    const median = fact?.value;
    const p90 = fact?.uncertainty?.p90;
    if (!fact?.available || !finite(p10) || !finite(median) || !finite(p90) || p10 > median || median > p90) return null;
    const markers = Object.freeze([
      Object.freeze({ id: 'p10', label: 'p10', value: p10, shape: 'square' }),
      Object.freeze({ id: 'median', label: 'Median', value: median, shape: 'diamond' }),
      Object.freeze({ id: 'p90', label: 'p90', value: p90, shape: 'circle' }),
    ]);
    return Object.freeze({
      id: 'climate.temperature.change.published_range',
      source_metric_id: fact.id,
      title: 'Published temperature-change range',
      evidence_class: 'modeled_projection_summary',
      evidence_kind: 'climate_model_ensemble',
      ranking_eligible: false,
      annual_timing: false,
      scenario: 'SSP2-4.5',
      period: fact.period ? String(fact.period).split(' vs ')[0] : '2040–2059',
      baseline: fact.context?.baseline || '1995–2014',
      unit: fact.unit,
      p10,
      median,
      p90,
      markers,
      source_uncertainty_kind: fact.uncertainty?.kind || 'multi_model_ensemble_percentile_range',
      method: 'The published CCKP multi-model p10, median, and p90 are copied directly without interpolation or sampling.',
      disclosure: 'Multi-model percentile summary—not a probabilistic forecast, annual trajectory, or new simulation.',
    });
  }

  function buildPowerField(facts) {
    const byId = new Map(facts.map(fact => [fact.id, fact]));
    const clean = byId.get('electricity.clean_share');
    const fossil = byId.get('electricity.fossil_share');
    const validShare = fact => fact?.available
      && fact.unit === '%'
      && finite(fact.value)
      && fact.value >= 0
      && fact.value <= 100;
    if (!validShare(clean)) return null;

    const cleanSourceIds = new Set(clean.sources.map(source => source.id));
    const compatibleShare = fact => validShare(fact)
      && fact.period === clean.period
      && fact.status === clean.status
      && fact.context?.source_evidence_class === clean.context?.source_evidence_class
      && fact.sources.some(source => cleanSourceIds.has(source.id));
    if (!compatibleShare(fossil)) return null;

    const reconciliation = clean.context?.fuel_mix_reconciliation || null;
    const mixGap = clean.context?.fuel_mix_gap_reason || 'Exact 2024 fuel shares are unavailable for this entity.';
    const shareLabel = value => value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const segmentDefinitions = [
      ['electricity.generation_share.nuclear', 'Nuclear', 'nuclear', 'clean'],
      ['electricity.generation_share.hydro', 'Hydro', 'hydro', 'clean'],
      ['electricity.generation_share.wind', 'Wind', 'wind', 'clean'],
      ['electricity.generation_share.solar', 'Solar', 'solar', 'clean'],
      ['electricity.generation_share.bioenergy', 'Bioenergy', 'bioenergy', 'clean'],
      ['electricity.generation_share.other_renewables', 'Other renewables', 'other-renewables', 'clean'],
      ['electricity.generation_share.coal', 'Coal', 'coal', 'fossil'],
      ['electricity.generation_share.gas', 'Gas', 'gas', 'fossil'],
      ['electricity.generation_share.other_fossil', 'Other fossil', 'other-fossil', 'fossil'],
    ];
    const segments = segmentDefinitions.map(([metricId, label, pattern, group]) => {
      const fact = byId.get(metricId);
      const available = compatibleShare(fact)
        && fact.context?.fuel_group === group
        && fact.context?.taxonomy === 'Ember published generation-fuel taxonomy';
      return Object.freeze({
        id: metricId,
        label,
        pattern,
        group,
        available,
        value: available ? fact.value : null,
        display_value: available ? shareLabel(fact.value) : 'Data gap',
        unit: available ? fact.unit : null,
        gap: available
          ? null
          : (fact?.available
              ? 'Not drawn because its period, evidence class, fuel group, or source taxonomy does not match the clean-share anchor.'
              : fact?.gap?.detail || 'The exact generation-fuel share is unavailable.'),
      });
    });
    if (!reconciliation || reconciliation.available !== true) {
      return Object.freeze({
        id: 'electricity.generation_mix',
        title: 'Generation mix',
        period: clean.period,
        evidence_label: clean.evidence_label,
        available: false,
        gap: mixGap,
        ranking_eligible: false,
        lanes: Object.freeze([]),
        visualized_fact_ids: Object.freeze([]),
        method: 'No fuel mix is rendered without non-blank source fuel rows and an exact reconciliation receipt.',
        disclosure: 'Missing fuel values remain gaps and are never converted to zero.',
      });
    }

    const lanes = [
      ['clean', 'Clean generation', clean, reconciliation.clean_component_sum],
      ['fossil', 'Fossil generation', fossil, reconciliation.fossil_component_sum],
    ].map(([id, label, fact, componentSum]) => Object.freeze({
      id,
      label,
      available: true,
      value: fact.value,
      component_sum: componentSum,
      display_value: shareLabel(fact.value),
      unit: fact.unit,
      segments: Object.freeze(segments.filter(segment => segment.group === id)),
    }));
    const variance = reconciliation.rounding_variance_from_100_pp;
    const roundingDisclosure = Math.abs(variance) < 0.000001
      ? 'Published non-blank fuel components reconcile to 100.00%.'
      : 'Published non-blank fuel components sum to ' + shareLabel(reconciliation.published_component_sum) + '%; '
        + (variance > 0 ? '+' : '') + shareLabel(variance) + ' percentage points is source rounding.';
    return Object.freeze({
      id: 'electricity.generation_mix',
      title: 'Generation mix',
      period: clean.period,
      evidence_label: clean.evidence_label,
      available: true,
      ranking_eligible: false,
      lanes: Object.freeze(lanes),
      published_component_sum: reconciliation.published_component_sum,
      rounding_variance_pp: variance,
      tolerance_pp: reconciliation.tolerance_pp,
      visual_normalization_applied: reconciliation.visual_normalization_applied,
      visualized_fact_ids: Object.freeze([
        'electricity.clean_share',
        'electricity.fossil_share',
        ...segments.map(segment => segment.id),
      ]),
      method: 'Two aligned bars copy exact shares of total electricity generation. Each bar is subdivided by the non-blank published fuel rows in the same annual Ember taxonomy.',
      disclosure: 'Clean and fossil use one 0–100% scale and form the published generation total. ' + roundingDisclosure + ' Blank fuel cells remain labelled data gaps; no browser rescaling is applied.',
      taxonomy_note: 'Other renewables is Ember’s combined geothermal, tidal, and wave category.',
    });
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

  function carbonReliefMode() {
    try {
      const query = new URLSearchParams(window.location.search);
      return query.get('carbon-relief') === CARBON_RELIEF_DEMO_VALUE
        ? 'lower_value_higher'
        : 'higher_value_higher';
    } catch (_) {
      return 'higher_value_higher';
    }
  }

  function normalizeCountryId(id) {
    const rawId = String(id || '').trim();
    return rawId.includes(':')
      ? rawId.slice(0, rawId.lastIndexOf(':') + 1).toLowerCase() + rawId.slice(rawId.lastIndexOf(':') + 1).toUpperCase()
      : rawId.toUpperCase();
  }

  function rankFor(lensId, countryId) {
    const order = _orderByLens.get(lensId);
    if (!order) return null;
    const indexed = _rankByLens.get(lensId)?.get(countryId);
    const ranked = indexed?.ranked ? indexed.entry : null;
    if (ranked) {
      return {
        eligible: true,
        ordinal: ranked.ordinal,
        total: order.eligible_count,
        term: _lensById.get(lensId).rail_term,
        reason: null,
      };
    }
    const unranked = indexed && !indexed.ranked ? indexed.entry : null;
    return {
      eligible: false,
      ordinal: null,
      total: order.eligible_count,
      term: _lensById.get(lensId).rail_term,
      reason: unranked?.reason || { code: 'not_in_comparison_set', detail: 'This entity is not in the exact comparison set.' },
    };
  }

  function getCountryVisual(id, lensId = 'carbon') {
    if (!_initialized && !init()) return null;
    const lens = _lensById.get(lensId) || _lensById.get('carbon');
    const rawId = String(id || '').trim();
    const country = _countryById.get(normalizeCountryId(rawId)) || _countryById.get(rawId);
    if (!country || !lens) return null;

    let lensCache = _visualByLens.get(lens.id);
    if (!lensCache) {
      lensCache = new Map();
      _visualByLens.set(lens.id, lensCache);
    }
    const cached = lensCache.get(country.country_id);
    if (cached) return cached;

    const metric = country.metrics[lens.comparison_metric_id];
    const value = finite(metric?.value) ? metric.value : null;
    const position = value === null ? null : normalize(lens.id, value);
    const rank = rankFor(lens.id, country.country_id);
    const metricRelief = position !== null && lens.visual.extrusion !== 'none';
    const reliefKind = lens.visual.extrusion === 'transparent_log' ? 'metric_log' : 'metric_linear';
    const inverseCarbonDemo = lens.id === 'carbon' && _carbonReliefMode === 'lower_value_higher';
    const reliefPosition = metricRelief && inverseCarbonDemo ? 1 - position : position;
    const visual = Object.freeze({
      available: value !== null,
      eligible: value !== null && rank?.eligible === true,
      normalized: position,
      color: color(lens.id, position, 0.7),
      solid_color: color(lens.id, position, 0.92),
      altitude: metricRelief ? round(RELIEF_BASE_ALTITUDE + reliefPosition * RELIEF_RANGE, 6) : RELIEF_BASE_ALTITUDE,
      extrusion: lens.visual.extrusion,
      relief: metricRelief ? reliefKind : 'base_tile',
      relief_encodes_metric: metricRelief,
      relief_normalized: metricRelief ? round(reliefPosition, 6) : null,
      relief_direction: inverseCarbonDemo ? 'lower_value_higher' : 'higher_value_higher',
      relief_demo: inverseCarbonDemo,
      side_color: lens.id === 'carbon' ? 'rgba(0,0,0,0)' : tileSideColor(lens.id, position),
    });
    lensCache.set(country.country_id, visual);
    return visual;
  }

  function atAGlanceMetrics(lensId) {
    if (lensId === 'power') return ['electricity.clean_share', 'electricity.clean_share_change_5y', 'electricity.carbon_intensity'];
    if (lensId === 'physical') return [];
    return ['emissions.fossil_co2.territorial', 'emissions.fossil_co2.territorial_per_capita', 'emissions.fossil_co2.cumulative'];
  }

  const NBS_PATHWAY_META = Object.freeze([
    Object.freeze({ id: 'seagrass', label: 'Seagrass (Posidonia & Zostera)', short_label: 'Seagrass', group: 'Coastal Blue Carbon' }),
    Object.freeze({ id: 'mangroves', label: 'Mangroves', short_label: 'Mangroves', group: 'Coastal Blue Carbon' }),
    Object.freeze({ id: 'algae', label: 'Macroalgae & Kelp', short_label: 'Algae / Kelp', group: 'Coastal Blue Carbon' }),
    Object.freeze({ id: 'hemp', label: 'Industrial Hemp (Cannabis sativa)', short_label: 'Industrial Hemp', group: 'Terrestrial & Industrial' }),
    Object.freeze({ id: 'biochar', label: 'Pyrogenic Biochar CDR', short_label: 'Biochar CDR', group: 'Pyrogenic Carbon Removal' }),
  ]);

  const NBS_METRIC_LABELS = Object.freeze({
    extent_ha: 'Mapped ecosystem extent (ha)',
    extent_km2: 'Mapped ecosystem extent (km²)',
    extent_change_ha: 'Net extent change (ha)',
    loss_ha: 'Historical habitat loss (ha)',
    gain_ha: 'Habitat gain / expansion (ha)',
    loss_rate_pct_yr: 'Annual habitat change rate (%/yr)',
    carbon_stock_mtc: 'Total carbon stock (MtC)',
    carbon_stock_total_MtC: 'Total carbon stock (MtC)',
    carbon_stock_t_c_ha: 'Carbon stock density (tC/ha)',
    carbon_stock_tC_ha: 'Carbon stock density (tC/ha)',
    sediment_carbon_density_gC_cm3: 'Sediment organic carbon density (gC/cm³)',
    burial_rate_gC_m2_yr: 'Carbon burial rate (gC/m²/yr)',
    soil_carbon_stock_mt_co2e: 'Soil organic carbon stock (MtCO₂e)',
    biomass_carbon_stock_mt_co2e: 'Biomass carbon stock (MtCO₂e)',
    total_carbon_stock_mt_co2e: 'Total ecosystem carbon stock (MtCO₂e)',
    sequestration_rate_t_c_ha_yr: 'Carbon burial / sequestration rate (tC/ha/yr)',
    sequestration_tCO2_ha_yr: 'Annual sequestration rate (tCO₂/ha/yr)',
    sequestration_total_MtCO2_yr: 'Total annual sequestration (MtCO₂/yr)',
    emissions_from_loss_MtCO2_yr: 'Annual emissions from habitat loss (MtCO₂/yr)',
    protected_fraction_pct: 'Protected habitat share (%)',
    restoration_potential_ha: 'Biophysical restorable area (ha)',
    restoration_area_ha: 'Field restoration site area (ha)',
    restoration_survival_pct: 'Field restoration survival (%)',
    restoration_cost_usd_ha: 'Field restoration cost (USD/ha)',
    rle_status: 'IUCN Red List of Ecosystems status',
    production_t_yr: 'Annual production (t/yr)',
    production_wet_t: 'Annual wet-weight harvest (t)',
    area_cultivated_ha: 'Cultivated / harvested area (ha)',
    harvested_area_ha: 'Harvested cultivation area (ha)',
    yield_t_ha_yr: 'Agronomic yield (t/ha/yr)',
    biomass_t_ha: 'Dry biomass density (t/ha)',
    dry_biomass_t_ha: 'Dry biomass yield (t/ha)',
    npp_gC_m2_yr: 'Net primary productivity (gC/m²/yr)',
    export_TgC_yr: 'Carbon export flux (TgC/yr)',
    carbon_content_pct: 'Biomass / biochar carbon content (%)',
    h_corg_ratio: 'Molar H/Corg stability ratio',
    permanence_fraction: '100-year permanence fraction',
    removal_potential_MtCO2_yr: 'CDR mitigation potential (MtCO₂/yr)',
    technical_potential_mt_co2_yr: 'Technical CDR mitigation potential (MtCO₂/yr)',
    economic_potential_mt_co2_yr: 'Cost-effective (<$100/tCO₂e) potential (MtCO₂/yr)',
    projects_count: 'Voluntary carbon market projects',
    credits_issued_tCO2: 'Carbon credits issued (tCO₂)',
    credits_retired_tCO2: 'Carbon credits retired (tCO₂)',
    price_usd_tCO2: 'Carbon credit price (USD/tCO₂)',
    tonnes_delivered_tCO2: 'Delivered biochar CDR (tCO₂)',
  });

  function formatNbsValue(value, unit) {
    if (typeof value === 'string') return value;
    if (!finite(value)) return 'Not available';
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    }
    if (Math.abs(value) >= 10) {
      return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  }

  function resolveNbsSource(atlas, sourceId) {
    if (!sourceId) return null;
    const src = atlas?.sources?.[sourceId] || safeCall('Data', 'getNbsSource', sourceId);
    if (!src) return { id: sourceId, title: sourceId, year: null, doi: null, url: null, license: null };
    const doi = src.doi ? String(src.doi).trim() : null;
    const url = doi && /^10\./.test(doi)
      ? 'https://doi.org/' + doi
      : (typeof src.url === 'string' && /^https:\/\//.test(src.url) ? src.url : null);
    const license = src.license || src.licence?.identifier || null;
    const licenseStatus = src.license_status || src.licence?.status || null;
    return {
      id: src.source_id || src.id || sourceId,
      title: src.title || sourceId,
      year: src.year || null,
      doi,
      url,
      license,
      license_status: licenseStatus,
    };
  }

  function buildMedRestorationSummaryForIso(atlas, iso3) {
    const benchmarks = atlas?.mediterranean_seagrass_spotlight?.mediterranean_field_and_restoration_benchmarks;
    if (!Array.isArray(benchmarks)) return null;
    const summary = {};
    benchmarks.filter(b => b.iso3 === iso3).forEach(b => {
      const count = b.stats?.count ?? b.count ?? 0;
      const min = b.stats?.min ?? b.min ?? null;
      const max = b.stats?.max ?? b.max ?? null;
      if (!count || min === null || max === null) return;
      if (!summary[b.metric]) {
        summary[b.metric] = { count, min, max, unit: b.unit || '' };
      } else {
        summary[b.metric].count += count;
        summary[b.metric].min = Math.min(summary[b.metric].min, min);
        summary[b.metric].max = Math.max(summary[b.metric].max, max);
      }
    });
    return Object.keys(summary).length ? summary : null;
  }

  function getNbsCountrySummary(id) {
    const rawId = String(id || '').trim();
    const iso3 = rawId.includes(':') ? rawId.slice(rawId.lastIndexOf(':') + 1).toUpperCase() : rawId.toUpperCase();
    const atlasReady = safeGet('Data', 'isNbsAtlasReady', false);
    const atlas = safeGet('Data', 'getNbsAtlas', null);
    if (!atlasReady || !atlas) {
      return {
        ready: false,
        available: false,
        iso_alpha3: iso3,
        pathways: [],
        policies: [],
      };
    }
    const record = atlas.countries?.[iso3] || safeCall('Data', 'getNbsCountry', iso3);
    if (!record) {
      return {
        ready: true,
        available: false,
        iso_alpha3: iso3,
        mediterranean_basin: false,
        active_pathway_count: 0,
        pathways: NBS_PATHWAY_META.map(meta => ({
          ...meta,
          available: false,
          metrics: [],
          species: [],
          local_summary: null,
        })),
        policies: [],
      };
    }

    const categoriesMap = record.categories || record.pathways || {};
    const pathways = NBS_PATHWAY_META.map(meta => {
      const pData = categoriesMap[meta.id];
      if (!pData) {
        return {
          ...meta,
          available: false,
          metrics: [],
          species: [],
          local_summary: null,
        };
      }
      const metricsObj = pData.metrics || {};
      const metrics = Object.keys(metricsObj).map(metricKey => {
        const m = metricsObj[metricKey];
        const baseMetric = m.metric || metricKey.split('|')[0];
        const qualifier = m.qualifier || (metricKey.includes('|') ? metricKey.split('|')[1] : null);
        const latestEntries = Array.isArray(m?.latest) ? m.latest.slice() : [];
        const seenSources = new Set(latestEntries.map(e => e.source_id).filter(Boolean));
        const obsList = Array.isArray(m?.observations) ? m.observations : [];
        for (let i = obsList.length - 1; i >= 0; i--) {
          const obs = obsList[i];
          if (obs && obs.source_id && !seenSources.has(obs.source_id)) {
            seenSources.add(obs.source_id);
            latestEntries.push(obs);
          }
        }
        const entries = latestEntries.map(entry => {
          const source = resolveNbsSource(atlas, entry.source_id);
          const low = finite(entry.uncertainty_lower) ? entry.uncertainty_lower : (finite(entry.low) ? entry.low : null);
          const high = finite(entry.uncertainty_upper) ? entry.uncertainty_upper : (finite(entry.high) ? entry.high : null);
          return {
            value: entry.value,
            display_value: formatNbsValue(entry.value, entry.unit || m.unit),
            unit: entry.unit || m.unit || '',
            year: entry.year || null,
            value_type: entry.value_type || entry.evidence_class || 'observation',
            scope: entry.scope || qualifier || entry.basis?.moisture_basis || entry.basis?.confidence_class || null,
            uncertainty_lower: low,
            uncertainty_upper: high,
            methodology: entry.methodology || entry.basis?.note || null,
            caveats: entry.caveats || null,
            source_id: entry.source_id || null,
            source,
          };
        });
        const baseLabel = NBS_METRIC_LABELS[baseMetric] || atlas.metrics_catalog?.[baseMetric]?.label || baseMetric.replace(/_/g, ' ');
        return {
          id: metricKey,
          label: qualifier ? baseLabel + ' · ' + qualifier.replace(/_/g, ' ') : baseLabel,
          unit: m.unit || entries[0]?.unit || '',
          collision: Boolean(m.collision_in_latest) || entries.length > 1,
          entries,
          series_years: m.series_summary ? [m.series_summary.first_year, m.series_summary.latest_year].filter(Boolean) : [],
        };
      }).filter(m => m.entries.length > 0);

      const speciesObj = pData.species || {};
      const species = Object.keys(speciesObj).map(spKey => {
        const sp = speciesObj[spKey];
        const byYear = sp?.by_year || {};
        const years = Object.keys(byYear).sort();
        const latestYear = years.length ? years[years.length - 1] : null;
        const latestEntries = latestYear ? (byYear[latestYear] || []) : [];
        const primaryEntry = latestEntries[0] || null;
        return primaryEntry ? {
          id: spKey,
          label: spKey.replace(/__/g, ' · ').replace(/_/g, ' '),
          year: primaryEntry.year || latestYear,
          value: primaryEntry.value,
          display_value: formatNbsValue(primaryEntry.value, primaryEntry.unit || sp.unit),
          unit: primaryEntry.unit || sp.unit || '',
          source: resolveNbsSource(atlas, primaryEntry.source_id),
        } : null;
      }).filter(Boolean);

      let localSummary = null;
      const siteBuckets = Array.isArray(pData.site_and_subnational) ? pData.site_and_subnational : [];
      if (siteBuckets.length > 0) {
        let totalRecords = 0;
        const localMetrics = siteBuckets.map(b => {
          const count = b.stats?.count ?? b.count ?? 0;
          totalRecords += count;
          const min = finite(b.stats?.min) ? b.stats.min : (finite(b.min) ? b.min : null);
          const max = finite(b.stats?.max) ? b.stats.max : (finite(b.max) ? b.max : null);
          const baseLabel = NBS_METRIC_LABELS[b.metric] || atlas.metrics_catalog?.[b.metric]?.label || b.metric.replace(/_/g, ' ');
          const speciesSuffix = Array.isArray(b.species) && b.species.length ? ' · ' + b.species.join(', ') : '';
          return {
            id: b.metric + (b.level ? '|' + b.level : ''),
            label: baseLabel + speciesSuffix,
            count,
            unit: b.unit || '',
            min,
            max,
            display_range: min !== null && max !== null
              ? (min === max
                  ? formatNbsValue(min, b.unit)
                  : formatNbsValue(min, b.unit) + ' – ' + formatNbsValue(max, b.unit))
              : null,
            sources: (b.sources || []).map(sid => resolveNbsSource(atlas, sid)).filter(Boolean),
            sample_sites: (b.sample_sites || []).map(site => ({
              ...site,
              site: site.site || site.name || site.site_name || iso3,
              display_value: formatNbsValue(site.value, site.unit || b.unit),
              source: resolveNbsSource(atlas, site.source_id),
            })),
          };
        });
        localSummary = {
          total_records: totalRecords,
          metrics: localMetrics,
        };
      } else if (pData.local_summary && pData.local_summary.total_records > 0) {
        const byMetricObj = pData.local_summary.by_metric || {};
        const localMetrics = Object.keys(byMetricObj).map(metricKey => {
          const lm = byMetricObj[metricKey];
          return {
            id: metricKey,
            label: NBS_METRIC_LABELS[metricKey] || metricKey.replace(/_/g, ' '),
            count: lm.count,
            unit: lm.unit || '',
            min: finite(lm.min) ? lm.min : null,
            max: finite(lm.max) ? lm.max : null,
            display_range: finite(lm.min) && finite(lm.max)
              ? (lm.min === lm.max
                  ? formatNbsValue(lm.min, lm.unit)
                  : formatNbsValue(lm.min, lm.unit) + ' – ' + formatNbsValue(lm.max, lm.unit))
              : null,
            sources: (lm.sources || []).map(sid => resolveNbsSource(atlas, sid)).filter(Boolean),
            sample_sites: (lm.sample_sites || []).map(site => ({
              ...site,
              display_value: formatNbsValue(site.value, site.unit || lm.unit),
              source: resolveNbsSource(atlas, site.source_id),
            })),
          };
        });
        localSummary = {
          total_records: pData.local_summary.total_records,
          metrics: localMetrics,
        };
      }

      return {
        ...meta,
        available: metrics.length > 0 || species.length > 0 || Boolean(localSummary),
        metrics,
        species,
        local_summary: localSummary,
      };
    });

    const policies = (Array.isArray(record.policies) ? record.policies : []).map(pol => ({
      ...pol,
      policy_type: pol.policy_type || pol.instrument_type || 'Policy',
      pathway: pol.pathway || (Array.isArray(pol.categories) ? pol.categories.join(', ') : ''),
      description: pol.description || [pol.title, pol.quantitative_target, pol.verbatim_quote].filter(Boolean).join(' — '),
      source: resolveNbsSource(atlas, pol.source_id),
    }));

    const activePathways = pathways.filter(p => p.available);
    const msRoot = atlas.mediterranean_seagrass_spotlight || {};
    const medRecord = record.mediterranean_basin
      ? (msRoot.countries || []).find(c => c.iso3 === iso3) || null
      : null;
    const basinExtentHa = finite(msRoot.basin_extent_ha) ? msRoot.basin_extent_ha : 1901960;
    const posidoniaExtent = medRecord ? (medRecord.posidonia_extent_ha ?? medRecord.traganos_extent_ha ?? null) : null;

    return {
      ready: true,
      available: activePathways.length > 0 || policies.length > 0 || Boolean(medRecord),
      iso_alpha3: iso3,
      country_name: record.country_name || record.name || iso3,
      mediterranean_basin: Boolean(record.mediterranean_basin),
      mediterranean_seagrass: medRecord ? {
        ...medRecord,
        name: medRecord.country_name || medRecord.name || iso3,
        traganos_extent_ha: posidoniaExtent,
        basin_share_pct: finite(posidoniaExtent) && basinExtentHa > 0
          ? Number(((posidoniaExtent / basinExtentHa) * 100).toFixed(2))
          : null,
        mckenzie_extent_ha: medRecord.mckenzie_extent_ha ?? null,
        protected_fraction_pct: medRecord.protected_fraction_pct ?? null,
        extent_caveats: iso3 === 'TUR'
          ? (msRoot.turkiye_highlight?.posidonia_scope_note || null)
          : (medRecord.gap_note || null),
        extent_source: resolveNbsSource(atlas, medRecord.posidonia_source_id || medRecord.extent_source_id || 'traganos-mediterranean-seagrass-2022'),
        mckenzie_source: resolveNbsSource(atlas, medRecord.mckenzie_source_id || 'mckenzie-seagrass-supplement-2020'),
        protected_source: resolveNbsSource(atlas, medRecord.protected_source_id || 'kumagai-habitat-protection-2022'),
        local_restoration_summary: buildMedRestorationSummaryForIso(atlas, iso3),
      } : null,
      turkiye_focus: iso3 === 'TUR' ? {
        seagrass: msRoot.turkiye_highlight || msRoot.turkiye_focus || null,
        hemp: atlas.hemp_and_biochar_industrial_ledger?.turkiye_industrial_profile || null,
        biochar: atlas.hemp_and_biochar_industrial_ledger?.turkiye_industrial_profile || null,
      } : null,
      active_pathway_count: activePathways.length,
      pathways,
      policies,
      release_id: atlas.release_id || atlas.release?.id || 'nbs-atlas-public-noncommercial-v1',
      checksum: safeGet('Data', 'getNbsAtlasSha256', null),
    };
  }

  function getNbsAtlasOverview() {
    const atlasReady = safeGet('Data', 'isNbsAtlasReady', false);
    const atlas = safeGet('Data', 'getNbsAtlas', null);
    if (!atlasReady || !atlas) return null;

    const normSources = {};
    for (const [sid, s] of Object.entries(atlas.sources || {})) {
      normSources[sid] = {
        ...s,
        id: s.source_id || s.id || sid,
        license: s.license || s.licence?.identifier || null,
        license_status: s.license_status || s.licence?.status || null,
      };
    }

    const ms = atlas.mediterranean_seagrass_spotlight || {};
    const basinExtentHa = finite(ms.basin_extent_ha) ? ms.basin_extent_ha : 1901960;
    const basinStockMtC = finite(ms.basin_carbon_stock_MtC) ? ms.basin_carbon_stock_MtC : 722.2;
    const basinStockMtCO2e = finite(ms.basin_carbon_stock_MtCO2e) ? ms.basin_carbon_stock_MtCO2e : 2648.07;
    const th = ms.turkiye_highlight || {};

    const medSpotlight = {
      ...ms,
      basin_totals: ms.basin_totals || {
        extent_ha: { value: basinExtentHa },
        extent_km2: { value: Number((basinExtentHa / 100).toFixed(2)) },
        carbon_stock_mtc: { value: basinStockMtC },
        total_carbon_stock_mt_co2e: { value: basinStockMtCO2e },
      },
      turkiye_focus: ms.turkiye_focus || {
        traganos_2022_posidonia_extent_ha: { value: th.posidonia_extent_ha ?? 74059 },
        mckenzie_2020_polygon_extent_ha: { value: th.mckenzie_bioregion_extent_ha ?? 231 },
        kumagai_2022_protected_fraction_pct: { value: th.protected_fraction_pct ?? 6.15 },
      },
      countries: (ms.countries || []).map(c => {
        const ext = c.posidonia_extent_ha ?? c.traganos_extent_ha ?? null;
        return {
          ...c,
          name: c.country_name || c.name || c.iso3,
          traganos_extent_ha: ext,
          basin_share_pct: finite(ext) && basinExtentHa > 0 ? Number(((ext / basinExtentHa) * 100).toFixed(2)) : null,
          mckenzie_extent_ha: c.mckenzie_extent_ha ?? null,
          protected_fraction_pct: c.protected_fraction_pct ?? null,
          local_restoration_summary: buildMedRestorationSummaryForIso(atlas, c.iso3),
        };
      }),
      restoration_and_field_benchmarks: (ms.mediterranean_field_and_restoration_benchmarks || ms.restoration_and_field_benchmarks || []).map(b => ({
        iso3: b.iso3,
        country_name: b.country_name || b.iso3,
        metric: b.metric,
        count: b.stats?.count ?? b.count ?? 0,
        min: b.stats?.min ?? b.min ?? null,
        max: b.stats?.max ?? b.max ?? null,
        unit: b.unit || '',
        source_id: b.source_id,
        sample_sites: (b.sample_sites || []).map(s => ({
          site: s.site_name || s.name || s.site || b.iso3,
          value: s.value,
          unit: b.unit || '',
          year: s.year || null,
        })),
      })),
    };

    const rl = atlas.restoration_and_ecosystem_ledger || {};
    const rlRecords = Array.isArray(rl.records) ? rl.records : [];
    const buildCatRestTable = (cat) => {
      const out = { restoration_area_ha: [], restoration_survival_pct: [], restoration_cost_usd_ha: [] };
      rlRecords.filter(r => r.category === cat && out[r.metric]).forEach(r => {
        out[r.metric].push({
          iso3: r.iso3,
          country_name: r.country_name || r.iso3,
          metric: r.metric,
          count: r.stats?.count ?? 0,
          min: r.stats?.min ?? null,
          max: r.stats?.max ?? null,
          unit: r.unit || '',
          sources: [r.source_id].filter(Boolean),
        });
      });
      return out;
    };
    const topMangrovePot = rlRecords
      .filter(r => r.category === 'mangroves' && r.metric === 'restoration_potential_ha')
      .map(r => ({
        iso3: r.iso3,
        country_name: r.country_name || r.iso3,
        value: r.stats?.max ?? r.stats?.median ?? null,
        year: r.year_range || 2024,
      }))
      .filter(r => finite(r.value))
      .sort((a, b) => b.value - a.value);

    const restLedger = {
      ...rl,
      seagrass: rl.seagrass || buildCatRestTable('seagrass'),
      mangroves: rl.mangroves || {
        ...buildCatRestTable('mangroves'),
        top_restoration_potential_countries: topMangrovePot,
        iucn_rle_provinces: (rl.iucn_mangrove_rle_provinces || []).map(p => ({
          province: p.province_name || p.province,
          rle_status: p.status || p.rle_status,
          year: p.year || 2024,
          methodology: p.note || p.methodology || '',
          caveats: null,
        })),
      },
      algae: rl.algae || buildCatRestTable('algae'),
    };

    const hb = atlas.hemp_and_biochar_industrial_ledger || {};
    const tip = hb.turkiye_industrial_profile || {};
    const topBiochar = [];
    const topHemp = [];
    for (const [iso, c] of Object.entries(atlas.countries || {})) {
      const bMetric = c.categories?.biochar?.metrics?.['removal_potential_MtCO2_yr|soil_application']
        || c.categories?.biochar?.metrics?.removal_potential_MtCO2_yr;
      if (bMetric && Array.isArray(bMetric.latest) && bMetric.latest.length) {
        const vals = bMetric.latest.map(e => e.value).filter(finite).sort((a, b2) => b2 - a);
        if (vals.length) {
          topBiochar.push({
            iso3: iso,
            country_name: c.country_name || c.name || iso,
            technical_mt_co2_yr: vals[0],
            economic_mt_co2_yr: vals.length > 1 ? vals[vals.length - 1] : null,
          });
        }
      }
      const hFibre = c.categories?.hemp?.metrics?.['area_cultivated_ha|fibre'] || c.categories?.hemp?.metrics?.area_cultivated_ha;
      const hSeed = c.categories?.hemp?.metrics?.['area_cultivated_ha|seed'];
      const fEntry = hFibre?.latest?.[0] || null;
      const sEntry = hSeed?.latest?.[0] || null;
      if (fEntry || sEntry) {
        const totalArea = (finite(fEntry?.value) ? fEntry.value : 0) + (finite(sEntry?.value) ? sEntry.value : 0);
        const primary = fEntry || sEntry;
        if (totalArea > 0) {
          topHemp.push({
            iso3: iso,
            country_name: c.country_name || c.name || iso,
            value: Number(totalArea.toFixed(2)),
            year: primary.year || 2024,
            source_id: primary.source_id,
          });
        }
      }
    }
    topBiochar.sort((a, b) => (b.technical_mt_co2_yr || 0) - (a.technical_mt_co2_yr || 0));
    topHemp.sort((a, b) => (b.value || 0) - (a.value || 0));

    const ensureTurInTop = (list, count = 25) => {
      const sliced = list.slice(0, count);
      if (!sliced.some(r => r.iso3 === 'TUR')) {
        const turRow = list.find(r => r.iso3 === 'TUR');
        if (turRow) sliced[sliced.length - 1] = turRow;
      }
      return sliced;
    };

    const hempBiocharLedger = {
      ...hb,
      turkiye_hemp: hb.turkiye_hemp || {
        latest_2024_fibre: {
          harvested_area_ha: { value: tip.hemp_2024_fibre_area_ha ?? 1000 },
          production_t_yr: { value: tip.hemp_2024_fibre_production_t_yr ?? 2000 },
          yield_t_ha_yr: { value: tip.hemp_2024_fibre_yield_t_ha_yr ?? 1.0 },
        },
        latest_2024_seed: {
          harvested_area_ha: { value: tip.hemp_2024_seed_area_ha ?? 721 },
          production_t_yr: { value: tip.hemp_2024_seed_production_t_yr ?? 556 },
          yield_t_ha_yr: { value: tip.hemp_2024_seed_yield_t_ha_yr ?? 0.7712 },
        },
      },
      turkiye_biochar_cdr: hb.turkiye_biochar_cdr || {
        technical_potential_mt_co2_yr: { value: tip.biochar_technical_potential_MtCO2_yr ?? 13.9555 },
        economic_potential_mt_co2_yr: { value: tip.biochar_economic_potential_MtCO2_yr ?? 10.792 },
      },
      hemp_carbon_and_biomass_benchmarks: (hb.hemp_carbon_and_cultivar_trials || []).slice(0, 14).map(b => ({
        metric: b.metric,
        value: b.value,
        unit: b.unit || '',
        methodology: b.basis?.note || (b.location_name ? b.location_name + (b.year ? ' (' + b.year + ')' : '') : ''),
        caveats: null,
        source_id: b.source_id,
      })),
      biochar_stability_benchmarks: {
        permanence_fraction: (hb.biochar_characterization_and_stability || []).slice(0, 14).map(p => ({
          metric: p.metric,
          value: p.value,
          unit: p.unit || '',
          methodology: p.basis?.note || (p.location_name ? p.location_name + (p.year ? ' (' + p.year + ')' : '') : ''),
          caveats: null,
          source_id: p.source_id,
        })),
      },
      top_biochar_cdr_countries: ensureTurInTop(topBiochar, 25),
      top_hemp_area_countries: ensureTurInTop(topHemp, 25),
    };

    const normCountries = {};
    for (const [iso, c] of Object.entries(atlas.countries || {})) {
      normCountries[iso] = {
        ...c,
        name: c.country_name || c.name || iso,
        pathways: c.categories || c.pathways || {},
      };
    }

    return {
      ready: true,
      release: atlas.release || { id: atlas.release_id },
      pathways: atlas.categories || atlas.pathways,
      mediterranean_seagrass_spotlight: medSpotlight,
      restoration_and_ecosystem_ledger: restLedger,
      hemp_and_biochar_industrial_ledger: hempBiocharLedger,
      sources: normSources,
      countries: normCountries,
      checksum: safeGet('Data', 'getNbsAtlasSha256', null),
    };
  }

  function getCountryView(id, lensId = 'carbon') {
    if (!_initialized && !init()) return null;
    const lens = _lensById.get(lensId) || _lensById.get('carbon');
    const rawId = String(id || '').trim();
    const normalizedId = normalizeCountryId(rawId);
    const country = _countryById.get(normalizedId) || _countryById.get(rawId);
    if (!country || !lens) return null;
    const primary = factView(lens.comparison_metric_id, country);
    const rank = rankFor(lens.id, country.country_id);
    const visual = getCountryVisual(country.country_id, lens.id);
    const panel = PANEL_COPY[lens.id];
    const activeFacts = PANEL_METRICS[lens.id].map(metricId => factView(metricId, country));
    const glanceMetricIds = atAGlanceMetrics(lens.id);
    const glanceMetricSet = new Set(glanceMetricIds);
    const chartMetricIds = lens.id === 'physical'
      ? ['climate.temperature.observed_trend', 'climate.precipitation.observed_trend']
      : [lens.comparison_metric_id];
    const chartMetricSet = new Set(chartMetricIds);
    const panelFacts = lens.id === 'physical'
      ? []
      : activeFacts.filter(fact => !glanceMetricSet.has(fact.id) && !chartMetricSet.has(fact.id));
    const detailCharts = chartMetricIds.map(metricId => factView(metricId, country)).filter(fact => fact.series.length > 1);
    const detailChart = detailCharts[0] || null;
    const temperatureObserved = activeFacts.find(fact => fact.id === 'climate.temperature.observed_trend') || null;
    const precipitationObserved = activeFacts.find(fact => fact.id === 'climate.precipitation.observed_trend') || null;
    const temperatureProjected = activeFacts.find(fact => fact.id === 'climate.temperature.change') || null;
    const precipitationProjected = activeFacts.find(fact => fact.id === 'climate.precipitation.change') || null;
    const physicalStory = lens.id === 'physical'
      ? {
          temperature: {
            observed: temperatureObserved,
            projection_range: buildTemperatureProjectionRange(temperatureProjected),
            projected_fact: temperatureProjected,
          },
          precipitation: {
            projected_fact: precipitationProjected,
            observed: precipitationObserved,
          },
        }
      : null;
    const powerStory = lens.id === 'power'
      ? { field: buildPowerField(activeFacts) }
      : null;
    const citationOnlySources = _release.source_catalog
      .filter(source => source.public_role === 'citation_only')
      .map(source => ({ id: source.id, title: source.title, version: source.version, url: source.source_url, note: 'Citation retained for historical provenance; no values from this source appear in this release.' }));
    const rankText = rank.eligible
      ? lens.id === 'physical'
        ? 'Exploration order ' + rank.ordinal + ' of ' + rank.total + ' for the same modeled warming metric.'
        : 'Order ' + rank.ordinal + ' of ' + rank.total + ' for the same metric and period.'
      : 'Unranked: ' + rank.reason.detail;
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
      at_a_glance: glanceMetricIds.map(metricId => factView(metricId, country)),
      detail_chart: detailChart,
      detail_chart_heading: lens.id === 'physical' && detailCharts.length ? 'Observed reanalysis' : null,
      detail_charts: detailCharts,
      power_story: powerStory,
      physical_story: physicalStory,
      nbs_atlas: getNbsCountrySummary(country.iso_alpha3),
      active_panel: {
        id: lens.id,
        heading: panel.heading,
        description: panel.description,
        facts: panelFacts,
      },
      visual,
      methods: {
        release_id: _release.release.id,
        release_status: _release.release.status,
        review_label: releaseReviewLabel(),
        review_state: _release.release.review_state,
        generated_on: _release.release.generated_on,
        checksum: safeGet('Data', 'getClimateIntelligenceSha256', null),
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
    const cached = _railRowsByLens.get(lens.id);
    if (cached) return cached;
    const order = _orderByLens.get(lens.id);
    if (!order) return null;
    const inverseCarbonDemo = lens.id === 'carbon' && _carbonReliefMode === 'lower_value_higher';
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
    const rows = {
      lens,
      ordered,
      unranked,
      all: ordered.concat(unranked),
      eligible_count: order.eligible_count,
      unranked_count: order.unranked_count,
      disclosure: order.rule,
      relief_note: inverseCarbonDemo ? 'Inverse relief demo' : null,
    };
    _railRowsByLens.set(lens.id, rows);
    return rows;
  }

  function getLegend(lensId = 'carbon') {
    if (!_initialized && !init()) return null;
    const lens = _lensById.get(lensId) || _lensById.get('carbon');
    const cached = _legendByLens.get(lens.id);
    if (cached) return cached;
    const rows = getRailRows(lens.id);
    const palette = PALETTES[lens.id];
    const inverseCarbonDemo = lens.id === 'carbon' && _carbonReliefMode === 'lower_value_higher';
    const labels = lens.id === 'power'
      ? ['0% clean', '100% clean']
      : lens.id === 'physical'
        ? ['Lower projected warming', 'Higher projected warming']
        : ['Lower territorial fossil CO₂', 'Higher territorial fossil CO₂'];
    const legend = {
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
        ? inverseCarbonDemo
          ? 'Demo relief is inverted: lower territorial fossil CO₂ sits slightly higher. Color and the rail still show raw emissions; this is not a performance score.'
          : 'Subtle transparent log-scaled tile relief and color show magnitude.'
        : lens.id === 'power'
          ? 'Subtle bounded linear tile relief and color show clean electricity share.'
          : 'Subtle linear tile relief and color show projected warming—not vulnerability or damage.',
      relief_direction: inverseCarbonDemo ? 'lower_value_higher' : 'higher_value_higher',
      relief_demo: inverseCarbonDemo,
      evidence_label: evidenceLabel(lens.evidence_status, lens.comparison_metric_id),
    };
    _legendByLens.set(lens.id, legend);
    return legend;
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
    _rankByLens = new Map(Object.entries(release.lens_orders).map(([lensId, order]) => [lensId, new Map([
      ...order.ordered.map(entry => [entry.country_id, { ranked: true, entry }]),
      ...order.unranked.map(entry => [entry.country_id, { ranked: false, entry }]),
    ])]));
    _carbonReliefMode = carbonReliefMode();
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
    _visualByLens = new Map();
    _railRowsByLens = new Map();
    _legendByLens = new Map();
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
    _rankByLens = new Map();
    _domainByLens = new Map();
    _countryById = new Map();
    _visualByLens = new Map();
    _railRowsByLens = new Map();
    _legendByLens = new Map();
    _carbonReliefMode = 'higher_value_higher';
    return true;
  }

  function getState() {
    return {
      initialized: _initialized,
      version: VERSION,
      releaseId: _release?.release?.id || null,
      entityCount: _release?.countries?.length || 0,
      lenses: Array.from(_lensById.keys()),
      carbonReliefMode: _carbonReliefMode,
      relief: {
        baseAltitude: RELIEF_BASE_ALTITUDE,
        range: RELIEF_RANGE,
        maximumAltitude: RELIEF_BASE_ALTITUDE + RELIEF_RANGE,
        demoQuery: 'carbon-relief=' + CARBON_RELIEF_DEMO_VALUE,
      },
    };
  }

  return { init, getCountryView, getCountryVisual, getRailRows, getLegend, getNbsCountrySummary, getNbsAtlasOverview, getState, reset, destroy };
})();

window.COUNTRY_CLIMATE_INTELLIGENCE = COUNTRY_CLIMATE_INTELLIGENCE;

if (hasModule('MODULE_CONTRACTS')) {
  MODULE_CONTRACTS.register('COUNTRY_CLIMATE_INTELLIGENCE', {
    provides: ['init', 'getCountryView', 'getCountryVisual', 'getRailRows', 'getLegend', 'getNbsCountrySummary', 'getNbsAtlasOverview', 'getState', 'reset', 'destroy'],
    requires: ['Data', 'EventBus'],
    emits: ['climate-intelligence:ready'],
  });
}
