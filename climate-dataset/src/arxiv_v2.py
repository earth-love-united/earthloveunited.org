"""
arXiv Climate Paper Scraper v2.0
Expanded queries for 5,000+ papers.
"""

import json
import time
from pathlib import Path

import arxiv
from tqdm import tqdm

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")

QUERIES = [
    # Core climate science
    "cat:physics.ao-ph AND (abs:climate OR abs:warming OR abs:carbon OR abs:temperature)",
    "cat:physics.ao-ph AND (abs:greenhouse OR abs:emissions OR abs:radiative)",
    "cat:physics.ao-ph AND (abs:precipitation OR abs:drought OR abs:extreme)",
    # Geophysics
    "cat:physics.geo-ph AND (abs:climate OR abs:carbon OR abs:sea+level)",
    "cat:physics.geo-ph AND (abs:glacier OR abs:ice+sheet OR abs:permafrost)",
    # Atmospheric science
    "cat:physics.ao-ph AND (abs:aerosol OR abs:cloud OR abs:atmospheric)",
    # Oceanography
    "cat:physics.ao-ph AND (abs:ocean OR abs:marine OR abs:coral)",
    # Climate impacts
    "cat:physics.ao-ph AND (abs:impact OR abs:risk OR abs:vulnerability)",
    # NLP/AI for climate
    "cat:cs.CL AND (abs:climate+change OR abs:environmental)",
    "cat:cs.AI AND (abs:climate OR abs:carbon OR abs:sustainability)",
    "cat:cs.LG AND (abs:climate OR abs:weather OR abs:earth+system)",
    # Environmental science
    "cat:cs.CY AND (abs:climate OR abs:sustainability OR abs:environmental)",
]

def scrape_arxiv_v2(max_per_query: int = 500) -> list:
    """Scrape expanded climate papers."""
    all_papers = []
    seen_ids = set()

    for query in QUERIES:
        print(f"\nQuery: {query[:60]}...")
        try:
            search = arxiv.Search(
                query=query,
                max_results=max_per_query,
                sort_by=arxiv.SortCriterion.SubmittedDate,
                sort_order=arxiv.SortOrder.Descending,
            )

            # Use client for better pagination
            client = arxiv.Client()
            results = list(client.results(search))

            new_count = 0
            for paper in results:
                pid = paper.entry_id.split('/')[-1]
                if pid not in seen_ids:
                    seen_ids.add(pid)
                    all_papers.append({
                        'arxiv_id': pid,
                        'title': paper.title.strip().replace('\n', ' '),
                        'abstract': paper.summary.strip().replace('\n', ' '),
                        'published': paper.published.isoformat() if paper.published else '',
                        'authors': [a.name for a in paper.authors],
                        'categories': paper.categories,
                        'pdf_url': paper.pdf_url,
                    })
                    new_count += 1

            print(f"  Found {len(results)} papers ({new_count} new)")
            time.sleep(3)

        except Exception as e:
            print(f"  Error: {e}")
            time.sleep(10)
            continue

    print(f"\nTotal unique papers: {len(all_papers)}")
    return all_papers


if __name__ == "__main__":
    papers = scrape_arxiv_v2(max_per_query=500)
    output_path = RAW_DIR / "arxiv_climate_v2.json"
    with open(output_path, 'w') as f:
        json.dump(papers, f, indent=2)
    print(f"Saved to {output_path}")
