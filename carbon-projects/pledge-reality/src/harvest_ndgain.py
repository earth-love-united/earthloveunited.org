#!/usr/bin/env python3
"""
Download ND-GAIN Country Index data.

ND-GAIN (Notre Dame Global Adaptation Initiative) provides:
  - Vulnerability scores (exposure, sensitivity, adaptive capacity)
  - Readiness scores (economic, governance, social)
  - Overall ND-GAIN index

180+ countries, 1995-present. Free CC-BY download.
This gives us a universal climate accountability metric for ALL countries,
not just the 40 CAT tracks.

Source: https://gain.nd.edu/our-work/country-index/download-data/
"""
import requests
import zipfile
import io
import os
import pandas as pd

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
RAW_DIR = os.path.join(PLEDGE_DIR, 'data', 'raw')
PROC_DIR = os.path.join(PLEDGE_DIR, 'data', 'processed')

# ND-GAIN download URL
NDGAIN_URL = "https://gain.nd.edu/assets/437559/nd_gain_countryindex_data.zip"

# Alternative: direct CSV URLs from their data portal
NDGAIN_GAIN_URL = "https://gain.nd.edu/assets/437559/gain.csv"
NDGAIN_VULN_URL = "https://gain.nd.edu/assets/437559/vulnerability.csv"
NDGAIN_READY_URL = "https://gain.nd.edu/assets/437559/readiness.csv"


def download_csv(url, name):
    """Download a single CSV file."""
    print(f"  Downloading {name}...", end=' ', flush=True)
    try:
        resp = requests.get(url, timeout=60, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        })
        if resp.status_code == 200:
            path = os.path.join(RAW_DIR, f'ndgain_{name}.csv')
            with open(path, 'wb') as f:
                f.write(resp.content)
            print(f"OK ({len(resp.content)} bytes)")
            return path
        else:
            print(f"HTTP {resp.status_code}")
            return None
    except Exception as e:
        print(f"Error: {e}")
        return None


def download_zip():
    """Download the ZIP bundle."""
    print("Downloading ND-GAIN data bundle...")
    try:
        resp = requests.get(NDGAIN_URL, timeout=120, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        })
        if resp.status_code != 200:
            print(f"  HTTP {resp.status_code} — trying individual CSVs")
            return False

        # Extract ZIP
        z = zipfile.ZipFile(io.BytesIO(resp.content))
        for name in z.namelist():
            if name.endswith('.csv'):
                out_path = os.path.join(RAW_DIR, f'ndgain_{os.path.basename(name)}')
                with open(out_path, 'wb') as f:
                    f.write(z.read(name))
                print(f"  Extracted: {os.path.basename(name)}")

        return True
    except Exception as e:
        print(f"  ZIP download failed: {e}")
        return False


def process():
    """Process ND-GAIN data into our format."""
    # Try to find the gain CSV
    gain_path = os.path.join(RAW_DIR, 'ndgain_gain.csv')
    vuln_path = os.path.join(RAW_DIR, 'ndgain_vulnerability.csv')
    ready_path = os.path.join(RAW_DIR, 'ndgain_readiness.csv')

    # Check which files exist
    available = []
    for p, name in [(gain_path, 'gain'), (vuln_path, 'vulnerability'), (ready_path, 'readiness')]:
        if os.path.exists(p):
            available.append((p, name))

    if not available:
        # Try alternate file names from ZIP extraction
        for f in os.listdir(RAW_DIR):
            if f.startswith('ndgain_') and f.endswith('.csv'):
                available.append((os.path.join(RAW_DIR, f), f.replace('ndgain_', '').replace('.csv', '')))

    if not available:
        print("No ND-GAIN data files found")
        return None

    print(f"\nProcessing {len(available)} ND-GAIN files...")

    dfs = {}
    for path, name in available:
        try:
            df = pd.read_csv(path)
            dfs[name] = df
            print(f"  {name}: {len(df)} rows x {len(df.columns)} cols")
        except Exception as e:
            print(f"  Error reading {name}: {e}")

    if not dfs:
        return None

    # The ND-GAIN CSVs are typically wide format:
    # ISO3, Name, 1995, 1996, ..., 2022
    # We need to melt to long format and filter to 2015-2024

    all_rows = []

    for name, df in dfs.items():
        # Find year columns
        year_cols = [c for c in df.columns if c.isdigit() and 2015 <= int(c) <= 2024]
        id_cols = [c for c in df.columns if not c.isdigit()]

        if not year_cols:
            # Try finding year columns differently
            year_cols = [c for c in df.columns if c.strip().isdigit()]
            year_cols = [c for c in year_cols if 2015 <= int(c.strip()) <= 2024]

        if not year_cols or not id_cols:
            print(f"  Skipping {name}: can't identify year columns")
            continue

        # Melt
        iso_col = None
        for candidate in ['ISO3', 'iso3', 'ISO', 'Country Code', 'code']:
            if candidate in df.columns:
                iso_col = candidate
                break
        if not iso_col:
            iso_col = id_cols[0]

        name_col = None
        for candidate in ['Name', 'name', 'Country', 'country']:
            if candidate in df.columns:
                name_col = candidate
                break

        for _, row in df.iterrows():
            iso = row.get(iso_col, '')
            country = row.get(name_col, '') if name_col else ''

            for yc in year_cols:
                val = row.get(yc)
                if pd.notna(val):
                    all_rows.append({
                        'iso_code': str(iso).strip(),
                        'country_ndgain': str(country).strip(),
                        'year': int(yc.strip()),
                        f'ndgain_{name}': float(val),
                    })

    if not all_rows:
        print("No data extracted")
        return None

    result = pd.DataFrame(all_rows)

    # Merge rows with same iso_code + year
    if len(dfs) > 1:
        # Pivot and merge
        merged = None
        for name in dfs:
            col = f'ndgain_{name}'
            if col in result.columns:
                sub = result[result[col].notna()][['iso_code', 'country_ndgain', 'year', col]]
                sub = sub.drop_duplicates(subset=['iso_code', 'year'], keep='last')
                if merged is None:
                    merged = sub
                else:
                    merged = merged.merge(sub[['iso_code', 'year', col]],
                                         on=['iso_code', 'year'], how='outer')
        if merged is not None:
            result = merged

    result = result.sort_values(['iso_code', 'year']).reset_index(drop=True)

    # Save
    os.makedirs(PROC_DIR, exist_ok=True)
    out_path = os.path.join(PROC_DIR, 'ndgain_index.csv')
    result.to_csv(out_path, index=False)

    print(f"\nND-GAIN processed:")
    print(f"  Records: {len(result)}")
    print(f"  Countries: {result['iso_code'].nunique()}")
    print(f"  Years: {sorted(result['year'].unique())}")
    ndgain_cols = [c for c in result.columns if c.startswith('ndgain_')]
    for col in ndgain_cols:
        non_null = result[col].notna().sum()
        print(f"  {col}: {non_null} non-null values")
    print(f"  Saved to: {out_path}")

    return result


def main():
    os.makedirs(RAW_DIR, exist_ok=True)

    # Try ZIP first, then individual CSVs
    if not download_zip():
        print("\nTrying individual CSV downloads...")
        download_csv(NDGAIN_GAIN_URL, 'gain')
        download_csv(NDGAIN_VULN_URL, 'vulnerability')
        download_csv(NDGAIN_READY_URL, 'readiness')

    process()


if __name__ == '__main__':
    main()
