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

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/') {
      assert.equal(pendingTail, null, 'stream cases must run sequentially');
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
    const releaseTail = () => {
      assert.ok(pendingTail, 'server must retain the streamed tail until the test releases it');
      const tail = pendingTail;
      pendingTail = null;
      tail.response.end(tail.finalChunk);
    };
    const activationResults = {};

    for (const activation of ['pointer', 'enter', 'space']) {
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
      assert.equal(before.bridge, true, `${activation}: capture bridge must exist by first contentful paint`);
      assert.equal(before.appBound, false, `${activation}: stream tail must still hold the deferred App runtime`);
      assert.equal(before.documentState, 'loading', `${activation}: document must still be streaming at the interaction boundary`);

      if (activation === 'pointer') await button.click();
      else {
        await button.focus();
        await button.press(activation === 'enter' ? 'Enter' : 'Space');
      }
      const after = await page.evaluate(() => ({
        appBound: window.App?._staticActionsBound === true,
        busy: document.querySelector('.enter-btn')?.getAttribute('aria-busy') || null,
        disabled: document.querySelector('.enter-btn')?.disabled === true,
        globeMode: document.body.classList.contains('globe-mode'),
        pending: window.__ELU_EARLY_GLOBE__?.pending === true,
        requestedAt: window.__ELU_EARLY_GLOBE__?.requestedAt || null,
        status: document.getElementById('app-readiness-status')?.textContent || '',
      }));
      assert.equal(after.appBound, false, `${activation}: stream tail must remain paused through activation`);
      assert.equal(after.pending, true, `${activation}: first-paint activation must queue while the document is still streaming`);
      assert.equal(after.busy, 'true', `${activation}: first-paint activation must expose an immediate busy state`);
      assert.equal(after.disabled, true, `${activation}: first-paint activation must prevent duplicates`);
      assert.equal(after.globeMode, false, `${activation}: hero must remain stable until exact evidence and renderer readiness`);
      assert.ok(Number.isFinite(after.requestedAt), `${activation}: activation must retain an exact request timestamp`);
      assert.match(after.status, /Loading verified country evidence/, `${activation}: activation must announce its queued state`);

      releaseTail();
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await page.waitForFunction(() => window.App?._staticActionsBound === true && window.__ELU_EARLY_GLOBE__?.pending === false, null, { timeout: 15000 });
      await page.waitForFunction(() => (
        document.body.classList.contains('globe-mode') &&
        document.querySelectorAll('#globeViz canvas').length === 1
      ), null, { timeout: 30000 });
      await page.evaluate(() => window.App.exitGlobe());
      await page.waitForFunction(() => !document.body.classList.contains('globe-mode'), null, { timeout: 5000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const afterExit = await page.evaluate(() => ({
        openerRestored: document.activeElement?.matches?.('.enter-btn[data-action="enterGlobe"]') === true,
        topbarAriaHidden: document.getElementById('topbar')?.getAttribute('aria-hidden') || null,
        topbarInert: document.getElementById('topbar')?.hasAttribute('inert') === true,
      }));
      assert.equal(afterExit.openerRestored, true, `${activation}: globe exit must restore the exact streamed CTA opener`);
      assert.equal(afterExit.topbarInert, true, `${activation}: globe exit must make the hidden topbar inert`);
      assert.equal(afterExit.topbarAriaHidden, 'true', `${activation}: globe exit must hide the topbar from the accessibility tree`);
      assert.deepEqual(pageErrors, [], `${activation}: streamed first-paint path emitted page errors: ${pageErrors.join('; ')}`);
      activationResults[activation] = { before, after, after_exit: afterExit };
      await page.close();
    }

    const focusPage = await context.newPage();
    const focusErrors = [];
    focusPage.on('pageerror', error => focusErrors.push(error.message));
    await focusPage.goto(url, { waitUntil: 'commit', timeout: 15000 });
    await focusPage.locator('.enter-btn[data-action="enterGlobe"]').waitFor({ state: 'visible', timeout: 10000 });
    releaseTail();
    await focusPage.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await focusPage.waitForFunction(() => window.App?._staticActionsBound === true, null, { timeout: 15000 });
    const topbarState = await focusPage.evaluate(() => {
      const topbar = document.getElementById('topbar');
      return {
        ariaHidden: topbar?.getAttribute('aria-hidden') || null,
        inert: topbar?.hasAttribute('inert') === true,
      };
    });
    assert.equal(topbarState.inert, true, 'Foundation view must keep the invisible topbar inert');
    assert.equal(topbarState.ariaHidden, 'true', 'Foundation view must keep the invisible topbar out of the accessibility tree');
    await focusPage.locator('.enter-btn[data-action="enterGlobe"]').focus();
    const foundationFocusTrail = [];
    for (let index = 0; index < 8; index += 1) {
      await focusPage.keyboard.press('Tab');
      foundationFocusTrail.push(await focusPage.evaluate(() => ({
        id: document.activeElement?.id || null,
        inTopbar: document.activeElement?.closest?.('#topbar') != null,
        tag: document.activeElement?.tagName || null,
      })));
    }
    assert.equal(foundationFocusTrail.some(entry => entry.inTopbar), false, 'Foundation Tab order must skip every invisible topbar control');
    await focusPage.locator('.enter-btn[data-action="enterGlobe"]').focus();
    assert.equal(await focusPage.evaluate(() => window.App.enterGlobe()), true, 'normal globe entry must remain available after the focus-order check');
    await focusPage.waitForFunction(() => document.body.classList.contains('globe-mode'), null, { timeout: 15000 });
    const globeTopbarState = await focusPage.evaluate(() => {
      const topbar = document.getElementById('topbar');
      return {
        ariaHidden: topbar?.getAttribute('aria-hidden') || null,
        inert: topbar?.hasAttribute('inert') === true,
      };
    });
    assert.equal(globeTopbarState.inert, false, 'globe mode must restore topbar focusability');
    assert.equal(globeTopbarState.ariaHidden, null, 'globe mode must restore topbar accessibility-tree visibility');
    await focusPage.locator('#globe-theme-toggle').focus();
    assert.equal(await focusPage.evaluate(() => document.activeElement?.id), 'globe-theme-toggle', 'visible globe topbar control must accept focus');
    await focusPage.evaluate(() => window.App.exitGlobe());
    await focusPage.waitForFunction(() => !document.body.classList.contains('globe-mode'), null, { timeout: 5000 });
    await focusPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const returnedTopbarState = await focusPage.evaluate(() => {
      const topbar = document.getElementById('topbar');
      const active = document.activeElement;
      return {
        ariaHidden: topbar?.getAttribute('aria-hidden') || null,
        inert: topbar?.hasAttribute('inert') === true,
        openerRestored: active?.matches?.('.enter-btn[data-action="enterGlobe"]') === true,
      };
    });
    assert.equal(returnedTopbarState.inert, true, 'globe exit must make the hidden topbar inert again');
    assert.equal(returnedTopbarState.ariaHidden, 'true', 'globe exit must hide the topbar from the accessibility tree again');
    assert.equal(returnedTopbarState.openerRestored, true, 'globe exit must restore focus to the Foundation opener');
    assert.deepEqual(focusErrors, [], `Foundation focus path emitted page errors: ${focusErrors.join('; ')}`);
    await focusPage.close();

    process.stdout.write(`${JSON.stringify({
      ok: true,
      root: SERVED_ROOT,
      streamed_bytes_before_tail: Buffer.byteLength(firstChunk),
      bridge_byte_offset: bridgeAt,
      hero_byte_offset: heroAt,
      activation_results: activationResults,
      foundation_topbar: topbarState,
      foundation_focus_trail: foundationFocusTrail,
      globe_topbar: globeTopbarState,
      returned_topbar: returnedTopbarState,
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
