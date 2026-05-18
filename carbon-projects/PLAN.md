# Carbon Project Registry Unification — Complete Plan & Research

## Registry Data Access Summary

### Verra (VCS) — 2,646 registered projects
- **API**: POST `https://registry.verra.org/uiapi/resource/resource/search`
- **Auth**: None required (public)
- **Headers needed**: `Referer: https://registry.verra.org/`, `User-Agent` browser-like
- **Request body**: `{"program":"VCS","page":0,"size":100}`
- **Response**: `{"value":[...],"countExceeded":false}` — NO total count in response
- **Total from summary API**: `https://registry.verra.org/uiapi/program/programSummary/VCS` → `resourcesRegistered: 2646`
- **Fields per project**:
  - `resourceIdentifier` (e.g. "6016")
  - `resourceName`
  - `proponent` (developer)
  - `operator`, `designee`
  - `protocolCategories` (e.g. "Agriculture Forestry and Other Land Use")
  - `protocolSubCategories` (e.g. "ARR", "REDD", "ALM")
  - `protocols` (methodology, e.g. "VM0047", "ACM0001")
  - `resourceStatus` (e.g. "Registered", "Under validation", "Inactive", "Withdrawn")
  - `country`
  - `estAnnualEmissionReductions` (tCO2e/year)
  - `region`
  - `projectRegistrationDate`
  - `version` (e.g. "VCS Version 3")
  - `creditingPeriodStartDate`, `creditingPeriodEndDate`
  - `createDate`
- **Pagination**: page-based (0-indexed), size up to 100
- **Note**: No project detail endpoint found (404 for `/resource/resource/{id}`). All data is in the search response.

### Gold Standard — 4,085 projects
- **API**: GET `https://public-api.goldstandard.org/projects?query=&page=1&size=25`
- **Auth**: None required (public)
- **Headers needed**: `Referer: https://registry.goldstandard.org/`, `User-Agent` browser-like
- **Response**: Array of project objects directly (not wrapped)
- **Total count**: `X-Total-Count: 4085` response header
- **Rate limit headers**: `X-Ratelimit-Quota-Capacity`, `X-Ratelimit-Remaining-Quota`, `X-Ratelimit-Seconds-to-Reset-Quota`
- **Fields per project**:
  - `id` (internal numeric ID)
  - `name`
  - `description` (long text)
  - `status` (e.g. "LISTED", "GOLD_STANDARD_CERTIFIED_DESIGN")
  - `gsf_standards_version` (e.g. "Gold Standard for the Global Goals")
  - `estimated_annual_credits`
  - `crediting_period_start_date`, `crediting_period_end_date`
  - `methodology` (often null in list view)
  - `type` (e.g. "Energy Efficiency - Domestic", "A/R", "PV", "Biogas - Heat")
  - `size` (e.g. "Small Scale", "Large Scale", "Micro Scale")
  - `sustaincert_id` (GS ID number)
  - `sustaincert_url` (link to project documents)
  - `project_developer`
  - `carbon_stream` (e.g. "GS_VER")
  - `country`
  - `country_code` (ISO 3166-1 alpha-2)
  - `latitude`, `longitude` (often null)
  - `state`
  - `crediting_periods` (null in list view)
  - `programme_of_activities` ("Standalone", "POA", "VPA")
  - `poa_project_id`, `poa_project_sustaincert_id`, `poa_project_name` (for VPAs)
  - `sustainable_development_goals` (array of {name, issuable_products})
  - `labels` (array)
  - `created_at`, `updated_at`
- **Pagination**: page-based (1-indexed), size up to 100

### CDM (Clean Development Mechanism) — ~8,000+ projects
- **Website**: https://cdm.unfccc.int/Projects/DB/search.html
- **Access**: Heavily protected (Incapsula bot detection)
- **Data available**: Project name, ID, host country, methodology, developer, CERs issued, status, dates
- **Approach needed**: Browser-based scraping or find alternative data source
- **Alternative**: UNFCCC may have a data dump or CSV export

### Other Registries (to research further)
- **ACR** (American Carbon Registry): ~500 projects — americancarbonregistry.org
- **CAR** (Climate Action Reserve): ~400 projects — climateactionreserve.org
- **Plan Vivo**: ~300 projects — planvivo.org (may have CSV export)
- **ART** (Architecture for REDD+ Transactions): ~100 projects — art-registry.org
- **GCC** (Global Carbon Council): ~50 projects
- **CORSIA-eligible**: ICAO list of eligible programs

## Unified Schema Design

```json
{
  "unified_id": "UUID v4",
  "registry_ids": [
    {"registry": "verra", "id": "6016", "url": "https://registry.verra.org/app/projectDetail/VCS/6016"},
    {"registry": "gold_standard", "id": "GS23645", "url": "https://registry.goldstandard.org/projects/GS23645"}
  ],
  "name": "Project Name",
  "description": "Full project description text",
  "status": "registered|listed|under_validation|inactive|withdrawn|completed",
  "status_raw": "Original status string from registry",
  
  "project_type": {
    "category": "forestry|renewable_energy|energy_efficiency|methane|waste|transport|agriculture|industrial|other",
    "sub_category": "ARR|REDD|ALM|solar|wind|hydro|biogas|cookstove|etc",
    "methodology": "VM0047",
    "methodology_name": "Afforestation/Reforestation Methodology"
  },
  
  "location": {
    "country": "United States",
    "country_code_iso3": "USA",
    "country_code_iso2": "US",
    "region": "North America",
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  
  "developer": {
    "name": "Organization Name",
    "type": "private|ngo|government|partnership"
  },
  "partners": ["partner1", "partner2"],
  
  "crediting": {
    "period_start": "2023-01-01",
    "period_end": "2033-12-31",
    "period_type": "fixed|renewable",
    "estimated_annual_reduction_tco2": 50000,
    "total_estimated_reduction_tco2": 500000,
    "credits_issued": 250000,
    "credits_retired": 100000,
    "credits_cancelled": 0,
    "credit_unit": "VCU|CER|GS_VER|CRT|PVC"
  },
  
  "registration": {
    "date": "2020-03-15",
    "last_verification": "2023-06-01",
    "last_updated": "2025-01-01"
  },
  
  "co_benefits": {
    "sdgs": [7, 13, 15],
    "sdg_details": [
      {"goal": 7, "name": "Affordable and Clean Energy", "products": []},
      {"goal": 13, "name": "Climate Action", "products": ["VER", "CER"]}
    ],
    "labels": ["biodiversity", "livelihoods", "water", "gender_equality"]
  },
  
  "verification": {
    "body": "SCS Global Services",
    "documents_url": "https://..."
  },
  
  "data_quality": {
    "score": 0.0-1.0,
    "cross_registered": true,
    "registries_count": 2,
    "notes": "Cross-registered in Verra and Gold Standard"
  },
  
  "data_sources": [
    {
      "registry": "verra",
      "url": "https://registry.verra.org/app/projectDetail/VCS/6016",
      "last_scraped": "2026-05-16",
      "raw_data": {...}
    }
  ]
}
```

## Registry Field Mapping

### Verra → Unified
| Verra Field | Unified Field | Transform |
|-------------|---------------|-----------|
| resourceIdentifier | registry_ids[].id | Prefix with "VCS-" |
| resourceName | name | Direct |
| proponent | developer.name | Direct |
| protocolCategories | project_type.category | Map taxonomy |
| protocolSubCategories | project_type.sub_category | Direct |
| protocols | project_type.methodology | Direct |
| resourceStatus | status | Normalize |
| country | location.country | Direct |
| estAnnualEmissionReductions | crediting.estimated_annual_reduction_tco2 | Direct |
| region | location.region | Direct |
| projectRegistrationDate | registration.date | Parse date |
| creditingPeriodStartDate | crediting.period_start | Direct |
| creditingPeriodEndDate | crediting.period_end | Direct |

### Gold Standard → Unified
| GS Field | Unified Field | Transform |
|----------|---------------|-----------|
| sustaincert_id | registry_ids[].id | Prefix with "GS-" |
| name | name | Direct |
| description | description | Direct |
| status | status | Normalize |
| type | project_type.category | Map taxonomy |
| methodology | project_type.methodology | Direct |
| country | location.country | Direct |
| country_code | location.country_code_iso2 | Direct |
| estimated_annual_credits | crediting.estimated_annual_reduction_tco2 | Direct |
| crediting_period_start_date | crediting.period_start | Direct |
| crediting_period_end_date | crediting.period_end | Direct |
| project_developer | developer.name | Direct |
| programme_of_activities | project_type.poa_type | Direct |
| sustainable_development_goals | co_benefits.sdg_details | Transform |
| latitude | location.latitude | Direct |
| longitude | location.longitude | Direct |

## Project Type Taxonomy Mapping

### Verra protocolCategories → Unified category
- "Agriculture Forestry and Other Land Use" → forestry
- "Energy industries (renewable/non-renewable sources)" → renewable_energy
- "Energy demand" → energy_efficiency
- "Waste handling and disposal" → waste
- "Transport" → transport
- "Manufacturing industries" → industrial
- "Carbon capture and storage" → industrial
- "Livestock, enteric fermentation, and manure management" → agriculture

### Gold Standard type → Unified category
- "Energy Efficiency - Domestic" → energy_efficiency
- "Energy Efficiency - Public Sector" → energy_efficiency
- "Energy Efficiency - Transport Sector" → transport
- "A/R" → forestry
- "PV" → renewable_energy
- "Biogas - Heat" → methane
- "Other" → other

## Deduplication Strategy

### Matching Signals (weighted)
1. **Project name similarity** (fuzzy, threshold 0.85) — weight: 0.3
2. **Developer name similarity** (fuzzy) — weight: 0.2
3. **Country match** (exact) — weight: 0.15
4. **Project type match** (exact category) — weight: 0.1
5. **Methodology overlap** (exact) — weight: 0.15
6. **Crediting period overlap** (temporal) — weight: 0.1

### Deduplication Rules
- Combined score > 0.7 → same project, merge
- Combined score 0.5-0.7 → flag for manual review
- Combined score < 0.5 → different projects
- Cross-registration is a strong signal (same project in Verra + GS)

## Build Pipeline

### Step 1: Scrape Verra
```python
# Paginate through all projects
all_projects = []
page = 0
while True:
    response = requests.post(
        "https://registry.verra.org/uiapi/resource/resource/search",
        json={"program": "VCS", "page": page, "size": 100},
        headers={"Referer": "https://registry.verra.org/"}
    )
    data = response.json()
    all_projects.extend(data["value"])
    if data["countExceeded"]:
        break
    page += 1
# Expected: ~2,646 projects, ~27 pages
```

### Step 2: Scrape Gold Standard
```python
# Paginate through all projects
all_projects = []
page = 1
while True:
    response = requests.get(
        f"https://public-api.goldstandard.org/projects?query=&page={page}&size=100",
        headers={"Referer": "https://registry.goldstandard.org/"}
    )
    data = response.json()
    if not data:
        break
    all_projects.extend(data)
    total = int(response.headers["X-Total-Count"])
    if page * 100 >= total:
        break
    page += 1
# Expected: ~4,085 projects, ~41 pages
```

### Step 3: Scrape CDM (browser-based)
- Use browser automation to navigate search results
- Extract project data from HTML tables
- Handle pagination via "Next" button clicks
- Expected: ~8,000 projects

### Step 4: Normalize
- Map all registry fields to unified schema
- Normalize country codes (ISO 3166-1 alpha-3)
- Normalize project type taxonomy
- Normalize status values
- Convert all credit units to tCO2e

### Step 5: Deduplicate
- Compute pairwise matching scores
- Merge cross-registered projects
- Flag uncertain matches for review

### Step 6: Enrich
- Add geocoding (lat/lon from country/region)
- Add quality scores
- Calculate aggregate statistics

### Step 7: Publish
- Push to Hugging Face as `earthloveunited/carbon-projects-unified`
- Include: unified JSONL, per-registry raw data, dedup mapping, validation scripts

## Estimated Scope

| Registry | Projects | API Type | Difficulty |
|----------|----------|----------|------------|
| Verra (VCS) | 2,646 | POST API | Easy |
| Gold Standard | 4,085 | GET API | Easy |
| CDM | ~8,000 | Browser scrape | Hard |
| ACR | ~500 | Browser scrape | Medium |
| CAR | ~400 | Browser scrape | Medium |
| Plan Vivo | ~300 | CSV/HTML | Easy |
| ART | ~100 | HTML scrape | Medium |
| **Total** | **~16,000** | | |
| **After dedup** | **~12,000** | | |

## Data Quality Considerations

1. **Verra**: Rich data, clean API, but no project detail endpoint (all data in search)
2. **Gold Standard**: Rich data, clean API, includes SDGs and co-benefits
3. **CDM**: Largest dataset but hardest to scrape (bot protection)
4. **Cross-registration rate**: Estimated 10-15% of projects registered in multiple registries
5. **Data freshness**: Registries update weekly; plan monthly refresh

## Legal/License Considerations

- Registry data is publicly available but may have usage restrictions
- Check each registry's terms of service before publishing
- Verra: Public registry data, likely OK for research/educational use
- Gold Standard: Public API, check ToS
- CDM: UNFCCC data, likely public domain
- Plan Vivo: Open data approach
- **Action**: Review ToS for each registry before publishing

## Next Steps

1. Build Verra scraper (easy, POST API)
2. Build Gold Standard scraper (easy, GET API)
3. Build CDM scraper (hard, browser-based)
4. Build ACR/CAR scrapers
5. Build Plan Vivo scraper
6. Design and implement normalization pipeline
7. Implement deduplication
8. Validate and audit
9. Publish to Hugging Face
