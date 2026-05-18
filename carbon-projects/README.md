---
language:
  - en
license: cc-by-sa-4.0
tags:
  - climate
  - carbon
  - carbon-credits
  - carbon-offset
  - verra
  - gold-standard
  - cdm
  - voluntary-carbon-market
  - earth-love-united
task_categories:
  - tabular-classification
size_categories:
  - 10K<n<100K
configs:
  - config_name: default
    data_files:
      - split: train
        path: carbon_projects_v6.jsonl
---

# Earth Love United — Carbon Projects Unified Dataset

**23,343 unique carbon projects** from 8 registries, normalized, deduplicated, and enriched.

Built by [Earth Love United Foundation](https://earthloveunited.org) for open climate science.

## Quick Stats

| Metric | Value |
|--------|-------|
| Total projects | 23,343 |
| Registries | 8 (Verra, Gold Standard, CDM, CAR, ACR, CERCARBONO, Isometric, ART) |
| Countries | 188 |
| Coordinate coverage | 100% |
| Methodology name coverage | 94% |
| Methodology code coverage | 95.5% |
| Description coverage | 84% |
| Cross-registered | 774 |

## Registry Breakdown

| Registry | Projects |
|----------|----------|
| CDM | 12,525 |
| Verra (VCS) | 4,965 |
| Gold Standard | 4,085 |
| CAR | 1,267 |
| ACR | 977 |
| CERCARBONO | 234 |
| Isometric | 59 |
| ART | 28 |

## Schema

Each record is a JSON Lines entry with: `unified_id`, `registry_ids`, `name`, `description`, `status`, `project_type` (category, sub_category, methodology, methodology_name), `location` (country, region, lat/lon), `developer`, `crediting` (period, annual reductions, credits issued/retired), `registration` (date), `co_benefits` (SDGs, labels), `data_quality` (score, cross_registered), `data_sources`.

## Sources

- **Verra Registry** — Public POST API + browser-scraped detail pages
- **Gold Standard Registry** — Public GET API + UC Berkeley VROD cross-reference
- **CDM (UNFCCC)** — IGES CDM Database v13.7
- **CarbonPlan OffsetsDB** — CAR, ACR, CERCARBONO, Isometric, ART

## License

CC-BY-SA-4.0. Source data from public registry APIs and research databases.

## Citation

```
Earth Love United Foundation (2026). Carbon Projects Unified Dataset.
Hugging Face. https://huggingface.co/datasets/ego0op/carbon-projects-unified
```
