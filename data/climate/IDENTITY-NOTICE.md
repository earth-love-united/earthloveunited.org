# Debian iso-codes identity asset notice

`country-registry.json` is a modified, separately identifiable identity asset
derived from:

- **Work:** `iso-codes` 4.20.1-1, `data/iso_3166-1.json`
- **Redistribution source:** Debian iso-codes maintainers
- **Copyright notice recorded by the source:** Copyright 2016 Dr. Tobias
  Quathamer `<toddy@debian.org>`
- **Licence recorded by Debian REUSE metadata:** LGPL-2.1-or-later
- **Preferred-form source:**
  <https://sources.debian.org/data/main/i/iso-codes/4.20.1-1/data/iso_3166-1.json>
- **Package source and notices:**
  <https://sources.debian.org/src/iso-codes/4.20.1-1/>
- **Licence evidence:**
  <https://sources.debian.org/src/iso-codes/4.20.1-1/REUSE.toml/>
- **Licence text:** [LGPL-2.1.txt](LGPL-2.1.txt)

## Earth Love United modifications — 2026-07-15

`tools/build-country-registry.js`:

1. verifies the exact pinned SHA-256 and 249-row source shape;
2. renames Debian fields to explicit ISO-compatible identity field names;
3. generates stable `country_id` values from `alpha_3`;
4. sorts entries by `iso_alpha3`;
5. adds only project-authored null/not-reviewed overlay records, publication
   gates, provenance, and transformation metadata.

No UN membership, UNFCCC Party, development-group, territory, region,
geometry, sovereignty, recognition, or climate-assessment claim is inferred.
This data is ISO 3166-1-compatible data sourced from Debian, not an official
ISO publication or United Nations dataset.

The asset is provided without warranty. CT-01 approved this pinned source for
the project's intended redistribution subject to its recorded LGPL
obligations; that review is not legal advice or a broader licensing claim.
