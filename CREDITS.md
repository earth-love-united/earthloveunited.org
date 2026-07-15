# Credits & Attribution

Earth Love United is built on the shoulders of a remarkable global commons.
This file lists every third-party component, dataset, and primary source that
this project incorporates, references, or builds upon. We are grateful to all
of these creators and institutions for their work being freely available.

If you find an attribution missing or incorrect, please open an issue.

---

## Code dependencies

### globe.gl
Interactive 3D globe rendering — the visual centerpiece of the site.

- **Project:** https://github.com/vasturiano/globe.gl
- **Author:** Vasco Asturiano ([@vasturiano](https://github.com/vasturiano))
- **License:** MIT
- **Version:** 2.46.1
- **Pinned SHA-256:** `2ab6767f47e2be0ac346cd7a5eb55d259ea3da06d479dc22f1820ddd698f496a`
- **Delivery:** `./tools/fetch-globe-vendor.sh` fetches the exact HTTPS source,
  verifies the digest, and atomically installs the generated local copy
- **Generated location:** `js/vendor/globe.gl.js` (gitignored; never commit the
  1.8 MB generated file)
- **Notice boundary:** the exact minified file is a composite bundle. Its full
  dependency notice inventory has not yet been independently reviewed or
  deployed, so this pin does not by itself establish production redistribution
  readiness.

### Globe runtime assets
The country navigation geometry and four decorative globe images are committed
under `assets/globe/runtime/` and pinned in
`assets/globe/runtime/manifest.json`. Runtime requests are same-origin and use
content-versioned query keys; they are not loaded from a CDN.

- **Natural Earth geometry:**
  `ne_110m_admin_0_countries.geojson`, from the exact `globe.gl@2.46.1`
  example URL recorded in the manifest. Natural Earth's
  [project description](https://www.naturalearthdata.com/about/) explains the
  dataset, and its data are public domain under the project's
  [official terms](https://www.naturalearthdata.com/about/terms-of-use/).
  The 1:110m file is generalized, follows Natural Earth's
  [disputed-boundaries policy](https://www.naturalearthdata.com/about/disputed-boundaries-policy/),
  and is used only for navigation—not as a sovereignty, legal boundary, or
  climate-performance judgment.
- **three-globe 2.45.2 image files:** `earth-blue-marble.jpg`,
  `earth-night.jpg`, `earth-topology.png`, and `night-sky.png`, from the exact
  versioned URLs, SHA-256 digests, sizes, and dimensions in the manifest.
- **Rights boundary:** Package inclusion establishes byte provenance, not production image-rights clearance.
  The four underlying image rights and the
  applicable deployed notice sections are **not reviewed**;
  `production_use_approved` and `release_authority` remain `false`.
- **Small-state navigation points:** 28 manually curated approximate point
  affordances are pinned to `data/small-nations.json` and normalized to the
  candidate registry names by ISO. They are not Natural Earth polygons,
  boundaries, sovereignty assertions, or precise centroids.

### three.js
The WebGL engine is included transitively inside the exact composite globe.gl
bundle; it is not loaded separately from a CDN.

- **Project:** https://github.com/mrdoob/three.js
- **License:** MIT
- **Notice status:** included in the pending exact-bundle third-party notice
  review above; no blanket production-compliance claim is made here.

---

## Datasets we publish (Hugging Face)

Our own curated datasets, released under open licenses for the research and
climate-AI community. **286 downloads** across three public datasets at the
time of going public — and growing.

Maintainer profile: https://huggingface.co/ego0op

### `ego0op/earth-love-united-climate-knowledge`
The primary RAG corpus powering Gaia's grounded responses.

- **URL:** https://huggingface.co/datasets/ego0op/earth-love-united-climate-knowledge
- **License:** CC BY 4.0
- **Rows:** ~10,100  •  **Downloads:** 158
- **Contents:** 7,260 chunks across IPCC AR6, Wikipedia (119 articles),
  arXiv (4,092 papers), Project Drawdown (24 solutions), US EPA (8 explainers),
  and 83 sections of original ELU synthesis.

### `ego0op/carbon-projects-unified`
Unified, deduplicated carbon offset project records across registries.

- **URL:** https://huggingface.co/datasets/ego0op/carbon-projects-unified
- **License:** CC BY 4.0
- **Rows:** ~23,300  •  **Downloads:** 100  •  **Likes:** 1

### `ego0op/earth-love-united-carbon-projects`
Companion carbon-projects dataset with foundation-specific framing.

- **URL:** https://huggingface.co/datasets/ego0op/earth-love-united-carbon-projects
- **License:** CC BY 4.0
- **Rows:** ~23,300  •  **Downloads:** 28

---

## Upstream data sources (incorporated into our datasets)

### IPCC AR6 (Sixth Assessment Report)
The gold standard of climate science consensus.

- **Publisher:** Intergovernmental Panel on Climate Change
- **URL:** https://www.ipcc.ch/assessment-report/ar6/
- **Reports used:** WGI SPM, WGII SPM, WGIII SPM, SR1.5, Synthesis Report
- **Terms:** Free for non-commercial use with attribution to IPCC.

### Project Drawdown
Catalog of evidence-ranked climate solutions.

- **Publisher:** Project Drawdown
- **URL:** https://drawdown.org
- **Terms:** CC BY-NC 4.0 (non-commercial). We attribute solutions to Drawdown
  in every chunk and link back to original solution pages.

### CarbonPlan OffsetsDB
Carbon offset registry data aggregated across ACR, ART TREES, Cercarbono,
CAR, Gold Standard, Isometric, and Verra.

- **Publisher:** CarbonPlan
- **URL:** https://carbonplan.org
- **Terms of Use:** https://carbonplan.org/terms
- **Note:** Original registry data is owned by the respective registries.
  CarbonPlan aggregates and standardizes the formatting.

### US EPA — Climate Change Indicators
Plain-language US government climate explainers.

- **Publisher:** United States Environmental Protection Agency
- **URL:** https://www.epa.gov/climate-indicators
- **Terms:** US Federal Government works are public domain in the US.

### Wikipedia (Climate articles)
Encyclopedic coverage of climate topics.

- **URL:** https://en.wikipedia.org
- **License:** CC BY-SA 4.0 — text snippets in our corpus retain this license
  and require attribution + ShareAlike if redistributed independently.

### arXiv (Climate papers)
Open-access climate research preprints.

- **URL:** https://arxiv.org
- **Terms:** Per-paper license varies (most CC BY 4.0 or arXiv non-exclusive
  license). We store only abstracts and metadata.

### NOAA Global Monitoring Laboratory
Real-time atmospheric greenhouse gas measurements (CO₂, CH₄, N₂O, SF6).

- **Publisher:** US National Oceanic and Atmospheric Administration
- **URL:** https://gml.noaa.gov
- **Terms:** US Federal Government — public domain.

### Our World in Data — CO₂ Dataset
Country-level emissions records from 1751 to present.

- **Publisher:** Our World in Data
- **URL:** https://ourworldindata.org/co2-emissions
- **License:** CC BY 4.0

---

## Fonts & visual assets

All UI fonts in the site are either system fonts or loaded from Google Fonts
under the SIL Open Font License (OFL).

Visual designs (color palette, glassmorphic UI patterns, ring animations) are
original to Earth Love United and shared under the same MIT license as the
code.

---

## AI agents & tooling

This site was co-developed with the assistance of large language model agents
(Hermes, Owl alpha, and others). All training data they generated during this
project belongs to the agents' respective hosts under their published terms.
Earth Love United releases all of its own code and content under the licenses
declared above, with no restrictions on training-data use.

---

## How to cite Earth Love United

If you use this code or the datasets above in academic or applied work:

```bibtex
@misc{earth_love_united_2026,
  title  = {Earth Love United: An open climate-action knowledge platform},
  author = {Ozdemir, Ekmel and the Earth Love United Foundation},
  year   = {2026},
  url    = {https://earthloveunited.org},
  note   = {Source code: https://github.com/<ORG>/earthloveunited.org}
}
```

For dataset-specific citations, use the BibTeX entries on the corresponding
Hugging Face dataset pages.
