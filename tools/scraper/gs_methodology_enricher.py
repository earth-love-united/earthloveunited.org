"""
═══════════════════════════════════════════════════════════════════════════
  GOLD STANDARD METHODOLOGY ENRICHER
  
  1,524 GS projects have null methodology.
  
  Four-phase resolution strategy:
  
    Phase A — POA Parent Inheritance (VPAs inherit from parent POA)
    Phase B — API Detail Sweep (catch DB updates since last pull)
    Phase C — Type-Based Inference (≥70% confidence, tagged as inferred)
    Phase D — Berkeley VROD Cross-Reference (UC Berkeley research DB,
              CC BY 4.0, covers all 5 major registries)

  Combined resolution: ~491/1,524 (32.2%) → GS coverage 62.7% → 74.7%
═══════════════════════════════════════════════════════════════════════════
"""

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Optional
from collections import Counter

import httpx

logger = logging.getLogger("scraper.gs_enrich")

GS_API_BASE = "https://public-api.goldstandard.org"

HEADERS = {
    "Accept": "application/json",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Referer": "https://registry.goldstandard.org/",
}


def load_all_gs_projects(raw_jsonl_path: str) -> dict[str, dict]:
    """Load all GS projects into a dict keyed by string ID."""
    projects = {}
    with open(raw_jsonl_path) as f:
        for line in f:
            p = json.loads(line)
            projects[str(p["id"])] = p
    return projects


def find_gs_projects_needing_methodology(raw_jsonl_path: str) -> list[dict]:
    """Find GS projects with null/empty methodology."""
    needing = []
    total = 0
    with open(raw_jsonl_path) as f:
        for line in f:
            p = json.loads(line)
            total += 1
            methodology = p.get("methodology")
            if not methodology or methodology in ("null", "None", ""):
                needing.append(p)

    logger.info(
        f"GS methodology gap: {len(needing)}/{total} projects "
        f"({len(needing)/total*100:.1f}%) need enrichment"
    )
    return needing


# ═══════════════════════════════════════════════════════════════
#  PHASE A — POA Parent Inheritance
# ═══════════════════════════════════════════════════════════════

def resolve_via_poa_parent(
    null_projects: list[dict],
    all_projects: dict[str, dict],
    output_path: str,
) -> dict:
    """
    VPA projects inherit methodology from their parent POA.
    Check if the parent has methodology and assign it.
    """
    output = Path(output_path)
    stats = {"resolved": 0, "parent_also_null": 0, "not_vpa": 0}

    already_done = _load_already_done(output)

    for p in null_projects:
        if str(p["id"]) in already_done:
            continue

        poa_parent_id = p.get("poa_project_id")
        if not poa_parent_id:
            stats["not_vpa"] += 1
            continue

        parent = all_projects.get(str(poa_parent_id))
        if parent and parent.get("methodology"):
            result = {
                "id": str(p["id"]),
                "sustaincert_id": p.get("sustaincert_id"),
                "methodology": parent["methodology"],
                "source": "poa_parent_inheritance",
                "parent_id": str(poa_parent_id),
                "confidence": 1.0,
            }
            _append_result(output, result)
            stats["resolved"] += 1
        else:
            stats["parent_also_null"] += 1

    logger.info(
        f"Phase A (POA Parent): resolved={stats['resolved']}, "
        f"parent_null={stats['parent_also_null']}, "
        f"not_vpa={stats['not_vpa']}"
    )
    return stats


# ═══════════════════════════════════════════════════════════════
#  PHASE B — API Detail Sweep
# ═══════════════════════════════════════════════════════════════

async def resolve_via_api(
    null_projects: list[dict],
    output_path: str,
    delay: float = 0.3,
) -> dict:
    """
    Query the GS detail API for each null-methodology project.
    May catch updates that happened after the list API was cached.
    """
    output = Path(output_path)
    already_done = _load_already_done(output)
    pending = [p for p in null_projects if str(p["id"]) not in already_done]

    logger.info(f"Phase B: {len(pending)} projects to query via API ({len(already_done)} already done)")
    stats = {"queried": 0, "found": 0, "not_found": 0, "errors": 0}

    async with httpx.AsyncClient(
        timeout=20.0, follow_redirects=True, headers=HEADERS,
    ) as client:
        for i, project in enumerate(pending):
            pid = project["id"]
            try:
                r = await client.get(f"{GS_API_BASE}/projects/{pid}")
                stats["queried"] += 1

                if r.status_code == 200:
                    detail = r.json()
                    methodology = detail.get("methodology") if isinstance(detail, dict) else None

                    if methodology:
                        result = {
                            "id": str(pid),
                            "sustaincert_id": project.get("sustaincert_id"),
                            "methodology": methodology,
                            "source": "api_detail",
                            "confidence": 1.0,
                        }
                        _append_result(output, result)
                        stats["found"] += 1
                    else:
                        stats["not_found"] += 1
                elif r.status_code == 404:
                    stats["not_found"] += 1
                else:
                    stats["errors"] += 1
            except Exception as e:
                logger.warning(f"Error querying GS project {pid}: {e}")
                stats["errors"] += 1

            await asyncio.sleep(delay)

            if (i + 1) % 100 == 0:
                logger.info(
                    f"  Phase B progress: {i+1}/{len(pending)} | "
                    f"Found: {stats['found']} | Not found: {stats['not_found']}"
                )

    logger.info(
        f"Phase B (API Detail): queried={stats['queried']}, "
        f"found={stats['found']}, not_found={stats['not_found']}, "
        f"errors={stats['errors']}"
    )
    return stats


# ═══════════════════════════════════════════════════════════════
#  PHASE C — Type-Based Inference (High-Confidence Only)
# ═══════════════════════════════════════════════════════════════

def resolve_via_type_inference(
    null_projects: list[dict],
    all_projects: dict[str, dict],
    output_path: str,
    min_confidence: float = 0.70,
) -> dict:
    """
    Infer methodology from project type using the known type→methodology
    distribution from projects that DO have methodology.
    
    Only applies when the top methodology for a type exceeds min_confidence.
    Results are tagged source="type_inference" so Hermes can distinguish.
    """
    output = Path(output_path)
    already_done = _load_already_done(output)

    # Build type → methodology distribution from known projects
    type_meth: dict[str, Counter] = {}
    for p in all_projects.values():
        if p.get("methodology") and p.get("type"):
            t = p["type"]
            if t not in type_meth:
                type_meth[t] = Counter()
            type_meth[t][p["methodology"]] += 1

    # Build inference map (only high-confidence types)
    inference_map: dict[str, tuple[str, float]] = {}
    for t, counter in type_meth.items():
        total = sum(counter.values())
        top_meth, top_count = counter.most_common(1)[0]
        confidence = top_count / total
        if confidence >= min_confidence and total >= 10:
            inference_map[t] = (top_meth, confidence)

    logger.info(
        f"Phase C: {len(inference_map)} types with >{min_confidence*100:.0f}% confidence: "
        f"{', '.join(f'{t} ({c:.0%})' for t, (_, c) in inference_map.items())}"
    )

    stats = {"inferred": 0, "below_threshold": 0, "no_type": 0}

    for p in null_projects:
        if str(p["id"]) in already_done:
            continue

        project_type = p.get("type")
        if not project_type:
            stats["no_type"] += 1
            continue

        if project_type in inference_map:
            methodology, confidence = inference_map[project_type]
            result = {
                "id": str(p["id"]),
                "sustaincert_id": p.get("sustaincert_id"),
                "methodology": methodology,
                "source": "type_inference",
                "inferred_from_type": project_type,
                "confidence": round(confidence, 3),
            }
            _append_result(output, result)
            stats["inferred"] += 1
        else:
            stats["below_threshold"] += 1

    logger.info(
        f"Phase C (Type Inference): inferred={stats['inferred']}, "
        f"below_threshold={stats['below_threshold']}, "
        f"no_type={stats['no_type']}"
    )
    return stats


# ═══════════════════════════════════════════════════════════════
#  PHASE D — Berkeley VROD Cross-Reference
# ═══════════════════════════════════════════════════════════════

def resolve_via_berkeley_vrod(
    null_projects: list[dict],
    berkeley_xlsx_path: str,
    output_path: str,
) -> dict:
    """
    Cross-reference against the Berkeley Voluntary Registry Offsets Database
    (UC Berkeley Carbon Trading Project). CC BY 4.0.
    
    The VROD contains 4,000+ GS projects with methodology data that
    GS's own API doesn't return for ~1,500 projects.
    
    Download: https://gspp.berkeley.edu/berkeley-carbon-trading-project/offsets-database
    """
    try:
        import openpyxl
    except ImportError:
        logger.warning("Phase D requires openpyxl. Install: pip install openpyxl")
        return {"resolved": 0, "not_found": 0, "error": "openpyxl not installed"}

    output = Path(output_path)
    already_done = _load_already_done(output)

    # Build Berkeley GS methodology lookup: GS{sustaincert_id} → methodology
    berkeley_meth: dict[str, str] = {}
    wb = openpyxl.load_workbook(berkeley_xlsx_path, read_only=True, data_only=True)
    ws = wb["PROJECTS"]
    for row in ws.iter_rows(min_row=5, max_col=15, values_only=True):
        registry = str(row[2]).strip() if row[2] else ""
        if registry != "GOLD":
            continue
        berkeley_id = str(row[0]).strip() if row[0] else ""
        methodology = str(row[8]).strip() if row[8] else None
        if methodology and methodology not in ("None", "", "nan"):
            berkeley_meth[berkeley_id] = methodology
    wb.close()

    logger.info(f"Phase D: Loaded {len(berkeley_meth)} GS methodologies from Berkeley VROD")

    stats = {"resolved": 0, "not_found": 0}

    for p in null_projects:
        if str(p["id"]) in already_done:
            continue

        sid = p.get("sustaincert_id")
        if sid:
            berkeley_key = f"GS{sid}"
            if berkeley_key in berkeley_meth:
                result = {
                    "id": str(p["id"]),
                    "sustaincert_id": sid,
                    "methodology": berkeley_meth[berkeley_key],
                    "source": "berkeley_vrod",
                    "confidence": 1.0,
                }
                _append_result(output, result)
                stats["resolved"] += 1
            else:
                stats["not_found"] += 1
        else:
            stats["not_found"] += 1

    logger.info(
        f"Phase D (Berkeley VROD): resolved={stats['resolved']}, "
        f"not_found={stats['not_found']}"
    )
    return stats


# ═══════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════

def _load_already_done(output_path: Path) -> set[str]:
    """Load IDs already written to the output file."""
    done = set()
    if output_path.exists():
        with open(output_path) as f:
            for line in f:
                try:
                    d = json.loads(line)
                    if d.get("id"):
                        done.add(str(d["id"]))
                except json.JSONDecodeError:
                    continue
    return done


def _append_result(output_path: Path, result: dict):
    """Append a single result to the output JSONL."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "a") as f:
        f.write(json.dumps(result, ensure_ascii=False) + "\n")


def summary(output_path: str) -> dict:
    """Summarize enrichment results by source."""
    if not Path(output_path).exists():
        return {"total": 0}

    sources = Counter()
    total = 0
    with open(output_path) as f:
        for line in f:
            try:
                d = json.loads(line)
                sources[d.get("source", "unknown")] += 1
                total += 1
            except json.JSONDecodeError:
                continue

    return {"total": total, "by_source": dict(sources)}
