"""
arXiv Climate Paper Scraper — Robust Version
Uses proper rate limiting and fallback strategies.
"""

import time
import re
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
from tqdm import tqdm

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")
ARXIV_API = "https://export.arxiv.org/api/query"

NS = {
    'atom': 'http://www.w3.org/2005/Atom',
    'arxiv': 'http://arxiv.org/schemas/atom',
}

# Smaller, targeted queries to avoid rate limits
QUERIES = [
    "cat:physics.ao-ph+AND+abs:climate+change",
    "cat:physics.ao-ph+AND+abs:carbon+cycle",
    "cat:physics.ao-ph+AND+abs:global+warming",
    "cat:physics.geo-ph+AND+abs:climate",
    "cat:cs.CL+AND+abs:climate+change",
]


def fetch_arxiv(query: str, start: int = 0, max_results: int = 100, retries: int = 3) -> str:
    """Fetch papers from arXiv API with retry logic."""
    params = {
        'search_query': query,
        'start': start,
        'max_results': max_results,
        'sortBy': 'submittedDate',
        'sortOrder': 'descending',
    }

    for attempt in range(retries):
        try:
            response = requests.get(ARXIV_API, params=params, timeout=30)
            if response.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"  Rate limited. Waiting {wait}s...")
                time.sleep(wait)
                continue
            response.raise_for_status()
            return response.text
        except requests.exceptions.RequestException as e:
            if attempt < retries - 1:
                time.sleep(10 * (attempt + 1))
            else:
                raise e

    return ""


def parse_arxiv_xml(xml_text: str) -> list:
    """Parse arXiv API XML response."""
    root = ET.fromstring(xml_text)
    papers = []

    for entry in root.findall('atom:entry', NS):
        paper = {
            'arxiv_id': entry.find('atom:id', NS).text.split('/')[-1] if entry.find('atom:id', NS) is not None else '',
            'title': entry.find('atom:title', NS).text.strip().replace('\n', ' ') if entry.find('atom:title', NS) is not None else '',
            'abstract': entry.find('atom:summary', NS).text.strip().replace('\n', ' ') if entry.find('atom:summary', NS) is not None else '',
            'published': entry.find('atom:published', NS).text if entry.find('atom:published', NS) is not None else '',
            'authors': [a.find('atom:name', NS).text for a in entry.findall('atom:author', NS) if a.find('atom:name', NS) is not None],
            'categories': [c.get('term') for c in entry.findall('atom:category', NS)],
        }
        papers.append(paper)

    return papers


def get_total_results(xml_text: str) -> int:
    """Get total number of results."""
    root = ET.fromstring(xml_text)
    total = root.find('{http://a9.com/-/spec/opensearch/1.1/}totalResults')
    return int(total.text) if total is not None else 0


def scrape_arxiv(max_per_query: int = 200) -> list:
    """Scrape climate papers with proper rate limiting."""
    all_papers = []
    seen_ids = set()

    for query in QUERIES:
        print(f"\nQuery: {query}")
        time.sleep(5)  # Initial delay between queries

        try:
            xml = fetch_arxiv(query, start=0, max_results=1)
            total = get_total_results(xml)
            fetch_count = min(total, max_per_query)
            print(f"  Total: {total}, fetching: {fetch_count}")

            for start in tqdm(range(0, fetch_count, 50), desc="  Fetching"):
                time.sleep(4)  # Rate limit: 1 req per 3+ seconds

                try:
                    xml = fetch_arxiv(query, start=start, max_results=50)
                    papers = parse_arxiv_xml(xml)

                    for paper in papers:
                        if paper['arxiv_id'] not in seen_ids:
                            seen_ids.add(paper['arxiv_id'])
                            all_papers.append(paper)

                except Exception as e:
                    print(f"  Error at offset {start}: {e}")
                    time.sleep(15)
                    continue

        except Exception as e:
            print(f"  Query failed: {e}")
            continue

    print(f"\nTotal unique papers: {len(all_papers)}")
    return all_papers


def save_papers(papers: list):
    """Save papers to raw data directory."""
    output_path = RAW_DIR / "arxiv_climate_papers.json"
    with open(output_path, 'w') as f:
        json.dump(papers, f, indent=2)
    print(f"Saved {len(papers)} papers to {output_path}")


if __name__ == "__main__":
    papers = scrape_arxiv(max_per_query=200)
    save_papers(papers)
