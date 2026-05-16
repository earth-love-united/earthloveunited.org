"""
Earth Love United — Climate Knowledge Dataset Pipeline
Main orchestrator. Runs all extractors, processes, chunks, and outputs
the final dataset ready for Hugging Face.

Usage:
  python pipeline.py --all          # Run everything
  python pipeline.py --arxiv        # Just arXiv
  python pipeline.py --wikipedia    # Just Wikipedia
  python pipeline.py --ipcc         # Just IPCC
  python pipeline.py --process      # Just process existing raw data
"""

import json
import argparse
from pathlib import Path
from datetime import datetime

from builder import DatasetBuilder, clean_text, chunk_text, make_doc_id, is_climate_relevant

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")
PROCESSED_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/processed")


def load_arxiv_papers() -> list:
    """Load and format arXiv papers."""
    path = RAW_DIR / "arxiv_climate_papers.json"
    if not path.exists():
        print("arXiv papers not found. Run arxiv_scraper.py first.")
        return []

    with open(path) as f:
        papers = json.load(f)

    documents = []
    for paper in papers:
        # Combine title + abstract as the knowledge unit
        text = f"{paper['title']}. {paper['abstract']}"

        doc = {
            'id': make_doc_id('arxiv', paper['arxiv_id']),
            'source': 'arXiv',
            'title': paper['title'],
            'text': text,
            'url': f"https://arxiv.org/abs/{paper['arxiv_id']}",
            'date': paper.get('published', ''),
            'type': 'research_paper',
            'topics': paper.get('categories', []),
            'confidence': 'high',
            'authors': paper.get('authors', []),
            'check_relevance': False,  # Already filtered by query
        }
        documents.append(doc)

    print(f"Loaded {len(documents)} arXiv papers")
    return documents


def load_wikipedia_articles() -> list:
    """Load and format Wikipedia articles."""
    path = RAW_DIR / "wikipedia_climate_articles.json"
    if not path.exists():
        print("Wikipedia articles not found. Run wikipedia_extractor.py first.")
        return []

    with open(path) as f:
        articles = json.load(f)

    documents = []
    for article in articles:
        doc = {
            'id': make_doc_id('wikipedia', article['title']),
            'source': 'Wikipedia',
            'title': article['title'],
            'text': article['text'],
            'url': article.get('url', ''),
            'date': article.get('last_modified', ''),
            'type': 'encyclopedia',
            'topics': article.get('categories', [])[:10],
            'confidence': 'high',
            'check_relevance': False,  # Already curated
        }
        documents.append(doc)

    print(f"Loaded {len(documents)} Wikipedia articles")
    return documents


def load_ipcc_reports() -> list:
    """Load and format IPCC reports."""
    path = RAW_DIR / "ipcc_reports.json"
    if not path.exists():
        print("IPCC reports not found. Run ipcc_extractor.py first.")
        return []

    with open(path) as f:
        reports = json.load(f)

    documents = []
    for report in reports:
        doc = {
            'id': make_doc_id('ipcc', report['id']),
            'source': 'IPCC',
            'title': report['title'],
            'text': report['text'],
            'url': report.get('url', ''),
            'date': report.get('date', ''),
            'type': report.get('type', 'ipcc_report'),
            'topics': report.get('topics', []),
            'confidence': 'very_high',
            'check_relevance': False,
        }
        documents.append(doc)

    print(f"Loaded {len(documents)} IPCC report sections")
    return documents


def load_our_research() -> list:
    """Load our own RESEARCH.md as structured knowledge."""
    research_path = Path("/Users/ekmelozdemir/earthloveunited.org/RESEARCH.md")
    if not research_path.exists():
        print("RESEARCH.md not found")
        return []

    with open(research_path) as f:
        content = f.read()

    # Split into sections by headers
    sections = re.split(r'\n## ', content)

    documents = []
    for section in sections:
        if not section.strip():
            continue

        # Extract title
        lines = section.strip().split('\n')
        title = lines[0].strip().lstrip('#').strip()
        text = '\n'.join(lines[1:]).strip()

        if len(text.split()) < 50:
            continue

        doc = {
            'id': make_doc_id('elu_research', title),
            'source': 'Earth Love United Research',
            'title': title,
            'text': text,
            'url': 'https://earthloveunited.org',
            'date': '2026-05-15',
            'type': 'research_synthesis',
            'topics': ['climate science', 'carbon', 'earth love united'],
            'confidence': 'very_high',
            'check_relevance': False,
        }
        documents.append(doc)

    print(f"Loaded {len(documents)} research sections from RESEARCH.md")
    return documents


def load_data_sources_research() -> list:
    """Load DATA_SOURCES.md as structured knowledge."""
    path = Path("/Users/ekmelozdemir/earthloveunited.org/DATA_SOURCES.md")
    if not path.exists():
        return []

    with open(path) as f:
        content = f.read()

    sections = re.split(r'\n## ', content)
    documents = []

    for section in sections:
        if not section.strip():
            continue
        lines = section.strip().split('\n')
        title = lines[0].strip().lstrip('#').strip()
        text = '\n'.join(lines[1:]).strip()
        if len(text.split()) < 50:
            continue

        doc = {
            'id': make_doc_id('elu_data_sources', title),
            'source': 'Earth Love United Data Sources',
            'title': title,
            'text': text,
            'url': 'https://earthloveunited.org',
            'date': '2026-05-15',
            'type': 'data_catalog',
            'topics': ['data sources', 'climate data', 'APIs'],
            'confidence': 'very_high',
            'check_relevance': False,
        }
        documents.append(doc)

    print(f"Loaded {len(documents)} sections from DATA_SOURCES.md")
    return documents


def run_pipeline(args):
    """Run the full pipeline."""
    builder = DatasetBuilder()

    # ─── Load all sources ───

    if args.all or args.arxiv:
        print("\n=== Loading arXiv papers ===")
        docs = load_arxiv_papers()
        for doc in docs:
            builder.add_document(doc)

    if args.all or args.wikipedia:
        print("\n=== Loading Wikipedia articles ===")
        docs = load_wikipedia_articles()
        for doc in docs:
            builder.add_document(doc)

    if args.all or args.ipcc:
        print("\n=== Loading IPCC reports ===")
        docs = load_ipcc_reports()
        for doc in docs:
            builder.add_document(doc)

    if args.all or args.research:
        print("\n=== Loading our research ===")
        docs = load_our_research()
        for doc in docs:
            builder.add_document(doc)
        docs = load_data_sources_research()
        for doc in docs:
            builder.add_document(doc)

    if args.process:
        # Load from existing processed data
        pass

    # ─── Process ───

    print(f"\n=== Processing {len(builder.documents)} documents ===")
    processed = builder.process_all()

    # ─── Save ───

    print(f"\n=== Saving dataset ===")
    df = builder.save(processed, name="earth_love_united_climate_knowledge")

    # ─── Print summary ───

    print(f"\n{'='*60}")
    print(f"DATASET SUMMARY")
    print(f"{'='*60}")
    print(f"Total documents: {builder.stats['total_docs']}")
    print(f"Total chunks:    {builder.stats['total_chunks']}")
    print(f"\nSources:")
    for source, count in sorted(builder.stats['sources'].items(), key=lambda x: -x[1]):
        print(f"  {source}: {count}")
    print(f"\nOutput files:")
    print(f"  {PROCESSED_DIR / 'earth_love_united_climate_knowledge.jsonl'}")
    print(f"  {PROCESSED_DIR / 'earth_love_united_climate_knowledge.parquet'}")
    print(f"{'='*60}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Climate Knowledge Dataset Pipeline")
    parser.add_argument('--all', action='store_true', help='Run everything')
    parser.add_argument('--arxiv', action='store_true', help='Scrape arXiv')
    parser.add_argument('--wikipedia', action='store_true', help='Extract Wikipedia')
    parser.add_argument('--ipcc', action='store_true', help='Extract IPCC reports')
    parser.add_argument('--research', action='store_true', help='Load our research')
    parser.add_argument('--process', action='store_true', help='Process existing raw data')
    args = parser.parse_args()

    if not any([args.all, args.arxiv, args.wikipedia, args.ipcc, args.research, args.process]):
        args.all = True

    run_pipeline(args)
