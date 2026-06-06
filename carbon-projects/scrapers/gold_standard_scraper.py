import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Gold Standard Registry Scraper
GET API: https://public-api.goldstandard.org/projects
No auth required. ~4,085 projects.
"""
import json
import time
import requests

BASE_URL = "https://public-api.goldstandard.org"
PROJECTS_ENDPOINT = f"{BASE_URL}/projects"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://registry.goldstandard.org/",
}
PAGE_SIZE = 100
OUTPUT_FILE = "carbon-projects/raw/gold_standard_projects.jsonl"


def scrape_gold_standard():
    all_projects = []
    page = 1
    total_count = None

    print("Scraping Gold Standard projects...")
    while True:
        params = {"query": "", "page": page, "size": PAGE_SIZE}
        try:
            resp = requests.get(
                PROJECTS_ENDPOINT,
                params=params,
                headers=HEADERS,
                timeout=60
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"  Error on page {page}: {e}")
            time.sleep(5)
            try:
                resp = requests.get(
                    PROJECTS_ENDPOINT,
                    params=params,
                    headers=HEADERS,
                    timeout=60
                )
                resp.raise_for_status()
            except requests.RequestException as e2:
                print(f"  Failed retry on page {page}: {e2}")
                break

        projects = resp.json()

        if not projects or not isinstance(projects, list):
            print(f"  No more projects on page {page}")
            break

        # Get total count from first response
        if total_count is None:
            total_count = resp.headers.get("X-Total-Count")
            if total_count:
                total_count = int(total_count)
                print(f"  Total projects: {total_count:,}")
            remaining = resp.headers.get("X-Ratelimit-Remaining-Quota")
            if remaining:
                print(f"  Rate limit remaining: {remaining}")

        all_projects.extend(projects)
        print(f"  Page {page}: {len(projects)} projects (total: {len(all_projects)})")

        # Check if we've got all projects
        if total_count and len(all_projects) >= total_count:
            break

        page += 1
        time.sleep(0.5)  # Be respectful

    print(f"\nTotal Gold Standard projects scraped: {len(all_projects)}")

    # Save raw data
    with open(OUTPUT_FILE, "w") as f:
        for p in all_projects:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"Saved to {OUTPUT_FILE}")

    return all_projects


if __name__ == "__main__":
    scrape_gold_standard()
