---
language:
  - en
license: cc-by-sa-4.0
tags:
  - climate
  - carbon
  - emissions
  - ndc
  - paris-agreement
  - climate-action-tracker
  - global-carbon-budget
  - pledge-vs-reality
task_categories:
  - tabular-classification
  - tabular-regression
size_categories:
  - 1K<n<10K
configs:
  - config_name: default
    data_files:
      - split: train
        path: data/train-00000-of-00001.parquet
---

# Climate Pledge vs Reality Dataset

**212 countries × 10 years (2015–2024) = 2,120 records with 52 columns**

This dataset quantifies the gap between countries' climate pledges (NDCs) and their actual emissions reality. It combines data from 5 major sources to create the most comprehensive country-level climate accountability dataset available.

## Data Sources

| Source | Coverage | Data |
|--------|----------|------|
| **Global Carbon Budget 2025** | 212 countries | Annual fossil CO2 emissions (MtCO2, MtC) |
| **Climate Action Tracker** | 40 countries | Detailed ratings (overall, NDC target, policies, fair share), NDC target values (MtCO2e), BAU scenarios, baseline years, net zero targets |
| **UNFCCC NDC Registry** | 196 countries | Latest NDC submission date, version, language, target year |
| **World Bank** | 192 countries | Population, GDP |
| **Climate Watch** | N/A | NDC content indicators (API limited) |

## Columns (52 total)

### Core
- `country` — Standardized country name
- `year` — 2015–2024
- `fossil_co2_mtCO2` — Annual fossil CO2 emissions (million tonnes CO2)
- `fossil_co2_mtC` — Annual fossil CO2 emissions (million tonnes carbon)

### Emissions Metrics
- `co2_per_capita_t` — Per-capita emissions (tonnes CO2/person)
- `co2_intensity_kg_per_usd` — Emissions intensity (kg CO2 per USD GDP)
- `emissions_change_from_2015_pct` — % change from 2015 baseline
- `yoy_change_pct` — Year-over-year % change
- `cumulative_co2_mtCO2` — Cumulative emissions from 2015

### NDC Pledges
- `ndc_target_year` — Target year from NDC title
- `ndc_version` — NDC version number
- `ndc_submission_date` — Date of latest submission
- `language` — Language of submission

### CAT Ratings (40 countries)
- `cat_overall_rating` — Overall CAT rating
- `cat_policies_and_actionagainst_modelled_domestic_pathways` — Policies & action rating
- `cat_ndc_targetagainst_modelled_domestic_pathways` — NDC target rating
- `cat_ndc_targetagainst_fair_share` — NDC fair share rating
- `cat_climate_finance` — Climate finance rating
- `cat_net_zero_target` — Net zero comprehensiveness
- `cat_land_use_and_forestry` — LULUCF status
- `cat_ndc_target_2030_mtco2e` — NDC 2030 target (MtCO2e)
- `cat_bau_2030_mtco2e` — Business-as-usual 2030 (MtCO2e)
- `cat_reduction_pct` — Stated reduction percentage
- `cat_baseline_year` — Baseline year for targets
- `cat_target_year` — Target year from CAT assessment

### Gap Analysis
- `gap_pct` — Required vs actual annual reduction gap
- `on_track` — Whether country is on track ('true'/'false')
- `required_annual_reduction_pct` — Required annual % reduction
- `years_to_target` — Years remaining to target

### Globe Visualization
- `globe_color` — Hex color for globe (green→red based on CAT rating)
- `cat_rating_score` — Numeric score (1–5)

### Data Quality Flags
- `has_cat_rating` — Has CAT rating
- `has_ndc_target` — Has NDC target year
- `has_per_capita` — Has per-capita data

### Economic
- `population` — World Bank population
- `gdp_usd` — World Bank GDP (USD)

## CAT Rating Scale

| Rating | Score | Color | Description |
|--------|-------|-------|-------------|
| 1.5°C Paris Agreement Compatible | 5 | #27ae60 | Aligned with 1.5°C |
| Almost sufficient | 4 | #2ecc71 | Close to 1.5°C |
| Insufficient | 3 | #f39c12 | 2°C pathway |
| Highly insufficient | 2 | #e74c3c | 3°C+ pathway |
| Critically insufficient | 1 | #c0392b | 4°C+ pathway |
| Not assessed | 0 | #95a5a6 | No CAT assessment |

## Usage

```python
from datasets import load_dataset

ds = load_dataset("ego0op/climate-pledge-vs-reality")
df = ds["train"].to_pandas()

# Top emitters 2024
top = df[df["year"] == 2024].nlargest(10, "fossil_co2_mtCO2")

# Countries on track vs off track
on_track = df[(df["year"] == 2024) & (df["on_track"] == "true")]
off_track = df[(df["year"] == 2024) & (df["on_track"] == "false")]

# Per-capita emissions
df["co2_per_capita_t"].describe()
```

## Limitations

- NDC target years are parsed from submission titles (only 18 countries have explicit year ranges)
- CAT assessments cover 40 major emitters (not all 212 countries)
- Population/GDP data from World Bank may not cover all countries
- Climate Watch API returned limited data (pagination needed)

## Citation

```
Earth Love United (2026). Climate Pledge vs Reality Dataset.
https://huggingface.co/datasets/ego0op/climate-pledge-vs-reality
```

## License

CC BY-SA 4.0 — Data compiled from publicly available sources.
Individual sources retain their own licenses.
