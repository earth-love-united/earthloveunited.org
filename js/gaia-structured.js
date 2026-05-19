/**
 * GAIA STRUCTURED — verified, typed lookups over Earth Love United's
 * curated datasets. Sits next to GaiaRetrieval: retrieval handles
 * unstructured prose, this handles "the answer is literally a row".
 *
 * Datasets loaded lazily on first use:
 *   /dist/knowledge/pledges.json
 *   /dist/knowledge/projects-by-country.json
 *   /dist/knowledge/paleo.json
 *
 * Public surface (attached to window.GaiaStructured):
 *   await GaiaStructured.ready()
 *   GaiaStructured.detect(text)        → { country?, projects?, paleo? }
 *   GaiaStructured.lookupCountry(name) → pledge + trajectory row
 *   GaiaStructured.lookupProjects(name|iso) → aggregate row
 *   GaiaStructured.lookupPaleo(yrsBp)  → nearest paleo row
 *   GaiaStructured.buildContext(detection) → { text, sources }
 */

window.GaiaStructured = (function () {
  let _pledges = null;
  let _projects = null;
  let _paleo = null;
  let _loading = null;
  let _loaded = false;
  // Lower-cased name → canonical country name. Built on load.
  let _countryNameIndex = null;

  async function _fetchJson(url) {
    const r = await fetch(url, { cache: "force-cache" });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  }

  function load() {
    if (_loading) return _loading;
    _loading = (async () => {
      try {
        const [pl, pr, pa] = await Promise.all([
          _fetchJson("/dist/knowledge/pledges.json").catch(() => null),
          _fetchJson("/dist/knowledge/projects-by-country.json").catch(() => null),
          _fetchJson("/dist/knowledge/paleo.json").catch(() => null),
        ]);
        _pledges = pl;
        _projects = pr;
        _paleo = pa;
        _countryNameIndex = _buildNameIndex();
        _loaded = !!(pl || pr || pa);
        console.log(
          `[GaiaStructured] loaded · pledges:${pl ? pl._meta?.countries : 0}` +
          ` projects:${pr ? Object.keys(pr.by_iso3).length : 0}` +
          ` paleo:${pa ? pa.rows.length : 0}`
        );
      } catch (e) {
        console.warn("[GaiaStructured] load failed:", e.message);
        _loaded = false;
      }
      return _loaded;
    })();
    return _loading;
  }

  function ready() { return _loading || load(); }

  function _buildNameIndex() {
    const idx = new Map();
    const addAlias = (alias, canonical) => {
      if (alias) idx.set(alias.toLowerCase().trim(), canonical);
    };
    if (_pledges && _pledges.countries) {
      for (const name of Object.keys(_pledges.countries)) {
        addAlias(name, name);
        const iso = _pledges.countries[name].iso;
        if (iso) addAlias(iso, name);
      }
    }
    // A few common nicknames / variants that won't match by raw lookup.
    const aliases = {
      "usa": "United States",
      "us": "United States",
      "u.s.": "United States",
      "u.s.a.": "United States",
      "america": "United States",
      "uk": "United Kingdom",
      "u.k.": "United Kingdom",
      "britain": "United Kingdom",
      "england": "United Kingdom",
      "turkiye": "Turkey",
      "türkiye": "Turkey",
      "russia": "Russian Federation",
      "south korea": "Republic of Korea",
      "korea": "Republic of Korea",
      "north korea": "Democratic People's Republic of Korea",
      "iran": "Iran (Islamic Republic of)",
      "vietnam": "Viet Nam",
      "ivory coast": "Cote d'Ivoire",
      "drc": "Democratic Republic of the Congo",
      "congo": "Democratic Republic of the Congo",
      "burma": "Myanmar",
      "czech republic": "Czechia",
      "swaziland": "Eswatini",
      "macedonia": "North Macedonia",
      "syria": "Syrian Arab Republic",
      "tanzania": "United Republic of Tanzania",
      "venezuela": "Venezuela (Bolivarian Republic of)",
      "bolivia": "Bolivia (Plurinational State of)",
      "moldova": "Republic of Moldova",
      "laos": "Lao People's Democratic Republic",
      "brunei": "Brunei Darussalam",
    };
    for (const [a, c] of Object.entries(aliases)) {
      // Only add aliases that resolve to a country actually present.
      if (_pledges && _pledges.countries[c]) addAlias(a, c);
      else if (_pledges) {
        // Try a case-insensitive match for the canonical name.
        for (const real of Object.keys(_pledges.countries)) {
          if (real.toLowerCase() === c.toLowerCase()) { addAlias(a, real); break; }
        }
      }
    }
    return idx;
  }

  // ─── Country lookup ──────────────────────────────────────────────
  function lookupCountry(query) {
    if (!_pledges || !query) return null;
    const key = query.toLowerCase().trim();
    const canonical = _countryNameIndex.get(key);
    if (!canonical) return null;
    const row = _pledges.countries[canonical];
    if (!row) return null;
    return { country: canonical, ...row };
  }

  // ─── Project aggregate lookup ───────────────────────────────────
  function lookupProjects(query) {
    if (!_projects || !query) return null;
    const key = query.toLowerCase().trim();
    // Try ISO3 first
    const upper = key.toUpperCase();
    if (_projects.by_iso3[upper]) {
      return _projects.by_iso3[upper];
    }
    // Resolve via the country name index
    const canonical = _countryNameIndex && _countryNameIndex.get(key);
    if (canonical) {
      const iso = (_pledges.countries[canonical] || {}).iso;
      if (iso && _projects.by_iso3[iso]) {
        return _projects.by_iso3[iso];
      }
    }
    // Fallback: case-insensitive country name scan
    for (const entry of Object.values(_projects.by_iso3)) {
      if (entry.country && entry.country.toLowerCase() === key) return entry;
    }
    return null;
  }

  function globalProjectTotals() {
    return _projects ? _projects.totals : null;
  }

  // ─── Paleo lookup ───────────────────────────────────────────────
  function lookupPaleo(yrsBp) {
    if (!_paleo || !_paleo.rows.length) return null;
    let best = _paleo.rows[0];
    let bestDist = Math.abs(best.yrs_bp - yrsBp);
    for (const r of _paleo.rows) {
      const d = Math.abs(r.yrs_bp - yrsBp);
      if (d < bestDist) { best = r; bestDist = d; }
    }
    return best;
  }

  // ─── Detection — turn free-form text into structured query intents ─
  // Returns { country?, projects?, paleoYrsBp? }. Caller can use multiple.
  function detect(text) {
    if (!_loaded || !text) return {};
    const t = text.toLowerCase();
    const out = {};

    // Country: try multi-word match (longest first) against the alias index.
    // Cheap heuristic — for "how is brazil doing on climate" we want "brazil".
    if (_countryNameIndex && _countryNameIndex.size) {
      const aliasList = Array.from(_countryNameIndex.keys()).sort((a, b) => b.length - a.length);
      for (const alias of aliasList) {
        // Word-boundary match
        const re = new RegExp(`(^|[^A-Za-z])${escapeRe(alias)}([^A-Za-z]|$)`, "i");
        if (re.test(t)) {
          out.country = _countryNameIndex.get(alias);
          break;
        }
      }
    }

    // Carbon-project intent — "carbon projects in X", "offset projects",
    // "verra", "gold standard", "credits issued"
    if (/(carbon\s+project|offset\s+project|carbon\s+credit|credits?\s+issued|verra|gold\s+standard|registry)/i.test(text)) {
      out.projects = true;
    }

    // Paleo intent: "X years ago", "X thousand years bp", "holocene", "ice age",
    // "younger dryas", "1000 yrs bp"
    const yrsBpMatch = text.match(/(\d{1,5})\s*(?:k|kyr|thousand)\s*(?:years?\s*)?(?:ago|bp|before)/i)
      || text.match(/(\d{2,5})\s*(?:years?|yr)\s*(?:ago|bp|before)/i);
    if (yrsBpMatch) {
      let n = parseInt(yrsBpMatch[1], 10);
      if (/k|kyr|thousand/i.test(yrsBpMatch[0])) n *= 1000;
      out.paleoYrsBp = n;
    } else if (/holocene|younger\s*dryas|last\s*glacial|ice\s*age|paleo/i.test(t)) {
      // No explicit year — sample a meaningful point.
      out.paleoYrsBp = /younger\s*dryas/i.test(t) ? 12000
        : /last\s*glacial|ice\s*age/i.test(t) ? 20000
        : 8000;
    }

    return out;
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // ─── Context builder for the prompt ──────────────────────────────
  function buildContext(detection) {
    if (!detection || !_loaded) return { text: "", sources: [] };
    const lines = [];
    const sources = [];

    if (detection.country) {
      const c = lookupCountry(detection.country);
      if (c) {
        const tag = `N${sources.length + 1}`;
        const p = c.pledge || {};
        const traj = (c.trajectory || []).slice(-6);
        const trajStr = traj.map(r => `${r.y}: ${r.total != null ? r.total + " MtCO₂e" : "—"}`).join("; ");
        const pledgeStr = p.target
          ? `${p.target}${p.target_year ? " (target year " + p.target_year + ")" : ""}${p.conditionality ? " · " + p.conditionality : ""}`
          : "no NDC target on record";
        lines.push(
          `[${tag}] COUNTRY: ${c.country} (${c.iso || "?"})\n` +
          `NDC pledge: ${pledgeStr}\n` +
          `Submission: ${p.submission_date || "—"}${p.ndc_version ? " · " + p.ndc_version : ""}\n` +
          `Emissions trajectory (total MtCO₂e): ${trajStr || "—"}\n` +
          `Latest year on record: ${c.latest_year} · fossil CO₂: ${c.latest_co2} MtCO₂`
        );
        sources.push({
          tag, kind: "pledge",
          title: `${c.country} — NDC pledge & emissions trajectory`,
          source: "Climate Watch / Global Carbon Budget (ELU pledge-vs-reality dataset)",
          url: null,
        });
      }

      if (detection.projects) {
        const pr = lookupProjects(detection.country);
        if (pr) {
          const tag = `P${sources.length + 1}`;
          const methods = (pr.top_methodologies || []).map(([m, n]) => `${m} (${n})`).join("; ");
          lines.push(
            `[${tag}] CARBON PROJECTS: ${pr.country} (${pr.iso3})\n` +
            `Registered projects: ${pr.count}\n` +
            `Est. annual reduction: ${pr.annual_reduction_tco2.toLocaleString()} tCO₂\n` +
            `Credits issued: ${pr.credits_issued.toLocaleString()} · retired: ${pr.credits_retired.toLocaleString()}\n` +
            `Top methodologies: ${methods || "—"}\n` +
            `Registries: ${Object.entries(pr.registries || {}).map(([k, v]) => `${k}:${v}`).join(", ") || "—"}`
          );
          sources.push({
            tag, kind: "projects",
            title: `${pr.country} — carbon project aggregate`,
            source: "Verra + Gold Standard (ELU unified carbon registry dataset)",
            url: null,
          });
        }
      }
    } else if (detection.projects) {
      const totals = globalProjectTotals();
      if (totals) {
        const tag = `P${sources.length + 1}`;
        lines.push(
          `[${tag}] GLOBAL CARBON PROJECTS (Verra + Gold Standard, unified)\n` +
          `Total projects: ${totals.projects} across ${totals.countries} countries\n` +
          `Aggregate annual reduction: ${totals.annual_reduction_tco2.toLocaleString()} tCO₂\n` +
          `Credits issued: ${totals.credits_issued.toLocaleString()} · retired: ${totals.credits_retired.toLocaleString()}`
        );
        sources.push({
          tag, kind: "projects",
          title: "Global carbon project aggregate",
          source: "Verra + Gold Standard (ELU unified carbon registry dataset)",
          url: null,
        });
      }
    }

    if (detection.paleoYrsBp != null) {
      const r = lookupPaleo(detection.paleoYrsBp);
      if (r) {
        const tag = `H${sources.length + 1}`;
        lines.push(
          `[${tag}] PALEOCLIMATE at ~${r.yrs_bp.toLocaleString()} years BP\n` +
          `GISP2 temperature (°C, ice-core δ¹⁸O): ${r.temp_c}\n` +
          `EPICA Dome C CO₂: ${r.co2_ppm} ppm\n` +
          `Solar Δ¹⁴C: ${r.solar_14c}‰ · Geomagnetic VADM: ${r.geomag}\n` +
          `Global sea-level anomaly: ${r.sea_level_m} m`
        );
        sources.push({
          tag, kind: "paleo",
          title: `Paleoclimate matrix at ${r.yrs_bp} yrs BP`,
          source: "GISP2 + EPICA Dome C + INTCAL solar 14C + GIA sea-level (ELU holocene-bifurcation dataset)",
          url: null,
        });
      }
    }

    return { text: lines.join("\n\n"), sources };
  }

  return {
    load,
    ready,
    detect,
    lookupCountry,
    lookupProjects,
    globalProjectTotals,
    lookupPaleo,
    buildContext,
    get loaded() { return _loaded; },
  };
})();

if (typeof window !== "undefined") {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(() => window.GaiaStructured.load(), { timeout: 5000 });
  } else {
    setTimeout(() => window.GaiaStructured.load(), 1800);
  }
}
