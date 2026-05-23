#!/usr/bin/env python3
"""
synthetic_labels.py — Placeholder relevance labels using a deterministic
heuristic. The whole point of these labels is to let us exercise the
training + browser-runtime pipeline end-to-end *today*, before owl's real
labels come back. Once owl returns labels in the same format, this file
is unused.

Heuristic relevance per (query, candidate):
  base = 0
  + 1 if rrf_score >= median(rrf_scores) for this query
  + 1 if doc title shares any token with query (after stemming)
  + 1 if dense_rank or bm25_rank is in the top-3 for this query
  - clamped to [0, 3]

This is decent but biased — it rewards what the retriever already liked.
Owl's labels will correct for that bias.
"""

import json
import re
import datetime as dt
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).parent.parent
PACK = ROOT / "dist" / "labels" / "labeling_pack.json"
OUT = ROOT / "dist" / "labels" / "labels_synthetic.json"


STOP = set((
    "a an the and or but if of at by for with about to in on is are was were "
    "be been being am do does did has have had this that these those it its "
    "they them their there here then than so such as also just from into onto "
    "over under up down out off not no nor very more most much many some any "
    "all each every other another one two three first second new old high low "
    "i you he she we us my your our his her whom what which who whose when "
    "where why how because while although however therefore thus hence yet "
    "still already even ever would could should may might must can shall will"
).split())
WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9]+")


def stem(t):
    if len(t) <= 4: return t
    for s in ("ization","ational","ically","ation","ments","ment","ness","tion","ence","ance","able","ible"):
        if t.endswith(s) and len(t)-len(s) >= 4: return t[:-len(s)]
    if t.endswith("ies") and len(t) >= 6: return t[:-3]+"y"
    for s in ("ing","ers","er","ed","es","s"):
        if t.endswith(s) and len(t)-len(s) >= 4: return t[:-len(s)]
    return t


def toks(text):
    return {stem(w.lower()) for w in WORD_RE.findall(text or "") if len(w) >= 3 and w.lower() not in STOP}


def main():
    pack = json.loads(PACK.read_text())
    out_labels = []
    rel_dist = Counter()

    for q in pack["queries"]:
        qtoks = toks(q["text"])
        cands = q["candidates"]
        if not cands: continue
        scores = sorted([c["rrf_score"] for c in cands])
        median_rrf = scores[len(scores) // 2]
        for c in cands:
            relevance = 0
            # +1 for above-median RRF
            if c["rrf_score"] >= median_rrf:
                relevance += 1
            # +1 for shared title tokens
            if qtoks & toks(c["title"]):
                relevance += 1
            # +1 if top-3 in either retriever
            if (c.get("bm25_rank") is not None and c["bm25_rank"] <= 3) or \
               (c.get("dense_rank") is not None and c["dense_rank"] <= 3):
                relevance += 1
            relevance = max(0, min(3, relevance))
            out_labels.append({"qid": q["qid"], "doc_id": c["doc_id"], "relevance": relevance})
            rel_dist[relevance] += 1

    payload = {
        "v": 1,
        "labeled_at": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "labeler": "synthetic-v1",
        "labels": out_labels,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False))
    total = sum(rel_dist.values())
    print(f"[synthetic-labels] wrote {OUT}")
    print(f"[synthetic-labels] {total} labeled pairs")
    print(f"[synthetic-labels] distribution:")
    for r in [3, 2, 1, 0]:
        c = rel_dist[r]
        pct = c / total * 100 if total else 0
        print(f"   relevance={r}: {c:5d}  ({pct:5.1f}%)")


if __name__ == "__main__":
    main()
