# CT-10B PRIMAP v2.6.1 Economy-wide GHG Candidates

**Status:** Reproducible normalized evidence candidates; assessed use denied

This mission ingests the frozen PRIMAP-hist v2.6.1 final CSV selected by the
CT-01 source decision `d49b7d0`. It does not commit the 74.7MB raw file. The
compact normalized artifact is redistributable under CC BY 4.0 with the source
attribution and transformation disclosure embedded in the artifact.

## Exact selection

```text
source release:  PRIMAP-hist_v2.6.1_final
scenario:        HISTTP
entity:          KYOTOGHG (AR6GWP100)
category:        M.0.EL
years:           2014–2023
source unit:     gigagram CO2 equivalent / year
output unit:     MtCO2e / year
formula:         value_mtco2e = source_value_ggco2e / 1000
evidence plane:  harmonized
LULUCF:          excluded
```

HISTTP is a third-party harmonized estimate. It is never labelled official.
HISTCR is not ingested or merged and must remain a separate evidence plane.
`M.0.EL` means the national total excluding LULUCF; land-use emissions are not
silently added.

The selected CSV rows do not by themselves establish whether international
bunker memo items are inside or outside the selected total. The artifact stores
`not_specified_for_selected_category` and blocks silent comparison with an
accounting frame that makes a bunker treatment claim. The selected rows also do
not provide uncertainty bounds; this absence is recorded explicitly and must
not be presented as zero uncertainty.

## Pinned source

```text
file:    PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv
bytes:   74,692,621
MD5:     09b9c61629f87e16012222e5b303bc36
SHA-256: 7607f2b7c5b00d3ddbb19e5c7b100ff7bd8c2d8c2bfc8959c40f41d2cfecf4d9
DOI:     https://doi.org/10.5281/zenodo.15016289
licence: CC-BY-4.0
```

Attribution: Gütschow, Busch and Pflüger (2025), PRIMAP-hist v2.6.1
final, https://doi.org/10.5281/zenodo.15016289, retrieved 2026-07-15.
Earth Love United selected HISTTP, `KYOTOGHG (AR6GWP100)`, `M.0.EL`, and
converted gigagrams CO2 equivalent per year to megatonnes CO2 equivalent per
year.

## Coverage and exclusions

The exact source slice has 215 rows and 215 nonempty 2023 values:

- 206 exact ISO alpha-3 matches to CT-02 country IDs;
- 8 aggregates (`ANNEXI`, `AOSIS`, `BASIC`, `EARTH`, `EU27BX`, `LDC`,
  `NONANNEXI`, `UMBRELLA`);
- 1 obsolete code (`ANT`);
- 0 otherwise unmapped rows; and
- 43 of the 249 CT-02 identity entries without a selected source row.

Every registry entry receives an explicit coverage state. Every excluded source
row retains its CSV row number and complete source row key.

## Review and publication boundary

These are real values built by the ingestion author and have not been checked
by a different reviewer. Therefore every series is `not_reviewed`, release and
scoring eligibility are false, and the release manifest instructs CT-40 to
return `deny_not_reviewed`. No performance label, impact band, score, ranking,
or target is present.

The normalized artifact may be inspected and independently reviewed. It must
not feed public assessment, ranking, card status, or globe performance styling
until a separate reviewer signs off and the release gate is rebuilt.

CC BY 4.0 candidate redistribution is distinct from site release eligibility:
the normalized candidates may be shared for audit with attribution, but the
site must not consume them as reviewed evidence.

## Rebuild

```bash
node tools/build-primap-economy-wide.js \
  /tmp/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv \
  2026-07-15T00:00:00Z

node tools/check-primap-economy-wide.js \
  /tmp/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv
```

The build has no network or package dependency. It refuses a raw file whose
size, MD5, or SHA-256 differs from the approved source. Release time is caller
supplied; the artifact and manifest carry deterministic calculation hashes.
