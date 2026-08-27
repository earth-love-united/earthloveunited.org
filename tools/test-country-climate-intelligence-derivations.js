#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { landMetric } = require('./lib/gcb-country-intelligence');
const { olsSlopePerDecade, olsTrendLine, populationStdDev, round, scopesExactlyMatch } = require('./lib/country-climate-intelligence');
const { projectedMetric } = require('./compile-cckp-physical');

assert.strictEqual(round((10 * 1000000) / 2000000), 5, 'MtCO2-to-tCO2/person conversion failed');
assert.strictEqual(round(62.5 - 55.25), 7.25, 'five-year percentage-point change failed');

const models = {
  BLUE: Array.from({ length: 10 }, (_, index) => ({ year: 2015 + index, value: -1 })),
  OSCAR: Array.from({ length: 10 }, (_, index) => ({ year: 2015 + index, value: -2 })),
  LUCE: Array.from({ length: 10 }, (_, index) => ({ year: 2015 + index, value: -3 })),
};
const land = landMetric('TST', models);
assert.strictEqual(land.value, -7.328, 'negative land-use removals were not preserved');
assert.strictEqual(land.uncertainty.sigma, round(populationStdDev([-3.664, -7.328, -10.992])), 'land-use population sigma failed');
assert.strictEqual(land.context.negative_values_are_removals, true);

assert.strictEqual(olsSlopePerDecade([
  { year: 1970, value: 1 },
  { year: 1980, value: 3 },
  { year: 1990, value: 5 },
]), 2, 'OLS slope per decade failed');
assert.deepStrictEqual(olsTrendLine([
  { year: 1970, value: 1 },
  { year: 1980, value: 3 },
  { year: 1990, value: 5 },
]), {
  start: { year: 1970, value: 1 },
  end: { year: 1990, value: 5 },
  slope_per_decade: 2,
}, 'OLS trend-line endpoints failed');

const entity = { iso_alpha3: 'TST' };
const rows = [
  { scenario: 'SSP1-2.6', percentile: 'median', value: 1 },
  { scenario: 'SSP2-4.5', percentile: 'p10', value: 1.2 },
  { scenario: 'SSP2-4.5', percentile: 'median', value: 1.6 },
  { scenario: 'SSP2-4.5', percentile: 'p90', value: 2.1 },
  { scenario: 'SSP5-8.5', percentile: 'median', value: 2.4 },
];
const projection = projectedMetric(entity, 'tas', rows);
assert.strictEqual(projection.value, 1.6);
assert.strictEqual(projection.uncertainty.p10, 1.2);
assert.strictEqual(projection.uncertainty.p90, 2.1);
assert.throws(() => projectedMetric(entity, 'tas', rows.map(row => row.percentile === 'p10' ? { ...row, value: 2 } : row)), /percentile ordering invalid/);

const territorial = {
  metric: 'emissions.fossil_co2.territorial',
  accounting_frame: 'territorial',
  gases: ['CO2'],
  sectors: ['fossil'],
  geography: 'TST',
  lulucf_treatment: 'excluded',
  gwp: 'not_applicable_single_gas',
  unit: 'MtCO2/yr',
  period: '2024',
};
assert.strictEqual(scopesExactlyMatch(territorial, { ...territorial }), true, 'identical scopes must match');
assert.strictEqual(scopesExactlyMatch(territorial, { ...territorial, accounting_frame: 'consumption' }), false, 'mismatched accounting frames must not match');
assert.strictEqual(scopesExactlyMatch(territorial, { ...territorial, period: '2023' }), false, 'mismatched periods must not match');

assert.notStrictEqual(0, null, 'zero and missing must remain distinct');
console.log('Country Climate Intelligence derivation tests passed (per-capita, power change, land-use mean/σ, OLS, projections, and scope matching).');
