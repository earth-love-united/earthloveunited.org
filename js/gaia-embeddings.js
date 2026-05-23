/**
 * GAIA EMBEDDINGS — LSA dense retrieval over the curated climate corpus.
 *
 * Loads two artefacts (built by dis/build_embeddings.py):
 *   /dist/knowledge/embeddings.bin        ~1 MB packed int8 + scales
 *   /dist/knowledge/embeddings.meta.json   ~90 KB vocab + IDF
 *
 * Provides semantic search via Latent Semantic Analysis (TF-IDF + SVD
 * trained on this exact corpus). Works in pure JS, no neural model
 * downloads, sub-50ms per query after the one-time ~1 MB load.
 *
 * Public surface (attached to window.GaiaEmbeddings):
 *   GaiaEmbeddings.load()                  → start loading (idempotent)
 *   await GaiaEmbeddings.ready()           → resolves when search is usable
 *   GaiaEmbeddings.searchDense(q, k=8)     → [{ id, score, ... }]
 *   GaiaEmbeddings.embedQuery(q)           → Float32Array(dim) | null
 *   GaiaEmbeddings.status                  → { loaded, n, vocab_count, dim }
 *
 * Designed to compose with GaiaRetrieval (BM25). The fusion glue lives
 * in gaia-retrieval.js, which falls back to BM25-only if embeddings
 * haven't loaded yet.
 */

window.GaiaEmbeddings = (function () {
  let _loaded = false;
  let _loading = null;

  // Binary tables (typed arrays for fast math)
  let _docScales = null;        // Float32Array(N)
  let _docEmbs = null;          // Int8Array(N * K)
  let _termScales = null;       // Float32Array(V)
  let _termEmbs = null;         // Int8Array(V * K)

  // Metadata
  let _n = 0, _v = 0, _dim = 0;
  let _vocabIndex = null;       // Map<string, number>
  let _idf = null;              // Float32Array(V)
  let _meta = null;

  // ─── Tokenizer (must match build_embeddings.py / gaia-retrieval.js) ─
  const STOP = new Set((
    "a an the and or but if of at by for with about to in on is are was were " +
    "be been being am do does did has have had this that these those it its " +
    "they them their there here then than so such as also just from into onto " +
    "over under up down out off not no nor very more most much many some any " +
    "all each every other another one two three first second new old high low " +
    "i you he she we us my your our his her whom what which who whose when " +
    "where why how because while although however therefore thus hence yet " +
    "still already even ever would could should may might must can shall will " +
    "go goes going gone get got gets getting make makes made making take takes " +
    "took taking taken say says said saying know knows known knew knowing " +
    "see sees saw seen seeing look looks looked looking use uses used using " +
    "find finds found finding give gives gave given giving tell tells told " +
    "telling well back also now just like than"
  ).split(/\s+/));
  const WORD_RE = /[A-Za-z][A-Za-z0-9]+/g;

  function stem(t) {
    if (t.length <= 4) return t;
    for (const s of ["ization","izations","ational","iveness","fulness","ousness","ically","ation","ations","ments","ment","ness","tion","ence","ance","able","ible"]) {
      if (t.endsWith(s) && t.length - s.length >= 4) return t.slice(0, -s.length);
    }
    if (t.endsWith("ings") && t.length >= 7) return t.slice(0, -4);
    if (t.endsWith("ies") && t.length >= 6) return t.slice(0, -3) + "y";
    if (t.endsWith("ied") && t.length >= 6) return t.slice(0, -3);
    for (const s of ["ing","ers","er","ed","es","s"]) {
      if (t.endsWith(s) && t.length - s.length >= 4) return t.slice(0, -s.length);
    }
    return t;
  }

  function tokenize(text) {
    if (!text) return [];
    const out = [];
    const ms = text.match(WORD_RE);
    if (!ms) return out;
    for (const w of ms) {
      const lc = w.toLowerCase();
      if (lc.length < 3 || STOP.has(lc)) continue;
      out.push(stem(lc));
    }
    return out;
  }

  // ─── Binary loader ──────────────────────────────────────────────
  // Layout (little-endian):
  //   magic         char[4]   "GAIA"
  //   version       u32       1
  //   doc_count     u32       N
  //   vocab_count   u32       V
  //   dim           u32       K
  //   doc_scales    f32[N]
  //   doc_embs      i8[N*K]
  //   term_scales   f32[V]
  //   term_embs     i8[V*K]
  async function _loadBinary() {
    const r = await fetch("/dist/knowledge/embeddings.bin", { cache: "force-cache" });
    if (!r.ok) throw new Error(`embeddings.bin → ${r.status}`);
    const buf = await r.arrayBuffer();
    const dv = new DataView(buf);
    const magic = String.fromCharCode(
      dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)
    );
    if (magic !== "GAIA") throw new Error("embeddings.bin: bad magic");
    const version = dv.getUint32(4, true);
    if (version !== 1) throw new Error("embeddings.bin: version mismatch");
    _n = dv.getUint32(8, true);
    _v = dv.getUint32(12, true);
    _dim = dv.getUint32(16, true);

    let off = 20;
    _docScales = new Float32Array(buf, off, _n);   off += _n * 4;
    _docEmbs   = new Int8Array(buf, off, _n * _dim); off += _n * _dim;
    _termScales = new Float32Array(buf, off, _v);  off += _v * 4;
    _termEmbs   = new Int8Array(buf, off, _v * _dim); off += _v * _dim;

    if (off !== buf.byteLength) {
      console.warn(
        `[GaiaEmbeddings] binary tail mismatch: parsed ${off} of ${buf.byteLength} bytes`
      );
    }
  }

  async function _loadMeta() {
    const r = await fetch("/dist/knowledge/embeddings.meta.json", { cache: "force-cache" });
    if (!r.ok) throw new Error(`embeddings.meta.json → ${r.status}`);
    _meta = await r.json();
    const vocab = _meta.vocab;
    _vocabIndex = new Map();
    for (let i = 0; i < vocab.length; i++) _vocabIndex.set(vocab[i], i);
    _idf = Float32Array.from(_meta.idf);
  }

  function load() {
    if (_loading) return _loading;
    _loading = (async () => {
      const t0 = performance.now();
      try {
        await Promise.all([_loadBinary(), _loadMeta()]);
        if (_meta.dim !== _dim || _meta.n !== _n || _meta.vocab_count !== _v) {
          throw new Error(
            `embedding meta/binary shape mismatch: meta(n=${_meta.n}, v=${_meta.vocab_count}, dim=${_meta.dim}) vs bin(n=${_n}, v=${_v}, dim=${_dim})`
          );
        }
        _loaded = true;
        const ms = (performance.now() - t0).toFixed(0);
        console.log(
          `[GaiaEmbeddings] loaded N=${_n} V=${_v} dim=${_dim}  explained=${_meta.explained_variance_ratio}  in ${ms}ms`
        );
      } catch (e) {
        console.warn("[GaiaEmbeddings] load failed:", e.message);
        _loaded = false;
      }
      return _loaded;
    })();
    return _loading;
  }

  function ready() { return _loading || load(); }

  // ─── Query embedding ────────────────────────────────────────────
  // 1. tokenize → term frequencies
  // 2. build sparse TF-IDF vector (sublinear TF: 1 + ln(tf))
  // 3. L2-normalise
  // 4. project to dim via Σ_{term} tfidf[term] * V[term]   (V is term_embs)
  // 5. L2-normalise the projection
  function embedQuery(query) {
    if (!_loaded) return null;
    const tokens = tokenize(query);
    if (tokens.length === 0) return null;

    const tfMap = new Map();
    for (const t of tokens) tfMap.set(t, (tfMap.get(t) || 0) + 1);

    // Build sparse representation, also compute its L2 norm.
    const entries = [];
    let norm2 = 0;
    for (const [term, tf] of tfMap) {
      const j = _vocabIndex.get(term);
      if (j === undefined) continue;
      const w = (1 + Math.log(tf)) * _idf[j];
      entries.push([j, w]);
      norm2 += w * w;
    }
    if (entries.length === 0) return null;

    const norm = Math.sqrt(norm2) || 1;
    const out = new Float32Array(_dim);
    // q_emb = sum_j (tfidf_j / norm) * V[j]  where V[j] is the term-embedding row.
    // V[j] is stored quantized (int8) with a per-row scale. Reconstruct on the fly.
    for (const [j, w] of entries) {
      const ws = (w / norm) * _termScales[j];
      const base = j * _dim;
      for (let d = 0; d < _dim; d++) {
        out[d] += ws * _termEmbs[base + d];
      }
    }
    // L2 normalise the projected vector.
    let qn = 0;
    for (let d = 0; d < _dim; d++) qn += out[d] * out[d];
    qn = Math.sqrt(qn);
    if (qn > 0) {
      for (let d = 0; d < _dim; d++) out[d] /= qn;
    }
    return out;
  }

  // ─── Dense search ───────────────────────────────────────────────
  // For each doc i: score = Σ_d (docScales[i] * docEmbs[i*K + d]) * queryEmb[d]
  // Factoring out docScales[i] keeps the hot loop in int8 land.
  function searchDense(query, k = 8) {
    if (!_loaded) return [];
    const q = embedQuery(query);
    if (!q) return [];
    const scores = new Float32Array(_n);
    const K = _dim;
    for (let i = 0; i < _n; i++) {
      const base = i * K;
      let acc = 0;
      for (let d = 0; d < K; d++) {
        acc += _docEmbs[base + d] * q[d];
      }
      scores[i] = acc * _docScales[i];
    }
    // Top-k by score
    const indices = new Array(_n);
    for (let i = 0; i < _n; i++) indices[i] = i;
    indices.sort((a, b) => scores[b] - scores[a]);
    const out = [];
    for (let r = 0; r < Math.min(k, _n); r++) {
      const idx = indices[r];
      out.push({ id: idx, score: scores[idx] });
    }
    return out;
  }

  return {
    load,
    ready,
    embedQuery,
    searchDense,
    tokenize,
    get status() {
      return {
        loaded: _loaded,
        n: _n,
        vocab_count: _v,
        dim: _dim,
        explained: _meta ? _meta.explained_variance_ratio : null,
      };
    },
  };
})();

// Auto-load on idle. The chat path awaits ready() with a short timeout
// so the first message can still go out under BM25-only if needed.
if (typeof window !== "undefined") {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => window.GaiaEmbeddings.load(), { timeout: 6000 });
  } else {
    setTimeout(() => window.GaiaEmbeddings.load(), 2200);
  }
}
