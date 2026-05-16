"""
Earth Love United — Climate Knowledge Dataset Curation Pipeline
Curates the best open climate science dataset ever made for Hugging Face.

Sources:
  1. IPCC AR6 reports (PDF → text)
  2. Wikipedia climate articles (API → structured text)
  3. arXiv climate papers (API → abstracts)
  4. Our RESEARCH.md (structured knowledge)
  5. Project Drawdown solutions (web scrape)
  6. Carbon Brief articles (web scrape)

Output: Clean, chunked, embedded dataset ready for RAG/AI.
"""

import os
import re
import json
import time
import hashlib
from pathlib import Path
from datetime import datetime

import requests
import pandas as pd
from tqdm import tqdm
import fitz  # PyMuPDF

# ─── Configuration ───

BASE_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset")
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
EMBEDDINGS_DIR = BASE_DIR / "data" / "embeddings"
CONFIG_DIR = BASE_DIR / "config"

for d in [RAW_DIR, PROCESSED_DIR, EMBEDDINGS_DIR, CONFIG_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Climate keywords for filtering
CLIMATE_KEYWORDS = [
    "climate change", "global warming", "greenhouse gas", "carbon dioxide",
    "carbon cycle", "carbon budget", "emissions", "temperature anomaly",
    "sea level rise", "ocean acidification", "deforestation", "renewable energy",
    "carbon capture", "carbon offset", "carbon credit", "methane", "nitrous oxide",
    "climate sensitivity", "tipping point", "permafrost", "ice sheet",
    "climate mitigation", "climate adaptation", "paris agreement", "ipcc",
    "fossil fuel", "decarbonization", "net zero", "carbon neutral",
    "climate model", "climate projection", "climate scenario",
    "extreme weather", "heat wave", "drought", "flood", "wildfire",
    "biodiversity", "ecosystem", "restoration", "reforestation",
    "solar energy", "wind energy", "battery", "electric vehicle",
    "climate justice", "climate policy", "carbon tax", "carbon pricing",
]

def is_climate_relevant(text: str, min_keywords: int = 2) -> bool:
    """Check if text is climate-relevant based on keyword matching."""
    text_lower = text.lower()
    matches = sum(1 for kw in CLIMATE_KEYWORDS if kw in text_lower)
    return matches >= min_keywords


def clean_text(text: str) -> str:
    """Clean extracted text."""
    # Remove excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    # Remove URLs
    text = re.sub(r'https?://\S+', '', text)
    # Remove email addresses
    text = re.sub(r'\S+@\S+', '', text)
    # Remove page numbers
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)
    return text.strip()


def chunk_text(text: str, max_tokens: int = 512, overlap: int = 50) -> list:
    """Split text into overlapping chunks."""
    # Simple sentence-based chunking
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = []
    current_len = 0

    for sent in sentences:
        sent_len = len(sent.split())
        if current_len + sent_len > max_tokens and current_chunk:
            chunks.append(' '.join(current_chunk))
            # Keep overlap
            overlap_sents = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
            current_chunk = overlap_sents + [sent]
            current_len = sum(len(s.split()) for s in current_chunk)
        else:
            current_chunk.append(sent)
            current_len += sent_len

    if current_chunk:
        chunks.append(' '.join(current_chunk))

    return chunks


def make_doc_id(source: str, title: str) -> str:
    """Generate a unique document ID."""
    hash_input = f"{source}:{title}"
    hash_val = hashlib.md5(hash_input.encode()).hexdigest()[:8]
    safe_title = re.sub(r'[^a-z0-9]+', '_', title.lower())[:40]
    return f"{source}_{safe_title}_{hash_val}"


class DatasetBuilder:
    """Main dataset builder class."""

    def __init__(self):
        self.documents = []
        self.stats = {
            "total_docs": 0,
            "total_chunks": 0,
            "sources": {},
            "start_time": datetime.now().isoformat(),
        }

    def add_document(self, doc: dict):
        """Add a document to the dataset."""
        self.documents.append(doc)
        source = doc.get("source", "unknown")
        self.stats["sources"][source] = self.stats["sources"].get(source, 0) + 1
        self.stats["total_docs"] += 1

    def process_all(self):
        """Process all documents: clean, chunk, prepare for embedding."""
        processed = []

        for doc in tqdm(self.documents, desc="Processing documents"):
            # Clean text
            clean = clean_text(doc["text"])

            # Skip if too short
            if len(clean.split()) < 50:
                continue

            # Skip if not climate-relevant (for web-scraped content)
            if doc.get("check_relevance") and not is_climate_relevant(clean):
                continue

            # Chunk
            chunks = chunk_text(clean)

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
                    "topics": doc.get("topics", []),
                    "confidence": doc.get("confidence", "high"),
                })

        self.stats["total_chunks"] = len(processed)
        return processed

    def save(self, documents: list, name: str = "climate_knowledge"):
        """Save dataset in multiple formats."""
        # JSONL
        jsonl_path = PROCESSED_DIR / f"{name}.jsonl"
        with open(jsonl_path, 'w') as f:
            for doc in documents:
                f.write(json.dumps(doc) + '\n')
        print(f"Saved {len(documents)} chunks to {jsonl_path}")

        # Parquet
        df = pd.DataFrame(documents)
        parquet_path = PROCESSED_DIR / f"{name}.parquet"
        df.to_parquet(parquet_path, index=False)
        print(f"Saved to {parquet_path}")

        # Stats
        stats_path = PROCESSED_DIR / f"{name}_stats.json"
        self.stats["end_time"] = datetime.now().isoformat()
        self.stats["total_processed_chunks"] = len(documents)
        with open(stats_path, 'w') as f:
            json.dump(self.stats, f, indent=2)
        print(f"Stats: {self.stats}")

        return df


print("Dataset builder ready.")
