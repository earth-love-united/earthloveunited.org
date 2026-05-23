#!/usr/bin/env python3
"""
build_labeling_pack.py — Stage 1 of the reranker pipeline.

Builds a JSON "labeling pack" that owl (or any judge) can score directly:

  {
    "queries": [
      {
        "qid": 1,
        "text": "How does permafrost thaw amplify warming?",
        "kind": "causal",
        "candidates": [
          { "doc_id": 1142, "title": "Permafrost", "source": "Wikipedia",
            "snippet": "Permafrost is ground that ..." , "bm25_rank": 1,
            "dense_rank": 3, "rrf_score": 0.0312 },
          ...
        ]
      },
      ...
    ]
  }

The questions are generated deterministically from a few question-type
templates filled in over the actual chunk taxonomy in our corpus — so the
distribution matches what real climate-curious users tend to ask.
"""

import json
import random
import re
import struct
from pathlib import Path
from collections import Counter, defaultdict

import numpy as np

ROOT = Path(__file__).parent.parent
IDX_PATH = ROOT / "dist" / "knowledge" / "index.json"
EMB_BIN = ROOT / "dist" / "knowledge" / "embeddings.bin"
EMB_META = ROOT / "dist" / "knowledge" / "embeddings.meta.json"
PLEDGES_PATH = ROOT / "dist" / "knowledge" / "pledges.json"
OUT_DIR = ROOT / "dist" / "labels"
OUT = OUT_DIR / "labeling_pack.json"

random.seed(42)


# ─── Tokenizer (mirror of build_embeddings.py) ───────────────────────
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


def stem(t):
    if len(t) <= 4:
        return t
    for s in ("ization","izations","ational","iveness","fulness","ousness","ically","ation","ations","ments","ment","ness","tion","ence","ance","able","ible"):
        if t.endswith(s) and len(t)-len(s) >= 4: return t[:-len(s)]
    if t.endswith("ings") and len(t) >= 7: return t[:-4]
    if t.endswith("ies") and len(t) >= 6: return t[:-3]+"y"
    if t.endswith("ied") and len(t) >= 6: return t[:-3]
    for s in ("ing","ers","er","ed","es","s"):
        if t.endswith(s) and len(t)-len(s) >= 4: return t[:-len(s)]
    return t


def tokenize(text):
    if not text: return []
    return [stem(w.lower()) for w in WORD_RE.findall(text) if len(w) >= 3 and w.lower() not in STOP]


# ─── BM25 (mirror of build_retrieval_index.py / gaia-retrieval.js) ──
K1, B = 1.5, 0.75
SOURCE_BOOST = {
    "ipcc": ("I", 1.6), "ar6": ("I", 1.6), "sr15": ("I", 1.6),
    "drawdown": ("D", 1.8),
    "epa": ("E", 1.6),
}


def source_boosts(query):
    boosts = {}
    ql = query.lower()
    for keyword, (code, mult) in SOURCE_BOOST.items():
        if re.search(rf"\b{re.escape(keyword)}\b", ql):
            boosts[code] = mult
    return boosts


def bm25_search(query, index, k=32):
    toks = tokenize(query)
    if not toks: return []
    N = index["n"]; avgdl = index["avgdl"]
    scores = defaultdict(float)
    qtf = Counter(toks)
    boosts = source_boosts(query)
    for term, qt in qtf.items():
        df = index["df"].get(term)
        if not df: continue
        postings = index["post"].get(term, [])
        idf = np.log((N - df + 0.5) / (df + 0.5) + 1)
        for doc_idx, tf in postings:
            chunk = index["chunks"][doc_idx]
            dl = chunk.get("l", avgdl)
            denom = tf + K1 * (1 - B + B * (dl / avgdl))
            s = idf * ((tf * (K1 + 1)) / denom) * qt
            mult = boosts.get(chunk["s"], 1.0)
            scores[doc_idx] += s * mult
    sorted_hits = sorted(scores.items(), key=lambda x: -x[1])[:k]
    return [(i, float(s)) for i, s in sorted_hits]


# ─── LSA dense search (mirror of gaia-embeddings.js) ────────────────
def load_embeddings():
    raw = EMB_BIN.read_bytes()
    if raw[:4] != b"GAIA":
        raise SystemExit("embeddings.bin: bad magic")
    version, n, v, dim = struct.unpack_from("<IIII", raw, 4)
    off = 20
    doc_scales = np.frombuffer(raw, dtype=np.float32, count=n, offset=off); off += n * 4
    doc_embs = np.frombuffer(raw, dtype=np.int8, count=n * dim, offset=off).reshape(n, dim); off += n * dim
    term_scales = np.frombuffer(raw, dtype=np.float32, count=v, offset=off); off += v * 4
    term_embs = np.frombuffer(raw, dtype=np.int8, count=v * dim, offset=off).reshape(v, dim); off += v * dim
    meta = json.loads(EMB_META.read_text())
    vocab_idx = {t: i for i, t in enumerate(meta["vocab"])}
    idf = np.asarray(meta["idf"], dtype=np.float32)
    return {
        "n": n, "v": v, "dim": dim,
        "doc_scales": doc_scales, "doc_embs": doc_embs,
        "term_scales": term_scales, "term_embs": term_embs,
        "vocab_idx": vocab_idx, "idf": idf,
    }


def embed_query(query, emb):
    toks = tokenize(query)
    if not toks: return None
    tf = Counter(toks)
    entries = []
    norm2 = 0.0
    for term, n_tf in tf.items():
        j = emb["vocab_idx"].get(term)
        if j is None: continue
        w = (1 + np.log(n_tf)) * emb["idf"][j]
        entries.append((j, w))
        norm2 += w * w
    if not entries: return None
    norm = np.sqrt(norm2) if norm2 > 0 else 1
    out = np.zeros(emb["dim"], dtype=np.float32)
    for j, w in entries:
        ws = (w / norm) * emb["term_scales"][j]
        out += ws * emb["term_embs"][j].astype(np.float32)
    qn = float(np.linalg.norm(out))
    if qn > 0: out /= qn
    return out


def dense_search(query, emb, k=32):
    q = embed_query(query, emb)
    if q is None: return []
    # int8 docs × float32 query — dot product gives cosine since both pre-normalized
    scores = (emb["doc_embs"].astype(np.float32) @ q) * emb["doc_scales"]
    top = np.argsort(-scores)[:k]
    return [(int(i), float(scores[i])) for i in top]


# ─── Hybrid via RRF ─────────────────────────────────────────────────
RRF_K = 60
def hybrid(query, index, emb, k=20):
    bm = bm25_search(query, index, k=max(k * 2, 32))
    de = dense_search(query, emb, k=max(k * 2, 32))
    fused = {}
    bm_rank = {i: r + 1 for r, (i, _) in enumerate(bm)}
    bm_score = {i: s for i, s in bm}
    de_rank = {i: r + 1 for r, (i, _) in enumerate(de)}
    de_score = {i: s for i, s in de}
    for r, (i, s) in enumerate(bm):
        fused[i] = fused.get(i, 0) + 1 / (RRF_K + r + 1)
    for r, (i, s) in enumerate(de):
        fused[i] = fused.get(i, 0) + 1 / (RRF_K + r + 1)
    ranked = sorted(fused.items(), key=lambda x: -x[1])[:k]
    out = []
    for doc_id, rrf in ranked:
        out.append({
            "doc_id": doc_id,
            "rrf_score": round(rrf, 5),
            "bm25_rank": bm_rank.get(doc_id),
            "bm25_score": round(bm_score.get(doc_id, 0.0), 4),
            "dense_rank": de_rank.get(doc_id),
            "dense_score": round(de_score.get(doc_id, 0.0), 4),
        })
    return out


# ─── Question generator ─────────────────────────────────────────────
# Strategy: generate ~300 diverse questions by combining question
# templates with seeds drawn from our actual chunk taxonomy.
def make_questions(index, pledges):
    questions = []
    chunks = index["chunks"]

    # ── Pool 1: titles directly. Real users sometimes search this way.
    title_pool = list({c["t"] for c in chunks if c["t"] and len(c["t"]) > 3 and not c["t"].startswith("AR6")})
    random.shuffle(title_pool)
    for t in title_pool[:50]:
        questions.append({"text": t, "kind": "title-direct"})

    # ── Pool 2: simple "what is X" / "tell me about X" wrappers
    concept_seeds = [
        "permafrost", "tipping points", "AMOC", "sea level rise",
        "carbon cycle", "ocean acidification", "albedo feedback",
        "methane emissions", "fossil fuels", "biochar",
        "agroforestry", "afforestation", "mangrove", "peatland",
        "coral bleaching", "ice sheets", "monsoon", "drought",
        "wildfire", "renewable energy", "carbon capture", "direct air capture",
        "electric vehicles", "heat pumps", "wind power", "solar power",
        "nuclear power", "geothermal", "energy storage", "smart grid",
        "regenerative agriculture", "plant-rich diet", "food waste",
        "circular economy", "high-speed rail", "shipping emissions",
        "aviation emissions", "concrete emissions", "steel emissions",
        "Younger Dryas", "Holocene", "Pliocene", "ice age",
        "carbon budget", "climate sensitivity", "radiative forcing",
        "NDC", "Paris Agreement", "IPCC AR6", "Project Drawdown",
    ]
    wrappers = [
        "what is {x}", "tell me about {x}", "explain {x}",
        "how does {x} work", "what causes {x}", "why does {x} matter",
        "what are the impacts of {x}", "how do we solve {x}",
        "is {x} reversible", "how serious is {x}",
        "what's the latest on {x}", "what does the science say about {x}",
    ]
    for c in concept_seeds:
        for w in random.sample(wrappers, k=2):
            questions.append({"text": w.format(x=c), "kind": "concept"})

    # ── Pool 3: paraphrased / colloquial queries (the LSA wins)
    paraphrases = [
        "thawing tundra",
        "frozen ground melting under warming",
        "ocean current weakening in the north atlantic",
        "rising waters along coastlines threatening cities",
        "trees grown together with crops in fields",
        "carbon-eating plants in tropical zones",
        "cars that run on electricity instead of gasoline",
        "what happens when the amazon dies",
        "is it too late to fix the climate",
        "earth getting hotter every year",
        "polar bears losing their home",
        "why are storms getting stronger",
        "how warm was it during the last ice age",
        "the great barrier reef is dying",
        "what countries are doing the most damage",
        "who is responsible for climate change",
        "best ways to remove carbon from the atmosphere",
        "the world's lungs are burning",
        "what's the deal with green hydrogen",
        "is methane worse than co2",
        "i'm scared about climate change what can i do",
        "small things i can do to help the planet",
        "is the climate really getting worse or is it hype",
        "can we reverse climate change",
        "100 years from now what will earth look like",
    ]
    for p in paraphrases:
        questions.append({"text": p, "kind": "paraphrase"})

    # ── Pool 4: country pledges (structured)
    country_seeds = ["Turkey", "Brazil", "Indonesia", "Germany",
                     "India", "China", "United States", "Japan",
                     "Saudi Arabia", "Russia", "France", "Australia",
                     "Canada", "Mexico", "Argentina", "Egypt",
                     "Nigeria", "South Africa", "United Kingdom",
                     "Sri Lanka", "Benin"]
    country_templates = [
        "what did {x} pledge under the paris agreement",
        "how are {x}'s emissions trending",
        "is {x} on track to meet its climate goals",
        "{x} climate policy",
    ]
    for c in country_seeds:
        for t in random.sample(country_templates, k=2):
            questions.append({"text": t.format(x=c), "kind": "country"})

    # ── Pool 5: source-explicit queries
    source_queries = [
        "what does the ipcc say about 1.5 degrees",
        "ipcc ar6 conclusions",
        "drawdown's most recommended solutions",
        "project drawdown ranking of climate solutions",
        "epa data on us emissions",
        "wikipedia summary of the carbon cycle",
        "ipcc tipping points",
        "drawdown solutions for electricity sector",
        "drawdown solutions for transportation",
        "drawdown solutions for food and agriculture",
    ]
    for q in source_queries:
        questions.append({"text": q, "kind": "source-explicit"})

    # ── Pool 6: paleoclimate
    paleo = [
        "what was co2 during the younger dryas",
        "how warm was earth in the pliocene",
        "sea level at the last glacial maximum",
        "co2 levels 800000 years ago",
        "temperature in the holocene",
        "ice age co2 levels",
    ]
    for q in paleo:
        questions.append({"text": q, "kind": "paleo"})

    # ── Pool 7: comparative
    comparatives = [
        "what's worse for the climate, coal or oil",
        "mangroves vs rainforest carbon storage",
        "wind power versus solar power",
        "electric vehicles versus public transit",
        "direct air capture or planting trees",
    ]
    for q in comparatives:
        questions.append({"text": q, "kind": "comparative"})

    # Deduplicate
    seen = set()
    deduped = []
    for q in questions:
        key = q["text"].lower().strip()
        if key in seen: continue
        seen.add(key)
        deduped.append(q)
    # Assign qids
    for i, q in enumerate(deduped):
        q["qid"] = i + 1
    return deduped


def snippet_of(text, n=240):
    if not text: return ""
    s = " ".join(text.split())[:n]
    return s


def main():
    if not IDX_PATH.exists() or not EMB_BIN.exists():
        raise SystemExit("indexes missing — run build_retrieval_index.py and build_embeddings.py first")
    index = json.loads(IDX_PATH.read_text())
    emb = load_embeddings()
    pledges = json.loads(PLEDGES_PATH.read_text()) if PLEDGES_PATH.exists() else None

    questions = make_questions(index, pledges)
    print(f"[label-pack] {len(questions)} unique questions across kinds:")
    by_kind = Counter(q["kind"] for q in questions)
    for k, v in by_kind.most_common():
        print(f"   {k:<16} {v}")

    out_queries = []
    for q in questions:
        cands = hybrid(q["text"], index, emb, k=20)
        cand_records = []
        for c in cands:
            doc = index["chunks"][c["doc_id"]]
            cand_records.append({
                "doc_id": c["doc_id"],
                "title": doc["t"],
                "source": index["src"].get(doc["s"], doc["s"]),
                "url": doc.get("u") or None,
                "snippet": snippet_of(doc.get("x", ""), 280),
                "topics": doc.get("p") or [],
                "bm25_rank": c["bm25_rank"],
                "bm25_score": c["bm25_score"],
                "dense_rank": c["dense_rank"],
                "dense_score": c["dense_score"],
                "rrf_score": c["rrf_score"],
            })
        out_queries.append({
            "qid": q["qid"],
            "text": q["text"],
            "kind": q["kind"],
            "candidates": cand_records,
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pack = {
        "v": 1,
        "schema": {
            "queries[].qid": "stable integer id per question",
            "queries[].text": "the question text",
            "queries[].kind": "question category (title-direct, concept, paraphrase, country, source-explicit, paleo, comparative)",
            "queries[].candidates[].doc_id": "integer index into the retrieval index",
            "queries[].candidates[]": "20 retrieved candidates, ordered by RRF",
        },
        "total_queries": len(out_queries),
        "candidates_per_query": 20,
        "queries": out_queries,
    }
    OUT.write_text(json.dumps(pack, ensure_ascii=False, indent=2))
    mb = OUT.stat().st_size / 1024 / 1024
    print(f"[label-pack] wrote {OUT} ({mb:.2f} MB)")
    print(f"[label-pack] {len(out_queries)} queries × 20 candidates = {len(out_queries) * 20} pairs to label")


if __name__ == "__main__":
    main()
