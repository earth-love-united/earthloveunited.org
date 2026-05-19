/**
 * GAIA RETRIEVAL — BM25 over the curated climate knowledge index
 *
 * Loads dist/knowledge/index.json.gz on first use (lazy).
 * Returns top-k chunks ranked by Okapi BM25 (k1=1.5, b=0.75) with light
 * stemming. Title and topic tokens were 2× weighted at build time, so
 * matches against titles naturally score higher.
 *
 * Public surface (attached to window.GaiaRetrieval):
 *   await GaiaRetrieval.ready()           → resolves once index is loaded
 *   GaiaRetrieval.search(q, k=8)          → [{ id, score, title, source, url, text }]
 *   GaiaRetrieval.getContext(q, opts)     → { text, sources } for the prompt
 *   GaiaRetrieval.status                  → { loaded, n, terms, sizeKB }
 *   GaiaRetrieval.sourceLabel(code)       → "Wikipedia" etc.
 *
 * Designed to fail soft: if the index can't be fetched, search() returns []
 * and the caller falls back to the legacy static knowledge context.
 */

window.GaiaRetrieval = (function () {
  // ─── State ───────────────────────────────────────────────────────
  let _index = null;          // { v, n, avgdl, src, chunks, df, post }
  let _loading = null;        // in-flight promise
  let _loaded = false;
  const INDEX_URL = "/dist/knowledge/index.json.gz";
  const INDEX_URL_FALLBACK = "/dist/knowledge/index.json";

  // BM25 parameters — classical defaults.
  const K1 = 1.5;
  const B = 0.75;

  // ─── Tokenizer (mirror of dis/build_retrieval_index.py) ──────────
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
    const suffs = [
      "ization","izations","ational","iveness","fulness","ousness","ically",
      "ation","ations","ments","ment","ness","tion","ence","ance","able","ible",
    ];
    for (const s of suffs) {
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
    const matches = text.match(WORD_RE);
    if (!matches) return out;
    for (const w of matches) {
      const t = w.toLowerCase();
      if (t.length < 3 || STOP.has(t)) continue;
      out.push(stem(t));
    }
    return out;
  }

  // ─── Loading ─────────────────────────────────────────────────────
  async function _fetchIndex() {
    // Try gzipped first; fall back to the uncompressed copy the build
    // script also writes (handy in dev where the server may not gzip-
    // negotiate a .gz response).
    let json = null;
    try {
      const r = await fetch(INDEX_URL, { cache: "force-cache" });
      if (r.ok) {
        // The browser will transparently decompress when the server sets
        // Content-Encoding: gzip. When it doesn't (most static servers),
        // r.text() returns the binary blob and JSON.parse will throw — so
        // we catch and fall through to the uncompressed copy.
        try { json = await r.json(); } catch (_) { json = null; }
      }
    } catch (_) { /* fall through */ }
    if (!json) {
      const r2 = await fetch(INDEX_URL_FALLBACK, { cache: "force-cache" });
      if (!r2.ok) throw new Error(`retrieval index fetch failed: ${r2.status}`);
      json = await r2.json();
    }
    return json;
  }

  function load() {
    if (_loading) return _loading;
    _loading = (async () => {
      const t0 = performance.now();
      try {
        const idx = await _fetchIndex();
        if (!idx || !idx.chunks || !idx.post) {
          throw new Error("retrieval index missing required fields");
        }
        _index = idx;
        _loaded = true;
        const ms = (performance.now() - t0).toFixed(0);
        console.log(
          `[GaiaRetrieval] loaded ${_index.n} chunks · ${Object.keys(_index.post).length} terms in ${ms}ms`
        );
      } catch (e) {
        console.warn("[GaiaRetrieval] load failed:", e.message);
        _loaded = false;
      }
      return _loaded;
    })();
    return _loading;
  }

  function ready() { return _loading || load(); }

  // Source-name boosting. When the user explicitly references a source
  // ("what does the IPCC say…", "Drawdown solutions for wind") we want
  // chunks from that source ranked higher. The pattern → source-code map
  // is checked once per query.
  const SOURCE_PATTERNS = [
    { re: /\b(ipcc|ar6|ar5|wg\s*[123i]+|sr15|spm|synthesis report)\b/i, code: "I", boost: 1.6 },
    { re: /\b(drawdown|project\s+drawdown)\b/i, code: "D", boost: 1.8 },
    { re: /\b(epa|us epa|environmental protection agency)\b/i, code: "E", boost: 1.6 },
    { re: /\b(wikipedia|wiki)\b/i, code: "W", boost: 1.3 },
  ];

  function _sourceBoosts(query) {
    const boosts = {};
    for (const p of SOURCE_PATTERNS) {
      if (p.re.test(query)) boosts[p.code] = p.boost;
    }
    return boosts;
  }

  // ─── BM25 search ─────────────────────────────────────────────────
  function search(query, k = 8) {
    if (!_loaded || !_index) return [];
    const qTokens = tokenize(query);
    if (qTokens.length === 0) return [];

    const N = _index.n;
    const avgdl = _index.avgdl || 100;
    const scores = new Map();   // chunk_idx → bm25 score
    const boosts = _sourceBoosts(query);

    // Deduplicate query terms but keep frequency for repeated terms (qtf).
    const qTf = new Map();
    for (const t of qTokens) qTf.set(t, (qTf.get(t) || 0) + 1);

    for (const [term, qtf] of qTf) {
      const df = _index.df[term];
      if (!df) continue;
      const postings = _index.post[term];
      if (!postings) continue;
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      for (const [docIdx, tf] of postings) {
        const dl = _index.chunks[docIdx].l || avgdl;
        const denom = tf + K1 * (1 - B + B * (dl / avgdl));
        let score = idf * ((tf * (K1 + 1)) / denom) * qtf;
        // Apply source-name boost if the user mentioned that source.
        const srcCode = _index.chunks[docIdx].s;
        if (boosts[srcCode]) score *= boosts[srcCode];
        scores.set(docIdx, (scores.get(docIdx) || 0) + score);
      }
    }

    if (scores.size === 0) return [];

    // Take top-k by score.
    const arr = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    const results = [];
    for (let i = 0; i < Math.min(k, arr.length); i++) {
      const [idx, score] = arr[i];
      const c = _index.chunks[idx];
      results.push({
        id: idx,
        score,
        title: c.t,
        source: _index.src[c.s] || c.s,
        sourceCode: c.s,
        url: c.u || null,
        text: c.x,
        topics: c.p || [],
      });
    }
    return results;
  }

  // ─── Domain-relevance gate ───────────────────────────────────────
  // Cheap check: does the query (or its top hits) mention any of the
  // core climate-vocabulary terms? If not, treat as out-of-domain and
  // let the chat refuse rather than confabulate.
  const DOMAIN_TERMS = new Set([
    "climate","climat","carbon","co2","emission","emiss","warm","temperature",
    "ice","glacier","ocean","atmosphere","atmospher","forest","biome","tree",
    "mangrove","peat","wetland","sea","ipcc","drawdown","ndc","paris",
    "renewable","solar","wind","fossil","coal","oil","gas","methane","ch4",
    "permafrost","amoc","arctic","antarctic","tipping","feedback","greenhouse",
    "weather","drought","flood","wildfire","fire","reforestation","afforestation",
    "biodiversity","species","ecosystem","sustainab","cop","unfccc","paleo",
    "holocene","epica","mauna","keeling","ndvi","biochar","sequestrat",
    "watershed","river","precipitation","aridity","desert","tundra","reef",
    "coral","plankton","krill","whale","ocean","acid","ph","albedo","aerosol",
    "soot","particulate","ozone","stratosphere","troposphere","monsoon","enso",
  ]);

  // Important: we look only at the QUERY tokens here, not at any retrieved
  // hits. The index contains only climate content, so any BM25 match will
  // surface climate-flavoured topics regardless of how off-topic the query
  // is. The gate's whole purpose is to refuse out-of-domain queries cleanly.
  function isInDomain(query) {
    const tokens = tokenize(query);
    if (tokens.length === 0) return false;
    for (const t of tokens) {
      if (DOMAIN_TERMS.has(t)) return true;
      // Allow prefix match in BOTH directions: query token is a prefix of a
      // domain term (e.g. "warm" → "warming"), or a domain term is a prefix
      // of the query token (e.g. "permafrost" → "permafrosting"). The 4-char
      // minimum on the query token prevents trivial matches like "ice".
      if (t.length >= 4) {
        for (const d of DOMAIN_TERMS) {
          if (d.startsWith(t) || t.startsWith(d)) return true;
        }
      }
    }
    return false;
  }

  // ─── Context builder for the prompt ──────────────────────────────
  // Returns a SOURCES block plus the parallel sources array (so the UI
  // can render an attribution footer once GAIA's reply comes back).
  function getContext(query, opts) {
    opts = opts || {};
    const k = opts.k || 8;
    const maxChars = opts.maxChars || 4500;     // budget for the SOURCES block
    const snippetChars = opts.snippetChars || 480;

    const hits = search(query, k);
    if (hits.length === 0) {
      return { text: "", sources: [], n: 0, inDomain: false };
    }

    // Out-of-domain queries: even if BM25 found something, refuse to
    // pass it as evidence — the GROUNDING CONTRACT in the system prompt
    // will then trigger the refusal posture.
    if (!isInDomain(query, hits)) {
      return { text: "", sources: [], n: 0, inDomain: false };
    }

    const lines = [];
    const sources = [];
    let used = 0;
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      const tag = `S${i + 1}`;
      const snippet = (h.text || "").slice(0, snippetChars).replace(/\s+/g, " ").trim();
      const line = `[${tag}] ${h.title} — ${h.source}\n${snippet}`;
      if (used + line.length + 2 > maxChars && lines.length >= 3) break;
      lines.push(line);
      sources.push({
        tag,
        title: h.title,
        source: h.source,
        sourceCode: h.sourceCode,
        url: h.url,
        score: +h.score.toFixed(3),
      });
      used += line.length + 2;
    }

    return {
      text: lines.join("\n\n"),
      sources,
      n: sources.length,
      inDomain: true,
    };
  }

  function sourceLabel(code) {
    return (_index && _index.src && _index.src[code]) || code;
  }

  return {
    load,
    ready,
    search,
    getContext,
    sourceLabel,
    tokenize,
    get status() {
      return {
        loaded: _loaded,
        n: _index ? _index.n : 0,
        terms: _index ? Object.keys(_index.post).length : 0,
        sources: _index ? _index.src : {},
      };
    },
  };
})();

// Kick off the load on idle — chat will await ready() when needed.
if (typeof window !== "undefined") {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => window.GaiaRetrieval.load(), { timeout: 4000 });
  } else {
    setTimeout(() => window.GaiaRetrieval.load(), 1500);
  }
}
