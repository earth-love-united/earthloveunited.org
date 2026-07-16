#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  materializeRollbackSite,
  rehearse,
} = require('./lib/ct42-runtime-rollback-proof');

const ROOT = path.resolve(__dirname, '..');
const PROOF_PATH = 'data/climate/reviews/ct42-candidate-rollback-rehearsal.json';

function installBrowserHarness(siteRoot) {
  const indexPath = path.join(siteRoot, 'index.html');
  const index = fs.readFileSync(indexPath, 'utf8');
  const anchor = '</body>';
  assert.equal(index.split(anchor).length - 1, 1, 'browser harness body anchor drift');
  const harness = `
<button id="rollback-browser-audit" type="button" style="position:fixed;left:8px;bottom:8px;z-index:10000;min-width:44px;min-height:44px;padding:8px;background:#10242b;color:#fff;border:1px solid #7be8d0;border-radius:4px">Run rollback browser audit</button>
<pre id="rollback-browser-audit-result" role="status" aria-live="polite" hidden></pre>
<script>
(function () {
  var button = document.getElementById('rollback-browser-audit');
  var output = document.getElementById('rollback-browser-audit-result');
  button.addEventListener('click', async function () {
    button.disabled = true;
    button.textContent = 'Running rollback audit…';
    var smoke;
    var stack;
    try {
      smoke = await window.SmokeTest.run();
      stack = window.StackLint.audit();
      var forbidden = ['country-factual-candidate.json', 'earth-night.jpg', 'night-sky.png', 'earth-blue-marble.jpg', 'earth-topology.png'];
      var resources = performance.getEntriesByType('resource').map(function (entry) { return entry.name; });
      var leaked = resources.filter(function (name) { return forbidden.some(function (token) { return name.indexOf(token) !== -1; }); });
      var external = resources.filter(function (name) {
        try { return new URL(name, location.href).origin !== location.origin; }
        catch (error) { return false; }
      });
      var result = {
        pass: smoke && smoke.failed === 0 && smoke.criticalFailed === 0 && Array.isArray(smoke.results) && smoke.results.every(function (entry) { return entry.pass === true; }) && Array.isArray(stack) && stack.length === 0 && leaked.length === 0 && external.length === 0,
        smoke: smoke,
        stack: stack,
        state: window.GlobeModule.getState(),
        texture: window.GlobeModule.getRuntimeTextureState(),
        forbidden_resource_requests: leaked,
        external_runtime_requests: external,
        canvas_count: document.querySelectorAll('#globeViz canvas').length
      };
      output.textContent = JSON.stringify(result, null, 2);
      output.dataset.result = result.pass ? 'pass' : 'fail';
      output.hidden = false;
      button.textContent = result.pass ? 'Rollback audit passed' : 'Rollback audit failed';
    } catch (error) {
      output.textContent = JSON.stringify({ pass: false, error: String(error && error.stack || error) }, null, 2);
      output.dataset.result = 'fail';
      output.hidden = false;
      button.textContent = 'Rollback audit failed';
    }
  });
})();
</script>
`;
  fs.writeFileSync(indexPath, index.replace(anchor, harness + anchor));
}

function cliValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  assert.ok(process.argv[index + 1], `${flag} requires a value`);
  return process.argv[index + 1];
}

const proof = JSON.parse(fs.readFileSync(path.join(ROOT, PROOF_PATH)));
const result = rehearse(ROOT, proof);
const site = cliValue('--site');
let materialized = null;
if (site) {
  materialized = materializeRollbackSite(ROOT, proof, path.resolve(site));
  if (process.argv.includes('--browser-harness')) installBrowserHarness(materialized.destination);
}

process.stdout.write([
  'CT-42 neutral runtime rollback static rehearsal: PASS',
  `  candidate decision: ${result.candidate_decision}`,
  `  deterministic patch files: ${result.changed_files}; pinned controls: ${result.pinned_control_files}`,
  `  pinned unchanged runtime dependencies: ${result.pinned_runtime_dependencies}`,
  `  materialized runtime dependencies: ${result.materialized_runtime_dependencies}; vendor materialized: ${result.vendor_materialized}`,
  `  runtime dependency closure complete: ${result.runtime_dependencies_complete}`,
  `  neutral entities: ${result.retained_polygons} retained polygons + ${result.small_nation_points} approximate points = ${result.retained_polygons + result.small_nation_points}`,
  `  service-worker cache: ${result.cache_name}`,
  `  runtime exclusions absent: ${result.runtime_exclusions_absent}`,
  `  prohibited production outputs absent: ${result.prohibited_outputs_absent}`,
  '  workspace mutation / deploy / release authority: false / false / false',
  '  browser execution: NOT RUN OR RECORDED by this checker; external independently reviewed browser evidence remains required',
  ...(materialized ? [
    `  temporary browser site: ${materialized.destination}`,
    ...(process.argv.includes('--browser-harness') ? ['  temporary browser harness: installed (not part of rollback target hashes; results are not persisted as evidence)'] : []),
    '  next: serve this directory on a fresh localhost origin, enter the globe, then require SmokeTest.run() to have zero failures and StackLint.audit() to return [].',
  ] : []),
].join('\n') + '\n');
