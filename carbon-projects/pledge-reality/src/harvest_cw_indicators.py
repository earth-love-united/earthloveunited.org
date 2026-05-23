#!/usr/bin/env python3
"""
Smart Climate Watch NDC Content Harvester v2.

Discovery: The CW API ignores indicator_id as a filter parameter.
It always returns ALL indicators for all countries, paginated by iso_code ASC.
The `countries` parameter DOES work for filtering by ISO3 code.

Strategy: 
  1. Get the full list of ISO3 codes from the API (first pass)
  2. For each country, fetch ALL their indicators in one shot
  3. Filter client-side for the indicators we need
  4. Save structured JSON

Each country has ~150-200 records, so per_page=500 should get most in 1 request.
"""
import requests
import json
import time
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
RAW_DIR = os.path.join(PLEDGE_DIR, 'data', 'raw')

BASE_URL = "https://www.climatewatchdata.org/api/v1/data/ndc_content"

# ISO3 codes for all UN member states + observers (196 UNFCCC parties)
# Generated from standard ISO 3166-1 alpha-3
ALL_ISO3 = [
    'AFG','ALB','DZA','AND','AGO','ATG','ARG','ARM','AUS','AUT',
    'AZE','BHS','BHR','BGD','BRB','BLR','BEL','BLZ','BEN','BTN',
    'BOL','BIH','BWA','BRA','BRN','BGR','BFA','BDI','CPV','KHM',
    'CMR','CAN','CAF','TCD','CHL','CHN','COL','COM','COG','COK',
    'CRI','HRV','CUB','CYP','CZE','CIV','PRK','COD','DNK','DJI',
    'DMA','DOM','ECU','EGY','SLV','GNQ','ERI','EST','SWZ','ETH',
    'FJI','FIN','FRA','GAB','GMB','GEO','DEU','GHA','GRC','GRD',
    'GTM','GIN','GNB','GUY','HTI','HND','HUN','ISL','IND','IDN',
    'IRN','IRQ','IRL','ISR','ITA','JAM','JPN','JOR','KAZ','KEN',
    'KIR','KWT','KGZ','LAO','LVA','LBN','LSO','LBR','LBY','LIE',
    'LTU','LUX','MDG','MWI','MYS','MDV','MLI','MLT','MHL','MRT',
    'MUS','MEX','FSM','MCO','MNG','MNE','MAR','MOZ','MMR','NAM',
    'NRU','NPL','NLD','NZL','NIC','NER','NGA','NIU','MKD','NOR',
    'OMN','PAK','PLW','PAN','PNG','PRY','PER','PHL','POL','PRT',
    'QAT','KOR','MDA','ROU','RUS','RWA','KNA','LCA','VCT','WSM',
    'SMR','STP','SAU','SEN','SRB','SYC','SLE','SGP','SVK','SVN',
    'SLB','SOM','ZAF','SSD','ESP','LKA','SDN','SUR','SWE','CHE',
    'SYR','TJK','THA','TLS','TGO','TON','TTO','TUN','TUR','TKM',
    'TUV','UGA','UKR','ARE','GBR','TZA','USA','URY','UZB','VUT',
    'VEN','VNM','YEM','ZMB','ZWE',
    # EU as entity
    'EUU',
]

# The indicators we actually need (filter client-side)
TARGET_INDICATORS = {
    'ghg_target', 'ghg_target_type', 'time_target_year', 'indc_summary',
    'conditionality', 'mitigation_contribution_type',
    'ghg_target_base_year', 'ghg_target_baseline', 'ghg_target_intensity',
    'ghg_target_fixed_level', 'ghg_target_trajectory',
    'timeframe', 'time_single_multi_year_target',
    'coverage_sectors', 'coverage_gas',
    'submission', 'submission_date', 'submission_type',
    'pa_ratified', 'pa_status',
    'non_ghg_target',
    'mitigation_total_financial_requirements',
    'adaptation_total_financial_requirements',
    'identified_total_financial_requirements',
    'ndce_ghg',  # share of global GHG
}


def fetch_country(iso3, max_pages=10):
    """Fetch all NDC content records for a single country."""
    all_records = []
    seen_ids = set()

    for page in range(1, max_pages + 1):
        try:
            resp = requests.get(
                BASE_URL,
                params={
                    'countries': iso3,
                    'per_page': 500,
                    'page': page,
                },
                headers={'User-Agent': 'EarthLoveUnited/1.0 (climate-research)'},
                timeout=30,
            )

            if resp.status_code != 200:
                break

            data = resp.json()
            records = data.get('data', [])

            if not records:
                break

            new = 0
            for r in records:
                rid = r.get('id')
                if rid and rid not in seen_ids:
                    seen_ids.add(rid)
                    all_records.append(r)
                    new += 1

            # If we got fewer than 500, we're done
            if len(records) < 500 or new == 0:
                break

            time.sleep(0.1)

        except requests.exceptions.Timeout:
            time.sleep(1)
            continue
        except Exception as e:
            break

    return all_records


def harvest_all():
    """Harvest NDC data for all countries."""
    os.makedirs(RAW_DIR, exist_ok=True)

    country_indicators = {}
    total_records = 0
    failed = []

    print(f"Harvesting {len(ALL_ISO3)} countries from Climate Watch API...")
    print(f"{'='*60}")

    for i, iso3 in enumerate(ALL_ISO3):
        sys.stdout.write(f"\r[{i+1}/{len(ALL_ISO3)}] {iso3}...")
        sys.stdout.flush()

        records = fetch_country(iso3)

        if not records:
            # Country might not have NDC data
            failed.append(iso3)
            continue

        # Filter for our target indicators and extract
        country_name = records[0].get('country', iso3)
        cd = {
            'iso_code': iso3,
            'country': country_name,
        }

        for r in records:
            ind_id = r.get('indicator_id', '')
            value = r.get('value', '')
            source = r.get('source', '')

            if not ind_id or not value:
                continue

            if ind_id not in TARGET_INDICATORS:
                continue

            # CRITICAL: CW API returns NDC records in chronological order.
            # The LAST record for each indicator is the LATEST NDC submission.
            # Always overwrite with the newest value.
            key = ind_id
            if value and value != 'Not Specified':
                cd[key] = value

        country_indicators[iso3] = cd
        total_records += len(records)

        # Throttle
        time.sleep(0.05)

    print(f"\n{'='*60}")
    print(f"Total countries harvested: {len(country_indicators)}")
    print(f"Failed/empty: {len(failed)}")
    print(f"Total raw records processed: {total_records}")

    # Save
    raw_path = os.path.join(RAW_DIR, 'cw_ndc_indicators.json')
    with open(raw_path, 'w') as f:
        json.dump({
            'harvested_at': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'total_records': total_records,
            'total_countries': len(country_indicators),
            'failed_iso3': failed,
            'indicators_tracked': sorted(TARGET_INDICATORS),
            'data': country_indicators,
        }, f, indent=2)

    print(f"\nSaved to: {raw_path}")

    # Coverage stats
    print(f"\n=== Coverage Stats ===")
    for ind_id in ['ghg_target', 'time_target_year', 'ghg_target_type',
                    'conditionality', 'indc_summary', 'ndce_ghg']:
        count = sum(1 for cd in country_indicators.values()
                    if cd.get(ind_id) and cd[ind_id] != 'Not Specified')
        print(f"  {ind_id}: {count} countries")

    # Sample
    print(f"\n=== Sample Data ===")
    for iso in ['USA', 'CHN', 'IND', 'BRA', 'DEU', 'NGA', 'KEN', 'FJI']:
        cd = country_indicators.get(iso, {})
        target = (cd.get('ghg_target', 'N/A') or 'N/A')[:80]
        year = cd.get('time_target_year', 'N/A')
        cond = cd.get('conditionality', 'N/A')
        print(f"  {iso}: target_year={year}, cond={cond}")
        print(f"        ghg_target={target}")

    return country_indicators


if __name__ == '__main__':
    harvest_all()
