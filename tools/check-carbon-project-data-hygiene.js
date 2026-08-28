#!/usr/bin/env node
'use strict';

// ═══════════════════════════════════════════════════════════════
// check-carbon-project-data-hygiene.js — fail-closed payload guard
// ═══════════════════════════════════════════════════════════════
//
// The site panel renders fields from data/carbon-projects.json into HTML. The
// renderer escapes current values; this independent data gate keeps the public
// payload inert as defense in depth and protects future consumers too.
//
// Invariant: the payload must remain HTML-inert. Any '<' would be a live tag
// opening if a consumer regressed; script-bearing URL schemes could become a
// sink if a URL attribute interpolation is added. Prose characters ('>', '&',
// quotes) are explicitly allowed.
//
// If this check fails: fix the DATA, not the checker. Do not widen the allow
// list to make a dirty payload pass.

const fs = require('node:fs');
const path = require('node:path');
const { parseJsonNoDuplicateKeys } = require('./lib/ct42-runtime-rollback-review');

const ROOT = path.resolve(__dirname, '..');
const PAYLOAD_PATH = 'data/carbon-projects.json';

const FORBIDDEN_PATTERNS = [
  { pattern: /</, reason: 'tag-opening "<" would be live markup at innerHTML render' },
  { pattern: /javascript:/i, reason: '"javascript:" scheme is a script-URL sink' },
  { pattern: /vbscript:/i, reason: '"vbscript:" scheme is a legacy script-URL sink' },
  { pattern: /\bdata:/i, reason: '"data:" URI is an active-content sink' },
];

// The WHATWG URL parser removes ASCII tab/newline characters before scheme
// parsing. Apply the same normalization before the defense-in-depth blacklist
// so values such as "java\\nscript:" cannot become active only at the sink.
const URL_SCHEME_IGNORABLE_CONTROLS = /[\u0009\u000A\u000D]/g;

function collectViolations(node, location, violations) {
  if (typeof node === 'string') {
    const normalized = node.replace(URL_SCHEME_IGNORABLE_CONTROLS, '');
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (pattern.test(normalized)) {
        violations.push({ location, reason });
      }
    }
  } else if (Array.isArray(node)) {
    node.forEach((entry, index) => collectViolations(entry, `${location}[${index}]`, violations));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      collectViolations(key, `${location}{key:${JSON.stringify(key)}}`, violations);
      collectViolations(value, `${location}.${key}`, violations);
    }
  }
}

function checkPayload(sourceRoot) {
  const absolute = path.join(sourceRoot, PAYLOAD_PATH);
  const source = fs.readFileSync(absolute, 'utf8');
  let parsed;
  try {
    // Validate duplicate keys with the release parser, but scan JSON.parse's
    // result. JSON.parse preserves "__proto__" as an enumerable own property;
    // the validator's ordinary-object assignments intentionally are not used
    // as the security walk input.
    parseJsonNoDuplicateKeys(source, PAYLOAD_PATH);
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`${PAYLOAD_PATH} is not strict duplicate-free JSON: ${error.message}`);
  }

  const violations = [];
  collectViolations(parsed, '$', violations);

  if (violations.length > 0) {
    const details = violations.slice(0, 10)
      .map(v => `  ${v.location}: ${v.reason}`)
      .join('\n');
    throw new Error(
      `${PAYLOAD_PATH} failed HTML-inert hygiene (${violations.length} violation(s)).\n` +
      `Fix the payload. Do not relax this checker.\n${details}` +
      (violations.length > 10 ? `\n  ...and ${violations.length - 10} more` : '')
    );
  }
  return parsed;
}

function selfTest() {
  const assert = require('node:assert/strict');
  const os = require('node:os');

  const run = source => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-hygiene-'));
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'data', 'carbon-projects.json'), source);
    try {
      return checkPayload(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  // Clean payloads pass, including prose with > & quotes.
  run(JSON.stringify({ data: { TST: { name: "St. Vincent's > R&D", icon: '🌱' } } }));

  // Tag opening fails.
  assert.throws(() => run(JSON.stringify({ data: { TST: { narrative: 'fine <img src=x onerror=alert(1)>' } } })), /failed HTML-inert hygiene/);
  assert.throws(() => run(JSON.stringify({ data: { TST: { sandbox: [{ label: '<script>' }] } } })), /tag-opening/);
  assert.throws(() => run(JSON.stringify({ data: { '<unsafe>': { name: 'key' } } })), /tag-opening/);

  // JSON magic keys remain enumerable scan inputs rather than mutating the
  // security walker's prototype and disappearing from Object.entries().
  assert.throws(() => run('{"data":{"TST":{"__proto__":{"html":"<script>"}}}}'), /tag-opening/);
  assert.throws(() => run('{"data":{"TST":{"__proto__":{"url":"javascript:alert(1)"}}}}'), /javascript:/);

  // Script-bearing schemes fail, including nested arrays and non-obvious case.
  assert.throws(() => run(JSON.stringify({ data: { TST: { connection: 'JAVASCRIPT:alert(1)' } } })), /javascript:/);
  assert.throws(() => run(JSON.stringify({ data: { TST: { links: ['vbscript:msgbox(1)'] } } })), /vbscript:/);
  assert.throws(() => run(JSON.stringify({ data: { TST: { links: ['data:image/png;base64,AAAA'] } } })), /"data:"/);
  assert.throws(() => run('{"data":{"TST":{"u":"java\\nscript:alert(1)"}}}'), /javascript:/);
  assert.throws(() => run('{"data":{"TST":{"u":"da\\tta:text/plain,active"}}}'), /"data:"/);

  // Duplicate keys fail via strict parsing.
  assert.throws(() => run('{"data":{"TST":{"name":"a","name":"b"}}}'), /duplicate/i);
}

module.exports = { checkPayload, selfTest };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') {
    selfTest();
    process.stdout.write('Carbon project data hygiene self-test: PASS\n');
  } else if (args.length === 0) {
    const parsed = checkPayload(ROOT);
    const siteCount = parsed?.data ? Object.keys(parsed.data).length : 0;
    process.stdout.write(`Carbon project data hygiene: PASS (${siteCount} sites, HTML-inert)\n`);
  } else {
    process.stderr.write('Usage: node tools/check-carbon-project-data-hygiene.js [--self-test]\n');
    process.exitCode = 2;
  }
}
