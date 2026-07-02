/**
 * GAIA RERANKER — gradient-boosted decision-tree ranker that reorders
 * candidates produced by searchHybrid (BM25 + LSA).
 *
 * Model: LambdaRank LightGBM, exported to flat-node JSON by
 *        dis/train_reranker.py. ~20 KB, ~10-50 trees, depth ≤ 6.
 *
 * At runtime:
 *   1. Load reranker.json (lazy, on idle).
 *   2. For each candidate, compute the same 16 features the trainer used.
 *   3. Sum leaf values across all trees → relevance score.
 *   4. Reorder candidates by descending score.
 *
 * Public surface (attached to window.GaiaReranker):
 *   await GaiaReranker.ready()
 *   GaiaReranker.rerank(queryText, candidates) → reordered candidates
 *   GaiaReranker.featurize(queryText, candidate) → Float32Array (for tests)
 *   GaiaReranker.status → { loaded, trees, features }
 *
 * Falls back to identity (input ordering preserved) if model isn't loaded.
 */

window.GaiaReranker = (function () {

  MODULE_CONTRACTS.register('GaiaReranker', {
    provides: ['load', 'rerank', 'getStatus', 'init', 'reset', 'destroy', 'getState'],
    requires: [],
  });
  let _model = null;
  let _loaded = false;
  let _loading = null;

  async function load() {
    if (_loading) return _loading;
    _loading = (async () => {
      try {
        const r = await fetch("/dist/knowledge/reranker.json", { cache: "force-cache" });
        if (!r.ok) throw new Error(`reranker.json → ${r.status}`);
        const m = await r.json();
        if (!m.trees || !m.feature_names) {
          throw new Error("reranker.json: missing trees or feature_names");
        }
        _model = m;
        _loaded = true;
        console.log(`[GaiaReranker] loaded ${m.trees.length} trees · features=${m.feature_names.length}`);
      } catch (e) {
        console.warn("[GaiaReranker] load failed:", e.message);
        _loaded = false;
      }
      return _loaded;
    })();
    return _loading;
  }
  function ready() { return _loading || load(); }

  // ─── Tokenizer (same as gaia-retrieval) ──────────────────────────
  const STOP = new Set((
    "a an the and or but if of at by for with about to in on is are was were " +
    "be been being am do does did has have had this that these those it its " +
    "they them their there here then than so such as also just from into onto " +
    "over under up down out off not no nor very more most much many some any " +
    "all each every other another one two three first second new old high low " +
    "i you he she we us my your our his her whom what which who whose when " +
    "where why how because while although however therefore thus hence yet " +
    "still already even ever would could should may might must can shall will"
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
  function toks(text) {
    const out = [];
    const ms = (text || "").match(WORD_RE);
    if (!ms) return out;
    for (const w of ms) {
      const lc = w.toLowerCase();
      if (lc.length < 3 || STOP.has(lc)) continue;
      out.push(stem(lc));
    }
    return out;
  }

  const SOURCE_RE = /\b(ipcc|ar6|ar5|sr15|drawdown|epa|wikipedia)\b/i;
  const SRC_CODE = {
    "Wikipedia": "W", "IPCC": "I",
    "Project Drawdown": "D", "US EPA": "E",
  };

  // ─── Featurization (mirror of dis/train_reranker.py:featurize) ──
  function featurize(queryText, c) {
    const qToks = toks(queryText);
    const qSet = new Set(qToks);
    const titleToks = new Set(toks(c.title));
    const topicToks = new Set();
    for (const t of (c.topics || [])) for (const tk of toks(t)) topicToks.add(tk);
    const snippetToks = new Set(toks(c.text || c.snippet || ""));

    const srcCode = SRC_CODE[c.source] || "?";

    const titleOverlap = intersect(qSet, titleToks);
    const titleUnion = qSet.size + titleToks.size - titleOverlap;
    const jaccard = titleUnion ? titleOverlap / titleUnion : 0;
    const topicOverlap = intersect(qSet, topicToks);
    const snippetOverlap = intersect(qSet, snippetToks);

    const bmRank = c.bmRank ?? c.bm25_rank ?? 33;
    const dnRank = c.denseRank ?? c.dense_rank ?? 33;
    const docLen = (c._docLen != null) ? c._docLen : (c.l != null ? c.l : 0);

    return new Float32Array([
      +(c.bm25Score ?? c.bm25_score ?? 0),
      +bmRank,
      +(c.denseScore ?? c.dense_score ?? 0),
      +dnRank,
      +(c.score ?? c.rrf_score ?? 0),
      srcCode === "W" ? 1 : 0,
      srcCode === "I" ? 1 : 0,
      srcCode === "D" ? 1 : 0,
      srcCode === "E" ? 1 : 0,
      titleOverlap,
      jaccard,
      topicOverlap,
      snippetOverlap,
      qToks.length,
      docLen,
      SOURCE_RE.test(queryText || "") ? 1 : 0,
    ]);
  }

  function intersect(a, b) {
    let n = 0;
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    for (const x of small) if (big.has(x)) n++;
    return n;
  }

  // ─── Tree evaluation ────────────────────────────────────────────
  // Each node is [feat, threshold, left_idx, right_idx, default_left].
  // Leaves are [-1, leaf_value, 0, 0, 0].
  function evalTree(tree, features) {
    let i = 0;
    // Guard against degenerate trees (some boosters yield a single-leaf
    // tree if the data is too easy on early rounds).
    let steps = 0;
    while (steps++ < 64) {
      const node = tree[i];
      if (node[0] === -1) return node[1];
      const f = features[node[0]];
      // Missing values shouldn't happen in our pipeline (we always emit a
      // number), but if they did, default_left says where to send them.
      const goLeft = (Number.isFinite(f) ? f <= node[1] : node[4] === 1);
      i = goLeft ? node[2] : node[3];
    }
    return 0;
  }

  function score(queryText, candidate) {
    if (!_loaded) return 0;
    const fx = featurize(queryText, candidate);
    let s = 0;
    for (const tree of _model.trees) s += evalTree(tree, fx);
    return s;
  }

  function rerank(queryText, candidates) {
    if (!_loaded || !candidates || !candidates.length) return candidates;
    const scored = candidates.map(c => ({ c, s: score(queryText, c) }));
    scored.sort((a, b) => b.s - a.s);
    return scored.map(({ c, s }) => ({ ...c, rerankerScore: s }));
  }

  return {
    load, ready, rerank, score, featurize,
    get status() {
      return {
        loaded: _loaded,
        trees: _model ? _model.trees.length : 0,
        features: _model ? _model.feature_names : [],
      };
    },
    reset() { console.debug(`[SML] GaiaReranker.reset`); return true; },
    destroy() { console.debug(`[SML] GaiaReranker.destroy`); return true; },
    getState() { return {
    getStatus() {
      console.debug(`[Stub] Module.getStatus`);
      return true;
    },
    load() {
      console.debug(`[Stub] Module.load`);
      return true;
    },
    rerank() {
      console.debug(`[Stub] Module.rerank`);
      return true;
    },
}; },
  };
})();

if (typeof window !== "undefined") {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => window.GaiaReranker.load(), { timeout: 7000 });
  } else {
    setTimeout(() => window.GaiaReranker.load(), 2800);
  }
}
