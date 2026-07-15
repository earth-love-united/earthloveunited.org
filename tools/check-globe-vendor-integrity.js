#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { evaluateVendorIntegrity } = require('./lib/globe-vendor-integrity');

const ROOT = path.resolve(__dirname, '..');
const REQUIRE_FILE = process.argv.includes('--require-file');
const JSON_ONLY = process.argv.includes('--json');
const PATHS = Object.freeze({
  fetchScript: 'tools/fetch-globe-vendor.sh',
  fixture: 'tools/fixtures/globe-vendor-integrity.json',
  buildDeploy: 'tools/build-deploy.sh',
  ci: '.github/workflows/ci.yml',
  codeowners: '.github/CODEOWNERS',
  climateTruthCi: 'tools/climate-truth-ci.js',
  readme: 'README.md',
  credits: 'CREDITS.md',
  deploymentGuide: 'docs/operations/GO_PUBLIC.md',
  gitignore: '.gitignore',
  app: 'js/app.js',
  globe: 'js/globe.js',
  vendor: 'js/vendor/globe.gl.js',
});

function absolute(relative) { return path.join(ROOT, relative); }
function read(relative) { return fs.readFileSync(absolute(relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }
function sha256(relative) { return crypto.createHash('sha256').update(fs.readFileSync(absolute(relative))).digest('hex'); }
function clone(value) { return structuredClone(value); }
function get(target, dotted) { return dotted.split('.').reduce((node, key) => node[key], target); }
function set(target, dotted, value) {
  const parts = dotted.split('.');
  const key = parts.pop();
  const owner = parts.reduce((node, part) => node[part], target);
  owner[key] = value;
}

function fetchSpec() {
  const run = childProcess.spawnSync('bash', [PATHS.fetchScript, '--print-spec'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
  });
  assert.equal(run.status, 0, `canonical fetcher could not print its spec: ${run.stderr || run.stdout}`);
  return JSON.parse(run.stdout);
}

function vendorTracked() {
  const run = childProcess.spawnSync('git', ['ls-files', '--error-unmatch', '--', PATHS.vendor], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (run.error) return null;
  return run.status === 0;
}

function localVendor() {
  const tracked = vendorTracked();
  const vendorDir = path.dirname(absolute(PATHS.vendor));
  if (fs.existsSync(vendorDir) && fs.lstatSync(vendorDir).isSymbolicLink()) {
    return { exists: true, sha256: null, tracked };
  }
  let stat;
  try {
    stat = fs.lstatSync(absolute(PATHS.vendor));
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false, sha256: null, tracked };
    throw error;
  }
  return { exists: true, sha256: stat.isFile() && !stat.isSymbolicLink() ? sha256(PATHS.vendor) : null, tracked };
}

function exerciseFetcherBehavior(scriptContent) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-globe-vendor-integrity-'));
  const scriptPath = path.join(tempRoot, PATHS.fetchScript);
  const vendorPath = path.join(tempRoot, PATHS.vendor);
  const symlinkTarget = path.join(tempRoot, 'outside-vendor.js');
  const symlinkDirectoryTarget = path.join(tempRoot, 'outside-vendor-directory');
  try {
    fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
    fs.mkdirSync(path.dirname(vendorPath), { recursive: true });
    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });
    fs.writeFileSync(vendorPath, 'intentionally tampered vendor bytes\n');
    const before = crypto.createHash('sha256').update(fs.readFileSync(vendorPath)).digest('hex');
    const run = childProcess.spawnSync('bash', [scriptPath], {
      cwd: tempRoot,
      encoding: 'utf8',
      env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
    });
    const after = fs.existsSync(vendorPath)
      ? crypto.createHash('sha256').update(fs.readFileSync(vendorPath)).digest('hex')
      : null;
    fs.unlinkSync(vendorPath);
    fs.writeFileSync(symlinkTarget, 'external bytes must never become the dependency\n');
    fs.symlinkSync(symlinkTarget, vendorPath);
    const symlinkRun = childProcess.spawnSync('bash', [scriptPath], {
      cwd: tempRoot,
      encoding: 'utf8',
      env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
    });
    const fileSymlinkPreserved = fs.lstatSync(vendorPath).isSymbolicLink();
    fs.unlinkSync(vendorPath);
    fs.rmSync(path.dirname(vendorPath), { recursive: true });
    fs.mkdirSync(symlinkDirectoryTarget, { recursive: true });
    fs.writeFileSync(path.join(symlinkDirectoryTarget, 'globe.gl.js'), 'external directory bytes\n');
    fs.symlinkSync(symlinkDirectoryTarget, path.dirname(vendorPath));
    const directorySymlinkRun = childProcess.spawnSync('bash', [scriptPath], {
      cwd: tempRoot,
      encoding: 'utf8',
      env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' },
    });
    return {
      existing_mismatch_refused: run.status !== 0,
      existing_mismatch_preserved: before === after,
      destination_symlink_refused: symlinkRun.status !== 0 && /symbolic link/.test(`${symlinkRun.stderr}${symlinkRun.stdout}`),
      destination_symlink_preserved: fileSymlinkPreserved,
      destination_directory_symlink_refused: directorySymlinkRun.status !== 0 && /destination directory must not be a symbolic link/.test(`${directorySymlinkRun.stderr}${directorySymlinkRun.stdout}`),
      destination_directory_symlink_preserved: fs.lstatSync(path.dirname(vendorPath)).isSymbolicLink(),
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function loadInput() {
  const fetchScript = read(PATHS.fetchScript);
  return {
    spec: fetchSpec(),
    files: {
      fetch_script: fetchScript,
      build_deploy: read(PATHS.buildDeploy),
      ci: read(PATHS.ci),
      codeowners: read(PATHS.codeowners),
      climate_truth_ci: read(PATHS.climateTruthCi),
      readme: read(PATHS.readme),
      credits: read(PATHS.credits),
      deployment_guide: read(PATHS.deploymentGuide),
      gitignore: read(PATHS.gitignore),
      app: read(PATHS.app),
      globe: read(PATHS.globe),
    },
    vendor: localVendor(),
    fetcher_behavior: exerciseFetcherBehavior(fetchScript),
    require_vendor: REQUIRE_FILE,
  };
}

function applyMutation(input, mutation) {
  if (mutation.operation === 'set') {
    set(input, mutation.path, mutation.value);
  } else if (mutation.operation === 'replace') {
    const current = get(input, mutation.path);
    assert.equal(typeof current, 'string', `${mutation.id}: replacement target must be text`);
    assert.ok(current.includes(mutation.from), `${mutation.id}: replacement source is absent`);
    set(input, mutation.path, current.replace(mutation.from, mutation.to));
  } else if (mutation.operation === 'append') {
    set(input, mutation.path, `${get(input, mutation.path)}${mutation.value}`);
  } else {
    throw new Error(`${mutation.id}: unknown mutation operation ${mutation.operation}`);
  }
  if (mutation.then) set(input, mutation.then.path, mutation.then.value);
}

const input = loadInput();
const report = evaluateVendorIntegrity(input);
const fixture = json(PATHS.fixture);
let rejected = 0;
for (const mutation of fixture.mutations) {
  const changed = clone(input);
  applyMutation(changed, mutation);
  changed.fetcher_behavior = exerciseFetcherBehavior(changed.files.fetch_script);
  const result = evaluateVendorIntegrity(changed);
  assert.equal(result.status, 'fail', `${mutation.id}: unsafe vendor policy mutation was accepted`);
  assert.ok(result.failure_ids.includes(mutation.expected_failure), `${mutation.id}: expected ${mutation.expected_failure}, got ${result.failure_ids.join(', ')}`);
  rejected += 1;
}

if (JSON_ONLY) {
  process.stdout.write(`${JSON.stringify({ ...report, adversarial_mutations_rejected: rejected }, null, 2)}\n`);
} else {
  process.stdout.write([
    `globe.gl vendor integrity: ${report.status.toUpperCase()}`,
    `  pin: globe.gl@${report.version} -> ${report.destination}`,
    `  local file: ${report.local_file_present ? 'present and verified' : report.local_file_required ? 'required but absent' : 'absent; accessible runtime fallback retained'}`,
    `  policy checks: ${report.checks.filter(item => item.pass).length}/${report.checks.length}`,
    `  adversarial mutations rejected: ${rejected}`,
  ].join('\n') + '\n');
  for (const failure of report.checks.filter(item => !item.pass)) {
    process.stderr.write(`  [FAIL] ${failure.id}: ${failure.detail}\n`);
  }
}

if (report.status !== 'pass') process.exitCode = 1;
