#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const GOVERNANCE_DIR = path.join(ROOT, 'data/climate/releases/gcb-2025-v1.0');
const dirAt = process.argv.indexOf('--dir');
const DIR = dirAt === -1 ? GOVERNANCE_DIR : path.resolve(process.argv[dirAt + 1]);
let failures = 0;

function check(condition, message) {
  if (!condition) { console.error(`FAIL: ${message}`); failures += 1; }
}

function read(name, governance = false) {
  const requested = path.join(DIR, name);
  const file = governance && !fs.existsSync(requested) ? path.join(GOVERNANCE_DIR, name) : requested;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hash(name) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, name))).digest('hex');
}

function main() {
  const source = read('source-manifest.json', true);
  const official = read('official-inventory-manifest.json', true);
  const evidence = read('fossil-co2-territorial.json');
  const report = read('coverage-anomalies.json');
  const release = read('release-manifest.json');

  check(source.evidence_plane === 'harmonized', 'GCB must remain in harmonized plane');
  check(source.raw_retrieval.sha256 === '968097cacb1a6a5bfa0cf74ee90763f74a90ef10499e060ab43d1a74c671d46b', 'exact v1.0 checksum required');
  check(source.licence.identifier === 'CC-BY-4.0', 'GCB licence must be explicit');
  check(source.accounting_scope.includes.some(value => /cement carbonation/.test(value)), 'cement carbonation treatment required');
  check(source.accounting_scope.excludes.some(value => /land-use/.test(value)), 'LULUCF exclusion required');

  check(official.plane === 'official', 'official manifest plane required');
  check(official.release_status === 'metadata_only', 'official plane must fail closed');
  check(Array.isArray(official.normalized_values) && official.normalized_values.length === 0, 'official normalized values prohibited');
  check(!JSON.stringify(official).includes('gcb-2025-v1.0'), 'official and harmonized releases must not be reconciled');

  check(evidence.evidence_plane === 'harmonized', 'evidence plane must be harmonized');
  check(evidence.schema_ref === '../../schemas/emissions-evidence.schema.json', 'evidence schema reference required');
  check(Array.isArray(evidence.series), 'series array required');
  if (evidence.release_status === 'blocked_source_unavailable') {
    check(evidence.series.length === 0, 'blocked artifact cannot contain observations');
    check(evidence.availability && evidence.availability.value === null, 'blocked artifact must expose explicit null');
    check(release.publication_gate === 'user_licence_acceptance_required', 'blocked release gate must be explicit');
  } else {
    check(['staged_identity_review', 'fixture_only'].includes(evidence.release_status), 'compiled release must await identity review or be fixture-only');
    check(evidence.series.length > 0, 'compiled release requires source series');
    for (const entity of evidence.series) {
      check(entity.canonical_country_id === null, `${entity.source_entity_id}: unreviewed identity must be null`);
      check(entity.identity_link_status === 'not_reviewed', `${entity.source_entity_id}: identity status required`);
      for (const observation of entity.observations) {
        check(observation.value !== undefined, `${entity.source_entity_id}/${observation.year}: value required, including null`);
        check(observation.status === (observation.value === null ? 'not_reported' : 'estimated'), `${entity.source_entity_id}/${observation.year}: status/value mismatch`);
        check(observation.uncertainty.status === 'not_provided_at_country_year_level', `${entity.source_entity_id}/${observation.year}: uncertainty state required`);
      }
    }
    for (const artifact of release.artifacts) {
      check(hash(artifact.path) === artifact.sha256, `${artifact.path}: release checksum mismatch`);
    }
  }

  check(report.observations.total === report.observations.estimated + report.observations.missing, 'coverage observation totals must balance');
  if (failures) throw new Error(`${failures} country emissions evidence check(s) failed`);
  console.log(`country emissions evidence: PASS (${evidence.release_status})`);
}

try { main(); } catch (error) { if (!failures) console.error(error.stack || error.message); process.exitCode = 1; }
