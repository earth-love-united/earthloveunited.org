#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fileSha256, readJson, writeJson } = require('./lib/country-climate-intelligence');
const { compile: compileWpp } = require('./compile-wpp-population');
const { compile: compileEmber } = require('./compile-ember-power');
const { compile: compileCckp } = require('./compile-cckp-physical');
const {
  FACTOR: GCB_FACTOR,
  applyIdentity: applyGcbIdentity,
  fossilMetrics: gcbFossilMetrics,
  landMetric: gcbLandMetric,
  loadIdentityMap: loadGcbIdentityMap,
  matrix: gcbMatrix,
} = require('./lib/gcb-country-intelligence');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-cci-compilers-'));

function write(fileName, text) {
  const file = path.join(temporaryDirectory, fileName);
  fs.writeFileSync(file, text);
  return file;
}

function receiptFor(sourceRegistryId, file, extra = {}) {
  const receipt = {
    bytes: fs.statSync(file).size,
    retrieved_on: '2026-08-24',
    sha256: fileSha256(file),
    source_registry_id: sourceRegistryId,
    ...extra,
  };
  const receiptPath = `${file}.receipt.json`;
  writeJson(receiptPath, receipt);
  return receiptPath;
}

try {
  const gcbRows = [
    { _row: 1, A: 'Year', B: 'Aruba' },
    { _row: 2, A: 1850, B: 1 },
    { _row: 3, A: 2024, B: 2 },
  ];
  const parsedGcb = gcbMatrix(gcbRows, 'Territorial Emissions fixture');
  assert.deepStrictEqual(parsedGcb, [{
    source_name: 'Aruba',
    observations: [{ year: 1850, value: 1 }, { year: 2024, value: 2 }],
  }]);
  assert.throws(() => gcbMatrix([
    { _row: 1, A: 'Year', B: 'Aruba' },
    { _row: 2, A: 2023, B: 'not-a-number' },
    { _row: 3, A: 2024, B: 2 },
  ], 'invalid fixture'), /non-numeric value/);

  const gcbFossil = gcbFossilMetrics('ABW',
    [{ year: 1850, value: 1 }, { year: 2024, value: 2 }],
    [{ year: 2023, value: 3 }],
    [{ year: 2023, value: -1 }]);
  assert.strictEqual(gcbFossil['emissions.fossil_co2.territorial'].value, 2 * GCB_FACTOR);
  assert.strictEqual(gcbFossil['emissions.fossil_co2.cumulative'].value, 3 * GCB_FACTOR);
  assert.strictEqual(gcbFossil['emissions.fossil_co2.cumulative'].context.available_years, 2,
    'GCB cumulative must count only source years with numeric values');
  assert.strictEqual(gcbFossil['emissions.fossil_co2.consumption'].value, 3 * GCB_FACTOR);
  assert.strictEqual(gcbFossil['emissions.fossil_co2.net_transfer'].value, -1 * GCB_FACTOR,
    'GCB transfer sign must be preserved rather than absolutized or reversed');

  const constantModel = value => Array.from({ length: 10 }, (_, index) => ({ year: 2015 + index, value }));
  const gcbLand = gcbLandMetric('ABW', {
    BLUE: constantModel(1),
    OSCAR: constantModel(2),
    LUCE: constantModel(3),
  });
  assert.deepStrictEqual(gcbLand.context.model_means, { BLUE: GCB_FACTOR, OSCAR: 2 * GCB_FACTOR, LUCE: 3 * GCB_FACTOR });
  assert.strictEqual(gcbLand.value, 2 * GCB_FACTOR, 'GCB land central value must be the mean of the three model means');
  assert.strictEqual(gcbLand.uncertainty.kind, 'model_spread_population_standard_deviation');
  assert.strictEqual(gcbLand.uncertainty.sigma,
    Math.round((GCB_FACTOR * Math.sqrt(2 / 3)) * 1e6) / 1e6,
    'GCB land spread must use population standard deviation across BLUE, OSCAR, and LUCE');
  assert.strictEqual(gcbLandMetric('ABW', { BLUE: constantModel(1).slice(1), OSCAR: constantModel(2), LUCE: constantModel(3) }).value, null,
    'GCB land values must fail closed when any model-year is missing');

  const duplicateIdentityPath = write('gcb-duplicate-identity.json', JSON.stringify({
    mappings: [{ source_name: 'Aruba', iso_alpha3: 'ABW' }],
    exceptions: [{ source_name: 'Aruba', kind: 'unmapped', reason: 'fixture ambiguity' }],
  }));
  assert.throws(() => loadGcbIdentityMap(duplicateIdentityPath), /Duplicate GCB identity disposition/);
  const registryFixture = { entities: [{ iso_alpha3: 'ABW' }] };
  assert.throws(() => applyGcbIdentity([parsedGcb], new Map(), registryFixture), /no reviewed identity disposition/);
  assert.throws(() => applyGcbIdentity([parsedGcb], new Map([['Aruba', { kind: 'mapped', iso_alpha3: 'XXX' }]]), registryFixture), /unknown ISO3/);
  assert.throws(() => applyGcbIdentity([parsedGcb], new Map([
    ['Aruba', { kind: 'mapped', iso_alpha3: 'ABW' }],
    ['Unused', { kind: 'unmapped', reason: 'fixture' }],
  ]), registryFixture), /unused dispositions/);

  const wppInput = write('wpp.csv', 'LocID,ISO3_code,Location,Time,Variant,TPopulation1July\n533,ABW,Aruba,2024,Medium,123.456\n');
  const wppReceipt = receiptFor('un-wpp-2024', wppInput, { year_classification_2024: 'projection' });
  const wppOutput = path.join(temporaryDirectory, 'wpp-output.json');
  compileWpp(['--input', wppInput, '--receipt', wppReceipt, '--output', wppOutput]);
  const wpp = readJson(wppOutput);
  assert.strictEqual(wpp.entity_count, 249);
  assert.strictEqual(wpp.countries.find(country => country.iso_alpha3 === 'ABW').metrics['population.wpp_medium_projection'].value, 123456);
  assert.strictEqual(wpp.countries.find(country => country.iso_alpha3 === 'ABW').metrics['population.wpp_medium_projection'].status, 'modeled');
  assert.strictEqual(wpp.countries.find(country => country.iso_alpha3 === 'AFG').metrics['population.wpp_medium_projection'].value, null);

  const emberRows = [
    ['Aruba', 'ABW', 2019, 'Country or economy', 'Electricity generation', 'Aggregate fuel', 'Clean', '%', 10, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Aggregate fuel', 'Clean', '%', 25, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Aggregate fuel', 'Fossil', '%', 75, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Aggregate fuel', 'Wind and Solar', '%', 20, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Fuel', 'Bioenergy', '%', 0, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Fuel', 'Coal', '%', 20, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Fuel', 'Gas', '%', 50, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Fuel', 'Hydro', '%', 5, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Fuel', 'Nuclear', '%', 0, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Fuel', 'Other Fossil', '%', 5, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Fuel', 'Other Renewables', '%', 0, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Fuel', 'Solar', '%', 10, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Electricity generation', 'Fuel', 'Wind', '%', 10, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Power sector emissions', 'CO2 intensity', 'CO2 intensity', 'gCO2/kWh', 400, 'actual'],
    ['Aruba', 'ABW', 2024, 'Country or economy', 'Power sector emissions', 'Total', 'Total emissions', 'mtCO2', 0.4, 'actual'],
  ];
  const emberInput = write('ember.csv', `Area,ISO 3 code,Year,Area type,Category,Subcategory,Variable,Unit,Value,Evidence class\n${emberRows.map(row => row.join(',')).join('\n')}\n`);
  const emberReceipt = receiptFor('ember-yearly-electricity-data-2026-08-25', emberInput, { year_status_2019: 'actual', year_status_2024: 'actual', default_evidence_class: 'actual' });
  const emberOutput = path.join(temporaryDirectory, 'ember-output.json');
  compileEmber(['--input', emberInput, '--receipt', emberReceipt, '--output', emberOutput]);
  const ember = readJson(emberOutput);
  const arubaPower = ember.countries.find(country => country.iso_alpha3 === 'ABW').metrics;
  assert.strictEqual(arubaPower['electricity.clean_share'].value, 25);
  assert.strictEqual(arubaPower['electricity.clean_share_change_5y'].value, 15);
  assert.strictEqual(arubaPower['electricity.emissions'].value, 0.4);
  assert.strictEqual(arubaPower['electricity.generation_share.nuclear'].value, 0);
  assert.strictEqual(arubaPower['electricity.generation_share.solar'].value, 10);
  assert.strictEqual(arubaPower['electricity.clean_share'].context.fuel_mix_reconciliation.published_component_sum, 100);
  assert.strictEqual(arubaPower['electricity.clean_share'].context.fuel_mix_reconciliation.visual_normalization_applied, false);

  const emberCo2eRows = emberRows.map(row => row.slice());
  emberCo2eRows[emberCo2eRows.length - 1][7] = 'MtCO2e';
  const emberCo2eInput = write('ember-co2e.csv', `Area,ISO 3 code,Year,Area type,Category,Subcategory,Variable,Unit,Value,Evidence class\n${emberCo2eRows.map(row => row.join(',')).join('\n')}\n`);
  const emberCo2eReceipt = receiptFor('ember-yearly-electricity-data-2026-08-25', emberCo2eInput, { year_status_2019: 'actual', year_status_2024: 'actual', default_evidence_class: 'actual' });
  assert.throws(() => compileEmber(['--input', emberCo2eInput, '--receipt', emberCo2eReceipt, '--output', emberOutput]), /unit mismatch/);

  const projectionRows = [];
  for (const variable of ['tas', 'pr']) {
    const unit = variable === 'tas' ? '°C' : 'mm/year';
    projectionRows.push(
      { iso_alpha3: 'ABW', variable, scenario: 'SSP1-2.6', period: '2040–2059 vs 1995–2014', percentile: 'median', value: 1, unit },
      { iso_alpha3: 'ABW', variable, scenario: 'SSP2-4.5', period: '2040–2059 vs 1995–2014', percentile: 'p10', value: 1.2, unit },
      { iso_alpha3: 'ABW', variable, scenario: 'SSP2-4.5', period: '2040–2059 vs 1995–2014', percentile: 'median', value: 1.6, unit },
      { iso_alpha3: 'ABW', variable, scenario: 'SSP2-4.5', period: '2040–2059 vs 1995–2014', percentile: 'p90', value: 2.1, unit },
      { iso_alpha3: 'ABW', variable, scenario: 'SSP5-8.5', period: '2040–2059 vs 1995–2014', percentile: 'median', value: 2.4, unit },
    );
  }
  const projectionInput = write('cckp-projection.json', `${JSON.stringify({ rows: projectionRows })}\n`);
  const observedInput = write('cckp-observed.json', `${JSON.stringify({ rows: [
    { iso_alpha3: 'ABW', variable: 'tas', year: 1970, value: 20, unit: '°C' },
    { iso_alpha3: 'ABW', variable: 'tas', year: 1980, value: 21, unit: '°C' },
    { iso_alpha3: 'ABW', variable: 'tas', year: 1990, value: 22, unit: '°C' },
    { iso_alpha3: 'ABW', variable: 'pr', year: 1970, value: 100, unit: 'mm/year' },
    { iso_alpha3: 'ABW', variable: 'pr', year: 1980, value: 120, unit: 'mm/year' },
    { iso_alpha3: 'ABW', variable: 'pr', year: 1990, value: 140, unit: 'mm/year' },
  ] })}\n`);
  const projectionReceipt = receiptFor('world-bank-cckp-cmip6-2026-08-24', projectionInput);
  const observedReceipt = receiptFor('world-bank-cckp-era5-2026-08-25', observedInput, { last_complete_year: 1990 });
  const cckpOutput = path.join(temporaryDirectory, 'cckp-output.json');
  compileCckp([
    '--projection-input', projectionInput, '--projection-receipt', projectionReceipt,
    '--observed-input', observedInput, '--observed-receipt', observedReceipt,
    '--output', cckpOutput,
  ]);
  const cckp = readJson(cckpOutput);
  const arubaClimate = cckp.countries.find(country => country.iso_alpha3 === 'ABW').metrics;
  assert.strictEqual(arubaClimate['climate.temperature.change'].value, 1.6);
  assert.strictEqual(arubaClimate['climate.temperature.observed_trend'].value, 1);
  assert.deepStrictEqual(arubaClimate['climate.temperature.observed_trend'].series, [
    { year: 1970, value: 20 },
    { year: 1980, value: 21 },
    { year: 1990, value: 22 },
  ]);
  assert.strictEqual(arubaClimate['climate.temperature.observed_trend'].context.series_unit, '°C');
  assert.strictEqual(arubaClimate['climate.temperature.observed_trend'].evidence_kind, 'reanalysis');
  assert.strictEqual(arubaClimate['climate.temperature.observed_trend'].context.annual_statistic_label, 'Annual mean');
  assert.deepStrictEqual(arubaClimate['climate.temperature.observed_trend'].context.trend_line, [
    { year: 1970, value: 20 },
    { year: 1990, value: 22 },
  ]);
  assert.strictEqual(arubaClimate['climate.precipitation.observed_trend'].value, 20);
  assert.strictEqual(arubaClimate['climate.precipitation.observed_trend'].unit, 'mm/year/decade');
  assert.strictEqual(arubaClimate['climate.precipitation.observed_trend'].context.series_unit, 'mm/year');
  assert.strictEqual(arubaClimate['climate.precipitation.observed_trend'].evidence_kind, 'reanalysis');
  assert.strictEqual(arubaClimate['climate.precipitation.observed_trend'].context.annual_statistic_label, 'Annual total');
  assert.strictEqual(arubaClimate['climate.precipitation.observed_trend'].context.series_label, 'Annual total precipitation');
  assert.strictEqual(cckp.countries.find(country => country.iso_alpha3 === 'AFG').metrics['climate.temperature.observed_trend'].gap_reason.code, 'source_value_missing');
  assert.strictEqual(cckp.countries.find(country => country.iso_alpha3 === 'AFG').metrics['climate.precipitation.observed_trend'].gap_reason.code, 'source_value_missing');
  assert.strictEqual(cckp.countries.find(country => country.iso_alpha3 === 'AFG').metrics['climate.temperature.observed_trend'].evidence_kind, 'reanalysis');

  const duplicateProjectionInput = write('cckp-projection-duplicate.json', `${JSON.stringify({ rows: projectionRows.concat({ ...projectionRows[0] }) })}\n`);
  const duplicateProjectionReceipt = receiptFor('world-bank-cckp-cmip6-2026-08-24', duplicateProjectionInput);
  assert.throws(() => compileCckp([
    '--projection-input', duplicateProjectionInput, '--projection-receipt', duplicateProjectionReceipt,
    '--observed-input', observedInput, '--observed-receipt', observedReceipt,
    '--output', cckpOutput,
  ]), /Duplicate CCKP projection tuple/);

  assert.throws(() => compileEmber(['--input', emberInput, '--receipt', wppReceipt, '--output', emberOutput]), /Ember receipt/);
  console.log('Country Climate Intelligence compiler fixtures passed (GCB, WPP, Ember, and CCKP; source math, identity denials, and 249-row gap-preserving outputs).');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
