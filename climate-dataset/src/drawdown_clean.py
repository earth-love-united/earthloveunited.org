#!/usr/bin/env python3
"""
drawdown_clean.py — Parse the Drawdown Explorer table dump into one
clean retrieval chunk per solution.

Three table schemas appear in the dump:

Schema A — Highly Recommended / Worthwhile rows with quantified impact:
    ...
    [sector]
    [parent name optionally ending with ':']
    [solution name]
    Classification
    [tier]
    Potential Emissions Avoided Gt CO₂‑eq/yr
    [range "x.xx to y.yy"]
    Speed of Action
    [Gradual | Fast | Emergency Brake]
    View Solution

Schema B — Coming Soon rows (not yet quantified):
    ...
    [sector]
    [parent name optionally ending with ':']
    [solution name]
    Classification
    [tier]
    View Solution

Schema C — Final matrix at the tail of the page (some solutions only appear
here, e.g. mangrove and peatland protection by climate zone):
    [parent name ending with ':']
    [sub-zone name]
    current [n]
    [low]
    [high]

This script parses all three and emits one cleaned JSONL row per solution.
"""

import json
import re
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).parent.parent.parent
RAW = ROOT / "climate-dataset" / "data" / "raw" / "drawdown_solutions_v2.json"
OUT_DIR = ROOT / "climate-dataset" / "data" / "processed"
OUT = OUT_DIR / "drawdown_clean.jsonl"

TIERS = {"Highly Recommended", "Worthwhile", "Keep Watching", "Not Recommended"}
SPEEDS = {"Gradual", "Fast", "Emergency Brake"}

# Known Drawdown sectors. New ones discovered in the dump are added here.
SECTORS = {
    "Buildings",
    "Buildings & Industry",
    "Buildings & Electricity",
    "Electricity",
    "Electricity & Industry",
    "Transportation",
    "Transportation & Industry",
    "Industry, Materials & Waste",
    "Food, Agriculture, Land & Ocean (FALO)",
    "FALO & Nature-Based Carbon Removal",
    "Nature-Based Carbon Removal",
    "Industrial Carbon Removal",
    "Other Energy",
    "Land",
    "Cross-Sector",
    "Population & Health",
}

# Phrases that mark a row as junk (filter labels, headers).
JUNK_NAMES = {
    "Classification", "View Solution", "Coming Soon",
    "— All Classifications —", "— All Sectors —",
    "— Filter by Sector —", "— Filter by Classification —",
}

RANGE_RE = re.compile(r"^\d+(?:\.\d+)?\s+to\s+\d+(?:\.\d+)?$")
NUM_RE = re.compile(r"^\d+(?:\.\d+)?$")


def find_sector(lines, end_idx):
    """Walk backward up to 8 lines from end_idx looking for a sector match."""
    for j in range(end_idx, max(-1, end_idx - 8), -1):
        if 0 <= j < len(lines) and lines[j] in SECTORS:
            return lines[j]
    return None


def parse_classification_rows(lines):
    """Schemas A and B — anchored on the 'Classification' label."""
    solutions = []
    n = len(lines)
    for i, ln in enumerate(lines):
        if ln != "Classification":
            continue
        # Name = the line immediately before. Skip if it's a junk label.
        name = lines[i - 1] if i > 0 else ""
        if name in JUNK_NAMES or name in TIERS or name in SECTORS or not name:
            continue
        # Skip if name is a number — table rendering artefact.
        if NUM_RE.match(name) or RANGE_RE.match(name):
            continue
        # Look up to 2 lines back for a parent label ending with ":".
        parent = lines[i - 2] if i >= 2 else ""
        if parent.endswith(":") and len(parent) > 2 and parent not in JUNK_NAMES:
            full_name = f"{parent[:-1].strip()}: {name}"
        else:
            full_name = name
        sector = find_sector(lines, i - 1) or "Unspecified"
        # Detect schema
        after = i + 1
        tier_in_block = lines[after] if after < n else ""
        if tier_in_block not in TIERS:
            continue
        after += 1
        nxt = lines[after] if after < n else ""
        if nxt == "View Solution":
            # Schema B: Coming Soon — no quantified range
            solutions.append({
                "name": full_name,
                "tier": tier_in_block,
                "sector": sector,
                "range": None,
                "speed": None,
                "quantified": False,
            })
        elif "Potential Emissions Avoided" in nxt or "Gt" in nxt:
            # Schema A: walk forward to grab range + speed.
            range_line = None
            speed = None
            j = after + 1
            while j < n and j < i + 12 and lines[j] != "View Solution":
                if RANGE_RE.match(lines[j]):
                    range_line = lines[j]
                elif lines[j] in SPEEDS:
                    speed = lines[j]
                j += 1
            solutions.append({
                "name": full_name,
                "tier": tier_in_block,
                "sector": sector,
                "range": range_line,
                "speed": speed,
                "quantified": bool(range_line),
            })
    return solutions


def parse_matrix_tail(lines):
    """Schema C — the matrix at the tail of the page where some solutions
    only appear (mangrove/peatland zones, forest zones, etc.).
    Pattern:
        [parent ending with ':']    (optional)
        [solution name]
        current [n|not determined]
        [low]
        [high]
    """
    solutions = []
    n = len(lines)
    i = 0
    while i < n - 4:
        ln = lines[i]
        # Look for a "current" marker that signals a matrix row.
        if not (ln.startswith("current ") or ln == "current not determined"):
            i += 1
            continue
        # The two lines below should be the low and high values.
        if not (NUM_RE.match(lines[i + 1] or "") and NUM_RE.match(lines[i + 2] or "")):
            i += 1
            continue
        lo = float(lines[i + 1])
        hi = float(lines[i + 2])
        # Name = lines[i-1]; parent = lines[i-2] if it ends with ":".
        name = lines[i - 1] if i > 0 else ""
        parent = lines[i - 2] if i >= 2 else ""
        if not name or name in JUNK_NAMES or name in TIERS or name in SECTORS:
            i += 3
            continue
        if NUM_RE.match(name):
            i += 3
            continue
        if parent.endswith(":") and len(parent) > 2:
            full_name = f"{parent[:-1].strip()}: {name}"
        else:
            full_name = name
        # Sector = walk back to find a known sector.
        sector = find_sector(lines, i - 1) or "Nature-Based Carbon Removal"
        solutions.append({
            "name": full_name,
            "tier": "Highly Recommended",  # matrix solutions are listed as actionable
            "sector": sector,
            "range": f"{lo:.2f} to {hi:.2f}",
            "speed": None,
            "quantified": True,
        })
        i += 3
    return solutions


def slugify(s: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_").lower()
    return s[:60]


def to_chunk(sol: dict) -> dict:
    name = sol["name"]
    sector = sol["sector"]
    tier = sol["tier"]
    speed = sol["speed"] or "—"
    rng = sol["range"]

    pieces = [f"Solution: {name}.", f"Sector: {sector}.",
              f"Project Drawdown classification: {tier}."]
    if speed and speed != "—":
        pieces.append(f"Speed of action: {speed}.")
    if rng:
        lo, hi = [float(x) for x in rng.split(" to ")]
        if lo == hi:
            pieces.append(
                f"Potential emissions avoided: {lo:.2f} Gt CO₂-equivalent per year."
            )
        else:
            pieces.append(
                f"Potential emissions avoided: {lo:.2f} to {hi:.2f} Gt CO₂-equivalent per year."
            )
    else:
        pieces.append(
            "Quantified emissions-reduction potential is not yet published "
            "for this solution (Project Drawdown lists it as Coming Soon)."
        )
    pieces.append(
        "Source: Project Drawdown Explorer — drawdown.org/solutions. Drawdown is a non-profit research organisation that ranks substantive climate solutions based on rigorous, science-based analysis."
    )

    topics = [sector, tier, "Project Drawdown solution"]
    if speed and speed != "—":
        topics.insert(2, speed)

    return {
        "id": f"drawdown_{slugify(name)}",
        "source": "Project Drawdown",
        "title": name,
        "text": " ".join(pieces),
        "url": "https://drawdown.org/solutions",
        "confidence": "high",
        "topics": topics,
    }


def main():
    if not RAW.exists():
        print(f"missing: {RAW}", file=sys.stderr)
        sys.exit(1)
    with RAW.open() as f:
        records = json.load(f)
    if not records:
        sys.exit("empty raw file")
    text = records[0]["text"]
    lines = [ln.strip() for ln in text.split("\n")]

    cls_rows = parse_classification_rows(lines)
    matrix_rows = parse_matrix_tail(lines)

    # Merge: dedupe by name (lowercased); matrix rows fill in solutions
    # missing from the Classification rows.
    by_name = {}
    for s in cls_rows:
        by_name[s["name"].lower()] = s
    matrix_added = 0
    for s in matrix_rows:
        key = s["name"].lower()
        if key not in by_name:
            by_name[key] = s
            matrix_added += 1
    unique = list(by_name.values())

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUT.open("w") as f:
        for s in unique:
            f.write(json.dumps(to_chunk(s), ensure_ascii=False) + "\n")

    tiers = Counter(s["tier"] for s in unique)
    sectors = Counter(s["sector"] for s in unique)
    quant = sum(1 for s in unique if s["quantified"])
    print(f"[drawdown_clean] classification anchors parsed: {len(cls_rows)}")
    print(f"[drawdown_clean] matrix-tail solutions added:   {matrix_added}")
    print(f"[drawdown_clean] unique total:                  {len(unique)} ({quant} quantified)")
    print(f"[drawdown_clean] tiers:   {dict(tiers)}")
    print(f"[drawdown_clean] sectors: {dict(sectors)}")
    print(f"[drawdown_clean] wrote {OUT}")
    print("[drawdown_clean] sample:")
    for s in unique[:8]:
        rng = s["range"] or "—"
        print(f"   - {s['name']:<55} [{s['tier']:<20}] {rng:>14} Gt/yr · {s['sector']}")


if __name__ == "__main__":
    main()
