#!/usr/bin/env python3
"""
Build Gaia Knowledge Index v2 — Compact
- Truncates text to 200 chars per chunk (enough for search context)
- Uses integer codes for sources
- Compresses the JSON with gzip
"""

import json
import re
import gzip
from pathlib import Path
from collections import Counter

DATASET_PATH = Path(__file__).parent.parent / "climate-dataset" / "data" / "processed" / "earth_love_united_climate_knowledge_v3.jsonl"
OUTPUT_PATH = Path(__file__).parent / "knowledge-index.json.gz"

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
    'new','first','last','long','great','little','right','old','big','high',
    'small','large','next','early','young','important','public','bad','good',
    'able','different','possible','free','still','best','better','sure','true',
    'real','full','special','easy','clear','recent','certain','personal','open',
    'red','blue','green','white','black','hot','cold','hard','soft','fast',
    'slow','close','deep','wide','thin','thick','heavy','light','dark','bright',
    'strong','weak','clean','dry','wet','cool','warm','fresh','raw','safe',
    'rich','poor','simple','complex','modern','ancient','vast','tiny','huge',
])

# Source codes
SOURCE_CODES = {
    'Wikipedia': 'W',
    'arXiv': 'A',
    'IPCC': 'I',
    'Project Drawdown': 'D',
    'US EPA': 'E',
    'Earth Love United': 'U',
}

def tokenize(text):
    return [w for w in re.split(r'[^a-z0-9-]+', text.lower()) if len(w) > 2 and w not in STOP_WORDS]

def build_index():
    chunks = []
    with open(DATASET_PATH) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                chunks.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    
    print(f"Loaded {len(chunks)} chunks")
    
    # Build inverted index
    index = {}
    compact_chunks = []
    
    for i, chunk in enumerate(chunks):
        # Compact chunk
        text = chunk.get('text', '')[:200]  # Truncate for search context
        title = chunk.get('title', '')[:150]
        source = SOURCE_CODES.get(chunk.get('source', ''), 'X')
        topics = chunk.get('topics', [])[:3]
        
        compact_chunks.append([
            title,      # 0: title
            text,       # 1: text (truncated)
            source,     # 2: source code
            topics,     # 3: topics
        ])
        
        # Index tokens
        all_text = f"{title} {text} {' '.join(topics)}"
        tokens = set(tokenize(all_text))
        for token in tokens:
            if token not in index:
                index[token] = []
            index[token].append(i)
    
    # Filter: only keep terms in 1-100 chunks
    filtered = {t: idxs for t, idxs in index.items() if 1 <= len(idxs) <= 100}
    
    output = {
        'v': 2,
        'n': len(compact_chunks),
        'src': {'W': 'Wikipedia', 'A': 'arXiv', 'I': 'IPCC', 'D': 'Drawdown', 'E': 'EPA', 'U': 'ELU'},
        'c': compact_chunks,
        'i': filtered,
    }
    
    # Write compressed
    with gzip.open(OUTPUT_PATH, 'wt', compresslevel=9) as f:
        json.dump(output, f, separators=(',', ':'))
    
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"Index: {len(filtered)} terms, {len(compact_chunks)} chunks")
    print(f"Output: {OUTPUT_PATH} ({size_kb:.0f} KB compressed)")
    
    sources = Counter(c[2] for c in compact_chunks)
    print(f"\nSources:")
    for src, cnt in sources.most_common():
        name = output['src'].get(src, src)
        print(f"  {name}: {cnt}")

if __name__ == "__main__":
    build_index()
