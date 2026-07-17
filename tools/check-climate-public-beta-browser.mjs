#!/usr/bin/env node

import { chromium } from 'playwright';

const expectedOrigin = process.argv[2] || 'http://127.0.0.1:8001';
const base = new URL('/', expectedOrigin);
if (!['127.0.0.1', 'localhost'].includes(base.hostname) || base.protocol !== 'http:') {
  throw new Error('engineering browser smoke accepts only a local HTTP origin');
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 320, height: 800 },
  });
  const page = await context.newPage();
  const requests = [];
  const unexpectedConsole = [];
  page.on('request', request => requests.push(request.url()));
  page.on('pageerror', error => unexpectedConsole.push('pageerror: ' + error.message));
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type()) && !/Failed to load resource/.test(message.text())) {
      unexpectedConsole.push(message.type() + ': ' + message.text());
    }
  });

  await page.goto(base.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForFunction(() => {
    const panel = document.getElementById('release-error');
    return panel && panel.hidden === false;
  }, null, { timeout: 15000 });

  const state = await page.evaluate(() => ({
    title: document.title,
    h1Count: document.querySelectorAll('h1').length,
    errorVisible: document.getElementById('release-error')?.hidden === false,
    errorText: document.getElementById('release-error-message')?.textContent,
    browserHidden: document.getElementById('evidence-browser')?.hidden === true,
    recordRows: document.querySelectorAll('#evidence-rows tr').length,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    activeFeedbackLinks: ['methodology-feedback', 'methodology-feedback-privacy', 'detail-feedback',
      'detail-feedback-privacy', 'footer-feedback'].filter(id => document.getElementById(id)?.hasAttribute('href')),
    feedbackStates: ['methodology-feedback', 'methodology-feedback-privacy', 'detail-feedback',
      'detail-feedback-privacy', 'footer-feedback'].map(id => ({
        id,
        disabled: document.getElementById(id)?.getAttribute('aria-disabled'),
        tabIndex: document.getElementById(id)?.tabIndex,
      })),
    runtimeState: window.CLIMATE_PUBLIC_BETA?.getState?.() || null,
    serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
  }));

  if (state.title !== 'Climate Public Beta | Earth Love United' || state.h1Count !== 1) {
    throw new Error('beta page identity or heading structure drifted');
  }
  if (!state.errorVisible || !state.browserHidden || state.recordRows !== 0 ||
      state.runtimeState?.status !== 'failed' || state.runtimeState?.failure_code !== 'artifact-fetch-failed') {
    throw new Error('missing runtime manifest must produce the exact visible fail-closed state');
  }
  if (state.horizontalOverflow) throw new Error('beta page overflows horizontally at 320 CSS pixels');
  if (state.activeFeedbackLinks.length || state.feedbackStates.some(item => item.disabled !== 'true' || item.tabIndex !== -1)) {
    throw new Error('feedback links became actionable without reviewed privacy/route decisions');
  }
  if (state.serviceWorkerController) throw new Error('beta engineering origin is controlled by a service worker');
  if (unexpectedConsole.length) throw new Error('beta browser console errors: ' + unexpectedConsole.join('; '));

  const unexpectedOrigins = [...new Set(requests.map(value => new URL(value).origin))]
    .filter(origin => origin !== base.origin);
  if (unexpectedOrigins.length) throw new Error('beta made automatic cross-origin requests: ' + unexpectedOrigins.join(', '));

  const serviceWorkerProbe = await context.request.get(new URL('/sw.js', base).href, { failOnStatusCode: false });
  if (serviceWorkerProbe.status() !== 404) throw new Error('/sw.js must be absent on the isolated beta origin');

  process.stdout.write(
    `Climate public-beta browser smoke: PASS (320px; fail closed; ${requests.length} same-origin requests; /sw.js 404)\n`,
  );
} finally {
  await browser.close();
}
