# Superseding final runtime/accessibility/release-rails review

Reviewer: `ai-reviewer:terra-runtime`
Model: `gpt-5.6-terra`
Canonical subject digest: `6a920fadfa3a245e4544facf2faac5fd0692cc80a4c23fdb7c0cf48bf02073d5`
Review-request SHA-256: `7d7a47e9d2f8cceb1c9d95d26a5f38471062f079c81058ed6f18f182c7319a6e`
Base commit: `91357d1389c2269609328ffb332850d5e8b85637`, with the supplied uncommitted mitigation subject.
Staged surface: 51 exact files.

## Verified evidence

- `node tools/check-cci-factual-public-deploy.js --staged _deploy` — PASS; exact rights-safe 51-file surface.
- `node tools/check-country-climate-intelligence-ci.js` — PASS; CCI SHA `4939fbc6e26c0ef0fc283ecf98ab3924ccb93d93b7e5392eab2014f7ab3c57fe`, 249 entities, 26 metrics, three lenses.
- `node tools/check-globe-webgl-fallback.js` — PASS; exact WebGL/fallback parity and explicit gaps.
- `node tools/check-globe-runtime-assets.js` — PASS: 63/63 policy checks, 149 adversarial mutations rejected, 3 staged-symlink cases rejected, and production/release authority remains false.
- `node tools/climate-truth-ci.js --strict` — PASS.
- `python3 scripts/verify_load_order.py`; `node --check sw.js js/*.js` — PASS.
- Existing human release rails remain intact:
  - CCI signature gate: candidate / 24 fail-closed mutations.
  - Globe-asset approval trust: unprovisioned / 38 fail-closed mutations.
  - CT-42 deterministic rollback proof: PASS, still explicitly non-authorizing.

## Post-mitigation findings

No blocker was found in the implementation subject.

- The smoke job now derives and emits `integrity_mode`; CCI candidate selects `cci-ai-factual`, while legacy candidate and release profiles retain distinct routes.
- The CCI browser build has its own unique job step and uses the AI-factual staged surface.
- The final aggregate verifier receives `smoke_profile.outputs.integrity_mode`, eliminating the previous candidate-mode misrouting.
- CT-45 policy recognizes CCI’s profile-aware route and attacks route reversal/hardcoding through fixtures.
- The AI-factual lane correctly expects 404 for the excluded images; non-AI/full-texture lanes retain the exact `image/png` sky MIME assertion.
- NASA-only surface/null sky, eliminated inverted Carbon relief, explicit fallback disclosure, cache epoch coupling, and the 51-file surface remain unchanged and verified.
- The existing human-signed production gate is not weakened or repurposed by the AI-factual profile.

## Conditions and limitations

1. The four-report aggregate is still draft (`draft_final_sol_pending`); its final report pins, condition receipts, authorization, and current subject binding must be completed before the strict AI-factual profile can authorize staging.
2. CI must run the exact Chromium SmokeTest/StackLint path against this final staged digest. Local Playwright Chromium is unavailable, so the reviewer did not independently execute the live WebGL browser lane.
3. This approval applies only to the separately labeled AI-reviewed source-data lane. It does not authorize a human-reviewed, legally certified, or signed production release.

`post_mitigation_verdict: approve_with_conditions`
