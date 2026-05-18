"""
Deduplication engine for unified carbon projects.
Uses fuzzy matching on name, developer, country, type, methodology.
"""
import json
import re
from collections import defaultdict

INPUT_FILE = "/Users/ekmelozdemir/earthloveunited.org/carbon-projects/unified/carbon_projects_unified.jsonl"
OUTPUT_FILE = "/Users/ekmelozdemir/earthloveunited.org/carbon-projects/unified/carbon_projects_deduped.jsonl"
DEDUP_MAP_FILE = "/Users/ekmelozdemir/earthloveunited.org/carbon-projects/unified/dedup_mapping.json"


def normalize_text(text):
    """Normalize text for comparison."""
    if not text:
        return ""
    text = text.lower().strip()
    # Remove common suffixes/prefixes
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s]', '', text)
    # Remove common words
    for word in ['the', 'project', 'programme', 'program', 'carbon', 'credit', 'credits']:
        text = re.sub(r'\b' + word + r'\b', '', text)
    return text.strip()


def jaccard_similarity(str1, str2):
    """Compute Jaccard similarity between two strings using word sets."""
    if not str1 or not str2:
        return 0.0
    words1 = set(str1.split())
    words2 = set(str2.split())
    if not words1 or not words2:
        return 0.0
    intersection = words1 & words2
    union = words1 | words2
    return len(intersection) / len(union) if union else 0.0


def compute_match_score(p1, p2):
    """Compute matching score between two projects. Returns (score, reasons)."""
    score = 0.0
    reasons = []

    # 1. Project name similarity (weight: 0.3)
    name1 = normalize_text(p1.get("name", ""))
    name2 = normalize_text(p2.get("name", ""))
    name_sim = jaccard_similarity(name1, name2)
    if name_sim > 0.5:
        score += 0.3 * name_sim
        reasons.append(f"name_sim={name_sim:.2f}")

    # 2. Developer name similarity (weight: 0.2)
    dev1 = normalize_text(p1.get("developer", {}).get("name", ""))
    dev2 = normalize_text(p2.get("developer", {}).get("name", ""))
    dev_sim = jaccard_similarity(dev1, dev2)
    if dev_sim > 0.3:
        score += 0.2 * dev_sim
        reasons.append(f"dev_sim={dev_sim:.2f}")

    # 3. Country match (weight: 0.15)
    c1 = p1.get("location", {}).get("country_code_iso3")
    c2 = p2.get("location", {}).get("country_code_iso3")
    if c1 and c2 and c1 == c2:
        score += 0.15
        reasons.append("country_match")

    # 4. Project type match (weight: 0.1)
    t1 = p1.get("project_type", {}).get("category")
    t2 = p2.get("project_type", {}).get("category")
    if t1 and t2 and t1 == t2:
        score += 0.1
        reasons.append("type_match")

    # 5. Methodology overlap (weight: 0.15)
    m1 = p1.get("project_type", {}).get("methodology", "")
    m2 = p2.get("project_type", {}).get("methodology", "")
    if m1 and m2:
        # Extract base methodology code
        m1_base = m1.split(";")[0].strip().split("-")[0].strip()
        m2_base = m2.split(";")[0].strip().split("-")[0].strip()
        if m1_base == m2_base:
            score += 0.15
            reasons.append(f"methodology_match={m1_base}")

    # 6. Crediting period overlap (weight: 0.1)
    start1 = p1.get("crediting", {}).get("period_start")
    start2 = p2.get("crediting", {}).get("period_start")
    if start1 and start2:
        # Compare year only
        year1 = start1[:4] if len(start1) >= 4 else None
        year2 = start2[:4] if len(start2) >= 4 else None
        if year1 and year2 and year1 == year2:
            score += 0.1
            reasons.append(f"year_match={year1}")

    return score, reasons


def merge_projects(p1, p2):
    """Merge two duplicate projects into one."""
    merged = json.loads(json.dumps(p1))  # Deep copy

    # Merge registry IDs
    existing_ids = {(r["registry"], r["id"]) for r in merged["registry_ids"]}
    for r in p2["registry_ids"]:
        if (r["registry"], r["id"]) not in existing_ids:
            merged["registry_ids"].append(r)

    # Merge data sources
    existing_sources = {s["registry"] for s in merged["data_sources"]}
    for s in p2["data_sources"]:
        if s["registry"] not in existing_sources:
            merged["data_sources"].append(s)

    # Take the better description
    if not merged.get("description") and p2.get("description"):
        merged["description"] = p2["description"]

    # Take coordinates if available
    if not merged["location"].get("latitude") and p2["location"].get("latitude"):
        merged["location"]["latitude"] = p2["location"]["latitude"]
        merged["location"]["longitude"] = p2["location"]["longitude"]

    # Merge SDGs
    existing_sdgs = set(merged.get("co_benefits", {}).get("sdgs", []))
    for sdg in p2.get("co_benefits", {}).get("sdgs", []):
        if sdg not in existing_sdgs:
            merged["co_benefits"]["sdgs"].append(sdg)

    # Update quality score
    merged["data_quality"]["cross_registered"] = True
    merged["data_quality"]["registries_count"] = len(merged["registry_ids"])
    merged["data_quality"]["score"] = min(1.0, 0.5 + 0.1 * merged["data_quality"]["registries_count"])

    # Take the better status (prefer registered > listed > others)
    status_priority = {
        "registered": 3, "listed": 2, "certified": 2, "gold_standard_certified_project": 2,
        "under_validation": 1, "under_development": 0, "inactive": -1, "withdrawn": -2,
    }
    s1_priority = status_priority.get(merged["status"], 0)
    s2_priority = status_priority.get(p2["status"], 0)
    if s2_priority > s1_priority:
        merged["status"] = p2["status"]
        merged["status_raw"] = p2["status_raw"]

    return merged


def main():
    print("=" * 60)
    print("CARBON PROJECTS DEDUPLICATION ENGINE")
    print("=" * 60)

    # Load unified projects
    print("\nLoading unified projects...")
    projects = []
    with open(INPUT_FILE) as f:
        for line in f:
            projects.append(json.loads(line))
    print(f"  Loaded {len(projects)} projects")

    # Group by country for efficient matching
    print("\nGrouping by country...")
    by_country = defaultdict(list)
    for i, p in enumerate(projects):
        country = p.get("location", {}).get("country_code_iso3", "UNKNOWN")
        by_country[country].append(i)

    # Find duplicates
    print("\nFinding duplicates...")
    to_merge = []  # List of (i, j, score, reasons)
    seen_pairs = set()

    for country, indices in by_country.items():
        for a in range(len(indices)):
            for b in range(a + 1, len(indices)):
                i, j = indices[a], indices[b]
                pair_key = (min(i, j), max(i, j))
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)

                p1, p2 = projects[i], projects[j]

                # Only match across different registries
                r1 = {s["registry"] for s in p1["data_sources"]}
                r2 = {s["registry"] for s in p2["data_sources"]}
                if r1 & r2:  # Same registry, skip
                    continue

                score, reasons = compute_match_score(p1, p2)
                if score >= 0.5:
                    to_merge.append((i, j, score, reasons))

    print(f"  Found {len(to_merge)} potential duplicates")

    # Sort by score (highest first) and merge
    to_merge.sort(key=lambda x: -x[2])

    merged_indices = set()
    merge_groups = []
    dedup_mapping = []

    for i, j, score, reasons in to_merge:
        if i in merged_indices or j in merged_indices:
            continue
        merge_groups.append((i, j, score, reasons))
        merged_indices.add(i)
        merged_indices.add(j)

        # Merge
        merged = merge_projects(projects[i], projects[j])
        dedup_mapping.append({
            "project_1": {"unified_id": projects[i]["unified_id"], "name": projects[i]["name"], "registry": projects[i]["data_sources"][0]["registry"]},
            "project_2": {"unified_id": projects[j]["unified_id"], "name": projects[j]["name"], "registry": projects[j]["data_sources"][0]["registry"]},
            "score": round(score, 3),
            "reasons": reasons,
            "merged_id": merged["unified_id"],
        })

    print(f"  Merged {len(merge_groups)} pairs")

    # Build final list
    final_projects = []
    for i, p in enumerate(projects):
        if i in merged_indices:
            # Find the merge group and use merged version
            for j, k, score, reasons in merge_groups:
                if i == j:
                    # Find if k was also merged
                    merged = merge_projects(projects[j], projects[k])
                    final_projects.append(merged)
                    break
        else:
            final_projects.append(p)

    print(f"\nFinal project count: {len(final_projects)} (was {len(projects)}, merged {len(merge_groups)} pairs)")

    # Save deduped data
    with open(OUTPUT_FILE, "w") as f:
        for p in final_projects:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"Saved to {OUTPUT_FILE}")

    # Save dedup mapping
    with open(DEDUP_MAP_FILE, "w") as f:
        json.dump(dedup_mapping, f, indent=2)
    print(f"Saved dedup mapping to {DEDUP_MAP_FILE}")

    # Print some examples
    print(f"\n{'=' * 60}")
    print("SAMPLE MERGES (top 10 by score)")
    print(f"{'=' * 60}")
    for m in dedup_mapping[:10]:
        print(f"\n  Score: {m['score']}")
        print(f"  P1: [{m['project_1']['registry']}] {m['project_1']['name'][:60]}")
        print(f"  P2: [{m['project_2']['registry']}] {m['project_2']['name'][:60]}")
        print(f"  Reasons: {', '.join(m['reasons'])}")

    # Stats
    cross_registered = sum(1 for p in final_projects if p["data_quality"]["cross_registered"])
    print(f"\n{'=' * 60}")
    print("DEDUPLICATION STATS")
    print(f"{'=' * 60}")
    print(f"Original count: {len(projects)}")
    print(f"Merged pairs: {len(merge_groups)}")
    print(f"Final count: {len(final_projects)}")
    print(f"Cross-registered projects: {cross_registered}")
    print(f"Reduction: {len(projects) - len(final_projects)} projects ({100*(len(projects)-len(final_projects))/len(projects):.1f}%)")


if __name__ == "__main__":
    main()
