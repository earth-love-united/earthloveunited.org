#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_ORIGIN = 'https://earthloveunited.org/';
const REQUIRED_HSTS_MAX_AGE = 31536000;
const HSTS_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const HSTS_QUOTED_STRING = /^"(?:[\t !#-\[\]-~]|\\[\t -~])*"$/;

function fail(message) {
  throw new Error(message);
}

function readRegular(root, relative) {
  const absoluteRoot = path.resolve(root);
  const absolute = path.join(absoluteRoot, relative);
  const normalized = path.relative(absoluteRoot, absolute);
  if (!normalized || normalized.startsWith('..' + path.sep) || path.isAbsolute(normalized)) {
    fail('unsafe hardening path: ' + relative);
  }
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) fail('hardening input must be a regular file: ' + relative);
  return fs.readFileSync(absolute, 'utf8');
}

function parseHeaderBlocks(source) {
  const blocks = new Map();
  let active = null;
  source.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    if (!/^\s/.test(line)) {
      active = trimmed;
      if (!blocks.has(active)) blocks.set(active, []);
      return;
    }
    if (active) blocks.get(active).push(trimmed);
  });
  return blocks;
}

function splitHstsDirectives(policy) {
  if (typeof policy !== 'string' || /[\r\n]/.test(policy)) fail('HSTS policy must be one header-field value');
  const directives = [];
  let current = '';
  let quoted = false;
  let escaped = false;

  for (const character of policy) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (quoted && character === '\\') {
      current += character;
      escaped = true;
    } else if (character === '"') {
      current += character;
      quoted = !quoted;
    } else if (character === ';' && !quoted) {
      directives.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }

  if (quoted || escaped) fail('HSTS policy contains an unterminated quoted-string');
  directives.push(current.trim());
  if (directives.some(directive => directive.length === 0)) fail('HSTS policy contains an empty directive');
  return directives;
}

function parseHstsPolicy(policy) {
  const directives = new Map();
  for (const rawDirective of splitHstsDirectives(policy)) {
    const equals = rawDirective.indexOf('=');
    const name = (equals === -1 ? rawDirective : rawDirective.slice(0, equals)).trim();
    const value = equals === -1 ? null : rawDirective.slice(equals + 1).trim();
    if (!HSTS_TOKEN.test(name)) fail('HSTS policy contains a malformed directive name');
    if (value !== null && (!value || (!HSTS_TOKEN.test(value) && !HSTS_QUOTED_STRING.test(value)))) {
      fail('HSTS policy contains a malformed directive value: ' + name);
    }

    const normalizedName = name.toLowerCase();
    if (directives.has(normalizedName)) fail('HSTS policy contains a duplicate directive: ' + name);
    directives.set(normalizedName, value);
  }

  const maxAgeValue = directives.get('max-age');
  if (typeof maxAgeValue !== 'string' || !/^\d+$/.test(maxAgeValue)) {
    fail('HSTS max-age must appear exactly once with an unquoted decimal value');
  }
  const maxAge = Number(maxAgeValue);
  if (!Number.isSafeInteger(maxAge)) fail('HSTS max-age must be a safe decimal integer');
  if (directives.has('includesubdomains') && directives.get('includesubdomains') !== null) {
    fail('HSTS includeSubDomains directive must not have a value');
  }
  return { directives, maxAge };
}

function checkPublicEdgeHardening(root) {
  const notFound = readRegular(root, '404.html');
  const robots = readRegular(root, 'robots.txt');
  const sitemap = readRegular(root, 'sitemap.xml');
  const index = readRegular(root, 'index.html');
  const headers = readRegular(root, '_headers');
  const wranglerSource = readRegular(root, 'wrangler.jsonc');

  let wrangler;
  try { wrangler = JSON.parse(wranglerSource); }
  catch (error) { fail('wrangler.jsonc must remain strict JSON: ' + error.message); }
  if (wrangler?.assets?.directory !== './_deploy' || wrangler?.assets?.not_found_handling !== '404-page') {
    fail('Cloudflare assets must serve _deploy/ with real 404-page handling');
  }

  if (!/<meta\s+name=["']robots["']\s+content=["'][^"']*\bnoindex\b[^"']*["']\s*\/?\s*>/i.test(notFound)) {
    fail('404.html must remain noindex');
  }
  if (!/<a\b[^>]*\bhref=["']\/["'][^>]*>/i.test(notFound)) {
    fail('404.html must retain a root recovery link');
  }

  const robotLines = robots.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!robotLines.includes('User-agent: *') || !robotLines.includes('Allow: /')) {
    fail('robots.txt must allow the public root');
  }
  const sitemapDirectives = robotLines.filter(line => /^Sitemap:/i.test(line));
  if (sitemapDirectives.length !== 1 || sitemapDirectives[0] !== 'Sitemap: ' + CANONICAL_ORIGIN + 'sitemap.xml') {
    fail('robots.txt must expose exactly the canonical sitemap URL');
  }

  const sitemapLocations = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(match => match[1]);
  if (sitemapLocations.length !== 1 || sitemapLocations[0] !== CANONICAL_ORIGIN) {
    fail('sitemap.xml must contain exactly the canonical root URL');
  }

  const canonicalLinks = [...index.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?\s*>/gi)]
    .map(match => match[1]);
  if (canonicalLinks.length !== 1 || canonicalLinks[0] !== CANONICAL_ORIGIN) {
    fail('index.html must contain exactly one canonical root link');
  }

  const blocks = parseHeaderBlocks(headers);
  const hstsHeaders = [...blocks.entries()].flatMap(([route, values]) => values
    .filter(value => /^Strict-Transport-Security:/i.test(value))
    .map(value => ({ route, value })));
  if (hstsHeaders.length !== 1 || hstsHeaders[0].route !== '/*') {
    fail('HSTS must be declared exactly once on the global /* route');
  }
  const policy = hstsHeaders[0].value.slice(hstsHeaders[0].value.indexOf(':') + 1);
  const parsedHsts = parseHstsPolicy(policy);
  if (parsedHsts.maxAge < REQUIRED_HSTS_MAX_AGE) {
    fail('HSTS max-age must be at least one year');
  }

  return {
    status: 'pass',
    checks: 6,
    hsts_max_age: parsedHsts.maxAge,
    canonical_origin: CANONICAL_ORIGIN,
  };
}

function selfTest() {
  const fixtures = {
    '404.html': '<!doctype html><meta name="robots" content="noindex, follow"><a href="/">Home</a>\n',
    'robots.txt': 'User-agent: *\nAllow: /\n\nSitemap: https://earthloveunited.org/sitemap.xml\n',
    'sitemap.xml': '<urlset><url><loc>https://earthloveunited.org/</loc></url></urlset>\n',
    'index.html': '<!doctype html><link rel="canonical" href="https://earthloveunited.org/">\n',
    '_headers': '/*\n  Strict-Transport-Security: max-age=31536000; includeSubDomains; extension="quoted;value"\n',
    'wrangler.jsonc': '{"assets":{"directory":"./_deploy","not_found_handling":"404-page"}}\n',
  };

  const makeFixture = () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-edge-hardening-'));
    Object.entries(fixtures).forEach(([relative, content]) => fs.writeFileSync(path.join(root, relative), content));
    return root;
  };
  let rejected = 0;
  const mutate = (relative, replacement, expected) => {
    const root = makeFixture();
    try {
      fs.writeFileSync(path.join(root, relative), replacement);
      assert.throws(() => checkPublicEdgeHardening(root), expected);
      rejected += 1;
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };

  const clean = makeFixture();
  try { assert.equal(checkPublicEdgeHardening(clean).status, 'pass'); }
  finally { fs.rmSync(clean, { recursive: true, force: true }); }

  mutate('wrangler.jsonc', '{"assets":{"directory":"./_deploy","not_found_handling":"single-page-application"}}', /real 404-page/);
  mutate('404.html', '<a href="/">Home</a>', /noindex/);
  mutate('robots.txt', 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n', /canonical sitemap/);
  mutate('sitemap.xml', '<urlset><url><loc>https://example.com/</loc></url></urlset>', /canonical root/);
  mutate('index.html', '<!doctype html>', /canonical root link/);
  mutate('_headers', '/*\n  Strict-Transport-Security: max-age=0\n', /at least one year/);
  mutate('_headers', '/*\n  Strict-Transport-Security: max-age=31536000; max-age=0\n', /duplicate directive/);
  mutate('_headers', '/*\n  Strict-Transport-Security: max-age=31536000; includeSubDomains; includeSubDomains\n', /duplicate directive/);
  mutate('_headers', '/*\n  Strict-Transport-Security: max-age="31536000"\n', /unquoted decimal/);
  mutate('_headers', '/*\n  Strict-Transport-Security: max-age=31536000oops\n', /unquoted decimal/);
  mutate('_headers', '/*\n  Strict-Transport-Security: max-age=31536000;; includeSubDomains\n', /empty directive/);
  mutate('_headers', '/*\n  Strict-Transport-Security: max-age=31536000; includeSubDomains=1\n', /must not have a value/);
  mutate('_headers', '/*\n  Strict-Transport-Security: max-age=31536000, max-age=0\n', /malformed directive value/);
  return rejected;
}

module.exports = { checkPublicEdgeHardening, parseHeaderBlocks, parseHstsPolicy, selfTest };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') {
    const rejected = selfTest();
    process.stdout.write(`Public edge hardening self-test: PASS (${rejected} fail-closed mutations)\n`);
  } else if (args.length === 0) {
    const result = checkPublicEdgeHardening(ROOT);
    process.stdout.write(`Public edge hardening: PASS (${result.checks} checks; HSTS max-age=${result.hsts_max_age}; canonical=${result.canonical_origin})\n`);
  } else {
    process.stderr.write('Usage: node tools/check-public-edge-hardening.js [--self-test]\n');
    process.exitCode = 2;
  }
}
