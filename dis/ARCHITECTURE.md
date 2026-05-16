# GAIA'S KNOWLEDGE ARCHITECTURE v1.0
## The Complete Research Foundation

---

# LAYER 1: TEXT KNOWLEDGE (10,128 chunks)
**Source**: Hugging Face dataset `ego0op/earth-love-united-climate-knowledge`
**Format**: JSONL, 25 MB
**Content**: Wikipedia (283 articles), arXiv (4,092 papers), IPCC AR6 (5 reports), Project Drawdown (33 solutions), US EPA (8 pages), Earth Love United research (83 sections)
**Search**: Inverted index, 23,757 terms, <5ms lookup
**File**: `dis/knowledge-index.json.gz` (1.1 MB compressed)

---

# LAYER 2: CLIMATE FACTS (124 structured facts)
**Source**: `dis/climate-facts.json` (25 KB)
**Format**: JSON, key-value pairs with metadata
**Content**:
- Atmospheric concentrations (CO2, CH4, N2O — current + pre-industrial)
- Global temperature (anomaly, warming rate, Arctic amplification)
- Carbon budget (remaining, annual emissions, sinks, airborne fraction)
- Sea level (current rate, projections, ice sheet loss)
- Carbon pools (atmosphere, ocean, vegetation, soil, permafrost, fossil fuels)
- Ecosystem carbon data (mangroves, seagrasses, peatlands, biochar, hemp, kelp, coral, permafrost)
- Solutions metrics (solar/wind costs, DAC, reforestation potential, soil carbon)
- Emissions by sector and top emitters (with per-capita)
- Climate sensitivity and tipping points
- Ocean (pH, heat content, acidification)
- Ice (Arctic sea ice, glaciers, ice sheets)
- Carbon pricing and climate finance
- Food system and energy transition

**Every fact has**: value, unit, source, year, confidence level
**Tool**: `get_climate_fact(topic)` — returns precise numbers with sources
**No opinions. No agenda. Just sourced data.**

---

# LAYER 3: GEOLOGICAL MEMORY (4.54 billion years)
**Source**: `dis/geological-memory.json` (16 KB)
**Format**: JSON timeline with 4 eras, 44 events, 6 GAIA quotes
**Content**:
- **Hadean** (4.54-4.0 Ga): Formation, Moon birth, magma ocean, first oceans
- **Archean** (4.0-2.5 Ga): First life, stromatolites, photosynthesis, methane greenhouse
- **Proterozoic** (2.5-0.541 Ga): Great Oxidation, Snowball Earths, eukaryotes, Ediacaran
- **Phanerozoic** (0.541 Ga-present): 5 mass extinctions, CO2/temperature history, current crisis

**Comparative data**:
- CO2 through time (10 data points: 100,000+ ppm → 431 ppm)
- Temperature through time (8 data points: +14°C → -6°C vs present)
- 5 mass extinctions with recovery times
- 6 GAIA voice quotes for personality

**Tool**: `get_geological_history(topic)` — returns events, conditions, GAIA voice
**Purpose**: Gives GAIA depth, authority, and emotional resonance

---

# LAYER 4: LIVE DATA (real-time)
**Source**: NOAA GML Mauna Loa (CO2), cached 1 hour
**Tool**: `get_live_climate_data()` — fetches current CO2 ppm
**Fallback**: Returns last known value if fetch fails

---

# WORKER ARCHITECTURE

**File**: `dis/worker.js` (37 KB)
**Tools**: 20 total
1. read_participant_state
2. read_engagement_counters
3. fly_globe_to
4. show_overlay
5. hide_overlay
6. reveal_data_layer
7. prompt_user
8. calculate_carbon
9. update_journal
10. set_quest
11. speak
12. react
13. wait_for_event
14. get_site_data
15. get_biome_data
16. list_quests
17. share_prompt
18. get_global_stats
19. search_knowledge (10,128 text chunks)
20. get_climate_fact (124 structured facts)
21. get_geological_history (4.54 billion year timeline)
22. get_live_climate_data (real-time CO2)

**Startup sequence**:
1. Load knowledge index from compressed JSON (<50ms)
2. Load climate facts from JSON (<5ms)
3. Load geological memory from JSON (<5ms)
4. All subsequent searches are in-memory, zero network calls

**LLM**: OpenRouter API (default: google/gemini-2.0-flash-001)
**System prompt**: Instructs GAIA to always call knowledge tools first for factual questions

---

# DATA FLOW

```
User: "How much CO2 is in the atmosphere?"
  → LLM calls get_live_climate_data()
  → Worker fetches NOAA data (cached 1hr)
  → Returns: "431.12 ppm as of April 2026"
  → GAIA speaks with sourced number

User: "What's the carbon budget for 1.5°C?"
  → LLM calls get_climate_fact("carbon_budget")
  → Worker searches 124 facts, returns match
  → Returns: "250 Gt CO2 from start of 2025, 50% probability"
  → GAIA speaks with sourced number

User: "Has Earth had high CO2 before?"
  → LLM calls get_geological_history("co2_history")
  → Worker searches geological timeline
  → Returns: CO2 was 10,000-100,000+ ppm in Hadean, 4,000-7,000 ppm in Cambrian
  → GAIA speaks with deep time context

User: "Tell me about mangroves"
  → LLM calls search_knowledge("mangroves")
  → Worker searches 10,128 chunks via inverted index
  → Returns: Top 5 relevant chunks from Wikipedia, research papers
  → GAIA synthesizes explanation from sources
```

---

# DEPLOYMENT

**Command**: `wrangler deploy` (from `dis/` folder)
**Build pipeline**:
1. `python3 build_knowledge_index.py` → generates knowledge-index.json.gz
2. `python3 build_climate_facts.py` → generates climate-facts.json
3. `python3 build_geological_memory.py` → generates geological-memory.json
4. `npm run build` → bundles worker
5. `wrangler deploy` → pushes to Cloudflare edge

**Static assets** (bundled with worker):
- knowledge-index.json.gz (1.1 MB)
- climate-facts.json (25 KB)
- geological-memory.json (16 KB)

**Total bundle size**: ~1.2 MB (knowledge) + ~37 KB (worker) + ~41 KB (data) = ~1.3 MB

---

# RESEARCH GAPS (for future versions)

**v1.1 — More ecosystem data**:
- Kelp/seaweed carbon sequestration
- Mycorrhizal networks and soil carbon
- Boreal forest carbon dynamics
- Savanna and grassland carbon
- Deep ocean carbon storage

**v1.2 — Country-level data**:
- Per-capita emissions for top 50 countries
- Renewable energy share by country
- Climate vulnerability indices
- NDC commitments and progress

**v1.3 — Temporal data**:
- Historical CO2 levels (ice core data, 800,000 years)
- Temperature record by decade
- Sea level reconstruction
- Emissions trajectory since 1850

**v2.0 — Proper embeddings**:
- Replace TF-IDF with vector embeddings
- Use Cloudflare's native embedding model
- Hybrid search: keyword + semantic

**v3.0 — Synthetic Q&A**:
- Generate question-answer pairs from chunks
- Separate "qa" split in dataset
- Enables fine-tuning climate QA models
