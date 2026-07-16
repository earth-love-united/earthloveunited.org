'use strict';

const crypto = require('node:crypto');

const POLICY_VERSION = '1.0.0';
const EXPECTED_SPEC = Object.freeze({
  dependency: 'globe.gl',
  version: '2.46.1',
  url: 'https://cdn.jsdelivr.net/npm/globe.gl@2.46.1/dist/globe.gl.min.js',
  sha256: '2ab6767f47e2be0ac346cd7a5eb55d259ea3da06d479dc22f1820ddd698f496a',
  destination: 'js/vendor/globe.gl.js',
  transport: 'https-only',
  install: 'atomic-same-directory-rename',
  existing_mismatch: 'refuse',
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function occurrences(value, needle) {
  if (!needle) return 0;
  return String(value || '').split(needle).length - 1;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ciStepBlocks(ci, name) {
  const lines = String(ci || '').split('\n');
  const namePattern = new RegExp(`^([ \\t]*)- name: ${escapeRegExp(name)}[ \\t]*$`);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(namePattern);
    if (!match) continue;
    const indent = match[1];
    let end = index + 1;
    while (end < lines.length && !lines[end].startsWith(`${indent}- `)) end += 1;
    blocks.push(lines.slice(index, end));
  }
  return blocks;
}

function hasExactCiStep(ci, name, command) {
  const blocks = ciStepBlocks(ci, name);
  if (blocks.length !== 1) return false;
  const runPattern = new RegExp(`^[ \\t]*run: ${escapeRegExp(command)}[ \\t]*$`);
  const runLines = blocks[0].filter(line => runPattern.test(line));
  const disabled = blocks[0].some(line => /^[ \\t]*(?:if|continue-on-error):/.test(line));
  return runLines.length === 1 && !disabled;
}

function hasActiveCiJob(ci, name) {
  const lines = String(ci || '').split('\n');
  const jobPattern = new RegExp(`^([ \\t]+)${escapeRegExp(name)}:[ \\t]*$`);
  const matches = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(jobPattern);
    if (!match) continue;
    const indent = match[1];
    let end = index + 1;
    while (end < lines.length && !new RegExp(`^${escapeRegExp(indent)}[A-Za-z0-9_-]+:[ \\t]*$`).test(lines[end])) end += 1;
    matches.push({ indent, lines: lines.slice(index, end) });
  }
  if (matches.length !== 1) return false;
  const propertyIndent = `${matches[0].indent}  `;
  return !matches[0].lines.some(line =>
    line.startsWith(`${propertyIndent}if:`) || line.startsWith(`${propertyIndent}continue-on-error:`));
}

function hasDirectDownloaderCommand(content) {
  return String(content || '').split('\n').some(rawLine => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return false;
    if (line === 'curl -fsS http://localhost:8000/ >/dev/null && break') return false;
    return /(?:^|[ \\t;|&])(?:curl|wget|fetch)(?=$|[ \\t\\])/.test(line);
  });
}

function hasVendorMutationCommand(content) {
  return String(content || '').split('\n').some(rawLine => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return false;
    const mutates = /(?:^|[ \\t;|&])(?:cp|mv|install|ln|rsync|dd|tee)(?=$|[ \\t\\])/.test(line);
    return mutates && /(?:globe(?:\.gl)?|js\/vendor)/i.test(line);
  });
}

function stripJsComments(content) {
  return String(content || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trimStart().startsWith('//'))
    .join('\n');
}

function evaluateVendorIntegrity(input) {
  const spec = input?.spec || {};
  const files = input?.files || {};
  const vendor = input?.vendor || { exists: false, sha256: null };
  const fetcherBehavior = input?.fetcher_behavior || {};
  const checks = [];
  const check = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });
  const fetchScript = String(files.fetch_script || '');
  const buildDeploy = String(files.build_deploy || '');
  const ci = String(files.ci || '');
  const codeowners = String(files.codeowners || '');
  const climateTruthCi = String(files.climate_truth_ci || '');
  const readme = String(files.readme || '');
  const credits = String(files.credits || '');
  const deploymentGuide = String(files.deployment_guide || '');
  const gitignore = String(files.gitignore || '');
  const app = String(files.app || '');
  const globe = String(files.globe || '');

  check('canonical-spec', Object.entries(EXPECTED_SPEC).every(([key, value]) => spec[key] === value),
    'The fetcher must expose the exact approved globe.gl version, URL, digest, destination, and fail-closed policy.');
  let parsedUrl = null;
  try { parsedUrl = new URL(spec.url); } catch (_) { parsedUrl = null; }
  check('https-source', parsedUrl?.protocol === 'https:' && parsedUrl?.username === '' && parsedUrl?.password === '',
    'The dependency source must be authenticated HTTPS without URL credentials.');
  check('canonical-source-singleton', occurrences(fetchScript, EXPECTED_SPEC.url) === 1 && occurrences(fetchScript, EXPECTED_SPEC.sha256) === 1,
    'The canonical fetch script must contain one source URL and one expected digest.');
  check('atomic-temp-download', fetchScript.includes('TEMP_FILE="$(mktemp "$DEST_DIR/.globe.gl.js.download.XXXXXX")"') && fetchScript.includes('trap cleanup EXIT'),
    'Downloads must use a cleaned-up temporary file in the destination directory.');
  check('https-only-curl', fetchScript.includes("--proto '=https'") && fetchScript.includes("--proto-redir '=https'") && fetchScript.includes('--tlsv1.2'),
    'curl must reject non-HTTPS initial requests and redirects.');
  const tempVerify = fetchScript.indexOf('verify_digest "$TEMP_FILE"');
  const atomicMove = fetchScript.indexOf('mv "$TEMP_FILE" "$DEST_PATH"');
  check('verify-before-install', tempVerify !== -1 && atomicMove !== -1 && tempVerify < atomicMove,
    'The downloaded temporary file must be verified before the atomic rename.');
  check('existing-mismatch-refused', fetchScript.includes('existing vendor file has the wrong digest; refusing to replace it'),
    'An existing mismatched dependency must stop the build instead of being overwritten.');
  check('executable-mismatch-refusal', fetcherBehavior.existing_mismatch_refused === true && fetcherBehavior.existing_mismatch_preserved === true,
    'An isolated execution must reject tampered existing bytes and leave them unchanged.');
  check('destination-symlink-refused',
    fetcherBehavior.destination_symlink_refused === true &&
    fetcherBehavior.destination_symlink_preserved === true &&
    fetcherBehavior.destination_directory_symlink_refused === true &&
    fetcherBehavior.destination_directory_symlink_preserved === true,
    'Isolated executions must identify and refuse symbolic-link destination files and directories without replacing them.');

  const deployDownloaderBypass = hasDirectDownloaderCommand(buildDeploy);
  const deployMutationBypass = hasVendorMutationCommand(buildDeploy);
  check('deploy-uses-canonical-fetcher',
    occurrences(buildDeploy, 'tools/fetch-globe-vendor.sh') === 1 &&
    occurrences(buildDeploy, EXPECTED_SPEC.destination) === 1 &&
    !buildDeploy.includes(EXPECTED_SPEC.url) &&
    !deployDownloaderBypass &&
    !deployMutationBypass,
    'Deployment staging must call the canonical fetcher once and contain no direct globe.gl download or overwrite.');
  check('ci-policy-wired',
    hasActiveCiJob(ci, 'static') &&
    hasActiveCiJob(ci, 'smoke') &&
    hasExactCiStep(ci, 'globe.gl vendor delivery policy', 'node tools/check-globe-vendor-integrity.js') &&
    hasExactCiStep(ci, 'Fetch verified globe.gl runtime dependency', './tools/fetch-globe-vendor.sh') &&
    hasExactCiStep(ci, 'Verify browser-test dependency bytes', 'node tools/check-globe-vendor-integrity.js --require-file'),
    'Authoritative CI must check policy and verify the fetched file used by browser tests.');
  const ciDownloaderBypass = hasDirectDownloaderCommand(ci);
  check('ci-no-direct-download', !ci.includes(EXPECTED_SPEC.url) && !ciDownloaderBypass,
    'CI must not duplicate or bypass the canonical dependency fetcher.');
  const truthComponent = "{ id: 'CT-44-VENDOR', script: 'tools/check-globe-vendor-integrity.js', required: true }";
  const truthComponentMatches = stripJsComments(climateTruthCi).split('\n').filter(line => {
    const candidate = line.trim().replace(/,$/, '');
    return candidate === truthComponent;
  });
  check('truth-ci-required-component', truthComponentMatches.length === 1,
    'Climate truth CI must require the vendor delivery policy as CT-44.');
  check('control-files-owned', [
    '/tools/fetch-globe-vendor.sh',
    '/tools/check-globe-vendor-integrity.js',
    '/tools/lib/globe-vendor-integrity.js',
    '/tools/fixtures/globe-vendor-integrity.json',
    '/tools/climate-truth-ci.js',
  ].every(required => codeowners.includes(`${required} `)),
  'The fetcher, checker, policy, and fixtures must retain maintainer ownership.');
  check('readme-canonical-command', readme.includes('./tools/fetch-globe-vendor.sh') && !readme.includes(EXPECTED_SPEC.url),
    'Quick-start instructions must use the canonical verified fetch command.');
  check('credits-pin', /\*\*Version:\*\*\s+2\.46\.1/.test(credits) && credits.includes(EXPECTED_SPEC.sha256) && credits.includes('./tools/fetch-globe-vendor.sh') && /\*\*License:\*\*\s+MIT/.test(credits),
    'Attribution must state the exact version, digest, command, and licence.');
  check('deployment-contract', deploymentGuide.includes('Build command:** `./tools/build-deploy.sh --release`') && deploymentGuide.includes('Build output directory:** `_deploy`') && !deploymentGuide.includes('Build command:** *(leave empty)*'),
    'Cloudflare instructions must run verified staging and publish only _deploy.');
  check('post-deploy-digest-check',
    deploymentGuide.includes('https://earthloveunited.pages.dev/js/vendor/globe.gl.js') &&
    deploymentGuide.includes(EXPECTED_SPEC.sha256) &&
    deploymentGuide.includes('curl -fsSL') &&
    deploymentGuide.includes('sha256sum "$VENDOR_FILE"') &&
    deploymentGuide.includes('shasum -a 256 "$VENDOR_FILE"') &&
    deploymentGuide.includes('test "$VENDOR_SHA256" ='),
    'The production runbook must verify the deployed response body against the approved digest with portable checksum tooling.');
  check('vendor-remains-ignored', /^js\/vendor\/$/m.test(gitignore),
    'The generated 1.8 MB dependency must remain gitignored.');
  const runtimeScriptCreations = app.match(/\bdocument\s*\.\s*createElement\s*\(\s*['"]script['"]\s*\)/g) || [];
  const runtimeDotAssignments = app.match(/\b[A-Za-z_$][\w$]*\s*\.\s*src\s*(?:=|\|\|=|&&=|\?\?=)/g) || [];
  const runtimeBracketAssignments = app.match(/\[\s*['"]src['"]\s*\]\s*(?:=|\|\|=|&&=|\?\?=)/g) || [];
  const runtimeAttributeAssignments = app.match(/\.\s*setAttribute\s*\(\s*['"]src['"]\s*,/g) || [];
  check('runtime-local-path',
    runtimeScriptCreations.length === 1 &&
    runtimeDotAssignments.length === 1 &&
    runtimeBracketAssignments.length === 0 &&
    runtimeAttributeAssignments.length === 0 &&
    app.includes("script.src = 'js/vendor/globe.gl.js';"),
    'The browser must have exactly one runtime script assignment and it must use the locally verified deployment copy.');
  check('runtime-fallback-preserved', app.includes("safeCall('GlobeModule', 'showFallback', 'library_load_failed')") && globe.includes("EventBus.emit('globe:fallback-shown'"),
    'Missing or unloadable vendor bytes must retain the accessible factual fallback.');

  const localPass = vendor.exists
    ? vendor.sha256 === EXPECTED_SPEC.sha256
    : input?.require_vendor !== true;
  check('local-file-integrity', localPass,
    vendor.exists ? 'Any local dependency file must match the pinned digest.' : 'The file may be absent only when this run does not require deployable vendor bytes.');
  check('vendor-not-tracked', vendor.tracked === false,
    'The generated vendor blob must be proven absent from the Git index.');

  const failures = checks.filter(item => !item.pass);
  const result = {
    policy_version: POLICY_VERSION,
    status: failures.length ? 'fail' : 'pass',
    dependency: EXPECTED_SPEC.dependency,
    version: EXPECTED_SPEC.version,
    destination: EXPECTED_SPEC.destination,
    local_file_present: vendor.exists === true,
    local_file_required: input?.require_vendor === true,
    checks,
    failure_ids: failures.map(item => item.id),
    calculation_hash: null,
  };
  result.calculation_hash = digest(result);
  return result;
}

module.exports = { EXPECTED_SPEC, POLICY_VERSION, digest, evaluateVendorIntegrity, hasActiveCiJob, hasDirectDownloaderCommand, hasExactCiStep, hasVendorMutationCommand, occurrences, stripJsComments };
