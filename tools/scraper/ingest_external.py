"""
═══════════════════════════════════════════════════════════════════════════
  EXTERNAL DATA INGESTOR

  Converts external databases (CarbonPlan, Berkeley VROD) into
  Hermes-compatible JSONL for merging into the unified carbon dataset.
  
  Sources:
    - CarbonPlan OffsetsDB: ACR, CAR, CERCARBONO, Isometric, ART TREES
    - Berkeley VROD: Cross-validation + supplementary fields
═══════════════════════════════════════════════════════════════════════════
"""

import csv
import json
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger("scraper.ingest")

# Registry name mapping: CarbonPlan → Hermes standard
REGISTRY_MAP = {
    "american-carbon-registry": "ACR",
    "climate-action-reserve": "CAR",
    "cercarbono": "CERCARBONO",
    "isometric": "ISOMETRIC",
    "art-trees": "ART",
    "verra": "VCS",
    "gold-standard": "GS",
}

# Status mapping
STATUS_MAP = {
    "registered": "Registered",
    "listed": "Listed",
    "completed": "Completed",
    "transferred": "Transferred",
    "under development": "Under Development",
}


def ingest_carbonplan(
    csv_path: str,
    output_dir: str,
    registries: list[str] | None = None,
) -> dict:
    """
    Convert CarbonPlan OffsetsDB projects.csv into per-registry JSONL files.
    
    Args:
        csv_path: Path to CarbonPlan projects.csv
        output_dir: Output directory for JSONL files
        registries: List of registries to extract (None = new ones only)
    """
    if registries is None:
        registries = [
            "american-carbon-registry",
            "climate-action-reserve",
            "cercarbono",
            "isometric",
            "art-trees",
        ]
    
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    
    stats = {}
    
    # Group projects by registry
    by_registry: dict[str, list[dict]] = {}
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            reg = row["registry"]
            if reg in registries:
                if reg not in by_registry:
                    by_registry[reg] = []
                by_registry[reg].append(row)
    
    for reg, projects in by_registry.items():
        hermes_name = REGISTRY_MAP.get(reg, reg.upper())
        out_path = output / f"{hermes_name.lower()}_projects.jsonl"
        
        count = 0
        with open(out_path, "w") as f:
            for row in projects:
                # Normalize protocol field (can be a JSON array string)
                protocol = row.get("protocol", "")
                if protocol.startswith("["):
                    try:
                        protocols = json.loads(protocol.replace("'", '"'))
                        protocol = protocols[0] if protocols else ""
                    except (json.JSONDecodeError, IndexError):
                        pass
                
                project = {
                    "project_id": row.get("project_id", ""),
                    "name": row.get("name", ""),
                    "registry": hermes_name,
                    "status": STATUS_MAP.get(
                        row.get("status", "").lower(),
                        row.get("status", ""),
                    ),
                    "methodology": protocol,
                    "project_type": row.get("project_type", ""),
                    "category": row.get("category", ""),
                    "country": row.get("country", ""),
                    "proponent": row.get("proponent", ""),
                    "listed_at": row.get("listed_at", ""),
                    "first_issuance_at": row.get("first_issuance_at", ""),
                    "credits_issued": _parse_int(row.get("issued", "")),
                    "credits_retired": _parse_int(row.get("retired", "")),
                    "is_compliance": row.get("is_compliance", "").lower() == "true",
                    "project_url": row.get("project_url", ""),
                    "source": "carbonplan_offsetsdb",
                    "ingested_at": datetime.utcnow().isoformat() + "Z",
                }
                f.write(json.dumps(project, ensure_ascii=False) + "\n")
                count += 1
        
        stats[hermes_name] = count
        logger.info(f"Ingested {count} {hermes_name} projects → {out_path}")
    
    return stats


def ingest_credits(
    csv_path: str,
    output_path: str,
    registries: list[str] | None = None,
) -> dict:
    """
    Convert CarbonPlan credits.csv into a unified credits JSONL.
    This gives us vintage-level credit issuance and retirement data.
    """
    if registries is None:
        registries = [
            "american-carbon-registry",
            "climate-action-reserve",
            "cercarbono",
            "isometric",
            "art-trees",
        ]
    
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    
    count = 0
    with open(csv_path) as f_in, open(output, "w") as f_out:
        reader = csv.DictReader(f_in)
        for row in reader:
            reg = row.get("registry", "")
            if reg not in registries:
                continue
            
            hermes_name = REGISTRY_MAP.get(reg, reg.upper())
            credit = {
                "project_id": row.get("project_id", ""),
                "registry": hermes_name,
                "transaction_date": row.get("transaction_date", ""),
                "transaction_type": row.get("transaction_type", ""),
                "quantity": _parse_int(row.get("quantity", "")),
                "vintage": row.get("vintage", ""),
                "source": "carbonplan_offsetsdb",
            }
            f_out.write(json.dumps(credit, ensure_ascii=False) + "\n")
            count += 1
    
    logger.info(f"Ingested {count} credit transactions → {output}")
    return {"total_credits": count}


def _parse_int(val: str) -> int | None:
    """Parse integer from string, handling floats and empties."""
    if not val or val == "":
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None
