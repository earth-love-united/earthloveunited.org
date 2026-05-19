#!/usr/bin/env python3
"""
build_retrieval_index.py — BM25 retrieval index for GAIA v5

Reads:   data/climate-knowledge-curated.jsonl  (2,840 chunks, ~2.3 MB raw)
Writes:  dist/knowledge/index.json.gz          (~1.3 MB gzipped)

The output JSON is consumed by js/gaia-retrieval.js in the browser.
No external libraries — pure Python stdlib so this script runs anywhere.

Schema (compact, keys minimised because we ship this to clients):
{
  "v": 3,                          # schema version
  "n": 2840,                       # total chunks
  "avgdl": 87.4,                   # average document length in tokens
  "src": { "W":"Wikipedia", ... }, # source code → human name
  "chunks": [                      # i-th chunk
    { "t":"title", "s":"W", "u":"url", "x":"full text", "p":["topic1","topic2"], "l":78 }
    ...                            # l = doc length in tokens (cached for BM25)
  ],
  "df": { "carbon": 412, ... },                          # document frequency per term
  "post": { "carbon": [[12,3],[55,1],...], ... }         # postings: [chunk_idx, term_freq]
}
"""

import json
import re
import gzip
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(__file__).parent.parent
SRC = ROOT / "data" / "climate-knowledge-curated.jsonl"
OUT_DIR = ROOT / "dist" / "knowledge"
OUT_FILE = OUT_DIR / "index.json.gz"

SOURCE_CODES = {
    "Wikipedia": "W",
    "Project Drawdown": "D",
    "IPCC": "I",
    "US EPA": "E",
    "arXiv": "A",
    "Earth Love United": "U",
}

# Compact stopword list — common English noise.
STOP = {
    "a","an","the","and","or","but","if","of","at","by","for","with","about",
    "to","in","on","is","are","was","were","be","been","being","am","do","does",
    "did","has","have","had","this","that","these","those","it","its","they",
    "them","their","there","here","then","than","so","such","as","also","just",
    "from","into","onto","over","under","up","down","out","off","not","no","nor",
    "very","more","most","much","many","some","any","all","each","every","other",
    "another","one","two","three","first","second","new","old","high","low",
    "i","you","he","she","we","us","my","your","our","his","her","whom","what",
    "which","who","whose","when","where","why","how","because","while","although",
    "however","therefore","thus","hence","yet","still","already","even","ever",
    "would","could","should","may","might","must","can","shall","will",
    "go","goes","going","gone","get","got","gets","getting",
    "make","makes","made","making","take","takes","took","taking","taken",
    "say","says","said","saying","know","knows","known","knew","knowing",
    "see","sees","saw","seen","seeing","look","looks","looked","looking",
    "use","uses","used","using","find","finds","found","finding",
    "give","gives","gave","given","giving","tell","tells","told","telling",
    "well","back","also","now","just","like","than",
}

WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9]+")


def stem(tok: str) -> str:
    """Porter-lite: strip a few common English suffixes. Conservative on purpose —
    we want recall improvement without over-merging unrelated terms."""
    if len(tok) <= 4:
        return tok
    for suf in ("ization", "izations", "ational", "iveness", "fulness",
                "ousness", "ically", "ation", "ations", "ments", "ment",
                "ness", "tion", "ence", "ance", "able", "ible"):
        if tok.endswith(suf) and len(tok) - len(suf) >= 4:
            return tok[: -len(suf)]
    for suf in ("ings", "ies", "ied"):
        if tok.endswith(suf) and len(tok) - len(suf) >= 4:
            return tok[: -len(suf)] + ("y" if suf == "ies" else "")
    for suf in ("ing", "ers", "er", "ed", "es", "s"):
        if tok.endswith(suf) and len(tok) - len(suf) >= 4:
            return tok[: -len(suf)]
    return tok


def tokenize(text: str):
    out = []
    for m in WORD_RE.findall(text or ""):
        t = m.lower()
        if len(t) < 3 or t in STOP:
            continue
        out.append(stem(t))
    return out


def build():
    if not SRC.exists():
        raise SystemExit(f"missing source: {SRC}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    raw_chunks = []
    with SRC.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                raw_chunks.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    print(f"[build] loaded {len(raw_chunks)} raw chunks from {SRC}")

    chunks = []
    df = Counter()                  # document frequency
    post = defaultdict(list)        # term → [(chunk_idx, term_freq), ...]
    dl_total = 0

    for i, c in enumerate(raw_chunks):
        title = (c.get("title") or "").strip()
        text = (c.get("text") or "").strip()
        source = SOURCE_CODES.get(c.get("source", ""), "X")
        url = (c.get("url") or "").strip()
        topics = [t for t in (c.get("topics") or []) if t and len(t) < 60][:5]

        body_tokens = tokenize(text)
        title_tokens = tokenize(title)
        topic_tokens = []
        for t in topics:
            topic_tokens.extend(tokenize(t))

        # Title + topic terms get a 2× boost in the term-frequency vector.
        # Implemented by injecting them twice extra (effective TF *= 3 if also in body).
        all_tokens = body_tokens + title_tokens + title_tokens + topic_tokens + topic_tokens

        tf = Counter(all_tokens)
        dl = len(body_tokens)        # doc length uses body only for BM25 length norm
        dl_total += dl

        chunks.append({
            "t": title[:160],
            "s": source,
            "u": url,
            "x": text,
            "p": topics,
            "l": dl,
        })

        for term, freq in tf.items():
            df[term] += 1
            post[term].append([i, freq])

    n = len(chunks)
    avgdl = round(dl_total / max(n, 1), 2)

    # Filter terms: keep those that appear in 2..70% of docs. This drops typos
    # and ultra-common boilerplate that BM25's IDF would still partially flag.
    max_df = int(n * 0.70)
    pruned_post = {}
    pruned_df = {}
    for term, postings in post.items():
        d = df[term]
        if d < 2 or d > max_df:
            continue
        pruned_post[term] = postings
        pruned_df[term] = d

    print(f"[build] chunks: {n}  avgdl: {avgdl}  unique terms (kept): {len(pruned_post)}  (dropped {len(post)-len(pruned_post)})")

    src_label = {v: k for k, v in SOURCE_CODES.items()}
    out = {
        "v": 3,
        "n": n,
        "avgdl": avgdl,
        "src": src_label,
        "chunks": chunks,
        "df": pruned_df,
        "post": pruned_post,
    }

    raw_bytes = json.dumps(out, separators=(",", ":")).encode("utf-8")
    with gzip.open(OUT_FILE, "wb", compresslevel=9) as f:
        f.write(raw_bytes)

    raw_size_mb = len(raw_bytes) / 1024 / 1024
    gz_size_mb = OUT_FILE.stat().st_size / 1024 / 1024
    print(f"[build] wrote {OUT_FILE}")
    print(f"[build] raw: {raw_size_mb:.2f} MB   gzipped: {gz_size_mb:.2f} MB")

    # Also write an uncompressed copy alongside for dev inspection / range queries
    OUT_FILE.with_suffix("").write_bytes(raw_bytes)
    print(f"[build] wrote {OUT_FILE.with_suffix('')} (uncompressed for dev)")

    # Source distribution sanity check
    src_counts = Counter(c["s"] for c in chunks)
    print("[build] source distribution:")
    for code, cnt in src_counts.most_common():
        print(f"        {src_label.get(code, code):<20} {cnt}")


if __name__ == "__main__":
    build()
