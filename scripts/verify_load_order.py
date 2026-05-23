#!/usr/bin/env python3
"""
verify-load-order.py — Static DAG verifier for Earth Love United

Parses HTML files for <script src="..."> tags, extracts the load order,
reads module-contracts from JS files, and validates that every module
loads AFTER all of its dependencies.

Exits 0 on success, non-zero on any violation.

Usage:
    python3 scripts/verify-load-order.py [index.html gaia.html ...]

If no files given, defaults to index.html and gaia.html in the project root.
"""

import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Project root: this file lives in <repo>/scripts/, so repo root is ../
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent


# ---------------------------------------------------------------------------
# Step 1: Parse HTML to extract script load order
# ---------------------------------------------------------------------------

def extract_script_load_order(html_path: Path) -> list[str]:
    """Return list of JS file paths (relative to project root) in load order.

    Skips external CDN scripts, commented-out tags, and strips cache-busting
    query params (?v=...).
    """
    content = html_path.read_text(encoding="utf-8")

    # Remove HTML comments (including commented-out scripts)
    content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)

    scripts = []
    for m in re.finditer(r'<script\s+src="([^"]+)"', content):
        src = m.group(1)
        if src.startswith(('http://', 'https://', '//')):
            continue
        src = src.split('?')[0]          # strip ?v=123 cache-busting
        scripts.append(src)

    return scripts


# ---------------------------------------------------------------------------
# Step 2: Parse JS files to extract MODULE_CONTRACTS.register() calls
# ---------------------------------------------------------------------------

_REGISTER_RE = re.compile(
    r"""MODULE_CONTRACTS\.register\(\s*['"](\w+)['"]\s*,\s*\{"""
)

_REQUIRES_RE = re.compile(r"requires:\s*\[([^\]]*)\]", re.DOTALL)
_PROVIDES_RE = re.compile(r"provides:\s*\[([^\]]*)\]", re.DOTALL)


def extract_contracts_from_js(js_path: Path) -> dict[str, dict]:
    """Extract MODULE_CONTRACTS.register() calls from a JS file.

    Returns dict of:
        module_name -> { "requires": [...], "provides": [...], "file": "rel/path" }
    """
    content = js_path.read_text(encoding="utf-8")
    contracts = {}

    for m in _REGISTER_RE.finditer(content):
        mod_name = m.group(1)

        # Grab everything from the opening { of register's second arg to its
        # matching closing } — handles multi-line provides arrays.
        rest = content[m.end():]
        depth = 0
        close_idx = None
        for i, ch in enumerate(rest):
            if ch == '{':
                depth += 1
            elif ch == '}':
                if depth == 0:
                    close_idx = i
                    break
                depth -= 1

        if close_idx is None:
            continue  # malformed — skip

        block = rest[:close_idx]

        # Parse requires
        requires: list[str] = []
        rm = _REQUIRES_RE.search(block)
        if rm:
            raw = rm.group(1)
            requires = [x.strip().strip("'\"")
                        for x in raw.split(',') if x.strip()]

        # Parse provides (may span multiple lines)
        provides: list[str] = []
        pm = _PROVIDES_RE.search(block)
        if pm:
            raw = pm.group(1)
            provides = [x.strip().strip("'\"")
                        for x in raw.split(',') if x.strip()]

        contracts[mod_name] = {
            "requires": requires,
            "provides": provides,
            "file": str(js_path.relative_to(PROJECT_ROOT)),
        }

    return contracts


def build_contract_index() -> dict[str, dict]:
    """Scan all JS files under js/ and dis/ for contract registrations."""
    contracts: dict[str, dict] = {}
    search_dirs = [PROJECT_ROOT / "js", PROJECT_ROOT / "dis"]

    for js_dir in search_dirs:
        if not js_dir.exists():
            continue
        for js_file in sorted(js_dir.rglob("*.js")):
            for mod_name, contract in extract_contracts_from_js(js_file).items():
                contracts[mod_name] = contract

    return contracts


# ---------------------------------------------------------------------------
# Step 3: Map modules -> files via window.X = Y assignments
# ---------------------------------------------------------------------------

def build_module_file_map(script_files: list[str]) -> dict[str, str]:
    """Map each module name to the JS file that defines it.

    Pattern: window.MODULE_NAME = MODULE_NAME;
    """
    module_to_file: dict[str, str] = {}

    for rel_path in script_files:
        js_path = PROJECT_ROOT / rel_path
        if not js_path.exists():
            continue
        content = js_path.read_text(encoding="utf-8")
        for m in re.finditer(r"window\.(\w+)\s*=\s*\w+\s*;", content):
            module_to_file[m.group(1)] = rel_path

    return module_to_file


# ---------------------------------------------------------------------------
# Step 4: Validate — every module must load AFTER its dependencies
# ---------------------------------------------------------------------------

def validate_load_order(
    script_files: list[str],
    contracts: dict[str, dict],
    module_to_file: dict[str, str],
    html_name: str,
) -> list[str]:
    """Return list of violation messages (empty = clean)."""
    errors: list[str] = []

    # file -> earliest position in load order
    file_pos: dict[str, int] = {}
    for idx, f in enumerate(script_files):
        base = f.split('?')[0]
        if base not in file_pos:
            file_pos[base] = idx

    for mod_name, contract in sorted(contracts.items()):
        mod_file = module_to_file.get(mod_name)
        if mod_file is None:
            continue  # dynamically loaded or optional — skip

        mod_pos = file_pos.get(mod_file)
        if mod_pos is None:
            errors.append(
                f"  [{html_name}] '{mod_name}' is defined in '{mod_file}' "
                f"but that file is not in <script> tags"
            )
            continue

        for dep in contract["requires"]:
            dep_file = module_to_file.get(dep)
            if dep_file is None:
                if dep in contracts:
                    dep_src = contracts[dep].get("file", "?")
                    errors.append(
                        f"  [{html_name}] '{mod_name}' requires '{dep}' "
                        f"(defined in {dep_src}) but '{dep}' has no <script> tag"
                    )
                continue

            dep_pos = file_pos.get(dep_file)
            if dep_pos is None:
                errors.append(
                    f"  [{html_name}] '{mod_name}' requires '{dep}' "
                    f"(in {dep_file}) but that file is not in <script> tags"
                )
            elif dep_pos >= mod_pos:
                errors.append(
                    f"  [{html_name}] ORDER VIOLATION: '{mod_name}' (pos {mod_pos}) "
                    f"requires '{dep}' (pos {dep_pos}) — move {dep_file} before "
                    f"{mod_file}"
                )

    return errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    html_files = [Path(f) for f in sys.argv[1:]] if len(sys.argv) > 1 else [
        PROJECT_ROOT / "index.html",
        PROJECT_ROOT / "gaia.html",
    ]
    for p in html_files:
        if not p.exists():
            print(f"ERROR: {p} not found", file=sys.stderr)
            sys.exit(2)

    contracts = build_contract_index()

    print("📋 Static DAG Verifier — Earth Love United")
    print(f"   {len(contracts)} contract registrations found\n")

    all_errors: list[str] = []

    for html_path in html_files:
        html_name = html_path.name
        scripts = extract_script_load_order(html_path)
        mod_map = build_module_file_map(scripts)
        errors = validate_load_order(scripts, contracts, mod_map, html_name)

        if errors:
            print(f"🔍 {html_name}: ❌ {len(errors)} violation(s)")
            for e in errors:
                print(e)
            all_errors.extend(errors)
        else:
            print(f"🔍 {html_name}: ✅ all {len(scripts)} scripts in correct order")
        print()

    if all_errors:
        print(f"🔴 FAIL — {len(all_errors)} DAG violation(s)")
        print()
        print("Contract DAG (dependents <- requires):")
        for mod, c in sorted(contracts.items()):
            if c["requires"]:
                print(f"  {mod} <- {', '.join(c['requires'])}")
        sys.exit(1)
    else:
        print("🟢 PASS — all DAG constraints satisfied")
        sys.exit(0)


if __name__ == "__main__":
    main()
