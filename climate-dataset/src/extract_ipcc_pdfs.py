#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""Extract IPCC PDFs and update ipcc_reports.json"""
import fitz, json
from pathlib import Path

RAW_DIR = Path("climate-dataset/data/raw")

ipcc_files = [
    ("ar6_wgii_spm", "AR6 WGII Summary for Policymakers",
     "https://www.ipcc.ch/report/ar6/wg2/downloads/report/IPCC_AR6_WGII_SummaryForPolicymakers.pdf",
     "ipcc_spm", "2022-02-28"),
    ("sr15", "SR15 Global Warming of 1.5C",
     "https://www.ipcc.ch/site/assets/uploads/sites/2/2018/07/SR15_SPM_version_stand_alone_LR.pdf",
     "ipcc_special", "2018-10-08"),
]

with open(RAW_DIR / "ipcc_reports.json") as f:
    existing = json.load(f)

existing_ids = {e["id"] for e in existing}

for name, title, url, dtype, date in ipcc_files:
    if name in existing_ids:
        print(f"{name}: already exists, skipping")
        continue

    pdf_path = RAW_DIR / f"{name}.pdf"
    if not pdf_path.exists():
        print(f"{name}: PDF not found, skipping")
        continue

    doc = fitz.open(pdf_path)
    text = "\n\n".join(p.get_text().strip() for p in doc if len(p.get_text().strip()) > 50)
    doc.close()

    existing.append({
        "id": name, "source": "IPCC", "title": title, "text": text,
        "url": url, "type": dtype, "confidence": "very_high",
        "date": date, "topics": ["ipcc", "climate science"],
        "page_count": len(doc)
    })
    print(f"{name}: {len(text.split())} words from {len(doc)} pages")

with open(RAW_DIR / "ipcc_reports.json", "w") as f:
    json.dump(existing, f, indent=2)
print(f"Total IPCC reports: {len(existing)}")
