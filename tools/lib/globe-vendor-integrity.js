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

function evaluateVendorIntegrity(input) {
  const spec = input?.spec || {};
  const files = input?.files || {};
  const vendor = input?.vendor || { exists: false, sha256: null };
  const checks = [];
  const check = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail });
  const fetchScript = String(files.fetch_script || '');
  const buildDeploy = String(files.build_deploy || '');
  const ci = String(files.ci || '');
  const codeowners = String(files.codeowners || '');
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

  check('deploy-uses-canonical-fetcher', buildDeploy.includes('tools/fetch-globe-vendor.sh') && !buildDeploy.includes(EXPECTED_SPEC.url) && !/curl[^\n]*globe\.gl/.test(buildDeploy),
    'Deployment staging must call the canonical fetcher and contain no direct globe.gl download.');
  check('ci-policy-wired', ci.includes('node tools/check-globe-vendor-integrity.js') && ci.includes('tools/fetch-globe-vendor.sh') && ci.includes('node tools/check-globe-vendor-integrity.js --require-file'),
    'Authoritative CI must check policy and verify the fetched file used by browser tests.');
  check('ci-no-direct-download', !ci.includes(EXPECTED_SPEC.url) && !/curl[^\n]*globe\.gl/.test(ci),
    'CI must not duplicate or bypass the canonical dependency fetcher.');
  check('control-files-owned', [
    '/tools/fetch-globe-vendor.sh',
    '/tools/check-globe-vendor-integrity.js',
    '/tools/lib/globe-vendor-integrity.js',
    '/tools/fixtures/globe-vendor-integrity.json',
  ].every(required => codeowners.includes(`${required} `)),
  'The fetcher, checker, policy, and fixtures must retain maintainer ownership.');
  check('readme-canonical-command', readme.includes('./tools/fetch-globe-vendor.sh') && !readme.includes(EXPECTED_SPEC.url),
    'Quick-start instructions must use the canonical verified fetch command.');
  check('credits-pin', /\*\*Version:\*\*\s+2\.46\.1/.test(credits) && credits.includes(EXPECTED_SPEC.sha256) && credits.includes('./tools/fetch-globe-vendor.sh') && /\*\*License:\*\*\s+MIT/.test(credits),
    'Attribution must state the exact version, digest, command, and licence.');
  check('deployment-contract', deploymentGuide.includes('Build command:** `./tools/build-deploy.sh`') && deploymentGuide.includes('Build output directory:** `_deploy`') && !deploymentGuide.includes('Build command:** *(leave empty)*'),
    'Cloudflare instructions must run verified staging and publish only _deploy.');
  check('vendor-remains-ignored', /^js\/vendor\/$/m.test(gitignore),
    'The generated 1.8 MB dependency must remain gitignored.');
  check('runtime-local-path', app.includes("script.src = 'js/vendor/globe.gl.js';"),
    'The browser must load only the locally verified deployment copy.');
  check('runtime-fallback-preserved', app.includes("safeCall('GlobeModule', 'showFallback', 'library_load_failed')") && globe.includes("EventBus.emit('globe:fallback-shown'"),
    'Missing or unloadable vendor bytes must retain the accessible factual fallback.');

  const localPass = vendor.exists
    ? vendor.sha256 === EXPECTED_SPEC.sha256
    : input?.require_vendor !== true;
  check('local-file-integrity', localPass,
    vendor.exists ? 'Any local dependency file must match the pinned digest.' : 'The file may be absent only when this run does not require deployable vendor bytes.');

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

module.exports = { EXPECTED_SPEC, POLICY_VERSION, digest, evaluateVendorIntegrity, occurrences };
