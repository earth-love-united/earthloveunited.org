# DATASET AUDIT & ENHANCEMENT PLAN
## Earth Love United Climate Knowledge Dataset
## Audit Date: May 2026

---

# PART 1: AUDIT FINDINGS

## 1.1 Current State

| Metric | Value | Status |
|--------|-------|--------|
| Total chunks | 33,011 | ✅ |
| Total documents | 1,059 | ⚠️ Lean |
| Sources | 4 | ⚠️ Need more |
| Avg chunk size | 1,095 words | ⚠️ Too large |
| Max chunk size | 2,985 words | ❌ Too large |
| Duplicate IDs | 2,134 | ❌ Must fix |
| Empty text | 0 | ✅ |
| URL coverage | 100% | ✅ |
| Date coverage | 100% | ✅ |

## 1.2 Critical Issues

### Issue 1: Duplicate Documents (HIGH PRIORITY)
- 5 Wikipedia articles were extracted twice (Climate change, Climate change mitigation,
  Global surface temperature, Carbon offsets and credits, Net-zero emissions)
- This creates 2,134 duplicate chunk IDs
- Root cause: Wikipedia API returned duplicate entries for some articles
- Impact: Inflates Wikipedia share from ~80% to 87%, dilutes other sources

### Issue 2: Chunks Too Large (HIGH PRIORITY)
- Average chunk: 1,095 words (should be 200-500 for RAG)
- 21,956 chunks > 1,000 words (66% of all chunks!)
- Max chunk: 2,985 words
- Root cause: chunk_text() function uses sentence-based chunking with 512 token limit
  but doesn't enforce it strictly — long sentences blow past the limit
- Impact: RAG retrieval will be imprecise, embeddings less focused

### Issue 3: Wikipedia Category Noise (MEDIUM PRIORITY)
- Wikipedia "topics" are raw category names like:
  "Category:Articles with short description"
  "Category:All articles with unsourced statements"
  "Category:CS1 maint: deprecated archival service"
- These are Wikipedia maintenance tags, NOT climate topics
- Impact: Topic-based filtering/routing won't work well

### Issue 4: Source Imbalance (MEDIUM PRIORITY)
- Wikipedia: 87.1% of chunks (too dominant)
- IPCC: 10.1% (should be higher — it's the gold standard)
- arXiv: 2.7% (too low — should be 10-15%)
- ELU Research: 0.1% (too low — our unique content)

### Issue 5: Missing Key Sources (HIGH PRIORITY)
Missing entirely:
  - Project Drawdown solutions (80+ solutions, the best solutions catalog)
  - EPA climate explainers (authoritative, plain language)
  - UNFCCC/Paris Agreement documents (policy knowledge)
  - World Bank climate data (development + climate intersection)
  - Skeptical Science myth rebuttals (critical for fact-checking)
  - RealClimate expert commentary
  - PLOS Climate open-access papers
  - FineWeb-Edu climate subset (614K high-quality web pages)

## 1.3 Quality Samples

### IPCC Chunks — GOOD but too large
Sample: 1,426 words from AR6 Synthesis Report
- Contains references like "{2.2.2}" that should be cleaned
- Mixes multiple sub-sections in one chunk
- Needs better section-level splitting

### Wikipedia Chunks — GOOD content, noisy topics
Sample: "Present-day climate change includes both global warming..."
- Content is excellent
- Topics are Wikipedia maintenance categories, not climate topics
- Needs topic extraction from content, not just categories

### arXiv Chunks — GOOD but too narrow
Sample: "Structure-preserving stochastic parameterization of a barotropic..."
- Highly technical, may not be useful for general audience
- Abstracts only — no full text
- Needs filtering for relevance/audience level

### ELU Research Chunks — EXCELLENT but too few
Sample: "The Keeling Curve is the most important scientific measurement..."
- High quality, well-written, unique content
- Only 39 chunks — should be 200+
- Needs more of our research incorporated

---

# PART 2: ENHANCEMENT PLAN

## 2.1 Fixes (Must Do)

### Fix 1: Deduplicate Wikipedia Articles
- Remove duplicate entries from raw data
- Re-extract with deduplication
- Expected impact: Remove ~2,100 duplicate chunks

### Fix 2: Improve Chunking
- Reduce max chunk size to 400 words (from 1,095 avg)
- Use paragraph-aware splitting (not just sentence-based)
- Add overlap of 50 words between chunks
- Expected impact: 2-3x more chunks, much better RAG precision

### Fix 3: Clean Wikipedia Topics
- Filter out Wikipedia maintenance categories
- Extract actual climate topics from content using keyword matching
- Map to a controlled vocabulary of ~50 climate topics
- Expected impact: Topic-based routing actually works

### Fix 4: Clean IPCC References
- Remove reference markers like "{2.2.2}" from text
- Split at section boundaries (not just sentence boundaries)
- Expected impact: Cleaner text, better embeddings

## 2.2 Enhancements (Should Do)

### Enhancement 1: Add Project Drawdown Solutions
SOURCE: https://drawdown.org/solutions
FORMAT: ~80 solution pages with structured data
CONTENT: Description, impact, cost, co-benefits for each solution
EXPECTED CHUNKS: ~500-800
PRIORITY: HIGH — this is the best climate solutions catalog available

### Enhancement 2: Add EPA Climate Explainers
SOURCE: https://www.epa.gov/climate-change
FORMAT: ~100 pages of plain-language explanations
CONTENT: Causes, effects, solutions, FAQs
EXPECTED CHUNKS: ~300-500
PRIORITY: HIGH — authoritative, plain language, US government

### Enhancement 3: Add Skeptical Science Myth Rebuttals
SOURCE: https://skepticalscience.com/
FORMAT: ~200 myth rebuttals
CONTENT: Common climate myths + scientific rebuttals
EXPECTED CHUNKS: ~400-600
PRIORITY: HIGH — critical for fact-checking capability

### Enhancement 4: Add More Wikipedia Articles
CURRENT: 130 articles
TARGET: 500+ articles
METHOD: Expand seed list to cover all major climate topics
EXPECTED CHUNKS: ~15,000-20,000
PRIORITY: MEDIUM — more coverage, but Wikipedia already dominant

### Enhancement 5: Add More arXiv Papers
CURRENT: 897 papers
TARGET: 5,000+ papers
METHOD: Broader search queries, more categories
EXPECTED CHUNKS: ~5,000-10,000
PRIORITY: MEDIUM — more research depth

### Enhancement 6: Add FineWeb-Edu Climate Subset
SOURCE: sraj/finewebedu-climate on Hugging Face (614K pages)
FORMAT: High-quality educational web pages filtered for climate
CONTENT: Diverse climate content from across the web
EXPECTED CHUNKS: ~50,000-100,000
PRIORITY: HIGH — this is a massive, high-quality source

### Enhancement 7: Add Our Full Research Corpus
CURRENT: RESEARCH.md only (27 sections)
ADD: DATA_SOURCES.md, CARBON_REGISTRIES.md, PRODUCTION_GUIDE.md,
     CLIMATE_DATASETS.md
EXPECTED CHUNKS: ~200-300
PRIORITY: HIGH — our unique content is our moat

### Enhancement 8: Add UNFCCC/Paris Agreement Documents
SOURCE: https://unfccc.int/
FORMAT: Treaty text, NDCs, policy documents
CONTENT: International climate policy knowledge
EXPECTED CHUNKS: ~200-400
PRIORITY: MEDIUM — policy knowledge gap

## 2.3 Target Dataset v2.0

| Source | Current Chunks | Target Chunks | Change |
|--------|---------------|---------------|--------|
| Wikipedia | 28,757 | 15,000 | Better chunking, deduped |
| IPCC | 3,318 | 2,000 | Better section splitting |
| arXiv | 897 | 5,000 | 5x more papers |
| ELU Research | 39 | 300 | All our research |
| Project Drawdown | 0 | 800 | NEW |
| EPA | 0 | 500 | NEW |
| Skeptical Science | 0 | 600 | NEW |
| FineWeb-Edu Climate | 0 | 50,000 | NEW |
| UNFCCC | 0 | 300 | NEW |
| **Total** | **33,011** | **74,500** | **2.3x larger** |

---

# PART 3: IMPLEMENTATION ORDER

## Phase 1: Fixes (Do First)
1. Fix Wikipedia deduplication
2. Improve chunking algorithm
3. Clean Wikipedia topics
4. Clean IPCC references
5. Rebuild dataset

## Phase 2: High-Priority Enhancements
6. Add Project Drawdown solutions
7. Add EPA climate explainers
8. Add Skeptical Science myths
9. Add our full research corpus
10. Rebuild dataset

## Phase 3: Scale Enhancements
11. Add FineWeb-Edu climate subset
12. Expand Wikipedia to 500+ articles
13. Expand arXiv to 5,000+ papers
14. Add UNFCCC documents
15. Final rebuild and validation

## Phase 4: Push to Hugging Face
16. Generate dataset card
17. Validate all chunks
18. Push to earthloveunited/climate-knowledge
19. Announce

---

# PART 4: QUALITY METRICS FOR V2.0

| Metric | Current | Target |
|--------|---------|--------|
| Total chunks | 33,011 | ~75,000 |
| Avg chunk words | 1,095 | 300-400 |
| Max chunk words | 2,985 | 600 |
| Duplicate IDs | 2,134 | 0 |
| Sources | 4 | 9 |
| Wikipedia % | 87% | 20% |
| IPCC % | 10% | 3% |
| Research % | 3% | 15% |
| Unique content % | 0.1% | 0.4% |
| Topic quality | Noisy | Clean |
