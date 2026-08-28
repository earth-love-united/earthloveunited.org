# Superseding final post-mitigation source-rights report

Reviewer: `ai-reviewer:luna-rights`
Model: `gpt-5.6-luna`
Role: AI source-rights/attribution/provenance reviewer; not human and not legal counsel
Canonical subject digest: `6a920fadfa3a245e4544facf2faac5fd0692cc80a4c23fdb7c0cf48bf02073d5`
Review-request SHA-256: `7d7a47e9d2f8cceb1c9d95d26a5f38471062f079c81058ed6f18f182c7319a6e`
Commit inspected: `91357d1389c2269609328ffb332850d5e8b85637`

## Read-only evidence

- Request SHA verified exactly against `data/climate/releases/country-climate-intelligence-v1/review-request.json`.
- `node tools/check-cci-factual-public-deploy.js --staged _deploy` → `PASS (51 exact files)`.
- CCI deploy self-test → `PASS`.
- Staged runtime contains only:
  - `earth-night.jpg`
  - `ne_110m_admin_0_countries.geojson`
- Verified staged hashes:
  - NASA surface: `373e5a08c9f378a2ce6320214a613148e4b1e3946b3f39a516c9093b76cb7124`
  - Natural Earth geometry: `a4d67eac9c75d5b6f20170d2b07bb53ea791536b0c8e5ebae3ba94df093f76e0`
- Three ambiguous Three-Globe images remain absent from staged bytes, executable runtime/SW tokens, and exact public path allowlist.
- No Climate TRACE content is present in the staged release boundary.
- Corrected public notice is present: “Decorative historical surface only; no endorsement is implied. Three-Globe example images are excluded from this public release.”
- The four-report aggregate remains a final pinning condition, as instructed.

## Findings

### PASS — Three-Globe image mitigation

`night-sky.png`, `earth-blue-marble.jpg`, and `earth-topology.png` are excluded from the staged deployment and runtime cache. Their historical package provenance remains documented without claiming underlying image rights.

### PASS WITH CONDITIONS — NASA Black Marble

The retained NASA Earth Observatory 2012 image is byte-pinned and credited to Robert Simmon, with Suomi NPP VIIRS/NOAA data credit. The staged copy retains historical/decorative-only and no-endorsement language. NASA’s official guidance supports acknowledgement and prohibits implied endorsement. This is evidence, not legal certification.

### PASS WITH CONDITIONS — Natural Earth

Natural Earth’s official terms provide a public-domain basis and permit modification/dissemination. The staged release retains navigation-only, generalized-boundary, disputed-boundary, and approximate-point limitations. “Made with Natural Earth” remains an appropriate recommended attribution.

### PASS WITH CONDITIONS — GCB, WPP, Ember, CCKP CMIP6/ERA5

The unchanged source records retain credible licence and attribution bases:

- GCB 2025 — CC BY 4.0, DOI, transformations disclosed.
- WPP 2024 — CC BY 3.0 IGO, UN DESA attribution and projection/unit conversion disclosed.
- Ember — CC BY 4.0, taxonomy and transformations disclosed.
- CCKP CMIP6 — World Bank CC BY 4.0, WCRP/CMIP6/ESGF acknowledgement.
- CCKP ERA5 — World Bank CC BY 4.0, ERA5/Copernicus attribution and reanalysis limitation.

## Verification caveat

The local `node tools/climate-truth-ci.js --strict` invocation encountered an environment-level `EPERM` while CT-45 attempted to create `.ct45-final-failure-*` under the mission worktree. This was not a rights or public-surface failure; the targeted CCI deploy checks passed, and the requested CI changes are confined to governed routing/test rails. CI’s claimed CT-45/149-mutation results should remain part of the final aggregate receipt.

```json
{
  "post_mitigation_verdict": "approve_with_conditions",
  "conditions": [
    "Assemble and pin the final four-report artifact to subject digest 6a920fadfa3a245e4544facf2faac5fd0692cc80a4c23fdb7c0cf48bf02073d5.",
    "Preserve explicit no-human-review and no-legal-certification disclosure.",
    "Preserve NASA no-endorsement and Natural Earth navigation/disputed-boundary limitations.",
    "Keep all three ambiguous Three-Globe image files excluded from staged bytes, runtime, service-worker tokens, and public output allowlist.",
    "Retain GCB, WPP, Ember, and CCKP CMIP6/ERA5 attribution and transformation notices."
  ],
  "legal_certification": false,
  "human_review_claim": false
}
```
