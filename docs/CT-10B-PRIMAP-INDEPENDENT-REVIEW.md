# CT-10B-R — PRIMAP independent review

Decision: **PASS** for candidate-data integrity at commits `28fdd61d029ed3e3dd97918360624228f5dcd9ee` and `de6552d37e60db61f5f1ae251ea1bbc3e7d80af3`.

Reviewer identity: `ct-10b-independent-reviewer`, independent of builder `ct-10b-ingestion`. The machine-readable record is `data/climate/reviews/primap-hist-2.6.1-economy-wide-ct10b-review.json`.

The review independently checked the pinned raw checksums and five-field selection, all 215 selected rows, exact decimal normalization, the 206-series/43-gap classification, batch-schema validation, 2,060 CT-02 boundary observations, 4,120 globally unique source plus normalized fact IDs, 13 targeted country samples, an isolated byte-identical rebuild, source-tamper rejection, and fail-closed assessment/scoring gates.

Run the linked checker with the pinned raw CSV:

```sh
node tools/check-primap-review-attestation.js /path/to/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv
```

This PASS is not a scoring or public assessed-data release. The candidate artifacts remain `not_reviewed`, assessed use and scoring remain false, reviewed-site release remains false, and CT-40 release-gate design and execution remain required before any such publication.
