# Final AI performance and scientific-methodology review

Reviewer: `ai-reviewer:luna-science`

Model: `gpt-5.6-luna`

Role: AI performance, measurement, loss-function, action-readiness, and scientific-methodology reviewer; not human and not legal counsel

Reviewed HEAD: `108e6b6be2e3a53c45b4c2a596de11656774ab8c`

Measured candidate runtime control: `4adeea0fc327f53b3f4e2082185d156f296ed4f5`

Canonical subject digest: `75804cbb652bedb85acabf35996889600f82a963aebb124f4960b7a1f7b0e017`

Review-request SHA-256: `8fe8a47dbf8eea2081f7135ab11b3baab1c4af164e6fc9542d7ceaf06c780753`

Review-request calculation hash: `dfd4b50b1482bbc6688b68b1536b8a2700625873424f13a60be8427bab093f35`

## Verdict

`approve_with_conditions`

The exact frozen subject contains internally consistent and reproducible local evidence for a `27.225×` hero-image payload reduction, a separate `6.161×` median local LCP improvement, elimination of the defined above-threshold loss, and early-action acknowledgement with eventual globe readiness.

No frozen-subject performance or methodology blocker was found for the separately labeled CCI AI-factual public lane. The evidence does not establish a 10× page-speed improvement, sub-second full globe readiness, production PageSpeed performance, Google ranking impact, or field-user performance.

This is AI-only methodological review. It is not human review, legal advice, legal certification, independent institutional review, scientific certification, publication authority, release authority, or deployment authority.

## Exact-subject and receipt verification

- Git HEAD matches `108e6b6be2e3a53c45b4c2a596de11656774ab8c`.
- The request contains exactly 300 pins; all resolve to regular, non-symlink files with matching hashes.
- All three required-absent paths remain absent.
- The subject digest, review-request SHA-256, and request calculation hash independently recompute to the values above.
- The request generator reproduces the committed request semantically, including the same pins, absent-path boundary, digest, and calculation hash.
- The performance receipt is SHA-256 `b39acb33548ad9e23d3df23d878175b3aa67b87c25bf7236ad9a9eea17ff144d` and recomputes to calculation hash `2edc2eb02ccd0d13709cbff4623bbd5b19e4b91a4a7d846687aa53fd6fe90844`.
- The benchmark tool is SHA-256 `6ce919fecfbfb720325f9e31ece1458ee2906d5665b09165eddfc239d00dddbf`.
- The receipt checker is SHA-256 `1bbb8eb9d2e63582dac78c497e40b5b4428bf751a579c0b0e8f67c0e02f12a6d`.
- The streamed-action browser checker is SHA-256 `34c11d0812a77fd207316c04a5b1b40735b553813721366a99f15336ede36c32`.

The measured candidate commit is an ancestor of the reviewed HEAD. Files changed after that runtime control are limited to the performance receipt and checker binding, deterministic rollback evidence, and the regenerated review request. Runtime HTML, CSS, JavaScript, images, and climate data are unchanged, so the measured runtime bytes remain applicable to this frozen subject.

## Baseline and candidate binding

The receipt and checker bind:

- baseline commit `41a694f925e36669b72ca62029cd1d62c8ddfeaf`;
- candidate commit `4adeea0fc327f53b3f4e2082185d156f296ed4f5`;
- baseline document: 78,665 bytes, SHA-256 `865e59145cf1225a2de56f6e1592f1c5a43fe03d9ce9cd21cdf09904ac50d7a4`;
- candidate document: 84,332 bytes, SHA-256 `1cb352d50ac411177c0f0f51ae272ec4bc8899b12ab1050282ce75e3e270eca3`;
- baseline hero logo: 395,059 bytes, SHA-256 `f1d088194a790bfb338df905d54c44ee13042d93922475274eeac537c35689d6`;
- candidate hero logo: 14,511 bytes, SHA-256 `899ac2c93503300de2d74f549a4eca1dcc09e688e24e4a9a551b297ac9e20e77`;
- candidate generated globe bundle: 1,796,338 bytes, SHA-256 `2ab6767f47e2be0ac346cd7a5eb55d259ea3da06d479dc22f1820ddd698f496a`.

The checker reads the document and logo bytes directly from the named Git commits and verifies them against the served-resource records. It also verifies the candidate globe bundle against the frozen vendor-integrity specification.

The receipt does not record response-body hashes for every CSS, JavaScript, and data response in the raw network ledger. Its “exact Git archives” statement is therefore procedurally credible but not a complete cryptographic manifest of every served response. The asset-payload claim has exact byte binding; future publication-grade latency receipts should add a full archive digest or per-response hashes.

## Experimental protocol

The landing experiment contains 12 raw cold runs, six per subject, in three repeated ABBA blocks:

`baseline, candidate, candidate, baseline, baseline, candidate, candidate, baseline, baseline, candidate, candidate, baseline`

Each run uses:

- a fresh Chrome process and browser context;
- blocked service workers and disabled browser cache;
- 412×823 CSS-pixel mobile emulation at DPR 1.75 with touch enabled;
- Chrome `151.0.7922.174` on Darwin 25.6.0 arm64;
- 150 ms configured latency and 4× CPU throttling;
- same-origin-only network completion;
- an 8.5-second measurement window.

The CDP throughput configuration is `floor(1.6 × 1024² / 8)` bytes per second down and `floor(750 × 1024 / 8)` bytes per second up. These values behave as 1.6 Mibit/s and 750 Kibit/s despite the compact `download_mibps` and `upload_kibps` field names. Future receipts should spell out bit-versus-byte units.

The fixed ABBA order reduces simple warm-up and monotonic time-drift bias, while fresh processes and disabled caches enforce a cold-navigation comparison. It is not randomized, includes only six observations per arm, and covers one browser, host, device emulation, date, and network profile. No confidence interval, bootstrap interval, preregistered hypothesis test, or field-user sample is included.

## Raw results and statistics

The raw FCP values are:

- baseline: 1,452, 1,416, 1,408, 1,396, 1,424, and 1,424 ms;
- candidate: 564, 536, 564, 536, 548, and 536 ms.

The raw LCP values are:

- baseline: 4,728, 4,756, 4,756, 4,712, 4,832, and 4,772 ms;
- candidate: 772, 768, 772, 784, 756, and 788 ms.

The recomputed summary is:

- median FCP: `1,420 ms → 542 ms`, a `2.620×` local latency improvement;
- median LCP: `4,756 ms → 772 ms`, a `6.161×` local latency improvement;
- median CLS: `0.006256 → 0.006265`, effectively unchanged and slightly worse;
- median TBT: `0 → 0 ms`;
- median threshold loss: `40.608 → 0`;
- FCP population standard deviation: `17.282 ms → 12.526 ms`;
- LCP population standard deviation: `38.047 ms → 10.499 ms`.

Every candidate FCP and LCP observation is better than every baseline observation in this harness. All six candidate LCP observations fall between 756 and 788 ms, below 0.8 seconds. This supports an exact local synthetic result, not a live-site, field-user, or universal sub-0.8-second claim.

## LCP element identity

All 12 recorded LCP entries in this exact receipt are the same `hero-foundation-logo` element class, and all point to the corresponding baseline or candidate logo URL. The exact reported median ratio therefore does not mix LCP element types.

The checker deliberately permits the candidate live carbon value, `#cc-hero-value`, to supersede the logo as LCP in a future run. The claim boundary correctly discloses that possibility. A future receipt with mixed LCP identities should stratify results by element or explicitly explain the change rather than present a single unqualified latency ratio.

## Loss-function review

The custom loss is:

`100 × (0.45×max(0,LCP/2500−1) + 0.25×max(0,CLS/0.1−1) + 0.20×max(0,FCP/1800−1) + 0.10×max(0,TBT/200−1))`

It is a normalized, weighted, threshold-clipped engineering penalty. Values below each threshold receive no further reward. In the baseline runs, FCP, CLS, and TBT are already below threshold; the positive loss is produced entirely by LCP exceeding 2,500 ms. Every candidate metric is below its threshold, so every candidate run has zero loss.

Reporting `40.608 → 0` as 100% elimination of the above-threshold penalty is mathematically correct. Dividing by zero to produce a factor would be undefined, and the receipt correctly stores the loss ratio as `null`.

The weights and thresholds are policy choices, not a learned model, a validated predictor of user satisfaction, a Lighthouse score, a PageSpeed score, or Google’s search-ranking algorithm. The loss can be used as an internal regression rail only if its definition and flat-below-threshold behavior remain explicit.

The recorded TBT calculation sums long-task time beyond 50 ms from FCP through the 8.5-second window. It is a useful bounded approximation but is not a full Lighthouse TBT implementation and does not establish post-interaction responsiveness.

## Transfer and environment limitations

Every raw run contains:

- 20 completed same-origin requests;
- one incomplete same-origin request;
- one failed, intentionally blocked Google Fonts request;
- no page errors.

The incomplete request is the 7,714,390-byte Country Climate Intelligence runtime. It starts around 5.0 seconds in baseline runs and around 3.0 seconds in candidate runs but does not finish inside the 8.5-second window. The reported completed-byte medians—965,941 baseline and 566,292 candidate—are therefore lower bounds, not complete-navigation totals, and must not be used to claim a whole-page transfer factor.

The baseline Google Fonts URL uses `display=swap`; the candidate uses `display=optional`. Both are blocked by the same-origin harness, so the experiment does not measure either production font delivery or the behavioral difference between those strategies.

The Python SimpleHTTP server uses no content encoding and does not reproduce production CDN, HTTP/2 or HTTP/3, compression, caching, edge latency, or response-header behavior. Those limitations do not invalidate the exact PNG byte ratio, but they prevent the local latency factors from being represented as production PageSpeed or field results.

## First-paint action readiness

The receipt’s separate action scenario is unthrottled apart from deliberate delays: `/js/app.js` is delayed by 1,500 ms and the exact climate runtime by 4,500 ms. It records:

- FCP at 148 ms;
- programmatic activation at 152.2 ms, 4.2 ms after FCP;
- busy-state acknowledgement in 0.2 ms;
- the early bridge present while App remains unbound;
- a queued intent, disabled button, `aria-busy="true"`, and evidence-loading status;
- full globe readiness at 6,534.2 ms with one canvas, ready styles, 249 entities, cleared busy state, and no page errors.

This proves immediate local acknowledgement and correct queuing under an intentionally slow runtime. It does not prove that the full globe becomes ready in less than one second. “First-paint action ready” must retain that distinction.

An independently rerun streamed browser scenario passes pointer, Enter, and Space activation while the document is still loading and App remains unbound. It verifies queued busy/disabled state, eventual globe entry, Foundation-mode topbar `inert` and `aria-hidden`, globe-mode restoration, exclusion of hidden topbar controls from the focus trail, and exact focus return to the initiating control after exit. No page errors occurred.

The deterministic accessibility contract also passes 12 runtime domains and rejects 18 expected failures. This is bounded browser and DOM-contract evidence, not assistive-technology or human accessibility certification.

## Checker and adversarial evidence

`node tools/check-first-paint-performance-receipt.js` passes and reports the exact `27.225×` asset reduction, `6.161×` median local LCP improvement, 12 cold runs, and action readiness.

`node tools/check-first-paint-performance-receipt.js --self-test` passes and rejects 12 mutations after each mutation’s calculation hash is recomputed. The mutations cover document binding, asset ratio, run order, raw metrics, LCP identity, network totals, summary statistics, zero-loss handling, vendor bytes, acknowledgement time, canvas readiness, and claim-boundary widening.

The streamed Chrome test, static 12-script load-order verifier, JavaScript syntax checks, and country accessibility contract all pass.

These checks establish internal consistency and fail-closed behavior. They provide no network, legal, publication, release, or deployment authority.

## Claim boundary

- `27.225×` is the exact hero-image payload reduction only.
- `6.161×` is the separate median local synthetic LCP-latency improvement.
- `2.620×` is the separate median local synthetic FCP-latency improvement.
- `100%` describes elimination of this custom above-threshold penalty, not an infinite ratio.
- The completed-byte sums are partial lower bounds, not total-page transfer.
- The action test proves sub-second acknowledgement, not sub-second full globe readiness.
- No current evidence supports “10× faster,” “10× PageSpeed,” “10× less page transfer,” “Google prefers this,” or any search-ranking claim.
- Public PageSpeed lab results and real-user Core Web Vitals require post-deployment measurement.

## Required conditions and blockers

1. Bind this report and the other final specialist reports to the exact HEAD, request SHA-256, 300-pin subject digest, and request calculation hash before rebuilding the aggregate.
2. Preserve the `27.225×` statement as an exact hero-image payload result only.
3. Keep the `6.161×` LCP, `2.620×` FCP, slightly worse CLS, zero TBT, zero custom loss, and partial transfer results separate.
4. Describe the loss as a custom threshold-clipped engineering rail. Do not present it as Google’s algorithm, Lighthouse scoring, a learned objective, or a validated user-satisfaction model.
5. Describe action readiness as immediate acknowledgement plus eventual completion. Do not claim full globe readiness below one second from this evidence.
6. Do not derive any whole-page transfer ratio while the 7.7 MB runtime response remains incomplete.
7. Before public production-performance claims, run post-deployment PageSpeed against the live URL and collect representative field Core Web Vitals where available.
8. Repeat production validation with real fonts, production headers and compression, cache and service-worker behavior, multiple devices and networks, randomized or independently counterbalanced runs, more repetitions, and uncertainty intervals.
9. Preserve LCP element identity in every receipt. Stratify or qualify future results if the live carbon value replaces the logo as LCP.
10. Strengthen future receipt binding with a full Git-archive manifest or response-body hashes for all served CSS, JavaScript, image, vendor, and data resources.
11. Spell out network throughput in bits or bytes per second in future methodology records.
12. Preserve pointer, Enter, Space, busy-state, inert/ARIA, focus exclusion, globe restoration, exact opener return, and no-page-error coverage in final staged validation.
13. Do not treat this performance evidence, its loss function, browser checks, CI, reviewer identity, or report hash as human, legal, institutional, publication, release, or deployment authority.
14. Any frozen-subject byte change requires a new receipt applicability review, subject digest, and specialist review.

The report and aggregate finalization steps are publication blockers. No additional frozen-subject performance blocker was found for the exact AI-factual public lane.

```json
{
  "post_mitigation_verdict": "approve_with_conditions",
  "ai_factual_public_lane_only": true,
  "human_review_claim": false,
  "legal_certification": false,
  "independent_institutional_review": false,
  "scientific_certification": false,
  "publication_authority": false,
  "release_authority": false,
  "deploy_authority": false
}
```
