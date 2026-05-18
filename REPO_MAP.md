# EARTH LOVE UNITED — REPO MAP
# Generated: 2026-05-18 after restructuring
# 
# Root contains ONLY: entry points (HTML), top-level dirs, .gitignore
# All docs moved to docs/, all legacy code archived or removed

## TOP-LEVEL FILES
  index.html              — Main site entry point (globe + GAIA overlay)
  gaia.html               — Standalone GAIA chat interface
  dashboard.html          — Agent tracking dashboard (Consigliere)
  .gitignore              — Updated with new patterns

## DIRECTORY STRUCTURE

### docs/                      ← Planning, tracking, dev docs (9 files)
  DATA_SOURCES.md
  DEV_INTEGRATION_PLAN.md
  DEV_STATUS.md
  DEV_TASK_DOM_ADAPTER.md
  DEV_TASK_PHASE2_3.md
  PHASE4_PLAN.md
  PRODUCTION_GUIDE.md
  PROJECT_TRACKER.md
  RESEARCH.md

### js/                        ← Browser JS modules (20 files)
  app.js                   — Main app bootstrap
  data.js                  — Core data layer
  globe.js                 — Globe.gl 3D globe
  globe-overlay.js         — Globe overlay (Phase 4-5)
  site-panel.js            — Site panel with GAIA section
  gaia-nodes.js            — GAIA nodes on globe
  gaia-chat.js             — GAIA chat interface
  gaia-voice.js            — GAIA voice system
  gaia-engagement.js       — Engagement scoring
  gaia-journal.js          — GAIA journal
  gaia-bubble.js           — GAIA bubble UI
  gaia-presence.js         — GAIA presence indicator
  gaia-overlay-knowledge.js — GAIA overlay knowledge
  ndvi-verifier.js         — NDVI verification
  pledge-wall.js           — Pledge wall
  registry-check.js        — Registry checker
  quiz.js                  — Climate quiz
  biomes.js                — Biomes data
  carbon-clock.js          — Carbon clock widget
  counters.js              — Animated counters
  country-data.js          — Country data
  cycle.js                 — Carbon cycle
  delegation.js            — Delegation UI
  scenario.js              — Scenario builder
  
  gaia-legacy/             ← OLD GAIA system (6 files, archived from root)
    gaia-data.js           — Old data engine (localStorage cache)
    gaia-signals.js        — Old signals
    gaia-charts.js         — Old charts
    gaia-knowledge.js      — Old knowledge base
    gaia-dom-adapter.js    — Old DOM adapter (defines GaiaDOMAdapter)
    gaia-integration.js    — Old integration (defines GaiaIntegration)

### css/                       ← Stylesheets (12 files)
  base.css, layout.css, components.css, widgets.css, responsive.css
  carbon-clock.css, delegation.css, pledge-wall.css
  gaia-bubble.css, gaia-presence.css, globe-overlay.css
  ndvi-verifier.css, registry-check.css

### data/                      ← Shared data files
  biomes.json
  sites.json
  climate-knowledge-curated.jsonl   (~2800 chunks, ~2.3MB)

### dis/                       ← GAIA DIS (Digital Intelligence System)
  ### Runtime JS (active)
  gaia-client.js           — Cloudflare Worker client (not loaded, needs backend)
  gaia-voice-data.js       — Voice data
  gaia-state-machine.js    — State machine
  gaia-voice-engine.js     — Voice engine
  gaia-quest-system.js     — Quest system
  gaia-key-gate.js         — Key gate
  gaia-mind.js             — GAIA mind (core)
  gaia-knowledge.js        — Knowledge module
  worker.js                — Cloudflare Worker
  test-gaia.js             — Test suite
  
  ### Build scripts
  build_bifurcation_points.py
  build_climate_facts.py
  build_geological_memory.py
  build_knowledge_index.py
  fix-final.py
  
  ### Data files
  climate-bifurcation-points.json
  climate-facts.json
  geological-memory.json
  knowledge-index.json     — (gitignored, ~7MB)
  knowledge-index.json.gz  — (gitignored, ~1.2MB)
  
  ### Docs
  ARCHITECTURE.md, README.md, CLIMATE_FACTS.md
  gaia-engagement-algorithm.md, gaia-system-prompt.md
  gaia-tool-definitions.md, gaia-voice-library.md
  behavioral-test-v2.md, turing-test-v2.md
  
  ### Config
  wrangler.toml            — Cloudflare Workers config
  
  ### Build artifacts
  dist/                    — (gitignored)

### carbon-projects/           ← Carbon registry data pipeline
  CARBON_REGISTRIES.md     ← (moved from root)
  PLAN.md, README.md, dataset_card.md
  
  scrapers/                — Registry scrapers (3 files)
    verra_scraper.py, verra_descriptions.py, gold_standard_scraper.py
  
  scripts/                 — Data processing (9 files)
    deduplicate.py, deep_sanitize.py, enrich.py, final_merge.py
    geocode.py, market_analysis.py, merge_v4.py
    methodology_names.py, normalize.py, sanitize.py, unify_v2.py
  
  raw/                     — Raw scraped data
    verra_projects.jsonl, verra_descriptions.json, gold_standard_projects.jsonl
  
  data/                    — Processed data
    verra_details_deduped.jsonl
  
  unified/                 — Final unified outputs
    carbon_projects_final.jsonl   ← LATEST (keep)
    train.parquet                 ← ML training data (keep)
    dedup_mapping.json
    market_analysis.json
    normalization_stats.json
    audit_dataset.py
  
  pledge-reality/          ← Pledge vs Reality dataset
    TIMELINE.md, ndc_page.html
    src/                   — Pipeline scripts
      build_dataset.py, process_gcb.py, process_ndc.py
      process_cat.py, scrape_cat_countries.py
    data/raw/              — Raw inputs (GCB, NDC, CAT)
    data/processed/        — Processed CSVs
    data/output/           — Final outputs (pledge_vs_reality.parquet)

### climate-dataset/           ← Climate knowledge dataset (HF publishing)
  CLIMATE_DATASETS.md      ← (moved from root)
  AG_audit_report.md, AUDIT.md, GAP_ANALYSIS.md
  INTEGRATION.md, README.md, README_v3.md, STATUS.md
  
  src/                     — Current build scripts (7 files)
    build_v3.py            ← LATEST main builder
    wikipedia_v3.py        ← LATEST Wikipedia extractor
    drawdown_v2.py         ← LATEST Drawdown scraper
    climate_economics.py, climate_economics_extract.py
    epa_scraper.py, extract_ipcc_pdfs.py, ipcc_extractor.py
  
  config/                  — Configuration
    expanded_wiki_articles.json, expanded_wiki_list.py
  
  data/raw/                — Raw scraped data (PDFs, JSONs)
  data/processed/          — Processed outputs (JSONL, Parquet)
  notebooks/               — Jupyter notebooks

### holocene-bifurcation/      ← Holocene climate bifurcation research
  scripts/                 — Data fetchers & builder (5 files)
    build_matrix.py, fetch_geomagnetic.py, fetch_ice_cores.py
    fetch_sea_level.py, fetch_solar.py
  data/raw/                — Raw data (ice cores, geomagnetic, etc.)
  data/processed/          — Processed outputs (CSV, Parquet)

### design/                    ← Design explorations
  LEARNING_EXPERIENCE_DESIGN.md
  burn-scar-demo.html, concept-1-weight.html, concept-2-legacy.html
  concept-3-diagnosis.html, concept-4-fusion.html

### tools/scraper/             ← General scraping tools
  run.py, batch_runner.py, browser.py, cookie_manager.py
  verra_details.py, gs_methodology_enricher.py, ingest_external.py
  iges_cdm_download.py, rate_limiter.py
  config.yaml, carbondataset_hermes_briefing.md
  bin/lightpanda            — Lightpanda headless browser binary
  data/                    — Scraped data cache (checkpoints, external, scraped)

## ARCHIVE LOCATION
  /tmp/earthloveunited-archive/
    gaia-legacy-js/              — Original root gaia-*.js (6 files)
    carbon-projects-unified-intermediates/ — Pruned versioned JSONL (12 files)
    climate-dataset-src-legacy/  — Pruned versioned scripts (10 files)

## WHAT CHANGED (2026-05-18)
  - Deleted from root: 6 gaia-*.js files → moved to js/gaia-legacy/
  - Moved to docs/: 9 MD files (DEV_*, PHASE4_*, PRODUCTION_*, PROJECT_*, RESEARCH.md, DATA_SOURCES.md)
  - Moved to carbon-projects/: CARBON_REGISTRIES.md
  - Moved to climate-dataset/: CLIMATE_DATASETS.md
  - Deleted: carbon-projects/pledge-reality/earthloveunited.org/ (recursive copy)
  - Pruned from carbon-projects/unified/: 12 versioned JSONL intermediates (~600MB)
  - Pruned from climate-dataset/src/: 10 old versioned scripts
  - Removed: __pycache__/ in tools/scraper/ and carbon-projects/scripts/
  - Updated: .gitignore (intermediate JSONL patterns)
  - Updated: index.html, gaia.html (script paths → js/gaia-legacy/)
