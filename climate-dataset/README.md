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
  - environment
  - science
  - ipcc
  - wikipedia
  - arxiv
  - rag
  - knowledge-base
  - drawdown
  - epa
  - earth-love-united
pretty_name: "Earth Love United Climate Knowledge"
size_categories:
  - 10K<n<100K
source_datasets:
  - original
  - wikipedia
  - arxiv
  - ipcc
---

# 🌍 Earth Love United Climate Knowledge Dataset

> An open climate-science knowledge dataset curated for RAG, AI assistants,
> public education, and source-traceable climate inquiry.

## Dataset Description

This dataset contains **7,260 chunks of authoritative climate science knowledge**
sourced from the world's most trusted climate institutions:

- **IPCC AR6** (5 reports) — major international climate assessments
- **Wikipedia** (119 climate articles) — broad encyclopedic coverage
- **arXiv** (4,092 climate papers) — research abstracts and paper metadata
- **Project Drawdown** (24 solutions) — structured climate solutions material
- **US EPA** (8 explainers) — plain-language government explanations
- **Earth Love United** (83 sections) — original research synthesis

## Dataset Statistics

| Source | Documents | Chunks | Words | Confidence |
|--------|-----------|--------|-------|------------|
| Wikipedia | 119 | ~2,200 | 667K | high |
| arXiv | 4,092 | 4,094 | ~1M | high |
| IPCC AR6 | 5 | 348 | 100K | very_high |
| Project Drawdown | 24 | 456 | 100K | very_high |
| US EPA | 8 | 19 | 10K | very_high |
| Earth Love United | 83 | 85 | 100K | very_high |
| **Total** | **4,331** | **7,260** | **~2M** | — |

## Data Format

```json
{
  "id": "ipcc_ar6_wgi_spm_chunk_0",
  "doc_id": "ipcc_ar6_wgi_spm",
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

## Intended Use

1. **RAG (Retrieval-Augmented Generation)** — Power climate AI chatbots
2. **Question Answering** — Train/fine-tune climate QA models
3. **Climate Education** — Build interactive learning experiences
4. **Fact-Checking** — Verify climate claims against authoritative sources

## Provenance Registry

Public readiness language for this dataset is maintained in
[`../data/provenance-registry.json`](../data/provenance-registry.json) under
the `climate-knowledge` entry. Update that registry entry when source families,
intended use, known limits, local paths, or Hugging Face links change.

Validate the registry from the repository root:

```bash
node tools/check-provenance-registry.js
```

## Sources and Licensing

| Source | License | Commercial Use |
|--------|---------|---------------|
| IPCC reports | Free for any use | Yes |
| Wikipedia | CC-BY-SA 3.0 | Yes (with attribution) |
| arXiv abstracts | Public domain | Yes |
| Project Drawdown | Copyright | Educational use |
| US EPA | Public domain | Yes |
| ELU Research | CC-BY-4.0 | Yes |

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
We thank the IPCC, Wikipedia editors, arXiv, Project Drawdown, and the US EPA.
