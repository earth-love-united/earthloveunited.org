#!/usr/bin/env python3
"""
Build Climate Knowledge Dataset v3 — Enhanced
Combines all sources:
- Wikipedia v3 (283 articles, 1.45M words) — comprehensive climate coverage
- Climate Economics Wikipedia (~40 articles) — policy, finance, justice
- arXiv v2 (4,092 papers) — research depth
- IPCC AR6 (5 reports) — gold standard
- Project Drawdown v2 (33 solutions) — solutions catalog
- ELU Research (83 sections) — original synthesis
- US EPA (8 pages) — government explainers
"""

import json
import re
from pathlib import Path
from collections import Counter

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")
PROCESSED_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/processed")

# ─── Configuration ───
MAX_CHUNK_WORDS = 400
MIN_CHUNK_WORDS = 50
OVERLAP_WORDS = 50

STOP_WORDS = set([
    'the','and','for','are','but','not','you','all','can','had','her','was',
    'one','our','out','has','have','what','when','where','which','this','that',
    'with','from','they','will','each','make','like','time','come','how','its',
    'than','them','then','there','these','been','being','does','doing','more',
    'most','some','such','into','over','also','just','about','would','could',
    'should','shall','might','must','need','were','is','am','be','had',
    'do','did','may','ought','used','to','of','in','on','at','by','as','an',
    'it','he','she','his','him','they','their','we','us','my','your','me',
    'who','whom','whose','why','here','up','down','off','out','a','i','or',
    'if','so','no','nor','own','same','too','very','back','get','got','go',
    'goes','gone','take','took','give','gave','say','said','know','known',
    'think','thought','see','seen','look','looked','want','find','found',
    'tell','ask','work','call','try','feel','become','becomes','leave','left',
    'put','mean','keep','let','begin','seem','help','show','hear','play','run',
    'move','live','believe','bring','happen','write','provide','sit','stand',
    'lose','pay','meet','include','continue','set','learn','change','lead',
    'understand','watch','follow','stop','create','speak','read','allow','add',
    'spend','grow','open','walk','win','offer','remember','love','consider',
    'appear','buy','wait','serve','die','send','expect','build','stay','fall',
    'cut','reach','kill','remain','suggest','raise','pass','sell','require',
    'report','decide','pull','develop','an','there','here','then','than',
])

CLIMATE_TOPICS = [
    "carbon cycle", "carbon dioxide", "carbon budget", "carbon offset",
    "carbon credit", "carbon capture", "carbon sequestration", "carbon tax",
    "carbon pricing", "emissions trading", "climate change", "global warming",
    "greenhouse effect", "greenhouse gas", "temperature", "sea level rise",
    "ocean acidification", "climate sensitivity", "tipping points",
    "climate feedback", "methane", "nitrous oxide", "renewable energy",
    "solar energy", "wind power", "nuclear energy", "energy transition",
    "energy efficiency", "fossil fuel", "coal", "oil", "natural gas",
    "deforestation", "reforestation", "afforestation", "forest",
    "biodiversity", "ecosystem", "species extinction", "climate mitigation",
    "climate adaptation", "climate resilience", "paris agreement", "unfccc",
    "ipcc", "climate policy", "climate finance", "climate justice",
    "loss and damage", "net zero", "carbon neutrality", "decarbonization",
    "extreme weather", "heat wave", "drought", "flood", "wildfire",
    "agriculture", "food security", "water resources", "climate modeling",
    "climate projection", "climate scenario", "climate justice",
    "climate migration", "climate refugee", "just transition",
    "electric vehicle", "public transit", "green building", "heat pump",
    "carbon footprint", "climate risk", "green bond", "green finance",
    "sustainable development", "cop26", "cop27", "cop28", "cop29", "cop30",
    "nationally determined contribution", "drawdown", "restoration",
    "permafrost", "ice sheet", "glacier", "arctic", "antarctic",
    "coral reef", "mangrove", "wetland", "peatland", "soil carbon",
    "ocean current", "thermohaline circulation", "el nino",
    "air quality", "pollution", "public health", "climate communication",
    "climate education", "climate denial", "climate activism",
    "climate litigation", "climate movement", "indigenous peoples",
    "climate and development", "climate and poverty", "climate and gender",
    "climate and health", "climate and agriculture", "climate and water",
    "climate and cities", "climate and migration", "climate and conflict",
    "climate and security", "climate and tourism", "climate and insurance",
    "climate and law", "climate and religion", "climate psychology",
    "climate anxiety", "climate grief",
]

def tokenize(text):
    return [w for w in re.split(r'[^a-z0-9-]+', text.lower()) if len(w) > 2 and w not in STOP_WORDS]

def extract_topics(text):
    text_lower = text.lower()
    return [t for t in CLIMATE_TOPICS if t in text_lower][:10]

def clean_text(text):
    text = re.sub(r'\{\d+\.\d+\.\d+\}', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)
    return text.strip()

def chunk_text(text, max_words=MAX_CHUNK_WORDS, overlap=OVERLAP_WORDS):
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current_chunk = []
    current_len = 0
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        para_len = len(para.split())
        if para_len > max_words:
            sentences = re.split(r'(?<=[.!?])\s+', para)
            for sent in sentences:
                sent_len = len(sent.split())
                if current_len + sent_len > max_words and current_chunk:
                    chunks.append(' '.join(current_chunk))
                    ow = ' '.join(current_chunk).split()[-overlap:]
                    current_chunk = [' '.join(ow), sent] if ow else [sent]
                    current_len = sum(len(s.split()) for s in current_chunk)
                else:
                    current_chunk.append(sent)
                    current_len += sent_len
        else:
            if current_len + para_len > max_words and current_chunk:
                chunks.append(' '.join(current_chunk))
                ow = ' '.join(current_chunk).split()[-overlap:]
                current_chunk = [' '.join(ow), para] if ow else [para]
                current_len = sum(len(s.split()) for s in current_chunk)
            else:
                current_chunk.append(para)
                current_len += para_len
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    return chunks

def make_doc_id(source, title):
    import hashlib
    h = hashlib.md5(f"{source}:{title}".encode()).hexdigest()[:8]
    safe = re.sub(r'[^a-z0-9]+', '_', title.lower())[:40]
    return f"{source}_{safe}_{h}"

def clean_wiki_categories(cats):
    pattern = re.compile(r'^Category:(All articles|CS1|Articles with|Short description|Commons category|Wikipedia articles|Pages using|Use |All stubs|All disambiguation)', re.IGNORECASE)
    clean = []
    for cat in cats:
        if not pattern.match(cat):
            name = cat.replace('Category:', '').strip()
            if len(name) > 3 and not name.startswith('All '):
                clean.append(name)
    return clean[:10]

# ─── Load all sources ───
print("=== Loading Sources ===")
all_docs = []

# 1. Wikipedia v3
wiki_path = RAW_DIR / "wikipedia_climate_v3.json"
if wiki_path.exists():
    with open(wiki_path) as f:
        wiki_articles = json.load(f)
    seen_titles = set()
    for article in wiki_articles:
        tl = article["title"].lower()
        if tl in seen_titles:
            continue
        seen_titles.add(tl)
        topics = extract_topics(article["text"])
        cc = clean_wiki_categories(article.get("categories", []))
        topics = list(set(topics + cc))[:10]
        all_docs.append({
            "id": make_doc_id("wikipedia", article["title"]),
            "source": "Wikipedia", "title": article["title"],
            "text": article["text"], "url": article.get("url", ""),
            "date": article.get("last_modified", ""), "type": "encyclopedia",
            "topics": topics, "confidence": "high", "check_relevance": False,
        })
    print(f"  Wikipedia v3: {len(seen_titles)} articles")

# 2. Climate Economics
econ_path = RAW_DIR / "climate_economics_wiki.json"
if econ_path.exists():
    with open(econ_path) as f:
        econ_articles = json.load(f)
    seen_econ = set()
    for article in econ_articles:
        tl = article["title"].lower()
        if tl in seen_titles or tl in seen_econ:
            continue
        seen_econ.add(tl)
        topics = extract_topics(article["text"])
        all_docs.append({
            "id": make_doc_id("wikipedia", article["title"]),
            "source": "Wikipedia", "title": article["title"],
            "text": article["text"], "url": article.get("url", ""),
            "date": "", "type": "encyclopedia",
            "topics": topics, "confidence": "high", "check_relevance": False,
        })
    print(f"  Climate Economics: {len(seen_econ)} articles")

# 3. arXiv v2
arxiv_path = RAW_DIR / "arxiv_climate_v2.json"
if arxiv_path.exists():
    with open(arxiv_path) as f:
        papers = json.load(f)
    for paper in papers:
        text = f"{paper['title']}. {paper['abstract']}"
        topics = extract_topics(text)
        all_docs.append({
            "id": make_doc_id("arxiv", paper["arxiv_id"]),
            "source": "arXiv", "title": paper["title"], "text": text,
            "url": f"https://arxiv.org/abs/{paper['arxiv_id']}",
            "date": paper.get("published", ""), "type": "research_paper",
            "topics": topics, "confidence": "high", "check_relevance": False,
        })
    print(f"  arXiv: {len(papers)} papers")

# 4. IPCC
with open(RAW_DIR / "ipcc_reports.json") as f:
    reports = json.load(f)
for report in reports:
    topics = extract_topics(report["text"])
    all_docs.append({
        "id": make_doc_id("ipcc", report["id"]),
        "source": "IPCC", "title": report["title"], "text": report["text"],
        "url": report.get("url", ""), "date": report.get("date", ""),
        "type": report.get("type", "ipcc_report"),
        "topics": topics, "confidence": "very_high", "check_relevance": False,
    })
print(f"  IPCC: {len(reports)} reports")

# 5. Drawdown v2
dd_path = RAW_DIR / "drawdown_solutions_v2.json"
dd_count = 0
if dd_path.exists():
    with open(dd_path) as f:
        solutions = json.load(f)
    for sol in solutions:
        topics = extract_topics(sol["text"])
        all_docs.append({
            "id": make_doc_id("drawdown", sol.get("solution_name", sol["title"])),
            "source": "Project Drawdown", "title": sol["title"], "text": sol["text"],
            "url": sol.get("url", ""), "date": "2026-01-01", "type": "solution",
            "topics": topics, "confidence": "very_high", "check_relevance": False,
        })
        dd_count += 1
print(f"  Drawdown: {dd_count} solutions")

# 6. EPA
epa_path = RAW_DIR / "epa_climate.json"
epa_count = 0
if epa_path.exists():
    with open(epa_path) as f:
        pages = json.load(f)
    for page in pages:
        topics = extract_topics(page["text"])
        all_docs.append({
            "id": make_doc_id("epa", page["title"]),
            "source": "US EPA", "title": page["title"], "text": page["text"],
            "url": page.get("url", ""), "date": "2026-01-01", "type": "government",
            "topics": topics, "confidence": "very_high", "check_relevance": False,
        })
        epa_count += 1
print(f"  EPA: {epa_count} pages")

# 7. ELU Research
elu_count = 0
for filename in ["RESEARCH.md", "DATA_SOURCES.md", "CARBON_REGISTRIES.md", "CLIMATE_DATASETS.md"]:
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
        topics = extract_topics(text)
        all_docs.append({
            "id": make_doc_id("elu", f"{filename}_{title}"),
            "source": "Earth Love United", "title": title, "text": text,
            "url": "https://earthloveunited.org", "date": "2026-05-15",
            "type": "research_synthesis",
            "topics": topics, "confidence": "very_high", "check_relevance": False,
        })
        elu_count += 1
print(f"  ELU Research: {elu_count} sections")

# ─── Process all documents ───
print(f"\n=== Processing {len(all_docs)} documents ===")
processed = []
for doc in all_docs:
    clean = clean_text(doc["text"])
    if len(clean.split()) < 50:
        continue
    chunks = chunk_text(clean)
    topics = doc.get("topics", [])
    if not topics:
        topics = extract_topics(clean)
    for i, chunk in enumerate(chunks):
        if len(chunk.split()) < 30:
            continue
        processed.append({
            "id": f"{doc['id']}_chunk_{i}",
            "doc_id": doc["id"],
            "source": doc["source"],
            "title": doc.get("title", ""),
            "text": chunk,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "url": doc.get("url", ""),
            "date": doc.get("date", ""),
            "type": doc.get("type", ""),
            "topics": topics,
            "confidence": doc.get("confidence", "high"),
            "word_count": len(chunk.split()),
        })

# ─── Save ───
print(f"\n=== Saving ===")
jsonl_path = PROCESSED_DIR / "earth_love_united_climate_knowledge_v3.jsonl"
with open(jsonl_path, "w") as f:
    for doc in processed:
        f.write(json.dumps(doc) + "\n")

size_mb = jsonl_path.stat().st_size / (1024*1024)
print(f"Saved {len(processed)} chunks ({size_mb:.1f} MB)")

# ─── Summary ───
print(f"\n{'='*60}")
print(f"DATASET v3.0 — Earth Love United Climate Knowledge")
print(f"{'='*60}")
print(f"Documents: {len(all_docs)}")
print(f"Chunks: {len(processed)}")

src_counts = Counter(d["source"] for d in processed)
print(f"\nSources:")
for src, cnt in src_counts.most_common():
    pct = cnt / len(processed) * 100
    print(f"  {src}: {cnt} chunks ({pct:.1f}%)")

wc = [len(c["text"].split()) for c in processed]
print(f"\nChunk words — min:{min(wc)}, max:{max(wc)}, avg:{sum(wc)//len(wc)}")
print(f"Chunks >600w: {sum(1 for w in wc if w > 600)}")
ids_list = [c["id"] for c in processed]
print(f"Duplicate IDs: {len(ids_list) - len(set(ids_list))}")
print(f"Total words: {sum(wc):,}")
print(f"\nOutput: {jsonl_path}")
