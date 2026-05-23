# HERMES AGENT HANDOFF — OVERNIGHT BRIEFS

Seven self-contained briefs covering the gaps surfaced in the v5 evaluation
of GAIA. Each is sized for a single overnight session by one agent. They
share no files, so they can run in parallel — distribute freely.

Each brief tells you:
- **Goal** — one sentence
- **Why** — the user-visible problem this solves
- **Inputs** — files you'll read
- **Deliverable** — files you'll write
- **Done when** — testable criteria the agent can self-verify
- **Constraints** — what NOT to touch
- **Best fit** — agent disposition this work suits

Read the brief, do the work, mark done, leave a brief commit note in the
deliverable. Don't expand scope; if something feels out of scope, drop it
and flag in your commit note.

---

## BRIEF A — Top-k diversity via Maximal Marginal Relevance

**Goal.** Spread the top-8 retrieved chunks across distinct source articles
instead of returning six near-identical snippets from the same Wikipedia page.

**Why.** The end-to-end simulation showed that *"what did Turkey pledge under
the Paris agreement"* returns six Paris Agreement Wikipedia chunks in a row.
The LLM gets six near-duplicate sources, wasting context budget that could
have gone to the Climate Watch NDC chunk, Turkey-specific Wikipedia article,
and any IPCC mentions of Turkey. MMR is the standard fix: trade off relevance
against novelty.

**Inputs.**
- `js/gaia-retrieval.js` (the `searchHybrid` function — pool of ~24 candidates)
- `dist/knowledge/index.json` (for chunk titles)

**Deliverable.**
- `js/gaia-retrieval.js` updated with an MMR pass after the reranker. After
  the reranker scores all pool candidates, instead of taking the top-k by
  score, run MMR with λ=0.7 (relevance weight): repeatedly pick the next
  candidate that maximises `λ * rerankScore - (1-λ) * max_similarity_to_already_picked`
  where similarity is computed as Jaccard over chunk title tokens. Stop at k=8.
- `dis/test_retrieval.mjs` — add one test confirming the Turkey query
  returns no more than 3 Paris Agreement chunks in the top-8 (the diversity
  threshold).

**Done when.**
- All 18 existing retrieval tests still pass.
- New diversity test passes.
- Run `node dis/simulate_end_to_end.mjs` and confirm the Turkey query's
  top-6 now spans at least 3 distinct chunk titles.

**Constraints.**
- Don't change the reranker or its training. MMR is a post-rerank diversification step.
- Don't change the candidate pool size or the RRF logic.

**Best fit.** Execution-oriented agent. Code change is ~50-80 lines + one test.

---

## BRIEF B — Sector-match feature + reranker v2

**Goal.** Add a sector-aware feature to the reranker so *"best drawdown
solutions for the electricity sector"* stops returning Cool Roofs and Low-Flow
Fixtures (which are Buildings-sector solutions).

**Why.** The reranker has no sector awareness. The sector is in the chunk
text (`Sector: Electricity`) and in the chunk topics, but the reranker only
sees aggregated features. Add a `sector_match` feature: 1 if the query
mentions a sector keyword AND the chunk's topics or text contains that
sector, else 0.

**Inputs.**
- `dis/train_reranker.py` (the `featurize` function — 16 features currently)
- `js/gaia-reranker.js` (the `featurize` function — must mirror exactly)
- `dist/labels/labels.json` (Ring's labels, used as-is for retraining)
- `dist/knowledge/index.json`

**Deliverable.**
- Both `featurize` functions extended with feature 16: `sector_match`.
  Sector keywords to detect in the query: "electricity", "transport(ation)",
  "buildings", "industry", "agriculture", "food", "land", "ocean", "waste",
  "carbon removal", "energy storage". Match against chunk topics first,
  then chunk text.
- Update `FEATURE_NAMES` array in both files.
- Retrain by running `python3 dis/train_reranker.py`. The new
  `reranker.json` ships automatically.
- Verify in `node dis/simulate_end_to_end.mjs` that the "electricity sector"
  query now returns solutions like Wind Turbines, Solar PV, LED Lighting —
  not Cool Roofs or Low-Flow Fixtures.

**Done when.**
- Trainer runs cleanly. Reports NDCG numbers.
- `node dis/test_reranker.mjs` runs cleanly (parity between Python and
  JS scoring on a few sample queries — write a small parity check if
  needed).
- Simulation shows the fix.

**Constraints.**
- Don't change other features. Just add the 17th.
- Don't change tokenization or stemming.
- Mirror Python ↔ JS featurize implementations exactly.

**Best fit.** Execution-oriented agent. Touches two files symmetrically.

---

## BRIEF C — Paleo chunk enrichment

**Goal.** Make the paleoclimate data interpretable when injected into the
LLM prompt. Currently the GISP2 temperature reading `-46.515°C` looks like
an absolute air temperature and will confuse the model.

**Why.** GISP2 δ¹⁸O-derived temperatures are proxies, not absolute readings.
The LLM might quote `-46°C in the Younger Dryas` literally, which is wrong.
The structured chunk needs a one-line interpretive note, and ideally a
calibrated absolute-temperature column added (Greenland air temperature
during the Younger Dryas was roughly -35°C to -40°C; the GISP2 value can
be calibrated against modern observation).

**Inputs.**
- `dis/build_structured.py` (the `build_paleo` function)
- `holocene-bifurcation/data/processed/holocene_bifurcation_base.csv`
- Optional: web research on GISP2 calibration to absolute temperature.

**Deliverable.**
- `dis/build_structured.py` updated to emit an additional `notes` field
  in each paleo row: a short explanation that GISP2 temps are δ¹⁸O proxies,
  what they represent, and a calibrated approximation if possible.
- Update `js/gaia-structured.js` `buildContext` for paleo to include the
  note in the structured block.
- Regenerate paleo.json by running `python3 dis/build_structured.py`.

**Done when.**
- The end-to-end simulation for "Younger Dryas" query now shows an
  interpretive note alongside the raw GISP2 number.
- No existing tests break.

**Constraints.**
- Don't modify the raw paleo CSV.
- Don't add new data sources unless they're well-cited.

**Best fit.** Reasoning agent. Requires judgment about how to phrase the
interpretive note responsibly, plus light coding.

---

## BRIEF D — Real LLM smoke test (10-query end-to-end)

**Goal.** Run 10 representative queries through the full live pipeline —
including a real OpenRouter call — and capture what users actually see.
Currently the system has never been verified end-to-end with a live LLM.

**Why.** Everything we've built has been tested up to the point of "the
LLM call." We don't know how the model handles the GROUNDING CONTRACT in
the system prompt, whether it cites `[S#]` tags consistently, whether the
sources footer renders right, or whether the personality survives the
contract.

**Inputs.**
- `js/gaia-chat.js` (the `_buildGroundedTurn` and `_callOpenRouter` functions)
- An OpenRouter API key (request from the human running the brief; do not
  commit the key)
- `dis/simulate_end_to_end.mjs` (for the query list and prompt assembly)

**Deliverable.**
- New `dis/live_smoke_test.mjs` that:
  1. Loads the OpenRouter key from `OPENROUTER_API_KEY` env var (fail
     clearly if missing).
  2. Runs 10 hand-picked queries (use the simulation's 5 + 5 more covering
     country, paleo, emotional, comparative, source-explicit).
  3. Captures: assembled system prompt, LLM response, sources passed in,
     citation tags found in response, citation tags MISSING from response.
  4. Saves results to `dist/eval/live_smoke_test_<timestamp>.json` plus
     a human-readable `.md` summary.
- A brief written analysis section in the `.md`: which queries got cited
  correctly, which queries got confabulation, which queries should have
  triggered refusal but didn't.

**Done when.**
- Script runs without errors on a real API call.
- Output JSON + MD exist and are readable.
- The analysis section identifies at least one concrete issue (zero issues
  is suspicious — look harder).

**Constraints.**
- Don't ship the API key in any file.
- Don't burn more than 10 queries' worth of API budget.
- Use the free `google/gemini-2.0-flash-001:free` model unless told
  otherwise.

**Best fit.** Execution-oriented agent for the script; reasoning agent
for the analysis. Could be split.

---

## BRIEF E — Cross-labeler validation

**Goal.** Verify Ring's label calibration by independently labeling a
sample of the same 200 (query, doc) pairs and computing inter-labeler
agreement.

**Why.** ~10–13% NDCG lift over RRF is real, but the model could overfit
to Ring's particular calibration. Cross-labeler agreement (Cohen's
weighted κ) tells us whether two reasoning agents looking at the same
pairs converge on the same labels. If κ > 0.6, the labels are robust.
If κ < 0.3, the model is fitting to one judge.

**Inputs.**
- `dist/labels/labeling_pack.json`
- `dist/labels/labels.json` (Ring's labels — DO NOT READ until after labeling)
- `dis/RING_LABELING_PROMPT.md` (the rubric — use it)

**Deliverable.**
- `dist/labels/labels_validation.json` — your independent labels for a
  random 200-pair sample (use seed 42 in pair selection so the sample is
  reproducible). Same schema as Ring's labels file.
- `dis/eval_label_agreement.py` — computes Cohen's weighted κ between
  your labels and Ring's labels on the same 200 pairs.
- `dist/eval/label_agreement_report.md` — your κ score, per-class
  confusion matrix, and one paragraph of qualitative notes on where you
  disagreed with Ring and why.

**Done when.**
- Labels file exists with exactly 200 pairs.
- κ computed and written.
- Disagreement notes are honest and specific (cite at least 3 example
  pairs where you scored differently from Ring).

**Constraints.**
- DO NOT look at Ring's labels until after you've finished your own.
  This is single-blind validation.
- Use the same rubric (0–3 scale). Don't invent a new scale.

**Best fit.** Reasoning agent. This is exactly the work Ring did — but
done by someone other than Ring.

---

## BRIEF F — Competitive benchmark research

**Goal.** Identify the existing climate AI tools we're implicitly
competing with, summarise their capabilities, and design a head-to-head
benchmark protocol we can run in a follow-up session.

**Why.** The mission statement is *"best climate AI in the world."*
Right now we have no idea what "best" looks like because we've never
looked. ClimateGPT, ChatClimate, IPCC.AI, ClimateBERT-derived tools all
exist. We need to know what they do well and where we differ before we
can credibly say we're best.

**Inputs.**
- Web research (whichever tools you can identify with the web tools you have).
- Our `docs/CLIMATE_AI_ARCHITECTURE.md` for what we have.

**Deliverable.**
- `dis/COMPETITIVE_LANDSCAPE.md` — a written analysis covering:
  - Each major climate AI tool: name, URL, who built it, what they
    cover, what corpus they use, whether they cite sources, languages,
    pricing model (free / paid / API).
  - A capabilities matrix comparing them on: grounded citations,
    refusal posture, structured data integration, paraphrase recall,
    multilingual support, voice/accessibility, offline use, mobile UX.
  - A short section on where GAIA-v5 already wins, where it likely
    loses, and where the gap is unclear.
- `dis/BENCHMARK_PROTOCOL.md` — a protocol for a 50-query benchmark
  run: which queries, which tools to compare, what to measure, how to
  judge winners. Don't run the benchmark yet — just design it.

**Done when.**
- At least 5 climate AI tools surveyed honestly.
- Capabilities matrix populated.
- Benchmark protocol is specific enough that a future session can just
  execute it.

**Constraints.**
- No marketing-speak. If a tool is bad, say so. If GAIA is worse, say so.
- Cite sources for claims about competitors' capabilities.

**Best fit.** Reasoning agent. Requires honest comparative judgment.

---

## BRIEF G — Turkish localization scaffolding

**Goal.** Set up the infrastructure for serving GAIA in Turkish, including
UI string externalization, language detection, a Turkish system prompt
for GAIA's personality, and a starter Turkish knowledge corpus from
Wikipedia TR.

**Why.** COP31 is in Antalya, Turkey, November 2026. The host audience
deserves to interact with GAIA in their language. This brief is
scaffolding only — full translation quality polish is a future session.

**Inputs.**
- `index.html` and `gaia.html` (current English-only UI)
- `js/gaia-chat.js` (the English GAIA system prompt)
- `data/climate-knowledge-curated.jsonl` (for taxonomy reference)
- Turkish Wikipedia climate articles (you'll need to scrape — start with
  the same 20–30 article titles we used in English).

**Deliverable.**
- `js/gaia-i18n.js` — a tiny i18n layer. Exposes `t('key')` that returns
  the current-language string. Detects language via `navigator.language`
  with manual override stored in `localStorage`.
- `i18n/en.json` and `i18n/tr.json` — strings file for at least: hero
  title, CTA button, sidebar headings, send-button, GAIA bubble messages,
  the demo banner copy, source-footer label.
- `js/gaia-chat.js` updated to choose the Turkish system prompt when
  language=tr. Translate the GROUNDING CONTRACT carefully — don't lose
  the meaning of `[S#]` citation rules.
- A starter Turkish corpus: `data/climate-knowledge-curated-tr.jsonl`
  with at least 200 chunks from Turkish Wikipedia climate articles
  (Iklim degisikligi, Sera etkisi, etc.). Same chunk schema as English.
- Extension of `dis/build_retrieval_index.py` to optionally build a
  Turkish index (`dist/knowledge/index-tr.json.gz`) — but use the same
  tokenizer (it works fine for Turkish since Turkish is reasonably
  alphabetic; stemming will be wrong but BM25 still works as a baseline).

**Done when.**
- Toggling language to tr changes the UI strings.
- Turkish queries hit the Turkish index.
- The Turkish system prompt is real Turkish, not Google-translated word
  salad. (If you can't write Turkish, flag this and stop — don't ship
  broken Turkish.)

**Constraints.**
- Don't break the English path. Default remains English.
- Don't translate the Drawdown solution names or IPCC labels — they're
  proper nouns in English.
- Use the same tokenizer for both languages.

**Best fit.** Execution-oriented agent — but ONLY if Turkish-capable.
If your agent can't write Turkish, decline this brief and flag back.

---

## DISTRIBUTION GUIDANCE

If you have two agents available (Ring + Owl), suggested routing:

| Brief | Best fit | Why |
|------|----------|------|
| A — MMR diversity | Owl | Code change, clear scope |
| B — Sector feature | Owl | Code change, clear scope, retrain |
| C — Paleo enrichment | Ring | Needs judgment on interpretive language |
| D — LLM smoke test | Owl + Ring | Owl writes script, Ring analyses output |
| E — Cross-labeler validation | Ring | Pure judgment work — but NOT Ring-who-already-labeled. Needs a different reasoning agent (or Ring-2 if same agent state but cleared context) |
| F — Competitive benchmark | Ring | Comparative reasoning + research |
| G — Turkish localization | Owl (if Turkish-capable) | Infrastructure-heavy |

If only Owl is available: A, B, C, D-script, G. Skip E and F for now.

If only Ring is available: C, D-analysis, E, F. Skip A, B, G for now.

Each brief is self-contained. None of them touch the same files, so they
can run in parallel without merge conflicts.

When an agent reports back "done", verify by running the relevant test
script and inspecting the deliverables. Then move the brief to a
DONE.md so it doesn't get re-assigned.
