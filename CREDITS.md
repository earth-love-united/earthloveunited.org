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
- **Version vendored:** 2.46.1
- **Location in repo:** `js/vendor/globe.gl.js` (gitignored — re-fetch from upstream CDN)

### three-globe (textures + geometry)
The earth surface, bump, specular, and night-sky textures used by globe.gl.

- **Project:** https://github.com/vasturiano/three-globe
- **Author:** Vasco Asturiano
- **License:** MIT
- **Assets used (loaded from jsdelivr CDN):**
  - `earth-night.jpg`
  - `earth-topology.png`
  - `earth-water.png`
  - `night-sky.png`

### three.js
The underlying WebGL engine for globe.gl.

- **Project:** https://github.com/mrdoob/three.js
- **License:** MIT
- **Loaded via:** CDN (no vendored copy)

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
