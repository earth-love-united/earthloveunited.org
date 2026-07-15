#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const notices = require('./lib/globe-third-party-notices');
const { FIXED_RUNTIME_PATHS } = require('./lib/climate-runtime-diff-boundary');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, notices.MANIFEST_PATH);
const NOTICE_PATH = path.join(ROOT, notices.NOTICE_PATH);
const INTEGRATION_PATH = path.join(ROOT, notices.INTEGRATION_PATH);
const APPROVAL_SCHEMA_PATH = path.join(ROOT, notices.APPROVAL_SCHEMA_PATH);
const APPROVAL_TRUST_PATH = path.join(ROOT, notices.APPROVAL_TRUST_PATH);
const FIXTURE_PATH = path.join(ROOT, 'tools/fixtures/globe-third-party-notices.json');
const STAGED_INDEX = process.argv.indexOf('--staged');
const EXACT_SOURCE_FILES = Object.freeze([
  Object.freeze({ path: notices.NOTICE_PATH, sha256: notices.EXPECTED_NOTICE_SHA256 }),
  Object.freeze({ path: notices.MANIFEST_PATH, sha256: notices.EXPECTED_MANIFEST_SHA256 }),
  Object.freeze({ path: notices.INTEGRATION_PATH, sha256: notices.EXPECTED_INTEGRATION_SHA256 }),
  Object.freeze({ path: notices.APPROVAL_SCHEMA_PATH, sha256: notices.EXPECTED_APPROVAL_SCHEMA_SHA256 }),
  Object.freeze({ path: notices.APPROVAL_TRUST_PATH, sha256: notices.EXPECTED_APPROVAL_TRUST_SHA256 })
]);

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function inspectRegularFile(root, relative) {
  if (!path.isAbsolute(root)) throw new Error('notice verification root must be absolute');
  const normalized = path.posix.normalize(String(relative).replaceAll(path.sep, '/'));
  if (!normalized || normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    throw new Error('unsafe notice relative path: ' + relative);
  }
  let rootStat;
  try {
    rootStat = fs.lstatSync(root);
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false, regular_file: false, reason: 'root_missing' };
    throw error;
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    return { exists: true, regular_file: false, reason: 'unsafe_root' };
  }

  let current = root;
  const parts = normalized.split('/');
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') return { exists: false, regular_file: false, reason: 'missing' };
      throw error;
    }
    if (stat.isSymbolicLink()) return { exists: true, regular_file: false, reason: 'symbolic_link' };
    if (index < parts.length - 1 && !stat.isDirectory()) {
      return { exists: true, regular_file: false, reason: 'non_directory_parent' };
    }
    if (index === parts.length - 1 && !stat.isFile()) {
      return { exists: true, regular_file: false, reason: 'not_regular_file' };
    }
  }
  const bytes = fs.readFileSync(current);
  return {
    exists: true,
    regular_file: true,
    bytes: bytes.length,
    sha256: notices.sha256(bytes)
  };
}

function resolveStagedRoot(repoRoot, requested) {
  if (typeof requested !== 'string' || !requested.trim() || requested.includes('\0')) {
    throw new Error('--staged requires a safe staged directory');
  }
  const lexicalRoot = path.resolve(repoRoot);
  const lexicalCandidate = path.resolve(lexicalRoot, requested);
  const lexicalRelative = path.relative(lexicalRoot, lexicalCandidate);
  if (!lexicalRelative || lexicalRelative.startsWith('..') || path.isAbsolute(lexicalRelative)) {
    throw new Error('--staged must be a directory inside the repository');
  }
  const rootStat = fs.lstatSync(lexicalRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error('repository root must be a regular directory');
  }
  let current = lexicalRoot;
  for (const part of lexicalRelative.split(path.sep)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('--staged path must not contain symbolic links');
    if (!stat.isDirectory()) throw new Error('--staged path components must be directories');
  }
  const realRoot = fs.realpathSync.native(lexicalRoot);
  const realCandidate = fs.realpathSync.native(lexicalCandidate);
  const realRelative = path.relative(realRoot, realCandidate);
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error('--staged real path must remain inside the repository');
  }
  return realCandidate;
}

function sourceRecords(root) {
  return Object.fromEntries(EXACT_SOURCE_FILES.map(function (entry) {
    return [entry.path, inspectRegularFile(root, entry.path)];
  }));
}

function verifyNoticeFiles(root) {
  const records = sourceRecords(root);
  EXACT_SOURCE_FILES.forEach(function (entry) {
    const record = records[entry.path];
    if (!record || record.regular_file !== true) {
      throw new Error('notice file must be a regular non-symlink: ' + entry.path);
    }
    if (record.sha256 !== entry.sha256) {
      throw new Error('notice file SHA-256 drift: ' + entry.path);
    }
  });
  return records;
}

function loadIntegrationInput() {
  const integrationText = readUtf8(INTEGRATION_PATH);
  const approvalSchemaText = readUtf8(APPROVAL_SCHEMA_PATH);
  const approvalTrustText = readUtf8(APPROVAL_TRUST_PATH);
  return {
    integration: JSON.parse(integrationText),
    integrationText: integrationText,
    approvalSchema: JSON.parse(approvalSchemaText),
    approvalSchemaText: approvalSchemaText,
    approvalTrust: JSON.parse(approvalTrustText),
    approvalTrustText: approvalTrustText,
    coreManifest: JSON.parse(readUtf8(MANIFEST_PATH)),
    approval_artifact_present: inspectRegularFile(ROOT, notices.APPROVAL_PATH).exists === true,
    signature_bundle_present: inspectRegularFile(ROOT, notices.APPROVAL_SIGNATURE_BUNDLE_PATH).exists === true,
    source_records: sourceRecords(ROOT),
    runtime_fixed_paths: Array.from(FIXED_RUNTIME_PATHS),
    files: {
      build_deploy: readUtf8(path.join(ROOT, 'tools/build-deploy.sh')),
      index: readUtf8(path.join(ROOT, 'index.html')),
      credits: readUtf8(path.join(ROOT, 'CREDITS.md')),
      ci: readUtf8(path.join(ROOT, '.github/workflows/ci.yml')),
      climate_truth_ci: readUtf8(path.join(ROOT, 'tools/climate-truth-ci.js')),
      codeowners: readUtf8(path.join(ROOT, '.github/CODEOWNERS')),
      production_docs: [
        readUtf8(path.join(ROOT, 'docs/CLIMATE-PRODUCTION-READINESS.md')),
        readUtf8(path.join(ROOT, 'docs/COUNTRY-CLIMATE-TRUTH-CI.md')),
        readUtf8(path.join(ROOT, 'docs/operations/GO_PUBLIC.md')),
        readUtf8(path.join(ROOT, 'ARCHITECTURE.md'))
      ].join('\n')
    }
  };
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

function assertFixtureBaseline(fixture, report, integrationReport) {
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
  if (baseline.integration_sha256 !== notices.EXPECTED_INTEGRATION_SHA256) failures.push('integration SHA-256');
  if (baseline.integration_calculation_hash !== notices.EXPECTED_INTEGRATION_CALCULATION_HASH) failures.push('integration calculation hash');
  if (baseline.approval_schema_sha256 !== notices.EXPECTED_APPROVAL_SCHEMA_SHA256) failures.push('approval schema SHA-256');
  if (baseline.approval_trust_sha256 !== notices.EXPECTED_APPROVAL_TRUST_SHA256) failures.push('approval trust SHA-256');
  if (baseline.asset_rights_disposition_count !== notices.EXPECTED_ASSET_RIGHTS_ROWS.length) failures.push('asset rights count');
  if (!integrationReport || integrationReport.status !== 'pass') failures.push('integration report');

  if (failures.length > 0) {
    throw new Error('Fixture baseline drift: ' + failures.join(', '));
  }
}

function applyIntegrationMutation(baseline, mutation) {
  const changed = clone(baseline);
  if (mutation.kind === 'set_integration') {
    setAtPath(changed.integration, mutation.path, mutation.value);
    changed.integration.calculation_hash = notices.integrationCalculationHash(changed.integration);
    changed.integrationText = JSON.stringify(changed.integration, null, 2) + '\n';
    changed.source_records[notices.INTEGRATION_PATH].sha256 = notices.sha256(changed.integrationText);
  } else if (mutation.kind === 'set_schema') {
    setAtPath(changed.approvalSchema, mutation.path, mutation.value);
    changed.approvalSchemaText = JSON.stringify(changed.approvalSchema, null, 2) + '\n';
    changed.source_records[notices.APPROVAL_SCHEMA_PATH].sha256 = notices.sha256(changed.approvalSchemaText);
  } else if (mutation.kind === 'replace_file') {
    const current = changed.files[mutation.file];
    if (typeof current !== 'string' || !current.includes(mutation.from)) {
      throw new Error(mutation.id + ': integration replacement anchor missing');
    }
    changed.files[mutation.file] = current.replace(mutation.from, mutation.to);
  } else if (mutation.kind === 'append_file') {
    changed.files[mutation.file] += mutation.value;
  } else if (mutation.kind === 'remove_runtime_path') {
    changed.runtime_fixed_paths = changed.runtime_fixed_paths.filter(function (item) {
      return item !== mutation.path;
    });
  } else if (mutation.kind === 'approval_present') {
    changed.approval_artifact_present = true;
  } else {
    throw new Error('Unknown integration mutation kind: ' + mutation.kind);
  }
  return changed;
}

function stageFixtureRoot(root) {
  EXACT_SOURCE_FILES.forEach(function (entry) {
    const destination = path.join(root, entry.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ROOT, entry.path), destination);
  });
}

function runFilesystemFixtures(fixture) {
  let rejected = 0;
  (fixture.filesystem_cases || []).forEach(function (testCase) {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-notice-files-'));
    let external = null;
    try {
      if (testCase.operation === 'intermediate_symlink_escape') {
        external = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-notice-external-'));
        const externalStage = path.join(external, 'staged');
        fs.mkdirSync(externalStage);
        stageFixtureRoot(externalStage);
        fs.symlinkSync(external, path.join(temp, 'escape'), 'dir');
        assertRejected(function () { resolveStagedRoot(temp, 'escape/staged'); }, testCase.id);
        rejected += 1;
        return;
      }
      stageFixtureRoot(temp);
      const target = path.join(temp, testCase.path);
      if (testCase.operation === 'omit') {
        fs.unlinkSync(target);
      } else if (testCase.operation === 'tamper') {
        fs.appendFileSync(target, '\nfixture tamper\n');
      } else if (testCase.operation === 'symlink') {
        const external = path.join(temp, 'external-' + path.basename(testCase.path));
        fs.copyFileSync(target, external);
        fs.unlinkSync(target);
        fs.symlinkSync(path.relative(path.dirname(target), external), target);
      } else if (testCase.operation === 'directory_symlink') {
        const directory = path.dirname(target);
        const externalDirectory = path.join(temp, 'external-directory');
        fs.renameSync(directory, externalDirectory);
        fs.symlinkSync(path.relative(path.dirname(directory), externalDirectory), directory, 'dir');
      } else {
        throw new Error(testCase.id + ': unknown filesystem operation');
      }
      let accepted = false;
      try {
        verifyNoticeFiles(temp);
        accepted = true;
      } catch (_) {
        accepted = false;
      }
      if (accepted) throw new Error(testCase.id + ': unsafe filesystem case was accepted');
      rejected += 1;
    } finally {
      fs.rmSync(temp, { recursive: true, force: true });
      if (external) fs.rmSync(external, { recursive: true, force: true });
    }
  });
  return rejected;
}

function assertRejected(action, id) {
  let rejected = false;
  try { action(); } catch (_) { rejected = true; }
  if (!rejected) throw new Error(id + ': unsafe case was accepted');
}

function run() {
  if (STAGED_INDEX !== -1) {
    const requested = process.argv[STAGED_INDEX + 1];
    if (!requested) throw new Error('--staged requires a staged directory');
    const stagedRoot = resolveStagedRoot(ROOT, requested);
    verifyNoticeFiles(ROOT);
    verifyNoticeFiles(stagedRoot);
    console.log('PASS: staged globe third-party notice integrity (inventory integrity only; no approval)');
    console.log('Review status: not_reviewed');
    console.log('Production approved: false');
    console.log('Release approved: false');
    return;
  }

  const manifestText = readUtf8(MANIFEST_PATH);
  const noticeText = readUtf8(NOTICE_PATH);
  const fixture = JSON.parse(readUtf8(FIXTURE_PATH));
  const manifest = JSON.parse(manifestText);
  const integrationInput = loadIntegrationInput();

  verifyNoticeFiles(ROOT);
  const baselineReport = notices.evaluateThirdPartyNotices({
    manifest: manifest,
    manifestText: manifestText,
    noticeText: noticeText
  });
  const integrationReport = notices.evaluateNoticeIntegration(integrationInput);

  if (baselineReport.status !== 'pass' || integrationReport.status !== 'pass') {
    console.error('FAIL: globe third-party notice evidence or integration did not validate.');
    baselineReport.failures.concat(integrationReport.failures).forEach(function (failure) {
      console.error('- ' + failure.id + ': ' + (failure.message || failure.detail || 'check failed'));
      if (failure.message && failure.detail !== undefined) console.error('  ' + failure.detail);
      if (failure.details !== undefined) console.error('  ' + JSON.stringify(failure.details));
    });
    process.exitCode = 1;
    return;
  }

  assertFixtureBaseline(fixture, baselineReport, integrationReport);

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
  (fixture.integration_mutations || []).forEach(function (mutation) {
    try {
      const changed = applyIntegrationMutation(integrationInput, mutation);
      const report = notices.evaluateNoticeIntegration(changed);
      if (report.status !== 'fail') {
        mutationFailures.push(mutation.id + ': integration mutation unexpectedly passed');
      } else if (!report.failure_ids.includes(mutation.expected_failure)) {
        mutationFailures.push(
          mutation.id + ': expected ' + mutation.expected_failure +
          ', received ' + report.failure_ids.join(', ')
        );
      }
    } catch (error) {
      mutationFailures.push(mutation.id + ': integration fixture execution error: ' + error.message);
    }
  });
  let filesystemRejected = 0;
  try {
    filesystemRejected = runFilesystemFixtures(fixture);
  } catch (error) {
    mutationFailures.push('filesystem fixtures: ' + error.message);
  }

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
  const semanticMutationCount = fixture.mutations.length + (fixture.integration_mutations || []).length;
  console.log('Adversarial semantic mutations rejected: ' + semanticMutationCount + '/' + semanticMutationCount);
  console.log('Adversarial filesystem cases rejected: ' + filesystemRejected + '/' + (fixture.filesystem_cases || []).length);
  console.log('Integration changes recorded: deployment=true, public_ui=true, control_plane=true');
  console.log('Asset rights dispositions unresolved: ' + notices.EXPECTED_ASSET_RIGHTS_ROWS.length);
  console.log('Counsel questions unresolved: ' + manifest.counsel_questions.length);
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error('FAIL: globe third-party notice checker: ' + (error.stack || error.message));
    process.exitCode = 1;
  }
}

module.exports = {
  applyIntegrationMutation: applyIntegrationMutation,
  applyMutation: applyMutation,
  inspectRegularFile: inspectRegularFile,
  loadIntegrationInput: loadIntegrationInput,
  runFilesystemFixtures: runFilesystemFixtures,
  resolveStagedRoot: resolveStagedRoot,
  verifyNoticeFiles: verifyNoticeFiles,
  run: run
};
