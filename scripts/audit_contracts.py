#!/usr/bin/env python3
"""Audit all JS modules for their provides/requires to generate contract registrations."""
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path("/Users/ekmelozdemir/earthloveunited.org")

# Files to audit (all window.X modules not yet registered)
FILES = [
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
    "js/gaia-legacy/gaia-signals.js",
    "js/gaia-legacy/gaia-knowledge.js",
    "js/gaia-legacy/gaia-dom-adapter.js",
    "js/gaia-legacy/gaia-integration.js",
    "dis/gaia-mind.js",
    "dis/gaia-state-machine.js",
    "dis/gaia-voice-engine.js",
    "dis/gaia-key-gate.js",
    "dis/gaia-quest-system.js",
]

# Modules that already have contracts
EXISTING = {"Data", "GlobeModule", "GLOBE_MODES", "GLOBE_EVENTS", "GLOBE_NDVI",
            "GLOBE_RESTORE", "GAIA_NODES", "GAIA_ENGAGEMENT"}

SAFE_CALL_RE = re.compile(r'(?:safeCall|hasModule|safeGet)\s*\(\s*["\']([^"\']+)["\']')
RETURN_RE = re.compile(r'return\s*\{')


def audit_file(rel_path: str) -> dict:
    js_path = PROJECT_ROOT / rel_path
    if not js_path.exists():
        return {"file": rel_path, "error": "not found"}

    content = js_path.read_text(encoding="utf-8")

    # Find module name from window.X = assignment
    window_match = re.search(r'window\.(\w+)\s*=\s*\w+\s*;', content)
    if not window_match:
        # Try alternate pattern: if (typeof window !== 'undefined') window.X = X
        window_match = re.search(r'window\.(\w+)\s*=\s*\w+', content)
    mod_name = window_match.group(1) if window_match else Path(rel_path).stem

    # Find provides: keys in the main return { } block
    provides = []
    returns = list(RETURN_RE.finditer(content))
    if returns:
        m = returns[-1]  # last return { } is typically the IIFE's public API
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
        if end is not None:
            block = rest[:end]
            provides = re.findall(r'(\w+)\s*:', block)
            # Filter out non-method keys (like closing braces artifacts)
            provides = [p for p in provides if not p.startswith('_')]

    # Find requires: targets of safeCall/hasModule/safeGet
    requires = set()
    for m in SAFE_CALL_RE.finditer(content):
        target = m.group(1)
        if target not in EXISTING and target != mod_name:
            # Only include targets that are actual modules (not string literals for other purposes)
            requires.add(target)

    return {
        "file": rel_path,
        "module": mod_name,
        "provides": provides[:20],  # cap at 20
        "requires": sorted(requires),
    }


if __name__ == "__main__":
    for f in FILES:
        result = audit_file(f)
        mod = result.get("module", "?")
        prov = result.get("provides", [])
        req = result.get("requires", [])
        err = result.get("error")

        if err:
            print(f"SKIP {f}: {err}")
            continue

        print(f"  {mod}:")
        print(f"    file:     {f}")
        print(f"    provides: {', '.join(prov)}")
        print(f"    requires: {', '.join(req) if req else '(none)'}")
        print()
