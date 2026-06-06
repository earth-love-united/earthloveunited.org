import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Final merge: incorporate Verra descriptions + GS enrichments into v2 dataset.
Run this after the scrapers finish.
"""
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone

V2_FILE = "carbon-projects/unified/carbon_projects_v2.jsonl"
VERRA_DETAILS = "tools/scraper/data/scraped/verra_details.jsonl"
GS_ENRICH = "tools/scraper/data/scraped/gs_methodology_enrichment.jsonl"
OUTPUT = "carbon-projects/unified/carbon_projects_v2_final.jsonl"

def main():
    print("=" * 60)
    print("FINAL MERGE: Verra descriptions + GS enrichments → v2")
    print("=" * 60)

    # Load Verra details
    verra_details = {}
    if Path(VERRA_DETAILS).exists():
        with open(VERRA_DETAILS) as f:
            for line in f:
                d = json.loads(line)
                verra_details[d.get("project_id", "")] = d
    print(f"Verra details: {len(verra_details)}")

    # Load GS enrichments
    gs_enrich = {}
    if Path(GS_ENRICH).exists():
        with open(GS_ENRICH) as f:
            for line in f:
                d = json.loads(line)
                gs_enrich[d.get("id", "")] = d
    print(f"GS enrichments: {len(gs_enrich)}")

    # Load v2 dataset
    projects = []
    with open(V2_FILE) as f:
        for line in f:
            projects.append(json.loads(line))
    print(f"v2 projects: {len(projects)}")

    # Apply enrichments
    verra_patched = 0
    gs_patched = 0

    for p in projects:
        # Patch Verra descriptions
        for reg_id in p.get("registry_ids", []):
            if reg_id.get("registry") == "verra":
                vid = reg_id.get("id", "")
                detail = verra_details.get(vid)
                if detail:
                    if detail.get("description") and not p.get("description"):
                        p["description"] = detail["description"]
                        verra_patched += 1
                    if detail.get("methodology_name") and not p.get("project_type", {}).get("methodology_name"):
                        p["project_type"]["methodology_name"] = detail["methodology_name"]
                    if detail.get("estimated_annual_reductions") and not p.get("crediting", {}).get("estimated_annual_reduction_tco2"):
                        p["crediting"]["estimated_annual_reduction_tco2"] = detail["estimated_annual_reductions"]
                    # Merge SDGs
                    if detail.get("sdgs"):
                        existing = set(p.get("co_benefits", {}).get("sdgs", []))
                        for sdg in detail["sdgs"]:
                            if sdg not in existing:
                                p["co_benefits"]["sdgs"].append(sdg)
                                existing.add(sdg)
                break

        # Patch GS methodologies
        for reg_id in p.get("registry_ids", []):
            if reg_id.get("registry") == "gold_standard":
                gid = str(reg_id.get("id", "")).replace("GS", "")
                enrich = gs_enrich.get(gid)
                if enrich and enrich.get("methodology"):
                    if not p.get("project_type", {}).get("methodology"):
                        p["project_type"]["methodology"] = enrich["methodology"]
                        gs_patched += 1
                    if not p.get("project_type", {}).get("methodology_name"):
                        from methodology_names import get_methodology_name
                        name = get_methodology_name(enrich["methodology"])
                        if name:
                            p["project_type"]["methodology_name"] = name
                break

        # Recompute quality score
        score = 0.0
        reg_count = p.get("data_quality", {}).get("registries_count", 1)
        score += min(0.15, 0.075 * reg_count)
        if p.get("project_type", {}).get("methodology"): score += 0.15
        if p.get("project_type", {}).get("methodology_name"): score += 0.10
        if p.get("description"): score += 0.15
        if p.get("location", {}).get("latitude") is not None: score += 0.10
        cred = p.get("crediting", {})
        if cred.get("period_start") and cred.get("period_end"): score += 0.10
        if cred.get("estimated_annual_reduction_tco2"): score += 0.10
        if p.get("co_benefits", {}).get("sdgs"): score += 0.05
        if p.get("developer", {}).get("name"): score += 0.05
        if p.get("registration", {}).get("date"): score += 0.05
        if p.get("project_type", {}).get("sub_category"): score += 0.05
        if cred.get("credits_issued"): score += 0.05
        if cred.get("credits_retired"): score += 0.05
        p["data_quality"]["score"] = round(min(1.0, score), 3)

    # Save
    with open(OUTPUT, "w") as f:
        for p in projects:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    # Stats
    has_coords = sum(1 for p in projects if p.get("location", {}).get("latitude") is not None)
    has_name = sum(1 for p in projects if p.get("project_type", {}).get("methodology_name"))
    has_desc = sum(1 for p in projects if p.get("description"))
    has_code = sum(1 for p in projects if p.get("project_type", {}).get("methodology"))
    scores = [p["data_quality"]["score"] for p in projects]

    print(f"\n{'=' * 60}")
    print("FINAL v2 DATASET")
    print(f"{'=' * 60}")
    print(f"Total projects: {len(projects):,}")
    print(f"Verra descriptions patched: {verra_patched}")
    print(f"GS methodologies patched: {gs_patched}")
    print(f"")
    print(f"Coordinates: {has_coords}/{len(projects)} ({100*has_coords/len(projects):.1f}%)")
    print(f"Methodology names: {has_name}/{len(projects)} ({100*has_name/len(projects):.1f}%)")
    print(f"Methodology codes: {has_code}/{len(projects)} ({100*has_code/len(projects):.1f}%)")
    print(f"Descriptions: {has_desc}/{len(projects)} ({100*has_desc/len(projects):.1f}%)")
    print(f"Quality: avg={sum(scores)/len(scores):.3f}, max={max(scores):.3f}")
    print(f"Quality 0.7+: {sum(1 for s in scores if s >= 0.7)} ({100*sum(1 for s in scores if s >= 0.7)/len(projects):.1f}%)")

    import os
    print(f"\nFile size: {os.path.getsize(OUTPUT)/1024/1024:.1f} MB")
    print(f"Saved to {OUTPUT}")


if __name__ == "__main__":
    main()
