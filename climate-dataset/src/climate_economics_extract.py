#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import json, time
from pathlib import Path
import wikipediaapi

RAW_DIR = Path("climate-dataset/data/raw")
with open(RAW_DIR / "climate_economics_articles.json") as f:
    ARTICLES = json.load(f)

wiki = wikipediaapi.Wikipedia(user_agent="EarthLoveUnited/1.0", language="en")
articles = []
seen = set()
for i, title in enumerate(ARTICLES):
    if title.lower() in seen:
        continue
    seen.add(title.lower())
    try:
        page = wiki.page(title)
        if not page.exists():
            continue
        text = page.text
        if len(text.split()) < 100:
            continue
        articles.append({
            "title": page.title, "text": text, "summary": page.summary,
            "url": page.fullurl, "page_id": page.pageid,
            "categories": [c.title for c in page.categories.values()][:20],
        })
        if i % 10 == 0:
            print(f"  {i}/{len(ARTICLES)}: {len(articles)} extracted")
        time.sleep(0.3)
    except:
        continue

print(f"\nExtracted {len(articles)} articles")
with open(RAW_DIR / "climate_economics_wiki.json", "w") as f:
    json.dump(articles, f, indent=2)
print("Saved!")
