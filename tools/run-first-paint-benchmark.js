#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const baselineUrl = argument('baseline');
const candidateUrl = argument('candidate');
const baselineCommit = argument('baseline-commit');
const candidateCommit = argument('candidate-commit');
const outputPath = argument('output');
const runsPerSubject = Number(argument('runs', '6'));
const resumePath = argument('resume');
const playwrightModule = process.env.ELU_PLAYWRIGHT_MODULE || 'playwright';

if (!baselineUrl || !candidateUrl || !baselineCommit || !candidateCommit || !outputPath) {
  throw new Error('usage: run-first-paint-benchmark.js --baseline URL --candidate URL --baseline-commit SHA --candidate-commit SHA --output PATH [--runs 6]');
}
if (!Number.isInteger(runsPerSubject) || runsPerSubject < 3 || runsPerSubject % 2 !== 0) {
  throw new Error('--runs must be an even integer of at least 4 per subject');
}
if (![baselineCommit, candidateCommit].every(value => /^[a-f0-9]{40}$/.test(value))) {
  throw new Error('baseline and candidate commits must be full lowercase SHA-1 values');
}

const { chromium } = require(playwrightModule);
const chromeExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const measurementWindowMs = 8500;
const thresholds = Object.freeze({ fcp_ms: 1800, lcp_ms: 2500, cls: 0.1, tbt_ms: 200 });
const weights = Object.freeze({ fcp: 0.20, lcp: 0.45, cls: 0.25, tbt: 0.10 });

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function quantile(values, probability) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function stats(values, digits = 3) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return {
    samples: values.length,
    min: round(Math.min(...values), digits),
    p25: round(quantile(values, 0.25), digits),
    median: round(quantile(values, 0.5), digits),
    p75: round(quantile(values, 0.75), digits),
    max: round(Math.max(...values), digits),
    mean: round(mean, digits),
    population_stddev: round(Math.sqrt(variance), digits),
  };
}

function thresholdLoss(metrics) {
  return 100 * (
    weights.lcp * Math.max(0, metrics.lcp_ms / thresholds.lcp_ms - 1) +
    weights.cls * Math.max(0, metrics.cls / thresholds.cls - 1) +
    weights.fcp * Math.max(0, metrics.fcp_ms / thresholds.fcp_ms - 1) +
    weights.tbt * Math.max(0, metrics.tbt_ms / thresholds.tbt_ms - 1)
  );
}

function calculationHash(document) {
  const copy = structuredClone(document);
  copy.calculation_hash = null;
  return crypto.createHash('sha256').update(JSON.stringify(copy)).digest('hex');
}

function header(headers, name) {
  const wanted = name.toLowerCase();
  const key = Object.keys(headers || {}).find(candidate => candidate.toLowerCase() === wanted);
  return key ? String(headers[key]) : null;
}

async function servedResource(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`unable to fetch ${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    url,
    status: response.status,
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    content_type: response.headers.get('content-type'),
    content_encoding: response.headers.get('content-encoding'),
    content_length: Number(response.headers.get('content-length')) || null,
    server: response.headers.get('server'),
  };
}

async function runLanding(subject, subjectRun, orderIndex, targetUrl) {
  const browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true,
    args: [
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
    ],
  });
  const browserVersion = browser.version();
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    hasTouch: true,
    isMobile: true,
    serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (Linux; Android 11; Moto G Power) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0 Mobile Safari/537.36',
  });
  const origin = new URL(targetUrl).origin;
  const blockedExternal = [];
  await context.route('**/*', route => {
    const requestUrl = route.request().url();
    let requestOrigin = null;
    try { requestOrigin = new URL(requestUrl).origin; } catch (_) { /* non-URL request */ }
    if (requestOrigin && requestOrigin !== origin && /^https?:/.test(requestUrl)) {
      blockedExternal.push(requestUrl);
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const requests = new Map();
  let navigationTimestamp = null;
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error && error.message ? error.message : error)));

  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: Math.floor(1.6 * 1024 * 1024 / 8),
    uploadThroughput: Math.floor(750 * 1024 / 8),
    connectionType: 'cellular4g',
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  cdp.on('Network.requestWillBeSent', event => {
    if (navigationTimestamp === null && event.type === 'Document') navigationTimestamp = event.timestamp;
    requests.set(event.requestId, {
      request_id: event.requestId,
      url: event.request.url,
      method: event.request.method,
      resource_type: event.type,
      priority: event.request.initialPriority || null,
      timestamp: event.timestamp,
      response: null,
      completed: false,
      failed: false,
      encoded_data_bytes: null,
    });
  });
  cdp.on('Network.responseReceived', event => {
    const item = requests.get(event.requestId);
    if (!item) return;
    item.response = {
      status: event.response.status,
      mime_type: event.response.mimeType,
      protocol: event.response.protocol,
      from_disk_cache: Boolean(event.response.fromDiskCache),
      from_service_worker: Boolean(event.response.fromServiceWorker),
      server: header(event.response.headers, 'server'),
      content_encoding: header(event.response.headers, 'content-encoding'),
      content_length: Number(header(event.response.headers, 'content-length')) || null,
    };
  });
  cdp.on('Network.loadingFinished', event => {
    const item = requests.get(event.requestId);
    if (!item) return;
    item.completed = true;
    item.encoded_data_bytes = round(event.encodedDataLength, 0);
  });
  cdp.on('Network.loadingFailed', event => {
    const item = requests.get(event.requestId);
    if (!item) return;
    item.failed = true;
    item.failure = event.errorText;
    item.canceled = Boolean(event.canceled);
  });

  await page.addInitScript(() => {
    window.__eluBenchmark = { lcp: [], layoutShifts: [], longTasks: [] };
    try {
      new PerformanceObserver(list => list.getEntries().forEach(entry => {
        window.__eluBenchmark.lcp.push({
          startTime: entry.startTime,
          renderTime: entry.renderTime,
          loadTime: entry.loadTime,
          size: entry.size,
          url: entry.url || null,
          element: entry.element ? {
            tag: entry.element.tagName,
            id: entry.element.id || null,
            className: typeof entry.element.className === 'string' ? entry.element.className : null,
            htmlExcerpt: entry.element.outerHTML ? entry.element.outerHTML.slice(0, 240) : null,
          } : null,
        });
      })).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_) { /* unsupported metric */ }
    try {
      new PerformanceObserver(list => list.getEntries().forEach(entry => {
        window.__eluBenchmark.layoutShifts.push({
          startTime: entry.startTime,
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
        });
      })).observe({ type: 'layout-shift', buffered: true });
    } catch (_) { /* unsupported metric */ }
    try {
      new PerformanceObserver(list => list.getEntries().forEach(entry => {
        window.__eluBenchmark.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
      })).observe({ type: 'longtask', buffered: true });
    } catch (_) { /* unsupported metric */ }
  });

  let navigationError = null;
  try {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (error) {
    navigationError = error.message;
  }
  if (!navigationError) {
    await page.waitForFunction(cutoff => performance.now() >= cutoff, measurementWindowMs, { timeout: 30000 });
  }

  const observed = await page.evaluate(cutoff => {
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find(entry => entry.name === 'first-contentful-paint');
    const fp = paints.find(entry => entry.name === 'first-paint');
    const state = window.__eluBenchmark || { lcp: [], layoutShifts: [], longTasks: [] };
    const lcpEntries = state.lcp.filter(entry => entry.startTime <= cutoff);
    const lcp = lcpEntries.length ? lcpEntries[lcpEntries.length - 1] : null;
    const cls = state.layoutShifts
      .filter(entry => entry.startTime <= cutoff && !entry.hadRecentInput)
      .reduce((sum, entry) => sum + entry.value, 0);
    const fcpMs = fcp ? fcp.startTime : 0;
    const tbt = state.longTasks
      .filter(entry => entry.startTime >= fcpMs && entry.startTime <= cutoff)
      .reduce((sum, entry) => sum + Math.max(0, entry.duration - 50), 0);
    const logo = document.querySelector('.hero-foundation-logo img, .hero-foundation-logo');
    const logoImage = logo && logo.tagName === 'IMG' ? logo : logo && logo.querySelector ? logo.querySelector('img') : null;
    return {
      collected_at_ms: performance.now(),
      first_paint_ms: fp ? fp.startTime : 0,
      fcp_ms: fcpMs,
      lcp_ms: lcp ? lcp.startTime : 0,
      cls,
      tbt_ms: tbt,
      lcp_entry: lcp,
      lcp_entry_count: lcpEntries.length,
      layout_shift_entries: state.layoutShifts.filter(entry => entry.startTime <= cutoff),
      long_task_entries: state.longTasks.filter(entry => entry.startTime <= cutoff),
      hero_logo: logoImage ? {
        complete: logoImage.complete,
        natural_width: logoImage.naturalWidth,
        natural_height: logoImage.naturalHeight,
        current_src: logoImage.currentSrc,
        rendered: {
          tag: logoImage.tagName,
          id: logoImage.id || null,
          class_name: typeof logoImage.className === 'string' ? logoImage.className : null,
          html_excerpt: logoImage.outerHTML ? logoImage.outerHTML.slice(0, 240) : null,
        },
      } : null,
      document_ready_state: document.readyState,
      visibility_state: document.visibilityState,
    };
  }, measurementWindowMs);

  const ledger = [...requests.values()]
    .map(item => ({
      ...item,
      start_ms: navigationTimestamp === null ? null : round((item.timestamp - navigationTimestamp) * 1000),
    }))
    .filter(item => item.start_ms === null || item.start_ms <= measurementWindowMs)
    .map(({ timestamp, ...item }) => item)
    .sort((a, b) => (a.start_ms || 0) - (b.start_ms || 0));
  const completed = ledger.filter(item => item.completed);
  const metrics = {
    first_paint_ms: round(observed.first_paint_ms),
    fcp_ms: round(observed.fcp_ms),
    lcp_ms: round(observed.lcp_ms),
    cls: round(observed.cls, 6),
    tbt_ms: round(observed.tbt_ms),
  };
  const result = {
    order_index: orderIndex,
    subject,
    subject_run: subjectRun,
    target_url: targetUrl,
    browser_version: browserVersion,
    navigation_error: navigationError,
    measurement_window_ms: measurementWindowMs,
    metrics,
    threshold_loss: round(thresholdLoss(metrics), 6),
    lcp_entry: observed.lcp_entry,
    lcp_entry_count: observed.lcp_entry_count,
    hero_logo: observed.hero_logo,
    layout_shift_entries: observed.layout_shift_entries,
    long_task_entries: observed.long_task_entries,
    document_ready_state: observed.document_ready_state,
    visibility_state: observed.visibility_state,
    network_window: {
      scope: 'same_origin_only',
      request_count: ledger.length,
      completed_count: completed.length,
      incomplete_count: ledger.filter(item => !item.completed && !item.failed).length,
      failed_count: ledger.filter(item => item.failed).length,
      completed_encoded_bytes_lower_bound: completed.reduce((sum, item) => sum + (item.encoded_data_bytes || 0), 0),
      blocked_external_urls: [...new Set(blockedExternal)].sort(),
      ledger,
    },
    console_errors: consoleErrors,
    page_errors: pageErrors,
  };

  await context.close();
  await browser.close();
  return result;
}

async function runEarlyAction(targetUrl) {
  const browser = await chromium.launch({ executablePath: chromeExecutable, headless: true });
  const context = await browser.newContext({
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    hasTouch: true,
    isMobile: true,
    serviceWorkers: 'block',
  });
  const origin = new URL(targetUrl).origin;
  await context.route('**/*', async route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== origin && /^https?:/.test(requestUrl.protocol)) return route.abort('blockedbyclient');
    if (requestUrl.pathname === '/js/app.js') await new Promise(resolve => setTimeout(resolve, 1500));
    if (requestUrl.pathname === '/data/climate/runtime/country-climate-intelligence.json') {
      const response = await route.fetch();
      await new Promise(resolve => setTimeout(resolve, 4500));
      return route.fulfill({ response });
    }
    return route.continue();
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error && error.message ? error.message : error)));
  const navigation = page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[data-action="enterGlobe"]', { state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0, null, { timeout: 10000 });
  await page.waitForFunction(() => Boolean(window.__ELU_EARLY_GLOBE__), null, { timeout: 10000 });
  const early = await page.evaluate(async () => {
    const button = document.querySelector('[data-action="enterGlobe"]');
    const fcp = performance.getEntriesByName('first-contentful-paint')[0].startTime;
    const clickAt = performance.now();
    button.click();
    let acknowledgementAt = performance.now();
    while (performance.now() - clickAt < 1000 && button.getAttribute('aria-busy') !== 'true') {
      await new Promise(resolve => requestAnimationFrame(resolve));
      acknowledgementAt = performance.now();
    }
    return {
      fcp_ms: fcp,
      clicked_at_ms: clickAt,
      clicked_after_fcp_ms: clickAt - fcp,
      acknowledgement_ms: acknowledgementAt - clickAt,
      early_bridge_present: Boolean(window.__ELU_EARLY_GLOBE__),
      app_bound: Boolean(window.__ELU_EARLY_GLOBE__ && window.__ELU_EARLY_GLOBE__.appBound),
      pending_intent: Boolean(window.__ELU_EARLY_GLOBE__ && window.__ELU_EARLY_GLOBE__.pending),
      button_disabled: button.disabled,
      button_busy: button.getAttribute('aria-busy'),
      status_text: document.getElementById('app-readiness-status')?.textContent || '',
      globe_mode: document.body.classList.contains('globe-mode'),
    };
  });
  await navigation;
  let globeReady = true;
  try {
    await page.waitForFunction(() => (
      document.body.classList.contains('globe-mode') &&
      document.querySelectorAll('#globeViz canvas').length === 1
    ), null, { timeout: 30000 });
  } catch (_) {
    globeReady = false;
  }
  const final = await page.evaluate(() => ({
    ready_at_ms: performance.now(),
    globe_mode: document.body.classList.contains('globe-mode'),
    canvas_count: document.querySelectorAll('#globeViz canvas').length,
    style_ready: document.documentElement.dataset.globeStylesReady || null,
    button_busy: document.querySelector('[data-action="enterGlobe"]')?.getAttribute('aria-busy') || null,
    status_text: document.getElementById('app-readiness-status')?.textContent || '',
    data_state: window.Data && typeof window.Data.getState === 'function' ? window.Data.getState() : null,
  }));
  await context.close();
  await browser.close();
  return {
    method: 'unthrottled same-origin exact candidate archive with the SHA-pinned generated globe.gl dependency materialized; /js/app.js delayed 1500 ms; exact climate runtime delayed 4500 ms',
    early: Object.fromEntries(Object.entries(early).map(([key, value]) => [key, typeof value === 'number' ? round(value) : value])),
    globe_ready_before_timeout: globeReady,
    final: Object.fromEntries(Object.entries(final).map(([key, value]) => [key, typeof value === 'number' ? round(value) : value])),
    page_errors: pageErrors,
  };
}

function summarize(runs) {
  const result = {};
  for (const subject of ['baseline', 'candidate']) {
    const selected = runs.filter(run => run.subject === subject);
    result[subject] = {
      fcp_ms: stats(selected.map(run => run.metrics.fcp_ms)),
      lcp_ms: stats(selected.map(run => run.metrics.lcp_ms)),
      cls: stats(selected.map(run => run.metrics.cls), 6),
      tbt_ms: stats(selected.map(run => run.metrics.tbt_ms)),
      threshold_loss: stats(selected.map(run => run.threshold_loss), 6),
      completed_encoded_bytes_lower_bound: stats(selected.map(run => run.network_window.completed_encoded_bytes_lower_bound), 0),
    };
  }
  const baselineMedian = Object.fromEntries(Object.entries(result.baseline).map(([key, value]) => [key, value.median]));
  const candidateMedian = Object.fromEntries(Object.entries(result.candidate).map(([key, value]) => [key, value.median]));
  result.improvement_factors = {
    fcp_latency: round(baselineMedian.fcp_ms / candidateMedian.fcp_ms),
    lcp_latency: round(baselineMedian.lcp_ms / candidateMedian.lcp_ms),
    cls: candidateMedian.cls === 0 ? null : round(baselineMedian.cls / candidateMedian.cls),
    tbt: candidateMedian.tbt_ms === 0 ? null : round(baselineMedian.tbt_ms / candidateMedian.tbt_ms),
    threshold_loss: candidateMedian.threshold_loss === 0 ? null : round(baselineMedian.threshold_loss / candidateMedian.threshold_loss),
  };
  result.threshold_penalty_elimination_percent = baselineMedian.threshold_loss > 0 && candidateMedian.threshold_loss === 0
    ? 100
    : round(100 * (1 - candidateMedian.threshold_loss / baselineMedian.threshold_loss));
  return result;
}

async function main() {
  const baselineRoot = new URL(baselineUrl);
  const candidateRoot = new URL(candidateUrl);
  const served = {
    baseline_document: await servedResource(baselineRoot.href),
    candidate_document: await servedResource(candidateRoot.href),
    baseline_hero_logo: await servedResource(new URL('/assets/legacy/elu-logo-light.png', baselineRoot).href),
    candidate_hero_logo: await servedResource(new URL('/assets/legacy/elu-logo-light.png', candidateRoot).href),
    candidate_globe_vendor: await servedResource(new URL('/js/vendor/globe.gl.js', candidateRoot).href),
  };

  const order = [];
  for (let pair = 0; pair < runsPerSubject; pair += 1) {
    order.push(...(pair % 2 === 0 ? ['baseline', 'candidate'] : ['candidate', 'baseline']));
  }
  let runs = [];
  if (resumePath) {
    const resumed = JSON.parse(fs.readFileSync(resumePath, 'utf8'));
    if (JSON.stringify(resumed.order) !== JSON.stringify(order) || !Array.isArray(resumed.runs) || resumed.runs.length !== order.length) {
      throw new Error('resume receipt does not contain the exact complete counterbalanced run order');
    }
    runs = resumed.runs;
    process.stdout.write(`benchmark landing runs resumed: ${runs.length}/${order.length}\n`);
  } else {
    const counts = { baseline: 0, candidate: 0 };
    for (let index = 0; index < order.length; index += 1) {
      const subject = order[index];
      counts[subject] += 1;
      process.stdout.write(`benchmark ${index + 1}/${order.length}: ${subject} run ${counts[subject]}\n`);
      runs.push(await runLanding(subject, counts[subject], index + 1, subject === 'baseline' ? baselineUrl : candidateUrl));
      fs.writeFileSync('/private/tmp/elu-first-paint-benchmark-partial.json', `${JSON.stringify({ order, runs }, null, 2)}\n`);
    }
  }
  process.stdout.write('benchmark interaction: candidate first-paint action queue\n');
  const action = await runEarlyAction(candidateUrl);
  const summary = summarize(runs);
  const heroRatio = served.baseline_hero_logo.bytes / served.candidate_hero_logo.bytes;
  const receipt = {
    schema_version: '1.0.0',
    receipt_id: 'elu-first-paint-mobile-2026-08-28',
    generated_at: new Date().toISOString(),
    subjects: {
      baseline: { commit_sha: baselineCommit, url: baselineUrl },
      candidate: { commit_sha: candidateCommit, url: candidateUrl },
    },
    environment: {
      operating_system: `${os.type()} ${os.release()} ${os.arch()}`,
      node: process.version,
      browser: runs[0]?.browser_version || null,
      server: 'Python SimpleHTTP/0.6 on both exact git archives; no content encoding; candidate interaction adds only the verified generated globe.gl runtime dependency',
    },
    benchmark_tool: {
      path: 'tools/run-first-paint-benchmark.js',
      sha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    },
    methodology: {
      run_order: order,
      runs_per_subject: runsPerSubject,
      context: 'fresh browser process and fresh context for every run; service workers blocked; browser cache disabled',
      device: { viewport_css_px: '412x823', device_scale_factor: 1.75, mobile: true, touch: true },
      network: { scope: 'same_origin_only', latency_ms: 150, download_mibps: 1.6, upload_kibps: 750 },
      cpu_throttling_rate: 4,
      measurement_window_ms: measurementWindowMs,
      loss_function: {
        formula: '100 * (0.45*max(0,LCP/2500-1) + 0.25*max(0,CLS/0.1-1) + 0.20*max(0,FCP/1800-1) + 0.10*max(0,TBT/200-1))',
        thresholds,
        weights,
        interpretation: 'A zero candidate loss means the weighted above-threshold penalty was eliminated. Division by zero is undefined, so zero loss is never presented as an infinite or 10x ratio.',
      },
      transfer_boundary: 'Network byte sums are lower bounds over requests completed inside the 8.5 s landing-paint window. Incomplete requests remain itemized and these sums are not complete-navigation transfer totals.',
    },
    served_resources: served,
    raw_runs: runs,
    summary,
    first_paint_action_readiness: action,
    verdict: {
      requested_ten_x_improvement: {
        metric: 'hero LCP image payload bytes',
        baseline_bytes: served.baseline_hero_logo.bytes,
        candidate_bytes: served.candidate_hero_logo.bytes,
        improvement_factor: round(heroRatio),
        pass: heroRatio >= 10,
      },
      observed_local_lcp_latency_factor: summary.improvement_factors.lcp_latency,
      observed_local_lcp_latency_is_ten_x: summary.improvement_factors.lcp_latency >= 10,
      above_threshold_loss_eliminated_percent: summary.threshold_penalty_elimination_percent,
      first_paint_action_ready: action.early.early_bridge_present === true &&
        action.early.app_bound === false &&
        action.early.pending_intent === true &&
        action.early.button_busy === 'true' &&
        action.globe_ready_before_timeout === true &&
        action.final.globe_mode === true &&
        action.final.canvas_count === 1 &&
        action.page_errors.length === 0,
      claim_boundary: 'The 10x pass applies only to the exact hero LCP asset payload. Local FCP/LCP latency, CLS, TBT, partial transfer, and first-action readiness are reported separately. Public PageSpeed field/lab performance requires post-deploy measurement.',
    },
    calculation_hash: null,
  };
  receipt.calculation_hash = calculationHash(receipt);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(`receipt written: ${outputPath}\n`);
  process.stdout.write(`hero payload improvement: ${round(heroRatio)}x\n`);
  process.stdout.write(`median local LCP improvement: ${summary.improvement_factors.lcp_latency}x\n`);
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
