#!/usr/bin/env python3
"""
Inject MODULE_CONTRACTS.register() calls into all JS files that have window.X = X
but are missing contract registrations.

Run once, then verify with verify_load_order.py.
"""
import re
from pathlib import Path

PROJECT_ROOT = Path("/Users/ekmelozdemir/earthloveunited.org")

# module_name -> { "provides": [...], "requires": [...] }
CONTRACTS = {
    "GLOBE_OVERLAY": {
        "provides": ["isOpen", "getCurrentSite"],
        "requires": [],
    },
    "SITE_PANEL": {
        "provides": ["open", "close", "nextLayer", "selectPrediction", "addInsight",
                      "verifyCurrentSite", "switchVerifyTab", "toggleGAIA", "speakGAIA",
                      "addInsightFromGAIA", "scrollToLayer"],
        "requires": ["GLOBE_OVERLAY"],
    },
    "PLEDGE_PANEL": {
        "provides": ["open", "close"],
        "requires": [],
    },
    "GAIA_BUBBLE": {
        "provides": ["speak", "show", "hide", "setMood", "setPosition", "fadeIn",
                      "fadeOut", "isVisible", "setInteractive", "setPhase",
                      "handleScroll", "handleResize", "on", "off", "destroy"],
        "requires": ["GAIA_JOURNAL"],
    },
    "PLEDGE_WALL": {
        "provides": ["init", "open", "close", "submit", "renderPledges",
                      "getPledges", "getPledgeCount", "hasPledged", "destroy"],
        "requires": ["COUNTRY_DATA", "DELEGATION", "GAIA_BUBBLE", "GAIA_JOURNAL"],
    },
    "NDVIVerifier": {
        "provides": ["init", "activate", "deactivate", "verify", "getStatus"],
        "requires": [],
    },
    "CARBON_CLOCK": {
        "provides": ["init", "start", "stop", "update"],
        "requires": [],
    },
    "RegistryCheck": {
        "provides": ["init", "check", "getRegistry", "getProject"],
        "requires": [],
    },
    "Quiz": {
        "provides": ["init", "start", "next", "answer", "getResult", "reset"],
        "requires": [],
    },
    "Biomes": {
        "provides": ["init", "getBiome", "getAllBiomes", "classify"],
        "requires": [],
    },
    "Cycle": {
        "provides": ["init", "update", "getCurrentPhase", "setPhase"],
        "requires": [],
    },
    "Counters": {
        "provides": ["init", "increment", "getCount", "reset"],
        "requires": [],
    },
    "COUNTRY_DATA": {
        "provides": ["init", "getCountry", "getCountries", "lookup",
                      "getByCode", "search"],
        "requires": [],
    },
    "DELEGATION": {
        "provides": ["init", "getDetected", "getCountryData", "destroy"],
        "requires": ["GAIA_BUBBLE"],
    },
    "Scenario": {
        "provides": ["init", "load", "play", "pause", "reset"],
        "requires": [],
    },
    "GAIA_JOURNAL": {
        "provides": ["init", "addEntry", "getEntries", "getAllQuests",
                      "save", "load", "clear"],
        "requires": [],
    },
    "GAIA_VOICE": {
        "provides": ["init", "speak", "silent", "setVoice", "getVoice"],
        "requires": [],
    },
    "GAIA_PRESENCE": {
        "provides": ["init", "show", "hide", "tease", "destroy"],
        "requires": ["GAIA_BUBBLE"],
    },
    "GAIA_KNOWLEDGE": {
        "provides": ["init", "query", "search", "getContext", "destroy"],
        "requires": [],
    },
    "GAIA_CHARTS": {
        "provides": ["init", "render", "update", "destroy"],
        "requires": [],
    },
    "GAIA_DATA": {
        "provides": ["init", "getVisitCount", "getFirstVisit", "getTotalTime",
                      "getVisitHistory"],
        "requires": [],
    },
    "App": {
        "provides": ["init"],
        "requires": ["MODULE_CONTRACTS", "SITE_PANEL", "PLEDGE_WALL", "GAIA_BUBBLE",
                      "CARBON_CLOCK", "DELEGATION", "GAIA_VOICE", "GAIA_DATA"],
    },
    # gaia-legacy modules
    "GAIA_CHARTS": {
        "provides": ["init", "render", "update", "destroy"],
        "requires": [],
    },
    "GAIA_DATA": {
        "provides": ["init", "getVisitCount", "getFirstVisit", "getTotalTime"],
        "requires": [],
    },
    # dis/ modules (gaia.html only)
    "GaiaMind": {
        "provides": ["init", "serialize", "deserialize", "process", "getMood",
                      "setContext", "getContext"],
        "requires": [],
    },
    "GaiaState": {
        "provides": ["init", "getState", "setState", "getMood", "setMood",
                      "registerCallbacks", "process"],
        "requires": [],
    },
    "GaiaVoice": {
        "provides": ["init", "speak", "setLibrary", "getLibrary", "destroy"],
        "requires": [],
    },
    "GaiaKeyGate": {
        "provides": ["init", "check", "unlock", "isUnlocked"],
        "requires": [],
    },
    "GaiaQuests": {
        "provides": ["init", "getQuests", "completeQuest", "getProgress"],
        "requires": [],
    },
}

# Map module -> file
MODULE_FILES = {
    "GLOBE_OVERLAY": "js/globe-overlay.js",
    "SITE_PANEL": "js/site-panel.js",
    "PLEDGE_PANEL": "js/site-panel.js",  # same file, second registration
    "GAIA_BUBBLE": "js/gaia-bubble.js",
    "PLEDGE_WALL": "js/pledge-wall.js",
    "NDVIVerifier": "js/ndvi-verifier.js",
    "CARBON_CLOCK": "js/carbon-clock.js",
    "RegistryCheck": "js/registry-check.js",
    "Quiz": "js/quiz.js",
    "Biomes": "js/biomes.js",
    "Cycle": "js/cycle.js",
    "Counters": "js/counters.js",
    "COUNTRY_DATA": "js/country-data.js",
    "DELEGATION": "js/delegation.js",
    "Scenario": "js/scenario.js",
    "GAIA_JOURNAL": "js/gaia-journal.js",
    "GAIA_VOICE": "js/gaia-voice.js",
    "GAIA_PRESENCE": "js/gaia-presence.js",
    "GAIA_KNOWLEDGE": "js/gaia-overlay-knowledge.js",
    "GAIA_CHARTS": "js/gaia-legacy/gaia-charts.js",
    "GAIA_DATA": "js/gaia-legacy/gaia-data.js",
    "App": "js/app.js",
    "GaiaMind": "dis/gaia-mind.js",
    "GaiaState": "dis/gaia-state-machine.js",
    "GaiaVoice": "dis/gaia-voice-engine.js",
    "GaiaKeyGate": "dis/gaia-key-gate.js",
    "GaiaQuests": "dis/gaia-quest-system.js",
}

REGISTER_RE = re.compile(r'MODULE_CONTRACTS\.register\(')
WINDOW_RE = re.compile(r'window\.(\w+)\s*=\s*\w+\s*;')


def needs_contract(js_path: Path, mod_name: str) -> bool:
    """Check if file already has a contract for this module."""
    content = js_path.read_text(encoding="utf-8")
    if REGISTER_RE.search(content):
        return False
    return True


def inject_contract(js_path: Path, mod_name: str, contract: dict) -> bool:
    """Inject MODULE_CONTRACTS.register() after window.X = X; ."""
    content = js_path.read_text(encoding="utf-8")

    if not needs_contract(js_path, mod_name):
        return False

    provides = contract.get("provides", [])
    requires = contract.get("requires", [])

    # Build the registration block
    provides_str = ", ".join(f"'{p}'" for p in provides) if provides else ""
    requires_str = ", ".join(f"'{r}'" for r in requires) if requires else ""

    register_block = f"""
  MODULE_CONTRACTS.register('{mod_name}', {{
    provides: [{provides_str}],
    requires: [{requires_str}],
  }});"""

    # Find the window.X = X; line and insert after it
    pattern = rf'(window\.{mod_name}\s*=\s*\w+\s*;\n)'
    replacement = rf'\1{register_block}\n'

    new_content, n = re.subn(pattern, replacement, content, count=1)

    if n == 0:
        # Try alternate pattern: if (typeof window !== 'undefined') window.X = X
        pattern2 = rf'(window\.{mod_name}\s*=\s*\w+)'
        replacement2 = rf'\1\n{register_block}'
        new_content, n = re.subn(pattern2, replacement2, content, count=1)

    if n == 0:
        print(f"  WARNING: Could not find window.{mod_name} in {js_path}")
        return False

    js_path.write_text(new_content, encoding="utf-8")
    return True


def main():
    injected = 0
    skipped = 0
    errors = 0

    for mod_name, rel_path in MODULE_FILES.items():
        js_path = PROJECT_ROOT / rel_path
        contract = CONTRACTS.get(mod_name)
        if not contract:
            print(f"  SKIP {mod_name}: no contract defined")
            skipped += 1
            continue

        if inject_contract(js_path, mod_name, contract):
            print(f"  INJECTED {mod_name} -> {rel_path}")
            injected += 1
        else:
            if not js_path.exists():
                print(f"  ERROR: {rel_path} not found")
                errors += 1
            else:
                print(f"  SKIP {mod_name}: already registered or pattern not found")
                skipped += 1

    print(f"\nDone: {injected} injected, {skipped} skipped, {errors} errors")


if __name__ == "__main__":
    main()
