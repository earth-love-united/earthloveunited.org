import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Arrow-safe sanitizer v2: handles nested raw_data subfields.
The HF viewer error "Couldn't cast array of type string to null" comes from
data_sources[].raw_data which contains original registry JSON with mixed types.
"""
import json
from pathlib import Path
from collections import defaultdict

INPUT = Path("carbon-projects/unified/carbon_projects_v4.jsonl")
OUTPUT = Path("carbon-projects/unified/carbon_projects_v5.jsonl")


def collect_all_types(obj, prefix="", types=None):
    """Recursively collect types for every field path."""
    if types is None:
        types = defaultdict(lambda: defaultdict(int))
    
    if isinstance(obj, dict):
        for k, v in obj.items():
            path = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (dict, list)):
                collect_all_types(v, path, types)
            else:
                types[path][type(v).__name__] += 1
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            if isinstance(item, dict):
                # For lists of dicts, collect types across all items
                collect_all_types(item, f"{prefix}[]", types)
            else:
                types[f"{prefix}[]"][type(item).__name__] += 1
    
    return types


def get_conflicts(types):
    """Find fields with null + other types."""
    return {path: dict(t) for path, t in types.items() if len(t) > 1 and 'NoneType' in t}


def make_empty(types):
    """Determine the empty value for a conflicting field."""
    non_null = {k: v for k, v in types.items() if k != 'NoneType'}
    if not non_null:
        return None
    dominant = max(non_null.items(), key=lambda x: x[1])[0]
    if dominant == 'list':
        return []
    elif dominant == 'dict':
        return {}
    elif dominant == 'str':
        return ""
    elif dominant == 'int':
        return 0
    elif dominant == 'float':
        return 0.0
    elif dominant == 'bool':
        return False
    return None


def sanitize(obj, conflict_map, prefix=""):
    """Recursively sanitize an object using the conflict map."""
    if isinstance(obj, dict):
        result = {}
        for k, v in obj.items():
            path = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (dict, list)):
                result[k] = sanitize(v, conflict_map, path)
            elif v is None and path in conflict_map:
                result[k] = conflict_map[path]
            else:
                result[k] = v
        return result
    elif isinstance(obj, list):
        return [sanitize(item, conflict_map, f"{prefix}[]") for item in obj]
    return obj


def main():
    print("=" * 60)
    print("ARROW-SAFE SANITIZER v2 (deep nested)")
    print("=" * 60)

    # Load records
    print("\n[1/4] Loading records...")
    records = []
    with open(INPUT) as f:
        for line in f:
            records.append(json.loads(line))
    print(f"  {len(records)} records")

    # Collect types across ALL nested fields
    print("[2/4] Scanning all nested fields for type conflicts...")
    all_types = defaultdict(lambda: defaultdict(int))
    
    for record in records:
        collect_all_types(record, types=all_types)
    
    conflicts = get_conflicts(all_types)
    print(f"  Total unique field paths: {len(all_types)}")
    print(f"  Paths with null+value conflicts: {len(conflicts)}")
    
    if conflicts:
        print(f"\n  Top conflicts:")
        for path, types in sorted(conflicts.items(), key=lambda x: -sum(x[1].values()))[:15]:
            empty = make_empty(types)
            print(f"    {path}: {types} → {repr(empty)}")
    
    # Build conflict map
    conflict_map = {}
    for path, types in conflicts.items():
        empty = make_empty(types)
        if empty is not None:
            conflict_map[path] = empty
    
    # Sanitize
    print(f"\n[3/4] Sanitizing {len(records)} records...")
    changed = 0
    
    with open(OUTPUT, "w") as f:
        for record in records:
            old = json.dumps(record)
            new = sanitize(record, conflict_map)
            new_str = json.dumps(new)
            if old != new_str:
                changed += 1
            f.write(new_str + "\n")
    
    print(f"  Modified: {changed} records")
    
    # Verify
    print(f"\n[4/4] Verifying...")
    verify_types = defaultdict(lambda: defaultdict(int))
    with open(OUTPUT) as f:
        for line in f:
            record = json.loads(line)
            collect_all_types(record, types=verify_types)
    
    verify_conflicts = get_conflicts(verify_types)
    print(f"  Remaining conflicts: {len(verify_conflicts)}")
    
    if verify_conflicts:
        for path, types in sorted(verify_conflicts.items())[:10]:
            print(f"    {path}: {types}")
    else:
        print("  ✅ ZERO null+value type conflicts!")
    
    import os
    size = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f"\nOutput: {OUTPUT}")
    print(f"Size: {size:.1f} MB")


if __name__ == "__main__":
    main()
