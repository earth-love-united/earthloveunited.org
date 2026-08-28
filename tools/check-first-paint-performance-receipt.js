#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { parseJsonNoDuplicateKeys } = require('./lib/ct42-runtime-rollback-review');
const { EXPECTED_SPEC: EXPECTED_VENDOR } = require('./lib/globe-vendor-integrity');

const ROOT = path.resolve(__dirname, '..');
const RECEIPT_PATH = 'data/performance/first-paint-mobile-2026-08-28.json';
const TOOL_PATH = 'tools/run-first-paint-benchmark.js';
const BASELINE_COMMIT = '41a694f925e36669b72ca62029cd1d62c8ddfeaf';
const CANDIDATE_COMMIT = '911fc30f1d5847bba91f976f59d64d42e1731f7c';
const EXPECTED_ORDER = Object.freeze([
  'baseline', 'candidate', 'candidate', 'baseline',
  'baseline', 'candidate', 'candidate', 'baseline',
  'baseline', 'candidate', 'candidate', 'baseline',
]);
const THRESHOLDS = Object.freeze({ fcp_ms: 1800, lcp_ms: 2500, cls: 0.1, tbt_ms: 200 });
const WEIGHTS = Object.freeze({ fcp: 0.20, lcp: 0.45, cls: 0.25, tbt: 0.10 });

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function absolute(relative) {
  return path.join(ROOT, relative);
}

function gitBlob(commit, relative) {
  const result = childProcess.spawnSync('git', ['show', `${commit}:${relative}`], {
    cwd: ROOT,
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `unable to read ${relative} from ${commit}: ${String(result.stderr || '')}`);
  return result.stdout;
}

function round(value, digits = 3) {
  assert.ok(Number.isFinite(value), `non-finite number: ${value}`);
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

function loss(metrics) {
  return 100 * (
    WEIGHTS.lcp * Math.max(0, metrics.lcp_ms / THRESHOLDS.lcp_ms - 1) +
    WEIGHTS.cls * Math.max(0, metrics.cls / THRESHOLDS.cls - 1) +
    WEIGHTS.fcp * Math.max(0, metrics.fcp_ms / THRESHOLDS.fcp_ms - 1) +
    WEIGHTS.tbt * Math.max(0, metrics.tbt_ms / THRESHOLDS.tbt_ms - 1)
  );
}

function calculationHash(document) {
  const copy = structuredClone(document);
  copy.calculation_hash = null;
  return sha256(Buffer.from(JSON.stringify(copy)));
}

function assertServedBlob(resource, bytes, expectedUrlPattern) {
  assert.equal(resource.status, 200);
  assert.match(resource.url, expectedUrlPattern);
  assert.equal(resource.bytes, bytes.length);
  assert.equal(resource.content_length, bytes.length);
  assert.equal(resource.sha256, sha256(bytes));
  assert.equal(resource.content_encoding, null);
  assert.match(resource.server, /^SimpleHTTP\/0\.6 Python\/3\.13\.2$/);
}

function validateReceipt(receipt) {
  assert.equal(receipt.schema_version, '1.0.0');
  assert.equal(receipt.receipt_id, 'elu-first-paint-mobile-2026-08-28');
  assert.ok(Number.isFinite(Date.parse(receipt.generated_at)), 'generated_at is invalid');
  assert.equal(receipt.subjects.baseline.commit_sha, BASELINE_COMMIT);
  assert.equal(receipt.subjects.candidate.commit_sha, CANDIDATE_COMMIT);
  assert.match(receipt.subjects.baseline.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.match(receipt.subjects.candidate.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.notEqual(receipt.subjects.baseline.url, receipt.subjects.candidate.url);

  assert.equal(receipt.environment.node, 'v24.19.0');
  assert.equal(receipt.environment.browser, '151.0.7922.174');
  assert.match(receipt.environment.operating_system, /^Darwin 25\.6\.0 arm64$/);
  assert.match(receipt.environment.server, /no content encoding/);

  assert.equal(receipt.benchmark_tool.path, TOOL_PATH);
  assert.equal(receipt.benchmark_tool.sha256, sha256(fs.readFileSync(absolute(TOOL_PATH))));
  assert.deepEqual(receipt.methodology.run_order, EXPECTED_ORDER);
  assert.equal(receipt.methodology.runs_per_subject, 6);
  assert.equal(receipt.methodology.measurement_window_ms, 8500);
  assert.deepEqual(receipt.methodology.loss_function.thresholds, THRESHOLDS);
  assert.deepEqual(receipt.methodology.loss_function.weights, WEIGHTS);
  assert.match(receipt.methodology.loss_function.interpretation, /Division by zero is undefined/);
  assert.match(receipt.methodology.transfer_boundary, /lower bounds/);
  assert.match(receipt.methodology.transfer_boundary, /not complete-navigation transfer totals/);

  const baselineIndex = gitBlob(BASELINE_COMMIT, 'index.html');
  const candidateIndex = gitBlob(CANDIDATE_COMMIT, 'index.html');
  const baselineLogo = gitBlob(BASELINE_COMMIT, 'assets/legacy/elu-logo-light.png');
  const candidateLogo = gitBlob(CANDIDATE_COMMIT, 'assets/legacy/elu-logo-light.png');
  assertServedBlob(receipt.served_resources.baseline_document, baselineIndex, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assertServedBlob(receipt.served_resources.candidate_document, candidateIndex, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assertServedBlob(receipt.served_resources.baseline_hero_logo, baselineLogo, /\/assets\/legacy\/elu-logo-light\.png$/);
  assertServedBlob(receipt.served_resources.candidate_hero_logo, candidateLogo, /\/assets\/legacy\/elu-logo-light\.png$/);
  const vendor = receipt.served_resources.candidate_globe_vendor;
  assert.equal(vendor.status, 200);
  assert.equal(vendor.sha256, EXPECTED_VENDOR.sha256);
  assert.equal(vendor.bytes, vendor.content_length);
  assert.equal(vendor.content_encoding, null);
  assert.match(vendor.url, /\/js\/vendor\/globe\.gl\.js$/);

  assert.ok(Array.isArray(receipt.raw_runs));
  assert.equal(receipt.raw_runs.length, EXPECTED_ORDER.length);
  const subjectCounts = { baseline: 0, candidate: 0 };
  for (let index = 0; index < receipt.raw_runs.length; index += 1) {
    const run = receipt.raw_runs[index];
    const expectedSubject = EXPECTED_ORDER[index];
    subjectCounts[expectedSubject] += 1;
    assert.equal(run.order_index, index + 1);
    assert.equal(run.subject, expectedSubject);
    assert.equal(run.subject_run, subjectCounts[expectedSubject]);
    assert.equal(run.target_url, receipt.subjects[expectedSubject].url);
    assert.equal(run.browser_version, receipt.environment.browser);
    assert.equal(run.navigation_error, null);
    assert.equal(run.measurement_window_ms, 8500);
    assert.deepEqual(run.page_errors, []);
    assert.ok(run.console_errors.every(message => /ERR_BLOCKED_BY_CLIENT/.test(message)));
    for (const key of ['first_paint_ms', 'fcp_ms', 'lcp_ms', 'cls', 'tbt_ms']) {
      assert.ok(Number.isFinite(run.metrics[key]) && run.metrics[key] >= 0, `${run.order_index}: invalid ${key}`);
    }
    assert.ok(run.metrics.first_paint_ms > 0);
    assert.ok(run.metrics.fcp_ms > 0);
    assert.ok(run.metrics.lcp_ms >= run.metrics.fcp_ms);
    assert.equal(run.threshold_loss, round(loss(run.metrics), 6));
    if (run.lcp_entry.element.className === 'hero-foundation-logo') {
      assert.match(run.lcp_entry.url, /\/assets\/legacy\/elu-logo-light\.png\?/);
    } else {
      assert.equal(run.subject, 'candidate', 'only the candidate live carbon value may supersede the hero image as LCP');
      assert.equal(run.lcp_entry.element.className, 'cc-value');
      assert.equal(run.lcp_entry.element.id, 'cc-hero-value');
      assert.equal(run.lcp_entry.url, null);
    }
    if (run.hero_logo !== null) {
      assert.equal(run.hero_logo.complete, true);
      assert.ok(run.hero_logo.natural_width > 0 && run.hero_logo.natural_height > 0);
    }
    assert.equal(run.document_ready_state, 'complete');
    assert.equal(run.visibility_state, 'visible');

    const network = run.network_window;
    assert.equal(network.scope, 'same_origin_only');
    assert.equal(network.request_count, network.ledger.length);
    assert.equal(network.completed_count, network.ledger.filter(item => item.completed).length);
    assert.equal(network.incomplete_count, network.ledger.filter(item => !item.completed && !item.failed).length);
    assert.equal(network.failed_count, network.ledger.filter(item => item.failed).length);
    assert.equal(network.completed_encoded_bytes_lower_bound,
      network.ledger.filter(item => item.completed).reduce((sum, item) => sum + (item.encoded_data_bytes || 0), 0));
    const targetOrigin = new URL(run.target_url).origin;
    for (const request of network.ledger) {
      const requestOrigin = new URL(request.url).origin;
      if (request.completed) {
        assert.equal(requestOrigin, targetOrigin, `${run.order_index}: external request completed`);
        assert.equal(request.response.from_disk_cache, false);
        assert.equal(request.response.from_service_worker, false);
        assert.equal(request.response.content_encoding, null);
      } else if (requestOrigin !== targetOrigin) {
        assert.equal(request.failed, true);
        assert.ok(network.blocked_external_urls.includes(request.url));
      }
    }
  }
  assert.deepEqual(subjectCounts, { baseline: 6, candidate: 6 });

  for (const subject of ['baseline', 'candidate']) {
    const runs = receipt.raw_runs.filter(run => run.subject === subject);
    assert.deepEqual(receipt.summary[subject].fcp_ms, stats(runs.map(run => run.metrics.fcp_ms)));
    assert.deepEqual(receipt.summary[subject].lcp_ms, stats(runs.map(run => run.metrics.lcp_ms)));
    assert.deepEqual(receipt.summary[subject].cls, stats(runs.map(run => run.metrics.cls), 6));
    assert.deepEqual(receipt.summary[subject].tbt_ms, stats(runs.map(run => run.metrics.tbt_ms)));
    assert.deepEqual(receipt.summary[subject].threshold_loss, stats(runs.map(run => run.threshold_loss), 6));
    assert.deepEqual(receipt.summary[subject].completed_encoded_bytes_lower_bound,
      stats(runs.map(run => run.network_window.completed_encoded_bytes_lower_bound), 0));
  }

  const baselineMedian = receipt.summary.baseline;
  const candidateMedian = receipt.summary.candidate;
  assert.equal(receipt.summary.improvement_factors.fcp_latency,
    round(baselineMedian.fcp_ms.median / candidateMedian.fcp_ms.median));
  assert.equal(receipt.summary.improvement_factors.lcp_latency,
    round(baselineMedian.lcp_ms.median / candidateMedian.lcp_ms.median));
  assert.equal(receipt.summary.improvement_factors.threshold_loss, null);
  assert.equal(receipt.summary.threshold_penalty_elimination_percent, 100);
  assert.equal(candidateMedian.threshold_loss.median, 0);
  assert.ok(baselineMedian.threshold_loss.median > 0);

  const ratio = baselineLogo.length / candidateLogo.length;
  const tenX = receipt.verdict.requested_ten_x_improvement;
  assert.equal(tenX.metric, 'hero image payload bytes');
  assert.equal(tenX.baseline_bytes, baselineLogo.length);
  assert.equal(tenX.candidate_bytes, candidateLogo.length);
  assert.equal(tenX.improvement_factor, round(ratio));
  assert.equal(tenX.pass, true);
  assert.ok(ratio >= 10);
  assert.equal(receipt.verdict.observed_local_lcp_latency_factor, receipt.summary.improvement_factors.lcp_latency);
  assert.equal(receipt.verdict.observed_local_lcp_latency_is_ten_x,
    receipt.summary.improvement_factors.lcp_latency >= 10);
  assert.equal(receipt.verdict.above_threshold_loss_eliminated_percent, 100);
  assert.match(receipt.verdict.claim_boundary, /10x pass applies only to the exact hero image asset payload/);
  assert.match(receipt.verdict.claim_boundary, /image or the live carbon value as LCP/);
  assert.match(receipt.verdict.claim_boundary, /Public PageSpeed field\/lab performance requires post-deploy measurement/);

  const action = receipt.first_paint_action_readiness;
  assert.match(action.method, /SHA-pinned generated globe\.gl dependency/);
  assert.ok(action.early.clicked_after_fcp_ms >= 0);
  assert.ok(action.early.acknowledgement_ms >= 0 && action.early.acknowledgement_ms < 1000);
  assert.equal(action.early.early_bridge_present, true);
  assert.equal(action.early.app_bound, false);
  assert.equal(action.early.pending_intent, true);
  assert.equal(action.early.button_disabled, true);
  assert.equal(action.early.button_busy, 'true');
  assert.equal(action.early.globe_mode, false);
  assert.equal(action.globe_ready_before_timeout, true);
  assert.equal(action.final.globe_mode, true);
  assert.equal(action.final.canvas_count, 1);
  assert.equal(action.final.style_ready, 'true');
  assert.equal(action.final.button_busy, null);
  assert.equal(action.final.status_text, 'The Living Globe is ready.');
  assert.equal(action.final.data_state.climateIntelligenceState, 'ready');
  assert.deepEqual(action.page_errors, []);
  assert.equal(receipt.verdict.first_paint_action_ready, true);

  assert.match(receipt.calculation_hash, /^[a-f0-9]{64}$/);
  assert.equal(receipt.calculation_hash, calculationHash(receipt));
  return { ratio: round(ratio), lcpFactor: receipt.summary.improvement_factors.lcp_latency };
}

function set(target, dotted, value) {
  const parts = dotted.split('.');
  const key = parts.pop();
  const owner = parts.reduce((node, part) => node[Number.isInteger(Number(part)) ? Number(part) : part], target);
  owner[key] = value;
}

const receipt = parseJsonNoDuplicateKeys(fs.readFileSync(absolute(RECEIPT_PATH), 'utf8'), RECEIPT_PATH);
const result = validateReceipt(receipt);

if (process.argv.includes('--self-test')) {
  const mutations = [
    ['baseline-sha', 'served_resources.baseline_document.sha256', '0'.repeat(64)],
    ['asset-ratio', 'verdict.requested_ten_x_improvement.candidate_bytes', 395059],
    ['run-order', 'raw_runs.0.subject', 'candidate'],
    ['metric', 'raw_runs.0.metrics.lcp_ms', 1],
    ['lcp-element', 'raw_runs.0.lcp_entry.element.className', 'not-the-lcp'],
    ['network-total', 'raw_runs.0.network_window.completed_encoded_bytes_lower_bound', 1],
    ['summary', 'summary.candidate.lcp_ms.median', 1],
    ['zero-loss-ratio', 'summary.improvement_factors.threshold_loss', 999],
    ['vendor', 'served_resources.candidate_globe_vendor.sha256', '0'.repeat(64)],
    ['early-ack', 'first_paint_action_readiness.early.acknowledgement_ms', 1001],
    ['canvas', 'first_paint_action_readiness.final.canvas_count', 0],
    ['claim-boundary', 'verdict.claim_boundary', 'everything is 10x'],
  ];
  let rejected = 0;
  for (const [id, dotted, value] of mutations) {
    const changed = structuredClone(receipt);
    set(changed, dotted, value);
    changed.calculation_hash = calculationHash(changed);
    assert.throws(() => validateReceipt(changed), `${id}: unsafe receipt mutation was accepted`);
    rejected += 1;
  }
  process.stdout.write(`First-paint performance receipt self-test: PASS (${rejected} recomputed-hash adversarial mutations rejected; no network or release authority)\n`);
} else {
  process.stdout.write(`First-paint performance receipt: PASS (${result.ratio}x hero image payload reduction; ${result.lcpFactor}x median local LCP latency improvement; 12 counterbalanced cold runs; first-paint action ready)\n`);
}
