"""
Generate market analysis and narrative context for the carbon projects dataset.
"""
import json

INPUT_FILE = "/Users/ekmelozdemir/earthloveunited.org/carbon-projects/unified/carbon_projects_enriched.jsonl"
OUTPUT_FILE = "/Users/ekmelozdemir/earthloveunited.org/carbon-projects/unified/market_analysis.json"


def main():
    projects = []
    with open(INPUT_FILE) as f:
        for line in f:
            projects.append(json.loads(line))

    print(f"Analyzing {len(projects)} projects...")

    # Country stats
    country_stats = {}
    for p in projects:
        country = p.get("location", {}).get("country", "Unknown")
        if country not in country_stats:
            country_stats[country] = {"count": 0, "types": {}, "total_reductions": 0, "cross_registered": 0}
        country_stats[country]["count"] += 1
        ptype = p.get("project_type", {}).get("category", "other")
        country_stats[country]["types"][ptype] = country_stats[country]["types"].get(ptype, 0) + 1
        reductions = p.get("crediting", {}).get("estimated_annual_reduction_tco2", 0) or 0
        country_stats[country]["total_reductions"] += reductions
        if p.get("data_quality", {}).get("cross_registered"):
            country_stats[country]["cross_registered"] += 1

    top_countries = sorted(country_stats.items(), key=lambda x: -x[1]["count"])[:30]

    # Type stats
    type_stats = {}
    for p in projects:
        ptype = p.get("project_type", {}).get("category", "other")
        if ptype not in type_stats:
            type_stats[ptype] = {"count": 0, "countries": set(), "total_reductions": 0, "methodologies": {}}
        type_stats[ptype]["count"] += 1
        type_stats[ptype]["countries"].add(p.get("location", {}).get("country", "Unknown"))
        reductions = p.get("crediting", {}).get("estimated_annual_reduction_tco2", 0) or 0
        type_stats[ptype]["total_reductions"] += reductions
        meth = p.get("project_type", {}).get("methodology", "")
        if meth:
            first_meth = meth.split(";")[0].strip()
            type_stats[ptype]["methodologies"][first_meth] = type_stats[ptype]["methodologies"].get(first_meth, 0) + 1

    # Methodology stats
    meth_stats = {}
    for p in projects:
        meth = p.get("project_type", {}).get("methodology", "")
        if meth:
            codes = [c.strip() for c in meth.split(";")]
            for code in codes:
                if code not in meth_stats:
                    meth_stats[code] = {"count": 0, "types": {}, "countries": set()}
                meth_stats[code]["count"] += 1
                ptype = p.get("project_type", {}).get("category", "other")
                meth_stats[code]["types"][ptype] = meth_stats[code]["types"].get(ptype, 0) + 1
                meth_stats[code]["countries"].add(p.get("location", {}).get("country", "Unknown"))

    top_methodologies = sorted(meth_stats.items(), key=lambda x: -x[1]["count"])[:20]

    # Registration years
    reg_years = {}
    for p in projects:
        reg_date = p.get("registration", {}).get("date", "")
        if reg_date and len(reg_date) >= 4:
            year = reg_date[:4]
            reg_years[year] = reg_years.get(year, 0) + 1

    # Cross-registration
    cross_registered = [p for p in projects if p.get("data_quality", {}).get("cross_registered")]
    cross_by_type = {}
    cross_by_country = {}
    for p in cross_registered:
        ptype = p.get("project_type", {}).get("category", "other")
        cross_by_type[ptype] = cross_by_type.get(ptype, 0) + 1
        country = p.get("location", {}).get("country", "Unknown")
        cross_by_country[country] = cross_by_country.get(country, 0) + 1

    total_reductions = sum(p.get("crediting", {}).get("estimated_annual_reduction_tco2", 0) or 0 for p in projects)

    analysis = {
        "market_overview": {
            "total_projects": len(projects),
            "total_countries": len(country_stats),
            "total_estimated_annual_reductions_tco2": total_reductions,
            "cross_registered_projects": len(cross_registered),
            "cross_registration_rate": round(len(cross_registered) / len(projects), 3),
            "verra_projects": sum(1 for p in projects if any(s["registry"] == "verra" for s in p["data_sources"])),
            "gold_standard_projects": sum(1 for p in projects if any(s["registry"] == "gold_standard" for s in p["data_sources"])),
        },
        "top_countries": [
            {
                "country": country,
                "project_count": stats["count"],
                "dominant_type": max(stats["types"].items(), key=lambda x: x[1])[0] if stats["types"] else None,
                "total_reductions_tco2": stats["total_reductions"],
                "cross_registered": stats["cross_registered"],
            }
            for country, stats in top_countries
        ],
        "project_types": {
            ptype: {
                "count": stats["count"],
                "percentage": round(100 * stats["count"] / len(projects), 1),
                "countries_count": len(stats["countries"]),
                "total_reductions_tco2": stats["total_reductions"],
                "top_methodologies": sorted(stats["methodologies"].items(), key=lambda x: -x[1])[:5],
            }
            for ptype, stats in sorted(type_stats.items(), key=lambda x: -x[1]["count"])
        },
        "top_methodologies": [
            {
                "code": code,
                "count": stats["count"],
                "primary_type": max(stats["types"].items(), key=lambda x: x[1])[0] if stats["types"] else None,
                "countries_count": len(stats["countries"]),
            }
            for code, stats in top_methodologies
        ],
        "registration_by_year": dict(sorted(reg_years.items())),
        "cross_registration": {
            "total": len(cross_registered),
            "by_type": dict(sorted(cross_by_type.items(), key=lambda x: -x[1])),
            "by_country": dict(sorted(cross_by_country.items(), key=lambda x: -x[1])[:20]),
        },
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(analysis, f, indent=2, ensure_ascii=False)
    print(f"Saved to {OUTPUT_FILE}")

    # Summary
    o = analysis["market_overview"]
    print(f"\nTotal: {o['total_projects']:,} projects, {o['total_countries']} countries")
    print(f"Est. reductions: {o['total_estimated_annual_reductions_tco2']:,.0f} tCO2e/yr")
    print(f"Cross-registered: {o['cross_registered_projects']} ({100*o['cross_registration_rate']:.1f}%)")
    print(f"\nTop 5 countries:")
    for c in analysis["top_countries"][:5]:
        print(f"  {c['country']}: {c['project_count']} projects")
    print(f"\nTop 5 methodologies:")
    for m in analysis["top_methodologies"][:5]:
        print(f"  {m['code']}: {m['count']} projects")


if __name__ == "__main__":
    main()
