#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readSheet } = require('./lib/xlsx-table');
const { EXPECTED, verify } = require('./acquire-gcb-2025');

const MTCO2_PER_MTC = 3.664;
const DEFAULT_DIR = 'data/climate/releases/gcb-2025-v1.0';
const AGGREGATES = [
  /^WORLD$/,
  /^GLOBAL$/,
  /BUNKER/,
  /INTERNATIONAL (AVIATION|SHIPPING|TRANSPORT)/,
  /STATISTICAL DIFFERENCE/,
  /^KP ANNEX B$/,
  /^NON KP ANNEX B$/,
  /^OECD$/,
  /^NON-OECD$/,
  /^EU27$/,
  /^AFRICA$/,
  /^ASIA$/,
  /^CENTRAL AMERICA$/,
  /^EUROPE$/,
  /^MIDDLE EAST$/,
  /^NORTH AMERICA$/,
  /^OCEANIA$/,
  /^SOUTH AMERICA$/,
];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function serialize(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function slug(value) {
  return value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isAggregate(name) {
  return AGGREGATES.some(pattern => pattern.test(name.toUpperCase()));
}

function loadRows(args) {
  const fixtureAt = args.indexOf('--fixture');
  if (fixtureAt !== -1) {
    const fixture = JSON.parse(fs.readFileSync(args[fixtureAt + 1], 'utf8'));
    if (fixture.fixture_only !== true) throw new Error('Fixture input must declare fixture_only=true');
    return { rows: fixture.rows, input: { kind: 'fixture', sha256: sha256(serialize(fixture)) } };
  }
  const inputAt = args.indexOf('--input');
  if (inputAt === -1 || !args[inputAt + 1]) throw new Error('Use --input <verified xlsx> or --fixture <fixture json>');
  const input = verify(args[inputAt + 1]);
  return { rows: readSheet(input, 'Territorial Emissions'), input: { kind: 'xlsx', sha256: EXPECTED.sha256 } };
}

function extract(rows) {
  const firstDataIndex = rows.findIndex(row => Number.isInteger(row.A) && row.A >= 1800 && row.A <= 2100);
  if (firstDataIndex < 1) throw new Error('Could not find first annual Territorial Emissions row');
  const header = rows[firstDataIndex - 1];
  const dataRows = rows.slice(firstDataIndex).filter(row => Number.isInteger(row.A) && row.A >= 1800 && row.A <= 2100);
  if (dataRows.length < 2) throw new Error('Territorial Emissions sheet has fewer than two annual rows');

  const columns = Object.keys(header)
    .filter(column => column !== '_row' && column !== 'A' && typeof header[column] === 'string' && header[column].trim())
    .map(column => ({ column, name: header[column].trim() }));
  if (!columns.length) throw new Error('No source entity headers found');

  const excluded = columns.filter(item => isAggregate(item.name)).map(item => item.name).sort();
  const entities = columns.filter(item => !isAggregate(item.name));
  const years = dataRows.map(row => row.A);
  const series = entities.map(entity => {
    const observations = dataRows.map(row => {
      const raw = row[entity.column];
      if (raw === null || raw === undefined || raw === '') {
        return {
          year: row.A,
          value: null,
          unit: 'MtCO2/yr',
          status: 'not_reported',
          uncertainty: { status: 'not_provided_at_country_year_level', lower: null, upper: null },
        };
      }
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        throw new Error(`Non-numeric emission for ${entity.name}, ${row.A}`);
      }
      return {
        year: row.A,
        value: Number((raw * MTCO2_PER_MTC).toFixed(6)),
        unit: 'MtCO2/yr',
          status: 'estimated',
        uncertainty: { status: 'not_provided_at_country_year_level', lower: null, upper: null },
      };
    });
    return {
      source_entity_id: `gcb:${slug(entity.name)}`,
      source_entity_name: entity.name,
      canonical_country_id: null,
      identity_link_status: 'not_reviewed',
      observations,
    };
  }).sort((a, b) => a.source_entity_id.localeCompare(b.source_entity_id));

  const duplicateIds = series.map(item => item.source_entity_id).filter((id, i, all) => all.indexOf(id) !== i);
  if (duplicateIds.length) throw new Error(`Source identity slug collision: ${[...new Set(duplicateIds)].join(', ')}`);
  return { series, excluded, years };
}

function buildReport(series, excluded, years) {
  const anomalies = [];
  let estimated = 0;
  let missing = 0;
  for (const entity of series) {
    const present = entity.observations.filter(item => item.status === 'estimated');
    estimated += present.length;
    missing += entity.observations.length - present.length;
    const negative = present.filter(item => item.value < 0).map(item => item.year);
    if (negative.length) anomalies.push({ source_entity_id: entity.source_entity_id, type: 'negative_net_fossil_co2', years: negative });
    const availableYears = new Set(present.map(item => item.year));
    if (present.length) {
      const first = present[0].year;
      const last = present[present.length - 1].year;
      const internal = years.filter(year => year > first && year < last && !availableYears.has(year));
      if (internal.length) anomalies.push({ source_entity_id: entity.source_entity_id, type: 'internal_missing_years', years: internal });
    }
  }
  return {
    schema_version: '1.0.0',
    release_id: 'gcb-2025-v1.0',
    year_span: years.length ? { first: Math.min(...years), last: Math.max(...years), count: years.length } : null,
    source_entities: series.length,
    canonical_identities_linked: series.filter(item => item.canonical_country_id).length,
    observations: { estimated, missing, total: estimated + missing },
    excluded_aggregate_columns: excluded,
    anomalies,
    identity_gate: 'All source identities require review against a separately licensed canonical registry before country-profile joins.',
  };
}

function artifact(series, input, compiledOn) {
  return {
    schema_version: '1.0.0',
    schema_ref: '../../schemas/emissions-evidence.schema.json',
    release_id: 'gcb-2025-v1.0',
    release_status: input.kind === 'fixture' ? 'fixture_only' : 'staged_identity_review',
    compiled_on: compiledOn,
    evidence_plane: 'harmonized',
    metric: 'territorial_fossil_co2',
    accounting: {
      gases: ['CO2'],
      boundary: 'territorial',
      includes: ['fossil_fuel_combustion', 'fossil_fuel_oxidation', 'carbonate_decomposition_in_industry', 'cement_production'],
      cement_carbonation: 'included_as_a_sink_in_E_FOS',
      excludes: ['land_use_change', 'short_cycle_biomass', 'international_aviation_and_maritime_bunkers_from_country_values'],
      source_unit: 'MtC/yr',
      published_unit: 'MtCO2/yr',
      conversion: { formula: 'MtC * 3.664', factor: MTCO2_PER_MTC },
    },
    source: {
      source_registry_id: 'gcp-gcb-2025-v1.0',
      title: 'Supplemental data of the Global Carbon Project 2025: National Fossil Carbon Emissions 2025 v1.0',
      doi: EXPECTED.doi,
      object_url: EXPECTED.landing_url,
      input_sha256: input.sha256,
      licence: 'CC-BY-4.0',
      attribution: 'Global Carbon Project (2025), Supplemental data of Global Carbon Budget 2025, version 1.0, https://doi.org/10.18160/GCP-2025. Unit conversion by Earth Love United.',
    },
    identity_policy: {
      source_names_preserved: true,
      canonical_join: 'not_reviewed',
      rule: 'No ISO or M49 identity is inferred from a source label. canonical_country_id remains null until reviewed against an approved registry.',
    },
    series,
  };
}

function main() {
  const args = process.argv.slice(2);
  const outputAt = args.indexOf('--output-dir');
  const outputDir = path.resolve(outputAt === -1 ? DEFAULT_DIR : args[outputAt + 1]);
  const dateAt = args.indexOf('--compiled-on');
  const compiledOn = dateAt === -1 ? '2026-07-15' : args[dateAt + 1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(compiledOn)) throw new Error('--compiled-on must be YYYY-MM-DD');
  const input = loadRows(args);
  const extracted = extract(input.rows);
  const evidence = artifact(extracted.series, input.input, compiledOn);
  const report = buildReport(extracted.series, extracted.excluded, extracted.years);
  fs.mkdirSync(outputDir, { recursive: true });
  const evidenceText = serialize(evidence);
  const reportText = serialize(report);
  fs.writeFileSync(path.join(outputDir, 'fossil-co2-territorial.json'), evidenceText);
  fs.writeFileSync(path.join(outputDir, 'coverage-anomalies.json'), reportText);
  const release = {
    schema_version: '1.0.0',
    release_id: evidence.release_id,
    release_status: evidence.release_status,
    methodology_version: '0.1.0',
    compiled_on: compiledOn,
    source_release: 'Global Carbon Budget 2025 v1.0',
    artifacts: [
      { path: 'fossil-co2-territorial.json', sha256: sha256(evidenceText), rows: report.observations.total },
      { path: 'coverage-anomalies.json', sha256: sha256(reportText), rows: report.anomalies.length },
    ],
    publication_gate: input.input.kind === 'fixture' ? 'fixture_only' : 'identity_review_required',
  };
  fs.writeFileSync(path.join(outputDir, 'release-manifest.json'), serialize(release));
  console.log(`Compiled ${report.source_entities} source entities and ${report.observations.total} annual states.`);
  console.log(`Estimated ${report.observations.estimated}; missing ${report.observations.missing}; anomalies ${report.anomalies.length}.`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
