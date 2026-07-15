#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  CONTROL_FILES,
  PROHIBITED_OUTPUTS,
  calculationHash,
  sha256,
} = require('./lib/ct42-runtime-rollback-proof');

const ROOT = path.resolve(__dirname, '..');
const CANDIDATE_COMMIT = '793eade295ae3fa787749e4d6ee112cf374a7634';
const REVIEW_CHAIN_HEAD = '9089b1f34cad985464c6d77f486b05f415496586';
const PRODUCTION_CONTROL_HEAD = '225873f6a78889ef9395b0862e30ecf759c9608f';
const BASELINE_COMMIT = '4f94b218c460d2d452dc3fd1354b9e1c3ddc25cc';
const PATCH_PATH = 'data/climate/operations/ct42-runtime-rollback.patch.b64';
const PROOF_PATH = 'data/climate/reviews/ct42-candidate-rollback-rehearsal.json';

function git(args, options = {}) {
  const run = childProcess.spawnSync('git', args, { cwd: options.cwd || ROOT, encoding: options.encoding || 'buffer' });
  assert.equal(run.status, 0, `git ${args.join(' ')} failed: ${String(run.stderr || run.stdout || '').trim()}`);
  return run.stdout;
}

function gitFile(commit, relative) {
  return git(['show', `${commit}:${relative}`]);
}

function write(root, relative, bytes) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}

function replaceOnce(bytes, from, to, label) {
  const text = bytes.toString('utf8');
  assert.equal(text.split(from).length - 1, 1, `${label} replacement anchor drift`);
  return Buffer.from(text.replace(from, to));
}

function removeWhitespaceOnlyLines(bytes) {
  return Buffer.from(bytes.toString('utf8').replace(/^[\t ]+$/gm, ''));
}

function encodePatchArtifact(patch) {
  const base64 = patch.toString('base64');
  return Buffer.from(`${base64.match(/.{1,76}/g).join('\n')}\n`);
}

function accessibleNeutralCss(candidate) {
  let css = candidate;
  css = replaceOnce(css, `.elu-rank-dot.is-magnitude { background: linear-gradient(135deg,#5b4a97,#f6913a); box-shadow:0 0 7px rgba(246,145,58,.28); }
.elu-rank-dot.is-gap { background:repeating-linear-gradient(135deg,#91a0ac 0 2px,transparent 2px 4px); border:1px solid #aeb9c1; }
.elu-rank-gap-heading { margin:0; padding:9px 10px; border-top:1px solid var(--hud-divider); border-bottom:1px solid var(--hud-divider-soft); color:var(--hud-muted); font-family:var(--mono); font-size:8px; font-weight:500; letter-spacing:1px; text-transform:uppercase; }
.elu-rank-disclosure,.elu-rank-unmapped { padding:7px 10px; color:var(--hud-muted); font-size:9px; line-height:1.4; }
.elu-rank-unmapped { border-bottom:1px solid var(--hud-divider-soft); }
`, '', 'candidate rank styles');
  css = replaceOnce(css, `#hex-country-tooltip .tt-status-magnitude { color:#f2b36f; border-color:rgba(242,179,111,.38); background:rgba(117,76,151,.16); }
#hex-country-tooltip .tt-candidate { margin-top:8px; padding:7px 8px; border:1px solid rgba(242,179,111,.34); background:rgba(117,76,151,.14); color:#f7c58d; font-family:var(--mono); font-size:8px; letter-spacing:.55px; line-height:1.4; text-transform:uppercase; }
`, '', 'candidate status styles');
  css = replaceOnce(css, `#hex-country-tooltip .tt-factual h3 { margin:12px 0 5px; color:var(--mint); font-family:var(--mono); font-size:9px; letter-spacing:1px; text-transform:uppercase; }
#hex-country-tooltip .tt-factual-value { color:var(--text2); font-size:11px; }
#hex-country-tooltip .tt-factual-value strong { color:#f2b36f; font-family:var(--mono); font-size:20px; }
#hex-country-tooltip .tt-factual-value span { color:var(--hud-faint); }
#hex-country-tooltip .elu-trajectory-current.is-magnitude { stroke:#f2a553; stroke-width:2; fill:none; }
#hex-country-tooltip .elu-trajectory-point { fill:#fff1dc; stroke:#704f9d; stroke-width:1.2; }
#hex-country-tooltip .elu-chart-axis { fill:var(--text2); font-family:var(--mono); font-size:7px; }
#hex-country-tooltip .tt-chart-data { margin-top:8px; color:var(--text2); font-size:10px; }
#hex-country-tooltip .tt-chart-data summary { min-height:44px; display:flex; align-items:center; color:var(--teal); cursor:pointer; }
#hex-country-tooltip .tt-chart-data table { width:100%; border-collapse:collapse; font-family:var(--mono); font-size:9px; }
#hex-country-tooltip .tt-chart-data caption { padding:5px; color:var(--hud-muted); text-align:left; }
#hex-country-tooltip .tt-chart-data th,#hex-country-tooltip .tt-chart-data td { padding:4px 5px; border-top:1px solid var(--hud-divider-soft); text-align:left; }
#hex-country-tooltip .tt-source,#hex-country-tooltip .tt-limit { margin-top:8px; color:var(--text2); font-size:10px; line-height:1.45; }
#hex-country-tooltip .tt-source a { display:inline-flex; align-items:center; min-height:44px; color:var(--teal); }
`, '', 'candidate factual card styles');
  css = replaceOnce(css, `html[data-theme="light"] body.globe-mode #hex-country-tooltip .tt-status-magnitude,
html[data-theme="light"] body.globe-mode #hex-country-tooltip .tt-candidate,
html[data-theme="light"] body.globe-mode #hex-country-tooltip .tt-factual-value strong {
  color: #6b3d00;
}
html[data-theme="light"] body.globe-mode #hex-country-tooltip .tt-candidate {
  border-color: #81521d;
  background: #f4e7d4;
}
html[data-theme="light"] body.globe-mode #hex-country-tooltip .elu-trajectory-current.is-magnitude { stroke: #7a4300; }

`, '', 'candidate light-theme styles');
  css = replaceOnce(css, "    content: '2023';", "    content: 'A–Z';", 'neutral mobile rail title');
  return css;
}

function accessibleNeutralIndex(candidate) {
  let index = candidate;
  index = replaceOnce(index,
    '.hex-legend-swatch{width:10px;height:10px;border-radius:2px}.hex-legend-swatch.magnitude-low{background:#5b4a97}.hex-legend-swatch.magnitude-high{background:#f6913a}.hex-legend-swatch.magnitude-gap{background:repeating-linear-gradient(135deg,#91a0ac 0 2px,transparent 2px 4px);border:1px solid #aeb9c1}.hex-legend-note{max-width:230px;margin-top:3px;padding-top:4px;border-top:1px solid rgba(255,255,255,.08);line-height:1.35}',
    '.hex-legend-swatch{width:10px;height:10px;border-radius:2px}',
    'candidate legend styles');
  index = replaceOnce(index, `<div class="hex-legend" id="hex-legend" role="note" aria-label="Candidate emissions magnitude legend">
  <div class="hex-legend-row"><span class="hex-legend-swatch magnitude-low" aria-hidden="true"></span> Lower 2023 emissions magnitude</div>
  <div class="hex-legend-row"><span class="hex-legend-swatch magnitude-high" aria-hidden="true"></span> Higher 2023 emissions magnitude</div>
  <div class="hex-legend-row"><span class="hex-legend-swatch magnitude-gap" aria-hidden="true"></span> Source gap · visible, not ranked</div>
  <div class="hex-legend-note">Log-scaled MtCO₂e/yr · harmonized estimate · CT-42 candidate, not a performance score</div>
</div>`, `<div class="hex-legend" id="hex-legend" role="note" aria-label="Country evidence availability legend">
  <div class="hex-legend-row"><span class="hex-legend-swatch" style="background:rgba(120,150,165,0.28)" aria-hidden="true"></span> Uniform neutral surface · country evidence withheld</div>
</div>`, 'candidate legend copy');
  index = replaceOnce(index,
    'This CT-42 candidate previews reviewed PRIMAP annual harmonized emissions estimates for 206 registry entities and keeps 43 source gaps explicitly visible. The preview is not a production release: commitments and targets are not reviewed, while delivery, performance, impact bands, and climate scores are not assessed.',
    'The globe remains navigable while its country evidence is rebuilt from reviewed sources. Neutral, uniform height and shading indicate that climate facts and performance are unavailable. Target, ambition, delivery, finance, rating, and emissions claims are withheld during this review.',
    'candidate section lead');
  index = replaceOnce(index, `      <span role="listitem"><i style="background:linear-gradient(135deg,#5b4a97,#f6913a)"></i> Non-green sequential color · log-scaled 2023 emissions magnitude, not performance</span>
      <span role="listitem"><i style="background:repeating-linear-gradient(135deg,#91a0ac 0 2px,transparent 2px 4px);border:1px solid #aeb9c1"></i> Neutral pattern · source gap, visible and unranked</span>`,
    '      <span role="listitem"><i style="background:rgba(120,150,165,0.28)"></i> Country facts being re-sourced · performance unavailable</span>',
    'candidate section legend');
  index = replaceOnce(index,
    'The factual series passed CT-10C / CT-10C-R review, but this runtime candidate has not. Performance judgments remain unavailable until target scope and independently reviewed assessment evidence can be compared.',
    'Country cards now disclose the evidence quarantine directly. Performance judgments remain unavailable until target scope and observed emissions can be compared on a reviewed basis.',
    'candidate evidence card');
  index = replaceOnce(index,
    'Tap a mapped entity to inspect its source-labelled 2014–2023 annual harmonized estimates, exact unit, accessible data table, and limitations. Source gaps remain neutral, unnumbered, and equally navigable.',
    'Tap a country to navigate the atlas and see the explicit evidence-unavailable state. Climate values and modeled trajectories are not shown until reviewed replacements are released.',
    'candidate country card');
  index = replaceOnce(index, 'href="css/globe-system.css?v=v12"', 'href="css/globe-system.css?v=ct42-rollback-1"', 'rollback CSS cache key');
  index = replaceOnce(index, 'href="js/data.js?v=v1" as="script"', 'href="js/data.js?v=ct42-rollback-1" as="script"', 'rollback data preload cache key');
  index = replaceOnce(index, 'src="js/data.js?v=v1"', 'src="js/data.js?v=ct42-rollback-1"', 'rollback data cache key');
  index = replaceOnce(index, 'src="js/globe.js?v=v6"', 'src="js/globe.js?v=ct42-rollback-1"', 'rollback globe cache key');
  index = replaceOnce(index, "navigator.serviceWorker.register('/sw.js?v=27-ct42-candidate'", "navigator.serviceWorker.register('/sw.js?v=28-ct42-rollback'", 'index service worker');
  return index;
}

function accessibleNeutralGlobe(baseline) {
  let globe = baseline;
  globe = replaceOnce(globe, '        this.selectDefaultCountry();', `        // Do not auto-open a dialog. Country evidence remains fail-closed,
        // and every opened card must have a real focus-restoration target.`, 'default country dialog');
  globe = replaceOnce(globe, `      wrap.id = 'elu-country-card-wrap';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'Country dashboard navigation');`, `      wrap.id = 'elu-country-card-wrap';`, 'country dialog wrapper');
  globe = replaceOnce(globe, `      });
      document.body.appendChild(wrap);
    }
    if (!wrap.contains(tt)) wrap.insertBefore(tt, wrap.querySelector('.tt-nav-next'));`, `      });
      wrap.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const heading = wrap.querySelector('#country-card-heading');
        const tabbable = Array.from(wrap.querySelectorAll('button,a[href],summary,[tabindex="0"]')).filter(node => {
          if (node.disabled || node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
          const style = window.getComputedStyle(node);
          return node.getClientRects().length > 0 && style.visibility !== 'hidden';
        });
        if (!heading || !tabbable.length) return;
        const last = tabbable[tabbable.length - 1];
        if (event.shiftKey && document.activeElement === heading) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); heading.focus(); }
      });
      document.body.appendChild(wrap);
    }
    if (!wrap.contains(tt)) wrap.insertBefore(tt, wrap.querySelector('.tt-nav-next'));`, 'country dialog focus trap');
  globe = replaceOnce(globe, `    const d = _getCountryDisplayData(feature);
    if (!d) return;
    this._selectedCountryFeature = feature;`, `    const d = _getCountryDisplayData(feature);
    if (!d) return;
    if (opts.focus && document.activeElement && !document.activeElement.closest('#hex-country-tooltip')) {
      this._countryOpener = document.activeElement;
    }
    this._selectedCountryFeature = feature;`, 'country opener capture');
  globe = replaceOnce(globe, `    if (opts.focus && tt) {
      tt.setAttribute('tabindex', '-1');
      tt.focus({ preventScroll: true });
    }`, `    if (opts.focus && tt) {
      const heading = tt.querySelector('#country-card-heading');
      if (heading) heading.focus({ preventScroll: true });
    }`, 'country heading focus');
  globe = replaceOnce(globe, `    if (selected) this._ensureCountryCardWrap(tt);
    else this._unmountCountryCard();
    tt.classList.toggle('selected', !!selected);
    tt.dataset.status = statusAttr;
    tt.setAttribute('role', selected ? 'region' : 'tooltip');
    tt.setAttribute('aria-label', selected ? d.country + ' evidence review' : d.country + ' evidence unavailable');
    if (!selected) tt.removeAttribute('tabindex');`, `    if (selected) {
      const wrap = this._ensureCountryCardWrap(tt);
      if (wrap) {
        wrap.setAttribute('role', 'dialog');
        wrap.setAttribute('aria-modal', 'true');
        wrap.setAttribute('aria-labelledby', 'country-card-heading');
      }
    } else this._unmountCountryCard();
    tt.classList.toggle('selected', !!selected);
    tt.setAttribute('aria-hidden', 'false');
    tt.dataset.status = statusAttr;
    if (selected) tt.removeAttribute('role');
    else tt.setAttribute('role', 'tooltip');
    if (selected) tt.removeAttribute('aria-label');
    else tt.setAttribute('aria-label', d.country + ' evidence unavailable');
    if (!selected) tt.removeAttribute('tabindex');`, 'country dialog semantics');
  globe = replaceOnce(globe,
    `      + '<div class="tt-country">' + _escapeHtml(d.country) + '</div>'`,
    `      + (selected ? '<h2 class="tt-country" id="country-card-heading" tabindex="-1">' + _escapeHtml(d.country) + '</h2>' : '<div class="tt-country">' + _escapeHtml(d.country) + '</div>')`,
    'country dialog heading');
  globe = replaceOnce(globe, `    const enterDuration = mobileMotion ? 300 : 460;
    // Bumble semantics:`, `    const enterDuration = mobileMotion ? 300 : 460;
    const activeBeforeSwap = document.activeElement;
    const restoreHeadingFocus = !!(tt && activeBeforeSwap && tt.contains(activeBeforeSwap));
    // Bumble semantics:`, 'navigation focus capture');
  globe = replaceOnce(globe, `      this._countryHoverFeature = target.feature;
      this._renderCountryInfoCard(target.feature, true);
      this._dockCountryCard();`, `      this._countryHoverFeature = target.feature;
      this._renderCountryInfoCard(target.feature, true);
      if (restoreHeadingFocus && tt) {
        const heading = tt.querySelector('#country-card-heading');
        if (heading) heading.focus({ preventScroll: true });
      }
      this._dockCountryCard();`, 'navigation focus restore');
  globe = replaceOnce(globe, `      tt.classList.remove('visible', 'selected');
      tt.removeAttribute('tabindex');
      delete tt.dataset.status;`, `      tt.classList.remove('visible', 'selected');
      tt.removeAttribute('tabindex');
      tt.removeAttribute('role');
      tt.removeAttribute('aria-modal');
      tt.removeAttribute('aria-labelledby');
      tt.removeAttribute('aria-label');
      tt.setAttribute('aria-hidden', 'true');
      delete tt.dataset.status;`, 'closed dialog accessibility tree');
  globe = replaceOnce(globe, `    this._clearCountryProjects();
    this._refreshCountryBorders();
    if (hasModule('EventBus'))`, `    this._clearCountryProjects();
    this._refreshCountryBorders();
    if (this._countryOpener && document.contains(this._countryOpener) && typeof this._countryOpener.focus === 'function') this._countryOpener.focus();
    this._countryOpener = null;
    if (hasModule('EventBus'))`, 'country opener restore');
  return globe;
}

function rollbackTargets(current) {
  const targets = Object.fromEntries(CONTROL_FILES.map(relative => [relative, gitFile(BASELINE_COMMIT, relative)]));
  targets['index.html'] = accessibleNeutralIndex(current['index.html']);
  targets['css/globe-system.css'] = accessibleNeutralCss(current['css/globe-system.css']);
  targets['js/globe.js'] = accessibleNeutralGlobe(targets['js/globe.js']);
  let sw = replaceOnce(
    targets['sw.js'],
    ' * Version bump (v26) — remove the retired legacy country payload.',
    ' * Rollback cache (v28) — evict the denied CT-42 candidate and restore fail-closed country evidence.',
    'service-worker comment',
  );
  sw = replaceOnce(sw, "const CACHE_NAME = 'elu-v26';", "const CACHE_NAME = 'elu-v28-ct42-rollback';", 'service-worker cache');
  targets['sw.js'] = sw;
  CONTROL_FILES.forEach(relative => { targets[relative] = removeWhitespaceOnlyLines(targets[relative]); });
  return targets;
}

function buildPatch(current, targets) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-ct42-rollback-build-'));
  try {
    git(['init', '-q'], { cwd: temp });
    git(['config', 'user.name', 'Earth Love United rollback builder'], { cwd: temp });
    git(['config', 'user.email', 'rollback-builder@invalid.example'], { cwd: temp });
    CONTROL_FILES.forEach(relative => write(temp, relative, current[relative]));
    git(['add', '--', ...CONTROL_FILES], { cwd: temp });
    git(['commit', '-q', '-m', 'candidate surface'], { cwd: temp });
    CONTROL_FILES.forEach(relative => write(temp, relative, targets[relative]));
    const patch = git(['diff', '--binary', '--full-index', '--no-ext-diff', '--', ...CONTROL_FILES], { cwd: temp });
    assert.ok(patch.length > 0, 'rollback patch unexpectedly empty');
    return patch;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

const current = Object.fromEntries(CONTROL_FILES.map(relative => {
  const bytes = fs.readFileSync(path.join(ROOT, relative));
  assert.deepEqual(bytes, gitFile(PRODUCTION_CONTROL_HEAD, relative), `${relative} no longer matches the exact production-control head`);
  return [relative, bytes];
}));
const targets = rollbackTargets(current);
const patch = buildPatch(current, targets);
const encodedPatch = encodePatchArtifact(patch);

const ct40Path = 'data/climate/reviews/ct42-ct40-release-review-result.json';
const manifestPath = 'data/climate/runtime/candidate-manifest.json';
const runtimePath = 'data/climate/runtime/country-factual-candidate.json';
const ct40 = JSON.parse(fs.readFileSync(path.join(ROOT, ct40Path)));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, manifestPath)));
assert.equal(ct40.decision, 'deny');
assert.equal(ct40.eligible, false);
assert.equal(ct40.release_authority, false);
assert.equal(manifest.review_status, 'not_reviewed');
assert.equal(manifest.production_runtime_release, false);
PROHIBITED_OUTPUTS.forEach(relative => assert.equal(fs.existsSync(path.join(ROOT, relative)), false, `${relative} must remain absent`));

const roles = {
  'index.html': 'public_copy_and_service_worker_registration',
  'css/globe-system.css': 'candidate_visual_presentation',
  'js/data.js': 'runtime_data_pointer',
  'js/globe.js': 'candidate_globe_and_card_logic',
  'sw.js': 'cache_epoch_and_candidate_precache',
};

const proof = {
  schema_version: '1.0.0',
  proof_id: 'ct-42-runtime-rollback-rehearsal-2026-07-15',
  status: 'rehearsed_not_reviewed',
  release_authority: false,
  deploy_authority: false,
  review: {
    status: 'not_reviewed',
    builder_id: 'ct-42-runtime-rollback-builder',
    reviewer_id: null,
    reviewed_at: null,
    independent_review_required: true,
  },
  candidate: {
    builder_commit: CANDIDATE_COMMIT,
    review_chain_head: REVIEW_CHAIN_HEAD,
    production_control_head: PRODUCTION_CONTROL_HEAD,
    candidate_id: manifest.candidate_id,
    decision: 'deny',
    release_eligible: false,
    production_runtime_release: false,
    candidate_manifest: { path: manifestPath, sha256: sha256(fs.readFileSync(path.join(ROOT, manifestPath))) },
    runtime_data: { path: runtimePath, sha256: sha256(fs.readFileSync(path.join(ROOT, runtimePath))) },
    ct40_result: { path: ct40Path, sha256: sha256(fs.readFileSync(path.join(ROOT, ct40Path))) },
  },
  rollback: {
    strategy: 'candidate_to_fail_closed_baseline',
    baseline_commit: BASELINE_COMMIT,
    cache_name: 'elu-v28-ct42-rollback',
    service_worker_registration: '/sw.js?v=28-ct42-rollback',
    workspace_mutation: false,
    patch: {
      path: PATCH_PATH,
      encoding: 'base64',
      sha256: sha256(encodedPatch),
      decoded_sha256: sha256(patch),
      changed_files: CONTROL_FILES,
    },
    controls: CONTROL_FILES.map(relative => ({
      path: relative,
      role: roles[relative],
      candidate_sha256: sha256(current[relative]),
      rollback_sha256: sha256(targets[relative]),
    })),
    assertions: [
      'candidate runtime data pointer absent',
      'candidate magnitude, ranking, trajectory, and card presentation absent',
      'neutral evidence-withheld public copy restored',
      'reviewed dialog, focus, target-size, narrow-layout, and reduced-motion safeguards preserved',
      'service-worker cache advanced and candidate JSON removed from pre-cache',
      'production runtime manifest, reviewed release diff, and CT-40 allow manifest absent',
    ],
  },
  prohibited_outputs: PROHIBITED_OUTPUTS,
  execution: {
    builder: 'node tools/build-ct42-runtime-rollback-proof.js',
    command: 'node tools/rehearse-ct42-runtime-rollback.js',
    checker: 'node tools/check-ct42-runtime-rollback-proof.js',
    builder_requires_git_objects: [CANDIDATE_COMMIT, REVIEW_CHAIN_HEAD, PRODUCTION_CONTROL_HEAD, BASELINE_COMMIT],
    mode: 'temporary_copy_only',
    writes_workspace: false,
    deploys: false,
  },
  calculation_hash: null,
};
proof.calculation_hash = calculationHash(proof);

write(ROOT, PATCH_PATH, encodedPatch);
write(ROOT, PROOF_PATH, Buffer.from(JSON.stringify(proof, null, 2) + '\n'));
process.stdout.write(`CT-42 rollback proof built: ${proof.calculation_hash}\n  patch artifact ${proof.rollback.patch.sha256}\n  decoded patch ${proof.rollback.patch.decoded_sha256}\n`);
