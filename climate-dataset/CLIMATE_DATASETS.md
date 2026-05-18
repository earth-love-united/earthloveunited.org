# CLIMATE KNOWLEDGE DATASETS — COMPREHENSIVE SURVEY
## What's Available, What's Missing, and Should We Curate One?
## Research Report | May 2026

---

# EXECUTIVE SUMMARY

**The short answer: Yes, you should curate one.**

Here's what we found:

Hugging Face has ~587 datasets tagged "climate" and ~133 tagged "carbon",
but the vast majority are:
  - Too small (< 1K samples)
  - Too narrow (specific research tasks, not general knowledge)
  - Too technical (raw satellite data, not human-readable)
  - Not designed for RAG or conversational AI

The best existing datasets are:
  1. ClimateFever (1.5K claims + evidence) — good for fact-checking
  2. ClimateBert Environmental Claims (2.1K) — good for classification
  3. FineWeb-Edu Climate (614K web pages) — closest to what we need
  4. CarbonGlobe (10K-100K geospatial) — good for globe visualization
  5. Wikipedia Climate Data (1.8K articles) — decent baseline

**None of these alone is sufficient for a comprehensive climate AI.**
The best approach is to curate a custom dataset by combining:
  - arXiv climate papers (abstracts + full text)
  - IPCC reports (the gold standard)
  - Wikipedia climate articles
  - Government climate data portals
  - FineWeb-Edu climate subset
  - Our own RESEARCH.md content

---

# PART 1: HUGGING FACE DATASETS

## 1.1 Climate-Tagged Datasets (587 total)

TOP DATASETS BY DOWNLOADS:

| Dataset | Downloads | Size | Type | Quality |
|---------|-----------|------|------|---------|
| thainamhoang/era5-climate-learn | 10,485 | Large | Time-series weather | ★★★★ |
| mteb/ClimateFEVER_test | 4,791 | 250 | Fact-checking benchmark | ★★★ |
| thainamhoang/cerra-climate-learn | 2,542 | Large | Time-series weather | ★★★★ |
| mteb/climate-fever | 1,779 | 1.5K | Fact-checking | ★★★ |
| jasonjewik/climate-learn | 1,431 | Medium | Weather data | ★★★ |
| tdiggelm/climate_fever | 1,293 | 1.5K | Claims + evidence | ★★★★ |
| datania/climate-trace | 1,214 | Medium | Emissions data | ★★★★ |
| tjhunter/climate-trace | 1,076 | Medium | Emissions data | ★★★★ |
| sraj/finewebedu-climate | 892 | 614K | Web text (climate-filtered) | ★★★★★ |
| climatebert/environmental_claims | 695 | 2.1K | Text classification | ★★★ |
| rlacombe/ClimateNet | 605 | Medium | Climate text | ★★★ |
| Vinom/ClimateChangeQA | 1,280 | 1.3K | Q&A pairs | ★★★★ |
| Vinom/ClimateChangeQA_hard | 1,240 | 1.2K | Q&A pairs (hard) | ★★★★ |
| zhwang1/CarbonGlobe | 135 | 10K-100K | Geospatial carbon | ★★★★★ |
| pierre-pessarossi/wikipedia-climate-data | 1,860 | 1.8K | Wikipedia articles | ★★★★ |

## 1.2 Carbon-Tagged Datasets (133 total)

Most carbon datasets on HF are NOT about carbon emissions/credits:
  - Carbon-24 (chess games)
  - CarbonChroma (methodology documents)
  - CarbonBeagle (LLM model weights)
  - CarbonAlpha (LLM training data)

The relevant ones:
  - zhwang1/CarbonGlobe — Geospatial carbon cycle data (10K-100K rows, CC-BY-4.0)
  - joduor/carbon-credit-categories — Carbon credit classification
  - 77ethers/CarbonAlpha-train — LLM training data (not directly useful)

## 1.3 Detailed Analysis of Key Datasets

### ClimateFever (tdiggelm/climate_fever)
  Size: 1,540 test rows
  Format: Parquet
  Structure: claim_id, claim, claim_label, evidences
  Labels: SUPPORTS, REFUTES, NOT_ENOUGH_INFO, DISPUTED
  Source: Wikipedia climate articles + expert annotations
  License: Unknown
  Best for: Fact-checking, claim verification
  Limitations: Small, only 4 labels, no full text

### FineWeb-Edu Climate (sraj/finewebedu-climate)
  Size: 614,435 rows
  Format: Parquet
  Structure: text, id, url, file_path, language, score, tags, matched_keywords
  Source: Common Crawl, filtered for climate content + educational quality
  Best for: RAG knowledge base, general climate text
  Limitations: Variable quality, web-crawl noise, no structured facts
  **THIS IS THE SINGLE BEST EXISTING DATASET FOR OUR PURPOSE**

### CarbonGlobe (zhwang1/CarbonGlobe)
  Size: 10K-100K rows
  Format: Geospatial
  Tags: carbon-cycle, forest-ecosystems, ecosystem-modeling, earth-system-science, climate-change, remote-sensing
  License: CC-BY-4.0
  Best for: Globe visualization, carbon cycle data
  Limitations: Technical/scientific, not human-readable

### ClimateBert Environmental Claims
  Size: 2,120 train / 265 validation / 265 test
  Format: Parquet
  Structure: text, label (yes/no for environmental claim)
  Source: Corporate reports, news articles
  License: CC-BY-NC-SA-4.0
  Best for: Classifying environmental claims
  Limitations: Small, binary classification only

### ClimateChangeQA (Vinom/ClimateChangeQA)
  Size: 1,280 rows
  Format: JSON/Parquet
  Structure: question, answer, context
  Best for: Q&A for climate AI
  Limitations: Small, may not cover all topics

### Wikipedia Climate Data (pierre-pessarossi/wikipedia-climate-data)
  Size: 1,860 rows
  Format: JSON
  Structure: Wikipedia articles about climate topics
  Best for: Structured knowledge base
  Limitations: May be outdated, no full article text

---

# PART 2: ARXIV FOR CLIMATE PAPERS

## 2.1 arXiv API Access

arXiv provides a free API: https://export.arxiv.org/api/query

SEARCH QUERY EXAMPLES:
  # Climate papers in atmospheric physics
  https://export.arxiv.org/api/query?search_query=cat:physics.ao-ph+AND+(abs:carbon+OR+abs:climate)&max_results=100

  # Carbon cycle papers
  https://export.arxiv.org/api/query?search_query=abs:carbon+cycle+AND+cat:physics.ao-ph&max_results=100

  # Climate change papers (any category)
  https://export.arxiv.org/api/query?search_query=abs:climate+change&max_results=100&sortBy=relevance

RATE LIMITS:
  - Max 1 request per 3 seconds
  - Max 100 results per request (use pagination)
  - No authentication required

## 2.2 Relevant arXiv Categories

CATEGORY | DESCRIPTION | ESTIMATED PAPERS
---------|-------------|------------------
physics.ao-ph | Atmospheric and Oceanic Physics | ~15,000+
physics.geo-ph | Geophysics | ~10,000+
cs.CL | Computation and Language (NLP) | ~500 climate-related
cs.AI | Artificial Intelligence | ~200 climate-related
cs.LG | Machine Learning | ~300 climate-related
eess.IV | Image and Video Processing | ~100 climate-related

## 2.3 What We Can Extract from arXiv

For each paper:
  - Title
  - Authors
  - Abstract (excellent for RAG)
  - Categories/keywords
  - Submission date
  - PDF link (for full-text extraction)
  - DOI (if published)

BULK DOWNLOAD:
  - arXiv provides bulk metadata via S3: s3://arxiv/
  - Full PDFs available via torrent
  - Metadata dump: ~2.5M papers, ~500GB

---

# PART 3: IPCC DATA

## 3.1 IPCC Data Distribution Centre (DDC)

URL: https://www.ipcc-data.org/

The IPCC DDC provides:
  - Climate observations (historical)
  - Climate projections (CMIP5, CMIP6)
  - Socioeconomic scenarios (SSPs)
  - Sea level rise projections
  - Extreme weather indices

DATA FORMATS: NetCDF, CSV, GeoTIFF
LICENSE: Free for research and education
QUALITY: The gold standard for climate science

## 3.2 IPCC Reports as Knowledge Sources

REPORT | YEAR | PAGES | KNOWLEDGE VALUE
-------|------|-------|----------------
AR6 WGI (Physical Science) | 2021 | 3,949 | ★★★★★
AR6 WGII (Impacts) | 2022 | 3,675 | ★★★★★
AR6 WGIII (Mitigation) | 2022 | 2,913 | ★★★★★
AR6 Synthesis Report | 2023 | 85 | ★★★★★
SR15 (1.5°C) | 2018 | 62 | ★★★★
SRCCL (Land) | 2019 | 87 | ★★★★
SROCC (Ocean) | 2019 | 87 | ★★★★

These reports are THE authoritative source for climate science.
They should be the backbone of any climate AI knowledge base.

ACCESS: PDFs are free at ipcc.ch
MACHINE-READABLE: Some data tables available, but mostly PDF

---

# PART 4: OTHER KNOWLEDGE SOURCES

## 4.1 Wikipedia Climate Articles

~15,000+ articles in the climate change category tree.
High quality, well-sourced, constantly updated.

KEY ARTICLES (for seed knowledge base):
  - Climate change
  - Global warming
  - Carbon cycle
  - Greenhouse effect
  - Carbon dioxide
  - Methane
  - Climate sensitivity
  - Carbon budget
  - Ocean acidification
  - Sea level rise
  - Deforestation
  - Renewable energy
  - Carbon capture and storage
  - Climate change mitigation
  - Climate change adaptation
  - Paris Agreement
  - IPCC
  - Keeling Curve
  - Carbon footprint
  - Carbon offset

ACCESS: Wikimedia dumps (monthly), Wikipedia API
FORMAT: XML/JSON
LICENSE: CC-BY-SA

## 4.2 Government Climate Data Portals

PORTAL | URL | DATA
-------|-----|-----
NOAA Climate | climate.gov | Observations, projections, teaching resources
NASA Earth Data | earthdata.nasa.gov | Satellite data, climate indicators
Copernicus CDS | cds.climate.copernicus.eu | ERA5 reanalysis, projections
US Global Change Research Program | globalchange.gov | National climate assessments
UK Met Office | metoffice.gov.uk | Hadley Centre data
Berkeley Earth | berkeleyearth.org | Temperature records
Global Carbon Atlas | globalcarbonatlas.org | Emissions data
Climate TRACE | climatetrace.org | Emissions tracking
EDGAR | edgar.jrc.ec.europa.eu | Global emissions database

## 4.3 Climate-Specific Knowledge Bases

PROJECT | URL | DESCRIPTION
--------|-----|-------------
Project Drawdown | drawdown.org | 80+ climate solutions ranked by impact
Climate Interactive | climateinteractive.org | En-ROADS simulator, teaching tools
RealClimate | realclimate.org | Climate science blog by scientists
Carbon Brief | carbonbrief.org | Climate science journalism
Skeptical Science | skepticalscience.com | Climate myth rebuttals
Global Forest Watch | globalforestwatch.org | Forest monitoring
Our World in Data | ourworldindata.org | Emissions, energy, climate data

## 4.4 Academic Climate Datasets

DATASET | SOURCE | SIZE | DESCRIPTION
--------|--------|------|-------------
CMIP6 | ESGF | 100TB+ | Climate model projections
ERA5 | Copernicus | 50TB+ | Historical weather reanalysis
Global Carbon Budget | GCP | Annual | Carbon accounting
HadCRUT5 | Met Office | Monthly | Temperature record
GISTEMP | NASA | Monthly | Temperature record
NOAA Global Temp | NOAA | Monthly | Temperature record
OISST | NOAA | Daily | Sea surface temperature
GRACE | NASA | Monthly | Ice sheet mass
Argo | Argo | Continuous | Ocean temperature/salinity

---

# PART 5: SHOULD WE CURATE A CLIMATE KNOWLEDGE DATASET?

## 5.1 The Case For Yes

  1. No comprehensive climate knowledge dataset exists for RAG/AI
  2. Existing datasets are either too small, too narrow, or too technical
  3. The IPCC reports are the gold standard but not in machine-readable format
  4. A curated dataset would be a significant contribution to the field
  5. It would power our Climate AI with authoritative, sourced information
  6. It could be open-sourced to help other climate AI projects

## 5.2 What to Include

TIER 1 — Core Knowledge (must have):
  - IPCC AR6 reports (all 4 main reports) — extracted text
  - Wikipedia climate articles (~500 key articles)
  - Our RESEARCH.md content
  - NOAA/NASA climate explainers
  - Project Drawdown solutions

TIER 2 — Extended Knowledge (should have):
  - arXiv climate paper abstracts (~50K papers)
  - FineWeb-Edu climate subset (614K pages, filtered)
  - Carbon Brief articles
  - Climate.gov teaching resources
  - Government climate assessment reports

TIER 3 — Specialized Knowledge (nice to have):
  - Full arXiv climate papers (PDF extraction)
  - Historical climate data tables
  - Carbon registry project descriptions
  - Restoration project case studies
  - Climate litigation documents

## 5.3 Dataset Format

For RAG/AI use, the ideal format:

  {
    "id": "ipcc-ar6-wg1-ch2-001",
    "source": "IPCC AR6 WGI Chapter 2",
    "title": "Changing State of the Climate System",
    "text": "The global surface temperature has increased by approximately 1.1°C...",
    "url": "https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-2/",
    "date": "2021-08-09",
    "type": "report",
    "topics": ["temperature", "observations", "attribution"],
    "confidence": "very_high",
    "citations": ["IPCC, 2021: AR6 WGI Chapter 2"]
  }

## 5.4 Curation Pipeline

STEP 1: COLLECT
  - Download IPCC PDFs → extract text with layout preservation
  - Scrape Wikipedia climate category → extract articles
  - Query arXiv API → download abstracts for climate papers
  - Download FineWeb-Edu climate subset
  - Scrape Carbon Brief, Climate.gov, Project Drawdown

STEP 2: CLEAN
  - Remove boilerplate, headers, footers
  - Split into semantic chunks (paragraphs, sections)
  - Deduplicate across sources
  - Normalize formatting
  - Extract citations and references

STEP 3: ANNOTATE
  - Tag with topics (carbon cycle, temperature, impacts, solutions, etc.)
  - Assign source authority (IPCC = highest, blog = lower)
  - Extract key claims and numbers
  - Link related documents

STEP 4: INDEX
  - Generate embeddings (e.g., text-embedding-3-large)
  - Store in vector database (ChromaDB, Pinecone, Weaviate)
  - Build search index (Elasticsearch or similar)
  - Create knowledge graph (entities, relationships)

STEP 5: VALIDATE
  - Expert review of key facts
  - Cross-reference between sources
  - Flag uncertain or disputed claims
  - Version control for updates

## 5.5 Estimated Size

SOURCE | DOCUMENTS | TEXT VOLUME
-------|-----------|-------------
IPCC AR6 (4 reports) | ~200 sections | ~500K words
Wikipedia climate | ~500 articles | ~2M words
arXiv abstracts | ~50K papers | ~10M words
FineWeb-Edu climate | ~614K pages | ~200M words
Our research | ~50 documents | ~100K words
Carbon Brief | ~5K articles | ~10M words
Project Drawdown | ~100 solutions | ~200K words

TOTAL: ~250M+ words, ~700K+ documents

For a focused RAG system, we'd use a curated subset:
  - ~10K high-quality documents
  - ~50M words
  - Covers 95% of likely user questions

## 5.6 Licensing

SOURCE | LICENSE | COMMERCIAL USE?
-------|---------|---------------
IPCC reports | Free for any use | Yes
Wikipedia | CC-BY-SA | Yes (with attribution)
arXiv abstracts | Public domain | Yes
FineWeb-Edu | ODC-BY | Yes
Our research | Our license | Yes
Carbon Brief | Copyright | Need permission
Project Drawdown | Copyright | Need permission

---

# PART 6: RECOMMENDATION

## Build the Earth Love United Climate Knowledge Dataset

WHY:
  1. Nothing like it exists
  2. It would be a major contribution to climate AI
  3. It powers our Climate AI with authoritative information
  4. It can be open-sourced to help the broader community
  5. It creates a moat — our AI knows more about climate than any other

HOW:
  1. Start with Tier 1 sources (IPCC + Wikipedia + our research)
  2. Add Tier 2 sources incrementally
  3. Use the curation pipeline above
  4. Release as an open dataset on Hugging Face
  5. Version it annually (aligned with IPCC assessment cycles)

FIRST MILESTONE:
  - 10K documents
  - IPAR AR6 + Wikipedia + our research
  - Embeddings generated
  - Vector database populated
  - Climate AI can answer 90% of common climate questions

OPEN SOURCE STRATEGY:
  - Release core dataset (IPCC + Wikipedia derived) as CC-BY-SA
  - Keep proprietary additions (our research, proprietary data) private
  - Build community around the dataset
  - Accept contributions from researchers

---

Research prepared for Earth Love United Foundation
May 2026
