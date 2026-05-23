/**
 * compare_bm25_vs_hybrid.mjs — side-by-side comparison of BM25-only
 * vs. BM25+LSA(RRF) retrieval on paraphrase queries.
 *
 * Purpose: prove the embeddings actually help, by showing the same query
 * scored under both retrievers and noting where the LSA half of the
 * fusion improved a result.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = JSON.parse(readFileSync(join(ROOT, "dist", "knowledge", "index.json"), "utf8"));
const buf = readFileSync(join(ROOT, "dist", "knowledge", "embeddings.bin"));
const meta = JSON.parse(readFileSync(join(ROOT, "dist", "knowledge", "embeddings.meta.json"), "utf8"));

// ─── Tokenizer + BM25 + LSA + RRF, copy-pasted from test_retrieval.mjs ─
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
    const lc = w.toLowerCase();
    if (lc.length < 3 || STOP.has(lc)) continue;
    out.push(stem(lc));
  }
  return out;
}

const K1 = 1.5, B = 0.75;
function bm25(query, k = 8) {
  const qT = tokenize(query);
  if (!qT.length) return [];
  const N = INDEX.n, avgdl = INDEX.avgdl;
  const scores = new Map();
  const qTf = new Map();
  for (const t of qT) qTf.set(t, (qTf.get(t) || 0) + 1);
  for (const [term, qtf] of qTf) {
    const df = INDEX.df[term]; if (!df) continue;
    const postings = INDEX.post[term]; if (!postings) continue;
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    for (const [docIdx, tf] of postings) {
      const dl = INDEX.chunks[docIdx].l || avgdl;
      const denom = tf + K1 * (1 - B + B * (dl / avgdl));
      const s = idf * ((tf * (K1 + 1)) / denom) * qtf;
      scores.set(docIdx, (scores.get(docIdx) || 0) + s);
    }
  }
  return Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, k)
    .map(([i, s]) => ({ id: i, score: s, title: INDEX.chunks[i].t, source: INDEX.src[INDEX.chunks[i].s] }));
}

// LSA
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const N_EMB = dv.getUint32(8, true), V_EMB = dv.getUint32(12, true), DIM = dv.getUint32(16, true);
let off = 20;
const docScales = new Float32Array(buf.buffer, buf.byteOffset + off, N_EMB);  off += N_EMB * 4;
const docEmbs = new Int8Array(buf.buffer, buf.byteOffset + off, N_EMB * DIM); off += N_EMB * DIM;
const termScales = new Float32Array(buf.buffer, buf.byteOffset + off, V_EMB); off += V_EMB * 4;
const termEmbs = new Int8Array(buf.buffer, buf.byteOffset + off, V_EMB * DIM); off += V_EMB * DIM;
const vocabIdx = new Map();
for (let i = 0; i < meta.vocab.length; i++) vocabIdx.set(meta.vocab[i], i);
const idf = Float32Array.from(meta.idf);

function embedQuery(q) {
  const toks = tokenize(q); if (!toks.length) return null;
  const tfMap = new Map();
  for (const t of toks) tfMap.set(t, (tfMap.get(t) || 0) + 1);
  const entries = []; let norm2 = 0;
  for (const [term, tf] of tfMap) {
    const j = vocabIdx.get(term); if (j === undefined) continue;
    const w = (1 + Math.log(tf)) * idf[j];
    entries.push([j, w]); norm2 += w * w;
  }
  if (!entries.length) return null;
  const norm = Math.sqrt(norm2) || 1;
  const out = new Float32Array(DIM);
  for (const [j, w] of entries) {
    const ws = (w / norm) * termScales[j], base = j * DIM;
    for (let d = 0; d < DIM; d++) out[d] += ws * termEmbs[base + d];
  }
  let qn = 0;
  for (let d = 0; d < DIM; d++) qn += out[d] * out[d];
  qn = Math.sqrt(qn);
  if (qn > 0) for (let d = 0; d < DIM; d++) out[d] /= qn;
  return out;
}
function dense(query, k = 8) {
  const q = embedQuery(query); if (!q) return [];
  const scores = new Float32Array(N_EMB);
  for (let i = 0; i < N_EMB; i++) {
    let acc = 0; const base = i * DIM;
    for (let d = 0; d < DIM; d++) acc += docEmbs[base + d] * q[d];
    scores[i] = acc * docScales[i];
  }
  const idx = new Array(N_EMB); for (let i = 0; i < N_EMB; i++) idx[i] = i;
  idx.sort((a, b) => scores[b] - scores[a]);
  return idx.slice(0, k).map(i => ({ id: i, score: scores[i], title: INDEX.chunks[i].t, source: INDEX.src[INDEX.chunks[i].s] }));
}

const RRF_K = 60;
function hybrid(query, k = 8) {
  const bm = bm25(query, 16), de = dense(query, 16);
  const fused = new Map();
  bm.forEach((h, r) => fused.set(h.id, { rrf: 1 / (RRF_K + r + 1), title: h.title, source: h.source, bmRank: r + 1, denseRank: null }));
  de.forEach((d, r) => {
    const cur = fused.get(d.id);
    if (cur) { cur.rrf += 1 / (RRF_K + r + 1); cur.denseRank = r + 1; }
    else fused.set(d.id, { rrf: 1 / (RRF_K + r + 1), title: d.title, source: d.source, bmRank: null, denseRank: r + 1 });
  });
  return Array.from(fused.values()).sort((a, b) => b.rrf - a.rrf).slice(0, k);
}

const QUERIES = [
  "thawing tundra",
  "frozen ground melting under warming",
  "ocean current weakening in the north atlantic",
  "rising waters along coastlines threatening cities",
  "what about cars that run on electricity instead of gasoline",
  "trees grown together with crops in fields",
  "the icy crust at the top of the world is shrinking",
  "carbon-eating plants in tropical zones",
];

console.log("╔════════════════════════════════════════════════════════════════════════════╗");
console.log("║  BM25-only vs. BM25 + LSA (RRF) — side-by-side on paraphrase queries     ║");
console.log("╚════════════════════════════════════════════════════════════════════════════╝\n");

for (const q of QUERIES) {
  console.log(`▸ "${q}"`);
  const bm = bm25(q, 3);
  const hy = hybrid(q, 3);
  console.log("    BM25-only:");
  if (!bm.length) console.log("      (no hits)");
  for (const h of bm) console.log(`      ${h.source.padEnd(18)} · ${h.title}`);
  console.log("    Hybrid (BM25 + LSA via RRF):");
  for (const h of hy) {
    const tag = h.bmRank === null ? "dense-only" : h.denseRank === null ? "bm25-only" : `bm=${h.bmRank} dense=${h.denseRank}`;
    console.log(`      ${h.source.padEnd(18)} · ${h.title}  (${tag})`);
  }
  console.log("");
}
