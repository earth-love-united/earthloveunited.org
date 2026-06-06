import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Sanitize carbon_projects_v2 JSONL for HF viewer compatibility.
Fixes: null → [] for list fields, null → "" for nullable string fields in nested structs.
"""
import json
from pathlib import Path
from collections import defaultdict

INPUT = "carbon-projects/unified/carbon_projects_v2_final.jsonl"
OUTPUT = "carbon-projects/unified/carbon_projects_v3.jsonl"

# Fields that must be [] not null
LIST_FIELDS = {
    "registry_ids",
    "data_sources",
    "co_benefits.sdgs",
    "co_benefits.labels",
    "co_benefits.sdg_details",
    "project_type.sub_category",  # can be null, but let's keep as-is for strings
}

# Nullable string fields inside nested structs that should be "" not null
# We handle these by walking the nested dicts

def sanitize_record(record):
    """Normalize nulls in a single record."""
    
    # Top-level list fields
    for field in ["registry_ids", "data_sources"]:
        if field in record and record[field] is None:
            record[field] = []
    
    # co_benefits
    co_benefits = record.get("co_benefits")
    if isinstance(co_benefits, dict):
        for field in ["sdgs", "labels", "sdg_details"]:
            if field in co_benefits and co_benefits[field] is None:
                co_benefits[field] = []
    
    # project_type
    project_type = record.get("project_type")
    if isinstance(project_type, dict):
        for field in ["sub_category", "methodology_name"]:
            if field in project_type and project_type[field] is None:
                project_type[field] = ""
    
    # location
    location = record.get("location")
    if isinstance(location, dict):
        for field in ["country_code_iso3", "region"]:
            if field in location and location[field] is None:
                location[field] = ""
    
    # developer
    developer = record.get("developer")
    if isinstance(developer, dict):
        if "name" in developer and developer["name"] is None:
            developer["name"] = ""
    
    # crediting — numeric fields should be 0 not null
    crediting = record.get("crediting")
    if isinstance(crediting, dict):
        for field in ["period_start", "period_end", "credit_unit"]:
            if field in crediting and crediting[field] is None:
                crediting[field] = ""
        for field in ["credits_issued", "credits_retired", "estimated_annual_reduction_tco2"]:
            if field in crediting and crediting[field] is None:
                crediting[field] = 0
    
    # location — lat/lon should be float not string
    location = record.get("location")
    if isinstance(location, dict):
        for field in ["country_code_iso3", "region"]:
            if field in location and location[field] is None:
                location[field] = ""
        for field in ["latitude", "longitude"]:
            if field in location and isinstance(location[field], str):
                try:
                    location[field] = float(location[field])
                except (ValueError, TypeError):
                    location[field] = 0.0
    
    # project_type — methodology should be "" not null
    project_type = record.get("project_type")
    if isinstance(project_type, dict):
        for field in ["sub_category", "methodology_name", "methodology"]:
            if field in project_type and project_type[field] is None:
                project_type[field] = ""
    
    # registration
    registration = record.get("registration")
    if isinstance(registration, dict):
        for field in ["date", "last_updated"]:
            if field in registration and registration[field] is None:
                registration[field] = ""
    
    # data_quality
    data_quality = record.get("data_quality")
    if isinstance(data_quality, dict):
        if "score" in data_quality and data_quality["score"] is None:
            data_quality["score"] = 0.0
    
    # Top-level nullable strings
    for field in ["description", "status_raw"]:
        if field in record and record[field] is None:
            record[field] = ""
    
    return record


def main():
    print("=" * 60)
    print("SANITIZER: null → [] / "" for HF viewer compatibility")
    print("=" * 60)

    # First pass: scan for type conflicts
    print("\n[1/3] Scanning for type conflicts...")
    schema_types = defaultdict(lambda: defaultdict(int))
    total = 0
    
    with open(INPUT) as f:
        for line in f:
            total += 1
            record = json.loads(line)
            
            # Check top-level fields
            for key, val in record.items():
                t = type(val).__name__
                schema_types[key][t] += 1
            
            # Check nested fields
            for nested_key in ["co_benefits", "project_type", "location", "developer", "crediting", "registration", "data_quality"]:
                nested = record.get(nested_key)
                if isinstance(nested, dict):
                    for k, v in nested.items():
                        t = type(v).__name__
                        schema_types[f"{nested_key}.{k}"][t] += 1
    
    # Report conflicts
    conflicts = {}
    for field, types in schema_types.items():
        if len(types) > 1:
            conflicts[field] = dict(types)
    
    if conflicts:
        print(f"\n  Found {len(conflicts)} fields with type conflicts:")
        for field, types in sorted(conflicts.items()):
            print(f"    {field}: {types}")
    else:
        print("  No type conflicts found!")
    
    # Second pass: sanitize
    print(f"\n[2/3] Sanitizing {total} records...")
    sanitized = 0
    changes = defaultdict(int)
    
    with open(INPUT) as fin, open(OUTPUT, "w") as fout:
        for line in fin:
            record = json.loads(line)
            
            # Track what changed
            old_co_benefits = json.dumps(record.get("co_benefits"))
            old_project_type = json.dumps(record.get("project_type"))
            old_location = json.dumps(record.get("location"))
            old_developer = json.dumps(record.get("developer"))
            old_crediting = json.dumps(record.get("crediting"))
            old_registration = json.dumps(record.get("registration"))
            old_data_quality = json.dumps(record.get("data_quality"))
            
            record = sanitize_record(record)
            
            # Count changes
            if json.dumps(record.get("co_benefits")) != old_co_benefits:
                changes["co_benefits"] += 1
            if json.dumps(record.get("project_type")) != old_project_type:
                changes["project_type"] += 1
            if json.dumps(record.get("location")) != old_location:
                changes["location"] += 1
            if json.dumps(record.get("developer")) != old_developer:
                changes["developer"] += 1
            if json.dumps(record.get("crediting")) != old_crediting:
                changes["crediting"] += 1
            if json.dumps(record.get("registration")) != old_registration:
                changes["registration"] += 1
            if json.dumps(record.get("data_quality")) != old_data_quality:
                changes["data_quality"] += 1
            
            fout.write(json.dumps(record, ensure_ascii=False) + "\n")
            sanitized += 1
    
    print(f"  Sanitized: {sanitized} records")
    print(f"  Changes by field:")
    for field, count in sorted(changes.items()):
        print(f"    {field}: {count} records modified")
    
    # Third pass: verify
    print(f"\n[3/3] Verifying output...")
    schema_types_v2 = defaultdict(lambda: defaultdict(int))
    total_v2 = 0
    
    with open(OUTPUT) as f:
        for line in f:
            total_v2 += 1
            record = json.loads(line)
            for key, val in record.items():
                t = type(val).__name__
                schema_types_v2[key][t] += 1
            for nested_key in ["co_benefits", "project_type", "location", "developer", "crediting", "registration", "data_quality"]:
                nested = record.get(nested_key)
                if isinstance(nested, dict):
                    for k, v in nested.items():
                        t = type(v).__name__
                        schema_types_v2[f"{nested_key}.{k}"][t] += 1
    
    conflicts_v2 = {}
    for field, types in schema_types_v2.items():
        if len(types) > 1:
            conflicts_v2[field] = dict(types)
    
    if conflicts_v2:
        print(f"\n  ⚠️  {len(conflicts_v2)} fields still have type conflicts:")
        for field, types in sorted(conflicts_v2.items()):
            print(f"    {field}: {types}")
    else:
        print("  ✅ No type conflicts — clean schema!")
    
    import os
    size = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f"\nOutput: {OUTPUT}")
    print(f"Size: {size:.1f} MB")
    print(f"Records: {total_v2}")


if __name__ == "__main__":
    main()
