#!/usr/bin/env python3
"""
train_reranker.py — Train a LambdaRank LightGBM model over labeled
(query, candidate) pairs and export a JSON model the browser can
evaluate in pure JS.

Inputs:
  dist/labels/labeling_pack.json     — candidates + retrieval features
  dist/labels/labels.json            — owl's labels (preferred)
  dist/labels/labels_synthetic.json  — heuristic fallback if labels.json missing

Outputs:
  dist/knowledge/reranker.json       — compact model + feature spec

Features per (query, candidate):
   0  bm25_score
   1  bm25_rank             (33 if absent — sentinel for "didn't surface")
   2  dense_score
   3  dense_rank            (33 if absent)
   4  rrf_score
   5  source_W              (1 if Wikipedia, else 0)
   6  source_I              (1 if IPCC,      else 0)
   7  source_D              (1 if Drawdown,  else 0)
   8  source_E              (1 if EPA,       else 0)
   9  title_overlap_count   (# of query tokens appearing in title)
  10  title_jaccard         (Jaccard similarity of query tokens vs title tokens)
  11  topic_overlap_count
  12  snippet_overlap_count
  13  query_length          (tokens after stop/stem)
  14  doc_length            (tokens, from index)
  15  source_mentioned      (1 if query explicitly named a source: IPCC/Drawdown/EPA/Wikipedia)
"""

import json
import re
import sys
from pathlib import Path
from collections import Counter

import numpy as np
import lightgbm as lgb

ROOT = Path(__file__).parent.parent
PACK = ROOT / "dist" / "labels" / "labeling_pack.json"
LABELS_REAL = ROOT / "dist" / "labels" / "labels.json"
LABELS_SYN = ROOT / "dist" / "labels" / "labels_synthetic.json"
INDEX_PATH = ROOT / "dist" / "knowledge" / "index.json"
OUT = ROOT / "dist" / "knowledge" / "reranker.json"

# Tokenizer (kept consistent with build_retrieval_index.py)
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
    for s in ("ization","izations","ational","iveness","fulness","ousness","ically","ation","ations","ments","ment","ness","tion","ence","ance","able","ible"):
        if t.endswith(s) and len(t)-len(s) >= 4: return t[:-len(s)]
    if t.endswith("ings") and len(t) >= 7: return t[:-4]
    if t.endswith("ies") and len(t) >= 6: return t[:-3]+"y"
    if t.endswith("ied") and len(t) >= 6: return t[:-3]
    for s in ("ing","ers","er","ed","es","s"):
        if t.endswith(s) and len(t)-len(s) >= 4: return t[:-len(s)]
    return t


def toks(text):
    if not text: return []
    return [stem(w.lower()) for w in WORD_RE.findall(text) if len(w) >= 3 and w.lower() not in STOP]


SOURCE_MENTION_RE = re.compile(r"\b(ipcc|ar6|ar5|sr15|drawdown|epa|wikipedia)\b", re.IGNORECASE)


FEATURE_NAMES = [
    "bm25_score", "bm25_rank", "dense_score", "dense_rank", "rrf_score",
    "source_W", "source_I", "source_D", "source_E",
    "title_overlap_count", "title_jaccard",
    "topic_overlap_count", "snippet_overlap_count",
    "query_length", "doc_length", "source_mentioned",
]


def featurize(query_text, candidate, index_chunks):
    qtoks = toks(query_text)
    qset = set(qtoks)
    title_toks = set(toks(candidate["title"]))
    topic_toks = set()
    for t in candidate.get("topics", []) or []:
        topic_toks |= set(toks(t))
    snippet_toks = set(toks(candidate.get("snippet", "")))

    src = candidate["source"]
    src_code = {"Wikipedia": "W", "IPCC": "I", "Project Drawdown": "D", "US EPA": "E"}.get(src, "?")

    title_overlap = len(qset & title_toks)
    title_union = len(qset | title_toks)
    jaccard = title_overlap / title_union if title_union else 0.0
    topic_overlap = len(qset & topic_toks)
    snippet_overlap = len(qset & snippet_toks)

    bm_rank = candidate.get("bm25_rank") or 33
    dn_rank = candidate.get("dense_rank") or 33

    # Doc length from the index (chunks share that field).
    doc_id = candidate["doc_id"]
    doc_len = index_chunks[doc_id].get("l", 0)

    return [
        float(candidate.get("bm25_score", 0.0)),
        float(bm_rank),
        float(candidate.get("dense_score", 0.0)),
        float(dn_rank),
        float(candidate.get("rrf_score", 0.0)),
        1.0 if src_code == "W" else 0.0,
        1.0 if src_code == "I" else 0.0,
        1.0 if src_code == "D" else 0.0,
        1.0 if src_code == "E" else 0.0,
        float(title_overlap),
        float(jaccard),
        float(topic_overlap),
        float(snippet_overlap),
        float(len(qtoks)),
        float(doc_len),
        1.0 if SOURCE_MENTION_RE.search(query_text or "") else 0.0,
    ]


def main():
    if not PACK.exists():
        sys.exit("missing labeling pack — run build_labeling_pack.py")

    labels_path = LABELS_REAL if LABELS_REAL.exists() else LABELS_SYN
    if not labels_path.exists():
        sys.exit("no labels found — run synthetic_labels.py or provide labels.json")
    labels_doc = json.loads(labels_path.read_text())
    pack = json.loads(PACK.read_text())
    index = json.loads(INDEX_PATH.read_text())
    chunks = index["chunks"]

    print(f"[train] using labels from {labels_path.name}  (labeler={labels_doc.get('labeler')})")

    # Build label lookup
    label_map = {}
    for r in labels_doc["labels"]:
        label_map[(r["qid"], r["doc_id"])] = r["relevance"]

    # Featurize, group by qid
    queries_sorted = sorted(pack["queries"], key=lambda q: q["qid"])

    # Train/test split: 80/20 by qid
    rng = np.random.default_rng(7)
    qids = [q["qid"] for q in queries_sorted]
    rng.shuffle(qids)
    cutoff = int(len(qids) * 0.8)
    train_qids = set(qids[:cutoff])
    test_qids = set(qids[cutoff:])

    X_train, y_train, g_train = [], [], []
    X_test, y_test, g_test = [], [], []
    test_records = []  # for NDCG eval later

    skipped_no_label = 0
    for q in queries_sorted:
        in_train = q["qid"] in train_qids
        rows = []
        labels = []
        cand_keep = []
        for c in q["candidates"]:
            key = (q["qid"], c["doc_id"])
            if key not in label_map:
                skipped_no_label += 1
                continue
            rows.append(featurize(q["text"], c, chunks))
            labels.append(label_map[key])
            cand_keep.append(c)
        if not rows: continue
        target = (X_train if in_train else X_test)
        ytarget = (y_train if in_train else y_test)
        gtarget = (g_train if in_train else g_test)
        target.extend(rows); ytarget.extend(labels); gtarget.append(len(rows))
        if not in_train:
            test_records.append({"qid": q["qid"], "text": q["text"], "labels": labels,
                                 "candidates": cand_keep})

    if skipped_no_label:
        print(f"[train] skipped {skipped_no_label} pairs without labels")
    X_train = np.asarray(X_train, dtype=np.float32)
    y_train = np.asarray(y_train, dtype=np.int32)
    X_test = np.asarray(X_test, dtype=np.float32)
    y_test = np.asarray(y_test, dtype=np.int32)
    print(f"[train] train: {X_train.shape}  groups={len(g_train)}")
    print(f"[train] test:  {X_test.shape}   groups={len(g_test)}")

    # LambdaRank
    train_ds = lgb.Dataset(X_train, label=y_train, group=g_train, feature_name=FEATURE_NAMES)
    test_ds = lgb.Dataset(X_test, label=y_test, group=g_test, feature_name=FEATURE_NAMES, reference=train_ds)

    params = {
        "objective": "lambdarank",
        "metric": "ndcg",
        "ndcg_eval_at": [3, 5, 8],
        "learning_rate": 0.06,
        "num_leaves": 31,
        "min_data_in_leaf": 8,
        "feature_fraction": 0.9,
        "bagging_fraction": 0.9,
        "bagging_freq": 5,
        "verbosity": -1,
    }
    booster = lgb.train(
        params, train_ds,
        num_boost_round=400,
        valid_sets=[train_ds, test_ds],
        valid_names=["train", "test"],
        callbacks=[lgb.early_stopping(40), lgb.log_evaluation(50)],
    )

    # ─── Export to compact JSON ─────────────────────────────────────
    model_dump = booster.dump_model()
    trees = []
    for t in model_dump["tree_info"]:
        nodes = []
        flatten_tree(t["tree_structure"], nodes)
        trees.append(nodes)
    compact = {
        "v": 1,
        "objective": "lambdarank",
        "num_trees": len(trees),
        "feature_names": FEATURE_NAMES,
        "trees": trees,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(compact, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    print(f"[train] wrote {OUT}  ({size_kb:.0f} KB · {len(trees)} trees)")

    # Quick top-5 NDCG report on test set, using our exported model.
    ndcg_at = {3: [], 5: [], 8: []}
    for rec in test_records:
        X = np.asarray([featurize(rec["text"], c, chunks) for c in rec["candidates"]], dtype=np.float32)
        scores = booster.predict(X)
        order = np.argsort(-scores)
        sorted_rels = [rec["labels"][i] for i in order]
        ideal_rels = sorted(rec["labels"], reverse=True)
        for k in (3, 5, 8):
            ndcg_at[k].append(ndcg(sorted_rels, ideal_rels, k))
    for k in (3, 5, 8):
        vals = ndcg_at[k]
        print(f"[eval]  NDCG@{k}  reranker = {np.mean(vals):.4f}  (over {len(vals)} test queries)")

    # Compare against RRF baseline on the same test set.
    rrf_ndcg = {3: [], 5: [], 8: []}
    for rec in test_records:
        # candidates are already in RRF order from build_labeling_pack
        baseline_rels = [l for l in rec["labels"]]
        ideal_rels = sorted(rec["labels"], reverse=True)
        for k in (3, 5, 8):
            rrf_ndcg[k].append(ndcg(baseline_rels, ideal_rels, k))
    for k in (3, 5, 8):
        vals = rrf_ndcg[k]
        print(f"[eval]  NDCG@{k}  RRF base  = {np.mean(vals):.4f}  (over {len(vals)} test queries)")


def flatten_tree(node, out, default_left=True):
    """Convert LightGBM's nested tree dict into a flat node array.

    Each node is one of:
      [feat, threshold, left_idx, right_idx, default_left]   (split node)
      [-1,   leaf_value, 0, 0, 0]                            (leaf)
    Indices reference positions in `out`.
    """
    if "leaf_value" in node:
        out.append([-1, float(node["leaf_value"]), 0, 0, 0])
        return len(out) - 1
    idx = len(out)
    out.append(None)  # placeholder
    feat = node["split_feature"]
    thresh = float(node["threshold"])
    default_left_flag = 1 if node.get("default_left", True) else 0
    left_idx = flatten_tree(node["left_child"], out)
    right_idx = flatten_tree(node["right_child"], out)
    out[idx] = [int(feat), thresh, left_idx, right_idx, default_left_flag]
    return idx


def ndcg(rels, ideal, k):
    def dcg(r):
        return sum((2 ** rel - 1) / np.log2(i + 2) for i, rel in enumerate(r[:k]))
    idcg = dcg(ideal)
    return dcg(rels) / idcg if idcg else 0.0


if __name__ == "__main__":
    main()
