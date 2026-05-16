"""
arXiv Climate Paper Scraper — Using arxiv Python package
More reliable than raw API calls.
"""

import json
import time
from pathlib import Path

import arxiv
from tqdm import tqdm

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")

QUERIES = [
    "cat:physics.ao-ph AND (abs:climate OR abs:warming OR abs:carbon)",
    "cat:physics.geo-ph AND (abs:climate OR abs:carbon)",
    "cat:cs.CL AND (abs:climate OR abs:carbon OR abs:environmental)",
    "cat:cs.AI AND (abs:climate OR abs:carbon)",
    "cat:cs.LG AND (abs:climate OR abs:weather OR abs:carbon)",
]

def scrape_arxiv(max_per_query: int = 200) -> list:
    """Scrape climate papers using arxiv package."""
    all_papers = []
    seen_ids = set()

    for query in QUERIES:
        print(f"\nQuery: {query}")

        try:
            search = arxiv.Search(
                query=query,
                max_results=max_per_query,
                sort_by=arxiv.SortCriterion.SubmittedDate,
                sort_order=arxiv.SortOrder.Descending,
            )

            results = list(search.results())
            print(f"  Found {len(results)} papers")

            for paper in results:
                if paper.entry_id not in seen_ids:
                    seen_ids.add(paper.entry_id)
                    all_papers.append({
                        'arxiv_id': paper.entry_id.split('/')[-1],
                        'title': paper.title.strip().replace('\n', ' '),
                        'abstract': paper.summary.strip().replace('\n', ' '),
                        'published': paper.published.isoformat() if paper.published else '',
                        'authors': [a.name for a in paper.authors],
                        'categories': paper.categories,
                        'pdf_url': paper.pdf_url,
                    })

            time.sleep(3)  # Be nice

        except Exception as e:
            print(f"  Error: {e}")
            time.sleep(10)
            continue

    print(f"\nTotal unique papers: {len(all_papers)}")
    return all_papers


def save_papers(papers: list):
    """Save papers."""
    output_path = RAW_DIR / "arxiv_climate_papers.json"
    with open(output_path, 'w') as f:
        json.dump(papers, f, indent=2)
    print(f"Saved {len(papers)} papers to {output_path}")


if __name__ == "__main__":
    papers = scrape_arxiv(max_per_query=200)
    save_papers(papers)
