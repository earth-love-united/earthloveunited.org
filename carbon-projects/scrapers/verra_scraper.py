import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Verra (VCS) Registry Scraper
POST API returns ALL projects in a single call (~4,965 projects).
No pagination needed.
"""
import json
import time
import requests

BASE_URL = "https://registry.verra.org"
HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://registry.verra.org/",
    "Origin": "https://registry.verra.org",
}
OUTPUT_FILE = "carbon-projects/raw/verra_projects.jsonl"


def scrape_verra():
    # Get summary stats
    print("Fetching Verra summary...")
    resp = requests.get(
        f"{BASE_URL}/uiapi/program/programSummary/VCS",
        headers=HEADERS, timeout=30
    )
    summary = resp.json()
    for stat in summary.get("statistics", []):
        if stat["code"] == "resourcesRegistered":
            print(f"  Registered projects: {int(stat['value']):,}")
        elif stat["code"] == "issued":
            print(f"  Total issued VCUs: {int(stat['value']):,}")
        elif stat["code"] == "retired":
            print(f"  Total retired VCUs: {int(stat['value']):,}")

    # Get ALL projects in one call
    print("\nFetching all Verra projects (single API call)...")
    start = time.time()
    resp = requests.post(
        f"{BASE_URL}/uiapi/resource/resource/search",
        json={"program": "VCS", "page": 0, "size": 1},
        headers=HEADERS, timeout=120
    )
    resp.raise_for_status()
    data = resp.json()
    projects = data.get("value", [])
    elapsed = time.time() - start
    print(f"  Fetched {len(projects)} projects in {elapsed:.1f}s")

    # Save raw data
    with open(OUTPUT_FILE, "w") as f:
        for p in projects:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"  Saved to {OUTPUT_FILE}")

    # Print status breakdown
    statuses = {}
    for p in projects:
        s = p.get("resourceStatus", "Unknown")
        statuses[s] = statuses.get(s, 0) + 1
    print(f"\nStatus breakdown:")
    for status, count in sorted(statuses.items(), key=lambda x: -x[1]):
        print(f"  {status}: {count}")

    # Print type breakdown
    types = {}
    for p in projects:
        t = p.get("protocolCategories", "Unknown")
        types[t] = types.get(t, 0) + 1
    print(f"\nType breakdown:")
    for t, count in sorted(types.items(), key=lambda x: -x[1]):
        print(f"  {t}: {count}")

    # Print country breakdown (top 20)
    countries = {}
    for p in projects:
        c = p.get("country", "Unknown")
        countries[c] = countries.get(c, 0) + 1
    print(f"\nTop 20 countries:")
    for c, count in sorted(countries.items(), key=lambda x: -x[1])[:20]:
        print(f"  {c}: {count}")

    return projects


if __name__ == "__main__":
    scrape_verra()
