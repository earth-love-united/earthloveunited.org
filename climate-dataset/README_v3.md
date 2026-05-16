---
language:
  - en
license: cc-by-4.0
task_categories:
  - text-retrieval
  - question-answering
task_ids:
  - open-domain-qa
  - document-retrieval
tags:
  - climate
  - climate-change
  - carbon
  - earth-science
  - ipcc
  - rag
  - knowledge-base
  - tipping-points
  - geological-time
pretty_name: "Earth Love United Climate Knowledge"
size_categories:
  - 10K<n<100K
configs:
  - config_name: text_chunks
    data_files:
      - split: train
        path: earth_love_united_climate_knowledge_v3.jsonl
  - config_name: climate_facts
    data_files:
      - split: train
        path: climate-facts.json
  - config_name: geological_memory
    data_files:
      - split: train
        path: geological-memory.json
  - config_name: bifurcation_points
    data_files:
      - split: train
        path: climate-bifurcation-points.json
---

# 🌍 Earth Love United Climate Knowledge Dataset

> **The most comprehensive open climate science knowledge dataset.**
> 10,128 text chunks + 124 structured facts + 4.54B year geological memory + 10 tipping points.
> Built to power GAIA — an AI that embodies the living consciousness of Earth.

## Dataset Overview

This dataset gives an AI system **authoritative, sourced knowledge** about climate change,
carbon, Earth science, and solutions. It has **four layers**:

### Layer 1: Text Knowledge (10,128 chunks)
Curated from authoritative sources, cleaned, chunked, and indexed.

| Source | Documents | Coverage |
|--------|-----------|----------|
| Wikipedia | 283 articles | Climate science, impacts, solutions, policy, justice, biodiversity |
| arXiv | 4,092 papers | Cutting-edge climate research |
| IPCC AR6 | 5 reports | Gold standard climate science |
| Project Drawdown | 33 solutions | Climate solutions ranked by impact |
| US EPA | 8 pages | Plain-language government explanations |
| Earth Love United | 83 sections | Original research synthesis |
| Climate Economics | 52 articles | Carbon pricing, finance, policy, justice |

**File**: `earth_love_united_climate_knowledge_v3.jsonl` (25 MB)
**Search index**: `knowledge-index.json.gz` (1.1 MB compressed, 23,757 terms)

### Layer 2: Climate Facts (124 structured data points)
Cold, sourced, verifiable numbers. Every fact has: value, unit, source, year, confidence.

**Coverage**: Atmospheric concentrations, global temperature, carbon budget, sea level, carbon pools, ecosystem data (mangroves, seagrasses, peatlands, biochar, hemp, kelp, coral, permafrost), solutions metrics, emissions by sector, top emitters, climate sensitivity, ocean, ice, carbon pricing, climate finance, food system, energy transition.

**File**: `climate-facts.json` (25 KB)

### Layer 3: Geological Memory (4.54 billion years)
Earth's history across 4 eras, 44 events, comparative data, and GAIA voice quotes.

**Eras**: Hadean (formation, Moon birth), Archean (first life, photosynthesis), Proterozoic (Great Oxidation, Snowball Earths), Phanerozoic (5 mass extinctions, current crisis).

**Includes**: CO2 through time (10 data points), temperature through time (8 points), 5 mass extinctions with recovery times, 6 GAIA voice quotes.

**File**: `geological-memory.json` (16 KB)

### Layer 4: Bifurcation Points (10 tipping points)
Specific thresholds beyond which the climate system shifts to a new state.

**Tipping points covered**: Greenland Ice Sheet, West Antarctic Ice Sheet, Amazon rainforest, AMOC, permafrost, coral reefs, Arctic sea ice, boreal forest, West African monsoon, methane clathrates.

**Includes**: Threshold temperatures, irreversibility status, timescales, consequences, current status, GAIA voice quotes.

**File**: `climate-bifurcation-points.json` (13 KB)

## Files

| File | Size | Description |
|------|------|-------------|
| `earth_love_united_climate_knowledge_v3.jsonl` | 25 MB | Main dataset: 10,128 text chunks |
| `knowledge-index.json.gz` | 1.1 MB | Compressed inverted index for fast search |
| `climate-facts.json` | 25 KB | 124 structured climate data points |
| `geological-memory.json` | 16 KB | 4.54B year Earth timeline |
| `climate-bifurcation-points.json` | 13 KB | 10 tipping points and thresholds |
| `worker.js` | 24 KB | GAIA isolate runtime (23 tools, 4 knowledge layers) |

## Data Format

### Text Chunks (JSONL)
```json
{
  "id": "ipcc_ar6_wgi_spm_chunk_0",
  "source": "IPCC",
  "title": "AR6 WGI Summary for Policymakers",
  "text": "The global surface temperature has increased by approximately 1.1°C...",
  "chunk_index": 0,
  "total_chunks": 42,
  "url": "https://www.ipcc.ch/...",
  "date": "2021-08-09",
  "type": "ipcc_spm",
  "topics": ["climate science", "temperature", "attribution"],
  "confidence": "very_high",
  "word_count": 385
}
```

### Climate Facts (JSON)
```json
{
  "mangrove_carbon_sequestration_rate": {
    "value": 6.3,
    "unit": "tCO2/ha/year",
    "source": "Donato et al. 2011, Nature Geoscience",
    "year": 2011,
    "confidence": "high",
    "note": "Average across tropical mangroves. Range 2-10."
  }
}
```

### Bifurcation Points (JSON)
```json
{
  "name": "Greenland Ice Sheet collapse",
  "threshold_celsius": 1.5,
  "threshold_range": "1.0-3.0",
  "confidence": "medium",
  "irreversibility": "Yes",
  "timescale": "Centuries to millennia",
  "sea_level_contribution": 7.2,
  "gaia_voice": "I have carried ice sheets for 3 million years..."
}
```
## Loading the Dataset

```python
from datasets import load_dataset
import json
from huggingface_hub import hf_hub_download

# Layer 1: Text chunks (10,128 chunks)
ds = load_dataset("ego0op/earth-love-united-climate-knowledge", "text_chunks", split="train")

# Layer 2: Climate facts (124 structured facts)
facts = json.load(open(hf_hub_download(repo_id="ego0op/earth-love-united-climate-knowledge",
                                        filename="climate-facts.json", repo_type="dataset")))

# Layer 3: Geological memory (4.54B year timeline)
geo = json.load(open(hf_hub_download(repo_id="ego0op/earth-love-united-climate-knowledge",
                                      filename="geological-memory.json", repo_type="dataset")))

# Layer 4: Bifurcation points (11 tipping points)
bp = json.load(open(hf_hub_download(repo_id="ego0op/earth-love-united-climate-knowledge",
                                     filename="climate-bifurcation-points.json", repo_type="dataset")))
```

## Sources and Licensing

| Source | License | Notes |
|--------|---------|-------|
| IPCC reports | Free for any use | |
| Wikipedia | CC-BY-SA 3.0 | Share-alike obligations propagate to derivative works |
| arXiv abstracts | Author-licensed (varies, typically CC-BY) | Not public domain; check individual paper licenses |
| Project Drawdown | Copyright | Educational use permitted |
| US EPA | Public domain | US government work |
| ELU Research | CC-BY-4.0 | |

**Overall dataset license**: CC-BY-4.0. However, the Wikipedia content within this dataset carries CC-BY-SA 3.0 share-alike obligations. If you redistribute derivative works incorporating Wikipedia content, those works must be licensed under CC-BY-SA 3.0 or compatible.

## What Makes This Dataset Different

1. **Four layers of knowledge** — Text for explanations, facts for precise numbers, geological memory for deep time, bifurcation points for tipping points
2. **Zero speculation** — Every claim is sourced. Confidence levels are explicit
3. **Carbon-relevant focus** — Every topic connects to the carbon cycle, climate impacts, or solutions
4. **Deep time perspective** — 4.54 billion years of Earth history, not just the last 200 years
5. **Tipping point precision** — Exact thresholds, irreversibility status, timescales, and consequences
6. **AI-optimized** — Chunked for RAG, indexed for fast retrieval, structured for precise answers

## Citation

```bibtex
@dataset{earth_love_united_climate_knowledge_2026,
  title = {Earth Love United Climate Knowledge Dataset},
  author = {Earth Love United Foundation},
  year = {2026},
  url = {https://huggingface.co/datasets/ego0op/earth-love-united-climate-knowledge}
}
```

## Acknowledgments

Curated by the [Earth Love United Foundation](https://earthloveunited.org).
We thank the IPCC, Wikipedia editors, arXiv, Project Drawdown, NOAA, NASA, and the global climate science community.
