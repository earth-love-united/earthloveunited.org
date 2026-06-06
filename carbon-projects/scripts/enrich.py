import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Optimized enrichment pipeline.
1. Geocode unique country/region combinations (not every project)
2. Add methodology name mapping
3. Compute quality scores
4. Add document URLs
"""
import json
import time
import requests
import re

INPUT_FILE = "carbon-projects/unified/carbon_projects_deduped.jsonl"
OUTPUT_FILE = "carbon-projects/unified/carbon_projects_enriched.jsonl"

from methodology_names import get_methodology_name


def geocode_location(country, region):
    """Geocode a country + region to lat/lon using Nominatim."""
    if not country:
        return None, None
    query = f"{region}, {country}" if region and region != country else country
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": "CarbonProjectsDataset/1.0"},
            timeout=10
        )
        if resp.status_code == 200:
            results = resp.json()
            if results:
                return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception:
        pass
    return None, None


def compute_quality_score(project):
    """Compute a quality score (0-1) based on data completeness."""
    score = 0.0
    # Registry count (0.15)
    reg_count = project.get("data_quality", {}).get("registries_count", 1)
    score += min(0.15, 0.075 * reg_count)
    # Methodology (0.15)
    if project.get("project_type", {}).get("methodology"):
        score += 0.15
    # Description (0.15)
    if project.get("description"):
        score += 0.15
    # Coordinates (0.1)
    if project.get("location", {}).get("latitude"):
        score += 0.1
    # Crediting period (0.1)
    cred = project.get("crediting", {})
    if cred.get("period_start") and cred.get("period_end"):
        score += 0.1
    # Estimated reductions (0.1)
    if cred.get("estimated_annual_reduction_tco2"):
        score += 0.1
    # SDGs (0.05)
    if project.get("co_benefits", {}).get("sdgs"):
        score += 0.05
    # Developer (0.05)
    if project.get("developer", {}).get("name"):
        score += 0.05
    # Registration date (0.05)
    if project.get("registration", {}).get("date"):
        score += 0.05
    # Sub-category (0.05)
    if project.get("project_type", {}).get("sub_category"):
        score += 0.05
    # Methodology name (0.05)
    if project.get("project_type", {}).get("methodology_name"):
        score += 0.05
    return round(min(1.0, score), 3)


def main():
    print("=" * 60)
    print("ENRICHMENT PIPELINE (Optimized)")
    print("=" * 60)

    # Load projects
    print("\nLoading projects...")
    projects = []
    with open(INPUT_FILE) as f:
        for line in f:
            projects.append(json.loads(line))
    print(f"  Loaded {len(projects)} projects")

    # Find unique country/region combinations
    print("\nFinding unique locations...")
    unique_locations = set()
    for p in projects:
        country = p.get("location", {}).get("country", "")
        region = p.get("location", {}).get("region", "")
        needs_geocode = not p.get("location", {}).get("latitude")
        if needs_geocode and country:
            unique_locations.add((country, region))
    print(f"  Unique locations to geocode: {len(unique_locations)}")

    # Geocode unique locations
    print("\nGeocoding unique locations...")
    geocode_cache = {}
    geocoded = 0
    for i, (country, region) in enumerate(unique_locations):
        lat, lon = geocode_location(country, region)
        geocode_cache[(country, region)] = (lat, lon)
        if lat and lon:
            geocoded += 1
        if (i + 1) % 20 == 0:
            print(f"  Geocoded {i+1}/{len(unique_locations)} (found: {geocoded})")
        time.sleep(0.3)  # Nominatim rate limit

    print(f"  Geocoded: {geocoded}/{len(unique_locations)}")

    # Enrich projects
    print("\nEnriching projects...")
    methodology_named = 0
    coords_added = 0

    for p in projects:
        # 1. Add methodology name
        methodology = p.get("project_type", {}).get("methodology", "")
        if methodology:
            codes = [c.strip() for c in methodology.split(";")]
            names = []
            for code in codes:
                name = get_methodology_name(code)
                if name:
                    names.append(name)
                    methodology_named += 1
            if names:
                p["project_type"]["methodology_name"] = "; ".join(names)

        # 2. Geocode from cache
        if not p.get("location", {}).get("latitude"):
            country = p.get("location", {}).get("country", "")
            region = p.get("location", {}).get("region", "")
            cache_key = (country, region)
            if cache_key in geocode_cache:
                lat, lon = geocode_cache[cache_key]
                if lat and lon:
                    p["location"]["latitude"] = lat
                    p["location"]["longitude"] = lon
                    coords_added += 1

        # 3. Compute quality score
        p["data_quality"]["score"] = compute_quality_score(p)

        # 4. Add document URLs from registry IDs
        for reg_id in p.get("registry_ids", []):
            registry = reg_id.get("registry")
            rid = reg_id.get("id", "")
            if registry == "verra" and not reg_id.get("url"):
                reg_id["url"] = f"https://registry.verra.org/app/projectDetail/VCS/{rid}"
            elif registry == "gold_standard" and not reg_id.get("url"):
                reg_id["url"] = f"https://registry.goldstandard.org/projects/{rid}"

    print(f"  Methodology names added: {methodology_named}")
    print(f"  Coordinates added: {coords_added}")

    # Save enriched data
    with open(OUTPUT_FILE, "w") as f:
        for p in projects:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"\nSaved to {OUTPUT_FILE}")

    # Stats
    has_coords = sum(1 for p in projects if p.get("location", {}).get("latitude"))
    has_methodology_name = sum(1 for p in projects if p.get("project_type", {}).get("methodology_name"))
    has_desc = sum(1 for p in projects if p.get("description"))
    scores = [p["data_quality"]["score"] for p in projects]

    print(f"\n{'=' * 60}")
    print("ENRICHMENT STATS")
    print(f"{'=' * 60}")
    print(f"Coordinate coverage: {has_coords}/{len(projects)} ({100*has_coords/len(projects):.1f}%)")
    print(f"Methodology names: {has_methodology_name}/{len(projects)} ({100*has_methodology_name/len(projects):.1f}%)")
    print(f"Descriptions: {has_desc}/{len(projects)} ({100*has_desc/len(projects):.1f}%)")
    print(f"Quality scores: min={min(scores):.3f}, max={max(scores):.3f}, avg={sum(scores)/len(scores):.3f}")

    # Score distribution
    buckets = {"0.0-0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0}
    for s in scores:
        if s < 0.2: buckets["0.0-0.2"] += 1
        elif s < 0.4: buckets["0.2-0.4"] += 1
        elif s < 0.6: buckets["0.4-0.6"] += 1
        elif s < 0.8: buckets["0.6-0.8"] += 1
        else: buckets["0.8-1.0"] += 1
    print(f"\nQuality distribution:")
    for b, c in buckets.items():
        bar = "█" * (c * 50 // len(projects))
        print(f"  {b}: {c:4d} {bar}")


if __name__ == "__main__":
    main()
