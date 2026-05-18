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
  - voluntary-carbon-market
  - earth-love-united
task_categories:
  - tabular-classification
  - text-generation
size_categories:
  - 1K<n<10K
source_datasets:
  - original
---

# Carbon Projects Unified Dataset

**8,877 unique carbon projects** from Verra and Gold Standard registries, normalized and deduplicated.

## Quick Stats

| Metric | Value |
|--------|-------|
| Total projects | 8,877 |
| Countries | 155 |
| Cross-registered | 173 |
| Est. annual reductions | 2.9B tCO2e |
| Methodology coverage | 83.1% |
| Description coverage | 46.0% |

## Sources

- **Verra (VCS):** 4,965 projects via public API
- **Gold Standard:** 4,085 projects via public API
- **Cross-registered:** 173 projects merged

## Project Types

| Type | Count |
|------|-------|
| Energy Efficiency | 2,677 |
| Renewable Energy | 2,085 |
| Forestry | 1,961 |
| Waste | 259 |
| Methane | 245 |
| Industrial | 165 |
| Agriculture | 117 |
| Transport | 110 |

## Schema

Each record contains: `unified_id`, `registry_ids`, `name`, `description`, `status`, `project_type`, `location`, `developer`, `crediting`, `registration`, `co_benefits`, `data_quality`, `data_sources`.

See [README.md](README.md) for full schema documentation.

## Known Limitations

- CDM registry (≈8,000 projects) not included — website currently down
- ACR/CAR/Plan Vivo (≈1,300 projects) not included — deferred to v2
- Descriptions only available for Gold Standard projects
- Coordinates only available for 17.3% of projects

## Citation

```
Earth Love United Foundation (2026). Carbon Projects Unified Dataset.
https://huggingface.co/datasets/ego0op/carbon-projects-unified
```

## License

CC-BY-SA-4.0. Source data from Verra and Gold Standard public registries.
