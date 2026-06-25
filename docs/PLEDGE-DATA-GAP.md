# Pledge Data Gap Analysis

**Date:** 2026-06-24
**Scope:** 123 country pledge nodes in pledge-nodes.json
**Purpose:** Assess which gaps are cosmetic vs which break user-facing features

---

## Data Completeness by Runtime-Critical Field

| Field | Populated | Used By | Breaks If Empty? |
|-------|-----------|---------|-----------------|
| iso | 100% | Globe rendering | No |
| country | 100% | Hover tooltip | No |
| lat/lng | 100% | Globe placement | No |
| fossil_co2_mt | 100% | Point size + tooltip | No |
| globe_color | 100% | Point color (default lens) | No |
| co2_per_capita | 100% | Derived display | No |
| population | 100% | Per-capita calc | No |
| change_since_2015 | 100% | Change indicator | No |
| momentum_cagr | 100% | Momentum display | No |
| cat_score | 100% | (but 71% are 0) | No — gray is valid |
| ndc_summary | 99% | Overlay detail | No — falls back gracefully |
| conditionality | 99% | Pledge detail | No |
| target_year | 98% | Overlay header | No — "unregistered" fallback |
| reduction_pct | 80% | Overlay header | No — "unregistered" fallback |
| lulucf_co2_mt | 98% | Forest lens | No |
| cat_rating | 29% | Hover tooltip | No — empty = no rating shown |
| on_track | 46% | Gap assessment | No — gray is valid "unassessed" |
| reality_gap_mt | 46% | Gap lens color | No — gray is valid |
| required_cagr | 46% | Derived display | No |
| divergence | 46% | Derived display | No |
| implied_target_mt | 46% | Gap calculation | No |
| baseline_year | 39% | Baseline reference | No |
| finance_total_bn | 44% | Finance display | No |

## Key Finding: No Critical Gaps

The pledge data is designed with graceful degradation. Every field has a fallback:
- Missing `reality_gap_mt` → gray point (unassessed)
- Missing `reduction_pct` → "unregistered" text
- Missing `cat_rating` → no rating displayed
- Missing `cat_score` = 0 → gray color (valid state)

**The globe and overlay function correctly with current data.** The gaps are informational, not functional.

## What the Gaps Mean for Users

### Cosmetic Gaps (no broken features)
- 24 countries show "unregistered" for pledge target (reduction_pct missing)
- 87 countries show no CAT rating (they're not in CAT's coverage)
- 66 countries show no reality gap (can't calculate without implied target)

### Informational Gaps (could be improved)
- 87 countries have cat_score=0 — this is correct (not assessed by CAT) but the UI doesn't distinguish "not assessed" from "assessed as zero"
- 24 countries missing reduction_pct — these are smaller economies without formal NDCs
- 54 countries missing finance_total_bn — no public climate finance data

## Backfill Priority (if desired)

### Priority 1 — High value, low effort
- **reduction_pct (24 missing):** Source from NDC Registry (ndc-registry.undp.org) or Climate Watch
- **baseline_year (75 missing):** Derive from first year of available emissions data

### Priority 2 — Medium value, medium effort
- **finance_total_bn (69 missing):** Climate Policy Initiative annual reports, OECD DAC statistics
- **on_track (66 missing):** Derive from momentum_cagr vs required_cagr once those are populated

### Priority 3 — Low value, high effort
- **cat_rating/cat_score (87 missing):** These countries are NOT covered by Climate Action Tracker. Would need to either:
  - Extend CAT-style assessment to 87+ countries (major research effort)
  - Use alternative source (Climate Watch NDC progress ratings)
  - Accept "unassessed" as the correct state

## Recommendation

**Do not backfill before COP31.** The system handles missing data gracefully. Instead:
1. Ensure the "unregistered" fallback text is clear and informative
2. Add tooltip explaining why a country shows "unassessed" (gray)
3. Post-COP31: prioritize backfilling reduction_pct (24 countries) for completeness

---

*Assessment: Pledge data gaps are informational, not functional. No code changes required.*
