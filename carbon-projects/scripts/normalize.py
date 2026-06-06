import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Normalization pipeline: Verra + Gold Standard → Unified Schema
"""
import json
import hashlib
import uuid
from datetime import datetime

VERRA_FILE = "carbon-projects/raw/verra_projects.jsonl"
GS_FILE = "carbon-projects/raw/gold_standard_projects.jsonl"
OUTPUT_FILE = "carbon-projects/unified/carbon_projects_unified.jsonl"
STATS_FILE = "carbon-projects/unified/normalization_stats.json"

# Country name → ISO 3166-1 alpha-3 mapping (common ones)
COUNTRY_TO_ISO3 = {
    "United States": "USA", "China": "CHN", "India": "IND", "Brazil": "BRA",
    "Turkey": "TUR", "South Africa": "ZAF", "Colombia": "COL", "Madagascar": "MDG",
    "Indonesia": "IDN", "Kenya": "KEN", "Viet Nam": "VNM", "Thailand": "THA",
    "Peru": "PER", "Argentina": "ARG", "Germany": "DEU", "Mexico": "MEX",
    "Uganda": "UGA", "Canada": "CAN", "Chile": "CHL", "Zambia": "ZMB",
    "United Kingdom": "GBR", "Spain": "ESP", "Australia": "AUS", "Japan": "JPN",
    "Philippines": "PHL", "Malaysia": "MYS", "Netherlands": "NLD", "France": "FRA",
    "Italy": "ITA", "Poland": "POL", "Sweden": "SWE", "Norway": "NOR",
    "Denmark": "DNK", "Finland": "FIN", "Belgium": "BEL", "Switzerland": "CHE",
    "Austria": "AUT", "New Zealand": "NZL", "Singapore": "SGP", "Bangladesh": "BGD",
    "Pakistan": "PAK", "Nigeria": "NGA", "Ghana": "GHA", "Tanzania": "TZA",
    "Mozambique": "MOZ", "Ethiopia": "ETH", "Rwanda": "RWA", "Malawi": "MWI",
    "Haiti": "HTI", "Cambodia": "KHM", "Myanmar": "MMR", "Nepal": "NPL",
    "Sri Lanka": "LKA", "Mongolia": "MNG", "Kazakhstan": "KAZ", "Uzbekistan": "UZB",
    "Ukraine": "UKR", "Romania": "ROU", "Greece": "GRC", "Portugal": "PRT",
    "Ireland": "IRL", "Czech Republic": "CZE", "Hungary": "HUN", "Israel": "ISR",
    "Saudi Arabia": "SAU", "United Arab Emirates": "ARE", "Qatar": "QAT",
    "Egypt": "EGY", "Morocco": "MAR", "Tunisia": "TUN", "Algeria": "DZA",
    "Senegal": "SEN", "Cameroon": "CMR", "Cote d'Ivoire": "CIV", "Democratic Republic of the Congo": "COD",
    "Republic of the Congo": "COG", "Angola": "AGO", "Zimbabwe": "ZWE",
    "Botswana": "BWA", "Namibia": "NAM", "Lesotho": "LSO", "Swaziland": "SWZ",
    "Costa Rica": "CRI", "Panama": "PAN", "Guatemala": "GTM", "Honduras": "HND",
    "El Salvador": "SLV", "Nicaragua": "NIC", "Ecuador": "ECU", "Bolivia": "BOL",
    "Paraguay": "PRY", "Uruguay": "URY", "Venezuela": "VEN", "Jamaica": "JAM",
    "Trinidad and Tobago": "TTO", "Dominican Republic": "DOM", "Haiti": "HTI",
    "Fiji": "FJI", "Papua New Guinea": "PNG", "Solomon Islands": "SLB",
    "Vanuatu": "VUT", "Samoa": "WSM", "Tonga": "TON",
    "South Korea": "KOR", "North Korea": "PRK", "Taiwan": "TWN",
    "Hong Kong": "HKG", "Macau": "MAC", "Brunei": "BRN",
    "Laos": "LAO", "Timor-Leste": "TLS", "Bhutan": "BTN", "Maldives": "MDV",
    "Afghanistan": "AFG", "Iraq": "IRQ", "Iran": "IRN", "Syria": "SYR",
    "Jordan": "JOR", "Lebanon": "LBN", "Yemen": "YEM", "Oman": "OMN",
    "Kuwait": "KWT", "Bahrain": "BHR", "Libya": "LBY", "Sudan": "SDN",
    "South Sudan": "SSD", "Eritrea": "ERI", "Djibouti": "DJI",
    "Somalia": "SOM", "Burundi": "BDI", "Malawi": "MWI", "Mauritius": "MUS",
    "Seychelles": "SYC", "Comoros": "COM", "Cape Verde": "CPV",
    "Sao Tome and Principe": "STP", "Guinea-Bissau": "GNB", "Guinea": "GIN",
    "Sierra Leone": "SLE", "Liberia": "LBR", "Togo": "TGO", "Benin": "BEN",
    "Burkina Faso": "BFA", "Niger": "NER", "Chad": "TCD", "Central African Republic": "CAF",
    "Equatorial Guinea": "GNQ", "Gabon": "GAB", "Gambia": "GMB",
    "Mauritania": "MRT", "Mali": "MLI", "Ivory Coast": "CIV",
    "Croatia": "HRV", "Serbia": "SRB", "Bosnia and Herzegovina": "BIH",
    "Montenegro": "MNE", "North Macedonia": "MKD", "Albania": "ALB",
    "Kosovo": "XKX", "Slovenia": "SVN", "Slovakia": "SVK", "Lithuania": "LTU",
    "Latvia": "LVA", "Estonia": "EST", "Belarus": "BLR", "Moldova": "MDA",
    "Armenia": "ARM", "Georgia": "GEO", "Azerbaijan": "AZE",
    "Turkmenistan": "TKM", "Tajikistan": "TJK", "Kyrgyzstan": "KGZ",
    "Cuba": "CUB", "Guyana": "GUY", "Suriname": "SUR", "Belize": "BLZ",
    "Bahamas": "BHS", "Barbados": "BRB", "Saint Lucia": "LCA",
    "Grenada": "GRD", "Saint Vincent and the Grenadines": "VCT",
    "Antigua and Barbuda": "ATG", "Dominica": "DMA", "Saint Kitts and Nevis": "KNA",
    "Trinidad and Tobago": "TTO",
}

# Verra protocol category → unified type
VERRA_TYPE_MAP = {
    "Agriculture Forestry and Other Land Use": "forestry",
    "Energy industries (renewable/non-renewable sources)": "renewable_energy",
    "Energy demand": "energy_efficiency",
    "Waste handling and disposal": "waste",
    "Transport": "transport",
    "Manufacturing industries": "industrial",
    "Carbon capture and storage": "industrial",
    "Livestock, enteric fermentation, and manure management": "agriculture",
    "Mining/mineral production": "industrial",
    "Fugitive emissions from fuels (solid, oil and gas)": "industrial",
    "Chemical industry": "industrial",
    "Energy distribution": "energy_efficiency",
    "Construction": "industrial",
    "Metal production": "industrial",
    "Fugitive emissions from production and consumption of halocarbons and sulphur hexafluoride": "industrial",
}

# Gold Standard type → unified type
GS_TYPE_MAP = {
    "Energy Efficiency - Domestic": "energy_efficiency",
    "Energy Efficiency - Public Sector": "energy_efficiency",
    "Energy Efficiency - Transport Sector": "transport",
    "A/R": "forestry",
    "PV": "renewable_energy",
    "Biogas - Heat": "methane",
    "Other": "other",
}


def get_iso3(country_name):
    """Convert country name to ISO 3166-1 alpha-3."""
    if not country_name:
        return None
    # Direct lookup
    if country_name in COUNTRY_TO_ISO3:
        return COUNTRY_TO_ISO3[country_name]
    # Try uppercase
    upper = country_name.upper()
    for name, code in COUNTRY_TO_ISO3.items():
        if name.upper() == upper:
            return code
    return None


def normalize_verra_status(status):
    """Normalize Verra status to unified status."""
    status_map = {
        "Registered": "registered",
        "Under validation": "under_validation",
        "Under development": "under_development",
        "Inactive": "inactive",
        "Withdrawn": "withdrawn",
        "Rejected by Administrator": "rejected",
        "Late to verify": "late_verification",
        "Verification approval requested": "verification_requested",
        "Registration requested": "registration_requested",
        "Registration and verification approval requested": "registration_verification_requested",
        "On Hold - see notification letter": "on_hold",
        "Registration request denied": "registration_denied",
        "Registration and verification approval request denied": "registration_denied",
        "Verification approval request denied": "verification_denied",
        "Crediting Period Renewal Requested": "crediting_renewal_requested",
        "Crediting Period Renewal and Verification Approval Requested": "crediting_renewal_verification_requested",
        "Units Transferred from Approved GHG Program": "units_transferred",
    }
    return status_map.get(status, status.lower().replace(" ", "_"))


def normalize_gs_status(status):
    """Normalize Gold Standard status to unified status."""
    status_map = {
        "LISTED": "listed",
        "GOLD_STANDARD_CERTIFIED_DESIGN": "certified",
        "GOLD_STANDARD_CERTIFIED": "certified",
        "WITHDRAWN": "withdrawn",
        "REJECTED": "rejected",
        "ON_HOLD": "on_hold",
    }
    return status_map.get(status, status.lower().replace(" ", "_"))


def normalize_verra_type(protocol_categories):
    """Normalize Verra protocol category to unified type."""
    if not protocol_categories:
        return "other"
    # Take the first category if multiple (separated by ";")
    primary = protocol_categories.split(";")[0].strip()
    return VERRA_TYPE_MAP.get(primary, "other")


def normalize_gs_type(gs_type):
    """Normalize Gold Standard type to unified type."""
    if not gs_type:
        return "other"
    return GS_TYPE_MAP.get(gs_type, "other")


def normalize_verra_project(p):
    """Normalize a Verra project to unified schema."""
    country = p.get("country", "")
    iso3 = get_iso3(country)
    status = normalize_verra_status(p.get("resourceStatus", ""))
    proj_type = normalize_verra_type(p.get("protocolCategories", ""))
    methodology = p.get("protocols", "")
    # Take first methodology if multiple
    if methodology and ";" in methodology:
        methodology = methodology.split(";")[0].strip()

    return {
        "unified_id": str(uuid.uuid4()),
        "registry_ids": [
            {
                "registry": "verra",
                "id": p.get("resourceIdentifier", ""),
                "url": f"https://registry.verra.org/app/projectDetail/VCS/{p.get('resourceIdentifier', '')}"
            }
        ],
        "name": p.get("resourceName", ""),
        "description": None,
        "status": status,
        "status_raw": p.get("resourceStatus", ""),
        "project_type": {
            "category": proj_type,
            "sub_category": p.get("protocolSubCategories"),
            "methodology": methodology,
        },
        "location": {
            "country": country,
            "country_code_iso3": iso3,
            "region": p.get("region"),
            "latitude": None,
            "longitude": None,
        },
        "developer": {
            "name": p.get("proponent", ""),
        },
        "crediting": {
            "period_start": p.get("creditingPeriodStartDate"),
            "period_end": p.get("creditingPeriodEndDate"),
            "estimated_annual_reduction_tco2": p.get("estAnnualEmissionReductions"),
            "credits_issued": None,
            "credits_retired": None,
            "credit_unit": "VCU",
        },
        "registration": {
            "date": p.get("projectRegistrationDate"),
            "last_updated": p.get("createDate"),
        },
        "co_benefits": {
            "sdgs": [],
            "labels": [],
        },
        "data_quality": {
            "score": 0.5,  # Will be updated during dedup
            "cross_registered": False,
            "registries_count": 1,
        },
        "data_sources": [
            {
                "registry": "verra",
                "url": f"https://registry.verra.org/app/projectDetail/VCS/{p.get('resourceIdentifier', '')}",
                "last_scraped": datetime.utcnow().isoformat() + "Z",
                "raw_data": p,
            }
        ],
    }


def normalize_gs_project(p):
    """Normalize a Gold Standard project to unified schema."""
    country = p.get("country", "")
    iso3 = get_iso3(country)
    status = normalize_gs_status(p.get("status", ""))
    proj_type = normalize_gs_type(p.get("type", ""))
    methodology = p.get("methodology", "")

    # Extract SDGs
    sdgs = []
    sdg_details = []
    for sdg in p.get("sustainable_development_goals", []):
        name = sdg.get("name", "")
        # Extract goal number
        num = None
        if "Goal" in name:
            try:
                num = int(name.split("Goal")[1].split(":")[0].strip())
                sdgs.append(num)
            except (ValueError, IndexError):
                pass
        products = [prod.get("abbreviation") for prod in sdg.get("issuable_products", []) if prod.get("abbreviation")]
        sdg_details.append({
            "goal": num,
            "name": name,
            "products": products,
        })

    return {
        "unified_id": str(uuid.uuid4()),
        "registry_ids": [
            {
                "registry": "gold_standard",
                "id": f"GS{p.get('sustaincert_id', '')}",
                "url": f"https://registry.goldstandard.org/projects/GS{p.get('sustaincert_id', '')}"
            }
        ],
        "name": p.get("name", ""),
        "description": p.get("description"),
        "status": status,
        "status_raw": p.get("status", ""),
        "project_type": {
            "category": proj_type,
            "sub_category": None,
            "methodology": methodology,
        },
        "location": {
            "country": country,
            "country_code_iso3": iso3,
            "region": None,
            "latitude": p.get("latitude"),
            "longitude": p.get("longitude"),
        },
        "developer": {
            "name": p.get("project_developer", ""),
        },
        "crediting": {
            "period_start": p.get("crediting_period_start_date"),
            "period_end": p.get("crediting_period_end_date"),
            "estimated_annual_reduction_tco2": p.get("estimated_annual_credits"),
            "credits_issued": None,
            "credits_retired": None,
            "credit_unit": "GS_VER",
        },
        "registration": {
            "date": None,
            "last_updated": p.get("updated_at"),
        },
        "co_benefits": {
            "sdgs": sdgs,
            "sdg_details": sdg_details,
            "labels": p.get("labels", []),
        },
        "data_quality": {
            "score": 0.5,
            "cross_registered": False,
            "registries_count": 1,
        },
        "data_sources": [
            {
                "registry": "gold_standard",
                "url": f"https://registry.goldstandard.org/projects/GS{p.get('sustaincert_id', '')}",
                "last_scraped": datetime.utcnow().isoformat() + "Z",
                "raw_data": p,
            }
        ],
    }


def main():
    print("=" * 60)
    print("CARBON PROJECTS NORMALIZATION PIPELINE")
    print("=" * 60)

    # Load Verra projects
    print("\nLoading Verra projects...")
    verra_projects = []
    with open(VERRA_FILE) as f:
        for line in f:
            verra_projects.append(json.loads(line))
    print(f"  Loaded {len(verra_projects)} Verra projects")

    # Load Gold Standard projects
    print("Loading Gold Standard projects...")
    gs_projects = []
    with open(GS_FILE) as f:
        for line in f:
            gs_projects.append(json.loads(line))
    print(f"  Loaded {len(gs_projects)} Gold Standard projects")

    # Normalize
    print("\nNormalizing...")
    unified = []
    for p in verra_projects:
        unified.append(normalize_verra_project(p))
    for p in gs_projects:
        unified.append(normalize_gs_project(p))

    print(f"  Total unified projects: {len(unified)}")

    # Stats
    verra_countries = set()
    gs_countries = set()
    verra_types = {}
    gs_types = {}
    verra_statuses = {}
    gs_statuses = {}

    for p in unified:
        src = p["data_sources"][0]["registry"]
        if src == "verra":
            verra_countries.add(p["location"]["country"])
            t = p["project_type"]["category"]
            verra_types[t] = verra_types.get(t, 0) + 1
            s = p["status"]
            verra_statuses[s] = verra_statuses.get(s, 0) + 1
        else:
            gs_countries.add(p["location"]["country"])
            t = p["project_type"]["category"]
            gs_types[t] = gs_types.get(t, 0) + 1
            s = p["status"]
            gs_statuses[s] = gs_statuses.get(s, 0) + 1

    all_countries = verra_countries | gs_countries

    stats = {
        "total_projects": len(unified),
        "verra_projects": len(verra_projects),
        "gold_standard_projects": len(gs_projects),
        "unique_countries": len(all_countries),
        "verra_countries": len(verra_countries),
        "gs_countries": len(gs_countries),
        "verra_types": verra_types,
        "gs_types": gs_types,
        "verra_statuses": verra_statuses,
        "gs_statuses": gs_statuses,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }

    # Save unified data
    with open(OUTPUT_FILE, "w") as f:
        for p in unified:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print(f"\nSaved unified data to {OUTPUT_FILE}")

    # Save stats
    with open(STATS_FILE, "w") as f:
        json.dump(stats, f, indent=2)
    print(f"Saved stats to {STATS_FILE}")

    # Print summary
    print(f"\n{'=' * 60}")
    print("NORMALIZATION SUMMARY")
    print(f"{'=' * 60}")
    print(f"Total projects: {len(unified):,}")
    print(f"  Verra: {len(verra_projects):,}")
    print(f"  Gold Standard: {len(gs_projects):,}")
    print(f"Unique countries: {len(all_countries)}")
    print(f"\nVerra types:")
    for t, c in sorted(verra_types.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")
    print(f"\nGold Standard types:")
    for t, c in sorted(gs_types.items(), key=lambda x: -x[1]):
        print(f"  {t}: {c}")
    print(f"\nVerra statuses:")
    for s, c in sorted(verra_statuses.items(), key=lambda x: -x[1]):
        print(f"  {s}: {c}")
    print(f"\nGold Standard statuses:")
    for s, c in sorted(gs_statuses.items(), key=lambda x: -x[1]):
        print(f"  {s}: {c}")


if __name__ == "__main__":
    main()
