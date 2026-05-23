#!/usr/bin/env python3
"""
build_embeddings.py — LSA embeddings over the curated climate corpus.

Pipeline:
  1. Tokenize every chunk with the exact same rules as js/gaia-retrieval.js
     (lower-cased, alphanumeric, stop-word filtered, light Porter-lite stem).
     Title and topic tokens get a 2× weight (injected twice extra), mirroring
     the BM25 build so semantic and lexical retrieval share vocabulary.
  2. Build a sublinear-TF / inverse-doc-frequency TF-IDF matrix.
  3. Run TruncatedSVD with k=128 — Latent Semantic Analysis. This learns
     concept vectors purely from co-occurrence statistics in OUR corpus,
     so synonyms like "thawing tundra" / "permafrost" / "frozen ground"
     end up near each other in the 128-d space.
  4. Quantize:
       - doc_embs[N, k]  → int8 + per-row scale  (preserves relative geometry)
       - term_V[V, k]    → int8 + per-row scale  (used to project query at runtime)
  5. Write a binary blob (~1 MB) + JSON metadata.

Outputs:
  dist/knowledge/embeddings.bin        — packed int8 matrices + scales
  dist/knowledge/embeddings.meta.json  — vocab, IDF, schema version

A test routine at the bottom runs a few paraphrase queries against the
built index so we know the embeddings carry meaningful semantic structure
before we ship them to the browser.
"""

import json
import re
import struct
import sys
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD

ROOT = Path(__file__).parent.parent
SRC = ROOT / "data" / "climate-knowledge-curated.jsonl"
OUT_DIR = ROOT / "dist" / "knowledge"
BIN_PATH = OUT_DIR / "embeddings.bin"
META_PATH = OUT_DIR / "embeddings.meta.json"

K = 128                # SVD dimensions
MIN_DF = 2             # ignore terms appearing in fewer than 2 docs
MAX_DF = 0.7           # ignore terms appearing in more than 70% of docs

# ─── Tokenizer (exact mirror of js/gaia-retrieval.js) ───────────────
STOP = set((
    "a an the and or but if of at by for with about to in on is are was were "
    "be been being am do does did has have had this that these those it its "
    "they them their there here then than so such as also just from into onto "
    "over under up down out off not no nor very more most much many some any "
    "all each every other another one two three first second new old high low "
    "i you he she we us my your our his her whom what which who whose when "
    "where why how because while although however therefore thus hence yet "
    "still already even ever would could should may might must can shall will "
    "go goes going gone get got gets getting make makes made making take takes "
    "took taking taken say says said saying know knows known knew knowing "
    "see sees saw seen seeing look looks looked looking use uses used using "
    "find finds found finding give gives gave given giving tell tells told "
    "telling well back also now just like than"
).split())

WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9]+")


def stem(t: str) -> str:
    if len(t) <= 4:
        return t
    for s in ("ization", "izations", "ational", "iveness", "fulness",
              "ousness", "ically", "ation", "ations", "ments", "ment",
              "ness", "tion", "ence", "ance", "able", "ible"):
        if t.endswith(s) and len(t) - len(s) >= 4:
            return t[: -len(s)]
    if t.endswith("ings") and len(t) >= 7:
        return t[:-4]
    if t.endswith("ies") and len(t) >= 6:
        return t[:-3] + "y"
    if t.endswith("ied") and len(t) >= 6:
        return t[:-3]
    for s in ("ing", "ers", "er", "ed", "es", "s"):
        if t.endswith(s) and len(t) - len(s) >= 4:
            return t[: -len(s)]
    return t


def tokenize(text: str):
    if not text:
        return []
    return [
        stem(w.lower())
        for w in WORD_RE.findall(text)
        if len(w) >= 3 and w.lower() not in STOP
    ]


def chunk_doc(c: dict) -> str:
    body = tokenize(c.get("text", ""))
    title = tokenize(c.get("title", ""))
    topics = []
    for t in c.get("topics", []) or []:
        topics.extend(tokenize(t))
    # Title + topics injected twice extra ⇒ effective weight 3× when also
    # in body. Matches build_retrieval_index.py.
    return " ".join(body + title + title + topics + topics)


# ─── Quantization ────────────────────────────────────────────────────
def quantize_int8(X: np.ndarray):
    """Per-row int8 quantization. Returns (int8_matrix, scales_float32).

    Each row r is scaled by max(|r|) / 127 so that the row's max-magnitude
    value lands at ±127. This preserves the row's relative geometry and
    avoids losing information from rows with small magnitudes.
    """
    scales = np.max(np.abs(X), axis=1) / 127.0
    scales[scales == 0] = 1.0  # avoid divide-by-zero on zero rows
    q = np.clip(np.round(X / scales[:, None]), -127, 127).astype(np.int8)
    return q, scales.astype(np.float32)


def dequantize_int8(q: np.ndarray, scales: np.ndarray) -> np.ndarray:
    return q.astype(np.float32) * scales[:, None]


# ─── Build ───────────────────────────────────────────────────────────
def build():
    if not SRC.exists():
        raise SystemExit(f"missing {SRC}")

    chunks = []
    raw_chunks = []
    with SRC.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                c = json.loads(line)
            except json.JSONDecodeError:
                continue
            raw_chunks.append(c)
            chunks.append(chunk_doc(c))
    n = len(chunks)
    print(f"[embed] loaded {n} chunks")

    vec = TfidfVectorizer(
        token_pattern=r"\S+",   # we already pre-tokenized; just split on space
        min_df=MIN_DF,
        max_df=MAX_DF,
        sublinear_tf=True,      # 1 + log(tf), matches what BM25 morally does
        norm="l2",
    )
    X = vec.fit_transform(chunks)
    vocab = vec.get_feature_names_out()        # array of terms, in order
    idf = vec.idf_                              # float64
    print(f"[embed] tf-idf shape={X.shape} nnz={X.nnz}")

    # SVD: X ≈ U @ diag(S) @ V^T
    # svd.transform(X) returns U @ diag(S)  (n × k) — these are doc embeddings.
    # svd.components_ is V^T (k × vocab); we want V = svd.components_.T  (vocab × k)
    # so query embedding = q_tfidf @ V  (gives k-dim concept vector).
    svd = TruncatedSVD(n_components=K, random_state=42, n_iter=10)
    doc_embs = svd.fit_transform(X)            # (n, k) float32
    V = svd.components_.T                       # (vocab, k) float32
    explained = float(svd.explained_variance_ratio_.sum())
    print(f"[embed] svd k={K} explained_variance_ratio={explained:.3f}")

    # Pre-normalize doc embeddings so cosine sim is just a dot product at runtime.
    doc_norms = np.linalg.norm(doc_embs, axis=1, keepdims=True)
    doc_norms[doc_norms == 0] = 1.0
    doc_embs_n = doc_embs / doc_norms          # (n, k) unit vectors

    # Quantize
    doc_q, doc_scales = quantize_int8(doc_embs_n.astype(np.float32))
    term_q, term_scales = quantize_int8(V.astype(np.float32))

    # Reconstruction-quality check: how much info did int8 lose?
    doc_rec = dequantize_int8(doc_q, doc_scales)
    cos_self = np.einsum("ij,ij->i", doc_embs_n, doc_rec) / (
        np.linalg.norm(doc_embs_n, axis=1) * np.linalg.norm(doc_rec, axis=1) + 1e-9
    )
    print(f"[embed] int8 doc cosine self-similarity: mean={cos_self.mean():.4f} min={cos_self.min():.4f}")

    # ─── Binary layout ──────────────────────────────────────────────
    # Header:  magic(4) version(u32) doc_count(u32) vocab_count(u32) dim(u32)
    # Then:    doc_scales(float32×n)
    #          doc_embs(int8×n×k)
    #          term_scales(float32×V)
    #          term_embs(int8×V×k)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with BIN_PATH.open("wb") as f:
        f.write(b"GAIA")                                          # magic
        f.write(struct.pack("<IIII", 1, n, len(vocab), K))        # u32 LE
        f.write(doc_scales.tobytes())                             # n × 4 B
        f.write(doc_q.tobytes())                                  # n*k B
        f.write(term_scales.tobytes())                            # V × 4 B
        f.write(term_q.tobytes())                                 # V*k B

    bin_kb = BIN_PATH.stat().st_size / 1024
    print(f"[embed] wrote {BIN_PATH}  ({bin_kb:.0f} KB)")

    # Vocab + IDF as a JSON sidecar. Browser loads this once.
    # We round IDF to 4 decimals to keep the file small after gzip.
    meta = {
        "v": 1,
        "n": int(n),
        "vocab_count": int(len(vocab)),
        "dim": K,
        "explained_variance_ratio": round(explained, 4),
        "sublinear_tf": True,
        "tokenizer": "gaia-retrieval-stem-v1",
        # vocab is stored as an array; index in the array = term id, matching
        # the row order in term_scales / term_embs.
        "vocab": [str(t) for t in vocab.tolist()],
        "idf": [round(float(x), 4) for x in idf.tolist()],
    }
    META_PATH.write_text(json.dumps(meta, separators=(",", ":")))
    meta_kb = META_PATH.stat().st_size / 1024
    print(f"[embed] wrote {META_PATH}  ({meta_kb:.0f} KB)")

    # ─── Sanity: a few paraphrase searches in-Python ────────────────
    # Build a quick query embedder using the same V and IDF.
    vocab_to_idx = {t: i for i, t in enumerate(vocab)}

    def embed_query(q: str) -> np.ndarray:
        toks = tokenize(q)
        if not toks:
            return None
        # Sublinear TF
        from collections import Counter
        tf = Counter(toks)
        vec = np.zeros((len(vocab),), dtype=np.float32)
        any_hit = False
        for term, n_tf in tf.items():
            j = vocab_to_idx.get(term)
            if j is None:
                continue
            vec[j] = (1.0 + np.log(n_tf)) * idf[j]
            any_hit = True
        if not any_hit:
            return None
        # L2 normalize
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        q_emb = vec @ V                          # (k,)
        qn = np.linalg.norm(q_emb)
        if qn > 0:
            q_emb /= qn
        return q_emb

    def top_k(q: str, k: int = 5):
        qe = embed_query(q)
        if qe is None:
            return []
        sims = doc_embs_n @ qe
        order = np.argsort(-sims)[:k]
        return [(sims[i], raw_chunks[i]["title"], raw_chunks[i]["source"]) for i in order]

    print("\n[embed] paraphrase sanity check:")
    for q in [
        "thawing tundra",
        "frozen ground melting under warming",
        "vehicles powered by batteries",
        "trees grown together with crops in fields",
        "ocean currents weakening in the north atlantic",
        "rising sea levels along coastlines",
    ]:
        hits = top_k(q, 3)
        print(f"  q: {q!r}")
        for s, t, src in hits:
            print(f"     [{s:.3f}]  {src:<20}  {t}")


if __name__ == "__main__":
    build()
