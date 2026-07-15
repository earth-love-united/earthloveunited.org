#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  CONFIG,
  parseCsvLine,
  gigagramToMegatonne,
  classifyArea,
  buildCoverage,
  assertPinnedSource,
  readSelectedRows,
  buildArtifact,
  calculationHash,
} = require('./lib/primap-hist-ingest');

const ROOT = path.join(__dirname, '..');
const ARTIFACT_PATH = path.join(ROOT, 'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json');
const MANIFEST_PATH = path.join(ROOT, 'data/climate/releases/primap-hist-2.6.1-economy-wide-2026-07-15.json');
const FIXTURE_PATH = path.join(ROOT, 'data/climate/fixtures/primap-ingest.json');
const DEFAULT_SOURCE = '/tmp/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv';

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const sourcePath = process.argv[2] || DEFAULT_SOURCE;
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
  assert(fixture._meta.fictional_entities === true, 'parser fixtures must remain fictional');

  fixture.csv_lines.forEach(item => assert(JSON.stringify(parseCsvLine(item.line)) === JSON.stringify(item.expected), 'quoted CSV parser fixture failed'));
  fixture.unit_cases.forEach(item => assert(Object.is(gigagramToMegatonne(item.source_ggco2e), item.expected_mtco2e), `unit conversion fixture failed for ${item.source_ggco2e}`));
  const fictionalRegistry = new Set(fixture.classification.registry_iso3);
  fixture.classification.cases.forEach(item => assert(classifyArea(item.area, fictionalRegistry) === item.expected, `classification fixture failed for ${item.area}`));
  const fictionalSeries = new Map(fixture.coverage.mapped_series.map(item => [item.country_id, item]));
  const fictionalCoverage = buildCoverage(fixture.coverage.registry, fictionalSeries);
  Object.entries(fixture.coverage.expected_states).forEach(([countryId, state]) => {
    assert(fictionalCoverage.find(item => item.country_id === countryId)?.state === state, `coverage fixture failed for ${countryId}`);
  });

  assertPinnedSource(sourcePath);
  const { selected } = await readSelectedRows(sourcePath);
  assert(selected.length === CONFIG.source_row_count, `selected source rows must be ${CONFIG.source_row_count}`);
  assert(selected.filter(item => item.row['2023'] !== '').length === CONFIG.source_2023_nonempty, `2023 nonempty source rows must be ${CONFIG.source_2023_nonempty}`);

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/country-registry.json'), 'utf8'));
  const enums = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/schemas/enums.json'), 'utf8'));
  const registryIds = new Set(registry.entities.map(item => item.country_id));
  const rebuiltArtifact = buildArtifact(registry, selected, artifact.created_at);

  assert(JSON.stringify(rebuiltArtifact) === JSON.stringify(artifact), 'artifact is not an exact deterministic rebuild of the pinned source');
  assert(artifact.calculation_hash === calculationHash(artifact), 'artifact calculation hash mismatch');
  assert(manifest.calculation_hash === calculationHash(manifest), 'manifest calculation hash mismatch');
  assert(manifest.artifact.checksum_sha256 === hashFile(ARTIFACT_PATH), 'manifest artifact checksum mismatch');
  assert(manifest.input_hash_sha256 === CONFIG.source_sha256, 'manifest input hash mismatch');
  assert(artifact.source.input_hash_sha256 === CONFIG.source_sha256, 'artifact input hash mismatch');
  assert(fs.statSync(ARTIFACT_PATH).size < 10 * 1024 * 1024, 'normalized artifact must remain below 10MB');

  assert(artifact.selection.scenario === 'HISTTP', 'scenario must remain HISTTP');
  assert(artifact.selection.evidence_plane === 'harmonized', 'PRIMAP HISTTP must remain harmonized');
  assert(artifact.selection.official_plane_claimed === false, 'PRIMAP HISTTP must never claim official plane');
  assert(artifact.selection.histcr_included === false, 'HISTCR must remain separate');
  assert(artifact.selection.entity === 'KYOTOGHG (AR6GWP100)', 'gas/GWP entity changed');
  assert(artifact.selection.category === 'M.0.EL', 'category changed');
  assert(artifact.selection.lulucf === 'excluded', 'LULUCF treatment changed');
  assert(artifact.selection.international_bunkers === 'not_specified_for_selected_category', 'international-bunker uncertainty must remain explicit');
  assert(artifact.selection.uncertainty.status === 'not_provided_in_selected_rows', 'source uncertainty absence must remain explicit');
  assert(artifact.selection.formula === 'value_mtco2e = source_value_ggco2e / 1000', 'unit formula changed');
  assert(artifact.source.licence === 'CC-BY-4.0' && artifact.source.attribution.includes('Gütschow'), 'licence or attribution missing');

  assert(artifact.review.status === 'not_reviewed' && artifact.review.reviewer_id === null, 'real values must remain not_reviewed');
  assert(artifact.publication_gates.assessed_use.allowed === false, 'assessed use must fail closed');
  assert(artifact.publication_gates.scoring.allowed === false, 'scoring must fail closed');
  assert(artifact.publication_gates.scoring.reason_codes.includes('independent_review_required'), 'scoring denial must require independent review');
  assert(artifact.publication_gates.candidate_redistribution.allowed === true && artifact.publication_gates.candidate_redistribution.reviewed_site_release === false, 'candidate redistribution must remain distinct from reviewed site release');
  assert(manifest.gates.candidate_redistribution_allowed === true && manifest.gates.reviewed_site_release_allowed === false, 'manifest release boundary mismatch');
  assert(manifest.coverage.release_eligible === 0 && manifest.coverage.scoring_eligible === 0, 'release/scoring eligibility must be zero');
  assert(manifest.gates.ct40_required_result === 'deny_not_reviewed', 'CT-40 required denial is missing');
  assert(Object.values(artifact.forbidden_outputs).every(value => value === false), 'artifact assigned a forbidden assessment output');

  assert(artifact.source_row_audit.selected_rows === 215, 'source row audit mismatch');
  assert(artifact.source_row_audit.nonempty_2023 === 215, '2023 audit mismatch');
  assert(artifact.source_row_audit.mapped_country_rows === 206, 'mapped row count mismatch');
  assert(artifact.source_row_audit.aggregate_rows === 8, 'aggregate row count mismatch');
  assert(artifact.source_row_audit.obsolete_rows === 1, 'obsolete row count mismatch');
  assert(artifact.source_row_audit.unmapped_rows === 0, 'unmapped row count mismatch');
  assert(artifact.registry_coverage.length === 249, 'all registry entities need a state');
  assert(artifact.registry_coverage.filter(item => item.state === 'source_unavailable').length === 43, 'registry gap count mismatch');
  assert(artifact.registry_coverage.every(item => enums.evidence_states.includes(item.state)), 'coverage uses a non-canonical CT-02 evidence state');
  assert(artifact.registry_coverage.every(item => item.reason_codes.every(code => enums.reason_codes.includes(code))), 'coverage uses a non-canonical CT-02 reason code');
  assert(artifact.registry_coverage.every(item => registryIds.has(item.country_id)), 'coverage contains a non-canonical country ID');
  assert(artifact.series.length === 206, 'series count mismatch');
  assert(new Set(artifact.series.map(item => item.country_id)).size === 206, 'series country IDs must be unique');
  assert(artifact.series.every(item => registryIds.has(item.country_id)), 'series contains a non-canonical country ID');
  assert(artifact.series.every(item => item.review_status === 'not_reviewed' && item.release_eligible === false && item.scoring_eligible === false), 'series review gate mismatch');
  assert(artifact.series.every(item => item.reason_codes.every(code => enums.reason_codes.includes(code))), 'series uses a non-canonical CT-02 reason code');
  assert(artifact.series.every(item => item.values.length === 10), 'each series must cover 2014–2023');

  const rebuiltValues = new Map(selected.map(item => [item.row['area (ISO3)'], item]));
  artifact.series.forEach(series => {
    const source = rebuiltValues.get(series.iso_alpha3);
    assert(source && source.csv_row === series.source_locator.csv_row, `${series.iso_alpha3} locator mismatch`);
    assert(JSON.stringify(series.source_locator.row_key) === JSON.stringify({
      source: source.row.source,
      scenario: source.row['scenario (PRIMAP-hist)'],
      provenance: source.row.provenance,
      area: source.row['area (ISO3)'],
      entity: source.row.entity,
      unit: source.row.unit,
      category: source.row['category (IPCC2006_PRIMAP)'],
    }), `${series.iso_alpha3} row key mismatch`);
    series.values.forEach(value => {
      const sourceText = source.row[String(value.year)];
      const sourceNumber = sourceText === '' ? null : Number(sourceText);
      assert(Object.is(value.source_value_ggco2e, sourceNumber), `${series.iso_alpha3} ${value.year} source value mismatch`);
      assert(Object.is(value.value_mtco2e, sourceNumber === null ? null : sourceNumber / 1000), `${series.iso_alpha3} ${value.year} normalized value mismatch`);
      const sourceFactId = `fact:primap-hist-2.6.1:source:histtp:m0el:${series.iso_alpha3.toLowerCase()}:${value.year}`;
      assert(value.source_fact_id === sourceFactId, `${series.iso_alpha3} ${value.year} source fact ID mismatch`);
      assert(value.fact_id === `fact:primap-hist-2.6.1:normalized:histtp:m0el:${series.iso_alpha3.toLowerCase()}:${value.year}`, `${series.iso_alpha3} ${value.year} fact ID mismatch`);
      assert(JSON.stringify(value.input_fact_ids) === JSON.stringify([sourceFactId]), `${series.iso_alpha3} ${value.year} input lineage mismatch`);
    });
  });

  console.log(`PRIMAP CT-10B: PASS (215 source rows; 206 mapped; 8 aggregates; 1 obsolete; 0 unmapped; 43 registry gaps; ${artifact.series.length * 10} facts; ${fs.statSync(ARTIFACT_PATH).size} bytes)`);
}

main().catch(error => {
  console.error(`PRIMAP CT-10B: FAIL — ${error.message}`);
  process.exit(1);
});
