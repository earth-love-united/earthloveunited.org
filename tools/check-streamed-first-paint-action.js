#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const playwrightModule = process.env.ELU_PLAYWRIGHT_MODULE || 'playwright';
const chromeExecutable = process.env.ELU_CHROME_EXECUTABLE || null;
const { chromium } = require(playwrightModule);

const ROOT = path.resolve(__dirname, '..');
const rootIndex = process.argv.indexOf('--root');
const SERVED_ROOT = rootIndex === -1 ? ROOT : path.resolve(process.argv[rootIndex + 1] || '');
const INDEX_PATH = path.join(SERVED_ROOT, 'index.html');
const SPLIT_MARKER = '<!-- ═══ TOP BAR ═══ -->';
const HERO_MARKER = '<button class="enter-btn glass-btn" data-action="enterGlobe">';
const BRIDGE_MARKER = 'window.__ELU_EARLY_GLOBE__';

const MIME_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
});

function resolveRequestPath(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
  const resolved = path.resolve(SERVED_ROOT, relative);
  if (resolved !== SERVED_ROOT && !resolved.startsWith(`${SERVED_ROOT}${path.sep}`)) return null;
  return resolved;
}

async function main() {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const bridgeAt = html.indexOf(BRIDGE_MARKER);
  const heroAt = html.indexOf(HERO_MARKER);
  const splitAt = html.indexOf(SPLIT_MARKER);
  assert.ok(bridgeAt >= 0 && heroAt >= 0 && splitAt >= 0, 'stream markers must exist exactly on the production document');
  assert.ok(bridgeAt < heroAt && heroAt < splitAt, 'capture bridge must precede the visible CTA and streamed tail');

  const firstChunk = html.slice(0, splitAt);
  const finalChunk = html.slice(splitAt);
  let pendingTail = null;
  let streamClaimed = false;

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/' && !streamClaimed) {
      streamClaimed = true;
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/html; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      });
      response.flushHeaders();
      response.write(firstChunk);
      pendingTail = { response, finalChunk };
      return;
    }

    const filePath = resolveRequestPath(url.pathname);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('not found');
      return;
    }
    const bytes = fs.readFileSync(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': bytes.length,
      'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    response.end(bytes);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/`;
  let browser = null;
  let context = null;

  try {
    browser = await chromium.launch({
      headless: true,
      ...(chromeExecutable ? { executablePath: chromeExecutable } : {}),
    });
    context = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 412, height: 823 },
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(url, { waitUntil: 'commit', timeout: 15000 });
    const button = page.locator('.enter-btn[data-action="enterGlobe"]');
    await button.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, null, { timeout: 10000 });

    const before = await page.evaluate(() => ({
      appBound: window.App?._staticActionsBound === true,
      bridge: Boolean(window.__ELU_EARLY_GLOBE__),
      documentState: document.readyState,
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null,
      now: performance.now(),
    }));
    assert.equal(before.bridge, true, 'capture bridge must exist by first contentful paint');
    assert.equal(before.appBound, false, 'stream tail must still hold the deferred App runtime');
    assert.equal(before.documentState, 'loading', 'document must still be streaming at the interaction boundary');

    await button.click();
    const after = await page.evaluate(() => ({
      appBound: window.App?._staticActionsBound === true,
      busy: document.querySelector('.enter-btn')?.getAttribute('aria-busy') || null,
      disabled: document.querySelector('.enter-btn')?.disabled === true,
      globeMode: document.body.classList.contains('globe-mode'),
      pending: window.__ELU_EARLY_GLOBE__?.pending === true,
      requestedAt: window.__ELU_EARLY_GLOBE__?.requestedAt || null,
      status: document.getElementById('app-readiness-status')?.textContent || '',
    }));
    assert.equal(after.appBound, false, 'stream tail must remain paused through the first click');
    assert.equal(after.pending, true, 'first-paint click must queue while the document is still streaming');
    assert.equal(after.busy, 'true', 'first-paint click must expose an immediate busy state');
    assert.equal(after.disabled, true, 'first-paint click must prevent duplicate activation');
    assert.equal(after.globeMode, false, 'hero must remain stable until exact evidence and renderer readiness');
    assert.ok(Number.isFinite(after.requestedAt), 'first-paint click must retain an exact request timestamp');
    assert.match(after.status, /Loading verified country evidence/, 'first-paint click must announce its queued state');

    assert.ok(pendingTail, 'server must retain the streamed tail until after the interaction assertion');
    pendingTail.response.end(pendingTail.finalChunk);
    pendingTail = null;
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForFunction(() => window.App?._staticActionsBound === true && window.__ELU_EARLY_GLOBE__?.pending === false, null, { timeout: 15000 });
    assert.deepEqual(pageErrors, [], `streamed first-paint path emitted page errors: ${pageErrors.join('; ')}`);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      root: SERVED_ROOT,
      streamed_bytes_before_tail: Buffer.byteLength(firstChunk),
      bridge_byte_offset: bridgeAt,
      hero_byte_offset: heroAt,
      before,
      after,
    }, null, 2)}\n`);
  } finally {
    if (pendingTail) pendingTail.response.destroy();
    if (context) await context.close();
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
