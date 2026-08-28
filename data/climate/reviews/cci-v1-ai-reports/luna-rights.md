# Superseding final post-mitigation source-rights report

Reviewer: `ai-reviewer:luna-rights`
Model: `gpt-5.6-luna`
Role: AI source-rights/attribution/provenance reviewer; not human and not legal counsel
Canonical subject digest: `3d044004953cd2d159a58e80384b969258611def6dca144c07f3816fe03e8200`
Review-request SHA-256: `0904afc65386a570871fdc77262a8beb6da8f19043a3d1f235edefd4f96d0372`
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
    "Assemble and pin the final four-report artifact to subject digest 3d044004953cd2d159a58e80384b969258611def6dca144c07f3816fe03e8200.",
    "Preserve explicit no-human-review and no-legal-certification disclosure.",
    "Preserve NASA no-endorsement and Natural Earth navigation/disputed-boundary limitations.",
    "Keep all three ambiguous Three-Globe image files excluded from staged bytes, runtime, service-worker tokens, and public output allowlist.",
    "Retain GCB, WPP, Ember, and CCKP CMIP6/ERA5 attribution and transformation notices."
  ],
  "legal_certification": false,
  "human_review_claim": false
}
```

## Superseding Luna-rights addendum — final binding hardening

Reviewed: `2026-08-28T03:04:16Z`
Reviewer: `ai-reviewer:luna-rights` · `gpt-5.6-luna` (AI provenance review; not human or legal counsel)
Canonical subject digest: `3d044004953cd2d159a58e80384b969258611def6dca144c07f3816fe03e8200`
Review-request SHA-256: `0904afc65386a570871fdc77262a8beb6da8f19043a3d1f235edefd4f96d0372`

The final delta is rights- and provenance-safe. It does not change any source licence basis, attribution, retained-asset limitation, excluded-image decision, or public disclosure.

The checker now binds the exact request bytes, requires the exact 24 artifact paths and 9 public-output paths, and requires each reviewer’s canonical report path. Classifying the four reports and prepublication review JSON as post-subject generated outputs correctly avoids a hash cycle; those outputs remain independently exact-pinned by the aggregate. The vendor fallback is fail-closed: only an `ENOENT` for the exact vendor destination may use the pinned digest; dangling symlinks and all other errors block.

Read-only checks passed for missing vendor, exact vendor, mutated vendor, dangling symlink, and unrelated missing paths. Vendor integrity passed 23/23 checks with 41 adversarial mutations rejected; the staged CCI surface passed with 51 exact files.

Final verdict: `approve_with_conditions`. The aggregate and report pins must be mechanically repinned to the subject and request values above, followed by strict AI-factual review and staged-integrity checks. This remains mechanical finalization, not a rights or implementation defect.
