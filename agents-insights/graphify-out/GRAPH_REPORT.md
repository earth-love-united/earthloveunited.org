# Graph Report - earthloveunited.org  (2026-05-19)

## Corpus Check
- 131 files · ~286,161 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 787 nodes · 1153 edges · 39 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 106 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]

## God Nodes (most connected - your core abstractions)
1. `open()` - 55 edges
2. `BrowserManager` - 32 edges
3. `log()` - 21 edges
4. `BatchRunner` - 19 edges
5. `RateLimiter` - 19 edges
6. `log()` - 18 edges
7. `_executeToolCall()` - 18 edges
8. `fetch()` - 17 edges
9. `init()` - 15 edges
10. `main()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `_fetchIndex()` --calls--> `fetch()`  [INFERRED]
  js/gaia-retrieval.js → dis/worker.js
- `_fetchJson()` --calls--> `fetch()`  [INFERRED]
  js/gaia-structured.js → dis/worker.js
- `main()` --calls--> `open()`  [INFERRED]
  tools/scraper/iges_cdm_download.py → assets/js/index.js
- `ingest_carbonplan()` --calls--> `open()`  [INFERRED]
  tools/scraper/ingest_external.py → assets/js/index.js
- `ingest_credits()` --calls--> `open()`  [INFERRED]
  tools/scraper/ingest_external.py → assets/js/index.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (68): _activateStateMachine(), addMessage(), _addToHistory(), addToolCall(), askGaia(), autoResize(), _bridgeEvents(), _buildKnowledgeContext() (+60 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (67): build_index(), tokenize(), open(), main(), IGES CDM Database Acquisition — nodriver Cloudflare bypass. Opens the IGES page,, Gold Standard Registry Scraper GET API: https://public-api.goldstandard.org/proj, scrape_gold_standard(), get_verra_ids_without_descriptions() (+59 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (31): BatchRunner, ═══════════════════════════════════════════════════════════════════════════   BA, Mark a URL's status and persist., URLs that haven't been successfully scraped yet., Execute the full batch with concurrency control., Process a single URL with retry logic., Append a single result to the output JSONL file., Get current batch status. (+23 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (33): addMessage(), _addToHistory(), addToolCall(), askGaia(), autoResize(), _buildGroundedTurn(), _buildKnowledgeContext(), _callOpenRouter() (+25 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (34): animate(), animateNum(), calc(), calcResult(), _evictOldest(), flyToSite(), fmt(), getBiome() (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (36): _applyVoiceBeforeSpeak(), _autoSave(), _bindGlobalEvents(), _calcCarbon(), _connectToIsolate(), _executeToolCall(), _flushEvents(), _generateStateMachineChatResponse() (+28 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (33): _append_result(), find_gs_projects_needing_methodology(), load_all_gs_projects(), _load_already_done(), ═══════════════════════════════════════════════════════════════════════════   GO, Query the GS detail API for each null-methodology project.     May catch updates, Infer methodology from project type using the known type→methodology     distrib, Cross-reference against the Berkeley Voluntary Registry Offsets Database     (UC (+25 more)

### Community 7 - "Community 7"
Cohesion: 0.19
Nodes (24): _activateStateMachine(), _bridgeEvents(), _createIdAliases(), _createMissingElements(), _doInstallInterceptors(), _gaiaStateReady(), init(), _injectChatAvatar() (+16 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (18): classify_target_type(), clean_html(), extract_baseline_year(), extract_reduction_pct(), extract_target_mtco2e(), extract_target_year(), parse_conditionality(), parse_finance() (+10 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (16): get_iso3(), main(), normalize_gs_project(), normalize_gs_status(), normalize_gs_type(), normalize_verra_project(), normalize_verra_status(), normalize_verra_type() (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.17
Nodes (16): build_enriched_dataset(), load_cat_detailed(), load_climate_watch_ndc(), load_gcb_emissions(), load_lulucf(), load_ndc_registry(), load_ndgain(), load_world_bank() (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (8): CookieManager, ═══════════════════════════════════════════════════════════════════════════   CO, Manage persistent cookies for browser contexts., Load cookies from JSON file., Save cookies to JSON file., Inject saved cookies into a Playwright BrowserContext., Harvest cookies from a Playwright BrowserContext and save.         Call this aft, Normalize cookie format from various export sources.         Handles: DevTools c

### Community 12 - "Community 12"
Cohesion: 0.17
Nodes (9): _formatTime(), _handleQuestTrigger(), init(), _registerCallbacks(), renderDualResponse(), _renderGaiaMessage(), _renderOverlayContent(), renderUserMessage() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.28
Nodes (15): _callLLM(), _continueLLM(), fetch(), _getBifurcationContext(), _getGeoContext(), _getLiveClimateData(), _handleChat(), _handleWebSocket() (+7 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (11): compute_quality_score(), geocode_location(), main(), Optimized enrichment pipeline. 1. Geocode unique country/region combinations (no, Geocode a country + region to lat/lon using Nominatim., Compute a quality score (0-1) based on data completeness., main(), Final merge: incorporate Verra descriptions + GS enrichments into v2 dataset. Ru (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.23
Nodes (10): buildContext(), detect(), escapeRe(), _fetchJson(), globalProjectTotals(), load(), lookupCountry(), lookupPaleo() (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.28
Nodes (12): compute_dedup_score(), compute_quality(), get_centroid(), get_meth_name(), main(), map_carbonplan_category(), map_cdm_type(), map_gs_type() (+4 more)

### Community 17 - "Community 17"
Cohesion: 0.27
Nodes (9): _fetchIndex(), getContext(), isInDomain(), load(), ready(), search(), _sourceBoosts(), stem() (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.25
Nodes (10): collect_all_types(), get_conflicts(), main(), make_empty(), Arrow-safe sanitizer v2: handles nested raw_data subfields. The HF viewer error, Recursively collect types for every field path., Find fields with null + other types., Determine the empty value for a conflicting field. (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (10): compute_match_score(), jaccard_similarity(), main(), merge_projects(), normalize_text(), Deduplication engine for unified carbon projects. Uses fuzzy matching on name, d, Merge two duplicate projects into one., Normalize text for comparison. (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.27
Nodes (9): ingest_carbonplan(), ingest_credits(), _parse_int(), ═══════════════════════════════════════════════════════════════════════════   EX, Convert CarbonPlan credits.csv into a unified credits JSONL.     This gives us v, Parse integer from string, handling floats and empties., Convert CarbonPlan OffsetsDB projects.csv into per-registry JSONL files., ingest_external() (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.25
Nodes (8): load_ndc(), normalize_country(), parse_reduction_pct(), parse_target_year(), process(), Extract target year from NDC title like 'India NDC (2031 - 2035), Try to extract reduction percentage from title, Normalize country names to standard forms

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): isInDomain(), search(), sourceBoosts(), stem(), tokenize()

### Community 23 - "Community 23"
Cohesion: 0.39
Nodes (6): build_manifest(), build_paleo(), build_pledges(), _build_timestamp(), _to_float(), _to_int()

### Community 25 - "Community 25"
Cohesion: 0.4
Nodes (3): new_context(), new_page(), ═══════════════════════════════════════════════════════════════════════════   BR

### Community 26 - "Community 26"
Cohesion: 0.4
Nodes (5): Extract EPA Climate Explainers Authoritative, plain-language climate science fro, Scrape an EPA climate page., Scrape all EPA climate pages., scrape_all_epa(), scrape_epa_page()

### Community 27 - "Community 27"
Cohesion: 0.5
Nodes (2): bundleJs(), exposeGlobals()

### Community 29 - "Community 29"
Cohesion: 0.7
Nodes (4): check(), coverage(), spot(), warn()

### Community 30 - "Community 30"
Cohesion: 0.6
Nodes (4): build(), Porter-lite: strip a few common English suffixes. Conservative on purpose —, stem(), tokenize()

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (2): fetch_all_pages(), Alternative: fetch all pages and deduplicate

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (3): extract_ndc_from_page(), Extract NDC target data from a Wikipedia page, scrape_all()

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (3): extract_from_page(), Extract structured data from a CAT country page using requests + bs4, scrape_all()

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (2): build_matrix(), load_and_clean()

### Community 35 - "Community 35"
Cohesion: 0.67
Nodes (2): Scrape a Project Drawdown solution page., scrape_solution()

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (1): Final merge v4: deduped Verra descriptions + GS enrichments → v3 dataset.

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (1): Expanded Wikipedia Climate Article List v2.0 500+ articles covering all major cl

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (1): Create a browser context with neutral locale defaults.         Works with both L

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (1): Convenience: get a single page directly.         Usage:             async with b

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (1): HTTP endpoint for the CDP server.

## Knowledge Gaps
- **124 isolated node(s):** `IGES CDM Database Acquisition — nodriver Cloudflare bypass. Opens the IGES page,`, `═══════════════════════════════════════════════════════════════════════════   EX`, `Convert CarbonPlan OffsetsDB projects.csv into per-registry JSONL files.`, `Convert CarbonPlan credits.csv into a unified credits JSONL.     This gives us v`, `Parse integer from string, handling floats and empties.` (+119 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 27`** (5 nodes): `build.js`, `bundleCss()`, `bundleJs()`, `exposeGlobals()`, `processHtml()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (4 nodes): `scrape_cw_by_country.py`, `fetch_all_pages()`, `fetch_by_country()`, `Alternative: fetch all pages and deduplicate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (3 nodes): `build_matrix.py`, `build_matrix()`, `load_and_clean()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (3 nodes): `drawdown_v2.py`, `Scrape a Project Drawdown solution page.`, `scrape_solution()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `merge_v4.py`, `Final merge v4: deduped Verra descriptions + GS enrichments → v3 dataset.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `expanded_wiki_list.py`, `Expanded Wikipedia Climate Article List v2.0 500+ articles covering all major cl`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `Create a browser context with neutral locale defaults.         Works with both L`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `Convenience: get a single page directly.         Usage:             async with b`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `HTTP endpoint for the CDP server.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `open()` connect `Community 1` to `Community 2`, `Community 4`, `Community 6`, `Community 8`, `Community 9`, `Community 10`, `Community 14`, `Community 16`, `Community 18`, `Community 19`, `Community 20`?**
  _High betweenness centrality (0.343) - this node is a cross-community bridge._
- **Why does `fetch()` connect `Community 13` to `Community 0`, `Community 3`, `Community 4`, `Community 15`, `Community 17`?**
  _High betweenness centrality (0.232) - this node is a cross-community bridge._
- **Why does `init()` connect `Community 4` to `Community 13`?**
  _High betweenness centrality (0.199) - this node is a cross-community bridge._
- **Are the 49 inferred relationships involving `open()` (e.g. with `._load_checkpoint()` and `._save_checkpoint()`) actually correct?**
  _`open()` has 49 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `BrowserManager` (e.g. with `BatchRunner` and `═══════════════════════════════════════════════════════════════════════════   BA`) actually correct?**
  _`BrowserManager` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `BatchRunner` (e.g. with `BrowserManager` and `RateLimiter`) actually correct?**
  _`BatchRunner` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `RateLimiter` (e.g. with `BatchRunner` and `═══════════════════════════════════════════════════════════════════════════   BA`) actually correct?**
  _`RateLimiter` has 13 INFERRED edges - model-reasoned connections that need verification._