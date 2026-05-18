"""
Scrape Verra project descriptions using the browser.
The Verra detail pages are JS-rendered SPAs, so we need the browser.
We'll do this in batches to avoid overwhelming the browser.
"""
import json
import time
import subprocess
import re

INPUT_FILE = "/Users/ekmelozdemir/earthloveunited.org/carbon-projects/raw/verra_projects.jsonl"
OUTPUT_FILE = "/Users/ekmelozdemir/earthloveunited.org/carbon-projects/raw/verra_descriptions.json"

def get_verra_ids_without_descriptions():
    """Get Verra project IDs that need descriptions."""
    # Load unified projects to find which ones are Verra-only (no description)
    unified = []
    with open("/Users/ekmelozdemir/earthloveunited.org/carbon-projects/unified/carbon_projects_enriched.jsonl") as f:
        for line in f:
            unified.append(json.loads(line))

    verra_no_desc = []
    for p in unified:
        if not p.get("description"):
            for reg_id in p.get("registry_ids", []):
                if reg_id.get("registry") == "verra":
                    verra_no_desc.append(reg_id["id"])
                    break

    return verra_no_desc


def scrape_batch(batch_ids):
    """Scrape a batch of Verra project pages using curl + regex."""
    descriptions = {}

    for proj_id in batch_ids:
        url = f"https://registry.verra.org/app/projectDetail/VCS/{proj_id}"

        try:
            result = subprocess.run(
                ["curl", "-s", "-L",
                 "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                 "-H", "Accept: text/html,application/xhtml+xml",
                 "-H", "Referer: https://registry.verra.org/",
                 "--max-time", "20",
                 url],
                capture_output=True, text=True, timeout=25
            )

            html = result.stdout

            # Try to extract description from various patterns
            desc = None

            # Look for JSON data in the page (Angular apps often embed data)
            json_match = re.search(r'window\.__INITIAL_STATE__\s*=\s*(\{.*?\});', html, re.S)
            if json_match:
                try:
                    data = json.loads(json_match.group(1))
                    # Navigate the JSON structure to find description
                    if isinstance(data, dict):
                        for key in ['description', 'projectDescription', 'overview']:
                            if key in data:
                                desc = data[key]
                                break
                except json.JSONDecodeError:
                    pass

            # Look for meta description
            if not desc:
                meta_match = re.search(r'<meta[^>]*name="description"[^>]*content="([^"]+)"', html, re.I)
                if meta_match:
                    desc = meta_match.group(1).strip()

            # Look for og:description
            if not desc:
                og_match = re.search(r'<meta[^>]*property="og:description"[^>]*content="([^"]+)"', html, re.I)
                if og_match:
                    desc = og_match.group(1).strip()

            # Look for description in script tags (common in Angular apps)
            if not desc:
                script_match = re.findall(r'<script[^>]*>(.*?)</script>', html, re.S)
                for script in script_match:
                    if 'description' in script.lower():
                        # Try to extract a description value
                        desc_match = re.search(r'["\']description["\']\s*:\s*["\']([^"\']{50,})["\']', script)
                        if desc_match:
                            desc = desc_match.group(1)
                            break

            if desc and len(desc) > 30:
                descriptions[proj_id] = desc[:2000]  # Cap at 2000 chars

        except Exception as e:
            print(f"  Error for {proj_id}: {e}")

        time.sleep(0.5)

    return descriptions


def main():
    print("=" * 60)
    print("VERRA DESCRIPTION SCRAPER")
    print("=" * 60)

    # Get IDs that need descriptions
    print("\nFinding Verra projects without descriptions...")
    ids = get_verra_ids_without_descriptions()
    print(f"  Found {len(ids)} projects needing descriptions")

    # Process in batches
    batch_size = 100
    all_descriptions = {}

    for batch_start in range(0, len(ids), batch_size):
        batch = ids[batch_start:batch_start + batch_size]
        batch_num = batch_start // batch_size + 1
        total_batches = (len(ids) + batch_size - 1) // batch_size

        print(f"\nBatch {batch_num}/{total_batches} ({len(batch)} projects)...")
        descs = scrape_batch(batch)
        all_descriptions.update(descs)
        print(f"  Found {len(descs)} descriptions (total: {len(all_descriptions)})")

    # Save
    with open(OUTPUT_FILE, "w") as f:
        json.dump(all_descriptions, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(all_descriptions)} descriptions to {OUTPUT_FILE}")

    coverage = len(all_descriptions) / len(ids) * 100 if ids else 0
    print(f"Coverage: {len(all_descriptions)}/{len(ids)} ({coverage:.1f}%)")


if __name__ == "__main__":
    main()
