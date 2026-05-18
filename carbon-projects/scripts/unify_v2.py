"""
Full unification pipeline: 8 registries → 1 dataset.
Merges Verra, Gold Standard, CDM, CAR, ACR, CERCARBONO, Isometric, ART.
"""
import json
import uuid
import os
from datetime import datetime, timezone

DATA_DIR = "/Users/ekmelozdemir/earthloveunited.org/tools/scraper/data/scraped"
OUTPUT_FILE = "/Users/ekmelozdemir/earthloveunited.org/carbon-projects/unified/carbon_projects_v2.jsonl"

# Country centroids for geocoding
COUNTRY_CENTROIDS = {
    "Afghanistan": (33.0, 65.0), "Albania": (41.0, 20.0), "Algeria": (28.0, 3.0),
    "Angola": (-12.5, 18.5), "Argentina": (-34.0, -64.0), "Armenia": (40.0, 45.0),
    "Australia": (-27.0, 133.0), "Austria": (47.33, 13.33), "Azerbaijan": (40.5, 47.5),
    "Bahrain": (26.0, 50.55), "Bangladesh": (24.0, 90.0), "Belarus": (53.0, 28.0),
    "Belgium": (50.83, 4.0), "Belize": (17.25, -88.75), "Benin": (9.5, 2.25),
    "Bhutan": (27.5, 90.5), "Bolivia": (-17.0, -65.0), "Botswana": (-22.0, 24.0),
    "Brazil": (-10.0, -55.0), "Brunei": (4.5, 114.67), "Bulgaria": (43.0, 25.0),
    "Burkina Faso": (13.0, -2.0), "Burundi": (-3.5, 30.0), "Cambodia": (13.0, 105.0),
    "Cameroon": (6.0, 12.0), "Canada": (60.0, -95.0), "Cape Verde": (16.0, -24.0),
    "Cabo Verde": (16.0, -24.0), "Central African Republic": (7.0, 21.0),
    "Chad": (15.0, 19.0), "Chile": (-30.0, -71.0), "China": (35.0, 105.0),
    "Colombia": (4.0, -72.0), "Comoros": (-12.17, 44.25),
    "Republic of the Congo": (-1.0, 15.0), "Congo": (-1.0, 15.0),
    "Democratic Republic of the Congo": (0.0, 25.0), "DRC": (0.0, 25.0),
    "Costa Rica": (10.0, -84.0), "Croatia": (45.17, 15.5), "Cuba": (21.5, -80.0),
    "Cyprus": (35.0, 33.0), "Czech Republic": (49.75, 15.5), "Czechia": (49.75, 15.5),
    "Denmark": (56.0, 10.0), "Djibouti": (11.5, 43.0), "Dominican Republic": (19.0, -70.67),
    "Ecuador": (-2.0, -77.5), "Egypt": (27.0, 30.0), "El Salvador": (13.83, -88.92),
    "Equatorial Guinea": (2.0, 10.0), "Eritrea": (15.0, 39.0), "Estonia": (59.0, 26.0),
    "Eswatini": (-26.5, 31.5), "Swaziland": (-26.5, 31.5), "Ethiopia": (8.0, 38.0),
    "Fiji": (-18.0, 175.0), "Finland": (64.0, 26.0), "France": (46.0, 2.0),
    "Gabon": (-1.0, 11.75), "Gambia": (13.47, -16.57), "Georgia": (42.0, 43.5),
    "Germany": (51.0, 9.0), "Ghana": (8.0, -2.0), "Greece": (39.0, 22.0),
    "Grenada": (12.12, -61.67), "Guatemala": (15.5, -90.25), "Guinea": (11.0, -10.0),
    "Guinea-Bissau": (12.0, -15.0), "Guyana": (5.0, -59.0), "Haiti": (19.0, -72.42),
    "Honduras": (15.0, -86.5), "Hungary": (47.0, 20.0), "Iceland": (65.0, -18.0),
    "India": (20.0, 77.0), "Indonesia": (-5.0, 120.0), "Iran": (32.0, 53.0),
    "Iraq": (33.0, 44.0), "Ireland": (53.0, -8.0), "Israel": (31.5, 34.75),
    "Italy": (42.83, 12.83), "Ivory Coast": (8.0, -5.0), "Cote d'Ivoire": (8.0, -5.0),
    "Côte d'Ivoire": (8.0, -5.0), "Jamaica": (18.25, -77.5), "Japan": (36.0, 138.0),
    "Jordan": (31.0, 36.0), "Kazakhstan": (48.0, 68.0), "Kenya": (1.0, 38.0),
    "Kiribati": (1.42, 173.0), "Kuwait": (29.5, 45.75), "Kyrgyzstan": (41.0, 75.0),
    "Laos": (18.0, 105.0), "Lao People's Democratic Republic": (18.0, 105.0),
    "Latvia": (57.0, 25.0), "Lebanon": (33.83, 35.83), "Lesotho": (-29.5, 28.5),
    "Liberia": (6.5, -9.5), "Libya": (25.0, 17.0), "Lithuania": (56.0, 24.0),
    "Luxembourg": (49.75, 6.17), "Madagascar": (-20.0, 47.0), "Malawi": (-13.5, 34.0),
    "Malaysia": (2.5, 112.5), "Maldives": (3.25, 73.0), "Mali": (17.0, -4.0),
    "Malta": (35.83, 14.58), "Mauritania": (20.0, -12.0), "Mauritius": (-20.28, 57.55),
    "Mexico": (23.0, -102.0), "Moldova": (47.0, 29.0), "Mongolia": (46.0, 105.0),
    "Montenegro": (42.0, 19.0), "Morocco": (32.0, -5.0), "Mozambique": (-18.25, 35.0),
    "Myanmar": (22.0, 98.0), "Burma": (22.0, 98.0), "Namibia": (-22.0, 17.0),
    "Nepal": (28.0, 84.0), "Netherlands": (52.5, 5.75), "New Zealand": (-41.0, 174.0),
    "Nicaragua": (13.0, -85.0), "Niger": (16.0, 8.0), "Nigeria": (10.0, 8.0),
    "North Korea": (40.0, 127.0), "North Macedonia": (41.83, 22.0),
    "Norway": (62.0, 10.0), "Oman": (21.0, 57.0), "Pakistan": (30.0, 70.0),
    "Palau": (7.5, 134.5), "Panama": (9.0, -80.0), "Papua New Guinea": (-6.0, 147.0),
    "Paraguay": (-23.0, -58.0), "Peru": (-10.0, -76.0), "Philippines": (13.0, 122.0),
    "Poland": (52.0, 20.0), "Portugal": (39.5, -8.0), "Qatar": (25.5, 51.25),
    "Romania": (46.0, 25.0), "Russia": (60.0, 100.0), "Russian Federation": (60.0, 100.0),
    "Rwanda": (-2.0, 30.0), "Saudi Arabia": (25.0, 45.0), "Senegal": (14.0, -14.0),
    "Serbia": (44.0, 21.0), "Seychelles": (-4.58, 55.67), "Sierra Leone": (8.5, -11.5),
    "Singapore": (1.37, 103.8), "Slovakia": (48.67, 19.5), "Slovenia": (46.12, 14.82),
    "Solomon Islands": (-8.0, 159.0), "Somalia": (10.0, 49.0), "South Africa": (-29.0, 24.0),
    "South Korea": (37.0, 127.5), "South Sudan": (7.0, 30.0), "Spain": (40.0, -4.0),
    "Sri Lanka": (7.0, 81.0), "Sudan": (15.0, 30.0), "Suriname": (4.0, -56.0),
    "Sweden": (62.0, 15.0), "Switzerland": (47.0, 8.0), "Syria": (35.0, 38.0),
    "Taiwan": (23.5, 121.0), "Tajikistan": (39.0, 71.0), "Tanzania": (-6.0, 35.0),
    "Thailand": (15.0, 100.0), "Timor-Leste": (-8.83, 125.72), "Togo": (8.0, 1.17),
    "Trinidad and Tobago": (11.0, -61.0), "Tunisia": (34.0, 9.0), "Turkey": (39.0, 35.0),
    "Turkmenistan": (40.0, 60.0), "Uganda": (1.0, 32.0), "Ukraine": (49.0, 32.0),
    "United Arab Emirates": (24.0, 54.0), "United Kingdom": (54.0, -2.0),
    "United States": (38.0, -97.0), "USA": (38.0, -97.0), "UK": (54.0, -2.0),
    "Uruguay": (-33.0, -56.0), "Uzbekistan": (41.0, 64.0), "Vanuatu": (-16.0, 167.0),
    "Venezuela": (8.0, -66.0), "Viet Nam": (16.0, 108.0), "Vietnam": (16.0, 108.0),
    "Yemen": (15.0, 48.0), "Zambia": (-15.0, 30.0), "Zimbabwe": (-20.0, 30.0),
    "Bolivia, Plurinational State of": (-17.0, -65.0),
    "Congo, the Democratic Republic of the": (0.0, 25.0),
    "Congo, The Democratic Republic of The": (0.0, 25.0),
    "Lao People's Democratic Republic": (18.0, 105.0),
    "Moldova, Republic of": (47.0, 29.0), "Kosovo": (42.58, 20.90),
    "Kosovo, Republic of": (42.58, 20.90), "International": (0.0, 0.0),
    "Côte d'Ivoire": (8.0, -5.0), "Guam": (13.44, 144.79),
    "Hong Kong": (22.39, 114.11), "Mayotte": (-12.83, 45.17),
    "Syrian Arab Republic": (35.0, 38.0), "Tanzania, United Republic of": (-6.0, 35.0),
    "Venezuela, Bolivarian Republic of": (8.0, -66.0),
    "Iran, Islamic Republic of": (32.0, 53.0),
    "Korea, Republic of": (37.0, 127.5),
    "Micronesia, Federated States of": (6.88, 158.23),
}

# Methodology name mapping (comprehensive)
METH_NAMES = {
    "ACM0001": "Flaring or use of landfill gas",
    "ACM0002": "Grid-connected renewable electricity generation",
    "ACM0006": "Electricity and heat generation from biomass",
    "ACM0008": "Coal bed methane capture", "ACM0009": "Fuel switch from coal to natural gas",
    "ACM0010": "GHG emission reductions in cement manufacturing",
    "ACM0012": "Waste energy recovery", "ACM0014": "Electricity generation from biomass",
    "ACM0022": "Alternative waste treatment processes", "ACM0037": "Flaring of gas from coal mines",
    "AMS-I.A.": "Electricity generation by the user (small scale)",
    "AMS-I.C.": "Thermal energy production (small scale)",
    "AMS-I.D.": "Grid connected renewable electricity generation (small scale)",
    "AMS-I.E.": "Switch from non-renewable biomass for thermal applications (small scale)",
    "AMS-I.F.": "Renewable electricity generation for captive use (small scale)",
    "AMS-II.C.": "Energy efficiency in industrial facilities (small scale)",
    "AMS-II.D.": "Energy efficiency and fuel switch in industrial facilities (small scale)",
    "AMS-II.G.": "Energy efficiency in thermal applications of non-renewable biomass (small scale)",
    "AMS-II.J.": "Efficient lighting for buildings (small scale)",
    "AMS-III.AU": "Emission reduction in rice cultivation (small scale)",
    "AMS-III.C.": "Emission reduction in transport (small scale)",
    "AMS-III.D.": "Methane recovery in animal manure management (small scale)",
    "AMS-III.H.": "Methane recovery in wastewater treatment (small scale)",
    "AMS-III.Y.": "Methane recovery from industrial wastewater (small scale)",
    "AMS-III.Z.": "Efficiency improvements in brick manufacturing (small scale)",
    "AMS-III.AO.": "Methane recovery in wastewater treatment — algal biodiesel (small scale)",
    "AMS-III.AQ.": "Methane recovery in wastewater treatment — aquaculture (small scale)",
    "AR-ACM0003": "Afforestation and reforestation of degraded land",
    "AR-AMS0007": "Afforestation and reforestation (small scale)",
    "AR-AM0002": "Restoration of degraded lands through afforestation/reforestation",
    "AR-AM0003": "Afforestation and reforestation project activities",
    "VM0001": "Improved Forest Management (IFM) — Tropical Forests",
    "VM0007": "Reduced Emissions from Deforestation and Degradation (REDD)",
    "VM0009": "Methodology for Avoided Ecosystem Conversion",
    "VM0010": "Improved Forest Management — Smallholders",
    "VM0015": "Methodology for Avoided Unplanned Deforestation",
    "VM0017": "Adoption of Sustainable Agricultural Land Management",
    "VM0018": "Energy Efficiency and Fuel Switch Measures in Thermal Applications",
    "VM0025": "Methodology for Sustainable Agricultural Land Management (SALM)",
    "VM0026": "Improved Forest Management in Temperate and Boreal Forests",
    "VM0033": "Improved Forest Management through IFM",
    "VM0038": "Methodology for Improved Forest Management through ARR",
    "VM0041": "Reducing Enteric Methane Emissions from Ruminants",
    "VM0042": "Improved Agricultural Land Management",
    "VM0047": "Afforestation, Reforestation, and Revegetation (ARR)",
    "VM0048": "Reduced Emissions from Deforestation and Degradation (REDD+)",
    "VM0049": "Carbon Capture and Storage (CCS)",
    "VM0050": "Efficient Cookstoves for Domestic Cooking",
    "VM0051": "Reduced Emissions from Rice Cultivation",
    "VMR0006": "Emission reduction in the transport sector",
    "VMR0014": "Electric Vehicle Charging",
    "VMR0016": "Landfill Gas Capture and Destruction",
    "AM0073": "GHG emission reduction through multi-site cogeneration",
}

def get_meth_name(code):
    if not code:
        return None
    code = code.strip()
    if code in METH_NAMES:
        return METH_NAMES[code]
    for prefix, name in METH_NAMES.items():
        if code.startswith(prefix):
            return name
    if code.startswith("ACM"): return f"CDM Large-Scale Methodology {code}"
    if code.startswith("AMS-"): return f"CDM Small-Scale Methodology {code}"
    if code.startswith("VM"): return f"VCS Methodology {code}"
    if code.startswith("AR-"): return "Afforestation/Reforestation Methodology"
    if code.startswith("VMR"): return f"VCS Methodology {code}"
    if code.startswith("AM"): return f"CDM Methodology {code}"
    if code.startswith("GS"): return "Gold Standard Methodology"
    if "TPDDTEC" in code or "cookstove" in code.lower():
        return "Technologies and Practices to Displace Decentralized Thermal Energy Consumption"
    if "drinking water" in code.lower() or "safe water" in code.lower():
        return "Methodology for Safe Drinking Water Supply"
    return None

def get_centroid(country):
    if not country:
        return None, None
    if country in COUNTRY_CENTROIDS:
        return COUNTRY_CENTROIDS[country]
    country_lower = country.lower()
    for name, coords in COUNTRY_CENTROIDS.items():
        if name.lower() == country_lower:
            return coords
    for name, coords in COUNTRY_CENTROIDS.items():
        if abs(len(name) - len(country)) < 10:
            if name.lower() in country_lower or country_lower in name.lower():
                return coords
    return None, None

def normalize_status(status, registry):
    if not status:
        return "unknown"
    s = str(status).lower()
    if "registered" in s or "rd" == s: return "registered"
    if "listed" in s: return "listed"
    if "certified" in s: return "certified"
    if "validation" in s or "under" in s: return "under_validation"
    if "rejected" in s or "denied" in s: return "rejected"
    if "withdrawn" in s: return "withdrawn"
    if "inactive" in s: return "inactive"
    if "terminated" in s: return "terminated"
    if "under development" in s or "development" in s: return "under_development"
    return s.replace(" ", "_")

def compute_quality(p):
    score = 0.0
    if p.get("project_type", {}).get("methodology"): score += 0.15
    if p.get("project_type", {}).get("methodology_name"): score += 0.10
    if p.get("description"): score += 0.15
    if p.get("location", {}).get("latitude") is not None: score += 0.10
    cred = p.get("crediting", {})
    if cred.get("period_start") and cred.get("period_end"): score += 0.10
    if cred.get("estimated_annual_reduction_tco2"): score += 0.10
    if p.get("co_benefits", {}).get("sdgs"): score += 0.05
    if p.get("developer", {}).get("name"): score += 0.05
    if p.get("registration", {}).get("date"): score += 0.05
    if p.get("project_type", {}).get("sub_category"): score += 0.05
    if p.get("crediting", {}).get("credits_issued"): score += 0.05
    if p.get("crediting", {}).get("credits_retired"): score += 0.05
    return round(min(1.0, score), 3)


def main():
    print("=" * 60)
    print("CARBON PROJECTS v2 — FULL UNIFICATION")
    print("=" * 60)

    all_projects = []

    # ========================================
    # 1. VERRA (base)
    # ========================================
    print("\n[1/8] Loading Verra...")
    verra = {}
    with open("/Users/ekmelozdemir/earthloveunited.org/carbon-projects/raw/verra_projects.jsonl") as f:
        for line in f:
            p = json.loads(line)
            vid = p.get("resourceIdentifier", "")
            verra[vid] = p

    # Load Verra details (descriptions)
    verra_details = {}
    with open(f"{DATA_DIR}/verra_details.jsonl") as f:
        for line in f:
            d = json.loads(line)
            verra_details[d.get("project_id", "")] = d

    count = 0
    for vid, p in verra.items():
        methodology = p.get("protocols", "")
        names = []
        for code in methodology.split(";"):
            name = get_meth_name(code.strip())
            if name: names.append(name)

        detail = verra_details.get(vid, {})
        desc = detail.get("description")

        proj = {
            "unified_id": str(uuid.uuid4()),
            "registry_ids": [{"registry": "verra", "id": vid, "url": f"https://registry.verra.org/app/projectDetail/VCS/{vid}"}],
            "name": p.get("resourceName", ""),
            "description": desc,
            "status": normalize_status(p.get("resourceStatus", ""), "verra"),
            "status_raw": p.get("resourceStatus", ""),
            "project_type": {
                "category": map_verra_type(p.get("protocolCategories", "")),
                "sub_category": p.get("protocolSubCategories"),
                "methodology": methodology,
                "methodology_name": "; ".join(names) if names else None,
            },
            "location": {"country": p.get("country", ""), "country_code_iso3": None, "region": p.get("region"), "latitude": None, "longitude": None},
            "developer": {"name": p.get("proponent", "")},
            "crediting": {
                "period_start": p.get("creditingPeriodStartDate"),
                "period_end": p.get("creditingPeriodEndDate"),
                "estimated_annual_reduction_tco2": p.get("estAnnualEmissionReductions"),
                "credits_issued": None, "credits_retired": None, "credit_unit": "VCU",
            },
            "registration": {"date": p.get("projectRegistrationDate"), "last_updated": p.get("createDate")},
            "co_benefits": {"sdgs": [], "labels": []},
            "data_quality": {"score": 0, "cross_registered": False, "registries_count": 1},
            "data_sources": [{"registry": "verra", "url": f"https://registry.verra.org/app/projectDetail/VCS/{vid}", "last_scraped": datetime.now(timezone.utc).isoformat(), "raw_data": p}],
        }
        all_projects.append(proj)
        count += 1
    print(f"  {count} Verra projects")

    # ========================================
    # 2. GOLD STANDARD (base + enrichment)
    # ========================================
    print("[2/8] Loading Gold Standard...")
    # Load methodology enrichment
    gs_enrich = {}
    with open(f"{DATA_DIR}/gs_methodology_enrichment.jsonl") as f:
        for line in f:
            e = json.loads(line)
            gs_enrich[e.get("id", "")] = e

    gs = {}
    with open("/Users/ekmelozdemir/earthloveunited.org/carbon-projects/raw/gold_standard_projects.jsonl") as f:
        for line in f:
            p = json.loads(line)
            gs[p.get("id", "")] = p

    count = 0
    for gid, p in gs.items():
        methodology = p.get("methodology", "")
        # Check enrichment
        enrich = gs_enrich.get(gid, {})
        if not methodology and enrich.get("methodology"):
            methodology = enrich["methodology"]

        names = []
        for code in methodology.split(";") if methodology else []:
            name = get_meth_name(code.strip())
            if name: names.append(name)

        proj = {
            "unified_id": str(uuid.uuid4()),
            "registry_ids": [{"registry": "gold_standard", "id": f"GS{p.get('sustaincert_id', '')}", "url": f"https://registry.goldstandard.org/projects/GS{p.get('sustaincert_id', '')}"}],
            "name": p.get("name", ""),
            "description": p.get("description"),
            "status": normalize_status(p.get("status", ""), "gold_standard"),
            "status_raw": p.get("status", ""),
            "project_type": {
                "category": map_gs_type(p.get("type", "")),
                "sub_category": None,
                "methodology": methodology,
                "methodology_name": "; ".join(names) if names else None,
            },
            "location": {"country": p.get("country", ""), "country_code_iso3": None, "region": None, "latitude": p.get("latitude"), "longitude": p.get("longitude")},
            "developer": {"name": p.get("project_developer", "")},
            "crediting": {
                "period_start": p.get("crediting_period_start_date"),
                "period_end": p.get("crediting_period_end_date"),
                "estimated_annual_reduction_tco2": p.get("estimated_annual_credits"),
                "credits_issued": None, "credits_retired": None, "credit_unit": "GS_VER",
            },
            "registration": {"date": None, "last_updated": p.get("updated_at")},
            "co_benefits": {"sdgs": [sdg.get("goal") for sdg in p.get("sustainable_development_goals", []) if sdg.get("goal")], "labels": p.get("labels", [])},
            "data_quality": {"score": 0, "cross_registered": False, "registries_count": 1},
            "data_sources": [{"registry": "gold_standard", "url": f"https://registry.goldstandard.org/projects/GS{p.get('sustaincert_id', '')}", "last_scraped": datetime.now(timezone.utc).isoformat(), "raw_data": p}],
        }
        all_projects.append(proj)
        count += 1
    print(f"  {count} Gold Standard projects")

    # ========================================
    # 3. CDM
    # ========================================
    print("[3/8] Loading CDM...")
    count = 0
    with open(f"{DATA_DIR}/cdm_projects.jsonl") as f:
        for line in f:
            p = json.loads(line)
            methodology = p.get("methodology", "")
            names = []
            for code in methodology.split(";"):
                name = get_meth_name(code.strip())
                if name: names.append(name)

            proj = {
                "unified_id": str(uuid.uuid4()),
                "registry_ids": [{"registry": "cdm", "id": p.get("cdm_ref", ""), "url": f"https://cdm.unfccc.int/Projects/DB/{p.get('iges_id', '')}"}],
                "name": p.get("name", ""),
                "description": p.get("supplemental_info"),
                "status": normalize_status(p.get("status_id", ""), "cdm"),
                "status_raw": p.get("status_id", ""),
                "project_type": {
                    "category": map_cdm_type(p.get("project_type", "")),
                    "sub_category": p.get("scale"),
                    "methodology": methodology,
                    "methodology_name": "; ".join(names) if names else None,
                },
                "location": {"country": p.get("country", ""), "country_code_iso3": None, "region": p.get("region"), "latitude": None, "longitude": None},
                "developer": {"name": p.get("proponent", "")},
                "crediting": {
                    "period_start": p.get("crediting_start"),
                    "period_end": None,
                    "estimated_annual_reduction_tco2": p.get("annual_ers"),
                    "credits_issued": None, "credits_retired": None, "credit_unit": "CER",
                },
                "registration": {"date": p.get("registration_date"), "last_updated": p.get("ingested_at")},
                "co_benefits": {"sdgs": [], "labels": []},
                "data_quality": {"score": 0, "cross_registered": False, "registries_count": 1},
                "data_sources": [{"registry": "cdm", "url": f"https://cdm.unfccc.int/Projects/DB/{p.get('iges_id', '')}", "last_scraped": datetime.now(timezone.utc).isoformat(), "raw_data": p}],
            }
            all_projects.append(proj)
            count += 1
    print(f"  {count} CDM projects")

    # ========================================
    # 4-7. CarbonPlan registries (CAR, ACR, CERCARBONO, ISOMETRIC, ART)
    # ========================================
    carbonplan_files = [
        ("car", "CAR", f"{DATA_DIR}/car_projects.jsonl"),
        ("acr", "ACR", f"{DATA_DIR}/acr_projects.jsonl"),
        ("cercarbono", "CERCARBONO", f"{DATA_DIR}/cercarbono_projects.jsonl"),
        ("isometric", "ISOMETRIC", f"{DATA_DIR}/isometric_projects.jsonl"),
        ("art", "ART", f"{DATA_DIR}/art_projects.jsonl"),
    ]

    for name, registry, path in carbonplan_files:
        print(f"[{carbonplan_files.index((name, registry, path)) + 4}/8] Loading {registry}...")
        count = 0
        with open(path) as f:
            for line in f:
                p = json.loads(line)
                methodology = p.get("methodology", "")
                names = []
                for code in methodology.split(";"):
                    name_m = get_meth_name(code.strip())
                    if name_m: names.append(name_m)

                proj = {
                    "unified_id": str(uuid.uuid4()),
                    "registry_ids": [{"registry": registry.lower(), "id": p.get("project_id", ""), "url": p.get("project_url", "")}],
                    "name": p.get("name", ""),
                    "description": None,
                    "status": normalize_status(p.get("status", ""), registry),
                    "status_raw": p.get("status", ""),
                    "project_type": {
                        "category": map_carbonplan_category(p.get("category", ""), p.get("project_type", "")),
                        "sub_category": None,
                        "methodology": methodology,
                        "methodology_name": "; ".join(names) if names else None,
                    },
                    "location": {"country": p.get("country", ""), "country_code_iso3": None, "region": None, "latitude": None, "longitude": None},
                    "developer": {"name": p.get("proponent", "")},
                    "crediting": {
                        "period_start": None, "period_end": None,
                        "estimated_annual_reduction_tco2": None,
                        "credits_issued": p.get("credits_issued"),
                        "credits_retired": p.get("credits_retired"),
                        "credit_unit": registry.upper(),
                    },
                    "registration": {"date": p.get("listed_at"), "last_updated": p.get("ingested_at")},
                    "co_benefits": {"sdgs": [], "labels": []},
                    "data_quality": {"score": 0, "cross_registered": False, "registries_count": 1},
                    "data_sources": [{"registry": registry.lower(), "url": p.get("project_url", ""), "last_scraped": datetime.now(timezone.utc).isoformat(), "raw_data": p}],
                }
                all_projects.append(proj)
                count += 1
        print(f"  {count} {registry} projects")

    # ========================================
    # DEDUPLICATION
    # ========================================
    print(f"\nTotal before dedup: {len(all_projects)}")
    print("Deduplicating...")

    # Group by country for efficient matching
    by_country = {}
    for i, p in enumerate(all_projects):
        c = p.get("location", {}).get("country", "UNKNOWN")
        if c not in by_country:
            by_country[c] = []
        by_country[c].append(i)

    merged_indices = set()
    merge_count = 0

    for country, indices in by_country.items():
        for a in range(len(indices)):
            for b in range(a + 1, len(indices)):
                i, j = indices[a], indices[b]
                if i in merged_indices or j in merged_indices:
                    continue
                p1, p2 = all_projects[i], all_projects[j]
                r1 = {s["registry"] for s in p1["data_sources"]}
                r2 = {s["registry"] for s in p2["data_sources"]}
                if r1 & r2:
                    continue

                score = compute_dedup_score(p1, p2)
                if score >= 0.5:
                    merged = merge_two(p1, p2)
                    all_projects[i] = merged
                    merged_indices.add(j)
                    merge_count += 1

    final = [p for i, p in enumerate(all_projects) if i not in merged_indices]
    print(f"Merged: {merge_count} pairs")
    print(f"Final count: {len(final)}")

    # ========================================
    # GEOCODING
    # ========================================
    print("\nGeocoding...")
    geocoded = 0
    for p in final:
        if p.get("location", {}).get("latitude") is None:
            country = p.get("location", {}).get("country", "")
            lat, lon = get_centroid(country)
            if lat is not None and lon is not None:
                p["location"]["latitude"] = lat
                p["location"]["longitude"] = lon
                geocoded += 1
    print(f"  Geocoded: {geocoded}")

    # ========================================
    # QUALITY SCORES
    # ========================================
    print("Computing quality scores...")
    for p in final:
        p["data_quality"]["score"] = compute_quality(p)

    # ========================================
    # SAVE
    # ========================================
    with open(OUTPUT_FILE, "w") as f:
        for p in final:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    # Stats
    has_coords = sum(1 for p in final if p.get("location", {}).get("latitude") is not None)
    has_name = sum(1 for p in final if p.get("project_type", {}).get("methodology_name"))
    has_desc = sum(1 for p in final if p.get("description"))
    has_code = sum(1 for p in final if p.get("project_type", {}).get("methodology"))
    cross = sum(1 for p in final if p["data_quality"]["cross_registered"])
    scores = [p["data_quality"]["score"] for p in final]

    print(f"\n{'=' * 60}")
    print("FINAL v2 DATASET")
    print(f"{'=' * 60}")
    print(f"Total projects: {len(final):,}")
    print(f"Coordinates: {has_coords}/{len(final)} ({100*has_coords/len(final):.1f}%)")
    print(f"Methodology names: {has_name}/{len(final)} ({100*has_name/len(final):.1f}%)")
    print(f"Methodology codes: {has_code}/{len(final)} ({100*has_code/len(final):.1f}%)")
    print(f"Descriptions: {has_desc}/{len(final)} ({100*has_desc/len(final):.1f}%)")
    print(f"Cross-registered: {cross}")
    print(f"Quality: avg={sum(scores)/len(scores):.3f}, max={max(scores):.3f}")
    print(f"Quality 0.7+: {sum(1 for s in scores if s >= 0.7)} ({100*sum(1 for s in scores if s >= 0.7)/len(final):.1f}%)")

    # Registry breakdown
    reg_counts = {}
    for p in final:
        for src in p["data_sources"]:
            reg = src["registry"]
            reg_counts[reg] = reg_counts.get(reg, 0) + 1
    print(f"\nRegistry breakdown:")
    for reg, count in sorted(reg_counts.items(), key=lambda x: -x[1]):
        print(f"  {reg}: {count}")

    size = os.path.getsize(OUTPUT_FILE)
    print(f"\nFile size: {size/1024/1024:.1f} MB")
    print(f"Saved to {OUTPUT_FILE}")


def map_verra_type(cats):
    if not cats: return "other"
    primary = cats.split(";")[0].strip().lower()
    if "agriculture" in cats.lower() or "forestry" in cats.lower() or "afolu" in primary: return "forestry"
    if "energy industry" in primary or "renewable" in primary: return "renewable_energy"
    if "energy demand" in primary: return "energy_efficiency"
    if "waste" in primary: return "waste"
    if "transport" in primary: return "transport"
    if "manufacturing" in primary or "industrial" in primary or "chemical" in primary: return "industrial"
    if "livestock" in primary or "agriculture" in primary: return "agriculture"
    if "carbon capture" in primary: return "industrial"
    if "fugitive" in primary: return "industrial"
    if "mining" in primary: return "industrial"
    return "other"

def map_gs_type(t):
    if not t: return "other"
    t = t.lower()
    if "energy efficiency" in t or "cookstove" in t or "water" in t: return "energy_efficiency"
    if "a/r" in t or "forest" in t or "redd" in t: return "forestry"
    if "pv" in t or "solar" in t or "wind" in t or "hydro" in t: return "renewable_energy"
    if "biogas" in t or "methane" in t: return "methane"
    if "transport" in t: return "transport"
    return "other"

def map_cdm_type(t):
    if not t: return "other"
    t = t.lower()
    if "hydro" in t or "wind" in t or "solar" in t or "geothermal" in t or "biomass energy" in t: return "renewable_energy"
    if "energy efficiency" in t or "fuel switch" in t or "cogeneration" in t: return "energy_efficiency"
    if "methane" in t or "landfill" in t or "waste" in t or "compost" in t: return "waste"
    if "forest" in t or "afforestation" in t or "reforestation" in t or "redd" in t: return "forestry"
    if "transport" in t: return "transport"
    if "cement" in t or "industrial" in t or "chemical" in t: return "industrial"
    if "agriculture" in t or "rice" in t: return "agriculture"
    if "coal" in t or "mine" in t or "fugitive" in t: return "industrial"
    return "other"

def map_carbonplan_category(category, project_type):
    cat = (category or "").lower()
    ptype = (project_type or "").lower()
    if "forest" in cat or "forest" in ptype or "redd" in ptype or "ifm" in ptype: return "forestry"
    if "methane" in cat or "landfill" in ptype or "livestock" in ptype: return "waste"
    if "soil" in cat or "agriculture" in ptype: return "agriculture"
    if "biochar" in cat or "biochar" in ptype: return "industrial"
    if "biomass" in cat: return "renewable_energy"
    return "other"

def compute_dedup_score(p1, p2):
    score = 0.0
    n1 = p1.get("name", "").lower().strip()
    n2 = p2.get("name", "").lower().strip()
    if n1 and n2:
        words1 = set(n1.split())
        words2 = set(n2.split())
        if words1 and words2:
            jaccard = len(words1 & words2) / len(words1 | words2)
            if jaccard > 0.5:
                score += 0.3 * jaccard
    d1 = (p1.get("developer") or {}).get("name") or ""
    d2 = (p2.get("developer") or {}).get("name") or ""
    d1, d2 = d1.lower(), d2.lower()
    if d1 and d2 and d1 == d2:
        score += 0.2
    c1 = p1.get("location", {}).get("country_code_iso3")
    c2 = p2.get("location", {}).get("country_code_iso3")
    if c1 and c2 and c1 == c2:
        score += 0.15
    t1 = p1.get("project_type", {}).get("category")
    t2 = p2.get("project_type", {}).get("category")
    if t1 and t2 and t1 == t2:
        score += 0.1
    m1 = p1.get("project_type", {}).get("methodology", "")
    m2 = p2.get("project_type", {}).get("methodology", "")
    if m1 and m2:
        m1b = m1.split(";")[0].strip().split("-")[0].strip()
        m2b = m2.split(";")[0].strip().split("-")[0].strip()
        if m1b == m2b:
            score += 0.15
    s1 = p1.get("crediting", {}).get("period_start", "")
    s2 = p2.get("crediting", {}).get("period_start", "")
    if s1 and s2 and s1[:4] == s2[:4]:
        score += 0.1
    return score

def merge_two(p1, p2):
    import copy
    merged = copy.deepcopy(p1)
    existing_ids = {(r["registry"], r["id"]) for r in merged["registry_ids"]}
    for r in p2["registry_ids"]:
        if (r["registry"], r["id"]) not in existing_ids:
            merged["registry_ids"].append(r)
    existing_src = {s["registry"] for s in merged["data_sources"]}
    for s in p2["data_sources"]:
        if s["registry"] not in existing_src:
            merged["data_sources"].append(s)
    if not merged.get("description") and p2.get("description"):
        merged["description"] = p2["description"]
    if (merged.get("location") or {}).get("latitude") is None and (p2.get("location") or {}).get("latitude") is not None:
        merged["location"]["latitude"] = p2["location"]["latitude"]
        merged["location"]["longitude"] = p2["location"]["longitude"]
    merged["data_quality"]["cross_registered"] = True
    merged["data_quality"]["registries_count"] = len(merged["registry_ids"])
    return merged


if __name__ == "__main__":
    main()
