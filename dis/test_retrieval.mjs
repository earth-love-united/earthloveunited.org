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

if (!existsSync(IDX_PATH)) {
  console.error(`❌ retrieval index missing — run: python3 dis/build_retrieval_index.py`);
  process.exit(1);
}
const INDEX = JSON.parse(readFileSync(IDX_PATH, "utf8"));
const PLEDGES = existsSync(PLEDGES_PATH) ? JSON.parse(readFileSync(PLEDGES_PATH, "utf8")) : null;
const PROJECTS = existsSync(PROJECTS_PATH) ? JSON.parse(readFileSync(PROJECTS_PATH, "utf8")) : null;
const PALEO = existsSync(PALEO_PATH) ? JSON.parse(readFileSync(PALEO_PATH, "utf8")) : null;

console.log(`[setup] index: ${INDEX.n} chunks · ${Object.keys(INDEX.post).length} terms · avgdl=${INDEX.avgdl}`);
console.log(`[setup] structured: pledges=${PLEDGES?._meta?.countries || 0} projects=${Object.keys(PROJECTS?.by_iso3 || {}).length} paleo=${PALEO?.rows?.length || 0}`);
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

function isInDomain(query, hits) {
  const tokens = tokenize(query);
  for (const t of tokens) {
    if (DOMAIN_TERMS.has(t)) return true;
    for (const d of DOMAIN_TERMS) if (d.startsWith(t) && t.length >= 4) return true;
  }
  if (hits && hits.length) {
    const tts = hits[0].topics || [];
    for (const tp of tts) {
      for (const t of tokenize(tp)) if (DOMAIN_TERMS.has(t)) return true;
    }
  }
  return false;
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
    expectSources: ["IPCC", "Wikipedia"],
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
    name: "Drawdown solutions",
    query: "What does Project Drawdown say about onshore wind?",
    expectSources: ["Project Drawdown"],
    expectTermInTopK: ["wind"],
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
];

let passed = 0, failed = 0;
const fails = [];

for (const t of TESTS) {
  const hits = search(t.query, 8);
  const country = detectCountry(t.query);
  const yrsBp = detectPaleo(t.query);

  // Assertions
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
    // Out-of-domain queries must be flagged by the domain gate so the
    // chat falls back to the refusal posture.
    if (isInDomain(t.query, hits)) {
      issues.push(`isInDomain() returned TRUE for out-of-domain query — refusal posture won't engage`);
    }
  }

  const ok = issues.length === 0;
  if (ok) passed++; else { failed++; fails.push({ name: t.name, issues }); }

  console.log(`${ok ? "✅" : "❌"}  ${t.name}`);
  console.log(`    query: "${t.query}"`);
  if (country) console.log(`    detected country: ${country}`);
  if (yrsBp != null) {
    const row = lookupPaleo(yrsBp);
    console.log(`    detected paleo yrs_bp=${yrsBp} → temp_c=${row?.temp_c} co2_ppm=${row?.co2_ppm}`);
  }
  console.log(`    top-3 hits:`);
  for (const h of hits.slice(0, 3)) {
    console.log(`      [${h.score.toFixed(2)}] ${h.source} · ${h.title}`);
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
