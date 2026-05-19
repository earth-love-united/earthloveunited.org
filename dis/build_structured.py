#!/usr/bin/env python3
"""
build_structured.py — Structured-data sidecars for grounded GAIA answers

Builds three small JSON files that the chat can look up by name/ISO/year
without going through retrieval:

  dist/knowledge/pledges.json            country → NDC + emission trajectory
  dist/knowledge/projects-by-country.json   ISO3 → carbon-project aggregates
  dist/knowledge/paleo.json              holocene 12.5kyr matrix

These are tiny on the wire (<500 KB combined) and let GAIA answer with
verified per-country facts.
"""

import json
import csv
import re
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
OUT_DIR = ROOT / "dist" / "knowledge"
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────
# 1. Pledges + emission trajectory per country
# ─────────────────────────────────────────────────────────────────────
def build_pledges():
    src = ROOT / "carbon-projects" / "pledge-reality" / "data" / "output" / "pledge_vs_reality_enriched.csv"
    if not src.exists():
        print(f"[pledges] missing: {src}")
        return

    rows_by_country = defaultdict(list)
    with src.open() as f:
        for row in csv.DictReader(f):
            country = (row.get("country") or "").strip()
            if not country:
                continue
            rows_by_country[country].append(row)

    out = {}
    for country, rows in rows_by_country.items():
        rows.sort(key=lambda r: int(r["year"]) if r.get("year", "").isdigit() else 0)
        latest = rows[-1]
        iso = (latest.get("iso_code") or "").strip()
        # Build a trajectory: every 5 years if possible
        traj = []
        for r in rows:
            y = r.get("year")
            try:
                y = int(y)
            except (TypeError, ValueError):
                continue
            if y % 5 != 0 and y != int(rows[-1]["year"]):
                continue
            try:
                co2 = float(r["fossil_co2_mtCO2"]) if r.get("fossil_co2_mtCO2") else None
                lulucf = float(r["lulucf_co2_mtCO2"]) if r.get("lulucf_co2_mtCO2") else None
                total = float(r["total_co2_mtCO2"]) if r.get("total_co2_mtCO2") else None
            except ValueError:
                continue
            traj.append({"y": y, "co2": co2, "lulucf": lulucf, "total": total})

        # Pledge metadata — take the most recent non-empty
        pledge = {}
        for r in reversed(rows):
            if r.get("cw_ghg_target") and not pledge.get("target"):
                pledge["target"] = r["cw_ghg_target"]
                pledge["target_type"] = r.get("cw_ghg_target_type") or None
                pledge["target_year"] = _to_int(r.get("cw_target_year")) or _to_int(r.get("ndc_target_year"))
                pledge["baseline_year"] = _to_int(r.get("cw_baseline_year"))
                pledge["reduction_pct"] = _to_float(r.get("cw_reduction_pct"))
                pledge["reduction_pct_upper"] = _to_float(r.get("cw_reduction_pct_upper"))
                pledge["target_mtco2e"] = _to_float(r.get("cw_target_mtco2e"))
                pledge["conditionality"] = r.get("cw_conditionality") or None
                pledge["submission_date"] = r.get("submission_date") or None
                pledge["ndc_version"] = r.get("ndc_version") or None
                pledge["summary"] = r.get("cw_summary") or None
                break

        out[country] = {
            "iso": iso,
            "pledge": pledge if pledge else None,
            "trajectory": traj,
            "latest_year": int(rows[-1]["year"]) if rows[-1].get("year", "").isdigit() else None,
            "latest_co2": _to_float(rows[-1].get("fossil_co2_mtCO2")),
        }

    # Also write an ISO → country lookup so chat can resolve "USA" / "DEU"
    iso_index = {v["iso"]: k for k, v in out.items() if v.get("iso")}

    payload = {
        "v": 1,
        "countries": out,
        "iso_index": iso_index,
        "_meta": {
            "source": "Climate Watch NDC + Global Carbon Budget (pledge_vs_reality_enriched)",
            "rows_in": sum(len(v["trajectory"]) for v in out.values()),
            "countries": len(out),
        },
    }
    path = OUT_DIR / "pledges.json"
    path.write_text(json.dumps(payload, separators=(",", ":")))
    kb = path.stat().st_size / 1024
    print(f"[pledges] {len(out)} countries · {kb:.0f} KB → {path}")


def _to_int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _to_float(v):
    try:
        return round(float(v), 3)
    except (TypeError, ValueError):
        return None


# ─────────────────────────────────────────────────────────────────────
# 2. Carbon projects aggregated per country
# ─────────────────────────────────────────────────────────────────────
def build_projects():
    src = ROOT / "carbon-projects" / "unified" / "carbon_projects_final.jsonl"
    if not src.exists():
        print(f"[projects] missing: {src}")
        return

    by_country = defaultdict(lambda: {
        "country": None,
        "iso3": None,
        "count": 0,
        "methodologies": defaultdict(int),
        "categories": defaultdict(int),
        "statuses": defaultdict(int),
        "annual_reduction_tco2": 0.0,
        "credits_issued": 0.0,
        "credits_retired": 0.0,
        "registries": defaultdict(int),
    })

    total = 0
    with src.open() as f:
        for line in f:
            try:
                p = json.loads(line)
            except json.JSONDecodeError:
                continue
            total += 1
            loc = p.get("location") or {}
            iso = loc.get("country_code_iso3") or "UNK"
            entry = by_country[iso]
            entry["country"] = loc.get("country") or entry["country"]
            entry["iso3"] = iso
            entry["count"] += 1

            pt = p.get("project_type") or {}
            mn = pt.get("methodology_name") or pt.get("methodology") or "Unknown"
            cat = pt.get("category") or "uncategorised"
            entry["methodologies"][mn] += 1
            entry["categories"][cat] += 1
            entry["statuses"][p.get("status") or "unknown"] += 1

            cr = p.get("crediting") or {}
            for key in ("estimated_annual_reduction_tco2", "credits_issued", "credits_retired"):
                v = cr.get(key)
                if isinstance(v, (int, float)):
                    out_key = key if key == "estimated_annual_reduction_tco2" else key
                    if key == "estimated_annual_reduction_tco2":
                        entry["annual_reduction_tco2"] += v
                    elif key == "credits_issued":
                        entry["credits_issued"] += v
                    elif key == "credits_retired":
                        entry["credits_retired"] += v

            for r in p.get("registry_ids") or []:
                reg = (r or {}).get("registry") or "unknown"
                entry["registries"][reg] += 1

    # Sort top methodologies & categories per country
    out = {}
    for iso, entry in by_country.items():
        out[iso] = {
            "country": entry["country"],
            "iso3": iso,
            "count": entry["count"],
            "annual_reduction_tco2": round(entry["annual_reduction_tco2"]),
            "credits_issued": round(entry["credits_issued"]),
            "credits_retired": round(entry["credits_retired"]),
            "top_methodologies": sorted(entry["methodologies"].items(), key=lambda x: -x[1])[:5],
            "categories": sorted(entry["categories"].items(), key=lambda x: -x[1])[:5],
            "statuses": dict(entry["statuses"]),
            "registries": dict(entry["registries"]),
        }

    # Global totals
    totals = {
        "projects": total,
        "annual_reduction_tco2": round(sum(c["annual_reduction_tco2"] for c in out.values())),
        "credits_issued": round(sum(c["credits_issued"] for c in out.values())),
        "credits_retired": round(sum(c["credits_retired"] for c in out.values())),
        "countries": len(out),
    }

    payload = {
        "v": 1,
        "by_iso3": out,
        "totals": totals,
        "_meta": {
            "source": "carbon-projects/unified/carbon_projects_final.jsonl",
            "registries": "Verra + Gold Standard (unified, deduplicated)",
        },
    }
    path = OUT_DIR / "projects-by-country.json"
    path.write_text(json.dumps(payload, separators=(",", ":")))
    kb = path.stat().st_size / 1024
    print(f"[projects] {len(out)} countries · {total} projects · {kb:.0f} KB → {path}")


# ─────────────────────────────────────────────────────────────────────
# 3. Holocene paleoclimate matrix
# ─────────────────────────────────────────────────────────────────────
def build_paleo():
    src = ROOT / "holocene-bifurcation" / "data" / "processed" / "holocene_bifurcation_base.csv"
    if not src.exists():
        print(f"[paleo] missing: {src}")
        return

    rows = []
    with src.open() as f:
        for r in csv.DictReader(f):
            try:
                rows.append({
                    "yrs_bp": int(r["years_bp"]),
                    "temp_c": _to_float(r.get("gisp2_temp_c")),
                    "co2_ppm": _to_float(r.get("epica_co2_ppm")),
                    "solar_14c": _to_float(r.get("solar_delta_14c")),
                    "geomag": _to_float(r.get("geomagnetic_vadm")),
                    "sea_level_m": _to_float(r.get("global_sea_level_anomaly_m")),
                })
            except (KeyError, ValueError):
                continue

    rows.sort(key=lambda r: r["yrs_bp"])

    payload = {
        "v": 1,
        "rows": rows,
        "_meta": {
            "source": "holocene-bifurcation/data/processed/holocene_bifurcation_base.csv",
            "fields": {
                "yrs_bp": "years before present (0 = 1950)",
                "temp_c": "GISP2 ice-core δ¹⁸O-derived temperature (°C)",
                "co2_ppm": "EPICA Dome C CO₂ (ppm)",
                "solar_14c": "Δ¹⁴C solar activity proxy (‰)",
                "geomag": "geomagnetic VADM (10²² Am²)",
                "sea_level_m": "global mean sea-level anomaly (m)",
            },
            "rows_in": len(rows),
            "range_kyr_bp": [rows[0]["yrs_bp"], rows[-1]["yrs_bp"]] if rows else None,
        },
    }
    path = OUT_DIR / "paleo.json"
    path.write_text(json.dumps(payload, separators=(",", ":")))
    kb = path.stat().st_size / 1024
    print(f"[paleo] {len(rows)} rows · {kb:.0f} KB → {path}")


# ─────────────────────────────────────────────────────────────────────
# 4. Manifest
# ─────────────────────────────────────────────────────────────────────
def build_manifest():
    files = {}
    for p in sorted(OUT_DIR.glob("*.json")) + sorted(OUT_DIR.glob("*.json.gz")):
        files[p.name] = {"bytes": p.stat().st_size}
    manifest = {
        "v": 1,
        "built": _build_timestamp(),
        "files": files,
    }
    path = OUT_DIR / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2))
    print(f"[manifest] {path}")


def _build_timestamp():
    import datetime as dt
    return dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


if __name__ == "__main__":
    build_pledges()
    build_projects()
    build_paleo()
    build_manifest()
