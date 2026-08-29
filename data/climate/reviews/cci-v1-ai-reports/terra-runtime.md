# Terra runtime/accessibility/release-rails review

Reviewer: `ai-reviewer:terra-runtime`
Verdict: `approve`

Reviewed HEAD: `108e6b6be2e3a53c45b4c2a596de11656774ab8c`
Runtime focus control: `4adeea0fc327f53b3f4e2082185d156f296ed4f5`
Canonical subject digest: `75804cbb652bedb85acabf35996889600f82a963aebb124f4960b7a1f7b0e017`
Review-request SHA-256: `8fe8a47dbf8eea2081f7135ab11b3baab1c4af164e6fc9542d7ceaf06c780753`
Calculation hash: `dfd4b50b1482bbc6688b68b1536b8a2700625873424f13a60be8427bab093f35`

## Evidence

- Recomputed all 300 canonical artifact pins after runtime testing. Every SHA-256 matches the frozen request; the subject digest and calculation hash also match.
- Reviewed the early-opener control. The pre-App bridge records the activated CTA, App consumes that exact element on deferred binding, and the stored opener is used for the later focus return.
- Independent Chromium streaming coverage passed for pointer, Enter, and Space. Before tail release, the CTA was visible after FCP while `document.readyState` was `loading`, the bridge existed, and App remained unbound. Each activation set `aria-busy="true"`, disabled duplicate entry, queued the intent, and announced readiness without prematurely entering globe mode.
- After streamed tail release, each modality reached `globe-mode` with exactly one `#globeViz canvas`; `App.exitGlobe()` restored focus to the exact activated CTA and returned the topbar to `inert` plus `aria-hidden="true"`.
- Foundation focus coverage confirmed the topbar starts inert and hidden from the accessibility tree, eight Tab steps do not enter it, globe mode removes both restrictions and permits topbar focus, and exit restores both restrictions.
- Independently faulted `globe-system.css` and `guided-first-orbit.css` one at a time. Each fault set stylesheet readiness to `error`, kept globe mode false with zero canvas, retained inert/hidden topbar state, showed `The Living Globe interface could not be prepared. Please retry.`, and emitted no page errors.
- A normal live Chromium session passed SmokeTest `30/30` with zero failures and zero critical failures, StackLint returned `[]`, runtime readiness was 249 entities, 26 metrics, and 3 lenses, and globe entry retained one canvas.
- Source v78 and an independently materialized exact 51-file transformed v80 surface both loaded online and offline. Source used controller/cache `sw.js?v=78-first-paint-ready` and `elu-v78-first-paint-ready`; staged output used `sw.js?v=80-cci-factual-ai-review` and `elu-v80-cci-factual-ai-review`. In both cases App binding, exact data readiness, and stylesheet readiness remained true.
- Static and release checks passed: load-order DAG, syntax checks, runtime atomicity, accessibility contract, UI contract, WebGL fallback parity, factual deploy transform self-test, profile isolation self-test, vendor integrity, and runtime-asset policy.
- The first-paint receipt checker passed. Its `27.225×` result is limited to the hero LCP asset payload; the `6.161×` local median is a local cold-run result only, and transfer evidence remains partial.
- CT42 rollback proof passed as deterministic local evidence with calculation hash `c447b6878b4a4b1ffc43d17631c189125c219bb6ca861851e888c65db4bb0920`. It explicitly records browser execution as an external required gate, not run or recorded by that proof checker, and denies release/deploy/independent-review authority. The actual independent CT42 review checker correctly fails closed because its required artifact is absent.

## Conditions and release boundaries

1. Regenerate and repin all four AI reports and the multi-model aggregate against this exact HEAD, subject digest, and request before invoking the CCI AI-factual profile or staged release lane. The active profile is correctly `cci:candidate`; the current AI-factual checker blocks because the aggregate subject does not bind this exact candidate.
2. Retain Chromium CI coverage for streamed pointer, Enter, and Space activation; exact opener restoration; Foundation/globe topbar focus state; both stylesheet faults; one-canvas readiness; and source-v78/staged-v80 offline behavior.
3. CT42 deterministic rollback proof is not an independent CT42 review and must not be represented as legal, publication, release, or deploy authority.
4. The v80 transformed staging result is verification evidence only; it does not authorize a deployment.

This is an AI runtime/accessibility/release-rails review only. It grants no human, legal, institutional, publication, release, or deploy authority.
