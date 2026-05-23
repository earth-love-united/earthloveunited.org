#!/usr/bin/env python3
"""Debug script to inspect contract index and module-file mapping."""
import sys
import os

# Add scripts dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from verify_load_order import build_contract_index, extract_script_load_order, build_module_file_map

contracts = build_contract_index()
print("=== Contracts ===")
for mod, c in sorted(contracts.items()):
    print(f"  {mod}: requires={c['requires']}, file={c['file']}")

print()
scripts = extract_script_load_order(open("../index.html"))
print("=== Script order (first 15) ===")
for i, s in enumerate(scripts[:15]):
    print(f"  {i:2}: {s}")

print()
print("=== Module->file map (contract modules only) ===")
mod_map = build_module_file_map(scripts)
for mod in sorted(contracts.keys()):
    f = mod_map.get(mod, "NOT FOUND")
    print(f"  {mod} -> {f}")
