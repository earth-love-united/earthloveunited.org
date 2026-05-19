# CLIMATE AI ARCHITECTURE — GAIA v5
## Grounded generation over curated datasets
### May 2026

---

## THE PROBLEM

GAIA currently calls OpenRouter with a hand-typed static blob (`_buildKnowledgeContext()` in `js/gaia-chat.js`) — about thirty facts inlined into the system prompt. The real moat sitting in this repo never reaches the LLM:

| Dataset | Rows | Size | What it is |
|---|---|---|---|
| `data/climate-knowledge-curated.jsonl` | 2,840 chunks | 2.3 MB | Wikipedia (2,022) + Drawdown (456) + IPCC AR6 (348) + EPA (14), pre-chunked, ~500 chars each |
| `carbon-projects/unified/carbon_projects_final.jsonl` | 8,877 | 27 MB | Verra + Gold Standard offset projects with methodology, location, credits |
| `carbon-projects/pledge-reality/.../enriched.csv` | 2,749 | 2.5 MB | Country-year fossil/LULUCF emissions joined to NDC pledges (1990–present) |
| `holocene-bifurcation/.../base.csv` | 1,251 | 87 KB | GISP2 temp, EPICA CO₂, solar ¹⁴C, sea-level — 0 to 12,500 years BP |
| `dis/climate-facts.json`, `dis/climate-bifurcation-points.json`, `dis/geological-memory.json` | — | small | Curated structured facts |

Right now answers are either pre-baked HTML (knowledge intents) or LLM-generated free-form text with no citation contract. To be the best climate AI in the world, every claim that touches climate facts needs to be grounded in one of these datasets, and the user needs to see the source.

---

## TARGET ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                         User message                            │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  matchIntent(text)  —  fast paths only                          │
│  • calculator  → carbon engine                                  │
│  • greeting    → KB.greeting                                    │
│  • else        → GROUNDED PATH                                  │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  GaiaRetrieval.search(query, k=8)                               │
│  • Tokenize + stem                                              │
│  • BM25 score over inverted index                               │
│  • Return top-k chunks with id, title, source, url, text        │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  GaiaStructured.lookup(query)  —  optional, parallel            │
│  • Country regex → pledge_vs_reality row                        │
│  • "carbon projects in X / type Y" → aggregate                  │
│  • Years BP / paleo → holocene_bifurcation slice                │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  buildGroundedPrompt(query, chunks, structured, history)        │
│  System prompt =                                                │
│    GAIA personality                                             │
│  + GROUNDING CONTRACT (see below)                               │
│  + SOURCES block: [S1] title (source) — text...                 │
│  + STRUCTURED block: country pledges / project totals / paleo   │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenRouter call  →  reply text with inline [S1][S3] citations  │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  renderGroundedMessage(reply, chunks)                           │
│  • Parse [S#] tags → render as superscript links                │
│  • Append "Sources" footer with title + url per cited chunk     │
└─────────────────────────────────────────────────────────────────┘
```

---

## RETRIEVAL — BM25 over the curated set

**Index built offline** by `dis/build_retrieval_index.py` (new), output `dist/knowledge/index.json.gz`:

```
{
  "v": 3,
  "n": 2840,
  "avgdl": <average doc length in tokens>,
  "src": { "W":"Wikipedia","D":"Drawdown","I":"IPCC","E":"US EPA" },
  "chunks": [ { "t": "Climate change", "s": "W", "u": "https://...", "x": "full text", "p": ["topics"] }, ... ],
  "df": { "carbon": 412, "permafrost": 28, ... },
  "post": { "carbon": [[12,3],[55,1],...], ... }   // [chunk_idx, term_freq]
}
```

- **Tokenizer**: lowercase, strip non-alphanumerics, split, drop stopwords + length ≤ 2
- **Light stemming**: strip trailing `s`, `ed`, `ing` for both query and index (Porter-lite, no library needed)
- **BM25**: classic `k1=1.5`, `b=0.75`, with IDF = `log((N - df + 0.5)/(df + 0.5) + 1)`
- **Title boost**: tokens appearing in the title get a 2× term frequency
- **Topic boost**: topics field treated as title tokens (also 2×)

Expected size: ~1.3 MB gzipped. Loaded lazily on first chat message, cached in `localStorage` after first decode (compressed cache).

**Client engine** `js/gaia-retrieval.js`:
- Public API: `GaiaRetrieval.load()`, `GaiaRetrieval.search(q, k)`, `GaiaRetrieval.getContext(q, { maxChars, k })`
- Returns `[{ id, score, title, source, url, text, snippet }]`

---

## STRUCTURED LOOKUPS — pledge, projects, paleo

Small JSON aggregates, prebuilt offline, shipped alongside the retrieval index:

- `dist/knowledge/pledges.json` — one row per country: latest NDC summary, target year, %, conditionality, latest fossil CO₂ Mt, trajectory (5 most-recent years). ~250 KB.
- `dist/knowledge/projects-by-country.json` — grouped: per ISO3, project count, methodologies (top 5), total annual reduction (tCO₂), credits issued/retired. ~80 KB.
- `dist/knowledge/paleo.json` — full 1,251-row holocene matrix (already small). ~100 KB.

Client engine `js/gaia-structured.js`:
- `lookupCountry(name|iso)` → pledge row + emission trajectory
- `lookupProjects({ country, methodology, type })` → aggregate stats
- `lookupPaleo({ yearsBp })` → nearest CO₂/temp/sea-level row

Detection is regex-based in `gaia-chat.js`: country name → `lookupCountry`; "carbon projects in X" → `lookupProjects`; "X thousand/million years ago" → `lookupPaleo`.

---

## GROUNDING CONTRACT (in system prompt)

```
You are GAIA. You may speak freely about identity, feelings, ELU projects,
and general framing. But for any factual claim about climate science,
emissions, energy, policy, or paleoclimate, you MUST follow this contract:

1. SOURCES section below contains all evidence available for this question.
2. Cite every factual claim with the bracketed source IDs, e.g. "...
   atmospheric CO₂ reached 421 ppm in 2023 [S2]."
3. If multiple sources support a claim, cite them: [S1][S4].
4. If the sources do not support a claim, you must either:
   (a) omit the claim, or
   (b) prefix it with "Not in my sources, but —" and keep it brief.
5. Never invent specific numbers, dates, or quotes not in the sources.
6. STRUCTURED section, when present, holds verified country/project/paleo
   data — treat it with the same weight as sources, cite as [P1] for
   projects, [N1] for NDC/pledges, [H1] for paleo.
```

Refusal posture: if retrieval returns zero chunks AND no structured data matches, GAIA acknowledges the limit explicitly rather than confabulating.

---

## UI — citations as first-class

`addMessage('gaia', reply)` gets a new sibling renderer `renderGroundedReply(reply, sources)` that:

1. Replaces `[S1]` style tags with `<sup class="src-cite" data-id="S1">1</sup>` (clickable).
2. Appends a `<details class="sources">` block at the bottom of the bubble:
   ```
   ▾ Sources (4)
     1. Climate change — Wikipedia ↗
     2. AR6 WGI SPM — IPCC ↗
     ...
   ```
3. Hover/click a `[S#]` superscript scrolls + highlights the matching source row.

CSS additions in a new `css/gaia-sources.css`.

---

## BUILD PIPELINE

```
make knowledge   →   python dis/build_retrieval_index.py
                     python dis/build_structured.py
                     copies outputs to dist/knowledge/
```

Outputs (all served as static files, gzipped):
- `dist/knowledge/index.json.gz` — BM25 index + chunks (~1.3 MB gz)
- `dist/knowledge/pledges.json` — country pledge table (~250 KB)
- `dist/knowledge/projects-by-country.json` — project aggregates (~80 KB)
- `dist/knowledge/paleo.json` — holocene matrix (~100 KB)
- `dist/knowledge/manifest.json` — versions + checksums

Lazy-load: only fetched on first chat interaction or when user opens `gaia.html`.

---

## SUCCESS CRITERIA

A query like *"How is permafrost feedback expected to evolve under 2°C warming?"* should:
1. Retrieve top-k chunks from IPCC AR6 + Wikipedia permafrost articles.
2. Inject them as `SOURCES` in the prompt.
3. Get a reply that cites 2–4 [S#] tags inline.
4. Render a Sources footer with clickable links to the actual Wikipedia/IPCC URLs.

A query like *"What did Turkey pledge under Paris?"* should:
1. Hit `lookupCountry("Turkey")` → NDC summary row.
2. Inject as `STRUCTURED [N1]`.
3. Reply cites the pledge text + the latest emission trajectory.

A query like *"Tell me about quantum computing"* should:
1. Retrieve few/no chunks (out of domain).
2. GAIA replies: "That's outside what I'm built for — I'm trained on climate, restoration, and Earth-systems sources." (refusal posture, not confabulation.)

---

## WHAT IS NOT IN THIS PASS

- Vector embeddings (BM25 + light stemming gets us 80% of the way; embeddings can come later if recall is a problem)
- Server-side retrieval in the Cloudflare Worker (the worker path already exists in `dis/`, but the public site doesn't depend on it — client-side first)
- Multi-hop reasoning / agentic retrieval
- Multilingual retrieval (English-only for v5; Turkish for COP31 in a later pass)
- Re-ranking with an LLM (top-k from BM25 goes straight in)

These are deferred until the grounded baseline ships and we measure where it falls short.
