#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fileSha256, readJson, writeJson } = require('./lib/country-climate-intelligence');
const { compile: compileWpp } = require('./compile-wpp-population');
const { compile: compileTrace } = require('./compile-climate-trace');
const { compile: compileEmber } = require('./compile-ember-power');
const { compile: compileCckp } = require('./compile-cckp-physical');

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
  const wppInput = write('wpp.csv', 'ISO3_code,Location,Time,Variant,PopTotal\nABW,Aruba,2024,Medium,123.456\n');
  const wppReceipt = receiptFor('un-wpp-2024', wppInput, { year_classification_2024: 'projection' });
  const wppOutput = path.join(temporaryDirectory, 'wpp-output.json');
  compileWpp(['--input', wppInput, '--receipt', wppReceipt, '--output', wppOutput]);
  const wpp = readJson(wppOutput);
  assert.strictEqual(wpp.entity_count, 249);
  assert.strictEqual(wpp.countries.find(country => country.iso_alpha3 === 'ABW').metrics['population.estimate'].value, 123456);
  assert.strictEqual(wpp.countries.find(country => country.iso_alpha3 === 'ABW').metrics['population.estimate'].status, 'modeled');
  assert.strictEqual(wpp.countries.find(country => country.iso_alpha3 === 'AFG').metrics['population.estimate'].value, null);

  const traceInput = write('trace.json', `${JSON.stringify({
    release_version: '5.9.0',
    rows: [{
      iso_alpha3: 'ABW', country_name: 'Aruba', year: 2024, sector: 'power', gas: 'co2',
      emissions_tonnes: 1000000, co2e_100yr_tonnes: 1000000,
      gwp_basis: 'IPCC_AR6_GWP100', estimate_status: 'estimated',
    }],
  })}\n`);
  const traceReceipt = receiptFor('climate-trace-v5.9.0-country-annual', traceInput, { source_version: '5.9.0' });
  const traceOutput = path.join(temporaryDirectory, 'trace-output.json');
  compileTrace(['--input', traceInput, '--receipt', traceReceipt, '--output', traceOutput]);
  const trace = readJson(traceOutput);
  assert.strictEqual(trace.countries.find(country => country.iso_alpha3 === 'ABW').metrics['emissions.ghg.independent'].value, 1);
  assert.strictEqual(trace.countries.find(country => country.iso_alpha3 === 'AFG').metrics['emissions.ghg.independent'].value, null);

  const emberRows = [
    ['Aruba', 'ABW', 2019, 'Electricity generation', 'Clean', '%', 10, 'actual'],
    ['Aruba', 'ABW', 2024, 'Electricity generation', 'Clean', '%', 25, 'actual'],
    ['Aruba', 'ABW', 2024, 'Electricity generation', 'Fossil', '%', 75, 'actual'],
    ['Aruba', 'ABW', 2024, 'Electricity generation', 'Wind and solar', '%', 20, 'actual'],
    ['Aruba', 'ABW', 2024, 'Electricity generation', 'Carbon intensity', 'gCO2/kWh', 400, 'actual'],
    ['Aruba', 'ABW', 2024, 'Power sector emissions', 'Total', 'MtCO2', 0.4, 'actual'],
  ];
  const emberInput = write('ember.csv', `Entity,Entity code,Year,Category,Variable,Unit,Value,Evidence class\n${emberRows.map(row => row.join(',')).join('\n')}\n`);
  const emberReceipt = receiptFor('ember-yearly-electricity-data-2026-08-24', emberInput, { year_status_2024: 'actual', default_evidence_class: 'actual' });
  const emberOutput = path.join(temporaryDirectory, 'ember-output.json');
  compileEmber(['--input', emberInput, '--receipt', emberReceipt, '--output', emberOutput]);
  const ember = readJson(emberOutput);
  const arubaPower = ember.countries.find(country => country.iso_alpha3 === 'ABW').metrics;
  assert.strictEqual(arubaPower['electricity.clean_share'].value, 25);
  assert.strictEqual(arubaPower['electricity.clean_share_change_5y'].value, 15);
  assert.strictEqual(arubaPower['electricity.emissions'].value, 0.4);

  const emberCo2eRows = emberRows.map(row => row.slice());
  emberCo2eRows[emberCo2eRows.length - 1][5] = 'MtCO2e';
  const emberCo2eInput = write('ember-co2e.csv', `Entity,Entity code,Year,Category,Variable,Unit,Value,Evidence class\n${emberCo2eRows.map(row => row.join(',')).join('\n')}\n`);
  const emberCo2eReceipt = receiptFor('ember-yearly-electricity-data-2026-08-24', emberCo2eInput, { year_status_2024: 'actual', default_evidence_class: 'actual' });
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

  assert.throws(() => compileEmber(['--input', emberInput, '--receipt', traceReceipt, '--output', emberOutput]), /Ember receipt/);
  console.log('Country Climate Intelligence compiler fixtures passed (WPP, Climate TRACE, Ember, and CCKP; 249-row gap-preserving outputs).');
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
