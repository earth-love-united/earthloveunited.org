"""
Wikipedia Climate Article Extractor v2.0
Expanded to 350+ articles with deduplication.
"""

import json
import time
import re
from pathlib import Path

import wikipediaapi
from tqdm import tqdm

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")

# Load expanded article list
with open("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/config/expanded_wiki_articles.json") as f:
    ARTICLES = json.load(f)

print(f"Extracting {len(ARTICLES)} Wikipedia articles...")

wiki = wikipediaapi.Wikipedia(
    user_agent='EarthLoveUnited/1.0 (climate education project)',
    language='en'
)

articles = []
seen_titles = set()
errors = 0

for title in tqdm(ARTICLES, desc="Wikipedia v2"):
    # Skip duplicates
    if title.lower() in seen_titles:
        continue
    seen_titles.add(title.lower())

    try:
        page = wiki.page(title)
        if not page.exists():
            # Try alternative title
            alt_title = title.replace(" and ", " & ").replace(" - ", " – ")
            page = wiki.page(alt_title)
            if not page.exists():
                errors += 1
                continue

        text = page.text
        if len(text.split()) < 100:
            continue

        categories = [cat.title for cat in page.categories.values()]

        articles.append({
            'title': page.title,
            'text': text,
            'summary': page.summary,
            'url': page.fullurl,
            'page_id': page.pageid,
            'categories': categories[:20],
        })

        time.sleep(0.3)

    except Exception as e:
        errors += 1
        continue

print(f"\nExtracted {len(articles)} articles ({errors} errors/skipped)")

# Save
output_path = RAW_DIR / "wikipedia_climate_v2.json"
with open(output_path, 'w') as f:
    json.dump(articles, f, indent=2)
print(f"Saved to {output_path}")

# Stats
total_words = sum(len(a['text'].split()) for a in articles)
print(f"Total words: {total_words:,}")
print(f"Average words/article: {total_words // len(articles):,}")
