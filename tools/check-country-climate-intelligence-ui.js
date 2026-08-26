#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('./lib/country-climate-intelligence');

const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const presentation = fs.readFileSync(path.join(ROOT, 'js/country-climate-intelligence.js'), 'utf8');
const globe = fs.readFileSync(path.join(ROOT, 'js/globe.js'), 'utf8');
const guidedOrbit = fs.readFileSync(path.join(ROOT, 'js/guided-first-orbit.js'), 'utf8');
const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'css/globe-system.css'), 'utf8');
const guidedCss = fs.readFileSync(path.join(ROOT, 'css/guided-first-orbit.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const dataAt = index.indexOf('src="js/data.js?v=v10"');
const intelligenceAt = index.indexOf('src="js/country-climate-intelligence.js?v=v13"');
const globeAt = index.indexOf('src="js/globe.js?v=v37"');
assert(dataAt >= 0 && dataAt < intelligenceAt && intelligenceAt < globeAt, 'classic script order must be Data → Country Climate Intelligence → GlobeModule');

assert(presentation.includes('const COUNTRY_CLIMATE_INTELLIGENCE = (() => {'));
assert(presentation.includes('window.COUNTRY_CLIMATE_INTELLIGENCE = COUNTRY_CLIMATE_INTELLIGENCE;'));
for (const method of ['init', 'getCountryView', 'getCountryVisual', 'getRailRows', 'getLegend', 'getState', 'reset', 'destroy']) {
  assert(new RegExp(`provides: \\[[^\\]]*['"]${method}['"]`, 's').test(presentation), `Country Climate Intelligence contract does not provide ${method}`);
}
assert(globe.includes('setLens(lensId)'));
assert(globe.includes('getLens()'));
assert(globe.includes("EventBus.emit('globe:lens-changed'"));
assert(globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getRailRows'"));
assert(globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getLegend'"));
assert(presentation.includes("const reliefKind = lens.visual.extrusion === 'transparent_log' ? 'metric_log' : 'metric_linear'"));
assert(presentation.includes("relief: metricRelief ? reliefKind : 'base_tile'"));
assert(presentation.includes('relief_encodes_metric: metricRelief'));
assert(presentation.includes('const RELIEF_BASE_ALTITUDE = 0.007;'));
assert(presentation.includes('const RELIEF_RANGE = 0.005;'));
assert(presentation.includes("query.get('carbon-relief') === CARBON_RELIEF_DEMO_VALUE"));
assert(presentation.includes("relief_direction: inverseCarbonDemo ? 'lower_value_higher' : 'higher_value_higher'"));
assert(presentation.includes("relief_note: inverseCarbonDemo ? 'Inverse relief demo' : null"));
assert(presentation.includes('Color and the rail still show raw emissions; this is not a performance score.'));
assert(presentation.includes('Subtle bounded linear tile relief and color show clean electricity share.'));
assert(presentation.includes('Subtle linear tile relief and color show projected warming—not vulnerability or damage.'));
assert(guidedOrbit.includes('Three lenses. No single score.'));
assert(guidedOrbit.includes('Change the lens. Choose a country.'));
assert(guidedOrbit.includes('Change the lens, then choose a country from the globe or the lens-ordered sidebar.'));
assert(guidedOrbit.includes('Swipe through the country deck.'));
assert(!guidedOrbit.includes('They are never combined into a score.'));
assert(!guidedOrbit.includes('arrow keys, and a horizontal trackpad gesture do the same thing'));
assert(guidedOrbit.includes('const STORAGE_VERSION = 4;'));
assert(guidedOrbit.includes("query.get('guided-orbit') === '1' || query.has('review')"));
assert(guidedOrbit.includes("if (hasModule('SmokeTest')) return false;"));
assert(guidedOrbit.includes('const FINAL_STEP = 2;'));
assert(guidedOrbit.includes("EventBus.on('globe:country-navigated', _onCountryNavigated)"));
assert(globe.includes("EventBus.emit('globe:country-navigated'"));
assert(globe.includes("source: navigationSource"));
assert(globe.includes('cueCountrySwipe()'));
assert(globe.includes('clearCountrySwipeCue()'));
assert(guidedCss.includes('body.guided-orbit-step-3:not(.globe-fallback-active) #elu-country-card-wrap #hex-country-tooltip.tt-swipe-cue'));
assert(guidedCss.includes('.guided-orbit-cue.is-lens'));
assert(guidedCss.includes('.guided-orbit-cue.is-rail'));
assert(guidedCss.includes('.guided-orbit-cue.is-lens {\n    top: 130px;'), 'compact lens cue must clear the lens control');
assert(guidedCss.includes('.guided-orbit-cue.is-rail {\n    top: 170px;'), 'compact rail cue must occupy its own lane');
assert(guidedCss.includes('.guided-orbit[data-mode="source"][data-route="globe"] .guided-orbit-card'));
assert(index.includes('class="guided-orbit-period">2024</span>'));
assert(guidedCss.includes('animation: none !important;'));
assert(guidedOrbit.includes("EventBus.on('globe:fallback-hidden', _onFallbackHidden)"));
assert(globe.includes("EventBus.emit('globe:fallback-hidden'"));
assert(index.includes('aria-valuemax="3"'));
assert(!guidedOrbit.includes('guided-orbit-dialog-complete'));
assert(!guidedOrbit.includes('Only Carbon uses transparent log-scaled height'));
assert(globe.includes('_countryPolygonSideColorFn(feature)'));
assert(globe.includes('.polygonSideColor((f) => this._countryPolygonSideColorFn(f))'));
assert(globe.includes('class="elu-rank-relief-note"'));
assert(globe.includes('Inverse relief demo: lower territorial fossil CO₂ sits slightly higher; the raw descending rail is unchanged.'));
assert(css.includes('.elu-rank-relief-note'));
assert(globe.includes('const chartFacts = Array.isArray(view.detail_charts)'));
assert(globe.includes('class="elu-trajectory-trend"'));
assert(css.includes('.elu-trajectory-trend'));
assert(globe.includes("powerPreference: 'high-performance'"), 'renderer must request the high-performance GPU path');
assert(globe.includes('const GLOBE_TARGET_FPS = 120;'), '120 FPS renderer target is missing');
assert(globe.includes('getPerformanceState()'), 'renderer performance telemetry is missing');
assert(globe.includes('lensIds.forEach(lensId => this._buildCountryDeck(lensId, { force: true }))'), 'all three navigation decks must be warmed before the renderer starts');
assert(globe.includes('const cached = this._countryDeckByLens?.[lensId]'), 'lens switches must reuse the warmed navigation deck');
assert(globe.includes('this._countryNavigationSwapTimer = setTimeout(swap, exitDuration)'), 'country swap timer must be retained');
assert(globe.includes('_cancelCountryNavigation()'), 'country navigation must expose one cancellation path');
assert(globe.includes('if (navigationGeneration !== this._countryNavigationGeneration || !this._selectedCountryFeature) return;'), 'stale country swaps must be generation-guarded');
assert(globe.includes('this._rebindCountryOpener();'), 'rail replacement must rebind the selected country opener');
assert(globe.includes("candidate.getAttribute('data-country-rail-iso') === iso"), 'focus rebind must target the same country in the new lens rail');
assert(globe.includes(': this._activeLensControl();'), 'country close must retain an active-lens focus fallback');
assert(globe.includes('this.world.polygonStrokeColor((f) => this._countryBorderColorFn(f));'), 'hover path must update only the country outline');
assert(globe.includes('if (options.visuals === true)'), 'full polygon visual refresh must be an explicit lens-only path');
assert(globe.includes("this._countryTooltipResizeObserver = new ResizeObserver"), 'hover tooltip sizing must be learned without a synchronous layout read');
assert(!/_positionCountryInfoCard\(event\)[\s\S]{0,600}tt\.offset(Width|Height)/.test(globe), 'pointer positioning must not force tooltip layout');
assert(globe.includes("safeCall('COUNTRY_CLIMATE_INTELLIGENCE', 'getCountryVisual'"), 'polygon accessors must use the compact visual contract');
assert(!/_countryHexColorFn\(feature\)\s*\{[\s\S]{0,160}_getCountryDisplayData\(feature\)/.test(globe), 'hot color accessor must not build the country-card model');
assert(globe.includes('polygonCapCurvatureResolution(8)'), 'country caps must retain the bounded 8-degree tessellation');
assert(presentation.includes('buildTemperatureProjectionRange(fact)'));
assert(presentation.includes('copied directly without interpolation or sampling'));
assert(!/Monte Carlo|seededUnit|sampling_method|projection_ensemble|deterministic draw/i.test(presentation), 'projection view model must not generate or describe synthetic samples');
assert(globe.includes('_renderTemperatureProjectionRange(view'));
assert(globe.includes('No intervening years or probabilities are shown.'));
assert(globe.includes('Evidence boundary:'));
assert(!/ensemble draws|deterministic uncertainty samples|visual bridges/i.test(globe), 'projection renderer must not imply samples or trajectories');
assert(css.includes('.elu-projection-marker.is-p10'));
assert(css.includes('.elu-projection-marker.is-median'));
assert(css.includes('.elu-projection-marker.is-p90'));
assert(presentation.includes('buildPowerField(facts)'));
assert(presentation.includes('Two aligned bars copy exact shares of total electricity generation.'));
assert(presentation.includes('Missing fuel values remain gaps and are never converted to zero.'));
assert(presentation.includes('no browser rescaling is applied.'));
assert(presentation.includes('combined geothermal, tidal, and wave category'));
assert(globe.includes('_renderPowerField(view'));
assert(globe.includes('class="elu-power-field"'));
assert(globe.includes('visualizedPowerFacts'));
assert(css.includes('.elu-power-lane-track'));
assert(css.includes('.elu-power-segment.is-nuclear'));
assert(css.includes('.elu-power-segment.is-hydro'));
assert(css.includes('.elu-power-segment.is-wind'));
assert(css.includes('.elu-power-segment.is-solar'));
assert(css.includes('.elu-power-segment.is-bioenergy'));
assert(css.includes('.elu-power-segment.is-other-renewables'));
assert(css.includes('.elu-power-segment.is-coal'));
assert(css.includes('.elu-power-segment.is-gas'));
assert(css.includes('.elu-power-segment.is-other-fossil'));
assert(css.includes('.elu-power-mix-legend'));
assert(!globe.includes('elu-power-lane-mark'), 'clean and fossil aggregate headings must not repeat decorative swatches before their text');
assert(!css.includes('.elu-power-lane-mark'), 'retired aggregate heading swatches must not leave dead CSS');
assert(css.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'fuel names and values must retain a readable two-column legend');
assert(css.includes('white-space: normal;'), 'fuel names must not be hidden behind legend ellipses');
assert(css.includes('.elu-power-reconciliation.has-rounding'));
assert(css.includes('--power-nuclear: #5cff8d;'), 'dark-theme nuclear must use the approved neon green');
assert(css.includes('--power-nuclear: #28df70;'), 'fair-theme nuclear must retain a readable neon green');
assert(css.includes('--power-other-renewables: #b97acb;'), 'dark-theme Other Renewables must use the restored purple-pink family');
assert(css.includes('--power-other-renewables: #80558a;'), 'fair-theme Other Renewables must retain the restored purple-pink family');
assert(css.includes('--power-coal: #262c31;'), 'dark-theme coal must remain visually darker than the other fossil fuels');
assert(css.includes('0 0 6px rgba(92, 255, 141, .34)'), 'nuclear must retain only a restrained static glow');
assert(css.includes('.elu-power-mix-legend li.is-gap .elu-power-segment-key {\n  background: repeating-linear-gradient(135deg, transparent 0 3px, var(--hud-divider) 3px 5px);\n  box-shadow: none;'), 'a fuel-specific glow must never survive the explicit data-gap override');
assert(css.includes('.elu-power-segment-key.is-nuclear {\n  background: var(--power-nuclear);'), 'nuclear must use a plain fill without an inner decal');
assert(css.includes('repeating-linear-gradient(135deg, transparent 0 5px, rgba(255, 255, 255, .48) 5px 6px, transparent 6px 11px)'), 'solar must use restrained white linework');
assert(css.includes('.elu-power-segment-key.is-other-renewables {\n  background: var(--power-other-renewables);'), 'other renewables must use a plain purple-pink fill');
assert(css.includes('background: repeating-linear-gradient(135deg, var(--power-coal) 0 4px, var(--power-coal-ridge) 4px 6px);'), 'coal must retain a dark static texture');
assert(css.includes('linear-gradient(45deg, transparent 42%, var(--power-other-fossil-mark) 44% 56%, transparent 58%) 0 0 / 10px 10px'), 'Other Fossil must carry a dark X motif');
assert(!css.includes('repeating-radial-gradient(ellipse at 0 50%'), 'the excessive other-renewables decal must stay removed');
assert(!css.includes('.elu-power-lane-fill.is-wind-solar'));
const physicalLayout = globe.slice(globe.indexOf('return \'<section class="tt-physical-story"'), globe.indexOf('  _renderClimateMethods(view)'));
assert(globe.includes('const futureProjectionBlock = projectionHtml'));
assert(globe.includes('<h4>Future projection</h4>'));
assert(physicalLayout.indexOf('Observed analysis') < physicalLayout.indexOf('+ futureProjectionBlock'));
assert(physicalLayout.indexOf('+ futureProjectionBlock') < physicalLayout.indexOf('+ temperatureFact'));
assert(physicalLayout.indexOf('+ precipitationFact') < physicalLayout.indexOf('Observed data'));

const release = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/runtime/country-climate-intelligence.json'), 'utf8'));
const presentationSandbox = {
  URLSearchParams,
  console,
  hasModule: () => false,
  safeGet(globalName, methodName, fallback) {
    if (globalName !== 'Data') return fallback;
    if (methodName === 'getClimateIntelligenceRelease') return release;
    if (methodName === 'isClimateIntelligenceReady') return true;
    return fallback;
  },
};
presentationSandbox.window = presentationSandbox;
presentationSandbox.location = { search: '' };
vm.runInNewContext(presentation, presentationSandbox, { filename: 'country-climate-intelligence.js' });
const viewsByLens = Object.fromEntries(['carbon', 'power', 'physical'].map(lensId => [lensId,
  presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryView('JPN', lensId)]));
for (const [lensId, view] of Object.entries(viewsByLens)) {
  assert(view, `Japan ${lensId} view did not resolve`);
  const glanceIds = Array.from(view.at_a_glance, fact => fact.id);
  const panelIds = Array.from(view.active_panel.facts, fact => fact.id);
  assert.strictEqual(glanceIds.filter(id => panelIds.includes(id)).length, 0, `${lensId} At-a-glance metrics must not repeat in the lens panel`);
}
const physicalView = viewsByLens.physical;
const powerView = viewsByLens.power;
const powerField = powerView.power_story.field;
assert(powerField, 'Japan must expose an exact-source Power generation field');
assert.strictEqual(powerField.ranking_eligible, false, 'the Power field is not a new ranking metric');
assert.strictEqual(powerField.available, true);
assert.deepStrictEqual(Array.from(powerField.lanes, lane => lane.id), ['clean', 'fossil']);
assert.strictEqual(powerField.visual_normalization_applied, false);
assert(powerField.disclosure.includes('Clean and fossil use one 0–100% scale'));
assert(powerField.disclosure.includes('no browser rescaling is applied'));
const fuelMetricIds = [
  'electricity.generation_share.bioenergy',
  'electricity.generation_share.coal',
  'electricity.generation_share.gas',
  'electricity.generation_share.hydro',
  'electricity.generation_share.nuclear',
  'electricity.generation_share.other_fossil',
  'electricity.generation_share.other_renewables',
  'electricity.generation_share.solar',
  'electricity.generation_share.wind',
];
const japanSegments = powerField.lanes.flatMap(lane => lane.segments);
assert.deepStrictEqual(
  Array.from(japanSegments, segment => segment.id).sort(),
  fuelMetricIds.slice().sort(),
  'Japan must expose all nine source-permitted fuel slots'
);
const japanOtherRenewables = japanSegments.find(segment => segment.id === 'electricity.generation_share.other_renewables');
assert.strictEqual(japanOtherRenewables.available, false, 'Japan Other Renewables must remain an explicit blank source cell');
assert.strictEqual(japanOtherRenewables.value, null, 'Japan blank fuel cell must not become zero');
for (const [laneId, factId] of [['clean', 'electricity.clean_share'], ['fossil', 'electricity.fossil_share']]) {
  const lane = powerField.lanes.find(item => item.id === laneId);
  const fact = powerView.methods.facts.find(item => item.id === factId);
  assert(lane && fact && lane.available, `Japan ${laneId} lane must be available`);
  assert.strictEqual(lane.value, fact.value, `${laneId} lane must copy the reviewed anchor exactly`);
}
const francePower = presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryView('FRA', 'power');
const franceField = francePower.power_story.field;
const franceNuclear = franceField.lanes.flatMap(lane => lane.segments).find(segment => segment.id === 'electricity.generation_share.nuclear');
assert.strictEqual(franceField.lanes.find(lane => lane.id === 'clean').value, 94.9, 'France clean electricity share must remain the exact 2024 aggregate');
assert.strictEqual(franceField.lanes.find(lane => lane.id === 'fossil').value, 5.1, 'France fossil electricity share must remain the exact 2024 aggregate');
assert.strictEqual(franceNuclear.value, 67.7, 'France nuclear share must be visibly represented from the exact source row');
assert.strictEqual(franceField.published_component_sum, 100);
assert.strictEqual(franceField.visual_normalization_applied, false);
const antarcticaPower = presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryView('ATA', 'power');
assert.strictEqual(antarcticaPower.power_story.field, null, 'a missing clean-share anchor must not receive a fabricated Power field');
const lesothoPower = presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryView('LSO', 'power');
assert.strictEqual(lesothoPower.power_story.field.available, false, 'Lesotho aggregate may render while its fuel-detail gap stays explicit');
assert.strictEqual(lesothoPower.power_story.field.lanes.length, 0);
assert(lesothoPower.power_story.field.disclosure.includes('never converted to zero'));
let reconciledMixCount = 0;
for (const country of release.countries) {
  const view = presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryView(country.iso_alpha3, 'power');
  const clean = view.methods.facts.find(fact => fact.id === 'electricity.clean_share');
  const field = view.power_story.field;
  if (!clean.available) {
    assert.strictEqual(field, null, `${country.iso_alpha3} clean-share gap must not receive a Power field`);
    continue;
  }
  if (!field.available) {
    assert.strictEqual(country.iso_alpha3, 'LSO', `${country.iso_alpha3} has an unexpected fuel-detail gap`);
    continue;
  }
  reconciledMixCount += 1;
  assert.strictEqual(field.lanes.length, 2, `${country.iso_alpha3} must expose the two aligned generation lanes`);
  assert.strictEqual(field.visual_normalization_applied, false, `${country.iso_alpha3} must not rescale source shares`);
  const segments = field.lanes.flatMap(lane => lane.segments);
  assert.strictEqual(segments.length, 9, `${country.iso_alpha3} must retain all nine fuel slots, including explicit zeroes and gaps`);
  for (const segment of segments) {
    const fact = view.methods.facts.find(item => item.id === segment.id);
    assert(fact, `${country.iso_alpha3} ${segment.id} must remain in the methods facts`);
    assert.strictEqual(segment.available, fact.available, `${country.iso_alpha3} ${segment.id} availability must remain exact`);
    assert.strictEqual(segment.value, fact.value, `${country.iso_alpha3} ${segment.id} must copy the source value or null exactly`);
    if (!fact.available) assert.notStrictEqual(segment.value, 0, `${country.iso_alpha3} ${segment.id} gap must not become zero`);
  }
  for (const [laneId, factId] of [['clean', 'electricity.clean_share'], ['fossil', 'electricity.fossil_share']]) {
    const lane = field.lanes.find(item => item.id === laneId);
    const fact = view.methods.facts.find(item => item.id === factId);
    assert.strictEqual(lane.value, fact.value, `${country.iso_alpha3} ${laneId} anchor must remain exact`);
    const componentSum = Math.round(lane.segments.filter(segment => segment.available).reduce((sum, segment) => sum + segment.value, 0) * 1e6) / 1e6;
    assert.strictEqual(componentSum, lane.component_sum, `${country.iso_alpha3} ${laneId} segments must reconcile to the compiler receipt`);
  }
  const visualTotal = Math.round(segments.filter(segment => segment.available).reduce((sum, segment) => sum + segment.value, 0) * 1e6) / 1e6;
  assert.strictEqual(visualTotal, field.published_component_sum, `${country.iso_alpha3} visual total must copy the compiler reconciliation`);
  assert(Math.abs(field.published_component_sum - 100) <= field.tolerance_pp + 1e-9, `${country.iso_alpha3} source total exceeds its explicit rounding tolerance`);
  if (field.published_component_sum !== 100) assert(field.disclosure.includes('source rounding'), `${country.iso_alpha3} must disclose its non-100 published total`);
}
assert.strictEqual(reconciledMixCount, 194, 'exact fuel-mix coverage must remain deterministic');
const cachedPhysicalVisual = presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryVisual('JPN', 'physical');
assert.strictEqual(cachedPhysicalVisual, presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryVisual('JPN', 'physical'), 'compact visual models must be cached per country and lens');
assert.strictEqual(JSON.stringify(cachedPhysicalVisual), JSON.stringify(physicalView.visual), 'country-card and renderer visual contracts must match');
assert.strictEqual(physicalView.detail_chart.id, 'climate.temperature.observed_trend');
assert.deepStrictEqual(Array.from(physicalView.detail_charts, chart => chart.id), ['climate.temperature.observed_trend', 'climate.precipitation.observed_trend']);
assert.deepStrictEqual(Array.from(physicalView.detail_charts, chart => chart.series.length), [56, 56]);
assert.deepStrictEqual(Array.from(physicalView.detail_charts, chart => chart.series_unit), ['°C', 'mm/year']);
assert(physicalView.detail_charts.every(chart => chart.evidence_label === 'ERA5 reanalysis'));
assert(physicalView.detail_charts.every(chart => chart.evidence_kind === 'reanalysis'));
assert.strictEqual(physicalView.at_a_glance.length, 0, 'Physical facts must be grouped with their own evidence rather than repeated at a generic glance');
assert.strictEqual(physicalView.active_panel.facts.length, 0, 'Physical facts must not repeat in the generic lens panel');
assert.strictEqual(physicalView.physical_story.temperature.observed.id, 'climate.temperature.observed_trend');
assert.strictEqual(physicalView.physical_story.temperature.projected_fact.id, 'climate.temperature.change');
assert.strictEqual(physicalView.physical_story.precipitation.projected_fact.id, 'climate.precipitation.change');
assert.strictEqual(physicalView.physical_story.precipitation.observed.id, 'climate.precipitation.observed_trend');
const projectionRange = physicalView.physical_story.temperature.projection_range;
assert(projectionRange, 'Japan must expose the published temperature projection range');
assert.strictEqual(projectionRange.scenario, 'SSP2-4.5');
assert.strictEqual(projectionRange.evidence_class, 'modeled_projection_summary');
assert.strictEqual(projectionRange.ranking_eligible, false);
assert.strictEqual(projectionRange.annual_timing, false);
assert.deepStrictEqual(Array.from(projectionRange.markers, marker => marker.id), ['p10', 'median', 'p90']);
assert.deepStrictEqual(Array.from(projectionRange.markers, marker => marker.shape), ['square', 'diamond', 'circle']);
assert.deepStrictEqual(Array.from(projectionRange.markers, marker => marker.value), [projectionRange.p10, projectionRange.median, projectionRange.p90]);
assert(!Object.prototype.hasOwnProperty.call(projectionRange, 'draws'));
assert(!Object.prototype.hasOwnProperty.call(projectionRange, 'seed'));
assert(projectionRange.disclosure.includes('not a probabilistic forecast, annual trajectory, or new simulation'));
const antarcticaPhysical = presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryView('ATA', 'physical');
assert.strictEqual(antarcticaPhysical.physical_story.temperature.projection_range, null, 'documented projection gaps must not receive a fabricated range');
assert.strictEqual(antarcticaPhysical.physical_story.temperature.projected_fact.available, false);
for (const country of release.countries) {
  const view = presentationSandbox.COUNTRY_CLIMATE_INTELLIGENCE.getCountryView(country.iso_alpha3, 'physical');
  const projected = view.physical_story.temperature.projected_fact;
  const countryRange = view.physical_story.temperature.projection_range;
  if (!projected.available) {
    assert.strictEqual(countryRange, null, `${country.iso_alpha3} gap must not receive a projection range`);
    continue;
  }
  assert(countryRange && countryRange.markers.length === 3, `${country.iso_alpha3} must expose exactly three published projection statistics`);
  assert.deepStrictEqual(Array.from(countryRange.markers, marker => marker.value), [projected.uncertainty.p10, projected.value, projected.uncertainty.p90], `${country.iso_alpha3} range must copy source values exactly`);
}
const physicalGlanceIds = new Set(Array.from(physicalView.at_a_glance, fact => fact.id));
const physicalPanelIds = new Set(Array.from(physicalView.active_panel.facts, fact => fact.id));
for (const chart of physicalView.detail_charts) {
  assert(!physicalGlanceIds.has(chart.id) && !physicalPanelIds.has(chart.id), `${chart.id} must render once as a chart, not repeat as a fact card`);
}
assert.strictEqual(physicalView.methods.facts.length, 4, 'Methods drawer must retain all Physical facts after visual de-duplication');

const controlsAt = index.indexOf('id="climate-lens-controls"');
const globeVizAt = index.indexOf('id="globeViz"');
assert(controlsAt >= 0 && controlsAt < globeVizAt, 'lens controls must be body-level overlays before #globeViz');
for (const lens of ['carbon', 'power', 'physical']) {
  assert(index.includes(`data-climate-lens="${lens}"`), `missing ${lens} lens button`);
}
assert(index.includes('aria-live="polite"'));
assert(index.includes('Browse all 249 records'));
assert(index.includes('id="globe-fallback-country-list"'));
assert(index.includes('id="globe-fallback-search"'));
assert(index.includes('id="globe-fallback" hidden role="region"'));
assert(!index.includes('id="globe-fallback" hidden role="dialog" aria-modal="true"'));
assert(!globe.includes('_setFallbackIsolation('));
assert(!globe.includes('_onFallbackKeydown'));
assert(globe.includes('this._bindLensControls();\n    this._bindFallbackControls();'), 'fallback must bind the shared lens controls even when WebGL fails before normal init');
assert(globe.includes('id="globe-fallback-detail-title" tabindex="-1"'), 'fallback evidence heading must accept tutorial focus restoration');
assert(globe.includes("wrap.setAttribute('aria-modal', 'false')"));
assert(!globe.includes("wrap.setAttribute('aria-modal', 'true')"));
assert(!app.includes("safeCall('GlobeModule', 'selectDefaultCountry')"), 'subsequent globe entry must not auto-open a country panel');
assert(globe.includes("window.removeEventListener('resize', this._onCountryCardResize)"));
assert(!/on(?:click|input)="Panel/.test(globe), 'legacy panel must not use inline event handlers');
assert(globe.includes('${_escapeHtml(site.name)}'));
assert(globe.includes('${_escapeHtml(ctx.summary)}'));
assert(index.includes('No composite score, target assessment, finance judgment, or offset adjustment is produced.'));

assert(presentation.includes('citation_only_sources'));
assert(presentation.includes('Citation retained for historical provenance; no values from this source appear in this release.'));
assert(globe.includes('Methods &amp; sources'));
assert(globe.includes('At a glance'));
assert(globe.includes('view.primary.evidence_label') && globe.includes('view.tooltip.evidence_class'));
assert(css.includes('.tt-methods > summary'));
assert(css.includes('min-height: 44px') || css.includes('min-height:44px'));
assert(css.includes('@media (prefers-reduced-motion: reduce)') || css.includes('@media(prefers-reduced-motion:reduce)'));
const selectedHeaderCss = css.slice(
  css.indexOf('#hex-country-tooltip.selected .tt-topline {'),
  css.indexOf('}', css.indexOf('#hex-country-tooltip.selected .tt-topline {')) + 1
);
assert(selectedHeaderCss.includes('position: sticky'), 'selected-country identity header must remain visible while the card scrolls');
assert(selectedHeaderCss.includes('top: -14px'), 'selected-country identity header must clear the card padding and pin to the scrollport top');
assert(selectedHeaderCss.includes('background: var(--hud-bg-strong)'), 'sticky country identity must mask evidence scrolling beneath it in both themes');
assert(css.includes('scroll-padding-block-start: 76px'), 'country-card focus scrolling must clear the sticky identity header');
assert(css.includes('top: 142px !important;'), 'compact selected-country card CSS must override stale inline docking coordinates');
assert(globe.includes("const compactCardTop = '142px';"), 'runtime country-card dock must share the compact lens/card boundary');
assert(!globe.includes("wrap.style.top = '114px';"), 'runtime country-card dock retains the old touching coordinate');

const publicClimateSurface = [index, globe, css].join('\n');
assert(!/PRIMAP/i.test(publicClimateSurface), 'PRIMAP must not appear in public HTML, globe UI, or public globe CSS');
assert(!/pledges?\s+vs\.?\s+reality|climate performance|country performance score/i.test([presentation, globe].join('\n')), 'retired performance copy remains in the climate UI');
assert(!/provider-logo|source-logo/i.test([index, presentation, globe, css].join('\n')), 'provider logos must not dominate metric-first UI');

assert(serviceWorker.includes("const CACHE_NAME = 'elu-v69-runtime-resilience'"));
assert(serviceWorker.includes("'/css/globe-system.css?v=v42'"));
assert(serviceWorker.includes("'/css/guided-first-orbit.css?v=v9'"));
assert(serviceWorker.includes("'/js/data.js?v=v10'"));
assert(serviceWorker.includes("'/js/country-climate-intelligence.js?v=v13'"));
assert(serviceWorker.includes("'/js/globe.js?v=v37'"));
assert(serviceWorker.includes("'/js/guided-first-orbit.js?v=v6'"));
assert(serviceWorker.includes("'/js/app.js?v=v5'"));
assert(serviceWorker.includes("'/data/climate/runtime/country-climate-intelligence.json?v=cci1candidate7'"));
assert(serviceWorker.includes("'/data/climate/runtime/country-factual-candidate.json?v=ct42candidate1'"));
assert(!serviceWorker.includes('/data/carbon-projects.json'), 'retired project data must not be pinned by the climate runtime cache');

console.log('Country Climate Intelligence UI contract check passed (classic load order, three-move orbit, three lenses, non-modal evidence panels, and rollback pin).');
