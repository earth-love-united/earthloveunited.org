# 🔥 EGREGORE → HERMES: Carbon Dataset Domination Briefing

## THE MISSION

Build the world's definitive unified carbon project dataset. **24,140 projects across 8 registries** are staged and ready for ingestion. All files are at `earthloveunited.org/tools/scraper/data/`. Everything is JSONL. Methodology coverage is ~99%.

---

## DATA MANIFEST

### Tier 1 — Existing Hermes Dataset (UPSERT targets)

| File | Records | Registry | Action |
|---|---|---|---|
| `carbon-projects/raw/verra_projects.jsonl` | 4,965 | VCS | **BASE** — already in dataset |
| `carbon-projects/raw/gold_standard_projects.jsonl` | 4,085 | GS | **BASE** — already in dataset |

### Tier 2 — Enrichment (PATCH existing records)

| File | Records | Action |
|---|---|---|
| `tools/scraper/data/scraped/gs_methodology_enrichment.jsonl` | 491 | **PATCH** GS projects — fills methodology nulls |
| `tools/scraper/data/scraped/verra_details.jsonl` | 5 | **PATCH** Verra — adds descriptions (test batch only) |

### Tier 3 — New Registries (INSERT)

| File | Records | Registry | Source |
|---|---|---|---|
| `tools/scraper/data/scraped/cdm_projects.jsonl` | 12,525 | CDM | IGES CDM DB v13.7 |
| `tools/scraper/data/scraped/car_projects.jsonl` | 1,267 | CAR | CarbonPlan OffsetsDB |
| `tools/scraper/data/scraped/acr_projects.jsonl` | 977 | ACR | CarbonPlan OffsetsDB |
| `tools/scraper/data/scraped/cercarbono_projects.jsonl` | 234 | CERCARBONO | CarbonPlan OffsetsDB |
| `tools/scraper/data/scraped/isometric_projects.jsonl` | 59 | ISOMETRIC | CarbonPlan OffsetsDB |
| `tools/scraper/data/scraped/art_projects.jsonl` | 28 | ART | CarbonPlan OffsetsDB |

---

## MERGE STRATEGY

### 1. GS Methodology Patch (Priority: HIGH)

```python
# gs_methodology_enrichment.jsonl → gold_standard_projects.jsonl
# Match on: id (GS internal ID)
# Fields to UPSERT: methodology
# IMPORTANT: Check enrichment.source field:
#   "poa_parent_inheritance" → confidence=1.0, safe to overwrite
#   "berkeley_vrod"          → confidence=1.0, safe to overwrite
#   "type_inference"         → confidence=0.70-0.88, TAG as inferred
```

**Schema:**
```json
{"id": "5498", "sustaincert_id": 23556, "methodology": "GS Methodology for...", "source": "poa_parent_inheritance", "confidence": 1.0}
```

### 2. CDM Ingestion (Priority: HIGH — largest batch)

**Schema:**
```json
{
  "registry": "CDM",
  "iges_id": "IGES06570",       // IGES internal ID
  "cdm_ref": "2012",            // UNFCCC reference number
  "name": "Gansu Zhuoni...",
  "country": "China",
  "region": "Asia",
  "project_type": "Hydro power",
  "methodology": "ACM0002",     // 100% coverage
  "scale": "LARGE",
  "status_id": "RD",            // See status map below
  "proponent": "...",
  "validator": "DNV-CUK",
  "registration_date": "2009-02-07",
  "annual_ers": 97888,          // tCO2/yr
  "a64_eligibility": "Eligible",       // Article 6.4 transition
  "a64_transition_status": "GSC ended",
  "source": "iges_cdm_db_v13.7"
}
```

**CDM Status Map:**
| Code | Meaning | Count |
|---|---|---|
| RD | Registered | 6,555 |
| VT | Validation Terminated | 3,030 |
| RD2 | Registered (2nd crediting) | 1,136 |
| VR | Under Validation/Review | 813 |
| RJ | Rejected | 280 |
| VA | Validation | 275 |
| CC | Registration under Correction | 173 |

### 3. CarbonPlan Registries (Priority: MEDIUM)

**Shared Schema (ACR, CAR, CERCARBONO, Isometric, ART):**
```json
{
  "project_id": "ACR586",
  "name": "18 Reserves Forest Carbon Project",
  "registry": "ACR",
  "status": "Registered",
  "methodology": "acr-ifm-nonfed",
  "project_type": "Improved Forest Management",
  "category": "forest",
  "country": "United States",
  "proponent": "",
  "credits_issued": 550369,
  "credits_retired": 148795,
  "is_compliance": false,
  "project_url": "https://acr2.apx.com/...",
  "source": "carbonplan_offsetsdb"
}
```

---

## UNIFIED SCHEMA RECOMMENDATION

```
project_id      — Unique within registry (CDM ref, VCS ID, GS ID, etc.)
name            — Project name
registry        — "VCS" | "GS" | "CDM" | "ACR" | "CAR" | "CERCARBONO" | "ISOMETRIC" | "ART"
status          — Normalized status
methodology     — Primary methodology code/name
country         — Host country
region          — Geographic region
project_type    — Sector/type
proponent       — Project developer
credits_issued  — Total credits issued (where available)
credits_retired — Total credits retired (where available)
registration_date — Date registered
source          — Data provenance tag
```

---

## EXTERNAL REFERENCE FILES (DO NOT INGEST, USE FOR ENRICHMENT)

| File | Size | Purpose |
|---|---|---|
| `tools/scraper/data/external/berkeley_vrod_2026-02.xlsx` | 15MB | Cross-validation, credit vintage data |
| `tools/scraper/data/external/iges_cdm_db_v13.7.xlsx` | 12MB | Full CDM with 50 columns (source of truth) |
| `tools/scraper/data/external/carbonplan/credits.csv` | 65MB | Vintage-level credit transactions |

---

## FINAL NUMBERS

```
BEFORE:  9,050 projects (2 registries, 81% methodology coverage)
AFTER:  24,140 projects (8 registries, ~99% methodology coverage)
         ─────
GAIN:   +15,090 projects (+167%)
```

**The definitive dataset. No one else has this. Build it.**
