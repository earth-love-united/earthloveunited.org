'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { parseJsonNoDuplicateKeys } = require('./json-schema-lite');
const {
  DEPLOYMENT_CONTROL_EXACT_PATHS,
  DEPLOYMENT_CONTROL_PREFIXES,
  isBetaAffectingPath,
  isDeploymentControlPath,
} = require('./climate-public-beta-path-policy');

const REPOSITORY = 'earth-love-united/earthloveunited.org';
const PRODUCT_LABEL = 'Climate Public Beta — harmonized factual emissions evidence, not a climate-performance assessment.';
const MAX_ARTIFACT_BYTES = 26214400;
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const RELEASE_ID = /^(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/;
const GIT_MODE = /^(?:100644|100755)$/;
const ROLLBACK_UNIVERSE_DEFINITION = 'union_of_exact_release_and_baseline_git_file_inventories_v1';
const ROLLBACK_TARGET_DEFINITION = 'exact_beta_release_tree_before_rollback_proof_and_review_v1';
const ROLLBACK_TARGET_TYPES = Object.freeze([
  'access_locked_holding_page',
  'withdrawn_origin',
  'project_access_lock',
]);
const ROLLBACK_POLICY_LEVELS = Object.freeze(['invited_beta', 'public_beta']);

const RUNTIME_FILE_NAMES = Object.freeze({
  country_factual: 'country-factual.json',
  country_identity: 'country-identity.json',
  country_identity_source: 'country-identity.SOURCE.md',
  country_identity_transform: 'country-identity-transform.json',
  fact_lineage: 'fact-lineage.json',
  known_limitations: 'known-limitations.json',
  correction_log: 'correction-log.json',
});

const BETA_UI_PATHS = Object.freeze([
  'climate-public-beta/THIRD_PARTY_NOTICES.txt',
  'climate-public-beta/_headers',
  'climate-public-beta/css/beta.css',
  'climate-public-beta/index.html',
  'climate-public-beta/js/beta.js',
]);

const PUBLIC_FIXED_PATHS = Object.freeze([
  'THIRD_PARTY_NOTICES.txt',
  '_headers',
  'css/beta.css',
  'data/climate/public-beta/runtime/licenses/LGPL-2.1.txt',
  'data/climate/public-beta/runtime/runtime-manifest.json',
  'index.html',
  'js/beta.js',
]);

const GOVERNANCE_RELEASE_BA_FILES = Object.freeze([
  'independent-data-review.json',
  'independent-data-review.signatures.json',
  'independent-package-review.json',
  'independent-package-review.signatures.json',
  'independent-rollback-review.json',
  'independent-rollback-review.signatures.json',
  'independent-ui-accessibility-review.json',
  'independent-ui-accessibility-review.signatures.json',
  'release-diff.json',
  'rollback-proof.json',
  'source-rights-review.json',
  'source-rights-review.signatures.json',
  'ui-accessibility-comprehension-results.json',
]);

const ROLLBACK_POST_TARGET_FILES = Object.freeze([
  'independent-rollback-review.json',
  'independent-rollback-review.signatures.json',
  'rollback-proof.json',
]);

const PACKAGE_SCHEMA_NAMES = Object.freeze([
  'climate-public-beta-access-bootstrap-signatures.schema.json',
  'climate-public-beta-access-bootstrap.schema.json',
  'climate-public-beta-approval.schema.json',
  'climate-public-beta-evidence-signature-bundle.schema.json',
  'climate-public-beta-policy.schema.json',
  'climate-public-beta-review-protocol.schema.json',
  'climate-public-beta-feedback-privacy-contract.schema.json',
  'climate-public-beta-release-diff.schema.json',
  'climate-public-beta-rollback-proof.schema.json',
  'climate-public-beta-runtime-manifest.schema.json',
  'climate-public-beta-scope-manifest.schema.json',
  'climate-public-beta-signed-evidence.schema.json',
  'climate-public-beta-signature-bundle.schema.json',
  'climate-public-beta-trust-registry.schema.json',
  'climate-public-beta-ui-accessibility-results.schema.json',
]);

const REVIEWED_RUNTIME_SCHEMA_PATHS = Object.freeze([
  'data/climate/schemas/public-beta-reviewed-correction-log.schema.json',
  'data/climate/schemas/public-beta-reviewed-country-factual.schema.json',
  'data/climate/schemas/public-beta-reviewed-country-identity-transform.schema.json',
  'data/climate/schemas/public-beta-reviewed-country-identity.schema.json',
  'data/climate/schemas/public-beta-reviewed-fact-lineage.schema.json',
  'data/climate/schemas/public-beta-reviewed-known-limitations.schema.json',
]);

const REQUIRED_DEPLOYMENT_CONTROL_PATHS = Object.freeze([
  '.github/workflows/auto-merge.yml',
  '.github/workflows/ci.yml',
  '_headers',
  'climate-public-beta/_headers',
  'tools/build-climate-public-beta.sh',
  'tools/build-deploy.sh',
  'tools/check-climate-public-beta-diff-boundary.js',
  'tools/check-climate-public-beta-readiness.js',
  'tools/check-public-deploy-surface.js',
  'tools/check-staged-climate-public-beta-integrity.js',
  'tools/check-staged-production-integrity.js',
  'tools/lib/climate-public-beta-diff-boundary.js',
  'tools/lib/public-deploy-surface.js',
  'tools/org-setup.sh',
  'tools/stage-climate-public-beta.js',
  'tools/stage-public-deploy.js',
]);

const BETA_TRANSITIVE_DEPENDENCY_PATHS = Object.freeze([
  'tools/lib/json-schema-lite.js',
  'tools/lib/primap-hist-ingest.js',
]);

const REQUIRED_ENGINEERING_PATHS = Object.freeze([
  '.github/CODEOWNERS',
  '.github/workflows/auto-merge.yml',
  '.github/workflows/ci.yml',
  '.gitignore',
  '_headers',
  'data/climate/fixtures/climate-public-beta-package-adversarial-fixtures.json',
  'data/climate/fixtures/public-beta-assessed-boundary.json',
  'data/climate/fixtures/public-beta-data.json',
  'data/climate/fixtures/public-beta-id-allocations.json',
  'data/climate/schemas/public-beta-country-factual.schema.json',
  'data/climate/schemas/public-beta-country-identity.schema.json',
  'data/climate/schemas/public-beta-fact-lineage.schema.json',
  'tools/build-climate-public-beta.sh',
  'tools/build-deploy.sh',
  'tools/check-climate-public-beta-assessed-boundary.js',
  'tools/check-climate-public-beta-access-bootstrap.js',
  'tools/check-climate-public-beta-data.js',
  'tools/check-climate-public-beta-diff-boundary.js',
  'tools/check-climate-public-beta-governance-contracts.js',
  'tools/check-climate-public-beta-package.js',
  'tools/check-climate-public-beta-policy.js',
  'tools/check-climate-public-beta-browser.mjs',
  'tools/check-climate-public-beta-raw-rebuild.js',
  'tools/check-climate-public-beta-readiness.js',
  'tools/check-climate-public-beta-reviewed-data.js',
  'tools/check-climate-public-beta-surface.js',
  'tools/check-climate-public-beta-ui.js',
  'tools/check-remote-climate-public-beta.js',
  'tools/check-public-deploy-surface.js',
  'tools/check-staged-climate-public-beta-integrity.js',
  'tools/check-staged-production-integrity.js',
  'tools/generate-climate-public-beta-artifacts.js',
  'tools/lib/climate-public-beta-data.js',
  'tools/lib/climate-public-beta-access-bootstrap.js',
  'tools/lib/climate-public-beta-diff-boundary.js',
  'tools/lib/climate-public-beta-governance-contracts.js',
  'tools/lib/climate-public-beta-package.js',
  'tools/lib/climate-public-beta-path-policy.js',
  'tools/lib/climate-public-beta-policy.js',
  'tools/lib/climate-public-beta-remote.js',
  'tools/lib/climate-public-beta-reviewed-data.js',
  'tools/lib/climate-public-beta-surface.js',
  ...BETA_TRANSITIVE_DEPENDENCY_PATHS,
  'tools/lib/public-deploy-surface.js',
  'tools/org-setup.sh',
  'tools/fixtures/climate-public-beta-policy.json',
  'tools/stage-climate-public-beta.js',
  'tools/stage-public-deploy.js',
]);

const BETA_REQUIRE_CLOSURE_ROOT_PATHS = Object.freeze(REQUIRED_ENGINEERING_PATHS.filter(relative =>
  (relative.startsWith('tools/check-climate-public-beta-') && /\.(?:js|mjs)$/.test(relative)) ||
  relative.startsWith('tools/lib/climate-public-beta-') ||
  BETA_TRANSITIVE_DEPENDENCY_PATHS.includes(relative) ||
  [
    'tools/check-remote-climate-public-beta.js',
    'tools/check-staged-climate-public-beta-integrity.js',
    'tools/generate-climate-public-beta-artifacts.js',
    'tools/stage-climate-public-beta.js',
  ].includes(relative)
));

// F deliberately excludes the authority-producing/event-relative and direct
// staging controls. The package branch must introduce this complete set
// together; a partial set is an invalid transition. Self-tests use the
// present foundation closure only when this exact set is wholly absent.
const FOUNDATION_DEFERRED_CLOSURE_ROOT_PATHS = Object.freeze([
  'tools/check-climate-public-beta-diff-boundary.js',
  'tools/check-climate-public-beta-readiness.js',
  'tools/check-staged-climate-public-beta-integrity.js',
  'tools/lib/climate-public-beta-diff-boundary.js',
  'tools/stage-climate-public-beta.js',
]);

// The package reviewer must cover every executable/checker root and every
// recursively reached in-repository CommonJS dependency. The closure self-test
// below proves this static set remains complete as dependencies evolve.
const BETA_PACKAGE_REVIEW_CONTROL_PATHS = Object.freeze(
  [...new Set([...BETA_REQUIRE_CLOSURE_ROOT_PATHS, ...BETA_TRANSITIVE_DEPENDENCY_PATHS])]
    .sort(compareStrings),
);

const POST_ACTION_CHECKS = Object.freeze([
  'all_aliases_access_locked_or_withdrawn',
  'automatic_runtime_bytes_unreachable',
  'cache_withdrawal_confirmed',
  'production_origin_byte_inventory_unchanged',
  'remote_hash_result_recorded_after_action',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value, expected, label) {
  assert(isPlainObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort(compareStrings);
  const wanted = [...expected].sort(compareStrings);
  assert(JSON.stringify(actual) === JSON.stringify(wanted), `${label} keys mismatch`);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort(compareStrings).map(key => [key, stable(value[key])]));
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256Canonical(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value)));
}

function withCalculationHash(value, field = 'calculation_hash') {
  const output = structuredClone(value);
  output[field] = null;
  output[field] = sha256Canonical(output);
  return output;
}

function validateCalculationHash(value, field = 'calculation_hash') {
  assert(SHA256.test(value?.[field] || ''), `${field} must be a lowercase SHA-256`);
  const input = structuredClone(value);
  input[field] = null;
  assert(sha256Canonical(input) === value[field], `${field} mismatch`);
}

function safeRelative(relative) {
  assert(typeof relative === 'string' && relative && !relative.includes('\0') && !relative.includes('\\'), 'unsafe empty or escaped path');
  const normalized = path.posix.normalize(relative);
  assert(normalized === relative && normalized !== '..' && !normalized.startsWith('../') && !path.posix.isAbsolute(normalized), `unsafe path: ${relative}`);
  return normalized;
}

function validateReleaseId(betaReleaseId) {
  assert(typeof betaReleaseId === 'string' && RELEASE_ID.test(betaReleaseId), 'invalid beta release ID');
  return betaReleaseId;
}

function validateProductionIdentity(value, label = 'identity') {
  assert(typeof value === 'string' && value.trim() === value && value.length >= 5 && value.length <= 256 &&
    !/[\u0000-\u001f]/.test(value) &&
    !/(?:^|[\s@._-])(fake|invented|unknown|example|placeholder|tbd|todo)(?:$|[\s@._-])/i.test(value),
  `${label} must be a real, explicit, non-placeholder identity`);
  return value;
}

function validateBuilderIdentity(value) {
  return validateProductionIdentity(value, 'release builder identity');
}

function validateUtcTimestamp(value, label) {
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value),
    `${label} must be a canonical UTC timestamp`);
  const parsed = new Date(value);
  assert(!Number.isNaN(parsed.getTime()) && parsed.toISOString() === value,
    `${label} must be a real canonical UTC timestamp`);
  return parsed.getTime();
}

function assertNoAssessedOrCandidatePath(relative) {
  const normalized = safeRelative(relative);
  assert(!/candidate/i.test(normalized), `candidate path is forbidden in a beta package: ${normalized}`);
  const forbidden = [
    'data/climate/runtime-manifest.json',
    'data/climate/runtime/',
    'data/climate/releases/',
    'assets/globe/runtime/',
    'js/vendor/globe.gl.js',
  ];
  forbidden.forEach(prefix => {
    assert(normalized !== prefix.replace(/\/$/, '') && !normalized.startsWith(prefix), `assessed or globe runtime path is forbidden in a beta package: ${normalized}`);
  });
  return normalized;
}

function assertRealDirectory(root, label = 'root') {
  const absolute = path.resolve(root);
  const stat = fs.lstatSync(absolute);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), `${label} must be a real directory`);
  return absolute;
}

function inspectRegular(root, relative) {
  const normalized = safeRelative(relative);
  const absoluteRoot = assertRealDirectory(root);
  let current = absoluteRoot;
  normalized.split('/').forEach((part, index, parts) => {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    assert(!stat.isSymbolicLink(), `path contains a symlink: ${normalized}`);
    if (index < parts.length - 1) assert(stat.isDirectory(), `path parent is not a directory: ${normalized}`);
    else assert(stat.isFile(), `path is not a regular file: ${normalized}`);
  });
  const bytes = fs.readFileSync(current);
  const mode = fs.lstatSync(current).mode;
  return {
    path: normalized,
    bytes: bytes.length,
    sha256: sha256Bytes(bytes),
    git_mode: (mode & 0o111) === 0 ? '100644' : '100755',
    buffer: bytes,
    absolute: current,
  };
}

function staticRequireSpecifiers(source, label = 'JavaScript source') {
  assert(typeof source === 'string', `${label} must be text`);
  const specifiers = [];
  let cursor = 0;

  function skipString(start) {
    const quote = source[start];
    let index = start + 1;
    while (index < source.length) {
      const character = source[index];
      if (character === '\\') {
        index += 2;
        continue;
      }
      if (character === quote) return index + 1;
      if (character === '\n' || character === '\r') break;
      index += 1;
    }
    throw new Error(`${label} contains an unterminated string literal`);
  }

  function requireString(start) {
    const quote = source[start];
    let index = start + 1;
    let value = '';
    while (index < source.length) {
      const character = source[index];
      if (character === quote) return { value, end: index + 1 };
      assert(character !== '\\', `${label} require() specifiers must not use escapes`);
      assert(character !== '\n' && character !== '\r', `${label} require() specifier is unterminated`);
      value += character;
      index += 1;
    }
    throw new Error(`${label} require() specifier is unterminated`);
  }

  function skipTrivia(start) {
    let index = start;
    while (index < source.length) {
      if (/\s/.test(source[index])) {
        index += 1;
        continue;
      }
      if (source.startsWith('//', index)) {
        const newline = source.indexOf('\n', index + 2);
        return newline === -1 ? source.length : skipTrivia(newline + 1);
      }
      if (source.startsWith('/*', index)) {
        const end = source.indexOf('*/', index + 2);
        assert(end !== -1, `${label} contains an unterminated block comment`);
        index = end + 2;
        continue;
      }
      break;
    }
    return index;
  }

  function canStartRegex(start) {
    let index = start - 1;
    while (index >= 0 && /\s/.test(source[index])) index -= 1;
    if (index < 0 || /[([{:;,=!?&|+*%^~<>-]/.test(source[index])) return true;
    if (!/[A-Za-z0-9_$]/.test(source[index])) return false;
    const end = index + 1;
    while (index >= 0 && /[A-Za-z0-9_$]/.test(source[index])) index -= 1;
    return /^(?:return|case|throw|else|do|yield|await|typeof|delete|void|in|of|instanceof)$/.test(
      source.slice(index + 1, end),
    );
  }

  function skipRegex(start) {
    let index = start + 1;
    let characterClass = false;
    while (index < source.length) {
      const character = source[index];
      if (character === '\\') {
        index += 2;
        continue;
      }
      assert(character !== '\n' && character !== '\r', `${label} contains an unterminated regex literal`);
      if (character === '[') characterClass = true;
      else if (character === ']') characterClass = false;
      else if (character === '/' && !characterClass) {
        index += 1;
        while (index < source.length && /[A-Za-z]/.test(source[index])) index += 1;
        return index;
      }
      index += 1;
    }
    throw new Error(`${label} contains an unterminated regex literal`);
  }

  function scanTemplate() {
    cursor += 1;
    while (cursor < source.length) {
      if (source[cursor] === '\\') {
        cursor += 2;
        continue;
      }
      if (source[cursor] === '`') {
        cursor += 1;
        return;
      }
      if (source.startsWith('${', cursor)) {
        cursor += 2;
        scanCode(true);
        continue;
      }
      cursor += 1;
    }
    throw new Error(`${label} contains an unterminated template literal`);
  }

  function scanCode(stopAtTemplateBrace) {
    let nestedBraces = 0;
    while (cursor < source.length) {
      if (source.startsWith('//', cursor)) {
        const newline = source.indexOf('\n', cursor + 2);
        cursor = newline === -1 ? source.length : newline + 1;
        continue;
      }
      if (source.startsWith('/*', cursor)) {
        const end = source.indexOf('*/', cursor + 2);
        assert(end !== -1, `${label} contains an unterminated block comment`);
        cursor = end + 2;
        continue;
      }
      if (source[cursor] === '/' && canStartRegex(cursor)) {
        cursor = skipRegex(cursor);
        continue;
      }
      if (source[cursor] === '\'' || source[cursor] === '"') {
        cursor = skipString(cursor);
        continue;
      }
      if (source[cursor] === '`') {
        scanTemplate();
        continue;
      }
      if (stopAtTemplateBrace && source[cursor] === '{') {
        nestedBraces += 1;
        cursor += 1;
        continue;
      }
      if (stopAtTemplateBrace && source[cursor] === '}') {
        if (nestedBraces === 0) {
          cursor += 1;
          return;
        }
        nestedBraces -= 1;
        cursor += 1;
        continue;
      }
      if (/[A-Za-z_$]/.test(source[cursor])) {
        const start = cursor;
        cursor += 1;
        while (cursor < source.length && /[A-Za-z0-9_$]/.test(source[cursor])) cursor += 1;
        if (source.slice(start, cursor) !== 'require') continue;
        let call = skipTrivia(cursor);
        if (source[call] !== '(') continue;
        call = skipTrivia(call + 1);
        if (source[call] !== '\'' && source[call] !== '"') {
          throw new Error(`${label} contains a dynamic require(); local dependency closure must be static`);
        }
        const parsed = requireString(call);
        const close = skipTrivia(parsed.end);
        assert(source[close] === ')', `${label} contains a non-canonical require() call`);
        specifiers.push(parsed.value);
        cursor = close + 1;
        continue;
      }
      cursor += 1;
    }
    assert(!stopAtTemplateBrace, `${label} contains an unterminated template expression`);
  }

  scanCode(false);
  return specifiers;
}

function resolveRelativeRequire(root, importer, specifier) {
  assert(typeof specifier === 'string' && (specifier.startsWith('./') || specifier.startsWith('../')),
    `local dependency specifier is not relative: ${String(specifier)}`);
  const unresolved = safeRelative(path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier)));
  const extension = path.posix.extname(unresolved);
  const candidates = extension
    ? [unresolved]
    : [unresolved, `${unresolved}.js`, `${unresolved}.cjs`, `${unresolved}.mjs`, `${unresolved}/index.js`];
  for (const candidate of candidates) {
    const absolute = path.join(path.resolve(root), candidate);
    if (!fs.existsSync(absolute)) continue;
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile()) continue;
    assert(!stat.isSymbolicLink(), `local dependency is a symlink: ${candidate}`);
    assert(/\.(?:js|cjs|mjs)$/.test(candidate), `unsupported local dependency type: ${candidate}`);
    inspectRegular(root, candidate);
    return candidate;
  }
  throw new Error(`unresolved local dependency from ${importer}: ${specifier}`);
}

function betaRequireClosure(root, roots = BETA_REQUIRE_CLOSURE_ROOT_PATHS) {
  const queue = [...new Set(roots.map(safeRelative))].sort(compareStrings);
  const seen = new Set();
  const edges = [];
  while (queue.length) {
    const importer = queue.shift();
    if (seen.has(importer)) continue;
    const record = inspectRegular(root, importer);
    assert(/\.(?:js|cjs|mjs)$/.test(importer), `require-closure root is not JavaScript: ${importer}`);
    const source = record.buffer.toString('utf8');
    assert(Buffer.byteLength(source, 'utf8') === record.buffer.length && !source.includes('\uFFFD'),
      `require-closure source is not valid UTF-8: ${importer}`);
    seen.add(importer);
    staticRequireSpecifiers(source, importer).forEach(specifier => {
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) return;
      const dependency = resolveRelativeRequire(root, importer, specifier);
      edges.push({ importer, specifier, dependency });
      if (!seen.has(dependency)) queue.push(dependency);
    });
    queue.sort(compareStrings);
  }
  const files = [...seen].sort(compareStrings);
  const unclassified = files.filter(relative => !isBetaAffectingPath(relative));
  assert(unclassified.length === 0,
    `beta relative-require closure contains unclassified paths: ${unclassified.join(', ')}`);
  const outsideEngineeringMinimum = files.filter(relative => !REQUIRED_ENGINEERING_PATHS.includes(relative));
  assert(outsideEngineeringMinimum.length === 0,
    `beta relative-require closure is outside REQUIRED_ENGINEERING_PATHS: ${outsideEngineeringMinimum.join(', ')}`);
  return {
    roots: [...new Set(roots)].sort(compareStrings),
    files,
    edges: edges.sort((left, right) => compareStrings(
      `${left.importer}\0${left.dependency}`,
      `${right.importer}\0${right.dependency}`,
    )),
  };
}

function listRegularFiles(root, relativeDirectory) {
  const directory = safeRelative(relativeDirectory);
  const absoluteRoot = assertRealDirectory(root);
  const absoluteStart = path.join(absoluteRoot, directory);
  const startStat = fs.lstatSync(absoluteStart);
  assert(startStat.isDirectory() && !startStat.isSymbolicLink(), `scope directory must be real: ${directory}`);
  const output = [];
  function visit(absolute, relative) {
    fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => compareStrings(a.name, b.name)).forEach(entry => {
      const childRelative = safeRelative(path.posix.join(relative, entry.name));
      const childAbsolute = path.join(absolute, entry.name);
      const stat = fs.lstatSync(childAbsolute);
      assert(!stat.isSymbolicLink(), `scope path contains a symlink: ${childRelative}`);
      if (stat.isDirectory()) visit(childAbsolute, childRelative);
      else {
        assert(stat.isFile(), `scope path is not regular: ${childRelative}`);
        output.push(childRelative);
      }
    });
  }
  visit(absoluteStart, directory);
  return output.sort(compareStrings);
}

function discoverDeploymentControlPaths(root) {
  const absoluteRoot = assertRealDirectory(root, 'repository root');
  const workflowDirectory = path.join(absoluteRoot, '.github/workflows');
  const workflowFiles = fs.existsSync(workflowDirectory)
    ? listRegularFiles(absoluteRoot, '.github/workflows')
    : [];
  const optionalDeploymentDirectories = DEPLOYMENT_CONTROL_PREFIXES
    .map(prefix => prefix.replace(/\/$/, ''))
    .filter(directory => directory !== '.github/workflows')
    .flatMap(directory => {
      const absolute = path.join(absoluteRoot, directory);
      if (!fs.existsSync(absolute)) return [];
      return listRegularFiles(absoluteRoot, directory);
    });
  const exactDeploymentFiles = DEPLOYMENT_CONTROL_EXACT_PATHS.filter(relative => {
    const absolute = path.join(absoluteRoot, relative);
    if (!fs.existsSync(absolute)) return false;
    inspectRegular(absoluteRoot, relative);
    return true;
  });
  return [...new Set([
    ...workflowFiles,
    ...optionalDeploymentDirectories,
    ...exactDeploymentFiles,
  ].filter(isDeploymentControlPath))].sort(compareStrings);
}

function assertExactList(actual, expected, label) {
  const left = [...actual].sort(compareStrings);
  const right = [...expected].sort(compareStrings);
  assert(JSON.stringify(left) === JSON.stringify(right), `${label} exact path set mismatch`);
}

function assertDirectShape(root, relativeDirectory, expectedFiles, expectedDirectories, label, allowedExtraDirectory) {
  const directory = safeRelative(relativeDirectory);
  const absolute = path.join(assertRealDirectory(root), directory);
  const stat = fs.lstatSync(absolute);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), `${label} must be a real directory`);
  const files = [];
  const directories = [];
  fs.readdirSync(absolute, { withFileTypes: true }).forEach(entry => {
    const child = path.posix.join(directory, entry.name);
    const childStat = fs.lstatSync(path.join(absolute, entry.name));
    assert(!childStat.isSymbolicLink(), `${label} contains a symlink: ${child}`);
    if (childStat.isFile()) files.push(entry.name);
    else if (childStat.isDirectory()) directories.push(entry.name);
    else throw new Error(`${label} contains a non-regular entry: ${child}`);
  });
  assertExactList(files, expectedFiles, `${label} files`);
  const unexpectedDirectories = directories.filter(name => !expectedDirectories.includes(name) && !(allowedExtraDirectory && allowedExtraDirectory(name)));
  const missingDirectories = expectedDirectories.filter(name => !directories.includes(name));
  assert(unexpectedDirectories.length === 0 && missingDirectories.length === 0,
    `${label} directory set mismatch${missingDirectories.length ? `; missing ${missingDirectories.join(', ')}` : ''}${unexpectedDirectories.length ? `; unexpected ${unexpectedDirectories.join(', ')}` : ''}`);
}

function httpsUrlOrNull(value, label) {
  if (value === null) return null;
  assert(typeof value === 'string', `${label} must be an HTTPS URL or null`);
  let parsed;
  try { parsed = new URL(value); } catch (_) { throw new Error(`${label} is not a URL`); }
  assert(parsed.protocol === 'https:' && !parsed.username && !parsed.password, `${label} must be a credential-free HTTPS URL`);
  return parsed.href;
}

function canonicalHttpsOrigin(value, label) {
  assert(typeof value === 'string', `${label} must be a canonical HTTPS origin`);
  let parsed;
  try { parsed = new URL(value); } catch (_) { throw new Error(`${label} is not a URL`); }
  assert(parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
    parsed.pathname === '/' && !parsed.search && !parsed.hash && parsed.origin === value,
  `${label} must be a canonical credential-free HTTPS origin`);
  return value;
}

function validateOperationalReference(value, label) {
  assert(typeof value === 'string' && value.trim() === value && value.length >= 5 && value.length <= 512 &&
    !/[\u0000-\u001f]/.test(value) &&
    !/(?:^|[\s@._-])(fake|invented|unknown|example|placeholder|tbd|todo)(?:$|[\s@._-])/i.test(value),
  `${label} must be a real, explicit, non-placeholder reference`);
  return value;
}

function releaseRuntimeRoot(betaReleaseId) {
  return `data/climate/public-beta/runtime/releases/${validateReleaseId(betaReleaseId)}`;
}

function runtimeReleasePaths(betaReleaseId) {
  const root = releaseRuntimeRoot(betaReleaseId);
  return Object.values(RUNTIME_FILE_NAMES).map(name => `${root}/${name}`).sort(compareStrings);
}

function expectedPublicSurfacePaths(betaReleaseId) {
  return [...PUBLIC_FIXED_PATHS, ...runtimeReleasePaths(betaReleaseId)].sort(compareStrings);
}

function validateRuntimeManifest(manifest, options = {}) {
  exactKeys(manifest, [
    'schema_version', 'manifest_id', 'beta_release_id', 'product_tier', 'product_label',
    'content_state', 'independent_review_state', 'assessed_production_authority',
    'official_inventory', 'climate_performance_assessment', 'scope', 'feedback', 'files',
  ], 'runtime manifest');
  const betaReleaseId = validateReleaseId(manifest.beta_release_id);
  assert(manifest.schema_version === '1.0.0', 'runtime manifest schema version mismatch');
  assert(manifest.manifest_id === `elu-climate-public-beta-runtime-${betaReleaseId}`, 'runtime manifest ID does not bind the beta release ID');
  assert(manifest.product_tier === 'climate_public_beta' && manifest.product_label === PRODUCT_LABEL, 'runtime manifest beta product boundary mismatch');
  assert(['reviewed_beta_release', 'withheld', 'withdrawn'].includes(manifest.content_state), 'runtime manifest content state is invalid');
  assert(['reviewed', 'superseded'].includes(manifest.independent_review_state), 'runtime manifest independent review state is invalid');
  if (options.allowNonPublicationLifecycle !== true) {
    assert(manifest.content_state === 'reviewed_beta_release',
      'runtime manifest is not publication-eligible: content_state must be reviewed_beta_release');
    assert(manifest.independent_review_state === 'reviewed',
      'runtime manifest is not publication-eligible: independent_review_state must be reviewed');
  }
  assert(manifest.assessed_production_authority === false && manifest.official_inventory === false && manifest.climate_performance_assessment === false,
    'runtime manifest must grant no assessed, official-inventory, or performance-assessment authority');

  exactKeys(manifest.scope, ['source_id', 'source_version', 'display_years', 'counts', 'metric_id', 'unit', 'comparison_year'], 'runtime scope');
  assert(manifest.scope.source_id === 'primap-hist-2.6.1-final' && manifest.scope.source_version === '2.6.1 final, 13 March 2025', 'runtime source pin mismatch');
  exactKeys(manifest.scope.display_years, ['start', 'end'], 'runtime display years');
  assert(manifest.scope.display_years.start === 2014 && manifest.scope.display_years.end === 2023, 'runtime display years mismatch');
  exactKeys(manifest.scope.counts, ['registry_entities', 'factual_series', 'source_gaps', 'observations'], 'runtime counts');
  assert(manifest.scope.counts.registry_entities === 249 && manifest.scope.counts.factual_series === 206 &&
    manifest.scope.counts.source_gaps === 43 && manifest.scope.counts.observations === 2060, 'runtime coverage counts mismatch');
  assert(manifest.scope.metric_id === 'annual_economy_wide_ghg_excluding_lulucf' && manifest.scope.unit === 'MtCO2e/yr' &&
    manifest.scope.comparison_year === 2023, 'runtime metric boundary mismatch');

  exactKeys(manifest.feedback, ['approved_feedback_url', 'privacy_notice_url'], 'runtime feedback');
  httpsUrlOrNull(manifest.feedback.approved_feedback_url, 'approved feedback URL');
  httpsUrlOrNull(manifest.feedback.privacy_notice_url, 'feedback privacy URL');

  exactKeys(manifest.files, Object.keys(RUNTIME_FILE_NAMES), 'runtime files');
  const root = releaseRuntimeRoot(betaReleaseId);
  Object.entries(RUNTIME_FILE_NAMES).forEach(([key, filename]) => {
    const entry = manifest.files[key];
    exactKeys(entry, ['path', 'sha256', 'bytes'], `runtime file ${key}`);
    assert(entry.path === `${root}/${filename}`, `runtime file path mismatch: ${key}`);
    assert(SHA256.test(entry.sha256 || ''), `runtime file SHA-256 is invalid: ${key}`);
    assert(Number.isInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= MAX_ARTIFACT_BYTES, `runtime file byte count is invalid: ${key}`);
    assertNoAssessedOrCandidatePath(entry.path);
    if (options.root) {
      const actual = inspectRegular(options.root, entry.path);
      assert(actual.sha256 === entry.sha256, `runtime file hash mismatch: ${entry.path}`);
      assert(actual.bytes === entry.bytes, `runtime file byte count mismatch: ${entry.path}`);
    }
  });
  return { status: 'pass', beta_release_id: betaReleaseId, file_count: 7, level_neutral: true };
}

function scopeSelfPath(betaReleaseId) {
  return `data/climate/public-beta/governance/releases/${validateReleaseId(betaReleaseId)}/scope-manifest.json`;
}

function laterApprovalPaths(betaReleaseId) {
  const root = `data/climate/public-beta/governance/releases/${validateReleaseId(betaReleaseId)}/approvals`;
  return [
    `${root}/invited-beta.json`,
    `${root}/invited-beta.signatures.json`,
    `${root}/public-beta.json`,
    `${root}/public-beta.signatures.json`,
  ].sort(compareStrings);
}

function requiredBaPaths(betaReleaseId) {
  const release = validateReleaseId(betaReleaseId);
  const governanceRoot = `data/climate/public-beta/governance/releases/${release}`;
  return [...new Set([
    ...BETA_UI_PATHS,
    ...PACKAGE_SCHEMA_NAMES.map(name => `data/climate/public-beta/schemas/${name}`),
    ...REVIEWED_RUNTIME_SCHEMA_PATHS,
    'data/climate/public-beta/runtime/licenses/LGPL-2.1.txt',
    'data/climate/public-beta/runtime/runtime-manifest.json',
    ...runtimeReleasePaths(release),
    'data/climate/public-beta/governance/approval-trust.json',
    'data/climate/public-beta/governance/feedback-privacy-contract.json',
    'data/climate/public-beta/governance/policy.json',
    'data/climate/public-beta/governance/public-surface-manifest.json',
    'data/climate/public-beta/governance/review-protocol.json',
    ...GOVERNANCE_RELEASE_BA_FILES.map(name => `${governanceRoot}/${name}`),
    ...REQUIRED_ENGINEERING_PATHS,
  ])].sort(compareStrings);
}

function rollbackPostTargetPaths(betaReleaseId) {
  const governanceRoot = `data/climate/public-beta/governance/releases/${validateReleaseId(betaReleaseId)}`;
  return ROLLBACK_POST_TARGET_FILES.map(name => `${governanceRoot}/${name}`).sort(compareStrings);
}

function requiredRollbackTargetPaths(betaReleaseId) {
  const excluded = new Set(rollbackPostTargetPaths(betaReleaseId));
  return requiredBaPaths(betaReleaseId).filter(item => !excluded.has(item));
}

function discoverBaScopePaths(root, betaReleaseId, options = {}) {
  const release = validateReleaseId(betaReleaseId);
  const preRollbackProof = options.phase === 'pre_rollback_proof';
  assert(!options.phase || preRollbackProof, 'unknown beta package discovery phase');
  assertRealDirectory(root, 'repository root');

  assertDirectShape(root, 'data/climate/public-beta', [], ['governance', 'runtime', 'schemas'], 'public-beta package root');
  assertDirectShape(root, 'data/climate/public-beta/runtime', ['runtime-manifest.json'], ['licenses', 'releases'], 'public-beta runtime root');
  assertDirectShape(root, 'data/climate/public-beta/runtime/releases', [], [release], 'public-beta runtime releases', name => RELEASE_ID.test(name));
  assertDirectShape(root, releaseRuntimeRoot(release), Object.values(RUNTIME_FILE_NAMES), [], 'selected immutable public-beta runtime release');
  assertDirectShape(root, 'data/climate/public-beta/governance', [
    'approval-trust.json', 'feedback-privacy-contract.json', 'policy.json',
    'public-surface-manifest.json', 'review-protocol.json',
  ], ['releases'], 'public-beta governance root');
  assertDirectShape(root, 'data/climate/public-beta/governance/releases', [], [release], 'public-beta governance releases', name => RELEASE_ID.test(name));
  const governanceRoot = `data/climate/public-beta/governance/releases/${release}`;
  const postTarget = new Set(ROLLBACK_POST_TARGET_FILES);
  const governanceDirectFiles = GOVERNANCE_RELEASE_BA_FILES.filter(name => !preRollbackProof || !postTarget.has(name));
  if (!preRollbackProof && fs.existsSync(path.join(path.resolve(root), scopeSelfPath(release)))) governanceDirectFiles.push('scope-manifest.json');
  assertDirectShape(root, governanceRoot, governanceDirectFiles, [], 'selected public-beta release governance',
    name => !preRollbackProof && name === 'approvals');

  assertDirectShape(root, 'climate-public-beta', ['THIRD_PARTY_NOTICES.txt', '_headers', 'index.html'], ['css', 'js'], 'dedicated beta UI root');
  assertDirectShape(root, 'climate-public-beta/css', ['beta.css'], [], 'dedicated beta UI styles');
  assertDirectShape(root, 'climate-public-beta/js', ['beta.js'], [], 'dedicated beta UI scripts');

  assertExactList(listRegularFiles(root, 'climate-public-beta'), BETA_UI_PATHS, 'dedicated beta UI');

  const schemaFiles = listRegularFiles(root, 'data/climate/public-beta/schemas');
  assert(schemaFiles.every(item => item.endsWith('.schema.json')), 'public-beta schema directory contains a non-schema file');
  assertDirectShape(root, 'data/climate/public-beta/schemas', schemaFiles.map(item => path.posix.basename(item)), [], 'public-beta package schemas');

  const releaseFiles = listRegularFiles(root, releaseRuntimeRoot(release));
  assertExactList(releaseFiles, runtimeReleasePaths(release), 'immutable runtime release');
  const licenseFiles = listRegularFiles(root, 'data/climate/public-beta/runtime/licenses');
  assertExactList(licenseFiles, ['data/climate/public-beta/runtime/licenses/LGPL-2.1.txt'], 'beta runtime licenses');

  const governanceFiles = listRegularFiles(root, governanceRoot);
  const excluded = new Set(preRollbackProof ? [] : [...laterApprovalPaths(release), scopeSelfPath(release)]);
  const scopedGovernance = governanceFiles.filter(item => !excluded.has(item));
  const expectedGovernance = governanceDirectFiles
    .filter(name => name !== 'scope-manifest.json')
    .map(name => `${governanceRoot}/${name}`);
  assertExactList(scopedGovernance, expectedGovernance, 'beta release governance');
  governanceFiles.forEach(item => {
    assert(expectedGovernance.includes(item) || excluded.has(item), `unrecognized beta release governance path: ${item}`);
  });

  const preparationSchemas = fs.readdirSync(path.join(path.resolve(root), 'data/climate/schemas'), { withFileTypes: true })
    .filter(entry => entry.name.startsWith('public-beta-'))
    .map(entry => {
      assert(entry.isFile() && !entry.isSymbolicLink(), `beta preparation schema is not a regular file: ${entry.name}`);
      return `data/climate/schemas/${entry.name}`;
    }).sort(compareStrings);

  const fixtureFiles = fs.readdirSync(path.join(path.resolve(root), 'data/climate/fixtures'), { withFileTypes: true })
    .filter(entry => entry.name.includes('public-beta'))
    .map(entry => {
      assert(entry.isFile() && !entry.isSymbolicLink(), `beta fixture is not a regular file: ${entry.name}`);
      return `data/climate/fixtures/${entry.name}`;
    }).sort(compareStrings);

  function matchingRegular(directory, predicate) {
    return fs.readdirSync(path.join(path.resolve(root), directory), { withFileTypes: true })
      .filter(entry => predicate(entry.name))
      .map(entry => {
        assert(entry.isFile() && !entry.isSymbolicLink(), `beta engineering path is not a regular file: ${directory}/${entry.name}`);
        return `${directory}/${entry.name}`;
      }).sort(compareStrings);
  }
  const toolFiles = matchingRegular('tools', name => isBetaAffectingPath(`tools/${name}`));
  const libraryFiles = matchingRegular('tools/lib', name => isBetaAffectingPath(`tools/lib/${name}`));
  const toolFixtureFiles = matchingRegular('tools/fixtures', name => name.includes('climate-public-beta'));
  const requiredEngineeringFiles = REQUIRED_ENGINEERING_PATHS.map(relative => {
    inspectRegular(root, relative);
    return relative;
  });
  const workflowFiles = listRegularFiles(root, '.github/workflows');
  const deploymentControlFiles = discoverDeploymentControlPaths(root);

  const paths = [...new Set([
    ...BETA_UI_PATHS,
    ...schemaFiles,
    'data/climate/public-beta/runtime/runtime-manifest.json',
    ...licenseFiles,
    ...releaseFiles,
    'data/climate/public-beta/governance/policy.json',
    'data/climate/public-beta/governance/public-surface-manifest.json',
    'data/climate/public-beta/governance/approval-trust.json',
    'data/climate/public-beta/governance/feedback-privacy-contract.json',
    'data/climate/public-beta/governance/review-protocol.json',
    ...scopedGovernance,
    ...preparationSchemas,
    ...fixtureFiles,
    ...toolFiles,
    ...libraryFiles,
    ...toolFixtureFiles,
    ...requiredEngineeringFiles,
    '.github/CODEOWNERS',
    '.gitignore',
    ...deploymentControlFiles,
    ...workflowFiles,
  ])].sort(compareStrings);
  const minimum = preRollbackProof ? requiredRollbackTargetPaths(release) : requiredBaPaths(release);
  const missing = minimum.filter(item => !paths.includes(item));
  assert(missing.length === 0, `canonical BA scope is missing required paths: ${missing.join(', ')}`);
  const missingDeploymentControls = deploymentControlFiles.filter(item => !paths.includes(item));
  assert(missingDeploymentControls.length === 0,
    `canonical BA scope is missing deployment controls: ${missingDeploymentControls.join(', ')}`);
  paths.forEach(assertNoAssessedOrCandidatePath);
  return paths;
}

function discoverRollbackTargetPaths(root, betaReleaseId) {
  return discoverBaScopePaths(root, betaReleaseId, { phase: 'pre_rollback_proof' });
}

function buildScopeManifest({ root, betaReleaseId, releaseBuilderIdentity }) {
  const release = validateReleaseId(betaReleaseId);
  const builder = validateBuilderIdentity(releaseBuilderIdentity);
  const files = discoverBaScopePaths(root, release).map(relative => {
    const inspected = inspectRegular(root, relative);
    return { path: relative, sha256: inspected.sha256, bytes: inspected.bytes };
  });
  return withCalculationHash({
    schema_version: '1.0.0',
    scope_id: `elu-climate-public-beta-ba-scope-${release}`,
    beta_release_id: release,
    repository: REPOSITORY,
    scope_phase: 'beta_commit_a_package',
    release_builder_identity: builder,
    assessed_production_authority: false,
    self_path: scopeSelfPath(release),
    excluded_later_authority_paths: laterApprovalPaths(release),
    files,
    scope_hash: null,
  }, 'scope_hash');
}

function validateScopeManifest(manifest, options = {}) {
  exactKeys(manifest, [
    'schema_version', 'scope_id', 'beta_release_id', 'repository', 'scope_phase',
    'release_builder_identity', 'assessed_production_authority', 'self_path', 'excluded_later_authority_paths',
    'files', 'scope_hash',
  ], 'BA scope manifest');
  const release = validateReleaseId(manifest.beta_release_id);
  assert(manifest.schema_version === '1.0.0' && manifest.scope_id === `elu-climate-public-beta-ba-scope-${release}`,
    'BA scope manifest identity mismatch');
  assert(manifest.repository === REPOSITORY && manifest.scope_phase === 'beta_commit_a_package', 'BA scope repository or phase mismatch');
  validateBuilderIdentity(manifest.release_builder_identity);
  assert(manifest.assessed_production_authority === false, 'BA scope cannot grant assessed production authority');
  assert(manifest.self_path === scopeSelfPath(release), 'BA scope self path mismatch');
  assertExactList(manifest.excluded_later_authority_paths, laterApprovalPaths(release), 'later level-specific authority exclusions');
  validateCalculationHash(manifest, 'scope_hash');
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, 'BA scope files must be non-empty');
  const seen = new Set();
  manifest.files.forEach((entry, index) => {
    exactKeys(entry, ['path', 'sha256', 'bytes'], `BA scope file ${index}`);
    const relative = assertNoAssessedOrCandidatePath(entry.path);
    assert(!seen.has(relative), `duplicate BA scope path: ${relative}`);
    seen.add(relative);
    assert(SHA256.test(entry.sha256 || ''), `invalid BA scope SHA-256: ${relative}`);
    assert(Number.isInteger(entry.bytes) && entry.bytes > 0, `invalid BA scope byte count: ${relative}`);
    if (index > 0) assert(compareStrings(manifest.files[index - 1].path, relative) < 0, 'BA scope paths must be strictly sorted');
  });
  assert(!seen.has(manifest.self_path), 'BA scope manifest must not self-pin');
  manifest.excluded_later_authority_paths.forEach(item => assert(!seen.has(item), `later authority path must not be in BA scope: ${item}`));
  if (options.root) {
    const expected = buildScopeManifest({
      root: options.root,
      betaReleaseId: release,
      releaseBuilderIdentity: manifest.release_builder_identity,
    });
    assert(canonicalJson(expected) === canonicalJson(manifest), 'BA scope does not match the exact repository bytes');
    if (options.requireSelfFile !== false) {
      const own = inspectRegular(options.root, manifest.self_path);
      let parsed;
      try {
        parsed = parseJsonNoDuplicateKeys(own.buffer.toString('utf8'), 'BA scope self file');
      } catch (_) { throw new Error('BA scope self file is not strict JSON'); }
      assert(canonicalJson(parsed) === canonicalJson(manifest), 'BA scope self file does not match the validated manifest');
    }
  }
  return { status: 'pass', beta_release_id: release, file_count: manifest.files.length, scope_hash: manifest.scope_hash };
}

function normalizeSurfaceSnapshot(entries, betaReleaseId, label = 'public surface snapshot') {
  const release = validateReleaseId(betaReleaseId);
  assert(Array.isArray(entries), `${label} must be an array`);
  const normalized = entries.map((entry, index) => {
    exactKeys(entry, ['path', 'sha256'], `${label} entry ${index}`);
    const relative = assertNoAssessedOrCandidatePath(entry.path);
    assert(SHA256.test(entry.sha256 || ''), `${label} SHA-256 is invalid: ${relative}`);
    return { path: relative, sha256: entry.sha256 };
  }).sort((left, right) => compareStrings(left.path, right.path));
  assert(new Set(normalized.map(item => item.path)).size === normalized.length, `${label} contains duplicate paths`);
  assertExactList(normalized.map(item => item.path), expectedPublicSurfacePaths(release), label);
  return normalized;
}

function surfaceSnapshotFromManifest(surfaceManifest) {
  assert(isPlainObject(surfaceManifest), 'public-surface manifest must be an object');
  const release = validateReleaseId(surfaceManifest.beta_release_id);
  assert(Array.isArray(surfaceManifest.files), 'public-surface manifest files must be an array');
  return normalizeSurfaceSnapshot(surfaceManifest.files.map((entry, index) => {
    assert(isPlainObject(entry), `public-surface manifest file ${index} must be an object`);
    return { path: entry.destination_path, sha256: entry.sha256 };
  }), release, 'public-surface manifest snapshot');
}

function computeHashChanges(beforeEntries, afterEntries) {
  const before = new Map(beforeEntries.map(item => [item.path, item.sha256]));
  const after = new Map(afterEntries.map(item => [item.path, item.sha256]));
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort(compareStrings);
  return paths.flatMap(relative => {
    const beforeHash = before.get(relative) || null;
    const afterHash = after.get(relative) || null;
    if (beforeHash === afterHash) return [];
    const change = beforeHash === null ? 'added' : afterHash === null ? 'removed' : 'modified';
    return [{ path: relative, change, before_sha256: beforeHash, after_sha256: afterHash }];
  });
}

function summarizeChanges(changes) {
  const summary = { added: 0, modified: 0, removed: 0, total: changes.length };
  changes.forEach(entry => { summary[entry.change] += 1; });
  return summary;
}

function computeReleaseDiff({ betaReleaseId, previousBetaReleaseId = null, currentFiles, previousFiles = [] }) {
  const release = validateReleaseId(betaReleaseId);
  const initial = previousBetaReleaseId === null;
  let prior = null;
  if (!initial) {
    prior = validateReleaseId(previousBetaReleaseId);
    assert(prior !== release, 'a later beta release must use a new immutable release ID');
  }
  const current = normalizeSurfaceSnapshot(currentFiles, release, 'current public surface snapshot');
  let previous = [];
  if (initial) assert(Array.isArray(previousFiles) && previousFiles.length === 0, 'initial beta diff must use the no-prior-beta empty baseline');
  else previous = normalizeSurfaceSnapshot(previousFiles, prior, 'prior public surface snapshot');
  const changes = computeHashChanges(previous, current);
  assert(changes.length > 0, 'beta release diff must contain at least one exact byte change');
  return withCalculationHash({
    schema_version: '1.0.0',
    diff_id: `elu-climate-public-beta-public-surface-diff-${release}`,
    beta_release_id: release,
    previous_beta_release_id: prior,
    initial_release: initial,
    baseline_kind: initial ? 'no_prior_beta' : 'prior_immutable_beta_release',
    comparison_surface: 'exact_dedicated_beta_public_surface',
    assessed_production_authority: false,
    changes,
    summary: summarizeChanges(changes),
    calculation_hash: null,
  });
}

function validateReleaseDiff(diff) {
  exactKeys(diff, [
    'schema_version', 'diff_id', 'beta_release_id', 'previous_beta_release_id',
    'initial_release', 'baseline_kind', 'comparison_surface',
    'assessed_production_authority', 'changes', 'summary', 'calculation_hash',
  ], 'beta release diff');
  const release = validateReleaseId(diff.beta_release_id);
  assert(diff.schema_version === '1.0.0' && diff.diff_id === `elu-climate-public-beta-public-surface-diff-${release}`, 'beta release diff identity mismatch');
  assert(typeof diff.initial_release === 'boolean', 'beta release initial flag must be boolean');
  let prior = null;
  if (diff.initial_release) {
    assert(diff.previous_beta_release_id === null && diff.baseline_kind === 'no_prior_beta', 'initial beta release must use the explicit no-prior-beta baseline');
  } else {
    prior = validateReleaseId(diff.previous_beta_release_id);
    assert(prior !== release, 'a later beta release cannot reuse its prior immutable release ID');
    assert(diff.baseline_kind === 'prior_immutable_beta_release', 'later beta release must identify an immutable prior release baseline');
  }
  assert(diff.comparison_surface === 'exact_dedicated_beta_public_surface' && diff.assessed_production_authority === false,
    'beta release diff crossed its dedicated non-assessed surface boundary');
  validateCalculationHash(diff);
  assert(Array.isArray(diff.changes) && diff.changes.length > 0, 'beta release diff changes must be non-empty');
  const allowedPaths = new Set(diff.initial_release ? expectedPublicSurfacePaths(release) :
    [...expectedPublicSurfacePaths(prior), ...expectedPublicSurfacePaths(release)]);
  const currentImmutable = new Set(runtimeReleasePaths(release));
  const priorImmutable = new Set(prior ? runtimeReleasePaths(prior) : []);
  const seen = new Set();
  diff.changes.forEach((entry, index) => {
    exactKeys(entry, ['path', 'change', 'before_sha256', 'after_sha256'], `beta release diff change ${index}`);
    const relative = assertNoAssessedOrCandidatePath(entry.path);
    assert(allowedPaths.has(relative), `beta release diff contains a path outside its exact public surfaces: ${relative}`);
    assert(!seen.has(relative), `beta release diff contains a duplicate path: ${relative}`);
    seen.add(relative);
    if (index > 0) assert(compareStrings(diff.changes[index - 1].path, relative) < 0, 'beta release diff changes must be strictly sorted');
    assert(['added', 'modified', 'removed'].includes(entry.change), `invalid beta release diff operation: ${entry.change}`);
    assert(entry.before_sha256 === null || SHA256.test(entry.before_sha256), `invalid before hash in beta release diff: ${relative}`);
    assert(entry.after_sha256 === null || SHA256.test(entry.after_sha256), `invalid after hash in beta release diff: ${relative}`);
    if (entry.change === 'added') assert(entry.before_sha256 === null && SHA256.test(entry.after_sha256 || ''), `added beta path has invalid hashes: ${relative}`);
    if (entry.change === 'removed') assert(SHA256.test(entry.before_sha256 || '') && entry.after_sha256 === null, `removed beta path has invalid hashes: ${relative}`);
    if (entry.change === 'modified') assert(SHA256.test(entry.before_sha256 || '') && SHA256.test(entry.after_sha256 || '') && entry.before_sha256 !== entry.after_sha256,
      `modified beta path has invalid or equal hashes: ${relative}`);
    assert(!(currentImmutable.has(relative) || priorImmutable.has(relative)) || entry.change !== 'modified',
      `immutable beta release path cannot be modified: ${relative}`);
    if (diff.initial_release) assert(entry.change === 'added', 'initial no-prior-beta diff may contain only additions');
  });
  if (diff.initial_release) {
    assertExactList([...seen], expectedPublicSurfacePaths(release), 'initial beta public-surface additions');
  } else {
    currentImmutable.forEach(relative => assert(seen.has(relative) && diff.changes.find(item => item.path === relative).change === 'added',
      `new immutable beta release file must be added: ${relative}`));
    priorImmutable.forEach(relative => assert(seen.has(relative) && diff.changes.find(item => item.path === relative).change === 'removed',
      `prior immutable beta release file must be removed from the selected public surface: ${relative}`));
    const runtimeManifest = diff.changes.find(item => item.path === 'data/climate/public-beta/runtime/runtime-manifest.json');
    assert(runtimeManifest?.change === 'modified', 'later beta release must modify the level-neutral runtime manifest pointer');
  }
  exactKeys(diff.summary, ['added', 'modified', 'removed', 'total'], 'beta release diff summary');
  const summary = summarizeChanges(diff.changes);
  assert(canonicalJson(summary) === canonicalJson(diff.summary), 'beta release diff summary mismatch');
  return { status: 'pass', beta_release_id: release, previous_beta_release_id: prior, initial_release: diff.initial_release, change_count: diff.changes.length };
}

function evaluateReleaseDiff(diff, { currentFiles, previousFiles = [] }) {
  validateReleaseDiff(diff);
  const recomputed = computeReleaseDiff({
    betaReleaseId: diff.beta_release_id,
    previousBetaReleaseId: diff.previous_beta_release_id,
    currentFiles,
    previousFiles,
  });
  assert(canonicalJson(recomputed) === canonicalJson(diff), 'beta release diff does not match the exact before/after public-surface hashes');
  return { status: 'pass', beta_release_id: diff.beta_release_id, change_count: diff.changes.length, calculation_hash: diff.calculation_hash };
}

function normalizePins(pins, label, { allowEmpty = false, requireGitModes = false } = {}) {
  assert(Array.isArray(pins) && (allowEmpty || pins.length > 0), `${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
  const output = pins.map((entry, index) => {
    const hasGitMode = Object.prototype.hasOwnProperty.call(entry || {}, 'git_mode');
    exactKeys(entry, hasGitMode ? ['path', 'sha256', 'git_mode'] : ['path', 'sha256'], `${label} pin ${index}`);
    const relative = assertNoAssessedOrCandidatePath(entry.path);
    assert(SHA256.test(entry.sha256 || ''), `${label} pin SHA-256 is invalid: ${relative}`);
    if (hasGitMode) assert(GIT_MODE.test(entry.git_mode || ''), `${label} pin Git mode is invalid: ${relative}`);
    return hasGitMode
      ? { path: relative, sha256: entry.sha256, git_mode: entry.git_mode }
      : { path: relative, sha256: entry.sha256 };
  }).sort((left, right) => compareStrings(left.path, right.path));
  assert(new Set(output.map(item => item.path)).size === output.length, `${label} contains duplicate paths`);
  const modeCount = output.filter(item => Object.prototype.hasOwnProperty.call(item, 'git_mode')).length;
  assert(modeCount === 0 || modeCount === output.length, `${label} must provide Git modes for every pin or no pins`);
  assert(!requireGitModes || modeCount === output.length, `${label} must provide exact Git modes for every pin`);
  return output;
}

function treeHash(pins) {
  return sha256Canonical(normalizePins(pins, 'tree hash pins', { allowEmpty: true }));
}

function deriveCanonicalRollbackUniverse(releaseFiles, baselineFiles, options = {}) {
  const releasePins = normalizePins(releaseFiles, 'rollback universe release files', {
    allowEmpty: true,
    requireGitModes: options.requireGitModes === true,
  });
  const baselinePins = normalizePins(baselineFiles, 'rollback universe baseline files', {
    allowEmpty: true,
    requireGitModes: options.requireGitModes === true,
  });
  const release = new Map(releasePins.map(item => [item.path, item]));
  const baseline = new Map(baselinePins.map(item => [item.path, item]));
  const entries = [...new Set([...release.keys(), ...baseline.keys()])].sort(compareStrings).map(relative => {
    const releasePin = release.get(relative) || null;
    const baselinePin = baseline.get(relative) || null;
    return {
      path: relative,
      release_sha256: releasePin?.sha256 ?? null,
      release_git_mode: releasePin?.git_mode ?? null,
      baseline_sha256: baselinePin?.sha256 ?? null,
      baseline_git_mode: baselinePin?.git_mode ?? null,
    };
  });
  const hashInput = { definition: ROLLBACK_UNIVERSE_DEFINITION, entries };
  return {
    definition: ROLLBACK_UNIVERSE_DEFINITION,
    path_count: entries.length,
    entries,
    sha256: sha256Canonical(hashInput),
  };
}

function computeRollbackOperations(releaseFiles, baselineFiles) {
  return deriveCanonicalRollbackUniverse(releaseFiles, baselineFiles).entries.flatMap(entry => {
    if (entry.release_sha256 === entry.baseline_sha256 && entry.release_git_mode === entry.baseline_git_mode) return [];
    const operation = entry.baseline_sha256 === null ? 'remove' : entry.release_sha256 === null ? 'restore' : 'replace';
    return [{ ...entry, operation }];
  });
}

function executionEvidenceHash({ betaReleaseId, releaseCommitSha, baselineCommitSha, releaseTreeHash, baselineTreeHash, execution }) {
  const input = structuredClone(execution);
  input.evidence_sha256 = null;
  return sha256Canonical({
    domain: 'earth-love-united/climate-public-beta/repository-rollback-execution/v1',
    beta_release_id: betaReleaseId,
    release_commit_sha: releaseCommitSha,
    baseline_commit_sha: baselineCommitSha,
    release_tree_hash: releaseTreeHash,
    baseline_tree_hash: baselineTreeHash,
    execution: input,
  });
}

function listAllRegularFiles(root) {
  const absoluteRoot = assertRealDirectory(root, 'rollback tree root');
  const output = [];
  function visit(absolute, relative) {
    fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => compareStrings(a.name, b.name)).forEach(entry => {
      const childRelative = safeRelative(relative ? path.posix.join(relative, entry.name) : entry.name);
      const childAbsolute = path.join(absolute, entry.name);
      const stat = fs.lstatSync(childAbsolute);
      assert(!stat.isSymbolicLink(), `rollback tree contains a symlink: ${childRelative}`);
      if (stat.isDirectory()) visit(childAbsolute, childRelative);
      else {
        assert(stat.isFile(), `rollback tree contains a non-regular entry: ${childRelative}`);
        output.push(childRelative);
      }
    });
  }
  visit(absoluteRoot, '');
  return output.sort(compareStrings);
}

function verifyExactTree(root, pins, label) {
  const normalized = normalizePins(pins, `${label} pins`, { allowEmpty: true });
  assertExactList(listAllRegularFiles(root), normalized.map(item => item.path), `${label} file inventory`);
  normalized.forEach(pin => {
    const actual = inspectRegular(root, pin.path);
    assert(actual.sha256 === pin.sha256, `${label} file hash mismatch: ${pin.path}`);
    if (pin.git_mode) assert(actual.git_mode === pin.git_mode, `${label} file Git mode mismatch: ${pin.path}`);
  });
  return normalized;
}

function copyPinnedFile(fromRoot, toRoot, pin) {
  const source = inspectRegular(fromRoot, pin.path);
  assert(source.sha256 === pin.sha256, `rollback source hash mismatch: ${pin.path}`);
  const destination = path.join(path.resolve(toRoot), pin.path);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source.absolute, destination, fs.constants.COPYFILE_EXCL);
  if (pin.git_mode) fs.chmodSync(destination, pin.git_mode === '100755' ? 0o755 : 0o644);
}

function replacePinnedFile(fromRoot, toRoot, pin) {
  const source = inspectRegular(fromRoot, pin.path);
  assert(source.sha256 === pin.sha256, `rollback baseline source hash mismatch: ${pin.path}`);
  const destination = path.join(path.resolve(toRoot), pin.path);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source.absolute, destination);
  if (pin.git_mode) fs.chmodSync(destination, pin.git_mode === '100755' ? 0o755 : 0o644);
}

function performRepositoryRollback({ releaseRoot, baselineRoot, workRoot, releaseFiles, baselineFiles }) {
  const release = verifyExactTree(releaseRoot, releaseFiles, 'release rollback input');
  const baseline = verifyExactTree(baselineRoot, baselineFiles, 'baseline rollback input');
  const absoluteWork = assertRealDirectory(workRoot, 'rollback rehearsal work root');
  assert(listAllRegularFiles(absoluteWork).length === 0 && fs.readdirSync(absoluteWork).length === 0,
    'rollback rehearsal work root must be newly created and empty');
  release.forEach(pin => copyPinnedFile(releaseRoot, absoluteWork, pin));
  const operations = computeRollbackOperations(release, baseline);
  const baselineByPath = new Map(baseline.map(item => [item.path, item]));
  operations.forEach(operation => {
    const destination = path.join(absoluteWork, operation.path);
    if (operation.operation === 'remove') {
      const stat = fs.lstatSync(destination);
      assert(stat.isFile() && !stat.isSymbolicLink(), `rollback remove target is not a regular file: ${operation.path}`);
      fs.unlinkSync(destination);
    } else {
      replacePinnedFile(baselineRoot, absoluteWork, baselineByPath.get(operation.path));
    }
  });
  verifyExactTree(absoluteWork, baseline, 'restored rollback result');
  return { status: 'passed', restored_tree_hash: treeHash(baseline), operation_count: operations.length };
}

function buildRollbackExecution({
  betaReleaseId,
  releaseCommitSha,
  baselineCommitSha,
  releaseFiles,
  baselineFiles,
  releaseRoot,
  baselineRoot,
  workRoot,
  evidenceId,
  executedAt,
  executorIdentity,
  executionSubjectIdentity,
}) {
  const release = validateReleaseId(betaReleaseId);
  assert(COMMIT_SHA.test(releaseCommitSha || '') && COMMIT_SHA.test(baselineCommitSha || '') && releaseCommitSha !== baselineCommitSha,
    'rollback execution requires distinct exact release and baseline commit SHAs');
  assert(typeof evidenceId === 'string' && evidenceId.length >= 5, 'rollback execution evidence ID is required');
  validateProductionIdentity(executorIdentity, 'rollback execution executor identity');
  validateProductionIdentity(executionSubjectIdentity, 'rollback execution subject identity');
  validateUtcTimestamp(executedAt, 'rollback execution timestamp');
  const normalizedRelease = normalizePins(releaseFiles, 'rollback release files');
  const normalizedBaseline = normalizePins(baselineFiles, 'rollback baseline files', { allowEmpty: true });
  const result = performRepositoryRollback({
    releaseRoot,
    baselineRoot,
    workRoot,
    releaseFiles: normalizedRelease,
    baselineFiles: normalizedBaseline,
  });
  const execution = {
    status: 'passed',
    evidence_id: evidenceId,
    executed_at: executedAt,
    executor_identity: executorIdentity,
    execution_subject_identity: executionSubjectIdentity,
    review_relationship: {
      required_reviewer_role: 'beta_rollback_reviewer',
      review_state: 'pending_external_signed_review',
      reviewer_identity: null,
      executor_must_differ_from_reviewer: true,
      subject_must_differ_from_reviewer: true,
    },
    isolated_worktree: true,
    exit_code: 0,
    restored_tree_hash: result.restored_tree_hash,
    evidence_sha256: null,
  };
  execution.evidence_sha256 = executionEvidenceHash({
    betaReleaseId: release,
    releaseCommitSha,
    baselineCommitSha,
    releaseTreeHash: treeHash(normalizedRelease),
    baselineTreeHash: treeHash(normalizedBaseline),
    execution,
  });
  return execution;
}

function validateHostedWithdrawal(hosted) {
  exactKeys(hosted, [
    'evidence_state', 'target_kind', 'rollback_target_reference', 'hosting_project', 'level_contracts', 'deployment_id',
    'credentialed_steps', 'access_lock_or_withdraw_action', 'cache_purge_action',
    'expected_unauthorized_statuses', 'allowed_redirect_origins', 'rollback_response_target_seconds',
    'post_action_checks', 'production_origin_unchanged_required', 'production_baseline_origin',
    'production_baseline_inventory_sha256', 'remote_execution_evidence',
  ], 'hosted withdrawal plan');
  assert(hosted.evidence_state === 'plan_only_pending_post_deployment_evidence', 'hosted withdrawal proof must remain a predeployment plan');
  assert(ROLLBACK_TARGET_TYPES.includes(hosted.target_kind), 'hosted withdrawal target kind is invalid');
  validateOperationalReference(hosted.rollback_target_reference, 'hosted withdrawal rollback target');
  validateHostingProjectBinding(hosted.hosting_project, 'hosted withdrawal hosting project');
  assert(Array.isArray(hosted.level_contracts) && hosted.level_contracts.length > 0 && hosted.level_contracts.length <= 2,
    'hosted withdrawal must include one or both explicit publication-level contracts');
  const observedLevels = [];
  const allAliases = [];
  hosted.level_contracts.forEach((contract, index) => {
    exactKeys(contract, ['publication_level', 'intended_origin', 'aliases'], `hosted withdrawal level contract ${index}`);
    assert(ROLLBACK_POLICY_LEVELS.includes(contract.publication_level), 'hosted withdrawal publication level is invalid');
    observedLevels.push(contract.publication_level);
    const intended = canonicalHttpsOrigin(contract.intended_origin, `hosted withdrawal ${contract.publication_level} origin`);
    assert(Array.isArray(contract.aliases) && contract.aliases.length > 0,
      `hosted withdrawal ${contract.publication_level} aliases must be non-empty`);
    const aliases = contract.aliases.map((item, aliasIndex) =>
      canonicalHttpsOrigin(item, `hosted withdrawal ${contract.publication_level} alias ${aliasIndex}`));
    assert(new Set(aliases).size === aliases.length && canonicalJson(aliases) === canonicalJson(aliases.slice().sort(compareStrings)),
      `hosted withdrawal ${contract.publication_level} aliases must be unique and sorted`);
    assert(aliases.includes(intended), `hosted withdrawal ${contract.publication_level} aliases must include its intended origin`);
    allAliases.push(...aliases);
  });
  assert(new Set(observedLevels).size === observedLevels.length,
    'hosted withdrawal publication-level contracts must be unique');
  const canonicalLevelOrder = ROLLBACK_POLICY_LEVELS.filter(level => observedLevels.includes(level));
  assert(canonicalJson(observedLevels) === canonicalJson(canonicalLevelOrder),
    'hosted withdrawal publication-level contracts must use canonical order');
  assert(hosted.deployment_id === null && hosted.remote_execution_evidence === null,
    'predeployment rollback proof must not invent a deployment ID or remote execution evidence');
  ['credentialed_steps', 'post_action_checks'].forEach(key => {
    assert(Array.isArray(hosted[key]) && hosted[key].length > 0 && hosted[key].every(item => typeof item === 'string' && item.length >= 5),
      `hosted withdrawal ${key} must be a non-empty string array`);
    assert(new Set(hosted[key]).size === hosted[key].length, `hosted withdrawal ${key} must be unique`);
  });
  assertExactList(hosted.post_action_checks, POST_ACTION_CHECKS, 'hosted withdrawal post-action checks');
  assert(typeof hosted.access_lock_or_withdraw_action === 'string' && hosted.access_lock_or_withdraw_action.length >= 5,
    'hosted withdrawal access-lock or withdraw action is required');
  assert(typeof hosted.cache_purge_action === 'string' && hosted.cache_purge_action.length >= 5, 'hosted withdrawal cache action is required');
  assert(Array.isArray(hosted.expected_unauthorized_statuses) && hosted.expected_unauthorized_statuses.length > 0 &&
    hosted.expected_unauthorized_statuses.every(item => [302, 401, 403, 404].includes(item)) &&
    new Set(hosted.expected_unauthorized_statuses).size === hosted.expected_unauthorized_statuses.length &&
    canonicalJson(hosted.expected_unauthorized_statuses) === canonicalJson([...hosted.expected_unauthorized_statuses].sort((a, b) => a - b)),
  'hosted withdrawal expected unauthorized statuses are invalid');
  assert(Array.isArray(hosted.allowed_redirect_origins), 'hosted withdrawal allowed redirect origins must be an array');
  const redirectOrigins = hosted.allowed_redirect_origins.map((item, index) =>
    canonicalHttpsOrigin(item, `hosted withdrawal allowed redirect origin ${index}`));
  assert(new Set(redirectOrigins).size === redirectOrigins.length &&
    canonicalJson(redirectOrigins) === canonicalJson(redirectOrigins.slice().sort(compareStrings)),
  'hosted withdrawal allowed redirect origins must be unique and sorted');
  assert(Number.isInteger(hosted.rollback_response_target_seconds) && hosted.rollback_response_target_seconds > 0,
    'hosted withdrawal requires a positive pre-frozen response target');
  assert(hosted.production_origin_unchanged_required === true, 'hosted withdrawal must preserve the assessed production origin');
  const productionBaselineOrigin = canonicalHttpsOrigin(hosted.production_baseline_origin,
    'hosted withdrawal production baseline origin');
  assert(!allAliases.includes(productionBaselineOrigin),
    'hosted withdrawal production baseline origin must remain outside all beta aliases');
  assert(SHA256.test(hosted.production_baseline_inventory_sha256 || ''),
    'hosted withdrawal production baseline inventory hash is invalid');
  return hosted;
}

function validateHostingProjectBinding(binding, label) {
  exactKeys(binding, [
    'provider', 'project_id', 'production_branch', 'access_scope',
    'access_policy_reference', 'pages_dev_origin', 'deployment_alias_hostname_suffix',
  ], label);
  assert(binding.provider === 'cloudflare_pages', `${label} provider must be Cloudflare Pages`);
  assert(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(binding.project_id || ''),
    `${label} project ID must be a canonical Cloudflare Pages project label`);
  assert(binding.production_branch === 'main', `${label} production branch must be main`);
  assert(binding.access_scope === 'project_wide_all_deployments',
    `${label} access scope must cover the complete project`);
  validateOperationalReference(binding.access_policy_reference, `${label} access policy reference`);
  assert(binding.pages_dev_origin === `https://${binding.project_id}.pages.dev`,
    `${label} pages.dev origin must bind the exact Pages project`);
  assert(binding.deployment_alias_hostname_suffix === `.${binding.project_id}.pages.dev`,
    `${label} deployment alias hostname suffix must bind the exact Pages project`);
  return binding;
}

function rollbackContractLevels(contract) {
  if (contract === 'both') return [...ROLLBACK_POLICY_LEVELS];
  assert(ROLLBACK_POLICY_LEVELS.includes(contract),
    'rollback policy contract must be invited_beta, public_beta, or both');
  return [contract];
}

function validateRollbackAgainstPolicy(proof, policy, contract = 'both') {
  validateRollbackProof(proof);
  assert(policy && typeof policy === 'object' && !Array.isArray(policy), 'rollback policy binding requires a policy object');
  const levels = rollbackContractLevels(contract);
  exactKeys(policy.approved_origins, [...ROLLBACK_POLICY_LEVELS].sort(compareStrings), 'rollback policy approved origins');
  exactKeys(policy.approved_aliases, [...ROLLBACK_POLICY_LEVELS].sort(compareStrings), 'rollback policy approved aliases');
  exactKeys(policy.unauthorized_access_policy, ['allowed_statuses', 'allowed_redirect_origins'],
    'rollback policy unauthorized access contract');
  exactKeys(policy.rollback_target, ['type', 'reference'], 'rollback policy target');
  assert(policy.frozen_thresholds && typeof policy.frozen_thresholds === 'object' && !Array.isArray(policy.frozen_thresholds),
    'rollback policy frozen thresholds are missing');
  assert(policy.hosting_project && typeof policy.hosting_project === 'object' && !Array.isArray(policy.hosting_project),
    'rollback policy hosting project binding is missing');
  const policyHostingProject = validateHostingProjectBinding({
    provider: policy.hosting_project.provider,
    project_id: policy.hosting_project.project_id,
    production_branch: policy.hosting_project.production_branch,
    access_scope: policy.hosting_project.access_scope,
    access_policy_reference: policy.hosting_project.access_policy_reference,
    pages_dev_origin: policy.hosting_project.pages_dev_origin,
    deployment_alias_hostname_suffix: policy.hosting_project.deployment_alias_hostname_suffix,
  }, 'rollback policy hosting project');
  assert(ROLLBACK_TARGET_TYPES.includes(policy.rollback_target.type), 'rollback policy target type is not canonical');
  validateOperationalReference(policy.rollback_target.reference, 'rollback policy target reference');
  const hosted = proof.hosted_withdrawal;
  const proofLevels = hosted.level_contracts.map(item => item.publication_level);
  assert(canonicalJson(proofLevels) === canonicalJson(levels),
    'rollback proof publication-level coverage differs from the requested policy contract');
  levels.forEach(level => {
    const levelContract = hosted.level_contracts.find(item => item.publication_level === level);
    const policyOrigin = canonicalHttpsOrigin(policy.approved_origins[level], `rollback policy ${level} origin`);
    const policyAliases = policy.approved_aliases[level];
    assert(Array.isArray(policyAliases) && policyAliases.length > 0, `rollback policy ${level} aliases are missing`);
    policyAliases.forEach((item, index) => canonicalHttpsOrigin(item, `rollback policy ${level} alias ${index}`));
    assert(levelContract.intended_origin === policyOrigin,
      `rollback proof ${level} origin differs from policy`);
    assert(canonicalJson(levelContract.aliases) === canonicalJson(policyAliases),
      `rollback proof ${level} aliases differ from policy`);
  });
  assert(hosted.target_kind === policy.rollback_target.type,
    'rollback proof target type differs from policy');
  assert(hosted.rollback_target_reference === policy.rollback_target.reference,
    'rollback proof target reference differs from policy');
  assert(hosted.hosting_project.project_id === policyHostingProject.project_id,
    'rollback proof hosting project ID differs from policy');
  assert(hosted.hosting_project.provider === policyHostingProject.provider,
    'rollback proof hosting provider differs from policy');
  assert(hosted.hosting_project.production_branch === policyHostingProject.production_branch,
    'rollback proof hosting production branch differs from policy');
  assert(hosted.hosting_project.access_scope === policyHostingProject.access_scope,
    'rollback proof hosting access scope differs from policy');
  assert(hosted.hosting_project.access_policy_reference === policyHostingProject.access_policy_reference,
    'rollback proof access policy reference differs from policy');
  assert(hosted.hosting_project.pages_dev_origin === policyHostingProject.pages_dev_origin,
    'rollback proof pages.dev origin differs from policy');
  assert(hosted.hosting_project.deployment_alias_hostname_suffix === policyHostingProject.deployment_alias_hostname_suffix,
    'rollback proof deployment alias hostname suffix differs from policy');
  assert(canonicalJson(hosted.expected_unauthorized_statuses) ===
    canonicalJson(policy.unauthorized_access_policy.allowed_statuses),
  'rollback proof denial statuses differ from policy');
  assert(canonicalJson(hosted.allowed_redirect_origins) ===
    canonicalJson(policy.unauthorized_access_policy.allowed_redirect_origins),
  'rollback proof redirect policy differs from policy');
  assert(hosted.rollback_response_target_seconds === policy.frozen_thresholds.rollback_response_target_seconds,
    'rollback proof response target differs from policy');
  assert(hosted.production_baseline_origin === policy.production_baseline_origin,
    'rollback proof production baseline origin differs from policy');
  assert(hosted.production_baseline_inventory_sha256 === policy.production_baseline_inventory_sha256,
    'rollback proof production baseline inventory hash differs from policy');
  return {
    status: 'pass',
    beta_release_id: proof.beta_release_id,
    publication_levels: levels,
    rollback_target_type: hosted.target_kind,
    policy_bound: true,
  };
}

function buildRollbackProof({
  betaReleaseId,
  releaseCommitSha,
  baselineCommitSha,
  releaseFiles,
  baselineFiles,
  execution,
  hostedWithdrawal,
  proofCreatedAt,
}) {
  const release = validateReleaseId(betaReleaseId);
  const releasePins = normalizePins(releaseFiles, 'rollback release files');
  const baselinePins = normalizePins(baselineFiles, 'rollback baseline files', { allowEmpty: true });
  validateHostedWithdrawal(hostedWithdrawal);
  const universe = deriveCanonicalRollbackUniverse(releasePins, baselinePins);
  validateUtcTimestamp(proofCreatedAt, 'rollback proof creation timestamp');
  assert(validateUtcTimestamp(execution?.executed_at, 'rollback execution timestamp') <= new Date(proofCreatedAt).getTime(),
    'rollback execution must not occur after rollback proof creation');
  return withCalculationHash({
    schema_version: '1.0.0',
    proof_id: `elu-climate-public-beta-rollback-${release}`,
    beta_release_id: release,
    created_at: proofCreatedAt,
    proof_state: 'repository_rehearsed_hosted_plan_pending_deployment',
    assessed_production_authority: false,
    review_authority: false,
    repository_rollback: {
      strategy: 'restore_exact_pinned_repository_baseline',
      target_definition: ROLLBACK_TARGET_DEFINITION,
      release_commit_sha: releaseCommitSha,
      baseline_commit_sha: baselineCommitSha,
      release_files: releasePins,
      baseline_files: baselinePins,
      release_tree_hash: treeHash(releasePins),
      baseline_tree_hash: treeHash(baselinePins),
      universe_definition: universe.definition,
      universe_path_count: universe.path_count,
      universe_sha256: universe.sha256,
      operations: computeRollbackOperations(releasePins, baselinePins),
      procedure: {
        algorithm: 'restore-pinned-baseline-v1',
        executable: 'tools/check-climate-public-beta-package.js',
        mode: '--rehearse-rollback',
        requires_isolated_worktree: true,
      },
      execution: structuredClone(execution),
    },
    hosted_withdrawal: structuredClone(hostedWithdrawal),
    calculation_hash: null,
  });
}

function validateRollbackProof(proof) {
  exactKeys(proof, [
    'schema_version', 'proof_id', 'beta_release_id', 'created_at', 'proof_state',
    'assessed_production_authority', 'review_authority', 'repository_rollback',
    'hosted_withdrawal', 'calculation_hash',
  ], 'beta rollback proof');
  const release = validateReleaseId(proof.beta_release_id);
  assert(proof.schema_version === '1.0.0' && proof.proof_id === `elu-climate-public-beta-rollback-${release}`, 'beta rollback proof identity mismatch');
  validateUtcTimestamp(proof.created_at, 'rollback proof creation timestamp');
  assert(proof.proof_state === 'repository_rehearsed_hosted_plan_pending_deployment', 'beta rollback proof state is invalid');
  assert(proof.assessed_production_authority === false && proof.review_authority === false,
    'rollback proof cannot grant assessed, review, or publication authority');
  validateCalculationHash(proof);

  const repository = proof.repository_rollback;
  exactKeys(repository, [
    'strategy', 'target_definition', 'release_commit_sha', 'baseline_commit_sha', 'release_files',
    'baseline_files', 'release_tree_hash', 'baseline_tree_hash', 'universe_definition',
    'universe_path_count', 'universe_sha256', 'operations',
    'procedure', 'execution',
  ], 'repository rollback proof');
  assert(repository.strategy === 'restore_exact_pinned_repository_baseline', 'repository rollback strategy mismatch');
  assert(repository.target_definition === ROLLBACK_TARGET_DEFINITION,
    'repository rollback target definition is invalid');
  assert(COMMIT_SHA.test(repository.release_commit_sha || '') && COMMIT_SHA.test(repository.baseline_commit_sha || '') &&
    repository.release_commit_sha !== repository.baseline_commit_sha, 'repository rollback commit pins are invalid or equal');
  const releasePins = normalizePins(repository.release_files, 'repository rollback release files');
  const baselinePins = normalizePins(repository.baseline_files, 'repository rollback baseline files', { allowEmpty: true });
  assert(canonicalJson(releasePins) === canonicalJson(repository.release_files), 'repository rollback release pins must be strictly sorted');
  assert(canonicalJson(baselinePins) === canonicalJson(repository.baseline_files), 'repository rollback baseline pins must be strictly sorted');
  const requiredRelease = requiredRollbackTargetPaths(release);
  const releasePathSet = new Set(releasePins.map(item => item.path));
  const missing = requiredRelease.filter(item => !releasePathSet.has(item));
  assert(missing.length === 0,
    `repository rollback target pins omit required pre-proof package paths: ${missing.join(', ')}`);
  rollbackPostTargetPaths(release).forEach(item => assert(!releasePathSet.has(item),
    `post-target rollback proof/review path must not create a self-reference: ${item}`));
  assert(!releasePathSet.has(scopeSelfPath(release)), 'BA scope must be created after the rollback proof and cannot be a rollback target pin');
  laterApprovalPaths(release).forEach(item => assert(!releasePathSet.has(item), `repository BA rollback pins must exclude later approval path: ${item}`));
  assert(repository.release_tree_hash === treeHash(releasePins) && repository.baseline_tree_hash === treeHash(baselinePins),
    'repository rollback tree hash mismatch');
  const universe = deriveCanonicalRollbackUniverse(releasePins, baselinePins);
  assert(repository.universe_definition === universe.definition &&
    repository.universe_path_count === universe.path_count && repository.universe_sha256 === universe.sha256,
  'repository rollback universe binding mismatch');
  const operations = computeRollbackOperations(releasePins, baselinePins);
  assert(operations.length > 0 && canonicalJson(operations) === canonicalJson(repository.operations), 'repository rollback operations mismatch');
  exactKeys(repository.procedure, ['algorithm', 'executable', 'mode', 'requires_isolated_worktree'], 'repository rollback procedure');
  assert(repository.procedure.algorithm === 'restore-pinned-baseline-v1' &&
    repository.procedure.executable === 'tools/check-climate-public-beta-package.js' &&
    repository.procedure.mode === '--rehearse-rollback' && repository.procedure.requires_isolated_worktree === true,
  'repository rollback procedure is not the executable isolated-worktree algorithm');
  const execution = repository.execution;
  exactKeys(execution, [
    'status', 'evidence_id', 'executed_at', 'executor_identity', 'execution_subject_identity',
    'review_relationship', 'isolated_worktree',
    'exit_code', 'restored_tree_hash', 'evidence_sha256',
  ], 'repository rollback execution');
  assert(execution.status === 'passed' && execution.isolated_worktree === true && execution.exit_code === 0,
    'repository rollback execution did not pass in an isolated worktree');
  assert(typeof execution.evidence_id === 'string' && execution.evidence_id.length >= 5,
    'repository rollback execution evidence identity is missing');
  validateProductionIdentity(execution.executor_identity, 'repository rollback executor identity');
  validateProductionIdentity(execution.execution_subject_identity, 'repository rollback execution subject identity');
  exactKeys(execution.review_relationship, [
    'required_reviewer_role', 'review_state', 'reviewer_identity',
    'executor_must_differ_from_reviewer', 'subject_must_differ_from_reviewer',
  ], 'repository rollback review relationship');
  assert(execution.review_relationship.required_reviewer_role === 'beta_rollback_reviewer' &&
    execution.review_relationship.review_state === 'pending_external_signed_review' &&
    execution.review_relationship.reviewer_identity === null &&
    execution.review_relationship.executor_must_differ_from_reviewer === true &&
    execution.review_relationship.subject_must_differ_from_reviewer === true,
  'repository rollback review relationship is not the pending independent-review contract');
  validateUtcTimestamp(execution.executed_at, 'repository rollback execution timestamp');
  validateRollbackChronology(proof);
  assert(execution.restored_tree_hash === repository.baseline_tree_hash, 'repository rollback execution did not restore the exact baseline tree hash');
  const expectedEvidenceHash = executionEvidenceHash({
    betaReleaseId: release,
    releaseCommitSha: repository.release_commit_sha,
    baselineCommitSha: repository.baseline_commit_sha,
    releaseTreeHash: repository.release_tree_hash,
    baselineTreeHash: repository.baseline_tree_hash,
    execution,
  });
  assert(execution.evidence_sha256 === expectedEvidenceHash, 'repository rollback execution evidence hash mismatch');
  validateHostedWithdrawal(proof.hosted_withdrawal);
  return {
    status: 'pass',
    beta_release_id: release,
    release_commit_sha: repository.release_commit_sha,
    baseline_commit_sha: repository.baseline_commit_sha,
    operation_count: operations.length,
    hosted_evidence_state: proof.hosted_withdrawal.evidence_state,
  };
}

function validateRollbackChronology(proof, context = {}) {
  const executedAt = validateUtcTimestamp(proof?.repository_rollback?.execution?.executed_at,
    'repository rollback execution timestamp');
  const createdAt = validateUtcTimestamp(proof?.created_at, 'rollback proof creation timestamp');
  assert(executedAt <= createdAt, 'rollback execution must not occur after rollback proof creation');
  let reviewAt = null;
  if (context.reviewObservedAt !== undefined && context.reviewObservedAt !== null) {
    reviewAt = validateUtcTimestamp(context.reviewObservedAt, 'rollback independent-review timestamp');
    assert(createdAt < reviewAt, 'rollback independent review must occur after proof creation');
  }
  const approvalTimestamps = context.approvalTimestamps ?? [];
  assert(Array.isArray(approvalTimestamps), 'rollback approval timestamps must be an array');
  if (approvalTimestamps.length > 0) assert(reviewAt !== null,
    'rollback approval chronology requires the independent-review timestamp');
  approvalTimestamps.forEach((value, index) => {
    const approvalAt = validateUtcTimestamp(value, `rollback approval timestamp ${index}`);
    assert(approvalAt >= reviewAt, 'rollback approval must not predate the independent rollback review');
  });
  return {
    status: 'pass',
    executed_at: proof.repository_rollback.execution.executed_at,
    proof_created_at: proof.created_at,
    review_observed_at: context.reviewObservedAt ?? null,
    approval_count: approvalTimestamps.length,
  };
}

function validateRollbackReviewRelationship(proof, binding) {
  validateRollbackProof(proof);
  exactKeys(binding, ['producer_identity', 'reviewer_identity', 'reviewer_role', 'observed_at'],
    'rollback independent-review relationship binding');
  const execution = proof.repository_rollback.execution;
  validateProductionIdentity(binding.producer_identity, 'rollback review producer identity');
  validateProductionIdentity(binding.reviewer_identity, 'rollback independent reviewer identity');
  assert(binding.reviewer_role === execution.review_relationship.required_reviewer_role,
    'rollback reviewer role differs from the proof review contract');
  assert(binding.producer_identity === execution.execution_subject_identity,
    'rollback review producer differs from the proof execution subject');
  assert(binding.reviewer_identity !== execution.execution_subject_identity &&
    binding.reviewer_identity !== execution.executor_identity,
  'rollback reviewer must be independent from the execution subject and executor');
  validateRollbackChronology(proof, { reviewObservedAt: binding.observed_at });
  return {
    status: 'pass',
    beta_release_id: proof.beta_release_id,
    producer_identity: binding.producer_identity,
    reviewer_identity: binding.reviewer_identity,
    reviewer_role: binding.reviewer_role,
    independent: true,
  };
}

function validateRollbackUniverseProjection(proof, expected = {}) {
  validateRollbackProof(proof);
  assert(Array.isArray(expected.releaseFiles) && Array.isArray(expected.baselineFiles),
    'rollback universe validation requires complete release and baseline inventories');
  const requireGitModes = expected.requireGitModes === true;
  const expectedRelease = normalizePins(expected.releaseFiles, 'expected complete rollback release inventory', {
    allowEmpty: true,
    requireGitModes,
  });
  const expectedBaseline = normalizePins(expected.baselineFiles, 'expected complete rollback baseline inventory', {
    allowEmpty: true,
    requireGitModes,
  });
  const repository = proof.repository_rollback;
  assert(canonicalJson(repository.release_files) === canonicalJson(expectedRelease),
    'rollback proof release_files are not the exact complete release projection');
  assert(canonicalJson(repository.baseline_files) === canonicalJson(expectedBaseline),
    'rollback proof baseline_files are not the exact complete baseline projection');
  const expectedUniverse = deriveCanonicalRollbackUniverse(expectedRelease, expectedBaseline, { requireGitModes });
  assert(repository.universe_definition === expectedUniverse.definition &&
    repository.universe_path_count === expectedUniverse.path_count &&
    repository.universe_sha256 === expectedUniverse.sha256,
  'rollback proof universe differs from the externally derived complete Git projection');
  return {
    status: 'pass',
    beta_release_id: proof.beta_release_id,
    universe_path_count: expectedUniverse.path_count,
    universe_sha256: expectedUniverse.sha256,
    git_modes_verified: requireGitModes || expectedRelease.some(item => item.git_mode) ||
      expectedBaseline.some(item => item.git_mode),
  };
}

function rehearseRollbackProof(proof, { releaseRoot, baselineRoot, workRoot }) {
  validateRollbackProof(proof);
  const result = performRepositoryRollback({
    releaseRoot,
    baselineRoot,
    workRoot,
    releaseFiles: proof.repository_rollback.release_files,
    baselineFiles: proof.repository_rollback.baseline_files,
  });
  assert(result.restored_tree_hash === proof.repository_rollback.execution.restored_tree_hash,
    'replayed repository rollback result does not match the bound execution evidence');
  return { status: 'pass', beta_release_id: proof.beta_release_id, replayed_tree_hash: result.restored_tree_hash };
}

function validateRollbackAgainstScope(proof, scopeManifest, options = {}) {
  assert(options.root, 'rollback/scope binding validation requires the exact repository root');
  validateRollbackProof(proof);
  validateScopeManifest(scopeManifest, { root: options.root });
  assert(proof.beta_release_id === scopeManifest.beta_release_id, 'rollback proof and BA scope release IDs differ');
  const repository = proof.repository_rollback;
  const releasePins = new Map(repository.release_files.map(item => [item.path, item.sha256]));
  const scopePins = new Map(scopeManifest.files.map(item => [item.path, item]));
  const postTargetSet = new Set(rollbackPostTargetPaths(proof.beta_release_id));
  const expectedTargetPaths = scopeManifest.files.map(item => item.path)
    .filter(relative => !postTargetSet.has(relative)).sort(compareStrings);
  assertExactList([...releasePins.keys()], expectedTargetPaths,
    'rollback pre-proof target versus the later canonical BA scope');
  expectedTargetPaths.forEach(relative => {
    const scoped = scopePins.get(relative);
    assert(scoped && releasePins.get(relative) === scoped.sha256,
      `canonical BA scope does not preserve the rehearsed rollback target byte: ${relative}`);
  });
  const requiredPostTarget = rollbackPostTargetPaths(proof.beta_release_id);
  requiredPostTarget.forEach(relative => assert(scopePins.has(relative),
    `canonical BA scope omits a required post-target rollback proof/review path: ${relative}`));
  const proofPath = `data/climate/public-beta/governance/releases/${proof.beta_release_id}/rollback-proof.json`;
  const proofFile = inspectRegular(options.root, proofPath);
  assert(scopePins.get(proofPath)?.sha256 === proofFile.sha256,
    'canonical BA scope does not pin the exact validated rollback-proof bytes');
  let parsedProof;
  try {
    parsedProof = parseJsonNoDuplicateKeys(proofFile.buffer.toString('utf8'), 'scope-pinned rollback proof');
  }
  catch (_) { throw new Error('scope-pinned rollback proof is not valid JSON'); }
  assert(canonicalJson(parsedProof) === canonicalJson(proof),
    'validated rollback proof differs from the exact scope-pinned rollback-proof bytes');
  return {
    status: 'pass',
    beta_release_id: proof.beta_release_id,
    scope_hash: scopeManifest.scope_hash,
    target_file_count: expectedTargetPaths.length,
    proof_bound_externally_by_scope: true,
  };
}

module.exports = {
  BETA_PACKAGE_REVIEW_CONTROL_PATHS,
  BETA_REQUIRE_CLOSURE_ROOT_PATHS,
  BETA_TRANSITIVE_DEPENDENCY_PATHS,
  BETA_UI_PATHS,
  FOUNDATION_DEFERRED_CLOSURE_ROOT_PATHS,
  GOVERNANCE_RELEASE_BA_FILES,
  PACKAGE_SCHEMA_NAMES,
  POST_ACTION_CHECKS,
  PRODUCT_LABEL,
  PUBLIC_FIXED_PATHS,
  REVIEWED_RUNTIME_SCHEMA_PATHS,
  REQUIRED_DEPLOYMENT_CONTROL_PATHS,
  ROLLBACK_POLICY_LEVELS,
  ROLLBACK_POST_TARGET_FILES,
  ROLLBACK_TARGET_TYPES,
  ROLLBACK_UNIVERSE_DEFINITION,
  REQUIRED_ENGINEERING_PATHS,
  RUNTIME_FILE_NAMES,
  buildRollbackExecution,
  buildRollbackProof,
  buildScopeManifest,
  betaRequireClosure,
  canonicalJson,
  computeRollbackOperations,
  computeReleaseDiff,
  deriveCanonicalRollbackUniverse,
  discoverBaScopePaths,
  discoverDeploymentControlPaths,
  discoverRollbackTargetPaths,
  evaluateReleaseDiff,
  expectedPublicSurfacePaths,
  inspectRegular,
  laterApprovalPaths,
  normalizePins,
  normalizeSurfaceSnapshot,
  performRepositoryRollback,
  rehearseRollbackProof,
  requiredBaPaths,
  requiredRollbackTargetPaths,
  rollbackPostTargetPaths,
  runtimeReleasePaths,
  scopeSelfPath,
  sha256Bytes,
  sha256Canonical,
  staticRequireSpecifiers,
  surfaceSnapshotFromManifest,
  treeHash,
  validateReleaseDiff,
  validateRollbackAgainstPolicy,
  validateRollbackProof,
  validateRollbackAgainstScope,
  validateRollbackChronology,
  validateRollbackReviewRelationship,
  validateRollbackUniverseProjection,
  validateRuntimeManifest,
  validateBuilderIdentity,
  validateProductionIdentity,
  validateScopeManifest,
};
