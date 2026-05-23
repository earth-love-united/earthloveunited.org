#!/usr/bin/env python3
"""
replace_drawdown.py — Swap the 456 noisy Drawdown chunks in
data/climate-knowledge-curated.jsonl for the 157 cleanly-parsed
per-solution chunks from drawdown_clean.jsonl.

Idempotent: removes any existing Project Drawdown rows from the curated
file before appending the cleaned set. A timestamped backup of the
original file is written alongside.
"""

import json
import shutil
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).parent.parent
CURATED = ROOT / "data" / "climate-knowledge-curated.jsonl"
CLEAN = ROOT / "climate-dataset" / "data" / "processed" / "drawdown_clean.jsonl"


def main():
    if not CURATED.exists():
        raise SystemExit(f"missing {CURATED}")
    if not CLEAN.exists():
        raise SystemExit(f"missing {CLEAN} — run climate-dataset/src/drawdown_clean.py first")

    # Backup
    stamp = dt.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    backup = CURATED.with_suffix(f".jsonl.bak.{stamp}")
    shutil.copy(CURATED, backup)
    print(f"[backup] {CURATED} → {backup}")

    # Read current curated set
    keep = []
    dropped_drawdown = 0
    other_counts = {}
    with CURATED.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("source") == "Project Drawdown":
                dropped_drawdown += 1
                continue
            keep.append(obj)
            s = obj.get("source", "?")
            other_counts[s] = other_counts.get(s, 0) + 1

    # Append the cleaned Drawdown rows
    added = 0
    with CLEAN.open() as f:
        new_rows = [json.loads(l) for l in f if l.strip()]

    # Write back
    out = keep + new_rows
    with CURATED.open("w") as f:
        for row in out:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    added = len(new_rows)

    print(f"[replace] dropped Drawdown rows: {dropped_drawdown}")
    print(f"[replace] kept non-Drawdown rows: {len(keep)} ({other_counts})")
    print(f"[replace] added cleaned Drawdown rows: {added}")
    print(f"[replace] curated file now has {len(out)} chunks")


if __name__ == "__main__":
    main()
