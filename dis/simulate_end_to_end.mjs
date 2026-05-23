/**
 * simulate_end_to_end.mjs — Walk a real user query through the full GAIA
 * pipeline and print exactly what the LLM would receive as its prompt.
 *
 * Stages:
 *   1. Country / paleo / project intent detection
 *   2. BM25 search       (32 candidates)
 *   3. LSA dense search  (32 candidates)
 *   4. RRF fusion        (pool of ~24)
 *   5. LightGBM reranker (reorder to top-8)
 *   6. Structured lookup (per-country pledges, paleo, projects)
 *   7. Prompt assembly   (SOURCES + STRUCTURED blocks)
 *
 * No actual LLM call is made — we just show the assembled prompt.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = JSON.parse(readFileSync(join(ROOT, "dist", "knowledge", "index.json"), "utf8"));
const PLEDGES = JSON.parse(readFileSync(join(ROOT, "dist", "knowledge", "pledges.json"), "utf8"));
const PALEO = JSON.parse(readFileSync(join(ROOT, "dist", "knowledge", "paleo.json"), "utf8"));
const PROJECTS = JSON.parse(readFileSync(join(ROOT, "dist", "knowledge", "projects-by-country.json"), "utf8"));
const MODEL = JSON.parse(readFileSync(join(ROOT, "dist", "knowledge", "reranker.json"), "utf8"));

const emb_buf = readFileSync(join(ROOT, "dist", "knowledge", "embeddings.bin"));
const emb_meta = JSON.parse(readFileSync(join(ROOT, "dist", "knowledge", "embeddings.meta.json"), "utf8"));
const dv = new DataView(emb_buf.buffer, emb_buf.byteOffset, emb_buf.byteLength);
const EMB_N = dv.getUint32(8, true), EMB_V = dv.getUint32(12, true), EMB_DIM = dv.getUint32(16, true);
let _off = 20;
const docScales = new Float32Array(emb_buf.buffer, emb_buf.byteOffset + _off, EMB_N); _off += EMB_N * 4;
const docEmbs   = new Int8Array(emb_buf.buffer,    emb_buf.byteOffset + _off, EMB_N * EMB_DIM); _off += EMB_N * EMB_DIM;
const termScales= new Float32Array(emb_buf.buffer, emb_buf.byteOffset + _off, EMB_V); _off += EMB_V * 4;
const termEmbs  = new Int8Array(emb_buf.buffer,    emb_buf.byteOffset + _off, EMB_V * EMB_DIM); _off += EMB_V * EMB_DIM;
const vocabIdx = new Map(); for (let i = 0; i < emb_meta.vocab.length; i++) vocabIdx.set(emb_meta.vocab[i], i);
const idf = Float32Array.from(emb_meta.idf);

// ─── Tokenizer (shared by all components) ──────────────────────────
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

// ─── BM25 ──────────────────────────────────────────────────────────
function bm25(q, k=32) {
  const qT = toks(q); if (!qT.length) return [];
  const scores = new Map(); const qTf = new Map();
  for (const t of qT) qTf.set(t, (qTf.get(t)||0)+1);
  for (const [term, qtf] of qTf) {
    const df = INDEX.df[term]; if (!df) continue;
    const postings = INDEX.post[term] || [];
    const idfv = Math.log((INDEX.n - df + 0.5) / (df + 0.5) + 1);
    for (const [i, tf] of postings) {
      const dl = INDEX.chunks[i].l || INDEX.avgdl;
      const denom = tf + 1.5 * (1 - 0.75 + 0.75 * (dl / INDEX.avgdl));
      scores.set(i, (scores.get(i)||0) + idfv * (tf * 2.5) / denom * qtf);
    }
  }
  return Array.from(scores.entries()).sort((a,b)=>b[1]-a[1]).slice(0,k).map(([i,s])=>({id:i,score:s}));
}

// ─── LSA dense ─────────────────────────────────────────────────────
function embedQuery(q) {
  const tks = toks(q); if (!tks.length) return null;
  const tfMap = new Map(); for (const t of tks) tfMap.set(t,(tfMap.get(t)||0)+1);
  const ents = []; let n2 = 0;
  for (const [term, tf] of tfMap) {
    const j = vocabIdx.get(term); if (j===undefined) continue;
    const w = (1+Math.log(tf))*idf[j]; ents.push([j,w]); n2 += w*w;
  }
  if (!ents.length) return null;
  const norm = Math.sqrt(n2)||1;
  const out = new Float32Array(EMB_DIM);
  for (const [j,w] of ents) {
    const ws = (w/norm)*termScales[j], base = j*EMB_DIM;
    for (let d=0; d<EMB_DIM; d++) out[d] += ws * termEmbs[base+d];
  }
  let qn=0; for (let d=0;d<EMB_DIM;d++) qn += out[d]*out[d];
  qn = Math.sqrt(qn); if (qn>0) for (let d=0;d<EMB_DIM;d++) out[d] /= qn;
  return out;
}
function dense(q, k=32) {
  const qv = embedQuery(q); if (!qv) return [];
  const scores = new Float32Array(EMB_N);
  for (let i=0;i<EMB_N;i++) {
    let acc=0; const base=i*EMB_DIM;
    for (let d=0;d<EMB_DIM;d++) acc += docEmbs[base+d]*qv[d];
    scores[i] = acc * docScales[i];
  }
  const idx = [...Array(EMB_N).keys()].sort((a,b)=>scores[b]-scores[a]).slice(0,k);
  return idx.map(i=>({id:i,score:scores[i]}));
}

// ─── RRF + Reranker ────────────────────────────────────────────────
function rrfThenRerank(query, k=8) {
  const bm = bm25(query, 32), de = dense(query, 32);
  const RRF=60, fused = new Map();
  bm.forEach((h,r)=>fused.set(h.id, {rrf:1/(RRF+r+1), bmRank:r+1, denseRank:null, bmScore:h.score, denseScore:0}));
  de.forEach((d,r)=>{
    const c = fused.get(d.id);
    if (c) { c.rrf+=1/(RRF+r+1); c.denseRank=r+1; c.denseScore=d.score; }
    else fused.set(d.id, {rrf:1/(RRF+r+1), bmRank:null, denseRank:r+1, bmScore:0, denseScore:d.score});
  });
  const pool = Array.from(fused.entries()).sort((a,b)=>b[1].rrf-a[1].rrf).slice(0, k*3);
  // Featurize + rerank
  const SOURCE_RE = /\b(ipcc|ar6|ar5|sr15|drawdown|epa|wikipedia)\b/i;
  const SRC_CODE = {"Wikipedia":"W","IPCC":"I","Project Drawdown":"D","US EPA":"E"};
  const qToks = toks(query), qSet = new Set(qToks);
  const candidates = pool.map(([id, meta]) => {
    const c = INDEX.chunks[id];
    const titleToks = new Set(toks(c.t));
    const topicToks = new Set(); for (const t of (c.p||[])) for (const tk of toks(t)) topicToks.add(tk);
    const snippetToks = new Set(toks(c.x));
    const intersect = (a,b) => { let n=0; const [s,bg]=a.size<=b.size?[a,b]:[b,a]; for (const x of s) if (bg.has(x)) n++; return n; };
    const titleOverlap = intersect(qSet, titleToks);
    const titleUnion = qSet.size + titleToks.size - titleOverlap;
    const jaccard = titleUnion ? titleOverlap/titleUnion : 0;
    const topicOverlap = intersect(qSet, topicToks);
    const snippetOverlap = intersect(qSet, snippetToks);
    const srcCode = SRC_CODE[INDEX.src[c.s]] || "?";
    const fx = [
      meta.bmScore, meta.bmRank ?? 33, meta.denseScore, meta.denseRank ?? 33, meta.rrf,
      srcCode==="W"?1:0, srcCode==="I"?1:0, srcCode==="D"?1:0, srcCode==="E"?1:0,
      titleOverlap, jaccard, topicOverlap, snippetOverlap,
      qToks.length, c.l || 0, SOURCE_RE.test(query) ? 1 : 0,
    ];
    // Evaluate trees
    let rerankerScore = 0;
    for (const tree of MODEL.trees) {
      let ni = 0; let steps = 0;
      while (steps++ < 64) {
        const node = tree[ni];
        if (node[0] === -1) { rerankerScore += node[1]; break; }
        ni = (fx[node[0]] <= node[1]) ? node[2] : node[3];
      }
    }
    return { id, chunk: c, ...meta, rerankerScore };
  });
  candidates.sort((a, b) => b.rerankerScore - a.rerankerScore);

  // ─── MMR diversification ────────────────────────────────────────
  // λ=0.7: trade off reranker relevance against Jaccard novelty
  // over chunk title tokens. Same algorithm as gaia-retrieval.js.
  const LAMBDA = 0.7;
  const titleTokenSets = candidates.map(c => new Set(toks(c.chunk.t || "")));
  function jaccard(a, b) {
    if (a.size === 0 && b.size === 0) return 0;
    let inter = 0;
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    for (const t of small) if (big.has(t)) inter++;
    const union = a.size + b.size - inter;
    return union > 0 ? inter / union : 0;
  }
  let maxS = -Infinity, minS = Infinity;
  for (const c of candidates) {
    if (c.rerankerScore > maxS) maxS = c.rerankerScore;
    if (c.rerankerScore < minS) minS = c.rerankerScore;
  }
  const range = maxS - minS || 1;
  const norm = c => (c.rerankerScore - minS) / range;

  const picked = [];
  const pickedIdx = new Set();
  for (let step = 0; step < Math.min(k, candidates.length); step++) {
    let bestIdx = -1, bestMMR = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      if (pickedIdx.has(i)) continue;
      let maxSim = 0;
      for (const pi of pickedIdx) {
        const s = jaccard(titleTokenSets[i], titleTokenSets[pi]);
        if (s > maxSim) maxSim = s;
      }
      const mmr = LAMBDA * norm(candidates[i]) - (1 - LAMBDA) * maxSim;
      if (mmr > bestMMR) { bestMMR = mmr; bestIdx = i; }
    }
    picked.push(candidates[bestIdx]);
    pickedIdx.add(bestIdx);
  }
  return picked;
}

// ─── Structured detection ─────────────────────────────────────────
function detectCountry(text) {
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
  if (m) { let n=parseInt(m[1],10); if (/k|kyr|thousand/i.test(m[0])) n*=1000; return n; }
  if (/younger\s*dryas/i.test(text)) return 12000;
  if (/last\s*glacial|ice\s*age/i.test(text)) return 20000;
  if (/holocene/i.test(text)) return 8000;
  return null;
}

// ─── Prompt assembly ──────────────────────────────────────────────
function assemble(query) {
  console.log(`\n╔══════════════════════════════════════════════════════════════════════╗`);
  console.log(`║  Query: "${query}"`);
  console.log(`╚══════════════════════════════════════════════════════════════════════╝\n`);

  const country = detectCountry(query);
  const paleo = detectPaleo(query);
  console.log(`──[ structured intent ]──────────────────────────────────────────────────`);
  console.log(`   country detected: ${country || "(none)"}`);
  console.log(`   paleo detected:   ${paleo != null ? paleo + " yrs BP" : "(none)"}`);

  const hits = rrfThenRerank(query, 6);
  console.log(`\n──[ top-6 retrieved sources (after BM25 → LSA → RRF → reranker) ]────────`);
  hits.forEach((h, i) => {
    const tag = `S${i+1}`;
    const tags = [];
    if (h.bmRank) tags.push(`bm25 #${h.bmRank}`);
    if (h.denseRank) tags.push(`dense #${h.denseRank}`);
    console.log(`   [${tag}] ${INDEX.src[h.chunk.s]} · ${h.chunk.t}`);
    console.log(`         score=${h.rerankerScore.toFixed(3)}  rrf=${h.rrf.toFixed(4)}  (${tags.join(", ")})`);
  });

  // Structured rows
  console.log(`\n──[ structured rows that would be injected ]─────────────────────────────`);
  let structuredCount = 0;
  if (country) {
    const c = PLEDGES.countries[country];
    if (c) {
      console.log(`   [N1] COUNTRY: ${country} (${c.iso || "?"})`);
      if (c.pledge?.target) {
        console.log(`        Pledge: ${c.pledge.target.slice(0,90)}...`);
      }
      if (c.trajectory?.length) {
        const last = c.trajectory[c.trajectory.length-1];
        console.log(`        Latest: ${last.y} → ${last.total} MtCO₂e total`);
      }
      structuredCount++;
    }
    const pr = PROJECTS.by_iso3[(c && c.iso) || ""];
    if (pr) {
      console.log(`   [P1] PROJECTS in ${pr.country}: ${pr.count} projects`);
      console.log(`        Annual reduction: ${pr.annual_reduction_tco2.toLocaleString()} tCO₂`);
      structuredCount++;
    }
  }
  if (paleo != null) {
    let best = PALEO.rows[0], bd = Infinity;
    for (const r of PALEO.rows) { const d = Math.abs(r.yrs_bp - paleo); if (d < bd) { best=r; bd=d; } }
    console.log(`   [H1] PALEO at ~${best.yrs_bp.toLocaleString()} yrs BP`);
    console.log(`        Temp: ${best.temp_c}°C  ·  CO₂: ${best.co2_ppm} ppm  ·  Sea-level: ${best.sea_level_m} m`);
    structuredCount++;
  }
  if (!structuredCount) console.log(`   (none — pure retrieval grounding)`);

  // Token count estimate
  const sourceText = hits.map((h, i) => `[S${i+1}] ${h.chunk.t} — ${INDEX.src[h.chunk.s]}\n${h.chunk.x.slice(0, 280)}`).join("\n\n");
  console.log(`\n──[ payload sizes (estimated) ]─────────────────────────────────────────`);
  console.log(`   SOURCES block: ~${sourceText.length} chars  (~${Math.ceil(sourceText.length/4)} tokens)`);
  console.log(`   GAIA personality + grounding contract: ~2,200 chars (~550 tokens)`);
  console.log(`   Total system prompt: ~${Math.ceil((sourceText.length + 2200)/4)} tokens`);
  console.log(`   Well under any modern LLM context window.`);
}

// ─── Run a panel ───────────────────────────────────────────────────
const QUERIES = [
  "what did Turkey pledge under the Paris agreement",
  "how does permafrost thaw amplify warming",
  "i'm scared about climate change what can i do",
  "what was atmospheric CO2 during the Younger Dryas",
  "best drawdown solutions for the electricity sector",
];
for (const q of QUERIES) assemble(q);
