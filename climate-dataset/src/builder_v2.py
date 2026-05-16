"""
Enhanced Dataset Builder v2.0
Fixes: dedup, better chunking, clean topics, IPCC reference cleaning.
"""

import re, json, hashlib
from pathlib import Path
from datetime import datetime

CLIMATE_TOPICS = [
    "carbon cycle", "carbon dioxide", "carbon budget", "carbon offset",
    "carbon credit", "carbon capture", "carbon sequestration",
    "climate change", "global warming", "greenhouse effect", "greenhouse gas",
    "temperature", "sea level rise", "ocean acidification",
    "climate sensitivity", "tipping points", "climate feedback",
    "methane", "nitrous oxide", "fluorinated gases",
    "renewable energy", "solar energy", "wind power", "hydropower",
    "nuclear energy", "energy transition", "energy efficiency",
    "fossil fuel", "coal", "oil", "natural gas",
    "deforestation", "reforestation", "afforestation", "forest",
    "biodiversity", "ecosystem", "species extinction",
    "climate mitigation", "climate adaptation", "climate resilience",
    "paris agreement", "unfccc", "ipcc", "climate policy",
    "carbon tax", "carbon pricing", "emissions trading",
    "climate justice", "climate finance", "loss and damage",
    "extreme weather", "heat wave", "drought", "flood", "wildfire",
    "agriculture", "food security", "water resources",
    "climate modeling", "climate projection", "climate scenario",
    "net zero", "carbon neutrality", "decarbonization",
    "climate communication", "climate education", "climate denial",
    "permafrost", "ice sheet", "glacier", "arctic", "antarctic",
    "ocean current", "thermohaline circulation", "el nino",
    "air quality", "pollution", "public health",
    "sustainable development", "climate and development",
]

WIKI_MAINTENANCE_CATS = re.compile(
    r'^Category:(All articles|CS1|Articles with|Short description|'
    r'Commons category|Wikipedia articles|Pages using|Use |'
    r'All stubs|All disambiguation)', re.IGNORECASE
)

def is_climate_relevant(text, min_keywords=2):
    text_lower = text.lower()
    return sum(1 for kw in CLIMATE_TOPICS if kw in text_lower) >= min_keywords

def extract_climate_topics(text):
    text_lower = text.lower()
    return [t for t in CLIMATE_TOPICS if t in text_lower][:10]

def clean_text(text):
    text = re.sub(r'\{\d+\.\d+\.\d+\}', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)
    return text.strip()

def chunk_text(text, max_words=400, overlap=50):
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
    h = hashlib.md5(f"{source}:{title}".encode()).hexdigest()[:8]
    safe = re.sub(r'[^a-z0-9]+', '_', title.lower())[:40]
    return f"{source}_{safe}_{h}"

def clean_wikipedia_categories(categories):
    clean = []
    for cat in categories:
        if not WIKI_MAINTENANCE_CATS.match(cat):
            name = cat.replace('Category:', '').strip()
            if len(name) > 3 and not name.startswith('All '):
                clean.append(name)
    return clean[:10]

class DatasetBuilderV2:
    def __init__(self):
        self.documents = []
        self.seen_ids = set()
        self.stats = {"total_docs": 0, "total_chunks": 0, "sources": {},
                      "start_time": datetime.now().isoformat()}

    def add_document(self, doc):
        if doc["id"] in self.seen_ids:
            return False
        self.seen_ids.add(doc["id"])
        self.documents.append(doc)
        src = doc.get("source", "unknown")
        self.stats["sources"][src] = self.stats["sources"].get(src, 0) + 1
        self.stats["total_docs"] += 1
        return True

    def process_all(self):
        processed = []
        for doc in self.documents:
            clean = clean_text(doc["text"])
            if len(clean.split()) < 50:
                continue
            if doc.get("check_relevance") and not is_climate_relevant(clean):
                continue
            chunks = chunk_text(clean)
            topics = doc.get("topics", [])
            if not topics:
                topics = extract_climate_topics(clean)
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
        self.stats["total_chunks"] = len(processed)
        return processed

    def save(self, documents, name="climate_knowledge_v2"):
        import pandas as pd
        jsonl_path = PROCESSED_DIR / f"{name}.jsonl"
        with open(jsonl_path, 'w') as f:
            for doc in documents:
                f.write(json.dumps(doc) + '\n')
        df = pd.DataFrame(documents)
        parquet_path = PROCESSED_DIR / f"{name}.parquet"
        df.to_parquet(parquet_path, index=False)
        self.stats["end_time"] = datetime.now().isoformat()
        self.stats["total_processed_chunks"] = len(documents)
        with open(PROCESSED_DIR / f"{name}_stats.json", 'w') as f:
            json.dump(self.stats, f, indent=2)
        return df

PROCESSED_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/processed")
print("Builder v2 ready.")
