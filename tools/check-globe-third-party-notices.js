#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const notices = require('./lib/globe-third-party-notices');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'data/governance/vendor/globe-gl-2.46.1-notices.json');
const NOTICE_PATH = path.join(ROOT, 'THIRD_PARTY_NOTICES.txt');
const FIXTURE_PATH = path.join(ROOT, 'tools/fixtures/globe-third-party-notices.json');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setAtPath(target, dottedPath, value) {
  const keys = dottedPath.split('.');
  let cursor = target;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (!cursor || typeof cursor !== 'object' || !(key in cursor)) {
      throw new Error('Mutation path does not exist: ' + dottedPath);
    }
    cursor = cursor[key];
  }
  const finalKey = keys[keys.length - 1];
  if (!cursor || typeof cursor !== 'object' || !(finalKey in cursor)) {
    throw new Error('Mutation path does not exist: ' + dottedPath);
  }
  cursor[finalKey] = clone(value);
}

function findComponent(manifest, componentId) {
  const component = manifest.components.find(function (candidate) {
    return candidate.component_id === componentId;
  });
  if (!component) throw new Error('Fixture component not found: ' + componentId);
  return component;
}

function findNoticeSection(manifest, noticeId) {
  const section = manifest.notice_sections.find(function (candidate) {
    return candidate.notice_id === noticeId;
  });
  if (!section) throw new Error('Fixture notice section not found: ' + noticeId);
  return section;
}

function removeNoticeBlock(noticeText, noticeId) {
  const blockStartToken = '================================================================================\nNOTICE-ID: ' + noticeId + '\n';
  const blockStart = noticeText.indexOf(blockStartToken);
  if (blockStart === -1) throw new Error('Fixture notice block not found: ' + noticeId);
  const nextBlock = noticeText.indexOf('\n================================================================================', blockStart + blockStartToken.length);
  if (nextBlock === -1) return noticeText.slice(0, blockStart);
  return noticeText.slice(0, blockStart) + noticeText.slice(nextBlock + 1);
}

function applyMutation(baselineManifest, baselineNoticeText, mutation) {
  const manifest = clone(baselineManifest);
  let noticeText = baselineNoticeText;
  let noticeChanged = false;
  let shouldResign = true;

  switch (mutation.kind) {
    case 'set_manifest':
      setAtPath(manifest, mutation.path, mutation.value);
      break;
    case 'set_component':
      setAtPath(findComponent(manifest, mutation.component_id), mutation.path, mutation.value);
      break;
    case 'remove_component':
      manifest.components = manifest.components.filter(function (component) {
        return component.component_id !== mutation.component_id;
      });
      break;
    case 'duplicate_component':
      manifest.components.push(clone(findComponent(manifest, mutation.component_id)));
      break;
    case 'remove_notice_section':
      manifest.notice_sections = manifest.notice_sections.filter(function (section) {
        return section.notice_id !== mutation.notice_id;
      });
      break;
    case 'duplicate_notice_section':
      manifest.notice_sections.push(clone(findNoticeSection(manifest, mutation.notice_id)));
      break;
    case 'set_notice_section':
      setAtPath(findNoticeSection(manifest, mutation.notice_id), mutation.path, mutation.value);
      break;
    case 'replace_notice_text':
      if (!noticeText.includes(mutation.from)) {
        throw new Error('Fixture notice text not found for mutation ' + mutation.id);
      }
      noticeText = noticeText.replace(mutation.from, mutation.to);
      noticeChanged = true;
      if (mutation.sync_notice_id) {
        const parsed = notices.parseNoticeFile(noticeText);
        const parsedSection = parsed.sections.get(mutation.sync_notice_id);
        if (!parsedSection) {
          throw new Error('Changed notice section not found: ' + mutation.sync_notice_id);
        }
        findNoticeSection(manifest, mutation.sync_notice_id).payload_sha256 = parsedSection.payload_sha256;
      }
      break;
    case 'remove_notice_block':
      noticeText = removeNoticeBlock(noticeText, mutation.notice_id);
      noticeChanged = true;
      break;
    case 'append_notice_block':
      noticeText +=
        '\n================================================================================\n' +
        'NOTICE-ID: ' + mutation.notice_id + '\n' +
        'TITLE: Invented notice\n' +
        'APPLIES-TO:\n' +
        '- npm:globe.gl@2.46.1\n' +
        '----- BEGIN NOTICE ' + mutation.notice_id + ' -----\n' +
        'Invented notice payload.\n' +
        '----- END NOTICE ' + mutation.notice_id + ' -----\n';
      noticeChanged = true;
      break;
    case 'invalid_calculation_hash':
      manifest.calculation_hash = mutation.value;
      shouldResign = false;
      break;
    default:
      throw new Error('Unknown fixture mutation kind: ' + mutation.kind);
  }

  if (noticeChanged) manifest.notice_file.sha256 = notices.sha256(noticeText);
  if (shouldResign) manifest.calculation_hash = notices.calculationHash(manifest);

  return {
    manifest: manifest,
    manifestText: JSON.stringify(manifest, null, 2) + '\n',
    noticeText: noticeText
  };
}

function assertFixtureBaseline(fixture, report) {
  const baseline = fixture.baseline || {};
  const failures = [];

  if (fixture.schema_version !== notices.POLICY_VERSION) failures.push('fixture schema version');
  if (baseline.artifact_id !== 'globe-gl-2.46.1-third-party-notices-2026-07-15') failures.push('artifact id');
  if (baseline.manifest_sha256 !== notices.EXPECTED_MANIFEST_SHA256) failures.push('manifest SHA-256');
  if (baseline.manifest_calculation_hash !== notices.EXPECTED_MANIFEST_CALCULATION_HASH) failures.push('calculation hash');
  if (baseline.notice_sha256 !== notices.EXPECTED_NOTICE_SHA256) failures.push('notice SHA-256');
  if (baseline.component_count !== report.component_count) failures.push('component count');
  if (baseline.source_mapped_package_count !== report.source_mapped_package_count) failures.push('source-mapped package count');
  if (baseline.third_party_source_count !== report.third_party_source_count) failures.push('third-party source count');
  if (baseline.notice_section_count !== report.notice_section_count) failures.push('notice section count');

  if (failures.length > 0) {
    throw new Error('Fixture baseline drift: ' + failures.join(', '));
  }
}

function run() {
  const manifestText = readUtf8(MANIFEST_PATH);
  const noticeText = readUtf8(NOTICE_PATH);
  const fixture = JSON.parse(readUtf8(FIXTURE_PATH));
  const manifest = JSON.parse(manifestText);

  const baselineReport = notices.evaluateThirdPartyNotices({
    manifest: manifest,
    manifestText: manifestText,
    noticeText: noticeText
  });

  if (baselineReport.status !== 'pass') {
    console.error('FAIL: globe third-party notice evidence baseline did not validate.');
    baselineReport.failures.forEach(function (failure) {
      console.error('- ' + failure.id + ': ' + failure.message);
      if (failure.details !== undefined) console.error('  ' + JSON.stringify(failure.details));
    });
    process.exitCode = 1;
    return;
  }

  assertFixtureBaseline(fixture, baselineReport);

  const mutationFailures = [];
  fixture.mutations.forEach(function (mutation) {
    try {
      const mutated = applyMutation(manifest, noticeText, mutation);
      const report = notices.evaluateThirdPartyNotices(mutated);
      if (report.status !== 'fail') {
        mutationFailures.push(mutation.id + ': mutation unexpectedly passed');
      } else if (!report.failure_ids.includes(mutation.expected_failure)) {
        mutationFailures.push(
          mutation.id + ': expected ' + mutation.expected_failure +
          ', received ' + report.failure_ids.join(', ')
        );
      }
    } catch (error) {
      mutationFailures.push(mutation.id + ': fixture execution error: ' + error.message);
    }
  });

  if (mutationFailures.length > 0) {
    console.error('FAIL: adversarial notice fixtures did not behave as expected.');
    mutationFailures.forEach(function (failure) { console.error('- ' + failure); });
    process.exitCode = 1;
    return;
  }

  console.log('PASS: globe third-party notice evidence integrity');
  console.log('Review status: not_reviewed');
  console.log('Production approved: false');
  console.log('Release approved: false');
  console.log('Components: ' + baselineReport.component_count);
  console.log('Source-mapped packages: ' + baselineReport.source_mapped_package_count);
  console.log('Matched third-party sources: ' + baselineReport.third_party_source_count);
  console.log('Full notice sections: ' + baselineReport.notice_section_count);
  console.log('Adversarial mutations rejected: ' + fixture.mutations.length + '/' + fixture.mutations.length);
  console.log('Counsel questions unresolved: ' + manifest.counsel_questions.length);
}

if (require.main === module) run();

module.exports = {
  applyMutation: applyMutation,
  run: run
};
