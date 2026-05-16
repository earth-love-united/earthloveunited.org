"""
IPCC Report Text Extractor
Extracts structured text from IPCC AR6 PDF reports.
The gold standard of climate science knowledge.
"""

import re
import json
from pathlib import Path

import fitz  # PyMuPDF
from tqdm import tqdm

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")

# IPCC AR6 report PDFs (publicly available)
IPCC_REPORTS = {
    "ar6_wgi_spm": {
        "title": "AR6 WGI Summary for Policymakers",
        "url": "https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_SPM.pdf",
        "type": "ipcc_spm",
        "confidence": "very_high",
    },
    "ar6_wgii_spm": {
        "title": "AR6 WGII Summary for Policymakers",
        "url": "https://www.ipcc.ch/report/ar6/wg2/downloads/report/IPCC_AR6_WGII_SPM.pdf",
        "type": "ipcc_spm",
        "confidence": "very_high",
    },
    "ar6_wgiii_spm": {
        "title": "AR6 WGIII Summary for Policymakers",
        "url": "https://www.ipcc.ch/report/ar6/wg3/downloads/report/IPCC_AR6_WGIII_SPM.pdf",
        "type": "ipcc_spm",
        "confidence": "very_high",
    },
    "ar6_synthesis": {
        "title": "AR6 Synthesis Report",
        "url": "https://www.ipcc.ch/report/ar6/syr/downloads/report/IPCC_AR6_SYR_SPM.pdf",
        "type": "ipcc_synthesis",
        "confidence": "very_high",
    },
    "sr15": {
        "title": "SR15 Global Warming of 1.5°C",
        "url": "https://www.ipcc.ch/site/assets/uploads/sites/2/2022/06/SR15_SPM_version_report_LR.pdf",
        "type": "ipcc_special",
        "confidence": "very_high",
    },
    "srccL": {
        "title": "SRCCL Climate Change and Land",
        "url": "https://www.ipcc.ch/site/assets/uploads/2019/08/03b.-SPM_Approved_Microsite_FINAL.pdf",
        "type": "ipcc_special",
        "confidence": "very_high",
    },
    "srocc": {
        "title": "SROCC Ocean and Cryosphere",
        "url": "https://www.ipcc.ch/site/assets/uploads/sites/3/2019/12/SROCC_SPM_Approved.pdf",
        "type": "ipcc_special",
        "confidence": "very_high",
    },
}


def download_pdf(url: str, output_path: Path) -> bool:
    """Download a PDF file."""
    import requests
    try:
        response = requests.get(url, timeout=60, headers={'User-Agent': 'EarthLoveUnited/1.0'})
        response.raise_for_status()
        with open(output_path, 'wb') as f:
            f.write(response.content)
        return True
    except Exception as e:
        print(f"  Download failed: {e}")
        return False


def extract_pdf_text(pdf_path: Path) -> list:
    """Extract text from PDF, organized by page/section."""
    doc = fitz.open(pdf_path)
    pages = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()

        # Skip mostly-empty pages
        if len(text.strip()) < 50:
            continue

        pages.append({
            'page_num': page_num + 1,
            'text': text.strip(),
        })

    doc.close()
    return pages


def extract_ipcc_reports() -> list:
    """Download and extract all IPCC reports."""
    all_sections = []

    for report_id, report_info in tqdm(IPCC_REPORTS.items(), desc="IPCC reports"):
        print(f"\nProcessing: {report_info['title']}")

        pdf_path = RAW_DIR / f"{report_id}.pdf"

        # Download if not already present
        if not pdf_path.exists():
            print(f"  Downloading...")
            if not download_pdf(report_info['url'], pdf_path):
                continue
        else:
            print(f"  Already downloaded")

        # Extract text
        pages = extract_pdf_text(pdf_path)
        print(f"  Extracted {len(pages)} pages")

        # Create sections (group pages into logical sections)
        full_text = '\n\n'.join(p['text'] for p in pages)

        all_sections.append({
            'id': report_id,
            'source': 'IPCC',
            'title': report_info['title'],
            'text': full_text,
            'url': report_info['url'],
            'type': report_info['type'],
            'confidence': report_info['confidence'],
            'date': '2021-08-09',  # AR6 publication date
            'topics': ['climate science', 'ipcc', 'assessment'],
            'page_count': len(pages),
        })

    return all_sections


def save_ipcc(sections: list):
    """Save IPCC sections."""
    output_path = RAW_DIR / "ipcc_reports.json"
    with open(output_path, 'w') as f:
        json.dump(sections, f, indent=2)
    print(f"\nSaved {len(sections)} IPCC report sections to {output_path}")
    return output_path


if __name__ == "__main__":
    sections = extract_ipcc_reports()
    save_ipcc(sections)
