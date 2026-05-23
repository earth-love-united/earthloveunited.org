# OWL — RELEVANCE LABELING TASK

You are judging the relevance of retrieved documents for climate-related
user questions. Your labels will train a learning-to-rank model that
sits inside GAIA, the climate AI of Earth Love United.

## INPUT

You'll receive a JSON file at `dist/labels/labeling_pack.json` with this shape:

```json
{
  "queries": [
    {
      "qid": 1,
      "text": "what is permafrost",
      "kind": "concept",
      "candidates": [
        { "doc_id": 1142, "title": "Permafrost", "source": "Wikipedia",
          "snippet": "Permafrost is ground that ...", "topics": [...],
          "bm25_rank": 1, "dense_rank": 3, "rrf_score": 0.0312 },
        ...20 candidates total
      ]
    },
    ...238 queries total
  ]
}
```

There are **238 queries × 20 candidates = 4,760 pairs** to score.

## OUTPUT

Write a JSON file at `dist/labels/labels.json` with this exact shape:

```json
{
  "v": 1,
  "labeled_at": "2026-05-20",
  "labeler": "owl",
  "labels": [
    { "qid": 1, "doc_id": 1142, "relevance": 3 },
    { "qid": 1, "doc_id": 2087, "relevance": 1 },
    ...
  ]
}
```

Every (qid, doc_id) pair in the labeling pack must appear exactly once in
`labels`. No additions, no omissions.

## RUBRIC — score each (query, document) pair on a 0–3 scale

| Score | Meaning |
|------:|---------|
| **3** | **Highly relevant.** The document directly answers the question or is the single best source available for it. A reader getting this document would say "yes, that's exactly what I needed." |
| **2** | **Relevant.** The document addresses the question but isn't the most direct answer — it provides useful background, partial information, or one of several relevant angles. |
| **1** | **Marginally relevant.** The document touches the topic but doesn't really answer the question. It might mention the right keywords but in a different context. A reader would feel disappointed. |
| **0** | **Not relevant.** The document is off-topic for this question. The retrieval system surfaced it because of incidental term overlap, not real relevance. |

## JUDGEMENT GUIDELINES — read carefully

1. **Read the snippet, not just the title.** Some titles are accurate;
   others are misleading. A Wikipedia article titled "Climate change
   adaptation" may be 3-relevant for one query and 0-relevant for another
   depending on what the snippet actually contains.

2. **Source matters, but doesn't determine relevance.** A Wikipedia chunk
   can be highly relevant; an IPCC chunk can be irrelevant. Don't favour
   a source just because it sounds authoritative — favour it because the
   content actually answers the question.

3. **Be honest about partial matches.** If the question is "how do heat
   pumps work" and the document is "drawdown solutions for buildings
   sector", that's marginally relevant (1), not relevant (2). The document
   mentions heat pumps but doesn't explain how they work.

4. **For source-explicit queries, prefer the explicit source.** If the
   question says "what does the IPCC say about X", an IPCC chunk on X is
   3-relevant, a Wikipedia chunk on X is 2-relevant (still useful background,
   but not what was asked).

5. **For country queries, prefer chunks that mention the country.**
   "What did Turkey pledge under Paris" → a Wikipedia "Paris Agreement"
   chunk that lists country pledges is 2 or 3 depending on whether Turkey
   is actually mentioned in the snippet. A generic Paris Agreement chunk
   that doesn't mention Turkey is 1.

6. **For paraphrase queries, look beyond literal term overlap.**
   "thawing tundra" should pull permafrost articles at 3. The retrieval
   system has already done the heavy lifting — your job is to confirm
   whether the system was right.

7. **For paleo queries, prefer chunks that mention the specific epoch.**
   "CO2 during the Younger Dryas" → a chunk that mentions Younger Dryas
   specifically is 3; a generic paleoclimate chunk is 1–2.

8. **Tie-breaking.** When in doubt between two scores, pick the lower one.
   It's better to underestimate relevance than to over-reward weak matches —
   the model will learn the wrong patterns otherwise.

## CALIBRATION EXAMPLES

For each example I show one query and rate three candidates.

### Example 1
Query: **"what is permafrost"** (concept)

- **doc_id=1142** · Wikipedia · "Permafrost" · snippet: *"Permafrost is ground that remains continuously frozen for at least two consecutive years..."* → **3** (textbook answer)
- **doc_id=2455** · Wikipedia · "Effects of climate change" · snippet: *"...As permafrost thaws, it releases stored carbon and methane..."* → **2** (touches permafrost but in a downstream-effects context)
- **doc_id=982** · Project Drawdown · "Restore Peatlands: Boreal" · snippet: *"Solution: Restore Peatlands: Boreal. Sector: Nature-Based Carbon Removal..."* → **1** (peatlands ≠ permafrost, only marginally related)

### Example 2
Query: **"drawdown's most recommended solutions"** (source-explicit)

- **doc_id=2613** · Project Drawdown · "Deploy Onshore Wind Turbines" · snippet: *"Solution: Deploy Onshore Wind Turbines. Project Drawdown classification: Highly Recommended..."* → **3** (a top-recommended Drawdown solution)
- **doc_id=2700** · Project Drawdown · "Use Methane Removal" · snippet: *"Solution: Use Methane Removal... Project Drawdown classification: Keep Watching..."* → **1** ("Keep Watching" isn't "most recommended")
- **doc_id=455** · IPCC · "AR6 WGIII Summary for Policymakers" · snippet: *"...mitigation pathways..."* → **1** (not Drawdown, even if topical)

### Example 3
Query: **"what did Turkey pledge under the paris agreement"** (country)

- **doc_id=88** · Wikipedia · "Paris Agreement" · snippet: *"...Turkey ratified the Paris Agreement in 2021 and submitted an updated NDC with..."* → **3** (mentions Turkey + Paris together)
- **doc_id=89** · Wikipedia · "Paris Agreement" · snippet: *"The Paris Agreement is an international treaty on climate change... 196 parties..."* → **1** (Paris Agreement generic, no Turkey)
- **doc_id=1701** · Wikipedia · "Climate change in Turkey" · snippet: *"Turkey is a major emitter of greenhouse gases..."* → **2** (about Turkey's climate, useful background, doesn't directly cover the pledge)

## SCORING DISCIPLINE

- Be consistent across the file. If you rated a generic Wikipedia chunk
  as 1 for one query, rate similar chunks similarly for similar queries.
- It's normal for many candidates to be 0 or 1 — retrieval is recall-
  focused, and only the top few in each list should be 2 or 3.
- A healthy distribution: roughly 5–15% of pairs are 3, 15–25% are 2,
  30–40% are 1, and 30–40% are 0. If your output is wildly different
  (e.g. 90% rated 3) you've drifted — recalibrate.

## CHECKLIST BEFORE SUBMITTING

- [ ] Every (qid, doc_id) pair from `labeling_pack.json` is in `labels`.
- [ ] No pair appears twice.
- [ ] Every `relevance` value is an integer in {0, 1, 2, 3}.
- [ ] The JSON parses (valid syntax).
- [ ] Spot-check: a few 3-rated documents really do answer their queries.

Thank you, owl. The model you label will become the spine of GAIA's
retrieval. Take your time on the hard cases.
