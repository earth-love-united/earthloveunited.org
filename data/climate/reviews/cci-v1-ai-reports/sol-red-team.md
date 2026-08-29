# Sol red-team review — first-paint / CCI v1 candidate

## Verdict

`approve`

No blocking defect remains in the exact frozen subject. This approval is an AI technical-review result only; it grants no publication, deployment, legal, scientific, rights, rollback, or release authority.

## Reviewed subject

- HEAD: `108e6b6be2e3a53c45b4c2a596de11656774ab8c`
- Review-request SHA-256: `8fe8a47dbf8eea2081f7135ab11b3baab1c4af164e6fc9542d7ceaf06c780753`
- Subject digest: `75804cbb652bedb85acabf35996889600f82a963aebb124f4960b7a1f7b0e017`
- Request calculation hash: `dfd4b50b1482bbc6688b68b1536b8a2700625873424f13a60be8427bab093f35`
- Artifact pins: exactly 300

I independently recomputed the request hash, calculation hash, all 300 file hashes, and the subject digest using the canonical binary path ordering. All matched. Pins are sorted and unique; every pinned path and parent component was checked with `lstat`, with no symlink, traversal, absolute-path, non-regular-file, or workspace-escape case found.

All baseline-to-HEAD changed paths are pinned except the review request itself, which must remain outside its own digest and is separately bound by its raw SHA-256 and calculation hash. The changed protected files are pinned exactly:

- `.github/workflows/ci.yml`: `5154058023ec298ff2c4e0b9090a7c9cb45f1d17a313c17cfe5f06eb70c68c30`
- `AGENTS.md`: `5209a998d2721308483b0385a0a4143b4daaf0b52016e85157e71cc119d4e2f0`
- `ARCHITECTURE.md`: `4bed6b2dc8c1658b45ea93f2a53369927e09afbbe477a6a751647114553b446b`

The three required-absent paths remain absent. No unpinned changed protected subject file remains.

The dirty worktree entries are only the generated Luna/Terra review reports. They are intentionally outside the same-generation subject digest to avoid a hash cycle. They currently do not authorize release: the aggregate review gate rejects their stale binding.

## First-paint interaction and accessibility

The exact pinned streamed-document checker passed in real headless Chrome while holding the document tail after the visible hero. Pointer, Enter, and Space were each activated after FCP while `App` was absent and `document.readyState` was still `loading`.

For every activation:

- The head bridge captured one pending intent.
- The control immediately became busy and disabled.
- The loading status was announced.
- Globe mode remained closed until runtime and both stylesheets were ready.
- After renderer entry and exit, focus returned to the exact originating button.
- The foundation topbar returned to `inert` with `aria-hidden="true"`.

Observed FCP/activation boundaries were approximately 176/184 ms for pointer, 140/144 ms for Enter, and 112/121 ms for Space. The foundation tab trail did not enter the hidden topbar. The topbar became operable in globe mode and inert again on return.

Independent streamed probes forcing a 404 for each stylesheet separately also passed:

- `globe-system.css` failure
- `guided-first-orbit.css` failure

Both paths published an error state, refused globe mode, restored the opener, re-enabled the action, kept the topbar inert, hid the guided tutorial, exposed no HUD/tutorial controls, and produced a retry message without page errors. The two stylesheets therefore act as one readiness boundary rather than independently exposing partially styled UI.

One non-blocking accessibility hardening remains: native `disabled` temporarily moves focus to `BODY` while loading. The stored opener makes failure and normal exit deterministic, but retaining visible focus with `aria-disabled` or deliberately moving focus to the live status would improve the waiting interval.

## Performance claim integrity

The performance receipt calculation hash independently matches:

`2edc2eb02ccd0d13709cbff4623bbd5b19e4b91a4a7d846687aa53fd6fe90844`

The candidate runtime files at HEAD match measured runtime control commit `4adeea0fc327f53b3f4e2082185d156f296ed4f5`.

The receipt uses 12 counterbalanced cold runs, six per subject, with a fresh browser process/context, service workers blocked, cache disabled, identical 412×823 mobile emulation, DPR 1.75, 150 ms latency, 1.6 MiB/s download, 4× CPU throttling, and an 8.5-second measurement window.

Median results:

- FCP: 1420 ms → 542 ms, `2.620x`
- LCP: 4756 ms → 772 ms, `6.161x`
- CLS: 0.006256 → 0.006265, effectively unchanged and slightly worse
- TBT: 0 ms → 0 ms
- Threshold loss: 40.608 → 0, reported as 100% penalty elimination with no undefined ratio
- Completed-byte lower bound: 965,941 → 566,292 bytes, not represented as total navigation transfer

The `27.225x` result is valid only for hero image payload bytes: 395,059 → 14,511 bytes. It is not a PageSpeed, total-transfer, FCP, LCP, or threshold-loss multiplier. The receipt explicitly records that local LCP did not improve by 10×. No public claim should conflate `27.225x` asset reduction with `6.161x` local LCP improvement.

External Google Fonts were excluded from the controlled same-origin benchmark. Production PageSpeed and field behavior therefore still require post-deployment measurement.

## Theme and asset fidelity

Light and dark theme selection occurred before first paint in browser checks, and both themes selected the intended corresponding logo. Normal mobile DPR 1.75 rendering showed no visible regression.

The new logos are 384-pixel palette-alpha images with one-bit alpha, while the previous light logo was 1254-pixel RGBA. The hero can render at 188 CSS pixels, so high-DPR displays may upscale the new source. This is not a functional blocker, but brand review at DPR 2.5–3 should precede broad publication.

## Service worker and offline behavior

Source runtime consistently uses `elu-v78-first-paint-ready`; registration is versioned to v78. The AI-factual transform deliberately produces v80 and its self-test passed, so v78 source and v80 transformed output are not stale-document drift.

A v77→v78 upgrade rehearsal using the same unchanged `sw.js` passed controller replacement, old-cache removal, new-cache activation, runtime/style readiness, and offline reload. The final post-rehearsal changes affect opener/focus logic, not the service worker.

Non-blocking hardening: `self.clients.claim()` is invoked outside the activation `waitUntil` promise. The tested browsers completed it, but incorporating that promise into the activation lifetime would make the guarantee explicit.

## Rollback and public-release boundaries

The rollback proof passed with:

- Calculation hash: `c447b6878b4a4b1ffc43d17631c189125c219bb6ca861851e888c65db4bb0920`
- Patch artifact SHA-256: `24eb59810aa525c664e8fb5745d380756ecb8ccb568183e5605826c1a77a7f09`
- Decoded patch SHA-256: `632263240b0f4eb28bbbc696afb472213019ecd3f6bc12331afd2e614ae95b65`
- Exact entity boundary: 173 + 28 = 201
- Seven pinned controls, six patched files, and fourteen pinned dependencies
- Fifty-one rejected mutations and successful temporary-site materialization

The proof correctly records that browser execution remains an external required gate and that release/deploy authority and independent review are absent. It does not widen rollback authority.

Positive candidate, runtime, UI, asset, WebGL fallback, public-copy, release-gate, and adversarial self-tests passed. The following gates correctly remain fail-closed:

- AI-factual public review: stale aggregate does not bind this exact subject
- AI-factual public release profile: blocked by that review
- CT42 rollback review: independent review artifact absent

The staged generated `js/vendor/globe.gl.js` is intentionally not directly included in the 300-pin digest. Its bytes are instead constrained by pinned fetch/integrity policy, fixture, staged-byte checks, 63 runtime-asset policies, 149 adversarial mutations, and three symlink cases. Release must not bypass those checks.

## Privacy and workflow review

No new cookie, analytics, beacon, tracking-pixel, or telemetry behavior was introduced. Existing `localStorage` use remains limited to the theme preference. The existing Google Fonts request remains an external privacy/performance dependency, although it is now asynchronous and the preconnect was removed. Self-hosting remains preferable if IP/user-agent disclosure minimization is required.

Workflow static analysis found no unpinned-action or high-confidence security blocker. One low-severity inherited finding remains: CI performs an ad-hoc exact-version Playwright installation without a lockfile. Pre-provisioning or integrity-pinning that dependency would further reduce registry supply-chain exposure.

## Required release conditions

1. Regenerate every AI review and aggregate against this exact request SHA and subject digest; require the factual-public review and release-profile gates to pass.
2. Obtain the required independent scientific, rights, accessibility/runtime, reproducibility, and rollback reviews. This report cannot substitute for them.
3. Execute and record the independent CT42 browser rollback rehearsal before treating rollback as reviewed.
4. Obtain human/CODEOWNERS approval because the change touches protected files and spans 28 files.
5. Preserve the exact performance wording: `27.225x` hero bytes only and `6.161x` local LCP latency. Do not claim a 10× PageSpeed or latency result.
6. Keep v78 source staging, the v80 factual transform, vendor-integrity checks, and fail-closed public gates intact.
7. Perform final high-DPR light/dark logo QA and post-deployment PageSpeed measurement.

Any change to the frozen commit, request bytes, calculation hash, pin set, or subject digest invalidates this approval and requires a new review.
