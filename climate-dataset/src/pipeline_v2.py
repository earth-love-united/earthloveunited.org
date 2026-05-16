"""
Earth Love United — Climate Knowledge Dataset Pipeline v2.0
Full enhanced pipeline with all fixes and new sources.
"""

import json
import re
from pathlib import Path
from datetime import datetime

import pandas as pd
from tqdm import tqdm

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")
PROCESSED_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/processed")

# Import builder v2
import sys
sys.path.insert(0, str(Path(__file__).parent))
exec(open(Path(__file__).parent / "builder_v2.py").read())


def load_all_sources():
    """Load all data sources."""
    builder = DatasetBuilderV2()

    # ─── 1. Wikipedia v2 (expanded, deduplicated) ───
    print("\n=== Loading Wikipedia v2 ===")
    wiki_path = RAW_DIR / "wikipedia_climate_v2.json"
    if not wiki_path.exists():
        wiki_path = RAW_DIR / "wikipedia_climate_articles.json"  # Fallback
    with open(wiki_path) as f:
        articles = json.load(f)

    for article in articles:
        # Clean categories
        clean_cats = clean_wikipedia_categories(article.get('categories', []))
        # Extract topics from content
        topics = extract_climate_topics(article['text'])
        if clean_cats:
            topics = list(set(topics + clean_cats))[:10]

        doc = {
            "id": make_doc_id("wikipedia", article["title"]),
            "source": "Wikipedia",
            "title": article["title"],
            "text": article["text"],
            "url": article.get("url", ""),
            "date": article.get("last_modified", ""),
            "type": "encyclopedia",
            "topics": topics,
            "confidence": "high",
            "check_relevance": False,
        }
        builder.add_document(doc)
    print(f"  {builder.stats['sources'].get('Wikipedia', 0)} articles")

    # ─── 2. arXiv v2 (expanded) ───
    print("\n=== Loading arXiv v2 ===")
    arxiv_path = RAW_DIR / "arxiv_climate_v2.json"
    if not arxiv_path.exists():
        arxiv_path = RAW_DIR / "arxiv_climate_papers.json"  # Fallback
    with open(arxiv_path) as f:
        papers = json.load(f)

    for paper in papers:
        text = f"{paper['title']}. {paper['abstract']}"
        topics = extract_climate_topics(text)
        if paper.get('categories'):
            topics = list(set(topics + paper['categories'][:3]))[:10]

        doc = {
            "id": make_doc_id("arxiv", paper["arxiv_id"]),
            "source": "arXiv",
            "title": paper["title"],
            "text": text,
            "url": f"https://arxiv.org/abs/{paper['arxiv_id']}",
            "date": paper.get("published", ""),
            "type": "research_paper",
            "topics": topics,
            "confidence": "high",
            "check_relevance": False,
        }
        builder.add_document(doc)
    print(f"  {builder.stats['sources'].get('arXiv', 0)} papers")

    # ─── 3. IPCC Reports ───
    print("\n=== Loading IPCC Reports ===")
    with open(RAW_DIR / "ipcc_reports.json") as f:
        reports = json.load(f)

    for report in reports:
        topics = extract_climate_topics(report['text'])
        doc = {
            "id": make_doc_id("ipcc", report["id"]),
            "source": "IPCC",
            "title": report["title"],
            "text": report["text"],
            "url": report.get("url", ""),
            "date": report.get("date", ""),
            "type": report.get("type", "ipcc_report"),
            "topics": topics,
            "confidence": "very_high",
            "check_relevance": False,
        }
        builder.add_document(doc)
    print(f"  {builder.stats['sources'].get('IPCC', 0)} reports")

    # ─── 4. Project Drawdown Solutions ───
    print("\n=== Loading Project Drawdown ===")
    drawdown_path = RAW_DIR / "drawdown_solutions.json"
    if drawdown_path.exists():
        with open(drawdown_path) as f:
            solutions = json.load(f)
        for sol in solutions:
            topics = extract_climate_topics(sol['text'])
            doc = {
                "id": make_doc_id("drawdown", sol.get("solution_name", sol["title"])),
                "source": "Project Drawdown",
                "title": sol["title"],
                "text": sol["text"],
                "url": sol.get("url", ""),
                "date": "2026-01-01",
                "type": "solution",
                "topics": topics,
                "confidence": "very_high",
                "check_relevance": False,
            }
            builder.add_document(doc)
        print(f"  {builder.stats['sources'].get('Project Drawdown', 0)} solutions")
    else:
        print("  Not found, skipping")

    # ─── 5. EPA Climate Explainers ───
    print("\n=== Loading EPA Climate ===")
    epa_path = RAW_DIR / "epa_climate.json"
    if epa_path.exists():
        with open(epa_path) as f:
            pages = json.load(f)
        for page in pages:
            topics = extract_climate_topics(page['text'])
            doc = {
                "id": make_doc_id("epa", page["title"]),
                "source": "US EPA",
                "title": page["title"],
                "text": page["text"],
                "url": page.get("url", ""),
                "date": "2026-01-01",
                "type": "government",
                "topics": topics,
                "confidence": "very_high",
                "check_relevance": False,
            }
            builder.add_document(doc)
        print(f"  {builder.stats['sources'].get('US EPA', 0)} pages")
    else:
        print("  Not found, skipping")

    # ─── 6. ELU Research (all documents) ───
    print("\n=== Loading ELU Research ===")
    elu_docs = [
        ("RESEARCH.md", "Earth Love United Research"),
        ("DATA_SOURCES.md", "Earth Love United Data Sources"),
        ("CARBON_REGISTRIES.md", "Earth Love United Carbon Registries"),
        ("CLIMATE_DATASETS.md", "Earth Love United Climate Datasets"),
        ("PRODUCTION_GUIDE.md", "Earth Love United Production Guide"),
    ]

    for filename, source_name in elu_docs:
        filepath = Path("/Users/ekmelozdemir/earthloveunited.org") / filename
        if not filepath.exists():
            continue
        content = filepath.read_text()
        sections = re.split(r'\n## ', content)
        for section in sections:
            if not section.strip():
                continue
            lines = section.strip().split('\n')
            title = lines[0].strip().lstrip('#').strip()
            text = '\n'.join(lines[1:]).strip()
            if len(text.split()) < 50:
                continue
            topics = extract_climate_topics(text)
            doc = {
                "id": make_doc_id("elu", f"{filename}_{title}"),
                "source": source_name,
                "title": title,
                "text": text,
                "url": "https://earthloveunited.org",
                "date": "2026-05-15",
                "type": "research_synthesis",
                "topics": topics,
                "confidence": "very_high",
                "check_relevance": False,
            }
            builder.add_document(doc)
    print(f"  {builder.stats['sources'].get('Earth Love United Research', 0) + builder.stats['sources'].get('Earth Love United Data Sources', 0) + builder.stats['sources'].get('Earth Love United Carbon Registries', 0) + builder.stats['sources'].get('Earth Love United Climate Datasets', 0) + builder.stats['sources'].get('Earth Love United Production Guide', 0)} sections")

    return builder


def run_pipeline():
    """Run the full enhanced pipeline."""
    builder = load_all_sources()

    # Process
    print(f"\n=== Processing {len(builder.documents)} documents ===")
    processed = builder.process_all()

    # Save
    print(f"\n=== Saving ===")
    df = builder.save(processed, "earth_love_united_climate_knowledge_v2")

    # Summary
    print(f"\n{'='*60}")
    print(f"DATASET v2.0 COMPLETE")
    print(f"{'='*60}")
    print(f"Documents: {builder.stats['total_docs']}")
    print(f"Chunks: {builder.stats['total_chunks']}")
    print(f"\nSources:")
    for src, cnt in sorted(builder.stats['sources'].items(), key=lambda x: -x[1]):
        pct = cnt / builder.stats['total_docs'] * 100
        print(f"  {src}: {cnt} ({pct:.1f}%)")

    # Chunk stats
    word_counts = [len(c['text'].split()) for c in processed]
    print(f"\nChunk stats:")
    print(f"  Min words: {min(word_counts)}")
    print(f"  Max words: {max(word_counts)}")
    print(f"  Avg words: {sum(word_counts)//len(word_counts)}")
    print(f"  Chunks < 50 words: {sum(1 for w in word_counts if w < 50)}")
    print(f"  Chunks > 600 words: {sum(1 for w in word_counts if w > 600)}")

    # Check for duplicates
    ids = [c['id'] for c in processed]
    unique_ids = set(ids)
    print(f"  Duplicate IDs: {len(ids) - len(unique_ids)}")

    print(f"\nOutput: {PROCESSED_DIR / 'earth_love_united_climate_knowledge_v2.jsonl'}")

    return df


if __name__ == "__main__":
    run_pipeline()
