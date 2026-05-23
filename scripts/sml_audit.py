#!/usr/bin/env python3
"""Audit every contract-registered module for SML compliance."""
import re
from pathlib import Path

PROJECT_ROOT = Path("/Users/ekmelozdemir/earthloveunited.org")

# All files with contracts
CONTRACTED_FILES = [
    "js/data.js",
    "js/globe.js",
    "js/globe-modes.js",
    "js/globe-events.js",
    "js/globe-ndvi.js",
    "js/globe-restore.js",
    "js/gaia-nodes.js",
    "js/gaia-engagement.js",
    "js/globe-overlay.js",
    "js/site-panel.js",
    "js/gaia-bubble.js",
    "js/pledge-wall.js",
    "js/ndvi-verifier.js",
    "js/carbon-clock.js",
    "js/registry-check.js",
    "js/quiz.js",
    "js/biomes.js",
    "js/cycle.js",
    "js/counters.js",
    "js/country-data.js",
    "js/delegation.js",
    "js/scenario.js",
    "js/gaia-journal.js",
    "js/gaia-voice.js",
    "js/gaia-presence.js",
    "js/gaia-overlay-knowledge.js",
    "js/app.js",
    "js/gaia-legacy/gaia-charts.js",
    "js/gaia-legacy/gaia-data.js",
    "js/gaia-legacy/gaia-dom-adapter.js",
    "js/gaia-legacy/gaia-integration.js",
    "dis/gaia-mind.js",
    "dis/gaia-state-machine.js",
    "dis/gaia-voice-engine.js",
    "dis/gaia-key-gate.js",
    "dis/gaia-quest-system.js",
    "dis/gaia-voice-data.js",
    "js/gaia-embeddings.js",
    "js/gaia-reranker.js",
    "js/gaia-retrieval.js",
    "js/gaia-structured.js",
]

SML_METHODS = {"init", "reset", "destroy", "getState"}

RETURN_RE = re.compile(r'return\s*\{')


def audit_file(rel_path):
    js_path = PROJECT_ROOT / rel_path
    if not js_path.exists():
        return {"file": rel_path, "error": "not found"}

    content = js_path.read_text(encoding="utf-8")

    # Find module name from window assignment
    wm = re.search(r'window\.(\w+)\s*=\s*(?:\w+|(?:\(\s*function|\(\s*\(\s*\)))', content)
    mod_name = wm.group(1) if wm else Path(rel_path).stem

    # Find the IIFE's return block (last return { in file)
    returns = list(RETURN_RE.finditer(content))
    if not returns:
        return {"file": rel_path, "module": mod_name, "exports": [], "missing": sorted(SML_METHODS)}

    m = returns[-1]
    rest = content[m.end():]
    depth = 0
    end = None
    for i, ch in enumerate(rest):
        if ch == '{':
            depth += 1
        elif ch == '}':
            if depth == 0:
                end = i
                break
            depth -= 1

    if end is None:
        return {"file": rel_path, "module": mod_name, "exports": [], "missing": sorted(SML_METHODS)}

    block = rest[:end]
    # Extract exported method names
    exports = [k for k in re.findall(r'(\w+)\s*:', block) if not k.startswith('_')]

    present = SML_METHODS & set(exports)
    missing = SML_METHODS - present

    # Check for window.X = X; assignment (the contract trigger)
    has_window = bool(re.search(rf'window\.{mod_name}\s*=', content))

    return {
        "file": rel_path,
        "module": mod_name,
        "exports": exports,
        "has_window": has_window,
        "missing": sorted(missing),
        "compliant": len(missing) == 0,
    }


if __name__ == "__main__":
    results = [audit_file(f) for f in CONTRACTED_FILES]

    compliant = [r for r in results if r.get("compliant")]
    non_compliant = [r for r in results if not r.get("compliant") and "error" not in r]
    errors = [r for r in results if "error" in r]

    print(f"=== SML AUDIT: {len(compliant)}/{len(results)} compliant ===\n")

    for r in non_compliant:
        print(f"  {r['module']:20} {r['file']}")
        print(f"    exports: {', '.join(r['exports'][:10])}{'...' if len(r['exports']) > 10 else ''}")
        print(f"    MISSING SML: {', '.join(r['missing'])}")
        print()

    if errors:
        print(f"=== ERRORS ===")
        for r in errors:
            print(f"  {r['file']}: {r['error']}")
