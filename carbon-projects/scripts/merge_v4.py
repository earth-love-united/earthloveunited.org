"""
Final merge v4: deduped Verra descriptions + GS enrichments → v3 dataset.
"""
import json
from pathlib import Path

VERRA_DEDUPED = Path("/Users/ekmelozdemir/earthloveunited.org/carbon-projects/data/verra_details_deduped.jsonl")
GS_ENRICH = Path("/Users/ekmelozdemir/earthloveunited.org/tools/scraper/data/scraped/gs_methodology_enrichment.jsonl")
V3 = Path("/Users/ekmelozdemir/earthloveunited.org/carbon-projects/unified/carbon_projects_v3.jsonl")
OUTPUT = Path("/Users/ekmelozdemir/earthloveunited.org/carbon-projects/unified/carbon_projects_v4.jsonl")

# Load Verra details
verra_details = {}
with open(VERRA_DEDUPED) as f:
    for line in f:
        d = json.loads(line)
        verra_details[str(d.get("project_id", ""))] = d
print(f"Loaded {len(verra_details)} Verra details")

# Load GS enrichments
gs_enrich = {}
if GS_ENRICH.exists():
    with open(GS_ENRICH) as f:
        for line in f:
            d = json.loads(line)
            gs_enrich[str(d.get("id", ""))] = d
print(f"Loaded {len(gs_enrich)} GS enrichments")

# Load v3
projects = []
with open(V3) as f:
    for line in f:
        projects.append(json.loads(line))
print(f"Loaded {len(projects)} v3 projects")

# Patch
verra_patched = 0
gs_patched = 0

for p in projects:
    # Verra
    for reg_id in p.get("registry_ids", []):
        if reg_id.get("registry") == "verra":
            vid = str(reg_id.get("id", ""))
            detail = verra_details.get(vid)
            if detail:
                if detail.get("description") and not p.get("description"):
                    p["description"] = detail["description"]
                    verra_patched += 1
                if detail.get("methodology_name") and not p.get("project_type", {}).get("methodology_name"):
                    p["project_type"]["methodology_name"] = detail["methodology_name"]
                if detail.get("estimated_annual_reductions") and not p.get("crediting", {}).get("estimated_annual_reduction_tco2"):
                    p["crediting"]["estimated_annual_reduction_tco2"] = detail["estimated_annual_reductions"]
                if detail.get("sdgs"):
                    existing = set(p.get("co_benefits", {}).get("sdgs", []))
                    for sdg in detail["sdgs"]:
                        if sdg not in existing:
                            p["co_benefits"]["sdgs"].append(sdg)
                            existing.add(sdg)
            break
    
    # GS
    for reg_id in p.get("registry_ids", []):
        if reg_id.get("registry") == "gold_standard":
            gid = str(reg_id.get("id", "")).replace("GS", "")
            enrich = gs_enrich.get(gid)
            if enrich and enrich.get("methodology"):
                if not p.get("project_type", {}).get("methodology"):
                    p["project_type"]["methodology"] = enrich["methodology"]
                    gs_patched += 1
                if not p.get("project_type", {}).get("methodology_name"):
                    p["project_type"]["methodology_name"] = enrich["methodology"]
            break

# Quality scores
for p in projects:
    score = 0.0
    rc = p.get("data_quality", {}).get("registries_count", 1)
    score += min(0.15, 0.075 * rc)
    if p.get("project_type", {}).get("methodology"): score += 0.15
    if p.get("project_type", {}).get("methodology_name"): score += 0.10
    if p.get("description"): score += 0.15
    if p.get("location", {}).get("latitude") is not None: score += 0.10
    c = p.get("crediting", {})
    if c.get("period_start") and c.get("period_end"): score += 0.10
    if c.get("estimated_annual_reduction_tco2"): score += 0.10
    if p.get("co_benefits", {}).get("sdgs"): score += 0.05
    if p.get("developer", {}).get("name"): score += 0.05
    if p.get("registration", {}).get("date"): score += 0.05
    if p.get("project_type", {}).get("sub_category"): score += 0.05
    if c.get("credits_issued"): score += 0.05
    if c.get("credits_retired"): score += 0.05
    p["data_quality"]["score"] = round(min(1.0, score), 3)

# Save
with open(OUTPUT, "w") as f:
    for p in projects:
        f.write(json.dumps(p, ensure_ascii=False) + "\n")

# Stats
has_desc = sum(1 for p in projects if p.get("description"))
has_name = sum(1 for p in projects if p.get("project_type", {}).get("methodology_name"))
has_code = sum(1 for p in projects if p.get("project_type", {}).get("methodology"))
has_coords = sum(1 for p in projects if p.get("location", {}).get("latitude") is not None)
scores = [p["data_quality"]["score"] for p in projects]

print(f"\n=== v4 DATASET ===")
print(f"Total: {len(projects)}")
print(f"Verra patched: {verra_patched}")
print(f"GS patched: {gs_patched}")
print(f"Descriptions: {has_desc}/{len(projects)} ({100*has_desc/len(projects):.1f}%)")
print(f"Meth names: {has_name}/{len(projects)} ({100*has_name/len(projects):.1f}%)")
print(f"Meth codes: {has_code}/{len(projects)} ({100*has_code/len(projects):.1f}%)")
print(f"Coords: {has_coords}/{len(projects)} ({100*has_coords/len(projects):.1f}%)")
print(f"Quality 0.7+: {sum(1 for s in scores if s >= 0.7)}/{len(projects)} ({100*sum(1 for s in scores if s >= 0.7)/len(projects):.1f}%)")
print(f"Size: {OUTPUT.stat().st_size/1024/1024:.1f} MB")
