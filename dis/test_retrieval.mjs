/**
 * test_retrieval.mjs — End-to-end harness for GAIA's grounded retrieval.
 *
 * Loads dist/knowledge/index.json + the structured sidecars exactly the
 * way the browser would, runs a panel of representative climate questions
 * through BM25 + structured detection, and prints the prompt that would
 * be sent to the LLM. Asserts on top-k quality and source diversity.
 *
 * Run from the repo root:   node dis/test_retrieval.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IDX_PATH = join(ROOT, "dist", "knowledge", "index.json");
const PLEDGES_PATH = join(ROOT, "dist", "knowledge", "pledges.json");
const PROJECTS_PATH = join(ROOT, "dist", "knowledge", "projects-by-country.json");
const PALEO_PATH = join(ROOT, "dist", "knowledge", "paleo.json");
const EMB_BIN_PATH = join(ROOT, "dist", "knowledge", "embeddings.bin");
const EMB_META_PATH = join(ROOT, "dist", "knowledge", "embeddings.meta.json");

if (!existsSync(IDX_PATH)) {
  console.error(`❌ retrieval index missing — run: python3 dis/build_retrieval_index.py`);
  process.exit(1);
}
const INDEX = JSON.parse(readFileSync(IDX_PATH, "utf8"));
const PLEDGES = existsSync(PLEDGES_PATH) ? JSON.parse(readFileSync(PLEDGES_PATH, "utf8")) : null;
const PROJECTS = existsSync(PROJECTS_PATH) ? JSON.parse(readFileSync(PROJECTS_PATH, "utf8")) : null;
const PALEO = existsSync(PALEO_PATH) ? JSON.parse(readFileSync(PALEO_PATH, "utf8")) : null;

// ─── LSA embeddings (mirror of js/gaia-embeddings.js) ──────────────
let EMB = null;
if (existsSync(EMB_BIN_PATH) && existsSync(EMB_META_PATH)) {
  const buf = readFileSync(EMB_BIN_PATH);
  const meta = JSON.parse(readFileSync(EMB_META_PATH, "utf8"));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== "GAIA") throw new Error("embeddings.bin: bad magic");
  const version = dv.getUint32(4, true);
  const n = dv.getUint32(8, true);
  const v = dv.getUint32(12, true);
  const dim = dv.getUint32(16, true);
  let off = 20;
  const ab = buf.buffer;
  const baseOff = buf.byteOffset;
  const docScales = new Float32Array(ab, baseOff + off, n);          off += n * 4;
  const docEmbs   = new Int8Array(ab,    baseOff + off, n * dim);    off += n * dim;
  const termScales= new Float32Array(ab, baseOff + off, v);          off += v * 4;
  const termEmbs  = new Int8Array(ab,    baseOff + off, v * dim);    off += v * dim;
  const vocabIdx = new Map();
  for (let i = 0; i < meta.vocab.length; i++) vocabIdx.set(meta.vocab[i], i);
  const idf = Float32Array.from(meta.idf);
  EMB = { n, v, dim, docScales, docEmbs, termScales, termEmbs, vocabIdx, idf, meta };
}

console.log(`[setup] index: ${INDEX.n} chunks · ${Object.keys(INDEX.post).length} terms · avgdl=${INDEX.avgdl}`);
console.log(`[setup] structured: pledges=${PLEDGES?._meta?.countries || 0} projects=${Object.keys(PROJECTS?.by_iso3 || {}).length} paleo=${PALEO?.rows?.length || 0}`);
console.log(`[setup] embeddings: ${EMB ? `loaded · N=${EMB.n} V=${EMB.v} dim=${EMB.dim} explained=${EMB.meta.explained_variance_ratio}` : "NOT FOUND"}`);
console.log("");

// ─── BM25 (mirror of js/gaia-retrieval.js) ─────────────────────────
const K1 = 1.5;
const B = 0.75;

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
  const out = [];
  const ms = (text || "").match(WORD_RE);
  if (!ms) return out;
  for (const w of ms) {
    const t = w.toLowerCase();
    if (t.length < 3 || STOP.has(t)) continue;
    out.push(stem(t));
  }
  return out;
}

const SOURCE_PATTERNS = [
  { re: /\b(ipcc|ar6|ar5|wg\s*[123i]+|sr15|spm|synthesis report)\b/i, code: "I", boost: 1.6 },
  { re: /\b(drawdown|project\s+drawdown)\b/i, code: "D", boost: 1.8 },
  { re: /\b(epa|us epa|environmental protection agency)\b/i, code: "E", boost: 1.6 },
  { re: /\b(wikipedia|wiki)\b/i, code: "W", boost: 1.3 },
];

function sourceBoosts(q) {
  const b = {};
  for (const p of SOURCE_PATTERNS) if (p.re.test(q)) b[p.code] = p.boost;
  return b;
}

function search(query, k = 8) {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const N = INDEX.n;
  const avgdl = INDEX.avgdl;
  const scores = new Map();
  const qTf = new Map();
  const boosts = sourceBoosts(query);
  for (const t of qTokens) qTf.set(t, (qTf.get(t) || 0) + 1);
  for (const [term, qtf] of qTf) {
    const df = INDEX.df[term];
    if (!df) continue;
    const postings = INDEX.post[term];
    if (!postings) continue;
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    for (const [docIdx, tf] of postings) {
      const dl = INDEX.chunks[docIdx].l || avgdl;
      const denom = tf + K1 * (1 - B + B * (dl / avgdl));
      let score = idf * ((tf * (K1 + 1)) / denom) * qtf;
      const srcCode = INDEX.chunks[docIdx].s;
      if (boosts[srcCode]) score *= boosts[srcCode];
      scores.set(docIdx, (scores.get(docIdx) || 0) + score);
    }
  }
  const arr = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, k);
  return arr.map(([idx, score]) => {
    const c = INDEX.chunks[idx];
    return {
      id: idx,
      score: +score.toFixed(3),
      title: c.t,
      source: INDEX.src[c.s] || c.s,
      url: c.u,
      text: c.x,
      topics: c.p || [],
    };
  });
}

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
  "coral","plankton","krill","whale","acid","ph","albedo","aerosol",
  "soot","particulate","ozone","stratosphere","troposphere","monsoon","enso",
]);

function isInDomain(query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return false;
  for (const t of tokens) {
    if (DOMAIN_TERMS.has(t)) return true;
    if (t.length >= 4) {
      for (const d of DOMAIN_TERMS) {
        if (d.startsWith(t) || t.startsWith(d)) return true;
      }
    }
  }
  return false;
}

// ─── Dense LSA search (mirror of js/gaia-embeddings.js) ─────────────
function embedQuery(query) {
  if (!EMB) return null;
  const toks = tokenize(query);
  if (toks.length === 0) return null;
  const tfMap = new Map();
  for (const t of toks) tfMap.set(t, (tfMap.get(t) || 0) + 1);
  const entries = [];
  let norm2 = 0;
  for (const [term, tf] of tfMap) {
    const j = EMB.vocabIdx.get(term);
    if (j === undefined) continue;
    const w = (1 + Math.log(tf)) * EMB.idf[j];
    entries.push([j, w]);
    norm2 += w * w;
  }
  if (entries.length === 0) return null;
  const norm = Math.sqrt(norm2) || 1;
  const out = new Float32Array(EMB.dim);
  for (const [j, w] of entries) {
    const ws = (w / norm) * EMB.termScales[j];
    const base = j * EMB.dim;
    for (let d = 0; d < EMB.dim; d++) out[d] += ws * EMB.termEmbs[base + d];
  }
  let qn = 0;
  for (let d = 0; d < EMB.dim; d++) qn += out[d] * out[d];
  qn = Math.sqrt(qn);
  if (qn > 0) for (let d = 0; d < EMB.dim; d++) out[d] /= qn;
  return out;
}

function searchDense(query, k = 8) {
  if (!EMB) return [];
  const q = embedQuery(query);
  if (!q) return [];
  const scores = new Float32Array(EMB.n);
  const K = EMB.dim;
  for (let i = 0; i < EMB.n; i++) {
    const base = i * K;
    let acc = 0;
    for (let d = 0; d < K; d++) acc += EMB.docEmbs[base + d] * q[d];
    scores[i] = acc * EMB.docScales[i];
  }
  const idx = new Array(EMB.n);
  for (let i = 0; i < EMB.n; i++) idx[i] = i;
  idx.sort((a, b) => scores[b] - scores[a]);
  const out = [];
  for (let r = 0; r < Math.min(k, EMB.n); r++) {
    const i = idx[r];
    const c = INDEX.chunks[i];
    out.push({
      id: i,
      score: scores[i],
      title: c.t,
      source: INDEX.src[c.s] || c.s,
      url: c.u,
      text: c.x,
      topics: c.p || [],
    });
  }
  return out;
}

// ─── Reciprocal Rank Fusion (mirror of gaia-retrieval.searchHybrid) ─
const RRF_K = 60;
function searchHybrid(query, k = 8) {
  const bm = search(query, Math.max(k * 2, 16));
  const dense = searchDense(query, Math.max(k * 2, 16));
  if (dense.length === 0) return bm.slice(0, k);
  const fused = new Map();
  bm.forEach((h, rank) => {
    fused.set(h.id, { rrf: 1 / (RRF_K + rank + 1), hit: h, bmRank: rank + 1, denseRank: null });
  });
  dense.forEach((d, rank) => {
    const cur = fused.get(d.id);
    if (cur) {
      cur.rrf += 1 / (RRF_K + rank + 1);
      cur.denseRank = rank + 1;
    } else {
      fused.set(d.id, { rrf: 1 / (RRF_K + rank + 1), hit: d, bmRank: null, denseRank: rank + 1 });
    }
  });
  const sorted = Array.from(fused.values()).sort((a, b) => b.rrf - a.rrf);
  const rrfResults = sorted.slice(0, k).map(r => ({
    ...r.hit,
    score: r.rrf,
    bmRank: r.bmRank,
    denseRank: r.denseRank,
  }));

  // ─── MMR diversification ────────────────────────────────────────
  // λ=0.7: trade off relevance (RRF score here, reranker score in
  // the browser) against Jaccard novelty over chunk title tokens.
  const LAMBDA = 0.7;
  function tokTitle(title) {
    const out = new Set();
    const ms = (title || "").match(WORD_RE);
    if (!ms) return out;
    for (const w of ms) {
      const t = w.toLowerCase();
      if (t.length < 3 || STOP.has(t)) continue;
      out.add(stem(t));
    }
    return out;
  }
  const titleToks = rrfResults.map(r => tokTitle(r.title || ""));
  function jaccard(a, b) {
    if (a.size === 0 && b.size === 0) return 0;
    let inter = 0;
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    for (const t of small) if (big.has(t)) inter++;
    const union = a.size + b.size - inter;
    return union > 0 ? inter / union : 0;
  }
  // Normalize RRF scores to [0,1]
  let maxS = -Infinity, minS = Infinity;
  for (const r of rrfResults) {
    if (r.score > maxS) maxS = r.score;
    if (r.score < minS) minS = r.score;
  }
  const range = maxS - minS || 1;
  const norm = r => (r.score - minS) / range;

  const picked = [];
  const pickedIdx = new Set();
  for (let step = 0; step < Math.min(k, rrfResults.length); step++) {
    let bestIdx = -1, bestMMR = -Infinity;
    for (let i = 0; i < rrfResults.length; i++) {
      if (pickedIdx.has(i)) continue;
      const rel = norm(rrfResults[i]);
      let maxSim = 0;
      for (const pi of pickedIdx) {
        const s = jaccard(titleToks[i], titleToks[pi]);
        if (s > maxSim) maxSim = s;
      }
      const mmr = LAMBDA * rel - (1 - LAMBDA) * maxSim;
      if (mmr > bestMMR) { bestMMR = mmr; bestIdx = i; }
    }
    picked.push(rrfResults[bestIdx]);
    pickedIdx.add(bestIdx);
  }
  return picked;
}

// ─── Structured detection (mirror of js/gaia-structured.js) ────────
function detectCountry(text) {
  if (!PLEDGES) return null;
  const t = text.toLowerCase();
  const aliases = {
    "usa":"United States","us":"United States","america":"United States",
    "uk":"United Kingdom","britain":"United Kingdom",
    "russia":"Russian Federation","south korea":"Republic of Korea",
    "iran":"Iran (Islamic Republic of)","vietnam":"Viet Nam",
    "turkiye":"Turkey","türkiye":"Turkey",
  };
  const candidates = [...Object.keys(PLEDGES.countries), ...Object.keys(aliases)];
  candidates.sort((a, b) => b.length - a.length);
  for (const name of candidates) {
    const re = new RegExp(`(^|[^a-z])${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}([^a-z]|$)`, "i");
    if (re.test(t)) return aliases[name.toLowerCase()] || name;
  }
  return null;
}

function detectPaleo(text) {
  const m = text.match(/(\d{1,5})\s*(?:k|kyr|thousand)\s*(?:years?\s*)?(?:ago|bp|before)/i)
        || text.match(/(\d{2,5})\s*(?:years?|yr)\s*(?:ago|bp|before)/i);
  if (m) {
    let n = parseInt(m[1], 10);
    if (/k|kyr|thousand/i.test(m[0])) n *= 1000;
    return n;
  }
  if (/younger\s*dryas/i.test(text)) return 12000;
  if (/last\s*glacial|ice\s*age/i.test(text)) return 20000;
  if (/holocene/i.test(text)) return 8000;
  return null;
}

function lookupPaleo(yrsBp) {
  if (!PALEO) return null;
  let best = PALEO.rows[0], bd = Infinity;
  for (const r of PALEO.rows) {
    const d = Math.abs(r.yrs_bp - yrsBp);
    if (d < bd) { best = r; bd = d; }
  }
  return best;
}

// ─── Tests ─────────────────────────────────────────────────────────
const TESTS = [
  {
    name: "Permafrost feedback under warming",
    query: "How will permafrost feedback evolve under 2°C of warming?",
    // Wikipedia's dedicated Permafrost article is the natural top hit;
    // IPCC permafrost mentions are spread across short SPM chunks. As long
    // as the top-k is dominated by permafrost-bearing chunks, we're good.
    expectTermInTopK: ["permafrost"],
  },
  {
    name: "Current atmospheric CO2",
    query: "What's the current atmospheric CO2 level and how does it compare to the Pliocene?",
    expectTermInTopK: ["carbon", "atmosphere"],
  },
  {
    name: "Mangrove carbon density",
    query: "Why are mangroves so important for carbon storage?",
    expectTermInTopK: ["mangrove"],
  },
  {
    name: "AMOC tipping point",
    query: "Could the Atlantic meridional overturning circulation collapse?",
    expectTermInTopK: ["atlantic", "circulation"],
  },
  {
    name: "Drawdown — onshore wind",
    query: "What does Project Drawdown say about onshore wind?",
    expectSources: ["Project Drawdown"],
    expectTermInTopK: ["onshore wind"],
  },
  {
    name: "Drawdown — heat pumps quantified impact",
    query: "How much can heat pumps reduce emissions according to Drawdown?",
    expectSources: ["Project Drawdown"],
    expectTermInTopK: ["heat pump"],
  },
  {
    name: "Drawdown — electricity sector solutions",
    query: "What electricity-sector climate solutions does Drawdown recommend?",
    expectSources: ["Project Drawdown"],
    expectTermInTopK: ["electricity"],
  },
  {
    name: "Drawdown — nature-based carbon removal",
    query: "Which nature-based carbon removal solutions are most promising in Drawdown?",
    expectSources: ["Project Drawdown"],
  },
  {
    name: "Country pledge — Turkey",
    query: "What did Turkey pledge under the Paris Agreement and what are its emissions doing?",
    expectStructured: { country: "Turkey" },
  },
  {
    name: "Country pledge — USA",
    query: "Tell me about the United States NDC and its emission trajectory",
    expectStructured: { country: "United States" },
  },
  {
    name: "Paleoclimate at Younger Dryas",
    query: "What was atmospheric CO2 during the Younger Dryas?",
    expectPaleoYrsBp: 12000,
  },
  {
    name: "Out of domain — refusal posture",
    query: "What's the best programming language for game development?",
    expectFewSources: true,
  },
  {
    name: "Sea level rise",
    query: "How much will sea level rise by 2100 under high emissions?",
    expectTermInTopK: ["sea"],
  },

  // ─── Paraphrase recall — these benefit from LSA semantic search ───
  // Each one is phrased so that BM25 alone struggles (few literal term
  // matches with the source chunks), but LSA should pull the right
  // concept neighbourhood. We run them through the HYBRID retriever
  // and assert on the title or topic, not on literal keyword presence.
  {
    name: "Paraphrase — thawing tundra → permafrost",
    query: "thawing tundra",
    hybrid: true,
    expectTitleSubstring: "Permafrost",
  },
  {
    name: "Paraphrase — frozen ground melting → permafrost",
    query: "frozen ground melting under warming",
    hybrid: true,
    expectTitleSubstring: "Permafrost",
  },
  {
    name: "Paraphrase — ocean current weakening → AMOC / ocean current",
    query: "ocean current weakening in the north atlantic",
    hybrid: true,
    expectTitleSubstring: "Ocean current",
  },
  {
    name: "Paraphrase — coastal flooding → sea level rise",
    query: "rising waters along coastlines threatening cities",
    hybrid: true,
    expectTitleSubstring: "Sea level rise",
  },
  {
    name: "Paraphrase — gasoline-free cars → EV chunks",
    query: "what about cars that run on electricity instead of gasoline",
    hybrid: true,
    // Either the Wikipedia EV article or any Drawdown electric-mobility
    // solution is a correct grounded match — the user is asking about EVs.
    expectAnyTitleSubstring: [
      "Electric vehicle", "Electric Cars", "Mobilize Electric",
      "Electric Trucks", "Electric Bicycles", "Electric Bus",
    ],
  },
  {
    name: "MMR diversity — Turkey Paris Agreement (max 3 same-title)",
    query: "What did Turkey pledge under the Paris Agreement and what are its emissions doing?",
    hybrid: true,
    expectMaxSameTitle: 3,
  },
];

let passed = 0, failed = 0;
const fails = [];

for (const t of TESTS) {
  const useHybrid = t.hybrid && EMB;
  const hits = useHybrid ? searchHybrid(t.query, 8) : search(t.query, 8);
  const country = detectCountry(t.query);
  const yrsBp = detectPaleo(t.query);

  const issues = [];
  if (t.expectTermInTopK) {
    const blob = hits.map(h => (h.title + " " + h.text).toLowerCase()).join(" ");
    for (const term of t.expectTermInTopK) {
      if (!blob.includes(term.toLowerCase())) {
        issues.push(`top-k missing term "${term}"`);
      }
    }
  }
  if (t.expectSources) {
    const seenSources = new Set(hits.map(h => h.source));
    for (const src of t.expectSources) {
      if (!seenSources.has(src)) {
        issues.push(`expected source "${src}" not in top-k (saw ${[...seenSources].join(", ")})`);
      }
    }
  }
  if (t.expectStructured?.country && country !== t.expectStructured.country) {
    issues.push(`expected country "${t.expectStructured.country}", got "${country}"`);
  }
  if (t.expectPaleoYrsBp != null && yrsBp !== t.expectPaleoYrsBp) {
    issues.push(`expected paleoYrsBp ${t.expectPaleoYrsBp}, got ${yrsBp}`);
  }
  if (t.expectFewSources) {
    if (isInDomain(t.query)) {
      issues.push(`isInDomain() returned TRUE for out-of-domain query — refusal posture won't engage`);
    }
  }
  if (t.expectTitleSubstring) {
    const titles = hits.map(h => h.title);
    if (!titles.some(tt => tt.toLowerCase().includes(t.expectTitleSubstring.toLowerCase()))) {
      issues.push(`top-k titles missing "${t.expectTitleSubstring}" (saw: ${titles.slice(0, 5).join(" | ")})`);
    }
  }
  if (t.expectAnyTitleSubstring) {
    const titles = hits.map(h => h.title.toLowerCase());
    const wanted = t.expectAnyTitleSubstring.map(s => s.toLowerCase());
    const hit = wanted.some(w => titles.some(tt => tt.includes(w)));
    if (!hit) {
      issues.push(`top-k titles missing any of [${t.expectAnyTitleSubstring.join(", ")}] (saw: ${hits.slice(0, 5).map(h => h.title).join(" | ")})`);
    }
  }
  if (t.expectMaxSameTitle != null) {
    const counts = {};
    for (const h of hits) { counts[h.title] = (counts[h.title] || 0) + 1; }
    const maxCount = Math.max(...Object.values(counts));
    if (maxCount > t.expectMaxSameTitle) {
      const worst = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
      issues.push(`title "${worst[0]}" appears ${worst[1]} times — exceeds max ${t.expectMaxSameTitle}`);
    }
  }

  const ok = issues.length === 0;
  if (ok) passed++; else { failed++; fails.push({ name: t.name, issues }); }

  console.log(`${ok ? "✅" : "❌"}  ${t.name}${useHybrid ? "  (hybrid)" : ""}`);
  console.log(`    query: "${t.query}"`);
  if (country) console.log(`    detected country: ${country}`);
  if (yrsBp != null) {
    const row = lookupPaleo(yrsBp);
    console.log(`    detected paleo yrs_bp=${yrsBp} → temp_c=${row?.temp_c} co2_ppm=${row?.co2_ppm}`);
  }
  console.log(`    top-3 hits:`);
  for (const h of hits.slice(0, 3)) {
    const rankInfo = useHybrid
      ? `  (bm=${h.bmRank ?? "—"} dense=${h.denseRank ?? "—"})`
      : "";
    console.log(`      [${h.score.toFixed(3)}] ${h.source} · ${h.title}${rankInfo}`);
  }
  if (issues.length) {
    for (const i of issues) console.log(`    ⚠ ${i}`);
  }
  console.log("");
}

console.log("───────────────────────────────────────────");
console.log(`PASSED: ${passed}/${TESTS.length}   FAILED: ${failed}`);
if (failed) {
  console.log("");
  for (const f of fails) {
    console.log(`  ❌ ${f.name}`);
    for (const i of f.issues) console.log(`     · ${i}`);
  }
  process.exit(1);
}
process.exit(0);
